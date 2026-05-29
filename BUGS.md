# BUGS.md

## Bugs encountered during development

### 1. RNG divisor caused intermittent game freeze

**Symptom.** Occasionally and unpredictably, the AI would skip a turn entirely and the game would hang — no error in the console, no way to continue.

**Root cause.** The seeded RNG in `src/ui/main.js` normalized its output by dividing the LCG state by `0xffffffff` (2³² − 1) instead of `0x100000000` (2³²). When the LCG happened to produce its maximum state, that division returned *exactly* `1.0`. Multiplying by an array length and flooring then produced `array.length` — an out-of-bounds index returning `undefined`. Inside `doAITurn`, an `undefined` shot triggered an early return that skipped the turn-handoff, leaving `state.turn === 'ai'` permanently. The same incorrect divisor was duplicated in two test helpers (`test/ai.test.js`, `test/placement.test.js`).

**Fix.** Changed the divisor from `0xffffffff` to `0x100000000` so the normalized output is in `[0, 1)` rather than `[0, 1]`. Extracted `seededRng` into a new pure module `src/logic/rng.js` so it could be imported by both `main.js` and the test helpers — also a clean architectural improvement (pure logic out of the DOM file). The `& 0xffffffff` 32-bit state mask in the LCG update was deliberately left alone — that's a correct mask, not a divisor.

**Test added.** `test/rng.test.js` crafts a seed that produces the exact maximum LCG state (`0xffffffff`) on its first call, asserts the output is strictly less than `1.0`, and sweeps 100k+ iterations confirming outputs are always in `[0, 1)` and derived indices are always in bounds. The test fails against the old divisor and passes against the fix.

**How it was found.** Devin Review caught this on the initial PR. The build agent's own self-test reported "all tests passed, no issues found" — but the freeze only triggers on a specific RNG state that the seeded smoke runs didn't happen to hit. Useful reminder: a green test suite is only as strong as the states it actually exercises.

### 2. Placement hover preview stopped tracking after first hover

**Symptom.** During placement, the ship preview correctly highlighted on the first cell hovered, but didn't update as the mouse moved. It stayed stuck until something else (clicking, pressing R) triggered a re-render.

**Root cause.** In `renderPlacementUI`, `mouseenter`/`mouseleave` handlers were attached individually to each `<td>` cell. When a hover fired, the handler called `renderBoard`, which does `container.innerHTML = ''` and rebuilds the cells. The new cells only had `click` handlers re-attached, not hover handlers — so after the first hover, no element on the page had a `mouseenter` listener left to fire.

**Fix.** Replaced per-cell hover listeners with event delegation: one `mouseover`/`mouseout` listener attached to the parent `playerBoard`, which survives `innerHTML` rebuilds. The handler calls `e.target.closest('td')` to find the cell element, then reads `data-r`/`data-c` from it.

**Test added.** `test/hover.test.js` (using `happy-dom` as a scoped dev dependency) mounts the board, fires a mouseover — the first hover triggers `renderBoard` (which rebuilds `innerHTML`), then a second hover on a different cell asserts the preview still updates — proving the delegated handler survives the `innerHTML` rebuild.

**How it was found.** Also caught by Devin Review. Notably, the build agent's own self-test had flagged the underlying pattern in a `SKILL.md` note — *"the game re-renders the entire #app container on each state change, so DOM references become stale after actions"* — without recognizing it as a defect. The independent review pass connected that observation to a concrete bug. Spotting a code smell in your own work is not the same as fixing it.

### 3. Shot-result status messages never visible to the user

**Symptom.** "Hit!", "Miss.", and "You sank their <ship>" never appeared in the status area. Only "AI is thinking..." (after a player shot) and "Your turn." (after an AI shot) were ever displayed. The plan explicitly required announcing which ship was sunk; this requirement was silently violated.

**Root cause.** A synchronous-render bug. In both the player click handler and `doAITurn`, the sequence was: `applyShot` (which sets the status to "Hit!" / "Miss." / "You sank their X") → `render()` → `switchTurn` (which overwrites the status to "AI is thinking..." or "Your turn.") → `render()` — all back-to-back in the same JavaScript tick. The browser only paints after the call stack empties, so only the final status ever reached the screen. Victory/defeat messages survived only because they return early before `switchTurn`.

