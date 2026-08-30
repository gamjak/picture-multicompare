'use client';

/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions -- File drag-and-drop supplements the keyboard-accessible picker buttons. */

import { Crosshair, Images, ShieldCheck, Upload } from 'lucide-react';
import {
  type DragEvent as ReactDragEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import { Button } from '@/components/ui/button';

import { AlignmentControls } from './AlignmentControls';
import { ComparisonStage } from './ComparisonStage';
import {
  admitImageFiles,
  compactSlots,
  createImageItem,
  SLOT_IDS,
  swapSlots,
} from './files';
import { ImageTray } from './ImageTray';
import type { AlignmentResult } from './image-analysis';
import { Toolbar } from './Toolbar';
import type {
  ImageItem,
  ImageMetrics,
  IntakeResult,
  Point,
  SlotId,
} from './types';
import { useImageAlignment } from './useImageAlignment';

const INITIAL_POINT: Point = { x: 50, y: 50 };

type ImageComparatorProps = {
  analyzePair?: (
    referenceUrl: string,
    targetUrl: string,
  ) => Promise<AlignmentResult>;
};

function intakeMessage(result: IntakeResult): string {
  const parts: string[] = [];

  if (result.accepted.length === 1) {
    parts.push('1 Bild wurde lokal geladen.');
  } else if (result.accepted.length > 1) {
    parts.push(result.accepted.length + ' Bilder wurden lokal geladen.');
  }

  if (result.rejectedNames.length > 0) {
    parts.push(
      'Nicht als Bild erkannt: ' + result.rejectedNames.join(', ') + '.',
    );
  }

  if (result.overflowCount === 1) {
    parts.push('1 weiteres Bild wurde nicht hinzugefügt.');
  } else if (result.overflowCount > 1) {
    parts.push(
      result.overflowCount + ' weitere Bilder wurden nicht hinzugefügt.',
    );
  }

  return parts.join(' ');
}

export function ImageComparator({ analyzePair }: ImageComparatorProps = {}) {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [point, setPoint] = useState<Point>(INITIAL_POINT);
  const [zoom, setZoom] = useState(100);
  const [showLabels, setShowLabels] = useState(true);
  const [alignmentEnabled, setAlignmentEnabled] = useState(true);
  const [showAlignmentPoints, setShowAlignmentPoints] = useState(false);
  const [metricsById, setMetricsById] = useState<Record<string, ImageMetrics>>(
    {},
  );
  const [liveMessage, setLiveMessage] = useState('');
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const liveUrls = useRef(new Set<string>());
  const canFullscreen =
    typeof document !== 'undefined' && document.fullscreenEnabled;
  const alignment = useImageAlignment({
    images,
    enabled: alignmentEnabled,
    metricsById,
    analyze: analyzePair,
  });

  const revokeUrl = (url: string) => {
    if (!liveUrls.current.has(url)) {
      return;
    }

    URL.revokeObjectURL(url);
    liveUrls.current.delete(url);
  };

  useEffect(
    () => () => {
      for (const url of liveUrls.current) {
        URL.revokeObjectURL(url);
      }
      liveUrls.current.clear();
    },
    [],
  );

  const addFiles = (files: Iterable<File>) => {
    const result = admitImageFiles(files, images.length);
    const freeSlots = SLOT_IDS.filter(
      (slot) => !images.some((image) => image.slot === slot),
    );
    const additions = result.accepted.map((file, index) => {
      const item = createImageItem(file, freeSlots[index]);
      liveUrls.current.add(item.url);
      return item;
    });

    if (additions.length > 0) {
      setImages((current) => [...current, ...additions]);
    }

    setLiveMessage(
      intakeMessage(result) || 'Es wurden keine neuen Bilder ausgewählt.',
    );
  };

  const removeImage = (image: ImageItem) => {
    revokeUrl(image.url);
    setImages((current) =>
      compactSlots(current.filter((entry) => entry.id !== image.id)),
    );
    setLiveMessage(image.name + ' wurde entfernt.');
  };

  const replaceImage = (image: ImageItem, file: File) => {
    if (!file.type.startsWith('image/')) {
      setLiveMessage(file.name + ' wurde nicht als Bild erkannt.');
      return;
    }

    const replacement = createImageItem(file, image.slot);
    liveUrls.current.add(replacement.url);
    revokeUrl(image.url);
    setImages((current) =>
      current.map((entry) => (entry.id === image.id ? replacement : entry)),
    );
    setLiveMessage(image.name + ' wurde durch ' + file.name + ' ersetzt.');
  };

  const handleDecodeError = (image: ImageItem) => {
    revokeUrl(image.url);
    setImages((current) =>
      compactSlots(current.filter((entry) => entry.id !== image.id)),
    );
    setLiveMessage(image.name + ' konnte nicht gelesen werden.');
  };

  const resetView = () => {
    setPoint(INITIAL_POINT);
    setZoom(100);
    setShowLabels(true);
    setAlignmentEnabled(true);
    setShowAlignmentPoints(false);
    alignment.cancelManual();
    alignment.reanalyze();
    setImages((current) =>
      current.map((image, index) => ({
        ...image,
        slot: SLOT_IDS[index],
      })),
    );
    setLiveMessage('Die Ansicht wurde zurückgesetzt.');
  };

  const openFullscreen = async () => {
    if (!workspaceRef.current?.requestFullscreen) {
      setLiveMessage('Vollbild wird von diesem Browser nicht unterstützt.');
      return;
    }

    try {
      await workspaceRef.current.requestFullscreen();
    } catch {
      setLiveMessage('Vollbild konnte nicht geöffnet werden.');
    }
  };

  const handleDrop = (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDraggingFiles(false);
    addFiles(event.dataTransfer.files);
  };

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

        <div
          className="privacy-note"
          role="note"
          aria-label="Bleibt auf diesem Gerät. Keine Uploads, keine Speicherung."
        >
          <ShieldCheck aria-hidden="true" />
          <span aria-hidden="true">
            <strong>Bleibt auf diesem Gerät</strong>
            <small>Keine Uploads · keine Speicherung</small>
          </span>
        </div>
      </header>

      <section
        ref={workspaceRef}
        className={
          'workspace-shell' +
          (isDraggingFiles ? ' workspace-shell--dragging' : '')
        }
        aria-label="Bildvergleich"
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDraggingFiles(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setIsDraggingFiles(false);
          }
        }}
        onDrop={handleDrop}
      >
        <div className="workspace-heading">
          <div>
            <span className="eyebrow">Lokaler Vergleich</span>
            <h2>
              {images.length === 0
                ? 'Bis zu vier Perspektiven. Ein Blick.'
                : images.length === 1
                  ? '1 Bild bereit für den Vergleich'
                  : images.length + ' Bilder im direkten Vergleich'}
            </h2>
          </div>
          <p>
            {images.length === 0
              ? 'Lege Varianten deckungsgleich übereinander und verschiebe den Trenner genau dorthin, wo du Unterschiede prüfen möchtest.'
              : 'Alle Ebenen sind gleich skaliert und zentriert. Die lokale Ausrichtung gleicht kleine Verschiebungen, Drehungen und Größenunterschiede aus.'}
          </p>
        </div>

        {images.length === 0 ? (
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
        ) : (
          <div className="active-workspace">
            <Toolbar
              zoom={zoom}
              showLabels={showLabels}
              canAdd={images.length < 4}
              canFullscreen={canFullscreen}
              onZoomChange={setZoom}
              onAdd={() => inputRef.current?.click()}
              onReset={resetView}
              onToggleLabels={() => setShowLabels((current) => !current)}
              onFullscreen={openFullscreen}
            />
            <AlignmentControls
              images={images}
              enabled={alignmentEnabled}
              showPoints={showAlignmentPoints}
              referenceId={alignment.referenceId}
              entriesByImageId={alignment.entriesByImageId}
              manualSession={alignment.manualSession}
              onEnabledChange={(enabled) => {
                setAlignmentEnabled(enabled);
                if (!enabled) {
                  setShowAlignmentPoints(false);
                  alignment.cancelManual();
                }
              }}
              onShowPointsChange={setShowAlignmentPoints}
              onReanalyze={(targetId) => alignment.reanalyze(targetId)}
              onBeginManual={(targetId) => {
                setShowAlignmentPoints(false);
                alignment.beginManual(targetId);
              }}
              onUndoManual={alignment.undoManualPoint}
              onCancelManual={alignment.cancelManual}
              onApplyManual={() => {
                const applied = alignment.applyManual();
                if (applied) {
                  setLiveMessage(
                    'Die manuelle Drei-Punkt-Ausrichtung wurde angewendet.',
                  );
                }
                return applied;
              }}
            />
            <div className="workspace-grid">
              <ComparisonStage
                images={images}
                point={point}
                zoom={zoom}
                showLabels={showLabels}
                alignmentEnabled={alignmentEnabled}
                showAlignmentPoints={showAlignmentPoints}
                referenceId={alignment.referenceId}
                entriesByImageId={alignment.entriesByImageId}
                metricsById={metricsById}
                manualSession={alignment.manualSession}
                onPointChange={setPoint}
                onDecodeError={handleDecodeError}
                onImageMetrics={(imageId, metrics) =>
                  setMetricsById((current) => {
                    const previous = current[imageId];
                    if (
                      previous?.width === metrics.width &&
                      previous.height === metrics.height
                    ) {
                      return current;
                    }
                    return { ...current, [imageId]: metrics };
                  })
                }
                onManualPoint={alignment.recordManualPoint}
                onCancelManual={alignment.cancelManual}
              />
              <ImageTray
                images={images}
                onRemove={removeImage}
                onReplace={replaceImage}
                onMove={(from: SlotId, to: SlotId) =>
                  setImages((current) => swapSlots(current, from, to))
                }
              />
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="image/*"
          multiple
          tabIndex={-1}
          aria-label="Lokale Bilder auswählen"
          onChange={(event) => {
            if (event.currentTarget.files) {
              addFiles(event.currentTarget.files);
            }
            event.currentTarget.value = '';
          }}
        />

        <output className="status-message" aria-live="polite">
          {liveMessage}
        </output>

        <footer className="workspace-footer">
          {images.length === 0 ? (
            <>
              <span>2 Bilder · geteilter Slider</span>
              <span>3 Bilder · T-Ansicht</span>
              <span>4 Bilder · Bildkreuz</span>
            </>
          ) : (
            <>
              <span>Ziehen oder tippen zum Positionieren</span>
              <span>Pfeiltasten für Feinschritte</span>
              <span>Umschalt + Pfeil für 10%</span>
            </>
          )}
        </footer>
      </section>
    </main>
  );
}
