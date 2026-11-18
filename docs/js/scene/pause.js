// scene/pause.js — TankScene mixin: the PAUSE MENU (P key or the
// Pause button in the shop bar) and its settings.
//
// The old pause was just a "Paused — press P to resume" text. The
// menu is a real overlay (built once in create(), shown/hidden like
// the goal popup) with two settings:
//   Volume — a slider, 0-100%, master volume for all sound effects.
//     Session-only: it lives in the sound module, so it resets on
//     page reload and is never saved anywhere (no localStorage, by
//     design). Click the track to jump, or drag the handle.
//   Speed — 1x / 2x / 3x / 4x buttons. This is the SINGLE source of
//     truth for game speed (the old 2x shop toggle is gone). Speed
//     scales dt exactly as the 2x toggle did — update() multiplies
//     delta by speedMult — so hunger, coins, events, movement and
//     every timer scale with it; nothing in the code assumes 1x/2x.

import { CONFIG } from "../config.js";
import { sfx } from "../sound.js";

const TRACK_X0 = 330; // world x of the volume track's left end
const TRACK_X1 = 630; // ...and right end (300px wide, centred on 480)

export const pauseMixin = {
  // Build once (called from create()). Hidden until the game pauses.
  buildPauseMenu() {
    const menu = this.add.container(480, 270).setDepth(20).setVisible(false);
    const shade = this.add.rectangle(0, 0, CONFIG.width, CONFIG.height, 0x0b2a3a, 0.72).setOrigin(0.5, 0.5);
    const panel = this.add.rectangle(0, 0, 460, 300, 0x12394d, 1).setStrokeStyle(3, 0xffd23f);
    const title = this.add.text(0, -130, "Paused", { fontSize: "30px", color: "#ffe27a", fontStyle: "bold" }).setOrigin(0.5, 0.5);
    menu.add([shade, panel, title]);

    // --- Volume: label + click/drag slider + % readout.
    const volLabel = this.add.text(0, -95, "Volume", { fontSize: "16px", color: "#eaf6ff", fontStyle: "bold" }).setOrigin(0.5, 0.5);
    const track = this.add.rectangle(0, -70, TRACK_X1 - TRACK_X0, 10, 0x2a5a75, 1).setInteractive({ useHandCursor: true });
    const handle = this.add.circle(-150 + 300 * sfx.getVolume(), -70, 10, 0xffd23f).setInteractive({ useHandCursor: true });
    const volText = this.add.text(170, -70, Math.round(sfx.getVolume() * 100) + "%", { fontSize: "14px", color: "#eaf6ff", fontStyle: "bold" }).setOrigin(0, 0.5);
    track.on("pointerdown", (pointer) => { if (this.paused) this.volumeFromX(pointer.x); });
    // Drag the handle: Phaser's drag plugin moves it; the drag handler
    // clamps it to the track and sets the volume from its position.
    // (Guarded — the headless stub has no setDraggable; the track
    // click above is the testable path.)
    if (typeof this.input.setDraggable === "function") {
      this.input.setDraggable(handle);
      this.input.on("drag", (pointer, gameObject) => {
        if (gameObject === handle && this.paused) {
          handle.x = Phaser.Math.Clamp(pointer.x - 480, -150, 150);
          this.setVolume((handle.x + 150) / 300);
        }
      });
    }
    menu.add([volLabel, track, handle, volText]);

    // --- Speed: 1x / 2x / 3x / 4x. Current speed is gold, the rest dark.
    const speedLabel = this.add.text(0, -35, "Game Speed", { fontSize: "16px", color: "#eaf6ff", fontStyle: "bold" }).setOrigin(0.5, 0.5);
    menu.add(speedLabel);
    const speedBtns = {};
    CONFIG.gameSpeeds.forEach((mult, i) => {
      const bx = -135 + i * 90;
      const rect = this.add.rectangle(bx, 0, 70, 30, 0x2a5a75, 1).setInteractive({ useHandCursor: true });
      rect.setStrokeStyle(2, 0x8a6a1f);
      const label = this.add.text(bx, 0, mult + "x", { fontSize: "14px", color: "#eaf6ff", fontStyle: "bold" }).setOrigin(0.5, 0.5);
      rect.on("pointerdown", () => { if (this.paused) this.setSpeed(mult); });
      menu.add([rect, label]);
      speedBtns[mult] = { rect, label };
    });

    // --- Resume.
    const resumeRect = this.add.rectangle(0, 60, 180, 42, 0xffd23f, 1).setInteractive({ useHandCursor: true });
    resumeRect.setStrokeStyle(2, 0x8a6a1f);
    const resumeLabel = this.add.text(0, 60, "Resume", { fontSize: "16px", color: "#12394d", fontStyle: "bold" }).setOrigin(0.5, 0.5);
    resumeRect.on("pointerdown", () => { if (this.paused) this.setPaused(false); });
    const hint = this.add.text(0, 100, "P resumes too — hunger ticks faster at higher speeds.", { fontSize: "12px", color: "#eaf6ff" }).setOrigin(0.5, 0.5);
    menu.add([resumeRect, resumeLabel, hint]);

    this.pauseMenu = menu;
    this.pauseMenu.track = track;
    this.pauseMenu.handle = handle;
    this.pauseMenu.volText = volText;
    this.pauseMenu.speedBtns = speedBtns;
    this.pauseMenu.resumeRect = resumeRect;
  },

  // P key / Pause button. Same guards as the old P handler: never
  // before Start, never while the goal popup is open (it has its own
  // buttons — unpausing behind it would let the game run while the
  // player is still deciding).
  togglePause() {
    if (!this.started) return;
    if (this.goalPopupShown && !this.goalComplete) return;
    this.setPaused(!this.paused);
  },

  setPaused(v) {
    this.paused = v;
    this.pauseMenu.setVisible(v);
    if (v) {
      this.closeDecorPanel();
      this.closeFoodPanel();
      this.resetDescText();
      this.updatePauseMenu();
    }
  },

  // Volume 0-1 (slider is 0-100%). Master volume for every sfx beep
  // (see sound.js) — 0 is silent. Updates the handle + % readout.
  setVolume(v) {
    sfx.setVolume(v);
    if (!this.pauseMenu) return;
    const vol = sfx.getVolume();
    this.pauseMenu.handle.x = -150 + 300 * vol;
    this.pauseMenu.volText.setText(Math.round(vol * 100) + "%");
  },

  volumeFromX(worldX) {
    this.setVolume((worldX - TRACK_X0) / (TRACK_X1 - TRACK_X0));
  },

  // Game speed 1x-4x. The ONLY speed control now (the 2x shop toggle
  // is gone). update() multiplies dt by speedMult, so everything —
  // hunger, coins, events, movement, sprint/chew/cooldown timers —
  // scales exactly as 2x did. Invalid values are ignored.
  setSpeed(mult) {
    if (!CONFIG.gameSpeeds.includes(mult)) return;
    this.speedMult = mult;
    sfx.pop();
    this.toast(mult === 1 ? "Back to normal speed." : mult + "x speed — hunger ticks " + mult + "x as fast too!");
    this.updatePauseMenu();
  },

  // Refresh the menu to match the live settings (handle position, %
  // readout, which speed button is highlighted). Called on open and
  // after every change.
  updatePauseMenu() {
    if (!this.pauseMenu) return;
    const vol = sfx.getVolume();
    this.pauseMenu.handle.x = -150 + 300 * vol;
    this.pauseMenu.volText.setText(Math.round(vol * 100) + "%");
    for (const mult of CONFIG.gameSpeeds) {
      const b = this.pauseMenu.speedBtns[mult];
      const current = mult === this.speedMult;
      b.rect.setFillStyle(current ? 0xffd23f : 0x2a5a75, 1);
      b.label.setColor(current ? "#12394d" : "#eaf6ff");
    }
  },
};
