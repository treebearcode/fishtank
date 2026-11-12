// animation.js — PURE fish-animation math, no Phaser.
// The numbers here are unit-tested; the sprite work that uses them
// lives in scene/fish.js (animateFish).

import { CONFIG } from "./config.js";

// The tail's rotation offset, ±amplitude radians.
export function tailWiggle(phase, amplitude) {
  return Math.sin(phase) * amplitude;
}

// BODY GEOMETRY: the body ellipse is CENTRED in its 64x40 texture —
// centre (32, 20), radii (20, 13) — so flipping the body is a true
// mirror: the ellipse edge is ±20 from the sprite centre on both
// sides, facing either way.
export const BODY_ELLIPSE = { cx: 32, cy: 20, rx: 20, ry: 13 };

// TAIL JOINT: symmetric ±14 * baseScale. The tail's narrow point sits
// 2px from its pivot — toward the body facing right, away from it
// after the 180° rotation facing left — so the point is 4px inside the
// ±20 body edge on both sides: a real overlap, not a bare touch.
export function tailJointFor(facingLeft, baseScale) {
  return (facingLeft ? 14 : -14) * baseScale;
}

// TAIL ROTATION: the tail sprite's rotation, given the body rotation,
// the current wiggle, and which way the fish faces. The tail texture
// is drawn tip-left in its own space (wide fan at the trailing edge,
// narrow point at the origin), so with no turn at all its fan points
// left. Facing right that is already correct: rotation = rot + wiggle.
// Facing left the tail must turn ~180 deg so the fan points right, and
// the wiggle sign flips (minus) so the wag mirrors instead of doubling
// back. flipX on the tail is NEVER used — a flipped tail swings
// down/behind the body; rotating is the fix.
export function tailRotationFor(rot, wiggle, facingLeft) {
  return facingLeft ? rot + Math.PI - wiggle : rot + wiggle;
}

// Body tilt from swim direction, ±0.09 rad (±5°), following whether
// the fish is moving up or down.
export function fishTiltFor(dy, dist) {
  if (dist <= 4) return 0;
  const t = dy / dist;
  return Math.max(-0.09, Math.min(0.09, t * 0.09));
}

// POST-MEAL DRIFT target: the point ~distPx away from the pellet a
// fish just ate, in the direction away from that pellet, clamped into
// the water. If the fish is right on top of the pellet (under 4px
// away) there is no direction to go, so pick a random one — otherwise
// every fish that ate on the spot would drift the same way.
export function postMealDriftTarget(fx, fy, px, py, distPx) {
  const dx = fx - px, dy = fy - py;
  const len = Math.hypot(dx, dy);
  const ang = len < 4 ? Math.random() * Math.PI * 2 : Math.atan2(dy, dx);
  return {
    x: Math.max(30, Math.min(CONFIG.width - 30, fx + Math.cos(ang) * distPx)),
    y: Math.max(48, Math.min(CONFIG.waterBottom - 34, fy + Math.sin(ang) * distPx)),
  };
}