**Fix.** Introduced a short delay between displaying the shot result and switching turns. After `applyShot` and the first `render()`, the turn switch is scheduled via a tracked `setTimeout` (~900ms), giving the browser a paint cycle to display the result before the status changes. Input is guarded during the pause so a player can't fire again mid-delay.

**How it was found.** Devin Review, second round. A bug class that purely unit tests cannot catch — it's about render timing, not logic, and the unit tests had been running entirely in synchronous JavaScript where the browser paint loop doesn't exist.

### 4. Placement hover preview not visually cleared on mouseout

**Symptom.** Moving the mouse off the player board during placement cleared the internal preview state, but the green/red highlight cells stayed lit in the DOM until some other action triggered a re-render.

**Root cause.** The `mouseout` handler updated the JS state variables but never called `renderBoard()` (or `render()`), unlike its sibling `mouseover` handler which does trigger a render. State diverged from DOM.

**Fix.** After clearing `placementPreview` to null on mouseout, call `renderBoard()` — matching what `mouseover` already does. The render brings the DOM back in sync with state.

**How it was found.** Devin Review, second round. A small UX bug a casual player might not notice, but immediately visible to anyone moving the mouse deliberately.

### 5. Pending timer callbacks corrupted state after restart

**Symptom.** Clicking "New Game" during the brief pause between a shot and the turn switch could corrupt the freshly-created game state — e.g., place a freshly-started placement-phase game directly into "AI is thinking..." mode, or cause the AI to fire an extra shot on the first turn of a new game.

**Root cause.** Two related issues, fixed together:
- Multiple `setTimeout` calls in `main.js` (the 900ms result-display delays *and* the 500ms AI-turn kickoffs) captured the module-level `state` by reference. When a callback eventually fired, it operated on whatever `state` was at that moment — including a brand-new game in placement phase. `switchTurn` only short-circuited on `phase === 'gameover'`, not placement.
- Some timeouts (the 900ms ones) had their IDs stored after a first fix attempt, but others (the 500ms ones) didn't — so the restart handler could only cancel some of them. Partial cleanup left stale timers alive.

**Fix.** Centralized all turn-related timer scheduling behind small helpers (`scheduleTurn`/`cancelPendingTurnTimers`) so that *every* `setTimeout` in the turn flow is tracked through one mechanism. The restart handler cancels all pending turn-related timers in one call. Belt-and-suspenders: the `doAITurn` guard against `state.phase !== 'playing' || state.turn !== 'ai'` was kept so even an un-cancelled timer firing would no-op rather than corrupt state.

**How it was found.** Two consecutive rounds of Devin Review — a partial fix in round 3 (the 900ms timers) revealed in round 4 that the 500ms timers had the same bug. The lesson, captured here in the writeup: an incomplete fix can introduce a new bug surface, and a second independent review pass is what catches it. The final fix centralized the pattern so the bug class is structurally eliminated, not just patched at each site.

## Playtest findings (UX gaps caught after initial deploy)

After the initial PR merged and the game went live, I played a full game on each difficulty. The defects fixed in Devin Review (above) all held up. These two UX gaps surfaced — minor, but visible enough to a real player that they belonged in a small follow-up PR rather than being deferred to the visual polish work.

### 6. Enemy board lacks hover feedback during player's turn

**Symptom.** During the player's turn, hovering over enemy cells gave no visual cue that clicking would fire a shot. After tabbing away and back, the player couldn't tell whether the board was interactive without clicking.

**Root cause.** No hover style existed for the enemy board. The placement board had delegated hover handlers for ship preview, but the enemy board had only click handlers — no visual feedback on mouseover.

**Fix.** Added a delegated `mouseover`/`mouseout` listener on the enemy `board-container` element (same pattern as the placement hover). The `mouseover` handler calls `e.target.closest('td')`, checks that the cell has the `water` class (unfired), and guards on `state.phase === 'playing'`, `state.turn === 'player'`, and `!waitingForTurn` before adding a `target-hover` CSS class. The `mouseout` handler removes it. The `target-hover` style uses the existing `--slate-500` color and a `crosshair` cursor — no new colors or animations.

