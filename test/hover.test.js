import { describe, it, expect } from 'vitest';
import { Window } from 'happy-dom';
import { renderBoard } from '../src/ui/render.js';
import { getPlacementPreview } from '../src/ui/input.js';
import { createInitialState } from '../src/logic/game.js';

describe('Placement hover preview with event delegation', () => {
  it('tracks hover on new cells even after renderBoard rebuilds innerHTML', () => {
    const window = new Window();
    const document = window.document;

    // Provide minimal globals needed by render.js
    globalThis.document = document;

    const state = createInitialState();

    const board = document.createElement('div');
    board.className = 'board-container';
    document.body.appendChild(board);

    let lastPreview = null;

    const onCellClick = () => {};

    // Render the board initially
    renderBoard(board, state, state.player, true, onCellClick, null);

    // Attach delegated mouseover listener on the parent (mirrors main.js fix)
    board.addEventListener('mouseover', (e) => {
      const td = e.target.closest('td');
      if (!td || state.phase !== 'placement') return;
      const r = parseInt(td.dataset.r);
      const c = parseInt(td.dataset.c);
      lastPreview = getPlacementPreview(state, r, c);

      // Re-render the board (this replaces innerHTML, destroying old <td>s)
      renderBoard(board, state, state.player, true, onCellClick, lastPreview);
    });

    // Simulate hovering over a cell
    const firstTd = board.querySelector('td[data-r="0"][data-c="0"]');
    expect(firstTd).not.toBeNull();
    firstTd.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }));

    expect(lastPreview).not.toBeNull();
    expect(lastPreview.cells.length).toBeGreaterThan(0);

    // After first hover, renderBoard rebuilt the DOM.
    // With the old per-cell handler approach the listeners would be gone.
    // With event delegation, hovering a new cell should still work.
    const secondTd = board.querySelector('td[data-r="3"][data-c="3"]');
    expect(secondTd).not.toBeNull();

    lastPreview = null;
    secondTd.dispatchEvent(
      new window.MouseEvent('mouseover', { bubbles: true }),
    );

    expect(lastPreview).not.toBeNull();
    expect(lastPreview.cells.length).toBeGreaterThan(0);

    // Clean up global
    delete globalThis.document;
  });
});
