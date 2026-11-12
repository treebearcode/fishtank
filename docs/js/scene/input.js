// scene/input.js — TankScene mixin: the POINTER DISPATCHER.
//
// One place, one decision, one action. Every pointerdown in the tank
// goes through resolvePointerTarget() and runs exactly one branch, so
// a coin click can never also drop food, and a fish press can never
// drop food either.
//   pointerdown: coin -> collect | fish -> start poke/grab tracking
//                | water -> drop food immediately
//   pointermove: if a fish is being held and it moved >8px, it is a
//                grab — the fish follows the pointer.
//   pointerup:   fish held + quick + no move = poke (dart away)
//                fish held + moved + dropped on Sell = sell it
//                fish held + moved + dropped elsewhere = move it
// Shop buttons (y >= 460), the goal popup (paused), and the start
// overlay (not started) all return early here — their own handlers run
// instead, and no food is dropped for those clicks.

import { CONFIG } from "../config.js";
import { resolvePointerTarget, isPoke, isOverSell, robotHitAt } from "../input.js";
import { magnetHoverAt } from "../magnet.js";
import { sfx } from "../sound.js";

export const inputMixin = {
  onPointerDown(pointer) {
    if (!this.started || this.paused || this.goalPopupShown) return;
    if (pointer.y >= CONFIG.waterBottom || pointer.y < 36) return; // shop / top bar
    // Track the pointer for the magnet (hover-collect + drag need the
    // last known position).
    this.pointerX = pointer.x;
    this.pointerY = pointer.y;
    this.pointerSeen = true;
    // DECOR PANEL: a click ON the panel belongs to the panel (its rows
    // have their own handlers) — the dispatcher must not also drop
    // food or grab a fish behind it. A click elsewhere in the tank
    // closes the panel and does nothing else (one click, one action —
    // no surprise food drop).
    if (this.decorPanelBounds) {
      const b = this.decorPanelBounds;
      if (pointer.x >= b.x0 && pointer.x <= b.x1 && pointer.y >= b.y0 && pointer.y <= b.y1) return;
      this.closeDecorPanel();
      return;
    }
    const coins = this.coins.map((c) => ({ x: c.container.x, y: c.container.y }));
    const fishPos = this.fish.map((f) => ({ x: f.sprite.x, y: f.sprite.y }));
    const hit = resolvePointerTarget(pointer.x, pointer.y, coins, fishPos);
    if (hit.type === "coin") {
      this.collectCoin(this.coins[hit.index]);
      return;
    }
    if (hit.type === "fish") {
      const fish = this.fish[hit.index];
      this.dragFish = fish;
      fish.grabbed = true;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
      // Use the scene clock, not pointer.time (not a reliable
      // elapsed-time source in Phaser) — poke timing depends on it.
      this.dragStartTime = this.time.now;
      this.dragActive = false;
      this._dragOverSell = false;
      this.updateSellButton();
      return;
    }
    // The feeder-bot is a pet, not a fish — clicking it drops no food.
    // It is checked AFTER fish, so a fish swimming right behind the
    // robot can still be poked or grabbed.
    if (this.feederBot && robotHitAt(this.feederBot.sprite.x, this.feederBot.sprite.y, pointer.x, pointer.y)) {
      this.toast("That's the feeder-bot! It drops a $2 pellet every 15s.");
      return;
    }
    // Empty water — the only branch that drops food. A successful
    // drop starts the hold-to-feed cadence: keep dropping while the
    // button stays down (see updateFeedHold in scene/feeding.js). A
    // failed drop (broke) starts nothing, so "Not enough money"
    // toasts once per click, not once per frame.
    if (this.dropFood(pointer.x, pointer.y)) {
      this.feedHold = true;
      this.feedHoldTimer = CONFIG.feedHoldIntervalSec;
    }
  },

  onPointerMove(pointer) {
    // Track the pointer for the magnet, even when no fish is being
    // dragged. L1 HOVER COLLECT: hovering over a coin collects it
    // (same 24px hitbox as clicking) — no click needed. Hovering never
    // collects while a fish is being dragged, and never fires before
    // the game starts / while paused.
    if (this.started && !this.paused && !this.goalPopupShown && pointer.y < CONFIG.waterBottom) {
      this.pointerX = pointer.x;
      this.pointerY = pointer.y;
      this.pointerSeen = true;
      if (this.magnetLevel >= 1 && !this.dragFish) {
        for (const coin of [...this.coins]) {
          if (magnetHoverAt(coin.container.x, coin.container.y, pointer.x, pointer.y)) {
            this.collectCoin(coin);
          }
        }
      }
    }
    if (!this.dragFish) return;
    const dx = pointer.x - this.dragStartX, dy = pointer.y - this.dragStartY;
    if (!this.dragActive && Math.hypot(dx, dy) >= CONFIG.pokeMaxMove) {
      this.dragActive = true; // crossed the threshold: this is a grab
    }
    if (this.dragActive) {
      const fish = this.dragFish;
      // Held by the TAIL — the fish hangs head-down below the pointer,
      // so its centre sits ~20px under the pointer and its tail is at
      // the pointer. animateFish() (in updateFish) turns it vertical
      // and adds the struggle wobble.
      fish.sprite.x = Phaser.Math.Clamp(pointer.x, 30, CONFIG.width - 30);
      fish.sprite.y = Phaser.Math.Clamp(pointer.y + 20, 48, CONFIG.waterBottom - 34);
      this._dragOverSell = isOverSell(pointer.x, pointer.y);
      this.updateSellButton();
    }
  },

  onPointerUp(pointer) {
    // Release ends hold-to-feed. This runs BEFORE the dragFish early
    // return, so a plain water hold (no fish grabbed) still clears it.
    this.feedHold = false;
    if (!this.dragFish) return;
    const fish = this.dragFish;
    const movePx = Math.hypot(pointer.x - this.dragStartX, pointer.y - this.dragStartY);
    const elapsedMs = this.time.now - this.dragStartTime;
    fish.grabbed = false;
    // A released grab snaps back to horizontal over ~0.2s
    // (animateFish() lerps the rotation). A poke never sets this — it
    // was never held vertical in the first place.
    if (movePx >= CONFIG.pokeMaxMove) fish.returnSec = 0.2;
    this.dragFish = null;
    this.dragActive = false;
    this._dragOverSell = false;
    this.updateSellButton();
    if (isOverSell(pointer.x, pointer.y) && movePx >= CONFIG.pokeMaxMove) {
      // Dropped on Sell after a real drag: sell THAT fish.
      this.sellFish(fish);
      return;
    }
    if (isPoke(movePx, elapsedMs)) {
      // Quick tap, barely moved: POKE. Dart away from the pointer with
      // a 0.5s speed burst (handled in updateFish).
      let dx = fish.sprite.x - pointer.x, dy = fish.sprite.y - pointer.y;
      const len = Math.hypot(dx, dy) || 1;
      fish.pokeDirX = dx / len;
      fish.pokeDirY = dy / len;
      fish.pokeSec = 0.5;
      sfx.pop();
      return;
    }
    if (movePx >= CONFIG.pokeMaxMove) {
      // Grabbed and dropped in the water: the fish stays where it was
      // dropped and swims off from there. Centre it on the pointer (it
      // hung 20px below it while held — see onPointerMove) and let
      // animateFish() snap it horizontal.
      fish.sprite.x = Phaser.Math.Clamp(pointer.x, 30, CONFIG.width - 30);
      fish.sprite.y = Phaser.Math.Clamp(pointer.y, 48, CONFIG.waterBottom - 34);
      fish.targetX = fish.sprite.x;
      fish.targetY = fish.sprite.y;
      fish.wanderTimer = 1 + Math.random();
    }
    // A slow press with almost no movement (not a poke, not a grab):
    // do nothing — the fish just stays put. No food is dropped.
  },
};
