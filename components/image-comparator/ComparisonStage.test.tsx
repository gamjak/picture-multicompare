import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ComparisonStage } from './ComparisonStage';
import type { AlignmentEntry, ImageMetrics, StageImage } from './types';

const images: StageImage[] = ['A', 'B', 'C', 'D'].map((slot) => ({
  id: slot,
  name: slot + '.png',
  type: 'image/png',
  url: 'blob:' + slot,
  slot: slot as StageImage['slot'],
}));

const twelveImages: StageImage[] = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
].map((slot) => ({
  id: slot,
  name: slot + '.png',
  type: 'image/png',
  url: 'blob:' + slot,
  slot: slot as StageImage['slot'],
}));

const metricsById: Record<string, ImageMetrics> = {
  A: { width: 1200, height: 800 },
  B: { width: 1200, height: 800 },
  C: { width: 1200, height: 800 },
  D: { width: 1200, height: 800 },
};

const alignedB: AlignmentEntry = {
  status: 'aligned',
  source: 'automatic',
  referenceId: 'A',
  referenceUrl: 'blob:A',
  targetId: 'B',
  targetUrl: 'blob:B',
  transform: {
    scale: 1,
    rotation: 0,
    translateX: 100,
    translateY: 50,
  },
  anchors: [
    { reference: { x: 0.1, y: 0.1 }, target: { x: 0.02, y: 0.04 } },
    { reference: { x: 0.8, y: 0.15 }, target: { x: 0.72, y: 0.09 } },
    { reference: { x: 0.2, y: 0.8 }, target: { x: 0.12, y: 0.74 } },
  ],
  confidence: 0.9,
  rmsError: 0.5,
};

const mockStageRect = () =>
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 100,
    y: 50,
    top: 50,
    right: 700,
    bottom: 450,
    left: 100,
    width: 600,
    height: 400,
    toJSON: () => ({}),
  });

afterEach(() => vi.restoreAllMocks());

