const { createGarbageService } = require("../../game/services/garbageService");

function createState(rows = 20, cols = 10) {
  return {
    board: Array.from({ length: rows }, () => Array(cols).fill(0)),
    buffer: Array.from({ length: 20 }, () => Array(cols).fill(0)),
    cols,
    rows,
    gameOver: false,
  };
}

function createService(overrides = {}) {
  return createGarbageService({
    garbageMult: 1,
    garbageCap: 8,
    garbageMaxCap: 40,
    allClearGarbage: 0,
    garbageDelay: 1000,
    garbageDelayOnClear: 100,
    garbageTargeting: "random",
    garbageColumnChangeChance: 0,
    ...overrides,
  });
}

describe("garbageService", () => {
  test("queues sent garbage and applies it only after delay on a no-clear lock", () => {
    const service = createService();
    const attacker = createState();
    const defender = createState();
    const states = new Map([
      ["attacker", attacker],
      ["defender", defender],
    ]);

    jest.spyOn(Math, "random").mockReturnValue(0);

    service.handlePieceLocked({
      playerId: "attacker",
      state: attacker,
      linesCleared: 4,
      activePlayerIds: ["attacker", "defender"],
      stateMap: states,
      now: 0,
    });

    expect(defender.garbageQueue).toHaveLength(1);
    expect(defender.garbageQueue[0]).toMatchObject({
      lines: 4,
      status: "pending",
    });

    service.handlePieceLocked({
      playerId: "defender",
      state: defender,
      linesCleared: 0,
      activePlayerIds: ["attacker", "defender"],
      stateMap: states,
      now: 500,
    });

    expect(defender.board.at(-1).every((cell) => cell === 0)).toBe(true);
    expect(defender.garbageQueue[0].lines).toBe(4);

    service.handlePieceLocked({
      playerId: "defender",
      state: defender,
      linesCleared: 0,
      activePlayerIds: ["attacker", "defender"],
      stateMap: states,
      now: 1000,
    });

    expect(defender.board.slice(-4).every((row) => row.slice(1).every(Boolean))).toBe(true);
    expect(defender.garbageQueue).toHaveLength(0);

    Math.random.mockRestore();
  });

  test("clearing lines cancels pending garbage before sending leftovers", () => {
    const service = createService();
    const attacker = createState();
    const defender = createState();
    const states = new Map([
      ["attacker", attacker],
      ["defender", defender],
    ]);

    jest.spyOn(Math, "random").mockReturnValue(0);

    service.handlePieceLocked({
      playerId: "attacker",
      state: attacker,
      linesCleared: 4,
      activePlayerIds: ["attacker", "defender"],
      stateMap: states,
      now: 0,
    });

    service.handlePieceLocked({
      playerId: "defender",
      state: defender,
      linesCleared: 2,
      activePlayerIds: ["attacker", "defender"],
      stateMap: states,
      now: 10,
    });

    expect(defender.garbageQueue[0].lines).toBe(3);
    expect(attacker.garbageQueue).toHaveLength(0);

    service.handlePieceLocked({
      playerId: "defender",
      state: defender,
      linesCleared: 4,
      activePlayerIds: ["attacker", "defender"],
      stateMap: states,
      now: 20,
    });

    expect(defender.garbageQueue).toHaveLength(0);
    expect(attacker.garbageQueue[0].lines).toBe(1);

    Math.random.mockRestore();
  });

  test("double-hole garbage creates two empty cells per garbage row", () => {
    const service = createService({
      garbageHoles: 2,
    });
    const attacker = createState();
    const defender = createState();
    const states = new Map([
      ["attacker", attacker],
      ["defender", defender],
    ]);

    jest.spyOn(Math, "random").mockReturnValue(0);

    service.handlePieceLocked({
      playerId: "attacker",
      state: attacker,
      linesCleared: 4,
      activePlayerIds: ["attacker", "defender"],
      stateMap: states,
      now: 0,
    });

    service.handlePieceLocked({
      playerId: "defender",
      state: defender,
      linesCleared: 0,
      activePlayerIds: ["attacker", "defender"],
      stateMap: states,
      now: 1000,
    });

    for (const row of defender.board.slice(-4)) {
      expect(row.filter((cell) => cell === 0)).toHaveLength(2);
    }

    Math.random.mockRestore();
  });

  test("garbage config can differ per target player", () => {
    const service = createGarbageService(
      {
        garbageMult: 1,
        garbageCap: 8,
        garbageMaxCap: 40,
        allClearGarbage: 0,
        garbageDelay: 1000,
        garbageDelayOnClear: 100,
        garbageTargeting: "even",
        garbageColumnChangeChance: 0,
        garbageHoles: 1,
      },
      (playerId) => (playerId === "defender-a" ? { garbageHoles: 2 } : undefined),
    );
    const attacker = createState();
    const defenderA = createState();
    const defenderB = createState();
    const states = new Map([
      ["attacker", attacker],
      ["defender-a", defenderA],
      ["defender-b", defenderB],
    ]);

    jest.spyOn(Math, "random").mockReturnValue(0);

    service.handlePieceLocked({
      playerId: "attacker",
      state: attacker,
      linesCleared: 4,
      activePlayerIds: ["attacker", "defender-a", "defender-b"],
      stateMap: states,
      now: 0,
    });

    service.handlePieceLocked({
      playerId: "defender-a",
      state: defenderA,
      linesCleared: 0,
      activePlayerIds: ["attacker", "defender-a", "defender-b"],
      stateMap: states,
      now: 1000,
    });
    service.handlePieceLocked({
      playerId: "defender-b",
      state: defenderB,
      linesCleared: 0,
      activePlayerIds: ["attacker", "defender-a", "defender-b"],
      stateMap: states,
      now: 1000,
    });

    expect(defenderA.board.at(-1).filter((cell) => cell === 0)).toHaveLength(2);
    expect(defenderB.board.at(-1).filter((cell) => cell === 0)).toHaveLength(1);

    Math.random.mockRestore();
  });
});
