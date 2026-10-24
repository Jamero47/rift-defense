// Alle Gegner. Jeder Rift (siehe rifts.ts) bestimmt, welche Gegner in welcher Rolle auftreten.

export type EnemyRole = 'normal' | 'fast' | 'tank' | 'air' | 'special' | 'boss';

export type EnemyAbility =
  /** Deaktiviert Türme in der Nähe (Hacker). maxTargets: wie viele Türme gleichzeitig. */
  | { type: 'hack'; interval: number; radius: number; duration: number; maxTargets: number }
  /** Macht Gegner in der Nähe schneller (Brüllen). */
  | { type: 'roar'; interval: number; radius: number; boost: number; duration: number }
  /** Schild, der sich auflädt, wenn der Gegner eine Weile nicht getroffen wird. */
  | { type: 'shield'; amount: number; regenDelay: number }
  /** Erzeugt beim Tod neue Gegner. */
  | { type: 'spawnOnDeath'; enemy: string; count: number }
  /** Erzeugt regelmäßig neue Gegner. */
  | { type: 'spawner'; enemy: string; interval: number };

export interface EnemyLook {
  family: 'dino' | 'bot' | 'alien';
  variant: EnemyRole;
  body: number;
  accent: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  description: string;
  hp: number;
  /** Felder pro Sekunde */
  speed: number;
  /** 0 bis 0.9: Anteil des physischen Schadens, der abgehalten wird */
  armor: number;
  gold: number;
  /** Schaden am Stadttor, wenn der Gegner durchkommt */
  gateDamage: number;
  flying: boolean;
  boss?: boolean;
  /** Wie viele "Bedrohungspunkte" der Gegner im Wellen-Budget kostet */
  threat: number;
  /** Radius in Pixeln (Größe der Grafik) */
  radius: number;
  look: EnemyLook;
  abilities?: readonly EnemyAbility[];
}

