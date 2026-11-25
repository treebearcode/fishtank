// Coinfish Cove — headless tests (node, Phaser stubbed).
// Run: node tests/headless.test.js   (exit 0 = all green)
// Covers the V3.6 regressions that still apply PLUS all of V4:
// species table, decoration cents, money formatting, breeding chain
// + guards, shop button reuse, Sell bounds, feeder-bot band/pellets.
//
// The V3.6 suite was 64 tests; this file is its successor — the
// decoration-rounding expectations CHANGED by design in V4 (whole
// dollars -> cents), so the old "$1 -> 1/1/1/1" cases are replaced
// by "$1 -> 1/1.05/1.10/1.15" below. Everything else V3.6 is kept.
"use strict";

// ---------------------------------------------------------------------------
// Minimal Phaser stub — just enough for TankScene.create()/update().
// Every stub object is chainable and records the state tests read.
// ---------------------------------------------------------------------------
function makeStubObj() {
  const o = {
    x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, alpha: 1,
    visible: true, flipX: false, texture: null, text: "", color: null,
    originX: 0.5, originY: 0.5,
    destroyed: false, _handlers: {},
  };
  o.setDepth = function () { return o; };
  o.setVisible = function (v) { o.visible = !!v; return o; };
  o.setOrigin = function (x, y) { o.originX = x; o.originY = (y === undefined ? x : y); return o; };
  o.setScale = function (x, y) { o.scaleX = x; o.scaleY = (y === undefined ? x : y); return o; };
  o.setInteractive = function () { return o; };
  o.setFillStyle = function () { return o; };
  o.setStrokeStyle = function () { return o; };
  o.setTint = function (t) { o.tint = t; return o; };
  o.setAlpha = function (a) { o.alpha = a; return o; };
  o.setTexture = function (k) { o.texture = k; return o; };
  o.setFlipX = function (b) { o.flipX = !!b; return o; };
  o.setColor = function (c) { o.color = c; return o; };
  o.setText = function (t) { o.text = String(t); return o; };
  o.setData = function () { return o; };
  o.add = function () { return o; };
  o.destroy = function () { o.destroyed = true; return o; };
  o.on = function (ev, fn) { o._handlers[ev] = fn; return o; };
  return o;
}

function makeGraphicsStub(generated) {
  const g = makeStubObj();
  g.fillStyle = function () { return g; };
  g.fillGradientStyle = function () { return g; };
  g.fillEllipse = function () { return g; };
  g.fillTriangle = function () { return g; };
  g.fillCircle = function () { return g; };
  g.fillRect = function () { return g; };
  g.fillPoints = function () { return g; };
  g.generateTexture = function (key) { generated.push(key); return g; };
  return g;
}

function makeSceneStubs() {
  const generated = [];
  const keyboardHandlers = {};
  const stubs = {
    generated,
    keyboardHandlers,
    time: { now: 0, delayedCall: function () { return { remove: function () {} }; } },
    tweens: { add: function () {} },
    textures: { exists: function () { return false; } },
    make: { graphics: function () { return makeGraphicsStub(generated); } },
    input: {
      on: function () {},
      keyboard: { on: function (ev, fn) { keyboardHandlers[ev] = fn; } },
    },
  };
  const at = function (x, y) { const o = makeStubObj(); o.x = x; o.y = y; return o; };
  stubs.add = {
    graphics: function () { return makeGraphicsStub(generated); },
    image: function (x, y, key) { const o = at(x, y); o.texture = key; return o; },
    text: function (x, y, str) { const o = at(x, y); o.text = String(str); return o; },
    container: function (x, y) { return at(x, y); },
    rectangle: function (x, y) { return at(x, y); },
    circle: function (x, y) { return at(x, y); },
    // DOM elements: record the anchor, node and origin like the real
    // Phaser DOMElement (default origin 0.5, 0.5; setOrigin overrides).
    dom: function (x, y, node) { const o = at(x, y); o.node = node; return o; },
  };
  return stubs;
}

import "./phaser-stub.js"; // sets global.Phaser BEFORE the game modules evaluate
import * as G from "../docs/js/index.js";

// ---------------------------------------------------------------------------
// Tiny test framework.
// ---------------------------------------------------------------------------
let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    failures.push(name + " — " + e.message);
    console.log("FAIL: " + name + " — " + e.message);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || "assert failed"); }
function eq(a, b, msg) {
  if (a !== b) throw new Error((msg || "") + " expected " + JSON.stringify(b) + ", got " + JSON.stringify(a));
}
function approx(a, b, eps, msg) {
  if (Math.abs(a - b) > (eps || 1e-9)) throw new Error((msg || "") + " expected ~" + b + ", got " + a);
}

// Build a live scene with stubbed Phaser, past create(), started.
// create() spawns no fish — the starting fish arrive via startGame()
// (the Start button), so makeScene calls it to keep the contract
// "a running game with its 2 starting guppies".
function makeScene() {
  const stubs = makeSceneStubs();
  const scene = new G.TankScene();
  scene.add = stubs.add;
  scene.input = stubs.input;
  scene.time = stubs.time;
  scene.tweens = stubs.tweens;
  scene.textures = stubs.textures;
  scene.make = stubs.make;
  scene.create();
  scene.startGame();
  scene._stubs = stubs;
  return scene;
}
// Build a scene that is still on the title screen: create() ran, but
// Start was never clicked — no fish, not started.
function makeTitleScene() {
  const stubs = makeSceneStubs();
  const scene = new G.TankScene();
  scene.add = stubs.add;
  scene.input = stubs.input;
  scene.time = stubs.time;
  scene.tweens = stubs.tweens;
  scene.textures = stubs.textures;
  scene.make = stubs.make;
  scene.create();
  scene._stubs = stubs;
  return scene;
}
// Step the game loop `seconds` of sim time in 100ms frames.
function step(scene, seconds, perStep) {
  const dtMs = 100;
  const n = Math.round((seconds * 1000) / dtMs);
  let t = 0;
  for (let i = 0; i < n; i++) {
    t += dtMs;
    scene.time.now = t;
    scene.update(t, dtMs);
    if (perStep) perStep(i * dtMs / 1000);
  }
}
// Keep every fish fed + alive while a long sim runs (resets hunger).
function keepFed(scene) {
  for (const f of scene.fish) { f.hungerSec = 5; f.lastFedSec = 5; }
}
// keepFed + pin eggs to the floor. An egg pops wherever mum was
// swimming, and sinking at 15 px/s can take longer than a test's
// step — which made the hatch assertions flaky (the 20s sit-time
// only starts once the egg lands). Pinning makes them deterministic;
// the sink itself is covered visually, not here.
function keepFedEggsLanded(scene) {
  keepFed(scene);
  for (const egg of scene.eggs) { egg.sinking = false; egg.sprite.y = G.CONFIG.floorY; }
}

// ===========================================================================
// 1. SPECIES TABLE
// ===========================================================================
test("species: guppy is exactly the V3.6 guppy", () => {
  const g = G.SPECIES.guppy;
  eq(g.cost, 100); eq(g.speed, 45); eq(g.coinEverySec, 8);
  eq(JSON.stringify(g.coinValues), JSON.stringify([1, 5, 10]));
  eq(g.feedsToMedium, 3); eq(g.feedsToLarge, 6);
  eq(JSON.stringify(g.sellPrices), JSON.stringify([50, 100, 150]));
  assert(g.hasTail && !g.swimLow, "guppy has tail, swims normally");
});
test("species: emberfin stats", () => {
  const s = G.SPECIES.emberfin;
  eq(s.cost, 250); eq(s.speed, 65); eq(s.coinEverySec, 6);
  eq(JSON.stringify(s.coinValues), JSON.stringify([1, 5, 9]));
  eq(s.feedsToMedium, 3); eq(s.feedsToLarge, 6);
  eq(JSON.stringify(s.sellPrices), JSON.stringify([125, 200, 300]));
});
test("species: chomper stats (slow, grows 4/8, big coins)", () => {
  const s = G.SPECIES.chomper;
  eq(s.cost, 400); eq(s.speed, 30); eq(s.coinEverySec, 8);
  eq(JSON.stringify(s.coinValues), JSON.stringify([3, 10, 20]));
  eq(s.feedsToMedium, 4); eq(s.feedsToLarge, 8);
  eq(JSON.stringify(s.sellPrices), JSON.stringify([200, 350, 500]));
});
test("species: starfish stats (slow, low swimmer, no tail)", () => {
  const s = G.SPECIES.starfish;
  eq(s.cost, 300); eq(s.speed, 25); eq(s.coinEverySec, 12);
  eq(JSON.stringify(s.coinValues), JSON.stringify([2, 6, 12]));
  eq(s.feedsToMedium, 3); eq(s.feedsToLarge, 6);
  eq(JSON.stringify(s.sellPrices), JSON.stringify([150, 250, 350]));
  assert(s.swimLow && !s.hasTail, "starfish swims low and has no tail");
});
test("speciesDef falls back to guppy for unknown keys", () => {
  eq(G.speciesDef("nope").key, "guppy");
  eq(G.speciesDef(undefined).key, "guppy");
});

// ===========================================================================
// 2. GROWTH / COIN VALUES PER SPECIES
// ===========================================================================
test("stageForFeeds: guppy 3/6 (unchanged)", () => {
  eq(G.stageForFeeds(0), 0); eq(G.stageForFeeds(2), 0);
  eq(G.stageForFeeds(3), 1); eq(G.stageForFeeds(5), 1); eq(G.stageForFeeds(6), 2);
});
test("stageForFeeds: chomper grows slower at 4/8", () => {
  eq(G.stageForFeeds(3, "chomper"), 0);
  eq(G.stageForFeeds(4, "chomper"), 1);
  eq(G.stageForFeeds(7, "chomper"), 1);
  eq(G.stageForFeeds(8, "chomper"), 2);
});
test("stageForFeeds: emberfin/starfish grow at 3/6 like guppy", () => {
  eq(G.stageForFeeds(3, "emberfin"), 1); eq(G.stageForFeeds(6, "emberfin"), 2);
  eq(G.stageForFeeds(3, "starfish"), 1); eq(G.stageForFeeds(6, "starfish"), 2);
});
test("coinValueForStage per species", () => {
  eq(G.coinValueForStage(0, "guppy"), 1); eq(G.coinValueForStage(1, "guppy"), 5); eq(G.coinValueForStage(2, "guppy"), 10);
  eq(G.coinValueForStage(2, "emberfin"), 9);
  eq(G.coinValueForStage(0, "chomper"), 3); eq(G.coinValueForStage(1, "chomper"), 10); eq(G.coinValueForStage(2, "chomper"), 20);
  eq(G.coinValueForStage(0, "starfish"), 2); eq(G.coinValueForStage(1, "starfish"), 6); eq(G.coinValueForStage(2, "starfish"), 12);
});
test("sellPriceForStage per species", () => {
  eq(G.sellPriceForStage(0, "guppy"), 50); eq(G.sellPriceForStage(2, "guppy"), 150);
  eq(G.sellPriceForStage(0, "emberfin"), 125); eq(G.sellPriceForStage(1, "emberfin"), 200); eq(G.sellPriceForStage(2, "emberfin"), 300);
  eq(G.sellPriceForStage(0, "chomper"), 200); eq(G.sellPriceForStage(1, "chomper"), 350); eq(G.sellPriceForStage(2, "chomper"), 500);
  eq(G.sellPriceForStage(0, "starfish"), 150); eq(G.sellPriceForStage(1, "starfish"), 250); eq(G.sellPriceForStage(2, "starfish"), 350);
  eq(G.sellPriceForStage(1), 100, "default species is guppy");
});

// ===========================================================================
// 3. DECORATION CENTS (V4 — changed by design from V3.6 whole dollars)
// ===========================================================================
test("coinValueWithBonus: $1 -> 1 / 1.05 / 1.10 / 1.15", () => {
  eq(G.coinValueWithBonus(1, 0), 1);
  eq(G.coinValueWithBonus(1, 1), 1.05);
  eq(G.coinValueWithBonus(1, 2), 1.10);
  eq(G.coinValueWithBonus(1, 3), 1.15);
});
test("coinValueWithBonus: $5 -> 5 / 5.25 / 5.50 / 5.75", () => {
  eq(G.coinValueWithBonus(5, 0), 5);
  eq(G.coinValueWithBonus(5, 1), 5.25);
  eq(G.coinValueWithBonus(5, 2), 5.5);
  eq(G.coinValueWithBonus(5, 3), 5.75);
});
test("coinValueWithBonus: $10 -> 10 / 10.50 / 11.00 / 11.50", () => {
  eq(G.coinValueWithBonus(10, 0), 10);
  eq(G.coinValueWithBonus(10, 1), 10.5);
  eq(G.coinValueWithBonus(10, 2), 11);
  eq(G.coinValueWithBonus(10, 3), 11.5);
});
test("coinValueWithBonus: new species bases in cents", () => {
  eq(G.coinValueWithBonus(9, 1), 9.45); eq(G.coinValueWithBonus(9, 3), 10.35);
  eq(G.coinValueWithBonus(20, 2), 22); eq(G.coinValueWithBonus(20, 3), 23);
  eq(G.coinValueWithBonus(3, 1), 3.15); eq(G.coinValueWithBonus(2, 2), 2.2);
  eq(G.coinValueWithBonus(6, 1), 6.3); eq(G.coinValueWithBonus(12, 3), 13.8);
});
test("coinValueWithBonus is additive, not multiplicative", () => {
  // x1.05^3 would be 1.1576 -> $10 would be $11.58; additive is $11.50.
  eq(G.coinValueWithBonus(10, 3), 11.5);
});
test("moneyFmt: whole dollars print without cents", () => {
  eq(G.moneyFmt(12), "$12"); eq(G.moneyFmt(0), "$0"); eq(G.moneyFmt(100), "$100");
});
test("moneyFmt: cents print with two decimals", () => {
  eq(G.moneyFmt(12.35), "$12.35"); eq(G.moneyFmt(1.05), "$1.05");
  eq(G.moneyFmt(2.1), "$2.10"); eq(G.moneyFmt(11.5), "$11.50");
});
test("addMoney has no float dust", () => {
  eq(G.addMoney(0, 1.05), 1.05);
  eq(G.addMoney(1.05, 1.05), 2.1);
  eq(G.addMoney(10.5, 11.5), 22);
});

// ===========================================================================
// 4. BREEDING PURE HELPERS
// ===========================================================================
function breedFish(over) {
  return Object.assign({
    species: "guppy", stage: 2, lastFedSec: 5, hungerSec: 5,
    pregnant: false, breeding: false, breedCooldownSec: 0, grabbed: false,
  }, over || {});
}
test("BREED timings are 30 / 3 / 15 / 20 / 60", () => {
  eq(G.BREED.fedWithinSec, 30); eq(G.BREED.heartsSec, 3);
  eq(G.BREED.pregnantSec, 15); eq(G.BREED.eggWaitSec, 20);
  eq(G.BREED.breedCooldownSec, 60);
});
test("canBreed: two large recently-fed guppies can pair", () => {
  assert(G.canBreed(breedFish(), breedFish(), 2, 16), "should pair");
});
test("canBreed: different species cannot pair", () => {
  assert(!G.canBreed(breedFish(), breedFish({ species: "emberfin" }), 2, 16));
});
test("canBreed: not large cannot pair", () => {
  assert(!G.canBreed(breedFish({ stage: 1 }), breedFish(), 2, 16));
  assert(!G.canBreed(breedFish(), breedFish({ stage: 0 }), 2, 16));
});
test("canBreed: not recently fed cannot pair (lastFedSec > 30)", () => {
  assert(!G.canBreed(breedFish({ lastFedSec: 31 }), breedFish(), 2, 16));
  assert(G.canBreed(breedFish({ lastFedSec: 30 }), breedFish(), 2, 16), "30s is still recent");
});
test("canBreed: hungry fish cannot pair", () => {
  assert(!G.canBreed(breedFish({ hungerSec: 25, lastFedSec: 25 }), breedFish(), 2, 16));
});
test("canBreed: pregnant / breeding / cooldown / grabbed block pairing", () => {
  assert(!G.canBreed(breedFish({ pregnant: true }), breedFish(), 2, 16));
  assert(!G.canBreed(breedFish({ breeding: true }), breedFish(), 2, 16));
  assert(!G.canBreed(breedFish({ breedCooldownSec: 60 }), breedFish(), 2, 16));
  assert(!G.canBreed(breedFish({ breedCooldownSec: 0.5 }), breedFish(), 2, 16));
  assert(!G.canBreed(breedFish(), breedFish({ grabbed: true }), 2, 16));
});
test("canBreed: no pairing at the fish cap", () => {
  assert(!G.canBreed(breedFish(), breedFish(), 16, 16));
  assert(G.canBreed(breedFish(), breedFish(), 15, 16), "one slot free is enough");
});
test("canBreed: a fish cannot pair with itself", () => {
  const f = breedFish();
  assert(!G.canBreed(f, f, 2, 16));
});
test("findBreedPair finds the first pair, null when none", () => {
  const fish = [breedFish({ stage: 0 }), breedFish(), breedFish(), breedFish({ species: "emberfin" })];
  const pair = G.findBreedPair(fish, 16);
  assert(pair && pair[0] === fish[1] && pair[1] === fish[2], "first large same-species pair");
  assert(G.findBreedPair([breedFish({ stage: 0 })], 16) === null);
  assert(G.findBreedPair([breedFish(), breedFish({ species: "emberfin" })], 16) === null);
});
test("pickPregnantParent: better-fed (lower hungerSec) becomes pregnant", () => {
  const a = breedFish({ hungerSec: 4 }), b = breedFish({ hungerSec: 12 });
  eq(G.pickPregnantParent(a, b), a);
  eq(G.pickPregnantParent(b, a), a, "order does not matter");
  eq(G.pickPregnantParent(a, breedFish({ hungerSec: 4 })), a, "tie goes to first");
});
test("eggCanHatch: room yes, full no", () => {
  assert(G.eggCanHatch(15, 16)); assert(!G.eggCanHatch(16, 16));
});
test("robotHitAt: inside/outside the 30x22 box", () => {
  assert(G.robotHitAt(480, 180, 480, 180));
  assert(G.robotHitAt(480, 180, 505, 195));
  assert(!G.robotHitAt(480, 180, 520, 180));
  assert(!G.robotHitAt(480, 180, 480, 210));
});
test("ROBOT_BAND never goes deeper than y=300", () => {
  eq(G.ROBOT_BAND.maxY, 300); eq(G.ROBOT_BAND.minY, 110);
  eq(G.CONFIG.floorY, 428, "floor is well below the band");
});
test("SELL_BOUNDS matches the new Sell position (row 2, col 5)", () => {
  const cx = G.SHOP_COL_X(5);
  eq(G.SHOP.cols, 9);
  eq(G.SELL_BOUNDS.x0, Math.round(cx - G.SHOP.btnW / 2));
  eq(G.SELL_BOUNDS.x1, Math.round(cx + G.SHOP.btnW / 2));
  eq(G.SELL_BOUNDS.y0, G.SHOP.row2Y - G.SHOP.btnH / 2);
  eq(G.SELL_BOUNDS.y1, G.SHOP.row2Y + G.SHOP.btnH / 2);
  assert(G.isOverSell(587, 514), "Sell centre is inside");
  assert(!G.isOverSell(820, 520), "old V3.6 Sell position is outside now");
  assert(!G.isOverSell(906, 514), "old V4 Sell position (row 2, col 8) is outside now");
  assert(!G.isOverSell(587, 480), "row 1 is outside");
});

// ===========================================================================
// 5. V3.6 REGRESSIONS (pure helpers — unchanged behaviour)
// ===========================================================================
test("V3.6: tailJointFor is symmetric ±14 * baseScale", () => {
  eq(G.tailJointFor(false, 1), -14); eq(G.tailJointFor(true, 1), 14);
  eq(G.tailJointFor(false, 1.25), -17.5); approx(G.tailJointFor(true, 1.12), 15.68);
});
test("V3.6: BODY_ELLIPSE is centred (32,20) radii (20,13)", () => {
  eq(G.BODY_ELLIPSE.cx, 32); eq(G.BODY_ELLIPSE.cy, 20);
  eq(G.BODY_ELLIPSE.rx, 20); eq(G.BODY_ELLIPSE.ry, 13);
});
test("V3.6: TAIL_TRIANGLE is narrow at the body, wide at the fan", () => {
  eq(G.TAIL_TRIANGLE.point.x, 22); eq(G.TAIL_TRIANGLE.wideTop.x, 2);
  eq(G.TAIL_TRIANGLE.wideBottom.x, 2);
  assert(G.TAIL_TRIANGLE.wideTop.y < G.TAIL_TRIANGLE.point.y, "fan spans above/below the point");
});
test("V3.6: tailRotationFor rotates, never flips", () => {
  approx(G.tailRotationFor(0.1, 0.2, false), 0.3);
  approx(G.tailRotationFor(0.1, 0.2, true), 0.1 + Math.PI - 0.2);
});
test("V3.6: resolvePointerTarget priority is coin > fish > water", () => {
  const coins = [{ x: 100, y: 100 }];
  const fish = [{ x: 100, y: 100 }];
  eq(G.resolvePointerTarget(100, 100, coins, fish).type, "coin");
  eq(G.resolvePointerTarget(100, 100, [], fish).type, "fish");
  eq(G.resolvePointerTarget(500, 300, [], []).type, "water");
  eq(G.resolvePointerTarget(100, 100, coins, fish).index, 0);
});
test("V3.6: isPoke / isGrab thresholds", () => {
  assert(G.isPoke(5, 100)); assert(!G.isPoke(8, 100)); assert(!G.isPoke(5, 250));
  assert(G.isGrab(8)); assert(!G.isGrab(7));
});
test("V3.6: hunger / death thresholds unchanged", () => {
  assert(!G.isHungry(19)); assert(G.isHungry(20));
  assert(!G.isDead(49)); assert(G.isDead(50));
});
test("V3.6: goal needs $1000 banked AND 3 large fish", () => {
  assert(G.goalIsMet(1000, 3)); assert(!G.goalIsMet(999, 3)); assert(!G.goalIsMet(1000, 2));
});
test("V3.6: snail targets by time-to-collect, overshoot only while sinking", () => {
  const landed = { x: 200, y: 428, vy: 26 };
  const falling = { x: 120, y: 50, vy: 26 };
  eq(G.snailTargetCoin([falling, landed], 120, 428, 60), 1, "landed coin wins over a far-future faller");
  eq(G.snailAimX({ x: 200, y: 100 }, 120, 428, 20), 220, "aims past a sinking coin");
  eq(G.snailAimX({ x: 200, y: 428 }, 120, 428, 20), 200, "aims exactly at a landed coin");
  assert(G.snailCanCollect({ x: 130, y: 428 }, 120, 428));
  assert(!G.snailCanCollect({ x: 130, y: 300 }, 120, 428));
});
test("V3.6: nearestPelletEater picks closest eligible fish within 18px", () => {
  const cands = [
    { x: 0, y: 0, eatCooldownSec: 0, grabbed: false },
    { x: 10, y: 0, eatCooldownSec: 0.5, grabbed: false },
    { x: 5, y: 0, eatCooldownSec: 0, grabbed: true },
  ];
  eq(G.nearestPelletEater(1, 0, cands), 0);
  eq(G.nearestPelletEater(100, 100, cands), -1, "nobody in range");
});
test("V3.6: postMealDriftTarget stays inside the water", () => {
  const t = G.postMealDriftTarget(480, 200, 480, 200, 60);
  assert(t.x >= 30 && t.x <= 930 && t.y >= 48 && t.y <= 426, "clamped into water");
});
test("V3.6: decorCount counts owned decorations", () => {
  eq(G.decorCount({ coral: true, chest: false, castle: true }), 2);
  eq(G.decorCount({ coral: false, chest: false, castle: false }), 0);
});
test("V3.6: tailWiggle / fishTiltFor math", () => {
  approx(G.tailWiggle(Math.PI / 2, 0.35), 0.35);
  approx(G.fishTiltFor(0, 100), 0);
  assert(Math.abs(G.fishTiltFor(100, 100)) <= 0.09, "tilt capped at ±0.09");
});

