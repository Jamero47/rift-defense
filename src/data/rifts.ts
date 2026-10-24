import type { Modifier, Resources } from '../core/types';
import type { EnemyRole } from './enemies';

// Jede Nacht öffnet sich ein Rift und verwandelt das Land vor dem Tor.
// Ein Rift bestimmt: Aussehen, Felder (mit Boni/Mali), abbaubare Rohstoffe, Gegner und Sondereffekt.

export type TileDeco =
  | 'none' | 'tree' | 'fern' | 'rock' | 'hill' | 'swamp' | 'tar'
  | 'scrap' | 'pipes' | 'crate' | 'energy' | 'jammer' | 'conveyor'
  | 'crystal' | 'crater' | 'meteor' | 'crystalfield' | 'stardust' | 'gravity'
  | 'amber' | 'cell' | 'vines';

export interface TileDef {
  id: string;
  name: string;
  /** Darf man hier einen Turm bauen? */
  buildable: boolean;
  /** Gehört das Feld zum Weg der Gegner? */
  path: boolean;
  color: number;
  deco: TileDeco;
  /** Wirkt auf Türme, die auf diesem Feld stehen */
  towerModifiers?: readonly Modifier[];
  /** Tempo-Faktor für Gegner auf diesem Feld (0.6 = 40 % langsamer) */
  enemySpeedFactor?: number;
  /** Rohstoff-Feld: Der König (oder ein Sammler) kann es abbauen. Danach wird es zu freiem Bauland. */
  harvest?: Partial<Resources>;
  /** Kurzer Text für das Baumenü */
  effectText?: string;
}

export interface SpecialTilePlacement {
  tile: string;
  on: 'build' | 'path';
  count: readonly [number, number];
  /** Bei Wegfeldern: so viele Felder am Stück */
  length?: number;
}

export interface RiftDef {
  id: string;
  name: string;
  shortName: string;
  description: string;
  /** Farbe des Portals und der Akzente */
  color: number;
  /** Feld-IDs: 'ground' und 'path' müssen existieren */
  tiles: Record<string, TileDef>;
  generation: {
    blockedTiles: readonly string[];
    blockedDensity: number;
    /** Abbaubare Rohstoff-Felder mit Gewichtung (häufiger = höhere Zahl) */
    resourceTiles: Readonly<Record<string, number>>;
    resourceDensity: number;
    specials: readonly SpecialTilePlacement[];
  };
  enemies: Record<EnemyRole, readonly string[]>;
  /** Sondereffekt, der die ganze Nacht gilt */
  globalEffect: { name: string; text: string; modifiers: readonly Modifier[] };
}

