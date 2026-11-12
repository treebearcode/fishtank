// config.js — every number and constant that defines the game, in one place.
// Change the economy here, not scattered through the code.

export const CONFIG = {
  width: 960,
  height: 540,
  waterBottom: 460,   // y of the shop bar (water is 0..460)
  floorY: 428,        // y where coins land / the snail crawls
  startMoney: 200,
  startFish: 2,
  foodCost: 2,        // $ per standard pellet
  snailCost: 200,
  snailSpeed: 60,     // px per second along the floor
  snailSpeedUpgraded: 90, // Turbo after the $150 speed upgrade
  snailSpeedCost: 150,
  // How far past a SINKING coin's landing x Turbo aims, so he overshoots
  // and paces back across it while it floats down. Once it lands he aims
  // exactly at it (see snailAimX). Change this ONE number to tune it.
  snailOvershootPx: 20,
  crabCost: 300,
  crabSpeed: 60,      // px/s, in 2D — Claws chases sinking coins
  deluxeFoodCost: 5,  // $ per deluxe pellet (counts as 2 feeds)
  deluxeFeeds: 2,
  feedHoldIntervalSec: 0.1, // hold-to-feed: a pellet every 0.1s (~10/s, spam-click pace)
  coralCost: 75,
  chestCost: 100,
  castleCost: 150,
  decorBonusEach: 0.05, // +5% coin value per decoration owned
  tankUpgradeCost: 200,
  maxFishUpgraded: 28, // fish cap after the tank upgrade
  goalBankTarget: 1000, // lifetime $ collected this session
  goalLargeTarget: 3,   // large fish owned at the same time
  maxFish: 16,        // shop stops selling past this (tank gets crowded)
  feederCost: 400,        // feeder-bot, once, toggleable
  feederIntervalSec: 15,  // one standard pellet this often, when ON
  coinHitRadius: 24,      // generous coin hitbox (sprite is ~10-13px)
  pokeMaxMove: 8,         // px — tap a fish and move less = poke
  pokeMaxMs: 250,         // ms — release within this = poke, not grab
  FEED_COOLDOWN_S: 0.5, // how long a fish waits after eating before it
  // can eat again. The ONLY anti-hogging: any eligible fish that touches
  // a pellet eats it, first arrival wins, so a fish that just ate sits
  // out the next 0.5s and a rapid second pellet goes to someone else.
  sepRadiusPx: 36,     // pairs closer than this drift apart
  sepCrowdMult: 1.5,   // push multiplier when a fish has 2+ neighbours
  postMealDriftSec: 1, // how long the post-meal drift lasts
  postMealDriftPx: 60, // how far from the pellet the fed fish drifts
  robotSpeed: 35,      // px/s, gentle — it is a pet, not a hunter
  hungryAfterSec: 20,  // seconds without food before a fish is hungry
  diesAfterSec: 50,    // seconds without food before a fish dies
  coinBottomLifeSec: 10, // seconds a landed coin sits there before fading
  breedHeartsSec: 3,     // hearts animation while a pair swims together
  breedPregnantSec: 15,  // the pregnant fish carries the egg this long
  breedEggWaitSec: 20,   // the egg sits on the floor this long before hatching
  breedCooldownSec: 60,  // each parent waits this long after the egg pops
};

