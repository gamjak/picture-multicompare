"use client";

import { Crosshair, Images, ShieldCheck, Upload } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";

export function ImageComparator() {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <Crosshair />
          </span>
          <div>
            <h1>Vierblick</h1>
            <p>Bilder direkt vergleichen</p>
          </div>
        </div>

        <div className="privacy-note">
          <ShieldCheck aria-hidden="true" />
          <span>
            <strong>Bleibt auf diesem Gerät</strong>
            <small>Keine Uploads · keine Speicherung</small>
          </span>
        </div>
      </header>

      <section className="workspace-shell" aria-label="Bildvergleich">
        <div className="workspace-heading">
          <div>
            <span className="eyebrow">Lokaler Vergleich</span>
            <h2>Bis zu vier Perspektiven. Ein Blick.</h2>
          </div>
          <p>
            Lege Varianten deckungsgleich übereinander und verschiebe den
            Trenner genau dorthin, wo du Unterschiede prüfen möchtest.
          </p>
        </div>

        <div className="empty-stage">
          <span className="empty-divider empty-divider--vertical" />
          <span className="empty-divider empty-divider--horizontal" />
          <span className="empty-handle" aria-hidden="true">
            <Crosshair />
          </span>

          <div className="dropzone-content">
            <span className="dropzone-icon" aria-hidden="true">
              <Images />
            </span>
            <div>
              <h3>Deine Bilder hier ablegen</h3>
              <p>
                Wähle zwei bis vier Bilder. Sie werden automatisch gleich
                skaliert und mittig ausgerichtet.
              </p>
            </div>
            <div className="dropzone-actions">
              <Button
                type="button"
                size="lg"
                onClick={() => inputRef.current?.click()}
              >
                <Upload data-icon="inline-start" aria-hidden="true" />
                Bilder auswählen
              </Button>
              <span>oder per Drag-and-drop</span>
            </div>
            <strong className="dropzone-caption">Hier ablegen</strong>
          </div>
        </div>

        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="image/*"
          multiple
          aria-label="Lokale Bilder auswählen"
          onChange={(event) => {
            event.currentTarget.value = "";
          }}
        />

        <footer className="workspace-footer">
          <span>2 Bilder · geteilter Slider</span>
          <span>3 Bilder · T-Ansicht</span>
          <span>4 Bilder · Bildkreuz</span>
        </footer>
      </section>
    </main>
  );
}
