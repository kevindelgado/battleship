---
name: testing-battleship
description: Test the Battleship game end-to-end. Use when verifying UI, game logic, or UX changes.
---

## Local Dev Setup

1. `npm install` — install dependencies
2. `npm run dev` — starts Vite dev server at `http://localhost:5173/battleship/`
3. `npm test` — runs Vitest (86+ tests across 9 files)
4. `npm run lint` — runs ESLint on `src/` and `test/`

## Game Flow for Testing

The game has three phases: **placement** → **playing** → **gameover**.

### Testing Placement Phase

- Ships can be placed in any order by clicking the ship name in the sidebar
- The currently selected ship has a blue left border (`.ship-item.active` class)
- Placed ships are dimmed with a ✓ checkmark (`.ship-item.placed` class)
- After placing a ship, selection auto-advances to the next unplaced ship (first in queue)
- Undo restores the last-placed ship and selects it
- To verify the correct ship is selected: hover over the board and count the green preview cells — they should match the selected ship's length
- "Start Game" only enables when all 5 ships are placed (queue empty)

### Reaching Playing Phase Quickly
1. Navigate to `http://localhost:5173/battleship/`
2. Click "Auto-place" to place all ships randomly
3. Set "First move" to "Player" (default) to control who goes first
4. Click "Start Game"

### Turn Cycle During Playing Phase
- Player clicks an unfired enemy cell → shot result shown for ~900ms → AI fires → result shown ~900ms → back to player
- During the 900ms pauses, `waitingForTurn` is true and clicks are guarded
- The `board-disabled` CSS class dims the enemy board when the player can't fire

### Testing Visual/CSS Changes
- Enemy board hover: `target-hover` class on `.cell.water` elements during player's turn
- Board disabled state: `board-disabled` class on enemy `.board-container` during AI turn / post-shot pause
- Placement preview: `preview-ok` / `preview-bad` classes on cells during ship placement hover
- Ship selection: `.ship-item.active` for selected ship, `.ship-item.placed` for placed ships
- Hit/miss/sunk cells: `.cell.hit`, `.cell.miss`, `.cell.sunk` classes

### Testing Ship SVG Silhouettes
- Ships render as inline SVG silhouettes overlaying the grid cells
- Player ships: 5 SVGs with class `ship-svg ship-svg-own` inside the player `.board-container`
- Enemy sunk ships: SVGs with class `ship-svg ship-svg-sunk` appear only after all cells of a ship are hit
- The SVG overlay sits at **z-index: 2** (above the table at z-index: 1) — so semi-transparent silhouette paths render on top of cell backgrounds, blending visually with hit/sunk colors
- `.cell.ship` has the same navy background as `.cell.water` (`rgb(22, 51, 92)`) with matching `box-shadow` — gridlines are uniform
- `.cell.sunk` has `background: var(--accent-deep)` (`rgb(138, 42, 19)`)
- There are no `ship-bg` rects in the SVGs — cells provide the background, SVGs are pure silhouette overlays
- Vertical ships use `<g transform="translate(0, vbW) rotate(-90)">` for rotation
- Silhouette definitions are in `src/ui/ships.js` — each ship type has a unique viewBox and paths
- Each SVG has a 2.4px inset margin (6% of cell size) to preserve gridlines around ships

#### Verifying Hit + Ship Rendering (z-index fix)
- When a player ship cell is hit, the orange `--accent` background renders at z-index 1, and the semi-transparent silhouette (`rgba(180,195,215,0.45)`) renders on top at z-index 2 — both should be visible
- Programmatic check: `getComputedStyle(document.querySelector('.ship-svg-overlay')).zIndex` should be `'2'`
- Background match: `getComputedStyle(document.querySelector('.cell.ship')).backgroundColor` === `getComputedStyle(document.querySelector('.cell.water')).backgroundColor` === `'rgb(22, 51, 92)'`
- No leftover bg rects: `document.querySelectorAll('.ship-bg').length === 0`

### Efficiently Sinking Enemy Ships During Testing
- **Do NOT** try to manually hunt for enemy ships by guessing pixel coordinates — this is slow and error-prone
- **Use the devtools console** to programmatically click cells: `document.querySelectorAll('.board-container')[1].querySelector('td[data-r="R"][data-c="C"]').click()` where R and C are 0-indexed
- **To find current hits/misses**: `[...document.querySelectorAll('.board-container')[1].querySelectorAll('td.hit, td.miss')].forEach(td => console.log(td.className, 'r' + td.dataset.r + 'c' + td.dataset.c))`
- **Wait ~3 seconds** between shots (900ms status display + 500ms AI turn + buffer) before firing again
- After getting a hit, try all 4 adjacent cells — ship extends horizontally or vertically
- A ship with hits on ALL cells will show `ship-svg-sunk` SVG on the enemy board. The "You sank their X!" status appears for ~900ms.

### Testing Timer/State Changes
- All turn-related timers go through `scheduleTurn()` / `cancelPendingTurnTimers()`
- Click "New Game" link in footer to restart — tests timer cleanup
- Use `vi.useFakeTimers()` in Vitest for timer-related unit tests

## Key Files

- `src/ui/main.js` — main game loop, event handlers, render orchestration
- `src/ui/ships.js` — SVG silhouette definitions and overlay rendering (`renderShipOverlays`)
- `src/ui/input.js` — placement logic: `placeShip`, `undoPlacement`, `selectShip`, `getCurrentShipDef`
- `src/ui/render.js` — board rendering, cell class assignment
- `src/styles.css` — all visual styles including cell states, SVG overlay styles
- `src/logic/game.js` — game state (includes `placement.selectedId`), shot application, turn switching
- `src/logic/ai/` — AI difficulty implementations
- `test/` — test files (Vitest + happy-dom for DOM tests)

## Tips

- The game re-renders the entire `#app` container on each state change via `innerHTML = ''`, so DOM references become stale after actions. Event delegation on parent containers survives this.
- `happy-dom` is available as a dev dependency for DOM-based tests.
- The deployed version lives at the GitHub Pages URL; local dev server is preferred for testing changes.
- Screenshots during the ~900ms post-shot pause will show the dimmed enemy board; the timing window is short so take screenshots immediately after clicking.
- When testing ship selection, the most reliable way to prove the correct ship is active is to hover over the board and count green preview cells — this distinguishes between ships of different lengths.
- The game state is module-scoped in `main.js` and NOT exposed on `window`. You cannot access `state` directly from devtools console. Use DOM queries (cell classes, SVG elements) instead.
- Board containers can be selected as `document.querySelectorAll('.board-container')[0]` (player) and `[1]` (enemy).
- Cell coordinates: `data-r` = 0-indexed row, `data-c` = 0-indexed column. Row 0 = display row 1, col 0 = column A, col 3 = column D, etc.
- To verify SVG count: `document.querySelectorAll('.board-container')[0].querySelectorAll('.ship-svg').length` (player board = index 0)
- To verify sunk on enemy: `document.querySelectorAll('.board-container')[1].querySelectorAll('.ship-svg-sunk').length`

## Devin Secrets Needed

None — no authentication or secrets required for local development and testing.