// ===========================================================================
// 6. SCENE: CREATE + SPECIES
// ===========================================================================
test("scene: create() starts with no fish (title screen)", () => {
  const s = makeTitleScene();
  eq(s.started, false, "not started before Start is clicked");
  eq(s.fish.length, 0, "no fish on the title screen");
});
test("scene: startGame() spawns the 2 starting guppies", () => {
  const s = makeTitleScene();
  s.startGame();
  eq(s.started, true, "started after Start");
  eq(s.fish.length, 2);
  assert(s.fish.every((f) => f.species === "guppy"), "start fish are guppies");
});
test("scene: textures exist per species/stage/pattern; starfish has no tail texture", () => {
  const s = makeScene();
  const gen = s._stubs.generated;
  for (const key of ["guppy", "emberfin", "chomper", "starfish"]) {
    for (let st = 0; st < 4; st++) {
      for (const pat of ["plain", "stripes", "spots", "gradient"]) {
        assert(gen.includes("fish-body-" + key + "-" + st + "-" + pat), "missing body " + key + "-" + st + "-" + pat);
      }
    }
  }
  assert(gen.includes("fish-tail-emberfin-1"), "emberfin tail exists");
  assert(gen.includes("fish-tail-chomper-2"), "chomper tail exists");
  assert(gen.includes("fish-tail-guppy-3"), "stage-3 (royal) tail exists");
  assert(!gen.some((k) => k.indexOf("fish-tail-starfish") === 0), "starfish must have NO tail texture");
  assert(gen.includes("feeder-bot") && gen.includes("bot-light") && gen.includes("egg"), "bot + egg textures");
  for (const kind of ["party", "tophat", "beanie", "pirate", "flower", "bow", "crown"]) {
    assert(gen.includes("hat-" + kind), "missing hat texture " + kind);
  }
});
test("scene: spawnFish species fields (speed, tail, texture)", () => {
  const s = makeScene();
  const e = s.spawnFish(400, 200, "emberfin");
  eq(e.species, "emberfin"); eq(e.speed, 65);
  assert(e.tail !== null, "emberfin has a tail");
  assert(e.sprite.texture === "fish-body-emberfin-0-" + e.pattern, "emberfin body texture carries its pattern, got " + e.sprite.texture);
  const c = s.spawnFish(400, 300, "chomper");
  eq(c.speed, 30);
  const st = s.spawnFish(400, 350, "starfish");
  eq(st.species, "starfish"); eq(st.speed, 25);
  eq(st.tail, null, "starfish has no tail");
  assert(st.sprite.texture === "fish-body-starfish-0-" + st.pattern, "starfish body texture carries its pattern, got " + st.sprite.texture);
});
test("scene: starfish animates without a tail (no throw, body still bobs/tilts)", () => {
  const s = makeScene();
  const st = s.spawnFish(400, 350, "starfish");
  s.animateFish(st, 0.016);
  // V4.1: a baby starfish renders at 0.6 * 0.95 = 0.57, not 1x.
  approx(st.sprite.scaleX, G.fishScale(0, "starfish"), 1e-9, "baby starfish scale");
  approx(st.sprite.scaleY, G.fishScale(0, "starfish"), 1e-9, "baby starfish scale");
  st.pregnant = true;
  s.animateFish(st, 0.016);
  approx(st.sprite.scaleY, st.baseScale * 1.15, 1e-9, "pregnant starfish belly is 1.15x on Y");
});
test("scene: V3.6 tail joint still symmetric in animateFish", () => {
  const s = makeScene();
  const f = s.fish[0];
  // V4.1: the joint is ±14 * baseScale, and a baby guppy's
  // baseScale is now 0.6 (not 1), so the joint is ±8.4px.
  const j = G.tailJointFor(false, f.baseScale);
  f.sprite.setFlipX(false);
  s.animateFish(f, 0.016);
  approx(f.tail.x, f.sprite.x + j, 0.01, "facing right: tail joint 14*baseScale left of centre");
  f.sprite.setFlipX(true);
  s.animateFish(f, 0.016);
  approx(f.tail.x, f.sprite.x + G.tailJointFor(true, f.baseScale), 0.01, "facing left: tail joint 14*baseScale right of centre");
  eq(f.tail.flipX, false, "tail is never flipped (rot180, V3.5)");
});
test("scene: buyFish deducts cost, respects cap and wallet", () => {
  const s = makeScene();
  s.money = 1000;
  const before = s.fish.length;
  s.buyFish("emberfin");
  eq(s.money, 750); eq(s.fish.length, before + 1);
  eq(s.fish[s.fish.length - 1].species, "emberfin");
  s.money = 100;
  s.buyFish("chomper");
  eq(s.money, 100, "cannot afford chomper at $100");
  eq(s.fish.length, before + 1);
  // Fill to cap: no more sales.
  while (s.fish.length < s.maxFishCap()) s.spawnFish(100, 100, "guppy");
  s.money = 5000;
  const n = s.fish.length;
  s.buyFish("guppy");
  eq(s.fish.length, n, "cap blocks buying");
});
test("scene: starfish spawns low in the tank", () => {
  const s = makeScene();
  s.money = 1000;
  s.buyFish("starfish");
  const st = s.fish[s.fish.length - 1];
  assert(st.sprite.y >= 300, "starfish spawn y >= 300, got " + st.sprite.y);
});
test("scene: starfish wanders in the bottom third", () => {
  const s = makeScene();
  const st = s.spawnFish(400, 350, "starfish");
  let low = 0, picks = 0;
  for (let i = 0; i < 40; i++) {
    st.wanderTimer = 0;
    step(s, 0.2);
    if (st.targetY >= 300) low++;
    picks++;
    // Keep it alive/fed so wandering is the only thing measured.
    st.hungerSec = 5; st.lastFedSec = 5;
  }
  assert(low === picks, "every starfish wander target is >= 300 (got " + low + "/" + picks + ")");
});
test("scene: fish never wander into the fish-free top zone", () => {
  const s = makeScene();
  const f = s.spawnFish(480, 200, "guppy");
  let minTarget = Infinity, minY = Infinity;
  for (let i = 0; i < 40; i++) {
    f.wanderTimer = 0;
    step(s, 0.2, () => keepFed(s));
    minTarget = Math.min(minTarget, f.targetY);
    minY = Math.min(minY, f.sprite.y);
  }
  assert(minTarget >= G.CONFIG.fishMinY, "every wander target is >= fishMinY (min " + minTarget + ")");
  assert(minY >= G.CONFIG.fishMinY, "fish never swam above fishMinY (min y " + minY + ")");
});
test("scene: a live fish above the top zone is clamped back down", () => {
  const s = makeScene();
  const f = s.spawnFish(480, 200, "guppy");
  // Above the zone — e.g. released from a grab up there.
  f.sprite.y = 50; f.targetY = 50; f.wanderTimer = 100;
  step(s, 0.1, () => keepFed(s));
  // The clamp puts the LOGICAL position at fishMinY, but animateFish
  // adds the ±2px head bob after it — so allow the bob, not the zone.
  assert(f.sprite.y >= G.CONFIG.fishMinY - 2, "clamped to y>=fishMinY (bob aside), got " + f.sprite.y);
  assert(f.sprite.y < 100 + 2, "not shoved far down either, got " + f.sprite.y);
});
test("scene: pellets sink at 40 px/s", () => {
  const s = makeScene();
  s.dropPelletAt(480, 100, 1, false);
  const p = s.pellets[s.pellets.length - 1];
  eq(p.vy, G.CONFIG.pelletSinkPxS, "pellet sink speed is the config value");
  eq(p.vy, 40, "pellets sink at 40 px/s");
  for (const f of s.fish) f.eatCooldownSec = 999; // nobody eats it mid-test
  step(s, 1, () => keepFed(s));
  approx(p.sprite.y, 100 + 40, 1, "sank ~40px in 1s, got " + p.sprite.y);
});
test("scene: chomper grows at 4/8 feeds, guppy at 3/6", () => {
  const s = makeScene();
  const c = s.spawnFish(400, 200, "chomper");
  const g = s.spawnFish(500, 200, "guppy");
  const pellet = { sprite: { x: 0, y: 0, destroy: function () {} }, feeds: 1 };
  for (let i = 0; i < 3; i++) { s.feedFish(c, pellet); s.feedFish(g, pellet); }
  eq(c.stage, 0, "chomper still small at 3 feeds");
  eq(g.stage, 1, "guppy medium at 3 feeds");
  s.feedFish(c, pellet);
  eq(c.stage, 1, "chomper medium at 4 feeds");
});

// ===========================================================================
// 7. SCENE: DECORATION CENTS + MONEY DISPLAY
// ===========================================================================
test("scene: decoration toast states multiplier AND a concrete example", () => {
  const s = makeScene();
  s.money = 1000;
  s.buyDecoration("coral", G.CONFIG.coralCost);
  assert(s.toastText.text.indexOf("+5%") >= 0, "toast has +5%: " + s.toastText.text);
  assert(s.toastText.text.indexOf("$10.50") >= 0, "toast shows large guppy coin $10.50: " + s.toastText.text);
  s.buyDecoration("chest", G.CONFIG.chestCost);
  assert(s.toastText.text.indexOf("+10%") >= 0, "toast has +10%");
  assert(s.toastText.text.indexOf("$11.00") >= 0, "toast shows $11.00 at +10%");
});
test("scene: dropCoin pays cents with decorations", () => {
  const s = makeScene();
  const f = s.fish[0];
  s.decorations.coral = true;
  s.dropCoin(f);
  eq(s.coins[s.coins.length - 1].value, 1.05, "small guppy coin with 1 decoration is $1.05");
  s.decorations.chest = true; s.decorations.castle = true;
  f.stage = 2;
  s.dropCoin(f);
  eq(s.coins[s.coins.length - 1].value, 11.5, "large guppy coin with 3 decorations is $11.50");
});
test("scene: collectCoin adds cents exactly; HUD shows cents", () => {
  const s = makeScene();
  s.money = 200;
  s.decorations.coral = true;
  const f = s.fish[0];
  s.dropCoin(f); // $1.05
  const coin = s.coins[s.coins.length - 1];
  s.collectCoin(coin);
  eq(s.money, 201.05);
  eq(s.moneyText.text, "$201.05", "HUD shows cents");
  s.money = 212;
  s.updateTopUI();
  eq(s.moneyText.text, "$212", "HUD shows whole dollars without cents");
});
test("scene: sellFish pays species prices", () => {
  const s = makeScene();
  s.money = 0;
  const ch = s.spawnFish(400, 200, "chomper");
  ch.stage = 2; s.setFishStageVisual(ch);
  s.sellFish(ch);
  eq(s.money, 500, "large chomper sells for $500");
  const em = s.spawnFish(400, 200, "emberfin");
  em.stage = 0;
  s.sellFish(em);
  eq(s.money, 625, "small emberfin sells for $125");
  const st = s.spawnFish(400, 200, "starfish");
  st.stage = 1; s.setFishStageVisual(st);
  s.sellFish(st);
  eq(s.money, 875, "medium starfish sells for $250");
});
test("scene: drag-to-sell uses the NEW Sell bounds", () => {
  const s = makeScene();
  s.money = 0;
  const f = s.spawnFish(480, 200, "guppy");
  f.stage = 1;
  s.dragFish = f;
  s.dragStartX = 480; s.dragStartY = 200;
  s.dragStartTime = 0; s.time.now = 5000;
  s.onPointerUp({ x: 587, y: 514 });
  eq(s.money, 100, "medium guppy sold at new Sell position");
  assert(!s.fish.includes(f), "fish removed");
  // Old V3.6 Sell position (820, 520) no longer sells.
  const f2 = s.spawnFish(480, 200, "guppy");
  s.dragFish = f2;
  s.dragStartX = 480; s.dragStartY = 200;
  s.dragStartTime = 0; s.time.now = 5000;
  s.onPointerUp({ x: 820, y: 520 });
  assert(s.fish.includes(f2), "old Sell position does not sell");
  eq(s.money, 100, "no money from the old position");
  // Old V4 Sell position (906, 514) no longer sells either.
  const f3 = s.spawnFish(480, 200, "guppy");
  s.dragFish = f3;
  s.dragStartX = 480; s.dragStartY = 200;
  s.dragStartTime = 0; s.time.now = 5000;
  s.onPointerUp({ x: 906, y: 514 });
  assert(s.fish.includes(f3), "old V4 Sell position does not sell");
  eq(s.money, 100, "no money from the old V4 position");
});

// ===========================================================================
// 8. SCENE: SHOP BUTTON REUSE + TOOLTIPS
// ===========================================================================
test("scene: Turbo button becomes the speed upgrade, then MAX", () => {
  const s = makeScene();
  s.money = 1000;
  eq(s.snailBtn.text.text, "Turbo");
  s.buyTurboOrSpeed();
  assert(s.snail !== null, "Turbo bought");
  s.updateShopUI();
  eq(s.snailBtn.text.text, "Turbo Spd", "same button is now the speed upgrade");
  s.buyTurboOrSpeed();
  assert(s.snailUpgraded, "speed upgrade bought via the merged button");
  s.updateShopUI();
  eq(s.snailBtn.text.text, "Turbo ✓ MAX");
  assert(s.snailSpeedBtn === undefined, "separate speed button is gone");
});
test("scene: feeder button becomes ON/OFF toggle; tank/decor/magnet show state", () => {
  const s = makeScene();
  s.money = 2000;
  s.buyOrToggleFeeder();
  s.updateShopUI();
  eq(s.feederBtn.text.text, "Feeder: ON");
  s.buyOrToggleFeeder();
  s.updateShopUI();
  eq(s.feederBtn.text.text, "Feeder: OFF");
  s.buyTankUpgrade();
  s.updateShopUI();
  eq(s.tankBtn.text.text, "Tank ✓");
  // V4.1 PHASE 2: decorations are bought in the panel now — the
  // shared Decor button shows ✓ only once all three are owned.
  s.buyDecoration("coral", G.CONFIG.coralCost);
  s.updateShopUI();
  eq(s.decorBtn.text.text, "Decor", "one of three owned: still just Decor");
  s.buyDecoration("chest", G.CONFIG.chestCost);
  s.buyDecoration("castle", G.CONFIG.castleCost);
  s.updateShopUI();
  eq(s.decorBtn.text.text, "Decor ✓", "all three owned: Decor ✓");
  // V4.1 PHASE 2: the magnet is a drag chain now — one buy is L1
  // (Drag 60, $400); the next level is $600.
  s.buyMagnet();
  s.updateShopUI();
  eq(s.magnetLevel, 1, "one buyMagnet is level 1");
  eq(s.magnetBtn.text.text, "Magnet L1 · $600", "label shows level and next cost");
  s.buyCrab();
  s.updateShopUI();
  eq(s.crabBtn.text.text, "Claws ✓");
});
test("scene: every shop button has an icon and a tooltip function", () => {
  const s = makeScene();
  const btns = [s.guppyBtn, s.emberfinBtn, s.chomperBtn, s.starfishBtn, s.snailBtn,
    s.crabBtn, s.feederBtn, s.magnetBtn, s.foodBtn, s.uncapBtn, s.decorBtn,
    s.tankBtn, s.pauseBtn, s.sellBtn];
  eq(btns.length, 14, "14 shop buttons: 8 row 1 (magnet wide) + 6 row 2");
  for (const b of btns) {
    assert(b.icon && b.icon.text && b.icon.text.length > 0, "button missing icon");
    assert(typeof b.tipFn === "function" && b.tipFn().length > 10, "button missing tooltip text");
  }
  assert(s.guppyBtn.tipFn().indexOf("$100") >= 0, "guppy tooltip has the price");
  assert(s.coralBtn === undefined && s.chestBtn === undefined && s.castleBtn === undefined,
    "separate Coral / Treasure / Castle buttons are gone");
});
test("scene: description bar is fixed, shows hover text, resets on pointerout / pause", () => {
  const s = makeScene();
  // The bar is always visible, at its fixed y, showing the default hint.
  assert(s.descBar.visible, "description bar is always visible");
  eq(s.descBar.y, G.DESC_BAR.y, "bar sits at its fixed y");
  eq(s.descBarText.text, G.DESC_DEFAULT_TEXT, "default hint at rest");
  assert(s.descBar.y + G.DESC_BAR.h / 2 < G.SHOP.row1Y - G.SHOP.btnH / 2,
    "bar bottom (" + (s.descBar.y + G.DESC_BAR.h / 2) + ") clears the top of the row-1 buttons (" + (G.SHOP.row1Y - G.SHOP.btnH / 2) + ")");
  // Hover a button: the bar shows that button's description, and
  // the bar itself does NOT move.
  s.guppyBtn.bg._handlers["pointerover"]();
  eq(s.descBar.y, G.DESC_BAR.y, "bar never moves on hover");
  assert(s.descBarText.text.indexOf("$100") >= 0, "bar shows the guppy description");
  s.sellBtn.bg._handlers["pointerover"]();
  assert(s.descBarText.text.indexOf("Sell") >= 0, "bar shows the Sell description");
  // Pointerout restores the default hint (the bar stays visible).
  s.sellBtn.bg._handlers["pointerout"]();
  eq(s.descBarText.text, G.DESC_DEFAULT_TEXT, "bar resets on pointerout");
  assert(s.descBar.visible, "bar stays visible on pointerout");
  // Pause resets the text too — and never hides the bar.
  s.guppyBtn.bg._handlers["pointerover"]();
  assert(s.descBarText.text.indexOf("$100") >= 0, "bar shows guppy text again");
  s._stubs.keyboardHandlers["keydown-P"]();
  assert(s.paused, "P paused the game");
  eq(s.descBarText.text, G.DESC_DEFAULT_TEXT, "bar resets on pause");
  assert(s.descBar.visible, "bar stays visible while paused");
});
test("scene: pause menu speed selector sets 1x/2x/3x/4x (the old 2x shop toggle is gone)", () => {
  const s = makeScene();
  eq(s.speedMult, 1);
  assert(typeof s.toggleSpeed !== "function", "toggleSpeed is gone — the pause menu is the only speed control");
  assert(s.speedBtn === undefined, "no 2x toggle button in the shop bar");
  assert(s.pauseBtn !== undefined, "Pause button takes its place in row 2");
  for (const m of [2, 3, 4, 1]) {
    s.setSpeed(m);
    eq(s.speedMult, m, "setSpeed(" + m + ")");
  }
  s.setSpeed(99);
  eq(s.speedMult, 1, "an invalid speed is ignored");
});

// ===========================================================================
// PAUSE MENU SETTINGS: P (or the Pause button) opens an overlay with a
// Volume slider (0-100%, master volume for all sfx) and a 1x/2x/3x/4x
// speed selector. The menu is the single source of truth for speed.
// ===========================================================================
test("pause: P opens the menu, P again (or Resume) closes it", () => {
  const s = makeScene();
  assert(s.pauseMenu !== undefined, "menu built at create()");
  eq(s.pauseMenu.visible, false, "menu hidden while playing");
  s._stubs.keyboardHandlers["keydown-P"]();
  eq(s.paused, true, "P pauses");
  eq(s.pauseMenu.visible, true, "menu shown while paused");
  s._stubs.keyboardHandlers["keydown-P"]();
  eq(s.paused, false, "P again unpauses");
  eq(s.pauseMenu.visible, false, "menu hidden again");
  // The Pause button opens it too, and Resume closes it.
  s.pauseBtn.bg._handlers["pointerdown"]();
  eq(s.paused, true, "Pause button pauses");
  eq(s.pauseMenu.visible, true, "menu shown");
  s.pauseMenu.resumeRect._handlers["pointerdown"]();
  eq(s.paused, false, "Resume unpauses");
  eq(s.pauseMenu.visible, false, "menu hidden");
});

test("pause: P does nothing before Start or while the goal popup is open", () => {
  const t = makeTitleScene();
  t._stubs.keyboardHandlers["keydown-P"]();
  eq(t.paused, false, "no pause on the title screen");
  const s = makeScene();
  s.showGoalPopup();
  s._stubs.keyboardHandlers["keydown-P"]();
  eq(s.paused, true, "goal popup pauses (its own state)");
  eq(s.pauseMenu.visible, false, "P does not open the menu over the goal popup");
});

test("pause: volume slider changes the master volume (0-100%, clamped)", () => {
  const s = makeScene();
  G.sfx.setVolume(1); // clean state — the volume lives in the sound module
  s._stubs.keyboardHandlers["keydown-P"]();
  s.setVolume(0.5);
  eq(G.sfx.getVolume(), 0.5, "master volume 50%");
  eq(s.pauseMenu.volText.text, "50%", "readout shows 50%");
  eq(s.pauseMenu.handle.x, 0, "handle centred at 50%");
  s.setVolume(0);
  eq(G.sfx.getVolume(), 0, "0% is silent");
  eq(s.pauseMenu.volText.text, "0%", "readout shows 0%");
  s.setVolume(1);
  eq(G.sfx.getVolume(), 1, "100% is full volume");
  eq(s.pauseMenu.volText.text, "100%", "readout shows 100%");
  s.setVolume(2);
  eq(G.sfx.getVolume(), 1, "above 100% clamps to 1");
  s.setVolume(-1);
  eq(G.sfx.getVolume(), 0, "below 0% clamps to 0");
  G.sfx.setVolume(1); // leave the module clean for the other tests
});

test("pause: clicking the volume track sets the volume from the position", () => {
  const s = makeScene();
  s._stubs.keyboardHandlers["keydown-P"]();
  s.pauseMenu.track._handlers["pointerdown"]({ x: 480 }); // centre of the 330-630 track
  eq(G.sfx.getVolume(), 0.5, "centre click = 50%");
  s.pauseMenu.track._handlers["pointerdown"]({ x: 330 }); // left end
  eq(G.sfx.getVolume(), 0, "left end = 0%");
  s.pauseMenu.track._handlers["pointerdown"]({ x: 630 }); // right end
  eq(G.sfx.getVolume(), 1, "right end = 100%");
  G.sfx.setVolume(1);
});

test("pause: speed buttons in the menu set the speed", () => {
  const s = makeScene();
  s._stubs.keyboardHandlers["keydown-P"]();
  s.pauseMenu.speedBtns[3].rect._handlers["pointerdown"]();
  eq(s.speedMult, 3, "3x button sets 3x");
  s.pauseMenu.speedBtns[4].rect._handlers["pointerdown"]();
  eq(s.speedMult, 4, "4x button sets 4x");
  s.pauseMenu.speedBtns[1].rect._handlers["pointerdown"]();
  eq(s.speedMult, 1, "1x button back to normal");
  eq(s.paused, true, "picking a speed does not unpause");
});

test("pause: 4x speed actually runs the game 4x faster (hunger ticks)", () => {
  const s = makeScene();
  s.setSpeed(4);
  const f = s.fish[0];
  f.hungerSec = 0;
  step(s, 1); // 1 real second, no pellets dropped
  approx(f.hungerSec, 4, 1e-9, "hunger advanced 4s in 1s at 4x, got " + f.hungerSec);
  const s2 = makeScene();
  s2.setSpeed(3);
  const f2 = s2.fish[0];
  f2.hungerSec = 0;
  step(s2, 1);
  approx(f2.hungerSec, 3, 1e-9, "hunger advanced 3s in 1s at 3x, got " + f2.hungerSec);
});

// ===========================================================================
// 9. SCENE: FEEDER-BOT
// ===========================================================================
function buyBot(scene, money) {
  scene.money = money === undefined ? 1000 : money;
  scene.buyOrToggleFeeder();
  return scene.feederBot;
}
test("scene: buying the feeder spawns the robot in its band", () => {
  const s = makeScene();
  assert(s.feederBot === null, "no robot before purchase");
  buyBot(s);
  assert(s.feederBot !== null, "robot exists after purchase");
  assert(s.feederBot.sprite.y >= G.ROBOT_BAND.minY && s.feederBot.sprite.y <= G.ROBOT_BAND.maxY, "robot starts in band");
  eq(s.money, 600, "$400 deducted");
});
test("scene: robot never swims deeper than y=300 over a long sim", () => {
  const s = makeScene();
  buyBot(s);
  let maxY = -Infinity, minY = Infinity;
  step(s, 120, (t) => {
    const y = s.feederBot.sprite.y;
    if (y > maxY) maxY = y;
    if (y < minY) minY = y;
    keepFed(s);
  });
  assert(maxY <= 300, "robot max y was " + maxY);
  assert(minY >= 80, "robot min y was " + minY);
});
test("scene: robot drops a $2 pellet AT its own position every 15s", () => {
  const s = makeScene();
  buyBot(s, 1000);
  s.feederTimer = 14.9;
  const moneyBefore = s.money;
  const rx = s.feederBot.sprite.x, ry = s.feederBot.sprite.y;
  step(s, 0.5);
  eq(s.pellets.length, 1, "one pellet dropped");
  eq(s.money, moneyBefore - 2, "pellet costs $2");
  const p = s.pellets[0];
  approx(p.sprite.x, rx, 60, "pellet spawns near the robot's x");
  assert(p.sprite.y >= G.ROBOT_BAND.minY && p.sprite.y <= G.ROBOT_BAND.maxY,
    "pellet spawns inside the band, got y=" + p.sprite.y);
});
test("scene: robot pauses silently when broke or fishless", () => {
  const s = makeScene();
  buyBot(s, 1000);
  // Broke: $1 left, not enough for the $2 pellet.
  s.money = 1;
  s.feederTimer = 14.9;
  step(s, 0.5);
  eq(s.pellets.length, 0, "no pellet when broke");
  eq(s.money, 1, "money untouched when broke");
  // Fishless: plenty of money, no fish.
  s.money = 1000;
  for (const f of [...s.fish]) { f.sprite.destroy(); if (f.tail) f.tail.destroy(); }
  s.fish = [];
  s.feederTimer = 14.9;
  step(s, 0.5);
  eq(s.pellets.length, 0, "no pellet when fishless");
});
test("scene: robot stops when OFF, and keeps 2x-speed timing", () => {
  const s = makeScene();
  buyBot(s, 1000);
  s.buyOrToggleFeeder(); // OFF
  s.feederTimer = 14.9;
  step(s, 1);
  eq(s.pellets.length, 0, "no pellet while OFF");
  s.buyOrToggleFeeder(); // ON again
  s.speedMult = 2;
  s.feederTimer = 14;
  step(s, 0.6); // 0.6s real = 1.2s game time at 2x -> past 15s
  eq(s.pellets.length, 1, "2x speed still scales the feeder interval");
});
test("scene: clicking the robot toasts instead of dropping food", () => {
  const s = makeScene();
  buyBot(s, 1000);
  // Move all fish far away so the click cannot hit a fish first.
  for (const f of s.fish) { f.sprite.x = 100; f.sprite.y = 400; }
  const moneyBefore = s.money;
  const pelletsBefore = s.pellets.length;
  s.onPointerDown({ x: s.feederBot.sprite.x, y: s.feederBot.sprite.y });
  eq(s.money, moneyBefore, "no food bought by clicking the robot");
  eq(s.pellets.length, pelletsBefore, "no pellet dropped");
  assert(s.toastText.text.indexOf("feeder-bot") >= 0, "toast names the feeder-bot: " + s.toastText.text);
});
test("scene: feeder-bot survives resetTank only if re-bought", () => {
  const s = makeScene();
  buyBot(s, 1000);
  assert(s.feederBot !== null);
  s.resetTank();
  eq(s.feederBot, null, "reset clears the robot");
  eq(s.feederOwned, false);
  eq(s.eggs.length, 0);
  eq(s.breedingPairs.length, 0);
});

