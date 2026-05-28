/** Board constants and grid helpers. Zero DOM references. */

export const ROWS = 10;
export const COLS = 10;
export const COLUMNS = 'ABCDEFGHIJ';

export function inBounds(r, c) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

export function cellKey(r, c) {
  return `${r},${c}`;
}

export function parseKey(key) {
  const [r, c] = key.split(',').map(Number);
  return { r, c };
}

export function coordLabel(r, c) {
  return `${COLUMNS[c]}${r + 1}`;
}

export function createEmptyGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}
