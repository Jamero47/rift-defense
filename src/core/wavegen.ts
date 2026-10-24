import { BALANCE } from '../config';
import { getEnemy, type EnemyRole } from '../data/enemies';
import type { RiftDef } from '../data/rifts';
import type { Rng } from './rng';

// Stellt die Wellen einer Nacht zusammen. Jede Welle hat ein "Budget" an Bedrohungspunkten,
// das mit jeder Welle und jeder Nacht wächst. Davon werden Gegner "eingekauft".

export interface SpawnGroup {
  enemyId: string;
  count: number;
  /** Sekunden zwischen zwei Gegnern */
  interval: number;
  /** Sekunden nach Wellenstart */
  delay: number;
  /** Index des Wegs; -1 = Luftlinie (Fluggegner) */
  route: number;
}

export interface WaveDef {
  /** 1-basiert */
  number: number;
  groups: SpawnGroup[];
  hpMultiplier: number;
  isBoss: boolean;
  hasAir: boolean;
}

export function wavesForNight(night: number): number {
  return Math.min(BALANCE.wavesMax, BALANCE.wavesBase + Math.ceil(night / 2));
}

export function hpMultiplier(night: number, wave: number): number {
  return (1 + BALANCE.hpPerWave * (wave - 1)) * (1 + BALANCE.hpPerNight * (night - 1));
}

export function waveBudget(night: number, wave: number): number {
  return (BALANCE.waveBudgetBase + BALANCE.waveBudgetPerWave * wave) * (1 + BALANCE.waveBudgetPerNight * (night - 1));
}

const ROLE_INTERVAL: Record<EnemyRole, number> = {
  normal: 0.75,
  fast: 0.55,
  tank: 1.4,
  air: 1.0,
  special: 1.5,
  boss: 1,
};

/** Höchstens so viele Gegner pro Gruppe, damit es auf dem Handy flüssig bleibt. */
const MAX_PER_GROUP = 40;

export interface WaveGenOptions {
  /** Zusätzlicher Faktor auf die Anzahl (z. B. Rift-Effekt "Herdentiere"), 0.25 = +25 % */
  countBonus?: number;
}

export function generateWaves(
  night: number,
  rift: RiftDef,
  pathCount: number,
  rng: Rng,
  opts: WaveGenOptions = {},
): WaveDef[] {
  const total = wavesForNight(night);
  const countMul = 1 + (opts.countBonus ?? 0);
  const waves: WaveDef[] = [];

  for (let w = 1; w <= total; w++) {
    const isBoss = w === total;
    const hasAir = !isBoss && (w % 3 === 0 || (night >= 4 && w % 4 === 2));
    let budget = waveBudget(night, w) * countMul;
    const parts: { role: EnemyRole; budget: number }[] = [];

    if (isBoss) {
      parts.push({ role: 'boss', budget: 0 });
      budget *= 0.6; // Begleiter des Bosses
    }
    if (hasAir) {
      parts.push({ role: 'air', budget: budget * 0.5 });
      budget *= 0.5;
    }

    // Welche Bodentypen gibt es in dieser Welle schon? Jede Nacht beginnt sanft.
    const roles: Partial<Record<EnemyRole, number>> = { normal: 3 };
    if (w >= 2) roles.fast = 2;
    if (w >= (night >= 2 ? 3 : 4)) roles.tank = 1.5;
    if (w >= 3) roles.special = 1;

    // Die erste Bodengruppe besteht immer aus normalen Gegnern
    const groupCount = w <= 2 ? 1 : rng.int(2, 3);
    for (let g = 0; g < groupCount; g++) {
      const role = g === 0 && w !== 2 ? 'normal' : rng.weighted(roles as Record<EnemyRole, number>);
      parts.push({ role, budget: budget / groupCount });
    }

    const groups: SpawnGroup[] = [];
    let delay = 1;
    let groundIndex = rng.int(0, Math.max(0, pathCount - 1));
    for (const part of parts) {
      const enemyId = rng.pick(rift.enemies[part.role]);
      const def = getEnemy(enemyId);
      const count = part.role === 'boss' ? 1 : clamp(Math.round(part.budget / def.threat), 1, MAX_PER_GROUP);
      const interval = ROLE_INTERVAL[part.role];
      const route = def.flying ? -1 : groundIndex++ % Math.max(1, pathCount);
      groups.push({ enemyId, count, interval, delay, route });
      // Die nächste Gruppe startet, bevor diese ganz draußen ist
      delay += count * interval * 0.7 + 1.5;
    }

    waves.push({ number: w, groups, hpMultiplier: hpMultiplier(night, w), isBoss, hasAir });
  }
  return waves;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
