import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ImageComparator } from './ImageComparator';
import type { AlignmentResult } from './image-analysis';

const imageFile = (name: string) =>
  new File(['pixels'], name, { type: 'image/png' });
const revokeObjectURLMock = vi.fn();
const automaticAlignment: AlignmentResult = {
  status: 'aligned',
  transform: {
    scale: 1,
    rotation: 0,
    translateX: -12,
    translateY: 4,
  },
  anchors: [
    { reference: { x: 0.1, y: 0.1 }, target: { x: 0.11, y: 0.095 } },
    { reference: { x: 0.8, y: 0.15 }, target: { x: 0.81, y: 0.145 } },
    { reference: { x: 0.2, y: 0.8 }, target: { x: 0.21, y: 0.795 } },
  ],
  confidence: 0.9,
  rmsError: 0.6,
};

beforeEach(() => {
  let id = 0;
  revokeObjectURLMock.mockClear();
  vi.spyOn(URL, 'createObjectURL').mockImplementation(
    (file) => 'blob:' + (file as File).name,
  );
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeObjectURLMock);
  vi.stubGlobal('crypto', { randomUUID: () => 'id-' + ++id });
  Object.defineProperty(document, 'fullscreenEnabled', {
    configurable: true,
    value: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ImageComparator', () => {
  it('starts with a clear local-only image dropzone', () => {
    render(<ImageComparator />);

    expect(
      screen.getByRole('heading', { name: 'Picture MultiCompare' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Bleibt auf diesem Gerät')).toBeInTheDocument();
    expect(
      screen.getByRole('note', {
        name: /Bleibt auf diesem Gerät.*Keine Uploads.*keine Speicherung/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Hier ablegen')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Bilder auswählen' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Lokale Bilder auswählen')).toHaveAttribute(
      'accept',
      'image/*',
    );
  });

  it('loads twelve local images, shows all at once, and reports overflow', async () => {
    const user = userEvent.setup();
    const { container } = render(<ImageComparator />);

    await user.upload(
      screen.getByLabelText('Lokale Bilder auswählen'),
      Array.from({ length: 13 }, (_, index) => imageFile(`${index + 1}.png`)),
    );

    expect(screen.getAllByRole('img')).toHaveLength(12);
    expect(screen.getByText('12/12')).toBeInTheDocument();
    expect(container.querySelector('.comparison-stage')).toHaveAttribute(
      'data-image-count',
      '12',
    );
    expect(
      container.querySelectorAll('.radial-divider-overlay line'),
    ).toHaveLength(12);
    expect(
      screen.queryByRole('navigation', { name: 'Vergleichssätze' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      '1 weiteres Bild wurde nicht hinzugefügt. Maximal 12 Bilder sind möglich.',
    );
    expect(
      screen.getByRole('button', { name: 'Bilder hinzufügen' }),
    ).toBeDisabled();
  });

  it('keeps every loaded image visible in the same comparison', async () => {
    const user = userEvent.setup();
    render(<ImageComparator />);
    const picker = screen.getByLabelText('Lokale Bilder auswählen');

    await user.upload(
      picker,
      ['a', 'b', 'c', 'd'].map((name) => imageFile(`${name}.png`)),
    );
    expect(screen.getAllByRole('img')).toHaveLength(4);

    await user.upload(
      picker,
      ['e', 'f', 'g', 'h'].map((name) => imageFile(`${name}.png`)),
    );

    expect(screen.getAllByRole('img')).toHaveLength(8);
    expect(
      screen.getByRole('img', { name: 'Vergleichsbild A: a.png' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Vergleichsbild H: h.png' }),
    ).toBeInTheDocument();
    expect(screen.getByText('8 Bilder · 8 Bereiche')).toBeInTheDocument();
  });

  it('rejects a non-image file without losing an accepted image', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<ImageComparator />);

    await user.upload(screen.getByLabelText('Lokale Bilder auswählen'), [
      imageFile('a.png'),
      new File(['notes'], 'notes.txt', { type: 'text/plain' }),
    ]);

    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('notes.txt');
  });

  it('removes the reference, promotes the next image, and revokes its URL', async () => {
    const user = userEvent.setup();
    render(<ImageComparator />);

    await user.upload(screen.getByLabelText('Lokale Bilder auswählen'), [
      imageFile('a.png'),
      imageFile('b.png'),
      imageFile('c.png'),
    ]);
    await user.click(
      screen.getByRole('button', { name: 'Bild A: a.png entfernen' }),
    );

    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:a.png');
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(
      screen.getByRole('img', { name: 'Vergleichsbild A: b.png' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'b.png ist jetzt Referenz A',
    );
  });

  it('makes any loaded target the common reference', async () => {
    const user = userEvent.setup();
    render(<ImageComparator />);

    await user.upload(screen.getByLabelText('Lokale Bilder auswählen'), [
      imageFile('a.png'),
      imageFile('b.png'),
    ]);
    await user.click(
      screen.getByRole('button', {
        name: 'Bild B: b.png als Referenz A verwenden',
      }),
    );

    expect(
      screen.getByRole('img', { name: 'Vergleichsbild A: b.png' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Vergleichsbild B: a.png' }),
    ).toBeInTheDocument();
  });

  it('resets divider and shared zoom without changing the reference', async () => {
    const user = userEvent.setup();
    render(<ImageComparator />);

    await user.upload(screen.getByLabelText('Lokale Bilder auswählen'), [
      imageFile('a.png'),
      imageFile('b.png'),
    ]);
    await user.click(
      screen.getByRole('button', {
        name: 'Bild B: b.png als Referenz A verwenden',
      }),
    );
    fireEvent.change(screen.getByLabelText('Gemeinsamer Zoom'), {
      target: { value: '150' },
    });
    fireEvent.keyDown(screen.getByRole('button', { name: /Trennpunkt/ }), {
      key: 'ArrowRight',
      shiftKey: true,
    });
    await user.click(
      screen.getByRole('button', { name: 'Ansicht zurücksetzen' }),
    );

    expect(screen.getByLabelText('Gemeinsamer Zoom')).toHaveValue('100');
    expect(
      screen.getByRole('img', { name: 'Vergleichsbild A: b.png' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Trennpunkt/ }),
    ).toHaveAccessibleName(/50 Prozent horizontal/);
  });

  it('replaces an image while preserving its library position', async () => {
    const user = userEvent.setup();
    render(<ImageComparator />);

    await user.upload(screen.getByLabelText('Lokale Bilder auswählen'), [
      imageFile('a.png'),
      imageFile('b.png'),
    ]);
    await user.upload(
      screen.getByLabelText('Bild A: a.png ersetzen'),
      imageFile('neu.png'),
    );

    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:a.png');
    expect(
      screen.queryByRole('img', { name: 'Vergleichsbild A: a.png' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Vergleichsbild A: neu.png' }),
    ).toBeInTheDocument();
  });

  it('shows keyboard focus on replacement controls and skips hidden pickers', async () => {
    const user = userEvent.setup();
    render(<ImageComparator />);

    const addPicker = screen.getByLabelText('Lokale Bilder auswählen');
    expect(addPicker).toHaveAttribute('tabindex', '-1');

    await user.upload(addPicker, imageFile('a.png'));

    const replacePicker = screen.getByLabelText('Bild A: a.png ersetzen');
    expect(replacePicker.closest('.tray-icon-button')).toBeInTheDocument();
  });

  it('keeps actions distinguishable when two files have the same name', async () => {
    const user = userEvent.setup();
    render(<ImageComparator />);

    await user.upload(screen.getByLabelText('Lokale Bilder auswählen'), [
      imageFile('gleich.png'),
      imageFile('gleich.png'),
    ]);

    expect(
      screen.getByRole('button', { name: 'Bild A: gleich.png entfernen' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Bild B: gleich.png entfernen' }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Bild A: gleich.png ersetzen'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Bild B: gleich.png ersetzen'),
    ).toBeInTheDocument();
  });

  it('revokes remaining object URLs when the workspace unmounts', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ImageComparator />);

    await user.upload(screen.getByLabelText('Lokale Bilder auswählen'), [
      imageFile('a.png'),
      imageFile('b.png'),
    ]);
    unmount();

    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:a.png');
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:b.png');
  });

  it('automatically aligns two images and can switch the result off and on', async () => {
    const user = userEvent.setup();
    const analyzePair = vi.fn(async () => automaticAlignment);
    render(<ImageComparator analyzePair={analyzePair} />);

    await user.upload(screen.getByLabelText('Lokale Bilder auswählen'), [
      imageFile('a.png'),
      imageFile('b.png'),
    ]);

    await waitFor(() =>
      expect(
        screen.getByText('3 Punkte gefunden · Ausrichtung aktiv'),
      ).toBeInTheDocument(),
    );
    const toggle = screen.getByRole('switch', {
      name: 'Automatisch ausrichten',
    });
    expect(toggle).toBeChecked();

    await user.click(toggle);
    expect(screen.getByText('Ausrichtung aus')).toBeInTheDocument();
    await user.click(toggle);
    expect(
      screen.getByText('3 Punkte gefunden · Ausrichtung aktiv'),
    ).toBeInTheDocument();
    expect(analyzePair).toHaveBeenCalledTimes(1);
  });

  it('resets the automatic alignment switch to on', async () => {
    const user = userEvent.setup();
    render(<ImageComparator analyzePair={async () => automaticAlignment} />);
    await user.upload(screen.getByLabelText('Lokale Bilder auswählen'), [
      imageFile('a.png'),
      imageFile('b.png'),
    ]);
    const toggle = screen.getByRole('switch', {
      name: 'Automatisch ausrichten',
    });
    await user.click(toggle);
    expect(toggle).not.toBeChecked();

    await user.click(
      screen.getByRole('button', { name: 'Ansicht zurücksetzen' }),
    );

    expect(toggle).toBeChecked();
  });
});
