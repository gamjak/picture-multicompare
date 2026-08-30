import { describe, expect, it } from 'vitest';

import {
  clampPercent,
  clipPathsFor,
  movePointByKey,
  pointFromClient,
} from './geometry';

describe('comparison geometry', () => {
  it('clamps values to the visible percentage range', () => {
    expect(clampPercent(-8)).toBe(0);
    expect(clampPercent(52.4)).toBe(52.4);
    expect(clampPercent(140)).toBe(100);
  });

  it('converts a pointer position into bounded percentages', () => {
    const rect = { left: 20, top: 40, width: 400, height: 200 };

    expect(pointFromClient(220, 90, rect)).toEqual({ x: 50, y: 25 });
    expect(pointFromClient(900, -20, rect)).toEqual({ x: 100, y: 0 });
  });

  it('moves the divider with normal and large keyboard steps', () => {
    expect(movePointByKey({ x: 50, y: 50 }, 'ArrowRight', 1)).toEqual({
      x: 51,
      y: 50,
    });
    expect(movePointByKey({ x: 50, y: 50 }, 'ArrowUp', 10)).toEqual({
      x: 50,
      y: 40,
    });
    expect(movePointByKey({ x: 0, y: 0 }, 'ArrowLeft', 10)).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('returns one full layer for one image', () => {
    expect(clipPathsFor(1, { x: 30, y: 70 })).toEqual(['inset(0 0 0 0)']);
  });

  it('splits two images vertically', () => {
    expect(clipPathsFor(2, { x: 30, y: 70 })).toEqual([
      'inset(0 70% 0 0)',
      'inset(0 0 0 30%)',
    ]);
  });

  it('creates a top and two bottom regions for three images', () => {
    expect(clipPathsFor(3, { x: 30, y: 70 })).toEqual([
      'inset(0 0 30% 0)',
      'polygon(0 70%, 30% 70%, 30% 100%, 0 100%)',
      'polygon(30% 70%, 100% 70%, 100% 100%, 30% 100%)',
    ]);
  });

  it('creates four quadrants for four images', () => {
    expect(clipPathsFor(4, { x: 30, y: 70 })).toEqual([
      'inset(0 70% 30% 0)',
      'inset(0 0 30% 30%)',
      'inset(70% 0 0 30%)',
      'inset(70% 70% 0 0)',
    ]);
  });
});
