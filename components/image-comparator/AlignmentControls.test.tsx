import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AlignmentControls } from './AlignmentControls';
import type { AlignmentEntry, ImageItem } from './types';

const images: ImageItem[] = [
  { id: 'A', name: 'vorher.png', type: 'image/png', url: 'blob:A', slot: 'A' },
  { id: 'B', name: 'nachher.png', type: 'image/png', url: 'blob:B', slot: 'B' },
];

const alignedEntry: AlignmentEntry = {
  status: 'aligned',
  source: 'automatic',
  referenceId: 'A',
  referenceUrl: 'blob:A',
  targetId: 'B',
  targetUrl: 'blob:B',
  transform: {
    scale: 1,
    rotation: 0,
    translateX: -10,
    translateY: 5,
  },
  anchors: [
    { reference: { x: 0.1, y: 0.1 }, target: { x: 0.11, y: 0.094 } },
    { reference: { x: 0.8, y: 0.15 }, target: { x: 0.81, y: 0.144 } },
    { reference: { x: 0.2, y: 0.8 }, target: { x: 0.21, y: 0.794 } },
  ],
  confidence: 0.91,
  rmsError: 0.7,
};

const baseProps = {
  images,
  enabled: true,
  showPoints: false,
  referenceId: 'A',
  entriesByImageId: { B: alignedEntry },
  manualSession: null,
  onEnabledChange: vi.fn(),
  onShowPointsChange: vi.fn(),
  onReanalyze: vi.fn(),
  onBeginManual: vi.fn(),
  onUndoManual: vi.fn(),
  onCancelManual: vi.fn(),
  onApplyManual: vi.fn(() => true),
};

describe('AlignmentControls', () => {
  it('shows a checked switch and reports a successful automatic alignment', async () => {
    const user = userEvent.setup();
    const onEnabledChange = vi.fn();
    render(
      <AlignmentControls {...baseProps} onEnabledChange={onEnabledChange} />,
    );

    const toggle = screen.getByRole('switch', {
      name: 'Automatisch ausrichten',
    });
    expect(toggle).toBeChecked();
    expect(
      screen.getByText('3 Punkte gefunden · Ausrichtung aktiv'),
    ).toBeInTheDocument();
    expect(screen.getByText('Automatisch · 91%')).toBeInTheDocument();

    await user.click(toggle);
    expect(onEnabledChange).toHaveBeenCalledWith(false);
  });

  it('disables alignment until two images are present', () => {
    render(<AlignmentControls {...baseProps} images={images.slice(0, 1)} />);

    expect(
      screen.getByRole('switch', { name: 'Automatisch ausrichten' }),
    ).toBeDisabled();
    expect(screen.getByText('Mindestens 2 Bilder')).toBeInTheDocument();
  });

  it('keeps the summary in progress until every target has a result', () => {
    render(
      <AlignmentControls
        {...baseProps}
        images={[
          ...images,
          {
            id: 'C',
            name: 'detail.png',
            type: 'image/png',
            url: 'blob:C',
            slot: 'C',
          },
        ]}
      />,
    );

    expect(screen.getByText('Wird ausgerichtet …')).toBeInTheDocument();
  });

  it('keeps an uncertain target centered and offers the manual fallback', async () => {
    const user = userEvent.setup();
    const onBeginManual = vi.fn();
    const failedEntry: AlignmentEntry = {
      status: 'failed',
      reason: 'ambiguous',
      referenceId: 'A',
      referenceUrl: 'blob:A',
      targetId: 'B',
      targetUrl: 'blob:B',
    };
    render(
      <AlignmentControls
        {...baseProps}
        entriesByImageId={{ B: failedEntry }}
        onBeginManual={onBeginManual}
      />,
    );

    expect(
      screen.getByText('Nicht sicher · normal zentriert'),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: '3 Punkte manuell setzen' }),
    );
    expect(onBeginManual).toHaveBeenCalledWith('B');
  });

  it('guides the manual session and applies a ready point set', async () => {
    const user = userEvent.setup();
    const onApplyManual = vi.fn(() => true);
    render(
      <AlignmentControls
        {...baseProps}
        entriesByImageId={{}}
        manualSession={{
          referenceId: 'A',
          referenceUrl: 'blob:A',
          targetId: 'B',
          targetUrl: 'blob:B',
          phase: 'ready',
          referencePoints: [
            { x: 0.1, y: 0.1 },
            { x: 0.8, y: 0.15 },
            { x: 0.2, y: 0.8 },
          ],
          targetPoints: [
            { x: 0.12, y: 0.1 },
            { x: 0.82, y: 0.15 },
            { x: 0.22, y: 0.8 },
          ],
        }}
        onApplyManual={onApplyManual}
      />,
    );

    expect(
      screen.getByText('Alle 3 Punktpaare sind markiert.'),
    ).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText(/Pfeiltasten/)).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Ausrichtung anwenden' }),
    );
    expect(onApplyManual).toHaveBeenCalledOnce();
  });
});
