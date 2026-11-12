// scene/shop.js — TankScene mixin: everything the shop buttons DO.
// Purchase handlers, the decor panel, the magnet label/tip, selling a
// fish, the food selector, and the 2x speed toggle.

import { CONFIG, speciesDef, DECOR_PANEL } from "../config.js";
import { moneyFmt, addMoney, decorCount, coinValueForStage, coinValueWithBonus, sellPriceForStage } from "../economy.js";
import { MAGNET_LEVELS, magnetLevelCost } from "../magnet.js";
import { sfx } from "../sound.js";

const DECOR_NAMES = { coral: "Coral", chest: "Treasure Chest", castle: "Castle" };
const DECOR_TIP_NAMES = { coral: "Coral", chest: "Treasure", castle: "Castle" };

export const shopMixin = {
  // Buy any species. Same rules for all: enough money and room under
  // the shared fish cap (all species count together).
  buyFish(speciesKey) {
    const sp = speciesDef(speciesKey);
    if (this.money < sp.cost || this.fish.length >= this.maxFishCap()) { sfx.denied(); return; }
    this.money -= sp.cost;
    const x = 480 + (Math.random() * 200 - 100);
    // Starfish prefer the bottom third from the moment they arrive.
    const y = sp.swimLow ? 320 + Math.random() * 80 : 150 + Math.random() * 150;
    this.spawnFish(x, y, sp.key);
    sfx.buy();
    this.toast("Bought a " + sp.name + " for " + moneyFmt(sp.cost) + "!");
    this.updateShopUI();
    this.updateTopUI();
  },

  // The merged Turbo button handler. No Turbo yet -> buy him. Turbo
  // owned but not upgraded -> buy the speed upgrade. Already upgraded
  // -> nothing left to buy (the button is disabled, so this is only
  // reachable in edge cases).
  buyTurboOrSpeed() {
    if (!this.snail) { this.buySnail(); return; }
    if (!this.snailUpgraded) { this.buySnailSpeed(); return; }
    sfx.denied();
  },

  buySnail() {
    if (this.snail || this.money < CONFIG.snailCost) { sfx.denied(); return; }
    this.money -= CONFIG.snailCost;
    const sprite = this.add.image(120, CONFIG.floorY + 8, "snail").setScale(1);
    sprite.setDepth(4);
    this.snail = { sprite, targetCoin: null, bubbleTimer: 0, wanderX: 480 };
    sfx.buy();
    this.toast("Turbo is on duty! He collects coins that land on the floor.");
    this.updateShopUI();
    this.updateTopUI();
  },

  // Turbo Speed Upgrade — once only, and only after Turbo exists.
  // Speed is read live in update() from this.snailUpgraded.
  buySnailSpeed() {
    if (!this.snail || this.snailUpgraded || this.money < CONFIG.snailSpeedCost) { sfx.denied(); return; }
    this.money -= CONFIG.snailSpeedCost;
    this.snailUpgraded = true;
    sfx.buy();
    this.toast("Turbo upgraded! He now crawls at 90 px/s.");
    this.updateShopUI();
    this.updateTopUI();
  },

  // Claws the crab — the mid-water helper. Unlike Turbo he swims
  // (moves in 2D) and chases coins while they are still sinking.
  buyCrab() {
    if (this.crab || this.money < CONFIG.crabCost) { sfx.denied(); return; }
    this.money -= CONFIG.crabCost;
    const sprite = this.add.image(480, CONFIG.floorY, "crab").setScale(1);
    sprite.setDepth(4);
    this.crab = { sprite, targetCoin: null, wanderX: 480 };
    sfx.buy();
    this.toast("Claws is on duty! He grabs coins while they sink.");
    this.updateShopUI();
    this.updateTopUI();
  },

  // Food selector. Free to switch — the cost is paid per pellet when
  // you drop it. The highlight is updated by updateShopUI().
  selectFood(type) {
    this.foodType = type;
    sfx.pop();
    this.updateShopUI();
  },

  // Decorations — one of each, max. The bonus is +5% coin value each
  // (see coinValueWithBonus), and the decoration appears in the tank
  // the moment you buy it. The toast states the new multiplier AND a
  // concrete example, so the bonus is visible.
  // Bought from the decor PANEL (not a shop button) — the panel stays
  // open after a purchase (refreshDecorPanel rebuilds it), so the
  // player can buy another without re-opening it.
  buyDecoration(key, cost) {
    if (this.decorations[key] || this.money < cost) { sfx.denied(); return; }
    this.money -= cost;
    this.decorations[key] = true;
    if (this.decorSprites[key]) this.decorSprites[key].setVisible(true);
    sfx.buy();
    const n = decorCount(this.decorations);
    const example = coinValueWithBonus(10, n).toFixed(2);
    this.toast(DECOR_NAMES[key] + " placed! Coins now worth +" + (n * 5) + "% — a large guppy coin is now $" + example + ".");
    this.refreshDecorPanel();
    this.updateShopUI();
    this.updateTopUI();
  },

  decorTip() {
    const owned = ["coral", "chest", "castle"].filter((k) => this.decorations[k]).length;
    const ownedNames = ["coral", "chest", "castle"].filter((k) => this.decorations[k]).map((k) => DECOR_TIP_NAMES[k]).join(", ");
    return "Decorations — click to open the panel. Owned " + owned + "/3" +
      (ownedNames ? " (" + ownedNames + ")" : "") +
      " — Coins +" + (decorCount(this.decorations) * 5) + "% (max +15%).";
  },

  // DECOR PANEL — one shared "Decor" button opens it. The panel sits
  // above the shop buttons (DECOR_PANEL geometry), over the tank's
  // bottom edge, never over other buttons. It lists the three
  // decorations with icon + name + price + owned ✓ + the current total
  // bonus. Clicking a row buys/places that decoration and the panel
  // STAYS OPEN (refreshDecorPanel rebuilds it in place); Decor again,
  // or a click elsewhere in the tank, closes it (closeDecorPanel
  // DESTROYS it, so a closed panel can never block fish clicks).
  toggleDecorPanel() {
    if (this.decorPanel) { this.closeDecorPanel(); return; }
    this.openDecorPanel();
  },

  openDecorPanel() {
    if (this.decorPanel) return;
    const panel = this.add.container(DECOR_PANEL.cx, DECOR_PANEL.cy).setDepth(14);
    const bg = this.add.rectangle(0, 0, DECOR_PANEL.w, DECOR_PANEL.h, 0x0b2a3a, 0.95).setStrokeStyle(2, 0xffd23f);
    panel.add(bg);
    const bonus = decorCount(this.decorations) * 5;
    const header = this.add.text(0, -DECOR_PANEL.h / 2 + 12, "Decorations — Coins +" + bonus + "%", { fontSize: "13px", color: "#ffe27a", fontStyle: "bold" }).setOrigin(0.5, 0.5);
    panel.add(header);
    // Three rows: icon + name + price + owned ✓. Each row is its own
    // interactive rect, so clicking it buys that decoration.
    const rows = [
      { key: "coral", icon: "🪸", name: "Coral", cost: CONFIG.coralCost },
      { key: "chest", icon: "💰", name: "Treasure Chest", cost: CONFIG.chestCost },
      { key: "castle", icon: "🏰", name: "Castle", cost: CONFIG.castleCost },
    ];
    panel.rows = {};
    rows.forEach((row, i) => {
      const ry = -16 + i * 26;
      const owned = !!this.decorations[row.key];
      const rect = this.add.rectangle(0, ry, DECOR_PANEL.w - 20, 22, owned ? 0x2a5a75 : 0xffd23f, 1).setInteractive({ useHandCursor: true });
      const label = this.add.text(0, ry, row.icon + " " + row.name + " — $" + row.cost + (owned ? " ✓" : ""), { fontSize: "13px", color: owned ? "#cfeeff" : "#12394d", fontStyle: "bold" }).setOrigin(0.5, 0.5);
      rect.on("pointerdown", () => { if (this.started && !this.paused) this.buyDecoration(row.key, row.cost); });
      panel.add(rect);
      panel.add(label);
      panel.rows[row.key] = { rect, label };
    });
    this.decorPanel = panel;
    this.decorPanelBounds = {
      x0: DECOR_PANEL.cx - DECOR_PANEL.w / 2, x1: DECOR_PANEL.cx + DECOR_PANEL.w / 2,
      y0: DECOR_PANEL.cy - DECOR_PANEL.h / 2, y1: DECOR_PANEL.cy + DECOR_PANEL.h / 2,
    };
    sfx.pop();
  },

  closeDecorPanel() {
    if (!this.decorPanel) return;
    this.decorPanel.destroy();
    this.decorPanel = null;
    this.decorPanelBounds = null;
  },

  // Rebuild the open panel in place after a purchase, so the ✓ state
  // and the bonus header update without closing it. A closed panel
  // stays closed (nothing to rebuild).
  refreshDecorPanel() {
    if (!this.decorPanel) return;
    this.closeDecorPanel();
    this.openDecorPanel();
  },

  // Tank upgrade — once only, fish cap 16 -> 28.
  buyTankUpgrade() {
    if (this.tankUpgraded || this.money < CONFIG.tankUpgradeCost) { sfx.denied(); return; }
    this.money -= CONFIG.tankUpgradeCost;
    this.tankUpgraded = true;
    sfx.buy();
    this.toast("Tank upgraded! You can now keep 28 fish.");
    this.updateShopUI();
    this.updateTopUI();
  },

  // The feeder is a visible pet robot, not an invisible timer. Buying
  // it ($400) spawns the feeder-bot in the tank; the same button then
  // toggles it ON/OFF for free. When ON it drops a Standard pellet
  // every 15s AT the robot's position (see creatures.js). The robot
  // keeps its ON/OFF state and timer in feederOn/feederTimer, so 2x
  // speed still scales it.
  buyOrToggleFeeder() {
    if (!this.feederOwned) {
      if (this.money < CONFIG.feederCost) { sfx.denied(); return; }
      this.money -= CONFIG.feederCost;
      this.feederOwned = true;
      this.feederOn = true;
      this.feederTimer = 0;
      this.spawnFeederBot();
      sfx.buy();
      this.toast("Feeder-bot ON! It swims up top and drops a $2 pellet every 15s.");
    } else {
      this.feederOn = !this.feederOn;
      sfx.pop();
      this.toast(this.feederOn ? "Feeder-bot ON." : "Feeder-bot OFF.");
    }
    this.updateShopUI();
    this.updateTopUI();
  },

  // Coin Magnet is a 4-LEVEL CHAIN on one button. Each buy takes the
  // NEXT level (see magnet.js). Costs come from the float money
  // balance, like every other buy. After L4 the button shows
  // "Magnet ✓ MAX" and there is nothing left to buy.
  buyMagnet() {
    const cost = magnetLevelCost(this.magnetLevel);
    if (cost === null || this.money < cost) { sfx.denied(); return; }
    this.money -= cost;
    this.magnetLevel += 1;
    this.magnetOwned = this.magnetLevel > 0;
    sfx.buy();
    const level = MAGNET_LEVELS[this.magnetLevel - 1];
    const next = magnetLevelCost(this.magnetLevel);
    this.toast("Magnet L" + this.magnetLevel + " — " + level.name + "! " +
      (next !== null ? "Next: L" + (this.magnetLevel + 1) + " " + MAGNET_LEVELS[this.magnetLevel].name + " for $" + next + "." : "MAX — coins within 170px are pulled to your cursor."));
    this.updateShopUI();
    this.updateTopUI();
  },

  // The magnet button label — level AND next cost, e.g.
  // "Magnet L1 · $400". Before any purchase it shows the L1 cost
  // ("Magnet $250"); at MAX it shows "Magnet ✓ MAX".
  magnetLabel() {
    if (this.magnetLevel >= MAGNET_LEVELS.length) return "Magnet ✓ MAX";
    const next = magnetLevelCost(this.magnetLevel);
    if (this.magnetLevel === 0) return "Magnet $" + next;
    return "Magnet L" + this.magnetLevel + " · $" + next;
  },

  // The magnet description for the fixed bar — what the current level
  // does, plus the next level and its cost.
  magnetTip() {
    if (this.magnetLevel === 0) {
      return "Coin Magnet — $250. L1 Hover collect: hover over a coin to collect it (clicking still works).";
    }
    const cur = MAGNET_LEVELS[this.magnetLevel - 1];
    const next = magnetLevelCost(this.magnetLevel);
    if (next === null) {
      return "Magnet ✓ MAX — Drag 170: coins within 170px are gently pulled to your cursor and collected on touch.";
    }
    const nxt = MAGNET_LEVELS[this.magnetLevel];
    return "Magnet L" + this.magnetLevel + " — " + cur.name + ": " +
      (this.magnetLevel === 1
        ? "hover over a coin to collect it."
        : "coins within " + cur.radius + "px are pulled to your cursor.") +
      " Next: L" + (this.magnetLevel + 1) + " " + nxt.name + " — $" + next + ".";
  },

  // Sell a specific fish — only ever called from onPointerUp when a
  // grabbed fish is dropped inside the Sell button bounds. No confirm
  // popup: dragging onto Sell IS the deliberate choice.
  sellFish(fish) {
    if (!this.fish.includes(fish)) return;
    const price = sellPriceForStage(fish.stage, fish.species);
    const sp = speciesDef(fish.species);
    this.money = addMoney(this.money, price);
    this.floatText("+" + moneyFmt(price), fish.sprite.x, fish.sprite.y - 14, "#2ecc71");
    for (let i = 0; i < 5; i++) this.spawnBubble(fish.sprite.x, fish.sprite.y);
    fish.sprite.destroy();
    if (fish.tail) fish.tail.destroy();
    this.fish.splice(this.fish.indexOf(fish), 1);
    // A sold fish leaves its hearts pair too (see removeBreedPair).
    this.removeBreedPair(fish);
    sfx.coin();
    this.toast("Sold a " + (fish.stage === 2 ? "large" : fish.stage === 1 ? "medium" : "small") + " " + sp.name.toLowerCase() + " for " + moneyFmt(price) + ".");
    this.updateShopUI();
    this.updateTopUI();
    this.updateGoalUI();
  },

  // 2x speed toggle — free, and it speeds EVERYTHING (update()
  // multiplies dt by this.speedMult), hunger and coin timers included.
  toggleSpeed() {
    this.speedMult = this.speedMult === 2 ? 1 : 2;
    sfx.pop();
    this.toast(this.speedMult === 2 ? "2x speed ON — hunger ticks twice as fast too!" : "Back to normal speed.");
    this.updateShopUI();
  },
};
