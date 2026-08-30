import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  admitImageFiles,
  createImageItem,
  MAX_IMAGES,
  moveImageToReference,
  SLOT_IDS,
  stageImagesForAll,
} from './files';
import type { ImageItem } from './types';

const file = (name: string, type: string) => new File(['x'], name, { type });

const item = (name: string): ImageItem => ({
  id: name,
  name,
  type: 'image/png',
  url: 'blob:' + name,
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('local image files', () => {
  it('keeps up to twelve images and reports invalid and overflowing files', () => {
    const imageFiles = Array.from({ length: 13 }, (_, index) =>
      file(`${index + 1}.png`, 'image/png'),
    );
    const result = admitImageFiles(
      [imageFiles[0], file('notes.txt', 'text/plain'), ...imageFiles.slice(1)],
      0,
    );

    expect(MAX_IMAGES).toBe(12);
    expect(result.accepted).toHaveLength(MAX_IMAGES);
    expect(result.accepted.at(-1)?.name).toBe('12.png');
    expect(result.rejectedNames).toEqual(['notes.txt']);
    expect(result.overflowCount).toBe(1);
  });

  it('uses only the remaining capacity', () => {
    const result = admitImageFiles(
      [file('a.png', 'image/png'), file('b.png', 'image/png')],
      MAX_IMAGES - 1,
    );

    expect(result.accepted.map((entry) => entry.name)).toEqual(['a.png']);
    expect(result.overflowCount).toBe(1);
  });

  it('creates a local object-url item without a permanent stage slot', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'local-id' });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local');

    expect(createImageItem(file('a.png', 'image/png'))).toEqual({
      id: 'local-id',
      name: 'a.png',
      type: 'image/png',
      url: 'blob:local',
    });
  });

  it('assigns all twelve images to simultaneous stage areas A through L', () => {
    const images = Array.from({ length: 12 }, (_, index) =>
      item(String.fromCharCode(97 + index)),
    );

    expect(SLOT_IDS).toEqual([
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
    ]);
    expect(
      stageImagesForAll(images).map((image) => [image.id, image.slot]),
    ).toEqual(images.map((image, index) => [image.id, SLOT_IDS[index]]));
  });

  it('moves a selected image to reference while retaining target order', () => {
    const images = ['a', 'b', 'c', 'd'].map(item);

    expect(moveImageToReference(images, 'c').map((image) => image.id)).toEqual([
      'c',
      'a',
      'b',
      'd',
    ]);
  });
});
