// scene/savecode.js — TankScene mixin: IMPORT / EXPORT SAVE CODES.
//
// THE CODE IS THE SAVE. No localStorage, no cookies, no server —
// Export (pause menu) shows the current run as a short code, Import
// (title screen) pastes one back in. The codec itself is pure (see
// ../savecode.js); this file is the scene side: collecting the state,
// restoring it, and the two panels.
//
// UI: the code fields and the Copy / Load / Cancel buttons are real
// DOM elements (this.add.dom), not Phaser buttons, for two reasons:
//   1. Paste/select actually work — a 93-character code typed by
//      hand is nobody's idea of a save system, and a Phaser text
//      object cannot take pasted text.
//   2. DOM clicks never reach the Phaser pointer dispatcher. A
//      Phaser button that STARTS the game (like Load) would drop a
//      food pellet at its position — the same leak as the Resume
//      button — because the dispatcher runs after the button handler
//      unpauses/starts. DOM clicks never touch the canvas, so the
//      save UI cannot leak pellets. The two TRIGGER buttons (Export
//      in the pause menu, Import on the title screen) are Phaser
//      buttons and are safe: Export never unpauses, Import never
//      starts the game, so the dispatcher still returns early for
//      both clicks.
// DOM needs `dom: { createContainer: true }` in the game config (see
// main.js). In the headless tests there is no document and no
// add.dom, so the DOM parts are skipped — the panels still build as
// Phaser containers and the logic (exportSaveCode / importSaveCode)
// is fully testable there.

import { CONFIG, speciesDef } from "../config.js";
import { encodeSaveCode, decodeSaveCode } from "../savecode.js";
import { sfx } from "../sound.js";

export const SAVE_CODE_ERROR = "That code doesn't look right — check it and try again";

function domButton(label, gold) {
  const b = document.createElement("button");
  b.textContent = label;
  b.style.cssText = "box-sizing:border-box;width:120px;height:34px;font-size:15px;font-weight:bold;" +
    (gold
      ? "background:#ffd23f;color:#12394d;border:2px solid #8a6a1f;"
      : "background:#2a5a75;color:#eaf6ff;border:2px solid #8a6a1f;") +
    "border-radius:4px;cursor:pointer;";
  return b;
}

function domInput(readonly, placeholder) {
  const input = document.createElement("input");
  input.type = "text";
  if (readonly) input.readOnly = true;
  if (placeholder) input.placeholder = placeholder;
  input.spellcheck = false;
  input.autocomplete = "off";
  input.style.cssText = "box-sizing:border-box;width:500px;height:30px;font-size:14px;padding:2px 8px;" +
    "border:2px solid #ffd23f;background:#0b2a3a;color:#ffffff;border-radius:4px;outline:none;";
  return input;
}

// DOM LAYOUT — every save-code DOM element is anchored by its
// TOP-LEFT corner (setOrigin(0, 0)) and positioned in game
// coordinates, so the layout is exact at any FIT scale: the Phaser
// DOM container is scaled to the canvas, so a 500px field at game
// x=230 always spans 230..730 inside the 540-wide dialog, whether
// the canvas is 960px or 1919px wide. The previous layout centred
// the elements on their anchor (the default origin 0.5, 0.5), which
// only works if Phaser's one-time size measurement (updateSize, at
// creation) sees the real width — when it measures 0, the origin
// offset vanishes and the node lands with its top-left at the
// anchor instead: at 1919x998 the field started at the dialog's
// centre and ran ~400px past its right edge, and the buttons fell
// outside the box. Top-left anchoring does not depend on that
// measurement at all, and box-sizing:border-box above makes the CSS
// width the outer width, so the rects below are exact.

