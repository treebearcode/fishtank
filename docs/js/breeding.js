// breeding.js — PURE breeding guards (Minecraft-style), no Phaser.
//
// A pair can breed when ALL of these hold:
//   - the tank is NOT at its fish cap (an egg needs a slot to hatch
//     into, and the pair must not form when there is no room at all)
//   - both fish are LARGE (stage 2) and the SAME species
//   - both ate within the last 30s AND neither is hungry yet (the
//     "recently fed" check alone would still allow a fish fed 25s ago,
//     which is already pale and hungry)
//   - neither is pregnant, already in a hearts pair, on its 60s breed
//     cooldown, or grabbed right now
// `a` and `b` are plain fish-ish objects:
//   { species, stage, lastFedSec, hungerSec, pregnant, breeding,
//     breedCooldownSec, grabbed }. fishCount/cap are plain numbers.

import { CONFIG } from "./config.js";
import { isHungry } from "./economy.js";

export const BREED = {
  fedWithinSec: 30,     // each parent must have eaten within the last 30s
  heartsSec: 3,         // hearts animation while the pair swims together
  pregnantSec: 15,      // the pregnant fish carries the egg this long
  eggWaitSec: 20,       // the egg sits on the floor this long before hatching
  breedCooldownSec: 60, // each parent waits this long after the egg pops
};

export function canBreed(a, b, fishCount, cap) {
  if (!a || !b || a === b) return false;
  if (fishCount >= cap) return false;
  if (a.species !== b.species) return false;
  if (a.stage !== 2 || b.stage !== 2) return false;
  for (const f of [a, b]) {
    if (f.pregnant || f.breeding) return false;
    if ((f.breedCooldownSec || 0) > 0) return false;
    if (f.grabbed) return false;
    if ((f.lastFedSec == null ? Infinity : f.lastFedSec) > BREED.fedWithinSec) return false;
    if (isHungry(f.hungerSec || 0)) return false;
  }
  return true;
}

// Find the first breedable pair in a fish list, or null. Pairs are
// tried in list order, so the result is deterministic for a given
// tank — the first two large, recently-fed fish of a species win.
export function findBreedPair(fish, cap) {
  for (let i = 0; i < fish.length; i++) {
    for (let j = i + 1; j < fish.length; j++) {
      if (canBreed(fish[i], fish[j], fish.length, cap)) return [fish[i], fish[j]];
    }
  }
  return null;
}

// After the hearts, the BETTER-FED parent (lower hungerSec — fed more
// recently) becomes pregnant. Ties go to the first fish.
export function pickPregnantParent(a, b) {
  return (a.hungerSec || 0) <= (b.hungerSec || 0) ? a : b;
}

// An egg hatches only when there is room under the cap at hatch time.
// If the tank is full, the egg waits (pulsing) until room frees up.
export function eggCanHatch(fishCount, cap) { return fishCount < cap; }
