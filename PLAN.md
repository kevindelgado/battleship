# Battleship — Implementation Plan

A single-player Battleship game (human vs. algorithmic AI) delivered as a static web app. Optimized for engineering clarity and judgment over feature breadth. "Simple" is a hard constraint.

## 1. Deliverables

1. **Deployed playable game** — public link, GitHub Pages, human vs. AI, three difficulty levels.
2. **`BUGS.md`** — short writeup of bugs encountered during development and how they were fixed.
3. **Public GitHub repo** — clean, readable code with a sensible test suite and a `README.md`.

## 2. Non-goals

Explicitly out of scope for v1. Listed so reviewers don't expect them and so I don't drift into building them.

- No multiplayer, no networking, no real-time sync.
- No accounts, no login, no persistence across reloads (a refresh resets the game).
- No backend server, no API, no database.
- No LLM, no ML, no learned policy of any kind. AI is deterministic algorithm only.
- No heavy build framework (no Next.js, no CRA, no SSR).
- No animation library. Motion is limited to short CSS transitions for hit/miss reveal and hover preview.
- No sound effects.
- No mobile-first redesign beyond responsive stacking of the two boards.
- No accessibility audit beyond reasonable defaults (keyboard focus, semantic markup, sufficient contrast).

## 3. Stack & tooling

- **Language:** modern JavaScript (ES2022 modules). No TypeScript — keeps the surface small for a take-home.
- **Build/dev:** Vite. Static output, deployable as plain files.
- **UI:** vanilla JS + DOM. No framework. View functions render from a single game-state object.
- **Styling:** one hand-written `styles.css`. No Tailwind, no component library.
- **Testing:** Vitest. Logic modules are pure functions, trivially unit-testable.
- **Lint/format:** Prettier defaults plus a minimal ESLint config (recommended rules + `no-unused-vars`, `no-undef`). Cheap quality signal for a reviewed repo; not extended into stylistic bikeshedding.
- **Deployment:** GitHub Pages via `gh-pages` branch or Actions workflow building `dist/`.

## 4. Game rules (locked)

- 10×10 grid, columns A–J, rows 1–10.
- Classic fleet, one of each: Carrier (5), Battleship (4), Cruiser (3), Submarine (3), Destroyer (2). Total 17 cells.
- Ships are axis-aligned (horizontal or vertical), do not overlap, and stay fully on the board.
- **Ships are allowed to touch** (classic rules). Only overlap and off-board placements are illegal.
- **One shot per turn**, always. Hit or miss, turn passes.
- **First move is selectable** on the setup screen — Player / AI / Random — defaulting to Player. "Random" is resolved exactly once at game start to a concrete `turn` value stored in state (seeded in tests for determinism, never re-rolled mid-game).
- A shot reveals **hit** or **miss**. When a shot sinks a ship, the UI announces which ship (e.g. "You sank their Cruiser"). The AI receives the same sunk-ship-type signal — this matches the human's information set and avoids hidden asymmetry.
- First side to sink all five opposing ships wins. **Win detection runs immediately after each shot, before turn handoff.** The instant the final opposing ship is sunk the game enters `gameover` and the losing side does not get a subsequent shot, regardless of whose turn it would have been.

## 5. Architecture

Strict separation between pure game logic and DOM. Logic modules have no DOM references and are the unit-test target.

```
src/
  logic/
    board.js          # grid helpers, coordinates, cell-state constants
    fleet.js          # ship definitions, ship objects, sunk detection
    placement.js      # legal-placement check, random legal placement
    game.js           # game state, applyShot, winner detection, turn flow
    ai/
      easy.js         # random unfired cell
      medium.js       # hunt-and-target
      hard.js         # probability density
      index.js        # difficulty -> chooseShot(state) dispatch
  ui/
    render.js         # render boards + status from state
    input.js          # click/keyboard handlers, placement controller
    main.js           # bootstrap: build initial state, wire events, game loop
  styles.css
  index.html
test/
  board.test.js
  placement.test.js
  game.test.js
  ai.test.js
```

