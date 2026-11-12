// magnet.js — the Coin Magnet, a 4-LEVEL CHAIN on one shop button.
// Level 0 = not owned.
//   L1 Hover collect: coins are collected by HOVERING the pointer over
//      them (24px hitbox, same as clicking); clicking still works too.
//   L2-L4 Drag: coins within radius px of the cursor are gently dragged
//      toward it (MAGNET_DRAG_SPEED_PX) and collected on touch
//      (MAGNET_COLLECT_PX). Radii grow per level: 60 / 110 / 170.

import { CONFIG } from "./config.js";
import { coinHitAt } from "./input.js";

export const MAGNET_LEVELS = [
  { cost: 250, radius: 0,   name: "Hover collect" },
  { cost: 400, radius: 60,  name: "Drag 60" },
  { cost: 600, radius: 110, name: "Drag 110" },
  { cost: 900, radius: 170, name: "Drag 170" },
];
export const MAGNET_DRAG_SPEED_PX = 150; // px/s — a gentle pull, not a yank
export const MAGNET_COLLECT_PX = 14;     // collect when a dragged coin touches the cursor

// Cost to buy the NEXT level from `level` (0..3), or null at MAX (4).
export function magnetLevelCost(level) {
  return level >= 0 && level < MAGNET_LEVELS.length ? MAGNET_LEVELS[level].cost : null;
}

// Drag radius at `level` (0 = not owned -> 0, 1 = hover only -> 0).
export function magnetRadiusFor(level) {
  return level >= 1 && level <= MAGNET_LEVELS.length ? MAGNET_LEVELS[level - 1].radius : 0;
}

// MAGNET DRAG (pure, so it is unit-testable): where a coin ends up
// after one frame of being dragged toward the pointer. Returns null
// when the coin is OUTSIDE the radius (untouched), else
// { x, y, collect } — collect is true when the dragged coin is within
// MAGNET_COLLECT_PX of the pointer. The new position is clamped into
// the water (x 20..940, y 48..floorY), so drag can never pull a coin
// through the UI or out of the tank.
export function magnetDragCoin(coinX, coinY, pointerX, pointerY, radius, dt, speed) {
  const dx = pointerX - coinX, dy = pointerY - coinY;
  const dist = Math.hypot(dx, dy);
  if (dist > radius) return null;
  if (dist <= MAGNET_COLLECT_PX) return { x: coinX, y: coinY, collect: true };
  const step = Math.min(dist, (speed || MAGNET_DRAG_SPEED_PX) * dt);
  const nx = coinX + (dx / dist) * step;
  const ny = coinY + (dy / dist) * step;
  const cx = Math.max(20, Math.min(CONFIG.width - 20, nx));
  const cy = Math.max(48, Math.min(CONFIG.floorY, ny));
  const nd = Math.hypot(pointerX - cx, pointerY - cy);
  return { x: cx, y: cy, collect: nd <= MAGNET_COLLECT_PX };
}

// HOVER COLLECT (pure): L1 collects a coin when the pointer is over
// it — the same generous 24px hitbox as clicking (coinHitAt), so
// hovering feels exactly like clicking, minus the click.
export function magnetHoverAt(coinX, coinY, px, py) {
  return coinHitAt(coinX, coinY, px, py);
}
