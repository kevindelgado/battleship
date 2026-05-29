import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/logic/game.js';
import { FLEET } from '../src/logic/fleet.js';
import {
  getCurrentShipDef,
  placeShip,
  undoPlacement,
  selectShip,
} from '../src/ui/input.js';

function placeAt(state, r, c) {
  return placeShip(state, r, c);
}

describe('flexible placement order', () => {
  it('initial state selects the first ship (Carrier)', () => {
    const state = createInitialState();
    expect(state.placement.selectedId).toBe('carrier');
    expect(getCurrentShipDef(state).id).toBe('carrier');
  });

  it('selectShip switches the active ship', () => {
    const state = createInitialState();
    expect(selectShip(state, 'destroyer')).toBe(true);
    expect(state.placement.selectedId).toBe('destroyer');
    expect(getCurrentShipDef(state).id).toBe('destroyer');
    expect(getCurrentShipDef(state).length).toBe(2);
  });

  it('selectShip rejects an already-placed ship', () => {
    const state = createInitialState();
    // Place carrier at (0,0) horizontal
    placeAt(state, 0, 0);
    expect(selectShip(state, 'carrier')).toBe(false);
    expect(state.placement.selectedId).not.toBe('carrier');
  });

  it('placing a non-default ship works and auto-advances', () => {
    const state = createInitialState();
    // Select destroyer (length 2) instead of carrier
    selectShip(state, 'destroyer');
    expect(placeAt(state, 0, 0)).toBe(true);

    // Destroyer should be removed from queue
    expect(state.placement.queue).not.toContain('destroyer');
    expect(state.player.ships.some((s) => s.id === 'destroyer')).toBe(true);
    expect(state.player.ships[0].cells.length).toBe(2);

    // Auto-advance to first remaining in queue (carrier)
    expect(state.placement.selectedId).toBe('carrier');
  });

  it('ships can be placed in reverse order', () => {
    const state = createInitialState();
    const reverseOrder = [...FLEET].reverse();
    let row = 0;

    for (const def of reverseOrder) {
      selectShip(state, def.id);
      expect(getCurrentShipDef(state).id).toBe(def.id);
      expect(placeAt(state, row, 0)).toBe(true);
      row++;
    }

    expect(state.placement.queue.length).toBe(0);
    expect(state.player.ships.length).toBe(5);
    expect(state.status).toBe('All ships placed. Press Start Game!');
  });

  it('auto-advance after placing goes to queue[0]', () => {
    const state = createInitialState();
    // Place carrier (default first)
    placeAt(state, 0, 0);
    // Auto-advance to battleship (next in queue)
    expect(state.placement.selectedId).toBe('battleship');

    // Skip to submarine
    selectShip(state, 'submarine');
    placeAt(state, 1, 0);
    // Queue is now [battleship, cruiser, destroyer], auto-advance to battleship
    expect(state.placement.selectedId).toBe('battleship');
  });

  it('undo restores the undone ship as selected', () => {
    const state = createInitialState();
    // Select and place destroyer
    selectShip(state, 'destroyer');
    placeAt(state, 0, 0);
    expect(state.placement.selectedId).toBe('carrier');

    // Undo — destroyer comes back and becomes selected
    undoPlacement(state);
    expect(state.placement.selectedId).toBe('destroyer');
    expect(state.placement.queue).toContain('destroyer');
    expect(state.player.ships.some((s) => s.id === 'destroyer')).toBe(false);
  });

  it('placement validation still holds regardless of order', () => {
    const state = createInitialState();
    // Place destroyer at (0,0) horizontal → occupies (0,0) and (0,1)
    selectShip(state, 'destroyer');
    expect(placeAt(state, 0, 0)).toBe(true);

    // Try to place submarine overlapping at (0,0) — should fail
    selectShip(state, 'submarine');
    expect(placeAt(state, 0, 0)).toBe(false);

    // Place submarine non-overlapping
    expect(placeAt(state, 1, 0)).toBe(true);
  });

  it('Start Game gates on all 5 placed', () => {
    const state = createInitialState();
    // Place only 3 ships
    placeAt(state, 0, 0); // carrier
    placeAt(state, 1, 0); // battleship
    placeAt(state, 2, 0); // cruiser

    expect(state.placement.queue.length).toBe(2);
    expect(state.placement.queue).toContain('submarine');
    expect(state.placement.queue).toContain('destroyer');
  });

  it('selectedId is null after all ships placed', () => {
    const state = createInitialState();
    let row = 0;
    for (const def of FLEET) {
      selectShip(state, def.id);
      placeAt(state, row, 0);
      row++;
    }
    expect(state.placement.selectedId).toBeNull();
    expect(state.placement.queue.length).toBe(0);
  });
});
