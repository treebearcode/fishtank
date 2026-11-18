// textures.js — procedural art. Each function draws once into a texture
// that sprites then reuse (cheap: one draw, many sprites). No binary
// assets anywhere in the game.
//
// FUTURE SWAP: to use real art (e.g. the Kenney Fish Pack, CC0 — see
// CREDITS.md), drop the PNGs in src/assets/ and replace these makers
// with this.load.image() calls in preload(). The fish code only ever
// refers to the texture keys 'fish-body-<species>-<stage>-<pattern>'
// and 'fish-tail-<species>-<stage>'.
//
// The fish is TWO textures, not one: a single flat fish image cannot
// wiggle its tail — rotating the whole sprite just rocks the fish. So
// the body (ellipse + fin + eye) and the tail (triangle) are drawn
// separately and joined at runtime: the body image is fish.sprite (the
// single source of truth for position / flip / tint / scale), and the
// tail is a second image (fish.tail) that animateFish() positions and
// rotates every frame, pivoted where it meets the body.
//
// Body texture: 64x40. The body ellipse is CENTRED — spans x 12..52,
// centre (32, 20), radii (20, 13) — so flipping the body mirrors it
// exactly and the tail joint is the same ±14 both ways (see
// BODY_ELLIPSE / tailJointFor in animation.js).

import { speciesDef, COIN_COLORS } from "./config.js";

