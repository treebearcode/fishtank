// savecode.js — PURE import/export save-code codec. No Phaser, no
// side effects: plain state objects in, strings out (and back).
//
// THE CODE IS THE SAVE. There is no localStorage, no cookies, no
// server — the player copies the code out (pause menu) and pastes it
// back on the title screen. Everything below is bit-packed on purpose:
// a naive JSON of the same state is 2000+ characters, these codes are
// ~25 chars for a starter tank and ~93 for a full 16-fish tank.
//
// ENCODING — base64url, not base58. base64url carries 6 bits per
// character (base58 manages ~5.86) and maps straight onto the
// bitstream, so no BigInt math is needed — the codec is a handful of
// shifts. The code is grouped with dots every 6 characters for
// readability; decoding strips them (and any whitespace). The
// separator is a dot DELIBERATELY — "-" is a base64url character
// (value 62), so using it as the separator would eat payload dashes
// on decode and corrupt any code that happened to contain one.
//
// BIT LAYOUT (MSB-first, all fields fixed-width unless noted):
//   version      4 bits  (1 — future formats get a new nibble)
//   fishCount    6 bits  (0-63 — export refuses a tank past 63)
//   moneyCents  24 bits  (exact to the cent, saturates at $167,772.15)
//   bankedCents 24 bits  (lifetime banked, same cap — the goal only
//                          needs $1,000, so saturation is harmless)
//   helpers     14 bits  (snail, snailUpgraded, crab, feederOwned,
//                          feederOn, magnetLevel 2, coral, chest,
//                          castle, tankUpgraded, foodType 2, goalComplete)
//   per fish    25 bits  (species 2, feeds 4, hunger 5, tempo 3,
//                          trait 3, pattern 2, hue 2, hat 3, royal 1)
//   CRC-8        8 bits  (poly 0x07 over the payload bytes — a typo'd
//                          code is REJECTED, never loaded as garbage)
// Stage is NOT stored: it is fully determined by (feeds, species,
// royal gene) via stageForFeeds, so the loader derives it and a
// loaded fish can never disagree with the game's own growth rules.
// Hunger is quantized to 2s steps (0-50s fits in 5 bits) and tempo to
// 8 levels (0.85-1.2 in 0.05 steps) — exact seconds and exact tempo
// are not worth bits. Money is exact to the cent up to the cap.
// Total: 80 + 25N bits — 16 chars for an empty tank, ~25 for 2 fish,
// ~93 for a full 16-fish tank (dots included).

import { CONFIG, SPECIES_ORDER, TRAITS, PATTERNS, HATS, HUE_TINTS } from "./config.js";

export const SAVE_CODE_VERSION = 1;
export const SAVE_CODE_MAX_FISH = 63; // 6-bit fish count
const MONEY_MAX_CENTS = 0xffffff; // $167,772.15 — saturates, never wraps

const FOOD_TYPES = ["standard", "deluxe", "plant"];

// --- Bit writer / reader (MSB-first) ---------------------------------------
function makeBitWriter() {
  const bytes = [];
  let cur = 0, nbits = 0;
  return {
    write(value, bits) {
      for (let i = bits - 1; i >= 0; i--) {
        cur = (cur << 1) | ((value >> i) & 1);
        nbits++;
        if (nbits === 8) { bytes.push(cur); cur = 0; nbits = 0; }
      }
    },
    // Pad the last byte with zero bits and return the byte array.
    finish() {
      if (nbits > 0) { bytes.push(cur << (8 - nbits)); cur = 0; nbits = 0; }
      return bytes;
    },
  };
}

function makeBitReader(bytes) {
  let byteIdx = 0, bitIdx = 0;
  return {
    read(bits) {
      let v = 0;
      for (let i = 0; i < bits; i++) {
        if (byteIdx >= bytes.length) return null;
        v = (v << 1) | ((bytes[byteIdx] >> (7 - bitIdx)) & 1);
        bitIdx++;
        if (bitIdx === 8) { bitIdx = 0; byteIdx++; }
      }
      return v;
    },
    bitsLeft() { return (bytes.length - byteIdx) * 8 - bitIdx; },
  };
}

