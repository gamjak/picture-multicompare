import type { Point } from "./types";

type RectLike = Pick<DOMRect, "left" | "top" | "width" | "height">;

const formatPercent = (value: number) =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));

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

export function movePointByKey(
  point: Point,
  key: string,
  step: number,
): Point {
  if (key === "ArrowLeft") {
    return { ...point, x: clampPercent(point.x - step) };
  }

  if (key === "ArrowRight") {
    return { ...point, x: clampPercent(point.x + step) };
  }

  if (key === "ArrowUp") {
    return { ...point, y: clampPercent(point.y - step) };
  }

  if (key === "ArrowDown") {
    return { ...point, y: clampPercent(point.y + step) };
  }

  return point;
}

export function clipPathsFor(count: number, point: Point): string[] {
  const x = formatPercent(point.x);
  const y = formatPercent(point.y);
  const right = formatPercent(100 - point.x);
  const bottom = formatPercent(100 - point.y);

  if (count <= 1) {
    return ["inset(0 0 0 0)"];
  }

  if (count === 2) {
    return [
      "inset(0 " + right + "% 0 0)",
      "inset(0 0 0 " + x + "%)",
    ];
  }

  if (count === 3) {
    return [
      "inset(0 0 " + bottom + "% 0)",
      "polygon(0 " +
        y +
        "%, " +
        x +
        "% " +
        y +
        "%, " +
        x +
        "% 100%, 0 100%)",
      "polygon(" +
        x +
        "% " +
        y +
        "%, 100% " +
        y +
        "%, 100% 100%, " +
        x +
        "% 100%)",
    ];
  }

  return [
    "inset(0 " + right + "% " + bottom + "% 0)",
    "inset(0 0 " + bottom + "% " + x + "%)",
    "inset(" + y + "% 0 0 " + x + "%)",
    "inset(" + y + "% " + right + "% 0 0)",
  ];
}
