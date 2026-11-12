// input.js — PURE input / hitbox helpers, testable without Phaser.
//
// One scene-level pointer dispatcher (see scene/input.js) resolves
// every click with resolvePointerTarget() and runs exactly ONE branch,
// in strict priority order:
//   UI (its own buttons / y >= waterBottom) > coin > fish > empty water.
// First hit wins, nothing else fires — a coin click can never also
// drop food.
//
// Coins use a generous 24px radius, not the ~10px sprite, because a
// small, moving, sinking target is hard to click precisely.
// Fish use a 34x22 half-box (sprite is ~64x40, scaled up when large).

import { CONFIG, SELL_BOUNDS } from "./config.js";

export function coinHitAt(coinX, coinY, px, py) {
  const dx = px - coinX, dy = py - coinY;
  return dx * dx + dy * dy <= CONFIG.coinHitRadius * CONFIG.coinHitRadius;
}

export function fishHitAt(fishX, fishY, px, py) {
  return Math.abs(px - fishX) <= 34 && Math.abs(py - fishY) <= 22;
}

// coins: [{x, y}], fish: [{x, y}] — plain positions, no Phaser objects.
// Returns { type: "coin", index } / { type: "fish", index } /
// { type: "water" }. Nearest coin wins if several overlap; nearest
// fish wins likewise.
export function resolvePointerTarget(px, py, coins, fish) {
  let bestCoin = -1, bestCoinD = Infinity;
  for (let i = 0; i < coins.length; i++) {
    const dx = px - coins[i].x, dy = py - coins[i].y;
    const d = dx * dx + dy * dy;
    if (d <= CONFIG.coinHitRadius * CONFIG.coinHitRadius && d < bestCoinD) { bestCoinD = d; bestCoin = i; }
  }
  if (bestCoin >= 0) return { type: "coin", index: bestCoin };
  let bestFish = -1, bestFishD = Infinity;
  for (let i = 0; i < fish.length; i++) {
    if (!fishHitAt(fish[i].x, fish[i].y, px, py)) continue;
    const dx = px - fish[i].x, dy = py - fish[i].y;
    const d = dx * dx + dy * dy;
    if (d < bestFishD) { bestFishD = d; bestFish = i; }
  }
  if (bestFish >= 0) return { type: "fish", index: bestFish };
  return { type: "water" };
}

export function isPoke(movePx, elapsedMs) {
  return movePx < CONFIG.pokeMaxMove && elapsedMs < CONFIG.pokeMaxMs;
}
export function isGrab(movePx) { return movePx >= CONFIG.pokeMaxMove; }

export function isOverSell(px, py) {
  return px >= SELL_BOUNDS.x0 && px <= SELL_BOUNDS.x1 && py >= SELL_BOUNDS.y0 && py <= SELL_BOUNDS.y1;
}

// The feeder-bot is a pet, not a fish — clicking it does nothing
// except a toast. Its hitbox is a 30x22 half-box around its centre,
// like the fish hitbox (34x22) but a touch smaller.
export function robotHitAt(robotX, robotY, px, py) {
  return Math.abs(px - robotX) <= 30 && Math.abs(py - robotY) <= 22;
}