// ===========================================================================
// 10. SCENE: BREEDING CHAIN + GUARDS
// ===========================================================================
function twoLargeFed(scene, species) {
  // Two large, recently-fed fish of one species, far apart.
  const a = scene.spawnFish(200, 200, species || "guppy");
  const b = scene.spawnFish(700, 200, species || "guppy");
  for (const f of [a, b]) {
    f.feeds = 6; f.stage = 2; scene.setFishStageVisual(f);
    f.hungerSec = 5; f.lastFedSec = 5;
  }
  a.hungerSec = 4; a.lastFedSec = 4; // A is better-fed -> A becomes pregnant
  return [a, b];
}
test("scene: breeding chain — hearts -> pregnant -> egg -> hatch", () => {
  const s = makeScene();
  const [a, b] = twoLargeFed(s, "guppy");
  const fishBefore = s.fish.length;
  // Hearts form within a frame.
  step(s, 0.5, () => keepFed(s));
  eq(s.breedingPairs.length, 1, "pair formed");
  assert(a.breeding && b.breeding, "both fish marked breeding");
  assert(s.breedingPairs[0].hearts && s.breedingPairs[0].hearts.length === 2, "two heart sprites");
  // Hearts last ~3s, then the better-fed parent is pregnant.
  step(s, 3.2, () => keepFed(s));
  eq(s.breedingPairs.length, 0, "hearts pair cleared");
  assert(a.pregnant, "better-fed parent (A) is pregnant");
  assert(!b.pregnant, "other parent is not pregnant");
  approx(a.pregnantSec, 15, 1.0, "pregnant for ~15s");
  // Pregnant fish is visibly swollen (Y scale 1.15x) after a frame.
  step(s, 0.2, () => keepFed(s));
  approx(a.sprite.scaleY, a.baseScale * 1.15, 1e-9, "pregnant belly scale");
  // 15s of pregnancy -> egg pops out; both parents get a 60s cooldown.
  step(s, 15.5, () => keepFed(s));
  assert(!a.pregnant, "no longer pregnant after 15s");
  eq(s.eggs.length, 1, "one egg popped out");
  eq(s.eggs[0].species, "guppy", "egg is the parents' species");
  assert(a.breedCooldownSec > 50, "mum on 60s cooldown, got " + a.breedCooldownSec);
  assert(b.breedCooldownSec > 50, "dad on 60s cooldown, got " + b.breedCooldownSec);
  // Egg sinks, sits ~20s, then hatches into a small guppy.
  step(s, 40, () => keepFedEggsLanded(s));
  eq(s.eggs.length, 0, "egg hatched");
  eq(s.fish.length, fishBefore + 1, "one hatchling joined the tank");
  const baby = s.fish[s.fish.length - 1];
  eq(baby.species, "guppy"); eq(baby.stage, 0, "hatchling is small");
  assert(s.toastText.text.indexOf("hatched") >= 0, "hatch toast shown: " + s.toastText.text);
});
test("scene: breeding chain works for emberfin (hatchling matches parents)", () => {
  const s = makeScene();
  const [a, b] = twoLargeFed(s, "emberfin");
  step(s, 3.5, () => keepFed(s));
  assert(a.pregnant || b.pregnant, "an emberfin parent is pregnant");
  step(s, 16, () => keepFed(s));
  eq(s.eggs.length, 1, "emberfin egg popped");
  eq(s.eggs[0].species, "emberfin");
  step(s, 40, () => keepFedEggsLanded(s));
  eq(s.eggs.length, 0, "emberfin egg hatched");
  const baby = s.fish[s.fish.length - 1];
  eq(baby.species, "emberfin"); eq(baby.stage, 0);
});
test("scene: pregnant fish swims ~30% slower", () => {
  const s = makeScene();
  const mum = s.spawnFish(200, 200, "guppy");
  const plain = s.spawnFish(200, 300, "guppy");
  for (const f of [mum, plain]) {
    f.hungerSec = 5; f.lastFedSec = 5;
    f.targetX = 800; f.targetY = f.sprite.y; f.wanderTimer = 100;
    // Pin tempo: the pregnancy ratio is what this test measures,
    // and two random tempos would make it noise.
    f.tempo = 1;
  }
  mum.pregnant = true; mum.pregnantSec = 15;
  const x0m = mum.sprite.x, x0p = plain.sprite.x;
  step(s, 1, () => { mum.hungerSec = 5; plain.hungerSec = 5; });
  const dm = mum.sprite.x - x0m, dp = plain.sprite.x - x0p;
  assert(dm > 15, "pregnant fish still moves (" + dm + "px)");
  assert(dm < dp * 0.85, "pregnant fish is slower: " + dm.toFixed(1) + " vs " + dp.toFixed(1) + "px/s");
  approx(dm, 45 * 0.7, 8, "pregnant speed is ~70% of 45px/s");
});
test("scene: no pairing across species, or when not recently fed", () => {
  const s = makeScene();
  const [a] = twoLargeFed(s, "guppy");
  const e = s.spawnFish(700, 300, "emberfin");
  e.feeds = 6; e.stage = 2; s.setFishStageVisual(e);
  e.hungerSec = 5; e.lastFedSec = 5;
  step(s, 2, () => keepFed(s));
  // A and B are both guppies, so they WILL pair — check the emberfin is not in it.
  assert(s.breedingPairs.length <= 1, "at most one pair");
  if (s.breedingPairs.length === 1) {
    assert(s.breedingPairs[0].a.species === s.breedingPairs[0].b.species, "pair is same-species");
    assert(!e.breeding, "emberfin did not pair with a guppy");
  }
  // Fresh scene: two large guppies, one fed 40s ago -> no pair.
  const s2 = makeScene();
  const [c, d] = twoLargeFed(s2, "guppy");
  c.lastFedSec = 40; c.hungerSec = 40; // starving, not recently fed
  d.lastFedSec = 5; d.hungerSec = 5;
  step(s2, 2, () => { d.hungerSec = 5; d.lastFedSec = 5; });
  eq(s2.breedingPairs.length, 0, "stale-fed fish does not pair");
});
test("scene: no pairing at the fish cap", () => {
  const s = makeScene();
  twoLargeFed(s, "guppy");
  while (s.fish.length < s.maxFishCap()) s.spawnFish(100, 100, "guppy");
  eq(s.fish.length, s.maxFishCap());
  step(s, 2, () => keepFed(s));
  eq(s.breedingPairs.length, 0, "no pair forms at cap");
});
test("scene: egg waits when the tank is full, hatches when room frees up", () => {
  const s = makeScene();
  const mum = s.spawnFish(480, 200, "guppy");
  mum.feeds = 6; mum.stage = 2; s.setFishStageVisual(mum);
  mum.pregnant = true; mum.pregnantSec = 0.2;
  // Fill the tank to cap.
  while (s.fish.length < s.maxFishCap()) s.spawnFish(100, 100, "guppy");
  eq(s.fish.length, 16);
  step(s, 1, () => keepFed(s));
  eq(s.eggs.length, 1, "egg popped despite the full tank");
  // Egg sinks then waits: 40s sim, still an egg, no hatchling.
  step(s, 40, () => keepFed(s));
  eq(s.eggs.length, 1, "egg waits while the tank is full");
  eq(s.fish.length, 16, "no hatchling while full");
  // Free one slot: the egg hatches on the next frames.
  const victim = s.fish.find((f) => f !== mum);
  victim.sprite.destroy(); if (victim.tail) victim.tail.destroy();
  s.fish.splice(s.fish.indexOf(victim), 1);
  step(s, 1, () => keepFed(s));
  eq(s.eggs.length, 0, "egg hatched once room freed up");
  eq(s.fish.length, 16, "hatchling took the freed slot");
});
test("scene: 60s cooldown blocks re-pairing after the egg pops", () => {
  const s = makeScene();
  const [a, b] = twoLargeFed(s, "guppy");
  step(s, 3.5, () => keepFed(s));
  assert(a.pregnant || b.pregnant, "pregnancy started");
  step(s, 16, () => keepFed(s));
  eq(s.eggs.length, 1, "egg popped");
  assert(a.breedCooldownSec > 0 && b.breedCooldownSec > 0, "both parents on cooldown");
  // Even freshly fed, they cannot pair again while cooling down.
  step(s, 5, () => keepFed(s));
  eq(s.breedingPairs.length, 0, "no re-pair during cooldown");
  assert(G.findBreedPair(s.fish, s.maxFishCap()) === null, "pure guard agrees: no pair");
});
test("scene: only one hearts pair forms at a time", () => {
  const s = makeScene();
  twoLargeFed(s, "guppy");
  const [c, d] = twoLargeFed(s, "emberfin");
  void c; void d;
  step(s, 1, () => keepFed(s));
  eq(s.breedingPairs.length, 1, "one pair at a time, even with two eligible pairs");
});

// ===========================================================================
// 11. V4.1: SPECIES SIZES, TAIL ATTACHMENT, PREDATION
// ===========================================================================
test("V4.1: species size multipliers (Chomper 1.3x, Starfish 0.95x)", () => {
  eq(G.SPECIES.chomper.size, 1.3);
  eq(G.SPECIES.starfish.size, 0.95);
  eq(G.SPECIES.guppy.size, 1.0);
  eq(G.SPECIES.emberfin.size, 1.0);
  eq(G.speciesSize("chomper"), 1.3);
  eq(G.speciesSize("starfish"), 0.95);
});
test("V4.1: fishScale — baby ~half an adult, Chomper biggest", () => {
  eq(JSON.stringify(G.GROWTH_SCALES), JSON.stringify([0.6, 0.9, 1.2, 1.35]));
  approx(G.fishScale(0, "guppy"), 0.6);
  approx(G.fishScale(2, "guppy"), 1.2);
  approx(G.fishScale(3, "guppy"), 1.35, 1e-9, "royal is a touch bigger than large");
  approx(G.fishScale(0, "guppy") / G.fishScale(2, "guppy"), 0.5, 1e-9, "baby is exactly half an adult");
  approx(G.fishScale(1, "guppy"), 0.9);
  approx(G.fishScale(2, "chomper"), 1.56, 1e-9, "large Chomper is biggest");
  approx(G.fishScale(0, "chomper"), 0.78, 1e-9);
  approx(G.fishScale(0, "starfish"), 0.57, 1e-9, "baby starfish is smallest");
  approx(G.fishScale(2, "starfish"), 1.14, 1e-9);
  assert(G.fishScale(2, "chomper") > G.fishScale(2, "guppy"), "Chomper > guppy at large");
  assert(G.fishScale(2, "guppy") > G.fishScale(2, "starfish"), "guppy > starfish at large");
  assert(G.fishScale(0, "chomper") > G.fishScale(0, "guppy"), "Chomper > guppy at baby");
});
test("V4.1: rendered size does NOT change coin/sell/feeding numbers", () => {
  // A baby Chomper still drops a $3 coin and sells for $200; a
  // large guppy still drops $10 — scale is visual only.
  eq(G.coinValueForStage(0, "chomper"), 3);
  eq(G.sellPriceForStage(0, "chomper"), 200);
  eq(G.coinValueForStage(2, "guppy"), 10);
  eq(G.stageForFeeds(3, "guppy"), 1, "growth thresholds unchanged");
  eq(G.stageForFeeds(8, "chomper"), 2, "growth thresholds unchanged");
});
test("V4.1: starfish is brighter pink (new colors) and still star-shaped", () => {
  eq(G.SPECIES.starfish.colors[0], 0xff5c8a, "brighter pink than V4's 0xff6b9d");
  assert(!G.SPECIES.starfish.hasTail, "starfish still has no tail");
  assert(G.SPECIES.starfish.swimLow, "starfish still swims low");
});
test("V4.1: tailGeometryFor — Emberfin fan is longer and wider", () => {
  const em = G.tailGeometryFor("emberfin");
  const gu = G.tailGeometryFor("guppy");
  assert(em.w > gu.w, "emberfin tail texture is longer (" + em.w + " vs " + gu.w + ")");
  assert(em.wideTop.y < gu.wideTop.y, "emberfin fan is wider at the top");
  assert(em.wideBottom.y > gu.wideBottom.y, "emberfin fan is wider at the bottom");
  eq(em.point.x, em.w - 2, "emberfin narrow point is still 2px from the pivot");
  eq(gu.point.x, 22, "guppy tail unchanged (V3.5 triangle)");
  const ch = G.tailGeometryFor("chomper");
  eq(ch.w, 24, "chomper keeps the standard tail");
  eq(ch.point.x, 22);
});
test("V4.1: tail point stays inside the body edge at all stages/species (pure)", () => {
  // The tail point sits 2 texture units past the joint (away from
  // the body after the 180° rotation facing left, toward it facing
  // right — either way 16 * baseScale from the centre), and the
  // body edge is 20 * baseScale away. So the point is 4px inside
  // the edge at every scale. The joint itself is 14 * baseScale.
  for (const key of ["guppy", "emberfin", "chomper", "starfish"]) {
    for (let stage = 0; stage < 3; stage++) {
      const scale = G.fishScale(stage, key);
      const joint = Math.abs(G.tailJointFor(false, scale));
      approx(joint, 14 * scale, 1e-9, key + " stage " + stage + " joint");
      const pointDist = joint + 2 * scale;
      assert(pointDist < G.BODY_ELLIPSE.rx * scale,
        key + " stage " + stage + ": tail point " + pointDist + " must be inside body edge " + (G.BODY_ELLIPSE.rx * scale));
      assert(pointDist > 0, "tail point is not at the centre");
    }
  }
});
test("V4.1: HUNT constants are ~70px range / ~18px catch", () => {
  eq(G.HUNT_RANGE_PX, 70);
  eq(G.HUNT_CATCH_PX, 18);
  assert(G.CHOMP_GULP_SEC > 0, "gulp pulse has a duration");
});

// --- Predation pure helpers ---
function huntFish(over) {
  return Object.assign({
    species: "chomper", stage: 2, hungerSec: 5, grabbed: false, x: 400, y: 200,
  }, over || {});
}
function preyFish(over) {
  return Object.assign({
    species: "guppy", stage: 0, hungerSec: 0, grabbed: false, x: 430, y: 200,
  }, over || {});
}
test("V4.1: canHunt — large hungry Chomper vs baby guppy", () => {
  assert(G.canHunt(huntFish(), preyFish()), "should hunt");
  assert(G.isHuntablePrey(preyFish()), "baby guppy is prey");
});
test("V4.1: canHunt — baby prey of ANY species except baby Chomper", () => {
  assert(G.canHunt(huntFish(), preyFish({ species: "emberfin" })), "baby emberfin is prey");
  assert(G.canHunt(huntFish(), preyFish({ species: "starfish" })), "baby starfish is prey");
  assert(!G.canHunt(huntFish(), preyFish({ species: "chomper" })), "baby Chomper is NOT prey");
  assert(!G.isHuntablePrey(preyFish({ species: "chomper" })), "baby Chomper is not huntable");
});
test("V4.1: canHunt — medium/large fish are never prey", () => {
  assert(!G.canHunt(huntFish(), preyFish({ stage: 1 })), "medium guppy is not prey");
  assert(!G.canHunt(huntFish(), preyFish({ stage: 2 })), "large guppy is not prey");
  assert(!G.canHunt(huntFish(), preyFish({ stage: 1, species: "emberfin" })), "medium emberfin is not prey");
});
test("V4.1: canHunt — only LARGE Chompers hunt, only when hungry", () => {
  assert(!G.canHunt(huntFish({ stage: 1 }), preyFish()), "medium Chomper does not hunt");
  assert(!G.canHunt(huntFish({ stage: 0 }), preyFish()), "baby Chomper does not hunt");
  assert(!G.canHunt(huntFish({ species: "guppy", stage: 2 }), preyFish()), "a large guppy does not hunt");
  assert(!G.canHunt(huntFish({ hungerSec: 0 }), preyFish()), "well-fed Chomper (hungerSec 0) does not hunt");
  assert(G.canHunt(huntFish({ hungerSec: 0.1 }), preyFish()), "any time since a meal counts as hungry");
  assert(!G.canHunt(huntFish({ grabbed: true }), preyFish()), "grabbed hunter does not hunt");
  assert(!G.canHunt(huntFish(), preyFish({ grabbed: true })), "grabbed baby is not prey");
  assert(!G.canHunt(null, preyFish()), "null hunter");
  assert(!G.canHunt(huntFish(), null), "null prey");
});
test("V4.1: findPrey — nearest baby in range, null out of range", () => {
  const hunter = huntFish({ x: 400, y: 200 });
  const near = preyFish({ x: 450, y: 200 }); // 50px
  const nearer = preyFish({ species: "emberfin", x: 420, y: 200 }); // 20px
  const far = preyFish({ species: "starfish", x: 600, y: 200 }); // 200px
  eq(G.findPrey(hunter, [near, nearer, far]), nearer, "nearest baby in range wins");
  eq(G.findPrey(hunter, [far]), null, "out-of-range baby is safe");
  const atEdge = preyFish({ x: 470, y: 200 }); // exactly 70px
  eq(G.findPrey(hunter, [atEdge]), atEdge, "baby at exactly 70px is in range");
  assert(G.findPrey(hunter, [preyFish({ x: 471, y: 200 })]) === null, "baby at 71px is out of range");
  assert(G.findPrey(hunter, [preyFish({ species: "chomper", x: 410, y: 200 })]) === null, "baby Chomper is ignored even up close");
  assert(G.findPrey(huntFish({ hungerSec: 0 }), [near]) === null, "well-fed hunter finds no prey");
  assert(G.findPrey(hunter, []) === null, "no fish, no prey");
});

// --- Predation scene tests ---
function largeHungryChomper(scene, x, y) {
  const c = scene.spawnFish(x, y, "chomper");
  c.feeds = 8; c.stage = 2; scene.setFishStageVisual(c);
  c.hungerSec = 5; c.lastFedSec = 5;
  c.royalGene = false; // pin the gene off: a royal hunter would grow
  // to stage 3 on the eat, and these tests assert stage 2
  return c;
}
function stillBaby(scene, species, x, y) {
  const b = scene.spawnFish(x, y, species);
  b.hungerSec = 0; b.lastFedSec = 0;
  // Hold still so the test measures the hunter, not the wander.
  b.targetX = x; b.targetY = y; b.wanderTimer = 100;
  return b;
}
test("V4.1 scene: spawn scales — baby guppy 0.6, large guppy 1.2, large Chomper 1.56", () => {
  const s = makeScene();
  const baby = s.fish[0];
  approx(baby.baseScale, 0.6, 1e-9, "start guppy is a baby at 0.6");
  approx(baby.sprite.scaleX, 0.6, 1e-9, "sprite scale applied at spawn");
  const adult = s.spawnFish(400, 200, "guppy");
  adult.feeds = 6; adult.stage = 2; s.setFishStageVisual(adult);
  approx(adult.baseScale, 1.2, 1e-9, "large guppy is 1.2");
  const ch = s.spawnFish(500, 200, "chomper");
  ch.feeds = 8; ch.stage = 2; s.setFishStageVisual(ch);
  approx(ch.baseScale, 1.56, 1e-9, "large Chomper is 1.2 * 1.3");
  const st = s.spawnFish(600, 350, "starfish");
  approx(st.baseScale, 0.57, 1e-9, "baby starfish is 0.6 * 0.95");
});
test("V4.1 scene: tail stays attached at all stages/species, both facings", () => {
  const s = makeScene();
  for (const key of ["guppy", "emberfin", "chomper"]) {
    for (let stage = 0; stage < 3; stage++) {
      const f = s.spawnFish(480, 200, key);
      f.feeds = stage === 2 ? 8 : stage === 1 ? 3 : 0;
      f.stage = stage; s.setFishStageVisual(f);
      for (const facingLeft of [false, true]) {
        f.sprite.setFlipX(facingLeft);
        s.animateFish(f, 0.016);
        const joint = Math.abs(f.tail.x - f.sprite.x);
        approx(joint, 14 * f.baseScale, 0.01, key + " stage " + stage + " facingLeft=" + facingLeft + " joint");
        // Tail point is 2 * baseScale past the joint: still inside
        // the body edge (20 * baseScale) on both sides.
        assert(joint + 2 * f.baseScale < 20 * f.baseScale,
          key + " stage " + stage + ": tail point inside body edge");
      }
      // Clean up so the next species starts from a known tank.
      f.sprite.destroy(); if (f.tail) f.tail.destroy();
      s.fish.splice(s.fish.indexOf(f), 1);
    }
  }
});
test("V4.1 scene: hungry large Chomper eats a baby guppy in range", () => {
  const s = makeScene();
  // Park the two starting guppies far away and hold them still —
  // they are stage-0 prey too, and the hunter gets hungry again
  // right after its first meal, so a wandering starter could
  // otherwise be eaten as well. That made this test flaky (~1 in 4
  // runs lost a second fish). The parked spots are 400+px from the
  // hunter — unreachable in 3s even at the fastest chase speed
  // (3x base x 1.2 tempo = ~108 px/s, ~324px in 3s).
  const spots = [[100, 100], [860, 100]];
  s.fish.forEach((f, i) => {
    f.sprite.x = spots[i][0]; f.sprite.y = spots[i][1];
    f.targetX = spots[i][0]; f.targetY = spots[i][1]; f.wanderTimer = 100;
  });
  const hunter = largeHungryChomper(s, 480, 400);
  const baby = stillBaby(s, "guppy", 520, 400); // 40px away
  const nBefore = s.fish.length;
  const feedsBefore = hunter.feeds;
  step(s, 3);
  assert(!s.fish.includes(baby), "baby guppy was eaten");
  eq(s.fish.length, nBefore - 1, "one fish removed");
  assert(s.fish.includes(hunter), "hunter survives");
  eq(hunter.feeds, feedsBefore + 1, "hunter gains 1 feed");
  // The eat happened ~0.4s into the 3s step, so hunger has ticked
  // back up since — but it must be well under the 5 + 3 = 8s it
  // would be if the meal had never reset it.
  assert(hunter.hungerSec < 5, "hunter hunger reset (was 5+, now " + hunter.hungerSec.toFixed(2) + ", would be 8 without a reset)");
  assert(s.toastText.text.indexOf("A Chomper ate a baby guppy!") >= 0, "first-eat toast: " + s.toastText.text);
});
test("V4.1 scene: hungry large Chomper eats baby Emberfin and baby Starfish", () => {
  for (const species of ["emberfin", "starfish"]) {
    const s = makeScene();
    // Same parking as the guppy test above — the starters are prey
    // too, and a second meal would overwrite the toast this test
    // asserts on.
    const spots = [[100, 100], [860, 100]];
    s.fish.forEach((f, i) => {
      f.sprite.x = spots[i][0]; f.sprite.y = spots[i][1];
      f.targetX = spots[i][0]; f.targetY = spots[i][1]; f.wanderTimer = 100;
    });
    const hunter = largeHungryChomper(s, 480, 400);
    const baby = stillBaby(s, species, 520, 400);
    step(s, 3);
    assert(!s.fish.includes(baby), "baby " + species + " was eaten");
    assert(s.toastText.text.indexOf("A Chomper ate a baby " + species + "!") >= 0, "toast names " + species + ": " + s.toastText.text);
  }
});
test("V4.1 scene: eatBaby resets hunger exactly and starts the gulp pulse", () => {
  const s = makeScene();
  const hunter = largeHungryChomper(s, 480, 400);
  const baby = stillBaby(s, "guppy", 495, 400); // 15px — inside catch range
  const feedsBefore = hunter.feeds;
  s.eatBaby(hunter, baby);
  eq(hunter.feeds, feedsBefore + 1, "feed gained");
  eq(hunter.hungerSec, 0, "hunger reset to exactly 0");
  eq(hunter.lastFedSec, 0, "recently-fed clock reset too");
  eq(hunter.gulpSec, G.CHOMP_GULP_SEC, "gulp pulse started");
  assert(!s.fish.includes(baby), "baby removed");
  // The pulse is visible on the sprite after a frame: scale swells.
  const base = hunter.baseScale;
  step(s, 0.2);
  assert(hunter.sprite.scaleX > base, "gulp pulse swells the sprite: " + hunter.sprite.scaleX.toFixed(3) + " > " + base);
  assert(hunter.gulpSec > 0 && hunter.gulpSec < G.CHOMP_GULP_SEC, "gulp pulse ticks down");
});
test("V4.1 scene: well-fed Chomper does NOT eat (direct catch pass)", () => {
  const s = makeScene();
  const hunter = largeHungryChomper(s, 480, 400);
  hunter.hungerSec = 0; // just fed — well-fed
  const baby = stillBaby(s, "guppy", 490, 400); // 10px — inside catch range
  const nBefore = s.fish.length;
  s.updateHunting(); // run the catch pass with hunger exactly 0
  assert(s.fish.includes(baby), "well-fed Chomper leaves the baby alone");
  eq(s.fish.length, nBefore);
  eq(hunter.feeds, 8, "no feed gained");
});
test("V4.1 scene: Chomper does NOT eat baby Chompers", () => {
  const s = makeScene();
  const hunter = largeHungryChomper(s, 480, 400);
  const baby = stillBaby(s, "chomper", 520, 400);
  step(s, 3);
  assert(s.fish.includes(baby), "baby Chomper survives");
});
test("V4.1 scene: Chomper does NOT eat medium or large fish", () => {
  const s = makeScene();
  const hunter = largeHungryChomper(s, 480, 400);
  const med = s.spawnFish(520, 400, "guppy");
  med.feeds = 3; med.stage = 1; s.setFishStageVisual(med);
  med.targetX = 520; med.targetY = 400; med.wanderTimer = 100;
  med.hungerSec = 0;
  step(s, 2);
  assert(s.fish.includes(med), "medium guppy survives");
  const s2 = makeScene();
  const hunter2 = largeHungryChomper(s2, 480, 400);
  const big = s2.spawnFish(520, 400, "guppy");
  big.feeds = 6; big.stage = 2; s2.setFishStageVisual(big);
  big.targetX = 520; big.targetY = 400; big.wanderTimer = 100;
  big.hungerSec = 5; big.lastFedSec = 5; // fed, alive — and a
  // Chomper cannot breed with a guppy anyway (different species)
  step(s2, 2);
  assert(s2.fish.includes(big), "large guppy survives");
});
test("V4.1 scene: Chomper does NOT eat eggs", () => {
  const s = makeScene();
  const hunter = largeHungryChomper(s, 480, 380);
  const eggSprite = s.add.image(480, 428, "egg");
  s.eggs.push({ sprite: eggSprite, species: "guppy", waitSec: 20, sinking: false, pulse: 0 });
  const nFish = s.fish.length;
  step(s, 2);
  eq(s.eggs.length, 1, "egg is still there");
  eq(s.fish.length, nFish, "no fish eaten either");
});
test("V4.1 scene: out-of-range baby is safe", () => {
  const s = makeScene();
  const hunter = largeHungryChomper(s, 100, 100);
  const baby = stillBaby(s, "guppy", 850, 400); // ~800px away
  step(s, 1);
  assert(s.fish.includes(baby), "far-away baby survives");
});
test("V4.1 scene: only LARGE Chompers hunt (medium Chomper ignores babies)", () => {
  const s = makeScene();
  const med = s.spawnFish(480, 400, "chomper");
  med.feeds = 4; med.stage = 1; s.setFishStageVisual(med);
  med.hungerSec = 5; med.lastFedSec = 5;
  const baby = stillBaby(s, "guppy", 520, 400);
  step(s, 3);
  assert(s.fish.includes(baby), "medium Chomper leaves the baby alone");
});

