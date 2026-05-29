/** Bootstrap: build initial state, wire events, game loop. DOM module. */

import {
  createInitialState,
  applyShot,
  switchTurn,
  startGame,
} from '../logic/game.js';
import { chooseShot, updateAIAfterShot } from '../logic/ai/index.js';
import { renderBoard, renderStatus } from './render.js';
import {
  getPlacementPreview,
  placeShip,
  undoPlacement,
  toggleOrientation,
  selectShip,
} from './input.js';
import { FLEET } from '../logic/fleet.js';
import {
  buildOccupiedSet,
  shipCells,
  isLegalPlacement,
} from '../logic/placement.js';
import { cellKey } from '../logic/board.js';
import { seededRng } from '../logic/rng.js';

let state = createInitialState();
let placementPreview = null;
let hoverR = -1;
let hoverC = -1;
let waitingForTurn = false;
const pendingTurnTimers = new Set();

function scheduleTurn(fn, ms) {
  const id = setTimeout(() => {
    pendingTurnTimers.delete(id);
    fn();
  }, ms);
  pendingTurnTimers.add(id);
}

function cancelPendingTurnTimers() {
  for (const id of pendingTurnTimers) {
    clearTimeout(id);
  }
  pendingTurnTimers.clear();
}

function render() {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = '';

  if (state.phase === 'placement') {
    renderPlacementUI(app);
  } else {
    renderGameUI(app);
  }

  renderStatus(state);
}

