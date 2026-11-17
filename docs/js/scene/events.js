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
// dropped: the shower overlaps Coin Rush, the storm felt weak; the
// Golden Guppy was later replaced by the Glowing Jellyfish — the gold
// tint didn't read as gold and the event wasn't obvious):
//   Glowing Jellyfish — a translucent glowing jellyfish with a
//     pulsing comic-book starburst behind it drifts across once
//     (~15s). One click bursts it into five $5 coins ($25 total).
//     Ignored, it just drifts off. It is NOT a real fish: it lives
//     in this.jellyfish, never in this.fish, so it can't be grabbed,
//     sold, fed, bred, hunted, or counted toward the cap.
//   Coin Rush — 20s where every fish drops coins twice as often
//     (fish.js multiplies the coin timer while this.coinRushSec > 0).
//     The description bar shows the countdown while it runs.
//   Treasure Chest — floats up from the floor, bobs 12s. One click
//     opens it: $50, $100, or a free small guppy (money instead at
//     the fish cap). Unclicked it sinks away with no reward.
//
// RESCUE MODE: if the tank is empty AND the player can't afford the
// cheapest fish (a guppy, $100), the game is soft-locked — no income
// exists. The scheduler then fires a guaranteed rescue chest every
// 5-10s until the player has a fish again. A rescue chest always
// holds a free baby guppy, plus it tops money up to $10 (never +$10)
// — five pellets of runway, so the rescued fish doesn't just starve
// because the player can't afford food either.
//
// Every event announces itself with a toast + the event fanfare, so
// it can't be missed while you're looking at the shop.

import { CONFIG, SPECIES } from "../config.js";
import { addMoney, moneyFmt } from "../economy.js";
import { sfx } from "../sound.js";

const EVENT_KINDS = ["jelly", "rush", "chest"];