// Darken a hex colour by factor f (0-1) — pattern overlays are a
// darker shade of the body colour, so they read as markings, not new
// colours.
function shade(hex, f) {
  const r = Math.round(((hex >> 16) & 0xff) * f);
  const g = Math.round(((hex >> 8) & 0xff) * f);
  const b = Math.round((hex & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}

// PATTERN OVERLAY: drawn on top of the base body, before the eye, so
// markings never cover the face. All shapes stay inside the body
// silhouette by construction — stripes are chord-height bars, spots
// are small circles well inside the ellipse, the gradient is a small
// ellipse in the body's upper middle. Subtle on purpose (shade 0.72):
// a striped guppy is still obviously a guppy.
function drawBodyPattern(g, pattern, speciesKey, color) {
  if (!pattern || pattern === "plain") return;
  const dark = shade(color, 0.72);
  if (speciesKey === "starfish") {
    // The star's solid centre only — short bars and dots near it.
    if (pattern === "stripes") {
      g.fillStyle(dark, 1);
      for (const x of [28, 32, 36]) g.fillRect(x - 1.5, 15, 3, 10);
    } else if (pattern === "spots") {
      g.fillStyle(dark, 1);
      g.fillCircle(28, 17, 2); g.fillCircle(36, 17, 2); g.fillCircle(32, 24, 2);
    } else if (pattern === "gradient") {
      g.fillStyle(dark, 0.6);
      g.fillCircle(32, 20, 7);
    }
    return;
  }
  if (pattern === "stripes") {
    // Vertical bars at x=24/32/40, heights = the body ellipse's chord
    // at that x (minus a hair), so no bar pokes past the silhouette.
    g.fillStyle(dark, 1);
    for (const x of [24, 32, 40]) {
      const d = Math.abs(x - 32) / 20;
      const h = 2 * 13 * Math.sqrt(1 - d * d) - 2;
      g.fillRect(x - 2, 20 - h / 2, 4, h);
    }
  } else if (pattern === "spots") {
    g.fillStyle(dark, 1);
    g.fillCircle(24, 16, 2.5); g.fillCircle(36, 24, 2.5);
    g.fillCircle(40, 15, 2.5); g.fillCircle(26, 25, 2.5);
  } else if (pattern === "gradient") {
    // Darker upper body — a small ellipse in the body's upper middle,
    // sized to stay inside the silhouette.
    g.fillStyle(dark, 0.6);
    g.fillEllipse(32, 15, 24, 9);
  }
}

export function makeFishBodyTexture(scene, stage, speciesKey, pattern) {
  const sp = speciesDef(speciesKey);
  const pat = pattern || "plain";
  const key = "fish-body-" + sp.key + "-" + stage + "-" + pat;
  if (scene.textures.exists(key)) return key;
  // Stage 3 (royal) reuses the large palette — the crown and the
  // 1.35x scale are what mark a royal, not a new body colour.
  const color = sp.colors[Math.min(stage, 2)];
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const w = 64, h = 40;
  if (sp.key === "starfish") {
    // STARFISH: a 5-point star polygon, NOT the ellipse — the star is
    // the species' whole look. Centred at (32, 20), outer radius 19,
    // inner radius 8, one point straight up. The shape spans x 13..51,
    // symmetric about the centre, so flipping mirrors it exactly.
    // No tail texture exists for this species.
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 19 : 8;
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push({ x: 32 + Math.cos(ang) * r, y: 20 + Math.sin(ang) * r });
    }
    g.fillStyle(color, 1);
    g.fillPoints(pts, true);
    // Two little eyes near the top point, so it reads as a creature.
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(28, 14, 2);
    g.fillCircle(36, 14, 2);
    g.fillStyle(0xffffff, 0.3);
    g.fillCircle(32, 24, 4);
    drawBodyPattern(g, pat, sp.key, color);
    // Small white dots on the star arms, so the arms read at a glance.
    g.fillStyle(0xffffff, 0.9);
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      g.fillCircle(32 + Math.cos(ang) * 13, 20 + Math.sin(ang) * 13, 1.8);
    }
    g.generateTexture(key, w, h);
    g.destroy();
    return key;
  }
  if (sp.key === "emberfin") {
    // EMBERFIN: sleeker than a guppy (narrower ellipse) and TWO-TONE —
    // a darker red-orange back over a bright orange belly — with a
    // jagged flame-shaped dorsal fin. Centred at (32, 20) like the
    // guppy, so flipping mirrors it exactly and the tail joint is
    // unchanged.
    g.fillStyle(color, 1);
    g.fillEllipse(32, h / 2, 40, 22);
    // Darker red-orange back (upper half).
    g.fillStyle(0xd63c0a, 1);
    g.fillEllipse(32, h / 2 - 4, 34, 12);
    // Bright belly highlight.
    g.fillStyle(0xffffff, 0.25);
    g.fillEllipse(32, h / 2 + 6, 28, 8);
    drawBodyPattern(g, pat, sp.key, color);
    // Jagged flame dorsal fin (zigzag, not a smooth triangle).
    g.fillStyle(color, 1);
    g.fillPoints([
      { x: 24, y: 9 }, { x: 27, y: 1 }, { x: 30, y: 6 },
      { x: 33, y: 0 }, { x: 36, y: 6 }, { x: 39, y: 9 },
    ], true);
    // Eye.
    g.fillStyle(0xffffff, 1);
    g.fillCircle(46, 15, 5);
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(47, 15, 2.5);
    g.generateTexture(key, w, h);
    g.destroy();
    return key;
  }
  if (sp.key === "chomper") {
    // CHOMPER: deep purple body, a BIG visible jaw on the head end
    // (dark mouth + white teeth), a big eye, and a spiky dorsal fin —
    // unmistakably the predator. Still centred at (32, 20), same
    // 40x26 ellipse as the guppy, so the tail joint is unchanged; the
    // 1.3x size comes from fishScale(), not the texture.
    g.fillStyle(color, 1);
    g.fillEllipse(32, h / 2, 40, 26);
    // Belly highlight.
    g.fillStyle(0xffffff, 0.25);
    g.fillEllipse(32, h / 2 + 6, 30, 10);
    drawBodyPattern(g, pat, sp.key, color);
    // Spiky dorsal fin (zigzag).
    g.fillStyle(color, 1);
    g.fillPoints([
      { x: 24, y: 8 }, { x: 27, y: 0 }, { x: 30, y: 7 },
      { x: 33, y: 0 }, { x: 36, y: 7 }, { x: 39, y: 8 },
    ], true);
    // Big jaw on the head end: dark mouth arc + 3 small white teeth.
    g.fillStyle(0x2a0a3a, 1);
    g.fillEllipse(50, 24, 15, 9);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(45, 20, 48, 20, 46.5, 24);
    g.fillTriangle(49, 20, 52, 20, 50.5, 24);
    g.fillTriangle(53, 21, 56, 21, 54.5, 24);
    // Big eye.
    g.fillStyle(0xffffff, 1);
    g.fillCircle(44, 13, 6.5);
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(45, 13, 3);
    g.generateTexture(key, w, h);
    g.destroy();
    return key;
  }
  // Guppy body (ellipse), centred. No tail here — that is
  // fish-tail-<species>-<stage>.
  g.fillStyle(color, 1);
  g.fillEllipse(32, h / 2, 40, 26);
  // Belly highlight.
  g.fillStyle(0xffffff, 0.25);
  g.fillEllipse(32, h / 2 + 6, 30, 10);
  drawBodyPattern(g, pat, sp.key, color);
  // Dorsal fin.
  g.fillStyle(color, 1);
  g.fillTriangle(26, 8, 38, 8, 32, 0);
  // Eye.
  g.fillStyle(0xffffff, 1);
  g.fillCircle(46, 15, 5);
  g.fillStyle(0x1a1a1a, 1);
  g.fillCircle(47, 15, 2.5);
  g.generateTexture(key, w, h);
  g.destroy();
  return key;
}

