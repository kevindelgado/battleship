import { describe, it, expect } from 'vitest';
import { seededRng } from '../src/logic/rng.js';

describe('seededRng', () => {
  it('never returns exactly 1.0 even when internal state reaches max 32-bit value', () => {
    // The LCG state after one step from seed 0 is 1013904223.
    // We brute-force a seed whose first LCG output (s >>> 0) equals 0xffffffff,
    // which is the maximum unsigned 32-bit value. With the old divisor
    // (0xffffffff) this would produce 1.0; with the correct divisor
    // (0x100000000) the result must be strictly less than 1.0.

    // Directly craft a scenario: set seed so that after one LCG step s = 0xffffffff.
    // LCG: s_next = (seed * 1664525 + 1013904223) & 0xffffffff
    // We want s_next = 0xffffffff, so seed * 1664525 + 1013904223 ≡ -1 (mod 2^32).
    // Solve: seed = (0xffffffff - 1013904223) * modInverse(1664525, 2^32)
    // Rather than computing mod-inverse, just search for it:
    let craftedSeed = null;
    for (let candidate = 0; candidate < 0x100000000; candidate++) {
      const s = (candidate * 1664525 + 1013904223) & 0xffffffff;
      if ((s >>> 0) === 0xffffffff) {
        craftedSeed = candidate;
        break;
      }
    }

    // If we found a seed, test it; otherwise fall back to statistical check
    if (craftedSeed !== null) {
      const rng = seededRng(craftedSeed);
      const val = rng();
      expect(val).toBeLessThan(1.0);
      expect(val).toBeGreaterThanOrEqual(0);
    }

    // Also verify over many iterations that the result is always in [0, 1)
    const rng2 = seededRng(0);
    for (let i = 0; i < 100_000; i++) {
      const val = rng2();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1.0);
    }
  });

  it('index derived from RNG never equals array.length', () => {
    // Simulate the pattern used throughout the codebase:
    //   arr[Math.floor(rng() * arr.length)]
    // With the old bug (rng returning 1.0), this would produce arr.length.
    const arrLengths = [1, 2, 5, 10, 100];

    for (const len of arrLengths) {
      const rng = seededRng(0);
      for (let i = 0; i < 50_000; i++) {
        const idx = Math.floor(rng() * len);
        expect(idx).toBeGreaterThanOrEqual(0);
        expect(idx).toBeLessThan(len);
      }
    }
  });
});
