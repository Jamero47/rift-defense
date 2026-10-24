import { COLS, GATE_ROW, ROWS } from '../config';
import type { RiftDef } from '../data/rifts';
import { Rng } from './rng';
import type { GridPos } from './types';

// Erzeugt jede Nacht eine neue Karte vor dem Tor.
// Die Wege laufen von rechts (Rift) nach links (Tor) und schlängeln sich auf und ab.

export interface MapData {
  riftId: string;
  /** Feld-IDs, Zugriff mit tiles[row][col] */
  tiles: string[][];
  /** Jeder Weg: Liste von Feldern vom Rift (rechts) bis zum Tor (links) */
  paths: GridPos[][];
}

export function generateMap(rift: RiftDef, pathCount: number, rng: Rng): MapData {
  const tiles: string[][] = Array.from({ length: ROWS }, () => Array<string>(COLS).fill('ground'));
  const paths: GridPos[][] = [];

  const firstStart = rng.int(0, ROWS - 1);
  paths.push(carvePath(firstStart, null, rng));

  if (pathCount >= 2) {
    // Zweiter Weg startet weit entfernt vom ersten und mündet später in ihn.
    const candidates = range(0, ROWS - 1).filter((r) => Math.abs(r - firstStart) >= 4);
    const start = candidates.length > 0 ? rng.pick(candidates) : (firstStart + 4) % ROWS;
    paths.push(carvePath(start, paths[0], rng));
  }

  for (const path of paths) for (const p of path) tiles[p.row][p.col] = 'path';

  placeSpecials(rift, tiles, paths, rng);
  placeObstacles(rift, tiles, rng);

  return { riftId: rift.id, tiles, paths };
}

/**
 * Gräbt einen Weg von der rechten Kante bis zum Tor.
 * Ist `merge` gesetzt, endet der Weg, sobald er auf diesen anderen Weg trifft, und folgt ihm.
 */
function carvePath(startRow: number, merge: GridPos[] | null, rng: Rng): GridPos[] {
  const cells: GridPos[] = [];
  let col = COLS - 1;
  let row = startRow;

  // Gibt den Rest des anderen Wegs zurück, falls wir auf ihn treffen.
  const push = (c: number, r: number): GridPos[] | null => {
    cells.push({ col: c, row: r });
    if (!merge) return null;
    const idx = merge.findIndex((p) => p.col === c && p.row === r);
    return idx >= 0 ? merge.slice(idx + 1) : null;
  };

  let rest = push(col, row);
  if (rest) return [...cells, ...rest];

  while (col > 0) {
    // Ein Stück nach links
    const run = rng.int(2, 3);
    for (let i = 0; i < run && col > 0; i++) {
      col--;
      rest = push(col, row);
      if (rest) return [...cells, ...rest];
    }
    if (col <= 0) break;

    // Dann hoch oder runter. Kurz vor dem Tor geht es zur Torzeile.
    let target: number;
    if (col <= 3) {
      target = GATE_ROW;
    } else {
      const options = range(0, ROWS - 1).filter((r) => Math.abs(r - row) >= 2);
      target = rng.pick(options);
    }
    while (row !== target) {
      row += row < target ? 1 : -1;
      rest = push(col, row);
      if (rest) return [...cells, ...rest];
    }
  }

  // Falls wir in Spalte 0 nicht auf Torhöhe sind (sollte selten passieren): angleichen.
  while (row !== GATE_ROW) {
    row += row < GATE_ROW ? 1 : -1;
    rest = push(col, row);
    if (rest) return [...cells, ...rest];
  }
  return cells;
}

function placeSpecials(rift: RiftDef, tiles: string[][], paths: GridPos[][], rng: Rng): void {
  for (const spec of rift.generation.specials) {
    const count = rng.int(spec.count[0], spec.count[1]);
    if (spec.on === 'path') {
      const main = paths[0];
      for (let n = 0; n < count; n++) {
        // Nicht direkt am Rift und nicht direkt am Tor
        const startIdx = rng.int(3, Math.max(3, main.length - 4 - (spec.length ?? 1)));
        for (let k = 0; k < (spec.length ?? 1); k++) {
          const p = main[startIdx + k];
          if (p && tiles[p.row][p.col] === 'path') tiles[p.row][p.col] = spec.tile;
        }
      }
    } else {
      // Bau-Felder direkt neben dem Weg, damit sie nützlich sind
      const candidates = shuffled(
        allCells().filter((c) => tiles[c.row][c.col] === 'ground' && nearPath(tiles, c, rift)),
        rng,
      );
      for (const c of candidates.slice(0, count)) tiles[c.row][c.col] = spec.tile;
    }
  }
}

function placeObstacles(rift: RiftDef, tiles: string[][], rng: Rng): void {
  const gen = rift.generation;
  for (const c of allCells()) {
    if (tiles[c.row][c.col] !== 'ground') continue;
    // Neben dem Weg weniger Hindernisse, damit genug Bauplätze bleiben
    const factor = nearPath(tiles, c, rift) ? 0.35 : 1;
    const roll = rng.next();
    if (roll < gen.resourceDensity * factor) {
      tiles[c.row][c.col] = rng.weighted(gen.resourceTiles as Record<string, number>);
    } else if (gen.blockedTiles.length > 0 && roll < (gen.resourceDensity + gen.blockedDensity) * factor) {
      tiles[c.row][c.col] = rng.pick(gen.blockedTiles);
    }
  }
}

/** Liegt das Feld direkt (auch diagonal) neben einem Wegfeld? */
export function nearPath(tiles: string[][], c: GridPos, rift: RiftDef): boolean {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const id = tiles[c.row + dr]?.[c.col + dc];
      if (id && rift.tiles[id]?.path) return true;
    }
  }
  return false;
}

function allCells(): GridPos[] {
  const out: GridPos[] = [];
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) out.push({ col, row });
  return out;
}

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

function shuffled<T>(list: T[], rng: Rng): T[] {
  return rng.shuffle([...list]);
}

/** Wie viele abbaubare Rohstoff-Felder liegen auf der Karte? */
export function countResourceTiles(map: MapData, rift: RiftDef): number {
  let n = 0;
  for (const row of map.tiles) for (const id of row) if (rift.tiles[id]?.harvest) n++;
  return n;
}
