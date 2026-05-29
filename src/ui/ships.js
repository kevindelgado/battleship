/** Ship SVG silhouette definitions and overlay rendering. DOM module. */

import { isSunk } from '../logic/fleet.js';

// ---------------------------------------------------------------------------
// SVG path data — one silhouette per ship type, drawn in horizontal
// orientation. viewBox width = ship.length × 100, height = 100.
// ---------------------------------------------------------------------------

export const SILHOUETTES = {
  carrier: {
    viewBox: '0 0 500 100',
    paths: [
      // Hull + flight deck (flat top, angled bow ramp, squared stern)
      'M8 75 L14 84 L480 84 L492 75 L492 40 L480 35 L30 35 L14 28 L8 36 Z',
      // Island / bridge tower
      'M350 35 L350 16 L400 16 L400 35',
    ],
  },
  battleship: {
    viewBox: '0 0 400 100',
    paths: [
      // Hull
      'M8 74 L16 84 L384 84 L392 74 L392 48 L384 42 L16 42 L8 48 Z',
      // Superstructure / bridge
      'M155 42 L155 22 L200 16 L245 22 L245 42',
      // Forward gun turret
      'M52 42 L48 34 L96 34 L92 42',
      // Aft gun turret
      'M296 42 L292 34 L340 34 L336 42',
    ],
  },
  cruiser: {
    viewBox: '0 0 300 100',
    paths: [
      // Hull (sleek, narrower than battleship)
      'M8 72 L14 82 L286 82 L292 72 L292 48 L286 42 L14 42 L8 48 Z',
      // Bridge
      'M118 42 L122 24 L178 24 L182 42',
      // Forward gun turret
      'M34 42 L30 34 L72 34 L68 42',
    ],
  },
  submarine: {
    viewBox: '0 0 300 100',
    paths: [
      // Cigar-shaped hull with rounded ends
      'M22 56 Q6 67 22 78 L56 86 L244 86 L278 78 Q294 67 278 56 L244 48 L56 48 Z',
      // Conning tower / sail
      'M128 48 L133 26 L167 26 L172 48',
      // Periscope
      'M148 26 L148 14 L155 14 L155 26',
    ],
  },
  destroyer: {
    viewBox: '0 0 200 100',
    paths: [
      // Hull (compact, sharp bow)
      'M6 68 L12 80 L188 80 L194 68 L194 50 L188 44 L12 44 L6 50 Z',
      // Bridge / wheelhouse
      'M70 44 L70 26 L130 26 L130 44',
    ],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Determine ship orientation from its cell array. */
export function getShipOrientation(ship) {
  if (ship.cells.length < 2) return 'horizontal';
  return ship.cells[0].r === ship.cells[1].r ? 'horizontal' : 'vertical';
}

/** Return the top-left cell of a ship. */
function getShipOrigin(ship) {
  let minR = ship.cells[0].r;
  let minC = ship.cells[0].c;
  for (const cell of ship.cells) {
    if (cell.r < minR) minR = cell.r;
    if (cell.c < minC) minC = cell.c;
  }
  return { r: minR, c: minC };
}

// ---------------------------------------------------------------------------
// SVG element creation
// ---------------------------------------------------------------------------

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Fraction of cell size used as inset so gridlines remain visible. */
const INSET_RATIO = 0.06;

function createShipSVG(ship, x, y, cellW, cellH, sunk) {
  const silhouette = SILHOUETTES[ship.id];
  if (!silhouette) return null;

  const orientation = getShipOrientation(ship);
  const svg = document.createElementNS(SVG_NS, 'svg');

  svg.classList.add('ship-svg');
  svg.classList.add(sunk ? 'ship-svg-sunk' : 'ship-svg-own');

  // Inset proportional to cell size so the board gridlines stay visible.
  const inset = Math.min(cellW, cellH) * INSET_RATIO;

  // Outer SVG covers the FULL cell footprint (no inset on position/size)
  // so the ship-bg rect fills all cells with navy, preventing the tan
  // board-container background from bleeding through the inset gap.
  // A nested <svg> inside provides the visual inset for the paths.
  const fullW = orientation === 'horizontal'
    ? ship.length * cellW : cellW;
  const fullH = orientation === 'horizontal'
    ? cellH : ship.length * cellH;

  svg.style.position = 'absolute';
  svg.style.left = `${x}px`;
  svg.style.top = `${y}px`;
  svg.style.pointerEvents = 'none';
  svg.setAttribute('width', String(fullW));
  svg.setAttribute('height', String(fullH));
  svg.setAttribute('viewBox', `0 0 ${fullW} ${fullH}`);

  // Background rect matching ocean / sunk color, fills the full cell
  // footprint so no container background shows through the inset gap.
  const bg = document.createElementNS(SVG_NS, 'rect');
  bg.classList.add('ship-bg');
  bg.setAttribute('width', String(fullW));
  bg.setAttribute('height', String(fullH));
  svg.appendChild(bg);

  // Inner SVG for silhouette paths, inset within the outer SVG.
  const inner = document.createElementNS(SVG_NS, 'svg');
  inner.setAttribute('x', String(inset));
  inner.setAttribute('y', String(inset));
  inner.setAttribute('width', String(fullW - 2 * inset));
  inner.setAttribute('height', String(fullH - 2 * inset));

  const [, , vbW, vbH] = silhouette.viewBox.split(' ').map(Number);

  let pathParent = inner; // paths attach here (directly or via <g>)

  if (orientation === 'horizontal') {
    inner.setAttribute('viewBox', silhouette.viewBox);
  } else {
    // Vertical: swap viewBox dimensions and rotate the content.
    inner.setAttribute('viewBox', `0 0 ${vbH} ${vbW}`);

    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('transform', `translate(0, ${vbW}) rotate(-90)`);
    inner.appendChild(g);
    pathParent = g;
  }

  svg.appendChild(inner);

  for (const d of silhouette.paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    pathParent.appendChild(path);
  }

  return svg;
}

// ---------------------------------------------------------------------------
// Public: render ship overlays into a board container
// ---------------------------------------------------------------------------

/**
 * Render SVG silhouettes for visible ships inside the given board container.
 * Must be called AFTER the container (and its table) is in the DOM so that
 * getBoundingClientRect returns valid dimensions.
 *
 * @param {HTMLElement} container  The .board-container element
 * @param {object}      state     Game state
 * @param {boolean}     isOwn     true = player board, false = enemy board
 */
export function renderShipOverlays(container, state, isOwn) {
  const ships = isOwn ? state.player.ships : state.ai.ships;

  // Player ships: always shown.  Enemy ships: only when sunk.
  const visible = isOwn ? ships : ships.filter((s) => isSunk(s));
  if (visible.length === 0) return;

  const table = container.querySelector('table');
  if (!table) return;

  // Derive cell size and grid origin from the first data cell.
  const cell00 = table.querySelector('td[data-r="0"][data-c="0"]');
  if (!cell00) return;

  const containerRect = container.getBoundingClientRect();
  const cellRect = cell00.getBoundingClientRect();
  const originX = cellRect.left - containerRect.left;
  const originY = cellRect.top - containerRect.top;
  const cellW = cellRect.width;
  const cellH = cellRect.height;

  const overlay = document.createElement('div');
  overlay.className = 'ship-svg-overlay';

  for (const ship of visible) {
    const origin = getShipOrigin(ship);
    const x = originX + origin.c * cellW;
    const y = originY + origin.r * cellH;
    const sunk = isSunk(ship);

    const svg = createShipSVG(ship, x, y, cellW, cellH, sunk, isOwn);
    if (svg) overlay.appendChild(svg);
  }

  container.appendChild(overlay);
}
