import { describe, expect, it } from 'vitest';
import { CITY } from '../src/config';
import {
  buildingLevel, buyPlot, buyUpgrade, canBuild, canStartNight, cityModifiers, completeJobs, isPlotUnlocked,
  startBuild, startResearch, startUpgradeBuilding, unlockedTowers,
} from '../src/core/city';
import { Modifiers } from '../src/core/modifiers';
import { defaultSave, type SaveData } from '../src/core/save';
import { BUILDINGS } from '../src/data/buildings';
import { PLOTS, getPlot } from '../src/data/city';
import { RESEARCH } from '../src/data/research';
import { STORY_NIGHTS } from '../src/data/story';
import { getTower } from '../src/data/towers';

const T = CITY.buildSeconds * 1000;

function rich(): SaveData {
  const s = defaultSave(1);
  s.resources = { gold: 99999, holz: 99999, stein: 99999, magie: 99999, nahrung: 99999 };
  return s;
}

/** Baut sofort fertig (Bauzeit überspringen). */
function build(s: SaveData, plot: string, building: string, now = 0): void {
  const r = startBuild(s, plot, building, now);
  expect(r, r.reason).toEqual({ ok: true });
  completeJobs(s, now + T);
}

describe('Stadt', () => {
  it('Start: 4 Bauplätze frei, nur Thronsaal zuerst', () => {
    const s = defaultSave(1);
    expect(PLOTS.filter((p) => isPlotUnlocked(s.city, p)).map((p) => p.id).sort()).toEqual(['berg', 'feld_1', 'stadt_1', 'thron']);
    expect(canBuild(s, 'stadt_1', 'bogenmacher').ok).toBe(false);
    expect(canBuild(s, 'stadt_1', 'bogenmacher').reason).toMatch(/Thronsaal/);
    expect(canBuild(s, 'thron', 'thronsaal').ok).toBe(true);
  });

  it('Tutorial-Weg ist mit den Startressourcen bezahlbar', () => {
    const s = defaultSave(1);
    build(s, 'thron', 'thronsaal');
    build(s, 'stadt_1', 'bogenmacher');
    expect(unlockedTowers(s.city).sort()).toEqual(['ballista', 'bow']);
    expect(canStartNight(s.city).ok).toBe(true);
  });

  it('Bauen dauert und nur ein Auftrag gleichzeitig', () => {
    const s = rich();
    expect(startBuild(s, 'thron', 'thronsaal', 1000).ok).toBe(true);
    expect(buildingLevel(s.city, 'thronsaal')).toBe(0);
    expect(completeJobs(s, 1000 + T - 1)).toEqual([]);
    expect(completeJobs(s, 1000 + T)).toHaveLength(1);
    expect(buildingLevel(s.city, 'thronsaal')).toBe(1);
    expect(startBuild(s, 'stadt_1', 'bogenmacher', 0).ok).toBe(true);
    expect(startBuild(s, 'berg', 'steinbruch', 0).ok).toBe(false);
  });

  it('Thronsaal-Stufe schaltet Bauplätze und Universität frei, Gold kauft Bauplätze', () => {
    const s = rich();
    build(s, 'thron', 'thronsaal');
    expect(isPlotUnlocked(s.city, getPlot('stadt_2'))).toBe(false);
    expect(canBuild(s, 'stadt_1', 'universitaet').ok).toBe(false);
    startUpgradeBuilding(s, 'thron', 0);
    completeJobs(s, T);
    expect(isPlotUnlocked(s.city, getPlot('stadt_2'))).toBe(true);
    expect(canBuild(s, 'stadt_2', 'universitaet').ok).toBe(true);
    const gold = s.resources.gold;
    expect(buyPlot(s, 'stadt_3').ok).toBe(true);
    expect(s.resources.gold).toBe(gold - 150);
    expect(isPlotUnlocked(s.city, getPlot('stadt_3'))).toBe(true);
  });

  it('Upgrades brauchen Gebäudestufen und wirken im Kampf', () => {
    const s = rich();
    build(s, 'thron', 'thronsaal');
    build(s, 'stadt_1', 'bogenmacher');
    const bow = getTower('bow');
    const limit = () => new Modifiers(cityModifiers(s.city)).apply('towerLimit', bow.baseLimit, bow.tags);
    expect(limit()).toBe(2);
    expect(buyUpgrade(s, 'bogenmacher', 'mehr_bogentuerme').ok).toBe(true);
    expect(limit()).toBe(3);
    // Rang 2 braucht Bogenmacher Stufe 2
    expect(buyUpgrade(s, 'bogenmacher', 'mehr_bogentuerme').reason).toMatch(/Stufe 2/);
  });

  it('Forschung schaltet Gebäude frei', () => {
    const s = rich();
    build(s, 'thron', 'thronsaal');
    startUpgradeBuilding(s, 'thron', 0);
    completeJobs(s, T);
    build(s, 'stadt_2', 'universitaet');
    expect(canBuild(s, 'feld_1', 'holzfaeller').ok).toBe(false);
    expect(startResearch(s, 'forstwirtschaft', 0).ok).toBe(true);
    completeJobs(s, T);
    expect(canBuild(s, 'feld_1', 'holzfaeller').ok).toBe(true);
  });

  it('Daten sind stimmig', () => {
    const plotKinds = new Set(PLOTS.map((p) => p.kind));
    for (const b of BUILDINGS) {
      expect(plotKinds.has(b.plot), b.id).toBe(true);
      for (const u of b.upgrades) {
        expect(u.costs.length, u.id).toBe(u.maxRank);
        expect(u.requiredLevel.length, u.id).toBe(u.maxRank);
        expect(Math.max(...u.requiredLevel), u.id).toBeLessThanOrEqual(b.levels.length);
      }
      if (b.unlock.type === 'research') expect(RESEARCH.some((r) => r.id === (b.unlock as { id: string }).id)).toBe(true);
      if (b.unlock.type === 'story') expect(STORY_NIGHTS.some((st) => st.id === (b.unlock as { id: string }).id)).toBe(true);
    }
    for (const r of RESEARCH) {
      if (r.unlocksBuilding) expect(BUILDINGS.some((b) => b.id === r.unlocksBuilding), r.id).toBe(true);
      for (const t of r.unlocksTowers ?? []) expect(getTower(t).id).toBe(t);
      for (const req of r.requires) expect(RESEARCH.find((o) => o.id === req)?.tree, `${r.id} → ${req}`).toBe(r.tree);
      expect(r.unlocksBuilding || r.unlocksTowers || r.modifiers, r.id).toBeTruthy();
    }
    // Jedes Feld im Baum nur einmal belegt
    const cells = RESEARCH.map((r) => `${r.tree}:${r.col}:${r.row}`);
    expect(new Set(cells).size).toBe(cells.length);
    for (const b of BUILDINGS) for (const x of b.excludes ?? []) expect(BUILDINGS.some((o) => o.id === x), `${b.id} → ${x}`).toBe(true);
    const ids = BUILDINGS.flatMap((b) => b.upgrades.map((u) => u.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(PLOTS.length).toBeGreaterThanOrEqual(26);
    expect(new Set(PLOTS.map((p) => p.id)).size).toBe(PLOTS.length);
  });

  it('Entweder-oder: Kanonengießerei schließt die Belagerungswerkstatt aus (und umgekehrt)', () => {
    const s = rich();
    build(s, 'thron', 'thronsaal');
    s.city.research.push('schiesspulver', 'belagerung');
    build(s, 'stadt_1', 'giesserei');
    s.city.boughtPlots.push('stadt_3');
    const check = canBuild(s, 'stadt_3', 'belagerungswerkstatt');
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/Entweder-oder/);
    const t = rich();
    build(t, 'thron', 'thronsaal');
    t.city.research.push('schiesspulver', 'belagerung');
    build(t, 'stadt_1', 'belagerungswerkstatt');
    t.city.boughtPlots.push('stadt_3');
    expect(canBuild(t, 'stadt_3', 'giesserei').ok).toBe(false);
    expect(unlockedTowers(t.city)).toContain('catapult');
  });

  it('Forschungsbaum: Voraussetzungen und Universitätsstufe', () => {
    const s = rich();
    build(s, 'thron', 'thronsaal');
    startUpgradeBuilding(s, 'thron', 0);
    completeJobs(s, T);
    build(s, 'stadt_2', 'universitaet');
    expect(startResearch(s, 'fischerei', 0).reason).toMatch(/Forstwirtschaft/);
    expect(startResearch(s, 'forstwirtschaft', 0).ok).toBe(true);
    expect(startResearch(s, 'schiesspulver', 0).ok).toBe(false); // nur eine Forschung gleichzeitig
    completeJobs(s, T);
    expect(startResearch(s, 'fischerei', 0).ok).toBe(true);
    completeJobs(s, T);
    expect(startResearch(s, 'handel', 0).reason).toMatch(/Stufe 2/);
  });

  it('Magiebaum: eigener Forschungsplatz, Boni und Türme', () => {
    const s = rich();
    build(s, 'thron', 'thronsaal');
    startUpgradeBuilding(s, 'thron', 0);
    completeJobs(s, T);
    build(s, 'stadt_2', 'universitaet');
    s.city.story.push('hofmagier');
    build(s, 'stadt_1', 'akademie');
    expect(startResearch(s, 'forstwirtschaft', 0).ok).toBe(true);
    expect(startResearch(s, 'manafluss', 0).ok).toBe(true); // läuft parallel zur Universität
    completeJobs(s, T);
    expect(s.city.research).toEqual(expect.arrayContaining(['forstwirtschaft', 'manafluss']));
    expect(new Modifiers(cityModifiers(s.city)).pct('manaRegen')).toBeCloseTo(0.1);
    expect(unlockedTowers(s.city)).not.toContain('wind');
    expect(startResearch(s, 'windzauber', 0).ok).toBe(true);
    completeJobs(s, T);
    expect(unlockedTowers(s.city)).toContain('wind');
  });

  it('Baukunst verkürzt die Bauzeit', () => {
    const s = rich();
    build(s, 'thron', 'thronsaal');
    s.city.research.push('baukunst');
    expect(startBuild(s, 'stadt_1', 'bogenmacher', 0).ok).toBe(true);
    expect(s.city.job!.finishAt).toBe(T * 0.75);
    expect(completeJobs(s, T * 0.75).length).toBe(1);
  });
});
