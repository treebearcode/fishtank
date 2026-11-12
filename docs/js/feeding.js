// feeding.js — PURE feeding helpers, no Phaser.
//
// ANY eligible fish (not grabbed, not on its 0.5s cooldown) that
// touches a pellet eats it — nearestPelletEater() picks the closest
// eligible fish within eating range (18px), first arrival wins.
// Several fish may chase the same pellet: they fight over food.
// The 0.5s eat cooldown (CONFIG.FEED_COOLDOWN_S) is the only
// anti-hogging left.
// `fish` here is { x, y, eatCooldownSec, grabbed }.

export function isEligibleToEat(fish) {
  return !fish.grabbed && (fish.eatCooldownSec || 0) <= 0;
}

// Nearest eligible fish within 18px of the pellet, or -1 if none can
// eat it right now. Ties are impossible in practice (exact equal
// distances), but the first fish wins them.
export function nearestPelletEater(px, py, candidates) {
  let best = -1, bestD = 18 * 18;
  for (let i = 0; i < candidates.length; i++) {
    const f = candidates[i];
    if (!isEligibleToEat(f)) continue;
    const dx = px - f.x, dy = py - f.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}
