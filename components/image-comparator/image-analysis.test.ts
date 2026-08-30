import { describe, expect, it } from 'vitest';

import {
  alignGrayImages,
  detectFeatures,
  rgbaToGray,
  type GrayImage,
} from './image-analysis';

const makeImage = (width: number, height: number, fill = 0.12): GrayImage => ({
  width,
  height,
  sourceWidth: width,
  sourceHeight: height,
  pixels: new Float32Array(width * height).fill(fill),
});

const setPixel = (image: GrayImage, x: number, y: number, value: number) => {
  if (x >= 0 && x < image.width && y >= 0 && y < image.height) {
    image.pixels[y * image.width + x] = value;
  }
};

const drawRect = (
  image: GrayImage,
  x: number,
  y: number,
  width: number,
  height: number,
  value: number,
) => {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      setPixel(image, column, row, value);
    }
  }
};

const distinctiveFixture = () => {
  const image = makeImage(180, 140, 0.08);

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      image.pixels[y * image.width + x] +=
        ((x * 17 + y * 29 + ((x * y) % 37)) % 23) / 500;
    }
  }

  drawRect(image, 18, 18, 25, 17, 0.92);
  drawRect(image, 27, 26, 8, 30, 0.36);
  drawRect(image, 122, 15, 31, 11, 0.7);
  drawRect(image, 142, 24, 11, 31, 0.7);
  drawRect(image, 95, 88, 38, 26, 0.84);
  drawRect(image, 103, 96, 22, 10, 0.18);
  drawRect(image, 25, 98, 14, 27, 0.62);
  drawRect(image, 39, 112, 25, 13, 0.62);

  for (let offset = 0; offset < 25; offset += 1) {
    setPixel(image, 72 + offset, 45 + offset, 0.96);
    setPixel(image, 73 + offset, 45 + offset, 0.96);
  }

  return image;
};

const sampleNearest = (image: GrayImage, x: number, y: number) => {
  const roundedX = Math.round(x);
  const roundedY = Math.round(y);
  if (
    roundedX < 0 ||
    roundedX >= image.width ||
    roundedY < 0 ||
    roundedY >= image.height
  ) {
    return 0.08;
  }
  return image.pixels[roundedY * image.width + roundedX];
};

const transformedFixture = (
  reference: GrayImage,
  scale: number,
  rotation: number,
  translateX: number,
  translateY: number,
) => {
  const target = makeImage(reference.width, reference.height, 0.08);
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);

  for (let y = 0; y < target.height; y += 1) {
    for (let x = 0; x < target.width; x += 1) {
      const shiftedX = x - translateX;
      const shiftedY = y - translateY;
      const sourceX = (cosine * shiftedX + sine * shiftedY) / scale;
      const sourceY = (-sine * shiftedX + cosine * shiftedY) / scale;
      target.pixels[y * target.width + x] = sampleNearest(
        reference,
        sourceX,
        sourceY,
      );
    }
  }

  return target;
};

describe('local image feature analysis', () => {
  it('converts RGBA pixels to normalized perceptual luminance', () => {
    const gray = rgbaToGray(
      new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]),
    );

    expect([...gray]).toEqual([
      expect.closeTo(0.2126, 4),
      expect.closeTo(0.7152, 4),
      expect.closeTo(0.0722, 4),
    ]);
  });

  it('finds strong points across separate parts of a detailed image', () => {
    const features = detectFeatures(distinctiveFixture());
    const occupiedQuadrants = new Set(
      features.map(
        (feature) =>
          `${feature.x < 90 ? 'left' : 'right'}-${feature.y < 70 ? 'top' : 'bottom'}`,
      ),
    );

    expect(features.length).toBeGreaterThanOrEqual(12);
    expect(occupiedQuadrants.size).toBe(4);
  });

  it('recovers a small translation, rotation, and uniform scale', () => {
    const reference = distinctiveFixture();
    const target = transformedFixture(
      reference,
      1.02,
      (3 * Math.PI) / 180,
      5,
      -4,
    );

    const result = alignGrayImages(reference, target);

    expect(result.status).toBe('aligned');
    if (result.status === 'aligned') {
      expect(result.anchors).toHaveLength(3);
      expect(result.confidence).toBeGreaterThanOrEqual(0.62);
      expect(result.transform.scale).toBeCloseTo(0.9804, 1);
      expect(result.transform.rotation).toBeCloseTo((-3 * Math.PI) / 180, 1);
      expect(result.transform.translateX).toBeCloseTo(-4.69, 0);
      expect(result.transform.translateY).toBeCloseTo(4.17, 0);
    }
  });

  it('returns a safe failure for an image without detail', () => {
    expect(alignGrayImages(makeImage(160, 120), makeImage(160, 120))).toEqual({
      status: 'failed',
      reason: 'not-enough-detail',
    });
  });

  it('does not force an alignment for an ambiguous repeated pattern', () => {
    const checker = makeImage(160, 120, 0);
    for (let y = 0; y < checker.height; y += 1) {
      for (let x = 0; x < checker.width; x += 1) {
        checker.pixels[y * checker.width + x] =
          (Math.floor(x / 10) + Math.floor(y / 10)) % 2 === 0 ? 0.1 : 0.9;
      }
    }

    const result = alignGrayImages(checker, checker);

    expect(result.status).toBe('failed');
  });
});
