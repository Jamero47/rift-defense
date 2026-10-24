import { BALANCE } from '../config';
import { BUILDINGS, getBuilding, type BuildingDef } from '../data/buildings';
import { getCard } from '../data/cards';
import { RIFTS, getRift, type RiftDef } from '../data/rifts';
import { countResourceTiles, generateMap, type MapData } from './mapgen';
import { Modifiers, scaleModifiers } from './modifiers';
import { Rng, hashSeed } from './rng';
import { RESOURCE_IDS, emptyResources, type Modifier, type ResourceId, type Resources } from './types';
import { generateWaves, type WaveDef } from './wavegen';

// Verbindet die dauerhafte Stadt mit den Nächten:
// welcher Rift kommt, welche Boni gelten, welche Belohnung gibt es.

/** Nacht 1–3 stellen alle Rifts vor, danach ist es zufällig (nie zweimal derselbe hintereinander). */
export function riftForNight(seed: number, night: number): RiftDef {
  const intro = ['urzeit', 'tech', 'weltraum'];
  if (night <= intro.length) return getRift(intro[night - 1]);
  let previous = intro[intro.length - 1];
  let current = previous;
  for (let n = intro.length + 1; n <= night; n++) {
    const rng = new Rng(hashSeed(seed, n, 17));
    const options = RIFTS.filter((r) => r.id !== previous);
    current = rng.pick(options).id;
    previous = current;
  }
  return getRift(current);
}

export function pathCountForNight(seed: number, night: number): number {
  if (night < BALANCE.secondPathFromNight) return 1;
  if (night >= BALANCE.maxPathsFromNight) return 2;
  return new Rng(hashSeed(seed, night, 29)).chance(0.5) ? 2 : 1;
}

export interface NightSetup {
  night: number;
  rift: RiftDef;
  map: MapData;
  waves: WaveDef[];
  seed: number;
}

/** Alles, was eine Nacht ausmacht. Gleicher Seed + gleiche Nacht = gleiche Karte. */
export function setupNight(seed: number, night: number): NightSetup {
  const rift = riftForNight(seed, night);
  const nightSeed = hashSeed(seed, night);
  const pathCount = pathCountForNight(seed, night);
  const map = generateMap(rift, pathCount, new Rng(nightSeed));
  const countBonus = new Modifiers(rift.globalEffect.modifiers).pct('enemyCount');
  const waves = generateWaves(night, rift, pathCount, new Rng(hashSeed(nightSeed, 1)), { countBonus });
  return { night, rift, map, waves, seed: nightSeed };
}

export function buildingModifiers(levels: Record<string, number>): Modifier[] {
  const out: Modifier[] = [];
  for (const def of BUILDINGS) {
    const lvl = levels[def.id] ?? 0;
    if (lvl > 0 && def.modifiers) out.push(...scaleModifiers(def.modifiers, lvl));
  }
  return out;
}

export function cardModifiers(cardIds: readonly string[]): Modifier[] {
  return cardIds.flatMap((id) => getCard(id).modifiers ?? []);
}

/** Kosten, um ein Gebäude von `level` auf `level + 1` zu bringen. */
export function buildingCost(def: BuildingDef, level: number): Resources {
  const cost = emptyResources();
  for (const id of RESOURCE_IDS) {
    const base = def.baseCost[id];
    if (base) cost[id] = Math.round(base * Math.pow(def.growth, level));
  }
  return cost;
}

export function canAfford(have: Resources, cost: Resources): boolean {
  return RESOURCE_IDS.every((id) => have[id] >= cost[id]);
}

export function buildingIncome(levels: Record<string, number>): { building: BuildingDef; level: number; income: Resources }[] {
  const out: { building: BuildingDef; level: number; income: Resources }[] = [];
  for (const [id, level] of Object.entries(levels)) {
    if (level <= 0) continue;
    const def = getBuilding(id);
    if (!def.income) continue;
    const income = emptyResources();
    for (const rid of RESOURCE_IDS) income[rid] = (def.income[rid] ?? 0) * level;
    out.push({ building: def, level, income });
  }
  return out;
}

export interface RewardLine {
  label: string;
  resources: Resources;
}

export interface RewardBreakdown {
  lines: RewardLine[];
  total: Resources;
}

export function computeRewards(args: {
  rift: RiftDef;
  map: MapData;
  night: number;
  victory: boolean;
  wavesCleared: number;
  totalWaves: number;
  buildingLevels: Record<string, number>;
}): RewardBreakdown {
  const { rift, map, night, victory, wavesCleared, totalWaves, buildingLevels } = args;
  const lines: RewardLine[] = [];
  const res: ResourceId = rift.reward.resource;
  const factor = victory ? 1 : BALANCE.defeatRewardFactor * (wavesCleared / Math.max(1, totalWaves));

  const base = Math.round((rift.reward.base + rift.reward.perNight * (night - 1)) * factor);
  if (base > 0) {
    lines.push({ label: victory ? `${rift.name} bezwungen` : 'Teilbelohnung', resources: single(res, base) });
  }
  const tiles = countResourceTiles(map, rift);
  const tileName = Object.values(rift.tiles).find((t) => t.resource)?.name ?? 'Ressourcen';
  const fromTiles = Math.round(tiles * rift.reward.perResourceTile * factor);
  if (fromTiles > 0) {
    lines.push({ label: `${tileName} auf der Karte (${tiles})`, resources: single(res, fromTiles) });
  }
  // Gebäude liefern nach jedem Kampf – auch nach einer Niederlage
  for (const inc of buildingIncome(buildingLevels)) {
    lines.push({ label: `${inc.building.name} (Stufe ${inc.level})`, resources: inc.income });
  }

  const total = emptyResources();
  for (const line of lines) for (const id of RESOURCE_IDS) total[id] += line.resources[id];
  return { lines, total };
}

function single(id: ResourceId, amount: number): Resources {
  const r = emptyResources();
  r[id] = amount;
  return r;
}
