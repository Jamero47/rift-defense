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
  /** Gift: Schaden pro Sekunde und Dauer (stapelt sich) */
  poison?: { dps: number; duration: number };
  /** Rückstoß in Feldern pro Treffer */
  knockback?: number;
  /** Bann: Treffer zerstören Schilde und unterbrechen Gegner-Fähigkeiten für so viele Sekunden */
  silence?: number;
  /** Aura: Türme in Reichweite bekommen so viel mehr Angriffstempo (0.15 = +15 %) */
  aura?: number;
  /** Zivilisten, die Rohstoffe auf der Karte sammeln */
  gatherers?: number;
  /** Rift-Kristalle alle 5 Sekunden während einer Welle */
  crystalIncome?: number;
}

/** Fähigkeit bei vollem Mana. Die Zahlen sind in der Toolbox änderbar. */
export type TowerAbility =
  | { type: 'volley'; arrows: number }
  | { type: 'bigshot'; damageMul: number; radiusMul: number }
  | { type: 'storm'; targets: number }
  | { type: 'freeze'; duration: number }
  | { type: 'pierce'; damageMul: number }
  | { type: 'poisonCloud'; radius: number; dps: number; duration: number }
  | { type: 'rockRain'; rocks: number; damageMul: number }
  | { type: 'rally'; attackSpeed: number; duration: number }
  | { type: 'caravan'; civilians: number }
  | { type: 'motherlode'; crystals: number }
  | { type: 'banish'; duration: number }
  | { type: 'tornado'; duration: number; knockback: number };

export interface TowerDef {
  id: string;
  name: string;
  description: string;
  tags: readonly TowerTag[];
  targets: { ground: boolean; air: boolean };
  /** 'none' = greift nicht an (Unterstützung/Wirtschaft) */
  attack: 'projectile' | 'chain' | 'none';
  /** Fähigkeit, die bei vollem Mana ausgelöst wird */
  ability: { name: string; description: string } & TowerAbility;
  /** Zielwahl beim Bauen (Standard: vorderster Gegner) */
  targetMode?: 'first' | 'strong' | 'close' | 'dense';
  projectile: { style: ProjectileStyle; speed: number };
  /** Hauptfarbe für Grafik und Menüs */
  color: number;
  /** So viele Türme dieser Art darf man im Kampf bauen (Gebäude-Upgrades erhöhen das). */
  baseLimit: number;
  /** Bis zu dieser Stufe kann man den Turm im Kampf verbessern (Gebäude-Upgrades schalten mehr frei). */
  baseMaxLevel: number;
  levels: readonly TowerLevel[];
}

export type ProjectileStyle = 'arrow' | 'ball' | 'bolt' | 'shard' | 'royal' | 'glob' | 'rock' | 'orb' | 'gust';

