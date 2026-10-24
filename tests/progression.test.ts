import { describe, expect, it } from 'vitest';
import { rollCards } from '../src/core/draft';
import { buildingCost, buildingModifiers, computeRewards, riftForNight, setupNight } from '../src/core/progression';
import { Rng } from '../src/core/rng';
import { SaveStore, migrateSave, type KeyValueStorage } from '../src/core/save';
import { BUILDINGS, getBuilding } from '../src/data/buildings';
import { CARDS } from '../src/data/cards';

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

describe('Fortschritt', () => {
  it('Nacht 1–3 stellen die drei Rifts vor, danach nie zweimal gleich hintereinander', () => {
    expect(riftForNight(1, 1).id).toBe('urzeit');
    expect(riftForNight(1, 2).id).toBe('tech');
    expect(riftForNight(1, 3).id).toBe('weltraum');
    for (let n = 4; n < 40; n++) expect(riftForNight(99, n).id).not.toBe(riftForNight(99, n - 1).id);
  });

  it('dieselbe Nacht ergibt beim Neustart dieselbe Karte', () => {
    expect(setupNight(123, 5)).toEqual(setupNight(123, 5));
  });

  it('Gebäude: Kosten steigen, Boni wachsen mit der Stufe', () => {
    const def = getBuilding('bogenmacher');
    expect(buildingCost(def, 1).holz).toBeGreaterThan(buildingCost(def, 0).holz);
    const mods = buildingModifiers({ bogenmacher: 2 });
    expect(mods.find((m) => m.stat === 'damage')?.value).toBeCloseTo(0.2);
    for (const b of BUILDINGS) expect(b.modifiers || b.income).toBeTruthy();
  });

  it('Belohnung: Sieg > Niederlage, Holzfäller liefert immer', () => {
    const setup = setupNight(5, 1);
    const args = { rift: setup.rift, map: setup.map, night: 1, totalWaves: setup.waves.length, buildingLevels: { holzfaeller: 2 } };
    const win = computeRewards({ ...args, victory: true, wavesCleared: setup.waves.length });
    const lose = computeRewards({ ...args, victory: false, wavesCleared: 2 });
    expect(win.total.holz).toBeGreaterThan(lose.total.holz);
    expect(lose.total.holz).toBeGreaterThanOrEqual(40);
  });

  it('Karten: drei verschiedene, Höchstanzahl wird beachtet', () => {
    const rng = new Rng(3);
    for (let i = 0; i < 200; i++) {
      const cards = rollCards(rng, ['koenigsmacht'], 0);
      expect(cards).toHaveLength(3);
      expect(new Set(cards.map((c) => c.id)).size).toBe(3);
      expect(cards.some((c) => c.id === 'koenigsmacht')).toBe(false);
    }
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
  });
});

describe('Spielstand', () => {
  it('speichert und lädt', () => {
    const storage = new MemoryStorage();
    const a = new SaveStore(storage);
    a.update((d) => { d.night = 4; d.resources.holz = 99; d.buildings.holzfaeller = 1; });
    const b = new SaveStore(storage);
    expect(b.get().night).toBe(4);
    expect(b.get().resources.holz).toBe(99);
    expect(b.get().buildings.holzfaeller).toBe(1);
  });

  it('repariert kaputte oder alte Spielstände', () => {
    const s = migrateSave({ night: 'x', resources: { holz: 5 } });
    expect(s.night).toBe(1);
    expect(s.resources).toEqual({ holz: 5, metall: 0, kristall: 0 });
    expect(s.settings.speed).toBe(1);
  });
});