// TAIL SHAPE: a real fish tail is narrow where it joins the body and
// fans WIDE at the trailing edge. Vertices in texture space (24x40):
// the narrow point is at the body side (x=22, the origin side), the
// wide fan is the trailing edge (x=2, y 6..34). The pivot (origin
// (1, 0.5)) is the narrow point, so the point tucks into the
// elliptical body.
export const TAIL_TRIANGLE = {
  point: { x: 22, y: 20 },
  wideTop: { x: 2, y: 6 },
  wideBottom: { x: 2, y: 34 },
};

// TAIL GEOMETRY PER SPECIES: the guppy and Chomper share the triangle
// above. The Emberfin's tail is LONGER and WIDER — a flowing fan (30x40
// texture, point 2px from the pivot at x=28, fan spanning y 2..38).
// The pivot stays 2px from the narrow point for every species, so the
// tail point stays 4px inside the body edge at every stage and species.
// Starfish have no tail at all (hasTail: false).
export function tailGeometryFor(speciesKey) {
  if (speciesKey === "emberfin") {
    return {
      w: 30, h: 40,
      point: { x: 28, y: 20 },
      wideTop: { x: 2, y: 2 },
      wideBottom: { x: 2, y: 38 },
    };
  }
  return {
    w: 24, h: 40,
    point: { x: TAIL_TRIANGLE.point.x, y: TAIL_TRIANGLE.point.y },
    wideTop: { x: TAIL_TRIANGLE.wideTop.x, y: TAIL_TRIANGLE.wideTop.y },
    wideBottom: { x: TAIL_TRIANGLE.wideBottom.x, y: TAIL_TRIANGLE.wideBottom.y },
  };
}

export function makeFishTailTexture(scene, stage, speciesKey) {
  const sp = speciesDef(speciesKey);
  const key = "fish-tail-" + sp.key + "-" + stage;
  if (scene.textures.exists(key)) return key;
  // Stage 3 (royal) reuses the large tail colour, like the body.
  const color = sp.colors[Math.min(stage, 2)];
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const tg = tailGeometryFor(sp.key);
  g.fillStyle(color, 1);
  g.fillTriangle(
    tg.point.x, tg.point.y,
    tg.wideTop.x, tg.wideTop.y,
    tg.wideBottom.x, tg.wideBottom.y);
  g.generateTexture(key, tg.w, tg.h);
  g.destroy();
  return key;
}

// DEAD FISH: a starved fish, belly-up and grey. One texture per
// species, drawn once like the live bodies: the species' own shape
// (grey ellipse + its dorsal fin, or the grey star for a starfish)
// with cartoon X eyes instead of a normal eye. Tailed species get
// the tail drawn INTO the same texture (narrow point at the body
// joint, wide fan at the trailing edge — the tailGeometryFor fan,
// in grey), so a dead fish is a single sprite: it never wags, it
// just floats. The canvas is 88x40 for tailed fish (the tail fan
// sticks out 20px past the body's left edge) and 64x40 for the
// starfish; the body centre is at x=56 (tailed) so the sprite origin
// can sit on the body, not on the middle of the tail.
export function makeDeadFishTexture(scene, speciesKey) {
  const sp = speciesDef(speciesKey);
  const key = "fish-dead-" + sp.key;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const grey = 0x9aa5b1;      // dead grey body
  const greyDark = 0x7a8a99;  // darker grey for the fin
  const eyeDark = 0x2a2a2a;   // the X eyes
  // One X eye: two crossing diagonal bars (fillPoints polygons —
  // the headless stub has no lineBetween, so no strokes here).
  const xEye = (x, y) => {
    g.fillStyle(eyeDark, 1);
    g.fillPoints([
      { x: x - 3, y: y - 3 }, { x: x - 1, y: y - 3 },
      { x: x + 3, y: y + 3 }, { x: x + 1, y: y + 3 },
    ], true);
    g.fillPoints([
      { x: x + 3, y: y - 3 }, { x: x + 1, y: y - 3 },
      { x: x - 3, y: y + 3 }, { x: x - 1, y: y + 3 },
    ], true);
  };
  if (sp.key === "starfish") {
    // Grey star, same 5-point polygon as the live body.
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 19 : 8;
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push({ x: 32 + Math.cos(ang) * r, y: 20 + Math.sin(ang) * r });
    }
    g.fillStyle(grey, 1);
    g.fillPoints(pts, true);
    g.fillStyle(0xffffff, 0.15);
    g.fillCircle(32, 24, 4);
    xEye(28, 14);
    xEye(36, 14);
    g.generateTexture(key, 64, 40);
    g.destroy();
    return key;
  }
  // Tailed fish: tail fan first (drawn under the body), then the
  // body ellipse, then the species' dorsal fin, then the X eye.
  // Body centre (56, 20), edge at x=36; the tail's narrow point
  // tucks 2px inside that edge and the fan reaches x=18.
  const tg = tailGeometryFor(sp.key);
  g.fillStyle(grey, 1);
  g.fillTriangle(38, 20, 18, tg.wideTop.y, 18, tg.wideBottom.y);
  g.fillEllipse(56, 20, 40, 26);
  // Paler belly, so the grey reads as a fish and not a blob.
  g.fillStyle(0xffffff, 0.15);
  g.fillEllipse(56, 26, 30, 10);
  // Dorsal fin — the species' own silhouette, in darker grey.
  g.fillStyle(greyDark, 1);
  if (sp.key === "emberfin" || sp.key === "chomper") {
    // Jagged / spiky fin (same zigzag as the live body, shifted +24).
    g.fillPoints([
      { x: 48, y: 9 }, { x: 51, y: 1 }, { x: 54, y: 6 },
      { x: 57, y: 0 }, { x: 60, y: 6 }, { x: 63, y: 9 },
    ], true);
  } else {
    g.fillTriangle(50, 8, 62, 8, 56, 0);
  }
  // X eye where the live eye sits (head end, right side).
  xEye(70, 15);
  g.generateTexture(key, 88, 40);
  g.destroy();
  return key;
}