// ===========================================================================
// 12. V4.1 PHASE 2: DECOR PANEL, MAGNET CHAIN, DESCRIPTION BAR
// ===========================================================================
test("V4.1 P2: MAGNET_LEVELS — costs 400/600/900, radii 60/110/170, no $250 level", () => {
  eq(G.MAGNET_LEVELS.length, 3, "three drag levels — hover is free, not a level");
  eq(JSON.stringify(G.MAGNET_LEVELS.map((l) => l.cost)), JSON.stringify([400, 600, 900]));
  eq(JSON.stringify(G.MAGNET_LEVELS.map((l) => l.radius)), JSON.stringify([60, 110, 170]));
  eq(G.MAGNET_LEVELS[0].name, "Drag 60");
  eq(G.MAGNET_LEVELS[1].name, "Drag 110");
  eq(G.MAGNET_LEVELS[2].name, "Drag 170");
  assert(!G.MAGNET_LEVELS.some((l) => l.cost === 250), "no $250 magnet level exists");
  assert(!G.MAGNET_LEVELS.some((l) => l.name === "Hover collect"), "hover is not a purchasable level");
});
test("V4.1 P2: magnetLevelCost / magnetRadiusFor per level", () => {
  eq(G.magnetLevelCost(0), 400); eq(G.magnetLevelCost(1), 600);
  eq(G.magnetLevelCost(2), 900);
  eq(G.magnetLevelCost(3), null, "MAX has no next cost");
  assert(G.magnetLevelCost(0) !== 250 && G.magnetLevelCost(1) !== 250 && G.magnetLevelCost(2) !== 250,
    "no level costs $250");
  eq(G.magnetRadiusFor(0), 0, "level 0 is hover-only: no drag");
  eq(G.magnetRadiusFor(1), 60);
  eq(G.magnetRadiusFor(2), 110);
  eq(G.magnetRadiusFor(3), 170);
  assert(G.magnetRadiusFor(3) > G.magnetRadiusFor(2) && G.magnetRadiusFor(2) > G.magnetRadiusFor(1),
    "radii grow per level");
});
test("V4.1 P2: magnetDragCoin — drags within radius, ignores outside, collects on touch", () => {
  // Inside the radius: moves toward the pointer, capped by speed*dt.
  const r1 = G.magnetDragCoin(400, 400, 460, 400, 60, 0.2, 150);
  assert(r1 !== null, "coin 60px away is inside the 60px radius");
  assert(!r1.collect, "30px from the pointer after 0.2s: not touching yet");
  approx(r1.x, 430, 1e-9, "dragged 30px in 0.2s at 150px/s");
  // Outside the radius: untouched.
  eq(G.magnetDragCoin(400, 400, 470, 400, 60, 0.5, 150), null, "coin 70px away is outside the 60px radius");
  eq(G.magnetDragCoin(400, 400, 500, 400, 60, 0.5, 150), null, "coin 100px away is outside L2's 60px radius");
  const r2 = G.magnetDragCoin(400, 400, 500, 400, 110, 0.5, 150);
  assert(r2 !== null, "same coin IS inside L3's 110px radius");
  // Speed cap: a far coin moves at most speed*dt in one frame.
  const r3 = G.magnetDragCoin(300, 400, 470, 400, 170, 0.1, 150);
  approx(r3.x, 315, 1e-9, "moves at most 15px in 0.1s at 150px/s");
  // Touch: within 14px of the pointer -> collect.
  const r4 = G.magnetDragCoin(470, 400, 480, 400, 170, 0.1, 150);
  assert(r4.collect, "coin 10px from the pointer is collected");
  // Clamp: drag never pulls a coin out of the water or through the UI.
  const r5 = G.magnetDragCoin(480, 420, 480, 100, 400, 1, 150);
  assert(r5.y >= 48 && r5.y <= G.CONFIG.floorY, "y clamped into the water, got " + r5.y);
  const r6 = G.magnetDragCoin(30, 400, 0, 400, 400, 1, 150);
  assert(r6.x >= 20 && r6.x <= 940, "x clamped into the tank, got " + r6.x);
});
test("V4.1 P2: magnetHoverAt uses the 24px coin hitbox", () => {
  assert(G.magnetHoverAt(100, 100, 110, 100), "hover 10px away collects");
  assert(G.magnetHoverAt(100, 100, 124, 100), "hover at the 24px edge collects");
  assert(!G.magnetHoverAt(100, 100, 125, 100), "hover 25px away does not collect");
});
test("V4.1 P2: decor panel — open, buy one, stays open, bonus + owned ✓ update", () => {
  const s = makeScene();
  s.money = 1000;
  assert(s.decorPanel === null, "panel starts closed");
  s.decorBtn.bg._handlers["pointerdown"]();
  assert(s.decorPanel !== null, "Decor click opens the panel");
  assert(s.decorPanelBounds !== null, "panel has a hit rect");
  assert(s.decorPanelBounds.y1 < G.SHOP.row1Y - G.SHOP.btnH / 2,
    "panel bottom (" + s.decorPanelBounds.y1 + ") clears the top of the row-1 buttons");
  // Buy Coral from the panel row: money deducted, bonus up, panel STAYS open.
  const coralRow = s.decorPanel.rows.coral;
  assert(coralRow.label.text.indexOf("$75") >= 0, "coral row shows its price: " + coralRow.label.text);
  assert(coralRow.label.text.indexOf("✓") < 0, "coral not owned yet");
  coralRow.rect._handlers["pointerdown"]();
  eq(s.money, 925, "coral costs $75");
  assert(s.decorations.coral, "coral owned");
  assert(s.decorSprites.coral.visible, "coral sprite appears in the tank");
  assert(s.decorPanel !== null, "panel stays open after a purchase");
  assert(s.decorPanel.rows.coral.label.text.indexOf("✓") >= 0, "coral row now shows ✓");
  assert(s.decorPanel.rows.chest.label.text.indexOf("✓") < 0, "chest row still unowned");
  // The header shows the current total bonus.
  eq(G.decorCount(s.decorations), 1, "one decoration owned");
  // Buy another from the same open panel.
  s.decorPanel.rows.chest.rect._handlers["pointerdown"]();
  eq(s.money, 825, "chest costs $100");
  eq(G.decorCount(s.decorations), 2, "two decorations owned");
  assert(s.decorPanel !== null, "panel still open after the second purchase");
  // Decor click again closes it — and destroys it, not just hides it.
  s.decorBtn.bg._handlers["pointerdown"]();
  eq(s.decorPanel, null, "second Decor click closes the panel");
  eq(s.decorPanelBounds, null, "panel hit rect cleared");
});
test("V4.1 P2: decor panel closes on a click elsewhere in the tank (no food dropped)", () => {
  const s = makeScene();
  s.money = 1000;
  s.decorBtn.bg._handlers["pointerdown"]();
  assert(s.decorPanel !== null, "panel open");
  const moneyBefore = s.money;
  // Click empty water far from the panel and from any fish.
  s.onPointerDown({ x: 850, y: 150 });
  eq(s.decorPanel, null, "click elsewhere closes the panel");
  eq(s.money, moneyBefore, "closing the panel does not drop food");
  eq(s.pellets.length, 0, "no pellet dropped by the closing click");
});
test("V4.1 P2: panel does not block fish clicks when closed", () => {
  const s = makeScene();
  s.money = 1000;
  s.decorBtn.bg._handlers["pointerdown"]();
  s.decorBtn.bg._handlers["pointerdown"](); // open, then close
  eq(s.decorPanel, null, "panel closed");
  // Clicking a fish now starts a grab, exactly as before.
  const f = s.fish[0];
  s.onPointerDown({ x: f.sprite.x, y: f.sprite.y });
  eq(s.dragFish, f, "fish can be grabbed with the panel closed");
  // And clicking empty water drops food again.
  s.onPointerUp({ x: f.sprite.x, y: f.sprite.y });
  const moneyBefore = s.money;
  s.onPointerDown({ x: 850, y: 150 });
  eq(s.pellets.length, 1, "water click drops food with the panel closed");
  eq(s.money, moneyBefore - 2, "food paid for");
});
test("V4.1 P2: panel clicks on the panel itself do not drop food or grab fish", () => {
  const s = makeScene();
  s.money = 1000;
  s.decorBtn.bg._handlers["pointerdown"]();
  assert(s.decorPanel !== null, "panel open");
  const moneyBefore = s.money;
  // Click the panel's header area (inside the panel, not on a row).
  s.onPointerDown({ x: G.DECOR_PANEL.cx, y: G.DECOR_PANEL.cy - 40 });
  eq(s.money, moneyBefore, "clicking the panel does not drop food");
  eq(s.pellets.length, 0, "no pellet from a panel click");
  assert(s.decorPanel !== null, "clicking the panel does not close it");
  eq(s.dragFish, null, "no fish grabbed through the panel");
});
test("V4.1 P2: buying a decoration twice is denied, and a broke buy is denied", () => {
  const s = makeScene();
  s.money = 1000;
  s.buyDecoration("coral", G.CONFIG.coralCost);
  eq(s.money, 925);
  s.buyDecoration("coral", G.CONFIG.coralCost);
  eq(s.money, 925, "second coral is denied");
  s.money = 50;
  s.buyDecoration("castle", G.CONFIG.castleCost);
  eq(s.money, 50, "castle denied when broke");
  assert(!s.decorations.castle, "castle not owned");
});
test("V4.1 P2: hover-collect is default — no magnet purchase needed", () => {
  const s = makeScene();
  s.money = 1000;
  eq(s.magnetLevel, 0, "no magnet owned");
  // Hovering over a coin collects it with NO magnet purchased.
  const f = s.fish[0];
  s.dropCoin(f);
  const coin = s.coins[s.coins.length - 1];
  const moneyBefore = s.money;
  s.onPointerMove({ x: coin.container.x, y: coin.container.y });
  assert(!s.coins.includes(coin), "hover collected the coin at level 0");
  assert(s.money > moneyBefore, "hover-collect banks the coin value");
});
test("V4.1 P2: magnet L1 drags a coin within radius toward the pointer, not one outside it", () => {
  const s = makeScene();
  s.money = 5000;
  s.buyMagnet(); // L1 Drag 60 — $400
  eq(s.magnetLevel, 1);
  const f = s.fish[0];
  // Coin 50px from the pointer (inside L1's 60px radius), sinking.
  s.dropCoin(f);
  const near = s.coins[s.coins.length - 1];
  near.container.x = 400; near.container.y = 200;
  // Coin 150px away (outside L1's 60px radius).
  s.dropCoin(f);
  const far = s.coins[s.coins.length - 1];
  far.container.x = 650; far.container.y = 200;
  s.onPointerMove({ x: 450, y: 200 }); // pointerSeen + hover check (both coins are >24px away, so no hover-collect)
  const nearX0 = near.container.x, farX0 = far.container.x;
  step(s, 0.2, () => keepFed(s)); // 0.2s at 150px/s moves the near coin 30px — not far enough to touch the pointer
  assert(s.coins.includes(near), "near coin is dragged, not instantly collected");
  assert(near.container.x > nearX0 + 20, "near coin dragged toward the pointer: " + nearX0 + " -> " + near.container.x.toFixed(1));
  approx(far.container.x, farX0, 2, "far coin barely moved (only the sink wobble): " + farX0 + " -> " + far.container.x.toFixed(1));
});
test("V4.1 P2: magnet L2 drags a coin L1 cannot reach", () => {
  const s = makeScene();
  s.money = 5000;
  s.buyMagnet(); // L1 Drag 60
  const f = s.fish[0];
  s.dropCoin(f);
  const coin = s.coins[s.coins.length - 1];
  coin.container.x = 400; coin.container.y = 200;
  s.onPointerMove({ x: 500, y: 200 }); // 100px away: outside L1's 60px
  const x0 = coin.container.x;
  step(s, 0.5, () => keepFed(s));
  approx(coin.container.x, x0, 2, "L1 does not drag a coin 100px away");
  // Upgrade to L2 (radius 110): the same coin is now in range.
  s.buyMagnet();
  eq(s.magnetLevel, 2);
  step(s, 0.5, () => keepFed(s));
  assert(coin.container.x > x0 + 20, "L2 drags the 100px-away coin: " + x0 + " -> " + coin.container.x.toFixed(1));
});
test("V4.1 P2: magnet L3 drags a coin 150px away that L2 cannot reach", () => {
  const s = makeScene();
  s.money = 5000;
  s.buyMagnet(); s.buyMagnet(); // L2 Drag 110
  const f = s.fish[0];
  s.dropCoin(f);
  const coin = s.coins[s.coins.length - 1];
  coin.container.x = 400; coin.container.y = 200;
  s.onPointerMove({ x: 550, y: 200 }); // 150px away: outside L2's 110px
  const x0 = coin.container.x;
  step(s, 0.5, () => keepFed(s));
  approx(coin.container.x, x0, 2, "L2 does not drag a coin 150px away");
  // Upgrade to L3 (radius 170): the same coin is now in range.
  s.buyMagnet();
  eq(s.magnetLevel, 3);
  step(s, 0.5, () => keepFed(s));
  assert(coin.container.x > x0 + 20, "L3 drags the 150px-away coin: " + x0 + " -> " + coin.container.x.toFixed(1));
});
test("V4.1 P2: magnet drag collects on touch and never leaves the water", () => {
  const s = makeScene();
  s.money = 5000;
  s.buyMagnet(); // L1 Drag 60
  const f = s.fish[0];
  s.dropCoin(f);
  const coin = s.coins[s.coins.length - 1];
  coin.container.x = 450; coin.container.y = 200;
  const moneyBefore = s.money;
  // 30px from the pointer: outside the 24px hover hitbox, inside
  // the 60px drag radius — so only the DRAG can collect it.
  s.onPointerMove({ x: 480, y: 200 });
  assert(s.coins.includes(coin), "30px away is not hover-collected");
  step(s, 0.2, () => keepFed(s)); // drag moves it 30px onto the pointer
  assert(!s.coins.includes(coin), "coin dragged onto the cursor is collected");
  assert(s.money > moneyBefore, "drag-collect banks the value");
  // A dragged coin stays in the water even when the pointer is at the floor.
  s.dropCoin(f);
  const coin2 = s.coins[s.coins.length - 1];
  coin2.container.x = 480; coin2.container.y = 400;
  s.onPointerMove({ x: 480, y: 455 }); // pointer near the floor, 55px away: drag, never touch
  step(s, 1, () => keepFed(s));
  assert(s.coins.includes(coin2), "coin 27px from the pointer is dragged, not collected");
  assert(coin2.container.y <= G.CONFIG.floorY, "dragged coin never sinks past the floor");
  assert(coin2.container.y >= 48, "dragged coin never leaves the top of the water");
  assert(coin2.container.x >= 20 && coin2.container.x <= 940, "dragged coin never leaves the tank sides");
});
test("V4.1 P2: magnet buys are denied when broke, and MAX after L3", () => {
  const s = makeScene();
  s.money = 100;
  s.buyMagnet();
  eq(s.magnetLevel, 0, "L1 denied at $100");
  eq(s.money, 100, "money untouched");
  s.money = 3000;
  s.buyMagnet(); eq(s.magnetLevel, 1); eq(s.money, 2600, "L1 costs $400");
  s.buyMagnet(); eq(s.magnetLevel, 2); eq(s.money, 2000, "L2 costs $600");
  s.buyMagnet(); eq(s.magnetLevel, 3); eq(s.money, 1100, "L3 costs $900");
  eq(s.magnetBtn.text.text, "Magnet ✓ MAX", "button shows MAX after L3");
  assert(s.magnetTip().indexOf("MAX") >= 0, "tip says MAX: " + s.magnetTip());
  s.buyMagnet();
  eq(s.magnetLevel, 3, "no level 4");
  eq(s.money, 1100, "no charge after MAX");
});
test("V4.1 P2: magnet labels show level and next cost at every level", () => {
  const s = makeScene();
  s.money = 5000;
  eq(s.magnetLabel(), "Magnet $400", "L0 shows the first cost");
  s.buyMagnet(); eq(s.magnetLabel(), "Magnet L1 · $600");
  s.buyMagnet(); eq(s.magnetLabel(), "Magnet L2 · $900");
  s.buyMagnet(); eq(s.magnetLabel(), "Magnet ✓ MAX");
  assert(s.magnetTip().indexOf("Drag 170") >= 0, "MAX tip names Drag 170");
  assert(s.magnetTip().indexOf("170px") >= 0, "MAX tip names the radius");
});
test("V4.1 P2: old magnet drift is gone — level 0 does not pull coins to the centre", () => {
  const s = makeScene();
  s.money = 1000;
  // Level 0: hover only, no drift, no drag.
  const f = s.fish[0];
  s.dropCoin(f);
  const coin = s.coins[s.coins.length - 1];
  coin.container.x = 100; coin.container.y = 100;
  step(s, 1, () => keepFed(s));
  assert(Math.abs(coin.container.x - 100) < 5,
    "level-0 coin does not drift toward the centre (old drift moved it 30px/s): x=" + coin.container.x.toFixed(1));
});
test("V4.1 P2: magnet drag does not fight Turbo — he still collects landed coins", () => {
  const s = makeScene();
  s.money = 5000;
  s.buyMagnet(); // L1 Drag 60 — the pointer stays far away, so drag never reaches the coin
  s.buyTurboOrSpeed();
  assert(s.snail !== null, "Turbo bought");
  const f = s.fish[0];
  s.dropCoin(f);
  const coin = s.coins[s.coins.length - 1];
  // Land the coin right under Turbo and let him collect it.
  coin.container.x = s.snail.sprite.x; coin.container.y = G.CONFIG.floorY;
  s.onPointerMove({ x: 850, y: 100 }); // pointer far from the coin: no drag, no hover-collect
  const moneyBefore = s.money;
  step(s, 1, () => keepFed(s));
  assert(!s.coins.includes(coin), "Turbo still collects a landed coin with the magnet owned");
  assert(s.money > moneyBefore, "Turbo's collection banks the coin");
});
test("V4.1 P2: description bar text on hover for magnet and decor", () => {
  const s = makeScene();
  s.money = 5000;
  s.magnetBtn.bg._handlers["pointerover"]();
  assert(s.descBarText.text.indexOf("$400") >= 0, "magnet bar shows the L1 cost: " + s.descBarText.text);
  assert(s.descBarText.text.indexOf("Drag 60") >= 0, "magnet bar names L1");
  assert(s.descBarText.text.indexOf("free") >= 0, "magnet bar says hover is free: " + s.descBarText.text);
  s.buyMagnet();
  s.magnetBtn.bg._handlers["pointerover"]();
  assert(s.descBarText.text.indexOf("$600") >= 0, "magnet bar shows the next cost after L1: " + s.descBarText.text);
  s.decorBtn.bg._handlers["pointerover"]();
  assert(s.descBarText.text.indexOf("Decorations") >= 0, "decor bar names the panel: " + s.descBarText.text);
  assert(s.descBarText.text.indexOf("+0%") >= 0, "decor bar shows the current bonus: " + s.descBarText.text);
  s.buyDecoration("coral", G.CONFIG.coralCost);
  s.decorBtn.bg._handlers["pointerover"]();
  assert(s.descBarText.text.indexOf("+5%") >= 0, "decor bar updates to +5% after a buy: " + s.descBarText.text);
});
test("V4.1 P2: magnet button is wide and spans cols 7-8; Sell is at col 5", () => {
  const s = makeScene();
  // Magnet button centre is slotW*8, width 206 — it spans cols 7-8.
  eq(Math.round(s.magnetBtn.x), Math.round(G.SHOP.slotW * 8), "magnet button centre");
  assert(s.magnetBtn.bg !== undefined, "magnet button exists");
  // Sell button centre is col 5, matching SELL_BOUNDS.
  eq(Math.round(s.sellBtn.x), Math.round(G.SHOP_COL_X(5)), "sell button centre is col 5");
  eq(Math.round(s.decorBtn.x), Math.round(G.SHOP_COL_X(2)), "decor button is col 2");
});
test("V4.1 P2: resetTank clears the magnet chain and closes the decor panel", () => {
  const s = makeScene();
  s.money = 5000;
  s.buyMagnet(); s.buyMagnet();
  s.decorBtn.bg._handlers["pointerdown"]();
  assert(s.magnetLevel === 2 && s.decorPanel !== null, "level 2 + panel open before reset");
  s.resetTank();
  eq(s.magnetLevel, 0, "magnet back to 0");
  eq(s.magnetOwned, false, "magnetOwned cleared");
  eq(s.decorPanel, null, "panel destroyed by reset");
  eq(s.pointerSeen, false, "pointer tracking reset");
});

// ===========================================================================
// HOLD-TO-FEED: holding the click over open water drops pellets on a
// cadence (CONFIG.feedHoldIntervalSec), like spam clicking. Set by a
// successful water pointerdown, cleared by pointerup / broke / reset.
// ===========================================================================
test("hold-to-feed: config key exists at the spam-click cadence", () => {
  eq(G.CONFIG.feedHoldIntervalSec, 0.1, "0.1s = 10 pellets/s, spam-click pace");
});

test("hold-to-feed: a water press drops once and arms the hold", () => {
  const s = makeScene();
  s.onPointerDown({ x: 850, y: 150 });
  eq(s.pellets.length, 1, "the press itself drops one pellet");
  eq(s.feedHold, true, "hold armed by a successful drop");
  eq(s.feedHoldTimer, 0, "timer starts at 0 — the first repeat waits out the 0.3s initial delay");
  assert(typeof s.feedHoldAction === "function", "the shared hold action is armed");
});

test("hold-to-feed: holding for 1s drops ~5/s, not every frame", () => {
  const s = makeScene();
  s.onPointerDown({ x: 850, y: 150 });
  step(s, 1, () => keepFed(s));
  // 1 press pellet + 8 cadence pellets: the first repeat waits out
  // the 0.3s initial delay (frames at 300ms..1000ms), then one per 0.1s.
  eq(s.pellets.length, 9, "1 + 8 pellets after 1s of holding, got " + s.pellets.length);
  eq(s.feedHold, true, "still holding");
});

test("hold-to-feed: pellets follow the pointer as it moves", () => {
  const s = makeScene();
  s.onPointerDown({ x: 850, y: 150 });
  s.onPointerMove({ x: 200, y: 300 }); // drag the stream across the tank
  for (const f of s.fish) f.eatCooldownSec = 999; // nobody eats the stream mid-sim
  step(s, 0.4, () => keepFed(s));
  const last = s.pellets[s.pellets.length - 1];
  eq(Math.round(last.sprite.x), 200, "latest pellet dropped at the moved pointer");
  // updateHold runs before updatePellets, so a fresh pellet sinks
  // one frame (40 px/s * 0.1s) before we look at it.
  assert(Math.abs(last.sprite.y - (300 + 40 * 0.1)) < 1e-9, "latest pellet dropped at the moved y minus one frame of sink: " + last.sprite.y);
});

test("hold-to-feed: pointerup ends the hold", () => {
  const s = makeScene();
  s.onPointerDown({ x: 850, y: 150 });
  s.onPointerUp({ x: 850, y: 150 });
  eq(s.feedHold, false, "hold cleared on release");
  const before = s.pellets.length;
  step(s, 1, () => keepFed(s));
  eq(s.pellets.length, before, "no pellets dropped after release");
});

test("hold-to-feed: pointerupoutside ends the hold too", () => {
  const s = makeScene();
  s.onPointerDown({ x: 850, y: 150 });
  s.onPointerUp({ x: -50, y: -50 }); // released outside the canvas
  eq(s.feedHold, false, "hold cleared on outside release");
});

test("hold-to-feed: pausing stops the drops; unpausing resumes the hold", () => {
  const s = makeScene();
  s.onPointerDown({ x: 850, y: 150 });
  s.paused = true;
  const before = s.pellets.length;
  step(s, 0.5, () => keepFed(s));
  eq(s.pellets.length, before, "paused: no drops");
  eq(s.feedHold, true, "hold survives the pause");
  s.paused = false;
  step(s, 0.5, () => keepFed(s));
  assert(s.pellets.length > before, "unpaused: the held stream resumes");
});

test("hold-to-feed: pointer over the shop pauses the stream, back over water resumes", () => {
  const s = makeScene();
  s.onPointerDown({ x: 850, y: 150 });
  s.pointerY = 500; // slid down onto the shop bar
  const before = s.pellets.length;
  step(s, 0.5, () => keepFed(s));
  eq(s.pellets.length, before, "over the shop: no drops");
  eq(s.feedHold, true, "shop hover pauses but does not cancel the hold");
  s.pointerY = 150; // back over open water
  step(s, 0.5, () => keepFed(s));
  assert(s.pellets.length > before, "back over water: drops resume");
});

test("hold-to-feed: pointer over the top bar pauses the stream too", () => {
  const s = makeScene();
  s.onPointerDown({ x: 850, y: 150 });
  s.pointerY = 20;
  const before = s.pellets.length;
  step(s, 0.5, () => keepFed(s));
  eq(s.pellets.length, before, "over the top bar: no drops");
  eq(s.feedHold, true, "hold not cancelled by the top bar");
});

test("hold-to-feed: running out of money cancels the hold (one toast, not spam)", () => {
  const s = makeScene();
  s.money = 4; // exactly two standard pellets
  s.onPointerDown({ x: 850, y: 150 }); // $2
  step(s, 0.5, () => keepFed(s)); // one cadence drop ($2) -> broke
  const spent = s.pellets.length;
  eq(spent, 2, "dropped exactly the two pellets the money allowed");
  eq(s.feedHold, false, "hold cancelled when the drop failed");
  eq(s.money, 0, "no negative money");
  const after = s.pellets.length;
  step(s, 1, () => keepFed(s));
  eq(s.pellets.length, after, "no further drop attempts once broke");
});

test("hold-to-feed: a broke press does not arm the hold", () => {
  const s = makeScene();
  s.money = 0;
  s.onPointerDown({ x: 850, y: 150 });
  eq(s.feedHold, false, "failed drop arms nothing");
  eq(s.pellets.length, 0, "no pellet");
  step(s, 0.5, () => keepFed(s));
  eq(s.pellets.length, 0, "no delayed drops either");
});

test("hold-to-feed: grabbing a fish does not start the hold", () => {
  const s = makeScene();
  const f = s.fish[0];
  s.onPointerDown({ x: f.sprite.x, y: f.sprite.y });
  eq(s.dragFish, f, "fish is grabbed");
  eq(s.feedHold, false, "no hold on a fish press");
  step(s, 0.5, () => keepFed(s));
  eq(s.pellets.length, 0, "no pellets from a fish hold");
});

test("hold-to-feed: a coin press collects but does not arm the hold", () => {
  const s = makeScene();
  s.money = 5000;
  s.spawnFish(850, 150); // park a fed fish that will drop a coin there
  step(s, 10, () => keepFed(s)); // guppies coin every 8s
  const coin = s.coins[s.coins.length - 1];
  s.onPointerDown({ x: coin.container.x, y: coin.container.y });
  eq(s.feedHold, false, "coin click arms nothing");
  eq(s.coins.includes(coin), false, "coin was collected");
});

test("hold-to-feed: holding over water never grabs a fish that swims under the pointer", () => {
  const s = makeScene();
  s.onPointerDown({ x: 850, y: 150 });
  const f = s.fish[0];
  f.sprite.x = 850; f.sprite.y = 150; // fish swims under the held pointer
  step(s, 0.5, () => keepFed(s));
  eq(s.dragFish, null, "no mid-hold grab");
  eq(s.feedHold, true, "still feeding");
  assert(s.pellets.length >= 2, "stream continued");
});

test("hold-to-feed: resetTank clears the hold", () => {
  const s = makeScene();
  s.onPointerDown({ x: 850, y: 150 });
  eq(s.feedHold, true, "armed before reset");
  s.resetTank();
  eq(s.feedHold, false, "hold cleared by reset");
  eq(s.feedHoldTimer, 0, "timer cleared by reset");
});

test("hold-to-feed: 2x speed scales the cadence with everything else", () => {
  const s = makeScene();
  s.speedMult = 2;
  s.onPointerDown({ x: 850, y: 150 });
  step(s, 1, () => keepFed(s));
  // 1 real second = 10 frames; at 2x each frame is 0.2 sim-seconds, so
  // the 0.1s cadence fires on every frame — one drop per frame is the
  // loop's granularity cap. 1 press + 8 frame drops (the first repeat
  // waits out the 0.3s initial delay, frames at 300ms..1000ms).
  eq(s.pellets.length, 9, "1 + 8 pellets at 2x (one per frame), got " + s.pellets.length);
});

// ===========================================================================
// HOLD-REPEAT INITIAL DELAY: the first repeat waits 0.3s of continuous
// hold (CONFIG.holdInitialDelaySec), so a quick tap is EXACTLY one
// action. The old cadence started immediately, so a ~100-150ms click
// dropped TWO $40 plants and charged $80 (found live, 3 of 10 clicks).
// ===========================================================================
test("hold-delay: config key is ~300ms", () => {
  eq(G.CONFIG.holdInitialDelaySec, 0.3, "first repeat after 0.3s of continuous hold");
});

test("hold-delay: a ~150ms press drops exactly one food item", () => {
  const s = makeScene();
  s.onPointerDown({ x: 850, y: 150 });
  step(s, 0.2, () => keepFed(s)); // 200ms — inside the delay, no repeat yet
  eq(s.pellets.length, 1, "one pellet after a 200ms press, got " + s.pellets.length);
  s.onPointerUp({ x: 850, y: 150 });
  step(s, 0.5, () => keepFed(s));
  eq(s.pellets.length, 1, "still one pellet after release — no delayed drop");
  eq(s.money, 200 - 2, "charged for exactly one pellet");
});

test("hold-delay: a ~500ms hold drops several (press + 3 repeats)", () => {
  const s = makeScene();
  s.onPointerDown({ x: 850, y: 150 });
  step(s, 0.5, () => keepFed(s)); // repeats at 300ms, 400ms, 500ms
  eq(s.pellets.length, 4, "press + 3 repeats in 0.5s, got " + s.pellets.length);
  eq(s.feedHold, true, "still holding");
});

