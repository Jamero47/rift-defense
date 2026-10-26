import type { Modifier, Resources } from '../core/types';

// Zwei Forschungsbäume:
//  - 'uni'   = Forschungsbaum der Universität (schaltet vor allem Gebäude frei)
//  - 'magic' = Magiebaum der Magiergilde (Zauber-Boni und magische Türme)
// Ein Knoten wird erforschbar, wenn ALLE Knoten in `requires` erforscht sind
// und das Gebäude des Baums die nötige Stufe hat. Jede Forschung dauert CITY.buildSeconds.
// `col`/`row` bestimmen nur die Lage im Baum-Fenster (Spalte 0–3, Zeile 0–4).

export type ResearchTree = 'uni' | 'magic';

export const RESEARCH_TREES: Record<ResearchTree, { name: string; building: string; color: number }> = {
  uni: { name: 'Forschungsbaum', building: 'universitaet', color: 0x60a5fa },
  magic: { name: 'Magiebaum', building: 'akademie', color: 0xc084fc },
};

export interface ResearchDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  tree: ResearchTree;
  col: number;
  row: number;
  /** Diese Forschungen müssen vorher fertig sein */
  requires: readonly string[];
  cost: Partial<Resources>;
  /** Benötigte Stufe des Baum-Gebäudes (Universität bzw. Magiergilde) */
  requiredLevel: number;
  /** Schaltet dieses Gebäude frei */
  unlocksBuilding?: string;
  /** Schaltet diese Türme direkt für die Nacht frei */
  unlocksTowers?: readonly string[];
  /** Dauerhafte Boni im Kampf */
  modifiers?: readonly Modifier[];
}