export function makeCoinTexture(scene, stage) {
  const key = "coin-" + stage;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const color = COIN_COLORS[stage];
  const r = stage === 2 ? 13 : stage === 1 ? 12 : 10; // diamond biggest
  if (stage === 2) {
    // Diamond: a rotated square (gem) instead of a circle.
    g.fillStyle(0xffffff, 1);
    g.fillPoints([
      { x: 16, y: 2 }, { x: 30, y: 16 }, { x: 16, y: 30 }, { x: 2, y: 16 },
    ], true);
    g.fillStyle(color, 1);
    g.fillPoints([
      { x: 16, y: 6 }, { x: 26, y: 16 }, { x: 16, y: 26 }, { x: 6, y: 16 },
    ], true);
  } else {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(16, 16, r + 2);
    g.fillStyle(color, 1);
    g.fillCircle(16, 16, r);
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(16, 16, r - 4);
  }
  g.generateTexture(key, 32, 32);
  g.destroy();
  return key;
}

export function makeSnailTexture(scene) {
  const key = "snail";
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  // Body: a soft slug shape along the bottom.
  g.fillStyle(0xf2a65a, 1);
  g.fillEllipse(32, 26, 56, 18);
  // Shell: a big circle with a spiral hint (concentric rings).
  g.fillStyle(0x8e6cc8, 1);
  g.fillCircle(30, 16, 15);
  g.fillStyle(0xb79ce0, 1);
  g.fillCircle(30, 16, 10);
  g.fillStyle(0x8e6cc8, 1);
  g.fillCircle(30, 16, 5);
  // Eye stalks + eyes (front, right side — the snail faces right).
  g.fillStyle(0xf2a65a, 1);
  g.fillRect(52, 6, 3, 12);
  g.fillRect(58, 8, 3, 10);
  g.fillStyle(0x1a1a1a, 1);
  g.fillCircle(54, 6, 2.5);
  g.fillCircle(60, 8, 2.5);
  g.generateTexture(key, 64, 36);
  g.destroy();
  return key;
}

export function makePelletTexture(scene) {
  const key = "pellet";
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0x7a4a21, 1);
  g.fillCircle(6, 6, 5);
  g.fillStyle(0xa06a35, 1);
  g.fillCircle(6, 6, 3);
  g.generateTexture(key, 12, 12);
  g.destroy();
  return key;
}

// Deluxe pellet — bigger and gold, so the two food types are readable
// at a glance (and so a misclick is obvious, not silent).
export function makeDeluxePelletTexture(scene) {
  const key = "pellet-deluxe";
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0x8a6a1f, 1);
  g.fillCircle(8, 8, 7);
  g.fillStyle(0xffd23f, 1);
  g.fillCircle(8, 8, 5);
  g.fillStyle(0xfff3b0, 1);
  g.fillCircle(6, 6, 2);
  g.generateTexture(key, 16, 16);
  g.destroy();
  return key;
}

// Feast Plant fronds — THREE variants, each drawn AT display size
// (48x108) with real detail, not one small blade scaled 3x (that is
// what made the big plant look stretched and weird). The variants
// are dealt round-robin to the six fronds of a plant, so no two
// neighbouring fronds are identical:
//   a — long curved blade, tapered, centre vein + side veins;
//   b — broad oval leaf, lighter rim, veins fanning from the centre;
//   c — narrow serrated blade, zigzag edges, centre vein.
// All three pivot at the base (origin 0.5, 1 in spawnFeastPlant) and
// share the same 48x108 extent, so the plant's geometry math is
// unchanged.
function drawFrondVeins(g, color, tipX, tipY) {
  // Centre vein, base (24, 108) to the tip, plus four short side
  // veins angling off it — thin quads, so they read at any scale.
  g.fillStyle(color, 1);
  g.fillPoints([
    { x: 23, y: 106 }, { x: 25, y: 106 },
    { x: tipX + 1, y: tipY + 4 }, { x: tipX - 1, y: tipY + 4 },
  ]);
  for (const [y, len] of [[84, 10], [62, 12], [40, 11], [22, 8]]) {
    g.fillPoints([
      { x: 24, y }, { x: 24, y: y + 2 },
      { x: 24 - len, y: y + 8 }, { x: 24 - len, y: y + 10 },
    ]);
    g.fillPoints([
      { x: 24, y }, { x: 24, y: y + 2 },
      { x: 24 + len, y: y + 8 }, { x: 24 + len, y: y + 10 },
    ]);
  }
}