// SPECIES TABLE — every buyable fish, in one place.
//   Guppy    $100 — speed 45, coins $1/$5/$10 every ~8s, grows at 3/6 feeds.
//   Emberfin $250 — fast (65), coins every ~6s, $1/$5/$9.
//   Chomper  $400 — slow (30), grows slower (4/8 feeds), big coins $3/$10/$20.
//   Starfish $300 — slow (25), swims LOW (bottom third), coins every ~12s,
//                    $2/$6/$12, star-shaped body, NO tail.
// colors[] is the body colour per growth stage (small/medium/large).
// sellPrices[] scale with the buy cost. `size` is the species' rendered-size
// multiplier (Chomper 1.3x, Starfish 0.95x) — VISUAL only: it changes
// nothing about coins, sell prices, or feeding (see fishScale).
export const SPECIES = {
  guppy:    { key: "guppy",    name: "Guppy",    cost: 100, speed: 45, coinEverySec: 8,  coinValues: [1, 5, 10],  feedsToMedium: 3, feedsToLarge: 6, sellPrices: [50, 100, 150],  colors: [0xff9f43, 0xff6b81, 0x9b7ede], swimLow: false, hasTail: true,  size: 1.0 },
  emberfin: { key: "emberfin", name: "Emberfin", cost: 250, speed: 65, coinEverySec: 6,  coinValues: [1, 5, 9],   feedsToMedium: 3, feedsToLarge: 6, sellPrices: [125, 200, 300], colors: [0xff5a2a, 0xff7a1a, 0xffb03a], swimLow: false, hasTail: true,  size: 1.0 },
  chomper:  { key: "chomper",  name: "Chomper",  cost: 400, speed: 30, coinEverySec: 8,  coinValues: [3, 10, 20],  feedsToMedium: 4, feedsToLarge: 8, sellPrices: [200, 350, 500], colors: [0x5b2a86, 0x7a3fb0, 0x9a63d0], swimLow: false, hasTail: true,  size: 1.3 },
  starfish: { key: "starfish", name: "Starfish", cost: 300, speed: 25, coinEverySec: 12, coinValues: [2, 6, 12],  feedsToMedium: 3, feedsToLarge: 6, sellPrices: [150, 250, 350], colors: [0xff5c8a, 0xff8fb3, 0xff4d80], swimLow: true,  hasTail: false, size: 0.95 },
};
export const SPECIES_ORDER = ["guppy", "emberfin", "chomper", "starfish"];
export function speciesDef(key) { return SPECIES[key] || SPECIES.guppy; }

// SHOP LAYOUT: two rows across 960px. Each slot is 960/9 ≈ 106.7px wide;
// buttons are 100x30, so labels stay readable.
//   Row 1 (y 478): the 4 species + Turbo + Claws + Feeder-bot (cols 0-6)
//     + Magnet, WIDE (spans cols 7-8, 206px).
//   Row 2 (y 514): Std / Dlx food + Decor + Tank + 2x Speed + Sell (cols 0-5).
// Sell is a DROP ZONE, not a purchase — the drag-to-sell check uses
// SELL_BOUNDS, which is derived from this layout (row 2, col 5).
export const SHOP = { cols: 9, slotW: 960 / 9, btnW: 100, btnH: 30, row1Y: 478, row2Y: 514 };
export const SHOP_COL_X = (i) => SHOP.slotW * (i + 0.5);
// Sell button bounds (shop grid, row 2 col 5): x 537..637, y 499..529.
export const SELL_BOUNDS = { x0: 537, x1: 637, y0: 499, y1: 529 };

// DESCRIPTION BAR: one FIXED single-line strip, always visible, spanning
// the width just above the shop buttons. Spans y 448..462 — it overlaps
// only the very bottom of the water (waterBottom 460), never a button.
// Hovering a shop button shows its description here; otherwise the default.
export const DESC_BAR = { y: 455, h: 14 };
export const DESC_DEFAULT_TEXT = "Hover a button for details — click water to drop food (hold to keep feeding).";

// DECOR PANEL GEOMETRY: the panel opens ABOVE the shop buttons, over the
// tank's bottom edge, never over other buttons. Width 320, height 104,
// centred on the Decor button's column, bottom edge just above the
// description bar. Header + 3 rows of 22px.
export const DECOR_PANEL = { w: 320, h: 104, cx: 267, cy: 394 };

// FEEDER-BOT SWIM BAND: the robot swims the upper/mid water only and must
// NEVER go deeper than y = 300, so the pellets it drops have fall time and
// fish can intercept them before they hit the floor.
export const ROBOT_BAND = { minY: 80, maxY: 300, minX: 40, maxX: 920 };

// Coin colours by growth stage (silver / gold / diamond).
export const COIN_COLORS = [0xc0c8d0, 0xffd23f, 0x7fe7ff];
