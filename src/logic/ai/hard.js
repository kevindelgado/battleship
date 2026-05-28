/** Hard AI: probability density with parity. Zero DOM references. */

import { ROWS, COLS, cellKey } from '../board.js';
import { isSunk } from '../fleet.js';

function getUnsunkShips(playerShips) {
  return playerShips.filter((s) => !isSunk(s));
}

function getSunkCells(playerShips) {
  const set = new Set();
  for (const ship of playerShips) {
    if (isSunk(ship)) {
      for (const cell of ship.cells) {
        set.add(cellKey(cell.r, cell.c));
      }
    }
  }
  return set;
}

function getUnresolvedHits(state) {
  const sunkCells = getSunkCells(state.player.ships);
  const hits = [];
  for (const [key, val] of state.ai.shots) {
    if (val === 'hit' && !sunkCells.has(key)) {
      hits.push(key);
    }
  }
  return hits;
}

function computeTargetParity(state, unsunkShips, sunkCells) {
  const lmin = Math.min(...unsunkShips.map((s) => s.length));
  const counts = [0, 0];
  for (const ship of unsunkShips) {
    if (ship.length !== lmin) continue;
    for (const orientation of ['horizontal', 'vertical']) {
      const maxR =
        orientation === 'vertical' ? ROWS - ship.length : ROWS - 1;
      const maxC =
        orientation === 'horizontal' ? COLS - ship.length : COLS - 1;
      for (let r = 0; r <= maxR; r++) {
        for (let c = 0; c <= maxC; c++) {
          let valid = true;
          const cells = [];
          for (let i = 0; i < ship.length; i++) {
            const cr = orientation === 'vertical' ? r + i : r;
            const cc = orientation === 'horizontal' ? c + i : c;
            const key = cellKey(cr, cc);
            if (
              state.ai.shots.get(key) === 'miss' ||
              sunkCells.has(key)
            ) {
              valid = false;
              break;
            }
            cells.push({ r: cr, c: cc });
          }
          if (valid) {
            for (const cell of cells) {
              counts[(cell.r + cell.c) % 2]++;
            }
          }
        }
      }
    }
  }
  return counts[0] >= counts[1] ? 0 : 1;
}

export { computeTargetParity };

export function chooseShot(state, _rng = Math.random) {
  const unsunkShips = getUnsunkShips(state.player.ships);
  const sunkCells = getSunkCells(state.player.ships);
  const unresolvedHits = getUnresolvedHits(state);
  const inTargetMode = unresolvedHits.length > 0;
  const unresolvedSet = new Set(unresolvedHits);

  let targetParity = null;
  if (!inTargetMode) {
    targetParity = computeTargetParity(state, unsunkShips, sunkCells);
  }

  const scores = new Map();

  for (const ship of unsunkShips) {
    for (const orientation of ['horizontal', 'vertical']) {
      const maxR =
        orientation === 'vertical' ? ROWS - ship.length : ROWS - 1;
      const maxC =
        orientation === 'horizontal' ? COLS - ship.length : COLS - 1;
      for (let r = 0; r <= maxR; r++) {
        for (let c = 0; c <= maxC; c++) {
          let valid = true;
          let coversUnresolved = false;
          const cells = [];
          for (let i = 0; i < ship.length; i++) {
            const cr = orientation === 'vertical' ? r + i : r;
            const cc = orientation === 'horizontal' ? c + i : c;
            const key = cellKey(cr, cc);
            if (
              state.ai.shots.get(key) === 'miss' ||
              sunkCells.has(key)
            ) {
              valid = false;
              break;
            }
            cells.push({ r: cr, c: cc, key });
            if (unresolvedSet.has(key)) {
              coversUnresolved = true;
            }
          }

          if (!valid) continue;
          if (inTargetMode && !coversUnresolved) continue;

          for (const cell of cells) {
            if (!state.ai.shots.has(cell.key)) {
              if (
                !inTargetMode &&
                (cell.r + cell.c) % 2 !== targetParity
              ) {
                continue;
              }
              scores.set(
                cell.key,
                (scores.get(cell.key) || 0) + 1,
              );
            }
          }
        }
      }
    }
  }

  let bestKey = null;
  let bestScore = -1;
  for (const [key, score] of scores) {
    if (
      score > bestScore ||
      (score === bestScore && key < bestKey)
    ) {
      bestScore = score;
      bestKey = key;
    }
  }

  if (bestKey) {
    const [r, c] = bestKey.split(',').map(Number);
    return { r, c };
  }

  // Fallback: first unfired cell (should not normally happen)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!state.ai.shots.has(cellKey(r, c))) {
        return { r, c };
      }
    }
  }
  return null;
}
