export const inputTypes = [
  "left",
  "right",
  "down",
  "rotate",
  "rotateCCW",
  "rotate180",
  "drop",
  "hold",
] as const;

export type InputType = (typeof inputTypes)[number];

export type InputPhase = "press" | "release";

export type Input = {
  type: InputType;
  phase?: InputPhase;
  repeat?: boolean;
};

const inputTypeSet = new Set<InputType>(inputTypes);

export function isInput(value: unknown): value is Input {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof value.type === "string" &&
    inputTypeSet.has(value.type as InputType) &&
    (!("phase" in value) ||
      value.phase === "press" ||
      value.phase === "release") &&
    (!("repeat" in value) || typeof value.repeat === "boolean")
  );
}
