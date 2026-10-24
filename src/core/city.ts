import { CITY } from '../config';
import { BUILDINGS, getBuilding, type BuildingDef, type UpgradeDef } from '../data/buildings';
import { PLOTS, getPlot, type PlotDef } from '../data/city';
import { RESEARCH, getResearch, type ResearchDef } from '../data/research';
import { STORY_NIGHTS } from '../data/story';
import { scaleModifiers } from './modifiers';
import type { CityState, Job, SaveData } from './save';
import { RESOURCE_IDS, addResources, emptyResources, hasResources, type Modifier, type Resources } from './types';

// Logik der Stadt (Tag-Sphäre) ohne Grafik: Bauplätze, Gebäude, Upgrades, Forschung, Bauzeiten.
// Alle Funktionen arbeiten direkt auf dem Spielstand (SaveData) und sind dadurch testbar.

export interface Check {
  ok: boolean;
  /** Warum es (noch) nicht geht – für die Anzeige */
  reason?: string;
}

const YES: Check = { ok: true };
const no = (reason: string): Check => ({ ok: false, reason });

// ---------------------------------------------------------------- Abfragen

/** Höchste Stufe eines Gebäudes in der Stadt (0 = nicht gebaut). */
export function buildingLevel(city: CityState, buildingId: string): number {
  let best = 0;
  for (const p of Object.values(city.plots)) if (p.building === buildingId) best = Math.max(best, p.level);
  return best;
}

export function throneLevel(city: CityState): number {
  return buildingLevel(city, 'thronsaal');
}

export function upgradeRank(city: CityState, upgradeId: string): number {
  return city.upgrades[upgradeId] ?? 0;
}

function isBuiltOrInProgress(city: CityState, buildingId: string): boolean {
  return buildingLevel(city, buildingId) > 0 || (city.job?.kind === 'build' && city.job.id === buildingId);
}

// ---------------------------------------------------------------- Bauplätze

export function isPlotUnlocked(city: CityState, plot: PlotDef): boolean {
  const u = plot.unlock;
  if (u.type === 'start') return true;
  if (u.type === 'throne') return throneLevel(city) >= u.level;
  return city.boughtPlots.includes(plot.id);
}

export function plotUnlockText(plot: PlotDef): string {
  const u = plot.unlock;
  if (u.type === 'start') return 'Frei';
  if (u.type === 'throne') return `Wird mit Thronsaal Stufe ${u.level} frei`;
  return u.throneLevel ? `Kaufen für ${u.cost} Gold (ab Thronsaal Stufe ${u.throneLevel})` : `Kaufen für ${u.cost} Gold`;
}

export function canBuyPlot(save: SaveData, plot: PlotDef): Check {
  const u = plot.unlock;
  if (u.type !== 'gold') return no('Dieser Bauplatz kann nicht gekauft werden.');
  if (isPlotUnlocked(save.city, plot)) return no('Schon freigeschaltet.');
  if (u.throneLevel && throneLevel(save.city) < u.throneLevel) return no(`Braucht Thronsaal Stufe ${u.throneLevel}.`);
  if (save.resources.gold < u.cost) return no('Nicht genug Gold.');
  return YES;
}

export function buyPlot(save: SaveData, plotId: string): Check {
  const plot = getPlot(plotId);
  const check = canBuyPlot(save, plot);
  if (!check.ok) return check;
  if (plot.unlock.type === 'gold') save.resources.gold -= plot.unlock.cost;
  save.city.boughtPlots.push(plotId);
  return YES;
}

// ---------------------------------------------------------------- Gebäude bauen & ausbauen

export function isBuildingUnlocked(city: CityState, def: BuildingDef): boolean {
  const u = def.unlock;
  switch (u.type) {
    case 'start':
      return true;
    case 'research':
      return city.research.includes(u.id);
    case 'story':
      return city.story.includes(u.id);
    case 'throne':
      return throneLevel(city) >= u.level;
  }
}

export function buildingUnlockText(def: BuildingDef): string {
  const u = def.unlock;
  switch (u.type) {
    case 'start':
      return 'Von Anfang an verfügbar';
    case 'research':
      return `Forschung »${getResearch(u.id).name}« (Universität)`;
    case 'story': {
      const story = STORY_NIGHTS.find((s) => s.id === u.id);
      return story ? `Belohnung aus Nacht ${story.night}: »${story.title}«` : 'Story-Belohnung';
    }
    case 'throne':
      return `Thronsaal Stufe ${u.level}`;
  }
}

/** Kosten, um von `level` auf `level + 1` zu kommen (level 0 = bauen). null = schon maximal. */
export function levelCost(def: BuildingDef, level: number): Partial<Resources> | null {
  return def.levels[level] ?? null;
}

export function jobBusy(city: CityState): Check {
  return city.job ? no('Es wird bereits gebaut. Warte, bis die Baustelle fertig ist.') : YES;
}