export function makeFeastPlantFrondTexture(scene, variant) {
  const key = "feast-plant-frond-" + variant;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  if (variant === "a") {
    // Long curved blade — tapered, leaning slightly right.
    g.fillStyle(0x2f9e5f, 1);
    g.fillPoints([
      { x: 24, y: 108 }, { x: 14, y: 84 }, { x: 10, y: 52 },
      { x: 16, y: 22 }, { x: 26, y: 2 }, { x: 32, y: 24 },
      { x: 38, y: 56 }, { x: 34, y: 86 },
    ]);
    g.fillStyle(0x3fae6a, 1);
    g.fillPoints([
      { x: 24, y: 106 }, { x: 17, y: 82 }, { x: 14, y: 54 },
      { x: 19, y: 26 }, { x: 26, y: 6 }, { x: 29, y: 26 },
      { x: 34, y: 56 }, { x: 31, y: 84 },
    ]);
    drawFrondVeins(g, 0x1e6b3f, 26, 4);
    // Light edge along the curve's lit side.
    g.fillStyle(0x7fd4a0, 0.8);
    g.fillPoints([
      { x: 30, y: 30 }, { x: 33, y: 32 }, { x: 36, y: 58 },
      { x: 33, y: 84 }, { x: 30, y: 82 }, { x: 33, y: 56 },
    ]);
  } else if (variant === "b") {
    // Broad oval leaf — dark rim, lighter heart, veins fanning out.
    g.fillStyle(0x2f9e5f, 1);
    g.fillEllipse(24, 54, 44, 100);
    g.fillStyle(0x46b573, 1);
    g.fillEllipse(24, 54, 34, 88);
    g.fillStyle(0x2f9e5f, 1);
    g.fillEllipse(24, 58, 26, 76);
    drawFrondVeins(g, 0x1e6b3f, 24, 10);
    g.fillStyle(0x7fd4a0, 0.7);
    g.fillEllipse(20, 40, 10, 30);
  } else {
    // Narrow serrated blade — zigzag edges, centre vein.
    g.fillStyle(0x2f9e5f, 1);
    g.fillPoints([
      { x: 24, y: 108 }, { x: 16, y: 96 }, { x: 20, y: 86 },
      { x: 13, y: 74 }, { x: 18, y: 64 }, { x: 12, y: 50 },
      { x: 18, y: 40 }, { x: 14, y: 26 }, { x: 22, y: 14 },
      { x: 26, y: 2 }, { x: 30, y: 14 }, { x: 34, y: 26 },
      { x: 30, y: 40 }, { x: 36, y: 50 }, { x: 30, y: 64 },
      { x: 35, y: 74 }, { x: 28, y: 86 }, { x: 32, y: 96 },
    ]);
    g.fillStyle(0x3fae6a, 1);
    g.fillPoints([
      { x: 24, y: 106 }, { x: 19, y: 94 }, { x: 21, y: 84 },
      { x: 17, y: 72 }, { x: 20, y: 62 }, { x: 17, y: 50 },
      { x: 20, y: 40 }, { x: 18, y: 28 }, { x: 23, y: 16 },
      { x: 26, y: 6 }, { x: 29, y: 16 }, { x: 30, y: 28 },
      { x: 27, y: 40 }, { x: 31, y: 50 }, { x: 27, y: 62 },
      { x: 31, y: 72 }, { x: 27, y: 84 }, { x: 29, y: 94 },
    ]);
    drawFrondVeins(g, 0x1e6b3f, 26, 6);
  }
  g.generateTexture(key, 48, 108);
  g.destroy();
  return key;
}

