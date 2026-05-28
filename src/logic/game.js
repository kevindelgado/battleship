/** Game state, applyShot, winner detection, turn flow. Zero DOM references. */

import { cellKey } from './board.js';
import { allSunk, isSunk } from './fleet.js';
import { FLEET } from './fleet.js';
import { randomPlacement } from './placement.js';

export function createGameState({
  playerShips,
  aiShips,
  difficulty = 'easy',
  firstMove = 'player',
  rng = Math.random,
}) {
  let turn = firstMove;
  if (turn === 'random') {
    turn = rng() < 0.5 ? 'player' : 'ai';
  }

  return {
    phase: 'playing',
    difficulty,
    turn,
    player: {
      ships: playerShips,
      shots: new Map(),
    },
    ai: {
      ships: aiShips,
      shots: new Map(),
      memory: {},
    },
    status: turn === 'player' ? 'Your turn.' : "AI is thinking...",
    winner: null,
  };
}

export function createInitialState(difficulty = 'easy') {
  return {
    phase: 'placement',
    difficulty,
    turn: 'player',
    player: {
      ships: [],
      shots: new Map(),
    },
    ai: {
      ships: [],
      shots: new Map(),
      memory: {},
    },
    placement: {
      queue: FLEET.map((f) => f.id),
      orientation: 'horizontal',
    },
    status: `Place your ${FLEET[0].name} (length ${FLEET[0].length}). Press R to rotate.`,
    winner: null,
    firstMove: 'player',
  };
}

export function applyShot(state, shooter, r, c) {
  const key = cellKey(r, c);
  const target = shooter === 'player' ? state.ai : state.player;
  const shooterSide = shooter === 'player' ? state.player : state.ai;

  if (shooterSide.shots.has(key)) {
    return { result: 'duplicate', sunkShip: null };
  }

  let hit = false;
  let sunkShip = null;

  for (const ship of target.ships) {
    for (const cell of ship.cells) {
      if (cell.r === r && cell.c === c) {
        hit = true;
        ship.hits.add(key);
        if (isSunk(ship)) {
          sunkShip = ship;
        }
        break;
      }
    }
    if (hit) break;
  }

  shooterSide.shots.set(key, hit ? 'hit' : 'miss');

  if (allSunk(target.ships)) {
    state.phase = 'gameover';
    state.winner = shooter;
    if (shooter === 'player') {
      state.status = 'Victory — you sank the enemy fleet.';
    } else {
      state.status = 'Defeat — your fleet was sunk.';
    }
  } else if (sunkShip) {
    if (shooter === 'player') {
      state.status = `You sank their ${sunkShip.name}.`;
    } else {
      state.status = `They sank your ${sunkShip.name}.`;
    }
  } else if (hit) {
    state.status = 'Hit!';
  } else {
    state.status = 'Miss.';
  }

  return { result: hit ? 'hit' : 'miss', sunkShip };
}

export function switchTurn(state) {
  if (state.phase === 'gameover') return;
  state.turn = state.turn === 'player' ? 'ai' : 'player';
  if (state.turn === 'player') {
    state.status = 'Your turn.';
  } else {
    state.status = 'AI is thinking...';
  }
}

export function startGame(state, rng = Math.random) {
  const aiShips = randomPlacement(FLEET, rng);
  let turn = state.firstMove;
  if (turn === 'random') {
    turn = rng() < 0.5 ? 'player' : 'ai';
  }

  state.phase = 'playing';
  state.ai.ships = aiShips;
  state.turn = turn;
  state.status = turn === 'player' ? 'Your turn.' : 'AI is thinking...';
  state.placement = undefined;
}
