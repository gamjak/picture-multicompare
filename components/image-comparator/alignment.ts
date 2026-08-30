import type {
  ContainRect,
  CssMatrix,
  ImageMetrics,
  Point,
  SimilarityTransform,
  StageSize,
} from './types';

export const IDENTITY_MATRIX: CssMatrix = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0,
};

const EPSILON = 1e-9;

const isFinitePoint = (point: Point) =>
  Number.isFinite(point.x) && Number.isFinite(point.y);

const hasDuplicatePoints = (points: Point[]) =>
  points.some((point, index) =>
    points.slice(index + 1).some((candidate) => {
      const dx = point.x - candidate.x;
      const dy = point.y - candidate.y;
      return dx * dx + dy * dy <= EPSILON;
    }),
  );

export function triangleSpread(points: Point[]): number {
  let largestDoubleArea = 0;

  for (let first = 0; first < points.length - 2; first += 1) {
    for (let second = first + 1; second < points.length - 1; second += 1) {
      for (let third = second + 1; third < points.length; third += 1) {
        const a = points[first];
        const b = points[second];
        const c = points[third];
        const doubleArea = Math.abs(
          (b.x - a.x) * (c.y - a.y) -
            (b.y - a.y) * (c.x - a.x),
        );
        largestDoubleArea = Math.max(largestDoubleArea, doubleArea);
      }
    }
  }

  return largestDoubleArea;
}

function normalizedTriangleSpread(points: Point[]): number {
  if (points.length < 3) {
    return 0;
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const diagonalSquared = width * width + height * height;

  if (diagonalSquared <= EPSILON) {
    return 0;
  }

  return triangleSpread(points) / diagonalSquared;
}

export function applySimilarity(
  point: Point,
  transform: SimilarityTransform,
): Point {
  const cosine = Math.cos(transform.rotation);
  const sine = Math.sin(transform.rotation);

  return {
    x:
      transform.scale * (cosine * point.x - sine * point.y) +
      transform.translateX,
    y:
      transform.scale * (sine * point.x + cosine * point.y) +
      transform.translateY,
  };
}

export function estimateSimilarity(
  source: Point[],
  target: Point[],
): SimilarityTransform | null {
  if (
    source.length < 3 ||
    source.length !== target.length ||
    source.some((point) => !isFinitePoint(point)) ||
    target.some((point) => !isFinitePoint(point)) ||
    hasDuplicatePoints(source) ||
    hasDuplicatePoints(target) ||
    normalizedTriangleSpread(source) <= 1e-6 ||
    normalizedTriangleSpread(target) <= 1e-6
  ) {
    return null;
  }

  const sourceMean = source.reduce(
    (mean, point) => ({ x: mean.x + point.x, y: mean.y + point.y }),
    { x: 0, y: 0 },
  );
  const targetMean = target.reduce(
    (mean, point) => ({ x: mean.x + point.x, y: mean.y + point.y }),
    { x: 0, y: 0 },
  );
  sourceMean.x /= source.length;
  sourceMean.y /= source.length;
  targetMean.x /= target.length;
  targetMean.y /= target.length;

  let denominator = 0;
  let dot = 0;
  let cross = 0;

  for (let index = 0; index < source.length; index += 1) {
    const sourceX = source[index].x - sourceMean.x;
    const sourceY = source[index].y - sourceMean.y;
    const targetX = target[index].x - targetMean.x;
    const targetY = target[index].y - targetMean.y;
    denominator += sourceX * sourceX + sourceY * sourceY;
    dot += sourceX * targetX + sourceY * targetY;
    cross += sourceX * targetY - sourceY * targetX;
  }

  if (denominator <= EPSILON) {
    return null;
  }

  const real = dot / denominator;
  const imaginary = cross / denominator;
  const scale = Math.hypot(real, imaginary);
  const rotation = Math.atan2(imaginary, real);

  if (!Number.isFinite(scale) || scale <= EPSILON) {
    return null;
  }

  const transformedMean = applySimilarity(sourceMean, {
    scale,
    rotation,
    translateX: 0,
    translateY: 0,
  });
  const transform = {
    scale,
    rotation,
    translateX: targetMean.x - transformedMean.x,
    translateY: targetMean.y - transformedMean.y,
  };

  return Object.values(transform).every(Number.isFinite) ? transform : null;
}

export function fitContainRect(
  image: ImageMetrics,
  stage: StageSize,
): ContainRect {
  if (
    image.width <= 0 ||
    image.height <= 0 ||
    stage.width <= 0 ||
    stage.height <= 0
  ) {
    return { x: 0, y: 0, width: 0, height: 0, scale: 0 };
  }

  const scale = Math.min(stage.width / image.width, stage.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;

  return {
    x: (stage.width - width) / 2,
    y: (stage.height - height) / 2,
    width,
    height,
    scale,
  };
}

function fitMatrix(rect: ContainRect): CssMatrix {
  return {
    a: rect.scale,
    b: 0,
    c: 0,
    d: rect.scale,
    e: rect.x,
    f: rect.y,
  };
}

function similarityMatrix(transform: SimilarityTransform): CssMatrix {
  const cosine = Math.cos(transform.rotation) * transform.scale;
  const sine = Math.sin(transform.rotation) * transform.scale;

  return {
    a: cosine,
    b: sine,
    c: -sine,
    d: cosine,
    e: transform.translateX,
    f: transform.translateY,
  };
}

export function multiplyMatrices(left: CssMatrix, right: CssMatrix): CssMatrix {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
}

export function invertMatrix(matrix: CssMatrix): CssMatrix | null {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;

  if (Math.abs(determinant) <= EPSILON) {
    return null;
  }

  return {
    a: matrix.d / determinant,
    b: -matrix.b / determinant,
    c: -matrix.c / determinant,
    d: matrix.a / determinant,
    e: (matrix.c * matrix.f - matrix.d * matrix.e) / determinant,
    f: (matrix.b * matrix.e - matrix.a * matrix.f) / determinant,
  };
}

export function applyMatrix(point: Point, matrix: CssMatrix): Point {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f,
  };
}

export function displayMatrixFor(
  transform: SimilarityTransform | null,
  targetMetrics: ImageMetrics,
  referenceMetrics: ImageMetrics,
  stage: StageSize,
): CssMatrix {
  if (!transform) {
    return IDENTITY_MATRIX;
  }

  const targetFit = fitContainRect(targetMetrics, stage);
  const referenceFit = fitContainRect(referenceMetrics, stage);
  const inverseTargetFit = invertMatrix(fitMatrix(targetFit));

  if (!inverseTargetFit || referenceFit.scale <= 0) {
    return IDENTITY_MATRIX;
  }

  return multiplyMatrices(
    fitMatrix(referenceFit),
    multiplyMatrices(similarityMatrix(transform), inverseTargetFit),
  );
}

const cleanNumber = (value: number) => {
  const rounded = Math.abs(value) < 1e-12 ? 0 : Number(value.toFixed(8));
  return Object.is(rounded, -0) ? 0 : rounded;
};

export function matrixToCss(matrix: CssMatrix): string {
  return `matrix(${[
    matrix.a,
    matrix.b,
    matrix.c,
    matrix.d,
    matrix.e,
    matrix.f,
  ]
    .map(cleanNumber)
    .join(', ')})`;
}
