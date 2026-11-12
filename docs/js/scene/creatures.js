// scene/creatures.js — TankScene mixin: the hired helpers.
// Turbo the snail (floor crawler), Claws the crab (sinking-coin
// grabber), and the feeder-bot (auto-feeder pet).

import { CONFIG, ROBOT_BAND } from "../config.js";
import { snailTargetCoin, snailAimX, snailCanCollect } from "../snail.js";
import { sfx } from "../sound.js";

export const creaturesMixin = {
  // SNAIL: bottom-only, toward the coin he can collect SOONEST
  // (time-to-collect scoring, see snail.js). ANTICIPATION: he targets
  // a coin while it is still SINKING, not just once it lands — coins
  // fall mostly straight down (26 px/s), so their landing x is roughly
  // their current x, and he is already waiting there when it touches
  // down. He still only COLLECTS landed coins within 20px — mid-water
  // is Claws' job. OVERSHOOT: while the target coin is still sinking,
  // he aims ~20px past its landing x (snailAimX) and paces back across
  // it — eager. Once it lands he aims exactly at it, so overshoot can
  // never delay a collection.
  updateSnail(dt) {
    if (!this.snail) return;
    const s = this.snail;
    const snailSpeed = this.snailUpgraded ? CONFIG.snailSpeedUpgraded : CONFIG.snailSpeed;
    const coinTargets = this.coins.map((c) => ({ x: c.container.x, y: c.container.y, vy: c.vy }));
    const targetIdx = snailTargetCoin(coinTargets, s.sprite.x, CONFIG.floorY, snailSpeed);
    const target = targetIdx >= 0 ? this.coins[targetIdx] : null;
    if (target) {
      const aimX = snailAimX(
        { x: target.container.x, y: target.container.y },
        s.sprite.x, CONFIG.floorY, CONFIG.snailOvershootPx);
      const dx = aimX - s.sprite.x;
      const step = Math.min(Math.abs(dx), snailSpeed * dt);
      s.sprite.x += Math.sign(dx) * step;
      s.sprite.setFlipX(dx < 0);
      if (snailCanCollect({ x: target.container.x, y: target.container.y }, s.sprite.x, CONFIG.floorY)) {
        this.collectCoin(target);
      }
    } else {
      // No coins at all: amble slowly toward a random spot on the floor.
      if (Math.abs(s.wanderX - s.sprite.x) < 8) s.wanderX = 60 + Math.random() * 840;
      const dx = s.wanderX - s.sprite.x;
      s.sprite.x += Math.sign(dx) * Math.min(Math.abs(dx), 12 * dt);
      s.sprite.setFlipX(dx < 0);
    }
    s.sprite.x = Phaser.Math.Clamp(s.sprite.x, 30, CONFIG.width - 30);
    // Bubble trail, roughly once a second.
    s.bubbleTimer += dt;
    if (s.bubbleTimer > 1) { s.bubbleTimer = 0; this.spawnBubble(s.sprite.x, s.sprite.y - 14); }
  },

  // CRAB: 2D movement (~60 px/s) toward the nearest SINKING coin
  // (y < floor). If none is sinking, he ambles along the floor like
  // Turbo. He collects on touch, same as the player.
  updateCrab(dt) {
    if (!this.crab) return;
    const c = this.crab;
    let target = null, bestD = Infinity;
    for (const coin of this.coins) {
      if (coin.container.y >= CONFIG.floorY) continue; // landed — Turbo's job
      const dx = coin.container.x - c.sprite.x, dy = coin.container.y - c.sprite.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; target = coin; }
    }
    if (target) {
      const dx = target.container.x - c.sprite.x, dy = target.container.y - c.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 4) {
        const step = Math.min(dist, CONFIG.crabSpeed * dt);
        c.sprite.x += (dx / dist) * step;
        c.sprite.y += (dy / dist) * step;
        c.sprite.setFlipX(dx < 0);
      }
      if (dist < 22) this.collectCoin(target);
    } else {
      // No sinking coins: scuttle along the floor.
      if (Math.abs(c.wanderX - c.sprite.x) < 8) c.wanderX = 60 + Math.random() * 840;
      const dx = c.wanderX - c.sprite.x;
      c.sprite.x += Math.sign(dx) * Math.min(Math.abs(dx), 20 * dt);
      c.sprite.setFlipX(dx < 0);
      c.sprite.y = Math.min(c.sprite.y + 30 * dt, CONFIG.floorY);
    }
    c.sprite.x = Phaser.Math.Clamp(c.sprite.x, 30, CONFIG.width - 30);
    c.sprite.y = Phaser.Math.Clamp(c.sprite.y, 60, CONFIG.floorY);
  },

  // Spawn the feeder-bot sprite (body + blinking light) in the middle
  // of its swim band. Called once, when the feeder is bought.
  spawnFeederBot() {
    if (this.feederBot) return;
    const sprite = this.add.image(480, 180, "feeder-bot").setDepth(4);
    const light = this.add.image(480, 168, "bot-light").setDepth(5);
    this.feederBot = { sprite, light, targetX: 480, targetY: 180, wanderTimer: 2, blinkPhase: 0 };
  },

  // FEEDER TIMER: one Standard pellet every 15s while ON and owned.
  // Costs $2 each, paid here (not via dropFood, which charges the
  // selected food type). Pauses silently if broke or fishless, and
  // retries 15s later. The pellet spawns AT THE ROBOT's position
  // (clamped into its swim band) — the player can see where the food
  // came from. The timer uses dt, which is already scaled by
  // speedMult, so the bot keeps working during 2x speed.
  updateFeederDrop(dt) {
    if (!this.feederOwned || !this.feederOn || !this.feederBot) return;
    this.feederTimer += dt;
    if (this.feederTimer >= CONFIG.feederIntervalSec) {
      this.feederTimer = 0;
      if (this.fish.length > 0 && this.money >= CONFIG.foodCost) {
        this.money -= CONFIG.foodCost;
        const bx = Phaser.Math.Clamp(this.feederBot.sprite.x, ROBOT_BAND.minX, ROBOT_BAND.maxX);
        const by = Phaser.Math.Clamp(this.feederBot.sprite.y, ROBOT_BAND.minY, ROBOT_BAND.maxY);
        // Spawned AT the robot (no offset), so the pellet starts
        // inside the robot's swim band (y 80..300) — it then sinks
        // from there, giving fish the full fall time to catch it.
        this.dropPelletAt(bx, by, 1, false);
        // A little pop: the robot puffs up briefly + a blip.
        this.tweens.add({ targets: this.feederBot.sprite, scaleX: 1.25, scaleY: 1.25, duration: 120, yoyo: true });
        sfx.pop();
        this.updateShopUI();
        this.updateTopUI();
      }
    }
  },

  // FEEDER MOVEMENT: a visible pet robot that swims the UPPER/MID
  // water only — its wander targets are inside ROBOT_BAND (y 80..300)
  // and its position is clamped there every frame, so it can NEVER go
  // deeper than y=300. The pellets it drops (see updateFeederDrop)
  // therefore always have fall time, and fish can intercept them
  // before they hit the floor. Gentle speed (~35 px/s), faces its swim
  // direction, and its little light blinks. It is not a fish: it
  // cannot be grabbed, poked, or sold (see onPointerDown).
  updateFeederBot(dt) {
    if (!this.feederBot) return;
    const r = this.feederBot;
    r.wanderTimer -= dt;
    if (r.wanderTimer <= 0) {
      r.wanderTimer = 2 + Math.random() * 3;
      r.targetX = ROBOT_BAND.minX + Math.random() * (ROBOT_BAND.maxX - ROBOT_BAND.minX);
      r.targetY = ROBOT_BAND.minY + Math.random() * (ROBOT_BAND.maxY - ROBOT_BAND.minY);
    }
    const rdx = r.targetX - r.sprite.x, rdy = r.targetY - r.sprite.y;
    const rdist = Math.hypot(rdx, rdy);
    if (rdist > 4) {
      const step = Math.min(rdist, CONFIG.robotSpeed * dt);
      r.sprite.x += (rdx / rdist) * step;
      r.sprite.y += (rdy / rdist) * step;
      r.sprite.setFlipX(rdx < 0);
    }
    // Hard clamp into the band every frame — the MIN DEPTH RULE.
    r.sprite.x = Phaser.Math.Clamp(r.sprite.x, ROBOT_BAND.minX, ROBOT_BAND.maxX);
    r.sprite.y = Phaser.Math.Clamp(r.sprite.y, ROBOT_BAND.minY, ROBOT_BAND.maxY);
    // The light rides on the robot's dome and blinks (~2Hz).
    r.light.x = r.sprite.x;
    r.light.y = r.sprite.y - 12;
    r.blinkPhase += dt * 2;
    r.light.setAlpha(this.feederOn ? (Math.sin(r.blinkPhase * Math.PI * 2) > 0 ? 1 : 0.25) : 0.25);
    // Dim the whole robot while the feeder is OFF, so its state reads
    // at a glance.
    r.sprite.setAlpha(this.feederOn ? 1 : 0.6);
  },
};
