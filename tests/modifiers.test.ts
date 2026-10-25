import { describe, expect, it } from 'vitest';
import { Modifiers, describeModifier, scaleModifiers } from '../src/core/modifiers';

describe('Modifikatoren', () => {
  it('rechnet (Basis + fest) × (1 + Prozent)', () => {
    const m = new Modifiers([
      { stat: 'damage', kind: 'pct', value: 0.1 },
      { stat: 'damage', kind: 'pct', value: 0.2, towerTags: ['bow'] },
      { stat: 'damage', kind: 'flat', value: 5 },
    ]);
    expect(m.apply('damage', 10, ['cannon'])).toBeCloseTo(15 * 1.1);
    expect(m.apply('damage', 10, ['bow', 'projectile'])).toBeCloseTo(15 * 1.3);
  });

  it('Turm-Boni gelten nicht für allgemeine Werte', () => {
    const m = new Modifiers([{ stat: 'crystalGain', kind: 'pct', value: 0.2, towerTags: ['bow'] }]);
    expect(m.pct('crystalGain')).toBe(0);
  });

  it('nie unter 0', () => {
    const m = new Modifiers([{ stat: 'towerCost', kind: 'pct', value: -2 }]);
    expect(m.apply('towerCost', 100)).toBe(0);
  });

  it('skaliert pro Gebäudestufe und beschreibt auf Deutsch', () => {
    const [mod] = scaleModifiers([{ stat: 'damage', kind: 'pct', value: 0.1, towerTags: ['bow'] }], 3);
    expect(mod.value).toBeCloseTo(0.3);
    expect(describeModifier(mod)).toBe('+30 % Schaden (Bogentürme)');
    expect(describeModifier({ stat: 'projectiles', kind: 'flat', value: 1 })).toBe('+1 Projektil(e)');
  });
});

describe('Glück', () => {
  it('macht seltene Karten wahrscheinlicher', async () => {
    const { rarityChance } = await import('../src/core/draft');
    expect(rarityChance(5, 'legendary')).toBeGreaterThan(rarityChance(0, 'legendary'));
    expect(rarityChance(5, 'common')).toBeLessThan(rarityChance(0, 'common'));
    expect(rarityChance(1000, 'common')).toBeGreaterThan(0);
  });
});