export const ENEMIES: readonly EnemyDef[] = [
  // ---------- Urzeit ----------
  {
    id: 'dino_kompso', name: 'Kompsognathus', description: 'Kleiner, flinker Dino. Kommt in Gruppen.',
    hp: 26, speed: 1.1, armor: 0, gold: 4, gateDamage: 1, flying: false, threat: 1, radius: 13,
    look: { family: 'dino', variant: 'normal', body: 0x7bbf4a, accent: 0x3e6b26 },
  },
  {
    id: 'dino_raptor', name: 'Raptor', description: 'Sehr schnell.',
    hp: 34, speed: 1.9, armor: 0, gold: 6, gateDamage: 1, flying: false, threat: 2, radius: 14,
    look: { family: 'dino', variant: 'fast', body: 0xc9a227, accent: 0x6b4e12 },
  },
  {
    id: 'dino_trike', name: 'Triceratops', description: 'Gepanzert und zäh.',
    hp: 150, speed: 0.65, armor: 0.4, gold: 14, gateDamage: 3, flying: false, threat: 4, radius: 20,
    look: { family: 'dino', variant: 'tank', body: 0x8a6d5a, accent: 0xe8dcc0 },
  },
  {
    id: 'dino_ptero', name: 'Pteranodon', description: 'Fliegt in gerader Linie zum Tor.',
    hp: 42, speed: 1.15, armor: 0, gold: 8, gateDamage: 2, flying: true, threat: 2, radius: 15,
    look: { family: 'dino', variant: 'air', body: 0xd1774a, accent: 0x7a3b1f },
  },
  {
    id: 'dino_para', name: 'Parasaurolophus', description: 'Brüllt und macht Gegner in der Nähe schneller.',
    hp: 80, speed: 0.9, armor: 0.1, gold: 12, gateDamage: 2, flying: false, threat: 3, radius: 17,
    look: { family: 'dino', variant: 'special', body: 0x4aa3a8, accent: 0xe07a3f },
    abilities: [{ type: 'roar', interval: 5, radius: 2, boost: 0.5, duration: 2 }],
  },
  {
    id: 'dino_trex', name: 'Tyrannosaurus', description: 'Boss. Sein Brüllen treibt die Herde an.',
    hp: 750, speed: 0.5, armor: 0.25, gold: 100, gateDamage: 10, flying: false, boss: true, threat: 0, radius: 30,
    look: { family: 'dino', variant: 'boss', body: 0x6e4b3a, accent: 0xb5302a },
    abilities: [{ type: 'roar', interval: 6, radius: 3, boost: 0.4, duration: 2.5 }],
  },

  // ---------- Tech ----------
  {
    id: 'bot_scout', name: 'Späher-Bot', description: 'Leicht gepanzerter Standard-Roboter.',
    hp: 28, speed: 1.15, armor: 0.1, gold: 4, gateDamage: 1, flying: false, threat: 1, radius: 13,
    look: { family: 'bot', variant: 'normal', body: 0x9aa5b1, accent: 0x38bdf8 },
  },
  {
    id: 'bot_runner', name: 'Flitzer', description: 'Auf Rädern – sehr schnell.',
    hp: 30, speed: 2.0, armor: 0, gold: 6, gateDamage: 1, flying: false, threat: 2, radius: 13,
    look: { family: 'bot', variant: 'fast', body: 0xf2c94c, accent: 0x333333 },
  },
  {
    id: 'bot_tank', name: 'Kampfroboter', description: 'Schwere Panzerung. Magie hilft!',
    hp: 120, speed: 0.7, armor: 0.5, gold: 14, gateDamage: 3, flying: false, threat: 4, radius: 20,
    look: { family: 'bot', variant: 'tank', body: 0x5c6670, accent: 0xef4444 },
  },
  {
    id: 'bot_drone', name: 'Drohne', description: 'Fliegt in gerader Linie zum Tor.',
    hp: 38, speed: 1.3, armor: 0.1, gold: 8, gateDamage: 2, flying: true, threat: 2, radius: 15,
    look: { family: 'bot', variant: 'air', body: 0x64748b, accent: 0x22d3ee },
  },
  {
    id: 'bot_hacker', name: 'Hacker', description: 'Legt immer wieder einen Turm in der Nähe lahm.',
    hp: 65, speed: 0.9, armor: 0, gold: 15, gateDamage: 2, flying: false, threat: 3, radius: 15,
    look: { family: 'bot', variant: 'special', body: 0x1f2937, accent: 0x4ade80 },
    abilities: [{ type: 'hack', interval: 4.5, radius: 2.5, duration: 3, maxTargets: 1 }],
  },
  {
    id: 'bot_titan', name: 'Mech-Titan', description: 'Boss. Sein EMP-Stoß legt alle Türme in der Nähe lahm.',
    hp: 850, speed: 0.45, armor: 0.5, gold: 110, gateDamage: 12, flying: false, boss: true, threat: 0, radius: 30,
    look: { family: 'bot', variant: 'boss', body: 0x475569, accent: 0xf97316 },
    abilities: [{ type: 'hack', interval: 9, radius: 3, duration: 2.5, maxTargets: 99 }],
  },

  // ---------- Weltraum ----------
  {
    id: 'alien_crawler', name: 'Krabbler', description: 'Schwach, aber kommt in Schwärmen.',
    hp: 18, speed: 1.35, armor: 0, gold: 2, gateDamage: 1, flying: false, threat: 0.6, radius: 11,
    look: { family: 'alien', variant: 'normal', body: 0x84cc16, accent: 0x1a2e05 },
  },
  {
    id: 'alien_leaper', name: 'Springer', description: 'Springt blitzschnell voran.',
    hp: 32, speed: 2.0, armor: 0, gold: 6, gateDamage: 1, flying: false, threat: 2, radius: 13,
    look: { family: 'alien', variant: 'fast', body: 0xf472b6, accent: 0x831843 },
  },
  {
    id: 'alien_shield', name: 'Schildträger', description: 'Energieschild lädt sich wieder auf, wenn er nicht getroffen wird.',
    hp: 80, speed: 0.75, armor: 0.2, gold: 14, gateDamage: 3, flying: false, threat: 4, radius: 19,
    look: { family: 'alien', variant: 'tank', body: 0x6366f1, accent: 0x93c5fd },
    abilities: [{ type: 'shield', amount: 60, regenDelay: 3 }],
  },
  {
    id: 'alien_ufo', name: 'Ufo', description: 'Fliegt in gerader Linie zum Tor.',
    hp: 55, speed: 1.0, armor: 0, gold: 10, gateDamage: 2, flying: true, threat: 2.5, radius: 17,
    look: { family: 'alien', variant: 'air', body: 0x94a3b8, accent: 0x34d399 },
  },
  {
    id: 'alien_brood', name: 'Brüter', description: 'Platzt beim Tod und setzt Krabbler frei.',
    hp: 90, speed: 0.75, armor: 0, gold: 12, gateDamage: 2, flying: false, threat: 3.5, radius: 18,
    look: { family: 'alien', variant: 'special', body: 0xa3e635, accent: 0x7c3aed },
    abilities: [{ type: 'spawnOnDeath', enemy: 'alien_crawler', count: 3 }],
  },
  {
    id: 'alien_queen', name: 'Brutkönigin', description: 'Boss. Legt ständig neue Krabbler.',
    hp: 800, speed: 0.45, armor: 0.2, gold: 110, gateDamage: 12, flying: false, boss: true, threat: 0, radius: 30,
    look: { family: 'alien', variant: 'boss', body: 0x7e22ce, accent: 0xfacc15 },
    abilities: [
      { type: 'spawner', enemy: 'alien_crawler', interval: 3.5 },
      { type: 'spawnOnDeath', enemy: 'alien_crawler', count: 8 },
    ],
  },
];

export function getEnemy(id: string): EnemyDef {
  const def = ENEMIES.find((e) => e.id === id);
  if (!def) throw new Error(`Unbekannter Gegner: ${id}`);
  return def;
}
