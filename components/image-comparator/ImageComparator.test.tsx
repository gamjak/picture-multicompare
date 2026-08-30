import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ImageComparator } from "./ImageComparator";

describe("ImageComparator", () => {
  it("starts with a clear local-only image dropzone", () => {
    render(<ImageComparator />);

    expect(
      screen.getByRole("heading", { name: "Vierblick" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Bleibt auf diesem Gerät")).toBeInTheDocument();
    expect(screen.getByText("Hier ablegen")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Bilder auswählen" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Lokale Bilder auswählen")).toHaveAttribute(
      "accept",
      "image/*",
    );
  });
});
