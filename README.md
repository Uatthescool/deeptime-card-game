# Deep Time

**[Play in your browser →](https://uatthescool.github.io/deeptime-card-game/)**

Created by **Merrick McMorris**.

A strategy card game about ecology, with life from the Cambrian to the present, for two players or one against the computer. Each player fills five Niches with Creatures, overrides one Creature with another that shares enough traits, hunts the opposing ecosystem, and races to 12 Victory Levels.

The game currently ships three complete 40-card decks, five Biomes that change each player's rules, a card browser, and **Learn Something**, a set of illustrated lessons on the science behind the cards.

| Deck | Identity                                                                     |
| ---- | ---------------------------------------------------------------------------- |
| 1    | **Theropod Predators**: Carnivore board control built around Apex Predators  |
| 2    | **Herbivore Development**: armored Herbivores that grow toward Dreadnoughtus |
| 3    | **Aquatic Carnivores**: marine hunters using the closed Aquatic ecosystem    |

Play against the computer (Easy or Normal), or two players on one device, with hands hidden behind a handoff screen whenever the device passes between players. Games save automatically and survive a page refresh.

## Quick start

Requires [Node.js](https://nodejs.org/) 20.19 or newer (22 LTS recommended).

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

| Command            | What it does                                                       |
| ------------------ | ------------------------------------------------------------------ |
| `npm run dev`      | Development server with instant reload                             |
| `npm test`         | Rules, simulation, and interface tests                             |
| `npm run check`    | Typecheck, lint, and test, the same gate CI runs                   |
| `npm run build`    | Production build into `dist/`                                      |
| `npm run preview`  | Serve the production build locally                                 |
| `npm run playtest` | AI-vs-AI balance playtests (`-- --games=50 --decks=deck-1,deck-3`) |
| `npm run images`   | Resize and recompress artwork after adding new images              |
| `npm run format`   | Format all source files with Prettier                              |

## Architecture

```
src/
  ai/        The computer opponent: move choice and a Web Worker to run it
  data/      Card, deck, Biome, and Lesson content (no logic beyond validation)
  engine/    The rules engine: pure TypeScript, no browser or UI dependencies
  ui/        React interface: screens, components, saving, and session state
  styles/    Stylesheets
tests/
  ai/        Computer-opponent games, strength checks, and a fair-play test
  engine/    Rules tests, determinism tests, and whole-game simulations
  ui/        Interface tests run in a simulated browser
tools/       Playtest balance tool and image optimizer
```

### The rules engine

`src/engine` is the heart of the project and is built to be trustworthy:

- **Pure and immutable.** Every move is a function `(state, input) → newState`. Inputs are never mutated, and an illegal request returns an unchanged copy instead of corrupting the game.
- **Legality is enforced in the engine.** Each transition re-checks the matching legality query (`legalCreatureLanes`, `canPlayConcept`, …) before acting, so the interface can never perform an illegal move.
- **Deterministic.** All randomness (shuffles, coin flips, random effects) comes from a seeded generator stored in the game state. The same seed and the same moves always reproduce the same game. Each game shows its seed in the log, and entering that seed under **Advanced** on the setup screen replays the same shuffle.
- **One action vocabulary.** Every move is a serializable `GameAction` (`{ type: "playCreature", cardUid, laneIndex }`, …) applied through `applyAction`. The interface dispatches these, and the same actions can be recorded, replayed with `replay`, sent over a network, or chosen by an AI. `listLegalActions` lists every legal move in any state.
- **Self-checking.** `checkInvariants` verifies structural soundness: every card exists exactly once, Niches are consistent, and the winner matches the phase. The simulation tests run it after every action of every simulated game.

Modules, in dependency order: `core` (zones, board geometry, locks) → `override`, `victory`, `battle-math` → `queries` (read-only legality) → `turn` (turn flow) → `entry-effects`, `development`, `concepts`, `battle` (transitions) → `actions` (dispatch and legal-move generation).

### The computer opponent

`src/ai` plays a seat using only the engine's legal moves. It never cheats: before each decision it re-deals everything it couldn't know (the opponent's hand, the order of both decks, the random number generator) and plans on that imagined game, and it judges Hunts by weighing every Battle Coin outcome by its probability rather than peeking. A test checks this directly: scrambling the hidden information never changes its choice.

- **Normal** follows each move through its follow-up choices and plans two Development moves ahead.
- **Easy** judges each move by its first step only and sometimes misses or misjudges a move.

In testing, Normal beats Easy about 9 games in 10, and both beat random play about 9 in 10. Decisions run in a Web Worker, so the page stays responsive while the computer thinks, and each move is paced so a person can follow it.

### Tests

- **Rules** (`tests/engine/rules.test.ts`): 90 scenario tests covering card interactions and rulings.
- **Determinism** (`tests/engine/determinism.test.ts`): seed reproducibility, replay, purity, and Battle Coins.
- **Simulation** (`tests/engine/simulation.test.ts`): 54 complete games across every deck matchup and Biome, played by a random policy over `listLegalActions`. Invariants are checked after every action, and the suite fails if any game gets stuck or any listed action does nothing.
- **Computer opponent** (`tests/ai/ai.test.ts`): full computer games with every move checked for legality, strength against random play and between difficulties, and the fair-play test.
- **Interface** (`tests/ui/app.test.tsx`): setup-to-first-turn flow (against a person and against the computer), save and resume, the card browser, and the Hunt/coin modal.

## Rules source of truth

Card records live in `src/data`. Deck 1 and the shared Tag rules and rulings ledger are in `deck-1.json`; Decks 2 and 3 are in `deck-2.ts` and `deck-3.ts`. Card data is validated at startup, so a bad edit fails loudly.

When a rule changes, update the card data, the engine, and a rules test in the same change. Don't let interface wording become an undocumented rule.

## Deploying to GitHub Pages

The site is static and deploys automatically through GitHub Actions:

1. On GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Push to `main`. The **Deploy to GitHub Pages** workflow typechecks, lints, tests, builds, and publishes.

The site is served at `https://<user>.github.io/<repository>/`. The workflow sets the correct base path automatically, including for a custom domain. Pull requests and other branches run the same checks through the **CI** workflow without deploying.

## Artwork

All artwork is temporary. Final card illustrations and Biome art will be commissioned from artists or selected from fan submissions. The card layout, frame design, colors, and Biome concepts are original designs by Merrick McMorris.

`src/data/art.ts` records where every card's art came from, and a test keeps it in agreement with the files and credits:

| Source         | Cards | Notes                                                                                    |
| -------------- | ----- | ---------------------------------------------------------------------------------------- |
| Licensed       | 69    | Openly licensed images, credited in `public/artwork/attribution-manifest.json`           |
| AI placeholder | 17    | Generated with ChatGPT's image generator, as are the Biome backgrounds and Nautilus face |
| Pending        | 24    | No artwork yet; the card shows an "Artwork coming soon" frame                            |

Credits for all of it are shown in-game under **Artwork credits**.

**Adding new art:** put the image in `public/artwork/<card-key>.webp`, run `npm run images` to size it for the web, and move the card's key out of its current category in `src/data/art.ts`.

## Open items

- **Commissioned art.** 24 cards have no artwork, and 17 cards plus the Biome backgrounds use AI placeholders. Fan art contests need written submission terms (rights granted, originality, credit, prizes) before launch.
- **Placeholder Tags.** Shearing Bite, Retention, and Resonance are listed in the Tag registry but have no effect yet.
- **Rule documents.** The Changes Register, Player Rulebook, and Design Ledger documents are not yet in this repository.

## License

© 2026 Merrick McMorris. All rights reserved. No license has been chosen for this project yet.
