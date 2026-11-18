# Coinfish Cove

An original Insaniquarium-*inspired* aquarium game — mechanics only, all art
and names are original. Buy fish, feed them, collect the coins they drop,
and save up for Turbo the snail, who crawls along the bottom collecting
coins you miss.

**Play it:** run a static server in this folder and open `/docs/`:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/docs/
```

(Opening `docs/index.html` via `file://` will NOT work with ES modules — a
server is needed. The game also runs straight from GitHub Pages, which
deploys this repo's `docs/` folder.)

## Features

- **Four fish species:** Guppy $100 (coins $1/$5/$10 every ~8s), Emberfin
  $250 (fast, $1/$5/$9 every ~6s), Chomper $400 (slow, grows at 4/8 feeds,
  big coins $3/$10/$20), Starfish $300 (swims low, $2/$6/$12 every ~12s,
  star-shaped, no tail). All share the growth / coin / sell / feeding
  systems and the fish cap.
- **Money in cents:** the +5%-per-decoration bonus is paid in cents —
  $1 → $1.05 / $1.10 / $1.15, $5 → $5.25 / $5.50 / $5.75. The HUD shows
  "$12" when whole, "$12.35" when there are cents. Buy costs and sell
  prices stay whole dollars.
- **Feeding:** one "Food" button opens a panel with three food types —
  Standard $2 = 1 feed, Deluxe $5 = 2 feeds, Feast Plant $40 = 30 nibbles
  shared by the whole tank. The plant is big (~150px tall, dwarfing a
  fish), drawn in detail at that size (three frond variants with veins,
  a textured stem with roots, a gnarled skeleton for the final nibbles),
  drops from the cursor, sinks slowly, anchors on the floor until
  fully eaten, and loses a frond every 5 nibbles — the last few leave a
  bare skeleton. No cap on how many plants at once. Fish chase the
  fight over food. A 0.5s eat cooldown is the only anti-hogging for pellets
  (plants add a 1.5s chew pause per fish and one bite per 0.4s per plant).
  Overlapping fish drift apart, and a fish that just ate drifts away so the
  next pellet reaches a hungry fish.
- **Dynamic speeds:** every fish rolls its own tempo (0.85–1.2× species
  speed) at spawn, hungry fish hurry (1.25×) while just-fed fish drift
  lazily (0.9×), and a fish chasing a sinking pellet 40–120px away
  bursts into a 1.8× desperate sprint (up to 1.5s, then a ~3s breather)
  — tail wag speeds up with the fish.
- **Growth:** 3 feeds = medium, 6 = large (Chomper: 4 and 8). Bigger fish
  drop bigger coins. A baby renders at ~half an adult size (0.6 / 0.9 /
  1.2 growth scales × species size). A fish carrying the royal gene can
  grow one step further — see **Royalty** below.
- **Fish traits:** every fish rolls one of five traits at spawn —
  Greedy (chases food faster, chews plants in 1.0s), Shy (flinches
  farther when poked, chases food slower, sprints rarely), Bold
  (sprints from farther out, recovers in 1.5s), Lazy (slow tempo,
  eats last), Social (wanders toward the school). Babies inherit a
  parent's trait half the time. Hover a fish to see its trait.
- **Visual variety:** each fish rolls a subtle pattern (plain, stripes,
  spots, gradient belly) and a small hue shift inside its species
  palette, and ~1 in 5 spawns wearing a small hat (party, top hat,
  beanie, pirate hat, flower, bow) above its head.
- **Royalty:** ~5% of fish are born carrying the royal gene (hidden
  until it shows). Only gene carriers grow past large into ROYAL
  (stage 3, +3 feeds after large): crown, ~1.35× scale, 2× the large
  coin value and 2× the large sell price, and it counts as large for
  the goal. The gene inherits through breeding — 50% with one royal
  parent, 75% with two. Crowns mean royal only.
- **Breeding (Minecraft-style):** two LARGE (or royal) fish of the same species,
  both fed within the last 30s and not hungry, tank not at cap — they
  swim together with hearts for ~3s, then the better-fed one is pregnant
  for 15s, pops out an egg that sinks to the floor, sits ~20s, then
  hatches into a baby if there is room (else it waits, pulsing). Both
  parents wait 60s after the egg pops.
- **Predation:** a LARGE hungry Chomper chases any baby fish within
  ~70px and eats it on contact — babies from breeding are at risk, by
  design. Baby Chompers, grown fish, and eggs are never eaten.
- **Dead fish:** a starved fish floats belly-up to the surface (grey,
  X eyes), bobs there ~10s, then fades — and live fish that bump into
  it knock it around.
- **Random events:** one at a time, first 60–90s after Start then every
  2–4 minutes — a **Glowing Jellyfish** drifts across with a pulsing
  comic-book starburst (click it — it bursts into five $5 coins),
  a 20s **Coin Rush** (fish drop coins twice as fast, countdown in the
  description bar), or a **Treasure Chest** that floats up for 12s (click
  to open: $50, $100, or a free baby guppy — money instead at the cap).
