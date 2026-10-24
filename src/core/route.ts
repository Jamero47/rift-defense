import type { Vec } from './types';

/** Ein Weg als Linienzug. Gegner merken sich nur, wie weit sie schon gelaufen sind. */
export class Route {
  readonly points: readonly Vec[];
  /** Zurückgelegte Strecke bis zu jedem Punkt. */
  private readonly cum: number[];
  readonly length: number;

  constructor(points: readonly Vec[]) {
    if (points.length < 2) throw new Error('Route braucht mindestens zwei Punkte');
    this.points = points;
    this.cum = [0];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      this.cum.push(this.cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    this.length = this.cum[this.cum.length - 1];
  }

  /** Position und Laufrichtung (Winkel) nach `dist` Pixeln. */
  at(dist: number): { x: number; y: number; angle: number } {
    const d = Math.min(Math.max(dist, 0), this.length);
    // Binäre Suche nach dem passenden Abschnitt
    let lo = 0;
    let hi = this.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= d) lo = mid;
      else hi = mid;
    }
    const a = this.points[lo];
    const b = this.points[hi];
    const segLen = this.cum[hi] - this.cum[lo] || 1;
    const t = (d - this.cum[lo]) / segLen;
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }
}

/** Entfernt Punkte, die auf einer geraden Linie liegen. */
export function simplifyPoints(points: readonly Vec[]): Vec[] {
  if (points.length <= 2) return [...points];
  const out: Vec[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = out[out.length - 1];
    const b = points[i];
    const c = points[i + 1];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) > 0.001) out.push(b);
  }
  out.push(points[points.length - 1]);
  return out;
}
