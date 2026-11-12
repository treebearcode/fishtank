// index.js — barrel module. Re-exports everything the tests (and any
// tooling) need from the game's modules, so a consumer can do:
//   import * as G from "../src/js/index.js";

export * from "./config.js";
export * from "./economy.js";
export * from "./breeding.js";
export * from "./predation.js";
export * from "./feeding.js";
export * from "./snail.js";
export * from "./animation.js";
export * from "./input.js";
export * from "./magnet.js";
export * from "./sound.js";
export * from "./textures.js";
export { TankScene } from "./scene/tank.js";
