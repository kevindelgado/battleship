/** Ship definitions and fleet helpers. Zero DOM references. */

export const FLEET = [
  { id: 'carrier', name: 'Carrier', length: 5 },
  { id: 'battleship', name: 'Battleship', length: 4 },
  { id: 'cruiser', name: 'Cruiser', length: 3 },
  { id: 'submarine', name: 'Submarine', length: 3 },
  { id: 'destroyer', name: 'Destroyer', length: 2 },
];

export function createShip(def, cells) {
  return {
    id: def.id,
    name: def.name,
    length: def.length,
    cells: cells.map(({ r, c }) => ({ r, c })),
    hits: new Set(),
  };
}

export function isSunk(ship) {
  return ship.hits.size === ship.length;
}

export function allSunk(ships) {
  return ships.every(isSunk);
}
