"use client";

import { ImageIcon, Replace, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { SLOT_IDS } from "./files";
import type { ImageItem, SlotId } from "./types";

type ImageTrayProps = {
  images: ImageItem[];
  onRemove: (image: ImageItem) => void;
  onReplace: (image: ImageItem, file: File) => void;
  onMove: (from: SlotId, to: SlotId) => void;
};

export function ImageTray({
  images,
  onRemove,
  onReplace,
  onMove,
}: ImageTrayProps) {
  const orderedImages = [...images].sort(
    (a, b) => SLOT_IDS.indexOf(a.slot) - SLOT_IDS.indexOf(b.slot),
  );
  const occupiedSlots = orderedImages.map((image) => image.slot);

  return (
    <aside className="image-tray" aria-label="Geladene Bilder">
      <div className="tray-heading">
        <div>
          <span className="eyebrow">Ebenen</span>
          <h3>Geladene Bilder</h3>
        </div>
        <span>{images.length}/4</span>
      </div>

      <div className="tray-list">
        {orderedImages.map((image) => {
          const replaceId = "replace-" + image.id;

          return (
            <article className="image-card" key={image.id}>
              <div className="image-thumb">
                <img src={image.url} alt="" draggable={false} />
                <span>{image.slot}</span>
              </div>
              <div className="image-card-copy">
                <strong title={image.name}>{image.name}</strong>
                <label>
                  <span>Position</span>
                  <select
                    aria-label={"Position für " + image.name}
                    value={image.slot}
                    onChange={(event) =>
                      onMove(
                        image.slot,
                        event.currentTarget.value as SlotId,
                      )
                    }
                  >
                    {occupiedSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="image-card-actions">
                <label
                  htmlFor={replaceId}
                  className="tray-icon-button"
                >
                  <Replace aria-hidden="true" />
                  <span className="sr-only">{image.name} ersetzen</span>
                </label>
                <input
                  id={replaceId}
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file) {
                      onReplace(image, file);
                    }
                    event.currentTarget.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={image.name + " entfernen"}
                  onClick={() => onRemove(image)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      <p className="tray-tip">
        <ImageIcon aria-hidden="true" />
        Die Buchstaben entsprechen den sichtbaren Bereichen.
      </p>
    </aside>
  );
}
