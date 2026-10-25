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

  {
    id: 'kleeblatt', name: 'Kleeblatt', rarity: 'common',
    description: '+1 Glück: seltenere Karten, mehr Gold und seltene Funde',
    modifiers: [{ stat: 'luck', kind: 'flat', value: 1 }],
  },
  {
    id: 'giftmischer', name: 'Giftmischer', rarity: 'common',
    description: 'Gifttürme: +25 % Giftschaden',
    modifiers: [{ stat: 'poisonDamage', kind: 'pct', value: 0.25, towerTags: ['poison'] }],
  },
  {
    id: 'schwere_brocken', name: 'Schwere Brocken', rarity: 'common',
    description: 'Katapulte: +15 % Schaden',
    modifiers: [{ stat: 'damage', kind: 'pct', value: 0.15, towerTags: ['catapult'] }],
  },
  {
    id: 'manaquelle', name: 'Manaquelle', rarity: 'common',
    description: 'Alle Türme: +12 % Mana-Regeneration',
    modifiers: [{ stat: 'manaRegen', kind: 'pct', value: 0.12 }],
  },
  {
    id: 'flickwerk', name: 'Flickwerk', rarity: 'common',
    description: 'Das Tor heilt nach jeder Welle um 1',
    modifiers: [{ stat: 'gateRegen', kind: 'flat', value: 1 }],
    maxStacks: 3,
  },
  {
    id: 'sammelkoerbe', name: 'Sammelkörbe', rarity: 'common',
    description: 'Zivilisten der Rift-Sammler arbeiten 25 % schneller',
    modifiers: [{ stat: 'gatherSpeed', kind: 'pct', value: 0.25, towerTags: ['gatherer'] }],
  },
  {
    id: 'kristallsplitter', name: 'Kristallsplitter', rarity: 'common',
    description: '+1 Rift-Kristall für jeden besiegten Gegner',
    modifiers: [{ stat: 'crystalsPerKill', kind: 'flat', value: 1 }],
    maxStacks: 3,
  },
  {
    id: 'gegenwind', name: 'Gegenwind', rarity: 'common',
    description: 'Windtürme: +25 % Rückstoß',
    modifiers: [{ stat: 'knockback', kind: 'pct', value: 0.25, towerTags: ['wind'] }],
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

  {
    id: 'hufeisen', name: 'Hufeisen', rarity: 'rare',
    description: '+2 Glück',
    modifiers: [{ stat: 'luck', kind: 'flat', value: 2 }],
  },
  {
    id: 'scharfe_klingen', name: 'Scharfe Klingen', rarity: 'rare',
    description: 'Alle Türme: +25 % kritischer Schaden',
    modifiers: [{ stat: 'critDamage', kind: 'flat', value: 0.25 }],
  },
  {
    id: 'lautes_laeuten', name: 'Lautes Läuten', rarity: 'rare',
    description: 'Glockentürme: Aura +30 % stärker, +15 % Reichweite',
    modifiers: [
      { stat: 'auraStrength', kind: 'pct', value: 0.3, towerTags: ['bell'] },
      { stat: 'range', kind: 'pct', value: 0.15, towerTags: ['bell'] },
    ],
  },
  {
    id: 'reiche_ader', name: 'Reiche Ader', rarity: 'rare',
    description: 'Kristallminen: +30 % Ertrag',
    modifiers: [{ stat: 'mineIncome', kind: 'pct', value: 0.3, towerTags: ['mine'] }],
  },
  {
    id: 'zauberverstaerker', name: 'Zauberverstärker', rarity: 'rare',
    description: 'Alle Turm-Fähigkeiten wirken 20 % stärker',
    modifiers: [{ stat: 'abilityPower', kind: 'pct', value: 0.2 }],
  },
  {
    id: 'vorgeladen', name: 'Vorgeladen', rarity: 'rare',
    description: 'Neu gebaute Türme starten mit 50 % Mana',
    modifiers: [{ stat: 'startMana', kind: 'flat', value: 0.5 }],
    maxStacks: 2,
  },
  {
    id: 'aetzgift', name: 'Ätzgift', rarity: 'rare',
    description: 'Gifttürme: +40 % Giftschaden, +10 % Reichweite',
    modifiers: [
      { stat: 'poisonDamage', kind: 'pct', value: 0.4, towerTags: ['poison'] },
      { stat: 'range', kind: 'pct', value: 0.1, towerTags: ['poison'] },
    ],
  },
  {
    id: 'weitwurf', name: 'Weitwurf', rarity: 'rare',
    description: 'Katapulte: +15 % Reichweite und +15 % Explosionsradius',
    modifiers: [
      { stat: 'range', kind: 'pct', value: 0.15, towerTags: ['catapult'] },
      { stat: 'splashRadius', kind: 'pct', value: 0.15, towerTags: ['catapult'] },
    ],
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

  {
    id: 'glueckspilz', name: 'Glückspilz', rarity: 'epic',
    description: '+3 Glück und +2 % Chance auf seltene Funde',
    modifiers: [
      { stat: 'luck', kind: 'flat', value: 3 },
      { stat: 'rareDropChance', kind: 'flat', value: 0.02 },
    ],
  },
  {
    id: 'manaschleife', name: 'Manaschleife', rarity: 'epic',
    description: '20 % Chance, dass eine Fähigkeit nur halb so viel Mana kostet',
    modifiers: [{ stat: 'abilityRefund', kind: 'flat', value: 0.2 }],
    maxStacks: 2,
  },
  {
    id: 'grosse_familie', name: 'Große Familie', rarity: 'epic',
    description: 'Rift-Sammler: +1 Zivilist',
    modifiers: [{ stat: 'gatherers', kind: 'flat', value: 1, towerTags: ['gatherer'] }],
    maxStacks: 2,
  },
  {
    id: 'seuche', name: 'Seuche', rarity: 'epic',
    description: 'Gift- und Magie-Türme: +20 % Schaden; Gift wirkt +60 %',
    modifiers: [
      { stat: 'damage', kind: 'pct', value: 0.2, towerTags: ['poison', 'magic'] },
      { stat: 'poisonDamage', kind: 'pct', value: 0.6, towerTags: ['poison'] },
    ],
  },
  {
    id: 'turmbund', name: 'Turmbund', rarity: 'epic',
    description: 'Unterstützungs- und Wirtschaftstürme: +1 baubar',
    modifiers: [{ stat: 'towerLimit', kind: 'flat', value: 1, towerTags: ['support', 'economy'] }],
    maxStacks: 1,
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
  {
    id: 'fortuna', name: 'Fortunas Gunst', rarity: 'legendary',
    description: '+5 Glück, +5 % Chance auf seltene Funde, +1 Karten-Neuwurf',
    modifiers: [
      { stat: 'luck', kind: 'flat', value: 5 },
      { stat: 'rareDropChance', kind: 'flat', value: 0.05 },
      { stat: 'cardRerolls', kind: 'flat', value: 1 },
    ],
    maxStacks: 1,
  },
  {
    id: 'erzmagie', name: 'Erzmagie', rarity: 'legendary',
    description: 'Alle Türme: +40 % Mana-Regeneration, Fähigkeiten +30 % stärker',
    modifiers: [
      { stat: 'manaRegen', kind: 'pct', value: 0.4 },
      { stat: 'abilityPower', kind: 'pct', value: 0.3 },
    ],
    maxStacks: 1,
  },
  {
    id: 'blutkristalle', name: 'Blutkristalle', rarity: 'legendary',
    description: '+3 Rift-Kristalle pro Gegner und das Tor heilt 2 pro Welle',
    modifiers: [
      { stat: 'crystalsPerKill', kind: 'flat', value: 3 },
      { stat: 'gateRegen', kind: 'flat', value: 2 },
    ],
    maxStacks: 1,
  },
];

export function getCard(id: string): CardDef {
  const def = CARDS.find((c) => c.id === id);
  if (!def) throw new Error(`Unbekannte Karte: ${id}`);
  return def;
}
