import { describe, it, expect } from 'vitest';
import { SILHOUETTES, getShipOrientation } from '../src/ui/ships.js';
import { FLEET } from '../src/logic/fleet.js';

describe('Ship silhouette definitions', () => {
  it('has a silhouette entry for every fleet ship', () => {
    for (const def of FLEET) {
      expect(SILHOUETTES[def.id]).toBeDefined();
      expect(SILHOUETTES[def.id].viewBox).toBeTruthy();
      expect(SILHOUETTES[def.id].paths.length).toBeGreaterThan(0);
    }
  });

  it('viewBox width matches ship length × 100', () => {
    for (const def of FLEET) {
      const [, , w] = SILHOUETTES[def.id].viewBox.split(' ').map(Number);
      expect(w).toBe(def.length * 100);
    }
  });

  it('viewBox height is 100 for all ships', () => {
    for (const def of FLEET) {
      const [, , , h] = SILHOUETTES[def.id].viewBox.split(' ').map(Number);
      expect(h).toBe(100);
    }
  });

  it('submarine and cruiser have distinct path data', () => {
    const subPaths = SILHOUETTES.submarine.paths.join('');
    const cruPaths = SILHOUETTES.cruiser.paths.join('');
    expect(subPaths).not.toBe(cruPaths);
  });

  it('every ship has visually distinct paths', () => {
    const ids = Object.keys(SILHOUETTES);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = SILHOUETTES[ids[i]].paths.join('');
        const b = SILHOUETTES[ids[j]].paths.join('');
        expect(a).not.toBe(b);
      }
    }
  });
});

describe('getShipOrientation', () => {
  it('returns horizontal when cells share the same row', () => {
    const ship = {
      cells: [
        { r: 3, c: 2 },
        { r: 3, c: 3 },
        { r: 3, c: 4 },
      ],
    };
    expect(getShipOrientation(ship)).toBe('horizontal');
  });

  it('returns vertical when cells share the same column', () => {
    const ship = {
      cells: [
        { r: 0, c: 5 },
        { r: 1, c: 5 },
        { r: 2, c: 5 },
      ],
    };
    expect(getShipOrientation(ship)).toBe('vertical');
  });

  it('returns horizontal for a single-cell ship', () => {
    const ship = { cells: [{ r: 4, c: 7 }] };
    expect(getShipOrientation(ship)).toBe('horizontal');
  });

  it('detects orientation for edge-position ships', () => {
    // Ship at row 0 (top edge), horizontal
    expect(
      getShipOrientation({
        cells: [
          { r: 0, c: 0 },
          { r: 0, c: 1 },
        ],
      }),
    ).toBe('horizontal');

    // Ship at column 9 (right edge), vertical
    expect(
      getShipOrientation({
        cells: [
          { r: 8, c: 9 },
          { r: 9, c: 9 },
        ],
      }),
    ).toBe('vertical');
  });
});
