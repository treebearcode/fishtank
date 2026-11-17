// scene/events.js — TankScene mixin: RANDOM EVENTS.
//
// One event at a time, never overlapping. The scheduler ticks in the
// main update() loop: the first event lands 60-90s after Start, then
// a random 120-240s gap after the previous event ends. update()
// already returns early before Start, while paused, and while the
// goal popup is open (it sets paused), so no extra guards are needed
// here — the scheduler simply never runs in those states, and an
// active event freezes with everything else.
//
// The three events (Victor's cut — Coin Shower and Bubble Storm were
// dropped: the shower overlaps Coin Rush, the storm felt weak):
//   Golden Guppy — a rare gold fish swims across once (~15s). One
//     click drops a $25 coin, then it swims off faster. Ignored, it
//     just leaves. It is NOT a real fish: it lives in this.goldenGuppy,
//     never in this.fish, so it can't be grabbed, sold, fed, bred,
//     hunted, or counted toward the cap.
//   Coin Rush — 20s where every fish drops coins twice as often
//     (fish.js multiplies the coin timer while this.coinRushSec > 0).
//     The description bar shows the countdown while it runs.
//   Treasure Chest — floats up from the floor, bobs 12s. One click
//     opens it: $50, $100, or a free small guppy (money instead at
//     the fish cap). Unclicked it sinks away with no reward.
//
// Every event announces itself with a toast + the event fanfare, so
// it can't be missed while you're looking at the shop.

import { CONFIG } from "../config.js";
import { addMoney, moneyFmt } from "../economy.js";
import { tailJointFor, tailRotationFor } from "../animation.js";
import { sfx } from "../sound.js";

const EVENT_KINDS = ["guppy", "rush", "chest"];

