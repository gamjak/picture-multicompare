import {
  applySimilarity,
  estimateSimilarity,
  triangleSpread,
} from './alignment';
import type {
  AlignmentAnchor,
  AlignmentFailureReason,
  SimilarityTransform,
} from './types';

export type GrayImage = {
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  pixels: Float32Array;
};

export type FeaturePoint = {
  x: number;
  y: number;
  score: number;
  descriptor: Float32Array;
};

export type FeatureMatch = {
  reference: FeaturePoint;
  target: FeaturePoint;
  distance: number;
};

export type AlignmentResult =
  | {
      status: 'aligned';
      transform: SimilarityTransform;
      anchors: AlignmentAnchor[];
      confidence: number;
      rmsError: number;
    }
  | {
      status: 'failed';
      reason: AlignmentFailureReason;
    };

const PATCH_RADIUS = 8;
const DESCRIPTOR_SIDE = 5;
const DESCRIPTOR_SPACING = 3;
const FEATURE_LIMIT = 240;
const MATCH_RATIO = 0.78;
const MAX_ROTATION = (15 * Math.PI) / 180;
const MIN_SCALE = 0.75;
const MAX_SCALE = 1.33;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function rgbaToGray(rgba: Uint8ClampedArray): Float32Array {
  const pixels = new Float32Array(Math.floor(rgba.length / 4));

  for (let source = 0, target = 0; source < rgba.length; source += 4) {
    pixels[target] =
      (0.2126 * rgba[source] +
        0.7152 * rgba[source + 1] +
        0.0722 * rgba[source + 2]) /
      255;
    target += 1;
  }

  return pixels;
}

const waitForImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Bild konnte nicht dekodiert werden.'));
    image.src = url;
  });

export async function decodeGrayImage(
  url: string,
  maximumSide = 480,
): Promise<GrayImage> {
  const image = await waitForImage(url);
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const downscale = Math.min(1, maximumSide / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * downscale));
  const height = Math.max(1, Math.round(sourceHeight * downscale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    throw new Error('Lokale Bildanalyse ist in diesem Browser nicht verfügbar.');
  }

  context.drawImage(image, 0, 0, width, height);
  const rgba = context.getImageData(0, 0, width, height).data;

  return {
    width,
    height,
    sourceWidth,
    sourceHeight,
    pixels: rgbaToGray(rgba),
  };
}

function sample(image: GrayImage, x: number, y: number): number {
  const boundedX = clamp(x, 0, image.width - 1);
  const boundedY = clamp(y, 0, image.height - 1);
  const left = Math.floor(boundedX);
  const top = Math.floor(boundedY);
  const right = Math.min(image.width - 1, left + 1);
  const bottom = Math.min(image.height - 1, top + 1);
  const xMix = boundedX - left;
  const yMix = boundedY - top;
  const topValue =
    image.pixels[top * image.width + left] * (1 - xMix) +
    image.pixels[top * image.width + right] * xMix;
  const bottomValue =
    image.pixels[bottom * image.width + left] * (1 - xMix) +
    image.pixels[bottom * image.width + right] * xMix;
  return topValue * (1 - yMix) + bottomValue * yMix;
}

function gradientsFor(image: GrayImage) {
  const xGradient = new Float32Array(image.width * image.height);
  const yGradient = new Float32Array(image.width * image.height);

  for (let y = 1; y < image.height - 1; y += 1) {
    for (let x = 1; x < image.width - 1; x += 1) {
      const topLeft = image.pixels[(y - 1) * image.width + x - 1];
      const top = image.pixels[(y - 1) * image.width + x];
      const topRight = image.pixels[(y - 1) * image.width + x + 1];
      const left = image.pixels[y * image.width + x - 1];
      const right = image.pixels[y * image.width + x + 1];
      const bottomLeft = image.pixels[(y + 1) * image.width + x - 1];
      const bottom = image.pixels[(y + 1) * image.width + x];
      const bottomRight = image.pixels[(y + 1) * image.width + x + 1];
      const index = y * image.width + x;
      xGradient[index] =
        -topLeft + topRight - 2 * left + 2 * right - bottomLeft + bottomRight;
      yGradient[index] =
        -topLeft - 2 * top - topRight + bottomLeft + 2 * bottom + bottomRight;
    }
  }

  return { xGradient, yGradient };
}

