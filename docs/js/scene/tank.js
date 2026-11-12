// scene/tank.js — the one Phaser scene.
//
// create() builds the tank once. update(time, delta) is the GAME LOOP,
// called ~60x/second: it is now a thin ORCHESTRATOR that calls one
// method per system, in the original order — bubbles, feeder drop,
// pellets, fish, hunting, breeding, eggs, separation, coins, magnet
// drag, snail, crab, feeder movement, goal check. All timers use
// `delta` (ms since last frame) so P-pause freezes everything cleanly:
// when paused, update() returns early and no timer advances.
//
// The systems themselves live in mixin files (ui / shop / fish /
// creatures / feeding / coins / lifecycle / input) attached to
// TankScene.prototype at the bottom of this file.

import { CONFIG, SPECIES, SPECIES_ORDER, SHOP, SHOP_COL_X, DESC_BAR, DESC_DEFAULT_TEXT } from "../config.js";
import { goalIsMet, countLargeFish } from "../economy.js";
import { sfx } from "../sound.js";
import {
  makeFishBodyTexture, makeFishTailTexture, makeCoinTexture, makeSnailTexture,
  makePelletTexture, makeDeluxePelletTexture, makeCrabTexture, makeFeederBotTexture,
  makeBotLightTexture, makeEggTexture,
} from "../textures.js";
import { uiMixin } from "./ui.js";
import { shopMixin } from "./shop.js";
import { fishMixin } from "./fish.js";
import { creaturesMixin } from "./creatures.js";
import { feedingMixin } from "./feeding.js";
import { coinsMixin } from "./coins.js";
import { lifecycleMixin } from "./lifecycle.js";
import { inputMixin } from "./input.js";

export class TankScene extends Phaser.Scene {
  constructor() {
    super("TankScene");
    this.money = CONFIG.startMoney;
    this.fish = [];      // { sprite, stage, feeds, hungerSec, coinTimer, ... }
    this.pellets = [];   // { sprite, vy }
    this.coins = [];     // { container, img, value, vy, bottomSec, fading }
    this.bubbles = [];
    this.snail = null;   // { sprite, targetCoin } once bought
    this.crab = null;    // { sprite, targetCoin } once bought
    this.started = false;
    this.paused = false;
    this.bubbleTimer = 0;
    this.plants = [];
    // All of this state resets on Restart / Clear Tank, and none of it
    // is saved anywhere (no localStorage, by design).
    this.totalBanked = 0;        // lifetime $ collected this session
    this.foodType = "standard";  // "standard" ($2, 1 feed) or "deluxe" ($5, 2 feeds)
    this.snailUpgraded = false;  // Turbo Speed Upgrade bought?
    this.decorations = { coral: false, chest: false, castle: false };
    this.decorSprites = {};      // coral/chest/castle Graphics, hidden until bought
    this.tankUpgraded = false;   // fish cap 16 -> 28
    this.speedMult = 1;          // 1 or 2 (2x toggle)
    this.goalComplete = false;
    this.goalPopupShown = false;
    this.goalPopup = null;
    this.feederOwned = false;    // feeder-bot bought? ($400, once)
    this.feederOn = false;       // feeder-bot toggle (only when owned)
    this.feederTimer = 0;        // seconds since the last auto pellet
    // MAGNET CHAIN: magnetLevel 0 = not owned, 1-4 = the chain levels
    // (see magnet.js). magnetOwned is kept in sync (level > 0).
    this.magnetLevel = 0;
    this.magnetOwned = false;
    // POINTER: the magnet drag/hover needs the last known pointer
    // position even between move events. pointerSeen stays false until
    // the player actually moves the pointer, so the drag never vacuums
    // coins toward a made-up default spot.
    this.pointerX = 480;
    this.pointerY = 200;
    this.pointerSeen = false;
    // HOLD-TO-FEED: while the pointer is held down over open water,
    // dropFood fires on a fixed cadence (see updateFeedHold). Set by
    // onPointerDown's water branch, cleared by onPointerUp.
    this.feedHold = false;
    this.feedHoldTimer = 0;
    this.feederBot = null;       // { sprite, light, targetX, targetY, wanderTimer } once bought
    // BREEDING state. breedingPairs: [{ a, b, heartsSec, hearts: [text, text] }]
    // while a pair swims together; eggs: [{ sprite, species, waitSec }]
    // while an egg sits on the floor waiting to hatch.
    this.breedingPairs = [];
    this.eggs = [];
    // PREDATION: the first-eat toast fires once per session.
    this._chomperToastShown = false;
    // DESCRIPTION BAR: one fixed strip (see showDescText /
    // resetDescText), always visible, never moving. Built once here.
    this.descBar = null;
    this.descBarText = null;
    // DECOR PANEL: built on demand when the Decor button is clicked,
    // DESTROYED on close — never merely hidden — so a closed panel can
    // never block fish clicks. decorPanelBounds is its hit rect while
    // open (used by onPointerDown to swallow clicks on the panel).
    this.decorPanel = null;
    this.decorPanelBounds = null;
    // POINTER DISPATCHER state — one active pointer action.
    this.dragFish = null;      // fish being poked / grabbed, or null
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragStartTime = 0;
    this.dragActive = false;   // true once moved >8px (a grab, not a poke)
  }

