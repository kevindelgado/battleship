/** Render boards + status from state. DOM module. */

import { ROWS, COLS, COLUMNS, cellKey } from '../logic/board.js';
import { isSunk } from '../logic/fleet.js';

function cellClass(key, side, ships, isOwn) {
  const sunkShipCell = ships.find(
    (s) => isSunk(s) && s.cells.some((c) => cellKey(c.r, c.c) === key),
  );
  if (sunkShipCell) return 'cell sunk';

  const shotResult = side.shots.get(key);
  if (shotResult === 'hit') return 'cell hit';
  if (shotResult === 'miss') return 'cell miss';

  if (isOwn) {
    const onShip = ships.some((s) =>
      s.cells.some((c) => cellKey(c.r, c.c) === key),
    );
    if (onShip) return 'cell ship';
  }

  return 'cell water';
}

export function renderBoard(
  container,
  state,
  side,
  isOwn,
  onCellClick,
  placementPreview,
) {
  container.innerHTML = '';

  const table = document.createElement('table');
  table.className = 'board';

  // Header row with column labels
  const headerRow = document.createElement('tr');
  const emptyTh = document.createElement('th');
  headerRow.appendChild(emptyTh);
  for (let c = 0; c < COLS; c++) {
    const th = document.createElement('th');
    th.textContent = COLUMNS[c];
    th.className = 'col-label';
    headerRow.appendChild(th);
  }
  table.appendChild(headerRow);

  const ships = isOwn ? state.player.ships : state.ai.ships;

  for (let r = 0; r < ROWS; r++) {
    const tr = document.createElement('tr');
    const rowLabel = document.createElement('th');
    rowLabel.textContent = String(r + 1);
    rowLabel.className = 'row-label';
    tr.appendChild(rowLabel);

    for (let c = 0; c < COLS; c++) {
      const td = document.createElement('td');
      const key = cellKey(r, c);

      const displaySide = isOwn
        ? { shots: state.ai.shots }
        : { shots: state.player.shots };

      td.className = cellClass(key, displaySide, ships, isOwn);
      td.dataset.r = r;
      td.dataset.c = c;

      // Placement preview
      if (placementPreview) {
        const previewCell = placementPreview.cells.find(
          (pc) => pc.r === r && pc.c === c,
        );
        if (previewCell) {
          td.classList.add(
            placementPreview.legal ? 'preview-ok' : 'preview-bad',
          );
        }
      }

      if (onCellClick) {
        td.addEventListener('click', () => onCellClick(r, c));
      }
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }

  container.appendChild(table);
}

export function renderStatus(state) {
  const el = document.getElementById('status');
  if (el) el.textContent = state.status;
}