test("hold-delay: a quick tap on a $40 plant drops exactly one plant", () => {
  const s = makeScene();
  s.selectFood("plant");
  s.money = 5000;
  s.onPointerDown({ x: 850, y: 150 });
  step(s, 0.2, () => keepFed(s));
  eq(s.feastPlants.length, 1, "one plant after a 200ms press");
  s.onPointerUp({ x: 850, y: 150 });
  step(s, 0.5, () => keepFed(s));
  eq(s.feastPlants.length, 1, "still one plant after release");
  eq(s.money, 5000 - 40, "charged $40, not $80");
});

// ===========================================================================
// SPAM-BUY: holding a fish species button buys repeatedly at the food
// cadence (0.1s, after the 0.3s initial delay), checking money and the
// fish cap on every repeat. One-time purchases do NOT spam.
// ===========================================================================
test("spam-buy: holding the Guppy button buys several fish", () => {
  const s = makeScene();
  s.money = 5000;
  s.guppyBtn.bg._handlers["pointerdown"]();
  eq(s.fish.length, 3, "the press buys one guppy (2 starting + 1)");
  eq(s.feedHold, true, "hold armed by the buy");
  step(s, 0.5, () => keepFed(s)); // repeats at 300ms, 400ms, 500ms
  eq(s.fish.length, 6, "press + 3 repeats = 6 fish, got " + s.fish.length);
  eq(s.money, 5000 - 400, "$400 charged for 4 guppies");
  eq(s.feedHold, true, "still holding");
});

test("spam-buy: a single quick click buys exactly one fish", () => {
  const s = makeScene();
  s.money = 5000;
  s.guppyBtn.bg._handlers["pointerdown"]();
  step(s, 0.2, () => keepFed(s)); // inside the delay — no repeat yet
  eq(s.fish.length, 3, "one guppy after a 200ms press");
  s.guppyBtn.bg._handlers["pointerup"]();
  step(s, 0.5, () => keepFed(s));
  eq(s.fish.length, 3, "still one guppy after release");
  eq(s.money, 5000 - 100, "charged $100 once");
});

test("spam-buy: buying stops at the fish cap and cancels the hold", () => {
  const s = makeScene();
  s.money = 5000;
  s.guppyBtn.bg._handlers["pointerdown"]();
  step(s, 2, () => keepFed(s)); // far more repeats than the cap allows
  eq(s.fish.length, 16, "capped at 16 fish (base cap)");
  eq(s.feedHold, false, "hold cancelled at the cap");
  eq(s.money, 5000 - 14 * 100, "$1,400 charged for the 14 bought guppies");
  step(s, 0.5, () => keepFed(s));
  eq(s.fish.length, 16, "no further buys once capped");
});

test("spam-buy: buying stops when broke and cancels the hold", () => {
  const s = makeScene();
  s.money = 250; // two guppies, then broke
  s.guppyBtn.bg._handlers["pointerdown"]();
  step(s, 0.5, () => keepFed(s));
  eq(s.fish.length, 4, "press + 1 repeat = 4 fish (2 starting + 2 bought)");
  eq(s.money, 50, "$200 spent, $50 left — not enough for a third");
  eq(s.feedHold, false, "hold cancelled when the buy failed");
  step(s, 0.5, () => keepFed(s));
  eq(s.fish.length, 4, "no further buys once broke");
});

test("spam-buy: other species spam too (Emberfin, at its own price)", () => {
  const s = makeScene();
  s.money = 5000;
  s.emberfinBtn.bg._handlers["pointerdown"]();
  step(s, 0.5, () => keepFed(s));
  eq(s.fish.filter((f) => f.species === "emberfin").length, 4, "press + 3 repeats = 4 emberfins");
  eq(s.money, 5000 - 4 * 250, "$1,000 charged for 4 emberfins");
});

test("spam-buy: one-time purchases do NOT spam on hold", () => {
  const s = makeScene();
  s.money = 5000;
  s.snailBtn.bg._handlers["pointerdown"](); // Turbo the snail, $200, one-time
  assert(s.snail !== null, "snail bought once");
  eq(s.feedHold, false, "no hold armed by a one-time purchase");
  step(s, 0.5, () => keepFed(s));
  eq(s.money, 5000 - 200, "charged $200 once, not per frame");
  s.magnetBtn.bg._handlers["pointerdown"](); // Magnet level 1, $400 (drag chain, not a one-time buy)
  eq(s.magnetLevel, 1, "magnet bought once");
  eq(s.feedHold, false, "no hold armed by the magnet either");
  step(s, 0.5, () => keepFed(s));
  eq(s.money, 5000 - 600, "charged $600 total, not per frame");
});

// ===========================================================================
// 13. DEAD FISH: float belly-up, bob, fade, get knocked around
// ===========================================================================
function killFish(scene, fish) {
  // Starve one fish to death on the next frame (the other fish are
  // kept fed by the caller's perStep keepFed).
  fish.hungerSec = 50;
  step(scene, 0.2, () => keepFed(scene));
}
function clearLiveFish(scene) {
  for (const f of [...scene.fish]) { f.sprite.destroy(); if (f.tail) f.tail.destroy(); if (f.hat) f.hat.destroy(); }
  scene.fish = [];
}
test("dead fish: starving spawns one — live fish removed, dead fish present, belly-up", () => {
  const s = makeScene();
  const f = s.fish[0];
  const fx = f.sprite.x, fy = f.sprite.y;
  killFish(s, f);
  assert(!s.fish.includes(f), "dead fish leaves the live list");
  eq(s.fish.length, 1, "one live fish left");
  eq(s.deadFish.length, 1, "one dead fish spawned");
  const d = s.deadFish[0];
  eq(d.species, "guppy");
  eq(d.sprite.texture, "fish-dead-guppy", "grey dead texture, not the live one");
  approx(d.sprite.rotation, Math.PI, 1e-9, "belly-up: rotation PI");
  eq(d.baseScale, 0.6, "dead fish keeps the size it died at");
  approx(d.sprite.scaleX, 0.6, 1e-9, "sprite scale matches");
  eq(d.sprite.x, fx, "spawns where the fish died");
  assert(d.sprite.y < fy, "already rising in the death frame");
  assert(s.toastText.text.indexOf("starved") >= 0, "death toast still shows: " + s.toastText.text);
});
test("dead fish: textures exist for every species", () => {
  const s = makeScene();
  const gen = s._stubs.generated;
  for (const key of ["guppy", "emberfin", "chomper", "starfish"]) {
    assert(gen.includes("fish-dead-" + key), "missing dead texture for " + key);
  }
});
test("dead fish: rises to the surface at ~40 px/s, then bobs at y=56", () => {
  const s = makeScene();
  clearLiveFish(s); // no live fish to knock it while it rises
  const d = s.spawnDeadFish("guppy", 480, 400, 0.6);
  step(s, 1);
  approx(d.sprite.y, 400 - 40, 1, "rose ~40px in 1s, got " + d.sprite.y);
  assert(!d.atSurface, "not at the surface yet");
  step(s, 8); // 400 -> 56 is 344px / 40px/s = ~8.6s total
  assert(d.atSurface, "reached the surface");
  assert(Math.abs(d.sprite.y - G.CONFIG.deadSurfaceY) < 6, "bobs near y=56, got " + d.sprite.y.toFixed(1));
  assert(d.surfaceSec > 0, "surface timer is ticking");
});
test("dead fish: bobs ~10s at the surface, fades over the last 2s, then disappears", () => {
  const s = makeScene();
  clearLiveFish(s);
  const d = s.spawnDeadFish("guppy", 480, 400, 0.6);
  step(s, 9); // reach the surface (~8.6s) + a little bob time
  assert(d.atSurface, "at the surface before the fade test");
  assert(s.deadFish.includes(d), "still there after 7s");
  eq(d.sprite.alpha, 1, "fully opaque before the fade window");
  step(s, 8.5); // surfaceSec ~8.5-9: inside the 2s fade window
  assert(d.sprite.alpha < 1 && d.sprite.alpha > 0, "fading, alpha=" + d.sprite.alpha.toFixed(2));
  assert(s.deadFish.includes(d), "still there while fading");
  step(s, 2); // surfaceSec past 10: gone
  assert(!s.deadFish.includes(d), "dead fish removed after ~10s at the surface");
  assert(d.sprite.destroyed, "sprite destroyed");
});
test("dead fish: a live fish swimming into it nudges it (mild, not a launch)", () => {
  const s = makeScene();
  const d = s.spawnDeadFish("guppy", 480, 200, 0.6);
  // Pin one live fish 20px to the LEFT of the dead fish, swimming
  // into it; park the other far away so it cannot interfere.
  const pusher = s.fish[0];
  pusher.sprite.x = 460; pusher.sprite.y = 200;
  pusher.targetX = 460; pusher.targetY = 200; pusher.wanderTimer = 100;
  const other = s.fish[1];
  other.sprite.x = 100; other.sprite.y = 100;
  other.targetX = 100; other.targetY = 100; other.wanderTimer = 100;
  step(s, 0.5, () => keepFed(s));
  assert(d.sprite.x > 490, "knocked sideways: x=" + d.sprite.x.toFixed(1));
  assert(d.vx > 0, "has knock velocity, vx=" + d.vx.toFixed(1));
  const speed = Math.hypot(d.vx, d.vy);
  assert(speed <= G.CONFIG.deadKnockMaxPxS + 1e-9, "never faster than the cap: " + speed.toFixed(1));
  assert(speed < 200, "a nudge, not a launch: " + speed.toFixed(1) + " px/s");
});
test("dead fish: a knock below the surface floats back up (buoyancy)", () => {
  const s = makeScene();
  clearLiveFish(s);
  const d = s.spawnDeadFish("guppy", 480, 56, 0.6);
  step(s, 0.5); // reach the surface, start bobbing
  assert(d.atSurface, "bobbing at the surface");
  // Shove it down hard, as if a fish knocked it.
  d.sprite.y = 300; d.vy = 0; d.vx = 0;
  step(s, 1);
  assert(d.sprite.y < 300, "buoyancy pulls it back up: y=" + d.sprite.y.toFixed(1));
  step(s, 5);
  assert(Math.abs(d.sprite.y - G.CONFIG.deadSurfaceY) < 6, "back bobbing at the surface, y=" + d.sprite.y.toFixed(1));
});
test("dead fish: not counted in the live list or the fish cap", () => {
  const s = makeScene();
  s.spawnDeadFish("guppy", 480, 200, 0.6);
  s.spawnDeadFish("chomper", 500, 200, 1.56);
  eq(s.fish.length, 2, "live fish count unchanged by dead fish");
  eq(s.deadFish.length, 2, "dead fish tracked separately");
  // Fill the tank to the live cap: dead fish do not free or take slots.
  while (s.fish.length < s.maxFishCap()) s.spawnFish(100, 100, "guppy");
  eq(s.fish.length, s.maxFishCap(), "tank full of LIVE fish");
  s.money = 5000;
  const n = s.fish.length;
  s.buyFish("guppy");
  eq(s.fish.length, n, "cap still blocks buying with dead fish around");
  // And a dead fish never joins the live list by itself.
  assert(!s.fish.some((f) => s.deadFish.includes(f)), "no overlap between the lists");
});
test("dead fish: not clickable — a click on one drops food, never grabs", () => {
  const s = makeScene();
  clearLiveFish(s);
  const d = s.spawnDeadFish("guppy", 480, 200, 0.6);
  const moneyBefore = s.money;
  s.onPointerDown({ x: 480, y: 200 });
  eq(s.dragFish, null, "no grab from a dead fish");
  eq(s.pellets.length, 1, "the click fell through to open water and dropped food");
  eq(s.money, moneyBefore - 2, "food paid for");
  assert(s.deadFish.includes(d), "dead fish untouched by the click");
});
test("dead fish: resetTank clears them", () => {
  const s = makeScene();
  const d = s.spawnDeadFish("guppy", 480, 200, 0.6);
  eq(s.deadFish.length, 1);
  s.resetTank();
  eq(s.deadFish.length, 0, "dead fish cleared by reset");
  assert(d.sprite.destroyed, "dead sprite destroyed by reset");
});
test("dead fish: config timings match the coin fade idea (~10s at rest)", () => {
  eq(G.CONFIG.coinBottomLifeSec, 10, "coin floor life is the reference");
  eq(G.CONFIG.deadSurfaceLifeSec, 10, "dead fish surface life matches it");
  eq(G.CONFIG.deadKnockRadiusPx, 40, "knock radius 40px");
  assert(G.CONFIG.deadKnockMaxPxS <= 100, "knock speed cap stays mild");
});

// ===========================================================================
// 14. RANDOM EVENTS: Glowing Jellyfish, Coin Rush, Treasure Chest
// ===========================================================================
test("events: no event before Start — the title screen stays quiet", () => {
  const s = makeTitleScene();
  step(s, 300); // 5 minutes of title screen
  eq(s.activeEvent, null, "no active event");
  eq(s.jellyfish, null, "no jellyfish");
  eq(s.chest, null, "no chest");
  eq(s.coinRushSec, 0, "no rush");
});
test("events: no event while paused", () => {
  const s = makeScene();
  s.paused = true;
  s.eventTimerSec = 0.1; // would fire immediately if the loop ran
  step(s, 200);
  eq(s.activeEvent, null, "paused: scheduler never runs");
  eq(s.jellyfish, null, "no jellyfish while paused");
});
test("events: first event is armed 60-90s after Start", () => {
  const s = makeScene();
  assert(s.eventTimerSec >= G.CONFIG.eventFirstMinSec && s.eventTimerSec <= G.CONFIG.eventFirstMaxSec,
    "first timer in [60, 90], got " + s.eventTimerSec.toFixed(1));
  eq(G.CONFIG.eventFirstMinSec, 60, "first event no earlier than 60s");
  eq(G.CONFIG.eventFirstMaxSec, 90, "first event no later than 90s");
  eq(G.CONFIG.eventGapMinSec, 120, "gap after an event: 120s min");
  eq(G.CONFIG.eventGapMaxSec, 240, "gap after an event: 240s max");
});
test("events: an event fires when the timer expires", () => {
  const s = makeScene();
  s.eventTimerSec = 0.5;
  step(s, 0.2);
  eq(s.activeEvent, null, "not yet");
  step(s, 1);
  assert(["jelly", "rush", "chest"].includes(s.activeEvent), "an event fired: " + s.activeEvent);
});
test("events: never more than one active at a time (long sim)", () => {
  const s = makeScene();
  s.eventTimerSec = 0.5; // fire the first one right away
  for (let i = 0; i < 1000; i++) {
    step(s, 0.1, () => keepFed(s));
    const active = (s.jellyfish ? 1 : 0) + (s.chest ? 1 : 0) + (s.coinRushSec > 0 ? 1 : 0);
    assert(active <= 1, "overlap at t=" + (i * 0.1).toFixed(1) + "s: " + active + " active");
    assert(s.activeEvent === null || ["jelly", "rush", "chest"].includes(s.activeEvent), "bad activeEvent: " + s.activeEvent);
  }
});
test("events: chest and jellyfish textures are generated", () => {
  const s = makeScene();
  assert(s._stubs.generated.includes("chest-event"), "missing chest-event texture");
  assert(s._stubs.generated.includes("jellyfish"), "missing jellyfish texture");
  assert(s._stubs.generated.includes("jelly-burst"), "missing jelly-burst texture");
});

// --- Glowing Jellyfish ---
test("glowing jellyfish: drifts in with its pulsing starburst, never a real fish", () => {
  const s = makeScene();
  s.startEvent("jelly");
  eq(s.activeEvent, "jelly", "jellyfish event active");
  const j = s.jellyfish;
  assert(j, "jellyfish object exists");
  eq(j.sprite.texture, "jellyfish", "jellyfish texture");
  assert(j.burst, "starburst object exists");
  eq(j.burst.texture, "jelly-burst", "starburst texture");
  eq(s.fish.length, 2, "live fish count unchanged");
  assert(!s.fish.some((f) => f.sprite === j.sprite), "jellyfish is not in the live list");
});
test("glowing jellyfish: bell and burst pulse in sync", () => {
  const s = makeScene();
  s.startEvent("jelly");
  const j = s.jellyfish;
  eq(j.pulsePhase, 0, "pulse starts at 0");
  eq(j.sprite.scaleX, 1, "bell starts unscaled");
  eq(j.burst.scaleX, 1, "burst starts unscaled");
  eq(j.burst.alpha, 0.55, "burst starts dim");
  step(s, 0.5);
  approx(j.pulsePhase, 1.5, 0.01, "pulse phase advanced 0.5s * 3 rad/s");
  assert(Math.abs(j.sprite.scaleX - 1) > 0.05, "bell scale breathed, got " + j.sprite.scaleX.toFixed(3));
  assert(Math.abs(j.burst.scaleX - 1) > 0.1, "burst scale breathed, got " + j.burst.scaleX.toFixed(3));
  assert(j.burst.alpha > 0.8, "burst brightened with the pulse, got " + j.burst.alpha.toFixed(3));
});
test("glowing jellyfish: one click bursts it into five $5 coins, no food, no grab", () => {
  const s = makeScene();
  s.startEvent("jelly");
  const j = s.jellyfish;
  // Park the live fish far away so the click can't hit one instead.
  for (const f of s.fish) { f.sprite.x = 100; f.sprite.y = 100; f.targetX = 100; f.targetY = 100; f.wanderTimer = 100; }
  j.sprite.x = 480; j.sprite.y = 200; j.baseY = 200;
  j.burst.x = 480; j.burst.y = 200;
  const moneyBefore = s.money;
  s.onPointerDown({ x: 480, y: 200 });
  eq(s.coins.length, 5, "five coins burst out");
  assert(s.coins.every((c) => c.value === 5), "every burst coin is $5");
  eq(s.coins.reduce((t, c) => t + c.value, 0), 25, "$25 total, like the guppy gave");
  eq(s.pellets.length, 0, "no food dropped by the click");
  eq(s.dragFish, null, "no grab");
  eq(s.money, moneyBefore, "money only changes when the coins are collected");
  eq(s.jellyfish, null, "the jellyfish burst — it's gone");
  eq(s.activeEvent, null, "event ended with the burst");
});
test("glowing jellyfish: unclicked it drifts off after ~15s with no coins", () => {
  const s = makeScene();
  s.startEvent("jelly");
  const moneyBefore = s.money;
  step(s, 17, () => keepFed(s));
  eq(s.jellyfish, null, "jellyfish left");
  eq(s.activeEvent, null, "event ended");
  // The live fish still drop their normal $1 coins during the visit —
  // the assertion is only that none of them is a $5 burst coin.
  assert(!s.coins.some((c) => c.value === 5), "no $5 burst coin when ignored");
  eq(s.money, moneyBefore, "no money when ignored");
  assert(s.eventTimerSec >= G.CONFIG.eventGapMinSec && s.eventTimerSec <= G.CONFIG.eventGapMaxSec,
    "gap timer re-armed in [120, 240], got " + s.eventTimerSec.toFixed(1));
});

// --- Coin Rush ---
test("coin rush: doubles coin drops for 20s, then ends", () => {
  const s = makeScene();
  clearLiveFish(s);
  const f = s.spawnFish(480, 200, "guppy");
  f.coinTimer = 0;
  // Control: no rush, 4s is half a coin cycle — no coin yet.
  step(s, 4);
  eq(s.coins.length, 0, "no coin after 4s without a rush");
  // Rush: the same 4s is a full cycle at 2x.
  s.startEvent("rush");
  eq(s.coinRushSec, 20, "rush lasts 20s");
  step(s, 4, () => keepFed(s));
  eq(s.coins.length, 1, "one coin after 4s at 2x");
  // The description bar shows the countdown while it runs.
  assert(s.descBarText.text.indexOf("Coin Rush") >= 0, "countdown visible: " + s.descBarText.text);
  step(s, 17, () => keepFed(s)); // past 20s total
  eq(s.coinRushSec, 0, "rush over");
  eq(s.activeEvent, null, "event ended");
  eq(s.descBarText.text, G.DESC_DEFAULT_TEXT, "description bar back to normal");
});
test("coin rush: config timings", () => {
  eq(G.CONFIG.coinRushSec, 20, "20s rush");
  eq(G.CONFIG.jellyfishCoins, 5, "jellyfish bursts into 5 coins");
  eq(G.CONFIG.jellyfishCoinValue, 5, "each burst coin is $5");
});

// --- Treasure Chest ---
test("chest: reward roll is $50 / $100 / guppy, money-only at the cap", () => {
  const s = makeScene();
  eq(s.chestRewardFor(0.1, false).value, 50, "roll 0.1 -> $50");
  eq(s.chestRewardFor(0.5, false).value, 100, "roll 0.5 -> $100");
  eq(s.chestRewardFor(0.9, false).type, "guppy", "roll 0.9 -> free guppy");
  eq(s.chestRewardFor(0.9, true).type, "money", "roll 0.9 at cap -> money instead");
  eq(s.chestRewardFor(0.9, true).value, 100, "at-cap fallback is $100");
});
test("chest: floats up, bobs, and sinks away unclicked after 12s with no reward", () => {
  const s = makeScene();
  const moneyBefore = s.money;
  const fishBefore = s.fish.length;
  s.startEvent("chest");
  eq(s.activeEvent, "chest", "chest event active");
  const c = s.chest;
  assert(c, "chest object exists");
  approx(c.sprite.y, G.CONFIG.floorY, 1, "spawns on the floor");
  step(s, 4, () => keepFed(s)); // 188px up at 60 px/s is ~3.1s
  assert(Math.abs(c.sprite.y - G.CONFIG.chestBobY) < 8, "floated up to its bob height, y=" + c.sprite.y.toFixed(1));
  step(s, 9, () => keepFed(s)); // past 12s total
  eq(s.chest, null, "chest sank away");
  eq(s.activeEvent, null, "event ended");
  eq(s.money, moneyBefore, "no reward when ignored");
  eq(s.fish.length, fishBefore, "no free fish when ignored");
});
test("chest: clicking opens it — $50 / $100 / free guppy by the roll", () => {
  const origRandom = Math.random;
  try {
    const s = makeScene();
    Math.random = () => 0.1;
    s.startEvent("chest");
    const moneyBefore = s.money;
    s.openChest();
    eq(s.chest, null, "chest gone after opening");
    eq(s.money, moneyBefore + 50, "roll 0.1 pays $50");
    eq(s.activeEvent, null, "event ended");
    Math.random = () => 0.5;
    s.startEvent("chest");
    s.openChest();
    eq(s.money, moneyBefore + 150, "roll 0.5 pays $100 on top");
    Math.random = () => 0.9;
    s.startEvent("chest");
    const fishBefore = s.fish.length;
    s.openChest();
    eq(s.fish.length, fishBefore + 1, "roll 0.9 gives a free guppy");
    eq(s.money, moneyBefore + 150, "the guppy is free");
  } finally {
    Math.random = origRandom;
  }
});
test("chest: clicking it through the pointer dispatcher opens it, never drops food", () => {
  const s = makeScene();
  s.startEvent("chest");
  const c = s.chest;
  for (const f of s.fish) { f.sprite.x = 100; f.sprite.y = 100; f.targetX = 100; f.targetY = 100; f.wanderTimer = 100; }
  const moneyBefore = s.money;
  const fishBefore = s.fish.length;
  s.onPointerDown({ x: c.sprite.x, y: c.sprite.y });
  eq(s.chest, null, "chest opened by the click");
  eq(s.pellets.length, 0, "no food dropped by the click");
  const rewarded = s.money === moneyBefore + 50 || s.money === moneyBefore + 100 || s.fish.length === fishBefore + 1;
  assert(rewarded, "a valid reward was paid (money=" + s.money + ", fish=" + s.fish.length + ")");
});
test("chest: at the fish cap every open pays money, never a fish", () => {
  const s = makeScene();
  while (s.fish.length < s.maxFishCap()) s.spawnFish(100, 100, "guppy");
  eq(s.fish.length, s.maxFishCap(), "tank full");
  const moneyBefore = s.money;
  for (let i = 0; i < 5; i++) {
    s.startEvent("chest");
    s.openChest();
    eq(s.fish.length, s.maxFishCap(), "still no new fish at the cap (open " + (i + 1) + ")");
  }
  assert(s.money > moneyBefore, "money was paid instead");
});

// --- Scheduler / reset ---
test("events: resetTank clears any active event and re-arms the clock", () => {
  const s = makeScene();
  s.startEvent("jelly");
  assert(s.jellyfish, "jellyfish active before reset");
  s.resetTank();
  eq(s.jellyfish, null, "jellyfish cleared by reset");
  eq(s.chest, null, "chest cleared by reset");
  eq(s.coinRushSec, 0, "rush cleared by reset");
  eq(s.activeEvent, null, "no active event after reset");
  assert(s.eventTimerSec >= G.CONFIG.eventFirstMinSec && s.eventTimerSec <= G.CONFIG.eventFirstMaxSec,
    "clock re-armed to first-event range, got " + s.eventTimerSec.toFixed(1));
  s.startEvent("rush");
  s.resetTank();
  eq(s.coinRushSec, 0, "rush cleared by reset too");
  eq(s.descBarText.text, G.DESC_DEFAULT_TEXT, "description bar reset");
});