  create() {
    // --- Water: a vertical gradient (light at the top, deep at the bottom).
    const water = this.add.graphics();
    water.fillGradientStyle(0x7fd4e8, 0x7fd4e8, 0x1e7fa8, 0x1e7fa8, 1);
    water.fillRect(0, 0, CONFIG.width, CONFIG.waterBottom);
    // Light rays from the surface.
    water.fillStyle(0xffffff, 0.08);
    for (let i = 0; i < 5; i++) {
      water.fillTriangle(120 + i * 170, 0, 180 + i * 170, 0, 90 + i * 170, 300);
    }

    // --- Sand + rocks on the tank floor.
    const sand = this.add.graphics();
    sand.fillStyle(0xe8d29a, 1);
    sand.fillEllipse(480, CONFIG.waterBottom + 6, 980, 44);
    sand.fillStyle(0xd9bd7d, 1);
    for (let i = 0; i < 40; i++) {
      sand.fillCircle(20 + Math.random() * 920, CONFIG.waterBottom - 12 + Math.random() * 18, 2);
    }
    sand.fillStyle(0x8a8f98, 1);
    sand.fillEllipse(120, CONFIG.waterBottom - 8, 70, 26);
    sand.fillEllipse(850, CONFIG.waterBottom - 6, 90, 22);

    // --- Plants (static). Two clumps, drawn as wavy blades.
    this.plants = [];
    const plantSpots = [60, 210, 760, 900];
    plantSpots.forEach((x, i) => {
      const g = this.add.graphics();
      g.fillStyle(i % 2 ? 0x3fae6a : 0x2f9e5f, 1);
      for (let b = -1; b <= 1; b++) {
        g.fillTriangle(x + b * 10, CONFIG.waterBottom, x + b * 10 + 14, CONFIG.waterBottom - 70 - i * 6, x + b * 10 + 26, CONFIG.waterBottom);
      }
      this.plants.push(g);
    });

    // --- Textures (drawn once, reused by every sprite). One body/tail
    //     texture per species per stage (the starfish gets a star body
    //     and NO tail — see makeFishBodyTexture).
    for (const key of SPECIES_ORDER) {
      const sp = SPECIES[key];
      for (let s = 0; s < 3; s++) {
        makeFishBodyTexture(this, s, sp.key);
        if (sp.hasTail) makeFishTailTexture(this, s, sp.key);
      }
    }
    for (let s = 0; s < 3; s++) makeCoinTexture(this, s);
    makeSnailTexture(this);
    makeCrabTexture(this);
    makePelletTexture(this);
    makeDeluxePelletTexture(this);
    makeFeederBotTexture(this);
    makeBotLightTexture(this);
    makeEggTexture(this);

    // --- Decorations: drawn once, hidden until bought. Depth 2 —
    //     behind the fish (depth 5) so fish swim in front of them.
    //     Coral (left), Treasure Chest (right), Castle (centre-back).
    const coral = this.add.graphics().setDepth(2).setVisible(false);
    coral.fillStyle(0xff6b9d, 1);
    coral.fillTriangle(150, 452, 138, 400, 162, 452);
    coral.fillTriangle(168, 452, 162, 388, 180, 452);
    coral.fillStyle(0xff9ec4, 1);
    coral.fillCircle(150, 396, 7);
    coral.fillCircle(172, 384, 6);
    const chest = this.add.graphics().setDepth(2).setVisible(false);
    chest.fillStyle(0x7a4a21, 1);
    chest.fillRect(800, 428, 56, 26);
    chest.fillStyle(0x9a6a35, 1);
    chest.fillRect(800, 420, 56, 12);
    chest.fillStyle(0xffd23f, 1);
    chest.fillRect(824, 432, 8, 10);
    chest.fillCircle(812, 420, 4);
    chest.fillCircle(836, 418, 4);
    const castle = this.add.graphics().setDepth(1).setVisible(false);
    castle.fillStyle(0x9aa5b1, 1);
    castle.fillRect(440, 380, 80, 74);
    castle.fillRect(428, 350, 24, 104);
    castle.fillRect(488, 350, 24, 104);
    castle.fillStyle(0x7a8a99, 1);
    castle.fillTriangle(428, 350, 452, 326, 452, 350);
    castle.fillTriangle(488, 350, 512, 326, 512, 350);
    castle.fillStyle(0x12394d, 1);
    castle.fillRect(472, 420, 16, 34);
    this.decorSprites = { coral, chest, castle };

    // --- Top bar: money + fish count + goal (a dark pill so text
    //     reads over the bright water).
    this.add.rectangle(0, 0, CONFIG.width, 36, 0x0b2a3a, 0.55).setOrigin(0, 0);
    this.moneyText = this.add.text(14, 8, "", { fontSize: "20px", color: "#ffe27a", fontStyle: "bold" });
    this.fishText = this.add.text(200, 10, "", { fontSize: "16px", color: "#eaf6ff" });
    this.goalText = this.add.text(360, 10, "", { fontSize: "14px", color: "#ffe27a" });
    this.toastText = this.add.text(480, 60, "", { fontSize: "18px", color: "#ffffff", fontStyle: "bold", backgroundColor: "#0b2a3acc", padding: { x: 10, y: 6 } }).setOrigin(0.5, 0).setVisible(false).setDepth(10);
    this.emptyText = this.add.text(480, 200, "Tank is empty!\nBuy a guppy below to keep going.", { fontSize: "24px", color: "#ffffff", align: "center", backgroundColor: "#0b2a3acc", padding: { x: 16, y: 12 } }).setOrigin(0.5, 0).setVisible(false).setDepth(10);
    this.pausedText = this.add.text(480, 200, "Paused — press P to resume", { fontSize: "26px", color: "#ffffff", backgroundColor: "#0b2a3acc", padding: { x: 16, y: 12 } }).setOrigin(0.5, 0).setVisible(false).setDepth(10);

    // --- Shop bar (bottom, y 460..540): a 9-column grid, two rows of
    //     compact buttons (100x30, Magnet wide at 206px spanning cols
    //     7-8). Column centres are SHOP_COL_X(i) = 53.3 + i*106.7.
    //     Every button has a small icon glyph + a SHORT label; the long
    //     text (what it does, price, current state) lives in the FIXED
    //     description bar just above the buttons.
    //     Row 1: the 4 species + Turbo + Claws + Feeder + Magnet.
    //     Row 2: food Std/Dlx + Decor + Tank + 2x Speed + Sell.
    //     Sell is a DROP ZONE, not a purchase — clicking it alone does
    //     nothing; drag a fish onto it to sell. Decor opens a panel
    //     above the shop (see toggleDecorPanel) instead of buying
    //     directly.
    this.add.rectangle(0, CONFIG.waterBottom, CONFIG.width, CONFIG.height - CONFIG.waterBottom, 0x12394d, 1).setOrigin(0, 0);
    const col = (i) => SHOP_COL_X(i);
    const R1 = SHOP.row1Y, R2 = SHOP.row2Y, BW = SHOP.btnW, BH = SHOP.btnH;
    // Row 1 (y = 478): species + helpers + automation.
    this.guppyBtn = this.makeShopButton(col(0), R1, BW, BH, "Guppy", () => this.buyFish("guppy"), "🐟",
      () => "Guppy — $100. Coins $1/$5/$10 every ~8s. Grows at 3/6 feeds.");
    this.emberfinBtn = this.makeShopButton(col(1), R1, BW, BH, "Emberfin", () => this.buyFish("emberfin"), "🔥",
      () => "Emberfin — $250. Fast fiery fish, coins $1/$5/$9 every ~6s.");
    this.chomperBtn = this.makeShopButton(col(2), R1, BW, BH, "Chomper", () => this.buyFish("chomper"), "🟣",
      () => "Chomper — $400. Slow, grows at 4/8 feeds, big coins $3/$10/$20.");
    this.starfishBtn = this.makeShopButton(col(3), R1, BW, BH, "Starfish", () => this.buyFish("starfish"), "⭐",
      () => "Starfish — $300. Slow, swims low, coins $2/$6/$12 every ~12s.");
    this.snailBtn = this.makeShopButton(col(4), R1, BW, BH, "Turbo", () => this.buyTurboOrSpeed(), "🐌",
      () => !this.snail ? "Turbo the snail — $200. Crawls the floor collecting landed coins."
        : !this.snailUpgraded ? "Turbo Speed — $150. Turbo crawls 60 → 90 px/s."
        : "Turbo ✓ MAX — 90 px/s, collecting landed coins.");
    this.crabBtn = this.makeShopButton(col(5), R1, BW, BH, "Claws", () => this.buyCrab(), "🦀",
      () => this.crab ? "Claws ✓ on duty — grabs coins while they sink." : "Claws the crab — $300. Grabs coins while they sink.");
    this.feederBtn = this.makeShopButton(col(6), R1, BW, BH, "Feeder", () => this.buyOrToggleFeeder(), "🤖",
      () => !this.feederOwned ? "Feeder-bot — $400. A robot pet that drops a $2 pellet every 15s."
        : this.feederOn ? "Feeder-bot: ON — drops a $2 pellet every 15s. Click to turn OFF."
        : "Feeder-bot: OFF — click to turn it back ON.");
    // MAGNET: one wide button spanning cols 7-8 (centre x = slotW * 8,
    // width 206) — its label carries the level AND the next cost, e.g.
    // "Magnet L1 · $400".
    this.magnetBtn = this.makeShopButton(SHOP.slotW * 8, R1, BW * 2 + 6, BH, "Magnet $250", () => this.buyMagnet(), "🧲",
      () => this.magnetTip());
    // Row 2 (y = 514): food selector + decor + tank + speed + sell.
    this.foodStdBtn = this.makeShopButton(col(0), R2, BW, BH, "Std $2", () => this.selectFood("standard"), "🍤",
      () => "Standard food — $2 per pellet, 1 feed. Click water to drop it.");
    this.foodDeluxeBtn = this.makeShopButton(col(1), R2, BW, BH, "Dlx $5", () => this.selectFood("deluxe"), "✨",
      () => "Deluxe food — $5 per pellet, 2 feeds. The fish glows gold when it eats one.");
    this.decorBtn = this.makeShopButton(col(2), R2, BW, BH, "Decor", () => this.toggleDecorPanel(), "🪸",
      () => this.decorTip());
    this.tankBtn = this.makeShopButton(col(3), R2, BW, BH, "Tank", () => this.buyTankUpgrade(), "🐠",
      () => this.tankUpgraded ? "Tank ✓ upgraded — cap 28 fish." : "Tank Upgrade — $200. Fish cap 16 → 28.");
    this.speedBtn = this.makeShopButton(col(4), R2, BW, BH, "2x Speed", () => this.toggleSpeed(), "⚡",
      () => this.speedMult === 2 ? "2x Speed: ON — everything runs twice as fast, hunger included." : "2x Speed: OFF — click for double speed (hunger ticks twice as fast too).");
    this.sellBtn = this.makeShopButton(col(5), R2, BW, BH, "Sell", () => this.toast("Drag a fish onto Sell to sell it — prices depend on species and size."), "💲",
      () => "Sell — drag a fish here to sell it. Guppy $50/$100/$150, Emberfin $125/$200/$300, Chomper $200/$350/$500, Starfish $150/$250/$350.");

    // --- DESCRIPTION BAR: one fixed strip, built once, ALWAYS visible,
    //     never moving. It overlaps only the very bottom of the water
    //     and never touches a button. Hovering a shop button writes
    //     that button's description here (showDescText); pointerout
    //     restores the default hint (resetDescText).
    this.descBar = this.add.container(480, DESC_BAR.y).setDepth(15).setVisible(true);
    const descBg = this.add.rectangle(0, 0, 944, DESC_BAR.h, 0x0b2a3a, 0.85);
    this.descBarText = this.add.text(0, 0, DESC_DEFAULT_TEXT, { fontSize: "12px", color: "#eaf6ff", align: "center" }).setOrigin(0.5, 0.5);
    this.descBar.add([descBg, this.descBarText]);

    // --- INPUT: one scene-level pointer dispatcher (see input.js).
    //     There is NO food-zone handler and NO coin / fish pointerdown
    //     handler — every pointer event goes through
    //     resolvePointerTarget() exactly once and runs exactly one
    //     branch. Shop buttons keep their own handlers, but they live
    //     at y >= 460 (below the water), and the dispatcher returns
    //     early for those.
    this.input.on("pointerdown", (pointer) => this.onPointerDown(pointer));
    this.input.on("pointermove", (pointer) => this.onPointerMove(pointer));
    this.input.on("pointerup", (pointer) => this.onPointerUp(pointer));
    // If the pointer is released outside the canvas, the fish must
    // still be released — otherwise it would stay grabbed forever.
    this.input.on("pointerupoutside", (pointer) => this.onPointerUp(pointer));

    // --- P = pause. Not while the goal popup is open — the popup has
    //     its own buttons, and unpausing behind it would let the game
    //     run while the player is still deciding.
    this.input.keyboard.on("keydown-P", () => {
      if (!this.started) return;
      if (this.goalPopupShown && !this.goalComplete) return;
      this.paused = !this.paused;
      this.pausedText.setVisible(this.paused);
      if (this.paused) this.resetDescText();
    });

    // --- Starting fish.
    for (let i = 0; i < CONFIG.startFish; i++) this.spawnFish(300 + i * 360, 200 + i * 60);

    // --- Start overlay: the game only runs after the player clicks
    //     Start, so the hunger timers don't tick away while they're
    //     reading.
    this.startOverlay = this.add.container(0, 0);
    const shade = this.add.rectangle(0, 0, CONFIG.width, CONFIG.height, 0x0b2a3a, 0.72).setOrigin(0, 0);
    const title = this.add.text(480, 130, "Coinfish Cove", { fontSize: "52px", color: "#ffe27a", fontStyle: "bold" }).setOrigin(0.5, 0);
    const howto = this.add.text(480, 210,
      "Buy fish. Feed them. Collect the coins they drop.\n\n" +
      "• Click in the water to drop food — Standard $2 (1 feed), Deluxe $5 (2 feeds); hold the click to keep feeding\n" +
      "• Fish grow after 3 feeds, then 6 — bigger fish drop bigger coins\n" +
      "  (Chomper grows slower, at 4 and 8 feeds)\n" +
      "• New fish: Emberfin $250 (fast), Chomper $400 (big coins),\n" +
      "  Starfish $300 (swims low) — hover any shop button for details\n" +
      "• Two LARGE fish of the same species, both recently fed, will\n" +
      "  breed — hearts, then an egg hatches into a baby fish!\n" +
      "• Click coins before they fade on the floor (10s)\n" +
      "• Hungry fish go pale and stop dropping coins — feed them!\n" +
      "• Save $200 for Turbo the snail, $300 for Claws the crab,\n" +
      "  $400 for the feeder-bot (it drops food for you)\n" +
      "• Tap a fish to poke it, drag a fish to move it — drag it onto\n" +
      "  Sell to sell it (price depends on species and size)\n" +
      "• GOAL: bank $1,000 total and own 3 large fish",
      { fontSize: "18px", color: "#eaf6ff", align: "center", lineSpacing: 8 }).setOrigin(0.5, 0);
    const startBtn = this.add.rectangle(480, 430, 220, 56, 0xffd23f, 1).setInteractive({ useHandCursor: true });
    const startLabel = this.add.text(480, 430, "Start", { fontSize: "24px", color: "#12394d", fontStyle: "bold" }).setOrigin(0.5, 0.5);
    startBtn.on("pointerdown", () => {
      this.started = true;
      this.startOverlay.destroy();
      sfx.pop();
    });
    this.startOverlay.add([shade, title, howto, startBtn, startLabel]);

    // --- Goal popup: hidden until the goal is met. Built once here,
    //     shown/hidden by showGoalPopup() / closeGoalPopup(). It pauses
    //     the game while it is open (see update()).
    this.goalPopup = this.add.container(0, 0).setDepth(20).setVisible(false);
    const gShade = this.add.rectangle(0, 0, CONFIG.width, CONFIG.height, 0x0b2a3a, 0.72).setOrigin(0, 0);
    const gPanel = this.add.rectangle(480, 270, 520, 220, 0x12394d, 1).setStrokeStyle(3, 0xffd23f);
    const gTitle = this.add.text(480, 190, "Goal met!", { fontSize: "36px", color: "#ffe27a", fontStyle: "bold" }).setOrigin(0.5, 0);
    const gBody = this.add.text(480, 250, "You banked $1,000 and own 3 large fish!", { fontSize: "18px", color: "#eaf6ff", align: "center" }).setOrigin(0.5, 0);
    const gRestartBg = this.add.rectangle(370, 330, 200, 48, 0xffd23f, 1).setInteractive({ useHandCursor: true });
    const gRestartLabel = this.add.text(370, 330, "Restart / Clear Tank", { fontSize: "16px", color: "#12394d", fontStyle: "bold" }).setOrigin(0.5, 0.5);
    const gContinueBg = this.add.rectangle(590, 330, 200, 48, 0x2a5a75, 1).setInteractive({ useHandCursor: true });
    const gContinueLabel = this.add.text(590, 330, "Continue as is", { fontSize: "16px", color: "#eaf6ff", fontStyle: "bold" }).setOrigin(0.5, 0.5);
    gRestartBg.on("pointerdown", () => this.resetTank());
    gContinueBg.on("pointerdown", () => this.closeGoalPopup());
    this.goalPopup.add([gShade, gPanel, gTitle, gBody, gRestartBg, gRestartLabel, gContinueBg, gContinueLabel]);

    this.updateShopUI();
    this.updateTopUI();
    this.updateGoalUI();
  }

