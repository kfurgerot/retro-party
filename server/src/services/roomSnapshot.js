// Phase β — persist retro/poker rooms across server restarts.
//
// Rooms live in RAM Maps (`rooms` for retro, `pokerRooms` for poker). This
// service serializes the persistable parts to a JSONB column on the `rooms`
// table, and rehydrates them at server boot. Sockets reattach via existing
// reconnect logic (sessionId-based).
//
// Strategy:
// - markDirty(code) — flagged after every broadcast
// - flushDirty(pool) — writes dirty rooms to DB (throttled by setInterval)
// - hydrate(pool, ...) — reconstructs Maps from `rooms` rows where status IN
//   ('lobby','live') and state_snapshot IS NOT NULL

const dirtyRetro = new Set();
const dirtyPoker = new Set();

export function markRetroDirty(code) {
  if (code) dirtyRetro.add(code);
}

export function markPokerDirty(code) {
  if (code) dirtyPoker.add(code);
}

// --- Retro serialization -----------------------------------------------------

function serializeRetroRoom(room) {
  if (!room) return null;
  return {
    kind: "retro",
    state: room.state ?? null,
    lobby: (room.lobby ?? []).map((p) => ({
      socketId: null,
      sessionId: p.sessionId ?? null,
      name: p.name ?? "",
      avatar: p.avatar ?? 0,
      isHost: !!p.isHost,
      connected: false,
    })),
    configSnapshot: room.configSnapshot ?? null,
    mode: room.mode ?? "quick",
    sourceTemplateId: room.sourceTemplateId ?? null,
    createdByUserId: room.createdByUserId ?? null,
  };
}

function deserializeRetroRoom(snapshot) {
  if (!snapshot || snapshot.kind !== "retro") return null;
  return {
    state: snapshot.state,
    hostSocketId: null,
    clients: new Set(),
    disconnectTimers: new Map(),
    wsi: null,
    wsiTimers: new Set(),
    bwdTimers: new Set(),
    pointDuelTimers: new Set(),
    configSnapshot: snapshot.configSnapshot ?? null,
    mode: snapshot.mode ?? "quick",
    sourceTemplateId: snapshot.sourceTemplateId ?? null,
    createdByUserId: snapshot.createdByUserId ?? null,
    lobby: (snapshot.lobby ?? []).map((p) => ({
      ...p,
      socketId: null,
      connected: false,
    })),
  };
}

// --- Poker serialization -----------------------------------------------------

function serializePokerRoom(room) {
  if (!room) return null;
  return {
    kind: "poker",
    code: room.code,
    phase: room.phase,
    storyTitle: room.storyTitle,
    isPreparedSession: !!room.isPreparedSession,
    sessionEnded: !!room.sessionEnded,
    voteSystem: room.voteSystem,
    returnStoryTitle: room.returnStoryTitle ?? null,
    votesOpen: !!room.votesOpen,
    round: room.round ?? 1,
    revealed: !!room.revealed,
    preparedStories: room.preparedStories ?? [],
    currentStoryIndex: room.currentStoryIndex ?? -1,
    lobby: (room.lobby ?? []).map((p) => ({
      socketId: null,
      sessionId: p.sessionId ?? null,
      name: p.name ?? "",
      avatar: p.avatar ?? 0,
      isHost: !!p.isHost,
      connected: false,
      role: p.role ?? "player",
      hasVoted: !!p.hasVoted,
      vote: p.vote ?? null,
    })),
  };
}

function deserializePokerRoom(snapshot) {
  if (!snapshot || snapshot.kind !== "poker") return null;
  return {
    code: snapshot.code,
    phase: snapshot.phase ?? "lobby",
    storyTitle: snapshot.storyTitle ?? "Story #1",
    isPreparedSession: !!snapshot.isPreparedSession,
    sessionEnded: !!snapshot.sessionEnded,
    voteSystem: snapshot.voteSystem ?? "fibonacci",
    returnStoryTitle: snapshot.returnStoryTitle ?? null,
    votesOpen: !!snapshot.votesOpen,
    round: snapshot.round ?? 1,
    revealed: !!snapshot.revealed,
    hostSocketId: null,
    preparedStories: snapshot.preparedStories ?? [],
    currentStoryIndex: snapshot.currentStoryIndex ?? -1,
    clients: new Set(),
    disconnectTimers: new Map(),
    lobby: (snapshot.lobby ?? []).map((p) => ({
      ...p,
      socketId: null,
      connected: false,
    })),
  };
}

// --- Flush + hydrate ---------------------------------------------------------

export async function flushDirtyRooms(pool, { rooms, pokerRooms }) {
  const writes = [];
  for (const code of dirtyRetro) {
    const room = rooms.get(code);
    if (!room) continue;
    writes.push({ code, snapshot: serializeRetroRoom(room) });
  }
  dirtyRetro.clear();
  for (const code of dirtyPoker) {
    const room = pokerRooms.get(code);
    if (!room) continue;
    writes.push({ code, snapshot: serializePokerRoom(room) });
  }
  dirtyPoker.clear();

  for (const w of writes) {
    try {
      await pool.query(
        `UPDATE rooms
         SET state_snapshot = $1::jsonb, state_snapshot_at = now()
         WHERE room_code = $2`,
        [JSON.stringify(w.snapshot), w.code],
      );
    } catch (err) {
      console.error("[snapshot] failed to persist", w.code, err.message);
    }
  }
  return writes.length;
}

export async function hydrateRooms(pool, { rooms, pokerRooms }) {
  const result = await pool.query(
    `SELECT room_code, state_snapshot
     FROM rooms
     WHERE status IN ('lobby','live')
       AND state_snapshot IS NOT NULL`,
  );
  let retroCount = 0;
  let pokerCount = 0;
  for (const row of result.rows) {
    const snapshot =
      typeof row.state_snapshot === "string" ? safeParse(row.state_snapshot) : row.state_snapshot;
    if (!snapshot) continue;
    if (snapshot.kind === "retro") {
      const room = deserializeRetroRoom(snapshot);
      if (room) {
        rooms.set(row.room_code, room);
        retroCount++;
      }
    } else if (snapshot.kind === "poker") {
      const room = deserializePokerRoom(snapshot);
      if (room) {
        pokerRooms.set(row.room_code, room);
        pokerCount++;
      }
    }
  }
  return { retroCount, pokerCount };
}

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// Phase β.2 — persist quick (non-template) retro/poker rooms so the lifecycle
// service can resolve them. Fire-and-forget; conflicts are ignored.
export async function persistQuickRoom(pool, crypto, code, kind) {
  if (!code || !crypto || !pool) return;
  const module = kind === "poker" ? "planning-poker" : "retro-party";
  try {
    await pool.query(
      `INSERT INTO rooms (id, room_code, mode, config_snapshot, status)
       VALUES ($1, $2, 'quick', $3::jsonb, 'lobby')
       ON CONFLICT (room_code) DO NOTHING`,
      [crypto.randomUUID(), code, JSON.stringify({ baseConfig: { module } })],
    );
  } catch (err) {
    console.error("[snapshot] persistQuickRoom failed", code, err.message);
  }
}

export function startSnapshotFlushLoop(pool, maps, intervalMs = 1000) {
  return setInterval(() => {
    flushDirtyRooms(pool, maps).catch((err) => console.error("[snapshot] flush loop failed", err));
  }, intervalMs);
}