const URZEIT: RiftDef = {
  id: 'urzeit',
  name: 'Rift der Urzeit',
  shortName: 'Urzeit',
  description: 'Dichter Urwald, Teergruben und hungrige Dinosaurier. Bäume, Felsen und Riesenfarne lassen sich abbauen.',
  color: 0x9be15d,
  tiles: {
    ground: { id: 'ground', name: 'Urwiese', buildable: true, path: false, color: 0x2f4f2a, deco: 'none' },
    path: { id: 'path', name: 'Trampelpfad', buildable: false, path: true, color: 0x6b5236, deco: 'none' },
    tree: { id: 'tree', name: 'Urzeitbaum', buildable: false, path: false, color: 0x2a4626, deco: 'tree', harvest: { holz: 8 } },
    fern: { id: 'fern', name: 'Riesenfarn', buildable: false, path: false, color: 0x2a4626, deco: 'fern', harvest: { nahrung: 6 } },
    rock: { id: 'rock', name: 'Felsen', buildable: false, path: false, color: 0x2f4f2a, deco: 'rock', harvest: { stein: 6 } },
    amber: { id: 'amber', name: 'Bernstein', buildable: false, path: false, color: 0x2f4f2a, deco: 'amber', harvest: { magie: 3, gold: 2 } },
    hill: {
      id: 'hill', name: 'Hügel', buildable: true, path: false, color: 0x4a6b35, deco: 'hill',
      towerModifiers: [{ stat: 'range', kind: 'pct', value: 0.2 }],
      effectText: 'Hügel: +20 % Reichweite',
    },
    swamp: {
      id: 'swamp', name: 'Sumpf', buildable: true, path: false, color: 0x2c4a3e, deco: 'swamp',
      towerModifiers: [{ stat: 'attackSpeed', kind: 'pct', value: -0.15 }],
      effectText: 'Sumpf: −15 % Angriffstempo',
    },
    tar: {
      id: 'tar', name: 'Teergrube', buildable: false, path: true, color: 0x2a2320, deco: 'tar',
      enemySpeedFactor: 0.6,
      effectText: 'Teergrube: Gegner 40 % langsamer',
    },
  },
  generation: {
    blockedTiles: [],
    blockedDensity: 0,
    resourceTiles: { tree: 5, rock: 3, fern: 3, amber: 1 },
    resourceDensity: 0.2,
    specials: [
      { tile: 'hill', on: 'build', count: [3, 5] },
      { tile: 'swamp', on: 'build', count: [2, 3] },
      { tile: 'tar', on: 'path', count: [1, 2], length: 2 },
    ],
  },
  enemies: {
    normal: ['dino_kompso'],
    fast: ['dino_raptor'],
    tank: ['dino_trike'],
    air: ['dino_ptero'],
    special: ['dino_para'],
    boss: ['dino_trex'],
  },
  globalEffect: {
    name: 'Herdentiere',
    text: '25 % mehr Gegner, dafür 15 % weniger Leben.',
    modifiers: [
      { stat: 'enemyCount', kind: 'pct', value: 0.25 },
      { stat: 'enemyHp', kind: 'pct', value: -0.15 },
    ],
  },
};

const TECH: RiftDef = {
  id: 'tech',
  name: 'Rift der Maschinen',
  shortName: 'Tech',
  description: 'Eine Fabrik aus der Zukunft. Roboter, Förderbänder – und Hacker, die Türme lahmlegen.',
  color: 0x38bdf8,
  tiles: {
    ground: { id: 'ground', name: 'Metallboden', buildable: true, path: false, color: 0x252c37, deco: 'none' },
    path: { id: 'path', name: 'Wartungsweg', buildable: false, path: true, color: 0x5f6672, deco: 'none' },
    scrap: { id: 'scrap', name: 'Schrotthaufen', buildable: false, path: false, color: 0x252c37, deco: 'scrap', harvest: { stein: 5, gold: 2 } },
    pipes: { id: 'pipes', name: 'Rohre', buildable: false, path: false, color: 0x262e38, deco: 'pipes' },
    crate: { id: 'crate', name: 'Vorratskiste', buildable: false, path: false, color: 0x252c37, deco: 'crate', harvest: { holz: 6, nahrung: 4 } },
    cell: { id: 'cell', name: 'Energiezelle', buildable: false, path: false, color: 0x252c37, deco: 'cell', harvest: { magie: 4 } },
    energy: {
      id: 'energy', name: 'Energiefeld', buildable: true, path: false, color: 0x1f3a4a, deco: 'energy',
      towerModifiers: [{ stat: 'attackSpeed', kind: 'pct', value: 0.25 }],
      effectText: 'Energiefeld: +25 % Angriffstempo',
    },
    jammer: {
      id: 'jammer', name: 'Störsender', buildable: true, path: false, color: 0x3a2b30, deco: 'jammer',
      towerModifiers: [{ stat: 'damage', kind: 'pct', value: -0.2 }],
      effectText: 'Störsender: −20 % Schaden',
    },
    conveyor: {
      id: 'conveyor', name: 'Förderband', buildable: false, path: true, color: 0x3d4148, deco: 'conveyor',
      enemySpeedFactor: 1.35,
      effectText: 'Förderband: Gegner 35 % schneller',
    },
  },
  generation: {
    blockedTiles: ['pipes'],
    blockedDensity: 0.05,
    resourceTiles: { scrap: 4, crate: 3, cell: 2 },
    resourceDensity: 0.16,
    specials: [
      { tile: 'energy', on: 'build', count: [3, 4] },
      { tile: 'jammer', on: 'build', count: [2, 3] },
      { tile: 'conveyor', on: 'path', count: [1, 2], length: 3 },
    ],
  },
  enemies: {
    normal: ['bot_scout'],
    fast: ['bot_runner'],
    tank: ['bot_tank'],
    air: ['bot_drone'],
    special: ['bot_hacker'],
    boss: ['bot_titan'],
  },
  globalEffect: {
    name: 'Roboter-Panzerung',
    text: 'Alle Gegner haben +10 % Rüstung. Magie-Türme ignorieren Rüstung.',
    modifiers: [{ stat: 'enemyArmor', kind: 'flat', value: 0.1 }],
  },
};

