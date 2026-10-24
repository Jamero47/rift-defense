import { describe, expect, it } from 'vitest';
import { COLS, GATE_ROW, ROWS } from '../src/config';
import { generateMap, nearPath } from '../src/core/mapgen';
import { Rng } from '../src/core/rng';
import { RIFTS } from '../src/data/rifts';

describe('Kartengenerator', () => {
  for (const rift of RIFTS) {
    for (const pathCount of [1, 2]) {
      it(`${rift.id}, ${pathCount} Weg(e): zusammenhängende Wege vom Rift zum Tor`, () => {
        for (let seed = 1; seed <= 200; seed++) {
          const map = generateMap(rift, pathCount, new Rng(seed));
          expect(map.paths).toHaveLength(pathCount);
          for (const path of map.paths) {
            expect(path[0].col).toBe(COLS - 1);
            const last = path[path.length - 1];
            expect(last).toEqual({ col: 0, row: GATE_ROW });
            for (let i = 1; i < path.length; i++) {
              const d = Math.abs(path[i].col - path[i - 1].col) + Math.abs(path[i].row - path[i - 1].row);
              expect(d).toBe(1);
            }
            const keys = new Set(path.map((p) => `${p.col},${p.row}`));
            expect(keys.size).toBe(path.length);
            for (const p of path) {
              expect(p.row).toBeGreaterThanOrEqual(0);
              expect(p.row).toBeLessThan(ROWS);
              expect(rift.tiles[map.tiles[p.row][p.col]].path).toBe(true);
            }
          }
        }
      });
    }

    it(`${rift.id}: genug Bauplätze direkt am Weg`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const map = generateMap(rift, 1, new Rng(seed));
        let buildable = 0;
        for (let row = 0; row < ROWS; row++) {
          for (let col = 0; col < COLS; col++) {
            const tile = rift.tiles[map.tiles[row][col]];
            expect(tile, `Feld ${map.tiles[row][col]}`).toBeDefined();
            if (tile.buildable && nearPath(map.tiles, { col, row }, rift)) buildable++;
          }
        }
        expect(buildable).toBeGreaterThanOrEqual(15);
      }
    });
  }

  it('gleicher Seed ergibt gleiche Karte', () => {
    const a = generateMap(RIFTS[0], 2, new Rng(42));
    const b = generateMap(RIFTS[0], 2, new Rng(42));
    expect(a).toEqual(b);
  });
});
