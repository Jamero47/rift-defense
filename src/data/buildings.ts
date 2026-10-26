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
  /**
   * Entweder-oder: Steht eines dieser Gebäude (oder wird gebaut), kann man dieses nicht bauen.
   * Gilt in beide Richtungen – es reicht, das Paar bei einem Gebäude einzutragen.
   */
  excludes?: readonly string[];
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
        id: 'bogenturm_stufen', name: 'Verstärkte Bogentürme', icon: 'tower_base_3', maxRank: 1,
        description: 'Bogentürme können im Kampf bis Stufe 4 verbessert werden (Stufe 5: Forschung »Meisterbaukunst«).',
        costs: costs({ holz: 50, stein: 40, gold: 40 }, 1), requiredLevel: [2],
        modifiers: [{ stat: 'towerMaxLevel', kind: 'flat', value: 1, towerTags: ['bow'] }],
      },
      {
        id: 'ballista_stufen', name: 'Verstärkte Ballisten', icon: 'tower_base_3', maxRank: 1,
        description: 'Ballisten können im Kampf bis Stufe 4 verbessert werden (Stufe 5: Forschung »Meisterbaukunst«).',
        costs: costs({ holz: 60, stein: 50, gold: 50 }, 1), requiredLevel: [3],
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
      {
        id: 'steinmetze', name: 'Steinmetze', icon: 'icon_wall', maxRank: 3,
        description: 'Türme kosten im Kampf 3 % weniger Rift-Kristalle.',
        costs: costs({ stein: 60, gold: 40 }, 3), requiredLevel: [2, 3, 4],
        modifiers: [{ stat: 'towerCost', kind: 'pct', value: -0.03 }],
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
      {
        id: 'erntefest', name: 'Erntefest', icon: 'icon_clover', maxRank: 2,
        description: '+1 Glück in der Nacht.',
        costs: costs({ nahrung: 80, gold: 60 }, 2, 2), requiredLevel: [3, 5],
        modifiers: [{ stat: 'luck', kind: 'flat', value: 1 }],
      },
    ],
  },
  {
    id: 'universitaet', name: 'Universität', icon: 'icon_book', plot: 'inner', unique: true,
    description: 'Hier wird geforscht: Tippe auf »Forschungsbaum«. Forschung schaltet neue Gebäude frei.',
    unlock: { type: 'throne', level: 2 },
    levels: [
      { holz: 100, stein: 80, gold: 60 },
      { holz: 200, stein: 200, gold: 150, magie: 20 },
      { holz: 300, stein: 300, gold: 300, magie: 60 },
    ],
    upgrades: [
      {
        id: 'gelehrte', name: 'Gelehrte', icon: 'icon_book', maxRank: 3,
        description: 'Bauen und Forschen geht 10 % schneller.',
        costs: costs({ gold: 80, holz: 60 }, 3), requiredLevel: [1, 2, 3],
        modifiers: [{ stat: 'buildTime', kind: 'pct', value: -0.1 }],
      },
      {
        id: 'bibliothek', name: 'Bibliothek', icon: 'icon_scroll', maxRank: 2,
        description: '+1 Karten-Neuwurf pro Nacht.',
        costs: costs({ gold: 150, magie: 30 }, 2, 2), requiredLevel: [2, 3],
        modifiers: [{ stat: 'cardRerolls', kind: 'flat', value: 1 }],
      },
    ],
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
      {
        id: 'grosse_beute', name: 'Große Beute', icon: 'icon_pick', maxRank: 3,
        description: 'Abgebaute Rohstoff-Felder bringen 15 % mehr.',
        costs: costs({ holz: 50, gold: 50 }, 3), requiredLevel: [2, 3, 4],
        modifiers: [{ stat: 'harvestYield', kind: 'pct', value: 0.15 }],
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
    excludes: ['belagerungswerkstatt'],
    upgrades: [
      {
        id: 'mehr_kanonen', name: 'Mehr Kanonentürme', icon: 'top_cannon', maxRank: 2,
        description: '+1 baubarer Kanonenturm pro Nacht.',
        costs: costs({ stein: 80, gold: 60 }, 2, 2), requiredLevel: [1, 2],
        modifiers: [{ stat: 'towerLimit', kind: 'flat', value: 1, towerTags: ['cannon'] }],
      },
      {
        id: 'kanonen_stufen', name: 'Verstärkte Kanonen', icon: 'tower_base_3', maxRank: 1,
        description: 'Kanonentürme können im Kampf bis Stufe 4 verbessert werden (Stufe 5: Forschung »Meisterbaukunst«).',
        costs: costs({ stein: 80, gold: 80 }, 1), requiredLevel: [2],
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
      {
        id: 'kartaetschen', name: 'Kartätschen', icon: 'icon_kristall', maxRank: 3,
        description: 'Kanonentürme: +6 % kritische Trefferchance.',
        costs: costs({ stein: 70, gold: 60 }, 3), requiredLevel: [2, 2, 3],
        modifiers: [{ stat: 'critChance', kind: 'flat', value: 0.06, towerTags: ['cannon'] }],
      },
    ],
  },
  {
    id: 'akademie', name: 'Magiergilde', icon: 'top_mage', plot: 'inner', unique: true,
    description: 'Schaltet Magier- und Frostturm frei. Der befreite Hofmagier lehrt hier – tippe auf »Magiebaum« für Zauber-Forschung.',
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
        id: 'magie_stufen', name: 'Höhere Magie', icon: 'tower_base_3', maxRank: 1,
        description: 'Magie-Türme können im Kampf bis Stufe 4 verbessert werden (Stufe 5: Forschung »Meisterbaukunst«).',
        costs: costs({ magie: 60, gold: 80 }, 1), requiredLevel: [2],
        modifiers: [{ stat: 'towerMaxLevel', kind: 'flat', value: 1, towerTags: ['magic'] }],
      },
      {
        id: 'arkanes_wissen', name: 'Arkanes Wissen', icon: 'icon_kristall', maxRank: 5,
        description: 'Magier- und Frosttürme: +10 % Schaden.',
        costs: costs({ magie: 30, gold: 30 }, 5, 1.6), requiredLevel: [1, 1, 2, 2, 3],
        modifiers: [{ stat: 'damage', kind: 'pct', value: 0.1, towerTags: ['magic'] }],
      },
      {
        id: 'manakristalle', name: 'Manakristalle', icon: 'icon_wand', maxRank: 3,
        description: 'Magie-Türme: +10 % Mana-Regeneration.',
        costs: costs({ magie: 40, stein: 40 }, 3), requiredLevel: [1, 2, 3],
        modifiers: [{ stat: 'manaRegen', kind: 'pct', value: 0.1, towerTags: ['magic'] }],
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
      {
        id: 'zinnen', name: 'Zinnen', icon: 'icon_wall', maxRank: 3,
        description: 'Das Tor hat +2 Leben.',
        costs: costs({ stein: 60, holz: 30 }, 3), requiredLevel: [1, 2, 3],
        modifiers: [{ stat: 'gateMaxHp', kind: 'flat', value: 2 }],
      },
      {
        id: 'signalfeuer', name: 'Signalfeuer', icon: 'icon_air', maxRank: 3,
        description: 'Alle Türme: +8 % Schaden gegen Fluggegner.',
        costs: costs({ holz: 50, gold: 40 }, 3), requiredLevel: [1, 2, 3],
        modifiers: [{ stat: 'airDamage', kind: 'pct', value: 0.08 }],
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
      {
        id: 'kristalltresor', name: 'Kristalltresor', icon: 'icon_rift', maxRank: 2,
        description: 'Nach jeder Welle +5 % Zinsen auf deine Rift-Kristalle.',
        costs: costs({ gold: 150, stein: 100 }, 2, 2), requiredLevel: [2, 3],
        modifiers: [{ stat: 'interest', kind: 'flat', value: 0.05 }],
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
    excludes: ['gluecksbrunnen'],
    levelModifiers: [
      { stat: 'cardRerolls', kind: 'flat', value: 1 },
      { stat: 'luck', kind: 'flat', value: 1 },
    ],
    upgrades: [
      {
        id: 'sternkarten', name: 'Sternkarten', icon: 'icon_eye', maxRank: 3,
        description: '+1 Glück.',
        costs: costs({ magie: 40, gold: 60 }, 3), requiredLevel: [1, 2, 3],
        modifiers: [{ stat: 'luck', kind: 'flat', value: 1 }],
      },
      {
        id: 'vorahnung', name: 'Vorahnung', icon: 'icon_scroll', maxRank: 1,
        description: 'Eine Upgrade-Karte schon zu Beginn jeder Nacht.',
        costs: [{ magie: 150, gold: 200 }], requiredLevel: [3],
        modifiers: [{ stat: 'startCards', kind: 'flat', value: 1 }],
      },
    ],
  },
  // ---------------------------------------------------------------- Neue Gebäude (Forschungsbaum)
  // Entweder-oder-Paare: Kanonengießerei ⟷ Belagerungswerkstatt, Alchemistenhütte ⟷ Glockengießerei,
  // Händlergilde ⟷ Kristallschmiede, Orakel ⟷ Glücksbrunnen, Kapelle ⟷ Taverne.
  {
    id: 'belagerungswerkstatt', name: 'Belagerungswerkstatt', icon: 'top_catapult', plot: 'inner', unique: true,
    description: 'Schaltet das Katapult frei: riesige Reichweite, trifft die größte Gegnergruppe.',
    unlock: { type: 'research', id: 'belagerung' },
    levels: [
      { holz: 140, stein: 80, gold: 80 },
      { holz: 250, stein: 180, gold: 200, magie: 20 },
      { holz: 400, stein: 300, gold: 350, magie: 50 },
    ],
    unlocksTowers: ['catapult'],
    excludes: ['giesserei'],
    upgrades: [
      {
        id: 'mehr_katapulte', name: 'Mehr Katapulte', icon: 'top_catapult', maxRank: 2,
        description: '+1 baubares Katapult pro Nacht.',
        costs: costs({ holz: 90, gold: 70 }, 2, 2), requiredLevel: [1, 2],
        modifiers: [{ stat: 'towerLimit', kind: 'flat', value: 1, towerTags: ['catapult'] }],
      },
      {
        id: 'katapult_stufen', name: 'Verstärkte Katapulte', icon: 'tower_base_3', maxRank: 1,
        description: 'Katapulte können im Kampf bis Stufe 4 verbessert werden (Stufe 5: Forschung »Meisterbaukunst«).',
        costs: costs({ holz: 90, stein: 70, gold: 80 }, 1), requiredLevel: [2],
        modifiers: [{ stat: 'towerMaxLevel', kind: 'flat', value: 1, towerTags: ['catapult'] }],
      },
      {
        id: 'felsbrocken', name: 'Felsbrocken', icon: 'icon_stein', maxRank: 5,
        description: 'Katapulte: +10 % Schaden.',
        costs: costs({ stein: 40, holz: 30 }, 5, 1.6), requiredLevel: [1, 1, 2, 2, 3],
        modifiers: [{ stat: 'damage', kind: 'pct', value: 0.1, towerTags: ['catapult'] }],
      },
      {
        id: 'spannseile', name: 'Spannseile', icon: 'icon_eye', maxRank: 3,
        description: 'Katapulte: +6 % Reichweite.',
        costs: costs({ holz: 60, gold: 40 }, 3), requiredLevel: [1, 2, 3],
        modifiers: [{ stat: 'range', kind: 'pct', value: 0.06, towerTags: ['catapult'] }],
      },
    ],
  },
  {
    id: 'alchemistenhuette', name: 'Alchemistenhütte', icon: 'icon_flask', plot: 'inner', unique: true,
    description: 'Schaltet den Giftturm frei: Gift stapelt sich und wirkt über Zeit.',
    unlock: { type: 'research', id: 'alchemie' },
    levels: [
      { holz: 80, stein: 60, gold: 80, nahrung: 30 },
      { holz: 160, stein: 150, gold: 180, magie: 20 },
      { holz: 260, stein: 250, gold: 320, magie: 60 },
    ],
    unlocksTowers: ['poison'],
    excludes: ['glockengiesserei'],
    income: { magie: 2 },
    upgrades: [
      {
        id: 'mehr_gifttuerme', name: 'Mehr Gifttürme', icon: 'top_poison', maxRank: 2,
        description: '+1 baubarer Giftturm pro Nacht.',
        costs: costs({ nahrung: 60, gold: 60 }, 2, 2), requiredLevel: [1, 2],
        modifiers: [{ stat: 'towerLimit', kind: 'flat', value: 1, towerTags: ['poison'] }],
      },
      {
        id: 'gift_stufen', name: 'Starke Gifte', icon: 'tower_base_3', maxRank: 1,
        description: 'Gifttürme können im Kampf bis Stufe 4 verbessert werden (Stufe 5: Forschung »Meisterbaukunst«).',
        costs: costs({ nahrung: 60, magie: 30, gold: 60 }, 1), requiredLevel: [2],
        modifiers: [{ stat: 'towerMaxLevel', kind: 'flat', value: 1, towerTags: ['poison'] }],
      },
      {
        id: 'giftkueche', name: 'Giftküche', icon: 'icon_flask', maxRank: 5,
        description: 'Gifttürme: +12 % Giftschaden.',
        costs: costs({ nahrung: 30, gold: 30 }, 5, 1.6), requiredLevel: [1, 1, 2, 2, 3],
        modifiers: [{ stat: 'poisonDamage', kind: 'pct', value: 0.12, towerTags: ['poison'] }],
      },
      {
        id: 'destille', name: 'Destille', icon: 'icon_kristall', maxRank: 3,
        description: '+4 Magiekristalle nach jedem Kampf.',
        costs: costs({ stein: 50, gold: 50 }, 3), requiredLevel: [1, 2, 3],
        income: { magie: 4 },
      },
    ],
  },
  {
    id: 'glockengiesserei', name: 'Glockengießerei', icon: 'icon_bell', plot: 'inner', unique: true,
    description: 'Schaltet den Glockenturm frei: Türme in der Nähe schießen schneller.',
    unlock: { type: 'research', id: 'glockenguss' },
    levels: [
      { stein: 120, gold: 80 },
      { stein: 240, gold: 200, magie: 20 },
      { stein: 380, gold: 340, magie: 60 },
    ],
    unlocksTowers: ['bell'],
    excludes: ['alchemistenhuette'],
    upgrades: [
      {
        id: 'mehr_glocken', name: 'Mehr Glockentürme', icon: 'top_bell', maxRank: 2,
        description: '+1 baubarer Glockenturm pro Nacht.',
        costs: costs({ stein: 90, gold: 70 }, 2, 2), requiredLevel: [1, 2],
        modifiers: [{ stat: 'towerLimit', kind: 'flat', value: 1, towerTags: ['bell'] }],
      },
      {
        id: 'glocken_stufen', name: 'Große Glocken', icon: 'tower_base_3', maxRank: 1,
        description: 'Glockentürme können im Kampf bis Stufe 4 verbessert werden (Stufe 5: Forschung »Meisterbaukunst«).',
        costs: costs({ stein: 90, gold: 80 }, 1), requiredLevel: [2],
        modifiers: [{ stat: 'towerMaxLevel', kind: 'flat', value: 1, towerTags: ['bell'] }],
      },
      {
        id: 'klangkoerper', name: 'Klangkörper', icon: 'icon_bell', maxRank: 5,
        description: 'Glockentürme: Aura +8 % stärker.',
        costs: costs({ stein: 40, gold: 30 }, 5, 1.6), requiredLevel: [1, 1, 2, 2, 3],
        modifiers: [{ stat: 'auraStrength', kind: 'pct', value: 0.08, towerTags: ['bell'] }],
      },
      {
        id: 'weithall', name: 'Weithall', icon: 'icon_eye', maxRank: 3,
        description: 'Glockentürme: +10 % Reichweite der Aura.',
        costs: costs({ stein: 50, holz: 40 }, 3), requiredLevel: [1, 2, 3],
        modifiers: [{ stat: 'range', kind: 'pct', value: 0.1, towerTags: ['bell'] }],
      },
    ],
  },
  {
    id: 'haendlergilde', name: 'Händlergilde', icon: 'top_gatherer', plot: 'inner', unique: true,
    description: 'Schaltet den Rift-Sammler frei: Zivilisten sammeln Rohstoffe auf der Karte.',
    unlock: { type: 'research', id: 'karawanen' },
    levels: [
      { holz: 150, gold: 150, nahrung: 60 },
      { holz: 250, gold: 300, nahrung: 120 },
      { holz: 400, gold: 500, nahrung: 200, magie: 40 },
    ],
    unlocksTowers: ['gatherer'],
    excludes: ['kristallschmiede'],
    income: { gold: 10 },
    upgrades: [
      {
        id: 'mehr_sammler', name: 'Mehr Rift-Sammler', icon: 'top_gatherer', maxRank: 2,
        description: '+1 baubarer Rift-Sammler pro Nacht.',
        costs: costs({ gold: 100, nahrung: 60 }, 2, 2), requiredLevel: [1, 2],
        modifiers: [{ stat: 'towerLimit', kind: 'flat', value: 1, towerTags: ['gatherer'] }],
      },
      {
        id: 'sammler_stufen', name: 'Große Karawanen', icon: 'tower_base_3', maxRank: 1,
        description: 'Rift-Sammler können im Kampf bis Stufe 4 verbessert werden (Stufe 5: Forschung »Meisterbaukunst«).',
        costs: costs({ gold: 120, holz: 80 }, 1), requiredLevel: [2],
        modifiers: [{ stat: 'towerMaxLevel', kind: 'flat', value: 1, towerTags: ['gatherer'] }],
      },
      {
        id: 'packesel', name: 'Packesel', icon: 'icon_boot', maxRank: 3,
        description: 'Zivilisten laufen und sammeln 15 % schneller.',
        costs: costs({ nahrung: 50, gold: 40 }, 3), requiredLevel: [1, 2, 3],
        modifiers: [{ stat: 'gatherSpeed', kind: 'pct', value: 0.15, towerTags: ['gatherer'] }],
      },
      {
        id: 'marktstaende', name: 'Marktstände', icon: 'icon_gold', maxRank: 3,
        description: 'Abgebaute Felder bringen 10 % mehr, +10 Gold nach jedem Kampf.',
        costs: costs({ holz: 60, gold: 60 }, 3), requiredLevel: [1, 2, 3],
        modifiers: [{ stat: 'harvestYield', kind: 'pct', value: 0.1 }],
        income: { gold: 10 },
      },
    ],
  },
  {
    id: 'kristallschmiede', name: 'Kristallschmiede', icon: 'top_mine', plot: 'inner', unique: true,
    description: 'Schaltet die Kristallmine frei: Sie fördert im Kampf Rift-Kristalle.',
    unlock: { type: 'research', id: 'kristallkunde' },
    levels: [
      { stein: 160, gold: 120, magie: 20 },
      { stein: 280, gold: 250, magie: 50 },
      { stein: 420, gold: 420, magie: 100 },
    ],
    unlocksTowers: ['mine'],
    excludes: ['haendlergilde'],
    upgrades: [
      {
        id: 'mehr_minen', name: 'Mehr Kristallminen', icon: 'top_mine', maxRank: 2,
        description: '+1 baubare Kristallmine pro Nacht.',
        costs: costs({ stein: 100, gold: 90 }, 2, 2), requiredLevel: [1, 2],
        modifiers: [{ stat: 'towerLimit', kind: 'flat', value: 1, towerTags: ['mine'] }],
      },
      {
        id: 'minen_stufen', name: 'Tiefe Schächte', icon: 'tower_base_3', maxRank: 1,
        description: 'Kristallminen können im Kampf bis Stufe 4 verbessert werden (Stufe 5: Forschung »Meisterbaukunst«).',
        costs: costs({ stein: 120, gold: 100 }, 1), requiredLevel: [2],
        modifiers: [{ stat: 'towerMaxLevel', kind: 'flat', value: 1, towerTags: ['mine'] }],
      },
      {
        id: 'kristallbohrer', name: 'Kristallbohrer', icon: 'icon_rift', maxRank: 5,
        description: 'Kristallminen: +10 % Ertrag.',
        costs: costs({ stein: 50, magie: 15 }, 5, 1.6), requiredLevel: [1, 1, 2, 2, 3],
        modifiers: [{ stat: 'mineIncome', kind: 'pct', value: 0.1, towerTags: ['mine'] }],
      },
      {
        id: 'kristallsaeule', name: 'Kristallsäule', icon: 'icon_kristall', maxRank: 3,
        description: '+15 Rift-Kristalle zu Beginn jeder Nacht.',
        costs: costs({ stein: 60, gold: 60 }, 3), requiredLevel: [1, 2, 3],
        modifiers: [{ stat: 'startCrystals', kind: 'flat', value: 15 }],
      },
    ],
  },
  {
    id: 'mine', name: 'Mine', icon: 'icon_stein', plot: 'mountain', unique: false,
    description: 'Ein Stollen im Berg: Stein und ein paar Magiekristalle nach jedem Kampf.',
    unlock: { type: 'research', id: 'bergbau' },
    levels: [
      { holz: 80, gold: 60 },
      { holz: 140, gold: 120, stein: 60 },
      { holz: 220, gold: 220, stein: 120 },
      { holz: 320, gold: 350, stein: 200, magie: 30 },
    ],
    income: { stein: 10, magie: 2 },
    upgrades: [
      {
        id: 'edelsteine', name: 'Edelsteine', icon: 'icon_kristall', maxRank: 3,
        description: '+4 Magiekristalle nach jedem Kampf.',
        costs: costs({ holz: 60, gold: 60 }, 3), requiredLevel: [1, 2, 3],
        income: { magie: 4 },
      },
      {
        id: 'stollen', name: 'Tiefe Stollen', icon: 'icon_pick', maxRank: 3,
        description: '+10 Stein nach jedem Kampf.',
        costs: costs({ holz: 50, gold: 40 }, 3), requiredLevel: [1, 2, 4],
        income: { stein: 10 },
      },
    ],
  },
  {
    id: 'fischerhuette', name: 'Fischerhütte', icon: 'icon_nahrung', plot: 'field', unique: false,
    description: 'Fischt am Fluss: viel Nahrung.',
    unlock: { type: 'research', id: 'fischerei' },
    levels: [
      { holz: 50, gold: 20 },
      { holz: 90, stein: 30, gold: 40 },
      { holz: 140, stein: 70, gold: 90 },
    ],
    income: { nahrung: 22 },
    upgrades: [
      {
        id: 'netze', name: 'Große Netze', icon: 'icon_nahrung', maxRank: 3,
        description: '+10 Nahrung nach jedem Kampf.',
        costs: costs({ holz: 40, gold: 30 }, 3), requiredLevel: [1, 2, 3],
        income: { nahrung: 10 },
      },
      {
        id: 'raeucherei', name: 'Räucherei', icon: 'icon_gold', maxRank: 2,
        description: '+8 Gold nach jedem Kampf.',
        costs: costs({ holz: 60, stein: 40 }, 2), requiredLevel: [2, 3],
        income: { gold: 8 },
      },
    ],
  },
  {
    id: 'gluecksbrunnen', name: 'Glücksbrunnen', icon: 'icon_clover', plot: 'inner', unique: true,
    description: 'Wer eine Münze wirft, hat Glück: seltenere Karten, mehr Gold und seltene Funde.',
    unlock: { type: 'research', id: 'gluecksspiel' },
    levels: [
      { stein: 150, gold: 200, magie: 30 },
      { stein: 250, gold: 350, magie: 60 },
      { stein: 400, gold: 550, magie: 120 },
    ],
    levelModifiers: [
      { stat: 'luck', kind: 'flat', value: 2 },
      { stat: 'rareDropChance', kind: 'flat', value: 0.01 },
    ],
    upgrades: [
      {
        id: 'muenzwurf', name: 'Münzwurf', icon: 'icon_gold', maxRank: 3,
        description: '+3 % Chance, dass Gegner Gold fallen lassen.',
        costs: costs({ gold: 80 }, 3), requiredLevel: [1, 2, 3],
        modifiers: [{ stat: 'goldDropChance', kind: 'flat', value: 0.03 }],
      },
      {
        id: 'wunschmuenzen', name: 'Wunschmünzen', icon: 'icon_clover', maxRank: 3,
        description: '+1 Glück.',
        costs: costs({ gold: 100, magie: 30 }, 3), requiredLevel: [1, 2, 3],
        modifiers: [{ stat: 'luck', kind: 'flat', value: 1 }],
      },
    ],
  },
  {
    id: 'kapelle', name: 'Kapelle', icon: 'icon_heart', plot: 'inner', unique: true,
    description: 'Segen für das Tor: Es heilt nach jeder Welle.',
    unlock: { type: 'research', id: 'glaube' },
    levels: [
      { holz: 80, stein: 120, gold: 80 },
      { holz: 150, stein: 220, gold: 180 },
      { holz: 250, stein: 350, gold: 300, magie: 40 },
    ],
    excludes: ['taverne'],
    levelModifiers: [{ stat: 'gateRegen', kind: 'flat', value: 1 }],
    upgrades: [
      {
        id: 'segen', name: 'Segen', icon: 'icon_kristall', maxRank: 3,
        description: 'Alle Türme: +3 % kritische Trefferchance.',
        costs: costs({ gold: 60, nahrung: 40 }, 3), requiredLevel: [1, 2, 3],
        modifiers: [{ stat: 'critChance', kind: 'flat', value: 0.03 }],
      },
      {
        id: 'heilige_mauern', name: 'Heilige Mauern', icon: 'icon_wall', maxRank: 3,
        description: 'Das Tor hat +3 Leben.',
        costs: costs({ stein: 60, gold: 40 }, 3), requiredLevel: [1, 2, 3],
        modifiers: [{ stat: 'gateMaxHp', kind: 'flat', value: 3 }],
      },
    ],
  },
  {
    id: 'taverne', name: 'Taverne', icon: 'icon_scroll', plot: 'inner', unique: true,
    description: 'Helden auf Durchreise: Zu Beginn jeder Nacht darfst du eine Upgrade-Karte wählen.',
    unlock: { type: 'research', id: 'gastfreundschaft' },
    levels: [
      { holz: 150, stein: 80, gold: 150, nahrung: 80 },
      { holz: 250, stein: 160, gold: 300, nahrung: 150 },
    ],
    excludes: ['kapelle'],
    levelModifiers: [{ stat: 'startCards', kind: 'flat', value: 1 }],
    upgrades: [
      {
        id: 'stammgaeste', name: 'Stammgäste', icon: 'icon_scroll', maxRank: 2,
        description: '+1 Karten-Neuwurf pro Nacht.',
        costs: costs({ nahrung: 80, gold: 80 }, 2, 2), requiredLevel: [1, 2],
        modifiers: [{ stat: 'cardRerolls', kind: 'flat', value: 1 }],
      },
      {
        id: 'heldenlieder', name: 'Heldenlieder', icon: 'icon_clover', maxRank: 2,
        description: '+1 Glück.',
        costs: costs({ nahrung: 60, gold: 60 }, 2, 2), requiredLevel: [1, 2],
        modifiers: [{ stat: 'luck', kind: 'flat', value: 1 }],
      },
    ],
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
