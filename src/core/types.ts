// Gemeinsame Typen für Spieldaten und Logik.

export type ResourceId = 'holz' | 'metall' | 'kristall';
export type Resources = Record<ResourceId, number>;
export const RESOURCE_IDS: readonly ResourceId[] = ['holz', 'metall', 'kristall'];

export function emptyResources(): Resources {
  return { holz: 0, metall: 0, kristall: 0 };
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
  // Wirtschaft & Tor
  | 'goldGain'
  | 'startGold'
  | 'gateMaxHp'
  | 'interest'
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
