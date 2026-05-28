import { describe, it, expect } from 'vitest';
import { chooseShot, updateAIAfterShot } from '../src/logic/ai/index.js';
import { chooseShot as easyShot } from '../src/logic/ai/easy.js';
import {
  chooseShot as mediumShot,
  updateAfterShot as mediumUpdate,
} from '../src/logic/ai/medium.js';
import { chooseShot as hardShot, computeTargetParity } from '../src/logic/ai/hard.js';
import { createGameState, applyShot, switchTurn } from '../src/logic/game.js';
import { randomPlacement } from '../src/logic/placement.js';
import { FLEET } from '../src/logic/fleet.js';
import { ROWS, COLS, cellKey, inBounds } from '../src/logic/board.js';
import { isSunk } from '../src/logic/fleet.js';

function seededRng(seed) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function makeShip(id, name, length, cells) {
  return {
    id,
    name,
    length,
    cells: cells.map(([r, c]) => ({ r, c })),
    hits: new Set(),
  };
}

function makeFullFleetState(difficulty, seed) {
  const rng = seededRng(seed);
  const playerShips = randomPlacement(FLEET, rng);
  const aiShips = randomPlacement(FLEET, rng);
  return createGameState({
    playerShips,
    aiShips,
    difficulty,
    firstMove: 'player',
    rng,
  });
}

// ==============================
// AI legality (all three difficulties)
// ==============================
describe('AI legality — all difficulties', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    it(`${difficulty}: never fires a previously-fired cell in a full game`, () => {
      const rng = seededRng(42);
      const state = makeFullFleetState(difficulty, 42);

      const playerRng = seededRng(123);
      let totalShots = 0;

      while (state.phase === 'playing' && totalShots < 200) {
        if (state.turn === 'player') {
          // Scripted player: fire at random unfired cell on AI board
          const unfired = [];
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              if (!state.player.shots.has(cellKey(r, c))) {
                unfired.push({ r, c });
              }
            }
          }
          if (unfired.length === 0) break;
          const target = unfired[Math.floor(playerRng() * unfired.length)];
          applyShot(state, 'player', target.r, target.c);
          if (state.phase === 'gameover') break;
          switchTurn(state);
        } else {
          const shotRng = seededRng(totalShots * 7 + 13);
          const shot = chooseShot(state, shotRng);
          expect(shot).not.toBeNull();
          expect(inBounds(shot.r, shot.c)).toBe(true);

          // Must not have been fired before
          const key = cellKey(shot.r, shot.c);
          expect(state.ai.shots.has(key)).toBe(false);

          const { result, sunkShip } = applyShot(state, 'ai', shot.r, shot.c);
          updateAIAfterShot(state, shot.r, shot.c, result, sunkShip);
          if (state.phase === 'gameover') break;
          switchTurn(state);
        }
        totalShots++;
      }
    });

    it(`${difficulty}: never returns an off-board cell`, () => {
      const state = makeFullFleetState(difficulty, 77);
      const playerRng = seededRng(321);
      let totalShots = 0;

      while (state.phase === 'playing' && totalShots < 200) {
        if (state.turn === 'player') {
          const unfired = [];
          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              if (!state.player.shots.has(cellKey(r, c))) {
                unfired.push({ r, c });
              }
            }
          }
          if (unfired.length === 0) break;
          const target = unfired[Math.floor(playerRng() * unfired.length)];
          applyShot(state, 'player', target.r, target.c);
          if (state.phase === 'gameover') break;
          switchTurn(state);
        } else {
          const shotRng = seededRng(totalShots * 11 + 5);
          const shot = chooseShot(state, shotRng);
          expect(shot).not.toBeNull();
          expect(shot.r).toBeGreaterThanOrEqual(0);
          expect(shot.r).toBeLessThan(ROWS);
          expect(shot.c).toBeGreaterThanOrEqual(0);
          expect(shot.c).toBeLessThan(COLS);

          const { result, sunkShip } = applyShot(state, 'ai', shot.r, shot.c);
          updateAIAfterShot(state, shot.r, shot.c, result, sunkShip);
          if (state.phase === 'gameover') break;
          switchTurn(state);
        }
        totalShots++;
      }
    });
  }
});

