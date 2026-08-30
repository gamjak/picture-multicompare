'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { estimateSimilarity, triangleSpread } from './alignment';
import { analyzeImagePair, type AlignmentResult } from './image-analysis';
import { SLOT_IDS } from './files';
import type {
  AlignmentEntry,
  ImageItem,
  ImageMetrics,
  ManualAlignmentSession,
  NormalizedPoint,
} from './types';

type AnalyzePair = (
  referenceUrl: string,
  targetUrl: string,
) => Promise<AlignmentResult>;

type UseImageAlignmentOptions = {
  images: ImageItem[];
  enabled: boolean;
  metricsById: Record<string, ImageMetrics>;
  analyze?: AnalyzePair;
};

type EntryMap = Record<string, AlignmentEntry>;

const orderedImages = (images: ImageItem[]) =>
  [...images].sort(
    (left, right) => SLOT_IDS.indexOf(left.slot) - SLOT_IDS.indexOf(right.slot),
  );

const entryMatchesPair = (
  entry: AlignmentEntry,
  reference: ImageItem,
  target: ImageItem,
) =>
  entry.referenceId === reference.id &&
  entry.referenceUrl === reference.url &&
  entry.targetId === target.id &&
  entry.targetUrl === target.url;

export function useImageAlignment({
  images,
  enabled,
  metricsById,
  analyze = analyzeImagePair,
}: UseImageAlignmentOptions) {
  const ordered = useMemo(() => orderedImages(images), [images]);
  const reference = ordered.find((image) => image.slot === 'A') ?? ordered[0];
  const targets = useMemo(
    () => ordered.filter((image) => image.id !== reference?.id),
    [ordered, reference?.id],
  );
  const signature = ordered
    .map((image) => `${image.id}:${image.slot}:${image.url}`)
    .join('|');
  const [entriesByImageId, setEntriesByImageId] = useState<EntryMap>({});
  const entriesRef = useRef<EntryMap>({});
  const generationRef = useRef(0);
  const [retryVersion, setRetryVersion] = useState(0);
  const [manualSession, setManualSession] =
    useState<ManualAlignmentSession | null>(null);
  const targetById = useMemo(
    () => new Map(targets.map((target) => [target.id, target])),
    [targets],
  );
  const visibleEntriesByImageId = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(entriesByImageId).filter(([targetId, entry]) => {
          const target = targetById.get(targetId);
          return Boolean(
            reference && target && entryMatchesPair(entry, reference, target),
          );
        }),
      ),
    [entriesByImageId, reference, targetById],
  );
  const visibleManualSession =
    manualSession && reference && targetById.has(manualSession.targetId)
      ? manualSession
      : null;

  const updateEntries = useCallback(
    (update: (current: EntryMap) => EntryMap) => {
      setEntriesByImageId((current) => {
        const next = update(current);
        entriesRef.current = next;
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    let cancelled = false;

    if (!enabled || !reference || targets.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    const run = async () => {
      await Promise.resolve();
      for (const target of targets) {
        if (cancelled || generationRef.current !== generation) {
          return;
        }

        const cached = entriesRef.current[target.id];
        if (
          cached &&
          cached.status !== 'analyzing' &&
          entryMatchesPair(cached, reference, target)
        ) {
          continue;
        }

        updateEntries((current) => {
          const validEntries = Object.fromEntries(
            Object.entries(current).filter(([targetId, entry]) => {
              const currentTarget = targetById.get(targetId);
              return Boolean(
                currentTarget &&
                entryMatchesPair(entry, reference, currentTarget),
              );
            }),
          );
          return {
            ...validEntries,
            [target.id]: {
              status: 'analyzing',
              referenceId: reference.id,
              referenceUrl: reference.url,
              targetId: target.id,
              targetUrl: target.url,
            },
          };
        });

        let result: AlignmentResult;
        try {
          result = await analyze(reference.url, target.url);
        } catch {
          result = { status: 'failed', reason: 'not-enough-detail' };
        }

        if (cancelled || generationRef.current !== generation) {
          return;
        }

        updateEntries((current) => ({
          ...current,
          [target.id]:
            result.status === 'aligned'
              ? {
                  status: 'aligned',
                  source: 'automatic',
                  referenceId: reference.id,
                  referenceUrl: reference.url,
                  targetId: target.id,
                  targetUrl: target.url,
                  transform: result.transform,
                  anchors: result.anchors,
                  confidence: result.confidence,
                  rmsError: result.rmsError,
                }
              : {
                  status: 'failed',
                  reason: result.reason,
                  referenceId: reference.id,
                  referenceUrl: reference.url,
                  targetId: target.id,
                  targetUrl: target.url,
                },
        }));
        await Promise.resolve();
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    analyze,
    enabled,
    retryVersion,
    signature,
    targets,
    reference,
    targetById,
    updateEntries,
  ]);

  const reanalyze = useCallback(
    (targetId?: string) => {
      updateEntries((current) => {
        if (!targetId) {
          return {};
        }
        const next = { ...current };
        delete next[targetId];
        return next;
      });
      setManualSession((current) =>
        !targetId || current?.targetId === targetId ? null : current,
      );
      setRetryVersion((current) => current + 1);
    },
    [updateEntries],
  );

  const beginManual = useCallback(
    (targetId: string) => {
      if (!reference || !targets.some((target) => target.id === targetId)) {
        return;
      }
      setManualSession({
        targetId,
        phase: 'reference',
        referencePoints: [],
        targetPoints: [],
      });
    },
    [reference, targets],
  );

  const recordManualPoint = useCallback(
    (imageId: string, point: NormalizedPoint) => {
      setManualSession((current) => {
        if (!current || !reference) {
          return current;
        }
        const normalized = {
          x: clampNormalized(point.x),
          y: clampNormalized(point.y),
        };

        if (current.phase === 'reference' && imageId === reference.id) {
          const referencePoints = [
            ...current.referencePoints,
            normalized,
          ].slice(0, 3);
          return {
            ...current,
            referencePoints,
            phase: referencePoints.length === 3 ? 'target' : 'reference',
            error: undefined,
          };
        }

        if (current.phase === 'target' && imageId === current.targetId) {
          const targetPoints = [...current.targetPoints, normalized].slice(
            0,
            3,
          );
          return {
            ...current,
            targetPoints,
            phase: targetPoints.length === 3 ? 'ready' : 'target',
            error: undefined,
          };
        }

        return current;
      });
    },
    [reference],
  );

  const undoManualPoint = useCallback(() => {
    setManualSession((current) => {
      if (!current) {
        return null;
      }
      if (current.targetPoints.length > 0) {
        return {
          ...current,
          targetPoints: current.targetPoints.slice(0, -1),
          phase: 'target',
          error: undefined,
        };
      }
      if (current.referencePoints.length > 0) {
        return {
          ...current,
          referencePoints: current.referencePoints.slice(0, -1),
          phase: 'reference',
          error: undefined,
        };
      }
      return current;
    });
  }, []);

  const cancelManual = useCallback(() => setManualSession(null), []);

  const applyManual = useCallback(() => {
    if (
      !visibleManualSession ||
      !reference ||
      visibleManualSession.phase !== 'ready'
    ) {
      return false;
    }
    const target = targets.find(
      (image) => image.id === visibleManualSession.targetId,
    );
    const referenceMetrics = metricsById[reference.id];
    const targetMetrics = target ? metricsById[target.id] : undefined;

    if (!target || !referenceMetrics || !targetMetrics) {
      setManualSession((current) =>
        current ? { ...current, error: 'missing-metrics' } : current,
      );
      return false;
    }

    if (
      triangleSpread(visibleManualSession.referencePoints) < 0.01 ||
      triangleSpread(visibleManualSession.targetPoints) < 0.01
    ) {
      setManualSession((current) =>
        current ? { ...current, error: 'spread' } : current,
      );
      return false;
    }

    const referencePoints = visibleManualSession.referencePoints.map(
      (point) => ({
        x: point.x * referenceMetrics.width,
        y: point.y * referenceMetrics.height,
      }),
    );
    const targetPoints = visibleManualSession.targetPoints.map((point) => ({
      x: point.x * targetMetrics.width,
      y: point.y * targetMetrics.height,
    }));
    const transform = estimateSimilarity(targetPoints, referencePoints);

    if (!transform) {
      setManualSession((current) =>
        current ? { ...current, error: 'spread' } : current,
      );
      return false;
    }

    updateEntries((current) => ({
      ...current,
      [target.id]: {
        status: 'aligned',
        source: 'manual',
        referenceId: reference.id,
        referenceUrl: reference.url,
        targetId: target.id,
        targetUrl: target.url,
        transform,
        anchors: visibleManualSession.referencePoints.map((point, index) => ({
          reference: point,
          target: visibleManualSession.targetPoints[index],
        })),
        confidence: 1,
        rmsError: 0,
      },
    }));
    setManualSession(null);
    return true;
  }, [visibleManualSession, metricsById, reference, targets, updateEntries]);

  const isApplied = useCallback(
    (imageId: string) =>
      enabled && visibleEntriesByImageId[imageId]?.status === 'aligned',
    [enabled, visibleEntriesByImageId],
  );

  return {
    referenceId: reference?.id ?? null,
    entriesByImageId: visibleEntriesByImageId,
    manualSession: visibleManualSession,
    isApplied,
    reanalyze,
    beginManual,
    recordManualPoint,
    undoManualPoint,
    cancelManual,
    applyManual,
  };
}

function clampNormalized(value: number) {
  return Math.min(1, Math.max(0, value));
}