export const savecodeMixin = {
  // Build both panels once (called from create()). Hidden until used.
  // DOM parts are guarded — without a document / add.dom (headless
  // tests) the panels are Phaser-only and the code is shown as text.
  buildSaveCodeUI() {
    this._saveDom = typeof document !== "undefined" && typeof this.add.dom === "function";

    // --- EXPORT PANEL: floats over the pause menu (depth 25).
    const exp = this.add.container(480, 270).setDepth(25).setVisible(false);
    const expBg = this.add.rectangle(0, 0, 540, 170, 0x0b2a3a, 0.97).setStrokeStyle(3, 0xffd23f);
    const expTitle = this.add.text(0, -68, "Save Code", { fontSize: "20px", color: "#ffe27a", fontStyle: "bold" }).setOrigin(0.5, 0.5);
    const expHint = this.add.text(0, 62, "Copy it somewhere safe — the code IS your save. Paste it back on the title screen.", { fontSize: "12px", color: "#eaf6ff" }).setOrigin(0.5, 0.5);
    exp.add([expBg, expTitle, expHint]);
    // The code as Phaser text — the no-DOM fallback (hidden when the
    // selectable DOM input below exists, so the code never shows twice).
    const expCodeText = this.add.text(0, -20, "", { fontSize: "13px", color: "#ffffff", align: "center", wordWrap: { width: 500 } }).setOrigin(0.5, 0.5);
    exp.add(expCodeText);
    exp.codeText = expCodeText;
    this.exportPanel = exp;
    if (this._saveDom) {
      // Field: top-left (230, 232), 500 wide — spans 230..730 inside
      // the 210..750 dialog; buttons row below it, hint at y=332 clear.
      const inputEl = this.add.dom(230, 232, domInput(true)).setOrigin(0, 0).setVisible(false);
      exp.input = inputEl;
      const copyBtn = domButton("Copy", true);
      copyBtn.addEventListener("click", () => this.copySaveCode());
      exp.copyBtn = this.add.dom(350, 288, copyBtn).setOrigin(0, 0).setVisible(false);
      const closeBtn = domButton("Close", false);
      closeBtn.addEventListener("click", () => this.hideExportPanel());
      exp.closeBtn = this.add.dom(490, 288, closeBtn).setOrigin(0, 0).setVisible(false);
    }

    // --- IMPORT PANEL: over the title screen (depth 25). Its shade
    // is interactive, so clicks behind it cannot reach the Start
    // button underneath — Load or Cancel first.
    const imp = this.add.container(480, 270).setDepth(25).setVisible(false);
    const impShade = this.add.rectangle(0, 0, CONFIG.width, CONFIG.height, 0x0b2a3a, 0.72).setOrigin(0.5, 0.5).setInteractive();
    const impBg = this.add.rectangle(0, 0, 540, 220, 0x12394d, 1).setStrokeStyle(3, 0xffd23f);
    const impTitle = this.add.text(0, -92, "Import Save Code", { fontSize: "20px", color: "#ffe27a", fontStyle: "bold" }).setOrigin(0.5, 0.5);
    const impHint = this.add.text(0, 92, "A save code restores money, fish, helpers and upgrades.", { fontSize: "12px", color: "#eaf6ff" }).setOrigin(0.5, 0.5);
    const impError = this.add.text(0, 62, "", { fontSize: "13px", color: "#ff8a80", fontStyle: "bold" }).setOrigin(0.5, 0.5).setVisible(false);
    imp.add([impShade, impBg, impTitle, impHint, impError]);
    imp.errorText = impError;
    this.importPanel = imp;
    if (this._saveDom) {
      // Field: top-left (230, 208), 500 wide — spans 230..730 inside
      // the 210..750 dialog; buttons row below it, error line at y=332
      // and hint at y=362 both clear of the buttons (which end at 296).
      const inputEl = this.add.dom(230, 208, domInput(false, "Paste your save code here")).setOrigin(0, 0).setVisible(false);
      imp.input = inputEl;
      const loadBtn = domButton("Load", true);
      loadBtn.addEventListener("click", () => this.loadImportCode());
      imp.loadBtn = this.add.dom(350, 262, loadBtn).setOrigin(0, 0).setVisible(false);
      const cancelBtn = domButton("Cancel", false);
      cancelBtn.addEventListener("click", () => this.hideImportPanel());
      imp.cancelBtn = this.add.dom(490, 262, cancelBtn).setOrigin(0, 0).setVisible(false);
    }
  },

  // --- State collection / restore -------------------------------------------
  // Snapshot the whole run into the plain state object the codec eats.
  // Eggs are not saved as eggs — an egg in the tank loads as a hatched
  // stage-0 baby of its species (its inherited trait + royal gene are
  // already fixed at lay time, so they carry over; look and tempo are
  // fresh, exactly as a real hatch rolls them).
  collectSaveState() {
    const fish = this.fish.map((f) => ({
      species: f.species, feeds: f.feeds, hungerSec: f.hungerSec, tempo: f.tempo,
      trait: f.trait, pattern: f.pattern, hueTint: f.hueTint, hatKind: f.hatKind, royalGene: f.royalGene,
    }));
    for (const egg of this.eggs) {
      fish.push({ species: egg.species, feeds: 0, hungerSec: 0, tempo: 1.0, trait: egg.trait, pattern: "plain", hueTint: 0xffffff, hatKind: null, royalGene: egg.royalGene });
    }
    return {
      money: this.money, totalBanked: this.totalBanked, fish,
      snail: !!this.snail, snailUpgraded: !!this.snailUpgraded, crab: !!this.crab,
      feederOwned: !!this.feederOwned, feederOn: !!this.feederOn,
      magnetLevel: this.magnetLevel || 0,
      decorations: { coral: !!this.decorations.coral, chest: !!this.decorations.chest, castle: !!this.decorations.castle },
      tankUpgraded: !!this.tankUpgraded, foodType: this.foodType, goalComplete: !!this.goalComplete,
    };
  },

  // Restore a decoded state onto a fresh (title-screen) scene. Fish
  // spawn at random positions like Start does; the cap is NOT applied
  // here — a save is a restore, not a purchase — but buying and
  // breeding still obey it afterwards. Hunger resumes at the saved
  // hunger (no offline starvation). Pregnancy is not saved, so a
  // pregnant fish loads as not-pregnant; eggs already became babies
  // in collectSaveState. The event clock is re-armed by
  // startGameFromSave (first event 60-90s after load, as if a fresh
  // Start). The Uncap Fish toggle is session-only and is NOT restored.
  applySaveState(state) {
    this.money = state.money || 0;
    this.totalBanked = state.totalBanked || 0;
    for (const f of state.fish) {
      const sp = speciesDef(f.species);
      const x = 480 + (Math.random() * 200 - 100);
      const y = sp.swimLow ? 320 + Math.random() * 80 : 150 + Math.random() * 150;
      this.spawnFish(x, y, f.species, {
        trait: f.trait, royalGene: f.royalGene, pattern: f.pattern, hueTint: f.hueTint,
        hatKind: f.hatKind, feeds: f.feeds, hungerSec: f.hungerSec, tempo: f.tempo,
      });
    }
    // Helpers are rebuilt directly (no cost — a restore is not a buy).
    if (state.snail) {
      const sprite = this.add.image(120, CONFIG.floorY + 8, "snail").setScale(1);
      sprite.setDepth(4);
      this.snail = { sprite, targetCoin: null, bubbleTimer: 0, wanderX: 480 };
    }
    this.snailUpgraded = !!state.snailUpgraded;
    if (state.crab) {
      const sprite = this.add.image(480, CONFIG.floorY, "crab").setScale(1);
      sprite.setDepth(4);
      this.crab = { sprite, targetCoin: null, wanderX: 480 };
    }
    this.feederOwned = !!state.feederOwned;
    this.feederOn = !!state.feederOn;
    this.feederTimer = 0;
    if (this.feederOwned) this.spawnFeederBot();
    this.magnetLevel = state.magnetLevel || 0;
    this.magnetOwned = this.magnetLevel > 0;
    for (const key of ["coral", "chest", "castle"]) {
      this.decorations[key] = !!(state.decorations && state.decorations[key]);
      if (this.decorations[key] && this.decorSprites[key]) this.decorSprites[key].setVisible(true);
    }
    this.tankUpgraded = !!state.tankUpgraded;
    this.foodType = ["standard", "deluxe", "plant"].includes(state.foodType) ? state.foodType : "standard";
    this.goalComplete = !!state.goalComplete;
  },

  // --- Export ---------------------------------------------------------------
  // Encode the current run. Returns the code (or null when the tank
  // holds too many fish to encode) and remembers it for Copy.
  exportSaveCode() {
    const code = encodeSaveCode(this.collectSaveState());
    if (!code) {
      this.toast("Too many fish to fit in a save code — sell some first.");
      return null;
    }
    this._exportCode = code;
    return code;
  },

  showExportPanel() {
    if (!this.paused) return; // only from the pause menu
    const code = this.exportSaveCode();
    if (!code) return;
    this.exportPanel.codeText.setText(code);
    this.exportPanel.codeText.setVisible(!this._saveDom);
    if (this.exportPanel.input) {
      this.exportPanel.input.node.value = code;
      this.exportPanel.input.setVisible(true);
    }
    if (this.exportPanel.copyBtn) this.exportPanel.copyBtn.setVisible(true);
    if (this.exportPanel.closeBtn) this.exportPanel.closeBtn.setVisible(true);
    this.exportPanel.setVisible(true);
  },

  hideExportPanel() {
    if (!this.exportPanel) return;
    this.exportPanel.setVisible(false);
    if (this.exportPanel.input) this.exportPanel.input.setVisible(false);
    if (this.exportPanel.copyBtn) this.exportPanel.copyBtn.setVisible(false);
    if (this.exportPanel.closeBtn) this.exportPanel.closeBtn.setVisible(false);
  },

  // Copy the current code to the clipboard (from the button click, so
  // the browser allows it). Falls back to selecting the field so the
  // player can copy it by hand.
  copySaveCode() {
    const code = this._exportCode;
    if (!code) return;
    const done = () => this.toast("Save code copied!");
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        const p = navigator.clipboard.writeText(code);
        if (p && typeof p.then === "function") { p.then(done, () => this.copySaveCodeFallback()); return; }
        done();
        return;
      }
    } catch (e) { /* fall through to the fallback */ }
    this.copySaveCodeFallback();
  },

  copySaveCodeFallback() {
    try {
      if (this.exportPanel && this.exportPanel.input) {
        const node = this.exportPanel.input.node;
        node.select();
        if (typeof document !== "undefined" && document.execCommand("copy")) {
          this.toast("Save code copied!");
          return;
        }
      }
    } catch (e) { /* fall through */ }
    this.toast("Select the code above and copy it (Ctrl+C).");
  },

  // --- Import ---------------------------------------------------------------
  showImportPanel() {
    if (this.started) return; // title screen only
    this.importPanel.errorText.setVisible(false);
    if (this.importPanel.input) {
      this.importPanel.input.node.value = "";
      this.importPanel.input.setVisible(true);
      this.importPanel.input.node.focus();
    }
    if (this.importPanel.loadBtn) this.importPanel.loadBtn.setVisible(true);
    if (this.importPanel.cancelBtn) this.importPanel.cancelBtn.setVisible(true);
    this.importPanel.setVisible(true);
  },

  hideImportPanel() {
    if (!this.importPanel) return;
    this.importPanel.setVisible(false);
    if (this.importPanel.input) this.importPanel.input.setVisible(false);
    if (this.importPanel.loadBtn) this.importPanel.loadBtn.setVisible(false);
    if (this.importPanel.cancelBtn) this.importPanel.cancelBtn.setVisible(false);
  },

  // The Load button: read the pasted code and try it. A bad code shows
  // the error and stays on the title screen — the game never starts
  // on a code that does not decode cleanly.
  loadImportCode() {
    const raw = this.importPanel && this.importPanel.input ? this.importPanel.input.node.value : "";
    const res = this.importSaveCode(raw);
    if (!res.ok) {
      this.importPanel.errorText.setText(SAVE_CODE_ERROR).setVisible(true);
      sfx.denied();
    }
  },

  // Try a code: decode it, and on success start the game with the
  // restored state. Returns { ok } — the caller shows the error.
  importSaveCode(code) {
    const res = decodeSaveCode(code);
    if (!res.ok) return { ok: false, error: SAVE_CODE_ERROR };
    this.startGameFromSave(res.state);
    return { ok: true };
  },

  startGameFromSave(state) {
    this.hideImportPanel();
    this.hideExportPanel();
    this.applySaveState(state);
    this.started = true;
    if (this.startOverlay) { this.startOverlay.destroy(); this.startOverlay = null; }
    this.resetEventTimer(true); // first event 60-90s after load, as if a fresh Start
    this.updateShopUI();
    this.updateTopUI();
    this.updateGoalUI();
    sfx.pop();
    this.toast("Save loaded — welcome back!");
  },
};