// Feast Plant stem — drawn AT display size (24x72), not a flat
// rectangle: segment rings, a lighter centre stripe, and root
// tendrils flaring at the base. It sits at the same place and size
// as the old rectangle (centred on (0, 12) in the plant container).
export function makeFeastPlantStemTexture(scene) {
  const key = "feast-plant-stem";
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  // Main stem with a vertical gradient (darker at the top).
  g.fillGradientStyle(0x2a7a45, 0x2a7a45, 0x3fae6a, 0x3fae6a, 1);
  g.fillRect(4, 0, 16, 72);
  // Lighter centre stripe.
  g.fillStyle(0x6fc48d, 1);
  g.fillRect(10, 2, 4, 68);
  // Segment rings — the joints where fronds attach.
  g.fillStyle(0x1e6b3f, 1);
  for (const y of [14, 30, 46, 60]) g.fillRect(4, y, 16, 2);
  // Root tendrils flaring at the base.
  g.fillStyle(0x2f9e5f, 1);
  g.fillTriangle(6, 66, 0, 72, 10, 72);
  g.fillTriangle(12, 68, 10, 72, 15, 72);
  g.fillTriangle(18, 66, 14, 72, 24, 72);
  g.generateTexture(key, 24, 72);
  g.destroy();
  return key;
}

// Feast Plant skeleton — what is left when the fish strip a plant
// to the bone. Drawn AT display size (24x152) in detail: a gnarled,
// wavy pale stem (not a straight triangle), knots where fronds were
// bitten off, stubs of varied length and angle, and a forked tip.
// Shown only for the final 5 nibbles (see updatePlantFronds).
export function makeFeastPlantSkeletonTexture(scene) {
  const key = "feast-plant-skeleton";
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  // Gnarled stem — a wavy tapered polygon, wide at the base.
  g.fillStyle(0xd8cba6, 1);
  g.fillPoints([
    { x: 9, y: 152 }, { x: 6, y: 122 }, { x: 10, y: 92 },
    { x: 5, y: 62 }, { x: 9, y: 32 }, { x: 11, y: 8 },
    { x: 13, y: 2 }, { x: 15, y: 8 }, { x: 14, y: 32 },
    { x: 18, y: 62 }, { x: 13, y: 92 }, { x: 17, y: 122 },
    { x: 15, y: 152 },
  ]);
  // Lighter edge along the stem's lit side.
  g.fillStyle(0xe8dcc0, 1);
  g.fillPoints([
    { x: 13, y: 150 }, { x: 15, y: 122 }, { x: 12, y: 92 },
    { x: 16, y: 62 }, { x: 13, y: 32 }, { x: 14, y: 10 },
    { x: 15, y: 32 }, { x: 17, y: 62 }, { x: 14, y: 92 },
    { x: 16, y: 122 }, { x: 14, y: 150 },
  ]);
  // Knots where fronds were bitten off.
  g.fillStyle(0xbfae85, 1);
  g.fillCircle(8, 122, 2.5); g.fillCircle(15, 92, 2.5); g.fillCircle(8, 62, 2.5);
  // Stub branches — varied lengths and angles, alternating sides.
  g.fillStyle(0xc9b992, 1);
  g.fillRect(2, 26, 8, 3);
  g.fillRect(14, 50, 10, 3);
  g.fillRect(1, 76, 7, 3);
  g.fillRect(14, 100, 9, 3);
  g.fillRect(2, 124, 8, 3);
  g.fillRect(13, 140, 6, 3);
  // Forked tip.
  g.fillStyle(0xd8cba6, 1);
  g.fillTriangle(11, 8, 7, 0, 12, 0);
  g.fillTriangle(13, 8, 13, 0, 17, 0);
  g.generateTexture(key, 24, 152);
  g.destroy();
  return key;
}

// Claws the crab — round orange body, two raised claws, stalk eyes.
// Faces right, like the fish; setFlipX(true) turns him around.
export function makeCrabTexture(scene) {
  const key = "crab";
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  // Claws (raised, front-right).
  g.fillStyle(0xe85d3d, 1);
  g.fillCircle(58, 12, 7);
  g.fillCircle(48, 8, 6);
  g.fillStyle(0xfff3b0, 1);
  g.fillCircle(58, 10, 2);
  // Body.
  g.fillStyle(0xf0704a, 1);
  g.fillEllipse(32, 24, 52, 28);
  g.fillStyle(0xff9a7a, 1);
  g.fillEllipse(32, 28, 40, 14);
  // Legs (three little lines each side).
  g.fillStyle(0xe85d3d, 1);
  for (let i = 0; i < 3; i++) {
    g.fillRect(14 + i * 8, 36, 3, 8);
    g.fillRect(42 + i * 8, 36, 3, 8);
  }
  // Stalk eyes.
  g.fillStyle(0xf0704a, 1);
  g.fillRect(44, 4, 3, 10);
  g.fillRect(52, 4, 3, 10);
  g.fillStyle(0x1a1a1a, 1);
  g.fillCircle(46, 4, 2.5);
  g.fillCircle(54, 4, 2.5);
  g.generateTexture(key, 64, 46);
  g.destroy();
  return key;
}