export function canBuild(save: SaveData, plotId: string, buildingId: string): Check {
  const city = save.city;
  const plot = getPlot(plotId);
  const def = getBuilding(buildingId);
  if (!isPlotUnlocked(city, plot)) return no('Bauplatz ist noch gesperrt.');
  if (city.plots[plotId] || city.job?.plotId === plotId) return no('Hier steht schon etwas.');
  if (def.plot !== plot.kind) return no('Passt nicht auf diesen Bauplatz.');
  if (!isBuildingUnlocked(city, def)) return no(`Noch gesperrt: ${buildingUnlockText(def)}`);
  if (def.id !== 'thronsaal' && throneLevel(city) === 0) return no('Baue zuerst den Thronsaal.');
  if (def.unique && isBuiltOrInProgress(city, def.id)) return no('Gibt es schon in deiner Stadt.');
  const busy = jobBusy(city);
  if (!busy.ok) return busy;
  if (!hasResources(save.resources, def.levels[0])) return no('Nicht genug Ressourcen.');
  return YES;
}

export function startBuild(save: SaveData, plotId: string, buildingId: string, now: number): Check {
  const check = canBuild(save, plotId, buildingId);
  if (!check.ok) return check;
  spend(save.resources, getBuilding(buildingId).levels[0]);
  save.city.job = { kind: 'build', plotId, id: buildingId, finishAt: now + CITY.buildSeconds * 1000 };
  return YES;
}

export function canUpgradeBuilding(save: SaveData, plotId: string): Check {
  const state = save.city.plots[plotId];
  if (!state) return no('Hier steht kein Gebäude.');
  const def = getBuilding(state.building);
  const cost = levelCost(def, state.level);
  if (!cost) return no('Maximale Stufe erreicht.');
  const busy = jobBusy(save.city);
  if (!busy.ok) return busy;
  if (!hasResources(save.resources, cost)) return no('Nicht genug Ressourcen.');
  return YES;
}

export function startUpgradeBuilding(save: SaveData, plotId: string, now: number): Check {
  const check = canUpgradeBuilding(save, plotId);
  if (!check.ok) return check;
  const state = save.city.plots[plotId];
  spend(save.resources, levelCost(getBuilding(state.building), state.level)!);
  save.city.job = { kind: 'upgrade', plotId, id: state.building, finishAt: now + CITY.buildSeconds * 1000 };
  return YES;
}

/** 0 … 1 */
export function jobProgress(job: Job, now: number): number {
  const total = CITY.buildSeconds * 1000;
  return Math.min(1, Math.max(0, 1 - (job.finishAt - now) / total));
}

/** Schließt fertige Bauaufträge und Forschungen ab. Gibt Meldungen für die Anzeige zurück. */
export function completeJobs(save: SaveData, now: number): string[] {
  const city = save.city;
  const messages: string[] = [];
  const job = city.job;
  if (job && job.finishAt <= now && job.plotId) {
    const def = getBuilding(job.id);
    if (job.kind === 'build') {
      city.plots[job.plotId] = { building: job.id, level: 1 };
      messages.push(`${def.name} ist fertig gebaut!`);
    } else {
      const state = city.plots[job.plotId];
      if (state) state.level++;
      messages.push(`${def.name} ist jetzt Stufe ${state?.level ?? '?'}!`);
    }
    city.job = null;
  }
  const rj = city.researchJob;
  if (rj && rj.finishAt <= now) {
    if (!city.research.includes(rj.id)) city.research.push(rj.id);
    const r = getResearch(rj.id);
    messages.push(`Forschung abgeschlossen: ${r.name} – ${getBuilding(r.unlocksBuilding).name} freigeschaltet!`);
    city.researchJob = null;
  }
  return messages;
}

// ---------------------------------------------------------------- Upgrades in Gebäuden

export function canBuyUpgrade(save: SaveData, building: BuildingDef, upgrade: UpgradeDef): Check & { cost?: Partial<Resources> } {
  const rank = upgradeRank(save.city, upgrade.id);
  if (rank >= upgrade.maxRank) return no('Maximal ausgebaut.');
  const needed = upgrade.requiredLevel[rank] ?? 1;
  const level = buildingLevel(save.city, building.id);
  const cost = upgrade.costs[rank];
  if (level === 0) return { ...no(`Erst ${building.name} bauen.`), cost };
  if (level < needed) return { ...no(`Braucht ${building.name} Stufe ${needed}.`), cost };
  if (!hasResources(save.resources, cost)) return { ...no('Nicht genug Ressourcen.'), cost };
  return { ok: true, cost };
}

export function buyUpgrade(save: SaveData, buildingId: string, upgradeId: string): Check {
  const building = getBuilding(buildingId);
  const upgrade = building.upgrades.find((u) => u.id === upgradeId);
  if (!upgrade) return no('Unbekanntes Upgrade.');
  const check = canBuyUpgrade(save, building, upgrade);
  if (!check.ok) return check;
  spend(save.resources, check.cost!);
  save.city.upgrades[upgradeId] = upgradeRank(save.city, upgradeId) + 1;
  return YES;
}

// ---------------------------------------------------------------- Forschung

export type ResearchStatus = 'done' | 'running' | 'available' | 'locked';

