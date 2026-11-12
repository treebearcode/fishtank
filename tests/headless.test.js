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
    destroyed: false, _handlers: {},
  };
  o.setDepth = function () { return o; };
  o.setVisible = function (v) { o.visible = !!v; return o; };
  o.setOrigin = function () { return o; };
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
  scene.started = true;
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
  eq(G.ROBOT_BAND.maxY, 300); eq(G.ROBOT_BAND.minY, 80);
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
test("scene: create() starts with 2 guppies", () => {
  const s = makeScene();
  eq(s.fish.length, 2);
  assert(s.fish.every((f) => f.species === "guppy"), "start fish are guppies");
});
test("scene: textures exist per species/stage; starfish has no tail texture", () => {
  const s = makeScene();
  const gen = s._stubs.generated;
  for (const key of ["guppy", "emberfin", "chomper", "starfish"]) {
    for (let st = 0; st < 3; st++) {
      assert(gen.includes("fish-body-" + key + "-" + st), "missing body " + key + "-" + st);
    }
  }
  assert(gen.includes("fish-tail-emberfin-1"), "emberfin tail exists");
  assert(gen.includes("fish-tail-chomper-2"), "chomper tail exists");
  assert(!gen.some((k) => k.indexOf("fish-tail-starfish") === 0), "starfish must have NO tail texture");
  assert(gen.includes("feeder-bot") && gen.includes("bot-light") && gen.includes("egg"), "bot + egg textures");
});
test("scene: spawnFish species fields (speed, tail, texture)", () => {
  const s = makeScene();
  const e = s.spawnFish(400, 200, "emberfin");
  eq(e.species, "emberfin"); eq(e.speed, 65);
  assert(e.tail !== null, "emberfin has a tail");
  eq(e.sprite.texture, "fish-body-emberfin-0");
  const c = s.spawnFish(400, 300, "chomper");
  eq(c.speed, 30);
  const st = s.spawnFish(400, 350, "starfish");
  eq(st.species, "starfish"); eq(st.speed, 25);
  eq(st.tail, null, "starfish has no tail");
  eq(st.sprite.texture, "fish-body-starfish-0");
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
  // V4.1 PHASE 2: the magnet is a chain now — one buy is L1.
  s.buyMagnet();
  s.updateShopUI();
  eq(s.magnetLevel, 1, "one buyMagnet is level 1");
  eq(s.magnetBtn.text.text, "Magnet L1 · $400", "label shows level and next cost");
  s.buyCrab();
  s.updateShopUI();
  eq(s.crabBtn.text.text, "Claws ✓");
});
test("scene: every shop button has an icon and a tooltip function", () => {
  const s = makeScene();
  const btns = [s.guppyBtn, s.emberfinBtn, s.chomperBtn, s.starfishBtn, s.snailBtn,
    s.crabBtn, s.feederBtn, s.magnetBtn, s.foodStdBtn, s.foodDeluxeBtn, s.decorBtn,
    s.tankBtn, s.speedBtn, s.sellBtn];
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
test("scene: 2x speed toggle still works", () => {
  const s = makeScene();
  eq(s.speedMult, 1);
  s.toggleSpeed();
  eq(s.speedMult, 2);
  s.toggleSpeed();
  eq(s.speedMult, 1);
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
  eq(JSON.stringify(G.GROWTH_SCALES), JSON.stringify([0.6, 0.9, 1.2]));
  approx(G.fishScale(0, "guppy"), 0.6);
  approx(G.fishScale(2, "guppy"), 1.2);
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
test("V4.1 P2: MAGNET_LEVELS — costs 250/400/600/900, radii 0/60/110/170", () => {
  eq(G.MAGNET_LEVELS.length, 4);
  eq(JSON.stringify(G.MAGNET_LEVELS.map((l) => l.cost)), JSON.stringify([250, 400, 600, 900]));
  eq(JSON.stringify(G.MAGNET_LEVELS.map((l) => l.radius)), JSON.stringify([0, 60, 110, 170]));
  eq(G.MAGNET_LEVELS[0].name, "Hover collect");
  eq(G.MAGNET_LEVELS[1].name, "Drag 60");
  eq(G.MAGNET_LEVELS[2].name, "Drag 110");
  eq(G.MAGNET_LEVELS[3].name, "Drag 170");
});
test("V4.1 P2: magnetLevelCost / magnetRadiusFor per level", () => {
  eq(G.magnetLevelCost(0), 250); eq(G.magnetLevelCost(1), 400);
  eq(G.magnetLevelCost(2), 600); eq(G.magnetLevelCost(3), 900);
  eq(G.magnetLevelCost(4), null, "MAX has no next cost");
  eq(G.magnetRadiusFor(0), 0, "not owned: no drag");
  eq(G.magnetRadiusFor(1), 0, "L1 is hover-only: no drag");
  eq(G.magnetRadiusFor(2), 60);
  eq(G.magnetRadiusFor(3), 110);
  eq(G.magnetRadiusFor(4), 170);
  assert(G.magnetRadiusFor(4) > G.magnetRadiusFor(3) && G.magnetRadiusFor(3) > G.magnetRadiusFor(2),
    "radii increase per level");
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
test("V4.1 P2: magnet L1 hover-collects without a click", () => {
  const s = makeScene();
  s.money = 1000;
  // No magnet yet: hovering over a coin does nothing.
  const f = s.fish[0];
  s.dropCoin(f);
  const coin = s.coins[s.coins.length - 1];
  s.onPointerMove({ x: coin.container.x, y: coin.container.y });
  assert(s.coins.includes(coin), "no hover-collect before L1");
  // Buy L1: hovering the same coin collects it, no click.
  s.buyMagnet();
  eq(s.magnetLevel, 1);
  const moneyAfterBuy = s.money;
  s.onPointerMove({ x: coin.container.x, y: coin.container.y });
  assert(!s.coins.includes(coin), "hover collected the coin at L1");
  assert(s.money > moneyAfterBuy, "hover-collect banks the coin value");
});
test("V4.1 P2: magnet L2 drags a coin within radius toward the pointer, not one outside it", () => {
  const s = makeScene();
  s.money = 5000;
  s.buyMagnet(); // L1
  s.buyMagnet(); // L2
  eq(s.magnetLevel, 2);
  const f = s.fish[0];
  // Coin 50px from the pointer (inside L2's 60px radius), sinking.
  s.dropCoin(f);
  const near = s.coins[s.coins.length - 1];
  near.container.x = 400; near.container.y = 200;
  // Coin 150px away (outside L2's 60px radius).
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
test("V4.1 P2: magnet L3 drags a coin L2 cannot reach", () => {
  const s = makeScene();
  s.money = 5000;
  s.buyMagnet(); s.buyMagnet(); // L2
  const f = s.fish[0];
  s.dropCoin(f);
  const coin = s.coins[s.coins.length - 1];
  coin.container.x = 400; coin.container.y = 200;
  s.onPointerMove({ x: 500, y: 200 }); // 100px away: outside L2's 60px
  const x0 = coin.container.x;
  step(s, 0.5, () => keepFed(s));
  approx(coin.container.x, x0, 2, "L2 does not drag a coin 100px away");
  // Upgrade to L3 (radius 110): the same coin is now in range.
  s.buyMagnet();
  eq(s.magnetLevel, 3);
  step(s, 0.5, () => keepFed(s));
  assert(coin.container.x > x0 + 20, "L3 drags the 100px-away coin: " + x0 + " -> " + coin.container.x.toFixed(1));
});
test("V4.1 P2: magnet drag collects on touch and never leaves the water", () => {
  const s = makeScene();
  s.money = 5000;
  s.buyMagnet(); s.buyMagnet(); // L2
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
test("V4.1 P2: magnet buys are denied when broke, and MAX after L4", () => {
  const s = makeScene();
  s.money = 100;
  s.buyMagnet();
  eq(s.magnetLevel, 0, "L1 denied at $100");
  eq(s.money, 100, "money untouched");
  s.money = 3000;
  s.buyMagnet(); eq(s.magnetLevel, 1); eq(s.money, 2750, "L1 costs $250");
  s.buyMagnet(); eq(s.magnetLevel, 2); eq(s.money, 2350, "L2 costs $400");
  s.buyMagnet(); eq(s.magnetLevel, 3); eq(s.money, 1750, "L3 costs $600");
  s.buyMagnet(); eq(s.magnetLevel, 4); eq(s.money, 850, "L4 costs $900");
  eq(s.magnetBtn.text.text, "Magnet ✓ MAX", "button shows MAX after L4");
  assert(s.magnetTip().indexOf("MAX") >= 0, "tip says MAX: " + s.magnetTip());
  s.buyMagnet();
  eq(s.magnetLevel, 4, "no level 5");
  eq(s.money, 850, "no charge after MAX");
});
test("V4.1 P2: magnet labels show level and next cost at every level", () => {
  const s = makeScene();
  s.money = 5000;
  eq(s.magnetLabel(), "Magnet $250", "L0 shows the L1 cost");
  s.buyMagnet(); eq(s.magnetLabel(), "Magnet L1 · $400");
  s.buyMagnet(); eq(s.magnetLabel(), "Magnet L2 · $600");
  s.buyMagnet(); eq(s.magnetLabel(), "Magnet L3 · $900");
  s.buyMagnet(); eq(s.magnetLabel(), "Magnet ✓ MAX");
  assert(s.magnetTip().indexOf("Drag 170") >= 0, "MAX tip names Drag 170");
  assert(s.magnetTip().indexOf("170px") >= 0, "MAX tip names the radius");
});
test("V4.1 P2: old magnet drift is gone — L1 does not pull coins to the centre", () => {
  const s = makeScene();
  s.money = 1000;
  s.buyMagnet(); // L1 only: hover, no drift, no drag
  const f = s.fish[0];
  s.dropCoin(f);
  const coin = s.coins[s.coins.length - 1];
  coin.container.x = 100; coin.container.y = 100;
  step(s, 1, () => keepFed(s));
  assert(Math.abs(coin.container.x - 100) < 5,
    "L1 coin does not drift toward the centre (old drift moved it 30px/s): x=" + coin.container.x.toFixed(1));
});
test("V4.1 P2: magnet drag does not fight Turbo — he still collects landed coins", () => {
  const s = makeScene();
  s.money = 5000;
  s.buyMagnet(); // L1 only: hover, no drag — Turbo's floor is untouched
  s.buyTurboOrSpeed();
  assert(s.snail !== null, "Turbo bought");
  const f = s.fish[0];
  s.dropCoin(f);
  const coin = s.coins[s.coins.length - 1];
  // Land the coin right under Turbo and let him collect it.
  coin.container.x = s.snail.sprite.x; coin.container.y = G.CONFIG.floorY;
  const moneyBefore = s.money;
  step(s, 1, () => keepFed(s));
  assert(!s.coins.includes(coin), "Turbo still collects a landed coin with the magnet owned");
  assert(s.money > moneyBefore, "Turbo's collection banks the coin");
});
test("V4.1 P2: description bar text on hover for magnet and decor", () => {
  const s = makeScene();
  s.money = 5000;
  s.magnetBtn.bg._handlers["pointerover"]();
  assert(s.descBarText.text.indexOf("$250") >= 0, "magnet bar shows the L1 cost: " + s.descBarText.text);
  assert(s.descBarText.text.indexOf("Hover collect") >= 0, "magnet bar names L1");
  s.buyMagnet();
  s.magnetBtn.bg._handlers["pointerover"]();
  assert(s.descBarText.text.indexOf("$400") >= 0, "magnet bar shows the next cost after L1: " + s.descBarText.text);
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
  eq(s.feedHoldTimer, G.CONFIG.feedHoldIntervalSec, "timer set to the full cadence");
});

test("hold-to-feed: holding for 1s drops ~5/s, not every frame", () => {
  const s = makeScene();
  s.onPointerDown({ x: 850, y: 150 });
  step(s, 1, () => keepFed(s));
  // 1 press pellet + 10 cadence pellets (one per 0.1s).
  eq(s.pellets.length, 11, "1 + 10 pellets after 1s of holding, got " + s.pellets.length);
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
  // updateFeedHold runs before updatePellets, so a fresh pellet sinks
  // one frame (55 px/s * 0.1s) before we look at it.
  assert(Math.abs(last.sprite.y - (300 + 55 * 0.1)) < 1e-9, "latest pellet dropped at the moved y minus one frame of sink: " + last.sprite.y);
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
  // loop's granularity cap. 1 press + 10 frame drops.
  eq(s.pellets.length, 11, "1 + 10 pellets at 2x (one per frame), got " + s.pellets.length);
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
