'use client';

/* oxlint-disable nextjs/no-img-element -- Local blob URLs must stay on-device and cannot use an image optimizer. */

import { Crosshair, ImageIcon, Replace, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { MAX_IMAGES } from './files';
import type { ImageItem, StageImage } from './types';

type ImageTrayProps = {
  images: ImageItem[];
  activeImages: StageImage[];
  onRemove: (image: ImageItem) => void;
  onReplace: (image: ImageItem, file: File) => void;
  onMakeReference: (image: ImageItem) => void;
};

export function ImageTray({
  images,
  activeImages,
  onRemove,
  onReplace,
  onMakeReference,
}: ImageTrayProps) {
  const activeSlotById = new Map(
    activeImages.map((image) => [image.id, image.slot]),
  );

  return (
    <aside className="image-tray" aria-label="Geladene Bilder">
      <div className="tray-heading">
        <div>
          <span className="eyebrow">Bildbibliothek</span>
          <h3>Geladene Bilder</h3>
        </div>
        <span>
          {images.length}/{MAX_IMAGES}
        </span>
      </div>

      <div className="tray-list">
        {images.map((image, index) => {
          const replaceId = 'replace-' + image.id;
          const activeSlot = activeSlotById.get(image.id);
          const slotLabel = activeSlot ?? '?';
          const isReference = index === 0;

          return (
            <article className="image-card" key={image.id}>
              <div className="image-thumb">
                <img src={image.url} alt="" draggable={false} />
                <span>{activeSlot}</span>
              </div>
              <div className="image-card-copy">
                <strong title={image.name}>{image.name}</strong>
                <small>
                  {isReference
                    ? 'A · Gemeinsame Referenz'
                    : `${activeSlot} · Vergleichsbild`}
                </small>
              </div>
              <div className="image-card-actions">
                {!isReference ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={
                      'Bild ' +
                      slotLabel +
                      ': ' +
                      image.name +
                      ' als Referenz A verwenden'
                    }
                    onClick={() => onMakeReference(image)}
                  >
                    <Crosshair aria-hidden="true" />
                  </Button>
                ) : null}
                <label htmlFor={replaceId} className="tray-icon-button">
                  <Replace aria-hidden="true" />
                  <span className="sr-only">
                    {'Bild ' + slotLabel + ': ' + image.name + ' ersetzen'}
                  </span>
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
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={
                    'Bild ' + slotLabel + ': ' + image.name + ' entfernen'
                  }
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
        Alle Bilder sind gleichzeitig sichtbar; A bleibt Referenz.
      </p>
    </aside>
  );
}
