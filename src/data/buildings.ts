import type { Modifier, Resources } from '../core/types';
import type { PlotKind } from './city';

// Gebäude der Stadt (Tag-Sphäre). Jedes Gebäude
//  - steht auf einer bestimmten Art von Bauplatz (plot),
//  - wird erst freigeschaltet (Start, Forschung, Story-Nacht oder Thronsaal-Stufe),
//  - muss gebaut werden (dauert BUILD_SECONDS) und kann Stufen aufsteigen,
//  - kann Türme für die Nacht freischalten und enthält eigene Upgrades.
// Upgrade-Ränge brauchen eine Mindest-Stufe des Gebäudes.

export type BuildingUnlock =
  | { type: 'start' }
  | { type: 'research'; id: string }
  | { type: 'story'; id: string }
  | { type: 'throne'; level: number };

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  maxRank: number;
  /** Kosten je Rang (Index 0 = Rang 1) */
  costs: readonly Partial<Resources>[];
  /** Benötigte Gebäudestufe je Rang */
  requiredLevel: readonly number[];
  /** Wirkung PRO RANG (Rang 3 = dreifach) */
  modifiers?: readonly Modifier[];
  /** Zusätzliche Ressourcen nach jedem Kampf PRO RANG */
  income?: Partial<Resources>;
}

export interface BuildingDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  plot: PlotKind;
  /** false = darf mehrfach gebaut werden (z. B. Bauernhof) */
  unique: boolean;
  unlock: BuildingUnlock;
  /** Kosten je Stufe (Index 0 = Bau, Index 1 = Ausbau auf Stufe 2 …) */
  levels: readonly Partial<Resources>[];
  /** Diese Türme werden für die Nacht freigeschaltet, sobald das Gebäude steht */
  unlocksTowers?: readonly string[];
  /** Wirkung PRO GEBÄUDESTUFE */
  levelModifiers?: readonly Modifier[];
  /** Ressourcen nach jedem Kampf PRO GEBÄUDESTUFE */
  income?: Partial<Resources>;
  upgrades: readonly UpgradeDef[];
}

/** Kurzschreibweise für Upgrades mit gleichmäßig steigenden Kosten. */
function costs(base: Partial<Resources>, ranks: number, growth = 1.7): Partial<Resources>[] {
  return Array.from({ length: ranks }, (_, i) => {
    const c: Partial<Resources> = {};
    for (const [k, v] of Object.entries(base)) c[k as keyof Resources] = Math.round((v ?? 0) * Math.pow(growth, i));
    return c;
  });
}

