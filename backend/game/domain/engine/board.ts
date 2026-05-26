export type BoardWidth = number & { __brand: "BoardWidth" };
export type BoardHeight = number & { __brand: "BoardHeight" };

export function createBoardWidth(value: number): BoardWidth {
  if (!Number.isInteger(value) || value < 4 || value > 20) {
    throw new Error("Invalid board width");
  }

  return value as BoardWidth;
}

export function createBoardHeight(value: number): BoardHeight {
  if (!Number.isInteger(value) || value < 4 || value > 40) {
    throw new Error("Invalid board height");
  }

  return value as BoardHeight;
}

export function createEmptyBoard(rows: BoardHeight, cols: BoardWidth): number[][] {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}