// --- Rescue mode: the empty-tank soft-lock ---
// The lock is exactly "no fish AND can't afford the cheapest fish"
// (a guppy, $100). In that state the scheduler fires a guaranteed
// rescue chest in 5-10s; the rescue chest always holds a free baby
// guppy plus a top-up to $10 (never +$10 — it can't be farmed).
test("rescue: soft-lock is empty tank AND money under $100, nothing else", () => {
  const s = makeScene();
  clearLiveFish(s);
  s.money = 0;
  assert(s.isSoftLocked(), "empty + $0 is locked");
  s.money = 99;
  assert(s.isSoftLocked(), "empty + $99 is locked");
  s.money = 100;
  assert(!s.isSoftLocked(), "empty + $100 can buy a guppy — not locked");
  s.money = 0;
  s.spawnFish(480, 200, "guppy");
  assert(!s.isSoftLocked(), "a live fish means income — not locked, even at $0");
});
test("rescue: in rescue mode the scheduler fires a rescue chest in 5-10s", () => {
  const s = makeScene();
  clearLiveFish(s);
  s.money = 0;
  s.eventTimerSec = 0.5; // fire right away
  step(s, 1);
  eq(s.activeEvent, "chest", "rescue fires a chest");
  assert(s.chest && s.chest.rescue, "the chest is a rescue chest");
});
test("rescue: the next timer is 5-10s while locked, normal once a fish exists", () => {
  const s = makeScene();
  clearLiveFish(s);
  s.money = 0;
  s.resetEventTimer(false);
  assert(s.eventTimerSec >= G.CONFIG.rescueDelayMinSec && s.eventTimerSec <= G.CONFIG.rescueDelayMaxSec,
    "rescue delay in [5, 10], got " + s.eventTimerSec.toFixed(1));
  s.spawnFish(480, 200, "guppy");
  s.resetEventTimer(false);
  assert(s.eventTimerSec >= G.CONFIG.eventGapMinSec && s.eventTimerSec <= G.CONFIG.eventGapMaxSec,
    "normal gap in [120, 240] once a fish exists, got " + s.eventTimerSec.toFixed(1));
});
test("rescue: the rescue chest always gives a free guppy + top-up to $10", () => {
  const s = makeScene();
  clearLiveFish(s);
  // $0 -> guppy + $10.
  s.money = 0;
  s.startEvent("chest", true);
  s.openChest();
  eq(s.fish.length, 1, "a free guppy joins");
  eq(s.money, 10, "$0 topped up to $10");
  eq(s.activeEvent, null, "event ended");
  // $8 -> guppy + $2 top-up (lands on $10, not $18).
  clearLiveFish(s);
  s.money = 8;
  s.startEvent("chest", true);
  s.openChest();
  eq(s.fish.length, 1, "another free guppy");
  eq(s.money, 10, "$8 topped up to $10, not +$10");
  // $50 -> guppy, money untouched (already above $10).
  clearLiveFish(s);
  s.money = 50;
  s.startEvent("chest", true);
  s.openChest();
  eq(s.fish.length, 1, "free guppy at $50 too");
  eq(s.money, 50, "$50 stays $50 — no top-up needed");
  // The top-up is a grant, not collected income: it never counts
  // toward the $1,000 goal.
  eq(s.totalBanked, 0, "rescue top-up does not count toward the goal");
});
test("rescue: an ignored rescue chest is followed by another one quickly", () => {
  const s = makeScene();
  clearLiveFish(s);
  s.money = 0;
  s.startEvent("chest", true);
  step(s, 12.5, () => keepFed(s)); // past the chest's 12s life, unclicked
  eq(s.chest, null, "first rescue chest sank away");
  eq(s.activeEvent, null, "event ended");
  // Re-armed to a rescue delay, minus up to ~0.5s that ticked after
  // the chest ended mid-step.
  assert(s.eventTimerSec >= G.CONFIG.rescueDelayMinSec - 1 && s.eventTimerSec <= G.CONFIG.rescueDelayMaxSec,
    "still locked: next rescue in ~[5, 10], got " + s.eventTimerSec.toFixed(1));
  step(s, 11); // the next rescue chest fires
  eq(s.activeEvent, "chest", "a second rescue chest fires");
  assert(s.chest && s.chest.rescue, "still a rescue chest");
});
test("rescue: after the rescue the scheduler returns to normal gaps", () => {
  const s = makeScene();
  clearLiveFish(s);
  s.money = 0;
  s.startEvent("chest", true);
  s.openChest(); // free guppy + $10 — the lock is over
  assert(!s.isSoftLocked(), "a fish again: not locked");
  assert(s.eventTimerSec >= G.CONFIG.eventGapMinSec && s.eventTimerSec <= G.CONFIG.eventGapMaxSec,
    "normal gap in [120, 240] after rescue, got " + s.eventTimerSec.toFixed(1));
  // ...but the normal gap only holds while the fish lives: once the
  // rescue fish starves, the scheduler clamps back to a rescue delay
  // instead of leaving a broke, fishless player waiting out the long gap.
  const f = s.fish[0];
  f.hungerSec = 50; // starves on the next frame
  step(s, 0.5);
  assert(s.fish.length === 0, "rescue fish starved");
  assert(s.isSoftLocked(), "empty + $10: locked again");
  assert(s.eventTimerSec <= G.CONFIG.rescueDelayMaxSec,
    "timer clamped to a rescue delay, got " + s.eventTimerSec.toFixed(1));
  step(s, 11);
  eq(s.activeEvent, "chest", "a second rescue chest fires");
  assert(s.chest && s.chest.rescue, "still a rescue chest");
});
test("rescue: if the rescued fish dies mid-gap, the next rescue chest comes within 10s of the tank emptying", () => {
  const s = makeScene();
  clearLiveFish(s);
  s.money = 0;
  // First rescue: open the chest, get the guppy + $10. The scheduler
  // re-arms to a normal 120-240s gap, because the player has a fish.
  s.startEvent("chest", true);
  s.openChest();
  eq(s.fish.length, 1, "rescue guppy joins");
  eq(s.money, 10, "$0 topped up to $10");
  // Let the rescue fish starve — no feeding, no coin collection —
  // and measure from the moment the tank empties to the next rescue
  // chest. Before the fix this waited out the long normal gap
  // (70-190s); after it, the scheduler clamps to a rescue delay.
  let tEmpty = null, tRescue = null;
  step(s, 400, (t) => {
    if (tEmpty === null && s.fish.length === 0) tEmpty = t;
    if (tEmpty !== null && tRescue === null && s.activeEvent === "chest" && s.chest && s.chest.rescue) tRescue = t;
  });
  assert(tEmpty !== null, "the rescue fish starved within the sim");
  assert(tRescue !== null, "a second rescue chest fired within the sim");
  const wait = tRescue - tEmpty;
  assert(wait <= 10, "second rescue within 10s of the tank emptying, took " + wait.toFixed(1) + "s");
});
test("rescue: a soft-locked timer already under the rescue delay is not pushed out", () => {
  const s = makeScene();
  clearLiveFish(s);
  s.money = 0;
  s.eventTimerSec = 2; // already short — the clamp must leave it alone
  step(s, 3);
  eq(s.activeEvent, "chest", "rescue chest still fires on the short timer");
  assert(s.chest && s.chest.rescue, "still a rescue chest");
});
test("rescue: a non-locked player keeps normal gaps (no clamp)", () => {
  const s = makeScene();
  // Fish alive, $200: run a normal event, let it end, check the gap.
  s.startEvent("jelly");
  // Capture the gap the moment the event ends — the timer ticks
  // down from the 120-240s roll for the rest of the step, so
  // asserting on the value after a fixed 25s is a race (a low roll
  // ticks below 120 before the check runs; it failed ~3 in 12 runs
  // on the pristine tree).
  let gapAtEnd = null;
  step(s, 25, () => { keepFed(s); if (gapAtEnd === null && s.activeEvent === null) gapAtEnd = s.eventTimerSec; });
  eq(s.activeEvent, null, "jellyfish event ended");
  assert(gapAtEnd !== null, "event ended during the step");
  assert(gapAtEnd >= G.CONFIG.eventGapMinSec && gapAtEnd <= G.CONFIG.eventGapMaxSec,
    "normal gap in [120, 240] after a normal event, got " + gapAtEnd.toFixed(1));
  // 100s more with the tank healthy: still no event — the gap was
  // not shortened by anything.
  step(s, 100, () => keepFed(s));
  eq(s.activeEvent, null, "no event fires early on a normal gap");
  assert(s.eventTimerSec > 0, "timer still counting down, got " + s.eventTimerSec.toFixed(1));
});
test("rescue: a normal chest never pays the rescue reward", () => {
  const s = makeScene();
  clearLiveFish(s);
  s.money = 0;
  // A normal chest while locked would be a bug — but even if one
  // spawned, its roll must not top money up to $10 or grant a fish
  // for free outside the roll. Roll 0.1 pays $50, nothing else.
  const origRandom = Math.random;
  try {
    Math.random = () => 0.1;
    s.startEvent("chest"); // not a rescue chest
    s.openChest();
    eq(s.money, 50, "normal chest roll pays $50");
    eq(s.fish.length, 0, "no free guppy from a normal chest roll");
  } finally {
    Math.random = origRandom;
  }
});

// ===========================================================================
// 15. DYNAMIC FISH SPEEDS: per-fish tempo, hunger pace, food sprint
// ===========================================================================
// One fish, alone in the tank, tempo pinned to 1, mid hunger (10s —
// neither hungry nor just-fed), steering at a fixed target. The two
// starting guppies are parked far away with a permanent eat cooldown
// so they never touch the test pellet.
function sprintScene() {
  const s = makeScene();
  for (const f of s.fish) {
    f.sprite.x = 100; f.sprite.y = 100;
    f.targetX = 100; f.targetY = 100; f.wanderTimer = 100;
    f.eatCooldownSec = 999;
  }
  const f = s.spawnFish(480, 150, "guppy");
  f.tempo = 1;
  // Pin the trait to Social — the neutral one (no chase, sprint, or
  // tempo effect) — so these sprint tests never flake on a random
  // Bold roll (Bold sprints from 30px, and its cooldown is 1.5s).
  f.trait = "social";
  f.hungerSec = 10; f.lastFedSec = 10;
  f.targetX = 480; f.targetY = 150; f.wanderTimer = 100;
  return { scene: s, fish: f };
}
test("speeds: tuning constants are the agreed numbers", () => {
  const C = G.CONFIG;
  eq(C.tempoMin, 0.85); eq(C.tempoMax, 1.2);
  eq(C.hungrySpeedMult, 1.25); eq(C.fedSpeedMult, 0.9); eq(C.fedSpeedWindowSec, 5);
  eq(C.sprintMinPx, 40); eq(C.sprintMaxPx, 120);
  eq(C.sprintMult, 1.8); eq(C.sprintMaxSec, 1.5); eq(C.sprintCooldownSec, 3);
});
test("speeds: tempo rolls in [0.85, 1.2] and same-species fish differ", () => {
  const s = makeScene();
  const tempos = [];
  for (let i = 0; i < 30; i++) tempos.push(s.spawnFish(100 + i * 20, 200, "guppy").tempo);
  for (const t of tempos) assert(t >= G.CONFIG.tempoMin && t <= G.CONFIG.tempoMax, "tempo " + t + " out of range");
  const spread = Math.max(...tempos) - Math.min(...tempos);
  assert(spread > 0.05, "30 guppies should not all share one tempo (spread " + spread + ")");
});
test("speeds: fishSpeed is base x tempo x state", () => {
  const s = makeScene();
  const f = s.spawnFish(480, 200, "guppy");
  f.tempo = 1;
  f.hungerSec = 25; // hungry (>= 20s)
  approx(s.fishSpeed(f), 45 * 1.25, 1e-9, "hungry guppy");
  f.hungerSec = 2; // just fed (< 5s)
  approx(s.fishSpeed(f), 45 * 0.9, 1e-9, "just-fed guppy");
  f.hungerSec = 10; // in between
  approx(s.fishSpeed(f), 45, 1e-9, "mid-state guppy");
  f.tempo = 1.2;
  approx(s.fishSpeed(f), 45 * 1.2, 1e-9, "tempo applies");
});
test("speeds: hungry fish outswims a just-fed fish at the same tempo", () => {
  const s = makeScene();
  // Clear the starters so separation can't nudge the measurement.
  clearLiveFish(s);
  const f = s.spawnFish(100, 200, "guppy");
  f.tempo = 1;
  f.targetX = 900; f.targetY = 200; f.wanderTimer = 100;
  // Hungry: hungerSec 25 (>= 20) — 1.25x.
  f.hungerSec = 25; f.lastFedSec = 25;
  const x0 = f.sprite.x;
  step(s, 1);
  const dHungry = f.sprite.x - x0;
  // Just fed: hungerSec 2 (< 5) — 0.9x. Same fish, same tempo.
  f.sprite.x = 100; f.hungerSec = 2; f.lastFedSec = 2;
  f.targetX = 900; f.targetY = 200; f.wanderTimer = 100;
  const x1 = f.sprite.x;
  step(s, 1);
  const dFed = f.sprite.x - x1;
  approx(dHungry, 45 * 1.25, 3, "hungry guppy ~56px in 1s, got " + dHungry);
  approx(dFed, 45 * 0.9, 3, "just-fed guppy ~40px in 1s, got " + dFed);
  assert(dHungry > dFed * 1.2, "hungry clearly faster: " + dHungry + " vs " + dFed);
});
test("speeds: sprint triggers for a sinking pellet 40-120px away", () => {
  const { scene: s, fish: f } = sprintScene();
  s.dropPelletAt(480 + 80, 150, 1, false); // 80px to the right
  step(s, 0.1);
  assert(f.sprintSec > 0, "sprint started, sprintSec=" + f.sprintSec);
  assert(f.wiggleFreq > 15, "wag is frantic while sprinting, wiggleFreq=" + f.wiggleFreq);
});
test("speeds: no sprint for a pellet closer than 40px, farther than 120px, or on the floor", () => {
  // Closer than 40px.
  let t = sprintScene();
  t.scene.dropPelletAt(480 + 30, 150, 1, false);
  step(t.scene, 0.1);
  eq(t.fish.sprintSec, 0, "30px pellet: no sprint");
  // Farther than 120px.
  t = sprintScene();
  t.scene.dropPelletAt(480 + 200, 150, 1, false);
  step(t.scene, 0.1);
  eq(t.fish.sprintSec, 0, "200px pellet: no sprint");
  // A floor pellet in the window: landed flag set.
  t = sprintScene();
  t.scene.dropPelletAt(480 + 80, 150, 1, false);
  const p = t.scene.pellets[t.scene.pellets.length - 1];
  p.landed = true; p.vy = 0;
  step(t.scene, 0.1);
  eq(t.fish.sprintSec, 0, "landed pellet: no sprint");
});
test("speeds: sprint lasts at most 1.5s, then the ~3s cooldown blocks a re-trigger", () => {
  const { scene: s, fish: f } = sprintScene();
  s.dropPelletAt(480 + 80, 150, 1, false);
  const p = s.pellets[s.pellets.length - 1];
  // Hold the pellet 80px to the right of the fish every frame, so
  // the window never closes for any other reason — only the timer
  // can end the burst.
  const hold = () => { p.sprite.x = f.sprite.x + 80; p.sprite.y = f.sprite.y; };
  step(s, 0.1, hold);
  assert(f.sprintSec > 0, "sprint started");
  step(s, 1.6, hold);
  eq(f.sprintSec, 0, "burst ended within 1.5s + one frame");
  assert(f.sprintCooldownSec > 0, "cooldown started, " + f.sprintCooldownSec.toFixed(2) + "s left");
  // Pellet still in the window, but the cooldown must block a sprint.
  step(s, 0.2, hold);
  eq(f.sprintSec, 0, "no re-sprint during cooldown");
});
test("speeds: speed returns to normal after the burst, and a sprint can start again after the cooldown", () => {
  const { scene: s, fish: f } = sprintScene();
  s.dropPelletAt(480 + 80, 150, 1, false);
  const p = s.pellets[s.pellets.length - 1];
  const hold = () => { p.sprite.x = f.sprite.x + 80; p.sprite.y = f.sprite.y; };
  step(s, 0.1, hold);
  assert(f.sprintSec > 0, "sprint started");
  step(s, 1.6, hold);
  eq(f.sprintSec, 0, "burst over");
  // Cruise for 0.5s with the pellet still in the window (cooldown
  // active): back to base speed, not sprint speed.
  const x0 = f.sprite.x;
  step(s, 0.5, hold);
  const dCruise = f.sprite.x - x0;
  approx(dCruise, 45 * 0.5, 3, "cruising at base speed after the burst, got " + dCruise);
  // Wait out the cooldown with the pellet still in range: a fresh
  // sprint must start again.
  step(s, 3.1, hold);
  assert(f.sprintSec > 0, "sprint starts again after the cooldown");
});
test("speeds: a sprinting starfish is still slow in absolute terms", () => {
  const s = makeScene();
  clearLiveFish(s);
  const st = s.spawnFish(200, 350, "starfish");
  st.tempo = 1;
  // Pin the trait to Social (neutral chase speed) — a Greedy
  // starfish would outswim the 22.5px expectation by 1.15x.
  st.trait = "social";
  st.hungerSec = 10; st.lastFedSec = 10;
  st.targetX = 200; st.targetY = 350; st.wanderTimer = 100;
  s.dropPelletAt(280, 350, 1, false);
  const p = s.pellets[s.pellets.length - 1];
  const hold = () => { p.sprite.x = st.sprite.x + 80; p.sprite.y = st.sprite.y; };
  step(s, 0.1, hold);
  assert(st.sprintSec > 0, "starfish sprints");
  const x0 = st.sprite.x;
  step(s, 0.5, hold);
  const d = st.sprite.x - x0;
  approx(d, 25 * 1.8 * 0.5, 3, "sprinting starfish ~22.5px in 0.5s, got " + d);
  assert(d < 30, "starfish burst stays slow in absolute terms");
});
test("speeds: tail wag is faster during a sprint than at rest", () => {
  const { scene: s, fish: f } = sprintScene();
  // At rest (wandering, no pellet): wag is the base 6 x speed ratio.
  step(s, 0.1);
  const restFreq = f.wiggleFreq;
  // Now a pellet in the window: sprinting wag.
  s.dropPelletAt(f.sprite.x + 80, f.sprite.y, 1, false);
  step(s, 0.1);
  assert(f.sprintSec > 0, "sprint started");
  assert(f.wiggleFreq > restFreq * 2, "sprint wag " + f.wiggleFreq + " vs rest wag " + restFreq);
});
test("speeds: the hunt is still 3x the hunter's effective speed", () => {
  const s = makeScene();
  clearLiveFish(s);
  const hunter = s.spawnFish(400, 200, "chomper");
  hunter.feeds = 8; hunter.stage = 2; s.setFishStageVisual(hunter);
  hunter.tempo = 1; hunter.hungerSec = 25; hunter.lastFedSec = 25;
  const baby = s.spawnFish(460, 200, "guppy");
  baby.targetX = 460; baby.targetY = 200; baby.wanderTimer = 100;
  // 0.2s at 30 x 1.25 x 3 = 112.5px/s closes 22.5px of the 60px
  // gap — the baby is still alive, the hunter just got faster.
  const x0 = hunter.sprite.x;
  step(s, 0.2);
  const d = hunter.sprite.x - x0;
  approx(d, 30 * 1.25 * 3 * 0.2, 3, "hunting chomper ~22.5px in 0.2s, got " + d);
  assert(s.fish.includes(baby), "baby still alive after 0.2s");
});

// ===========================================================================
// 16. FOOD PANEL + FEAST PLANT + UNCAP FISH
// ===========================================================================
test("food panel: plant tuning constants are the agreed numbers", () => {
  const C = G.CONFIG;
  eq(C.plantCost, 40); eq(C.plantNibbles, 30); eq(C.plantSinkPxS, 25);
  eq(C.plantChewSec, 1.5); eq(C.plantGlobalSec, 0.4); eq(C.plantScale, 3);
  eq(C.plantMax, undefined, "no plant cap any more");
  eq(C.plantNibbleRangePx, 50); eq(C.plantFrondEvery, 5);
  eq(C.feedHoldIntervalSec, 0.1, "hold cadence unchanged for plants — same as pellets");
});
test("food panel: Food button shows the current selection; selectFood switches it", () => {
  const s = makeScene();
  eq(s.foodType, "standard", "default is standard");
  eq(s.foodBtn.text.text, "Food: Std", "button label matches");
  eq(s.foodBtn.icon.text, "🍤", "button icon matches");
  s.selectFood("deluxe");
  eq(s.foodType, "deluxe");
  eq(s.foodBtn.text.text, "Food: Dlx");
  eq(s.foodBtn.icon.text, "✨");
  s.selectFood("plant");
  eq(s.foodType, "plant");
  eq(s.foodBtn.text.text, "Food: Plant");
  eq(s.foodBtn.icon.text, "🌿");
});
test("food panel: open, pick a row, selects and closes (unlike Decor, which stays open)", () => {
  const s = makeScene();
  assert(s.foodPanel === null, "panel starts closed");
  s.foodBtn.bg._handlers["pointerdown"]();
  assert(s.foodPanel !== null, "Food click opens the panel");
  assert(s.foodPanelBounds !== null, "panel has a hit rect");
  eq(s.foodPanelBounds.x0, 0, "panel flush with the left edge");
  eq(s.foodPanelBounds.x1, 300, "panel 300 wide");
  assert(s.foodPanelBounds.y1 < G.SHOP.row1Y - G.SHOP.btnH / 2,
    "panel bottom (" + s.foodPanelBounds.y1 + ") clears the top of the row-1 buttons");
  assert(s.foodPanel.rows.standard && s.foodPanel.rows.deluxe && s.foodPanel.rows.plant, "three rows");
  assert(s.foodPanel.rows.standard.label.text.indexOf("✓") >= 0, "selected row checked: " + s.foodPanel.rows.standard.label.text);
  assert(s.foodPanel.rows.plant.label.text.indexOf("$40") >= 0, "plant row shows its price");
  assert(s.foodPanel.rows.plant.label.text.indexOf("30 nibbles") >= 0, "plant row shows the nibbles");
  // Pick the plant row: selection applies and the panel CLOSES.
  s.foodPanel.rows.plant.rect._handlers["pointerdown"]();
  eq(s.foodType, "plant", "row selection applied");
  eq(s.foodPanel, null, "panel closed on selection");
  eq(s.foodPanelBounds, null, "bounds cleared");
  // Toggle closes too.
  s.foodBtn.bg._handlers["pointerdown"]();
  assert(s.foodPanel, "reopened");
  s.foodBtn.bg._handlers["pointerdown"]();
  eq(s.foodPanel, null, "toggle closes");
});
test("food panel: a click outside the panel closes it and drops nothing", () => {
  const s = makeScene();
  s.foodBtn.bg._handlers["pointerdown"]();
  assert(s.foodPanel !== null, "panel open");
  const moneyBefore = s.money;
  s.onPointerDown({ x: 850, y: 150 });
  eq(s.foodPanel, null, "click elsewhere closes the panel");
  eq(s.money, moneyBefore, "closing the panel does not drop food");
  eq(s.pellets.length, 0, "no pellet dropped by the closing click");
  eq(s.feastPlants.length, 0, "no plant dropped either");
  eq(s.feedHold, false, "no hold armed");
});
test("food panel: a click on the panel itself drops nothing and does not close it", () => {
  const s = makeScene();
  s.foodBtn.bg._handlers["pointerdown"]();
  assert(s.foodPanel !== null, "panel open");
  const moneyBefore = s.money;
  s.onPointerDown({ x: G.FOOD_PANEL.cx, y: G.FOOD_PANEL.cy - 40 });
  eq(s.money, moneyBefore, "clicking the panel does not drop food");
  eq(s.pellets.length, 0, "no pellet from a panel click");
  assert(s.foodPanel !== null, "clicking the panel does not close it");
  eq(s.dragFish, null, "no fish grabbed through the panel");
});
test("food panel: opening one panel closes the other", () => {
  const s = makeScene();
  s.decorBtn.bg._handlers["pointerdown"]();
  assert(s.decorPanel !== null, "decor open");
  s.foodBtn.bg._handlers["pointerdown"]();
  assert(s.foodPanel !== null, "food open");
  eq(s.decorPanel, null, "decor closed when food opened");
  s.decorBtn.bg._handlers["pointerdown"]();
  assert(s.decorPanel !== null, "decor reopened");
  eq(s.foodPanel, null, "food closed when decor opened");
});
test("food panel: each food type drops at its own cost", () => {
  const s = makeScene();
  s.money = 100;
  s.selectFood("standard");
  s.dropFood(480, 200);
  eq(s.money, 98, "standard $2");
  eq(s.pellets.length, 1, "one standard pellet");
  s.selectFood("deluxe");
  s.dropFood(480, 200);
  eq(s.money, 93, "deluxe $5");
  eq(s.pellets.length, 2, "one deluxe pellet");
  eq(s.pellets[1].feeds, 2, "deluxe counts as 2 feeds");
  s.selectFood("plant");
  s.dropFood(480, 200);
  eq(s.money, 53, "plant $40");
  eq(s.feastPlants.length, 1, "one plant");
});
test("plant: dropFood with plant selected drops a plant for $40; broke drops nothing", () => {
  const s = makeScene();
  s.selectFood("plant");
  s.money = 200;
  eq(s.dropFood(480, 200), true, "drop succeeds");
  eq(s.money, 160, "$40 charged");
  eq(s.feastPlants.length, 1, "one plant");
  eq(s.pellets.length, 0, "no pellet");
  const p = s.feastPlants[0];
  eq(p.nibbles, 30, "30 nibbles");
  eq(p.sinking, true, "sinking");
  eq(p.counter.text, "30", "counter starts at 30");
  const broke = makeScene();
  broke.selectFood("plant");
  broke.money = 0;
  eq(broke.dropFood(480, 200), false, "broke drop fails");
  eq(broke.feastPlants.length, 0, "no plant");
  assert(broke.toastText.text.indexOf("Not enough money") >= 0, "broke toast: " + broke.toastText.text);
});
test("plant: sinks ~25 px/s with sway, then anchors on the floor and never disappears", () => {
  const s = makeScene();
  for (const f of s.fish) f.eatCooldownSec = 999; // nobody nibbles mid-test
  const p = s.spawnFeastPlant(480, 150);
  step(s, 1, () => { for (const f of s.fish) f.eatCooldownSec = 999; });
  approx(p.container.y, 175, 1, "sank ~25px in 1s, got " + p.container.y);
  assert(Math.abs(p.container.x - 480) <= 8, "sway within ±8px, x=" + p.container.x);
  const q = s.spawnFeastPlant(480, 400);
  step(s, 2, () => { for (const f of s.fish) f.eatCooldownSec = 999; });
  eq(q.container.y, G.CONFIG.floorY - 14 * G.CONFIG.plantScale, "anchored at floorY - 42");
  eq(q.sinking, false, "no longer sinking");
  eq(q.container.x, q.baseX, "sway stops once anchored");
  step(s, 5, () => { for (const f of s.fish) f.eatCooldownSec = 999; });
  assert(s.feastPlants.includes(q), "still there after 5s on the floor — never disappears");
  eq(q.nibbles, 30, "uneaten");
  assert(!q.container.destroyed, "container not destroyed");
});
test("plant: a nibble is 1 feed — hunger resets and growth progresses", () => {
  const s = makeScene();
  clearLiveFish(s);
  const f = s.spawnFish(480, 200, "guppy");
  f.hungerSec = 10; f.lastFedSec = 10; f.feeds = 2;
  f.targetX = 480; f.targetY = 200; f.wanderTimer = 100;
  const p = s.spawnFeastPlant(480, 200);
  step(s, 0.5);
  eq(f.feeds, 3, "one nibble = one feed");
  eq(f.stage, 1, "3 feeds grows a guppy to medium");
  assert(f.hungerSec < 1, "hunger reset by the nibble, hungerSec=" + f.hungerSec);
  eq(p.nibbles, 29, "one nibble taken");
  assert(f.plantChewSec > 0, "chew pause started");
});
test("plant: fronds are lost every 5 nibbles, the last few leave a bare skeleton, and the plant vanishes at 0", () => {
  const s = makeScene();
  const p = s.spawnFeastPlant(480, 200);
  const visible = () => p.fronds.filter((f) => f.visible).length;
  eq(visible(), 6, "6 fronds at 30 nibbles");
  assert(p.skeleton.visible === false, "skeleton hidden while bushy");
  assert(p.stem.visible === true, "green stem shown while bushy");
  p.nibbles = 26; s.updatePlantFronds(p); eq(visible(), 6, "26 nibbles: still 6");
  p.nibbles = 25; s.updatePlantFronds(p); eq(visible(), 5, "25 nibbles: 5");
  p.nibbles = 21; s.updatePlantFronds(p); eq(visible(), 5, "21 nibbles: still 5");
  p.nibbles = 20; s.updatePlantFronds(p); eq(visible(), 4, "20 nibbles: 4");
  p.nibbles = 6; s.updatePlantFronds(p); eq(visible(), 2, "6 nibbles: 2");
  p.nibbles = 5; s.updatePlantFronds(p);
  eq(visible(), 0, "5 nibbles: no fronds left");
  assert(p.skeleton.visible === true, "5 nibbles: stripped to a skeleton");
  assert(p.stem.visible === false, "5 nibbles: green stem hidden");
  p.nibbles = 1; s.updatePlantFronds(p);
  eq(visible(), 0, "1 nibble: still a skeleton");
  assert(p.skeleton.visible === true, "1 nibble: skeleton still shown");
  eq(p.counter.text, "1", "counter shows the nibbles left");
  // Vanish: one nibble left, a fish takes it, the plant is gone.
  clearLiveFish(s);
  const f = s.spawnFish(480, 200, "guppy");
  f.targetX = 480; f.targetY = 200; f.wanderTimer = 100;
  p.nibbles = 1; s.updatePlantFronds(p);
  step(s, 0.5);
  assert(!s.feastPlants.includes(p), "plant removed at 0 nibbles");
  assert(p.container.destroyed, "container destroyed");
});
test("plant: rendered ~152px tall — more than 2x a guppy, less than half the tank", () => {
  const s = makeScene();
  const p = s.spawnFeastPlant(480, 200);
  // A guppy is ~50px long (40px body + tail); the plant dwarfs it.
  assert(p.heightPx > 2 * 50, "plant height " + p.heightPx + "px is >2x a guppy");
  assert(p.heightPx < G.CONFIG.height / 2, "plant height " + p.heightPx + "px is < half the 540px tank");
  eq(p.topOffset, -104, "top offset");
  eq(p.baseOffset, 48, "base offset");
  eq(p.heightPx, 152, "152px tall in all");
  // Fronds are authored AT display size (48x108) — no upscale, so
  // scaleX is 1 and the only scale is the per-frond Y variation.
  eq(p.fronds[0].scaleX, 1, "fronds not scaled up on X — texture is already display size");
  eq(p.fronds[0].scaleY, 0.85, "first frond Y-scale 0.85");
  eq(p.fronds[2].scaleY, 1.15, "third frond Y-scale 1.15");
  eq(p.stem.texture, "feast-plant-stem", "detailed stem texture attached");
  eq(p.skeleton.texture, "feast-plant-skeleton", "skeleton visual attached");
  eq(p.counter.y, -144, "counter floats above the taller plant");
});
test("plant: three detailed frond variants, dealt round-robin, authored at display size", () => {
  const s = makeScene();
  const p = s.spawnFeastPlant(480, 200);
  // Each frond is one of three variants — no two neighbouring fronds
  // are the same blade, and the set across the plant has all three.
  eq(p.fronds[0].texture, "feast-plant-frond-a", "frond 1 is variant a");
  eq(p.fronds[1].texture, "feast-plant-frond-b", "frond 2 is variant b");
  eq(p.fronds[2].texture, "feast-plant-frond-c", "frond 3 is variant c");
  eq(p.fronds[3].texture, "feast-plant-frond-a", "frond 4 repeats a");
  const keys = new Set(p.fronds.map((f) => f.texture));
  eq(keys.size, 3, "three distinct frond textures on one plant");
  // The old single key is gone — nothing is the stretched small blade.
  assert(!keys.has("feast-plant-frond"), "no frond uses the old single-blade key");
  // All fronds are authored at display size: scaleX is 1 everywhere.
  for (let i = 0; i < 6; i++) eq(p.fronds[i].scaleX, 1, "frond " + i + " not upscaled on X");
  eq(p.stem.texture, "feast-plant-stem", "detailed stem texture (rings + roots), not a flat rectangle");
  eq(p.skeleton.texture, "feast-plant-skeleton", "detailed skeleton texture");
});

