import type { TowerTag } from '../core/types';

// Alle Turmarten. Neue Türme einfach hier ergänzen (und in textures.ts ein Aussehen geben).
// Welche Türme im Kampf verfügbar sind, bestimmen die Stadt-Gebäude (buildings.ts → unlocksTowers).
// Kosten in Rift-Kristallen.

export interface TowerLevel {
  /** Kosten für diese Stufe (Stufe 1 = Baukosten). */
  cost: number;
  /** Normaler (physischer) Schaden – wird von Rüstung abgeschwächt */
  physDamage: number;
  /** Magischer Schaden – ignoriert Rüstung */
  magicDamage: number;
  /** Angriffe pro Sekunde */
  attackSpeed: number;
  /** Reichweite in Feldern */
  range: number;
  /** Chance auf kritischen Treffer (0.1 = 10 %) */
  critChance: number;
  /** Schaden bei kritischem Treffer (1.5 = 150 %) */
  critDamage: number;
  /** Mana, das für die Fähigkeit nötig ist */
  mana: number;
  /** Mana pro Sekunde */
  manaRegen: number;
  /** Explosionsradius in Feldern (nur Flächenschaden) */
  splashRadius?: number;
  /** Verlangsamung: strength 0.4 = 40 % langsamer, duration in Sekunden */
  slow?: { strength: number; duration: number };
  /** Zusätzliche Ziele für Kettenblitze */
  chainTargets?: number;
}

export interface TowerDef {
  id: string;
  name: string;
  description: string;
  tags: readonly TowerTag[];
  targets: { ground: boolean; air: boolean };
  attack: 'projectile' | 'chain';
  /** Fähigkeit, die bei vollem Mana ausgelöst wird (Wirkung folgt in einem späteren Schritt) */
  ability: { name: string; description: string };
  projectile: { style: ProjectileStyle; speed: number };
  /** Hauptfarbe für Grafik und Menüs */
  color: number;
  /** So viele Türme dieser Art darf man im Kampf bauen (Gebäude-Upgrades erhöhen das). */
  baseLimit: number;
  /** Bis zu dieser Stufe kann man den Turm im Kampf verbessern (Gebäude-Upgrades schalten mehr frei). */
  baseMaxLevel: number;
  levels: readonly TowerLevel[];
}

export type ProjectileStyle = 'arrow' | 'ball' | 'bolt' | 'shard' | 'royal';

