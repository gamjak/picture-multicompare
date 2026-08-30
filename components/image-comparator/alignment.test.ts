import { describe, expect, it } from 'vitest';

import {
  applyMatrix,
  applySimilarity,
  displayMatrixFor,
  estimateSimilarity,
  fitContainRect,
  invertMatrix,
  matrixToCss,
  triangleSpread,
} from './alignment';
import type { Point, SimilarityTransform } from './types';

const expectPointClose = (actual: Point, expected: Point, digits = 5) => {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
};

describe('similarity alignment geometry', () => {
  it('recovers translation, slight rotation, and uniform scale', () => {
    const source = [
      { x: 100, y: 80 },
      { x: 420, y: 90 },
      { x: 160, y: 360 },
    ];
    const expected: SimilarityTransform = {
      scale: 1.04,
      rotation: (5 * Math.PI) / 180,
      translateX: 18,
      translateY: -11,
    };
    const target = source.map((point) => applySimilarity(point, expected));

    const actual = estimateSimilarity(source, target);

    expect(actual).not.toBeNull();
    expect(actual?.scale).toBeCloseTo(expected.scale, 5);
    expect(actual?.rotation).toBeCloseTo(expected.rotation, 5);
    expect(actual?.translateX).toBeCloseTo(expected.translateX, 5);
    expect(actual?.translateY).toBeCloseTo(expected.translateY, 5);
  });

  it('uses every point in a least-squares fit', () => {
    const source = [
      { x: 30, y: 20 },
      { x: 310, y: 45 },
      { x: 80, y: 260 },
    ];
    const expected: SimilarityTransform = {
      scale: 0.97,
      rotation: (-3 * Math.PI) / 180,
      translateX: -7,
      translateY: 13,
    };
    const noise = [
      { x: 0.2, y: -0.1 },
      { x: -0.15, y: 0.25 },
      { x: 0.1, y: -0.2 },
    ];
    const target = source.map((point, index) => {
      const transformed = applySimilarity(point, expected);
      return {
        x: transformed.x + noise[index].x,
        y: transformed.y + noise[index].y,
      };
    });

    const actual = estimateSimilarity(source, target);

    expect(actual?.scale).toBeCloseTo(expected.scale, 2);
    expect(actual?.rotation).toBeCloseTo(expected.rotation, 2);
    expect(actual?.translateX).toBeCloseTo(expected.translateX, 0);
    expect(actual?.translateY).toBeCloseTo(expected.translateY, 0);
  });

  it('rejects duplicate and collinear three-point sets', () => {
    expect(
      estimateSimilarity(
        [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        [
          { x: 2, y: 3 },
          { x: 2, y: 3 },
          { x: 4, y: 5 },
        ],
      ),
    ).toBeNull();

    expect(
      estimateSimilarity(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 2, y: 2 },
        ],
        [
          { x: 5, y: 2 },
          { x: 6, y: 3 },
          { x: 7, y: 4 },
        ],
      ),
    ).toBeNull();
  });

  it('measures how widely a normalized three-point set is distributed', () => {
    expect(
      triangleSpread([
        { x: 0.1, y: 0.1 },
        { x: 0.9, y: 0.15 },
        { x: 0.2, y: 0.85 },
      ]),
    ).toBeCloseTo(0.595, 5);
    expect(
      triangleSpread([
        { x: 0.1, y: 0.1 },
        { x: 0.2, y: 0.2 },
        { x: 0.3, y: 0.3 },
      ]),
    ).toBe(0);
  });

  it('computes centered contain rectangles with letterbox gutters', () => {
    expect(
      fitContainRect(
        { width: 1200, height: 800 },
        { width: 900, height: 900 },
      ),
    ).toEqual({ x: 0, y: 150, width: 900, height: 600, scale: 0.75 });

    expect(
      fitContainRect(
        { width: 800, height: 1200 },
        { width: 900, height: 600 },
      ),
    ).toEqual({ x: 250, y: 0, width: 400, height: 600, scale: 0.5 });
  });

  it('maps target content into the reference contain rectangle', () => {
    const targetMetrics = { width: 800, height: 1200 };
    const referenceMetrics = { width: 1200, height: 800 };
    const stage = { width: 900, height: 600 };
    const transform: SimilarityTransform = {
      scale: 1,
      rotation: 0,
      translateX: 100,
      translateY: 50,
    };
    const matrix = displayMatrixFor(
      transform,
      targetMetrics,
      referenceMetrics,
      stage,
    );
    const targetFit = fitContainRect(targetMetrics, stage);
    const referenceFit = fitContainRect(referenceMetrics, stage);
    const intrinsicTarget = { x: 300, y: 400 };
    const displayedTarget = {
      x: targetFit.x + intrinsicTarget.x * targetFit.scale,
      y: targetFit.y + intrinsicTarget.y * targetFit.scale,
    };
    const intrinsicReference = applySimilarity(intrinsicTarget, transform);
    const expectedReference = {
      x: referenceFit.x + intrinsicReference.x * referenceFit.scale,
      y: referenceFit.y + intrinsicReference.y * referenceFit.scale,
    };

    expectPointClose(applyMatrix(displayedTarget, matrix), expectedReference);
    expectPointClose(
      applyMatrix(expectedReference, invertMatrix(matrix)!),
      displayedTarget,
    );
    expect(matrixToCss(matrix)).toMatch(/^matrix\(/);
  });

  it('recomputes display translation when the stage is resized', () => {
    const transform: SimilarityTransform = {
      scale: 1,
      rotation: 0,
      translateX: 24,
      translateY: -12,
    };
    const metrics = { width: 1200, height: 800 };

    const small = displayMatrixFor(transform, metrics, metrics, {
      width: 600,
      height: 400,
    });
    const large = displayMatrixFor(transform, metrics, metrics, {
      width: 1200,
      height: 800,
    });

    expect(small.e).toBeCloseTo(12, 5);
    expect(small.f).toBeCloseTo(-6, 5);
    expect(large.e).toBeCloseTo(24, 5);
    expect(large.f).toBeCloseTo(-12, 5);
  });
});
