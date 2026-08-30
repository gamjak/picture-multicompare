"use client";

import {
  Eye,
  EyeOff,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type ToolbarProps = {
  zoom: number;
  showLabels: boolean;
  canAdd: boolean;
  canFullscreen: boolean;
  onZoomChange: (zoom: number) => void;
  onAdd: () => void;
  onReset: () => void;
  onToggleLabels: () => void;
  onFullscreen: () => void;
};

const clampZoom = (zoom: number) => Math.min(200, Math.max(50, zoom));

export function Toolbar({
  zoom,
  showLabels,
  canAdd,
  canFullscreen,
  onZoomChange,
  onAdd,
  onReset,
  onToggleLabels,
  onFullscreen,
}: ToolbarProps) {
  return (
    <div className="comparison-toolbar" aria-label="Vergleichswerkzeuge">
      <div className="toolbar-group toolbar-group--zoom">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Verkleinern"
          disabled={zoom <= 50}
          onClick={() => onZoomChange(clampZoom(zoom - 5))}
        >
          <Minus aria-hidden="true" />
        </Button>
        <label className="zoom-control">
          <span>Zoom</span>
          <input
            type="range"
            min="50"
            max="200"
            step="5"
            value={zoom}
            aria-label="Gemeinsamer Zoom"
            onChange={(event) =>
              onZoomChange(clampZoom(Number(event.currentTarget.value)))
            }
          />
          <span className="zoom-value" aria-hidden="true">
            {zoom}%
          </span>
        </label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Vergrößern"
          disabled={zoom >= 200}
          onClick={() => onZoomChange(clampZoom(zoom + 5))}
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>

      <div className="toolbar-group toolbar-group--actions">
        <Button
          type="button"
          variant="outline"
          disabled={!canAdd}
          onClick={onAdd}
        >
          <Upload data-icon="inline-start" aria-hidden="true" />
          Bilder hinzufügen
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-label="Ansicht zurücksetzen"
          onClick={onReset}
        >
          <RotateCcw data-icon="inline-start" aria-hidden="true" />
          Zurücksetzen
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-label={
            showLabels
              ? "Bereichsnamen ausblenden"
              : "Bereichsnamen einblenden"
          }
          aria-pressed={showLabels}
          onClick={onToggleLabels}
        >
          {showLabels ? (
            <Eye data-icon="inline-start" aria-hidden="true" />
          ) : (
            <EyeOff data-icon="inline-start" aria-hidden="true" />
          )}
          Bereiche
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-label="Vollbild öffnen"
          disabled={!canFullscreen}
          onClick={onFullscreen}
        >
          <Maximize2 data-icon="inline-start" aria-hidden="true" />
          Vollbild
        </Button>
      </div>
    </div>
  );
}
