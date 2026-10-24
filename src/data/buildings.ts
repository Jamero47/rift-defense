import type { Modifier, Resources } from '../core/types';

// Dauerhafte Stadt-Gebäude. Sie werden mit Ressourcen aus den Rifts ausgebaut
// und wirken in jeder Nacht. Werte gelten pro Stufe (Stufe 3 = dreifacher Bonus).

export interface BuildingDef {
  id: string;
  name: string;
  description: string;
  /** Symbol im Stadtbildschirm (Textur-Schlüssel) */
  icon: string;
  maxLevel: number;
  /** Kosten für Stufe 1; jede weitere Stufe kostet × growth */
  baseCost: Partial<Resources>;
  growth: number;
  /** Boni pro Stufe */
  modifiers?: readonly Modifier[];
  /** Ressourcen nach jedem Kampf, pro Stufe */
  income?: Partial<Resources>;
}

export const BUILDINGS: readonly BuildingDef[] = [
  {
    id: 'holzfaeller', name: 'Holzfäller', icon: 'icon_holz',
    description: 'Fällt Bäume rund um die Stadt.',
    maxLevel: 5, baseCost: { holz: 30 }, growth: 1.7,
    income: { holz: 20 },
  },
  {
    id: 'schrottplatz', name: 'Schrottplatz', icon: 'icon_metall',
    description: 'Sammelt Metall aus alten Rift-Trümmern.',
    maxLevel: 5, baseCost: { holz: 40, metall: 15 }, growth: 1.7,
    income: { metall: 15 },
  },
  {
    id: 'kristallmine', name: 'Kristallschleiferei', icon: 'icon_kristall',
    description: 'Gewinnt Kristalle aus Sternensplittern.',
    maxLevel: 5, baseCost: { holz: 30, kristall: 15 }, growth: 1.7,
    income: { kristall: 10 },
  },
  {
    id: 'bogenmacher', name: 'Bogenmacher', icon: 'top_bow',
    description: 'Bessere Bögen für alle Bogentürme.',
    maxLevel: 5, baseCost: { holz: 50 }, growth: 1.6,
    modifiers: [
      { stat: 'damage', kind: 'pct', value: 0.1, towerTags: ['bow'] },
      { stat: 'range', kind: 'pct', value: 0.04, towerTags: ['bow'] },
    ],
  },
  {
    id: 'giesserei', name: 'Kanonengießerei', icon: 'top_cannon',
    description: 'Schwerere Kugeln für Kanonentürme.',
    maxLevel: 5, baseCost: { holz: 30, metall: 40 }, growth: 1.6,
    modifiers: [{ stat: 'damage', kind: 'pct', value: 0.1, towerTags: ['cannon'] }],
  },
  {
    id: 'akademie', name: 'Magierakademie', icon: 'top_mage',
    description: 'Bildet Magier für Magier- und Frosttürme aus.',
    maxLevel: 5, baseCost: { holz: 30, kristall: 30 }, growth: 1.6,
    modifiers: [{ stat: 'damage', kind: 'pct', value: 0.1, towerTags: ['magic'] }],
  },
  {
    id: 'ballistenwerk', name: 'Ballistenwerkstatt', icon: 'top_ballista',
    description: 'Stärkere Flugabwehr.',
    maxLevel: 5, baseCost: { holz: 40, metall: 20 }, growth: 1.6,
    modifiers: [
      { stat: 'damage', kind: 'pct', value: 0.12, towerTags: ['antiair'] },
      { stat: 'range', kind: 'pct', value: 0.05, towerTags: ['antiair'] },
    ],
  },
  {
    id: 'stadtmauer', name: 'Stadtmauer', icon: 'icon_wall',
    description: 'Ein stärkeres Tor hält mehr aus.',
    maxLevel: 5, baseCost: { holz: 40, metall: 20 }, growth: 1.6,
    modifiers: [{ stat: 'gateMaxHp', kind: 'flat', value: 4 }],
  },
  {
    id: 'schatzkammer', name: 'Schatzkammer', icon: 'icon_gold',
    description: 'Mehr Gold zu Beginn jeder Nacht.',
    maxLevel: 5, baseCost: { holz: 60, metall: 30, kristall: 20 }, growth: 1.6,
    modifiers: [{ stat: 'startGold', kind: 'flat', value: 30 }],
  },
  {
    id: 'thronsaal', name: 'Thronsaal', icon: 'icon_crown',
    description: 'Der König trainiert für den Kampf am Tor.',
    maxLevel: 5, baseCost: { metall: 40, kristall: 30 }, growth: 1.6,
    modifiers: [
      { stat: 'kingDamage', kind: 'pct', value: 0.15 },
      { stat: 'kingAttackSpeed', kind: 'pct', value: 0.08 },
      { stat: 'kingAbilityDamage', kind: 'pct', value: 0.15 },
    ],
  },
  {
    id: 'orakel', name: 'Orakel', icon: 'icon_eye',
    description: 'Blickt in die Zukunft: bessere Upgrade-Karten.',
    maxLevel: 3, baseCost: { kristall: 50 }, growth: 1.8,
    modifiers: [
      { stat: 'cardRerolls', kind: 'flat', value: 1 },
      { stat: 'cardLuck', kind: 'flat', value: 0.5 },
    ],
  },
  {
    id: 'schmiede', name: 'Waffenschmiede', icon: 'icon_hammer',
    description: 'Bessere Waffen für alle Türme.',
    maxLevel: 5, baseCost: { holz: 50, metall: 50, kristall: 30 }, growth: 1.7,
    modifiers: [{ stat: 'damage', kind: 'pct', value: 0.05 }],
  },
];

export function getBuilding(id: string): BuildingDef {
  const def = BUILDINGS.find((b) => b.id === id);
  if (!def) throw new Error(`Unbekanntes Gebäude: ${id}`);
  return def;
}