- **Rescue mode:** if the tank is empty and you can't afford a guppy,
  a rescue chest arrives in 5–10s with a free baby guppy and a top-up
  to $10 for food — the game never soft-locks.
- **Helpers:** Turbo the snail $200 (collects landed coins, crawls toward
  a sinking coin's landing spot; speed upgrade $150 → 90 px/s), Claws the
  crab $300 (grabs coins while they sink), feeder-bot $400 (a robot pet
  that swims the upper water and drops a $2 pellet every 15s, ON/OFF
  toggle).
- **Coin Magnet:** hovering over a coin collects it, free, from the
  start. One button buys three drag levels — L1 $400 / L2 $600 /
  L3 $900, drag radii 60/110/170. Coins within the radius are gently
  pulled to the cursor and collected on touch.
- **Decorations:** one "Decor" button opens a panel with Coral $75,
  Treasure Chest $100, Castle $150 — +5% coin value each (max +15%),
  paid in cents.
- **Tank upgrade** $200: fish cap 16 → 28. **Uncap Fish** toggle (free,
  playtest only, resets on reload): removes the cap entirely while ON.
- **Pause menu (P or the Pause button):** Volume slider (0–100%, master
  volume for all sounds, session-only) and a game-speed selector
  1x/2x/3x/4x — the menu is the only speed control (the old 2x shop
  toggle is gone). Speed scales everything, hunger included.
- **Input:** click water = drop food, click coin = collect (UI > coins >
  fish > water priority, one dispatcher), tap fish = poke, drag fish =
  move it, drag onto Sell = sell it (prices depend on species and size).
  Hold water = keep dropping food; hold a fish species button = keep
  buying that fish — both at the same 0.1s cadence, after a 0.3s
  initial delay so a quick tap is exactly one action.
- **Goal:** bank $1,000 total and own 3 large fish → "Goal met!" popup
  with Restart / Continue. No save yet — closing the page resets the run.

## How to play

- **Click in the water** to drop a food pellet. Pick the food first in the
  shop: **Standard $2 = 1 feed**, **Deluxe $5 = 2 feeds** (gold pellet, the
  fish glows briefly when it eats one).
- Fish swim to the nearest pellet and eat it — first arrival wins,
  so fish fight over food. **3 feeds = medium, 6 feeds = large**
  (Chomper grows slower: 4 feeds = medium, 8 = large). A fish that just
  ate waits **0.5s** before it can eat again. Overlapping fish drift
  gently apart, and a fish that just ate drifts away from the food for
  about a second, so the next pellet goes to a hungry fish.
- Fish drop a coin on their own schedule (if they aren't hungry):

  | Fish | Buy | Speed | Coin every | Coins (small / med / large) | Grows at |
  |---|---|---|---|---|---|
  | Guppy | $100 | 45 | ~8s | $1 / $5 / $10 | 3 / 6 feeds |
  | Emberfin | $250 | 65 | ~6s | $1 / $5 / $9 | 3 / 6 feeds |
  | Chomper | $400 | 30 | ~8s | $3 / $10 / $20 | 4 / 8 feeds |
  | Starfish | $300 | 25 | ~12s | $2 / $6 / $12 | 3 / 6 feeds |

  Decorations add +5% each (max +15%), paid in cents: with all three,
  $1 → $1.15, $5 → $5.75, $10 → $11.50.
- **Breeding:** two LARGE (or royal) fish of the same species, both fed within the
  last 30s and not hungry, tank not at cap — they swim together with
  hearts for ~3s, then the better-fed one is pregnant for 15s (swollen
  belly, slower), pops out an egg that sinks to the floor, sits ~20s,
  then hatches into a small fish of that species if there is room (if
  the tank is full the egg waits, pulsing, until room frees up). Both
  parents then wait 60s before they can breed again. Pregnant fish still
  eat, get hungry, and can die like any fish.
- **Click coins to collect them.** Coins sink slowly and fade away after
  **~10 seconds** on the tank floor — don't leave them sitting there.
  Clicking a coin collects *only* the coin: the input priority is
  UI buttons > coins > fish > empty water, so a coin click never
  drops food by mistake.
- **Tap a fish to poke it** — it darts away. **Drag a fish to move it**
  — while you hold it, it's held by the tail, vertical, head down,
  wiggling (it doesn't like it). **Drag a fish onto the Sell button**
  to sell that exact fish:

  | Fish | Small | Medium | Large |
  |---|---|---|---|
  | Guppy | $50 | $100 | $150 |
  | Emberfin | $125 | $200 | $300 |
  | Chomper | $200 | $350 | $500 |
  | Starfish | $150 | $250 | $350 |

  Turbo, Claws, and the feeder-bot are not sellable. Dropping a fish
  anywhere else just moves it. While you drag, Sell glows and shows
  that fish's price.
- **Automation (shop):** the feeder-bot **$400** (once, then the same
  button toggles it on/off) is a little robot that swims the upper/mid
  water (never deeper than y=300) and drops a Standard pellet every
  **15s** for $2 each, right where it is — it pauses if you're broke
  or fishless.
- Fish get **hungry after ~20 seconds** without food: they hurry, go
  pale, and stop dropping coins. After **~30 more seconds** unfed, they die.
- **Shop (bottom bar, two rows of 9):** hover any button for a
  description — the buttons show short labels with icons.
  - Row 1: Guppy **$100**, Emberfin **$250**, Chomper **$400**,
    Starfish **$300** (cap 16, or 28 after the tank upgrade, shared
    by all species), Turbo (snail) **$200** — the same button then
    becomes Turbo Speed **$150** (60 → 90 px/s, once), Crab Claws
    **$300** (collects coins while they sink, ~60 px/s),
    Feeder-bot **$400** (ON/OFF toggle after purchase), Magnet
    **$400 → $900** (hover collect is free; three drag levels).
  - Row 2: Food selector (Standard $2 / Deluxe $5), Decor **panel**
    (Coral $75, Treasure Chest $100, Castle $150 — one of each, +5% coin
    value each, paid in cents), Tank Upgrade **$200** (cap 16 → 28,
    once), Pause button (opens the menu: volume + speed 1x–4x), Sell (drag a fish onto it).
  - Turbo crawls the floor and collects landed coins — he crawls
    toward a coin's landing spot while it's still sinking, so he's
    usually already there when it lands. Claws grabs sinking
    coins. Neither is as fast as you clicking — clicking is still fastest.
- **Goal (top bar): bank $1,000 total and own 3 large fish.** When both are
  true, the game pauses and a popup says **"Goal met!"** — choose
  **Restart / Clear Tank** (back to $200 + 2 small guppies, everything reset)
  or **Continue as is** (keep playing, goal shows ✓ Complete).
- **P** pauses. If all your fish die, the tank isn't over — buy a guppy
  and keep going.

## Starting money

$200 and 2 small guppies. A guppy pays for itself in food terms if you keep
it fed: a small fish drops $1 every 8s, so it takes a while — growing it to
medium/large is where the money is.

## Files

```
docs/
  index.html          Page shell + boot guard (Phaser loader, CDN fallback)
  style.css           Page chrome only — the game is drawn by Phaser
  assets/
    phaser.min.js     Phaser 3.60.0, bundled locally (MIT licence, see CREDITS.md)
  js/
    main.js           Boot: creates the Phaser.Game (CDN fallback if needed)
    config.js         Every constant: economy numbers, species table, layout
    economy.js        Pure money / growth / coin-value helpers
    breeding.js       Pure breeding guards (pairing, pregnancy, egg hatch)
    predation.js      Pure predation guards (Chomper hunts babies)
    feeding.js        Pure pellet-eating helpers (nearest eligible fish)
    snail.js          Pure snail targeting / overshoot / collect checks
    animation.js      Pure tail wiggle / joint / tilt / drift math
    input.js          Pure hitboxes and the pointer-target resolver
    magnet.js         Magnet drag-chain levels + pure drag/hover math
    sound.js          Tiny WebAudio beeps (no audio files)
    textures.js       All procedural art (fish, coins, snail, crab, bot, egg)
    index.js          Barrel re-exporting everything (tests import this)
    scene/
      tank.js         TankScene class + create() + update() orchestrator
      ui.js           HUD, shop buttons, description bar, goal popup, toasts
      shop.js         Purchase handlers, decor panel, magnet label/tip, selling
      fish.js         Spawning, growth visuals, animation, steering, separation
      creatures.js    Turbo, Claws, feeder-bot runtime updates
      feeding.js      Food/pellet drops, eating, bubbles, floating text
      coins.js        Coin drops, collection, sinking, magnet drag
      lifecycle.js    Breeding, eggs, predation (scene side)
      input.js        The one pointer dispatcher (poke / grab / sell)
tests/
  phaser-stub.js      Sets global.Phaser before the game modules load
  headless.test.js    139 node tests (Phaser stubbed) — run:
                      node tests/headless.test.js   (exit 0 = all green)
README.md
CREDITS.md
```

The game is a plain ES-module tree (no bundler). The scene class is one
class split across mixin files: `scene/tank.js` attaches the mixins with
`Object.assign(TankScene.prototype, ...)`, so every system keeps its own
file while sharing the same scene state.

The headless test suite imports the barrel (`docs/js/index.js`) and runs the
real scene against a Phaser stub — the same 139 tests cover the species
table, cents, breeding chain, shop reuse, Sell bounds, feeder-bot band,
and the tail-geometry regressions.

## Ideas for later

Aliens that eat fish, save-to-localStorage, tank cleaning, daily quests.
