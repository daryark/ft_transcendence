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

export type Input = { type: InputType };

const inputTypeSet = new Set<InputType>(inputTypes);

export function isInput(value: unknown): value is Input {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof value.type === "string" &&
    inputTypeSet.has(value.type as InputType)
  );
}
