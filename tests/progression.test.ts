import { describe, expect, it } from 'vitest';
import { rollCards } from '../src/core/draft';
import { computeRewards, riftForNight, setupNight } from '../src/core/progression';
import { Rng } from '../src/core/rng';
import { SaveStore, defaultSave, emptyCity, migrateSave, type KeyValueStorage } from '../src/core/save';
import { emptyResources } from '../src/core/types';
import { CARDS } from '../src/data/cards';
import { STORY_NIGHTS } from '../src/data/story';

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
    for (let n = 4; n < 40; n++) {
      if (STORY_NIGHTS.some((s) => s.night === n || s.night === n - 1)) continue;
      expect(riftForNight(99, n).id).not.toBe(riftForNight(99, n - 1).id);
    }
  });

  it('Story-Nächte haben ihren festen Rift', () => {
    for (const story of STORY_NIGHTS) {
      for (const seed of [1, 2, 3, 99]) {
        const setup = setupNight(seed, story.night);
        expect(setup.rift.id).toBe(story.riftId);
        expect(setup.story?.id).toBe(story.id);
      }
    }
  });

  it('dieselbe Nacht ergibt beim Neustart dieselbe Karte', () => {
    expect(setupNight(123, 5)).toEqual(setupNight(123, 5));
  });

  it('Belohnung: Beute + Siegprämie + Produktion; bei Niederlage nur ein Teil der Beute', () => {
    const city = emptyCity();
    city.plots.berg = { building: 'steinbruch', level: 2 };
    const loot = { ...emptyResources(), holz: 40, gold: 10 };
    const win = computeRewards({ night: 3, victory: true, loot, city });
    const lose = computeRewards({ night: 3, victory: false, loot, city });
    expect(win.total.holz).toBe(40);
    expect(lose.total.holz).toBe(20);
    expect(win.total.gold).toBeGreaterThan(lose.total.gold);
    // Steinbruch liefert immer: 2 × 15 Stein
    expect(win.total.stein).toBe(30);
    expect(lose.total.stein).toBe(30);
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

  it('Karten nur für vorhandene Türme', () => {
    const rng = new Rng(5);
    const tags = new Set(['projectile', 'bow', 'antiair'] as const);
    for (let i = 0; i < 300; i++) {
      for (const c of rollCards(rng, [], 2, 3, tags)) {
        expect(['grosse_kugeln', 'arkanes_wissen', 'kettenblitz', 'frostbiss', 'schwarzpulver']).not.toContain(c.id);
      }
    }
  });
});

describe('Spielstand', () => {
  it('speichert und lädt', () => {
    const storage = new MemoryStorage();
    const a = new SaveStore(storage);
    a.update((d) => { d.night = 4; d.resources.holz = 99; d.city.plots.thron = { building: 'thronsaal', level: 2 }; });
    const b = new SaveStore(storage);
    expect(b.get().night).toBe(4);
    expect(b.get().resources.holz).toBe(99);
    expect(b.get().city.plots.thron.level).toBe(2);
  });

  it('neues Spiel startet mit Ressourcen für Thronsaal und Bogenmacher', () => {
    const s = defaultSave(1);
    expect(s.resources.holz).toBeGreaterThanOrEqual(70);
    expect(s.city.plots).toEqual({});
  });

  it('wandelt Spielstände der Version 1 um', () => {
    const s = migrateSave({ version: 1, night: 5, resources: { holz: 500, metall: 200, kristall: 30 }, buildings: { holzfaeller: 3 } });
    expect(s.version).toBe(3);
    expect(s.city.magicJob).toBeNull();
    expect(s.night).toBe(5);
    expect(s.resources.holz).toBe(500);
    expect(s.resources.stein).toBe(200);
    expect(s.resources.magie).toBe(30);
    expect(s.city.plots).toEqual({});
  });

  it('repariert kaputte Spielstände', () => {
    const s = migrateSave({ version: 2, night: 'x', resources: { holz: 5 } });
    expect(s.night).toBe(1);
    expect(s.resources).toEqual({ gold: 0, holz: 5, stein: 0, magie: 0, nahrung: 0 });
    expect(s.settings.speed).toBe(1);
    expect(s.city.job).toBeNull();
  });
});