export const eventsMixin = {
  // Soft-lock check: no fish AND the player can't afford the
  // cheapest fish (a guppy). No income exists in that state, so the
  // scheduler switches to rescue mode (see resetEventTimer).
  isSoftLocked() {
    return this.fish.length === 0 && this.money < SPECIES.guppy.cost;
  },

  // (Re)arm the scheduler. first=true after Start / Reset: the
  // first event comes 60-90s in. Otherwise a random 120-240s gap
  // after the event that just ended. In rescue mode (soft-locked)
  // the next event is a rescue chest in 5-10s instead — the normal
  // gap would leave a broke, fishless player waiting minutes.
  resetEventTimer(first) {
    if (this.isSoftLocked()) {
      this.eventTimerSec = CONFIG.rescueDelayMinSec +
        Math.random() * (CONFIG.rescueDelayMaxSec - CONFIG.rescueDelayMinSec);
      return;
    }
    this.eventTimerSec = first
      ? CONFIG.eventFirstMinSec + Math.random() * (CONFIG.eventFirstMaxSec - CONFIG.eventFirstMinSec)
      : CONFIG.eventGapMinSec + Math.random() * (CONFIG.eventGapMaxSec - CONFIG.eventGapMinSec);
  },

  // Destroy any active event objects and re-arm the timer. Called
  // by resetTank() — a fresh tank starts the event clock over, with
  // no leftover jellyfish or chest floating around.
  clearEvents() {
    if (this.jellyfish) {
      this.jellyfish.sprite.destroy();
      if (this.jellyfish.burst) this.jellyfish.burst.destroy();
      this.jellyfish = null;
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
      if (this.activeEvent === "jelly") this.updateJellyfish(dt, time);
      else if (this.activeEvent === "chest") this.updateChest(dt, time);
      else if (this.activeEvent === "rush") this.updateCoinRush(dt);
      return;
    }
    // Soft-lock re-check, every tick: the lock can start mid-gap —
    // the rescue fish starves ~50s after the rescue, while the
    // scheduler is still counting down the normal 120-240s gap it
    // armed when the player had a fish. The lock is otherwise only
    // checked when the timer fires or an event ends, never when the
    // tank empties, so without this a broke, fishless player waits
    // minutes for the next rescue. A locked player never waits
    // longer than the rescue delay; a timer already under it is
    // left alone, and a non-locked player is untouched.
    if (this.isSoftLocked() && this.eventTimerSec > CONFIG.rescueDelayMaxSec) {
      this.eventTimerSec = CONFIG.rescueDelayMinSec +
        Math.random() * (CONFIG.rescueDelayMaxSec - CONFIG.rescueDelayMinSec);
    }
    this.eventTimerSec -= dt;
    if (this.eventTimerSec <= 0) {
      // Rescue mode: the next event is always a rescue chest, never
      // a random pick — a Coin Rush does nothing with no fish, and a
      // jellyfish's $25 still leaves the player short of a $100 guppy.
      if (this.isSoftLocked()) this.startEvent("chest", true);
      else this.startEvent(EVENT_KINDS[Math.floor(Math.random() * EVENT_KINDS.length)]);
    }
  },

  // Start one event by kind (also the test hook — the scheduler
  // picks randomly, tests pick directly). Sets activeEvent, announces
  // it, and builds the event's objects. rescue=true only ever comes
  // from the scheduler's rescue branch, for a rescue chest.
  startEvent(kind, rescue = false) {
    this.activeEvent = kind;
    if (kind === "jelly") this.spawnJellyfish();
    else if (kind === "rush") this.startCoinRush();
    else if (kind === "chest") this.spawnChest(rescue);
  },

  // An event is over: clear the flag and re-arm the gap timer. The
  // per-event updater calls this when its object leaves / expires.
  // Re-arming checks the soft-lock, so a rescue that just ended
  // goes back to the normal gap once the player has a fish again —
  // and an ignored rescue chest is followed by another one in 5-10s.
  endEvent() {
    this.activeEvent = null;
    this.resetEventTimer(false);
  },

  // --- GLOWING JELLYFISH --------------------------------------------------
  // A translucent glowing jellyfish with a pulsing comic-book
  // starburst behind it. It drifts straight across at 70 px/s (a
  // ~15s crossing) at a random height, either direction. The bell
  // contracts and expands as it swims (jellyfish swimming IS a
  // pulse), and the starburst pulses in sync — scale and alpha
  // breathing in and out — so the whole thing throbs and can't be
  // missed or mistaken for a normal fish.
  spawnJellyfish() {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const baseY = 140 + Math.random() * 180; // 140..320 — mid-water, never the top strip
    const x = dir > 0 ? -50 : CONFIG.width + 50;
    const burst = this.add.image(x, baseY, "jelly-burst").setDepth(4);
    burst.setAlpha(0.55);
    const sprite = this.add.image(x, baseY, "jellyfish").setDepth(5);
    this.jellyfish = {
      sprite, burst, dir, baseY,
      clicked: false, // one click only — it bursts once
      ageSec: 0,
      bobPhase: Math.random() * Math.PI * 2,
      pulsePhase: 0, // bell/burst pulse, advances with dt (see update)
    };
    this.toast("🪼 A glowing jellyfish drifts in! Click it — it bursts into coins!");
    sfx.event();
  },

  updateJellyfish(dt, time) {
    const j = this.jellyfish;
    if (!j) { this.endEvent(); return; }
    j.ageSec += dt;
    j.sprite.x += j.dir * CONFIG.jellyfishSpeedPxS * dt;
    // Gentle bob, like a real fish's animateFish but without the
    // full fish object (this is a visitor, not a fish).
    j.sprite.y = j.baseY + Math.sin(time / 500 + j.bobPhase) * 4;
    j.burst.x = j.sprite.x;
    j.burst.y = j.sprite.y;
    // Pulse: the bell contracts/expands (wider as it squashes
    // vertically, like a real jellyfish), and the starburst breathes
    // in sync — bigger and brighter, then smaller and dimmer.
    j.pulsePhase += dt * CONFIG.jellyfishPulseRadS;
    const s = Math.sin(j.pulsePhase);
    j.sprite.setScale(1 + 0.08 * s, 1 - 0.06 * s);
    j.burst.setScale(1 + 0.15 * s);
    j.burst.setAlpha(0.55 + 0.3 * s);
    // Off the far edge (or past its ~15s crossing): the visit ends.
    if (j.sprite.x < -60 || j.sprite.x > CONFIG.width + 60 || j.ageSec >= CONFIG.jellyfishSec + 5) {
      j.sprite.destroy();
      if (j.burst) j.burst.destroy();
      this.jellyfish = null;
      this.endEvent();
    }
  },

  // The pointer dispatcher calls this when the jellyfish is clicked
  // (checked BEFORE fish, so a fish behind it is never grabbed by
  // mistake). It BURSTS: five $5 coins scatter out ($25 total),
  // bubbles pop, and the jellyfish is gone — the click itself never
  // drops food.
  collectJellyfish() {
    const j = this.jellyfish;
    if (!j || j.clicked) return;
    j.clicked = true;
    const x = j.sprite.x, y = j.sprite.y;
    const offsets = [-36, -18, 0, 18, 36];
    for (let i = 0; i < CONFIG.jellyfishCoins; i++) {
      this.dropBonusCoin(x + offsets[i], y - (i === 2 ? 10 : i % 2 ? 6 : 0), CONFIG.jellyfishCoinValue);
    }
    for (let i = 0; i < 5; i++) this.spawnBubble(x, y);
    j.sprite.destroy();
    if (j.burst) j.burst.destroy();
    this.jellyfish = null;
    this.toast("🪼 Pop! Five $5 coins burst out!");
    sfx.coin();
    this.endEvent();
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
  // rescue=true marks a RESCUE chest (see openChest): it always
  // holds a free baby guppy plus a money top-up, never a random roll.
  spawnChest(rescue = false) {
    const x = 100 + Math.random() * (CONFIG.width - 200);
    const sprite = this.add.image(x, CONFIG.floorY, "chest-event").setDepth(5);
    this.chest = {
      sprite, x,
      ageSec: 0,              // life timer — 12s from spawn, then it sinks away
      bobPhase: Math.random() * Math.PI * 2,
      bobY: CONFIG.chestBobY, // height it floats up to before bobbing
      rising: true,           // still floating up from the floor
      rescue,                 // rescue chest: fixed reward, see openChest
    };
    this.toast(rescue
      ? "🛟 Your tank is empty — a rescue chest is on its way! Open it for a free guppy!"
      : "💰 A treasure chest floats up! Click it to open!");
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
  //   RESCUE chest: always a free small guppy, plus money topped up
  //   to $10 if below it — never +$10, so it can't be farmed by
  //   letting fish die. The top-up is five pellets of runway: a fed
  //   guppy earns ~$5 per $2 pellet, so after the first feeds the
  //   player is self-sustaining and the loop can't repeat. The
  //   top-up is a grant, not collected income, so it does NOT count
  //   toward totalBanked (goal progress). A rescue chest is only
  //   ever spawned while the tank is empty, so the fish cap can't
  //   block the free guppy.
  openChest() {
    const c = this.chest;
    if (!c) return;
    const x = c.sprite.x, y = c.sprite.y;
    c.sprite.destroy();
    this.chest = null;
    for (let i = 0; i < 5; i++) this.spawnBubble(x, y);
    if (c.rescue) {
      this.spawnFish(x, y, "guppy");
      let topped = 0;
      if (this.money < CONFIG.rescueMoneyTopUp) {
        topped = CONFIG.rescueMoneyTopUp - this.money;
        this.money = addMoney(this.money, topped); // lands exactly on $10
      }
      this.toast(topped > 0
        ? "🛟 Rescue! A free baby guppy joins your tank — plus " + moneyFmt(topped) + " for food!"
        : "🛟 Rescue! A free baby guppy joins your tank!");
      this.updateShopUI();
      this.updateTopUI();
      sfx.buy();
      this.endEvent();
      return;
    }
    const reward = this.chestRewardFor(Math.random(), this.fish.length >= this.maxFishCap());
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
