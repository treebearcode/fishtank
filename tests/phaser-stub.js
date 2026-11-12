// phaser-stub.js — sets global.Phaser BEFORE any game module is
// imported. The game's scene class does `class TankScene extends
// Phaser.Scene` at module-evaluation time, so this import must come
// first in tests/headless.test.js (ESM evaluates imports in order).

// Scene base class + Math.Clamp + Scale/Game dummies.
class StubScene {
  constructor(key) { this.sceneKey = key; }
}

global.Phaser = {
  Scene: StubScene,
  Math: { Clamp: function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); } },
  Scale: { FIT: "FIT", CENTER_BOTH: "CENTER_BOTH" },
  Game: class {},
};
