import type { ImageItem, IntakeResult, SlotId, StageImage } from './types';

export const MAX_IMAGES = 12;
export const SLOT_IDS: SlotId[] = [
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
];

export function admitImageFiles(
  files: Iterable<File>,
  occupiedCount: number,
): IntakeResult {
  const imageFiles: File[] = [];
  const rejectedNames: string[] = [];

  for (const file of files) {
    if (file.type.startsWith('image/')) {
      imageFiles.push(file);
    } else {
      rejectedNames.push(file.name);
    }
  }

  const available = Math.max(0, MAX_IMAGES - occupiedCount);

  return {
    accepted: imageFiles.slice(0, available),
    rejectedNames,
    overflowCount: Math.max(0, imageFiles.length - available),
  };
}

export function createImageItem(
  file: File,
  id = crypto.randomUUID(),
): ImageItem {
  return {
    id,
    name: file.name,
    type: file.type,
    url: URL.createObjectURL(file),
  };
}

export function stageImagesForAll(images: ImageItem[]): StageImage[] {
  return images.slice(0, MAX_IMAGES).map((image, index) => ({
    ...image,
    slot: SLOT_IDS[index],
  }));
}

export function moveImageToReference(
  images: ImageItem[],
  imageId: string,
): ImageItem[] {
  const nextReference = images.find((image) => image.id === imageId);
  if (!nextReference || images[0]?.id === imageId) {
    return images;
  }

  return [nextReference, ...images.filter((image) => image.id !== imageId)];
}
