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
      screen.getByRole('heading', { name: 'Vierblick' }),
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

  it('loads the first four local images and reports overflow', async () => {
    const user = userEvent.setup();
    render(<ImageComparator />);

    await user.upload(screen.getByLabelText('Lokale Bilder auswählen'), [
      imageFile('a.png'),
      imageFile('b.png'),
      imageFile('c.png'),
      imageFile('d.png'),
      imageFile('e.png'),
    ]);

    expect(screen.getAllByRole('img')).toHaveLength(4);
    expect(screen.getByRole('status')).toHaveTextContent(
      '1 weiteres Bild wurde nicht hinzugefügt',
    );
    expect(
      screen.getByRole('button', { name: 'Bilder hinzufügen' }),
    ).toBeDisabled();
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

  it('removes an image, revokes its URL, and compacts remaining slots', async () => {
    const user = userEvent.setup();
    render(<ImageComparator />);

    await user.upload(screen.getByLabelText('Lokale Bilder auswählen'), [
      imageFile('a.png'),
      imageFile('b.png'),
      imageFile('c.png'),
    ]);
    await user.click(screen.getByRole('button', { name: 'a.png entfernen' }));

    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:a.png');
    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getByLabelText('Position für b.png')).toHaveValue('A');
    expect(screen.getByLabelText('Position für c.png')).toHaveValue('B');
  });

  it('swaps occupied positions from the image tray', async () => {
    const user = userEvent.setup();
    render(<ImageComparator />);

    await user.upload(screen.getByLabelText('Lokale Bilder auswählen'), [
      imageFile('a.png'),
      imageFile('b.png'),
    ]);
    await user.selectOptions(screen.getByLabelText('Position für a.png'), 'B');

    expect(screen.getByLabelText('Position für a.png')).toHaveValue('B');
    expect(screen.getByLabelText('Position für b.png')).toHaveValue('A');
  });

  it('resets divider, shared zoom, and the original image assignment', async () => {
    const user = userEvent.setup();
    render(<ImageComparator />);

    await user.upload(screen.getByLabelText('Lokale Bilder auswählen'), [
      imageFile('a.png'),
      imageFile('b.png'),
    ]);
    await user.selectOptions(screen.getByLabelText('Position für a.png'), 'B');
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
    expect(screen.getByLabelText('Position für a.png')).toHaveValue('A');
    expect(screen.getByLabelText('Position für b.png')).toHaveValue('B');
    expect(
      screen.getByRole('button', { name: /Trennpunkt/ }),
    ).toHaveAccessibleName(/50 Prozent horizontal/);
  });

  it('replaces an image while preserving its position', async () => {
    const user = userEvent.setup();
    render(<ImageComparator />);

    await user.upload(screen.getByLabelText('Lokale Bilder auswählen'), [
      imageFile('a.png'),
      imageFile('b.png'),
    ]);
    await user.upload(
      screen.getByLabelText('a.png ersetzen'),
      imageFile('neu.png'),
    );

    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:a.png');
    expect(
      screen.queryByLabelText('Position für a.png'),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Position für neu.png')).toHaveValue('A');
  });

  it('shows keyboard focus on replacement controls and skips hidden pickers', async () => {
    const user = userEvent.setup();
    render(<ImageComparator />);

    const addPicker = screen.getByLabelText('Lokale Bilder auswählen');
    expect(addPicker).toHaveAttribute('tabindex', '-1');

    await user.upload(addPicker, imageFile('a.png'));

    const replacePicker = screen.getByLabelText('a.png ersetzen');
    expect(replacePicker.closest('.tray-icon-button')).toBeInTheDocument();
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
