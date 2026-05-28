/** Placement validation and random placement. Zero DOM references. */

import { ROWS, COLS, cellKey } from './board.js';

export function shipCells(r, c, length, orientation) {
  const cells = [];
  for (let i = 0; i < length; i++) {
    const cr = orientation === 'vertical' ? r + i : r;
    const cc = orientation === 'horizontal' ? c + i : c;
    cells.push({ r: cr, c: cc });
  }
  return cells;
}

export function isLegalPlacement(cells, occupiedSet) {
  for (const { r, c } of cells) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
    if (occupiedSet.has(cellKey(r, c))) return false;
  }
  return true;
}

export function buildOccupiedSet(ships) {
  const set = new Set();
  for (const ship of ships) {
    for (const { r, c } of ship.cells) {
      set.add(cellKey(r, c));
    }
  }
  return set;
}

export function randomPlacement(fleet, rng) {
  const ships = [];
  const occupied = new Set();
  const MAX_ATTEMPTS = 1000;

  for (const def of fleet) {
    let placed = false;

    for (let attempt = 0; attempt < MAX_ATTEMPTS && !placed; attempt++) {
      const orientation = rng() < 0.5 ? 'horizontal' : 'vertical';
      const maxR = orientation === 'vertical' ? ROWS - def.length : ROWS - 1;
      const maxC = orientation === 'horizontal' ? COLS - def.length : COLS - 1;
      const r = Math.floor(rng() * (maxR + 1));
      const c = Math.floor(rng() * (maxC + 1));
      const cells = shipCells(r, c, def.length, orientation);

      if (isLegalPlacement(cells, occupied)) {
        const ship = {
          id: def.id,
          name: def.name,
          length: def.length,
          cells,
          hits: new Set(),
        };
        ships.push(ship);
        for (const { r: cr, c: cc } of cells) {
          occupied.add(cellKey(cr, cc));
        }
        placed = true;
      }
    }

    if (!placed) {
      // Sequential scan fallback
      const orientations = ['horizontal', 'vertical'];
      for (const orientation of orientations) {
        if (placed) break;
        for (let r = 0; r < ROWS && !placed; r++) {
          for (let c = 0; c < COLS && !placed; c++) {
            const cells = shipCells(r, c, def.length, orientation);
            if (isLegalPlacement(cells, occupied)) {
              const ship = {
                id: def.id,
                name: def.name,
                length: def.length,
                cells,
                hits: new Set(),
              };
              ships.push(ship);
              for (const { r: cr, c: cc } of cells) {
                occupied.add(cellKey(cr, cc));
              }
              placed = true;
            }
          }
        }
      }
    }
  }

  return ships;
}
