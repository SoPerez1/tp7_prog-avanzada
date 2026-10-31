// PRNG con semilla (mulberry32): misma semilla => misma corrida
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    chance: (p) => next() < p,
    int: (lo, hi) => Math.floor(lo + next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    weighted(pairs) {
      let r = next() * pairs.reduce((s, [, w]) => s + w, 0);
      for (const [v, w] of pairs) if ((r -= w) < 0) return v;
      return pairs.at(-1)[0];
    },
  };
}
