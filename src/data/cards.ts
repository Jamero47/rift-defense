import type { Modifier } from '../core/types';

// Upgrade-Karten: Alle paar Wellen darf man aus drei Karten eine wählen.

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITIES: Record<Rarity, { name: string; color: number; weight: number }> = {
  common: { name: 'Gewöhnlich', color: 0xb8bcc6, weight: 60 },
  rare: { name: 'Selten', color: 0x3b82f6, weight: 28 },
  epic: { name: 'Episch', color: 0xa855f7, weight: 10 },
  legendary: { name: 'Legendär', color: 0xf59e0b, weight: 2 },
};

export const RARITY_ORDER: readonly Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export interface CardDef {
  id: string;
  name: string;
  rarity: Rarity;
  description: string;
  modifiers?: readonly Modifier[];
  /** Sofort-Effekte beim Wählen (Rift-Kristalle bzw. Tor-Leben) */
  instant?: { crystals?: number; heal?: number };
  /** Wie oft man die Karte höchstens nehmen kann (Standard: unbegrenzt) */
  maxStacks?: number;
}

export const CARDS: readonly CardDef[] = [
  // ---------- Gewöhnlich ----------
  {
    id: 'scharfe_spitzen', name: 'Scharfe Spitzen', rarity: 'common',
    description: 'Bogentürme: +15 % Schaden',
    modifiers: [{ stat: 'damage', kind: 'pct', value: 0.15, towerTags: ['bow'] }],
  },
  {
    id: 'schwarzpulver', name: 'Schwarzpulver', rarity: 'common',
    description: 'Kanonentürme: +15 % Schaden',
    modifiers: [{ stat: 'damage', kind: 'pct', value: 0.15, towerTags: ['cannon'] }],
  },
  {
    id: 'arkanes_wissen', name: 'Arkanes Wissen', rarity: 'common',
    description: 'Magier- und Frosttürme: +15 % Schaden',
    modifiers: [{ stat: 'damage', kind: 'pct', value: 0.15, towerTags: ['magic'] }],
  },
  {
    id: 'schwere_bolzen', name: 'Schwere Bolzen', rarity: 'common',
    description: 'Ballisten: +20 % Schaden',
    modifiers: [{ stat: 'damage', kind: 'pct', value: 0.2, towerTags: ['antiair'] }],
  },
  {
    id: 'frostbiss', name: 'Frostbiss', rarity: 'common',
    description: 'Frosttürme verlangsamen 10 % stärker',
    modifiers: [{ stat: 'slowStrength', kind: 'flat', value: 0.1, towerTags: ['frost'] }],
    maxStacks: 3,
  },
  {
    id: 'weitblick', name: 'Weitblick', rarity: 'common',
    description: 'Alle Türme: +6 % Reichweite',
    modifiers: [{ stat: 'range', kind: 'pct', value: 0.06 }],
  },
  {
    id: 'kriegskasse', name: 'Kriegskasse', rarity: 'common',
    description: 'Sofort +80 Rift-Kristalle',
    instant: { crystals: 80 },
  },
  {
    id: 'maurer', name: 'Maurerkolonne', rarity: 'common',
    description: 'Das Tor erhält sofort 5 Leben zurück',
    instant: { heal: 5 },
  },

  // ---------- Selten ----------
  {
    id: 'schmiedekunst', name: 'Schmiedekunst', rarity: 'rare',
    description: 'Alle Türme: +10 % Schaden',
    modifiers: [{ stat: 'damage', kind: 'pct', value: 0.1 }],
  },
  {
    id: 'schnelle_haende', name: 'Schnelle Hände', rarity: 'rare',
    description: 'Alle Türme: +10 % Angriffstempo',
    modifiers: [{ stat: 'attackSpeed', kind: 'pct', value: 0.1 }],
  },
  {
    id: 'kopfgeld', name: 'Kopfgeld', rarity: 'rare',
    description: 'Gegner geben +20 % Rift-Kristalle',
    modifiers: [{ stat: 'crystalGain', kind: 'pct', value: 0.2 }],
  },
  {
    id: 'baumeister', name: 'Baumeister', rarity: 'rare',
    description: 'Türme und Verbesserungen kosten 10 % weniger',
    modifiers: [{ stat: 'towerCost', kind: 'pct', value: -0.1 }],
    maxStacks: 3,
  },
  {
    id: 'koenigsklinge', name: 'Königsklinge', rarity: 'rare',
    description: 'König: +35 % Schaden',
    modifiers: [{ stat: 'kingDamage', kind: 'pct', value: 0.35 }],
  },
  {
    id: 'grosse_kugeln', name: 'Große Kugeln', rarity: 'rare',
    description: 'Kanonen-Explosionen 25 % größer',
    modifiers: [{ stat: 'splashRadius', kind: 'pct', value: 0.25, towerTags: ['cannon'] }],
    maxStacks: 3,
  },

  // ---------- Episch ----------
  {
    id: 'kettenblitz', name: 'Kettenblitz', rarity: 'epic',
    description: 'Magiertürme: Blitze springen auf 1 weiteres Ziel',
    modifiers: [{ stat: 'chainTargets', kind: 'flat', value: 1, towerTags: ['mage'] }],
    maxStacks: 3,
  },
  {
    id: 'panzerbrecher', name: 'Panzerbrecher', rarity: 'epic',
    description: 'Physischer Schaden ignoriert 30 % der Rüstung',
    modifiers: [{ stat: 'armorPen', kind: 'flat', value: 0.3 }],
    maxStacks: 3,
  },
  {
    id: 'adlerauge', name: 'Adlerauge', rarity: 'epic',
    description: '+40 % Schaden gegen Fluggegner',
    modifiers: [{ stat: 'airDamage', kind: 'pct', value: 0.4 }],
  },
  {
    id: 'zinsen', name: 'Zinsen', rarity: 'epic',
    description: 'Nach jeder Welle 10 % Zinsen auf deine Rift-Kristalle (höchstens 50)',
    modifiers: [{ stat: 'interest', kind: 'flat', value: 0.1 }],
    maxStacks: 2,
  },
  {
    id: 'glueckstreffer', name: 'Glückstreffer', rarity: 'epic',
    description: '+12 % kritische Trefferchance',
    modifiers: [{ stat: 'critChance', kind: 'flat', value: 0.12 }],
    maxStacks: 3,
  },

  // ---------- Legendär ----------
  {
    id: 'mehrfachschuss', name: 'Mehrfachschuss', rarity: 'legendary',
    description: 'Alle Projektiltürme: +1 Projektil',
    modifiers: [{ stat: 'projectiles', kind: 'flat', value: 1, towerTags: ['projectile'] }],
    maxStacks: 2,
  },
  {
    id: 'zeitverzerrung', name: 'Zeitverzerrung', rarity: 'legendary',
    description: 'Alle Gegner sind 15 % langsamer',
    modifiers: [{ stat: 'enemySpeed', kind: 'pct', value: -0.15 }],
    maxStacks: 2,
  },
  {
    id: 'goettlicher_segen', name: 'Göttlicher Segen', rarity: 'legendary',
    description: 'Alle Türme: +30 % Schaden',
    modifiers: [{ stat: 'damage', kind: 'pct', value: 0.3 }],
  },
  {
    id: 'koenigsmacht', name: 'Königsmacht', rarity: 'legendary',
    description: 'König: +60 % Schaden, Pfeilhagel lädt 40 % schneller',
    modifiers: [
      { stat: 'kingDamage', kind: 'pct', value: 0.6 },
      { stat: 'kingAbilityCooldown', kind: 'pct', value: -0.4 },
    ],
    maxStacks: 1,
  },
];

export function getCard(id: string): CardDef {
  const def = CARDS.find((c) => c.id === id);
  if (!def) throw new Error(`Unbekannte Karte: ${id}`);
  return def;
}
