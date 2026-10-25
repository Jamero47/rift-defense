// Die Stadt in der Tag-Sphäre: Lage der Bauplätze (Bildschirm-Koordinaten bei 1280 × 720).
// Bauplätze werden mit Gold gekauft oder durch eine Thronsaal-Stufe frei.

export type PlotKind = 'throne' | 'inner' | 'mountain' | 'wall' | 'field';

export const PLOT_KIND_LABELS: Record<PlotKind, string> = {
  throne: 'Platz des Thronsaals',
  inner: 'Stadtplatz',
  mountain: 'Bergbauplatz',
  wall: 'Mauerplatz',
  field: 'Feld vor dem Tor',
};

export type PlotUnlock =
  | { type: 'start' }
  /** Automatisch frei ab dieser Thronsaal-Stufe */
  | { type: 'throne'; level: number }
  /** Mit Gold kaufen (ggf. erst ab einer Thronsaal-Stufe) */
  | { type: 'gold'; cost: number; throneLevel?: number };

export interface PlotDef {
  id: string;
  kind: PlotKind;
  x: number;
  y: number;
  unlock: PlotUnlock;
}

export const PLOT_SIZE: Record<PlotKind, { w: number; h: number }> = {
  throne: { w: 170, h: 120 },
  inner: { w: 112, h: 96 },
  mountain: { w: 150, h: 96 },
  wall: { w: 64, h: 64 },
  field: { w: 130, h: 92 },
};

// 26 Bauplätze. Es gibt weniger Stadtplätze als Stadtgebäude – man muss sich entscheiden.
export const PLOTS: readonly PlotDef[] = [
  { id: 'thron', kind: 'throne', x: 610, y: 385, unlock: { type: 'start' } },
  // Stadtplätze: obere Reihe, Seiten, untere Reihe
  { id: 'stadt_1', kind: 'inner', x: 550, y: 200, unlock: { type: 'start' } },
  { id: 'stadt_2', kind: 'inner', x: 670, y: 200, unlock: { type: 'throne', level: 2 } },
  { id: 'stadt_3', kind: 'inner', x: 430, y: 200, unlock: { type: 'gold', cost: 150, throneLevel: 2 } },
  { id: 'stadt_4', kind: 'inner', x: 790, y: 200, unlock: { type: 'throne', level: 3 } },
  { id: 'stadt_5', kind: 'inner', x: 550, y: 570, unlock: { type: 'gold', cost: 400, throneLevel: 3 } },
  { id: 'stadt_6', kind: 'inner', x: 670, y: 570, unlock: { type: 'throne', level: 4 } },
  { id: 'stadt_7', kind: 'inner', x: 430, y: 385, unlock: { type: 'gold', cost: 600, throneLevel: 4 } },
  { id: 'stadt_8', kind: 'inner', x: 790, y: 385, unlock: { type: 'throne', level: 5 } },
  { id: 'stadt_9', kind: 'inner', x: 430, y: 570, unlock: { type: 'gold', cost: 900, throneLevel: 5 } },
  { id: 'stadt_10', kind: 'inner', x: 790, y: 570, unlock: { type: 'gold', cost: 1400, throneLevel: 5 } },
  // Berg
  { id: 'berg', kind: 'mountain', x: 180, y: 300, unlock: { type: 'start' } },
  { id: 'berg_2', kind: 'mountain', x: 180, y: 430, unlock: { type: 'throne', level: 3 } },
  { id: 'berg_3', kind: 'mountain', x: 180, y: 560, unlock: { type: 'gold', cost: 500, throneLevel: 4 } },
  // Felder vor dem Tor
  { id: 'feld_1', kind: 'field', x: 1015, y: 232, unlock: { type: 'start' } },
  { id: 'feld_2', kind: 'field', x: 1015, y: 500, unlock: { type: 'gold', cost: 100 } },
  { id: 'feld_3', kind: 'field', x: 1172, y: 500, unlock: { type: 'throne', level: 3 } },
  { id: 'feld_4', kind: 'field', x: 1015, y: 128, unlock: { type: 'gold', cost: 250, throneLevel: 2 } },
  { id: 'feld_5', kind: 'field', x: 1172, y: 128, unlock: { type: 'throne', level: 4 } },
  { id: 'feld_6', kind: 'field', x: 1015, y: 608, unlock: { type: 'gold', cost: 600, throneLevel: 4 } },
  // Mauer
  { id: 'mauer_1', kind: 'wall', x: 345, y: 122, unlock: { type: 'throne', level: 2 } },
  { id: 'mauer_2', kind: 'wall', x: 900, y: 122, unlock: { type: 'gold', cost: 120, throneLevel: 2 } },
  { id: 'mauer_3', kind: 'wall', x: 345, y: 648, unlock: { type: 'throne', level: 3 } },
  { id: 'mauer_4', kind: 'wall', x: 900, y: 648, unlock: { type: 'gold', cost: 250, throneLevel: 3 } },
  { id: 'mauer_5', kind: 'wall', x: 610, y: 122, unlock: { type: 'throne', level: 4 } },
  { id: 'mauer_6', kind: 'wall', x: 610, y: 648, unlock: { type: 'gold', cost: 500, throneLevel: 4 } },
];

export function getPlot(id: string): PlotDef {
  const def = PLOTS.find((p) => p.id === id);
  if (!def) throw new Error(`Unbekannter Bauplatz: ${id}`);
  return def;
}