### State shape (single source of truth)

```js
{
  phase: 'placement' | 'playing' | 'gameover',
  difficulty: 'easy' | 'medium' | 'hard',
  turn: 'player' | 'ai',
  player: {
    ships: [{ id, name, length, cells: [{r,c}], hits: Set<'r,c'> }],
    shots: Map<'r,c', 'hit'|'miss'>,   // shots the player has fired at the AI
  },
  ai: {
    ships: [...],
    shots: Map<'r,c', 'hit'|'miss'>,   // shots the AI has fired at the player
    memory: { ... },                    // difficulty-specific (e.g. target queue)
  },
  placement: {
    queue: [shipName, ...],            // ships left to place
    orientation: 'horizontal' | 'vertical',
  },
  status: string,                       // current message for the status area
  winner: null | 'player' | 'ai',
}
```

Shots are stored per-firer. Hits/sunk derive from the *target's* ship list, so there's one authoritative record of ship cells and one record of where each side has fired.

## 6. Ship placement

### Manual placement (required, v1)

- Player places ships in the fixed fleet order (Carrier → Battleship → Cruiser → Submarine → Destroyer).
- Orientation toggle button + **R** keyboard shortcut.
- On hover over the player's board, render a live preview of the ship footprint at that anchor: **green** outline if legal, **red** if it would overlap or go off-board.
- Click commits placement if legal; nothing happens if illegal.
- "Ships remaining to place" list shows each ship, its length, and a check mark when placed.
- Undo button to remove the last placed ship.
- "Auto-place" button fills remaining ships using the same random-placement routine used for the AI.
- Setup-screen controls (alongside the placement panel): **difficulty** selector (Easy / Medium / Hard) and **first move** selector (Player / AI / Random, default Player). Both are read at Start Game and locked for the duration of the match; "Random" resolves at that moment to a concrete `turn` value (seedable for tests).
- "Start Game" button is disabled until all five ships are placed.

### Random legal placement (shared)

Single function `randomPlacement(fleet, rng)` used for both Auto-place and AI fleet setup. Picks a random orientation and anchor for each ship, rejects illegal placements, retries with a bounded attempt count, falls back to a sequential scan if random retries fail. Deterministic when given a seeded RNG (used in tests).

## 7. AI opponent

### Why algorithmic and not ML

Battleship has a known, cheaply computable near-optimal strategy (probability density over remaining legal ship placements). An algorithmic opponent is **stronger, deterministic, fully testable, and ships as static files**. A learned policy would approximate a solved problem at higher engineering cost, larger artifact size, and lower reliability. This is a deliberate engineering call, not a shortcut.

### Global invariants (enforced by `chooseShot` and tested for all three)

- Never returns a cell already fired at.
- Never returns an off-board cell.
- Always returns a valid `{r, c}` while the game is in `playing` phase.

### Easy

Uniform random over unfired cells.

### Medium — hunt and target

State machine with two modes, stored in `ai.memory`:

- **Hunt:** fire at a random unfired cell.
- **Target:** maintain a queue of orthogonally adjacent candidates around known unresolved hits. On hit, enqueue the four orthogonal neighbors (filtered to legal, unfired). On miss, just pop. Once two hits are colinear, restrict further candidates to that line's two ends. When the target ship is reported sunk, clear the queue and any hits belonging to that ship, return to Hunt.
- No diagonal targeting.

### Hard — probability density

Two modes, switched implicitly by whether any **unresolved hits** exist (hits not yet attributed to a sunk ship).

**Hunt mode** (no unresolved hits). Each turn:

