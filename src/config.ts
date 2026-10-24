// Zentrale Konstanten für Layout und Balancing.
// Zahlen hier ändern, um das Spiel leichter oder schwerer zu machen.

/** Logische Spielauflösung (Querformat). Wird automatisch aufs Display skaliert. */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** Kantenlänge eines Kartenfelds in Pixeln. */
export const TILE = 72;
export const COLS = 16;
export const ROWS = 9;

/** Höhe der oberen Leiste (Gold, Welle, Knöpfe). */
export const HUD_HEIGHT = 72;

/** Linke obere Ecke der Karte. Links davon steht die Stadtmauer mit Tor und König. */
export const MAP_X = 128;
export const MAP_Y = HUD_HEIGHT;

/** In dieser Zeile liegt das Stadttor; alle Wege enden hier. */
export const GATE_ROW = 4;
/** x-Position, an der Gegner das Tor erreichen. */
export const GATE_X = 84;

export const FONT = '"Trebuchet MS", "Segoe UI", Roboto, Arial, sans-serif';

export const BALANCE = {
  /** Gold zu Beginn jeder Nacht (plus Schatzkammer): startGold + startGoldPerNight × (Nacht − 1). */
  startGold: 200,
  startGoldPerNight: 30,
  /** Leben des Stadttors (plus Stadtmauer). */
  gateHp: 20,
  /** Anteil der Baukosten, den man beim Verkaufen zurückbekommt. */
  sellRefund: 0.6,
  /** Gold-Bonus für jede geschaffte Welle: base + perWave * Wellennummer. */
  waveClearGoldBase: 20,
  waveClearGoldPerWave: 4,
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
  /** Werbung ansehen nach Niederlage: Welle wiederholen + so viel Gold. */
  adContinueGold: 100,
  /** Belohnung bei Niederlage: Anteil × (geschaffte Wellen / alle Wellen). */
  defeatRewardFactor: 0.5,
  /**
   * false: Upgrade-Karten gelten nur für die aktuelle Nacht (wie die Türme).
   * true: Karten bleiben über Nächte hinweg erhalten.
   */
  cardsPersistAcrossNights: false,
} as const;
