// scene/coins.js — TankScene mixin: coin drops, collection, the
// sinking/fading coin loop, and the magnet drag.
//
// Coin value includes the decoration bonus (+5% each, max +15%), paid
// in cents — the base value comes from the fish's species, and the
// label uses moneyFmt so "$1.05" shows as "$1.05".

import { CONFIG } from "../config.js";
import { coinValueForStage, coinValueWithBonus, decorCount, moneyFmt, addMoney } from "../economy.js";
import { MAGNET_DRAG_SPEED_PX, magnetRadiusFor, magnetDragCoin } from "../magnet.js";
import { sfx } from "../sound.js";

export const coinsMixin = {
  // Coin value includes the decoration bonus. The boosted value is
  // what the coin is worth AND what its label shows.
  dropCoin(fish) {
    const stage = fish.stage;
    const value = coinValueWithBonus(coinValueForStage(stage, fish.species), decorCount(this.decorations));
    const x = fish.sprite.x;
    const y = fish.sprite.y + 14;
    const container = this.add.container(x, y).setDepth(6);
    const img = this.add.image(0, 0, "coin-" + stage);
    const label = this.add.text(0, 0, moneyFmt(value), { fontSize: "11px", color: "#12394d", fontStyle: "bold" }).setOrigin(0.5, 0.5);
    container.add([img, label]);
    // Coins are NOT interactive any more. Their clicks are handled by
    // the single scene dispatcher (onPointerDown), which hit-tests
    // coins with a generous 24px radius. Giving the container its own
    // pointerdown handler made one click fire twice.
    const coin = { container, img, value, vy: 26, bottomSec: 0, fading: false, wobble: Math.random() * 6 };
    this.coins.push(coin);
  },

  collectCoin(coin) {
    if (!this.coins.includes(coin)) return; // already collected / faded
    // Cents-safe addition (addMoney rounds the total to cents).
    this.money = addMoney(this.money, coin.value);
    this.totalBanked = addMoney(this.totalBanked, coin.value); // goal progress — lifetime $ collected
    this.floatText("+" + moneyFmt(coin.value), coin.container.x, coin.container.y - 14, "#ffe27a");
    coin.container.destroy();
    this.coins.splice(this.coins.indexOf(coin), 1);
    sfx.coin();
    this.updateShopUI();
    this.updateTopUI();
    this.updateGoalUI();
  },

  // Coins sink slowly, wobble, then sit on the floor for 10s and fade.
  updateCoins(dt, time) {
    for (const coin of [...this.coins]) {
      if (coin.container.y < CONFIG.floorY) {
        coin.container.y += coin.vy * dt;
        coin.container.x += Math.sin(time / 400 + coin.wobble) * 0.25;
        if (coin.container.y >= CONFIG.floorY) coin.container.y = CONFIG.floorY;
      } else {
        coin.bottomSec += dt;
        if (coin.bottomSec > CONFIG.coinBottomLifeSec - 2) coin.container.setAlpha(1 - (coin.bottomSec - (CONFIG.coinBottomLifeSec - 2)) / 2);
        if (coin.bottomSec >= CONFIG.coinBottomLifeSec) {
          coin.container.destroy();
          this.coins.splice(this.coins.indexOf(coin), 1);
        }
      }
    }
  },

  // MAGNET DRAG (L2+): coins within the level's radius of the cursor
  // are gently dragged toward it (150 px/s) and collected on touch
  // (~14px). Sinking AND landed coins are dragged; magnetDragCoin
  // clamps the result into the water, so a coin can never be pulled
  // through the UI or out of the tank. Drag runs BEFORE Turbo/Claws,
  // but it never fights them: it only MOVES coins — Turbo still
  // collects landed coins and Claws still grabs sinking ones, on
  // touch, exactly as before. Drag needs a real pointer position
  // (pointerSeen) — before the player first moves the pointer, nothing
  // is dragged.
  updateMagnetDrag(dt) {
    if (this.magnetLevel >= 2 && this.pointerSeen) {
      const radius = magnetRadiusFor(this.magnetLevel);
      for (const coin of [...this.coins]) {
        if (!this.coins.includes(coin)) continue;
        const res = magnetDragCoin(coin.container.x, coin.container.y,
          this.pointerX, this.pointerY, radius, dt, MAGNET_DRAG_SPEED_PX);
        if (!res) continue;
        if (res.collect) { this.collectCoin(coin); continue; }
        coin.container.x = res.x;
        coin.container.y = res.y;
      }
    }
  },
};
