/** AI dispatch: difficulty -> chooseShot(state). Zero DOM references. */

import { chooseShot as easyShot } from './easy.js';
import { chooseShot as mediumShot, updateAfterShot as mediumUpdate } from './medium.js';
import { chooseShot as hardShot } from './hard.js';

export function chooseShot(state, rng = Math.random) {
  switch (state.difficulty) {
    case 'easy':
      return easyShot(state, rng);
    case 'medium':
      return mediumShot(state, rng);
    case 'hard':
      return hardShot(state, rng);
    default:
      return easyShot(state, rng);
  }
}

export function updateAIAfterShot(state, r, c, result, sunkShip) {
  if (state.difficulty === 'medium') {
    mediumUpdate(state, r, c, result, sunkShip);
  }
  // Hard AI is stateless (recomputes each turn); easy is random. No update needed.
}