export const BUILDINGS: readonly BuildingDef[] = [
  {
    id: 'thronsaal', name: 'Thronsaal', icon: 'icon_crown', plot: 'throne', unique: true,
    description: 'Herz der Stadt. Hier wird der König gestärkt. Höhere Stufen schalten Bauplätze und die Universität frei.',
    unlock: { type: 'start' },
    levels: [
      { holz: 30, stein: 20 },
      { gold: 80, holz: 80, stein: 60 },
      { gold: 200, holz: 150, stein: 150, nahrung: 50 },
      { gold: 400, stein: 300, magie: 40, nahrung: 100 },
      { gold: 800, stein: 500, magie: 100, nahrung: 200 },
    ],
    levelModifiers: [{ stat: 'gateMaxHp', kind: 'flat', value: 2 }],
    upgrades: [
      {
        id: 'koenigsklinge', name: 'Königliche Klinge', icon: 'icon_crown', maxRank: 5,
        description: 'Der König schlägt härter zu.',
        costs: costs({ gold: 30, nahrung: 10 }, 5), requiredLevel: [1, 1, 2, 3, 4],
        modifiers: [{ stat: 'kingDamage', kind: 'pct', value: 0.15 }],
      },
      {
        id: 'pfeilhagel_training', name: 'Pfeilhagel-Training', icon: 'icon_arrows', maxRank: 3,
        description: 'Stärkerer und schnellerer Pfeilhagel.',
        costs: costs({ gold: 50, holz: 40 }, 3), requiredLevel: [1, 2, 3],
        modifiers: [
          { stat: 'kingAbilityDamage', kind: 'pct', value: 0.2 },
          { stat: 'kingAbilityCooldown', kind: 'pct', value: -0.08 },
        ],
      },
      {
        id: 'koenigsstiefel', name: 'Königsstiefel', icon: 'icon_boot', maxRank: 3,
        description: 'Der König läuft schneller zu Rohstoffen und zurück.',
        costs: costs({ gold: 30, holz: 30 }, 3), requiredLevel: [1, 2, 3],
        modifiers: [{ stat: 'kingMoveSpeed', kind: 'pct', value: 0.25 }],
      },
      {
        id: 'fleissige_haende', name: 'Fleißige Hände', icon: 'icon_pick', maxRank: 3,
        description: 'Der König baut Rohstoffe schneller ab.',
        costs: costs({ gold: 30, nahrung: 20 }, 3), requiredLevel: [1, 2, 3],
        modifiers: [{ stat: 'kingHarvestSpeed', kind: 'pct', value: 0.3 }],
      },
      {
        id: 'eisentor', name: 'Eisenbeschlagenes Tor', icon: 'icon_wall', maxRank: 5,
        description: 'Das Stadttor hält mehr aus.',
        costs: costs({ holz: 30, stein: 40 }, 5), requiredLevel: [1, 1, 2, 3, 4],
        modifiers: [{ stat: 'gateMaxHp', kind: 'flat', value: 3 }],
      },
      {
        id: 'kriegskasse', name: 'Kriegskasse', icon: 'icon_rift', maxRank: 5,
        description: 'Mehr Rift-Kristalle zu Beginn jeder Nacht.',
        costs: costs({ gold: 50 }, 5), requiredLevel: [1, 2, 2, 3, 4],
        modifiers: [{ stat: 'startCrystals', kind: 'flat', value: 25 }],
      },
    ],
  },
  {
    id: 'bogenmacher', name: 'Bogenmacher', icon: 'top_bow', plot: 'inner', unique: true,
    description: 'Schaltet Bogenturm und Ballista für die Nacht frei.',
    unlock: { type: 'start' },
    levels: [
      { holz: 40, gold: 20 },
      { holz: 120, stein: 60, gold: 80 },
      { holz: 250, stein: 150, gold: 200, magie: 20 },
    ],
    unlocksTowers: ['bow', 'ballista'],
    upgrades: [
      {
        id: 'mehr_bogentuerme', name: 'Mehr Bogentürme', icon: 'top_bow', maxRank: 3,
        description: '+1 baubarer Bogenturm pro Nacht.',
        costs: costs({ holz: 40, gold: 30 }, 3), requiredLevel: [1, 2, 3],
        modifiers: [{ stat: 'towerLimit', kind: 'flat', value: 1, towerTags: ['bow'] }],
      },
      {
        id: 'mehr_ballisten', name: 'Mehr Ballisten', icon: 'top_ballista', maxRank: 2,
        description: '+1 baubare Ballista pro Nacht.',
        costs: costs({ holz: 60, stein: 30, gold: 40 }, 2), requiredLevel: [2, 3],
        modifiers: [{ stat: 'towerLimit', kind: 'flat', value: 1, towerTags: ['antiair'] }],
      },
      {
        id: 'bogenturm_stufen', name: 'Verstärkte Bogentürme', icon: 'tower_base_3', maxRank: 2,
        description: 'Bogentürme können im Kampf 1 Stufe höher verbessert werden.',
        costs: costs({ holz: 50, stein: 40, gold: 40 }, 2, 2), requiredLevel: [1, 2],
        modifiers: [{ stat: 'towerMaxLevel', kind: 'flat', value: 1, towerTags: ['bow'] }],
      },
      {
        id: 'ballista_stufen', name: 'Verstärkte Ballisten', icon: 'tower_base_3', maxRank: 2,
        description: 'Ballisten können im Kampf 1 Stufe höher verbessert werden.',
        costs: costs({ holz: 60, stein: 50, gold: 50 }, 2, 2), requiredLevel: [2, 3],
        modifiers: [{ stat: 'towerMaxLevel', kind: 'flat', value: 1, towerTags: ['antiair'] }],
      },
      {
        id: 'scharfe_pfeile', name: 'Scharfe Pfeile', icon: 'icon_arrows', maxRank: 5,
        description: 'Bogentürme: +10 % Schaden.',
        costs: costs({ holz: 30, gold: 20 }, 5, 1.6), requiredLevel: [1, 1, 2, 2, 3],
        modifiers: [{ stat: 'damage', kind: 'pct', value: 0.1, towerTags: ['bow'] }],
      },
      {
        id: 'schwere_bolzen', name: 'Schwere Bolzen', icon: 'top_ballista', maxRank: 5,
        description: 'Ballisten: +12 % Schaden.',
        costs: costs({ holz: 30, stein: 20, gold: 20 }, 5, 1.6), requiredLevel: [1, 2, 2, 3, 3],
        modifiers: [{ stat: 'damage', kind: 'pct', value: 0.12, towerTags: ['antiair'] }],
      },
    ],
  },
  {
    id: 'steinbruch', name: 'Steinbruch', icon: 'icon_pick', plot: 'mountain', unique: true,
    description: 'Bricht Stein aus dem Berg.',
    unlock: { type: 'start' },
    levels: [
      { holz: 30 },
      { holz: 60, gold: 30 },
      { holz: 100, gold: 80 },
      { holz: 160, gold: 150, nahrung: 40 },
      { holz: 250, gold: 250, magie: 20 },
    ],
    income: { stein: 15 },
    upgrades: [
      {
        id: 'bessere_spitzhacken', name: 'Bessere Spitzhacken', icon: 'icon_stein', maxRank: 3,
        description: '+8 Stein nach jedem Kampf.',
        costs: costs({ holz: 40, gold: 30 }, 3), requiredLevel: [1, 2, 3],
        income: { stein: 8 },
      },
      {
        id: 'goldader', name: 'Goldader', icon: 'icon_gold', maxRank: 3,
        description: '+10 Gold nach jedem Kampf.',
        costs: costs({ holz: 60, stein: 40 }, 3), requiredLevel: [2, 3, 4],
        income: { gold: 10 },
      },
    ],
  },
  {
    id: 'bauernhof', name: 'Bauernhof', icon: 'icon_nahrung', plot: 'field', unique: false,
    description: 'Felder vor dem Tor liefern Nahrung.',
    unlock: { type: 'start' },
    levels: [
      { holz: 25, gold: 10 },
      { holz: 60, stein: 20 },
      { holz: 100, stein: 60, gold: 40 },
      { holz: 160, stein: 100, gold: 100 },
      { holz: 250, stein: 160, gold: 200 },
    ],
    income: { nahrung: 15 },
    upgrades: [
      {
        id: 'reiche_ernte', name: 'Reiche Ernte', icon: 'icon_nahrung', maxRank: 3,
        description: '+8 Nahrung nach jedem Kampf.',
        costs: costs({ holz: 30, gold: 20 }, 3), requiredLevel: [1, 2, 3],
        income: { nahrung: 8 },
      },
      {
        id: 'gute_verpflegung', name: 'Gute Verpflegung', icon: 'icon_bolt', maxRank: 3,
        description: 'Satte Soldaten: alle Türme +4 % Angriffstempo.',
        costs: costs({ nahrung: 40, gold: 30 }, 3), requiredLevel: [2, 3, 4],
        modifiers: [{ stat: 'attackSpeed', kind: 'pct', value: 0.04 }],
      },
    ],
  },
  {
    id: 'universitaet', name: 'Universität', icon: 'icon_book', plot: 'inner', unique: true,
    description: 'Hier wird geforscht. Forschung schaltet neue Gebäude frei.',
    unlock: { type: 'throne', level: 2 },
    levels: [
      { holz: 100, stein: 80, gold: 60 },
      { holz: 200, stein: 200, gold: 150, magie: 20 },
      { holz: 300, stein: 300, gold: 300, magie: 60 },
    ],
    upgrades: [],
  },
  {
    id: 'holzfaeller', name: 'Holzfäller', icon: 'icon_holz', plot: 'field', unique: false,
    description: 'Fällt Holz rund um die Stadt. Sammler-Trupps bauen im Kampf Rohstoffe ab.',
    unlock: { type: 'research', id: 'forstwirtschaft' },
    levels: [
      { holz: 30, stein: 20, gold: 20 },
      { holz: 60, stein: 50, gold: 50 },
      { holz: 100, stein: 100, gold: 100 },
      { holz: 160, stein: 160, gold: 160 },
      { holz: 250, stein: 250, gold: 250 },
    ],
    income: { holz: 15 },
    upgrades: [
      {
        id: 'sammler_trupp', name: 'Sammler-Trupp', icon: 'icon_pick', maxRank: 3,
        description: 'Ein Sammler baut im Kampf regelmäßig ein Rohstoff-Feld ab (während der Wellen).',
        costs: costs({ holz: 60, gold: 60, nahrung: 30 }, 3, 2), requiredLevel: [1, 2, 3],
        modifiers: [{ stat: 'autoHarvest', kind: 'flat', value: 1 }],
      },
      {
        id: 'scharfe_aexte', name: 'Scharfe Äxte', icon: 'icon_holz', maxRank: 3,
        description: '+8 Holz nach jedem Kampf.',
        costs: costs({ stein: 30, gold: 30 }, 3), requiredLevel: [1, 2, 3],
        income: { holz: 8 },
      },
    ],
  },
  {
    id: 'giesserei', name: 'Kanonengießerei', icon: 'top_cannon', plot: 'inner', unique: true,
    description: 'Schaltet den Kanonenturm für die Nacht frei.',
    unlock: { type: 'research', id: 'schiesspulver' },
    levels: [
      { holz: 80, stein: 100, gold: 80 },
      { holz: 150, stein: 200, gold: 200, magie: 20 },
      { holz: 250, stein: 350, gold: 350, magie: 50 },
    ],
    unlocksTowers: ['cannon'],
    upgrades: [
      {
        id: 'mehr_kanonen', name: 'Mehr Kanonentürme', icon: 'top_cannon', maxRank: 2,
        description: '+1 baubarer Kanonenturm pro Nacht.',
        costs: costs({ stein: 80, gold: 60 }, 2, 2), requiredLevel: [1, 2],
        modifiers: [{ stat: 'towerLimit', kind: 'flat', value: 1, towerTags: ['cannon'] }],
      },
      {
        id: 'kanonen_stufen', name: 'Verstärkte Kanonen', icon: 'tower_base_3', maxRank: 2,
        description: 'Kanonentürme können im Kampf 1 Stufe höher verbessert werden.',
        costs: costs({ stein: 80, gold: 80 }, 2, 2), requiredLevel: [1, 2],
        modifiers: [{ stat: 'towerMaxLevel', kind: 'flat', value: 1, towerTags: ['cannon'] }],
      },
      {
        id: 'schwarzpulver', name: 'Schwarzpulver', icon: 'icon_bolt', maxRank: 5,
        description: 'Kanonentürme: +10 % Schaden.',
        costs: costs({ stein: 40, gold: 30 }, 5, 1.6), requiredLevel: [1, 1, 2, 2, 3],
        modifiers: [{ stat: 'damage', kind: 'pct', value: 0.1, towerTags: ['cannon'] }],
      },
      {
        id: 'grosse_kugeln', name: 'Große Kugeln', icon: 'top_cannon', maxRank: 3,
        description: 'Kanonen-Explosionen +10 % größer.',
        costs: costs({ stein: 60, gold: 50 }, 3), requiredLevel: [1, 2, 3],
        modifiers: [{ stat: 'splashRadius', kind: 'pct', value: 0.1, towerTags: ['cannon'] }],
      },
    ],
  },
  {
    id: 'akademie', name: 'Magierakademie', icon: 'top_mage', plot: 'inner', unique: true,
    description: 'Der befreite Hofmagier lehrt hier. Schaltet Magier- und Frostturm frei.',
    unlock: { type: 'story', id: 'hofmagier' },
    levels: [
      { stein: 100, gold: 100, magie: 40 },
      { stein: 200, gold: 200, magie: 100 },
      { stein: 350, gold: 350, magie: 200 },
    ],
    unlocksTowers: ['mage', 'frost'],
    upgrades: [
      {
        id: 'mehr_magier', name: 'Mehr Magiertürme', icon: 'top_mage', maxRank: 2,
        description: '+1 baubarer Magierturm pro Nacht.',
        costs: costs({ magie: 40, gold: 60 }, 2, 2), requiredLevel: [1, 2],
        modifiers: [{ stat: 'towerLimit', kind: 'flat', value: 1, towerTags: ['mage'] }],
      },
      {
        id: 'mehr_frost', name: 'Mehr Frosttürme', icon: 'top_frost', maxRank: 2,
        description: '+1 baubarer Frostturm pro Nacht.',
        costs: costs({ magie: 40, gold: 60 }, 2, 2), requiredLevel: [1, 2],
        modifiers: [{ stat: 'towerLimit', kind: 'flat', value: 1, towerTags: ['frost'] }],
      },
      {
        id: 'magie_stufen', name: 'Höhere Magie', icon: 'tower_base_3', maxRank: 2,
        description: 'Magier- und Frosttürme können 1 Stufe höher verbessert werden.',
        costs: costs({ magie: 60, gold: 80 }, 2, 2), requiredLevel: [1, 2],
        modifiers: [{ stat: 'towerMaxLevel', kind: 'flat', value: 1, towerTags: ['magic'] }],
      },
      {
        id: 'arkanes_wissen', name: 'Arkanes Wissen', icon: 'icon_kristall', maxRank: 5,
        description: 'Magier- und Frosttürme: +10 % Schaden.',
        costs: costs({ magie: 30, gold: 30 }, 5, 1.6), requiredLevel: [1, 1, 2, 2, 3],
        modifiers: [{ stat: 'damage', kind: 'pct', value: 0.1, towerTags: ['magic'] }],
      },
    ],
  },
  {
    id: 'wachturm', name: 'Wachturm', icon: 'icon_wall', plot: 'wall', unique: false,
    description: 'Ein Turm auf der Stadtmauer. Stärkt das Tor.',
    unlock: { type: 'research', id: 'wehrtuerme' },
    levels: [
      { holz: 40, stein: 60 },
      { holz: 80, stein: 120, gold: 40 },
      { holz: 120, stein: 200, gold: 100 },
    ],
    levelModifiers: [{ stat: 'gateMaxHp', kind: 'flat', value: 3 }],
    upgrades: [
      {
        id: 'spaeher', name: 'Späher', icon: 'icon_eye', maxRank: 3,
        description: '+3 % Chance, dass Gegner Gold fallen lassen.',
        costs: costs({ stein: 40, gold: 40 }, 3), requiredLevel: [1, 2, 3],
        modifiers: [{ stat: 'goldDropChance', kind: 'flat', value: 0.03 }],
      },
    ],
  },
  {
    id: 'schatzkammer', name: 'Schatzkammer', icon: 'icon_gold', plot: 'inner', unique: true,
    description: 'Mehr Rift-Kristalle zu Beginn der Nacht und mehr Gold-Beute.',
    unlock: { type: 'research', id: 'handel' },
    levels: [
      { holz: 100, stein: 120, gold: 150 },
      { holz: 200, stein: 250, gold: 300 },
      { holz: 300, stein: 400, gold: 500, magie: 50 },
    ],
    levelModifiers: [
      { stat: 'startCrystals', kind: 'flat', value: 20 },
      { stat: 'goldDropChance', kind: 'flat', value: 0.03 },
    ],
    upgrades: [
      {
        id: 'steuern', name: 'Steuern', icon: 'icon_gold', maxRank: 3,
        description: '+15 Gold nach jedem Kampf.',
        costs: costs({ holz: 60, stein: 60 }, 3), requiredLevel: [1, 2, 3],
        income: { gold: 15 },
      },
    ],
  },
  {
    id: 'orakel', name: 'Orakel', icon: 'icon_eye', plot: 'inner', unique: true,
    description: 'Blickt in die Zukunft: bessere Upgrade-Karten in der Nacht.',
    unlock: { type: 'research', id: 'sterndeutung' },
    levels: [
      { stein: 80, gold: 100, magie: 40 },
      { stein: 160, gold: 200, magie: 100 },
      { stein: 300, gold: 300, magie: 200 },
    ],
    levelModifiers: [
      { stat: 'cardRerolls', kind: 'flat', value: 1 },
      { stat: 'cardLuck', kind: 'flat', value: 0.5 },
    ],
    upgrades: [],
  },
];

export function getBuilding(id: string): BuildingDef {
  const def = BUILDINGS.find((b) => b.id === id);
  if (!def) throw new Error(`Unbekanntes Gebäude: ${id}`);
  return def;
}

export function findUpgrade(id: string): { building: BuildingDef; upgrade: UpgradeDef } {
  for (const building of BUILDINGS) {
    const upgrade = building.upgrades.find((u) => u.id === id);
    if (upgrade) return { building, upgrade };
  }
  throw new Error(`Unbekanntes Upgrade: ${id}`);
}
