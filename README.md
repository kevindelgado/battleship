# Battleship

A single-player Battleship game (human vs. algorithmic AI) delivered as a static web app with three difficulty levels.

## Play

Visit the deployed game: `https://<your-username>.github.io/battleship/`

Or run locally:

```bash
npm install
npm run dev
```

## Rules

- 10×10 grid, columns A–J, rows 1–10.
- Classic fleet: Carrier (5), Battleship (4), Cruiser (3), Submarine (3), Destroyer (2).
- Ships are axis-aligned, do not overlap, and stay fully on the board. Ships are allowed to touch.
- One shot per turn. Hit or miss, turn passes.
- First move is selectable on the setup screen (Player / AI / Random, default Player).
- A shot reveals hit or miss. When a ship sinks, the UI announces which ship.
- First side to sink all five opposing ships wins. Win detection runs immediately after each shot, before turn handoff.

## AI

Three difficulty levels, all deterministic and algorithmic:

- **Easy** — Uniform random over unfired cells.
- **Medium** — Hunt-and-target: fires randomly until a hit, then systematically targets adjacent cells. Returns to hunt mode when the targeted ship sinks.
- **Hard** — Probability density: for each unfired cell, counts the number of consistent ship placements covering it, and fires at the maximum. In hunt mode (no unresolved hits), restricts to a single checkerboard parity to halve the search space. In target mode (≥1 unresolved hit), placements must cover at least one unresolved hit; parity restriction does not apply.

### Known AI simplification

The Hard AI's target-mode rule "a consistent placement covers at least one unresolved hit" is correct when all unresolved hits belong to a single ship. When two adjacent ships are partially struck before either sinks, this heuristic can be slightly suboptimal compared to the strict rule requiring collective coverage of all unresolved hits. This is a deliberate scope simplification documented in `BUGS.md`.

## Architecture

Strict separation between pure game logic (`src/logic/`) and DOM (`src/ui/`). Logic modules have zero DOM references and are the unit-test target.

```
src/
  logic/
    board.js       # grid helpers, coordinates, cell-state constants
    fleet.js       # ship definitions, ship objects, sunk detection
    placement.js   # legal-placement check, random legal placement
    game.js        # game state, applyShot, winner detection, turn flow
    ai/
      easy.js      # random unfired cell
      medium.js    # hunt-and-target
      hard.js      # probability density
      index.js     # difficulty -> chooseShot(state) dispatch
  ui/
    render.js      # render boards + status from state
    input.js       # click/keyboard handlers, placement controller
    main.js        # bootstrap: build initial state, wire events, game loop
  styles.css
```

## Testing

```bash
npm test
```

Uses Vitest. Tests cover:

- Board, fleet, and placement logic
- Game state, applyShot, win detection (including both-orderings end-of-game termination)
- AI legality (no duplicate/off-board shots) for all three difficulties
- AI behavior: Medium adjacency and hunt-return, Hard parity restriction and density targeting
- Full-game smoke tests for all three difficulties

## Build & Deploy

```bash
npm run build    # outputs to dist/
npm run preview  # preview the production build locally
```

### GitHub Pages

The repo includes `.github/workflows/deploy.yml`. To enable:

1. Go to your repo's **Settings → Pages**.
2. Under **Source**, select **GitHub Actions**.
3. Push to `main` — the workflow will build and deploy automatically.

## Stack

- Vanilla JS (ES2022 modules), no framework
- Vite (build/dev)
- Vitest (testing)
- ESLint + Prettier (lint/format)
- Single hand-written `styles.css`

## Touch devices

Hover preview does not exist on touch. Touch users get a two-tap flow (tap to preview, tap again to commit).