1. Determine the set of unsunk enemy ship lengths; let `Lmin` be the smallest.
2. **Parity restriction.** Restrict candidate cells to a single checkerboard parity `(r + c) % 2 === targetParity`. Since every ship has length ≥ 2, any axis-aligned ship covers at least one cell of each parity, so restricting to one parity still guarantees finding every ship while roughly halving the search-mode shot count. The chosen parity is selected based on `Lmin` — heuristically the parity that yields the larger total consistent-placement count for the smallest unsunk ship, ties broken to `0`. It is recomputed each turn so it can shift as ships are sunk.
3. For every legal (ship, orientation, anchor) over the unsunk fleet, count it as consistent if it covers no known miss and no sunk-ship cell. For each **unfired cell of the chosen parity**, sum the placements covering it.
4. Fire at the highest-scoring such cell (ties broken by lowest row then lowest column for determinism).

**Target mode** (≥ 1 unresolved hit). Each turn:

1. Same enumeration, but a placement is consistent only if it covers no known miss, no sunk-ship cell, **and** covers at least one unresolved hit. Parity restriction does not apply in target mode.
2. Score every unfired cell by the count of consistent placements covering it; fire at the maximum (same tie-breaking).

This conditions on hits / misses / sunk, which is the version that actually plays well; pure unconditioned density wastes shots once a ship is partially hit.

**Documented scope simplification — multi-ship adjacency.** The target-mode rule "a consistent placement covers at least one unresolved hit" biases shots onto the live hit cluster, which is correct in the common case where all unresolved hits belong to a single ship. When two adjacent or interleaved ships are partially struck before either sinks, this heuristic can be slightly suboptimal compared to the strict rule "every consistent fleet-wide placement must collectively cover **all** unresolved hits across multiple ships." The strict version is materially more code, more enumeration cost, and a rare regime in practice. v1 ships the simpler rule deliberately. This is called out in `README.md` (AI section) and listed under "Known limitations / deliberate scope simplifications" in `BUGS.md` — it is documented, not a bug.

### Setup-screen choices are locked for the duration of a game

Both **difficulty** and **first move** are selected on the setup screen and immutable until the game ends. Locking difficulty avoids ill-defined transitions of AI memory; locking first move is what gives "Random" a single, well-defined resolution at game start.

## 8. Visual design

A polished, restrained nautical look. Beauty from disciplined CSS, not dependencies. All styles live in `styles.css`, organized into clearly commented sections (see end of this section).

### Palette

- `--navy-900: #0b1f3a` — deepest board background, headings.
- `--navy-700: #16335c` — board cells (water), primary buttons.
- `--slate-500: #4a6076` — grid lines, secondary text.
- `--sand-50:  #f6efe1` — page background (warm parchment).
- `--sand-100: #ece2cc` — card surfaces, panels.
- `--ink-900:  #1a1a1a` — body text.
- `--accent:   #e8552b` — signal orange, **reserved for hits**.
- `--accent-deep: #8a2a13` — sunk-ship outline/fill.
- `--ok:    #2f8a4a` — valid placement preview.
- `--bad:   #b3341d` — invalid placement preview.

The accent color appears **only** for hit/sunk states, nowhere else, so a hit is instantly recognizable.

### Typography

System font stack: `ui-sans-serif, -apple-system, "Segoe UI", Inter, Roboto, sans-serif`. No web font download. Status message and headings use heavier weight (600–700); board coordinates use a tabular/monospace fallback (`ui-monospace, SFMono-Regular, Menlo, monospace`) so labels align.

### Layout

- Header: title + setup controls (difficulty selector + first-move selector) during setup; status message during play.
- Main: two boards side by side on desktop. **Your Fleet** (left) shows your ships and incoming AI shots. **Enemy Waters** (right) is the targeting grid. On narrower viewports (`max-width: 900px`), boards stack vertically with the active board first.
- Side panel during placement: "Ships remaining to place" with each ship's name, length-as-dots indicator, and a check when placed; orientation toggle; Auto-place; Undo; Start Game.
- Footer: minimal — game restart link and difficulty indicator.

### Cell states (must be instantly distinct)

