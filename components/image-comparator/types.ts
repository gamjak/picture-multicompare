export type Point = {
  x: number;
  y: number;
};

export type NormalizedPoint = Point;

export type ImageMetrics = {
  width: number;
  height: number;
};

export type StageSize = {
  width: number;
  height: number;
};

export type ContainRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
};

export type SimilarityTransform = {
  scale: number;
  rotation: number;
  translateX: number;
  translateY: number;
};

export type CssMatrix = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

export type AlignmentAnchor = {
  reference: NormalizedPoint;
  target: NormalizedPoint;
};

export type AlignmentFailureReason =
  | 'not-enough-detail'
  | 'ambiguous'
  | 'out-of-range';

type AlignmentEntryBase = {
  referenceId: string;
  referenceUrl: string;
  targetId: string;
  targetUrl: string;
};

export type AlignmentEntry =
  | (AlignmentEntryBase & { status: 'analyzing' })
  | (AlignmentEntryBase & {
      status: 'failed';
      reason: AlignmentFailureReason;
    })
  | (AlignmentEntryBase & {
      status: 'aligned';
      source: 'automatic' | 'manual';
      transform: SimilarityTransform;
      anchors: AlignmentAnchor[];
      confidence: number;
      rmsError: number;
    });

export type ManualAlignmentSession = {
  targetId: string;
  phase: 'reference' | 'target' | 'ready';
  referencePoints: NormalizedPoint[];
  targetPoints: NormalizedPoint[];
  error?: 'spread' | 'missing-metrics';
};

export type SlotId = 'A' | 'B' | 'C' | 'D';

export type ImageItem = {
  id: string;
  name: string;
  type: string;
  url: string;
  slot: SlotId;
};

export type IntakeResult = {
  accepted: File[];
  rejectedNames: string[];
  overflowCount: number;
};
