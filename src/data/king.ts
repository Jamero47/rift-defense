// Der König steht vor dem Tor – die letzte Verteidigungslinie.
// Im Kampf kann man ihn mit Rift-Kristallen verbessern, dauerhaft über den Thronsaal (buildings.ts).
// Man kann ihn außerdem zu Rohstoff-Feldern schicken – dann fehlt er am Tor.

export const KING = {
  name: 'König Aldric',
  damage: 14,
  /** Angriffe pro Sekunde */
  attackSpeed: 1.1,
  /** Reichweite in Feldern, gemessen vom König */
  range: 2.4,
  /** Kosten in Rift-Kristallen für Stufe 2, 3, 4, 5 */
  upgradeCosts: [90, 140, 210, 300] as readonly number[],
  /** Zuwachs pro Stufe */
  perLevel: { damage: 0.3, attackSpeed: 0.1, range: 0.15 },
  ability: {
    name: 'Pfeilhagel',
    description: 'Tippe auf die Karte: Ein Pfeilhagel trifft alle Gegner im Zielgebiet – auch Fluggegner.',
    damage: 70,
    /** Radius in Feldern */
    radius: 1.4,
    /** Abklingzeit in Sekunden */
    cooldown: 25,
    /** Der Schaden kommt in so vielen Salven */
    hits: 3,
  },
} as const;

export const KING_MAX_LEVEL = KING.upgradeCosts.length + 1;
