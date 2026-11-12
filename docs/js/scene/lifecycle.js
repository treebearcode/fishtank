// scene/lifecycle.js — TankScene mixin: breeding, eggs, predation.
//
// The breeding chain, in full: two LARGE fish of the SAME species,
// both fed within the last 30s and not hungry, neither pregnant /
// breeding / on cooldown / grabbed, tank not at cap -> formBreedPair()
// marks them breeding and spawns pink hearts above them for ~3s while
// they swim toward each other (see the breeding branch in the fish
// steering code). When the hearts run out, the better-fed parent
// (lower hungerSec) becomes PREGNANT for 15s — swollen belly
// (animateFish scales Y 1.15x), ~30% slower — then layEgg() pops out
// an egg. The egg sinks to the floor, sits ~20s, then hatches into a
// SMALL fish of that species IF there is room under the cap; if the
// tank is full it waits, pulsing, until room frees up. Both parents
// get a 60s breed cooldown when the egg pops out, so breeding cannot
// chain-explode the tank. The hearts are small pink "♥" text sprites
// (procedural, no new assets).
//
// Predation: a LARGE Chomper that is hungry chases any stage-0 baby
// within ~70px at 3x speed (see the hunting branch in fish.js) and
// eats it on contact (~18px). The baby is removed, the Chomper gains 1
// feed, its hunger resets to 0, it puffs up briefly (gulpSec), and a
// gulp blip plays. The first eat in a session toasts. Baby Chompers,
// stage-1+ fish, and eggs are never eaten (see predation.js).

import { CONFIG, speciesDef } from "../config.js";
import { stageForFeeds } from "../economy.js";
import { findPrey, HUNT_CATCH_PX, CHOMP_GULP_SEC } from "../predation.js";
import { findBreedPair, pickPregnantParent, eggCanHatch } from "../breeding.js";
import { sfx } from "../sound.js";