// --- CRC-8 (poly 0x07, init 0x00) -------------------------------------------
function crc8(bytes) {
  let crc = 0;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x80) ? (((crc << 1) ^ 0x07) & 0xff) : ((crc << 1) & 0xff);
    }
  }
  return crc;
}

// --- base64url, hand-rolled (no btoa — this module runs in node too) ------
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
function bytesToBase64url(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = i + 1 < bytes.length ? bytes[i + 1] : 0, b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (b0 << 16) | (b1 << 8) | b2;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += B64[n & 63];
  }
  return out;
}
function base64urlToBytes(str) {
  let acc = 0, nbits = 0;
  const bytes = [];
  for (const ch of str) {
    const v = B64.indexOf(ch);
    if (v < 0) return null;
    acc = (acc << 6) | v;
    nbits += 6;
    if (nbits >= 8) {
      nbits -= 8;
      bytes.push((acc >> nbits) & 0xff);
    }
  }
  return bytes; // leftover bits (<8) are the zero padding from encode
}

// Hat codes: 0 = none, 1-6 = HATS in order, 7 = crown (royal only —
// a crown is never rolled at spawn, it only ever comes from a fish
// that turned royal, so a code can only carry one on a stage-3 fish).
function hatCode(hatKind) {
  if (!hatKind) return 0;
  if (hatKind === "crown") return 7;
  const i = HATS.indexOf(hatKind);
  return i < 0 ? 0 : i + 1;
}
function hatFromCode(code) {
  if (code === 0) return null;
  if (code === 7) return "crown";
  return HATS[code - 1];
}

// Encode a plain state object (see collectSaveState in
// scene/savecode.js for the shape) into a dashed save code. Returns
// null when the tank holds more fish than the 6-bit count allows —
// the caller toasts instead of exporting a truncated save.
export function encodeSaveCode(state) {
  const fish = state.fish || [];
  if (fish.length > SAVE_CODE_MAX_FISH) return null;
  const w = makeBitWriter();
  w.write(SAVE_CODE_VERSION, 4);
  w.write(fish.length, 6);
  w.write(Math.max(0, Math.min(MONEY_MAX_CENTS, Math.round((state.money || 0) * 100))), 24);
  w.write(Math.max(0, Math.min(MONEY_MAX_CENTS, Math.round((state.totalBanked || 0) * 100))), 24);
  const d = state.decorations || {};
  w.write(state.snail ? 1 : 0, 1);
  w.write(state.snailUpgraded ? 1 : 0, 1);
  w.write(state.crab ? 1 : 0, 1);
  w.write(state.feederOwned ? 1 : 0, 1);
  w.write(state.feederOn ? 1 : 0, 1);
  w.write(Math.max(0, Math.min(3, state.magnetLevel || 0)), 2);
  w.write(d.coral ? 1 : 0, 1);
  w.write(d.chest ? 1 : 0, 1);
  w.write(d.castle ? 1 : 0, 1);
  w.write(state.tankUpgraded ? 1 : 0, 1);
  w.write(Math.max(0, FOOD_TYPES.indexOf(state.foodType)), 2);
  w.write(state.goalComplete ? 1 : 0, 1);
  for (const f of fish) {
    w.write(Math.max(0, SPECIES_ORDER.indexOf(f.species)), 2);
    w.write(Math.max(0, Math.min(15, f.feeds || 0)), 4);
    // Hunger in 2s steps — a fish at 49s loads at 48s, one extra
    // second of grace, never a surprise death.
    w.write(Math.max(0, Math.min(31, Math.floor((f.hungerSec || 0) / 2))), 5);
    const tempo = f.tempo === undefined ? 1 : f.tempo;
    w.write(Math.max(0, Math.min(7, Math.round((tempo - CONFIG.tempoMin) / (CONFIG.tempoMax - CONFIG.tempoMin) * 7))), 3);
    w.write(Math.max(0, TRAITS.indexOf(f.trait)), 3);
    w.write(Math.max(0, PATTERNS.indexOf(f.pattern)), 2);
    w.write(Math.max(0, HUE_TINTS.indexOf(f.hueTint)), 2);
    w.write(hatCode(f.hatKind), 3);
    w.write(f.royalGene ? 1 : 0, 1);
  }
  const payload = w.finish();
  const all = payload.concat([crc8(payload)]);
  const b64 = bytesToBase64url(all);
  const groups = [];
  for (let i = 0; i < b64.length; i += 6) groups.push(b64.slice(i, i + 6));
  return groups.join(".");
}

