import { describe, expect, it } from 'vitest';

import {
  clampPercent,
  clipPathsFor,
  dividerSegmentsFor,
  labelPositionsFor,
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

  it('creates an X with top, right, bottom, and left regions for four images', () => {
    expect(clipPathsFor(4, { x: 30, y: 70 })).toEqual([
      'polygon(30% 70%, 0% 0%, 100% 0%)',
      'polygon(30% 70%, 100% 0%, 100% 100%)',
      'polygon(30% 70%, 100% 100%, 0% 100%)',
      'polygon(30% 70%, 0% 100%, 0% 0%)',
    ]);
    expect(dividerSegmentsFor(4, { x: 30, y: 70 })).toEqual([
      { start: { x: 30, y: 70 }, end: { x: 0, y: 0 } },
      { start: { x: 30, y: 70 }, end: { x: 100, y: 0 } },
      { start: { x: 30, y: 70 }, end: { x: 100, y: 100 } },
      { start: { x: 30, y: 70 }, end: { x: 0, y: 100 } },
    ]);
  });

  it.each([5, 6, 7, 8, 9, 10, 11, 12])(
    'creates %i radial sectors and divider rays',
    (count) => {
      const point = { x: 50, y: 50 };
      const clips = clipPathsFor(count, point);
      const segments = dividerSegmentsFor(count, point);

      expect(clips).toHaveLength(count);
      expect(clips.every((clip) => clip.startsWith('polygon(50% 50%'))).toBe(
        true,
      );
      expect(segments).toHaveLength(count);
      expect(
        segments.every(
          ({ start, end }) =>
            start.x === 50 &&
            start.y === 50 &&
            end.x >= 0 &&
            end.x <= 100 &&
            end.y >= 0 &&
            end.y <= 100,
        ),
      ).toBe(true);
    },
  );

  it('scales the radial geometry and readable label positions to twelve images', () => {
    const point = { x: 37, y: 62 };

    expect(clipPathsFor(12, point)).toHaveLength(12);
    expect(dividerSegmentsFor(12, point)).toHaveLength(12);
    expect(labelPositionsFor(12, point)).toHaveLength(12);
    expect(
      labelPositionsFor(12, point).every(
        (label) =>
          label.x >= 5 && label.x <= 95 && label.y >= 5 && label.y <= 95,
      ),
    ).toBe(true);
  });

  it('keeps outward-facing sectors degenerate when the center reaches a corner', () => {
    const clips = clipPathsFor(5, { x: 0, y: 0 });

    expect(clips).toHaveLength(5);
    expect(clips[0]).toBe('polygon(0% 0%, 0% 0%, 0% 0%)');
    expect(clips.every((clip) => !/NaN|Infinity|undefined/.test(clip))).toBe(
      true,
    );
  });
});