function descriptorAt(
  image: GrayImage,
  xGradient: Float32Array,
  yGradient: Float32Array,
  x: number,
  y: number,
): Float32Array {
  let orientationX = 0;
  let orientationY = 0;

  for (let offsetY = -4; offsetY <= 4; offsetY += 1) {
    for (let offsetX = -4; offsetX <= 4; offsetX += 1) {
      const index = (y + offsetY) * image.width + x + offsetX;
      orientationX += xGradient[index];
      orientationY += yGradient[index];
    }
  }

  const orientation = Math.atan2(orientationY, orientationX);
  const cosine = Math.cos(orientation);
  const sine = Math.sin(orientation);
  const descriptor = new Float32Array(DESCRIPTOR_SIDE * DESCRIPTOR_SIDE);
  let mean = 0;
  let cursor = 0;

  for (let row = -2; row <= 2; row += 1) {
    for (let column = -2; column <= 2; column += 1) {
      const localX = column * DESCRIPTOR_SPACING;
      const localY = row * DESCRIPTOR_SPACING;
      const sampleX = x + cosine * localX - sine * localY;
      const sampleY = y + sine * localX + cosine * localY;
      const value = sample(image, sampleX, sampleY);
      descriptor[cursor] = value;
      mean += value;
      cursor += 1;
    }
  }

  mean /= descriptor.length;
  let magnitude = 0;

  for (let index = 0; index < descriptor.length; index += 1) {
    descriptor[index] -= mean;
    magnitude += descriptor[index] * descriptor[index];
  }

  magnitude = Math.sqrt(magnitude);
  if (magnitude > 1e-8) {
    for (let index = 0; index < descriptor.length; index += 1) {
      descriptor[index] /= magnitude;
    }
  }

  return descriptor;
}

export function detectFeatures(image: GrayImage): FeaturePoint[] {
  if (
    image.width < PATCH_RADIUS * 2 + 3 ||
    image.height < PATCH_RADIUS * 2 + 3 ||
    image.pixels.length !== image.width * image.height
  ) {
    return [];
  }

  const { xGradient, yGradient } = gradientsFor(image);
  const responses = new Float32Array(image.width * image.height);
  const positiveResponses: number[] = [];

  for (let y = PATCH_RADIUS; y < image.height - PATCH_RADIUS; y += 1) {
    for (let x = PATCH_RADIUS; x < image.width - PATCH_RADIUS; x += 1) {
      let xx = 0;
      let yy = 0;
      let xy = 0;

      for (let windowY = -2; windowY <= 2; windowY += 1) {
        for (let windowX = -2; windowX <= 2; windowX += 1) {
          const index = (y + windowY) * image.width + x + windowX;
          const gradientX = xGradient[index];
          const gradientY = yGradient[index];
          xx += gradientX * gradientX;
          yy += gradientY * gradientY;
          xy += gradientX * gradientY;
        }
      }

      const determinant = xx * yy - xy * xy;
      const trace = xx + yy;
      const response = determinant - 0.04 * trace * trace;
      const index = y * image.width + x;
      responses[index] = response;
      if (response > 1e-7) {
        positiveResponses.push(response);
      }
    }
  }

  if (positiveResponses.length < 3) {
    return [];
  }

  positiveResponses.sort((left, right) => left - right);
  const threshold = positiveResponses[Math.floor(positiveResponses.length * 0.85)];
  const candidates: Array<{ x: number; y: number; score: number }> = [];

  for (let y = PATCH_RADIUS; y < image.height - PATCH_RADIUS; y += 1) {
    for (let x = PATCH_RADIUS; x < image.width - PATCH_RADIUS; x += 1) {
      const score = responses[y * image.width + x];
      if (score < threshold) {
        continue;
      }

      let localMaximum = true;
      for (let offsetY = -2; offsetY <= 2 && localMaximum; offsetY += 1) {
        for (let offsetX = -2; offsetX <= 2; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) {
            continue;
          }
          if (responses[(y + offsetY) * image.width + x + offsetX] > score) {
            localMaximum = false;
            break;
          }
        }
      }

      if (localMaximum) {
        candidates.push({ x, y, score });
      }
    }
  }

  candidates.sort((left, right) => right.score - left.score);
  const accepted: FeaturePoint[] = [];
  const perCell = new Map<string, number>();
  const cellWidth = image.width / 4;
  const cellHeight = image.height / 4;

  for (const candidate of candidates) {
    const cell = `${Math.min(3, Math.floor(candidate.x / cellWidth))}:${Math.min(3, Math.floor(candidate.y / cellHeight))}`;
    if ((perCell.get(cell) ?? 0) >= 12) {
      continue;
    }
    if (
      accepted.some((feature) => {
        const dx = feature.x - candidate.x;
        const dy = feature.y - candidate.y;
        return dx * dx + dy * dy < 36;
      })
    ) {
      continue;
    }

    accepted.push({
      ...candidate,
      descriptor: descriptorAt(
        image,
        xGradient,
        yGradient,
        candidate.x,
        candidate.y,
      ),
    });
    perCell.set(cell, (perCell.get(cell) ?? 0) + 1);

    if (accepted.length >= FEATURE_LIMIT) {
      break;
    }
  }

  return accepted;
}

