---
name: testing-battleship
description: Test the Battleship game end-to-end. Use when verifying UI, game logic, or UX changes.
---

## Local Dev Setup

1. `npm install` — install dependencies
2. `npm run dev` — starts Vite dev server at `http://localhost:5173/battleship/`
3. `npm test` — runs Vitest (67+ tests across 7 files)
4. `npm run lint` — runs ESLint on `src/` and `test/`

## Game Flow for Testing

The game has three phases: **placement** → **playing** → **gameover**.

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
- Hit/miss/sunk cells: `.cell.hit`, `.cell.miss`, `.cell.sunk` classes

### Testing Timer/State Changes
- All turn-related timers go through `scheduleTurn()` / `cancelPendingTurnTimers()`
- Click "New Game" link in footer to restart — tests timer cleanup
- Use `vi.useFakeTimers()` in Vitest for timer-related unit tests

## Key Files

- `src/ui/main.js` — main game loop, event handlers, render orchestration
- `src/ui/render.js` — board rendering, cell class assignment
- `src/styles.css` — all visual styles including cell states
- `src/logic/game.js` — game state, shot application, turn switching
- `src/logic/ai/` — AI difficulty implementations
- `test/` — test files (Vitest + happy-dom for DOM tests)

## Tips

- The game re-renders the entire `#app` container on each state change via `innerHTML = ''`, so DOM references become stale after actions. Event delegation on parent containers survives this.
- `happy-dom` is available as a dev dependency for DOM-based tests.
- The deployed version lives at the GitHub Pages URL; local dev server is preferred for testing changes.
- Screenshots during the ~900ms post-shot pause will show the dimmed enemy board; the timing window is short so take screenshots immediately after clicking.

## Devin Secrets Needed

None — no authentication or secrets required for local development and testing.