export const TOWERS: readonly TowerDef[] = [
  {
    id: 'bow',
    name: 'Bogenturm',
    description: 'Schnell und günstig. Trifft Boden- und Fluggegner.',
    tags: ['projectile', 'bow'],
    targets: { ground: true, air: true },
    attack: 'projectile',
    ability: { name: 'Pfeilsalve', description: 'Schießt eine Salve aus 5 Pfeilen auf verschiedene Gegner.', type: 'volley', arrows: 5 },
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
    ability: { name: 'Großkaliber', description: 'Feuert eine Riesenkugel: doppelter Schaden und doppelter Explosionsradius.', type: 'bigshot', damageMul: 2, radiusMul: 2 },
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
    ability: { name: 'Gewittersturm', description: 'Ein Blitz springt auf bis zu 8 Gegner, ohne schwächer zu werden.', type: 'storm', targets: 8 },
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
    ability: { name: 'Eiszeit', description: 'Friert alle Bodengegner in Reichweite für 2 Sekunden ein (Bosse nur halb so lang).', type: 'freeze', duration: 2 },
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
    ability: { name: 'Durchbohren', description: 'Ein Bolzen durchschlägt alle Fluggegner in einer Linie (1,5-facher Schaden).', type: 'pierce', damageMul: 1.5 },
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
  {
    id: 'poison',
    name: 'Giftturm',
    description: 'Vergiftet Bodengegner. Gift stapelt sich und wirkt über Zeit – ideal gegen zähe Gegner.',
    tags: ['projectile', 'poison'],
    targets: { ground: true, air: false },
    attack: 'projectile',
    ability: { name: 'Giftwolke', description: 'Eine Giftwolke auf der dichtesten Gegnergruppe: 20 Giftschaden pro Sekunde für 4 Sekunden.', type: 'poisonCloud', radius: 1.5, dps: 20, duration: 4 },
    projectile: { style: 'glob', speed: 7 },
    color: 0x84cc16,
    baseLimit: 1,
    baseMaxLevel: 1,
    levels: [
      { cost: 90, physDamage: 0, magicDamage: 3, attackSpeed: 1.0, range: 2.5, poison: { dps: 6, duration: 3 },
        critChance: 0.05, critDamage: 1.5, mana: 100, manaRegen: 8 },
      { cost: 80, physDamage: 0, magicDamage: 5, attackSpeed: 1.05, range: 2.6, poison: { dps: 10, duration: 3 },
        critChance: 0.05, critDamage: 1.5, mana: 100, manaRegen: 9 },
      { cost: 130, physDamage: 0, magicDamage: 8, attackSpeed: 1.1, range: 2.8, poison: { dps: 16, duration: 3.5 },
        critChance: 0.05, critDamage: 1.5, mana: 100, manaRegen: 10 },
    ],
  },
  {
    id: 'catapult',
    name: 'Katapult',
    description: 'Sehr große Reichweite. Wirft Felsen auf die dichteste Gegnergruppe. Nur Bodengegner.',
    tags: ['projectile', 'catapult'],
    targets: { ground: true, air: false },
    attack: 'projectile',
    targetMode: 'dense',
    ability: { name: 'Felsenregen', description: 'Fünf Felsen schlagen auf zufällige Gegner in Reichweite ein.', type: 'rockRain', rocks: 5, damageMul: 1 },
    projectile: { style: 'rock', speed: 5 },
    color: 0x8d6e4c,
    baseLimit: 1,
    baseMaxLevel: 1,
    levels: [
      { cost: 140, physDamage: 40, magicDamage: 0, attackSpeed: 0.3, range: 4.5, splashRadius: 1.1,
        critChance: 0.05, critDamage: 1.5, mana: 120, manaRegen: 5 },
      { cost: 110, physDamage: 65, magicDamage: 0, attackSpeed: 0.33, range: 5.0, splashRadius: 1.2,
        critChance: 0.05, critDamage: 1.5, mana: 120, manaRegen: 6 },
      { cost: 170, physDamage: 100, magicDamage: 0, attackSpeed: 0.36, range: 5.5, splashRadius: 1.35,
        critChance: 0.05, critDamage: 1.5, mana: 120, manaRegen: 7 },
    ],
  },
  {
    id: 'bell',
    name: 'Glockenturm',
    description: 'Greift nicht an. Türme in Reichweite feuern schneller (Aura).',
    tags: ['support', 'bell'],
    targets: { ground: false, air: false },
    attack: 'none',
    ability: { name: 'Sturmläuten', description: 'Alle Türme feuern 5 Sekunden lang 50 % schneller.', type: 'rally', attackSpeed: 0.5, duration: 5 },
    projectile: { style: 'arrow', speed: 0 },
    color: 0xd4a017,
    baseLimit: 1,
    baseMaxLevel: 1,
    levels: [
      { cost: 100, physDamage: 0, magicDamage: 0, attackSpeed: 0, range: 2.2, aura: 0.15,
        critChance: 0, critDamage: 1, mana: 100, manaRegen: 6 },
      { cost: 90, physDamage: 0, magicDamage: 0, attackSpeed: 0, range: 2.5, aura: 0.22,
        critChance: 0, critDamage: 1, mana: 100, manaRegen: 7 },
      { cost: 140, physDamage: 0, magicDamage: 0, attackSpeed: 0, range: 2.8, aura: 0.3,
        critChance: 0, critDamage: 1, mana: 100, manaRegen: 8 },
    ],
  },
  {
    id: 'gatherer',
    name: 'Rift-Sammler',
    description: 'Greift nicht an. Schickt während der Wellen Zivilisten los, die Rohstoffe auf der Karte abbauen.',
    tags: ['economy', 'gatherer'],
    targets: { ground: false, air: false },
    attack: 'none',
    ability: { name: 'Sammelzug', description: 'Drei zusätzliche Zivilisten ziehen los und sammeln, bis die Welle vorbei ist.', type: 'caravan', civilians: 3 },
    projectile: { style: 'arrow', speed: 0 },
    color: 0x22c55e,
    baseLimit: 1,
    baseMaxLevel: 1,
    levels: [
      { cost: 80, physDamage: 0, magicDamage: 0, attackSpeed: 0, range: 0, gatherers: 1,
        critChance: 0, critDamage: 1, mana: 100, manaRegen: 4 },
      { cost: 90, physDamage: 0, magicDamage: 0, attackSpeed: 0, range: 0, gatherers: 2,
        critChance: 0, critDamage: 1, mana: 100, manaRegen: 5 },
      { cost: 140, physDamage: 0, magicDamage: 0, attackSpeed: 0, range: 0, gatherers: 3,
        critChance: 0, critDamage: 1, mana: 100, manaRegen: 6 },
    ],
  },
  {
    id: 'mine',
    name: 'Kristallmine',
    description: 'Greift nicht an. Fördert während der Wellen alle 5 Sekunden Rift-Kristalle.',
    tags: ['economy', 'mine'],
    targets: { ground: false, air: false },
    attack: 'none',
    ability: { name: 'Mutterader', description: 'Sofort 40 Rift-Kristalle.', type: 'motherlode', crystals: 40 },
    projectile: { style: 'arrow', speed: 0 },
    color: 0xe879f9,
    baseLimit: 1,
    baseMaxLevel: 1,
    levels: [
      { cost: 120, physDamage: 0, magicDamage: 0, attackSpeed: 0, range: 0, crystalIncome: 4,
        critChance: 0, critDamage: 1, mana: 100, manaRegen: 5 },
      { cost: 100, physDamage: 0, magicDamage: 0, attackSpeed: 0, range: 0, crystalIncome: 7,
        critChance: 0, critDamage: 1, mana: 100, manaRegen: 6 },
      { cost: 150, physDamage: 0, magicDamage: 0, attackSpeed: 0, range: 0, crystalIncome: 11,
        critChance: 0, critDamage: 1, mana: 100, manaRegen: 7 },
    ],
  },
  {
    id: 'banner',
    name: 'Bannturm',
    description: 'Magische Treffer zerstören Schilde und unterbrechen Gegner-Fähigkeiten (Hacken, Brüllen, Brüten). Boden + Luft.',
    tags: ['projectile', 'magic', 'banner', 'control'],
    targets: { ground: true, air: true },
    attack: 'projectile',
    ability: { name: 'Bannkreis', description: 'Alle Gegner in Reichweite verlieren ihren Schild und können 6 Sekunden lang keine Fähigkeiten nutzen.', type: 'banish', duration: 6 },
    projectile: { style: 'orb', speed: 8 },
    color: 0xf0abfc,
    baseLimit: 1,
    baseMaxLevel: 1,
    levels: [
      { cost: 110, physDamage: 0, magicDamage: 8, attackSpeed: 0.9, range: 2.6, silence: 1.5,
        critChance: 0.05, critDamage: 1.5, mana: 100, manaRegen: 8 },
      { cost: 90, physDamage: 0, magicDamage: 13, attackSpeed: 0.95, range: 2.8, silence: 2,
        critChance: 0.05, critDamage: 1.5, mana: 100, manaRegen: 9 },
      { cost: 140, physDamage: 0, magicDamage: 20, attackSpeed: 1.0, range: 3.0, silence: 2.5,
        critChance: 0.05, critDamage: 1.5, mana: 100, manaRegen: 10 },
    ],
  },
  {
    id: 'wind',
    name: 'Windturm',
    description: 'Windstöße schieben Gegner zurück (Bosse kaum). Boden + Luft.',
    tags: ['projectile', 'magic', 'wind', 'control'],
    targets: { ground: true, air: true },
    attack: 'projectile',
    ability: { name: 'Wirbelsturm', description: 'Fluggegner in Reichweite stürzen 4 Sekunden ab (Bodentürme treffen sie), Bodengegner werden weit zurückgeworfen.', type: 'tornado', duration: 4, knockback: 1.5 },
    projectile: { style: 'gust', speed: 9 },
    color: 0x7dd3fc,
    baseLimit: 1,
    baseMaxLevel: 1,
    levels: [
      { cost: 100, physDamage: 0, magicDamage: 4, attackSpeed: 0.7, range: 2.4, knockback: 0.5,
        critChance: 0.05, critDamage: 1.5, mana: 100, manaRegen: 7 },
      { cost: 80, physDamage: 0, magicDamage: 6, attackSpeed: 0.75, range: 2.6, knockback: 0.7,
        critChance: 0.05, critDamage: 1.5, mana: 100, manaRegen: 8 },
      { cost: 130, physDamage: 0, magicDamage: 9, attackSpeed: 0.8, range: 2.8, knockback: 0.9,
        critChance: 0.05, critDamage: 1.5, mana: 100, manaRegen: 9 },
    ],
  },
];

export function getTower(id: string): TowerDef {
  const def = TOWERS.find((t) => t.id === id);
  if (!def) throw new Error(`Unbekannter Turm: ${id}`);
  return def;
}
