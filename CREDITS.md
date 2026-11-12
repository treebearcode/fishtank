# Credits

## V1 art — procedural / original

All fish, coins, the snail, plants, sand, bubbles and the water in V1 are
drawn in code with Phaser Graphics (`docs/js/textures.js` — originally
`makeFishTexture` / `makeCoinTexture` / `makeSnailTexture` in the old
single-file build). No external images, no ripped
Insaniquarium art, no copied names. "Coinfish Cove", "Turbo", and the fish
designs are original.

## Phaser

Phaser 3.60.0, bundled locally in `docs/assets/phaser.min.js`. Phaser is
released under the MIT licence.
https://phaser.io/ — https://github.com/photonstorm/phaser

## Open-source fish art — recommended future swap (not in V1)

Open-source art *is* allowed for this game, and the best checked option is:

- **Kenney Fish Pack** — https://kenney.nl/assets/fish-pack
  **CC0 (public domain, no attribution required)**, 120 files, PNG + SVG,
  free for commercial use and modification. This is the recommended pack
  if Victor wants real sprite art instead of the procedural fish.

- Also checked: OpenGameArt **"Cute Fish Sprites"** — OGA-BY 3.0,
  attribution required. Usable, but Kenney CC0 is simpler.

**Why V1 doesn't include them:** the GitHub snapshot push used for V1
only accepts UTF-8 text files, so binary PNGs can't be pushed that way.
The plan is: Victor (or a later push) drops the Kenney PNGs into
`docs/assets/` locally in VSCode, then swaps the fish textures in
`docs/js/textures.js` — search for `makeFishTexture` / `FISH_TEXTURES`
in the
code, where the swap point is marked. The procedural textures stay as a
fallback so the game still works without the PNGs.

## Sounds

All sounds in V1 are synthesized with the Web Audio API in
`docs/js/sound.js`
(`beep()`). No external audio files.