  // --- The game loop ---------------------------------------------------------
  update(time, delta) {
    if (!this.started || this.paused) return;
    // 2x speed multiplies every dt-based timer in this loop — hunger,
    // coins, fish movement, snail/crab — so it is not a free win.
    const dt = (delta / 1000) * this.speedMult; // seconds this frame

    this.updateBubbles(dt, time);
    this.updateFeedHold(dt);
    this.updateFeederDrop(dt);
    this.updatePellets(dt);
    this.updateFish(dt);
    this.updateHunting();
    this.updateBreeding(dt);
    this.updateEggs(dt);
    this.updateSeparation(dt);
    this.updateCoins(dt, time);
    this.updateMagnetDrag(dt);
    this.updateSnail(dt);
    this.updateCrab(dt);
    this.updateFeederBot(dt);

    // Goal check — once per frame, only while the goal is still open
    // and the popup isn't already up. Both conditions must hold at the
    // same moment; a large fish dying afterwards does not re-trigger
    // it (goalComplete / goalPopupShown guard that).
    if (!this.goalComplete && !this.goalPopupShown &&
        goalIsMet(this.totalBanked, countLargeFish(this.fish))) {
      this.showGoalPopup();
    }
  }
}

// Attach the system mixins. Plain Object.assign of method maps keeps
// every `this`-style method exactly as written in its own file.
Object.assign(TankScene.prototype,
  uiMixin,
  shopMixin,
  fishMixin,
  creaturesMixin,
  feedingMixin,
  coinsMixin,
  lifecycleMixin,
  inputMixin,
);
