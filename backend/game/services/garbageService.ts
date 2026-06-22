import type { GameState } from "../domain/engine/state";

export const GARBAGE_CELL = 8;
const WARNING_WINDOW_MS = 160;

type GarbageTargetingMode = "payback" | "even" | "random";

type GarbageConfigInput = {
  garbageMult?: number;
  garbageCap?: number;
  garbageMaxCap?: number;
  allClearGarbage?: number;
  garbageDelay?: number;
  garbageDelayOnClear?: number;
  garbageTargeting?: string;
  garbageColumnChangeChance?: number;
  garbageHoles?: number;
};

type GarbageConfigResolver = (
  playerId: string | number,
) => GarbageConfigInput | undefined;

type GarbageConfig = Required<Omit<GarbageConfigInput, "garbageTargeting">> & {
  garbageTargeting: GarbageTargetingMode;
};

type GarbageQueueEntry = {
  id: string;
  lines: number;
  column: number;
  receivedAt: number;
  entersAt: number;
};

type SerializedGarbageQueueEntry = GarbageQueueEntry & {
  status: "pending" | "warning";
};

type GarbageTarget = {
  targetId: string;
  lines: number;
};

type PieceLockedInput = {
  playerId: string | number;
  state: GameState;
  linesCleared: number;
  activePlayerIds: Array<string | number>;
  stateMap: Map<string, GameState>;
  now?: number;
};

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeConfig(config: GarbageConfigInput = {}): GarbageConfig {
  const targeting = config.garbageTargeting;

  return {
    garbageMult: finiteNumber(config.garbageMult, 1),
    garbageCap: finiteNumber(config.garbageCap, 8),
    garbageMaxCap: finiteNumber(config.garbageMaxCap, 40),
    allClearGarbage: finiteNumber(config.allClearGarbage, 5),
    garbageDelay: finiteNumber(config.garbageDelay, 500),
    garbageDelayOnClear: finiteNumber(config.garbageDelayOnClear, 100),
    garbageTargeting:
      targeting === "payback" || targeting === "even" || targeting === "random"
      ? targeting
      : "random",
    garbageColumnChangeChance:
      typeof config.garbageColumnChangeChance === "number" &&
      Number.isFinite(config.garbageColumnChangeChance)
      ? Math.min(1, Math.max(0, config.garbageColumnChangeChance))
      : 0.35,
    garbageHoles: Math.max(1, Math.floor(finiteNumber(config.garbageHoles, 1))),
  };
}

