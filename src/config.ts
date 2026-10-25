// Zentrale Konstanten für Layout und Balancing.
// Zahlen hier ändern, um das Spiel leichter oder schwerer zu machen.

/** Logische Spielauflösung (Querformat). Wird automatisch aufs Display skaliert. */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** Kantenlänge eines Kartenfelds in Pixeln. */
export const TILE = 72;
/** Größe der Kampfkarte in Feldern. Größer als der Bildschirm – man verschiebt sie mit dem Finger. */
export const COLS = 28;
export const ROWS = 13;

/** Höhe der oberen Leiste (Gold, Welle, Knöpfe). */
export const HUD_HEIGHT = 72;

/** Linke obere Ecke der Karte. Links davon steht die Stadtmauer mit Tor und König. */
export const MAP_X = 128;
export const MAP_Y = HUD_HEIGHT;

/** In dieser Zeile liegt das Stadttor; alle Wege enden hier. */
export const GATE_ROW = 6;

/** Größe der ganzen Kampfwelt in Pixeln (Mauer links + Karte). */
export const WORLD_WIDTH = MAP_X + COLS * TILE;
export const WORLD_HEIGHT = MAP_Y + ROWS * TILE;
/** x-Position, an der Gegner das Tor erreichen. */
export const GATE_X = 84;

export const FONT = '"Trebuchet MS", "Segoe UI", Roboto, Arial, sans-serif';

export const BALANCE = {
  /** Rift-Kristalle zu Beginn jeder Nacht: startCrystals + startCrystalsPerNight × (Nacht − 1) (+ Stadt-Boni). */
  startCrystals: 200,
  startCrystalsPerNight: 30,
  /** Leben des Stadttors (plus Stadtmauer). */
  gateHp: 20,
  /** Anteil der Baukosten, den man beim Verkaufen zurückbekommt. */
  sellRefund: 0.6,
  /** Rift-Kristall-Bonus für jede geschaffte Welle: base + perWave * Wellennummer. */
  waveClearCrystalsBase: 20,
  waveClearCrystalsPerWave: 4,
  /** Nach so vielen Wellen darf man eine Upgrade-Karte wählen. */
  cardEveryWaves: 3,
  /** Wellen pro Nacht: base + ceil(Nacht / 2), höchstens max. */
  wavesBase: 6,
  wavesMax: 12,
  /**
   * "Bedrohungspunkte" pro Welle – daraus werden die Gegner zusammengestellt:
   * (base + perWave × Welle) × (1 + perNight × (Nacht − 1)). So beginnt auch jede späte Nacht sanft.
   */
  waveBudgetBase: 6,
  waveBudgetPerWave: 3,
  waveBudgetPerNight: 0.15,
  /** Lebenspunkte-Zuwachs der Gegner pro Welle bzw. pro Nacht (0.1 = +10 %). */
  hpPerWave: 0.1,
  hpPerNight: 0.16,
  /** Ab dieser Nacht kann es zwei Wege geben, ab maxPathsFromNight immer. */
  secondPathFromNight: 4,
  maxPathsFromNight: 7,
  /** Werbung ansehen nach Niederlage: Welle wiederholen + so viele Rift-Kristalle. */
  adContinueCrystals: 100,
  /** Bei Niederlage behält man diesen Anteil der gesammelten Beute. */
  defeatLootFactor: 0.5,
  /** Siegprämie in Gold: base + perNight × Nacht */
  victoryGoldBase: 20,
  victoryGoldPerNight: 5,
  /** Chance, dass ein Gegner Gold fallen lässt; Menge ≈ Rift-Kristalle / goldDropDivisor */
  goldDropChance: 0.15,
  goldDropDivisor: 3,
  /** Sekunden, die Beute liegen bleibt, bevor sie in die Leiste fliegt */
  dropLingerSeconds: 1.2,
  /** König: Lauftempo (Felder/Sekunde) und Abbauzeit eines Rohstoff-Felds (Sekunden) */
  kingMoveSpeed: 1.8,
  harvestSeconds: 3,
  /** Sammler (Holzfäller-Upgrade): Sekunden zwischen zwei Abbauten, geteilt durch die Anzahl Sammler */
  autoHarvestSeconds: 25,
  /** Zivilisten des Rift-Sammlers: Lauftempo (Felder/s) und Abbauzeit (s) */
  civilianSpeed: 1.3,
  civilianHarvestSeconds: 4,
  /**
   * Glück: Jeder Punkt erhöht die Chance auf Gold-Beute um 15 % (relativ),
   * die Chance auf seltene Funde um 0,5 Prozentpunkte und verschiebt Karten zu höheren Seltenheiten.
   */
  luckDropBonus: 0.15,
  rareDropBase: 0.01,
  rareDropPerLuck: 0.005,
  /** Höchstens so viele Gift-Stapel auf einem Gegner */
  poisonMaxStacks: 5,
  /**
   * false: Upgrade-Karten gelten nur für die aktuelle Nacht (wie die Türme).
   * true: Karten bleiben über Nächte hinweg erhalten.
   */
  cardsPersistAcrossNights: false,
} as const;

/** Stadt (Tag-Sphäre) */
export const CITY = {
  /** Bauzeit für Gebäude, Ausbauten und Forschung in Sekunden (Platzhalter) */
  buildSeconds: 5,
  /** Startressourcen eines neuen Spiels */
  startResources: { gold: 60, holz: 120, stein: 50, magie: 0, nahrung: 30 },
} as const;
