import { describe, expect, it } from 'vitest';
import { TOWERS } from '../src/data/towers';

describe('Türme', () => {
  it('Stufe 1–3 ohne Forschung, 5 Stufen insgesamt', () => {
    for (const t of TOWERS) {
      expect(t.baseMaxLevel, t.id).toBe(3);
      expect(t.levels, t.id).toHaveLength(5);
    }
  });

  it('Stufe 2 und 3 erhöhen nur Grundwerte (Spezialwerte wie Stufe 1)', () => {
    const special = ['splashRadius', 'slow', 'chainTargets', 'poison', 'knockback', 'silence'] as const;
    for (const t of TOWERS) {
      for (const key of special) {
        expect(t.levels[1][key], `${t.id} ${key}`).toEqual(t.levels[0][key]);
        expect(t.levels[2][key], `${t.id} ${key}`).toEqual(t.levels[0][key]);
      }
      for (let i = 1; i < 5; i++) expect(t.levels[i].physDamage + t.levels[i].magicDamage, t.id).toBeGreaterThanOrEqual(t.levels[i - 1].physDamage + t.levels[i - 1].magicDamage);
    }
  });
});