function descriptorDistance(left: Float32Array, right: Float32Array): number {
  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    const difference = left[index] - right[index];
    distance += difference * difference;
  }
  return distance;
}

type Nearest = { index: number; best: number; second: number };

function nearestDescriptors(
  source: FeaturePoint[],
  candidates: FeaturePoint[],
): Nearest[] {
  return source.map((feature) => {
    let best = Number.POSITIVE_INFINITY;
    let second = Number.POSITIVE_INFINITY;
    let bestIndex = -1;

    candidates.forEach((candidate, index) => {
      const distance = descriptorDistance(feature.descriptor, candidate.descriptor);
      if (distance < best) {
        second = best;
        best = distance;
        bestIndex = index;
      } else if (distance < second) {
        second = distance;
      }
    });

    return { index: bestIndex, best, second };
  });
}

export function matchFeatures(
  reference: FeaturePoint[],
  target: FeaturePoint[],
): FeatureMatch[] {
  if (reference.length < 3 || target.length < 3) {
    return [];
  }

  const referenceToTarget = nearestDescriptors(reference, target);
  const targetToReference = nearestDescriptors(target, reference);
  const matches: FeatureMatch[] = [];

  referenceToTarget.forEach((nearest, referenceIndex) => {
    if (
      nearest.index < 0 ||
      !Number.isFinite(nearest.second) ||
      nearest.best >= nearest.second * MATCH_RATIO
    ) {
      return;
    }

    const reverse = targetToReference[nearest.index];
    if (
      reverse.index !== referenceIndex ||
      !Number.isFinite(reverse.second) ||
      reverse.best >= reverse.second * MATCH_RATIO
    ) {
      return;
    }

    matches.push({
      reference: reference[referenceIndex],
      target: target[nearest.index],
      distance: nearest.best,
    });
  });

  return matches.sort((left, right) => left.distance - right.distance);
}

function twoPointSimilarity(
  first: FeatureMatch,
  second: FeatureMatch,
): SimilarityTransform | null {
  const sourceX = second.target.x - first.target.x;
  const sourceY = second.target.y - first.target.y;
  const targetX = second.reference.x - first.reference.x;
  const targetY = second.reference.y - first.reference.y;
  const sourceLength = Math.hypot(sourceX, sourceY);
  const targetLength = Math.hypot(targetX, targetY);

  if (sourceLength < 8 || targetLength < 8) {
    return null;
  }

  const scale = targetLength / sourceLength;
  const rotation =
    Math.atan2(targetY, targetX) - Math.atan2(sourceY, sourceX);
  if (
    scale < MIN_SCALE ||
    scale > MAX_SCALE ||
    Math.abs(rotation) > MAX_ROTATION
  ) {
    return null;
  }

  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return {
    scale,
    rotation,
    translateX:
      first.reference.x -
      scale * (cosine * first.target.x - sine * first.target.y),
    translateY:
      first.reference.y -
      scale * (sine * first.target.x + cosine * first.target.y),
  };
}

function residual(match: FeatureMatch, transform: SimilarityTransform): number {
  const point = applySimilarity(match.target, transform);
  return Math.hypot(
    point.x - match.reference.x,
    point.y - match.reference.y,
  );
}

function chooseAnchors(
  matches: FeatureMatch[],
  reference: GrayImage,
  target: GrayImage,
): AlignmentAnchor[] | null {
  const candidates = matches.slice(0, 30);
  let best: [FeatureMatch, FeatureMatch, FeatureMatch] | null = null;
  let bestValue = 0;

  for (let first = 0; first < candidates.length - 2; first += 1) {
    for (let second = first + 1; second < candidates.length - 1; second += 1) {
      for (let third = second + 1; third < candidates.length; third += 1) {
        const triple: [FeatureMatch, FeatureMatch, FeatureMatch] = [
          candidates[first],
          candidates[second],
          candidates[third],
        ];
        const area = triangleSpread(
          triple.map((match) => ({
            x: match.reference.x / Math.max(1, reference.width - 1),
            y: match.reference.y / Math.max(1, reference.height - 1),
          })),
        );
        const distancePenalty =
          1 + triple.reduce((sum, match) => sum + match.distance, 0) / 3;
        const value = area / distancePenalty;
        if (value > bestValue) {
          bestValue = value;
          best = triple;
        }
      }
    }
  }

  if (!best || bestValue < 0.01) {
    return null;
  }

  return best.map((match) => ({
    reference: {
      x: match.reference.x / Math.max(1, reference.width - 1),
      y: match.reference.y / Math.max(1, reference.height - 1),
    },
    target: {
      x: match.target.x / Math.max(1, target.width - 1),
      y: match.target.y / Math.max(1, target.height - 1),
    },
  }));
}

