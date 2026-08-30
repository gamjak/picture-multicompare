export type Point = {
  x: number;
  y: number;
};

export type SlotId = "A" | "B" | "C" | "D";

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
