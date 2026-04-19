import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  initializePlayers,
  movePlayer,
  movePlayerWithRules,
  nextTurn,
} from "./gameLogic.js";

function makeLobbyPlayers() {
  return [
    { socketId: "s1", name: "Alice", avatar: 1, isHost: true },
    { socketId: "s2", name: "Bob", avatar: 2, isHost: false },
  ];
}

function makeLinearTiles() {
  return [
    { id: 0, type: "start", nextTileIds: [1] },
    { id: 1, type: "blue", nextTileIds: [2] },
    { id: 2, type: "green", nextTileIds: [3] },
    { id: 3, type: "red", nextTileIds: [4] },
    { id: 4, type: "yellow", nextTileIds: [] },
  ];
}

test("initializePlayers initialise le state de partie avec les valeurs attendues", () => {
  const initialState = createInitialState();
  const state = initializePlayers(initialState, makeLobbyPlayers(), 7);

  assert.equal(state.phase, "playing");
  assert.equal(state.turnPhase, "pre_roll");
  assert.equal(state.maxRounds, 7);
  assert.equal(state.players.length, 2);
  assert.deepEqual(
    state.players.map((player) => player.position),
    [0, 0],
  );
  assert.equal(state.players[0].isHost, true);
  assert.equal(state.players[1].isHost, false);
  assert.equal(state.players[0].points, 0);
  assert.equal(state.players[0].stars, 0);
});

test("movePlayerWithRules applique le fallback de branchement et achete une etoile sur case bonus", () => {
  const board = {
    nodes: [
      { id: "0", type: "start", next: ["1", "2"] },
      { id: "1", type: "blue", next: ["3"] },
      { id: "2", type: "red", next: ["3"] },
      { id: "3", type: "bonus", next: [] },
    ],
    players: [{ id: "p1", positionNodeId: "0", points: 10, stars: 0 }],
  };

  const chooseFn = (context) => {
    if (context?.kind === "kudo_purchase") return true;
    return "999";
  };

  const result = movePlayerWithRules(board, "p1", 2, chooseFn);

  assert.deepEqual(result.path, ["0", "1", "3"]);
  assert.equal(result.pointsAfter, 0);
  assert.equal(result.starsAfter, 1);
  assert.ok(result.events.some((event) => event.type === "invalid_choice_fallback"));
  assert.ok(result.events.some((event) => event.type === "branch_choice"));
  assert.ok(result.events.some((event) => event.type === "kudobox_buy_star"));
});

test("movePlayer utilise la valeur de de serveur (diceValue) et ignore le parametre steps client", () => {
  const initialState = createInitialState();
  const prepared = initializePlayers(initialState, makeLobbyPlayers(), 12);
  const state = {
    ...prepared,
    board: { seed: 1, cols: 1, rows: 1, length: 5 },
    tiles: makeLinearTiles(),
    diceValue: 2,
    turnPhase: "moving",
    currentQuestion: null,
    currentMinigame: null,
    pendingPathChoice: null,
    pendingKudoPurchase: null,
    pendingShop: null,
  };

  const moved = movePlayer(state, "s1", 99);

  assert.equal(moved.players[0].position, 2);
  assert.equal(moved.diceValue, null);
  assert.equal(moved.currentQuestion?.targetPlayerId, "s1");
  assert.equal(moved.currentQuestion?.type, "green");
});

test("nextTurn saute un joueur marque skipNextTurn et passe au round suivant", () => {
  const initialState = createInitialState();
  const prepared = initializePlayers(initialState, makeLobbyPlayers(), 3);
  const state = {
    ...prepared,
    currentPlayerIndex: 0,
    currentRound: 1,
    players: prepared.players.map((player, index) =>
      index === 1 ? { ...player, skipNextTurn: true } : { ...player },
    ),
    currentQuestion: null,
    currentMinigame: null,
    pendingPathChoice: null,
    pendingKudoPurchase: null,
    pendingShop: null,
  };

  const next = nextTurn(state);

  assert.equal(next.currentPlayerIndex, 0);
  assert.equal(next.currentRound, 2);
  assert.equal(next.players[1].skipNextTurn, false);
  assert.equal(next.turnPhase, "pre_roll");
});
