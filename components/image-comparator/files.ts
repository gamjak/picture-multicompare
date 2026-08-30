import type { ImageItem, IntakeResult, SlotId } from './types';

export const SLOT_IDS: SlotId[] = ['A', 'B', 'C', 'D'];

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

  const available = Math.max(0, 4 - occupiedCount);

  return {
    accepted: imageFiles.slice(0, available),
    rejectedNames,
    overflowCount: Math.max(0, imageFiles.length - available),
  };
}

export function createImageItem(file: File, slot: SlotId): ImageItem {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type,
    url: URL.createObjectURL(file),
    slot,
  };
}

export function compactSlots(items: ImageItem[]): ImageItem[] {
  const compactedSlots = new Map(
    [...items]
      .sort((a, b) => SLOT_IDS.indexOf(a.slot) - SLOT_IDS.indexOf(b.slot))
      .map((item, index) => [item.id, SLOT_IDS[index]]),
  );

  return items.map((item) => ({
    ...item,
    slot: compactedSlots.get(item.id) ?? item.slot,
  }));
}

export function swapSlots(
  items: ImageItem[],
  from: SlotId,
  to: SlotId,
): ImageItem[] {
  return items.map((item) => {
    if (item.slot === from) {
      return { ...item, slot: to };
    }

    if (item.slot === to) {
      return { ...item, slot: from };
    }

    return item;
  });
}
