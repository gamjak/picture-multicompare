'use client';

/* oxlint-disable nextjs/no-img-element -- Local blob URLs must stay on-device and cannot use an image optimizer. */

import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { useMemo, useRef } from 'react';

import { clipPathsFor, movePointByKey, pointFromClient } from './geometry';
import { SLOT_IDS } from './files';
import type { ImageItem, Point } from './types';

type ComparisonStageProps = {
  images: ImageItem[];
  point: Point;
  zoom: number;
  showLabels: boolean;
  onPointChange: (point: Point) => void;
  onDecodeError: (image: ImageItem) => void;
};

type StageStyle = CSSProperties & {
  '--divider-x': string;
  '--divider-y': string;
  '--image-zoom': number;
};

export function ComparisonStage({
  images,
  point,
  zoom,
  showLabels,
  onPointChange,
  onDecodeError,
}: ComparisonStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const orderedImages = useMemo(
    () =>
      [...images].sort(
        (a, b) => SLOT_IDS.indexOf(a.slot) - SLOT_IDS.indexOf(b.slot),
      ),
    [images],
  );
  const clips = clipPathsFor(orderedImages.length, point);
  const dividerY = orderedImages.length === 2 ? 50 : point.y;
  const stageStyle: StageStyle = {
    '--divider-x': point.x + '%',
    '--divider-y': dividerY + '%',
    '--image-zoom': zoom / 100,
  };

  const updateFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
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
    if (orderedImages.length < 2) {
      return;
    }

    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateFromPointer(event);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
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
      data-interactive={orderedImages.length >= 2}
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
            style={{ clipPath: clips[index] }}
          >
            <img
              className="comparison-image"
              src={image.url}
              alt={'Vergleichsbild ' + image.slot + ': ' + image.name}
              draggable={false}
              onError={() => onDecodeError(image)}
            />
          </div>
        ))}
      </div>

      {orderedImages.length === 1 ? (
        <p className="comparison-hint">
          Füge mindestens ein weiteres Bild hinzu
        </p>
      ) : null}

      {orderedImages.length >= 2 ? (
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
          <button
            type="button"
            className="divider-handle"
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
        ? orderedImages.map((image) => (
            <span
              className={'comparison-label comparison-label--' + image.slot}
              key={'label-' + image.id}
            >
              <strong>{image.slot}</strong>
              <span>{image.name}</span>
            </span>
          ))
        : null}
    </div>
  );
}