- **Water** (empty enemy cell): solid `--navy-700`, subtle inner shadow.
- **Your ship** (own board, placement and during play): `--slate-500` block with a 1px lighter top edge to suggest a hull. Continuous along the ship's footprint (cells of the same ship visually merge).
- **Miss**: water background with a small centered slate dot.
- **Hit**: `--accent` filled cell with a darker inner ring.
- **Sunk**: every cell of a sunk ship switches to a deeper, slightly desaturated `--accent-deep` fill, clearly distinct from `--accent` hit cells at a glance. v1 uses **per-cell fill only** — no single outline drawn around the whole ship footprint. A surrounding outline (SVG overlay or computed per-edge borders) is a noted nice-to-have, explicitly **not** built in v1, to avoid fighting CSS edge-border logic.
- **Hover preview during placement**: ship footprint outlined and tinted `--ok` if legal, `--bad` if illegal, only while hovering.

Grid lines are 1px `--slate-500` at low opacity. Cells are generously sized (~36–44px) with consistent gap; the board has a thin outer border and a soft drop shadow to sit on the sand background.

### Motion (restrained)

- Hit/miss reveal: 120ms ease-out background transition, optional 1px scale pulse for hits only.
- Hover preview: instant (no transition — it must track the cursor).
- Sunk fill: 180ms ease-out cross-fade from hit color to sunk color when a ship is sunk.
- No idle animations. No water shimmer. No shake.

### Status messaging

A single prominent status line drives all narrative feedback:

- Placement: "Place your Carrier (length 5). Press R to rotate."
- Playing: "Your turn." / "Hit!" / "Miss." / "You sank their Cruiser." / "They sank your Destroyer."
- End: "Victory — you sank the enemy fleet." / "Defeat — your fleet was sunk."

### `styles.css` organization

Single file, sections delimited by comment banners in this order:

1. CSS custom properties (palette, spacing, radii).
2. Reset / base typography.
3. Layout (header, main grid, panels, responsive stacking).
4. Board and cell styles.
5. Cell-state modifiers (water/ship/hit/miss/sunk/preview).
6. Placement panel (ship list, orientation toggle, buttons).
7. Status + end-state styles.
8. Motion / transitions.

## 9. Testing

Vitest. Logic is pure functions, so tests are direct. Target is high-signal coverage of invariants, not line-percentage chasing.

### Core logic

- **Hit detection:** a shot on a ship cell marks that cell as hit on the correct ship.
- **Sink detection:** a ship reports sunk only when all its cells are hit; not before.
- **Win detection:** game declares a winner only when **all** opposing ships are sunk; not when any ship is sunk.
- **Immediate end-of-game termination:** win detection runs after each shot, before turn handoff. Two tests, one with `firstMove = 'player'` and one with `firstMove = 'ai'`, drive the game to a state where one ship remains for the eventual loser, then assert that after the winning shot lands the game's `phase` is `gameover`, the `winner` is correct, and the losing side never fires (its shot count is unchanged on the next tick of the game loop).
- **Legal placement:** rejects overlaps; rejects off-board; accepts a ship touching another (no adjacency rule); accepts both orientations.
- **Random placement:** `randomPlacement` with a seeded RNG always produces a fleet with no overlaps, all on-board, and the correct ship lengths. Runs many seeds.

### AI legality (all three difficulties)

- Never returns a previously-fired cell — verified by running a full simulated game per difficulty and asserting no duplicate shots.
- Never returns an off-board cell — verified in the same simulation.
- Always terminates (returns a cell) given any reachable state with unfired cells remaining.

### AI behavior (sanity)

- **Medium**: after a hit on a known cell, the next chosen shot is orthogonally adjacent to that hit (when at least one orthogonal neighbor is legal and unfired).
- **Medium**: when the targeted ship is reported sunk, the AI returns to hunt mode (its target queue is empty before the next shot).
- **Hard**: given a constructed board with one specific unsunk-ship configuration and a partial set of hits/misses, the chosen cell is among the cells with maximal placement count. At least one test asserts that with a single unresolved hit at the center of an open board, the next Hard shot is one of the four orthogonal neighbors of that hit (because all consistent placements must cover the hit, so neighbors dominate).
- **Hard hunt-mode parity:** with no unresolved hits, the chosen cell satisfies `(r + c) % 2 === targetParity` for the parity the AI is currently using. Run across several seeds and across mid-game states (some ships sunk, no live hits) to confirm the restriction holds throughout hunt mode.

