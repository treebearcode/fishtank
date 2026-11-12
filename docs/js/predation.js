// predation.js — PURE predation guards, no Phaser.
//
// A LARGE Chomper that is hungry (hungerSec > 0 — ANY time since its
// last meal, not the 20s "hungry" pale threshold) hunts babies:
//   - prey: any stage-0 (baby) fish of ANY species EXCEPT baby
//     Chompers. Stage-1+ fish are never prey, and eggs are not fish
//     at all, so they are never eaten either.
//   - range: the hunter chases a baby within HUNT_RANGE_PX (~70px)
//     and catches it on contact within HUNT_CATCH_PX (~18px, the same
//     as pellet eating). Out of range, the baby is safe.
//   - a grabbed fish is never prey (the player is holding it), and a
//     grabbed hunter does not hunt.
// `hunter` / `prey` are plain fish-ish objects:
//   { species, stage, hungerSec, grabbed, x, y } — or scene fish,
//   whose position lives on .sprite (preyPos reads either).

export const HUNT_RANGE_PX = 70;    // chase trigger: baby within ~70px
export const HUNT_CATCH_PX = 18;    // catch on contact, like eating a pellet
export const CHOMP_GULP_SEC = 0.35; // how long the gulp scale pulse lasts

export function preyPos(f) {
  return f.sprite ? { x: f.sprite.x, y: f.sprite.y } : { x: f.x, y: f.y };
}

export function isHuntablePrey(prey) {
  return !!prey && prey.stage === 0 && prey.species !== "chomper" && !prey.grabbed;
}

export function canHunt(hunter, prey) {
  if (!hunter || !prey) return false;
  if (hunter.species !== "chomper" || hunter.stage !== 2) return false;
  if ((hunter.hungerSec || 0) <= 0) return false; // well-fed: no hunting
  if (hunter.grabbed) return false;
  return isHuntablePrey(prey);
}

// Nearest huntable baby within rangePx (default ~70px) of the hunter,
// or null. Ties go to the first baby in list order.
export function findPrey(hunter, fish, rangePx) {
  const range = rangePx == null ? HUNT_RANGE_PX : rangePx;
  const hp = preyPos(hunter);
  let best = null, bestD = range * range;
  for (const f of fish) {
    if (f === hunter || !canHunt(hunter, f)) continue;
    const pp = preyPos(f);
    const dx = pp.x - hp.x, dy = pp.y - hp.y;
    const d = dx * dx + dy * dy;
    if (d <= bestD) { bestD = d; best = f; }
  }
  return best;
}
