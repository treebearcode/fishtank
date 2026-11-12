// textures.js — procedural art. Each function draws once into a texture
// that sprites then reuse (cheap: one draw, many sprites). No binary
// assets anywhere in the game.
//
// FUTURE SWAP: to use real art (e.g. the Kenney Fish Pack, CC0 — see
// CREDITS.md), drop the PNGs in src/assets/ and replace these makers
// with this.load.image() calls in preload(). The fish code only ever
// refers to the texture keys 'fish-body-<species>-<stage>' and
// 'fish-tail-<species>-<stage>'.
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

export function makeFishBodyTexture(scene, stage, speciesKey) {
  const sp = speciesDef(speciesKey);
  const key = "fish-body-" + sp.key + "-" + stage;
  if (scene.textures.exists(key)) return key;
  const color = sp.colors[stage];
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
  const color = sp.colors[stage];
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