### Full-game smoke tests

For each of `easy`, `medium`, `hard`, run a fully simulated game (player ships placed by the seeded random routine, player firing via a trivial scripted policy, AI via its real `chooseShot`) and assert:

- The game terminates within a sane shot budget (e.g. ≤ 200 total shots).
- No exception is thrown at any point.
- On termination, exactly one side has all ships sunk and `winner` matches.
- No duplicate or off-board shots were fired by either side.

Cheap, and catches entire categories of integration regressions for the cost of a few seconds of test time.

### What I'm explicitly **not** testing

- DOM rendering snapshots.
- CSS.
- End-to-end browser flows. A small manual test pass before deploy is sufficient for this scope.

## 10. Repo layout

```
battleship/
  index.html
  src/...                # see §5
  test/...
  styles.css
  PLAN.md                # this file
  BUGS.md                # bugs encountered + fixes
  README.md              # how to run, test, deploy; design notes; AI rationale
  package.json
  vite.config.js
  .eslintrc.json                 # minimal ESLint config
  .github/workflows/deploy.yml   # GitHub Pages deploy
```

## 11. Build order (milestones)

Each milestone is independently runnable/testable. I'll commit at each step.

1. **Scaffold:** Vite project, `index.html`, empty `styles.css`, Vitest wired up, one passing smoke test.
2. **Board + fleet + placement logic** (pure, fully tested) — no UI.
3. **Game state + applyShot + win detection** (pure, fully tested) — no UI.
4. **Minimal UI:** render two boards from state, basic styling, click-to-fire against a hard-coded AI fleet placement; no AI yet (AI fires random).
5. **Manual placement UI** with hover preview, rotate, validation, auto-place, undo.
6. **AI: Easy, Medium, Hard** behind a single `chooseShot(state)` interface. Difficulty selector and first-move selector (Player / AI / Random, default Player) on setup screen; "Random" resolves at Start Game to a concrete `turn`.
7. **Visual polish pass:** apply the §8 design fully. Cell states, sunk fill, status line, responsive layout.
8. **Deploy** to GitHub Pages. Smoke test the live link.
9. **Fill in `BUGS.md`** from notes kept during steps 2–7.
10. **Final read-through** of code and README. Trim anything unused.

## 12. `BUGS.md` format

Stub file committed early; entries added as bugs are encountered. One section per bug:

```
### <short title>
- Symptom: what I observed.
- Root cause: what was actually wrong.
- Fix: the change, in one or two sentences. Link to commit if useful.
- Test added: name of the regression test, or "n/a" with a one-line justification.
```

Not pre-populated with fabricated bugs. Real bugs only.

A second section, **Known limitations / deliberate scope simplifications**, documents intentional design trade-offs that a careful reviewer would otherwise raise. Pre-populated with at least one entry: the Hard AI's target-mode rule covering "at least one unresolved hit" rather than the strict "all unresolved hits collectively across the fleet" — accurate in the single-ship case, slightly suboptimal when two adjacent ships are simultaneously partially hit. Same point is mirrored in `README.md` under the AI section.

## 13. Open risks / things to watch

- **Hard AI performance:** enumerating all legal placements of all unsunk ships every turn is ~hundreds of placements on a 10×10 — well within budget in JS, but I'll keep an eye on it and add memoization only if a measured turn exceeds ~50ms.
- **Manual placement UX on touch devices:** hover preview doesn't exist on touch. Touch users get a two-tap flow (tap to preview, tap again to commit). Acceptable for v1; noted in README.
