/** Seeded pseudo-random number generator (LCG). Pure module — no DOM. */

export function seededRng(seed) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  };
}
