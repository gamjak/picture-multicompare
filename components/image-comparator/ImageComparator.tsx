'use client';

/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions -- File drag-and-drop supplements the keyboard-accessible picker buttons. */

import { Crosshair, Images, ShieldCheck, Upload } from 'lucide-react';
import {
  type DragEvent as ReactDragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Button } from '@/components/ui/button';

import { AlignmentControls } from './AlignmentControls';
import { ComparisonStage } from './ComparisonStage';
import {
  admitImageFiles,
  createImageItem,
  MAX_IMAGES,
  moveImageToReference,
  stageImagesForAll,
} from './files';
import { ImageTray } from './ImageTray';
import type { AlignmentResult } from './image-analysis';
import { Toolbar } from './Toolbar';
import type {
  ImageItem,
  ImageMetrics,
  IntakeResult,
  Point,
  StageImage,
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
    parts.push(
      `1 weiteres Bild wurde nicht hinzugefügt. Maximal ${MAX_IMAGES} Bilder sind möglich.`,
    );
  } else if (result.overflowCount > 1) {
    parts.push(
      `${result.overflowCount} weitere Bilder wurden nicht hinzugefügt. Maximal ${MAX_IMAGES} Bilder sind möglich.`,
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
  const activeImages = useMemo(() => stageImagesForAll(images), [images]);
  const alignment = useImageAlignment({
    images: activeImages,
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

  const discardMetrics = (imageId: string) => {
    setMetricsById((current) => {
      if (!current[imageId]) {
        return current;
      }
      const next = { ...current };
      delete next[imageId];
      return next;
    });
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

  const cancelManualAlignment = () => {
    setShowAlignmentPoints(false);
    alignment.cancelManual();
  };

  const addFiles = (files: Iterable<File>) => {
    const result = admitImageFiles(files, images.length);
    const additions = result.accepted.map((file) => {
      const item = createImageItem(file);
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
    const imageIndex = images.findIndex((entry) => entry.id === image.id);
    if (imageIndex < 0) {
      return;
    }
    const nextImages = images.filter((entry) => entry.id !== image.id);

    revokeUrl(image.url);
    discardMetrics(image.id);
    cancelManualAlignment();
    setImages(nextImages);

    if (imageIndex === 0 && nextImages[0]) {
      setLiveMessage(
        `${image.name} wurde entfernt. ${nextImages[0].name} ist jetzt Referenz A.`,
      );
    } else {
      setLiveMessage(image.name + ' wurde entfernt.');
    }
  };

  const replaceImage = (image: ImageItem, file: File) => {
    if (!file.type.startsWith('image/')) {
      setLiveMessage(file.name + ' wurde nicht als Bild erkannt.');
      return;
    }

    const replacement = createImageItem(file, image.id);
    liveUrls.current.add(replacement.url);
    revokeUrl(image.url);
    discardMetrics(image.id);
    cancelManualAlignment();
    setImages((current) =>
      current.map((entry) =>
        entry.id === image.id && entry.url === image.url ? replacement : entry,
      ),
    );
    setLiveMessage(image.name + ' wurde durch ' + file.name + ' ersetzt.');
  };

  const handleDecodeError = (image: StageImage) => {
    const storedImage = images.find(
      (entry) => entry.id === image.id && entry.url === image.url,
    );
    if (!storedImage) {
      return;
    }

    revokeUrl(storedImage.url);
    discardMetrics(storedImage.id);
    cancelManualAlignment();
    const nextImages = images.filter((entry) => entry.id !== storedImage.id);
    setImages(nextImages);
    setLiveMessage(storedImage.name + ' konnte nicht gelesen werden.');
  };

  const makeReference = (image: ImageItem) => {
    if (images[0]?.id === image.id) {
      return;
    }
    cancelManualAlignment();
    setImages((current) => moveImageToReference(current, image.id));
    setLiveMessage(
      `${image.name} ist jetzt Referenz A. Die Ausrichtung wird neu berechnet.`,
    );
  };

  const resetView = () => {
    setPoint(INITIAL_POINT);
    setZoom(100);
    setShowLabels(true);
    setAlignmentEnabled(true);
    setShowAlignmentPoints(false);
    alignment.cancelManual();
    alignment.reanalyze();
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
            <h1>Picture MultiCompare</h1>
            <p>Viele Bilder. Ein präziser Vergleich.</p>
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
            <span className="eyebrow">Lokaler Mehrfachvergleich</span>
            <h2>
              {images.length === 0
                ? 'Bis zu zwölf Bilder. Präzise verglichen.'
                : images.length === 1
                  ? '1 Referenzbild bereit'
                  : `${images.length} Bilder · ${images.length} Bereiche`}
            </h2>
          </div>
          <p>
            {images.length === 0
              ? 'Lege ähnliche Aufnahmen deckungsgleich übereinander und prüfe Unterschiede direkt am verschiebbaren Kreuz.'
              : images.length === 1
                ? 'Füge mindestens ein Zielbild hinzu. Bild A bleibt die gemeinsame Referenz für alle Vergleiche.'
                : 'Alle Bilder sind gleichzeitig sichtbar. A bleibt die gemeinsame Referenz; alle Ziele werden gleich skaliert, zentriert und lokal ausgerichtet.'}
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
                  Wähle zwei bis zwölf Bilder. Alle erscheinen gleichzeitig in
                  eigenen Bereichen und werden automatisch ausgerichtet.
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
              canAdd={images.length < MAX_IMAGES}
              canFullscreen={canFullscreen}
              onZoomChange={setZoom}
              onAdd={() => inputRef.current?.click()}
              onReset={resetView}
              onToggleLabels={() => setShowLabels((current) => !current)}
              onFullscreen={openFullscreen}
            />
            <AlignmentControls
              images={activeImages}
              enabled={alignmentEnabled}
              showPoints={showAlignmentPoints}
              referenceId={alignment.referenceId}
              entriesByImageId={alignment.entriesByImageId}
              manualSession={alignment.manualSession}
              onEnabledChange={(enabled) => {
                setAlignmentEnabled(enabled);
                if (!enabled) {
                  cancelManualAlignment();
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
                images={activeImages}
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
                activeImages={activeImages}
                onRemove={removeImage}
                onReplace={replaceImage}
                onMakeReference={makeReference}
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
              <span>Bis zu 12 Bilder lokal</span>
              <span>A als gemeinsame Referenz</span>
              <span>Jedes Bild in einem eigenen Bereich</span>
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