// Decode a save code back into a plain state object. Returns
// { ok: true, state } or { ok: false, reason } — a typo'd, truncated
// or hand-edited code is REJECTED, never loaded as garbage. The
// caller shows the human error text; the reason here is for tests.
export function decodeSaveCode(code) {
  const fail = (reason) => ({ ok: false, reason });
  if (typeof code !== "string") return fail("not a string");
  const clean = code.replace(/[.\s]/g, "");
  if (clean.length < 14) return fail("too short");
  if (/[^A-Za-z0-9_-]/.test(clean)) return fail("bad characters");
  const bytes = base64urlToBytes(clean);
  // 10 bytes is the smallest valid code (empty tank: 9 payload + CRC).
  if (!bytes || bytes.length < 10) return fail("too short");
  const crc = bytes[bytes.length - 1];
  const payload = bytes.slice(0, -1);
  if (crc8(payload) !== crc) return fail("checksum mismatch");
  const r = makeBitReader(payload);
  const version = r.read(4);
  if (version === null || version !== SAVE_CODE_VERSION) return fail("unsupported version");
  const fishCount = r.read(6);
  if (fishCount === null || fishCount > SAVE_CODE_MAX_FISH) return fail("bad fish count");
  const moneyCents = r.read(24);
  const bankedCents = r.read(24);
  if (moneyCents === null || bankedCents === null) return fail("truncated");
  const snail = r.read(1) === 1;
  const snailUpgraded = r.read(1) === 1;
  const crab = r.read(1) === 1;
  const feederOwned = r.read(1) === 1;
  const feederOn = r.read(1) === 1;
  const magnetLevel = r.read(2);
  const coral = r.read(1) === 1;
  const chest = r.read(1) === 1;
  const castle = r.read(1) === 1;
  const tankUpgraded = r.read(1) === 1;
  const foodTypeIdx = r.read(2);
  const goalComplete = r.read(1) === 1;
  if (magnetLevel === null || foodTypeIdx === null || foodTypeIdx > 2) return fail("bad helpers");
  const fish = [];
  for (let i = 0; i < fishCount; i++) {
    const speciesIdx = r.read(2);
    const feeds = r.read(4);
    const hungerQ = r.read(5);
    const tempoQ = r.read(3);
    const traitIdx = r.read(3);
    const patternIdx = r.read(2);
    const hueIdx = r.read(2);
    const hat = r.read(3);
    const royalGene = r.read(1) === 1;
    if (speciesIdx === null || feeds === null || hungerQ === null || tempoQ === null ||
        traitIdx === null || patternIdx === null || hueIdx === null || hat === null) return fail("truncated");
    if (traitIdx >= TRAITS.length || hueIdx >= HUE_TINTS.length) return fail("bad fish data");
    fish.push({
      species: SPECIES_ORDER[speciesIdx],
      feeds,
      hungerSec: hungerQ * 2,
      tempo: CONFIG.tempoMin + (tempoQ / 7) * (CONFIG.tempoMax - CONFIG.tempoMin),
      trait: TRAITS[traitIdx],
      pattern: PATTERNS[patternIdx],
      hueTint: HUE_TINTS[hueIdx],
      hatKind: hatFromCode(hat),
      royalGene,
    });
  }
  // The only bits left must be zero padding (at most 7 of them).
  const rest = r.bitsLeft();
  if (rest > 7) return fail("trailing data");
  let pad = 0;
  for (let i = 0; i < rest; i++) pad = (pad << 1) | r.read(1);
  if (pad !== 0) return fail("bad padding");
  return {
    ok: true,
    state: {
      money: moneyCents / 100,
      totalBanked: bankedCents / 100,
      fish,
      snail, snailUpgraded, crab, feederOwned, feederOn, magnetLevel,
      decorations: { coral, chest, castle },
      tankUpgraded,
      foodType: FOOD_TYPES[foodTypeIdx],
      goalComplete,
    },
  };
}
