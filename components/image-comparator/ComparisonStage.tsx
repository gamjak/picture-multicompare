'use client';

/* oxlint-disable nextjs/no-img-element -- Local blob URLs must stay on-device and cannot use an image optimizer. */

import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  applyMatrix,
  displayMatrixFor,
  fitContainRect,
  IDENTITY_MATRIX,
  invertMatrix,
  matrixToCss,
} from './alignment';
import { SLOT_IDS } from './files';
import {
  clipPathsFor,
  dividerSegmentsFor,
  labelPositionsFor,
  movePointByKey,
  pointFromClient,
} from './geometry';
import type {
  AlignmentEntry,
  CssMatrix,
  ImageMetrics,
  ManualAlignmentSession,
  NormalizedPoint,
  Point,
  StageImage,
  StageSize,
} from './types';

type ComparisonStageProps = {
  images: StageImage[];
  point: Point;
  zoom: number;
  showLabels: boolean;
  alignmentEnabled?: boolean;
  showAlignmentPoints?: boolean;
  referenceId?: string | null;
  entriesByImageId?: Record<string, AlignmentEntry>;
  metricsById?: Record<string, ImageMetrics>;
  manualSession?: ManualAlignmentSession | null;
  onPointChange: (point: Point) => void;
  onDecodeError: (image: StageImage) => void;
  onImageMetrics?: (imageId: string, metrics: ImageMetrics) => void;
  onManualPoint?: (imageId: string, point: NormalizedPoint) => void;
  onCancelManual?: () => void;
};

type StageStyle = CSSProperties & {
  '--divider-x': string;
  '--divider-y': string;
};

type Marker = {
  key: string;
  label: string;
  kind: 'reference' | 'target';
  number: number;
  point: Point;
};

const EMPTY_ENTRIES: Record<string, AlignmentEntry> = {};
const EMPTY_METRICS: Record<string, ImageMetrics> = {};
const CENTER_POINT: NormalizedPoint = { x: 0.5, y: 0.5 };

const clampNormalized = (value: number) => Math.min(1, Math.max(0, value));

const zoomPoint = (point: Point, size: StageSize, zoom: number): Point => {
  const scale = zoom / 100;
  const centerX = size.width / 2;
  const centerY = size.height / 2;
  return {
    x: centerX + (point.x - centerX) * scale,
    y: centerY + (point.y - centerY) * scale,
  };
};

const unzoomPoint = (point: Point, size: StageSize, zoom: number): Point => {
  const scale = zoom / 100;
  const centerX = size.width / 2;
  const centerY = size.height / 2;
  return {
    x: centerX + (point.x - centerX) / scale,
    y: centerY + (point.y - centerY) / scale,
  };
};

