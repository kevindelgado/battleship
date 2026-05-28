import { describe, it, expect } from 'vitest';
import { ROWS, COLS, inBounds, cellKey, parseKey, coordLabel } from '../src/logic/board.js';

describe('board', () => {
  it('has a 10x10 grid', () => {
    expect(ROWS).toBe(10);
    expect(COLS).toBe(10);
  });

  it('inBounds accepts valid cells', () => {
    expect(inBounds(0, 0)).toBe(true);
    expect(inBounds(9, 9)).toBe(true);
    expect(inBounds(5, 5)).toBe(true);
  });

  it('inBounds rejects out-of-range cells', () => {
    expect(inBounds(-1, 0)).toBe(false);
    expect(inBounds(0, -1)).toBe(false);
    expect(inBounds(10, 0)).toBe(false);
    expect(inBounds(0, 10)).toBe(false);
  });

  it('cellKey and parseKey are inverses', () => {
    const key = cellKey(3, 7);
    expect(key).toBe('3,7');
    const { r, c } = parseKey(key);
    expect(r).toBe(3);
    expect(c).toBe(7);
  });

  it('coordLabel produces human-readable labels', () => {
    expect(coordLabel(0, 0)).toBe('A1');
    expect(coordLabel(9, 9)).toBe('J10');
    expect(coordLabel(4, 2)).toBe('C5');
  });
});
