import { BALANCE } from '../config';
import { getCard } from '../data/cards';
import { RIFTS, getRift, type RiftDef } from '../data/rifts';
import { storyForNight, type StoryNight } from '../data/story';
import { cityIncome } from './city';
import { generateMap, type MapData } from './mapgen';
import { Modifiers } from './modifiers';
import { Rng, hashSeed } from './rng';
import type { CityState } from './save';
import { addResources, emptyResources, isEmptyResources, type Modifier, type Resources } from './types';
import { generateWaves, type WaveDef } from './wavegen';

// Verbindet die dauerhafte Stadt mit den Nächten:
// welcher Rift kommt, welche Story-Nacht ansteht, welche Belohnung es gibt.

/**
 * Nacht 1–3 stellen alle Rifts vor, Story-Nächte haben einen festen Rift,
 * sonst zufällig (nie zweimal derselbe hintereinander).
 */
export function riftForNight(seed: number, night: number): RiftDef {
  const intro = ['urzeit', 'tech', 'weltraum'];
  if (night <= intro.length) return getRift(intro[night - 1]);
  let previous = intro[intro.length - 1];
  let current = previous;
  for (let n = intro.length + 1; n <= night; n++) {
    const story = storyForNight(n);
    if (story) {
      current = story.riftId;
    } else {
      const rng = new Rng(hashSeed(seed, n, 17));
      const options = RIFTS.filter((r) => r.id !== previous);
      current = rng.pick(options).id;
    }
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
  story?: StoryNight;
}

/** Alles, was eine Nacht ausmacht. Gleicher Seed + gleiche Nacht = gleiche Karte. */
export function setupNight(seed: number, night: number): NightSetup {
  const rift = riftForNight(seed, night);
  const nightSeed = hashSeed(seed, night);
  const pathCount = pathCountForNight(seed, night);
  const map = generateMap(rift, pathCount, new Rng(nightSeed));
  const countBonus = new Modifiers(rift.globalEffect.modifiers).pct('enemyCount');
  const waves = generateWaves(night, rift, pathCount, new Rng(hashSeed(nightSeed, 1)), { countBonus });
  return { night, rift, map, waves, seed: nightSeed, story: storyForNight(night) };
}

export function cardModifiers(cardIds: readonly string[]): Modifier[] {
  return cardIds.flatMap((id) => getCard(id).modifiers ?? []);
}

export interface RewardLine {
  label: string;
  resources: Resources;
}

export interface RewardBreakdown {
  lines: RewardLine[];
  total: Resources;
}

/**
 * Belohnung für die Stadt nach einer Nacht:
 * eingesammelte Beute (bei Niederlage nur ein Teil), Siegprämie und Produktion der Stadt.
 */
export function computeRewards(args: { night: number; victory: boolean; loot: Resources; city: CityState }): RewardBreakdown {
  const { night, victory, loot, city } = args;
  const lines: RewardLine[] = [];
  const lootFactor = victory ? 1 : BALANCE.defeatLootFactor;
  const kept = addResources(emptyResources(), loot, lootFactor);
  if (!isEmptyResources(kept)) {
    lines.push({ label: victory ? 'Beute aus dem Kampf' : `Beute aus dem Kampf (${Math.round(lootFactor * 100)} % gerettet)`, resources: kept });
  }
  if (victory) {
    lines.push({ label: 'Siegprämie', resources: { ...emptyResources(), gold: BALANCE.victoryGoldBase + BALANCE.victoryGoldPerNight * night } });
  }
  // Produktionsgebäude liefern nach jedem Kampf – auch nach einer Niederlage
  lines.push(...cityIncome(city));

  const total = emptyResources();
  for (const line of lines) addResources(total, line.resources);
  return { lines, total };
}
