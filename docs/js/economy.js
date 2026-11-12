// economy.js — PURE money / growth / coin-value helpers.
// No Phaser, no side effects: plain objects and numbers in, numbers out.
// These are the easiest bits to unit-test (see tests/headless.test.js).

import { CONFIG, speciesDef } from "./config.js";

// How many feeds make which stage? 0-2 feeds = small, then the species'
// own thresholds (guppy 3/6, Chomper 4/8). `speciesKey` is optional and
// defaults to the guppy, so old callers keep working.
export function stageForFeeds(feeds, speciesKey) {
  const sp = speciesDef(speciesKey);
  if (feeds >= sp.feedsToLarge) return 2;
  if (feeds >= sp.feedsToMedium) return 1;
  return 0;
}

// RENDERED SIZE — growth scale times species size. Growth is
// 0.6 / 0.9 / 1.2 (baby / medium / large): a baby is ~half an adult.
// Species size multiplies on top: a large Chomper renders at
// 1.2 * 1.3 = 1.56, a baby Starfish at 0.6 * 0.95 = 0.57. This is
// RENDERED size only — coin values, sell prices, and feeds-to-grow do
// NOT change with it.
export const GROWTH_SCALES = [0.6, 0.9, 1.2];
export function speciesSize(speciesKey) { return speciesDef(speciesKey).size || 1; }
export function fishScale(stage, speciesKey) {
  return GROWTH_SCALES[stage] * speciesSize(speciesKey);
}

// Coin base value by growth stage (before the decoration bonus).
export function coinValueForStage(stage, speciesKey) {
  return (speciesDef(speciesKey).coinValues[stage] || 1);
}

export function isHungry(secondsSinceFed) { return secondsSinceFed >= CONFIG.hungryAfterSec; }
export function isDead(secondsSinceFed) { return secondsSinceFed >= CONFIG.diesAfterSec; }

// Coin value after the decoration bonus. Each decoration is +5%, ADDITIVE
// (never multiplicative: x1.05^3 would be x1.158). The bonus is paid in
// CENTS, not rounded to whole dollars, so it is actually visible:
//   base $1 -> 1 / 1.05 / 1.10 / 1.15,  $5 -> 5 / 5.25 / 5.50 / 5.75,
//   $10 -> 10 / 10.50 / 11.00 / 11.50
// Money is kept as a float with cents everywhere (see moneyFmt); buy
// costs and sell prices stay whole dollars.
export function coinValueWithBonus(base, decorCount) {
  return Math.round(base * (1 + CONFIG.decorBonusEach * decorCount) * 100) / 100;
}

// How money is shown. Whole dollars print without cents ("$12"),
// anything with cents prints two decimals ("$12.35"). Float sums can
// leave dust (e.g. 12.3499999), so round to cents first.
export function moneyFmt(m) {
  const cents = Math.round((m || 0) * 100) / 100;
  return Number.isInteger(cents) ? "$" + cents : "$" + cents.toFixed(2);
}

// Add a coin's value to the balance without float dust — round the
// running total to cents after every addition, so $1.05 + $1.05 is
// $2.10, never $2.1000000000000005.
export function addMoney(balance, value) {
  return Math.round((balance + value) * 100) / 100;
}

export function decorCount(decorations) {
  return (decorations.coral ? 1 : 0) + (decorations.chest ? 1 : 0) + (decorations.castle ? 1 : 0);
}

// Goal: BOTH conditions at the same time — banked the target amount in
// this session AND the target number of large fish alive right now.
export function goalIsMet(totalBanked, largeCount) {
  return totalBanked >= CONFIG.goalBankTarget && largeCount >= CONFIG.goalLargeTarget;
}

export function countLargeFish(fish) { return fish.filter((f) => f.stage === 2).length; }

export function sellPriceForStage(stage, speciesKey) {
  return speciesDef(speciesKey).sellPrices[stage] || 50;
}