export const eventsMixin = {
  // (Re)arm the scheduler. first=true after Start / Reset: the
  // first event comes 60-90s in. Otherwise a random 120-240s gap
  // after the event that just ended.
  resetEventTimer(first) {
    this.eventTimerSec = first
      ? CONFIG.eventFirstMinSec + Math.random() * (CONFIG.eventFirstMaxSec - CONFIG.eventFirstMinSec)
      : CONFIG.eventGapMinSec + Math.random() * (CONFIG.eventGapMaxSec - CONFIG.eventGapMinSec);
  },

  // Destroy any active event objects and re-arm the timer. Called
  // by resetTank() — a fresh tank starts the event clock over, with
  // no leftover guppy or chest floating around.
  clearEvents() {
    if (this.goldenGuppy) {
      this.goldenGuppy.sprite.destroy();
      if (this.goldenGuppy.tail) this.goldenGuppy.tail.destroy();
      this.goldenGuppy = null;
    }
    if (this.chest) {
      this.chest.sprite.destroy();
      this.chest = null;
    }
    this.activeEvent = null;
    this.coinRushSec = 0;
    this._rushShownSec = -1;
    this.resetEventTimer(true);
    this.resetDescText();
  },

  // Per-frame, from update(). Ticks the scheduler when idle, and
  // the active event while one runs.
  updateEvents(dt, time) {
    if (this.activeEvent) {
      if (this.activeEvent === "guppy") this.updateGoldenGuppy(dt, time);
      else if (this.activeEvent === "chest") this.updateChest(dt, time);
      else if (this.activeEvent === "rush") this.updateCoinRush(dt);
      return;
    }
    this.eventTimerSec -= dt;
    if (this.eventTimerSec <= 0) {
      this.startEvent(EVENT_KINDS[Math.floor(Math.random() * EVENT_KINDS.length)]);
    }
  },

  // Start one event by kind (also the test hook — the scheduler
  // picks randomly, tests pick directly). Sets activeEvent, announces
  // it, and builds the event's objects.
  startEvent(kind) {
    this.activeEvent = kind;
    if (kind === "guppy") this.spawnGoldenGuppy();
    else if (kind === "rush") this.startCoinRush();
    else if (kind === "chest") this.spawnChest();
  },

  // An event is over: clear the flag and re-arm the gap timer. The
  // per-event updater calls this when its object leaves / expires.
  endEvent() {
    this.activeEvent = null;
    this.resetEventTimer(false);
  },

  // --- GOLDEN GUPPY -------------------------------------------------------
  // A medium guppy's body + tail, tinted gold, slightly larger than
  // life. It swims straight across at 70 px/s (a ~15s crossing) at a
  // random height, with a gentle bob and a wagging tail. It swims
  // either way across — left-to-right or right-to-left.
  spawnGoldenGuppy() {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const baseY = 140 + Math.random() * 180; // 140..320 — mid-water, never the top strip
    const x = dir > 0 ? -50 : CONFIG.width + 50;
    const scale = 1.1;
    const tail = this.add.image(x, baseY, "fish-tail-guppy-1").setOrigin(1, 0.5).setDepth(5);
    const sprite = this.add.image(x, baseY, "fish-body-guppy-1").setDepth(5);
    sprite.setScale(scale, scale);
    sprite.setTint(0xffd23f);
    tail.setScale(scale, scale);
    tail.setTint(0xffd23f);
    this.goldenGuppy = {
      sprite, tail, dir, baseY, scale,
      clicked: false, // one click only — the $25 coin drops once
      ageSec: 0,
      bobPhase: Math.random() * Math.PI * 2,
      wigglePhase: Math.random() * Math.PI * 2,
    };
    this.toast("✨ A Golden Guppy is visiting! Click it for a $25 coin!");
    sfx.event();
  },

  updateGoldenGuppy(dt, time) {
    const g = this.goldenGuppy;
    if (!g) { this.endEvent(); return; }
    g.ageSec += dt;
    // Clicked guppies hurry off at double speed — the reward is
    // already dropped, the visit is over.
    const speed = CONFIG.goldenGuppySpeedPxS * (g.clicked ? 2 : 1);
    g.sprite.x += g.dir * speed * dt;
    // Gentle bob and tail wag, like a real fish's animateFish but
    // without the full fish object (this is a visitor, not a fish).
    g.wigglePhase += dt * 6;
    const wiggle = Math.sin(g.wigglePhase) * 0.35;
    g.sprite.y = g.baseY + Math.sin(time / 500 + g.bobPhase) * 4;
    g.sprite.setFlipX(g.dir < 0);
    const facingLeft = g.dir < 0;
    const localX = tailJointFor(facingLeft, g.scale);
    g.tail.x = g.sprite.x + localX;
    g.tail.y = g.sprite.y;
    g.tail.rotation = tailRotationFor(0, wiggle, facingLeft);
    g.tail.setFlipX(false);
    // Off the far edge (or past its ~15s crossing): the visit ends.
    if (g.sprite.x < -60 || g.sprite.x > CONFIG.width + 60 || g.ageSec >= CONFIG.goldenGuppySec + 5) {
      g.sprite.destroy();
      if (g.tail) g.tail.destroy();
      this.goldenGuppy = null;
      this.endEvent();
    }
  },

  // The pointer dispatcher calls this when the golden guppy is
  // clicked (checked BEFORE fish, so a fish behind it is never
  // grabbed by mistake). One $25 bonus coin at the guppy's spot,
  // then it hurries off — the click itself never drops food.
  collectGoldenGuppy() {
    const g = this.goldenGuppy;
    if (!g || g.clicked) return;
    g.clicked = true;
    this.dropBonusCoin(g.sprite.x, g.sprite.y + 14, CONFIG.goldenGuppyValue);
    for (let i = 0; i < 5; i++) this.spawnBubble(g.sprite.x, g.sprite.y);
    this.toast("✨ Golden Guppy! A $25 coin drops!");
    sfx.coin();
  },

  // --- COIN RUSH ----------------------------------------------------------
  startCoinRush() {
    this.coinRushSec = CONFIG.coinRushSec;
    this._rushShownSec = -1;
    this.toast("🪙 Coin Rush! Fish drop coins twice as fast for 20s!");
    sfx.event();
  },

  updateCoinRush(dt) {
    this.coinRushSec -= dt;
    // Countdown in the description bar, so the player can always
    // tell the rush is on and how long is left. Rewritten every
    // frame, so a hover description never sticks over it for long.
    const left = Math.max(0, Math.ceil(this.coinRushSec));
    if (left !== this._rushShownSec) {
      this._rushShownSec = left;
      this.showDescText("🪙 Coin Rush! Coins drop twice as fast — " + left + "s left");
    }
    if (this.coinRushSec <= 0) {
      this.coinRushSec = 0;
      this.resetDescText();
      this.endEvent();
    }
  },

  // --- TREASURE CHEST -----------------------------------------------------
  // Spawns on the floor at a random x, floats up to its bob height,
  // then bobs for the rest of its 12s life. The chest is one sprite
  // (see makeTreasureChestTexture) — no shop/decor involvement.
  spawnChest() {
    const x = 100 + Math.random() * (CONFIG.width - 200);
    const sprite = this.add.image(x, CONFIG.floorY, "chest-event").setDepth(5);
    this.chest = {
      sprite, x,
      ageSec: 0,              // life timer — 12s from spawn, then it sinks away
      bobPhase: Math.random() * Math.PI * 2,
      bobY: CONFIG.chestBobY, // height it floats up to before bobbing
      rising: true,           // still floating up from the floor
    };
    this.toast("💰 A treasure chest floats up! Click it to open!");
    sfx.event();
  },

  updateChest(dt, time) {
    const c = this.chest;
    if (!c) { this.endEvent(); return; }
    c.ageSec += dt;
    const s = c.sprite;
    if (c.rising) {
      s.y -= CONFIG.chestRisePxS * dt;
      if (s.y <= c.bobY) { s.y = c.bobY; c.rising = false; }
    } else {
      s.y = c.bobY + Math.sin(time / 500 + c.bobPhase) * 4;
    }
    // Fade over the last 2s, like a landed coin.
    if (c.ageSec > CONFIG.chestLifeSec - 2) {
      s.setAlpha(1 - (c.ageSec - (CONFIG.chestLifeSec - 2)) / 2);
    }
    if (c.ageSec >= CONFIG.chestLifeSec) {
      // Unclicked: it sinks away with no reward and no fuss.
      s.destroy();
      this.chest = null;
      this.endEvent();
    }
  },

  // Pure reward roll, so tests can pin the outcome: roll < 1/3 is
  // $50, roll < 2/3 is $100, the rest is a free small guppy — or
  // $100 instead when the tank is at the fish cap (a free fish
  // would have nowhere to go).
  chestRewardFor(roll, atCap) {
    if (roll < 1 / 3) return { type: "money", value: 50 };
    if (roll < 2 / 3) return { type: "money", value: 100 };
    if (atCap) return { type: "money", value: 100 };
    return { type: "guppy" };
  },

  // The pointer dispatcher calls this when the chest is clicked.
  // Exactly one reward, then the chest is gone.
  openChest() {
    const c = this.chest;
    if (!c) return;
    const reward = this.chestRewardFor(Math.random(), this.fish.length >= this.maxFishCap());
    const x = c.sprite.x, y = c.sprite.y;
    c.sprite.destroy();
    this.chest = null;
    for (let i = 0; i < 5; i++) this.spawnBubble(x, y);
    if (reward.type === "money") {
      this.money = addMoney(this.money, reward.value);
      this.totalBanked = addMoney(this.totalBanked, reward.value);
      this.toast("💰 Treasure! +" + moneyFmt(reward.value) + "!");
      this.updateShopUI();
      this.updateTopUI();
      this.updateGoalUI();
    } else {
      this.spawnFish(x, y, "guppy");
      this.toast("🐟 Treasure! A free baby guppy joins your tank!");
    }
    sfx.buy();
    this.endEvent();
  },
};