function renderPlacementUI(app) {
  const container = document.createElement('div');
  container.className = 'game-layout';

  // Player board
  const playerSection = document.createElement('div');
  playerSection.className = 'board-section';
  const playerTitle = document.createElement('h2');
  playerTitle.textContent = 'Your Fleet';
  playerSection.appendChild(playerTitle);

  const playerBoard = document.createElement('div');
  playerBoard.className = 'board-container';
  playerSection.appendChild(playerBoard);

  container.appendChild(playerSection);

  // Side panel
  const panel = document.createElement('div');
  panel.className = 'placement-panel';

  // Difficulty selector
  const diffGroup = document.createElement('div');
  diffGroup.className = 'control-group';
  const diffLabel = document.createElement('label');
  diffLabel.textContent = 'Difficulty: ';
  const diffSelect = document.createElement('select');
  diffSelect.id = 'difficulty-select';
  for (const d of ['easy', 'medium', 'hard']) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d.charAt(0).toUpperCase() + d.slice(1);
    if (d === state.difficulty) opt.selected = true;
    diffSelect.appendChild(opt);
  }
  diffSelect.addEventListener('change', (e) => {
    state.difficulty = e.target.value;
  });
  diffGroup.appendChild(diffLabel);
  diffGroup.appendChild(diffSelect);
  panel.appendChild(diffGroup);

  // First move selector
  const fmGroup = document.createElement('div');
  fmGroup.className = 'control-group';
  const fmLabel = document.createElement('label');
  fmLabel.textContent = 'First move: ';
  const fmSelect = document.createElement('select');
  fmSelect.id = 'first-move-select';
  for (const fm of ['player', 'ai', 'random']) {
    const opt = document.createElement('option');
    opt.value = fm;
    opt.textContent =
      fm === 'player' ? 'Player' : fm === 'ai' ? 'AI' : 'Random';
    if (fm === state.firstMove) opt.selected = true;
    fmSelect.appendChild(opt);
  }
  fmSelect.addEventListener('change', (e) => {
    state.firstMove = e.target.value;
  });
  fmGroup.appendChild(fmLabel);
  fmGroup.appendChild(fmSelect);
  panel.appendChild(fmGroup);

  // Ship list
  const shipList = document.createElement('div');
  shipList.className = 'ship-list';
  const shipListTitle = document.createElement('h3');
  shipListTitle.textContent = 'Ships to place';
  shipList.appendChild(shipListTitle);

  for (const def of FLEET) {
    const item = document.createElement('div');
    item.className = 'ship-item';
    const placed = state.player.ships.some((s) => s.id === def.id);
    if (placed) {
      item.classList.add('placed');
    } else {
      if (state.placement.selectedId === def.id) {
        item.classList.add('active');
      }
      item.addEventListener('click', () => {
        selectShip(state, def.id);
        placementPreview = null;
        hoverR = -1;
        hoverC = -1;
        render();
      });
    }

    const nameSpan = document.createElement('span');
    nameSpan.className = 'ship-name';
    nameSpan.textContent = `${def.name} (${def.length})`;

    const dots = document.createElement('span');
    dots.className = 'ship-dots';
    dots.textContent = '●'.repeat(def.length);

    const check = document.createElement('span');
    check.className = 'ship-check';
    check.textContent = placed ? '✓' : '';

    item.appendChild(nameSpan);
    item.appendChild(dots);
    item.appendChild(check);
    shipList.appendChild(item);
  }
  panel.appendChild(shipList);

  // Orientation toggle
  const orientBtn = document.createElement('button');
  orientBtn.className = 'btn';
  orientBtn.textContent = `Orientation: ${state.placement.orientation === 'horizontal' ? 'Horizontal' : 'Vertical'}`;
  orientBtn.addEventListener('click', () => {
    toggleOrientation(state);
    render();
  });
  panel.appendChild(orientBtn);

  // Auto-place button
  const autoBtn = document.createElement('button');
  autoBtn.className = 'btn';
  autoBtn.textContent = 'Auto-place';
  autoBtn.addEventListener('click', () => {
    autoPlaceRemaining();
    render();
  });
  panel.appendChild(autoBtn);

  // Undo button
  const undoBtn = document.createElement('button');
  undoBtn.className = 'btn';
  undoBtn.textContent = 'Undo';
  undoBtn.disabled = state.player.ships.length === 0;
  undoBtn.addEventListener('click', () => {
    undoPlacement(state);
    render();
  });
  panel.appendChild(undoBtn);

  // Start Game button
  const startBtn = document.createElement('button');
  startBtn.className = 'btn btn-primary';
  startBtn.textContent = 'Start Game';
  startBtn.disabled = state.placement.queue.length > 0;
  startBtn.addEventListener('click', () => {
    startGame(state);
    render();
    if (state.turn === 'ai') {
      scheduleTurn(doAITurn, 500);
    }
  });
  panel.appendChild(startBtn);

  container.appendChild(panel);
  app.appendChild(container);

  // Render player board with placement handlers
  renderBoard(
    playerBoard,
    state,
    state.player,
    true,
    (r, c) => {
      if (state.phase !== 'placement') return;
      if (placeShip(state, r, c)) {
        placementPreview = null;
        render();
      }
    },
    placementPreview,
  );

  // Event-delegated hover handlers for placement preview
  playerBoard.addEventListener('mouseover', (e) => {
    const td = e.target.closest('td');
    if (!td || state.phase !== 'placement') return;
    const r = parseInt(td.dataset.r);
    const c = parseInt(td.dataset.c);
    if (r === hoverR && c === hoverC) return;
    hoverR = r;
    hoverC = c;
    placementPreview = getPlacementPreview(state, r, c);
    renderBoard(
      playerBoard,
      state,
      state.player,
      true,
      (r2, c2) => {
        if (state.phase !== 'placement') return;
        if (placeShip(state, r2, c2)) {
          placementPreview = null;
          render();
        }
      },
      placementPreview,
    );
  });
  playerBoard.addEventListener('mouseout', (e) => {
    const related = e.relatedTarget;
    if (related && playerBoard.contains(related)) return;
    placementPreview = null;
    hoverR = -1;
    hoverC = -1;
    renderBoard(
      playerBoard,
      state,
      state.player,
      true,
      (r2, c2) => {
        if (state.phase !== 'placement') return;
        if (placeShip(state, r2, c2)) {
          placementPreview = null;
          render();
        }
      },
      null,
    );
  });
}

function autoPlaceRemaining() {
  const rng = seededRng(Date.now());
  const remaining = state.placement.queue.map((id) =>
    FLEET.find((f) => f.id === id),
  );

  const occupied = buildOccupiedSet(state.player.ships);

  for (const def of remaining) {
    let placed = false;
    for (let attempt = 0; attempt < 1000 && !placed; attempt++) {
      const orientation = rng() < 0.5 ? 'horizontal' : 'vertical';
      const maxR = orientation === 'vertical' ? 10 - def.length : 9;
      const maxC = orientation === 'horizontal' ? 10 - def.length : 9;
      const r = Math.floor(rng() * (maxR + 1));
      const c = Math.floor(rng() * (maxC + 1));
      const cells = shipCells(r, c, def.length, orientation);

      if (isLegalPlacement(cells, occupied)) {
        state.player.ships.push({
          id: def.id,
          name: def.name,
          length: def.length,
          cells,
          hits: new Set(),
        });
        for (const cell of cells) {
          occupied.add(cellKey(cell.r, cell.c));
        }
        placed = true;
      }
    }
  }

  state.placement.queue = [];
  state.placement.selectedId = null;
  state.status = 'All ships placed. Press Start Game!';
}