test("plant: the detailed textures are generated at create()", () => {
  const s = makeScene();
  for (const key of ["feast-plant-frond-a", "feast-plant-frond-b", "feast-plant-frond-c",
    "feast-plant-stem", "feast-plant-skeleton"]) {
    assert(s._stubs.generated.includes(key), "texture generated: " + key);
  }
  assert(typeof G.makeFeastPlantFrondTexture === "function", "frond generator exported");
  assert(typeof G.makeFeastPlantStemTexture === "function", "stem generator exported");
  assert(typeof G.makeFeastPlantSkeletonTexture === "function", "skeleton generator exported");
});

test("plant: nibble range is measured to the plant's body — a fish at its top fronds can bite", () => {
  // Plant anchored: centre 386, top 282, base 434. A fish at (480, 300)
  // sits against the plant's upper fronds — 86px from the centre, but
  // 0px from the body — so it can nibble.
  const s = makeScene();
  clearLiveFish(s);
  const f = s.spawnFish(480, 300, "guppy");
  f.targetX = 480; f.targetY = 300; f.wanderTimer = 100;
  const p = s.spawnFeastPlant(480, 386);
  p.sinking = false;
  step(s, 0.5);
  assert(p.nibbles < 30, "fish at the top fronds nibbled, nibbles=" + p.nibbles);
  // And a fish 120px to the side of the plant's middle cannot reach it,
  // even sprinting: it closes at most ~60px in 0.5s, still >50px away.
  const s2 = makeScene();
  clearLiveFish(s2);
  const f2 = s2.spawnFish(600, 386, "guppy");
  f2.targetX = 600; f2.targetY = 386; f2.wanderTimer = 100;
  const p2 = s2.spawnFeastPlant(480, 386);
  p2.sinking = false;
  step(s2, 0.5);
  eq(p2.nibbles, 30, "fish 120px to the side took no bite");
});
test("plant: no cap — a fourth, fifth and sixth plant all drop fine", () => {
  const s = makeScene();
  s.selectFood("plant");
  s.money = 5000;
  for (let i = 0; i < 5; i++) assert(s.dropFood(200 + i * 100, 150), "drop " + (i + 1) + " succeeds");
  eq(s.feastPlants.length, 5, "five plants");
  eq(s.money, 5000 - 200, "$200 charged");
  assert(s.dropFood(700, 150), "a sixth plant drops too");
  eq(s.feastPlants.length, 6, "six plants");
});
test("plant: hold-down spawns plants at the pellet repeat rate with no cap to stop it", () => {
  const s = makeScene();
  s.selectFood("plant");
  s.money = 5000;
  s.onPointerDown({ x: 850, y: 150 });
  eq(s.feastPlants.length, 1, "the press drops one plant");
  eq(s.feedHold, true, "hold armed");
  step(s, 0.5, () => keepFed(s));
  // Press + 3 cadence drops in 0.5s: the first repeat waits out the
  // 0.3s initial delay (frames at 300ms, 400ms, 500ms).
  eq(s.feastPlants.length, 4, "press + 3 cadence drops in 0.5s, got " + s.feastPlants.length);
  eq(s.feedHold, true, "hold keeps going — no cap stops it");
  eq(s.money, 5000 - 160, "$160 charged for 4 plants");
});
test("plant: sprint applies to a sinking plant and to an anchored plant in the 40-120px window", () => {
  // Sinking plant 80px away.
  let t = sprintScene();
  t.scene.spawnFeastPlant(t.fish.sprite.x + 80, t.fish.sprite.y);
  step(t.scene, 0.1);
  assert(t.fish.sprintSec > 0, "sprint to a sinking plant, sprintSec=" + t.fish.sprintSec);
  // Anchored plant 80px away (a plant is food all the way down).
  t = sprintScene();
  const anchored = t.scene.spawnFeastPlant(t.fish.sprite.x + 80, G.CONFIG.floorY - 14 * G.CONFIG.plantScale);
  anchored.sinking = false;
  t.fish.sprite.y = G.CONFIG.floorY - 14 * G.CONFIG.plantScale;
  t.fish.targetY = G.CONFIG.floorY - 14 * G.CONFIG.plantScale;
  step(t.scene, 0.1);
  assert(t.fish.sprintSec > 0, "sprint to an anchored plant, sprintSec=" + t.fish.sprintSec);
  // Too far: no sprint.
  t = sprintScene();
  t.scene.spawnFeastPlant(t.fish.sprite.x + 200, t.fish.sprite.y);
  step(t.scene, 0.1);
  eq(t.fish.sprintSec, 0, "200px plant: no sprint");
  // Too close: no sprint.
  t = sprintScene();
  t.scene.spawnFeastPlant(t.fish.sprite.x + 30, t.fish.sprite.y);
  step(t.scene, 0.1);
  eq(t.fish.sprintSec, 0, "30px plant: no sprint");
});
test("uncap: maxFishCap is Infinity while ON, normal caps while OFF", () => {
  const s = makeScene();
  eq(s.maxFishCap(), 16, "base cap 16");
  s.tankUpgraded = true;
  eq(s.maxFishCap(), 28, "upgraded cap 28");
  s.toggleUncapFish();
  eq(s.maxFishCap(), Infinity, "uncapped");
  eq(s.fishText.text, "Fish: 2 / ∞", "HUD shows no cap: " + s.fishText.text);
  s.toggleUncapFish();
  eq(s.maxFishCap(), 28, "cap back on");
});
test("uncap: buying past the cap works while ON, blocked again when OFF", () => {
  const s = makeScene();
  s.money = 5000;
  while (s.fish.length < s.maxFishCap()) s.spawnFish(100, 100, "guppy");
  eq(s.fish.length, 16, "tank full");
  s.buyFish("guppy");
  eq(s.fish.length, 16, "denied at the cap");
  s.toggleUncapFish();
  s.buyFish("guppy");
  eq(s.fish.length, 17, "bought past the cap while uncapped");
  eq(s.fishText.text, "Fish: 17 / ∞", "HUD shows no cap");
  s.toggleUncapFish();
  s.buyFish("guppy");
  eq(s.fish.length, 17, "denied again once the cap is back on");
  eq(s.fishText.text, "Fish: 17 / 16", "HUD shows the cap again");
});
test("uncap: breeding pairs form past the cap while ON, not while OFF", () => {
  const s = makeScene();
  clearLiveFish(s);
  // 14 small guppies fill the tank; 2 large, recently-fed guppies
  // are the would-be pair. At 16 fish the cap blocks pairing.
  for (let i = 0; i < 14; i++) s.spawnFish(100 + i * 10, 100, "guppy");
  const a = s.spawnFish(400, 200, "guppy");
  const b = s.spawnFish(500, 200, "guppy");
  for (const f of [a, b]) {
    f.feeds = 6; f.stage = 2; s.setFishStageVisual(f);
    f.hungerSec = 0; f.lastFedSec = 0;
  }
  eq(s.fish.length, 16, "tank full");
  step(s, 0.5, () => keepFed(s));
  eq(s.breedingPairs.length, 0, "no pair at the cap");
  s.toggleUncapFish();
  step(s, 0.5, () => keepFed(s));
  eq(s.breedingPairs.length, 1, "pair forms once uncapped");
});
test("uncap: an egg hatches past the cap while ON, waits while OFF", () => {
  const s = makeScene();
  while (s.fish.length < s.maxFishCap()) s.spawnFish(100, 100, "guppy");
  eq(s.fish.length, 16, "tank full");
  const eggSprite = s.add.image(480, G.CONFIG.floorY, "egg");
  s.eggs.push({ sprite: eggSprite, species: "guppy", waitSec: 0, sinking: false, pulse: 0 });
  step(s, 0.5, () => keepFed(s));
  eq(s.fish.length, 16, "egg waits at the cap");
  eq(s.eggs.length, 1, "egg still there");
  s.toggleUncapFish();
  step(s, 0.5, () => keepFed(s));
  eq(s.fish.length, 17, "egg hatched once uncapped");
  eq(s.eggs.length, 0, "egg gone");
});
test("uncap: a chest pays a guppy past the cap while ON, money instead while OFF", () => {
  const s = makeScene();
  while (s.fish.length < s.maxFishCap()) s.spawnFish(100, 100, "guppy");
  const origRandom = Math.random;
  try {
    Math.random = () => 0.9; // guppy roll (>= 2/3)
    s.startEvent("chest");
    s.openChest();
    eq(s.fish.length, 16, "at the cap: no guppy");
    eq(s.money, 300, "$100 instead (200 + 100)");
    s.toggleUncapFish();
    s.startEvent("chest");
    s.openChest();
    eq(s.fish.length, 17, "uncapped: the guppy joins");
  } finally {
    Math.random = origRandom;
  }
});
test("uncap: resetTank turns the toggle back OFF", () => {
  const s = makeScene();
  s.toggleUncapFish();
  eq(s.uncapFish, true, "on");
  s.resetTank();
  eq(s.uncapFish, false, "reset clears it");
  eq(s.maxFishCap(), 16, "cap back to 16");
});

// ===========================================================================
// 17. FISH TRAITS, PATTERNS, HATS, AND THE ROYAL GENE
// ===========================================================================
test("traits: tuning constants are the agreed numbers", () => {
  const C = G.CONFIG;
  eq(C.greedyChaseMult, 1.15); eq(C.greedyChewSec, 1.0);
  eq(C.shyFleeMult, 1.5); eq(C.shyChaseMult, 0.9); eq(C.shySprintCooldownSec, 5);
  eq(C.boldSprintCooldownSec, 1.5); eq(C.boldSprintMinPx, 30); eq(C.boldSprintMaxPx, 150);
  eq(C.lazyChaseMult, 0.9); eq(C.lazyTempoMax, 1.0); eq(C.socialRangePx, 200);
  eq(C.hatChance, 0.2);
  eq(C.royalGeneChance, 0.05); eq(C.royalFeedsAfterLarge, 3); eq(C.royalScale, 1.35);
  eq(C.royalCoinMult, 2); eq(C.royalSellMult, 2);
  eq(C.royalGeneInheritOne, 0.5); eq(C.royalGeneInheritBoth, 0.75);
  eq(JSON.stringify(G.TRAITS), JSON.stringify(["greedy", "shy", "bold", "lazy", "social"]));
  eq(JSON.stringify(G.PATTERNS), JSON.stringify(["plain", "stripes", "spots", "gradient"]));
  eq(JSON.stringify(G.HATS), JSON.stringify(["party", "tophat", "beanie", "pirate", "flower", "bow"]));
});
test("traits: all five appear at spawn, roughly uniform", () => {
  const s = makeScene();
  const counts = {};
  for (let i = 0; i < 500; i++) {
    const f = s.spawnFish(100 + (i % 40) * 20, 150 + Math.floor(i / 40) * 40, "guppy");
    counts[f.trait] = (counts[f.trait] || 0) + 1;
  }
  for (const t of G.TRAITS) {
    assert(counts[t] > 60 && counts[t] < 140, "trait " + t + " count " + counts[t] + "/500");
  }
});
test("traits: Greedy chews a plant in 1.0s, other traits take 1.5s", () => {
  const s = makeScene();
  clearLiveFish(s);
  const g = s.spawnFish(480, 200, "guppy", { trait: "greedy" });
  const n = s.spawnFish(480, 300, "guppy", { trait: "bold" });
  const p = s.spawnFeastPlant(480, 200);
  s.nibblePlant(g, p);
  eq(g.plantChewSec, 1.0, "greedy chew");
  const q = s.spawnFeastPlant(480, 300);
  s.nibblePlant(n, q);
  eq(n.plantChewSec, 1.5, "normal chew");
});
test("traits: Shy fish flinches 1.5x farther on a poke", () => {
  const s = makeScene();
  clearLiveFish(s);
  const shy = s.spawnFish(480, 200, "guppy", { trait: "shy" });
  const calm = s.spawnFish(480, 300, "guppy", { trait: "bold" });
  for (const f of [shy, calm]) {
    f.pokeSec = 0.5; f.pokeDirX = 1; f.pokeDirY = 0;
    f.targetX = f.sprite.x; f.targetY = f.sprite.y; f.wanderTimer = 100;
    f.hungerSec = 10; f.lastFedSec = 10;
  }
  step(s, 0.1);
  approx(shy.sprite.x - 480, 45 * 3 * 1.5 * 0.1, 1e-9, "shy dart");
  approx(calm.sprite.x - 480, 45 * 3 * 0.1, 1e-9, "normal dart");
});
test("traits: Bold sprints from 30-150px and recovers in 1.5s; Shy needs 5s", () => {
  const s = makeScene();
  const b = s.spawnFish(480, 200, "guppy", { trait: "bold" });
  const y = s.spawnFish(480, 300, "guppy", { trait: "shy" });
  const n = s.spawnFish(480, 350, "guppy", { trait: "lazy" });
  eq(JSON.stringify(s.sprintWindowFor(b)), JSON.stringify({ min: 30, max: 150 }), "bold window");
  eq(JSON.stringify(s.sprintWindowFor(y)), JSON.stringify({ min: 40, max: 120 }), "shy window is the normal one");
  eq(s.sprintCooldownFor(b), 1.5, "bold cooldown");
  eq(s.sprintCooldownFor(y), 5, "shy cooldown");
  eq(s.sprintCooldownFor(n), 3, "normal cooldown");
});
test("traits: a Bold fish sprints for a pellet 140px away (outside the normal window)", () => {
  const { scene: s, fish: f } = sprintScene();
  f.trait = "bold";
  s.dropPelletAt(480 + 140, 150, 1, false);
  step(s, 0.1);
  assert(f.sprintSec > 0, "bold sprint started at 140px, sprintSec=" + f.sprintSec);
});
test("traits: a non-Bold fish does NOT sprint for a pellet 140px away", () => {
  const { scene: s, fish: f } = sprintScene();
  f.trait = "lazy";
  s.dropPelletAt(480 + 140, 150, 1, false);
  step(s, 0.1);
  eq(f.sprintSec, 0, "140px is outside the normal 40-120 window");
});
test("traits: Lazy fish roll tempo in [0.85, 1.0], never zippy", () => {
  const s = makeScene();
  for (let i = 0; i < 200; i++) {
    const f = s.spawnFish(100 + (i % 40) * 20, 150 + Math.floor(i / 40) * 40, "guppy", { trait: "lazy" });
    assert(f.tempo >= 0.85 && f.tempo <= 1.0, "lazy tempo " + f.tempo + " out of [0.85, 1.0]");
  }
  // And a random batch can be zippy — the cap is the trait, not the species.
  let zippy = 0;
  for (let i = 0; i < 200; i++) {
    const f = s.spawnFish(100 + (i % 40) * 20, 150 + Math.floor(i / 40) * 40, "guppy");
    if (f.tempo > 1.0) zippy++;
  }
  assert(zippy > 0, "200 random guppies should include a zippy one");
});
test("traits: a Social fish wanders toward the nearest fish within 200px", () => {
  const s = makeScene();
  clearLiveFish(s);
  const a = s.spawnFish(400, 300, "guppy", { trait: "social" });
  const b = s.spawnFish(500, 300, "guppy");
  a.wanderTimer = 0; a.targetX = 400; a.targetY = 300;
  a.hungerSec = 10; a.lastFedSec = 10;
  b.wanderTimer = 100; b.targetX = 500; b.targetY = 300;
  b.hungerSec = 10; b.lastFedSec = 10;
  step(s, 0.1);
  eq(a.targetX, 500, "social target is the friend's x");
  eq(a.targetY, 300, "social target is the friend's y");
});
test("traits: a Social fish with nobody nearby wanders randomly", () => {
  const s = makeScene();
  clearLiveFish(s);
  const a = s.spawnFish(400, 300, "guppy", { trait: "social" });
  a.wanderTimer = 0;
  a.hungerSec = 10; a.lastFedSec = 10;
  step(s, 0.1);
  assert(a.targetX >= 60 && a.targetX <= 900, "random wander x in range, got " + a.targetX);
  assert(a.targetY >= 100 && a.targetY <= 360, "random wander y in range, got " + a.targetY);
});
test("traits: babies inherit a parent's trait 50% of the time", () => {
  let inherited = 0;
  const n = 2000;
  for (let i = 0; i < n; i++) {
    const t = G.inheritTrait("bold", "lazy");
    if (t === "bold" || t === "lazy") inherited++;
  }
  // 50% inherit (bold or lazy) + 50% fresh roll (bold/lazy 2/5 of
  // those) = 70% bold-or-lazy overall.
  assert(inherited > n * 0.6 && inherited < n * 0.8, "inherited " + inherited + "/" + n);
});
test("traits: eggs inherit a parent's trait at the same 50% rate", () => {
  const s = makeScene();
  clearLiveFish(s);
  const mum = s.spawnFish(480, 200, "guppy", { trait: "bold", royalGene: false });
  const dad = s.spawnFish(520, 200, "guppy", { trait: "lazy", royalGene: false });
  let inherited = 0;
  const n = 200;
  for (let i = 0; i < n; i++) {
    mum.breedPartner = dad; dad.breedPartner = mum;
    s.layEgg(mum);
    const egg = s.eggs[s.eggs.length - 1];
    if (egg.trait === "bold" || egg.trait === "lazy") inherited++;
  }
  assert(inherited > n * 0.55 && inherited < n * 0.85, "egg inherited " + inherited + "/" + n);
});
test("patterns: all four appear at spawn, and species colours stay distinct", () => {
  const s = makeScene();
  const seen = {};
  for (let i = 0; i < 200; i++) {
    const f = s.spawnFish(100 + (i % 40) * 20, 150 + Math.floor(i / 40) * 40, "guppy");
    seen[f.pattern] = true;
    eq(f.sprite.texture, "fish-body-guppy-0-" + f.pattern, "body texture carries the pattern");
  }
  for (const pat of G.PATTERNS) assert(seen[pat], "pattern " + pat + " never appeared");
  // Species colours: the stage-0 body colour of each species differs
  // from every other — a pattern never makes a guppy look like an emberfin.
  const keys = Object.keys(G.SPECIES);
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      assert(G.SPECIES[keys[i]].colors[0] !== G.SPECIES[keys[j]].colors[0],
        keys[i] + " and " + keys[j] + " share a stage-0 colour");
    }
  }
});
test("hats: ~20% of fish spawn wearing one, all six kinds appear, never a crown", () => {
  const s = makeScene();
  let hatted = 0;
  const kinds = {};
  for (let i = 0; i < 1000; i++) {
    const f = s.spawnFish(100 + (i % 40) * 20, 150 + Math.floor(i / 40) * 40, "guppy");
    if (f.hatKind) {
      hatted++;
      kinds[f.hatKind] = true;
      assert(f.hatKind !== "crown", "a crown spawned on a normal fish");
      assert(f.hat !== null, "a hatted fish has a hat sprite");
    } else {
      assert(f.hat === null, "an unhatted fish has no hat sprite");
    }
  }
  assert(hatted > 120 && hatted < 280, "hatted " + hatted + "/1000");
  for (const kind of G.HATS) assert(kinds[kind], "hat kind " + kind + " never appeared");
});
test("hats: the hat follows the body's facing (rot180) and rotation", () => {
  const s = makeScene();
  clearLiveFish(s);
  // Spawn until one wears a hat (20% chance — a handful of tries).
  let f = null;
  for (let i = 0; i < 50 && !f; i++) {
    const c = s.spawnFish(480, 300, "guppy");
    if (c.hat) f = c;
    else { c.sprite.destroy(); if (c.tail) c.tail.destroy(); s.fish.splice(s.fish.indexOf(c), 1); }
  }
  assert(f !== null, "no hatted fish in 50 spawns");
  f.sprite.rotation = 0;
  f.sprite.setFlipX(false);
  s.animateFish(f, 0.016);
  assert(f.hat.x > f.sprite.x, "facing right: hat is on the head side, hat.x=" + f.hat.x);
  eq(f.hat.flipX, false, "hat not flipped when facing right");
  f.sprite.setFlipX(true);
  s.animateFish(f, 0.016);
  assert(f.hat.x < f.sprite.x, "facing left: hat mirrors to the head side, hat.x=" + f.hat.x);
  eq(f.hat.flipX, true, "hat flips with the body");
  // Rotation: animateFish drives the body rotation from the fish's
  // tilt, and the hat must ride that same rotation — so tilt the
  // fish and check the hat matches the body's final rotation.
  f.tilt = 0.4;
  s.animateFish(f, 0.016);
  approx(f.sprite.rotation, 0.4, 1e-9, "body rotation follows tilt");
  approx(f.hat.rotation, f.sprite.rotation, 1e-9, "hat rotates with the body");
});
test("hats: a starfish can wear a hat — it sits centred, no throw", () => {
  const s = makeScene();
  clearLiveFish(s);
  let f = null;
  for (let i = 0; i < 50 && !f; i++) {
    const c = s.spawnFish(480, 300, "starfish");
    if (c.hat) f = c;
    else { c.sprite.destroy(); s.fish.splice(s.fish.indexOf(c), 1); }
  }
  assert(f !== null, "no hatted starfish in 50 spawns");
  f.sprite.rotation = 0;
  s.animateFish(f, 0.016);
  approx(f.hat.x, f.sprite.x, 1e-9, "starfish hat is centred");
  assert(f.hat.y < f.sprite.y, "starfish hat sits above the body");
});
test("royalty: a merely-large fish never gets a crown", () => {
  const s = makeScene();
  clearLiveFish(s);
  const f = s.spawnFish(480, 200, "guppy", { royalGene: false });
  for (let i = 0; i < 6; i++) s.applyFeed(f, 1, 480, 200);
  eq(f.stage, 2, "6 feeds = large");
  assert(f.hatKind !== "crown", "large non-gene fish has no crown, hatKind=" + f.hatKind);
  if (f.hat) assert(f.hat.texture !== "hat-crown", "large fish wears no crown texture");
});
test("royalty: turning royal replaces the hat with the crown", () => {
  const s = makeScene();
  clearLiveFish(s);
  // A royal-gene fish that already wears a hat.
  let f = null;
  for (let i = 0; i < 50 && !f; i++) {
    const c = s.spawnFish(480, 200, "guppy", { royalGene: true });
    if (c.hat) f = c;
    else { c.sprite.destroy(); if (c.tail) c.tail.destroy(); s.fish.splice(s.fish.indexOf(c), 1); }
  }
  assert(f !== null, "no hatted royal-gene fish in 50 spawns");
  const oldHat = f.hat;
  for (let i = 0; i < 9; i++) s.applyFeed(f, 1, 480, 200);
  eq(f.stage, 3, "9 feeds = royal for a gene carrier");
  eq(f.hatKind, "crown", "royal wears a crown");
  eq(f.hat.texture, "hat-crown", "crown texture");
  assert(oldHat.destroyed, "the old hat was destroyed, not left floating");
  assert(f.hat !== oldHat, "a new crown sprite replaced the hat");
  // Growing further (or re-rendering) does not stack crowns.
  const crown = f.hat;
  s.setFishStageVisual(f);
  eq(f.hat, crown, "no second crown on re-render");
});
test("royalty: only gene carriers grow past large (stage 3 at +3 feeds)", () => {
  eq(G.stageForFeeds(8, "guppy", false), 2, "8 feeds, no gene: large");
  eq(G.stageForFeeds(9, "guppy", false), 2, "9 feeds, no gene: still large");
  eq(G.stageForFeeds(100, "guppy", false), 2, "100 feeds, no gene: still large");
  eq(G.stageForFeeds(9, "guppy", true), 3, "9 feeds + gene: royal");
  eq(G.stageForFeeds(10, "chomper", true), 2, "chomper needs 11 (8 + 3)");
  eq(G.stageForFeeds(11, "chomper", true), 3, "11 feeds + gene: royal chomper");
  eq(G.stageForFeeds(11, "chomper", false), 2, "11 feeds, no gene: large chomper");
  eq(G.stageForFeeds(9, "emberfin", true), 3, "emberfin royal at 9");
  eq(G.stageForFeeds(9, "starfish", true), 3, "starfish royal at 9");
  // End to end: a non-gene guppy fed 9 times stays large.
  const s = makeScene();
  clearLiveFish(s);
  const f = s.spawnFish(480, 200, "guppy", { royalGene: false });
  for (let i = 0; i < 9; i++) s.applyFeed(f, 1, 480, 200);
  eq(f.stage, 2, "fed 9x, no gene: large, not royal");
  const r = s.spawnFish(480, 300, "guppy", { royalGene: true });
  for (let i = 0; i < 9; i++) s.applyFeed(r, 1, 480, 300);
  eq(r.stage, 3, "fed 9x, gene: royal");
  approx(r.baseScale, 1.35, 1e-9, "royal scale 1.35x");
});
test("royalty: royal coins and sell prices are 2x large", () => {
  eq(G.coinValueForStage(3, "guppy"), 20, "royal guppy coin");
  eq(G.coinValueForStage(3, "emberfin"), 18, "royal emberfin coin");
  eq(G.coinValueForStage(3, "chomper"), 40, "royal chomper coin");
  eq(G.coinValueForStage(3, "starfish"), 24, "royal starfish coin");
  eq(G.sellPriceForStage(3, "guppy"), 300, "royal guppy sell");
  eq(G.sellPriceForStage(3, "emberfin"), 600, "royal emberfin sell");
  eq(G.sellPriceForStage(3, "chomper"), 1000, "royal chomper sell");
  eq(G.sellPriceForStage(3, "starfish"), 700, "royal starfish sell");
  // And large is unchanged.
  eq(G.coinValueForStage(2, "guppy"), 10, "large guppy coin unchanged");
  eq(G.sellPriceForStage(2, "chomper"), 500, "large chomper sell unchanged");
});
test("royalty: a royal fish counts as large for the goal", () => {
  const s = makeScene();
  clearLiveFish(s);
  for (let i = 0; i < 3; i++) {
    const f = s.spawnFish(200 + i * 200, 200, "guppy", { royalGene: true });
    f.stage = 3; s.setFishStageVisual(f);
  }
  eq(G.countLargeFish(s.fish), 3, "3 royals count as 3 large");
  assert(G.goalIsMet(1000, G.countLargeFish(s.fish)), "goal met with 3 royals");
  // Mixed: 2 royals + 1 large = 3.
  const s2 = makeScene();
  clearLiveFish(s2);
  for (let i = 0; i < 2; i++) {
    const f = s2.spawnFish(200 + i * 200, 200, "guppy", { royalGene: true });
    f.stage = 3; s2.setFishStageVisual(f);
  }
  const l = s2.spawnFish(600, 200, "guppy");
  l.stage = 2; s2.setFishStageVisual(l);
  eq(G.countLargeFish(s2.fish), 3, "2 royals + 1 large = 3");
});
test("royalty: a royal Chomper still hunts, and royal fish still breed", () => {
  const s = makeScene();
  clearLiveFish(s);
  const h = s.spawnFish(480, 200, "chomper", { royalGene: true });
  h.stage = 3; s.setFishStageVisual(h); h.hungerSec = 30; h.lastFedSec = 30;
  const b = s.spawnFish(500, 200, "guppy");
  assert(G.canHunt(h, b), "royal chomper hunts");
  const s2 = makeScene();
  clearLiveFish(s2);
  const a = s2.spawnFish(400, 200, "guppy", { royalGene: true });
  const c = s2.spawnFish(500, 200, "guppy", { royalGene: true });
  for (const f of [a, c]) { f.stage = 3; s2.setFishStageVisual(f); f.hungerSec = 5; f.lastFedSec = 5; }
  assert(G.canBreed(a, c, 2, 16), "two royals can breed");
});
test("royalty: the gene inherits 50% (one royal parent), 75% (two), 5% base", () => {
  const n = 2000;
  let one = 0, both = 0, base = 0;
  for (let i = 0; i < n; i++) {
    if (G.inheritRoyalGene(true, false)) one++;
    if (G.inheritRoyalGene(true, true)) both++;
    if (G.inheritRoyalGene(false, false)) base++;
  }
  assert(one > n * 0.42 && one < n * 0.58, "one parent: " + one + "/" + n);
  assert(both > n * 0.67 && both < n * 0.83, "two parents: " + both + "/" + n);
  assert(base > n * 0.02 && base < n * 0.09, "base: " + base + "/" + n);
});
test("royalty: ~5% of fish are born carrying the gene", () => {
  const s = makeScene();
  let carriers = 0;
  for (let i = 0; i < 2000; i++) {
    const f = s.spawnFish(100 + (i % 40) * 20, 150 + Math.floor(i / 40) * 40, "guppy");
    if (f.royalGene) carriers++;
  }
  assert(carriers > 60 && carriers < 150, "carriers " + carriers + "/2000");
});
test("traits: hovering a fish shows its trait in the description bar", () => {
  const s = makeScene();
  clearLiveFish(s);
  const f = s.spawnFish(480, 300, "guppy", { trait: "bold" });
  eq(s.fishTraitLine(f), "Bold Guppy — sprints first, sprints often", "trait line");
  s.onPointerMove({ x: 480, y: 300 });
  eq(s.descBarText.text, "Bold Guppy — sprints first, sprints often", "hover shows the trait");
  s.onPointerMove({ x: 100, y: 100 });
  eq(s.descBarText.text, G.DESC_DEFAULT_TEXT, "moving off restores the default text");
  // Royal fish are named as such, with the double-coin note.
  f.stage = 3; s.setFishStageVisual(f);
  eq(s.fishTraitLine(f), "Royal Bold Guppy — sprints first, sprints often · drops double coins", "royal trait line");
});

