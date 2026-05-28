import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createInitialState,
  createGameState,
  applyShot,
  switchTurn,
} from '../src/logic/game.js';
import { randomPlacement } from '../src/logic/placement.js';
import { FLEET } from '../src/logic/fleet.js';
import { seededRng } from '../src/logic/rng.js';

// Replicate the central timer helpers from main.js for test use
function createTimerManager() {
  const pending = new Set();
  return {
    schedule(fn, ms) {
      const id = setTimeout(() => {
        pending.delete(id);
        fn();
      }, ms);
      pending.add(id);
    },
    cancelAll() {
      for (const id of pending) clearTimeout(id);
      pending.clear();
    },
    get size() {
      return pending.size;
    },
  };
}

describe('pending turn timers must not corrupt state after restart', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('cancelAll prevents switchTurn on placement-phase state', () => {
    const timers = createTimerManager();
    const rng = seededRng(42);
    const playerShips = randomPlacement(FLEET, rng);
    const aiShips = randomPlacement(FLEET, rng);

    let state = createGameState({
      playerShips,
      aiShips,
      difficulty: 'easy',
      firstMove: 'player',
      rng,
    });

    applyShot(state, 'player', 0, 0);
    expect(state.phase).toBe('playing');

    // Schedule delayed switchTurn via central helper
    timers.schedule(() => {
      if (state.phase !== 'playing') return;
      switchTurn(state);
    }, 900);

    // Restart: cancel all timers, then reset state
    timers.cancelAll();
    state = createInitialState();

    const snapshot = { phase: state.phase, turn: state.turn, status: state.status };

    vi.advanceTimersByTime(1000);

    expect(state.phase).toBe(snapshot.phase);
    expect(state.turn).toBe(snapshot.turn);
    expect(state.status).toBe(snapshot.status);
  });

  it('defensive guard alone prevents corruption even without cancelAll', () => {
    const timers = createTimerManager();
    const rng = seededRng(99);
    const playerShips = randomPlacement(FLEET, rng);
    const aiShips = randomPlacement(FLEET, rng);

    let state = createGameState({
      playerShips,
      aiShips,
      difficulty: 'easy',
      firstMove: 'player',
      rng,
    });

    applyShot(state, 'player', 0, 0);

    // Schedule WITHOUT cancelling — guard must protect
    timers.schedule(() => {
      if (state.phase !== 'playing') return;
      switchTurn(state);
    }, 900);

    state = createInitialState();
    const snapshot = { phase: state.phase, turn: state.turn, status: state.status };

    vi.advanceTimersByTime(1000);

    expect(state.phase).toBe(snapshot.phase);
    expect(state.turn).toBe(snapshot.turn);
    expect(state.status).toBe(snapshot.status);
  });

  it('stale AI-turn timer from old game does not fire alongside new game AI turn', () => {
    // Scenario: player fires → 900ms delay schedules switchTurn →
    // switchTurn schedules doAITurn at 500ms → user clicks restart before
    // any of that fires → starts new game with firstMove='ai' →
    // advance timers → only one AI shot should fire on the new game.
    const timers = createTimerManager();
    const rng = seededRng(42);
    const playerShips = randomPlacement(FLEET, rng);
    const aiShips = randomPlacement(FLEET, rng);

    let state = createGameState({
      playerShips,
      aiShips,
      difficulty: 'easy',
      firstMove: 'player',
      rng,
    });

    applyShot(state, 'player', 0, 0);

    let aiShotCount = 0;

    // Mirrors the player-fire path: 900ms delay → switchTurn → 500ms doAITurn
    timers.schedule(() => {
      if (state.phase !== 'playing') return;
      switchTurn(state);
      if (state.turn === 'ai') {
        timers.schedule(() => {
          if (state.phase !== 'playing' || state.turn !== 'ai') return;
          aiShotCount++;
        }, 500);
      }
    }, 900);

    // Restart before any timers fire
    timers.cancelAll();

    // Start new game with firstMove='ai'
    const rng2 = seededRng(77);
    const p2 = randomPlacement(FLEET, rng2);
    const a2 = randomPlacement(FLEET, rng2);
    state = createGameState({
      playerShips: p2,
      aiShips: a2,
      difficulty: 'easy',
      firstMove: 'ai',
      rng: rng2,
    });

    // New game schedules its own AI turn
    timers.schedule(() => {
      if (state.phase !== 'playing' || state.turn !== 'ai') return;
      aiShotCount++;
    }, 500);

    // Advance past all possible timers
    vi.advanceTimersByTime(2000);

    expect(aiShotCount).toBe(1);
  });
});
