// A small seeded generator (mulberry32): the same seed builds the same city,
// which is what makes the screenshot scenes repeatable from ?seed=N.
export function createRandom(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one entry of `list` with the seeded generator. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** A value in [min, max) from the seeded generator. */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}
