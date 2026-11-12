// scene/ui.js — TankScene mixin: the HUD and shop UI.
// Buttons, the fixed description bar, top bar, goal popup, toasts.
// Mixed into TankScene.prototype (see scene/tank.js); every method
// works on `this` (the scene).

import { CONFIG, SPECIES, SPECIES_ORDER, DESC_DEFAULT_TEXT } from "../config.js";
import { moneyFmt, countLargeFish, sellPriceForStage } from "../economy.js";
import { magnetLevelCost } from "../magnet.js";
import { sfx } from "../sound.js";

export const uiMixin = {
  // A shop button — rounded rect + a small icon glyph + a SHORT label.
  // `onBuy` runs on click; the caller decides whether the purchase is
  // legal. `icon` is a text glyph (emoji / symbol — procedural, no
  // binary assets). `tipFn` returns the CURRENT hover description
  // (what it does, price, current state) — a function, not a fixed
  // string, so the bar stays right after a purchase changes the
  // button's state. The description goes in the FIXED bar (see
  // showDescText) — never an overlay over another button.
  makeShopButton(x, y, w, h, label, onBuy, icon, tipFn) {
    const btn = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, w, h, 0xffd23f, 1).setInteractive({ useHandCursor: true });
    bg.setStrokeStyle(2, 0x8a6a1f);
    const iconText = this.add.text(-w / 2 + 6, 0, icon || "", { fontSize: "14px" }).setOrigin(0, 0.5);
    const text = this.add.text(10, 0, label, { fontSize: "12px", color: "#12394d", fontStyle: "bold", align: "center" }).setOrigin(0.5, 0.5);
    btn.add([bg, iconText, text]);
    bg.on("pointerdown", () => { if (this.started && !this.paused) { this.resetDescText(); onBuy(); } });
    if (tipFn) {
      bg.on("pointerover", () => { if (this.started && !this.paused) this.showDescText(tipFn()); });
      bg.on("pointerout", () => this.resetDescText());
    }
    btn.bg = bg;
    btn.text = text;
    btn.icon = iconText;
    btn.tipFn = tipFn || null;
    btn.btnY = y;
    btn.setData("enabled", true);
    return btn;
  },

  // Write a description into the fixed bar. The bar never moves, never
  // hides, never covers a button — this only changes its text.
  showDescText(text) {
    if (!this.descBarText) return;
    this.descBarText.setText(text);
  },

  resetDescText() {
    if (!this.descBarText) return;
    this.descBarText.setText(DESC_DEFAULT_TEXT);
  },

  setButtonEnabled(btn, enabled, label) {
    btn.setData("enabled", enabled);
    btn.bg.setFillStyle(enabled ? 0xffd23f : 0x5a6b78, 1);
    btn.text.setColor(enabled ? "#12394d" : "#dfe9ef");
    if (label) btn.text.setText(label);
  },

  // Food-selector highlight. Selected food = gold, unselected = dark
  // blue. Selection is free — affordability is checked when a pellet
  // is actually dropped, not when you pick a food type.
  setButtonSelected(btn, selected) {
    btn.bg.setFillStyle(selected ? 0xffd23f : 0x2a5a75, 1);
    btn.text.setColor(selected ? "#12394d" : "#cfeeff");
  },

  updateShopUI() {
    const cap = this.maxFishCap();
    const atCap = this.fish.length >= cap;
    // One button per species. Disabled (grey) when unaffordable or the
    // tank is full; the label stays short — price lives in the hover
    // description.
    for (const key of SPECIES_ORDER) {
      const btn = this[key + "Btn"];
      if (!btn) continue;
      const sp = SPECIES[key];
      this.setButtonEnabled(btn, this.money >= sp.cost && !atCap,
        atCap ? "Tank full!" : sp.name);
    }
    // TURBO BUTTON REUSE — one button, three states. Before purchase it
    // buys Turbo ($200); after purchase the SAME button becomes the
    // Turbo Speed upgrade ($150); after the upgrade it shows
    // "Turbo ✓ MAX". buyTurboOrSpeed() picks the right action.
    this.setButtonEnabled(this.snailBtn,
      (!this.snail && this.money >= CONFIG.snailCost) ||
      (!!this.snail && !this.snailUpgraded && this.money >= CONFIG.snailSpeedCost),
      !this.snail ? "Turbo" : !this.snailUpgraded ? "Turbo Spd" : "Turbo ✓ MAX");
    this.setButtonEnabled(this.crabBtn, !this.crab && this.money >= CONFIG.crabCost,
      this.crab ? "Claws ✓" : "Claws");
    this.setButtonEnabled(this.tankBtn, !this.tankUpgraded && this.money >= CONFIG.tankUpgradeCost,
      this.tankUpgraded ? "Tank ✓" : "Tank");
    this.setButtonEnabled(this.speedBtn, true, this.speedMult === 2 ? "2x: ON" : "2x Speed");
    // Feeder — buy once, then the same button toggles it ON/OFF. It is
    // always clickable when owned (toggling is free); before that it is
    // only clickable when you can afford it.
    this.setButtonEnabled(this.feederBtn, this.feederOwned || this.money >= CONFIG.feederCost,
      !this.feederOwned ? "Feeder" : this.feederOn ? "Feeder: ON" : "Feeder: OFF");
    this.setButtonSelected(this.foodStdBtn, this.foodType === "standard");
    this.setButtonSelected(this.foodDeluxeBtn, this.foodType === "deluxe");
    // Decor: one shared button. It stays clickable (it opens the panel,
    // which is free to look at) as long as anything is left to buy; it
    // shows "Decor ✓" once all three are owned.
    const decorCosts = { coral: CONFIG.coralCost, chest: CONFIG.chestCost, castle: CONFIG.castleCost };
    const unowned = ["coral", "chest", "castle"].filter((k) => !this.decorations[k]);
    const cheapest = unowned.length ? Math.min(...unowned.map((k) => decorCosts[k])) : Infinity;
    const allDecorOwned = unowned.length === 0;
    this.setButtonEnabled(this.decorBtn, !allDecorOwned && this.money >= cheapest,
      allDecorOwned ? "Decor ✓" : "Decor");
    // Magnet chain: one button, four levels. The label carries the level
    // AND the next cost (see magnetLabel); the button greys out when the
    // next level is unaffordable, and shows "Magnet ✓ MAX" at L4.
    const nextCost = magnetLevelCost(this.magnetLevel);
    this.setButtonEnabled(this.magnetBtn, nextCost !== null && this.money >= nextCost,
      this.magnetLabel());
    this.updateSellButton();
  },

  // Sell button styling lives here, not in setButtonEnabled, because it
  // changes while a fish is being dragged: green + price when a fish is
  // over it, red "Sell" otherwise. Clicking it alone never sells
  // anything — only a drop does.
  updateSellButton() {
    if (!this.sellBtn) return;
    if (this.dragFish) {
      const price = sellPriceForStage(this.dragFish.stage, this.dragFish.species);
      const over = this._dragOverSell || false;
      this.sellBtn.bg.setFillStyle(over ? 0x2ecc71 : 0xe85d3d, 1);
      this.sellBtn.text.setColor("#ffffff");
      this.sellBtn.text.setText("Sell " + moneyFmt(price));
    } else {
      this.sellBtn.bg.setFillStyle(0xe85d3d, 1);
      this.sellBtn.text.setColor("#ffffff");
      this.sellBtn.text.setText("Sell");
    }
  },

  // Fish cap is 16, or 28 after the tank upgrade.
  maxFishCap() { return this.tankUpgraded ? CONFIG.maxFishUpgraded : CONFIG.maxFish; },

  updateTopUI() {
    // Money is a float with cents — "$12" when whole, "$12.35" when
    // there are cents (moneyFmt).
    this.moneyText.setText(moneyFmt(this.money));
    this.fishText.setText("Fish: " + this.fish.length + " / " + this.maxFishCap());
    this.emptyText.setVisible(this.fish.length === 0 && this.started);
  },

  // Goal progress line in the top bar. After the goal is complete it
  // shows a checkmark instead of the counters.
  updateGoalUI() {
    if (this.goalComplete) {
      this.goalText.setText("Goal ✓ Complete");
      return;
    }
    const large = countLargeFish(this.fish);
    this.goalText.setText("Goal: " + moneyFmt(this.totalBanked) + " / " + moneyFmt(CONFIG.goalBankTarget) +
      "  •  Large: " + large + "/" + CONFIG.goalLargeTarget);
  },

  // Show the "Goal met!" popup and freeze the game. Called from
  // update() the moment both conditions are true at once.
  showGoalPopup() {
    this.goalPopupShown = true;
    this.paused = true;
    this.pausedText.setVisible(false);
    this.goalPopup.setVisible(true);
    sfx.buy();
  },

  // "Continue as is" — close the popup, resume, goal stays complete.
  // goalPopupShown must be cleared here: while it is set, the pointer
  // dispatcher ignores every click in the tank.
  closeGoalPopup() {
    this.goalPopup.setVisible(false);
    this.goalComplete = true;
    this.goalPopupShown = false;
    this.paused = false;
    this.updateGoalUI();
    sfx.pop();
  },

  // "Restart / Clear Tank" — back to the start, everything wiped.
  resetTank() {
    for (const fish of this.fish) { fish.sprite.destroy(); if (fish.tail) fish.tail.destroy(); }
    for (const pellet of this.pellets) pellet.sprite.destroy();
    for (const coin of this.coins) coin.container.destroy();
    if (this.snail) this.snail.sprite.destroy();
    if (this.crab) this.crab.sprite.destroy();
    for (const pair of this.breedingPairs) this.destroyHearts(pair);
    for (const egg of this.eggs) egg.sprite.destroy();
    if (this.feederBot) { this.feederBot.sprite.destroy(); if (this.feederBot.light) this.feederBot.light.destroy(); }
    this.fish = [];
    this.pellets = [];
    this.coins = [];
    this.snail = null;
    this.crab = null;
    this.breedingPairs = [];
    this.eggs = [];
    this.feederBot = null;
    this.money = CONFIG.startMoney;
    this.totalBanked = 0;
    this.foodType = "standard";
    this.snailUpgraded = false;
    this.decorations = { coral: false, chest: false, castle: false };
    Object.values(this.decorSprites).forEach((g) => g.setVisible(false));
    this.tankUpgraded = false;
    this.speedMult = 1;
    this.goalComplete = false;
    this.goalPopupShown = false;
    this.goalPopup.setVisible(false);
    this.paused = false;
    this.feederOwned = false;
    this.feederOn = false;
    this.feederTimer = 0;
    this.magnetLevel = 0;
    this.magnetOwned = false;
    this.closeDecorPanel();
    this.pointerSeen = false;
    this.dragFish = null;
    this.dragActive = false;
    this._dragOverSell = false;
    this.feedHold = false;
    this.feedHoldTimer = 0;
    this._chomperToastShown = false;
    for (let i = 0; i < CONFIG.startFish; i++) this.spawnFish(300 + i * 360, 200 + i * 60);
    this.toast("Fresh tank! $200 and 2 small guppies.");
    this.updateShopUI();
    this.updateTopUI();
    this.updateGoalUI();
  },

  toast(msg, ms) {
    this.toastText.setText(msg).setVisible(true);
    if (this._toastTimer) this._toastTimer.remove();
    this._toastTimer = this.time.delayedCall(ms || 2200, () => this.toastText.setVisible(false));
  },
};
