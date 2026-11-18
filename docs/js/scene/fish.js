// scene/fish.js — TankScene mixin: the fish themselves.
// Spawning, growth visuals, per-frame animation, the big per-fish
// update (hunger / death / pregnancy / grab / poke / steering /
// coins), and crowd separation.

import { CONFIG, speciesDef } from "../config.js";
import { fishScale, isHungry, isDead } from "../economy.js";
import { findPrey, CHOMP_GULP_SEC } from "../predation.js";
import { tailWiggle, tailJointFor, tailRotationFor, fishTiltFor } from "../animation.js";
import { sfx } from "../sound.js";

export const fishMixin = {
  // spawnFish takes a species (default guppy). The fish object carries
  // its species key everywhere it matters — growth, coins, selling,
  // breeding — so no call site needs a species special case.
  //
  // A fish is TWO sprites — body (fish.sprite, the single source of
  // truth for position / flip / tint / scale) and tail (fish.tail,
  // added first so the body draws over the joint, same depth).
  // animateFish() moves the tail every frame. Everything that
  // destroys, moves, or hit-tests a fish uses fish.sprite; the tail is
  // purely visual and must be destroyed with it. The starfish has NO
  // tail (hasTail: false) — fish.tail is null, and animateFish()
  // skips only the tail part, never the body animation.
  spawnFish(x, y, speciesKey) {
    const sp = speciesDef(speciesKey);
    const tail = sp.hasTail
      ? this.add.image(x, y, "fish-tail-" + sp.key + "-0").setOrigin(1, 0.5).setDepth(5)
      : null;
    const sprite = this.add.image(x, y, "fish-body-" + sp.key + "-0").setScale(1);
    sprite.setDepth(5);
    const fish = {
      sprite, tail, species: sp.key, stage: 0, feeds: 0, hungerSec: 0, coinTimer: 0, glowSec: 0,
      targetX: x, targetY: y, wanderTimer: 0, speed: sp.speed,
      // TEMPO: this fish's own speed factor (0.85-1.2x species base),
      // rolled once at spawn — two guppies never swim in lockstep.
      // SPRINT: sprintSec counts down a food-chase burst, and
      // sprintCooldownSec the ~3s breather before the next one.
      // Both tick in updateFish(); see fishSpeed() / endSprint().
      tempo: CONFIG.tempoMin + Math.random() * (CONFIG.tempoMax - CONFIG.tempoMin),
      sprintSec: 0, sprintCooldownSec: 0,
      // eatCooldownSec ticks down in updateFish() — a fish that just
      // ate cannot eat again until this hits 0 (the ONLY anti-hogging).
      eatCooldownSec: 0,
      // plantChewSec is the feast-plant version of that cooldown: a
      // fish that just took a bite waits 1.5s before its next plant
      // bite (see nibblePlant). It ticks down alongside eatCooldownSec.
      plantChewSec: 0,
      // BREEDING: lastFedSec is seconds since this fish last ate
      // (tracked alongside hungerSec, reset in feedFish). A pair can
      // breed only while both lastFedSec values are <= 30s.
      // pregnant / pregnantSec: the 15s swollen-belly stage.
      // breeding: true while in a 3s hearts pair. breedCooldownSec:
      // 60s after the egg pops out, before this fish can pair again.
      lastFedSec: 0,
      pregnant: false, pregnantSec: 0,
      breeding: false, breedCooldownSec: 0,
      // Poke = a speed burst away from the pointer for 0.5s.
      pokeSec: 0, pokeDirX: 0, pokeDirY: 0,
      grabbed: false, // true while the player is holding this fish
      // POST-MEAL DRIFT (see feedFish): driftSec counts down from
      // CONFIG.postMealDriftSec after a meal, and driftX/Y is the
      // point ~60px away from the pellet the fish is drifting toward.
      // While it drifts it does not chase pellets — the fed fish
      // clears out so the next pellet goes to a hungry fish.
      driftSec: 0, driftX: x, driftY: y,
      // Animation state: random phases so fish do not wiggle in
      // lockstep; baseScale is the growth scale times species size;
      // tilt is the smoothed swim tilt; bobY is the current head-bob
      // offset already applied to sprite.y (animateFish removes it
      // before re-adding it); returnSec counts down the ~0.2s
      // snap-back after a grab; gulpSec counts down the ~0.35s scale
      // pulse after a Chomper eats a baby.
      animPhase: Math.random() * Math.PI * 2,
      bobPhase: Math.random() * Math.PI * 2,
      bobY: 0, tilt: 0, wiggle: 0, wiggleFreq: 6, wiggleAmp: 0.35,
      baseScale: 1, curTint: 0xffffff, curAlpha: 1, returnSec: 0,
      gulpSec: 0,
    };
    this.fish.push(fish);
    // Apply the stage/species scale at spawn, so a baby arrives at
    // ~0.6x (not 1x) — setFishStageVisual fixes scale and texture in
    // one place.
    this.setFishStageVisual(fish);
    this.updateTopUI();
    return fish;
  },

  // Growth visuals for the split fish — body AND tail change texture
  // together, and both use the same growth scale. Called from
  // spawnFish (stage 0) and feedFish / eatBaby (on growth). Never set
  // a fish texture or scale anywhere else.
  setFishStageVisual(fish) {
    fish.baseScale = fishScale(fish.stage, fish.species);
    fish.sprite.setTexture("fish-body-" + fish.species + "-" + fish.stage);
    if (fish.tail) fish.tail.setTexture("fish-tail-" + fish.species + "-" + fish.stage);
    fish.sprite.setScale(fish.baseScale, fish.baseScale);
  },

  // ANIMATION — the only place that touches a fish's rotation, bob, or
  // tail. Call it once per frame for every live fish, AFTER that
  // fish's position was updated (steering / poke / grab). It only
  // touches visuals, never logic: fish.sprite.x/y stay the single
  // source of truth for hit-testing, steering, and coins.
  //
  //   Swimming: body tilts toward its swim direction (fish.tilt,
  //     smoothed in updateFish), bobs ±2px, and the tail swings
  //     ±wiggleAmp around the body. Tail speed/amplitude are set by
  //     the caller: faster when chasing food or sprinting (the wag
  //     scales with the fish's actual speed), slower when just fed,
  //     fast when fleeing a poke.
  //   Grabbed: the body goes vertical, head down (rotation +90°,
  //     flip cleared so it is head-down whichever way it faced), and
  //     struggles — a ±15° wobble at ~8Hz plus a slight squash. The
  //     tail follows the body rotation, so it points up at the
  //     pointer: the player is holding the fish by the tail.
  //   Released: fish.returnSec counts down from 0.2s and the rotation
  //     lerps from vertical back to the swim tilt.
  //
  // Tail geometry: the tail image's origin is its narrow point, so the
  // pivot is the joint. The joint sits just inside the body ellipse's
  // edge (on the tail side — left when facing right), rotated by the
  // body rotation. The tail's rotation is the body rotation plus the
  // wiggle; facing left it turns ~180 deg (and the wiggle sign flips)
  // so the fan points right — see tailRotationFor(). The tail is
  // NEVER flipped. The tail copies the body's tint/alpha
  // (fish.curTint / curAlpha) so hunger paleness and the deluxe gold
  // glow cover the whole fish, not just the body.
  animateFish(fish, dt) {
    // A fish WITHOUT a tail (starfish) still animates its body — only
    // the tail section at the bottom is skipped.
    // PREGNANT: a pregnant fish's belly is swollen — the body sprite
    // is scaled ~1.15x on the Y axis only (pregScale), applied in both
    // the grabbed and swimming branches.
    const pregScale = fish.pregnant ? 1.15 : 1;
    // GULP PULSE: after a Chomper eats a baby, it puffs up briefly —
    // scale swells ~18% and back over CHOMP_GULP_SEC (a sine bump, so
    // it peaks mid-pulse and lands back at 1x).
    const gulpScale = fish.gulpSec > 0
      ? 1 + 0.18 * Math.sin(Math.PI * (1 - fish.gulpSec / CHOMP_GULP_SEC))
      : 1;
    // Head bob: remove last frame's offset before adding the new one,
    // so the bob never accumulates into the logical position.
    fish.sprite.y -= fish.bobY || 0;
    fish.bobY = 0;
    if (fish.grabbed) {
      // Held by the tail: vertical, head down, struggling.
      fish.sprite.setFlipX(false);
      fish.animPhase += dt * (fish.wiggleFreq || 50);
      const struggle = Math.sin(fish.animPhase) * 0.26; // ±15°
      fish.sprite.rotation = Math.PI / 2 + struggle;
      fish.wiggle = Math.sin(fish.animPhase) * (fish.wiggleAmp || 0.15);
      const squash = 1 + Math.sin(fish.animPhase) * 0.05;
      fish.sprite.setScale(fish.baseScale * gulpScale, fish.baseScale * squash * pregScale * gulpScale);
    } else {
      if (fish.returnSec > 0) {
        // Snapping back to horizontal after a grab.
        fish.returnSec = Math.max(0, fish.returnSec - dt);
        const k = fish.returnSec / 0.2;
        fish.sprite.rotation = fish.tilt + (Math.PI / 2 - fish.tilt) * k;
      } else {
        fish.sprite.rotation = fish.tilt;
      }
      // Head bob, ±2px, slower than the tail wag.
      fish.bobPhase += dt * 3;
      fish.bobY = Math.sin(fish.bobPhase) * 2;
      fish.sprite.y += fish.bobY;
      // Tail wag.
      fish.animPhase += dt * (fish.wiggleFreq || 6);
      fish.wiggle = tailWiggle(fish.animPhase, fish.wiggleAmp || 0.35);
      fish.sprite.setScale(fish.baseScale * gulpScale, fish.baseScale * pregScale * gulpScale);
    }
    if (!fish.tail) return; // tail-less fish (starfish): body only
    // Tail follows the body: joint + rotation + flip + tint/alpha/scale.
    const facingLeft = !!fish.sprite.flipX;
    // Symmetric joint — ±14 * baseScale, tail point 4px inside the
    // body edge both ways.
    const localX = tailJointFor(facingLeft, fish.baseScale);
    const rot = fish.sprite.rotation;
    fish.tail.x = fish.sprite.x + Math.cos(rot) * localX;
    fish.tail.y = fish.sprite.y + Math.sin(rot) * localX;
    // Rotate the tail, never flip it (see tailRotationFor).
    fish.tail.rotation = tailRotationFor(rot, fish.wiggle, facingLeft);
    fish.tail.setFlipX(false);
    fish.tail.setScale(fish.sprite.scaleX, fish.sprite.scaleY);
    fish.tail.setTint(fish.curTint);
    fish.tail.setAlpha(fish.curAlpha);
  },

  // EFFECTIVE SWIM SPEED — the one place a fish's speed is computed:
  // species base × this fish's own tempo × its state. Hungry fish
  // hurry (1.25x — they are looking for food); a fish that just ate
  // (hungerSec < 5s) drifts lazily (0.9x); anything in between is 1x.
  // The sprint multiplier is NOT in here — it is applied at the
  // steering site in updateFish(), only while food-chasing. The
  // hunt's 3x uses this helper as its base (so a hungry Chomper
  // hunts a little faster than a fed one); the poke burst still
  // uses the raw species speed, as before.
  fishSpeed(fish) {
    const sp = speciesDef(fish.species);
    const state = isHungry(fish.hungerSec)
      ? CONFIG.hungrySpeedMult
      : (fish.hungerSec < CONFIG.fedSpeedWindowSec ? CONFIG.fedSpeedMult : 1);
    return sp.speed * (fish.tempo || 1) * state;
  },

  // End a sprint early (pellet eaten / landed / out of range) and
  // start the cooldown — a burst never ends for free, so a fish
  // cannot immediately burst again.
  endSprint(fish) {
    if (fish.sprintSec > 0) {
      fish.sprintSec = 0;
      fish.sprintCooldownSec = CONFIG.sprintCooldownSec;
    }
  },

  // THE PER-FISH UPDATE — hunger, death, pregnancy, grab, poke, tint,
  // coin drops, steering, movement, animation. Iterate over a copy —
  // a fish can die (be removed) mid-loop.
  updateFish(dt) {
    for (const fish of [...this.fish]) {
      fish.hungerSec += dt;
      // lastFedSec ticks with hungerSec (both reset in feedFish) — it
      // is the breeding "recently fed" clock. The breed cooldown ticks
      // down too, so a fish can pair again 60s after its last egg.
      fish.lastFedSec = (fish.lastFedSec || 0) + dt;
      if (fish.breedCooldownSec > 0) fish.breedCooldownSec = Math.max(0, fish.breedCooldownSec - dt);
      // The eat cooldown ticks down every frame (2x speed ticks it
      // down twice as fast, like every other timer).
      if (fish.eatCooldownSec > 0) fish.eatCooldownSec = Math.max(0, fish.eatCooldownSec - dt);
      // The plant chew pause ticks down the same way.
      if (fish.plantChewSec > 0) fish.plantChewSec = Math.max(0, fish.plantChewSec - dt);
      // The post-meal drift timer ticks down here too, so it expires
      // on schedule even if the fish is grabbed or poked mid-drift
      // (those branches `continue` before steering).
      if (fish.driftSec > 0) fish.driftSec = Math.max(0, fish.driftSec - dt);
      // The gulp scale pulse ticks down here too.
      if (fish.gulpSec > 0) fish.gulpSec = Math.max(0, fish.gulpSec - dt);
      // Sprint timers tick with every other timer (2x speed ticks
      // them twice as fast, like everything else): the burst counts
      // down, and when it ends the cooldown starts — a fish that
      // just sprinted cannot burst again for ~3s.
      if (fish.sprintSec > 0) {
        fish.sprintSec = Math.max(0, fish.sprintSec - dt);
        if (fish.sprintSec <= 0) fish.sprintCooldownSec = CONFIG.sprintCooldownSec;
      } else if (fish.sprintCooldownSec > 0) {
        fish.sprintCooldownSec = Math.max(0, fish.sprintCooldownSec - dt);
      }
      const hungry = isHungry(fish.hungerSec);
      if (isDead(fish.hungerSec)) {
        // Starved: poof of bubbles, a sad sound — and the fish floats
        // belly-up to the surface as a dead fish instead of just
        // vanishing (see deadfish.js). The dead fish is purely
        // visual: it never eats, breeds, or counts toward the cap.
        for (let i = 0; i < 5; i++) this.spawnBubble(fish.sprite.x, fish.sprite.y);
        const deadX = fish.sprite.x, deadY = fish.sprite.y;
        const deadSpecies = fish.species, deadScale = fish.baseScale;
        fish.sprite.destroy();
        if (fish.tail) fish.tail.destroy();
        this.fish.splice(this.fish.indexOf(fish), 1);
        this.spawnDeadFish(deadSpecies, deadX, deadY, deadScale);
        // A dead fish leaves its hearts pair too (its partner stops
        // waiting) — removeBreedPair handles the hearts text.
        this.removeBreedPair(fish);
        sfx.death();
        this.toast("A " + speciesDef(fish.species).name.toLowerCase() + " starved! Feed your fish at least every 20 seconds.");
        this.updateTopUI();
        this.updateShopUI();
        this.updateGoalUI(); // a large fish dying can un-meet the goal
        continue;
      }
      // PREGNANCY: the 15s timer ticks here (even while grabbed or
      // poked — pregnancy is not paused by holding the fish). At 0 the
      // egg pops out (layEgg sets the parents' 60s cooldowns) and the
      // fish is pregnant no more.
      if (fish.pregnant) {
        fish.pregnantSec -= dt;
        if (fish.pregnantSec <= 0) {
          fish.pregnant = false;
          fish.pregnantSec = 0;
          this.layEgg(fish);
        }
      }

      // A grabbed fish does not steer and does not drop coins while it
      // is held (its coin timer is paused, not reset). Hunger still
      // ticks — holding a fish for a long time is not a way to cheat
      // the hunger clock.
      if (fish.grabbed) {
        if (fish.glowSec > 0) fish.glowSec -= dt;
        fish.wiggleFreq = Math.PI * 2 * 8; // struggle: 8 wobbles/sec
        fish.wiggleAmp = 0.15;
        this.animateFish(fish, dt);
        continue;
      }
      // Poke burst — dart away from the pointer for 0.5s at 3x speed,
      // ignoring pellets and wander targets while it lasts.
      if (fish.pokeSec > 0) {
        fish.pokeSec -= dt;
        const pokeSpeed = speciesDef(fish.species).speed * 3;
        fish.sprite.x += fish.pokeDirX * pokeSpeed * dt;
        fish.sprite.y += fish.pokeDirY * pokeSpeed * dt;
        fish.sprite.setFlipX(fish.pokeDirX < 0);
        fish.sprite.x = Phaser.Math.Clamp(fish.sprite.x, 30, CONFIG.width - 30);
        fish.sprite.y = Phaser.Math.Clamp(fish.sprite.y, 48, CONFIG.waterBottom - 34);
        fish.tilt += (fishTiltFor(fish.pokeDirY, 1) - fish.tilt) * Math.min(1, dt * 8);
        fish.wiggleFreq = 10;
        fish.wiggleAmp = 0.35;
        this.animateFish(fish, dt);
        continue;
      }

      // Hungry fish: pale, and they stop dropping coins. A fish
      // that just ate a deluxe pellet glows gold briefly — glow
      // overrides the pale tint while it lasts.
      if (fish.glowSec > 0) fish.glowSec -= dt;
      // Swim speed comes from fishSpeed() — species base × this
      // fish's tempo × its state (hungry fish hurry, just-fed fish
      // drift) — and a pregnant fish swims ~30% slower on top.
      const sp = speciesDef(fish.species);
      let speed = this.fishSpeed(fish);
      if (fish.pregnant) speed *= 0.7;
      // PREDATION CHASE: a large, hungry Chomper that has a baby
      // within ~70px chases it at poke-burst speed (3x its effective
      // speed — the same dart feel as a poke), ignoring pellets,
      // drift, and wander targets while it hunts. The catch itself
      // happens after the fish loop (updateHunting), so the hunter
      // has to actually reach the baby — it cannot eat at range.
      const huntPrey = (fish.species === "chomper" && fish.stage === 2 && (fish.hungerSec || 0) > 0 && !fish.breeding)
        ? findPrey(fish, this.fish)
        : null;
      if (huntPrey) speed = this.fishSpeed(fish) * 3;
      if (fish.glowSec > 0) {
        fish.curTint = 0xffe27a; fish.curAlpha = 1;
      } else {
        fish.curTint = hungry ? 0xb9c8d0 : 0xffffff;
        fish.curAlpha = hungry ? 0.75 : 1;
      }
      fish.sprite.setTint(fish.curTint);
      fish.sprite.setAlpha(fish.curAlpha);

      // Coins: only while fed, on the species' own schedule. During
      // a Coin Rush (see scene/events.js) the timer ticks twice as
      // fast, so coins drop twice as often for the rush's 20s.
      if (!hungry) {
        fish.coinTimer += dt * (this.coinRushSec > 0 ? 2 : 1);
        if (fish.coinTimer >= sp.coinEverySec) {
          fish.coinTimer = 0;
          this.dropCoin(fish);
        }
      }

      // Steering: chase the NEAREST food — a pellet or a feast plant,
      // nearest wins — else wander. Every fish may chase the same
      // food, so they fight over it — the 0.5s cooldown (not a claim)
      // is what stops one fish eating every pellet in a row, and the
      // plant's own chew/global pacing does the same for plants. A
      // fish on its post-meal drift does NEITHER — it swims to its
      // drift point (set in feedFish / nibblePlant) and ignores food
      // for steering until the drift timer runs out.
      let tx = fish.targetX, ty = fish.targetY;
      let chasing = false;
      let nearestPellet = null, nearestD = Infinity;
      // The food target the sprint checks: { x, y, sinking } — a
      // pellet counts only while sinking, a plant always (it is food
      // on the way down AND on the floor).
      let chaseTarget = null;
      // A fish in a hearts pair swims toward its partner, not toward
      // food or a wander target, for the ~3s the hearts last. It still
      // eats if a pellet bumps into it — only the steering changes.
      const breeding = !!(fish.breeding && fish.breedPartner && this.fish.includes(fish.breedPartner));
      if (breeding) {
        tx = fish.breedPartner.sprite.x;
        ty = fish.breedPartner.sprite.y;
      } else if (huntPrey) {
        // Hunting beats pellets and drift — the Chomper steers
        // straight at the baby it is chasing.
        tx = huntPrey.sprite.x;
        ty = huntPrey.sprite.y;
        chasing = true; // fast tail wag, like chasing food
      } else if (fish.driftSec > 0) {
        tx = fish.driftX; ty = fish.driftY;
      } else {
        for (const p of this.pellets) {
          const pdx = p.sprite.x - fish.sprite.x, pdy = p.sprite.y - fish.sprite.y;
          const pd = pdx * pdx + pdy * pdy;
          if (pd < nearestD) { nearestD = pd; nearestPellet = p; }
        }
        // Feast plants are food too — nearest food wins, pellet or
        // plant. A plant is chased while sinking AND once anchored.
        // Distance is measured to the plant's BODY (see plantDistSq):
        // a fish next to a 150px plant's top fronds is next to food,
        // not 100px from its centre.
        let nearestPlant = null, nearestPlantD = Infinity;
        for (const pl of this.feastPlants) {
          const pd = this.plantDistSq(pl, fish.sprite.x, fish.sprite.y);
          if (pd < nearestPlantD) { nearestPlantD = pd; nearestPlant = pl; }
        }
        if (nearestPellet && nearestD <= nearestPlantD) {
          tx = nearestPellet.sprite.x; ty = nearestPellet.sprite.y; chasing = true;
          chaseTarget = { x: tx, y: ty, sinking: !nearestPellet.landed };
        } else if (nearestPlant) {
          tx = nearestPlant.container.x; ty = nearestPlant.container.y; chasing = true;
          chaseTarget = { x: tx, y: ty, sinking: true };
        }
      }
      if (!chasing && fish.driftSec <= 0 && !breeding) {
        fish.wanderTimer -= dt;
        if (fish.wanderTimer <= 0) {
          fish.wanderTimer = 2 + Math.random() * 2.5;
          fish.targetX = 60 + Math.random() * (CONFIG.width - 120);
          // Starfish prefer the bottom third of the tank, even when
          // wandering — their target y is 300..floor, never the open
          // water the other species wander in. Other fish wander
          // 100..360 — never into the fish-free top strip (fishMinY).
          fish.targetY = sp.swimLow
            ? 300 + Math.random() * (CONFIG.waterBottom - 34 - 300)
            : CONFIG.fishMinY + Math.random() * (360 - CONFIG.fishMinY);
          tx = fish.targetX; ty = fish.targetY;
        }
      }
      // DESPERATE SPRINT: chasing a SINKING food target 40-120px
      // away — close enough to want, far enough to miss — the fish
      // bursts to 1.8x for up to 1.5s, then needs a ~3s breather. The
      // burst ends early if the food is eaten, lands, or leaves the
      // window; a target closer than 40px needs no sprint, and one
      // farther than 120px is just a normal chase. The target is a
      // pellet (only while sinking) or a feast plant (sinking or
      // anchored — a plant is food all the way down). Hunting,
      // drifting, and breeding never sprint — only the food chase does.
      let sprinting = false;
      if (chasing && chaseTarget && chaseTarget.sinking) {
        const chaseDist = Math.hypot(chaseTarget.x - fish.sprite.x, chaseTarget.y - fish.sprite.y);
        const inWindow = chaseDist >= CONFIG.sprintMinPx && chaseDist <= CONFIG.sprintMaxPx;
        if (fish.sprintSec > 0) {
          if (!inWindow) this.endSprint(fish);
        } else if (inWindow && fish.sprintCooldownSec <= 0) {
          fish.sprintSec = CONFIG.sprintMaxSec;
        }
        sprinting = fish.sprintSec > 0;
      } else if (fish.sprintSec > 0) {
        this.endSprint(fish);
      }
      if (sprinting) speed *= CONFIG.sprintMult;
      // Move toward the target at `speed`, then face that way.
      const dx = tx - fish.sprite.x, dy = ty - fish.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 4) {
        const step = Math.min(dist, speed * dt);
        fish.sprite.x += (dx / dist) * step;
        fish.sprite.y += (dy / dist) * step;
        fish.sprite.setFlipX(dx < 0); // face left when swimming left
      }
      // Keep fish inside the water — and never above the fish-free
      // top strip. This is the backstop for every steering path
      // (wander, pellet chase, hunt, breeding approach, post-meal
      // drift, separation): no live fish can end a frame above
      // fishMinY, even if its target was up there.
      fish.sprite.x = Phaser.Math.Clamp(fish.sprite.x, 30, CONFIG.width - 30);
      fish.sprite.y = Phaser.Math.Clamp(fish.sprite.y, CONFIG.fishMinY, CONFIG.waterBottom - 34);
      // Swim animation — tilt follows the swim direction, and the
      // tail wag scales with how fast the fish is actually swimming:
      // a sprinting fish wags frantically, a lazy just-fed fish
      // barely bothers. (Hungry fish are FASTER now, so they wag
      // faster too — the old hungry slowdown is gone with the 0.5x
      // speed.) animateFish() applies it all (and the tail).
      const tiltTarget = fishTiltFor(dy, dist);
      fish.tilt += (tiltTarget - fish.tilt) * Math.min(1, dt * 8);
      const wagRatio = Math.max(0.5, Math.min(2.5, speed / sp.speed));
      fish.wiggleFreq = (chasing ? 10 : 6) * wagRatio;
      fish.wiggleAmp = hungry ? 0.2 : 0.35;
      this.animateFish(fish, dt);
    }
  },

  // SEPARATION: overlapping fish drift gently apart. It just makes
  // the tank readable (you can see who is pale/hungry) and stops a
  // stack of fish from looking like one fish. Pairs closer than
  // CONFIG.sepRadiusPx are pushed apart at ~3x the overlap per second,
  // split evenly, and the push is 1.5x when either fish has 2+
  // neighbours in the radius (a stack of 3+). Grabbed fish are skipped
  // (the player is holding them). No jitter at 60fps because the push
  // scales with dt and with the overlap itself — it fades to zero as
  // the fish separate.
  updateSeparation(dt) {
    const sepR = CONFIG.sepRadiusPx;
    // Neighbour counts first, so a fish buried in a stack gets pushed
    // harder than a lone pair. Grabbed fish don't count — they aren't
    // part of the swimming crowd.
    const neighbours = this.fish.map((f, i) => {
      let n = 0;
      for (let k = 0; k < this.fish.length; k++) {
        if (k === i || this.fish[k].grabbed) continue;
        const ddx = this.fish[k].sprite.x - f.sprite.x, ddy = this.fish[k].sprite.y - f.sprite.y;
        if (ddx * ddx + ddy * ddy < sepR * sepR) n++;
      }
      return n;
    });
    for (let i = 0; i < this.fish.length; i++) {
      for (let j = i + 1; j < this.fish.length; j++) {
        const a = this.fish[i], b = this.fish[j];
        if (a.grabbed || b.grabbed) continue;
        const dx = b.sprite.x - a.sprite.x, dy = b.sprite.y - a.sprite.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= sepR) continue;
        let ux, uy;
        if (dist < 0.01) {
          // Exactly stacked (a whole group can converge on one
          // pellet): there is no direction to push along, so split
          // them horizontally by index — otherwise they would never
          // move at all.
          ux = (i % 2 === 0 ? 1 : -1); uy = 0;
        } else {
          ux = dx / dist; uy = dy / dist;
        }
        const crowd = (neighbours[i] >= 2 || neighbours[j] >= 2) ? CONFIG.sepCrowdMult : 1;
        const push = (sepR - dist) * 3 * crowd * dt / 2;
        a.sprite.x = Phaser.Math.Clamp(a.sprite.x - ux * push, 30, CONFIG.width - 30);
        a.sprite.y = Phaser.Math.Clamp(a.sprite.y - uy * push, 48, CONFIG.waterBottom - 34);
        b.sprite.x = Phaser.Math.Clamp(b.sprite.x + ux * push, 30, CONFIG.width - 30);
        b.sprite.y = Phaser.Math.Clamp(b.sprite.y + uy * push, 48, CONFIG.waterBottom - 34);
      }
    }
  },
};