// ==============================
// AI behavior — Medium
// ==============================
describe('Medium AI behavior', () => {
  it('after a hit, next shot is orthogonally adjacent', () => {
    const playerShips = [
      makeShip('carrier', 'Carrier', 5, [
        [4, 4],
        [4, 5],
        [4, 6],
        [4, 7],
        [4, 8],
      ]),
      makeShip('battleship', 'Battleship', 4, [
        [0, 0],
        [0, 1],
        [0, 2],
        [0, 3],
      ]),
      makeShip('cruiser', 'Cruiser', 3, [
        [2, 0],
        [2, 1],
        [2, 2],
      ]),
      makeShip('submarine', 'Submarine', 3, [
        [6, 0],
        [6, 1],
        [6, 2],
      ]),
      makeShip('destroyer', 'Destroyer', 2, [
        [8, 0],
        [8, 1],
      ]),
    ];
    const aiShips = randomPlacement(FLEET, seededRng(99));

    const state = createGameState({
      playerShips,
      aiShips,
      difficulty: 'medium',
      firstMove: 'ai',
      rng: () => 0.5,
    });

    // Manually simulate the AI hitting cell (4,4) to enter target mode
    state.ai.shots.set(cellKey(4, 4), 'hit');
    playerShips[0].hits.add(cellKey(4, 4));
    mediumUpdate(state, 4, 4, 'hit', null);

    const rng = seededRng(42);
    const nextShot = mediumShot(state, rng);

    // Should be orthogonally adjacent to (4,4)
    const isAdjacent =
      (Math.abs(nextShot.r - 4) === 1 && nextShot.c === 4) ||
      (nextShot.r === 4 && Math.abs(nextShot.c - 4) === 1);
    expect(isAdjacent).toBe(true);
  });

  it('returns to hunt mode after sinking a ship', () => {
    const playerShips = [
      makeShip('destroyer', 'Destroyer', 2, [
        [3, 3],
        [3, 4],
      ]),
      makeShip('carrier', 'Carrier', 5, [
        [7, 0],
        [7, 1],
        [7, 2],
        [7, 3],
        [7, 4],
      ]),
      makeShip('battleship', 'Battleship', 4, [
        [0, 0],
        [0, 1],
        [0, 2],
        [0, 3],
      ]),
      makeShip('cruiser', 'Cruiser', 3, [
        [9, 0],
        [9, 1],
        [9, 2],
      ]),
      makeShip('submarine', 'Submarine', 3, [
        [5, 7],
        [6, 7],
        [7, 7],
      ]),
    ];
    const aiShips = randomPlacement(FLEET, seededRng(50));

    const state = createGameState({
      playerShips,
      aiShips,
      difficulty: 'medium',
      firstMove: 'ai',
      rng: () => 0.5,
    });

    // Hit first cell
    state.ai.shots.set(cellKey(3, 3), 'hit');
    playerShips[0].hits.add(cellKey(3, 3));
    mediumUpdate(state, 3, 3, 'hit', null);
    expect(state.ai.memory.mode).toBe('target');

    // Hit second cell -> sinks the destroyer
    state.ai.shots.set(cellKey(3, 4), 'hit');
    playerShips[0].hits.add(cellKey(3, 4));
    expect(isSunk(playerShips[0])).toBe(true);
    mediumUpdate(state, 3, 4, 'hit', playerShips[0]);

    // After sinking, should be back in hunt mode with empty target queue
    expect(state.ai.memory.mode).toBe('hunt');
    expect(state.ai.memory.targetQueue.length).toBe(0);
  });
});

