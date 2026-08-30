import type { Point } from './types';

type RectLike = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;

export type DividerSegment = {
  start: Point;
  end: Point;
};

const formatPercent = (value: number) =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));

const formatPoint = (point: Point) =>
  `${formatPercent(point.x)}% ${formatPercent(point.y)}%`;

const radialAngles = (count: number) =>
  Array.from(
    { length: count },
    (_, index) => -90 - 180 / count + (index * 360) / count,
  );

function rayToBoundary(point: Point, angle: number): Point {
  const radians = (angle * Math.PI) / 180;
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);
  const candidates: number[] = [];

  if (Math.abs(dx) > 1e-9) {
    const horizontalTarget = dx > 0 ? 100 : 0;
    const distance = (horizontalTarget - point.x) / dx;
    if (distance >= 0) {
      candidates.push(distance);
    }
  }

  if (Math.abs(dy) > 1e-9) {
    const verticalTarget = dy > 0 ? 100 : 0;
    const distance = (verticalTarget - point.y) / dy;
    if (distance >= 0) {
      candidates.push(distance);
    }
  }

  const distance = Math.min(...candidates);
  return {
    x: clampPercent(point.x + dx * distance),
    y: clampPercent(point.y + dy * distance),
  };
}

const rectangleCorners: Point[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

const clockwiseDelta = (from: number, to: number) =>
  (((to - from) % 360) + 360) % 360;

function radialClipPaths(count: number, point: Point): string[] {
  const angles = radialAngles(count);
  const endpoints = angles.map((angle) => rayToBoundary(point, angle));
  const step = 360 / count;
  const epsilon = 1e-6;

  return endpoints.map((start, index) => {
    const end = endpoints[(index + 1) % endpoints.length];
    const startAngle = angles[index];
    const corners = rectangleCorners
      .map((corner) => ({
        corner,
        distance: Math.hypot(corner.x - point.x, corner.y - point.y),
        delta: clockwiseDelta(
          startAngle,
          (Math.atan2(corner.y - point.y, corner.x - point.x) * 180) / Math.PI,
        ),
      }))
      .filter(
        ({ distance, delta }) =>
          distance > epsilon && delta > epsilon && delta < step - epsilon,
      )
      .sort((left, right) => left.delta - right.delta)
      .map(({ corner }) => corner);

    return `polygon(${[point, start, ...corners, end]
      .map(formatPoint)
      .join(', ')})`;
  });
}

export const clampPercent = (value: number) =>
  Math.min(100, Math.max(0, value));

export function pointFromClient(
  clientX: number,
  clientY: number,
  rect: RectLike,
): Point {
  return {
    x: clampPercent(((clientX - rect.left) / rect.width) * 100),
    y: clampPercent(((clientY - rect.top) / rect.height) * 100),
  };
}

export function movePointByKey(point: Point, key: string, step: number): Point {
  if (key === 'ArrowLeft') {
    return { ...point, x: clampPercent(point.x - step) };
  }

  if (key === 'ArrowRight') {
    return { ...point, x: clampPercent(point.x + step) };
  }

  if (key === 'ArrowUp') {
    return { ...point, y: clampPercent(point.y - step) };
  }

  if (key === 'ArrowDown') {
    return { ...point, y: clampPercent(point.y + step) };
  }

  return point;
}

export function dividerSegmentsFor(
  count: number,
  point: Point,
): DividerSegment[] {
  if (count <= 1) {
    return [];
  }
  if (count === 2) {
    return [{ start: { x: point.x, y: 0 }, end: { x: point.x, y: 100 } }];
  }
  if (count === 3) {
    return [
      { start: { x: 0, y: point.y }, end: { x: 100, y: point.y } },
      { start: point, end: { x: point.x, y: 100 } },
    ];
  }
  if (count === 4) {
    return [
      { start: point, end: { x: 0, y: 0 } },
      { start: point, end: { x: 100, y: 0 } },
      { start: point, end: { x: 100, y: 100 } },
      { start: point, end: { x: 0, y: 100 } },
    ];
  }

  return radialAngles(count).map((angle) => ({
    start: point,
    end: rayToBoundary(point, angle),
  }));
}

export function labelPositionsFor(count: number, point: Point): Point[] {
  if (count <= 0) {
    return [];
  }
  if (count === 1) {
    return [{ x: 12, y: 12 }];
  }
  if (count === 2) {
    return [
      { x: point.x / 2, y: 88 },
      { x: point.x + (100 - point.x) / 2, y: 88 },
    ];
  }
  if (count === 3) {
    return [
      { x: 50, y: point.y / 2 },
      { x: point.x / 2, y: point.y + (100 - point.y) / 2 },
      {
        x: point.x + (100 - point.x) / 2,
        y: point.y + (100 - point.y) / 2,
      },
    ];
  }
  if (count === 4) {
    return [
      { x: 50, y: point.y / 2 },
      { x: point.x + (100 - point.x) / 2, y: 50 },
      {
        x: 50,
        y: point.y + (100 - point.y) / 2,
      },
      { x: point.x / 2, y: 50 },
    ];
  }

  const step = 360 / count;
  return radialAngles(count).map((angle) => {
    const edge = rayToBoundary(point, angle + step / 2);
    return {
      x: Math.min(95, Math.max(5, point.x + (edge.x - point.x) * 0.72)),
      y: Math.min(95, Math.max(5, point.y + (edge.y - point.y) * 0.72)),
    };
  });
}

export function clipPathsFor(count: number, point: Point): string[] {
  const x = formatPercent(point.x);
  const y = formatPercent(point.y);
  const right = formatPercent(100 - point.x);
  const bottom = formatPercent(100 - point.y);

  if (count <= 1) {
    return ['inset(0 0 0 0)'];
  }

  if (count === 2) {
    return ['inset(0 ' + right + '% 0 0)', 'inset(0 0 0 ' + x + '%)'];
  }

  if (count === 3) {
    return [
      'inset(0 0 ' + bottom + '% 0)',
      'polygon(0 ' + y + '%, ' + x + '% ' + y + '%, ' + x + '% 100%, 0 100%)',
      'polygon(' +
        x +
        '% ' +
        y +
        '%, 100% ' +
        y +
        '%, 100% 100%, ' +
        x +
        '% 100%)',
    ];
  }

  if (count >= 5) {
    return radialClipPaths(count, point);
  }

  return [
    `polygon(${x}% ${y}%, 0% 0%, 100% 0%)`,
    `polygon(${x}% ${y}%, 100% 0%, 100% 100%)`,
    `polygon(${x}% ${y}%, 100% 100%, 0% 100%)`,
    `polygon(${x}% ${y}%, 0% 100%, 0% 0%)`,
  ];
}
