import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { generateWaves, hpMultiplier, waveBudget, wavesForNight } from '../src/core/wavegen';
import { getEnemy } from '../src/data/enemies';
import { RIFTS } from '../src/data/rifts';

describe('Wellen', () => {
  it('Schwierigkeit steigt mit Welle und Nacht', () => {
    expect(hpMultiplier(1, 2)).toBeGreaterThan(hpMultiplier(1, 1));
    expect(hpMultiplier(2, 1)).toBeGreaterThan(hpMultiplier(1, 1));
    expect(waveBudget(1, 5)).toBeGreaterThan(waveBudget(1, 4));
    expect(waveBudget(3, 1)).toBeGreaterThan(waveBudget(2, 1));
    expect(wavesForNight(10)).toBeGreaterThanOrEqual(wavesForNight(1));
  });

  for (const rift of RIFTS) {
    it(`${rift.id}: letzte Welle hat einen Boss, Luftwellen haben Fluggegner`, () => {
      for (let night = 1; night <= 15; night++) {
        const waves = generateWaves(night, rift, night >= 4 ? 2 : 1, new Rng(night * 7));
        expect(waves).toHaveLength(wavesForNight(night));
        const last = waves[waves.length - 1];
        expect(last.isBoss).toBe(true);
        expect(last.groups.some((g) => getEnemy(g.enemyId).boss)).toBe(true);
        for (const w of waves) {
          const air = w.groups.filter((g) => getEnemy(g.enemyId).flying);
          if (w.hasAir) expect(air.length).toBeGreaterThan(0);
          for (const g of w.groups) {
            expect(g.count).toBeGreaterThan(0);
            expect(g.route === -1).toBe(getEnemy(g.enemyId).flying);
            expect(rift.enemies.normal.concat(rift.enemies.fast, rift.enemies.tank, rift.enemies.air, rift.enemies.special, rift.enemies.boss)).toContain(g.enemyId);
          }
        }
      }
    });
  }

  it('nicht jede Welle hat Fluggegner', () => {
    const waves = generateWaves(1, RIFTS[0], 1, new Rng(1));
    expect(waves.some((w) => !w.hasAir)).toBe(true);
    expect(waves.some((w) => w.hasAir)).toBe(true);
  });
});