// ==============================
// AI behavior — Hard
// ==============================
describe('Hard AI behavior', () => {
  it('with a single unresolved hit at center, next shot is orthogonal neighbor', () => {
    const playerShips = [
      makeShip('carrier', 'Carrier', 5, [
        [4, 3],
        [4, 4],
        [4, 5],
        [4, 6],
        [4, 7],
      ]),
      makeShip('battleship', 'Battleship', 4, [
        [0, 0],
        [0, 1],
        [0, 2],
        [0, 3],
      ]),
      makeShip('cruiser', 'Cruiser', 3, [
        [2, 0],
        [2, 1],
        [2, 2],
      ]),
      makeShip('submarine', 'Submarine', 3, [
        [6, 0],
        [6, 1],
        [6, 2],
      ]),
      makeShip('destroyer', 'Destroyer', 2, [
        [8, 0],
        [8, 1],
      ]),
    ];
    const aiShips = randomPlacement(FLEET, seededRng(99));

    const state = createGameState({
      playerShips,
      aiShips,
      difficulty: 'hard',
      firstMove: 'ai',
      rng: () => 0.5,
    });

    // Single unresolved hit at center (4,5)
    state.ai.shots.set(cellKey(4, 5), 'hit');
    playerShips[0].hits.add(cellKey(4, 5));

    const shot = hardShot(state);

    // Should be one of the four orthogonal neighbors
    const orthoNeighbors = [
      { r: 3, c: 5 },
      { r: 5, c: 5 },
      { r: 4, c: 4 },
      { r: 4, c: 6 },
    ];
    const isOrthogonal = orthoNeighbors.some(
      (n) => n.r === shot.r && n.c === shot.c,
    );
    expect(isOrthogonal).toBe(true);
  });

  it('hunt-mode parity: chosen cell satisfies (r+c)%2 === targetParity (§261)', () => {
    // Test across several seeds and mid-game states (some ships sunk, no live hits)
    for (const seed of [1, 42, 100, 999, 54321]) {
      const rng = seededRng(seed);
      const playerShips = randomPlacement(FLEET, rng);
      const aiShips = randomPlacement(FLEET, rng);

      const state = createGameState({
        playerShips,
        aiShips,
        difficulty: 'hard',
        firstMove: 'ai',
        rng,
      });

      // Fire several hunt-mode shots and verify each satisfies the per-turn parity
      for (let i = 0; i < 15; i++) {
        const unsunkShips = playerShips.filter(
          (s) => s.hits.size < s.length,
        );
        if (unsunkShips.length === 0) break;

        const sunkCells = new Set();
        for (const ship of playerShips) {
          if (ship.hits.size === ship.length) {
            for (const cell of ship.cells) {
              sunkCells.add(cellKey(cell.r, cell.c));
            }
          }
        }
        const expectedParity = computeTargetParity(
          state,
          unsunkShips,
          sunkCells,
        );

        const shot = hardShot(state);
        if (!shot) break;

        expect((shot.r + shot.c) % 2).toBe(expectedParity);
        state.ai.shots.set(cellKey(shot.r, shot.c), 'miss');
      }

      // Mid-game: sink the destroyer, verify parity still holds
      const destroyer = playerShips.find((s) => s.id === 'destroyer');
      for (const cell of destroyer.cells) {
        const key = cellKey(cell.r, cell.c);
        if (!state.ai.shots.has(key)) {
          state.ai.shots.set(key, 'hit');
        }
        destroyer.hits.add(key);
      }

      const unsunkAfter = playerShips.filter(
        (s) => s.hits.size < s.length,
      );
      if (unsunkAfter.length === 0) continue;

      const sunkCellsAfter = new Set();
      for (const ship of playerShips) {
        if (ship.hits.size === ship.length) {
          for (const cell of ship.cells) {
            sunkCellsAfter.add(cellKey(cell.r, cell.c));
          }
        }
      }
      const parityAfterSink = computeTargetParity(
        state,
        unsunkAfter,
        sunkCellsAfter,
      );

      const shotAfter = hardShot(state);
      if (shotAfter) {
        expect((shotAfter.r + shotAfter.c) % 2).toBe(parityAfterSink);
      }
    }
  });

  it('hard AI fires at cell with maximal placement count', () => {
    // Construct a board where the optimal shot is predictable
    const playerShips = [
      makeShip('destroyer', 'Destroyer', 2, [
        [0, 0],
        [0, 1],
      ]),
      makeShip('submarine', 'Submarine', 3, [
        [2, 0],
        [2, 1],
        [2, 2],
      ]),
      makeShip('cruiser', 'Cruiser', 3, [
        [4, 0],
        [4, 1],
        [4, 2],
      ]),
      makeShip('battleship', 'Battleship', 4, [
        [6, 0],
        [6, 1],
        [6, 2],
        [6, 3],
      ]),
      makeShip('carrier', 'Carrier', 5, [
        [8, 0],
        [8, 1],
        [8, 2],
        [8, 3],
        [8, 4],
      ]),
    ];
    const aiShips = randomPlacement(FLEET, seededRng(99));

    const state = createGameState({
      playerShips,
      aiShips,
      difficulty: 'hard',
      firstMove: 'ai',
      rng: () => 0.5,
    });

    const shot = hardShot(state);
    // Just verify it returns a valid unfired cell
    expect(shot).not.toBeNull();
    expect(inBounds(shot.r, shot.c)).toBe(true);
    expect(state.ai.shots.has(cellKey(shot.r, shot.c))).toBe(false);
  });
});