export function researchStatus(save: SaveData, r: ResearchDef): { status: ResearchStatus; reason?: string } {
  const city = save.city;
  if (city.research.includes(r.id)) return { status: 'done' };
  if (city.researchJob?.id === r.id) return { status: 'running' };
  const uni = buildingLevel(city, 'universitaet');
  if (uni === 0) return { status: 'locked', reason: 'Erst die Universität bauen.' };
  if (uni < r.requiredLevel) return { status: 'locked', reason: `Braucht Universität Stufe ${r.requiredLevel}.` };
  return { status: 'available' };
}

export function canStartResearch(save: SaveData, researchId: string): Check {
  const r = getResearch(researchId);
  const st = researchStatus(save, r);
  if (st.status !== 'available') return no(st.reason ?? 'Nicht möglich.');
  if (save.city.researchJob) return no('Es wird bereits geforscht.');
  if (!hasResources(save.resources, r.cost)) return no('Nicht genug Ressourcen.');
  return YES;
}

export function startResearch(save: SaveData, researchId: string, now: number): Check {
  const check = canStartResearch(save, researchId);
  if (!check.ok) return check;
  spend(save.resources, getResearch(researchId).cost);
  save.city.researchJob = { kind: 'research', id: researchId, finishAt: now + CITY.buildSeconds * 1000 };
  return YES;
}

export function allResearch(): readonly ResearchDef[] {
  return RESEARCH;
}

// ---------------------------------------------------------------- Wirkung auf die Nacht

/** Alle dauerhaften Boni der Stadt für den Kampf. */
export function cityModifiers(city: CityState): Modifier[] {
  const out: Modifier[] = [];
  for (const state of Object.values(city.plots)) {
    const def = getBuilding(state.building);
    if (def.levelModifiers) out.push(...scaleModifiers(def.levelModifiers, state.level));
  }
  for (const def of BUILDINGS) {
    for (const u of def.upgrades) {
      const rank = upgradeRank(city, u.id);
      if (rank > 0 && u.modifiers) out.push(...scaleModifiers(u.modifiers, rank));
    }
  }
  return out;
}

/** Türme, die man in der Nacht bauen kann. */
export function unlockedTowers(city: CityState): string[] {
  const out = new Set<string>();
  for (const state of Object.values(city.plots)) {
    for (const t of getBuilding(state.building).unlocksTowers ?? []) out.add(t);
  }
  return [...out];
}

/** Was die Stadt nach jedem Kampf liefert (Produktionsgebäude und Upgrades). */
export function cityIncome(city: CityState): { label: string; resources: Resources }[] {
  const lines: { label: string; resources: Resources }[] = [];
  for (const state of Object.values(city.plots)) {
    const def = getBuilding(state.building);
    if (def.income) lines.push({ label: `${def.name} (Stufe ${state.level})`, resources: addResources(emptyResources(), def.income, state.level) });
  }
  for (const def of BUILDINGS) {
    for (const u of def.upgrades) {
      const rank = upgradeRank(city, u.id);
      if (rank > 0 && u.income) lines.push({ label: `${u.name} (Rang ${rank})`, resources: addResources(emptyResources(), u.income, rank) });
    }
  }
  return lines;
}

// ---------------------------------------------------------------- Hilfen

export function spend(have: Resources, cost: Partial<Resources>): void {
  for (const id of RESOURCE_IDS) have[id] -= cost[id] ?? 0;
}

export function allPlots(): readonly PlotDef[] {
  return PLOTS;
}

/** Gebäude, die grundsätzlich auf diese Art Bauplatz passen. */
export function buildingsForPlot(plot: PlotDef): BuildingDef[] {
  return BUILDINGS.filter((b) => b.plot === plot.kind);
}

/** Nächster Tutorial-Schritt der Stadt (null = fertig). */
export function cityTutorialHint(save: SaveData): string | null {
  const city = save.city;
  if (throneLevel(city) === 0) {
    return city.job?.id === 'thronsaal'
      ? 'Der Thronsaal wird gebaut …'
      : 'Willkommen, König! Tippe auf den leuchtenden Platz in der Mitte und baue den Thronsaal.';
  }
  if (buildingLevel(city, 'bogenmacher') === 0) {
    return city.job?.id === 'bogenmacher'
      ? 'Der Bogenmacher wird gebaut …'
      : 'Baue jetzt den Bogenmacher auf einem Stadtplatz – er schaltet Bogenturm und Ballista frei.';
  }
  if (save.stats.nightsWon === 0 && save.stats.defeats === 0) {
    return `Die Nacht bricht herein! Tippe rechts auf »Nacht ${save.night}«, um das Tor zu verteidigen.`;
  }
  return null;
}

/** Darf die nächste Nacht beginnen? (Ohne Türme geht es nicht.) */
export function canStartNight(city: CityState): Check {
  if (unlockedTowers(city).length === 0) return no('Baue zuerst den Bogenmacher – ohne Türme kann die Stadt nicht verteidigt werden.');
  return YES;
}