export function alignGrayImages(
  reference: GrayImage,
  target: GrayImage,
): AlignmentResult {
  const referenceFeatures = detectFeatures(reference);
  const targetFeatures = detectFeatures(target);

  if (referenceFeatures.length < 3 || targetFeatures.length < 3) {
    return { status: 'failed', reason: 'not-enough-detail' };
  }

  const matches = matchFeatures(referenceFeatures, targetFeatures);
  if (matches.length < 3) {
    return { status: 'failed', reason: 'ambiguous' };
  }

  const inlierThreshold = Math.max(
    3,
    0.012 * Math.hypot(reference.width, reference.height),
  );
  let bestInliers: FeatureMatch[] = [];
  let bestRms = Number.POSITIVE_INFINITY;

  for (let first = 0; first < matches.length - 1; first += 1) {
    for (let second = first + 1; second < matches.length; second += 1) {
      const hypothesis = twoPointSimilarity(matches[first], matches[second]);
      if (!hypothesis) {
        continue;
      }

      const inliers = matches.filter(
        (match) => residual(match, hypothesis) <= inlierThreshold,
      );
      if (inliers.length < 3) {
        continue;
      }

      const rms = Math.sqrt(
        inliers.reduce((sum, match) => {
          const error = residual(match, hypothesis);
          return sum + error * error;
        }, 0) / inliers.length,
      );
      if (
        inliers.length > bestInliers.length ||
        (inliers.length === bestInliers.length && rms < bestRms)
      ) {
        bestInliers = inliers;
        bestRms = rms;
      }
    }
  }

  if (bestInliers.length < 3) {
    return { status: 'failed', reason: 'ambiguous' };
  }

  const analysisTransform = estimateSimilarity(
    bestInliers.map((match) => match.target),
    bestInliers.map((match) => match.reference),
  );
  if (!analysisTransform) {
    return { status: 'failed', reason: 'ambiguous' };
  }

  const refinedInliers = matches.filter(
    (match) => residual(match, analysisTransform) <= inlierThreshold,
  );
  const rms = Math.sqrt(
    refinedInliers.reduce((sum, match) => {
      const error = residual(match, analysisTransform);
      return sum + error * error;
    }, 0) / refinedInliers.length,
  );
  const referenceDiagonal = Math.hypot(reference.width, reference.height);
  const anchors = chooseAnchors(refinedInliers, reference, target);

  if (
    !anchors ||
    refinedInliers.length < 3 ||
    rms > referenceDiagonal * 0.015 ||
    analysisTransform.scale < MIN_SCALE ||
    analysisTransform.scale > MAX_SCALE ||
    Math.abs(analysisTransform.rotation) > MAX_ROTATION
  ) {
    return { status: 'failed', reason: 'out-of-range' };
  }

  const referenceScale = reference.width / reference.sourceWidth;
  const targetScale = target.width / target.sourceWidth;
  const transform: SimilarityTransform = {
    scale: (analysisTransform.scale * targetScale) / referenceScale,
    rotation: analysisTransform.rotation,
    translateX: analysisTransform.translateX / referenceScale,
    translateY: analysisTransform.translateY / referenceScale,
  };
  const inlierRatio = refinedInliers.length / matches.length;
  const errorQuality = 1 - clamp(rms / (referenceDiagonal * 0.015), 0, 1);
  const spreadQuality = clamp(
    triangleSpread(anchors.map((anchor) => anchor.reference)) / 0.25,
    0,
    1,
  );
  const descriptorQuality =
    1 -
    clamp(
      refinedInliers.reduce((sum, match) => sum + match.distance, 0) /
        refinedInliers.length /
        2,
      0,
      1,
    );
  const confidence = clamp(
    0.42 +
      0.2 * inlierRatio +
      0.16 * errorQuality +
      0.12 * spreadQuality +
      0.1 * descriptorQuality,
    0,
    1,
  );

  return {
    status: 'aligned',
    transform,
    anchors,
    confidence,
    rmsError: rms / referenceScale,
  };
}

export async function analyzeImagePair(
  referenceUrl: string,
  targetUrl: string,
): Promise<AlignmentResult> {
  try {
    const [reference, target] = await Promise.all([
      decodeGrayImage(referenceUrl),
      decodeGrayImage(targetUrl),
    ]);
    return alignGrayImages(reference, target);
  } catch {
    return { status: 'failed', reason: 'not-enough-detail' };
  }
}
