import type { TowerTag } from '../core/types';

// Alle Turmarten. Neue Türme einfach hier ergänzen (und in textures.ts ein Aussehen geben).

export interface TowerLevel {
  /** Kosten für diese Stufe (Stufe 1 = Baukosten). */
  cost: number;
  damage: number;
  /** Angriffe pro Sekunde */
  attackSpeed: number;
  /** Reichweite in Feldern */
  range: number;
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
  /** 'physical' wird von Rüstung abgeschwächt, 'magic' ignoriert Rüstung. */
  damageType: 'physical' | 'magic';
  attack: 'projectile' | 'chain';
  projectile: { style: ProjectileStyle; speed: number };
  /** Hauptfarbe für Grafik und Menüs */
  color: number;
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
    damageType: 'physical',
    attack: 'projectile',
    projectile: { style: 'arrow', speed: 9 },
    color: 0x5fa844,
    levels: [
      { cost: 70, damage: 9, attackSpeed: 1.25, range: 2.6 },
      { cost: 60, damage: 14, attackSpeed: 1.4, range: 2.8 },
      { cost: 100, damage: 22, attackSpeed: 1.6, range: 3.0 },
    ],
  },
  {
    id: 'cannon',
    name: 'Kanonenturm',
    description: 'Langsam, aber trifft mehrere Gegner auf einmal. Nur Bodengegner.',
    tags: ['projectile', 'cannon'],
    targets: { ground: true, air: false },
    damageType: 'physical',
    attack: 'projectile',
    projectile: { style: 'ball', speed: 6 },
    color: 0x5b5f6b,
    levels: [
      { cost: 110, damage: 22, attackSpeed: 0.55, range: 2.4, splashRadius: 0.9 },
      { cost: 90, damage: 36, attackSpeed: 0.6, range: 2.5, splashRadius: 1.0 },
      { cost: 150, damage: 58, attackSpeed: 0.65, range: 2.7, splashRadius: 1.15 },
    ],
  },
  {
    id: 'mage',
    name: 'Magierturm',
    description: 'Kettenblitze springen auf weitere Gegner und ignorieren Rüstung. Nur Bodengegner.',
    tags: ['magic', 'mage'],
    targets: { ground: true, air: false },
    damageType: 'magic',
    attack: 'chain',
    projectile: { style: 'bolt', speed: 0 },
    color: 0x9b5de5,
    levels: [
      { cost: 120, damage: 15, attackSpeed: 0.8, range: 2.7, chainTargets: 1 },
      { cost: 100, damage: 24, attackSpeed: 0.85, range: 2.8, chainTargets: 2 },
      { cost: 160, damage: 38, attackSpeed: 0.9, range: 3.0, chainTargets: 3 },
    ],
  },
  {
    id: 'frost',
    name: 'Frostturm',
    description: 'Verlangsamt Gegner. Ignoriert Rüstung. Nur Bodengegner.',
    tags: ['projectile', 'magic', 'frost'],
    targets: { ground: true, air: false },
    damageType: 'magic',
    attack: 'projectile',
    projectile: { style: 'shard', speed: 8 },
    color: 0x7fd3f7,
    levels: [
      { cost: 90, damage: 4, attackSpeed: 1.0, range: 2.3, slow: { strength: 0.35, duration: 1.5 } },
      { cost: 70, damage: 7, attackSpeed: 1.05, range: 2.5, slow: { strength: 0.45, duration: 1.8 } },
      { cost: 120, damage: 11, attackSpeed: 1.1, range: 2.7, slow: { strength: 0.55, duration: 2.0 } },
    ],
  },
  {
    id: 'ballista',
    name: 'Ballista',
    description: 'Flugabwehr: großer Schaden mit großer Reichweite. Nur Fluggegner.',
    tags: ['projectile', 'antiair'],
    targets: { ground: false, air: true },
    damageType: 'physical',
    attack: 'projectile',
    projectile: { style: 'bolt', speed: 12 },
    color: 0xd9822b,
    levels: [
      { cost: 100, damage: 34, attackSpeed: 0.7, range: 3.6 },
      { cost: 85, damage: 54, attackSpeed: 0.75, range: 3.9 },
      { cost: 140, damage: 85, attackSpeed: 0.8, range: 4.2 },
    ],
  },
];

export function getTower(id: string): TowerDef {
  const def = TOWERS.find((t) => t.id === id);
  if (!def) throw new Error(`Unbekannter Turm: ${id}`);
  return def;
}
