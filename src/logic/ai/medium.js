/** Medium AI: hunt and target. Zero DOM references. */

import { ROWS, COLS, cellKey, inBounds } from '../board.js';
import { isSunk } from '../fleet.js';

function initMemory() {
  return { mode: 'hunt', targetQueue: [], hits: [] };
}

export function chooseShot(state, rng = Math.random) {
  if (!state.ai.memory.mode) {
    Object.assign(state.ai.memory, initMemory());
  }

  const mem = state.ai.memory;

  // Clean up: if we just sank a ship, remove its hits and clear queue
  const lastShotEntries = [...state.ai.shots.entries()];
  if (lastShotEntries.length > 0) {
    for (const ship of state.player.ships) {
      if (isSunk(ship)) {
        for (const cell of ship.cells) {
          const key = cellKey(cell.r, cell.c);
          const idx = mem.hits.indexOf(key);
          if (idx !== -1) mem.hits.splice(idx, 1);
        }
      }
    }
    if (mem.hits.length === 0) {
      mem.mode = 'hunt';
      mem.targetQueue = [];
    }
  }

  if (mem.mode === 'target' && mem.targetQueue.length > 0) {
    while (mem.targetQueue.length > 0) {
      const candidate = mem.targetQueue.shift();
      if (!state.ai.shots.has(cellKey(candidate.r, candidate.c))) {
        return candidate;
      }
    }
    mem.mode = 'hunt';
  }

  // Hunt mode: random unfired cell
  const unfired = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!state.ai.shots.has(cellKey(r, c))) {
        unfired.push({ r, c });
      }
    }
  }
  return unfired[Math.floor(rng() * unfired.length)];
}

export function updateAfterShot(state, r, c, result, sunkShip) {
  if (!state.ai.memory.mode) {
    Object.assign(state.ai.memory, initMemory());
  }

  const mem = state.ai.memory;

  if (result === 'hit') {
    const key = cellKey(r, c);
    mem.hits.push(key);

    if (sunkShip) {
      // Remove hits belonging to sunk ship
      for (const cell of sunkShip.cells) {
        const sKey = cellKey(cell.r, cell.c);
        const idx = mem.hits.indexOf(sKey);
        if (idx !== -1) mem.hits.splice(idx, 1);
      }
      if (mem.hits.length === 0) {
        mem.mode = 'hunt';
        mem.targetQueue = [];
      }
      return;
    }

    mem.mode = 'target';

    // Check for colinear hits to restrict direction
    if (mem.hits.length >= 2) {
      const hitCoords = mem.hits.map((k) => {
        const [hr, hc] = k.split(',').map(Number);
        return { r: hr, c: hc };
      });

      const allSameRow = hitCoords.every((h) => h.r === hitCoords[0].r);
      const allSameCol = hitCoords.every((h) => h.c === hitCoords[0].c);

      if (allSameRow) {
        // Restrict to horizontal ends
        const cols = hitCoords.map((h) => h.c).sort((a, b) => a - b);
        const row = hitCoords[0].r;
        mem.targetQueue = [];
        const leftC = cols[0] - 1;
        const rightC = cols[cols.length - 1] + 1;
        if (inBounds(row, leftC) && !state.ai.shots.has(cellKey(row, leftC))) {
          mem.targetQueue.push({ r: row, c: leftC });
        }
        if (
          inBounds(row, rightC) &&
          !state.ai.shots.has(cellKey(row, rightC))
        ) {
          mem.targetQueue.push({ r: row, c: rightC });
        }
      } else if (allSameCol) {
        // Restrict to vertical ends
        const rows = hitCoords.map((h) => h.r).sort((a, b) => a - b);
        const col = hitCoords[0].c;
        mem.targetQueue = [];
        const topR = rows[0] - 1;
        const bottomR = rows[rows.length - 1] + 1;
        if (inBounds(topR, col) && !state.ai.shots.has(cellKey(topR, col))) {
          mem.targetQueue.push({ r: topR, c: col });
        }
        if (
          inBounds(bottomR, col) &&
          !state.ai.shots.has(cellKey(bottomR, col))
        ) {
          mem.targetQueue.push({ r: bottomR, c: col });
        }
      } else {
        // Not colinear, add all orthogonal neighbors of new hit
        addOrthogonalNeighbors(state, r, c, mem);
      }
    } else {
      // First hit — add orthogonal neighbors
      addOrthogonalNeighbors(state, r, c, mem);
    }
  }
}

function addOrthogonalNeighbors(state, r, c, mem) {
  const directions = [
    { r: -1, c: 0 },
    { r: 1, c: 0 },
    { r: 0, c: -1 },
    { r: 0, c: 1 },
  ];
  for (const d of directions) {
    const nr = r + d.r;
    const nc = c + d.c;
    if (inBounds(nr, nc) && !state.ai.shots.has(cellKey(nr, nc))) {
      const already = mem.targetQueue.some((t) => t.r === nr && t.c === nc);
      if (!already) {
        mem.targetQueue.push({ r: nr, c: nc });
      }
    }
  }
}
