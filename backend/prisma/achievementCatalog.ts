export type AchievementRarity = "common" | "rare" | "epic";

export type AchievementCode =
  | "first_piece"
  | "first_line"
  | "double_clear"
  | "triple_clear"
  | "pieces_25"
  | "hard_drops_25"
  | "first_hold"
  | "tiny_comeback"
  | "total_lines_10"
  | "score_1000"
  | "first_tetris"
  | "lines_25"
  | "pieces_100"
  | "hard_drops_100"
  | "holds_25"
  | "combo_3"
  | "score_10000"
  | "multiplayer_survive_180"
  | "level_10"
  | "tetrises_10"
  | "pieces_500"
  | "combo_5"
  | "lines_100"
  | "multiplayer_survive_300"
  | "level_50"
  | "multiplayer_score_50000"
  | "hard_drops_250"
  | "holds_100";

export type AchievementDefinition = {
  id: number;
  code: AchievementCode;
  name: string;
  description: string;
  rarity: AchievementRarity;
  target: number;
};

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { id: 1, code: "first_piece", name: "Block, Stock and Barrel", description: "Place your first piece.", rarity: "common", target: 1 },
  { id: 2, code: "first_line", name: "Line Goes Up? No, Down.", description: "Clear your first line.", rarity: "common", target: 1 },
  { id: 3, code: "double_clear", name: "Two Birds, One Block", description: "Clear 2 lines at once.", rarity: "common", target: 2 },
  { id: 4, code: "triple_clear", name: "Three's Company", description: "Clear 3 lines at once.", rarity: "common", target: 3 },
  { id: 5, code: "pieces_25", name: "Square Deal", description: "Place 25 pieces in one game.", rarity: "common", target: 25 },
  { id: 6, code: "hard_drops_25", name: "Gravity Enjoyer", description: "Use hard drop 25 times in one game.", rarity: "common", target: 25 },
  { id: 7, code: "first_hold", name: "Hold My Block", description: "Use hold for the first time.", rarity: "common", target: 1 },
  { id: 8, code: "tiny_comeback", name: "Tiny Comeback", description: "Clear a line after the stack reaches half the field.", rarity: "common", target: 1 },
  { id: 9, code: "total_lines_10", name: "Stack Intern", description: "Clear 10 total lines.", rarity: "common", target: 10 },
  { id: 10, code: "score_1000", name: "Not Quite Art", description: "Reach 1,000 points.", rarity: "common", target: 1000 },
  { id: 11, code: "first_tetris", name: "Tetris, Actually", description: "Clear 4 lines at once.", rarity: "rare", target: 1 },
  { id: 12, code: "lines_25", name: "Line Cook", description: "Clear 25 lines in one game.", rarity: "rare", target: 25 },
  { id: 13, code: "pieces_100", name: "Blocksmith", description: "Place 100 pieces in one game.", rarity: "rare", target: 100 },
  { id: 14, code: "hard_drops_100", name: "Drop It Like It's Hot", description: "Use hard drop 100 times in one game.", rarity: "rare", target: 100 },
  { id: 15, code: "holds_25", name: "Professional Procrastinator", description: "Use hold 25 times in one game.", rarity: "rare", target: 25 },
  { id: 16, code: "combo_3", name: "Combo Meal", description: "Reach a 3-combo in one game.", rarity: "rare", target: 3 },
  { id: 17, code: "score_10000", name: "Stack Overflow", description: "Reach 10,000 points.", rarity: "rare", target: 10000 },
  { id: 18, code: "multiplayer_survive_180", name: "Still Standing", description: "Survive 3 minutes in multiplayer.", rarity: "rare", target: 180 },
  { id: 19, code: "level_10", name: "Mildly Geometric", description: "Reach level 10.", rarity: "rare", target: 10 },
  { id: 21, code: "tetrises_10", name: "Four Real This Time", description: "Clear 10 Tetrises in one game.", rarity: "epic", target: 10 },
  { id: 23, code: "pieces_500", name: "Certified Bricklayer", description: "Place 500 pieces in one game.", rarity: "epic", target: 500 },
  { id: 24, code: "combo_5", name: "Combo Wombo", description: "Reach a 5-combo in one game.", rarity: "epic", target: 5 },
  { id: 25, code: "lines_100", name: "Ctrl + Alt + Deplete", description: "Clear 100 lines in one game.", rarity: "epic", target: 100 },
  { id: 26, code: "multiplayer_survive_300", name: "Panic at the Gridco", description: "Survive 5 minutes in multiplayer.", rarity: "epic", target: 300 },
  { id: 27, code: "level_50", name: "That Escalated Vertically", description: "Reach level 50.", rarity: "epic", target: 50 },
  { id: 28, code: "multiplayer_score_50000", name: "Point Taken", description: "Reach 50,000 points in multiplayer.", rarity: "epic", target: 50000 },
  { id: 29, code: "hard_drops_250", name: "Hard Drop Addict", description: "Use hard drop 250 times in one game.", rarity: "epic", target: 250 },
  { id: 30, code: "holds_100", name: "Held Together by Blocks", description: "Use hold 100 times in one game.", rarity: "epic", target: 100 },
] as const;