const WELTRAUM: RiftDef = {
  id: 'weltraum',
  name: 'Rift der Sterne',
  shortName: 'Weltraum',
  description: 'Eine fremde Mondlandschaft. Alien-Schwärme, Schilde und leuchtende Kristalle.',
  color: 0xc084fc,
  tiles: {
    ground: { id: 'ground', name: 'Mondgestein', buildable: true, path: false, color: 0x2a2742, deco: 'none' },
    path: { id: 'path', name: 'Kraterpfad', buildable: false, path: true, color: 0x55506e, deco: 'none' },
    crystal: { id: 'crystal', name: 'Kristallader', buildable: false, path: false, color: 0x2a2742, deco: 'crystal', harvest: { magie: 5 } },
    crater: { id: 'crater', name: 'Krater', buildable: false, path: false, color: 0x2a2742, deco: 'crater' },
    meteor: { id: 'meteor', name: 'Meteorit', buildable: false, path: false, color: 0x2a2742, deco: 'meteor', harvest: { stein: 6, gold: 2 } },
    vines: { id: 'vines', name: 'Alien-Ranken', buildable: false, path: false, color: 0x2a2742, deco: 'vines', harvest: { holz: 5, nahrung: 4 } },
    crystalfield: {
      id: 'crystalfield', name: 'Kristallfeld', buildable: true, path: false, color: 0x33305a, deco: 'crystalfield',
      towerModifiers: [{ stat: 'damage', kind: 'pct', value: 0.3 }],
      effectText: 'Kristallfeld: +30 % Schaden',
    },
    stardust: {
      id: 'stardust', name: 'Sternenstaub', buildable: true, path: false, color: 0x3a3350, deco: 'stardust',
      towerModifiers: [{ stat: 'range', kind: 'pct', value: -0.2 }],
      effectText: 'Sternenstaub: −20 % Reichweite',
    },
    gravity: {
      id: 'gravity', name: 'Schwerkraftfeld', buildable: false, path: true, color: 0x3b2f5c, deco: 'gravity',
      enemySpeedFactor: 0.7,
      effectText: 'Schwerkraftfeld: Gegner 30 % langsamer',
    },
  },
  generation: {
    blockedTiles: ['crater'],
    blockedDensity: 0.05,
    resourceTiles: { meteor: 3, crystal: 2, vines: 3 },
    resourceDensity: 0.16,
    specials: [
      { tile: 'crystalfield', on: 'build', count: [2, 3] },
      { tile: 'stardust', on: 'build', count: [3, 4] },
      { tile: 'gravity', on: 'path', count: [1, 2], length: 2 },
    ],
  },
  enemies: {
    normal: ['alien_crawler'],
    fast: ['alien_leaper'],
    tank: ['alien_shield'],
    air: ['alien_ufo'],
    special: ['alien_brood'],
    boss: ['alien_queen'],
  },
  globalEffect: {
    name: 'Niedrige Schwerkraft',
    text: 'Projektile fliegen 30 % schneller, Gegner laufen 10 % schneller.',
    modifiers: [
      { stat: 'projectileSpeed', kind: 'pct', value: 0.3 },
      { stat: 'enemySpeed', kind: 'pct', value: 0.1 },
    ],
  },
};

export const RIFTS: readonly RiftDef[] = [URZEIT, TECH, WELTRAUM];

export function getRift(id: string): RiftDef {
  const def = RIFTS.find((r) => r.id === id);
  if (!def) throw new Error(`Unbekannter Rift: ${id}`);
  return def;
}