function renderGameUI(app) {
  const container = document.createElement('div');
  container.className = 'game-layout';

  // Player board
  const playerSection = document.createElement('div');
  playerSection.className = 'board-section';
  const playerTitle = document.createElement('h2');
  playerTitle.textContent = 'Your Fleet';
  playerSection.appendChild(playerTitle);

  const playerBoard = document.createElement('div');
  playerBoard.className = 'board-container';
  playerSection.appendChild(playerBoard);

  renderBoard(playerBoard, state, state.player, true, null, null);

  container.appendChild(playerSection);

  // Enemy board
  const enemySection = document.createElement('div');
  enemySection.className = 'board-section';
  const enemyTitle = document.createElement('h2');
  enemyTitle.textContent = 'Enemy Waters';
  enemySection.appendChild(enemyTitle);

  const enemyBoard = document.createElement('div');
  enemyBoard.className = 'board-container';
  enemySection.appendChild(enemyBoard);

  // Apply disabled visual when player cannot fire
  if (
    state.phase !== 'playing' ||
    state.turn !== 'player' ||
    waitingForTurn
  ) {
    enemyBoard.classList.add('board-disabled');
  }

  renderBoard(
    enemyBoard,
    state,
    state.ai,
    false,
    (r, c) => {
      if (state.phase !== 'playing' || state.turn !== 'player') return;
      if (waitingForTurn) return;
      const key = cellKey(r, c);
      if (state.player.shots.has(key)) return;

      applyShot(state, 'player', r, c);
      render();

      if (state.phase === 'gameover') return;

      waitingForTurn = true;
      scheduleTurn(() => {
        waitingForTurn = false;
        if (state.phase !== 'playing') return;
        switchTurn(state);
        render();

        if (state.turn === 'ai') {
          scheduleTurn(doAITurn, 500);
        }
      }, 900);
    },
    null,
  );

  // Delegated hover for enemy board targeting feedback
  enemyBoard.addEventListener('mouseover', (e) => {
    const td = e.target.closest('td');
    if (!td) return;
    if (
      state.phase !== 'playing' ||
      state.turn !== 'player' ||
      waitingForTurn
    )
      return;
    if (!td.classList.contains('water')) return;
    td.classList.add('target-hover');
  });
  enemyBoard.addEventListener('mouseout', (e) => {
    const td = e.target.closest('td');
    if (!td) return;
    td.classList.remove('target-hover');
  });

  container.appendChild(enemySection);
  app.appendChild(container);
}

function doAITurn() {
  if (state.phase !== 'playing' || state.turn !== 'ai') return;

  const rng = seededRng(Date.now());
  const shot = chooseShot(state, rng);
  if (!shot) return;

  const { result, sunkShip } = applyShot(state, 'ai', shot.r, shot.c);
  updateAIAfterShot(state, shot.r, shot.c, result, sunkShip);
  render();

  if (state.phase === 'gameover') return;

  scheduleTurn(() => {
    if (state.phase !== 'playing') return;
    switchTurn(state);
    render();
  }, 900);
}

// Keyboard handler
document.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') {
    if (state.phase === 'placement') {
      toggleOrientation(state);
      if (hoverR >= 0 && hoverC >= 0) {
        placementPreview = getPlacementPreview(state, hoverR, hoverC);
      }
      render();
    }
  }
});

// Restart handler
document.addEventListener('click', (e) => {
  if (e.target.id === 'restart-link') {
    e.preventDefault();
    cancelPendingTurnTimers();
    waitingForTurn = false;
    state = createInitialState();
    placementPreview = null;
    hoverR = -1;
    hoverC = -1;
    render();
  }
});

// Initial render
render();
