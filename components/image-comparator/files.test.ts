import { afterEach, describe, expect, it, vi } from "vitest";

import {
  admitImageFiles,
  compactSlots,
  createImageItem,
  swapSlots,
} from "./files";
import type { ImageItem } from "./types";

const file = (name: string, type: string) =>
  new File(["x"], name, { type });

const item = (
  slot: ImageItem["slot"],
  name: string = slot,
): ImageItem => ({
  id: name,
  name,
  type: "image/png",
  url: "blob:" + name,
  slot,
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("local image files", () => {
  it("keeps the first four images and reports invalid and overflowing files", () => {
    const result = admitImageFiles(
      [
        file("a.png", "image/png"),
        file("notes.txt", "text/plain"),
        file("b.jpg", "image/jpeg"),
        file("c.webp", "image/webp"),
        file("d.gif", "image/gif"),
        file("e.avif", "image/avif"),
      ],
      0,
    );

    expect(result.accepted.map((entry) => entry.name)).toEqual([
      "a.png",
      "b.jpg",
      "c.webp",
      "d.gif",
    ]);
    expect(result.rejectedNames).toEqual(["notes.txt"]);
    expect(result.overflowCount).toBe(1);
  });

  it("uses only the slots that remain available", () => {
    const result = admitImageFiles(
      [file("a.png", "image/png"), file("b.png", "image/png")],
      3,
    );

    expect(result.accepted.map((entry) => entry.name)).toEqual(["a.png"]);
    expect(result.overflowCount).toBe(1);
  });

  it("creates an object-url item in the requested slot", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "local-id" });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local");

    expect(createImageItem(file("a.png", "image/png"), "B")).toEqual({
      id: "local-id",
      name: "a.png",
      type: "image/png",
      url: "blob:local",
      slot: "B",
    });
  });

  it("compacts gaps in slot order after an item is removed", () => {
    expect(
      compactSlots([item("A"), item("C"), item("D")]).map(
        (entry) => entry.slot,
      ),
    ).toEqual(["A", "B", "C"]);
  });

  it("swaps two occupied slots while keeping ordered output", () => {
    const swapped = swapSlots(
      [item("A", "first"), item("B", "second")],
      "A",
      "B",
    );

    expect(swapped.map((entry) => [entry.name, entry.slot])).toEqual([
      ["second", "A"],
      ["first", "B"],
    ]);
  });
});