export function ComparisonStage({
  images,
  point,
  zoom,
  showLabels,
  alignmentEnabled = false,
  showAlignmentPoints = false,
  referenceId = null,
  entriesByImageId = EMPTY_ENTRIES,
  metricsById = EMPTY_METRICS,
  manualSession = null,
  onPointChange,
  onDecodeError,
  onImageMetrics,
  onManualPoint,
  onCancelManual,
}: ComparisonStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const manualCursorRef = useRef<HTMLButtonElement>(null);
  const [stageSize, setStageSize] = useState<StageSize>({
    width: 0,
    height: 0,
  });
  const [manualCursor, setManualCursor] =
    useState<NormalizedPoint>(CENTER_POINT);
  const orderedImages = useMemo(
    () =>
      [...images].sort(
        (a, b) => SLOT_IDS.indexOf(a.slot) - SLOT_IDS.indexOf(b.slot),
      ),
    [images],
  );
  const clips = clipPathsFor(orderedImages.length, point);
  const dividerSegments = dividerSegmentsFor(orderedImages.length, point);
  const labelPositions = labelPositionsFor(orderedImages.length, point);
  const dividerY = orderedImages.length === 2 ? 50 : point.y;
  const stageStyle: StageStyle = {
    '--divider-x': point.x + '%',
    '--divider-y': dividerY + '%',
  };
  const referenceMetrics = referenceId ? metricsById[referenceId] : undefined;
  const manualImageId = manualSession
    ? manualSession.phase === 'reference'
      ? manualSession.referenceId
      : manualSession.targetId
    : null;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const measure = () => {
      const rect = stage.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }
      setStageSize((current) =>
        current.width === rect.width && current.height === rect.height
          ? current
          : { width: rect.width, height: rect.height },
      );
    };

    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(stage);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    if (!manualSession || !onCancelManual) {
      return;
    }

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancelManual();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [manualSession, onCancelManual]);

  const matrixForImage = (
    imageId: string,
    size: StageSize = stageSize,
  ): CssMatrix => {
    if (
      !alignmentEnabled ||
      imageId === referenceId ||
      !referenceMetrics ||
      size.width <= 0 ||
      size.height <= 0
    ) {
      return IDENTITY_MATRIX;
    }

    const entry = entriesByImageId[imageId];
    const targetMetrics = metricsById[imageId];
    if (entry?.status !== 'aligned' || !targetMetrics) {
      return IDENTITY_MATRIX;
    }

    return displayMatrixFor(
      entry.transform,
      targetMetrics,
      referenceMetrics,
      size,
    );
  };

  const displayedPoint = (
    imageId: string,
    normalized: NormalizedPoint,
    size: StageSize = stageSize,
  ): Point | null => {
    const metrics = metricsById[imageId];
    if (!metrics || size.width <= 0 || size.height <= 0) {
      return null;
    }
    const fit = fitContainRect(metrics, size);
    const baseline = {
      x: fit.x + normalized.x * fit.width,
      y: fit.y + normalized.y * fit.height,
    };
    return zoomPoint(
      applyMatrix(baseline, matrixForImage(imageId, size)),
      size,
      zoom,
    );
  };

  const markers: Marker[] = [];
  if (showAlignmentPoints && referenceId) {
    for (const image of orderedImages) {
      const entry = entriesByImageId[image.id];
      if (entry?.status !== 'aligned') {
        continue;
      }
      entry.anchors.forEach((anchor, index) => {
        const referencePoint = displayedPoint(referenceId, anchor.reference);
        const targetPoint = displayedPoint(image.id, anchor.target);
        if (referencePoint) {
          markers.push({
            key: `${image.id}-reference-${index}`,
            label: `Referenzpunkt ${index + 1} für Bild ${image.slot}`,
            kind: 'reference',
            number: index + 1,
            point: referencePoint,
          });
        }
        if (targetPoint) {
          markers.push({
            key: `${image.id}-target-${index}`,
            label: `Zielpunkt ${index + 1} für Bild ${image.slot}`,
            kind: 'target',
            number: index + 1,
            point: targetPoint,
          });
        }
      });
    }
  }

  if (manualSession) {
    manualSession.referencePoints.forEach((manualPoint, index) => {
      const markerPoint = displayedPoint(
        manualSession.referenceId,
        manualPoint,
      );
      if (markerPoint) {
        markers.push({
          key: `manual-reference-${index}`,
          label: `Manueller Referenzpunkt ${index + 1}`,
          kind: 'reference',
          number: index + 1,
          point: markerPoint,
        });
      }
    });
    manualSession.targetPoints.forEach((manualPoint, index) => {
      const markerPoint = displayedPoint(manualSession.targetId, manualPoint);
      if (markerPoint) {
        markers.push({
          key: `manual-target-${index}`,
          label: `Manueller Zielpunkt ${index + 1}`,
          kind: 'target',
          number: index + 1,
          point: markerPoint,
        });
      }
    });
  }

  const manualCursorPoint =
    manualSession &&
    manualSession.phase !== 'ready' &&
    manualImageId &&
    onManualPoint
      ? displayedPoint(manualImageId, manualCursor)
      : null;
  const hasManualCursor = Boolean(manualCursorPoint);
  const manualImage = manualImageId
    ? orderedImages.find((image) => image.id === manualImageId)
    : undefined;
  const manualCursorLabel = manualImage
    ? `Punktposition für Bild ${manualImage.slot}, ${Math.round(
        manualCursor.x * 100,
      )} Prozent horizontal, ${Math.round(
        manualCursor.y * 100,
      )} Prozent vertikal`
    : '';

  useEffect(() => {
    if (hasManualCursor) {
      manualCursorRef.current?.focus();
    }
  }, [hasManualCursor, manualSession?.referenceId, manualSession?.targetId]);

  const submitManualCursor = () => {
    if (
      !manualSession ||
      manualSession.phase === 'ready' ||
      !manualImageId ||
      !onManualPoint
    ) {
      return;
    }

    onManualPoint(manualImageId, manualCursor);
    setManualCursor(CENTER_POINT);
  };

  const handleManualCursorKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      submitManualCursor();
      return;
    }
    if (!event.key.startsWith('Arrow')) {
      return;
    }

    event.preventDefault();
    const step = event.shiftKey ? 0.05 : 0.01;
    setManualCursor((current) => ({
      x: clampNormalized(
        current.x +
          (event.key === 'ArrowLeft'
            ? -step
            : event.key === 'ArrowRight'
              ? step
              : 0),
      ),
      y: clampNormalized(
        current.y +
          (event.key === 'ArrowUp'
            ? -step
            : event.key === 'ArrowDown'
              ? step
              : 0),
      ),
    }));
  };

  const recordManualPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      !manualSession ||
      manualSession.phase === 'ready' ||
      !manualImageId ||
      !stageRef.current ||
      !onManualPoint
    ) {
      return;
    }

    const imageId = manualImageId;
    const metrics = metricsById[imageId];
    if (!metrics) {
      return;
    }

    const rect = stageRef.current.getBoundingClientRect();
    const size = { width: rect.width, height: rect.height };
    if (size.width <= 0 || size.height <= 0) {
      return;
    }
    const localPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const unzoomed = unzoomPoint(localPoint, size, zoom);
    const inverseAlignment = invertMatrix(matrixForImage(imageId, size));
    if (!inverseAlignment) {
      return;
    }
    const baseline = applyMatrix(unzoomed, inverseAlignment);
    const fit = fitContainRect(metrics, size);
    const normalized = {
      x: (baseline.x - fit.x) / fit.width,
      y: (baseline.y - fit.y) / fit.height,
    };
    if (
      normalized.x < 0 ||
      normalized.x > 1 ||
      normalized.y < 0 ||
      normalized.y > 1
    ) {
      return;
    }

    onManualPoint(imageId, normalized);
    setManualCursor(CENTER_POINT);
  };

  const updateFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (manualSession) {
      recordManualPoint(event);
      return;
    }
    if (orderedImages.length < 2 || !stageRef.current) {
      return;
    }

    const next = pointFromClient(
      event.clientX,
      event.clientY,
      stageRef.current.getBoundingClientRect(),
    );

    onPointChange(
      orderedImages.length === 2 ? { x: next.x, y: point.y } : next,
    );
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    if (manualSession) {
      recordManualPoint(event);
      return;
    }
    if (orderedImages.length < 2) {
      return;
    }

    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateFromPointer(event);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (manualSession) {
      return;
    }
    if (
      event.currentTarget.hasPointerCapture?.(event.pointerId) ||
      event.buttons === 1
    ) {
      updateFromPointer(event);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!event.key.startsWith('Arrow')) {
      return;
    }

    event.preventDefault();

    if (
      orderedImages.length === 2 &&
      (event.key === 'ArrowUp' || event.key === 'ArrowDown')
    ) {
      return;
    }

    const next = movePointByKey(point, event.key, event.shiftKey ? 10 : 1);

    if (next !== point) {
      onPointChange(next);
    }
  };

  return (
    <div
      ref={stageRef}
      className="comparison-stage"
      data-image-count={orderedImages.length}
      data-interactive={orderedImages.length >= 2 && !manualSession}
      data-manual={Boolean(manualSession)}
      style={stageStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      aria-label="Bildvergleich"
    >
      <div className="comparison-layers">
        {orderedImages.map((image, index) => (
          <div
            className="comparison-layer"
            key={image.id}
            style={{
              clipPath: manualSession
                ? image.id === manualImageId
                  ? 'inset(0)'
                  : 'inset(0 100% 100% 0)'
                : clips[index],
            }}
          >
            <div
              className="comparison-zoom"
              style={{ transform: `scale(${zoom / 100})` }}
            >
              <div
                className="comparison-alignment"
                data-testid={`alignment-${image.id}`}
                style={{ transform: matrixToCss(matrixForImage(image.id)) }}
              >
                <img
                  className="comparison-image"
                  src={image.url}
                  alt={'Vergleichsbild ' + image.slot + ': ' + image.name}
                  draggable={false}
                  onLoad={(event) => {
                    const width = event.currentTarget.naturalWidth;
                    const height = event.currentTarget.naturalHeight;
                    if (width > 0 && height > 0) {
                      onImageMetrics?.(image.id, { width, height });
                    }
                  }}
                  onError={() => onDecodeError(image)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {markers.map((marker) => (
        <span
          key={marker.key}
          className={`alignment-marker alignment-marker--${marker.kind}`}
          style={{ left: marker.point.x, top: marker.point.y }}
          aria-label={marker.label}
        >
          {marker.number}
        </span>
      ))}

      {manualCursorPoint && manualImage ? (
        <>
          <button
            ref={manualCursorRef}
            type="button"
            className="manual-point-cursor"
            style={{ left: manualCursorPoint.x, top: manualCursorPoint.y }}
            aria-label={manualCursorLabel}
            onKeyDown={handleManualCursorKeyDown}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              submitManualCursor();
            }}
          >
            <span aria-hidden="true" />
          </button>
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            {`Punktposition Bild ${manualImage.slot}: ${Math.round(
              manualCursor.x * 100,
            )} Prozent horizontal, ${Math.round(
              manualCursor.y * 100,
            )} Prozent vertikal`}
          </span>
        </>
      ) : null}

      {orderedImages.length === 1 ? (
        <p className="comparison-hint">
          Füge mindestens ein weiteres Bild hinzu
        </p>
      ) : null}

      {orderedImages.length >= 2 && !manualSession ? (
        <>
          {orderedImages.length >= 4 ? (
            <svg
              className="radial-divider-overlay"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              {dividerSegments.map((segment, index) => (
                <line
                  key={index}
                  x1={segment.start.x}
                  y1={segment.start.y}
                  x2={segment.end.x}
                  y2={segment.end.y}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          ) : (
            <>
              <span
                className={[
                  'divider-line',
                  'divider-line--vertical',
                  orderedImages.length === 3 ? 'divider-line--lower' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-hidden="true"
              />
              {orderedImages.length >= 3 ? (
                <span
                  className="divider-line divider-line--horizontal"
                  aria-hidden="true"
                />
              ) : null}
            </>
          )}
          <button
            type="button"
            className="divider-handle"
            disabled={Boolean(manualSession)}
            style={{ left: `${point.x}%`, top: `${dividerY}%` }}
            aria-label={
              'Trennpunkt, ' +
              Math.round(point.x) +
              ' Prozent horizontal, ' +
              Math.round(dividerY) +
              ' Prozent vertikal'
            }
            onKeyDown={handleKeyDown}
            onPointerDown={(event) => event.currentTarget.focus()}
          >
            <span aria-hidden="true" />
          </button>
        </>
      ) : null}

      {showLabels
        ? orderedImages
            .filter((image) => !manualSession || image.id === manualImageId)
            .map((image, index) => (
              <span
                className={
                  'comparison-label comparison-label--' +
                  image.slot +
                  (orderedImages.length >= 4
                    ? ' comparison-label--radial'
                    : '') +
                  (orderedImages.length >= 9
                    ? ' comparison-label--compact'
                    : '')
                }
                key={'label-' + image.id}
                style={
                  orderedImages.length >= 4
                    ? {
                        left: `${labelPositions[index].x}%`,
                        top: `${labelPositions[index].y}%`,
                      }
                    : undefined
                }
              >
                <strong>{image.slot}</strong>
                <span>{image.name}</span>
              </span>
            ))
        : null}
    </div>
  );
}
