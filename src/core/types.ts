// Gemeinsame Typen für Spieldaten und Logik.

/**
 * Dauerhafte Ressourcen für die Stadt (Tag-Sphäre).
 * Im Kampf (Nacht-Sphäre) bezahlt man dagegen mit Rift-Kristallen – die verfallen nach der Nacht.
 */
export type ResourceId = 'gold' | 'holz' | 'stein' | 'magie' | 'nahrung';
export type Resources = Record<ResourceId, number>;
export const RESOURCE_IDS: readonly ResourceId[] = ['gold', 'holz', 'stein', 'magie', 'nahrung'];

export function emptyResources(): Resources {
  return { gold: 0, holz: 0, stein: 0, magie: 0, nahrung: 0 };
}

/** Teilmenge → vollständige Ressourcen (fehlende = 0). */
export function toResources(part: Partial<Resources> | undefined, factor = 1): Resources {
  const r = emptyResources();
  for (const id of RESOURCE_IDS) r[id] = Math.round((part?.[id] ?? 0) * factor);
  return r;
}

export function addResources(target: Resources, add: Partial<Resources>, factor = 1): Resources {
  for (const id of RESOURCE_IDS) target[id] += Math.round((add[id] ?? 0) * factor);
  return target;
}

export function hasResources(have: Resources, cost: Partial<Resources>): boolean {
  return RESOURCE_IDS.every((id) => have[id] >= (cost[id] ?? 0));
}

export function isEmptyResources(r: Partial<Resources>): boolean {
  return RESOURCE_IDS.every((id) => !r[id]);
}

export type TowerTag = 'projectile' | 'magic' | 'bow' | 'cannon' | 'mage' | 'frost' | 'antiair';

/** Alle Werte, die durch Karten, Gebäude, Felder oder Rifts verändert werden können. */
export type StatKey =
  // Türme
  | 'damage'
  | 'attackSpeed'
  | 'range'
  | 'projectiles'
  | 'splashRadius'
  | 'slowStrength'
  | 'chainTargets'
  | 'armorPen'
  | 'critChance'
  | 'airDamage'
  | 'projectileSpeed'
  | 'towerCost'
  | 'towerLimit'
  | 'towerMaxLevel'
  // Wirtschaft & Tor (im Kampf)
  | 'crystalGain'
  | 'startCrystals'
  | 'gateMaxHp'
  | 'interest'
  // Beute für die Stadt
  | 'goldDropChance'
  | 'lootGain'
  | 'harvestYield'
  | 'autoHarvest'
  // Gegner
  | 'enemyHp'
  | 'enemySpeed'
  | 'enemyArmor'
  | 'enemyCount'
  // König
  | 'kingDamage'
  | 'kingAttackSpeed'
  | 'kingRange'
  | 'kingAbilityDamage'
  | 'kingAbilityCooldown'
  | 'kingMoveSpeed'
  | 'kingHarvestSpeed'
  // Karten
  | 'cardLuck'
  | 'cardRerolls';

/**
 * Ein Modifikator verändert einen Wert.
 * kind 'pct': prozentual (0.1 = +10 %), kind 'flat': fester Betrag (z. B. +1 Projektil).
 * towerTags: gilt nur für Türme mit mindestens einem dieser Tags.
 */
export interface Modifier {
  stat: StatKey;
  kind: 'pct' | 'flat';
  value: number;
  towerTags?: readonly TowerTag[];
}

export interface GridPos {
  col: number;
  row: number;
}

export interface Vec {
  x: number;
  y: number;
}
