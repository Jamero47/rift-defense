import { describe, expect, it } from 'vitest';
import { deepMerge, diff } from '../src/core/mod';
import { TOWERS } from '../src/data/towers';
import { BUILDINGS } from '../src/data/buildings';

describe('Toolbox-Änderungen', () => {
  it('speichert nur Unterschiede und stellt sie wieder her', () => {
    const base = structuredClone(TOWERS);
    const edited = structuredClone(TOWERS);
    edited[0].levels[1].physDamage = 99;
    edited[2].name = 'Zauberturm';
    const d = diff(base, edited) as { id: string }[];
    expect(d).toHaveLength(2);
    expect(JSON.stringify(d)).not.toContain('cannon');
    const restored = structuredClone(TOWERS);
    deepMerge(restored, d);
    expect(restored).toEqual(edited);
  });

  it('Kosten-Felder können ergänzt und entfernt werden', () => {
    const base = structuredClone(BUILDINGS);
    const edited = structuredClone(BUILDINGS);
    const levels = edited[0].levels as Record<string, number>[];
    levels[0].gold = 5;
    delete levels[0].holz;
    const restored = structuredClone(BUILDINGS);
    deepMerge(restored, diff(base, edited));
    expect(restored).toEqual(edited);
  });

  it('keine Änderung = nichts gespeichert', () => {
    expect(diff(TOWERS, structuredClone(TOWERS))).toBeUndefined();
  });
});
