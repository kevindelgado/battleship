import { describe, it, expect } from 'vitest';
import {
  createGameState,
  applyShot,
  switchTurn,
} from '../src/logic/game.js';
import { cellKey } from '../src/logic/board.js';
import { isSunk } from '../src/logic/fleet.js';

function makeShip(id, name, length, cells) {
  return {
    id,
    name,
    length,
    cells: cells.map(([r, c]) => ({ r, c })),
    hits: new Set(),
  };
}

function makeMinimalState(opts = {}) {
  const playerShips = opts.playerShips || [
    makeShip('destroyer', 'Destroyer', 2, [
      [0, 0],
      [0, 1],
    ]),
  ];
  const aiShips = opts.aiShips || [
    makeShip('destroyer', 'Destroyer', 2, [
      [5, 5],
      [5, 6],
    ]),
  ];
  return createGameState({
    playerShips,
    aiShips,
    difficulty: opts.difficulty || 'easy',
    firstMove: opts.firstMove || 'player',
    rng: opts.rng || (() => 0.5),
  });
}

describe('hit detection', () => {
  it('marks a ship cell as hit on the correct ship', () => {
    const state = makeMinimalState();
    const { result } = applyShot(state, 'player', 5, 5);
    expect(result).toBe('hit');
    expect(state.ai.ships[0].hits.has(cellKey(5, 5))).toBe(true);
    expect(state.player.shots.get(cellKey(5, 5))).toBe('hit');
  });

  it('records a miss for an empty cell', () => {
    const state = makeMinimalState();
    const { result } = applyShot(state, 'player', 3, 3);
    expect(result).toBe('miss');
    expect(state.player.shots.get(cellKey(3, 3))).toBe('miss');
  });

  it('rejects duplicate shots', () => {
    const state = makeMinimalState();
    applyShot(state, 'player', 5, 5);
    const { result } = applyShot(state, 'player', 5, 5);
    expect(result).toBe('duplicate');
  });
});

describe('sink detection', () => {
  it('reports sunk only when all cells are hit', () => {
    const state = makeMinimalState();

    const { sunkShip: s1 } = applyShot(state, 'player', 5, 5);
    expect(s1).toBeNull();
    expect(isSunk(state.ai.ships[0])).toBe(false);

    const { sunkShip: s2 } = applyShot(state, 'player', 5, 6);
    expect(s2).not.toBeNull();
    expect(s2.id).toBe('destroyer');
    expect(isSunk(state.ai.ships[0])).toBe(true);
  });

  it('does not report sunk when only some cells are hit', () => {
    const aiShips = [
      makeShip('cruiser', 'Cruiser', 3, [
        [0, 0],
        [0, 1],
        [0, 2],
      ]),
    ];
    const state = makeMinimalState({ aiShips });

    applyShot(state, 'player', 0, 0);
    applyShot(state, 'player', 0, 1);
    expect(isSunk(state.ai.ships[0])).toBe(false);
  });
});

describe('win detection', () => {
  it('declares winner only when ALL opposing ships are sunk', () => {
    const aiShips = [
      makeShip('destroyer', 'Destroyer', 2, [
        [0, 0],
        [0, 1],
      ]),
      makeShip('submarine', 'Submarine', 3, [
        [2, 0],
        [2, 1],
        [2, 2],
      ]),
    ];
    const state = makeMinimalState({ aiShips });

    // Sink the first ship
    applyShot(state, 'player', 0, 0);
    applyShot(state, 'player', 0, 1);
    expect(state.phase).toBe('playing'); // NOT gameover yet
    expect(state.winner).toBeNull();

    // Sink the second ship
    applyShot(state, 'player', 2, 0);
    applyShot(state, 'player', 2, 1);
    applyShot(state, 'player', 2, 2);
    expect(state.phase).toBe('gameover');
    expect(state.winner).toBe('player');
  });
});

