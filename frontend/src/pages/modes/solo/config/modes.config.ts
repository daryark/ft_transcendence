export interface ModeOption {
  id: string;
  label: string;
}

export interface ModeConfig {
  id: string;
  route: string;
  title: string;
  description: string[];
  accentColor: string;
  personalBest?: string;
  showMusic?: boolean;
  showAdvanced?: boolean;
  showOptions?: boolean;
  options?: ModeOption[];
  headerExtra?: "reset" | "export" | null;
  onStartLogic?: "navigate" | "api";
  navigatePath?: string;
}

export const DEFAULT_OPTIONS: ModeOption[] = [
  { id: "pro", label: "PRO MODE" },
  { id: "alert", label: "ALERT ON FINESSE FAULT" },
  { id: "retry", label: "RETRY ON FINESSE FAULT" },
  { id: "stride", label: "STRIDE MODE" },
];

export const MODES_CONFIG: Record<string, ModeConfig> = {
  blitz: {
    id: "blitz",
    route: "/play/solo/blitz",
    title: "Blitz",
    description: [
      "get as many points as possible within 2 minutes!",
      "clear lines to level up and gain more points and speed!",
    ],
    accentColor: "#7B2D2D",
    showMusic: false,
    showAdvanced: true,
    showOptions: true,
    options: DEFAULT_OPTIONS,
    onStartLogic: "navigate",
    navigatePath: "/play/solo/blitz/start",
  },
  "40lines": {
    id: "40lines",
    route: "/play/solo/40lines",
    title: "40 LINES",
    description: [
      "CLEAR 40 LINES IN THE SHORTEST AMOUNT OF TIME POSSIBLE.",
      "SCORE DOESN'T MATTER HERE, JUST GO FOR THE WORLD RECORD!",
    ],
    accentColor: "#8B5E3C",
    personalBest: "2:24.162",
    showAdvanced: true,
    showOptions: true,
    options: DEFAULT_OPTIONS,
    onStartLogic: "navigate",
    navigatePath: "/play/solo/40lines/start",
  },
  zen: {
    id: "zen",
    route: "/play/solo/zen",
    title: "ZEN",
    description: [
      "RELAX OR TRAIN IN A NEVERENDING MODE! YOUR PROGRESS IS STORED ACROSS GAMES.",
      "ADJUST THE FEEL OR HELP TRAIN USING THE ZEN SIDEBAR.",
      "YOU CAN UNDO AND REDO PLACEMENTS WITH CTRL+Z AND CTRL+Y!",
    ],
    accentColor: "#6B3FA0",
    showMusic: false,
    showAdvanced: false,
    showOptions: false,
    headerExtra: "reset",
    onStartLogic: "navigate",
    navigatePath: "/play/solo/zen/start",
  },
};
