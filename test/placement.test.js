import { describe, it, expect } from 'vitest';
import {
  shipCells,
  isLegalPlacement,
  buildOccupiedSet,
  randomPlacement,
} from '../src/logic/placement.js';
import { FLEET } from '../src/logic/fleet.js';
import { cellKey } from '../src/logic/board.js';
import { seededRng } from '../src/logic/rng.js';

describe('shipCells', () => {
  it('generates horizontal cells', () => {
    const cells = shipCells(0, 0, 3, 'horizontal');
    expect(cells).toEqual([
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 0, c: 2 },
    ]);
  });

  it('generates vertical cells', () => {
    const cells = shipCells(2, 3, 4, 'vertical');
    expect(cells).toEqual([
      { r: 2, c: 3 },
      { r: 3, c: 3 },
      { r: 4, c: 3 },
      { r: 5, c: 3 },
    ]);
  });
});

describe('isLegalPlacement', () => {
  it('accepts a ship fully on-board with no overlaps', () => {
    const cells = shipCells(0, 0, 5, 'horizontal');
    expect(isLegalPlacement(cells, new Set())).toBe(true);
  });

  it('rejects a ship going off the right edge', () => {
    const cells = shipCells(0, 8, 5, 'horizontal');
    expect(isLegalPlacement(cells, new Set())).toBe(false);
  });

  it('rejects a ship going off the bottom edge', () => {
    const cells = shipCells(8, 0, 5, 'vertical');
    expect(isLegalPlacement(cells, new Set())).toBe(false);
  });

  it('rejects overlapping ships', () => {
    const occupied = new Set([cellKey(0, 2)]);
    const cells = shipCells(0, 0, 5, 'horizontal');
    expect(isLegalPlacement(cells, occupied)).toBe(false);
  });

  it('accepts ships that touch (adjacent but not overlapping)', () => {
    // Ship at row 0, cols 0-4
    const occupied = new Set();
    for (let c = 0; c < 5; c++) {
      occupied.add(cellKey(0, c));
    }
    // Adjacent ship at row 1, cols 0-3
    const cells = shipCells(1, 0, 4, 'horizontal');
    expect(isLegalPlacement(cells, occupied)).toBe(true);
  });

  it('accepts both orientations', () => {
    const hCells = shipCells(5, 5, 2, 'horizontal');
    const vCells = shipCells(5, 5, 2, 'vertical');
    expect(isLegalPlacement(hCells, new Set())).toBe(true);
    expect(isLegalPlacement(vCells, new Set())).toBe(true);
  });
});

describe('buildOccupiedSet', () => {
  it('builds a set of all occupied cell keys', () => {
    const ships = [
      {
        id: 'destroyer',
        name: 'Destroyer',
        length: 2,
        cells: [
          { r: 0, c: 0 },
          { r: 0, c: 1 },
        ],
        hits: new Set(),
      },
    ];
    const set = buildOccupiedSet(ships);
    expect(set.has('0,0')).toBe(true);
    expect(set.has('0,1')).toBe(true);
    expect(set.has('0,2')).toBe(false);
  });
});

describe('randomPlacement', () => {
  const seeds = [1, 42, 100, 999, 12345, 77777, 314159, 271828, 1000000, 54321];

  for (const seed of seeds) {
    it(`produces a valid fleet with seed ${seed}`, () => {
      const rng = seededRng(seed);
      const ships = randomPlacement(FLEET, rng);

      // Correct number of ships
      expect(ships.length).toBe(FLEET.length);

      // Correct lengths
      for (let i = 0; i < FLEET.length; i++) {
        expect(ships[i].length).toBe(FLEET[i].length);
        expect(ships[i].cells.length).toBe(FLEET[i].length);
      }

      // All cells on-board
      for (const ship of ships) {
        for (const cell of ship.cells) {
          expect(cell.r).toBeGreaterThanOrEqual(0);
          expect(cell.r).toBeLessThan(10);
          expect(cell.c).toBeGreaterThanOrEqual(0);
          expect(cell.c).toBeLessThan(10);
        }
      }

      // No overlaps
      const allKeys = new Set();
      let totalCells = 0;
      for (const ship of ships) {
        for (const cell of ship.cells) {
          allKeys.add(cellKey(cell.r, cell.c));
          totalCells++;
        }
      }
      expect(allKeys.size).toBe(totalCells);
      expect(totalCells).toBe(17); // 5+4+3+3+2
    });
  }

  it('is deterministic with the same seed', () => {
    const rng1 = seededRng(42);
    const rng2 = seededRng(42);
    const ships1 = randomPlacement(FLEET, rng1);
    const ships2 = randomPlacement(FLEET, rng2);

    for (let i = 0; i < ships1.length; i++) {
      expect(ships1[i].cells).toEqual(ships2[i].cells);
    }
  });
});
