import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { ImageComparator } from "./ImageComparator";

const imageFile = (name: string) =>
  new File(["pixels"], name, { type: "image/png" });

beforeEach(() => {
  let id = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation(
    (file) => "blob:" + (file as File).name,
  );
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  vi.stubGlobal("crypto", { randomUUID: () => "id-" + ++id });
  Object.defineProperty(document, "fullscreenEnabled", {
    configurable: true,
    value: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

  it("loads the first four local images and reports overflow", async () => {
    const user = userEvent.setup();
    render(<ImageComparator />);

    await user.upload(screen.getByLabelText("Lokale Bilder auswählen"), [
      imageFile("a.png"),
      imageFile("b.png"),
      imageFile("c.png"),
      imageFile("d.png"),
      imageFile("e.png"),
    ]);

    expect(screen.getAllByRole("img")).toHaveLength(4);
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 weiteres Bild wurde nicht hinzugefügt",
    );
    expect(
      screen.getByRole("button", { name: "Bilder hinzufügen" }),
    ).toBeDisabled();
  });

  it("rejects a non-image file without losing an accepted image", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<ImageComparator />);

    await user.upload(screen.getByLabelText("Lokale Bilder auswählen"), [
      imageFile("a.png"),
      new File(["notes"], "notes.txt", { type: "text/plain" }),
    ]);

    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("notes.txt");
  });

  it("removes an image, revokes its URL, and compacts remaining slots", async () => {
    const user = userEvent.setup();
    render(<ImageComparator />);

    await user.upload(screen.getByLabelText("Lokale Bilder auswählen"), [
      imageFile("a.png"),
      imageFile("b.png"),
      imageFile("c.png"),
    ]);
    await user.click(
      screen.getByRole("button", { name: "a.png entfernen" }),
    );

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:a.png");
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getByLabelText("Position für b.png")).toHaveValue("A");
    expect(screen.getByLabelText("Position für c.png")).toHaveValue("B");
  });

  it("swaps occupied positions from the image tray", async () => {
    const user = userEvent.setup();
    render(<ImageComparator />);

    await user.upload(screen.getByLabelText("Lokale Bilder auswählen"), [
      imageFile("a.png"),
      imageFile("b.png"),
    ]);
    await user.selectOptions(
      screen.getByLabelText("Position für a.png"),
      "B",
    );

    expect(screen.getByLabelText("Position für a.png")).toHaveValue("B");
    expect(screen.getByLabelText("Position für b.png")).toHaveValue("A");
  });

  it("resets divider and shared zoom", async () => {
    const user = userEvent.setup();
    render(<ImageComparator />);

    await user.upload(screen.getByLabelText("Lokale Bilder auswählen"), [
      imageFile("a.png"),
      imageFile("b.png"),
    ]);
    fireEvent.change(screen.getByLabelText("Gemeinsamer Zoom"), {
      target: { value: "150" },
    });
    fireEvent.keyDown(
      screen.getByRole("button", { name: /Trennpunkt/ }),
      { key: "ArrowRight", shiftKey: true },
    );
    await user.click(
      screen.getByRole("button", { name: "Ansicht zurücksetzen" }),
    );

    expect(screen.getByLabelText("Gemeinsamer Zoom")).toHaveValue("100");
    expect(
      screen.getByRole("button", { name: /Trennpunkt/ }),
    ).toHaveAccessibleName(/50 Prozent horizontal/);
  });

  it("replaces an image while preserving its position", async () => {
    const user = userEvent.setup();
    render(<ImageComparator />);

    await user.upload(screen.getByLabelText("Lokale Bilder auswählen"), [
      imageFile("a.png"),
      imageFile("b.png"),
    ]);
    await user.upload(
      screen.getByLabelText("a.png ersetzen"),
      imageFile("neu.png"),
    );

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:a.png");
    expect(screen.queryByLabelText("Position für a.png")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Position für neu.png")).toHaveValue("A");
  });

  it("revokes remaining object URLs when the workspace unmounts", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ImageComparator />);

    await user.upload(screen.getByLabelText("Lokale Bilder auswählen"), [
      imageFile("a.png"),
      imageFile("b.png"),
    ]);
    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:a.png");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:b.png");
  });
});
