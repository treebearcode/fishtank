// scene/deadfish.js — TankScene mixin: dead fish.
//
// A starved fish does not just vanish any more. It floats belly-up
// to the surface (grey, X eyes — see makeDeadFishTexture), bobs
// there for a while, then fades — the same ~10s-at-rest idea as a
// landed coin. Dead fish are purely visual: they live in
// this.deadFish, NOT in this.fish, so nothing ever clicks, pokes,
// grabs, sells, feeds, breeds, or hunts them, and they never count
// toward the fish cap. The only interaction is the silly one: a
// live fish that swims into one knocks it around — a mild impulse
// with damping, and buoyancy pulls it back up to the surface.

import { CONFIG, speciesDef } from "../config.js";

export const deadfishMixin = {
  // Spawn a dead fish where a live one died. Same rendered size as
  // the fish that died (baseScale), belly-up (rotation PI), grey
  // texture for its species. The sprite origin sits on the body
  // centre (56/88 for tailed fish — the tail fan sticks out past
  // the body edge), so rotation pivots around the body and the
  // knock math reads the body position.
  spawnDeadFish(speciesKey, x, y, baseScale) {
    const sp = speciesDef(speciesKey);
    const sprite = this.add.image(x, y, "fish-dead-" + sp.key).setDepth(5);
    if (sp.hasTail) sprite.setOrigin(56 / 88, 0.5);
    sprite.setScale(baseScale, baseScale);
    sprite.rotation = Math.PI; // belly up
    const dead = {
      sprite, species: sp.key, baseScale,
      vx: 0, vy: 0,            // knock velocity (px/s), decays with damping
      surfaceSec: 0,          // seconds bobbing at the surface
      atSurface: false,       // true once it first reaches the bob line
      wobble: Math.random() * Math.PI * 2,
    };
    this.deadFish.push(dead);
    return dead;
  },

  // Per-frame: rise, bob, fade, and the knock physics. Iterate over
  // a copy — a dead fish can fade out mid-loop.
  updateDeadFish(dt, time) {
    for (const dead of [...this.deadFish]) {
      const s = dead.sprite;
      // KNOCK: a live fish that swims into a dead fish nudges it
      // away. The impulse is mild and the total speed is capped, so
      // a fish swimming through gives it a shove, never a launch.
      // Dead fish never knock each other (skipped by design).
      for (const fish of this.fish) {
        const dx = s.x - fish.sprite.x, dy = s.y - fish.sprite.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= CONFIG.deadKnockRadiusPx) continue;
        let ux, uy;
        if (dist < 0.01) { ux = 1; uy = 0; } // exactly stacked: shove sideways
        else { ux = dx / dist; uy = dy / dist; }
        dead.vx += ux * CONFIG.deadKnockImpulsePxS;
        dead.vy += uy * CONFIG.deadKnockImpulsePxS;
        const speed = Math.hypot(dead.vx, dead.vy);
        if (speed > CONFIG.deadKnockMaxPxS) {
          dead.vx = (dead.vx / speed) * CONFIG.deadKnockMaxPxS;
          dead.vy = (dead.vy / speed) * CONFIG.deadKnockMaxPxS;
        }
      }
      // Knock velocity decays, then moves the fish.
      const damp = Math.max(0, 1 - CONFIG.deadKnockDamping * dt);
      dead.vx *= damp;
      dead.vy *= damp;
      s.x += dead.vx * dt;
      s.y += dead.vy * dt;
      // BUOYANCY: below the surface it rises at a gentle fixed
      // speed — the same pull that brings it back up after a knock
      // shoves it down. Once it reaches the bob line it stays there
      // (eased, not snapped, so a knock dips it and it floats back).
      if (!dead.atSurface) {
        s.y -= CONFIG.deadRisePxS * dt;
        if (s.y <= CONFIG.deadSurfaceY) {
          s.y = CONFIG.deadSurfaceY;
          dead.atSurface = true;
        }
      } else {
        dead.surfaceSec += dt;
        const bobY = CONFIG.deadSurfaceY + Math.sin(time / 600 + dead.wobble) * 3;
        s.y += (bobY - s.y) * Math.min(1, dt * 3);
        // Gentle rocking on the surface, ±~5°.
        s.rotation = Math.PI + Math.sin(time / 700 + dead.wobble) * 0.08;
        // Fade over the last 2s at the surface, like a landed coin.
        if (dead.surfaceSec > CONFIG.deadSurfaceLifeSec - 2) {
          s.setAlpha(1 - (dead.surfaceSec - (CONFIG.deadSurfaceLifeSec - 2)) / 2);
        }
        if (dead.surfaceSec >= CONFIG.deadSurfaceLifeSec) {
          s.destroy();
          this.deadFish.splice(this.deadFish.indexOf(dead), 1);
          continue;
        }
      }
      // Keep it inside the water.
      s.x = Phaser.Math.Clamp(s.x, 30, CONFIG.width - 30);
      s.y = Phaser.Math.Clamp(s.y, 40, CONFIG.waterBottom - 34);
    }
  },
};
