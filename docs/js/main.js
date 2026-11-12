// main.js — boot. index.html loads Phaser (local bundled copy) as a
// classic script, then this module. Classic scripts run before
// deferred module scripts, so Phaser is normally already here — but if
// the local copy ever fails to load, we fall back to the CDN copy
// once, and show the "couldn't start" message if that fails too.
// The boot guard lives in index.html (window.__coinfishBoot /
// __coinfishShowFail).

import { CONFIG } from "./config.js";
import { TankScene } from "./scene/tank.js";

function startGame() {
  if (typeof Phaser === "undefined") return false;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: CONFIG.width,
    height: CONFIG.height,
    backgroundColor: "#1e7fa8",
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: TankScene,
  });
  return !!game;
}

function bootFail(msg) {
  if (typeof window.__coinfishShowFail === "function") window.__coinfishShowFail(msg);
}

if (startGame()) {
  window.__coinfishBoot.booted = true;
} else {
  // Local Phaser missing — try the CDN, once, and poll briefly for it
  // (the module may have run before the fallback script finished).
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js";
  document.head.appendChild(script);
  const deadline = Date.now() + 10000;
  const timer = setInterval(() => {
    if (startGame()) {
      clearInterval(timer);
      window.__coinfishBoot.booted = true;
    } else if (Date.now() > deadline) {
      clearInterval(timer);
      bootFail("Could not load Phaser (local copy or CDN).");
    }
  }, 100);
}