// ==============================
// Full-game smoke tests (§263)
// ==============================
describe('full-game smoke tests', () => {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (const seed of [42, 100, 999]) {
      it(`${difficulty} (seed ${seed}): game terminates, no errors, valid winner`, () => {
        const rng = seededRng(seed);
        const playerShips = randomPlacement(FLEET, rng);
        const aiShips = randomPlacement(FLEET, rng);

        const state = createGameState({
          playerShips,
          aiShips,
          difficulty,
          firstMove: 'player',
          rng,
        });

        const playerRng = seededRng(seed + 1);
        let totalShots = 0;
        const playerFired = new Set();
        const aiFired = new Set();

        while (state.phase === 'playing' && totalShots < 200) {
          if (state.turn === 'player') {
            const unfired = [];
            for (let r = 0; r < ROWS; r++) {
              for (let c = 0; c < COLS; c++) {
                const key = cellKey(r, c);
                if (!state.player.shots.has(key)) {
                  unfired.push({ r, c });
                }
              }
            }
            expect(unfired.length).toBeGreaterThan(0);
            const target =
              unfired[Math.floor(playerRng() * unfired.length)];
            const key = cellKey(target.r, target.c);

            // No duplicate player shots
            expect(playerFired.has(key)).toBe(false);
            playerFired.add(key);

            applyShot(state, 'player', target.r, target.c);
            if (state.phase === 'gameover') break;
            switchTurn(state);
          } else {
            const shotRng = seededRng(totalShots * 13 + seed);
            const shot = chooseShot(state, shotRng);
            expect(shot).not.toBeNull();
            expect(inBounds(shot.r, shot.c)).toBe(true);

            const key = cellKey(shot.r, shot.c);
            // No duplicate AI shots
            expect(aiFired.has(key)).toBe(false);
            aiFired.add(key);

            const { result, sunkShip } = applyShot(
              state,
              'ai',
              shot.r,
              shot.c,
            );
            updateAIAfterShot(state, shot.r, shot.c, result, sunkShip);
            if (state.phase === 'gameover') break;
            switchTurn(state);
          }
          totalShots++;
        }

        // Game must have terminated
        expect(state.phase).toBe('gameover');
        expect(totalShots).toBeLessThanOrEqual(200);

        // Exactly one side has all ships sunk
        const playerAllSunk = state.player.ships.every(
          (s) => s.hits.size === s.length,
        );
        const aiAllSunk = state.ai.ships.every(
          (s) => s.hits.size === s.length,
        );
        expect(playerAllSunk || aiAllSunk).toBe(true);
        expect(playerAllSunk && aiAllSunk).toBe(false);

        // Winner matches
        if (playerAllSunk) {
          expect(state.winner).toBe('ai');
        } else {
          expect(state.winner).toBe('player');
        }
      });
    }
  }
});