// The feeder-bot — a little silver robot pet. Rounded body, dome head,
// side fins and a tiny propeller on top (all drawn here; the blinking
// light is a separate small sprite so update() can blink it). 48x40,
// faces right.
export function makeFeederBotTexture(scene) {
  const key = "feeder-bot";
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  // Propeller mast + blades (top).
  g.fillStyle(0x8a8f98, 1);
  g.fillRect(22, 2, 4, 6);
  g.fillStyle(0xc0c8d0, 1);
  g.fillEllipse(24, 4, 24, 4);
  // Dome head.
  g.fillStyle(0xdfe9ef, 1);
  g.fillCircle(24, 14, 9);
  g.fillStyle(0x9fb6c3, 1);
  g.fillCircle(24, 14, 6);
  // Rounded body.
  g.fillStyle(0xb9c8d0, 1);
  g.fillEllipse(24, 28, 40, 18);
  g.fillStyle(0x8a9aa5, 1);
  g.fillEllipse(24, 32, 30, 8);
  // Side fins.
  g.fillStyle(0x8a9aa5, 1);
  g.fillTriangle(6, 24, 2, 30, 8, 32);
  g.fillTriangle(42, 24, 46, 30, 40, 32);
  // Eye (front, right side).
  g.fillStyle(0x1a1a1a, 1);
  g.fillCircle(29, 13, 2.5);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(30, 12, 1);
  // Belly panel.
  g.fillStyle(0x5a6b78, 1);
  g.fillRect(18, 26, 12, 6);
  g.generateTexture(key, 48, 40);
  g.destroy();
  return key;
}

// The feeder-bot's blinking light — a small amber dot drawn separately
// so update() can blink it without redrawing the body.
export function makeBotLightTexture(scene) {
  const key = "bot-light";
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0xffd23f, 1);
  g.fillCircle(4, 4, 3);
  g.fillStyle(0xfff3b0, 1);
  g.fillCircle(4, 4, 1.5);
  g.generateTexture(key, 8, 8);
  g.destroy();
  return key;
}

// A breeding egg — small, pale, slightly speckled. It sinks slowly to
// the floor, sits ~20s, then hatches.
export function makeEggTexture(scene) {
  const key = "egg";
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0xfff6e0, 1);
  g.fillEllipse(10, 11, 18, 22);
  g.fillStyle(0xe8d9b0, 1);
  g.fillCircle(7, 8, 1.5);
  g.fillCircle(13, 14, 1.5);
  g.fillCircle(9, 18, 1);
  g.generateTexture(key, 20, 22);
  g.destroy();
  return key;
}

// The RANDOM-EVENT treasure chest — a small wooden chest with a gold
// band and lock, 56x40. Drawn once like the other textures; the event
// chest is a single sprite (not the decor-chest Graphics in tank.js).
export function makeTreasureChestTexture(scene) {
  const key = "chest-event";
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  // Box.
  g.fillStyle(0x7a4a21, 1);
  g.fillRect(8, 18, 40, 18);
  // Domed lid.
  g.fillStyle(0x9a6a35, 1);
  g.fillEllipse(28, 14, 40, 12);
  g.fillRect(8, 12, 40, 8);
  // Gold band + lock.
  g.fillStyle(0xffd23f, 1);
  g.fillRect(24, 8, 8, 28);
  g.fillRect(24, 20, 8, 8);
  g.fillStyle(0x2a1a08, 1);
  g.fillCircle(28, 24, 2);
  // Gold coins peeking out of the lid, so it reads as treasure.
  g.fillStyle(0xffe27a, 1);
  g.fillCircle(14, 10, 3);
  g.fillCircle(42, 9, 3);
  g.generateTexture(key, 56, 40);
  g.destroy();
  return key;
}

// The RANDOM-EVENT glowing jellyfish — a translucent pinkish-purple
// bell with trailing tentacles, 64x84. Drawn once like the other
// textures; the bell pulses (scale) while it swims, and a starburst
// sprite behind it (see makeJellyBurstTexture) pulses in sync.
export function makeJellyfishTexture(scene) {
  const key = "jellyfish";
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  // Soft glow behind the bell, so it reads as glowing, not flat.
  g.fillStyle(0xe8b8ff, 0.35);
  g.fillEllipse(32, 30, 58, 52);
  // Bell — pinkish-purple dome, translucent.
  g.fillStyle(0xd98cff, 0.9);
  g.fillEllipse(32, 30, 48, 40);
  // Brighter bell top + a white highlight spot.
  g.fillStyle(0xf0c8ff, 0.9);
  g.fillEllipse(32, 22, 30, 18);
  g.fillStyle(0xffffff, 0.85);
  g.fillEllipse(24, 18, 8, 5);
  // Frilly oral-arms band under the bell.
  g.fillStyle(0xc98aff, 0.85);
  g.fillRect(14, 46, 36, 6);
  // Tentacles — tapered, trailing below the bell.
  g.fillStyle(0xe8a8ff, 0.8);
  for (let i = 0; i < 5; i++) {
    const tx = 16 + i * 8;
    g.fillTriangle(tx, 52, tx + 6, 52, tx + 3, 78);
  }
  g.generateTexture(key, 64, 84);
  g.destroy();
  return key;
}