**How it was found.** Manual playtesting of the deployed live URL, not Devin Review.

### 7. Enemy board looks identical whether the player can fire or not

**Symptom.** While the AI was thinking or during the post-shot result pause, the enemy board looked exactly like it did on the player's turn. Clicks silently did nothing, with no visual explanation.

**Root cause.** The JS click handler correctly guarded against firing during the AI's turn and during the `waitingForTurn` pause, but there was no corresponding visual feedback — the board's appearance was identical in active and inactive states.

**Fix.** In `renderGameUI`, when the player cannot fire (`state.phase !== 'playing'`, `state.turn !== 'player'`, or `waitingForTurn` is set), a `board-disabled` CSS class is applied to the enemy `board-container`. The class sets `opacity: 0.6` with a 200ms transition and `cursor: not-allowed` on cells. Pointer events remain enabled — the JS guards remain the source of truth; the CSS is purely visual feedback. The class is absent when control returns to the player (each `render()` call rebuilds the DOM, so the class is only applied when the guard conditions are true at render time).

**How it was found.** Manual playtesting of the deployed live URL, not Devin Review.

### 8. Ship silhouettes cover board gridlines

**Symptom.** Where a ship sat on the board, the gridlines disappeared — the SVG silhouette extended to the cell edges, erasing the 1px borders that separate cells. The rest of the board showed gridlines normally, so the effect was noticeable: ships looked like they were painted over the grid rather than placed on it.

**Root cause.** In `createShipSVG`, the SVG element's width and height were set to the ship's full cell footprint (`ship.length × cellW` by `cellH`, or the transposed equivalent for vertical ships), with its position at the exact cell origin. This left zero margin between the silhouette and the cell borders, so the SVG covered the gridlines along its edges.

**Fix.** Added a proportional inset (`INSET_RATIO = 0.06` of the smaller cell dimension) applied uniformly: the SVG position is offset inward by `inset` on both axes, and its width and height are each reduced by `2 × inset`. The inset scales with cell size (not hardcoded pixels) so it holds at both the 40px desktop and 36px mobile cell sizes. Applied identically in both orientations. The ship still renders as a single continuous hull — no internal gridlines between a ship's own cells — with the board's gridlines now visible around the ship's perimeter.

_Correction (follow-up):_ The initial inset fix shrank the SVG position and dimensions by the inset, set `.cell.ship` / `.cell.sunk` to `background: transparent`, and added a `ship-bg` rect inside the (now smaller) SVG. The tan board-container background (`--sand-100`) bled through the gap between the SVG edge and the cell edge, making ships appear to sit on beige rectangles. Fixed by keeping the outer SVG at the full cell footprint (no inset on position/size) with a `ship-bg` rect that fills all cells with navy, and nesting an inner `<svg>` element at the inset offset to contain the silhouette paths. This way the background rect covers the full cell area (no tan visible) while the paths render with the visual inset margin. Ship cells remain `background: transparent` so the SVG (at z-index 0, behind the table at z-index 1) shows through.

**How it was found.** Manual playtesting of the deployed game after the ship-silhouette feature (PR #7) was merged, not Devin Review. The background bleed-through was caught in a subsequent playtest after the inset fix (PR #8) was merged.

## Known limitations / deliberate scope simplifications

### Hard AI target-mode multi-ship adjacency heuristic

The Hard AI's target-mode rule requires that a consistent placement covers **at least one** unresolved hit. This is correct when all unresolved hits belong to a single ship (the common case). When two adjacent or interleaved ships are partially struck before either sinks, this heuristic can be slightly suboptimal compared to the strict rule requiring every consistent fleet-wide placement to collectively cover **all** unresolved hits across multiple ships simultaneously. The strict version requires materially more code and enumeration cost for a rare regime. v1 ships the simpler rule deliberately.

### Sunk-ship visual is per-cell fill only

v1 renders sunk ships by changing each cell's fill to `--accent-deep`. No single outline is drawn around the entire ship footprint (which would require SVG overlay or computed per-edge borders). This is a noted nice-to-have, not built in v1.

### Touch device placement UX

Hover preview does not exist on touch devices. Touch users get a two-tap flow (tap to preview, tap again to commit). Acceptable for v1.