export function createGarbageService(
  config?: GarbageConfigInput,
  resolveConfig?: GarbageConfigResolver,
) {
  const baseConfigInput = config ?? {};
  const garbageConfig = normalizeConfig(baseConfigInput);
  const queues = new Map<string, GarbageQueueEntry[]>();
  const lastAttackers = new Map<string, Set<string>>();
  const holeColumns = new Map<string, number>();
  let sequence = 0;
  let evenIndex = 0;

  function getConfig(playerId: string | number): GarbageConfig {
    if (!resolveConfig) return garbageConfig;

    return normalizeConfig({
      ...baseConfigInput,
      ...(resolveConfig(playerId) ?? {}),
    });
  }

  function getQueue(playerId: string | number): GarbageQueueEntry[] {
    const id = String(playerId);
    if (!queues.has(id)) {
      queues.set(id, []);
    }

    return queues.get(id) ?? [];
  }

  function serializeQueue(
    playerId: string | number,
    now = Date.now(),
  ): SerializedGarbageQueueEntry[] {
    return getQueue(playerId).map((entry) => ({
      id: entry.id,
      lines: entry.lines,
      column: entry.column,
      receivedAt: entry.receivedAt,
      entersAt: entry.entersAt,
      status:
        now >= entry.entersAt - WARNING_WINDOW_MS ? "warning" : "pending",
    }));
  }

  function syncState(
    playerId: string | number,
    state: GameState | undefined,
    now = Date.now(),
  ) {
    if (!state) return;
    state.garbageQueue = serializeQueue(playerId, now);
  }

  function attackFromClears(
    playerId: string | number,
    linesCleared: number,
    state?: GameState,
  ) {
    const config = getConfig(playerId);
    if (linesCleared <= 1) return 0;

    const lineAttack = linesCleared === 2 ? 1 : linesCleared === 3 ? 2 : 4;
    const boardEmpty = state?.board?.every((row) => row.every((cell) => !cell));
    const allClearBonus = boardEmpty ? config.allClearGarbage : 0;

    return Math.max(
      0,
      Math.floor((lineAttack + allClearBonus) * config.garbageMult),
    );
  }

  function cancelPending(playerId: string | number, attackLines: number) {
    if (attackLines <= 0) {
      return attackLines;
    }

    const queue = getQueue(playerId);
    let remaining = attackLines;

    while (remaining > 0 && queue.length > 0) {
      const entry = queue[0];
      const cancelled = Math.min(entry.lines, remaining);
      entry.lines -= cancelled;
      remaining -= cancelled;

      if (entry.lines <= 0) {
        queue.shift();
      }
    }

    return remaining;
  }

  function chooseTargets(
    attackerId: string | number,
    activePlayerIds: Array<string | number>,
    attackLines: number,
  ): GarbageTarget[] {
    const config = getConfig(attackerId);
    const attacker = String(attackerId);
    const opponents = activePlayerIds
      .map(String)
      .filter((playerId) => playerId !== attacker);

    if (opponents.length === 0 || attackLines <= 0) return [];

    if (config.garbageTargeting === "even") {
      return Array.from({ length: attackLines }, () => {
        const targetId = opponents[evenIndex % opponents.length];
        evenIndex += 1;
        return { targetId, lines: 1 };
      });
    }

    if (config.garbageTargeting === "payback") {
      const attackers = Array.from(lastAttackers.get(attacker) ?? []).filter(
        (playerId) => opponents.includes(playerId),
      );
      if (attackers.length > 0) {
        const linesPerTarget = Math.floor(attackLines / attackers.length);
        let remainder = attackLines % attackers.length;
        return attackers
          .map((targetId) => {
            const lines = linesPerTarget + (remainder > 0 ? 1 : 0);
            remainder = Math.max(0, remainder - 1);
            return { targetId, lines };
          })
          .filter((target) => target.lines > 0);
      }
    }

    return [
      {
        targetId: opponents[Math.floor(Math.random() * opponents.length)],
        lines: attackLines,
      },
    ];
  }

  function nextHoleColumn(playerId: string | number, cols: number) {
    const config = getConfig(playerId);
    const id = String(playerId);
    const previous = holeColumns.get(id);

    if (
      previous === undefined ||
      Math.random() < config.garbageColumnChangeChance
    ) {
      let next = Math.floor(Math.random() * cols);
      if (cols > 1 && next === previous) {
        next = (next + 1) % cols;
      }
      holeColumns.set(id, next);
      return next;
    }

    return previous;
  }

  function createGarbageRow(
    playerId: string | number,
    primaryHole: number,
    cols: number,
  ) {
    const holeCount = Math.min(cols, getConfig(playerId).garbageHoles);
    const holes = new Set<number>([
      Math.max(0, Math.min(cols - 1, primaryHole)),
    ]);

    let attempts = 0;
    while (holes.size < holeCount && attempts < cols * 3) {
      holes.add(Math.floor(Math.random() * cols));
      attempts += 1;
    }

    for (let col = 0; holes.size < holeCount && col < cols; col += 1) {
      holes.add(col);
    }

    return Array.from({ length: cols }, (_, col) =>
      holes.has(col) ? 0 : GARBAGE_CELL,
    );
  }

  function receiveGarbage(
    targetId: string,
    attackerId: string | number,
    lines: number,
    stateMap: Map<string, GameState>,
    now: number,
  ) {
    const queue = getQueue(targetId);
    const targetConfig = getConfig(targetId);
    const state = stateMap.get(String(targetId));
    const cols = state?.cols ?? 10;
    const queuedLines = queue.reduce((sum, entry) => sum + entry.lines, 0);
    let remainingCapacity = Math.max(
      0,
      targetConfig.garbageMaxCap - queuedLines,
    );
    const acceptedLines = Math.min(lines, remainingCapacity);

    if (acceptedLines <= 0) return;

    queue.push({
      id: `${now}-${sequence++}`,
      lines: acceptedLines,
      column: nextHoleColumn(targetId, cols),
      receivedAt: now,
      entersAt: now + targetConfig.garbageDelay,
    });

    const targetKey = String(targetId);
    if (!lastAttackers.has(targetKey)) {
      lastAttackers.set(targetKey, new Set());
    }
    lastAttackers.get(targetKey)?.add(String(attackerId));
  }

  function sendGarbage(
    attackerId: string | number,
    lines: number,
    activePlayerIds: Array<string | number>,
    stateMap: Map<string, GameState>,
    now: number,
  ) {
    const targets = chooseTargets(attackerId, activePlayerIds, lines);

    for (const target of targets) {
      receiveGarbage(target.targetId, attackerId, target.lines, stateMap, now);
    }
  }

  function applyGarbageToState(
    playerId: string | number,
    state: GameState,
    now: number,
  ) {
    const queue = getQueue(playerId);
    const config = getConfig(playerId);
    if (!state || queue.length === 0) return false;

    let linesToApply = 0;
    const entries: GarbageQueueEntry[] = [];

    while (queue.length > 0 && queue[0].entersAt <= now) {
      const entry = queue.shift();
      if (!entry) break;

      const allowed = Math.max(0, config.garbageCap - linesToApply);
      if (allowed <= 0) break;

      const lines = Math.min(entry.lines, allowed);
      entries.push({ ...entry, lines });
      linesToApply += lines;

      if (entry.lines > lines) {
        queue.unshift({ ...entry, lines: entry.lines - lines });
        break;
      }
    }

    if (linesToApply <= 0) return false;

    const overflowRows = state.board.slice(0, linesToApply);
    const hasOverflow =
      overflowRows.some((row) => row.some((cell) => cell !== 0)) ||
      state.buffer?.some?.((row) => row.some((cell) => cell !== 0));

    const garbageRows: number[][] = [];
    for (const entry of entries) {
      for (let line = 0; line < entry.lines; line += 1) {
        garbageRows.push(createGarbageRow(playerId, entry.column, state.cols));
      }
    }

    state.board = state.board.slice(linesToApply).concat(garbageRows);
    if (hasOverflow) {
      state.gameOver = true;
    }

    return true;
  }

  function addClearDelay(
    playerId: string | number,
    linesCleared: number,
    now: number,
  ) {
    const config = getConfig(playerId);
    if (linesCleared <= 0 || config.garbageDelayOnClear <= 0) return;

    const delay = config.garbageDelayOnClear * linesCleared;
    for (const entry of getQueue(playerId)) {
      if (entry.entersAt > now) {
        entry.entersAt += delay;
      }
    }
  }

  function handlePieceLocked({
    playerId,
    state,
    linesCleared,
    activePlayerIds,
    stateMap,
    now = Date.now(),
  }: PieceLockedInput) {
    const id = String(playerId);
    const cleared = Number(linesCleared) || 0;

    if (cleared > 0) {
      const attack = attackFromClears(id, cleared, state);
      const outgoing = cancelPending(id, attack);
      addClearDelay(id, cleared, now);
      sendGarbage(id, outgoing, activePlayerIds, stateMap, now);
    } else {
      applyGarbageToState(id, state, now);
    }

    for (const [targetId, targetState] of stateMap.entries()) {
      syncState(targetId, targetState, now);
    }
  }

  return {
    handlePieceLocked,
    syncState,
    serializeQueue,
  };
}
