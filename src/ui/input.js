/** Click/keyboard handlers, placement controller. DOM module. */

import {
  shipCells,
  isLegalPlacement,
  buildOccupiedSet,
} from '../logic/placement.js';
import { FLEET } from '../logic/fleet.js';

export function getCurrentShipDef(state) {
  if (!state.placement || state.placement.queue.length === 0) return null;
  const id = state.placement.selectedId || state.placement.queue[0];
  return FLEET.find((f) => f.id === id);
}

export function getPlacementPreview(state, r, c) {
  const def = getCurrentShipDef(state);
  if (!def) return null;

  const cells = shipCells(r, c, def.length, state.placement.orientation);
  const occupied = buildOccupiedSet(state.player.ships);
  const legal = isLegalPlacement(cells, occupied);

  return { cells, legal, ship: def };
}

export function placeShip(state, r, c) {
  const def = getCurrentShipDef(state);
  if (!def) return false;

  const cells = shipCells(r, c, def.length, state.placement.orientation);
  const occupied = buildOccupiedSet(state.player.ships);

  if (!isLegalPlacement(cells, occupied)) return false;

  state.player.ships.push({
    id: def.id,
    name: def.name,
    length: def.length,
    cells,
    hits: new Set(),
  });

  state.placement.queue = state.placement.queue.filter((id) => id !== def.id);

  if (state.placement.queue.length > 0) {
    state.placement.selectedId = state.placement.queue[0];
    const nextDef = getCurrentShipDef(state);
    state.status = `Place your ${nextDef.name} (length ${nextDef.length}). Press R to rotate.`;
  } else {
    state.placement.selectedId = null;
    state.status = 'All ships placed. Press Start Game!';
  }

  return true;
}

export function undoPlacement(state) {
  if (state.player.ships.length === 0) return false;

  const removed = state.player.ships.pop();
  state.placement.queue.unshift(removed.id);
  state.placement.selectedId = removed.id;

  const def = getCurrentShipDef(state);
  state.status = `Place your ${def.name} (length ${def.length}). Press R to rotate.`;

  return true;
}

export function selectShip(state, shipId) {
  if (!state.placement) return false;
  if (!state.placement.queue.includes(shipId)) return false;
  state.placement.selectedId = shipId;
  const def = FLEET.find((f) => f.id === shipId);
  state.status = `Place your ${def.name} (length ${def.length}). Press R to rotate.`;
  return true;
}

export function toggleOrientation(state) {
  if (!state.placement) return;
  state.placement.orientation =
    state.placement.orientation === 'horizontal' ? 'vertical' : 'horizontal';
}