describe('ComparisonStage', () => {
  it('shows a one-image prompt without an active divider', () => {
    render(
      <ComparisonStage
        images={images.slice(0, 1)}
        point={{ x: 50, y: 50 }}
        zoom={100}
        showLabels
        onPointChange={vi.fn()}
        onDecodeError={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Füge mindestens ein weiteres Bild hinzu'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Trennpunkt/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Bildvergleich')).toHaveAttribute(
      'data-interactive',
      'false',
    );
  });

  it('renders four layers and applies keyboard movement to the divider', () => {
    const onPointChange = vi.fn();

    const { container } = render(
      <ComparisonStage
        images={images}
        point={{ x: 50, y: 50 }}
        zoom={100}
        showLabels
        onPointChange={onPointChange}
        onDecodeError={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('img')).toHaveLength(4);
    expect(screen.getByLabelText('Bildvergleich')).toHaveAttribute(
      'data-interactive',
      'true',
    );
    expect(
      container.querySelectorAll('.radial-divider-overlay line'),
    ).toHaveLength(4);

    fireEvent.keyDown(screen.getByRole('button', { name: /Trennpunkt/ }), {
      key: 'ArrowRight',
      shiftKey: true,
    });

    expect(onPointChange).toHaveBeenCalledWith({ x: 60, y: 50 });
  });

  it('renders twelve simultaneous radial sectors and divider rays', () => {
    const { container } = render(
      <ComparisonStage
        images={twelveImages}
        point={{ x: 50, y: 50 }}
        zoom={100}
        showLabels
        onPointChange={vi.fn()}
        onDecodeError={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('img')).toHaveLength(12);
    expect(container.querySelectorAll('.comparison-layer')).toHaveLength(12);
    expect(
      [...container.querySelectorAll<HTMLElement>('.comparison-layer')].every(
        (layer) => layer.style.clipPath.startsWith('polygon(50% 50%'),
      ),
    ).toBe(true);
    expect(
      container.querySelectorAll('.radial-divider-overlay line'),
    ).toHaveLength(12);
    expect(screen.getByText('L')).toBeInTheDocument();
  });

  it('does not change the unused vertical axis in two-image mode', () => {
    const onPointChange = vi.fn();

    render(
      <ComparisonStage
        images={images.slice(0, 2)}
        point={{ x: 50, y: 50 }}
        zoom={100}
        showLabels
        onPointChange={onPointChange}
        onDecodeError={vi.fn()}
      />,
    );

    const defaultAllowed = fireEvent.keyDown(
      screen.getByRole('button', { name: /Trennpunkt/ }),
      { key: 'ArrowDown' },
    );

    expect(defaultAllowed).toBe(false);
    expect(onPointChange).not.toHaveBeenCalled();
  });

  it('keeps the visible star center on the actual geometry point at an edge', () => {
    render(
      <ComparisonStage
        images={twelveImages.slice(0, 5)}
        point={{ x: 0, y: 0 }}
        zoom={100}
        showLabels
        onPointChange={vi.fn()}
        onDecodeError={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Trennpunkt/ })).toHaveStyle({
      left: '0%',
      top: '0%',
    });
  });

  it('ignores non-primary pointer buttons on the comparison stage', () => {
    const onPointChange = vi.fn();

    render(
      <ComparisonStage
        images={images.slice(0, 2)}
        point={{ x: 50, y: 50 }}
        zoom={100}
        showLabels
        onPointChange={onPointChange}
        onDecodeError={vi.fn()}
      />,
    );

    fireEvent.pointerDown(screen.getByLabelText('Bildvergleich'), {
      button: 2,
      buttons: 2,
      clientX: 500,
      clientY: 300,
      pointerId: 1,
    });

    expect(onPointChange).not.toHaveBeenCalled();
  });

  it('can hide corner labels without hiding the images', () => {
    render(
      <ComparisonStage
        images={images.slice(0, 2)}
        point={{ x: 50, y: 50 }}
        zoom={100}
        showLabels={false}
        onPointChange={vi.fn()}
        onDecodeError={vi.fn()}
      />,
    );

    expect(screen.queryByText('A')).not.toBeInTheDocument();
    expect(screen.queryByText('B')).not.toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('reports the image that cannot be decoded', () => {
    const onDecodeError = vi.fn();

    render(
      <ComparisonStage
        images={images.slice(0, 1)}
        point={{ x: 50, y: 50 }}
        zoom={100}
        showLabels
        onPointChange={vi.fn()}
        onDecodeError={onDecodeError}
      />,
    );

    fireEvent.error(screen.getByRole('img'));

    expect(onDecodeError).toHaveBeenCalledWith(images[0]);
  });

  it('reports natural image dimensions after decoding', () => {
    const onImageMetrics = vi.fn();
    render(
      <ComparisonStage
        images={images.slice(0, 1)}
        point={{ x: 50, y: 50 }}
        zoom={100}
        showLabels
        onPointChange={vi.fn()}
        onDecodeError={vi.fn()}
        onImageMetrics={onImageMetrics}
      />,
    );
    const image = screen.getByRole('img');
    Object.defineProperties(image, {
      naturalWidth: { configurable: true, value: 1200 },
      naturalHeight: { configurable: true, value: 800 },
    });

    fireEvent.load(image);

    expect(onImageMetrics).toHaveBeenCalledWith('A', {
      width: 1200,
      height: 800,
    });
  });

  it('applies the target alignment in stage coordinates and can switch it off', async () => {
    mockStageRect();
    const { rerender } = render(
      <ComparisonStage
        images={images.slice(0, 2)}
        point={{ x: 50, y: 50 }}
        zoom={100}
        showLabels
        alignmentEnabled
        referenceId="A"
        entriesByImageId={{ B: alignedB }}
        metricsById={metricsById}
        onPointChange={vi.fn()}
        onDecodeError={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('alignment-B')).toHaveStyle({
        transform: 'matrix(1, 0, 0, 1, 50, 25)',
      }),
    );

    rerender(
      <ComparisonStage
        images={images.slice(0, 2)}
        point={{ x: 50, y: 50 }}
        zoom={100}
        showLabels
        alignmentEnabled={false}
        referenceId="A"
        entriesByImageId={{ B: alignedB }}
        metricsById={metricsById}
        onPointChange={vi.fn()}
        onDecodeError={vi.fn()}
      />,
    );

    expect(screen.getByTestId('alignment-B')).toHaveStyle({
      transform: 'matrix(1, 0, 0, 1, 0, 0)',
    });
  });

  it('converts a manual stage click into normalized source coordinates', () => {
    mockStageRect();
    const onManualPoint = vi.fn();
    render(
      <ComparisonStage
        images={images.slice(0, 2)}
        point={{ x: 50, y: 50 }}
        zoom={100}
        showLabels
        alignmentEnabled
        referenceId="A"
        entriesByImageId={{}}
        metricsById={metricsById}
        manualSession={{
          referenceId: 'A',
          referenceUrl: 'blob:A',
          targetId: 'B',
          targetUrl: 'blob:B',
          phase: 'reference',
          referencePoints: [],
          targetPoints: [],
        }}
        onPointChange={vi.fn()}
        onDecodeError={vi.fn()}
        onManualPoint={onManualPoint}
      />,
    );

    fireEvent.pointerDown(screen.getByLabelText('Bildvergleich'), {
      clientX: 250,
      clientY: 150,
      pointerId: 1,
      buttons: 1,
    });

    expect(onManualPoint).toHaveBeenCalledWith('A', { x: 0.25, y: 0.25 });
  });

  it('positions and records a manual point with the keyboard', () => {
    mockStageRect();
    const onManualPoint = vi.fn();
    render(
      <ComparisonStage
        images={images.slice(0, 2)}
        point={{ x: 50, y: 50 }}
        zoom={100}
        showLabels
        alignmentEnabled
        referenceId="A"
        entriesByImageId={{}}
        metricsById={metricsById}
        manualSession={{
          referenceId: 'A',
          referenceUrl: 'blob:A',
          targetId: 'B',
          targetUrl: 'blob:B',
          phase: 'reference',
          referencePoints: [],
          targetPoints: [],
        }}
        onPointChange={vi.fn()}
        onDecodeError={vi.fn()}
        onManualPoint={onManualPoint}
      />,
    );

    const cursor = screen.getByRole('button', {
      name: /Punktposition für Bild A/,
    });
    expect(cursor).toHaveFocus();
    expect(cursor).toHaveAccessibleName(/50 Prozent horizontal/);
    fireEvent.keyDown(cursor, { key: 'ArrowLeft', shiftKey: true });
    expect(cursor).toHaveAccessibleName(/45 Prozent horizontal/);
    expect(
      screen.getByText(
        'Punktposition Bild A: 45 Prozent horizontal, 50 Prozent vertikal',
      ),
    ).toHaveAttribute('aria-live', 'polite');
    fireEvent.keyDown(cursor, { key: 'Enter' });

    expect(onManualPoint).toHaveBeenCalledWith('A', { x: 0.45, y: 0.5 });
  });

  it('shows only the image currently being marked during manual alignment', () => {
    mockStageRect();
    const props = {
      images: images.slice(0, 2),
      point: { x: 50, y: 50 },
      zoom: 100,
      showLabels: true,
      alignmentEnabled: true,
      referenceId: 'A',
      entriesByImageId: {},
      metricsById,
      onPointChange: vi.fn(),
      onDecodeError: vi.fn(),
    };
    const { rerender } = render(
      <ComparisonStage
        {...props}
        manualSession={{
          referenceId: 'A',
          referenceUrl: 'blob:A',
          targetId: 'B',
          targetUrl: 'blob:B',
          phase: 'reference',
          referencePoints: [],
          targetPoints: [],
        }}
      />,
    );

    expect(
      screen.getByTestId('alignment-A').closest('.comparison-layer'),
    ).toHaveStyle({
      clipPath: 'inset(0)',
    });
    expect(
      screen.getByTestId('alignment-B').closest('.comparison-layer'),
    ).toHaveStyle({
      clipPath: 'inset(0 100% 100% 0)',
    });

    rerender(
      <ComparisonStage
        {...props}
        manualSession={{
          referenceId: 'A',
          referenceUrl: 'blob:A',
          targetId: 'B',
          targetUrl: 'blob:B',
          phase: 'target',
          referencePoints: [
            { x: 0.1, y: 0.1 },
            { x: 0.8, y: 0.15 },
            { x: 0.2, y: 0.8 },
          ],
          targetPoints: [],
        }}
      />,
    );

    expect(
      screen.getByTestId('alignment-A').closest('.comparison-layer'),
    ).toHaveStyle({
      clipPath: 'inset(0 100% 100% 0)',
    });
    expect(
      screen.getByTestId('alignment-B').closest('.comparison-layer'),
    ).toHaveStyle({
      clipPath: 'inset(0)',
    });
  });

  it('shows three numbered reference and target marker pairs on request', async () => {
    mockStageRect();
    render(
      <ComparisonStage
        images={images.slice(0, 2)}
        point={{ x: 50, y: 50 }}
        zoom={100}
        showLabels
        alignmentEnabled
        showAlignmentPoints
        referenceId="A"
        entriesByImageId={{ B: alignedB }}
        metricsById={metricsById}
        onPointChange={vi.fn()}
        onDecodeError={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByLabelText(/Referenzpunkt/)).toHaveLength(3);
      expect(screen.getAllByLabelText(/Zielpunkt/)).toHaveLength(3);
    });
  });
});
