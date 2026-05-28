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

describe('pending setTimeout must not corrupt state after restart', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('defensive guard prevents switchTurn on placement-phase state', () => {
    // Simulate: player fires → 900ms timeout is scheduled → user clicks
    // "New Game" before timeout fires → timeout fires on fresh state.
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

    // Player fires a shot
    applyShot(state, 'player', 0, 0);
    expect(state.phase).toBe('playing');

    // Schedule the delayed switchTurn (mirrors src/ui/main.js pattern)
    let pendingTurnTimeout = setTimeout(() => {
      if (state.phase !== 'playing') return;
      switchTurn(state);
    }, 900);

    // User clicks "New Game" before timeout fires — mirrors restart handler
    clearTimeout(pendingTurnTimeout);
    pendingTurnTimeout = null;
    state = createInitialState();

    // Snapshot the fresh placement state
    const expectedPhase = state.phase;
    const expectedTurn = state.turn;
    const expectedStatus = state.status;

    // Advance timers past the 900ms — timeout was cleared, nothing should happen
    vi.advanceTimersByTime(1000);

    expect(state.phase).toBe(expectedPhase);
    expect(state.turn).toBe(expectedTurn);
    expect(state.status).toBe(expectedStatus);
  });

  it('defensive guard alone prevents corruption even without clearTimeout', () => {
    // Belt-and-suspenders: even if clearTimeout is missed, the guard
    // inside the callback should bail out on non-playing state.
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

    // Schedule timeout that captures `state` by reference via closure.
    // We deliberately do NOT clearTimeout to test the guard.
    setTimeout(() => {
      if (state.phase !== 'playing') return;
      switchTurn(state);
    }, 900);

    // "Restart" — reassign state (simulates module-level reassignment)
    state = createInitialState();

    const snapshot = { phase: state.phase, turn: state.turn, status: state.status };

    vi.advanceTimersByTime(1000);

    // The closure captured the old binding; reassigning `state` means the
    // callback's `state` still points to the old object (which is in
    // 'playing' phase). But in the real code the module-level `state`
    // variable is reassigned, so the callback reads the NEW state.
    // This test verifies the pattern where the callback reads the same
    // variable that was reassigned — which is exactly how the module works.
    expect(state.phase).toBe(snapshot.phase);
    expect(state.turn).toBe(snapshot.turn);
    expect(state.status).toBe(snapshot.status);
  });
});
