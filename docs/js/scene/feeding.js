// scene/feeding.js — TankScene mixin: food, pellets, feast plants,
// bubbles, and the floating feedback text. The food type follows the
// Food button's selection: Standard = $2 / 1 feed, Deluxe = $5 / 2
// feeds (gold and bigger so the two are easy to tell apart), Feast
// Plant = $40 / 30 nibbles shared by the whole tank.

import { CONFIG, speciesDef } from "../config.js";
import { postMealDriftTarget } from "../animation.js";
import { nearestPelletEater } from "../feeding.js";
import { stageForFeeds, coinValueForStage, coinValueWithBonus, decorCount, moneyFmt } from "../economy.js";
import { sfx } from "../sound.js";

export const feedingMixin = {
  // The food type follows the Food button's selection. dropFood()
  // pays and drops whatever is selected — a pellet, or a feast plant.
  // The feeder-bot pays $2 and calls dropPelletAt() directly.
  dropFood(x, y) {
    if (this.foodType === "plant") return this.dropPlant(x, y);
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

  // FEAST PLANT: $40 for 30 nibbles, dropped from the cursor like any
  // food. NO cap on how many can be out at once — hold-to-feed drops
  // one every 0.1s at $40 each, so the only limit is the money. A
  // failed drop (broke) cancels the hold (see updateFeedHold). No
  // Tank Upgrade gate: the $40 cost IS the gate.
  dropPlant(x, y) {
    if (this.money < CONFIG.plantCost) {
      this.toast("Not enough money for food! Collect some coins first.");
      sfx.denied();
      return false;
    }
    this.money -= CONFIG.plantCost;
    this.spawnFeastPlant(x, y);
    sfx.pop();
    this.updateShopUI();
    this.updateTopUI();
    return true;
  },

  // A feast plant is one container: a stem, six frond blades fanning
  // up from the base, a bare skeleton for the final stage, and a
  // counter above it. Everything is scaled by CONFIG.plantScale (3):
  // the anchored plant stands ~152px tall — dwarfing a ~50px guppy
  // without dominating the 540px tank. The container's position is
  // the plant's centre (for steering); the base sits 48px below it,
  // so the plant anchors with its base on the floor (floorY - 42).
  // Fronds are hidden one per 5 nibbles and the last few leave only
  // the skeleton (see updatePlantFronds).
  spawnFeastPlant(x, y) {
    const S = CONFIG.plantScale;
    // Tallest frond: a 36px blade × 3 × 1.15 Y-scale at 10° reaches
    // ~122px above its pivot (+18) — the plant's top is ~104px above
    // its centre, its base 48px below: ~152px tall in all.
    const topOffset = Math.round(6 * S - 36 * S * 1.15 * Math.cos(10 * Math.PI / 180));
    const baseOffset = 16 * S;
    const px = Phaser.Math.Clamp(x, 20, CONFIG.width - 20);
    // Keep the whole plant on screen when dropped: the top must not
    // start above the water.
    const py = Phaser.Math.Clamp(y, 44 - topOffset, CONFIG.waterBottom - 30);
    const container = this.add.container(px, py).setDepth(3);
    const stem = this.add.rectangle(0, 4 * S, 5 * S, 24 * S, 0x2f7a3d);
    container.add(stem);
    const fronds = [];
    const angles = [-50, -30, -10, 10, 30, 50];
    angles.forEach((deg, i) => {
      const f = this.add.image(0, 6 * S, "feast-plant-frond").setOrigin(0.5, 1);
      f.rotation = deg * Math.PI / 180; // pivot at the base, fan outward
      f.setScale(S, S * (0.85 + (i % 3) * 0.15));
      container.add(f);
      fronds.push(f);
    });
    // Bare skeleton for the final stage — hidden until the fronds
    // are all gone. Same -104..+48 extent as the full plant.
    const skeleton = this.add.image(0, baseOffset, "feast-plant-skeleton").setOrigin(0.5, 1).setVisible(false);
    container.add(skeleton);
    const counter = this.add.text(0, -48 * S, String(CONFIG.plantNibbles), { fontSize: "12px", color: "#ffffff", fontStyle: "bold", backgroundColor: "#0b2a3acc", padding: { x: 4, y: 2 } }).setOrigin(0.5, 0.5);
    container.add(counter);
    const plant = {
      container, counter, fronds, stem, skeleton,
      topOffset, baseOffset, heightPx: baseOffset - topOffset,
      nibbles: CONFIG.plantNibbles,
      sinking: true,      // still dropping toward the floor
      biteTimer: 0,       // plant-wide: one bite at most every 0.4s
      swayPhase: Math.random() * Math.PI * 2,
      baseX: px,          // sway oscillates around this x while sinking
    };
    this.feastPlants.push(plant);
    return plant;
  },

  // Fronds + counter, from the nibble count: one frond lost per 5
  // nibbles (6 at 30, 5 at 25, ... 2 at 6-10). The final 5 nibbles
  // strip the plant to a bare skeleton — no fronds, no green stem,
  // just the pale stem with stubs. Called on every nibble and
  // directly by tests.
  updatePlantFronds(plant) {
    if (plant.nibbles > CONFIG.plantFrondEvery) {
      const visible = Math.ceil(plant.nibbles / CONFIG.plantFrondEvery);
      plant.fronds.forEach((f, i) => f.setVisible(i < visible));
      plant.stem.setVisible(true);
      plant.skeleton.setVisible(false);
    } else {
      plant.fronds.forEach((f) => f.setVisible(false));
      plant.stem.setVisible(false);
      plant.skeleton.setVisible(true);
    }
    plant.counter.setText(String(plant.nibbles));
  },

  // Squared distance from a point to a plant's body — the vertical
  // segment from its top fronds to its base on the floor. A ~150px
  // plant is edible along its whole height, not just within 50px of
  // its centre; the 50px range itself is unchanged.
  plantDistSq(plant, x, y) {
    const dx = x - plant.container.x;
    const topY = plant.container.y + plant.topOffset;
    const baseY = plant.container.y + plant.baseOffset;
    const dy = y < topY ? topY - y : (y > baseY ? y - baseY : 0);
    return dx * dx + dy * dy;
  },

  // Plants sink slowly (25 px/s, swaying ±8px), anchor on the floor,
  // and get nibbled. A plant is NEVER destroyed at the floor — unlike
  // pellets, it stays until fully eaten. The nearest eligible fish
  // within 50px of the plant's BODY takes one bite: not grabbed, not
  // on its 0.5s pellet cooldown, not on its 1.5s plant chew pause,
  // and the plant itself must be past its 0.4s bite timer.
  updateFeastPlants(dt, time) {
    for (const plant of [...this.feastPlants]) {
      if (plant.sinking) {
        plant.container.y += CONFIG.plantSinkPxS * dt;
        plant.container.x = plant.baseX + Math.sin(time / 700 + plant.swayPhase) * CONFIG.plantSwayPx;
        if (plant.container.y >= CONFIG.floorY - 14 * CONFIG.plantScale) {
          plant.container.y = CONFIG.floorY - 14 * CONFIG.plantScale;
          plant.container.x = plant.baseX;
          plant.sinking = false;
        }
      }
      if (plant.biteTimer > 0) plant.biteTimer = Math.max(0, plant.biteTimer - dt);
      if (plant.biteTimer <= 0 && plant.nibbles > 0) {
        let best = null, bestD = CONFIG.plantNibbleRangePx * CONFIG.plantNibbleRangePx;
        for (const f of this.fish) {
          if (f.grabbed || (f.eatCooldownSec || 0) > 0 || (f.plantChewSec || 0) > 0) continue;
          const d = this.plantDistSq(plant, f.sprite.x, f.sprite.y);
          if (d < bestD) { bestD = d; best = f; }
        }
        if (best) this.nibblePlant(best, plant);
      }
      if (plant.nibbles <= 0) {
        plant.container.destroy();
        this.feastPlants.splice(this.feastPlants.indexOf(plant), 1);
        this.toast("The fish finished the feast plant!");
        sfx.pop();
      }
    }
  },

  // One fish takes one bite of a plant: 1 full feed (same as a
  // pellet), plus the plant's own pacing — this fish waits 1.5s
  // before its next plant bite (a Greedy fish chews in 1.0s), and the
  // plant waits 0.4s before anyone's next bite.
  nibblePlant(fish, plant) {
    plant.nibbles -= 1;
    plant.biteTimer = CONFIG.plantGlobalSec;
    fish.plantChewSec = fish.trait === "greedy" ? CONFIG.greedyChewSec : CONFIG.plantChewSec;
    this.applyFeed(fish, 1, plant.container.x, plant.container.y);
    this.updatePlantFronds(plant);
  },

  // The shared pellet spawner. Returns false if the pellet could not
  // be placed (never happens in practice — the position is clamped
  // into the water).
  dropPelletAt(x, y, feeds, deluxe) {
    const px = Phaser.Math.Clamp(x, 20, CONFIG.width - 20);
    const py = Phaser.Math.Clamp(y, 44, CONFIG.waterBottom - 30);
    const sprite = this.add.image(px, py, deluxe ? "pellet-deluxe" : "pellet").setDepth(3);
    const pellet = { sprite, vy: CONFIG.pelletSinkPxS, feeds: feeds || 1, deluxe: !!deluxe, landed: false };
    // landed is always false here — pellets sink and are destroyed
    // at the floor, never sit on it — but the flag exists so the
    // desperate-sprint check can tell a sinking pellet from a floor
    // one (see updateFish in scene/fish.js).
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
    this.applyFeed(fish, pellet.feeds || 1, pellet.sprite.x, pellet.sprite.y);
    if (pellet.deluxe) fish.glowSec = 1.5;
  },

  // A fish ate `feeds` feeds at (foodX, foodY): hunger reset, feed
  // count, growth, post-meal drift, bubble, sound, goal UI. Shared
  // by pellets (feedFish) and feast plants (nibblePlant) — one place,
  // so a bite and a pellet can never drift apart in what they do.
  applyFeed(fish, feeds, foodX, foodY) {
    fish.feeds += feeds;
    fish.hungerSec = 0;   // a meal resets the hunger clock
    fish.lastFedSec = 0;  // and the breeding "recently fed" clock
    // Eating starts the cooldown (0.5s) — this fish cannot eat another
    // pellet until the cooldown ticks down in updateFish(). That is the
    // only anti-hogging.
    fish.eatCooldownSec = CONFIG.FEED_COOLDOWN_S;
    // POST-MEAL DRIFT: the fed fish drifts ~60px away from the food
    // for ~1s at normal swim speed (see the steering code in fish.js).
    // It is steering only, NOT a lockout — the 0.5s cooldown above is
    // unchanged, and if the drifting fish bumps into food it may still
    // eat it once the cooldown ends. The drift just stops the whole
    // stack sitting on the food: the fed fish clears out, the hungry
    // ones stay behind.
    const drift = postMealDriftTarget(fish.sprite.x, fish.sprite.y, foodX, foodY, CONFIG.postMealDriftPx);
    fish.driftX = drift.x; fish.driftY = drift.y;
    fish.driftSec = CONFIG.postMealDriftSec;
    // Growth thresholds come from the fish's species (Chomper grows at
    // 4/8 feeds, everyone else at 3/6) — and stage 3 (royal) needs the
    // gene as well as the feeds: a non-gene fish caps at large no
    // matter how much it eats (see stageForFeeds).
    const newStage = stageForFeeds(fish.feeds, fish.species, fish.royalGene);
    if (newStage !== fish.stage) {
      fish.stage = newStage;
      this.setFishStageVisual(fish); // body + tail texture and scale
      const boosted = coinValueWithBonus(coinValueForStage(newStage, fish.species), decorCount(this.decorations));
      const sp = speciesDef(fish.species);
      this.toast(newStage === 3
        ? "👑 A " + sp.name.toLowerCase() + " turned ROYAL! It drops " + moneyFmt(boosted) + " coins now."
        : newStage === 2
          ? "A " + sp.name.toLowerCase() + " grew into a LARGE fish! It drops " + moneyFmt(boosted) + " coins now."
          : "A " + sp.name.toLowerCase() + " grew into a MEDIUM fish! It drops " + moneyFmt(boosted) + " coins now.");
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
