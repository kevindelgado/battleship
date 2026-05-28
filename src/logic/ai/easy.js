/** Easy AI: random unfired cell. Zero DOM references. */

import { ROWS, COLS, cellKey } from '../board.js';

export function chooseShot(state, rng = Math.random) {
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