export const RESEARCH: readonly ResearchDef[] = [
  // ---------------------------------------------------------------- Universität
  {
    id: 'forstwirtschaft', name: 'Forstwirtschaft', icon: 'icon_holz', tree: 'uni', col: 0, row: 0, requires: [],
    description: 'Schaltet den Holzfäller frei (mit Sammler-Trupps für den Kampf).',
    cost: { gold: 60, holz: 50 }, requiredLevel: 1, unlocksBuilding: 'holzfaeller',
  },
  {
    id: 'fischerei', name: 'Fischerei', icon: 'icon_nahrung', tree: 'uni', col: 1, row: 0, requires: ['forstwirtschaft'],
    description: 'Schaltet die Fischerhütte frei: viel Nahrung auf einem Feld.',
    cost: { gold: 60, holz: 80 }, requiredLevel: 1, unlocksBuilding: 'fischerhuette',
  },
  {
    id: 'handel', name: 'Handel', icon: 'icon_gold', tree: 'uni', col: 2, row: 0, requires: ['fischerei'],
    description: 'Schaltet die Schatzkammer frei.',
    cost: { gold: 200, holz: 100 }, requiredLevel: 2, unlocksBuilding: 'schatzkammer',
  },
  {
    id: 'karawanen', name: 'Karawanen', icon: 'top_gatherer', tree: 'uni', col: 3, row: 0, requires: ['handel'],
    description: 'Schaltet die Händlergilde frei – und damit den Rift-Sammler.',
    cost: { gold: 250, holz: 150, nahrung: 80 }, requiredLevel: 2, unlocksBuilding: 'haendlergilde',
  },
  {
    id: 'bergbau', name: 'Bergbau', icon: 'icon_pick', tree: 'uni', col: 1, row: 1, requires: ['forstwirtschaft'],
    description: 'Schaltet die Mine am Berg frei: Stein und etwas Magie.',
    cost: { gold: 80, holz: 80 }, requiredLevel: 1, unlocksBuilding: 'mine',
  },
  {
    id: 'kristallkunde', name: 'Kristallkunde', icon: 'top_mine', tree: 'uni', col: 2, row: 1, requires: ['bergbau'],
    description: 'Schaltet die Kristallschmiede frei – und damit die Kristallmine.',
    cost: { gold: 200, stein: 150, magie: 20 }, requiredLevel: 2, unlocksBuilding: 'kristallschmiede',
  },
  {
    id: 'gluecksspiel', name: 'Glücksspiel', icon: 'icon_clover', tree: 'uni', col: 3, row: 1, requires: ['kristallkunde'],
    description: 'Schaltet den Glücksbrunnen frei. Mehr Glück = seltenere Karten und mehr Beute.',
    cost: { gold: 300, stein: 150, magie: 40 }, requiredLevel: 3, unlocksBuilding: 'gluecksbrunnen',
  },
  {
    id: 'schiesspulver', name: 'Schießpulver', icon: 'top_cannon', tree: 'uni', col: 0, row: 2, requires: [],
    description: 'Schaltet die Kanonengießerei frei – und damit den Kanonenturm.',
    cost: { gold: 120, stein: 80, magie: 10 }, requiredLevel: 1, unlocksBuilding: 'giesserei',
  },
  {
    id: 'belagerung', name: 'Belagerungskunst', icon: 'top_catapult', tree: 'uni', col: 1, row: 2, requires: ['schiesspulver'],
    description: 'Schaltet die Belagerungswerkstatt frei – und damit das Katapult.',
    cost: { gold: 150, holz: 120, stein: 80 }, requiredLevel: 1, unlocksBuilding: 'belagerungswerkstatt',
  },
  {
    id: 'ballistik', name: 'Ballistik', icon: 'icon_eye', tree: 'uni', col: 2, row: 2, requires: ['belagerung'],
    description: 'Alle Projektiltürme: +8 % Reichweite.',
    cost: { gold: 200, stein: 150 }, requiredLevel: 2,
    modifiers: [{ stat: 'range', kind: 'pct', value: 0.08, towerTags: ['projectile'] }],
  },
  {
    id: 'baukunst', name: 'Baukunst', icon: 'icon_wall', tree: 'uni', col: 3, row: 2, requires: ['ballistik'],
    description: 'Gebäude und Forschung sind 25 % schneller fertig.',
    cost: { gold: 300, holz: 200, stein: 200 }, requiredLevel: 3,
    modifiers: [{ stat: 'buildTime', kind: 'pct', value: -0.25 }],
  },
  {
    id: 'alchemie', name: 'Alchemie', icon: 'icon_flask', tree: 'uni', col: 1, row: 3, requires: ['schiesspulver'],
    description: 'Schaltet die Alchemistenhütte frei – und damit den Giftturm.',
    cost: { gold: 120, nahrung: 60, magie: 15 }, requiredLevel: 1, unlocksBuilding: 'alchemistenhuette',
  },
  {
    id: 'sterndeutung', name: 'Sterndeutung', icon: 'icon_eye', tree: 'uni', col: 2, row: 3, requires: ['alchemie'],
    description: 'Schaltet das Orakel frei.',
    cost: { gold: 150, magie: 40 }, requiredLevel: 2, unlocksBuilding: 'orakel',
  },
  {
    id: 'meisterbaukunst', name: 'Meisterbaukunst', icon: 'tower_base_5', tree: 'uni', col: 3, row: 3, requires: ['ballistik'],
    description: 'Alle Türme können im Kampf 1 Stufe höher verbessert werden (zusammen mit den Gebäude-Upgrades bis Stufe 5).',
    cost: { gold: 250, stein: 200, magie: 40 }, requiredLevel: 2,
    modifiers: [{ stat: 'towerMaxLevel', kind: 'flat', value: 1 }],
  },
  {
    id: 'wehrtuerme', name: 'Wehrtürme', icon: 'icon_wall', tree: 'uni', col: 0, row: 4, requires: [],
    description: 'Schaltet den Wachturm für die Mauerplätze frei.',
    cost: { holz: 60, stein: 100 }, requiredLevel: 1, unlocksBuilding: 'wachturm',
  },
  {
    id: 'glockenguss', name: 'Glockenguss', icon: 'icon_bell', tree: 'uni', col: 1, row: 4, requires: ['wehrtuerme'],
    description: 'Schaltet die Glockengießerei frei – und damit den Glockenturm.',
    cost: { gold: 120, stein: 120 }, requiredLevel: 1, unlocksBuilding: 'glockengiesserei',
  },
  {
    id: 'glaube', name: 'Glaube', icon: 'icon_heart', tree: 'uni', col: 2, row: 4, requires: ['glockenguss'],
    description: 'Schaltet die Kapelle frei: Das Tor heilt nach jeder Welle.',
    cost: { gold: 150, stein: 100, nahrung: 50 }, requiredLevel: 2, unlocksBuilding: 'kapelle',
  },
  {
    id: 'gastfreundschaft', name: 'Gastfreundschaft', icon: 'icon_scroll', tree: 'uni', col: 3, row: 4, requires: ['glaube'],
    description: 'Schaltet die Taverne frei: eine Upgrade-Karte schon zu Beginn der Nacht.',
    cost: { gold: 250, holz: 150, nahrung: 120 }, requiredLevel: 3, unlocksBuilding: 'taverne',
  },

  // ---------------------------------------------------------------- Magiergilde
  {
    id: 'manafluss', name: 'Manafluss', icon: 'icon_wand', tree: 'magic', col: 0, row: 2, requires: [],
    description: 'Alle Türme: +10 % Mana-Regeneration.',
    cost: { gold: 80, magie: 30 }, requiredLevel: 1,
    modifiers: [{ stat: 'manaRegen', kind: 'pct', value: 0.1 }],
  },
  {
    id: 'bannzauber', name: 'Bannzauber', icon: 'top_banner', tree: 'magic', col: 1, row: 0, requires: ['manafluss'],
    description: 'Schaltet den Bannturm frei: entfernt Schilde und sperrt Gegner-Fähigkeiten.',
    cost: { gold: 150, magie: 60 }, requiredLevel: 1, unlocksTowers: ['banner'],
  },
  {
    id: 'bannmeister', name: 'Bannmeister', icon: 'top_banner', tree: 'magic', col: 2, row: 0, requires: ['bannzauber'],
    description: 'Banntürme: +1 baubar und +20 % Schaden.',
    cost: { gold: 200, magie: 100 }, requiredLevel: 2,
    modifiers: [
      { stat: 'towerLimit', kind: 'flat', value: 1, towerTags: ['banner'] },
      { stat: 'damage', kind: 'pct', value: 0.2, towerTags: ['banner'] },
    ],
  },
  {
    id: 'arkane_macht', name: 'Arkane Macht', icon: 'icon_kristall', tree: 'magic', col: 1, row: 2, requires: ['manafluss'],
    description: 'Alle Turm-Fähigkeiten wirken 15 % stärker.',
    cost: { gold: 150, magie: 70 }, requiredLevel: 1,
    modifiers: [{ stat: 'abilityPower', kind: 'pct', value: 0.15 }],
  },
  {
    id: 'mana_echo', name: 'Mana-Echo', icon: 'icon_wand', tree: 'magic', col: 2, row: 2, requires: ['arkane_macht'],
    description: '10 % Chance, dass eine Fähigkeit nur die Hälfte des Manas verbraucht.',
    cost: { gold: 200, magie: 120 }, requiredLevel: 2,
    modifiers: [{ stat: 'abilityRefund', kind: 'flat', value: 0.1 }],
  },
  {
    id: 'erzmagier', name: 'Erzmagier', icon: 'top_mage', tree: 'magic', col: 3, row: 2, requires: ['mana_echo'],
    description: 'Magie-Türme: +25 % magischer Schaden.',
    cost: { gold: 350, magie: 200 }, requiredLevel: 3,
    modifiers: [
      { stat: 'magicDamage', kind: 'pct', value: 0.25, towerTags: ['magic'] },
    ],
  },
  {
    id: 'windzauber', name: 'Windzauber', icon: 'icon_wind', tree: 'magic', col: 1, row: 4, requires: ['manafluss'],
    description: 'Schaltet den Windturm frei: stößt Gegner zurück, holt Fluggegner vom Himmel.',
    cost: { gold: 150, magie: 60 }, requiredLevel: 1, unlocksTowers: ['wind'],
  },
  {
    id: 'sturmmeister', name: 'Sturmmeister', icon: 'top_wind', tree: 'magic', col: 2, row: 4, requires: ['windzauber'],
    description: 'Windtürme: +1 baubar und +25 % Rückstoß.',
    cost: { gold: 200, magie: 100 }, requiredLevel: 2,
    modifiers: [
      { stat: 'towerLimit', kind: 'flat', value: 1, towerTags: ['wind'] },
      { stat: 'knockback', kind: 'pct', value: 0.25, towerTags: ['wind'] },
    ],
  },
  {
    id: 'glueckszauber', name: 'Glückszauber', icon: 'icon_clover', tree: 'magic', col: 1, row: 3, requires: ['manafluss'],
    description: '+2 Glück: seltenere Karten und mehr Beute.',
    cost: { gold: 120, magie: 50 }, requiredLevel: 1,
    modifiers: [{ stat: 'luck', kind: 'flat', value: 2 }],
  },
  {
    id: 'schicksalsweber', name: 'Schicksalsweber', icon: 'icon_scroll', tree: 'magic', col: 2, row: 3, requires: ['glueckszauber'],
    description: '+1 Karten-Neuwurf pro Nacht und +1 % Chance auf seltene Funde.',
    cost: { gold: 220, magie: 110 }, requiredLevel: 2,
    modifiers: [
      { stat: 'cardRerolls', kind: 'flat', value: 1 },
      { stat: 'rareDropChance', kind: 'flat', value: 0.01 },
    ],
  },
  {
    id: 'kristallfokus', name: 'Kristallfokus', icon: 'icon_rift', tree: 'magic', col: 3, row: 3, requires: ['schicksalsweber'],
    description: 'Alle Türme starten mit 30 % Mana.',
    cost: { gold: 300, magie: 160 }, requiredLevel: 3,
    modifiers: [{ stat: 'startMana', kind: 'flat', value: 0.3 }],
  },
  {
    id: 'schutzrunen', name: 'Schutzrunen', icon: 'icon_heart', tree: 'magic', col: 1, row: 1, requires: ['manafluss'],
    description: 'Das Tor heilt nach jeder Welle um 1 und hat +3 Leben.',
    cost: { gold: 120, magie: 50, stein: 60 }, requiredLevel: 1,
    modifiers: [
      { stat: 'gateRegen', kind: 'flat', value: 1 },
      { stat: 'gateMaxHp', kind: 'flat', value: 3 },
    ],
  },
];

export function getResearch(id: string): ResearchDef {
  const def = RESEARCH.find((r) => r.id === id);
  if (!def) throw new Error(`Unbekannte Forschung: ${id}`);
  return def;
}
