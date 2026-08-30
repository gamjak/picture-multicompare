import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AlignmentResult } from './image-analysis';
import type { ImageItem, ImageMetrics } from './types';
import { useImageAlignment } from './useImageAlignment';

const images: ImageItem[] = [
  { id: 'image-a', name: 'A.png', type: 'image/png', url: 'blob:a', slot: 'A' },
  { id: 'image-b', name: 'B.png', type: 'image/png', url: 'blob:b', slot: 'B' },
];

const metricsById: Record<string, ImageMetrics> = {
  'image-a': { width: 1000, height: 800 },
  'image-b': { width: 1000, height: 800 },
  'image-b-new': { width: 1000, height: 800 },
};

const alignedResult: AlignmentResult = {
  status: 'aligned',
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

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
};

describe('useImageAlignment', () => {
  it('analyzes B against A and reuses the cached result across switch changes', async () => {
    const analysis = deferred<AlignmentResult>();
    const analyze = vi.fn(() => analysis.promise);
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useImageAlignment({ images, enabled, metricsById, analyze }),
      { initialProps: { enabled: true } },
    );

    await waitFor(() =>
      expect(result.current.entriesByImageId['image-b']?.status).toBe(
        'analyzing',
      ),
    );
    expect(result.current.referenceId).toBe('image-a');

    act(() => analysis.resolve(alignedResult));
    await waitFor(() =>
      expect(result.current.entriesByImageId['image-b']?.status).toBe(
        'aligned',
      ),
    );
    expect(result.current.isApplied('image-b')).toBe(true);

    rerender({ enabled: false });
    expect(result.current.isApplied('image-b')).toBe(false);
    expect(result.current.entriesByImageId['image-b']?.status).toBe('aligned');

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.isApplied('image-b')).toBe(true));
    expect(analyze).toHaveBeenCalledTimes(1);
  });

  it('ignores an obsolete result after a target image is replaced', async () => {
    const oldAnalysis = deferred<AlignmentResult>();
    const newAnalysis = deferred<AlignmentResult>();
    const analyze = vi
      .fn<() => Promise<AlignmentResult>>()
      .mockImplementationOnce(() => oldAnalysis.promise)
      .mockImplementationOnce(() => newAnalysis.promise);
    const { result, rerender } = renderHook(
      ({ activeImages }) =>
        useImageAlignment({
          images: activeImages,
          enabled: true,
          metricsById,
          analyze,
        }),
      { initialProps: { activeImages: images } },
    );

    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
    const replacement: ImageItem = {
      ...images[1],
      id: 'image-b-new',
      name: 'B-neu.png',
      url: 'blob:b-new',
    };
    rerender({ activeImages: [images[0], replacement] });
    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(2));

    act(() => oldAnalysis.resolve(alignedResult));
    expect(result.current.entriesByImageId['image-b']).toBeUndefined();

    act(() => newAnalysis.resolve(alignedResult));
    await waitFor(() =>
      expect(result.current.entriesByImageId['image-b-new']?.status).toBe(
        'aligned',
      ),
    );
  });

  it('uses the current A slot as reference after reassignment', async () => {
    const analyze = vi.fn(async () => alignedResult);
    const { result, rerender } = renderHook(
      ({ activeImages }) =>
        useImageAlignment({
          images: activeImages,
          enabled: true,
          metricsById,
          analyze,
        }),
      { initialProps: { activeImages: images } },
    );

    await waitFor(() =>
      expect(result.current.entriesByImageId['image-b']?.status).toBe(
        'aligned',
      ),
    );
    rerender({
      activeImages: [
        { ...images[0], slot: 'B' },
        { ...images[1], slot: 'A' },
      ],
    });

    await waitFor(() => expect(result.current.referenceId).toBe('image-b'));
    await waitFor(() =>
      expect(result.current.entriesByImageId['image-a']?.status).toBe(
        'aligned',
      ),
    );
    expect(analyze).toHaveBeenLastCalledWith('blob:b', 'blob:a');
  });

  it('keeps a failed target centered and can retry it explicitly', async () => {
    const analyze = vi
      .fn<() => Promise<AlignmentResult>>()
      .mockResolvedValueOnce({ status: 'failed', reason: 'ambiguous' })
      .mockResolvedValueOnce(alignedResult);
    const { result } = renderHook(() =>
      useImageAlignment({ images, enabled: true, metricsById, analyze }),
    );

    await waitFor(() =>
      expect(result.current.entriesByImageId['image-b']?.status).toBe('failed'),
    );
    expect(result.current.isApplied('image-b')).toBe(false);

    act(() => result.current.reanalyze('image-b'));
    await waitFor(() =>
      expect(result.current.entriesByImageId['image-b']?.status).toBe(
        'aligned',
      ),
    );
    expect(analyze).toHaveBeenCalledTimes(2);
  });

  it('creates a manual alignment from three paired normalized points', async () => {
    const analyze = vi.fn(
      async (): Promise<AlignmentResult> => ({
        status: 'failed',
        reason: 'ambiguous',
      }),
    );
    const { result } = renderHook(() =>
      useImageAlignment({ images, enabled: true, metricsById, analyze }),
    );
    await waitFor(() =>
      expect(result.current.entriesByImageId['image-b']?.status).toBe('failed'),
    );

    act(() => result.current.beginManual('image-b'));
    for (const point of [
      { x: 0.1, y: 0.1 },
      { x: 0.8, y: 0.15 },
      { x: 0.2, y: 0.8 },
    ]) {
      act(() => result.current.recordManualPoint('image-a', point));
    }
    for (const point of [
      { x: 0.12, y: 0.1 },
      { x: 0.82, y: 0.15 },
      { x: 0.22, y: 0.8 },
    ]) {
      act(() => result.current.recordManualPoint('image-b', point));
    }

    expect(result.current.manualSession?.phase).toBe('ready');
    act(() => expect(result.current.applyManual()).toBe(true));

    const entry = result.current.entriesByImageId['image-b'];
    expect(entry?.status).toBe('aligned');
    if (entry?.status === 'aligned') {
      expect(entry.source).toBe('manual');
      expect(entry.transform.translateX).toBeCloseTo(-20, 5);
      expect(entry.transform.translateY).toBeCloseTo(0, 5);
    }
    expect(result.current.manualSession).toBeNull();
  });

  it('rejects clustered manual points without replacing the safe fallback', async () => {
    const analyze = vi.fn(
      async (): Promise<AlignmentResult> => ({
        status: 'failed',
        reason: 'ambiguous',
      }),
    );
    const { result } = renderHook(() =>
      useImageAlignment({ images, enabled: true, metricsById, analyze }),
    );
    await waitFor(() =>
      expect(result.current.entriesByImageId['image-b']?.status).toBe('failed'),
    );

    act(() => result.current.beginManual('image-b'));
    for (const point of [
      { x: 0.1, y: 0.1 },
      { x: 0.11, y: 0.11 },
      { x: 0.12, y: 0.12 },
    ]) {
      act(() => result.current.recordManualPoint('image-a', point));
    }
    for (const point of [
      { x: 0.2, y: 0.2 },
      { x: 0.21, y: 0.21 },
      { x: 0.22, y: 0.22 },
    ]) {
      act(() => result.current.recordManualPoint('image-b', point));
    }

    act(() => expect(result.current.applyManual()).toBe(false));
    expect(result.current.manualSession?.error).toBe('spread');
    expect(result.current.entriesByImageId['image-b']?.status).toBe('failed');
  });
});
