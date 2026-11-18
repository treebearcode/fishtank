// config.js — every number and constant that defines the game, in one place.
// Change the economy here, not scattered through the code.

export const CONFIG = {
  width: 960,
  height: 540,
  waterBottom: 460,   // y of the shop bar (water is 0..460)
  floorY: 428,        // y where coins land / the snail crawls
  fishMinY: 100,      // live fish never swim above this — the top
  // strip is a safe place to drop food without grabbing a fish by
  // accident. Dead fish are exempt (they bob at the surface, y~56,
  // and are inert, so clicking one drops food anyway).
  pelletSinkPxS: 40, // pellets sink at this speed (was 55 — slower
  // so a pellet dropped in the top strip has time to be noticed)
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
  // FEAST PLANT: a big food that many fish share — $40 for 30
  // nibbles, dropped from the cursor like any food. It sinks slowly
  // (25 px/s, visibly lazier than a 40 px/s pellet), fish may nibble
  // it on the way down, and on reaching the floor it ANCHORS and
  // stays until fully eaten — it never disappears at the floor the
  // way pellets do. Each nibble is 1 full feed. The pacing is what
  // keeps a frenzy from stripping it instantly: a fish waits 1.5s
  // between its own bites, and the plant allows at most one bite
  // every 0.4s — a full tank finishes one in ~12s, a lone fish
  // grazes for ~45s. It loses one frond per 5 nibbles, so the
  // depletion is visible. The last few nibbles strip it to a bare
  // skeleton. There is NO cap on how many plants can be out at once
  // — hold-to-feed drops one every 0.1s at $40 each, so holding the
  // button down burns $400/s until the money runs out.
  plantCost: 40,          // $ per Feast Plant
  plantNibbles: 30,       // nibbles in one plant
  plantSinkPxS: 25,       // sink speed — slower than a pellet (40)
  plantSwayPx: 8,         // sideways sway while sinking
  plantScale: 3,          // rendered size vs the original plant: ~150px tall, dwarfing a ~50px guppy
  plantChewSec: 1.5,      // a fish waits this long between its own bites
  plantGlobalSec: 0.4,    // a plant allows at most one bite this often
  plantNibbleRangePx: 50, // how close a fish must be to take a bite — measured to the plant's body, not its centre
  plantFrondEvery: 5,     // one frond lost per this many nibbles
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
  // DYNAMIC FISH SPEEDS: every fish has its own tempo, speed follows
  // hunger, and a fish chasing a sinking pellet that is just out of
  // reach bursts into a desperate sprint (see fishSpeed() in
  // scene/fish.js). The sprint is a feel change, not an economy one:
  // food, hunger, and coin timers are untouched.
  tempoMin: 0.85,      // per-fish speed factor, slowest (rolled at spawn)
  tempoMax: 1.2,       // ...fastest — same species, different fish
  hungrySpeedMult: 1.25, // a hungry fish hurries — it is looking for food
  fedSpeedMult: 0.9,   // a fish that just ate drifts lazily
  fedSpeedWindowSec: 5, // "just ate" means hungerSec under this
  sprintMinPx: 40,     // sprint only when the pellet is at least this far
  sprintMaxPx: 120,    // ...and no farther than this (else a normal chase)
  sprintMult: 1.8,     // burst speed multiplier
  sprintMaxSec: 1.5,   // a burst lasts at most this long
  sprintCooldownSec: 3, // ...then this long before it can sprint again
  // FISH TRAITS: one rolled per fish at spawn (uniform among the 5).
  // Each is a small modifier in the existing helpers — Greedy chases
  // food faster and chews plants faster; Shy flees a poke farther,
  // chases food slower, and sprints rarely; Bold sprints sooner and
  // more often; Lazy rolls a low tempo and chases food slower; Social
  // wanders toward the nearest other fish. See fishSpeed() /
  // sprintCooldownFor() / the steering code in scene/fish.js.
  greedyChaseMult: 1.15, // Greedy: food-chase speed
  greedyChewSec: 1.0,    // Greedy: plant chew pause (vs 1.5s)
  shyFleeMult: 1.5,      // Shy: poke flee speed
  shyChaseMult: 0.9,     // Shy: food-chase speed
  shySprintCooldownSec: 5, // Shy: sprint breather (vs 3s)
  boldSprintCooldownSec: 1.5, // Bold: sprint breather (vs 3s)
  boldSprintMinPx: 30,   // Bold: sprint window, wider than 40-120
  boldSprintMaxPx: 150,
  lazyChaseMult: 0.9,    // Lazy: food-chase speed
  lazyTempoMax: 1.0,     // Lazy: tempo rolls 0.85-1.0, never zippy
  socialRangePx: 200,    // Social: wanders toward a fish this close
  // PATTERNS + HATS: visual variety, rolled at spawn. Patterns are
  // baked into the body texture (plain / stripes / spots / gradient
  // belly) and kept SUBTLE — a striped guppy is still obviously a
  // guppy. Hats are small sprites above the body, cosmetic only, one
  // max. The crown is NOT in the random set — crowns mean royal only.
  hatChance: 0.2,        // ~1 in 5 fish spawns wearing a hat
  // ROYAL GENE: a rare genetic tier 4. ~5% of fish are born carrying
  // it (hidden — the fish looks normal until it turns royal). Only
  // gene carriers can grow past large into ROYAL (stage 3, +3 feeds
  // after large): crown, ~1.35x scale, 2x the large coin value and
  // 2x the large sell price, and it counts as large for the goal.
  // The gene inherits through breeding: 50% with one royal parent,
  // 75% with two, else the 5% base roll.
  royalGeneChance: 0.05, // base roll at spawn
  royalFeedsAfterLarge: 3, // feeds past large to turn royal
  royalScale: 1.35,      // growth scale at stage 3 (vs 1.2 large)
  royalCoinMult: 2,      // royal coin = 2x the large coin value
  royalSellMult: 2,      // royal sell price = 2x the large sell price
  royalGeneInheritOne: 0.5,  // one royal parent
  royalGeneInheritBoth: 0.75, // two royal parents
  coinBottomLifeSec: 10, // seconds a landed coin sits there before fading
  breedHeartsSec: 3,     // hearts animation while a pair swims together
  breedPregnantSec: 15,  // the pregnant fish carries the egg this long
  breedEggWaitSec: 20,   // the egg sits on the floor this long before hatching
  breedCooldownSec: 60,  // each parent waits this long after the egg pops
  // DEAD FISH: a starved fish floats belly-up to the surface, bobs
  // there, then fades. Rise speed, bob line, surface life (fade over
  // the last 2s, like a landed coin), and the mild knock physics —
  // a live fish that swims into one nudges it, it never launches.
  deadRisePxS: 40,        // px/s upward while below the surface (was 55)
  deadSurfaceY: 56,       // y the dead fish bobs at (just under the top bar)
  deadSurfaceLifeSec: 10, // seconds bobbing at the surface before fading
  deadKnockRadiusPx: 40,  // a live fish this close nudges a dead fish
  deadKnockImpulsePxS: 60, // velocity added by one nudge (px/s)
  deadKnockMaxPxS: 90,    // a dead fish never moves faster than this
  deadKnockDamping: 2.5,  // knock velocity decays by this much per second
  // RANDOM EVENTS: one at a time, never overlapping. The first lands
  // 60-90s after Start, then a random 120-240s gap after the previous
  // event ends. No events before Start, while paused, or while the
  // goal popup is open (the update loop returns early for all three).
  eventFirstMinSec: 60,   // first event no earlier than this after Start
  eventFirstMaxSec: 90,   // ...and no later than this
  eventGapMinSec: 120,    // gap after an event ends, at the shortest
  eventGapMaxSec: 240,    // ...at the longest
  // GLOWING JELLYFISH: drifts across once, ~15s on screen. One
  // click bursts it into five $5 coins ($25 total); ignored, it
  // just drifts off. It is NOT a real fish — it lives in its own
  // object, so it can never be grabbed, sold, or counted. A pulsing
  // comic-book starburst behind it makes it unmistakable.
  jellyfishSec: 15,        // how long the crossing takes (at 70 px/s)
  jellyfishSpeedPxS: 70,   // drift speed across the tank
  jellyfishCoins: 5,       // how many coins it bursts into when clicked
  jellyfishCoinValue: 5,   // each burst coin is $5 ($25 total)
  jellyfishPulseRadS: 3,   // bell/burst pulse speed (radians per second)
  // RESCUE MODE: if the tank is empty AND the player can't afford
  // the cheapest fish (a guppy, $100), the game is soft-locked — no
  // income exists, and a rescue fish alone would starve because the
  // player can't afford food either. The scheduler then fires a
  // guaranteed rescue chest every 5-10s until the player has a fish
  // again; the rescue chest always holds a free baby guppy, plus it
  // tops money up to $10 (never +$10, so it can't be farmed by
  // letting fish die) — five pellets of runway, enough to bootstrap
  // the coin loop.
  rescueDelayMinSec: 5,    // rescue chest no earlier than this
  rescueDelayMaxSec: 10,   // ...and no later than this
  rescueMoneyTopUp: 10,    // rescue tops the wallet up to this
  // COIN RUSH: 20s where every fish drops coins twice as often.
  coinRushSec: 20,        // how long the rush lasts
  // TREASURE CHEST: floats up from the floor, bobs 12s; one click
  // opens it for $50, $100, or a free small guppy (money instead at
  // the fish cap). Unclicked it sinks away with no reward.
  chestLifeSec: 12,       // seconds from spawn until it sinks away
  chestRisePxS: 60,       // how fast it floats up to its bob height
  chestBobY: 240,         // y it bobs at once it has floated up
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

// TRAITS: one rolled per fish at spawn, uniform. The one-line hover
// descriptions are what the description bar shows when you hover a
// fish (see fishTraitLine in scene/fish.js).
export const TRAITS = ["greedy", "shy", "bold", "lazy", "social"];
export const TRAIT_DESCS = {
  greedy: "first to food, nibbles fast",
  shy: "nervous — darts away when poked",
  bold: "sprints first, sprints often",
  lazy: "drifts along, eats last",
  social: "sticks with the school",
};

// PATTERNS: baked into the body texture at spawn (see textures.js).
// HATS: small cosmetic sprites above the body (~20% of fish). The
// crown is deliberately NOT in HATS — crowns mean royal only.
export const PATTERNS = ["plain", "stripes", "spots", "gradient"];
export const HATS = ["party", "tophat", "beanie", "pirate", "flower", "bow"];

// HUE TINTS: the per-fish hue shift, applied as the body's base tint
// (see updateFish in scene/fish.js) — near-white, so the species
// colour still reads and hunger paleness / the deluxe gold glow still
// override it exactly as before.
export const HUE_TINTS = [0xfff2e0, 0xffffff, 0xe8f4ff];

// SHOP LAYOUT: two rows across 960px. Each slot is 960/9 ≈ 106.7px wide;
// buttons are 100x30, so labels stay readable.
//   Row 1 (y 478): the 4 species + Turbo + Claws + Feeder-bot (cols 0-6)
//     + Magnet, WIDE (spans cols 7-8, 206px).
//   Row 2 (y 514): Food + Uncap + Decor + Tank + 2x Speed + Sell (cols 0-5).
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

// FOOD PANEL GEOMETRY: mirrors the Decor panel (same height, same
// bottom edge, header + 3 rows) but narrower — it hangs off the Food
// button in column 0, so a 320-wide panel would run off the left
// edge. Width 300, left edge flush with the tank's left edge.
export const FOOD_PANEL = { w: 300, h: 104, cx: 150, cy: 394 };

// FEEDER-BOT SWIM BAND: the robot swims the upper/mid water only and must
// NEVER go deeper than y = 300, so the pellets it drops have fall time and
// fish can intercept them before they hit the floor.
export const ROBOT_BAND = { minY: 110, maxY: 300, minX: 40, maxX: 920 };

// Coin colours by growth stage (silver / gold / diamond).
export const COIN_COLORS = [0xc0c8d0, 0xffd23f, 0x7fe7ff];
