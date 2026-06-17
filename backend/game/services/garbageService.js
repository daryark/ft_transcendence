const GARBAGE_CELL = 8;
const WARNING_WINDOW_MS = 160;

function normalizeConfig(config = {}) {
  return {
    garbageMult: Number.isFinite(config.garbageMult) ? config.garbageMult : 1,
    garbageCap: Number.isFinite(config.garbageCap) ? config.garbageCap : 8,
    garbageMaxCap: Number.isFinite(config.garbageMaxCap)
      ? config.garbageMaxCap
      : 40,
    garbagePassthrough: config.garbagePassthrough !== false,
    allClearGarbage: Number.isFinite(config.allClearGarbage)
      ? config.allClearGarbage
      : 5,
    garbageDelay: Number.isFinite(config.garbageDelay)
      ? config.garbageDelay
      : 500,
    garbageDelayOnClear: Number.isFinite(config.garbageDelayOnClear)
      ? config.garbageDelayOnClear
      : 100,
    garbageTargeting: ["payback", "even", "random"].includes(
      config.garbageTargeting,
    )
      ? config.garbageTargeting
      : "random",
    garbageColumnChangeChance: Number.isFinite(
      config.garbageColumnChangeChance,
    )
      ? Math.min(1, Math.max(0, config.garbageColumnChangeChance))
      : 0.35,
  };
}

function createGarbageService(config) {
  const garbageConfig = normalizeConfig(config);
  const queues = new Map();
  const lastAttackers = new Map();
  const holeColumns = new Map();
  let sequence = 0;
  let evenIndex = 0;

  function getQueue(playerId) {
    const id = String(playerId);
    if (!queues.has(id)) {
      queues.set(id, []);
    }

    return queues.get(id);
  }

  function serializeQueue(playerId, now = Date.now()) {
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

  function syncState(playerId, state, now = Date.now()) {
    if (!state) return;
    state.garbageQueue = serializeQueue(playerId, now);
  }

  function attackFromClears(linesCleared, state) {
    if (linesCleared <= 1) return 0;

    const lineAttack = linesCleared === 2 ? 1 : linesCleared === 3 ? 2 : 4;
    const boardEmpty = state?.board?.every((row) => row.every((cell) => !cell));
    const allClearBonus = boardEmpty ? garbageConfig.allClearGarbage : 0;

    return Math.max(
      0,
      Math.floor((lineAttack + allClearBonus) * garbageConfig.garbageMult),
    );
  }

  function cancelPending(playerId, attackLines) {
    if (attackLines <= 0 || !garbageConfig.garbagePassthrough) {
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

  function chooseTargets(attackerId, activePlayerIds, attackLines) {
    const attacker = String(attackerId);
    const opponents = activePlayerIds
      .map(String)
      .filter((playerId) => playerId !== attacker);

    if (opponents.length === 0 || attackLines <= 0) return [];

    if (garbageConfig.garbageTargeting === "even") {
      return Array.from({ length: attackLines }, () => {
        const targetId = opponents[evenIndex % opponents.length];
        evenIndex += 1;
        return { targetId, lines: 1 };
      });
    }

    if (garbageConfig.garbageTargeting === "payback") {
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

  function nextHoleColumn(playerId, cols) {
    const id = String(playerId);
    const previous = holeColumns.get(id);

    if (
      previous === undefined ||
      Math.random() < garbageConfig.garbageColumnChangeChance
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

  function receiveGarbage(targetId, attackerId, lines, stateMap, now) {
    const queue = getQueue(targetId);
    const state = stateMap.get(String(targetId));
    const cols = state?.cols ?? 10;
    let queuedLines = queue.reduce((sum, entry) => sum + entry.lines, 0);
    let remainingCapacity = Math.max(
      0,
      garbageConfig.garbageMaxCap - queuedLines,
    );
    const acceptedLines = Math.min(lines, remainingCapacity);

    if (acceptedLines <= 0) return;

    queue.push({
      id: `${now}-${sequence++}`,
      lines: acceptedLines,
      column: nextHoleColumn(targetId, cols),
      receivedAt: now,
      entersAt: now + garbageConfig.garbageDelay,
    });

    if (!lastAttackers.has(String(targetId))) {
      lastAttackers.set(String(targetId), new Set());
    }
    lastAttackers.get(String(targetId)).add(String(attackerId));
  }

  function sendGarbage(attackerId, lines, activePlayerIds, stateMap, now) {
    const targets = chooseTargets(attackerId, activePlayerIds, lines);

    for (const target of targets) {
      receiveGarbage(target.targetId, attackerId, target.lines, stateMap, now);
    }
  }

  function applyGarbageToState(playerId, state, now) {
    const queue = getQueue(playerId);
    if (!state || queue.length === 0) return false;

    let linesToApply = 0;
    const entries = [];

    while (queue.length > 0 && queue[0].entersAt <= now) {
      const entry = queue.shift();
      if (!entry) break;

      const allowed = Math.max(0, garbageConfig.garbageCap - linesToApply);
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

    const garbageRows = [];
    for (const entry of entries) {
      for (let line = 0; line < entry.lines; line += 1) {
        const row = Array.from({ length: state.cols }, (_, col) =>
          col === entry.column ? 0 : GARBAGE_CELL,
        );
        garbageRows.push(row);
      }
    }

    state.board = state.board.slice(linesToApply).concat(garbageRows);
    if (hasOverflow) {
      state.gameOver = true;
    }

    return true;
  }

  function addClearDelay(playerId, linesCleared, now) {
    if (linesCleared <= 0 || garbageConfig.garbageDelayOnClear <= 0) return;

    const delay = garbageConfig.garbageDelayOnClear * linesCleared;
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
  }) {
    const id = String(playerId);
    const cleared = Number(linesCleared) || 0;

    if (cleared > 0) {
      const attack = attackFromClears(cleared, state);
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

module.exports = {
  createGarbageService,
  GARBAGE_CELL,
};