export const lifecycleMixin = {
  // Scan the tank once per frame for a breedable pair (findBreedPair
  // is the pure guard — see breeding.js) and tick any hearts pairs.
  // Only ONE pair forms per frame, and only when no pair is already in
  // its hearts phase — the tank breeds one pair at a time.
  updateBreeding(dt) {
    // Tick the hearts pairs first: the pair swims together for
    // BREED.heartsSec, then the better-fed parent becomes pregnant.
    for (const pair of [...this.breedingPairs]) {
      pair.heartsSec -= dt;
      // Keep the hearts floating above their fish (they swim toward
      // each other during this phase, so the hearts must follow).
      if (pair.hearts) {
        pair.hearts[0].x = pair.a.sprite.x;
        pair.hearts[0].y = pair.a.sprite.y - 34 + Math.sin(pair.heartsSec * 6) * 3;
        pair.hearts[1].x = pair.b.sprite.x;
        pair.hearts[1].y = pair.b.sprite.y - 34 + Math.cos(pair.heartsSec * 6) * 3;
      }
      if (pair.heartsSec > 0) continue;
      // Hearts done: pick the pregnant parent, clear the pair.
      const mum = pickPregnantParent(pair.a, pair.b);
      this.destroyHearts(pair);
      this.breedingPairs.splice(this.breedingPairs.indexOf(pair), 1);
      pair.a.breeding = false;
      pair.b.breeding = false;
      pair.a.breedPartner = null;
      pair.b.breedPartner = null;
      // If a parent died or was sold mid-hearts, the survivor does not
      // get pregnant alone — the pair is just over.
      if (!this.fish.includes(pair.a) || !this.fish.includes(pair.b)) continue;
      mum.pregnant = true;
      mum.pregnantSec = CONFIG.breedPregnantSec;
      // Remember the other parent, so layEgg() can set BOTH cooldowns
      // when the egg pops out.
      mum.breedPartner = mum === pair.a ? pair.b : pair.a;
    }
    // Only one hearts pair at a time, and only if the tank is not
    // already at cap (canBreed checks the cap too).
    if (this.breedingPairs.length === 0) {
      const pair = findBreedPair(this.fish, this.maxFishCap());
      if (pair) this.formBreedPair(pair[0], pair[1]);
    }
  },

  formBreedPair(a, b) {
    a.breeding = true;
    b.breeding = true;
    a.breedPartner = b;
    b.breedPartner = a;
    const heartA = this.add.text(a.sprite.x, a.sprite.y - 34, "♥", { fontSize: "18px", color: "#ff6b9d" }).setOrigin(0.5, 0.5).setDepth(9);
    const heartB = this.add.text(b.sprite.x, b.sprite.y - 34, "♥", { fontSize: "18px", color: "#ff6b9d" }).setOrigin(0.5, 0.5).setDepth(9);
    this.breedingPairs.push({ a, b, heartsSec: CONFIG.breedHeartsSec, hearts: [heartA, heartB] });
    sfx.pop();
  },

  destroyHearts(pair) {
    if (pair.hearts) for (const h of pair.hearts) h.destroy();
    pair.hearts = null;
  },

  // Remove any hearts pair containing this fish (death / sale / reset)
  // and clear the partner's breeding flags, so the survivor can pair
  // again instead of swimming at a ghost forever.
  removeBreedPair(fish) {
    for (const pair of [...this.breedingPairs]) {
      if (pair.a !== fish && pair.b !== fish) continue;
      this.destroyHearts(pair);
      this.breedingPairs.splice(this.breedingPairs.indexOf(pair), 1);
      const other = pair.a === fish ? pair.b : pair.a;
      other.breeding = false;
      other.breedPartner = null;
    }
    // A sold/dead fish also stops being anyone's pregnancy partner.
    for (const f of this.fish) {
      if (f.breedPartner === fish) f.breedPartner = null;
    }
  },

  // The pregnant fish pops out an egg at her position. Both parents
  // get their 60s breed cooldown NOW (at the pop, not at pairing), and
  // the partner link is cleared.
  layEgg(mum) {
    const dad = mum.breedPartner;
    mum.breedCooldownSec = CONFIG.breedCooldownSec;
    if (dad && this.fish.includes(dad)) dad.breedCooldownSec = CONFIG.breedCooldownSec;
    mum.breedPartner = null;
    if (dad) dad.breedPartner = null;
    const sprite = this.add.image(mum.sprite.x, mum.sprite.y + 10, "egg").setDepth(4);
    this.eggs.push({ sprite, species: mum.species, waitSec: CONFIG.breedEggWaitSec, sinking: true, pulse: 0 });
    sfx.pop();
  },

  // Eggs sink slowly to the floor, sit ~20s, then hatch into a SMALL
  // fish of that species — ONLY if there is room under the cap at
  // hatch time. A full tank leaves the egg waiting (faint pulse) until
  // room frees up. The egg is non-interactive, just visual.
  updateEggs(dt) {
    for (const egg of [...this.eggs]) {
      if (egg.sinking) {
        egg.sprite.y += 15 * dt; // slow sink, ~15 px/s
        if (egg.sprite.y >= CONFIG.floorY) {
          egg.sprite.y = CONFIG.floorY;
          egg.sinking = false;
        }
      } else {
        egg.waitSec -= dt;
        if (egg.waitSec <= 0) {
          if (!eggCanHatch(this.fish.length, this.maxFishCap())) {
            // Tank is full: wait, pulsing faintly, until room frees up.
            egg.pulse += dt;
            egg.sprite.setAlpha(0.6 + Math.sin(egg.pulse * 4) * 0.3);
            continue;
          }
          const sp = speciesDef(egg.species);
          this.spawnFish(egg.sprite.x, CONFIG.floorY - 30, egg.species);
          egg.sprite.destroy();
          this.eggs.splice(this.eggs.indexOf(egg), 1);
          sfx.buy();
          this.toast("An " + sp.name + " hatched!");
          this.updateTopUI();
        }
      }
    }
  },

  updateHunting() {
    for (const hunter of [...this.fish]) {
      if (hunter.species !== "chomper" || hunter.stage !== 2) continue;
      if (hunter.grabbed || hunter.breeding) continue;
      if ((hunter.hungerSec || 0) <= 0) continue; // well-fed: no hunting
      const prey = findPrey(hunter, this.fish, HUNT_CATCH_PX);
      if (prey) this.eatBaby(hunter, prey);
    }
  },

  eatBaby(hunter, prey) {
    if (!this.fish.includes(hunter) || !this.fish.includes(prey)) return;
    const sp = speciesDef(prey.species);
    prey.sprite.destroy();
    if (prey.tail) prey.tail.destroy();
    this.fish.splice(this.fish.indexOf(prey), 1);
    // A baby cannot be in a hearts pair, but clear the link anyway so
    // no partner is left swimming at a ghost.
    this.removeBreedPair(prey);
    hunter.feeds += 1;
    hunter.hungerSec = 0;  // a meal resets the hunger clock
    hunter.lastFedSec = 0; // and the breeding "recently fed" clock
    hunter.gulpSec = CHOMP_GULP_SEC; // brief scale pulse (animateFish)
    const newStage = stageForFeeds(hunter.feeds, hunter.species);
    if (newStage !== hunter.stage) {
      hunter.stage = newStage;
      this.setFishStageVisual(hunter);
    }
    sfx.gulp();
    if (!this._chomperToastShown) {
      this._chomperToastShown = true;
      this.toast("A Chomper ate a baby " + sp.name.toLowerCase() + "!");
    }
    this.updateTopUI();
    this.updateGoalUI();
  },
};
