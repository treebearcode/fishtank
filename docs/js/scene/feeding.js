// scene/feeding.js — TankScene mixin: food, pellets, bubbles, and the
// floating feedback text. The pellet type follows the shop selector:
// Standard = $2 / 1 feed, Deluxe = $5 / 2 feeds, gold and bigger so the
// two are easy to tell apart.

import { CONFIG, speciesDef } from "../config.js";
import { postMealDriftTarget } from "../animation.js";
import { nearestPelletEater } from "../feeding.js";
import { stageForFeeds, coinValueForStage, coinValueWithBonus, decorCount, moneyFmt } from "../economy.js";
import { sfx } from "../sound.js";

export const feedingMixin = {
  // The pellet type follows the shop selector. dropFood() pays and
  // calls dropPelletAt(); the feeder-bot pays $2 and calls it directly.
  dropFood(x, y) {
    const isDeluxe = this.foodType === "deluxe";
    const cost = isDeluxe ? CONFIG.deluxeFoodCost : CONFIG.foodCost;
    if (this.money < cost) {
      this.toast("Not enough money for food! Collect some coins first.");
      sfx.denied();
      return false;
    }
    this.money -= cost;
    this.dropPelletAt(x, y, isDeluxe ? CONFIG.deluxeFeeds : 1, isDeluxe);
    sfx.pop();
    this.updateShopUI();
    this.updateTopUI();
    return true;
  },

  // The shared pellet spawner. Returns false if the pellet could not
  // be placed (never happens in practice — the position is clamped
  // into the water).
  dropPelletAt(x, y, feeds, deluxe) {
    const px = Phaser.Math.Clamp(x, 20, CONFIG.width - 20);
    const py = Phaser.Math.Clamp(y, 44, CONFIG.waterBottom - 30);
    const sprite = this.add.image(px, py, deluxe ? "pellet-deluxe" : "pellet").setDepth(3);
    const pellet = { sprite, vy: 55, feeds: feeds || 1, deluxe: !!deluxe }; // pellets sink at 55 px/s
    this.pellets.push(pellet);
    // No claims — the pellet is free for any eligible fish to eat
    // (see updatePellets).
    return true;
  },

  // HOLD-TO-FEED: while the pointer is held down over open water,
  // drop a pellet on a fixed cadence — like spam clicking without the
  // RSI. The cadence runs on dt, so pausing (update() early-returns)
  // and 2x speed both apply. The hold pauses while the pointer is
  // over the shop or the top bar, and cancels when the money runs
  // out (a failed drop must not toast every frame). Cleared by
  // onPointerUp, which fires for pointerup and pointerupoutside.
  updateFeedHold(dt) {
    if (!this.feedHold) return;
    this.feedHoldTimer -= dt;
    if (this.feedHoldTimer > 0) return;
    if (!this.pointerSeen || this.pointerY < 36 || this.pointerY >= CONFIG.waterBottom) {
      // Pointer over the top bar / shop bar: hold pauses, does not cancel.
      return;
    }
    this.feedHoldTimer = CONFIG.feedHoldIntervalSec;
    if (!this.dropFood(this.pointerX, this.pointerY)) this.feedHold = false;
  },

  // A fish eats a pellet: reset hunger, count the feed(s), maybe grow.
  // A deluxe pellet counts as 2 feeds, and the fish glows gold briefly
  // (fish.glowSec) so the bonus is visible.
  feedFish(fish, pellet) {
    pellet.sprite.destroy();
    // NOTE: do NOT splice this.pellets here — feedFish is called from
    // inside a pellets.filter() loop, and mutating the array being
    // filtered can skip the next pellet. The filter's `return false`
    // in updatePellets() is what removes this pellet.
    fish.feeds += pellet.feeds || 1;
    fish.hungerSec = 0;   // a meal resets the hunger clock
    fish.lastFedSec = 0;  // and the breeding "recently fed" clock
    // Eating starts the cooldown (0.5s) — this fish cannot eat another
    // pellet until the cooldown ticks down in updateFish(). That is the
    // only anti-hogging.
    fish.eatCooldownSec = CONFIG.FEED_COOLDOWN_S;
    // POST-MEAL DRIFT: the fed fish drifts ~60px away from the pellet
    // for ~1s at normal swim speed (see the steering code in fish.js).
    // It is steering only, NOT a lockout — the 0.5s cooldown above is
    // unchanged, and if the drifting fish bumps into a pellet it may
    // still eat it once the cooldown ends. The drift just stops the
    // whole stack sitting on the food: the fed fish clears out, the
    // hungry ones stay behind.
    const drift = postMealDriftTarget(fish.sprite.x, fish.sprite.y, pellet.sprite.x, pellet.sprite.y, CONFIG.postMealDriftPx);
    fish.driftX = drift.x; fish.driftY = drift.y;
    fish.driftSec = CONFIG.postMealDriftSec;
    if (pellet.deluxe) fish.glowSec = 1.5;
    // Growth thresholds come from the fish's species (Chomper grows at
    // 4/8 feeds, everyone else at 3/6).
    const newStage = stageForFeeds(fish.feeds, fish.species);
    if (newStage !== fish.stage) {
      fish.stage = newStage;
      this.setFishStageVisual(fish); // body + tail texture and scale
      const boosted = coinValueWithBonus(coinValueForStage(newStage, fish.species), decorCount(this.decorations));
      const sp = speciesDef(fish.species);
      this.toast(newStage === 2 ? "A " + sp.name.toLowerCase() + " grew into a LARGE fish! It drops " + moneyFmt(boosted) + " coins now." : "A " + sp.name.toLowerCase() + " grew into a MEDIUM fish! It drops " + moneyFmt(boosted) + " coins now.");
    }
    // A little bubble puff as a "yum" — cheap feedback, no particles.
    this.spawnBubble(fish.sprite.x, fish.sprite.y - 10);
    sfx.eat();
    this.updateGoalUI(); // growth may have changed the large-fish count
  },

  // Pellets sink; ANY eligible fish that touches one eats it.
  // nearestPelletEater() picks the closest eligible fish (not grabbed,
  // not on its 0.5s cooldown) within 18px — first arrival wins, and
  // several fish may chase the same pellet, so they fight over it.
  updatePellets(dt) {
    this.pellets = this.pellets.filter((pellet) => {
      pellet.sprite.y += pellet.vy * dt;
      if (pellet.sprite.y >= CONFIG.floorY) {
        pellet.sprite.destroy();
        return false;
      }
      const candidates = this.fish.map((f) => ({
        x: f.sprite.x, y: f.sprite.y,
        eatCooldownSec: f.eatCooldownSec || 0, grabbed: !!f.grabbed,
      }));
      const eaterIdx = nearestPelletEater(pellet.sprite.x, pellet.sprite.y, candidates);
      if (eaterIdx >= 0) { this.feedFish(this.fish[eaterIdx], pellet); return false; }
      return true;
    });
  },

  // Ambient bubbles rising from the sand.
  updateBubbles(dt, time) {
    this.bubbleTimer += dt;
    if (this.bubbleTimer > 0.8) {
      this.bubbleTimer = 0;
      this.spawnBubble(40 + Math.random() * 880, CONFIG.waterBottom - 8);
    }
    this.bubbles = this.bubbles.filter((b) => {
      b.sprite.y -= b.vy * dt;
      b.sprite.x += Math.sin(time / 500 + b.sprite.y / 40) * 0.3;
      if (b.sprite.y < 40) { b.sprite.destroy(); return false; }
      return true;
    });
  },

  floatText(msg, x, y, color) {
    const t = this.add.text(x, y, msg, { fontSize: "16px", color, fontStyle: "bold" }).setOrigin(0.5, 0.5).setDepth(9);
    this.tweens.add({ targets: t, y: y - 28, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  },

  spawnBubble(x, y) {
    const b = this.add.circle(x, y, 3 + Math.random() * 3, 0xffffff, 0.5).setDepth(2);
    this.bubbles.push({ sprite: b, vy: 30 + Math.random() * 25 });
  },
};