// The comic-book starburst behind the jellyfish — straight
// speed-lines bursting outward from the centre, bright yellow and
// white on a transparent background, 260x260. The sprite using it
// pulses (scale + alpha) in sync with the bell, so the whole thing
// throbs and can't be missed or mistaken for a normal fish.
export function makeJellyBurstTexture(scene) {
  const key = "jelly-burst";
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const cx = 130, cy = 130;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const long = i % 2 === 0;
    const r = long ? 128 : 84;
    const w = long ? 0.10 : 0.07; // half-angle of the ray
    g.fillStyle(i % 2 === 0 ? 0xffe27a : 0xffffff, 0.9);
    g.fillTriangle(
      cx + Math.cos(a - w) * 18, cy + Math.sin(a - w) * 18,
      cx + Math.cos(a + w) * 18, cy + Math.sin(a + w) * 18,
      cx + Math.cos(a) * r, cy + Math.sin(a) * r
    );
  }
  g.fillStyle(0xfff3b0, 1);
  g.fillCircle(cx, cy, 20);
  g.generateTexture(key, 260, 260);
  g.destroy();
  return key;
}

// HATS — small cosmetic sprites worn above a fish's head, 24x16 each,
// origin (0.5, 1) at runtime (the bottom centre sits on the head).
// Six random kinds (~20% of fish spawn wearing one) plus the CROWN,
// which is never rolled — crowns mean royal only (see setFishStageVisual).
// All are drawn facing right and mostly symmetric, so flipX mirrors
// them correctly on a left-facing fish, exactly like the body.
export function makeHatTexture(scene, kind) {
  const key = "hat-" + kind;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  if (kind === "party") {
    // Cone party hat, pink with a yellow band and a white pompom.
    g.fillStyle(0xff6b9d, 1);
    g.fillTriangle(12, 1, 4, 16, 20, 16);
    g.fillStyle(0xffd23f, 1);
    g.fillRect(6, 12, 12, 3);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(12, 2, 2.5);
  } else if (kind === "tophat") {
    // Black top hat with a red band and a wide brim.
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(2, 12, 20, 3);
    g.fillRect(7, 2, 10, 11);
    g.fillStyle(0xc0392b, 1);
    g.fillRect(7, 9, 10, 3);
  } else if (kind === "beanie") {
    // Teal beanie dome with a darker brim and a white pompom.
    g.fillStyle(0x2a9d8f, 1);
    g.fillCircle(12, 12, 8);
    g.fillStyle(0x1f7a6e, 1);
    g.fillRect(4, 12, 16, 4);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(12, 3, 2.5);
  } else if (kind === "pirate") {
    // Black tricorn with a tiny white skull on the front.
    g.fillStyle(0x1a1a1a, 1);
    g.fillTriangle(2, 14, 12, 2, 22, 14);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(12, 10, 2.5);
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(11, 10, 0.8);
    g.fillCircle(13, 10, 0.8);
  } else if (kind === "flower") {
    // A daisy: five white petals around a yellow centre.
    g.fillStyle(0xffffff, 1);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      g.fillCircle(12 + Math.cos(a) * 4.5, 8 + Math.sin(a) * 4.5, 3);
    }
    g.fillStyle(0xffd23f, 1);
    g.fillCircle(12, 8, 2.5);
  } else if (kind === "bow") {
    // Pink bow: two triangles and a knot.
    g.fillStyle(0xe85d75, 1);
    g.fillTriangle(2, 6, 2, 14, 11, 10);
    g.fillTriangle(22, 6, 22, 14, 13, 10);
    g.fillStyle(0xc23a54, 1);
    g.fillCircle(12, 10, 2.5);
  } else if (kind === "crown") {
    // Gold crown, three points with red and blue jewels. Royal only.
    g.fillStyle(0xffd23f, 1);
    g.fillPoints([
      { x: 3, y: 15 }, { x: 3, y: 7 }, { x: 7, y: 11 },
      { x: 12, y: 3 }, { x: 17, y: 11 }, { x: 21, y: 7 }, { x: 21, y: 15 },
    ], true);
    g.fillStyle(0xe85d75, 1);
    g.fillCircle(8, 12, 1.5);
    g.fillStyle(0x5a8de8, 1);
    g.fillCircle(16, 12, 1.5);
    g.fillStyle(0xe85d75, 1);
    g.fillCircle(12, 11, 1.5);
  }
  g.generateTexture(key, 24, 16);
  g.destroy();
  return key;
}