// ===========================================================================
// 18. IMPORT / EXPORT SAVE CODES
// ===========================================================================
// A plain state object for codec round-trips (no scene needed).
function richState(fish) {
  return {
    money: 12345.67, totalBanked: 98765.43, fish: fish || [],
    snail: true, snailUpgraded: true, crab: true, feederOwned: true, feederOn: true,
    magnetLevel: 3, decorations: { coral: true, chest: true, castle: true },
    tankUpgraded: true, foodType: "plant", goalComplete: true,
  };
}
function testFish(species, o) {
  return Object.assign({ species, feeds: 0, hungerSec: 0, tempo: 1.0, trait: "bold", pattern: "plain", hueTint: 0xffffff, hatKind: null, royalGene: false }, o || {});
}
// Hunger and tempo are quantized in the code (2s steps, 0.05 steps),
// so those compare within tolerance; everything else is exact.
function eqFish(a, b, label) {
  eq(a.species, b.species, label + " species");
  eq(a.feeds, b.feeds, label + " feeds");
  assert(Math.abs(a.hungerSec - b.hungerSec) <= 2, label + " hunger " + a.hungerSec + " vs " + b.hungerSec);
  assert(Math.abs(a.tempo - b.tempo) <= 0.051, label + " tempo " + a.tempo + " vs " + b.tempo);
  eq(a.trait, b.trait, label + " trait");
  eq(a.pattern, b.pattern, label + " pattern");
  eq(a.hueTint, b.hueTint, label + " hue");
  eq(a.hatKind, b.hatKind, label + " hat");
  eq(a.royalGene, b.royalGene, label + " royal gene");
}

test("savecode: empty tank round-trips, and the code is short", () => {
  const code = G.encodeSaveCode({ money: 200, totalBanked: 0, fish: [], snail: false, snailUpgraded: false, crab: false, feederOwned: false, feederOn: false, magnetLevel: 0, decorations: { coral: false, chest: false, castle: false }, tankUpgraded: false, foodType: "standard", goalComplete: false });
  assert(code.length <= 20, "empty code " + code.length + " chars: " + code);
  const res = G.decodeSaveCode(code);
  assert(res.ok, "decodes: " + res.reason);
  eq(res.state.money, 200, "money");
  eq(res.state.totalBanked, 0, "banked");
  eq(res.state.fish.length, 0, "no fish");
  eq(res.state.foodType, "standard", "food type");
});
test("savecode: 2-fish starter round-trips within budget", () => {
  const state = richState([
    testFish("guppy", { trait: "social", pattern: "stripes", hatKind: "party", hungerSec: 7, tempo: 1.15 }),
    testFish("guppy", { trait: "shy", pattern: "spots", hueTint: 0xe8f4ff, feeds: 3 }),
  ]);
  state.money = 200; state.totalBanked = 0;
  state.snail = false; state.snailUpgraded = false; state.crab = false;
  state.feederOwned = false; state.feederOn = false; state.magnetLevel = 0;
  state.decorations = { coral: false, chest: false, castle: false };
  state.tankUpgraded = false; state.foodType = "standard"; state.goalComplete = false;
  const code = G.encodeSaveCode(state);
  assert(code.length <= 30, "2-fish code " + code.length + " chars: " + code);
  const res = G.decodeSaveCode(code);
  assert(res.ok, "decodes: " + res.reason);
  eq(res.state.money, 200, "money");
  eq(res.state.fish.length, 2, "two fish");
  eqFish(state.fish[0], res.state.fish[0], "fish 0");
  eqFish(state.fish[1], res.state.fish[1], "fish 1");
});
test("savecode: full 16-fish tank with a royal fish round-trips within budget", () => {
  const species = ["guppy", "emberfin", "chomper", "starfish"];
  const traits = ["greedy", "shy", "bold", "lazy", "social"];
  const patterns = ["plain", "stripes", "spots", "gradient"];
  const hats = [null, "party", "tophat", "beanie", "pirate", "flower", "bow"];
  const fish = [];
  for (let i = 0; i < 16; i++) {
    fish.push(testFish(species[i % 4], {
      feeds: i % 4 === 2 ? 11 : (i * 2) % 9,
      hungerSec: (i * 3) % 40,
      tempo: 0.85 + (i % 8) * 0.05,
      trait: traits[i % 5],
      pattern: patterns[i % 4],
      hueTint: [0xfff2e0, 0xffffff, 0xe8f4ff][i % 3],
      hatKind: hats[i % 7],
      royalGene: i === 10,
    }));
  }
  const state = richState(fish);
  const code = G.encodeSaveCode(state);
  assert(code.length <= 100, "16-fish code " + code.length + " chars: " + code);
  const res = G.decodeSaveCode(code);
  assert(res.ok, "decodes: " + res.reason);
  eq(res.state.money, 12345.67, "money exact to the cent");
  eq(res.state.totalBanked, 98765.43, "banked exact to the cent");
  eq(res.state.fish.length, 16, "sixteen fish");
  eq(res.state.snail, true, "turbo"); eq(res.state.snailUpgraded, true, "turbo speed");
  eq(res.state.crab, true, "claws");
  eq(res.state.feederOwned, true, "feeder owned"); eq(res.state.feederOn, true, "feeder on");
  eq(res.state.magnetLevel, 3, "magnet L3");
  eq(JSON.stringify(res.state.decorations), JSON.stringify({ coral: true, chest: true, castle: true }), "all decor");
  eq(res.state.tankUpgraded, true, "tank upgraded");
  eq(res.state.foodType, "plant", "food type");
  eq(res.state.goalComplete, true, "goal complete");
  for (let i = 0; i < 16; i++) eqFish(state.fish[i], res.state.fish[i], "fish " + i);
  eq(res.state.fish[10].royalGene, true, "royal gene on fish 10");
  eq(res.state.fish[10].feeds, 11, "royal feeds");
});
test("savecode: money and banked saturate at the 24-bit cap instead of wrapping", () => {
  const code = G.encodeSaveCode(richState([]));
  const res = G.decodeSaveCode(code);
  assert(res.ok, "decodes");
  eq(res.state.money, 12345.67, "under-cap money is exact");
  const big = G.encodeSaveCode({ money: 999999.99, totalBanked: 555555.55, fish: [], snail: false, snailUpgraded: false, crab: false, feederOwned: false, feederOn: false, magnetLevel: 0, decorations: { coral: false, chest: false, castle: false }, tankUpgraded: false, foodType: "standard", goalComplete: false });
  const bigRes = G.decodeSaveCode(big);
  assert(bigRes.ok, "big code decodes");
  eq(bigRes.state.money, 167772.15, "money saturates at $167,772.15");
  eq(bigRes.state.totalBanked, 167772.15, "banked saturates too");
});
test("savecode: a flipped character, a truncation, and garbage are all rejected", () => {
  const code = G.encodeSaveCode(richState([testFish("guppy", { feeds: 4, trait: "greedy" })]));
  // Flip one character in the middle (to a different valid base64url char).
  const flipped = code.slice(0, 5) + (code[5] === "A" ? "B" : "A") + code.slice(6);
  const r1 = G.decodeSaveCode(flipped);
  assert(!r1.ok, "flipped char must be rejected, got " + JSON.stringify(r1));
  // Truncate: drop the last dotted group.
  const truncated = code.slice(0, code.lastIndexOf("."));
  assert(!G.decodeSaveCode(truncated).ok, "truncated code must be rejected");
  // Garbage, empty, and a bad character.
  assert(!G.decodeSaveCode("hello world").ok, "garbage rejected");
  assert(!G.decodeSaveCode("").ok, "empty rejected");
  assert(!G.decodeSaveCode(code + "!").ok, "bad character rejected");
  assert(!G.decodeSaveCode(null).ok, "null rejected");
});
test("savecode: more than 63 fish refuses to encode", () => {
  const fish = [];
  for (let i = 0; i < 64; i++) fish.push(testFish("guppy"));
  eq(G.encodeSaveCode(richState(fish)), null, "64 fish is too many for the 6-bit count");
  const ok = [];
  for (let i = 0; i < 63; i++) ok.push(testFish("guppy"));
  assert(G.encodeSaveCode(richState(ok)) !== null, "63 fish still encodes");
});
test("savecode: scene export → import restores money, fish and helpers", () => {
  const s = makeScene();
  s.money = 5432.10;
  s.totalBanked = 2100.55;
  s.buySnail(); s.buySnailSpeed(); s.buyCrab(); s.buyOrToggleFeeder();
  s.buyMagnet(); s.buyMagnet(); s.buyMagnet();
  s.buyDecoration("coral", G.CONFIG.coralCost);
  s.buyDecoration("chest", G.CONFIG.chestCost);
  s.buyDecoration("castle", G.CONFIG.castleCost);
  s.buyTankUpgrade();
  s.selectFood("plant");
  clearLiveFish(s);
  const royal = s.spawnFish(300, 200, "guppy", { trait: "bold", pattern: "stripes", hueTint: 0xe8f4ff, hatKind: "tophat", feeds: 9, royalGene: true, hungerSec: 12, tempo: 1.1 });
  const plain = s.spawnFish(500, 250, "emberfin", { trait: "lazy", pattern: "spots", hungerSec: 6, tempo: 0.9 });
  royal.pregnant = true; royal.pregnantSec = 10; // pregnancy is NOT saved
  eq(royal.stage, 3, "royal is stage 3 before export");
  eq(royal.hatKind, "crown", "royal wears the crown before export");
  const code = s.exportSaveCode();
  assert(typeof code === "string" && code.length > 0, "export produces a code");
  const direct = G.decodeSaveCode(code);
  assert(direct.ok, "exported code decodes");
  approx(direct.state.money, 5432.10 - 3475, 0.01, "money after all the buys");
  eq(direct.state.totalBanked, 2100.55, "banked");

  const t = makeTitleScene();
  const res = t.importSaveCode(code);
  assert(res.ok, "import succeeds");
  assert(t.started, "import starts the game");
  assert(t.startOverlay === null, "title overlay gone after import");
  approx(t.money, 5432.10 - 3475, 0.01, "money restored");
  eq(t.totalBanked, 2100.55, "banked restored");
  eq(t.fish.length, 2, "both fish restored");
  assert(t.snail && t.snailUpgraded, "turbo + speed restored");
  assert(t.crab, "claws restored");
  assert(t.feederOwned && t.feederOn, "feeder restored");
  eq(t.magnetLevel, 3, "magnet restored");
  assert(t.decorations.coral && t.decorations.chest && t.decorations.castle, "decor restored");
  assert(t.tankUpgraded, "tank upgrade restored");
  eq(t.foodType, "plant", "food type restored");
  const imp = t.fish.find((f) => f.species === "guppy");
  eq(imp.stage, 3, "royal stage restored");
  eq(imp.hatKind, "crown", "royal crown restored");
  eq(imp.trait, "bold", "royal trait restored");
  eq(imp.pattern, "stripes", "royal pattern restored");
  assert(Math.abs(imp.hungerSec - 12) <= 2, "hunger resumes at the saved hunger, got " + imp.hungerSec);
  assert(!imp.pregnant, "pregnancy does not carry over");
  eq(t.fish.find((f) => f.species === "emberfin").trait, "lazy", "emberfin trait restored");
  assert(t.eventTimerSec >= 60 && t.eventTimerSec <= 90, "first event re-rolls 60-90s after load, got " + t.eventTimerSec);
});
test("savecode: import of a bad code shows the exact error and does not start", () => {
  const t = makeTitleScene();
  const res = t.importSaveCode("nonsense");
  assert(!res.ok, "bad code rejected");
  eq(res.error, "That code doesn't look right — check it and try again", "exact error text");
  assert(!t.started, "game does not start on a bad code");
  eq(t.fish.length, 0, "no fish spawned");
  eq(t.money, G.CONFIG.startMoney, "money untouched");
  // The panel path: Load with nothing pasted shows the same error.
  t.showImportPanel();
  assert(t.importPanel.visible, "import panel opens");
  t.loadImportCode();
  eq(t.importPanel.errorText.text, "That code doesn't look right — check it and try again", "panel error text");
  assert(t.importPanel.errorText.visible, "error shown");
  assert(!t.started, "still on the title screen");
});
test("savecode: eggs load as stage-0 babies of their species", () => {
  const s = makeScene();
  clearLiveFish(s);
  s.eggs.push({ species: "emberfin", trait: "bold", royalGene: true });
  const code = s.exportSaveCode();
  const t = makeTitleScene();
  const res = t.importSaveCode(code);
  assert(res.ok, "import succeeds");
  eq(t.fish.length, 1, "the egg became one fish");
  const baby = t.fish[0];
  eq(baby.species, "emberfin", "egg species");
  eq(baby.stage, 0, "hatched as a baby");
  eq(baby.feeds, 0, "no feeds yet");
  eq(baby.trait, "bold", "inherited trait carried over");
  eq(baby.royalGene, true, "inherited gene carried over");
});
test("savecode: restoring loads all fish even over the cap", () => {
  const fish = [];
  for (let i = 0; i < 20; i++) fish.push(testFish("guppy"));
  const code = G.encodeSaveCode({ money: 5000, totalBanked: 0, fish, snail: false, snailUpgraded: false, crab: false, feederOwned: false, feederOn: false, magnetLevel: 0, decorations: { coral: false, chest: false, castle: false }, tankUpgraded: false, foodType: "standard", goalComplete: false });
  const t = makeTitleScene();
  assert(t.importSaveCode(code).ok, "import succeeds");
  eq(t.fish.length, 20, "all 20 fish restored over the cap");
  eq(t.maxFishCap(), 16, "cap is still 16 after load");
  eq(t.buyFish("guppy"), false, "buying is still capped after load");
});
test("savecode: a hungry fish keeps its hunger on load (no offline starvation)", () => {
  const s = makeScene();
  clearLiveFish(s);
  s.spawnFish(300, 200, "guppy", { hungerSec: 48, tempo: 1.0 });
  const code = s.exportSaveCode();
  const t = makeTitleScene();
  assert(t.importSaveCode(code).ok, "import succeeds");
  eq(t.fish.length, 1, "one fish");
  eq(t.fish[0].hungerSec, 48, "hunger resumes at 48s, not reset");
  step(t, 1);
  eq(t.fish.length, 1, "still alive after 1s (49s < 50s death)");
});
test("savecode: pause menu has an Export button, title screen has an Import button", () => {
  const s = makeScene();
  assert(s.pauseMenu.exportRect !== undefined, "export button exists in the pause menu");
  s._stubs.keyboardHandlers["keydown-P"]();
  eq(s.paused, true, "P pauses");
  s.pauseMenu.exportRect._handlers["pointerdown"]();
  assert(s.exportPanel.visible, "export panel opens");
  assert(typeof s._exportCode === "string" && s._exportCode.length > 0, "export produced a code");
  assert(G.decodeSaveCode(s._exportCode).ok, "panel code decodes");
  eq(s.exportPanel.codeText.text, s._exportCode, "no-DOM fallback shows the code as text");
  s.pauseMenu.resumeRect._handlers["pointerdown"]();
  eq(s.paused, false, "resumed");
  eq(s.exportPanel.visible, false, "export panel closes on resume");
  const t = makeTitleScene();
  assert(t.importBtn !== undefined, "import button exists on the title screen");
  t.importBtn._handlers["pointerdown"]();
  assert(t.importPanel.visible, "import panel opens");
  eq(t.importPanel.errorText.visible, false, "no error yet");
});

test("savecode: changing ANY single character of a valid code is rejected, including the last", () => {
  // A real code exported by f95c24e ($94, 3 guppies) — it must still decode.
  const code = "EMAJLg.AAAAAA.ASWIAJ.opQSJ8.wBw";
  const res = G.decodeSaveCode(code);
  assert(res.ok, "f95c24e code decodes: " + res.reason);
  eq(res.state.money, 94, "money $94");
  eq(res.state.fish.length, 3, "three fish");
  // Flip every character of the dotless code in turn (dots are only
  // separators — decode strips them, so the dotless form is equivalent).
  const clean = code.replace(/[.]/g, "");
  for (let i = 0; i < clean.length; i++) {
    const flipped = clean.slice(0, i) + (clean[i] === "A" ? "B" : "A") + clean.slice(i + 1);
    const r = G.decodeSaveCode(flipped);
    assert(!r.ok, "char " + i + " (" + clean[i] + " -> " + flipped[i] + ") must be rejected, got " + JSON.stringify(r));
  }
  // The discriminating case: the last character's low 2 bits are
  // base64 padding, not payload — changing them must be rejected even
  // though the decoded bytes would be identical. "w" (110000) -> "x"
  // (110001) / "y" (110010) / "z" (110011) only touch padding bits.
  for (const c of ["x", "y", "z"]) {
    const r = G.decodeSaveCode(clean.slice(0, -1) + c);
    assert(!r.ok, "last char w->" + c + " (padding bits only) must be rejected, got " + JSON.stringify(r));
  }
});

// --- Save-code dialog layout ------------------------------------------------
// Headless geometry only: this test asserts the DOM elements' rects
// in GAME coordinates (top-left anchored, inside their dialog boxes).
// It CANNOT verify the live layout — the defect that broke it twice
// was never the game coordinates. The DOM container div sits over the
// canvas only because Phaser copies the canvas margins onto it AND
// style.css pins it to the parent's top-left while #game is not a
// flex container; when #game was display:flex, the browser put the
// container at its flex static position, the centred spot of a
// 960x540 box, about (+220,+124) game px off the canvas — the fields
// landed ~445px right and ~230px down of their dialogs at 1919x998
// while every game coordinate here was already correct. No stub
// models the container's screen position, so the live render still
// needs the live check. The DOM branch only runs with a document, so
// this test installs a minimal fake one for its duration and removes
// it afterwards.
function fakeDocument() {
  const makeEl = function (tag) {
    return {
      tagName: tag.toUpperCase(), type: "", value: "", textContent: "",
      readOnly: false, placeholder: "", spellcheck: false, autocomplete: "",
      style: {},
      addEventListener: function () {},
      select: function () {}, focus: function () {},
    };
  };
  return { createElement: makeEl };
}
// CSS size of a save-code DOM element (box-sizing:border-box, so the
// cssText width/height are the outer size).
function domCssPx(el, prop) {
  const m = new RegExp(prop + ":\\s*(\\d+)px").exec(el.node.style.cssText || "");
  return m ? parseInt(m[1], 10) : 0;
}
function assertDomInside(el, box, label) {
  assert(el, label + " exists");
  eq(el.originX, 0, label + " anchored by its left edge");
  eq(el.originY, 0, label + " anchored by its top edge");
  const w = domCssPx(el, "width"), h = domCssPx(el, "height");
  assert(w > 0 && h > 0, label + " has a CSS size");
  assert(el.x >= box.left && el.x + w <= box.right,
    label + " horizontal " + el.x + ".." + (el.x + w) + " must fit " + box.left + ".." + box.right);
  assert(el.y >= box.top && el.y + h <= box.bottom,
    label + " vertical " + el.y + ".." + (el.y + h) + " must fit " + box.top + ".." + box.bottom);
  return { top: el.y, bottom: el.y + h };
}
test("savecode: dialog DOM elements sit inside their dialog boxes", () => {
  const prevDoc = global.document;
  global.document = fakeDocument();
  try {
    // Export panel: bg 540x170 centred (480,270) -> x 210..750, y 185..355;
    // hint line at y=332, title at y=202.
    const s = makeScene();
    s._stubs.keyboardHandlers["keydown-P"]();
    s.pauseMenu.exportRect._handlers["pointerdown"]();
    const expBox = { left: 210, top: 185, right: 750, bottom: 355 };
    const expField = assertDomInside(s.exportPanel.input, expBox, "export field");
    const expCopy = assertDomInside(s.exportPanel.copyBtn, expBox, "export Copy");
    const expClose = assertDomInside(s.exportPanel.closeBtn, expBox, "export Close");
    assert(expField.bottom <= expCopy.top, "export field sits above the buttons");
    assert(expCopy.bottom <= 332 && expClose.bottom <= 332, "export buttons sit above the hint line");
    // Export hint: short enough to fit the 540-wide dialog at 12px
    // (the old line ran past both edges), and below the buttons.
    // Hint text is container-relative (0,62); the panel sits at
    // (480,270), so its game y is 332.
    const expHint = s.exportPanel.hintText;
    assert(expHint, "export hint exists");
    assert(expHint.text.length <= 60, "export hint fits the dialog, got " + expHint.text.length + " chars: " + expHint.text);
    eq(270 + expHint.y, 332, "export hint line");
    assert(expCopy.bottom <= 270 + expHint.y, "export buttons sit above the hint line");
    // Import panel: bg 540x220 centred (480,270) -> x 210..750, y 160..380;
    // error line at y=332, hint line at y=362, title at y=178.
    const t = makeTitleScene();
    t.importBtn._handlers["pointerdown"]();
    const impBox = { left: 210, top: 160, right: 750, bottom: 380 };
    const impField = assertDomInside(t.importPanel.input, impBox, "import field");
    const impLoad = assertDomInside(t.importPanel.loadBtn, impBox, "import Load");
    const impCancel = assertDomInside(t.importPanel.cancelBtn, impBox, "import Cancel");
    assert(impField.bottom <= impLoad.top, "import field sits above the buttons");
    assert(impLoad.bottom <= 332 && impCancel.bottom <= 332, "import buttons sit above the error line");
    // Import hint at relative (0,92) -> game y 362: inside the dialog,
    // below the buttons and the error line, so it is never covered by
    // the field once the field is inside the box.
    const impHint = t.importPanel.hintText;
    assert(impHint, "import hint exists");
    eq(270 + impHint.y, 362, "import hint line");
    assert(impLoad.bottom <= 270 + impHint.y && 270 + impHint.y <= impBox.bottom,
      "import hint sits below the buttons and inside the dialog");
  } finally {
    if (prevDoc === undefined) delete global.document;
    else global.document = prevDoc;
  }
});

// ===========================================================================
// Summary.
// ===========================================================================
console.log("\n" + passed + " passed, " + failed + " failed, " + (passed + failed) + " total.");
if (failures.length) {
  console.log("Failures:");
  for (const f of failures) console.log("  - " + f);
}
process.exit(failed ? 1 : 0);