export const TOWERS: readonly TowerDef[] = [
  {
    id: 'bow',
    name: 'Bogenturm',
    description: 'Schnell und günstig. Trifft Boden- und Fluggegner.',
    tags: ['projectile', 'bow'],
    targets: { ground: true, air: true },
    attack: 'projectile',
    ability: { name: 'Pfeilsalve', description: 'Bei vollem Mana schießt der Turm eine Salve aus 5 Pfeilen auf verschiedene Gegner.' },
    projectile: { style: 'arrow', speed: 9 },
    color: 0x5fa844,
    baseLimit: 2,
    baseMaxLevel: 1,
    levels: [
      { cost: 70, physDamage: 9, magicDamage: 0, attackSpeed: 1.25, range: 2.6,
        critChance: 0.1, critDamage: 1.5, mana: 100, manaRegen: 8 },
      { cost: 60, physDamage: 14, magicDamage: 0, attackSpeed: 1.4, range: 2.8,
        critChance: 0.1, critDamage: 1.5, mana: 100, manaRegen: 9 },
      { cost: 100, physDamage: 22, magicDamage: 0, attackSpeed: 1.6, range: 3.0,
        critChance: 0.1, critDamage: 1.5, mana: 100, manaRegen: 10 },
    ],
  },
  {
    id: 'cannon',
    name: 'Kanonenturm',
    description: 'Langsam, aber trifft mehrere Gegner auf einmal. Nur Bodengegner.',
    tags: ['projectile', 'cannon'],
    targets: { ground: true, air: false },
    attack: 'projectile',
    ability: { name: 'Großkaliber', description: 'Bei vollem Mana feuert der Turm eine Riesenkugel: doppelter Schaden und doppelter Explosionsradius.' },
    projectile: { style: 'ball', speed: 6 },
    color: 0x5b5f6b,
    baseLimit: 1,
    baseMaxLevel: 1,
    levels: [
      { cost: 110, physDamage: 22, magicDamage: 0, attackSpeed: 0.55, range: 2.4, splashRadius: 0.9,
        critChance: 0.05, critDamage: 1.5, mana: 120, manaRegen: 6 },
      { cost: 90, physDamage: 36, magicDamage: 0, attackSpeed: 0.6, range: 2.5, splashRadius: 1.0,
        critChance: 0.05, critDamage: 1.5, mana: 120, manaRegen: 7 },
      { cost: 150, physDamage: 58, magicDamage: 0, attackSpeed: 0.65, range: 2.7, splashRadius: 1.15,
        critChance: 0.05, critDamage: 1.5, mana: 120, manaRegen: 8 },
    ],
  },
  {
    id: 'mage',
    name: 'Magierturm',
    description: 'Kettenblitze springen auf weitere Gegner und ignorieren Rüstung. Nur Bodengegner.',
    tags: ['magic', 'mage'],
    targets: { ground: true, air: false },
    attack: 'chain',
    ability: { name: 'Gewittersturm', description: 'Bei vollem Mana springt ein Blitz auf bis zu 8 Gegner, ohne schwächer zu werden.' },
    projectile: { style: 'bolt', speed: 0 },
    color: 0x9b5de5,
    baseLimit: 1,
    baseMaxLevel: 1,
    levels: [
      { cost: 120, physDamage: 0, magicDamage: 15, attackSpeed: 0.8, range: 2.7, chainTargets: 1,
        critChance: 0.05, critDamage: 2.0, mana: 100, manaRegen: 10 },
      { cost: 100, physDamage: 0, magicDamage: 24, attackSpeed: 0.85, range: 2.8, chainTargets: 2,
        critChance: 0.05, critDamage: 2.0, mana: 100, manaRegen: 11 },
      { cost: 160, physDamage: 0, magicDamage: 38, attackSpeed: 0.9, range: 3.0, chainTargets: 3,
        critChance: 0.05, critDamage: 2.0, mana: 100, manaRegen: 12 },
    ],
  },
  {
    id: 'frost',
    name: 'Frostturm',
    description: 'Verlangsamt Gegner. Ignoriert Rüstung. Nur Bodengegner.',
    tags: ['projectile', 'magic', 'frost'],
    targets: { ground: true, air: false },
    attack: 'projectile',
    ability: { name: 'Eiszeit', description: 'Bei vollem Mana friert der Turm alle Bodengegner in Reichweite für 2 Sekunden ein.' },
    projectile: { style: 'shard', speed: 8 },
    color: 0x7fd3f7,
    baseLimit: 1,
    baseMaxLevel: 1,
    levels: [
      { cost: 90, physDamage: 0, magicDamage: 4, attackSpeed: 1.0, range: 2.3, slow: { strength: 0.35, duration: 1.5 },
        critChance: 0.05, critDamage: 1.5, mana: 100, manaRegen: 8 },
      { cost: 70, physDamage: 0, magicDamage: 7, attackSpeed: 1.05, range: 2.5, slow: { strength: 0.45, duration: 1.8 },
        critChance: 0.05, critDamage: 1.5, mana: 100, manaRegen: 9 },
      { cost: 120, physDamage: 0, magicDamage: 11, attackSpeed: 1.1, range: 2.7, slow: { strength: 0.55, duration: 2.0 },
        critChance: 0.05, critDamage: 1.5, mana: 100, manaRegen: 10 },
    ],
  },
  {
    id: 'ballista',
    name: 'Ballista',
    description: 'Flugabwehr: großer Schaden mit großer Reichweite. Nur Fluggegner.',
    tags: ['projectile', 'antiair'],
    targets: { ground: false, air: true },
    attack: 'projectile',
    ability: { name: 'Durchbohren', description: 'Bei vollem Mana durchschlägt ein Bolzen alle Fluggegner in einer Linie.' },
    projectile: { style: 'bolt', speed: 12 },
    color: 0xd9822b,
    baseLimit: 1,
    baseMaxLevel: 1,
    levels: [
      { cost: 100, physDamage: 34, magicDamage: 0, attackSpeed: 0.7, range: 3.6,
        critChance: 0.15, critDamage: 2.0, mana: 80, manaRegen: 6 },
      { cost: 85, physDamage: 54, magicDamage: 0, attackSpeed: 0.75, range: 3.9,
        critChance: 0.15, critDamage: 2.0, mana: 80, manaRegen: 7 },
      { cost: 140, physDamage: 85, magicDamage: 0, attackSpeed: 0.8, range: 4.2,
        critChance: 0.15, critDamage: 2.0, mana: 80, manaRegen: 8 },
    ],
  },
];

export function getTower(id: string): TowerDef {
  const def = TOWERS.find((t) => t.id === id);
  if (!def) throw new Error(`Unbekannter Turm: ${id}`);
  return def;
}
