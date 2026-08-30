import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ComparisonStage } from "./ComparisonStage";
import type { ImageItem } from "./types";

const images: ImageItem[] = ["A", "B", "C", "D"].map((slot) => ({
  id: slot,
  name: slot + ".png",
  type: "image/png",
  url: "blob:" + slot,
  slot: slot as ImageItem["slot"],
}));

describe("ComparisonStage", () => {
  it("shows a one-image prompt without an active divider", () => {
    render(
      <ComparisonStage
        images={images.slice(0, 1)}
        point={{ x: 50, y: 50 }}
        zoom={100}
        showLabels
        onPointChange={vi.fn()}
        onDecodeError={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Füge mindestens ein weiteres Bild hinzu"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Trennpunkt/ }),
    ).not.toBeInTheDocument();
  });

  it("renders four layers and applies keyboard movement to the divider", () => {
    const onPointChange = vi.fn();

    render(
      <ComparisonStage
        images={images}
        point={{ x: 50, y: 50 }}
        zoom={100}
        showLabels
        onPointChange={onPointChange}
        onDecodeError={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("img")).toHaveLength(4);

    fireEvent.keyDown(
      screen.getByRole("button", { name: /Trennpunkt/ }),
      {
        key: "ArrowRight",
        shiftKey: true,
      },
    );

    expect(onPointChange).toHaveBeenCalledWith({ x: 60, y: 50 });
  });

  it("does not change the unused vertical axis in two-image mode", () => {
    const onPointChange = vi.fn();

    render(
      <ComparisonStage
        images={images.slice(0, 2)}
        point={{ x: 50, y: 50 }}
        zoom={100}
        showLabels
        onPointChange={onPointChange}
        onDecodeError={vi.fn()}
      />,
    );

    fireEvent.keyDown(
      screen.getByRole("button", { name: /Trennpunkt/ }),
      { key: "ArrowDown" },
    );

    expect(onPointChange).not.toHaveBeenCalled();
  });

  it("can hide corner labels without hiding the images", () => {
    render(
      <ComparisonStage
        images={images.slice(0, 2)}
        point={{ x: 50, y: 50 }}
        zoom={100}
        showLabels={false}
        onPointChange={vi.fn()}
        onDecodeError={vi.fn()}
      />,
    );

    expect(screen.queryByText("A")).not.toBeInTheDocument();
    expect(screen.queryByText("B")).not.toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  it("reports the image that cannot be decoded", () => {
    const onDecodeError = vi.fn();

    render(
      <ComparisonStage
        images={images.slice(0, 1)}
        point={{ x: 50, y: 50 }}
        zoom={100}
        showLabels
        onPointChange={vi.fn()}
        onDecodeError={onDecodeError}
      />,
    );

    fireEvent.error(screen.getByRole("img"));

    expect(onDecodeError).toHaveBeenCalledWith(images[0]);
  });
});