describe('immediate end-of-game termination (§246)', () => {
  it('player wins (firstMove=player): losing side never fires after winning shot', () => {
    // One ship per side, player goes first
    const playerShips = [
      makeShip('destroyer', 'Destroyer', 2, [
        [0, 0],
        [0, 1],
      ]),
    ];
    const aiShips = [
      makeShip('destroyer', 'Destroyer', 2, [
        [5, 5],
        [5, 6],
      ]),
    ];
    const state = makeMinimalState({
      playerShips,
      aiShips,
      firstMove: 'player',
    });

    // Player fires, hits
    applyShot(state, 'player', 5, 5);
    switchTurn(state);

    // AI fires
    applyShot(state, 'ai', 0, 0);
    switchTurn(state);

    // Player fires winning shot
    applyShot(state, 'player', 5, 6);

    expect(state.phase).toBe('gameover');
    expect(state.winner).toBe('player');

    // AI should NOT have gotten another shot after the winning shot
    // AI has exactly 1 shot (from the earlier turn)
    expect(state.ai.shots.size).toBe(1);
  });

  it('player wins (firstMove=ai): losing side never fires after winning shot', () => {
    const playerShips = [
      makeShip('destroyer', 'Destroyer', 2, [
        [0, 0],
        [0, 1],
      ]),
    ];
    const aiShips = [
      makeShip('destroyer', 'Destroyer', 2, [
        [5, 5],
        [5, 6],
      ]),
    ];
    const state = makeMinimalState({
      playerShips,
      aiShips,
      firstMove: 'ai',
    });

    // AI goes first, fires
    applyShot(state, 'ai', 0, 0);
    switchTurn(state);

    // Player fires hit
    applyShot(state, 'player', 5, 5);
    switchTurn(state);

    // AI fires again
    applyShot(state, 'ai', 3, 3);
    switchTurn(state);

    // Player fires winning shot
    applyShot(state, 'player', 5, 6);

    expect(state.phase).toBe('gameover');
    expect(state.winner).toBe('player');

    // AI had exactly 2 shots, none after the winning shot
    expect(state.ai.shots.size).toBe(2);
  });

  it('AI wins (firstMove=player): losing side never fires after winning shot', () => {
    const playerShips = [
      makeShip('destroyer', 'Destroyer', 2, [
        [0, 0],
        [0, 1],
      ]),
    ];
    const aiShips = [
      makeShip('destroyer', 'Destroyer', 2, [
        [5, 5],
        [5, 6],
      ]),
    ];
    const state = makeMinimalState({
      playerShips,
      aiShips,
      firstMove: 'player',
    });

    // Player misses
    applyShot(state, 'player', 9, 9);
    switchTurn(state);

    // AI hits
    applyShot(state, 'ai', 0, 0);
    switchTurn(state);

    // Player misses
    applyShot(state, 'player', 8, 8);
    switchTurn(state);

    const playerShotsBefore = state.player.shots.size;

    // AI fires winning shot
    applyShot(state, 'ai', 0, 1);

    expect(state.phase).toBe('gameover');
    expect(state.winner).toBe('ai');

    // Player should NOT get to fire again — same count as before winning shot
    expect(state.player.shots.size).toBe(playerShotsBefore);
  });

  it('AI wins (firstMove=ai): losing side never fires after winning shot', () => {
    const playerShips = [
      makeShip('destroyer', 'Destroyer', 2, [
        [0, 0],
        [0, 1],
      ]),
    ];
    const aiShips = [
      makeShip('destroyer', 'Destroyer', 2, [
        [5, 5],
        [5, 6],
      ]),
    ];
    const state = makeMinimalState({
      playerShips,
      aiShips,
      firstMove: 'ai',
    });

    // AI hits
    applyShot(state, 'ai', 0, 0);
    switchTurn(state);

    // Player misses
    applyShot(state, 'player', 9, 9);
    switchTurn(state);

    const playerShotsBefore = state.player.shots.size;

    // AI fires winning shot
    applyShot(state, 'ai', 0, 1);

    expect(state.phase).toBe('gameover');
    expect(state.winner).toBe('ai');

    // Player's shot count unchanged after the winning shot
    expect(state.player.shots.size).toBe(playerShotsBefore);
  });
});

describe('switchTurn', () => {
  it('alternates between player and ai', () => {
    const state = makeMinimalState({ firstMove: 'player' });
    expect(state.turn).toBe('player');
    switchTurn(state);
    expect(state.turn).toBe('ai');
    switchTurn(state);
    expect(state.turn).toBe('player');
  });

  it('does not switch turn after gameover', () => {
    const state = makeMinimalState({ firstMove: 'player' });
    applyShot(state, 'player', 5, 5);
    applyShot(state, 'player', 5, 6);
    expect(state.phase).toBe('gameover');

    switchTurn(state);
    // Turn should not change after gameover (stays at whatever it was)
    expect(state.phase).toBe('gameover');
  });
});

describe('firstMove: random', () => {
  it('resolves "random" to a concrete turn value', () => {
    // rng returns 0.3 < 0.5 -> player
    const state1 = makeMinimalState({
      firstMove: 'random',
      rng: () => 0.3,
    });
    expect(state1.turn).toBe('player');

    // rng returns 0.7 >= 0.5 -> ai
    const state2 = makeMinimalState({
      firstMove: 'random',
      rng: () => 0.7,
    });
    expect(state2.turn).toBe('ai');
  });
});

describe('status messages', () => {
  it('shows hit/miss/sunk/victory/defeat messages', () => {
    const state = makeMinimalState();

    applyShot(state, 'player', 3, 3);
    expect(state.status).toBe('Miss.');

    applyShot(state, 'player', 5, 5);
    expect(state.status).toBe('Hit!');

    applyShot(state, 'player', 5, 6);
    expect(state.status).toContain('Victory');
  });

  it('shows defeat message when AI wins', () => {
    const state = makeMinimalState();
    applyShot(state, 'ai', 0, 0);
    applyShot(state, 'ai', 0, 1);
    expect(state.status).toContain('Defeat');
  });

  it('shows sunk message', () => {
    const aiShips = [
      makeShip('destroyer', 'Destroyer', 2, [
        [0, 0],
        [0, 1],
      ]),
      makeShip('submarine', 'Submarine', 3, [
        [2, 0],
        [2, 1],
        [2, 2],
      ]),
    ];
    const state = makeMinimalState({ aiShips });
    applyShot(state, 'player', 0, 0);
    applyShot(state, 'player', 0, 1);
    expect(state.status).toBe('You sank their Destroyer.');
  });
});
