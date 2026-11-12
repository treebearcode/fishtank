// snail.js — PURE snail targeting helpers, no Phaser.
//
// snailTargetCoin scores coins by estimated TIME-TO-COLLECT, not
// horizontal distance — a coin at the top of the tank directly above
// Turbo must NOT beat a landed coin 80px away, or he waits ~14s for it
// to fall while the landed coin sits out its 10s floor life and fades.
// The score for each coin is:
//   timeToLand = max(0, (floorY - coin.y) / coinVy)  — 0 if landed
//   travelTime = |coin.x - snailX| / snailSpeed       — crawl time
//   score      = max(timeToLand, travelTime)
// He can crawl WHILE the coin falls, so he only needs to be there when
// it lands — that is why it is max(), not a sum. He still only
// COLLECTS landed coins (snailCanCollect): target choice and collect
// check are deliberately separate.

import { CONFIG } from "./config.js";

export function snailTargetCoin(coins, snailX, floorY, snailSpeed) {
  const speed = Math.max(1, snailSpeed || CONFIG.snailSpeed);
  let best = -1, bestScore = Infinity;
  for (let i = 0; i < coins.length; i++) {
    const c = coins[i];
    const vy = c.vy || 26;
    const timeToLand = Math.max(0, (floorY - c.y) / vy);
    const travelTime = Math.abs(c.x - snailX) / speed;
    const score = Math.max(timeToLand, travelTime);
    if (score < bestScore) { bestScore = score; best = i; }
  }
  return best;
}

// SNAIL OVERSHOOT — where Turbo actually aims, once a target coin is
// picked. SINKING ONLY: while the coin is still floating down
// (y < floorY - 10), aim overshootPx PAST its landing x in the
// direction Turbo is travelling, so he rushes through the landing
// spot, turns, and paces back across it — eager, not jittery. The aim
// point is recomputed every frame, so when he crosses the landing x
// the overshoot flips to the other side and he paces back. Once the
// coin lands, aim exactly at it: aiming past a landed coin would only
// delay collecting it. If he is already directly under the coin
// (dx = 0) there is no travel direction, so aim at the coin itself.
export function snailAimX(coin, snailX, floorY, overshootPx) {
  if (!coin || coin.y >= floorY - 10) return coin ? coin.x : snailX;
  const dx = coin.x - snailX;
  if (dx === 0) return coin.x;
  return coin.x + Math.sign(dx) * (overshootPx || 0);
}

// Turbo only collects LANDED coins (within the last 10px above the
// floor), and only when he is within 20px of them.
export function snailCanCollect(coin, snailX, floorY) {
  return coin.y >= floorY - 10 && Math.abs(coin.x - snailX) < 20;
}
