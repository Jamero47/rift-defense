import type { Modifier, StatKey, TowerTag } from './types';

// Sammelt Modifikatoren aus Karten, Gebäuden, Rifts und Feldern
// und berechnet daraus den Endwert: (Basis + feste Boni) × (1 + Prozent-Boni).

export class Modifiers {
  private readonly list: Modifier[];

  constructor(mods: readonly Modifier[] = []) {
    this.list = [...mods];
  }

  add(...mods: readonly Modifier[]): this {
    this.list.push(...mods);
    return this;
  }

  clone(): Modifiers {
    return new Modifiers(this.list);
  }

  all(): readonly Modifier[] {
    return this.list;
  }

  /** Summe aller Prozent-Boni für einen Wert (0.1 = +10 %). */
  pct(stat: StatKey, tags?: readonly TowerTag[]): number {
    return this.sum(stat, 'pct', tags);
  }

  /** Summe aller festen Boni für einen Wert. */
  flat(stat: StatKey, tags?: readonly TowerTag[]): number {
    return this.sum(stat, 'flat', tags);
  }

  /** Endwert: (base + flat) × (1 + pct), nie unter 0. */
  apply(stat: StatKey, base: number, tags?: readonly TowerTag[]): number {
    return Math.max(0, (base + this.flat(stat, tags)) * Math.max(0, 1 + this.pct(stat, tags)));
  }

  private sum(stat: StatKey, kind: Modifier['kind'], tags?: readonly TowerTag[]): number {
    let total = 0;
    for (const m of this.list) {
      if (m.stat === stat && m.kind === kind && matchesTags(m, tags)) total += m.value;
    }
    return total;
  }
}

/** Modifikatoren ohne Tags gelten für alles, mit Tags nur für passende Türme. */
function matchesTags(mod: Modifier, tags?: readonly TowerTag[]): boolean {
  if (!mod.towerTags || mod.towerTags.length === 0) return true;
  if (!tags) return false;
  return mod.towerTags.some((t) => tags.includes(t));
}

/** Multipliziert alle Werte, z. B. für Gebäude-Stufe 3 = 3 × Bonus. */
export function scaleModifiers(mods: readonly Modifier[], factor: number): Modifier[] {
  return mods.map((m) => ({ ...m, value: m.value * factor }));
}

// ---------- Texte für die Anzeige ----------

const STAT_LABELS: Record<StatKey, { label: string; flat: 'number' | 'percent' }> = {
  damage: { label: 'Schaden', flat: 'number' },
  attackSpeed: { label: 'Angriffstempo', flat: 'number' },
  range: { label: 'Reichweite', flat: 'number' },
  projectiles: { label: 'Projektil(e)', flat: 'number' },
  splashRadius: { label: 'Explosionsradius', flat: 'number' },
  slowStrength: { label: 'Verlangsamung', flat: 'percent' },
  chainTargets: { label: 'Kettenziel(e)', flat: 'number' },
  armorPen: { label: 'Rüstungsdurchschlag', flat: 'percent' },
  critChance: { label: 'Chance auf doppelten Schaden', flat: 'percent' },
  airDamage: { label: 'Schaden gegen Fluggegner', flat: 'number' },
  projectileSpeed: { label: 'Projektiltempo', flat: 'number' },
  towerCost: { label: 'Turmkosten', flat: 'number' },
  towerLimit: { label: 'baubare Türme', flat: 'number' },
  towerMaxLevel: { label: 'Turmstufe', flat: 'number' },
  crystalGain: { label: 'Rift-Kristalle pro Gegner', flat: 'number' },
  startCrystals: { label: 'Start-Rift-Kristalle', flat: 'number' },
  goldDropChance: { label: 'Chance auf Gold-Beute', flat: 'percent' },
  lootGain: { label: 'Beute', flat: 'number' },
  harvestYield: { label: 'Ertrag beim Abbauen', flat: 'number' },
  autoHarvest: { label: 'Sammler im Kampf', flat: 'number' },
  gateMaxHp: { label: 'Tor-Leben', flat: 'number' },
  interest: { label: 'Zinsen pro Welle', flat: 'percent' },
  enemyHp: { label: 'Gegner-Leben', flat: 'number' },
  enemySpeed: { label: 'Gegner-Tempo', flat: 'number' },
  enemyArmor: { label: 'Gegner-Rüstung', flat: 'percent' },
  enemyCount: { label: 'Gegner-Anzahl', flat: 'number' },
  kingDamage: { label: 'König: Schaden', flat: 'number' },
  kingAttackSpeed: { label: 'König: Tempo', flat: 'number' },
  kingRange: { label: 'König: Reichweite', flat: 'number' },
  kingAbilityDamage: { label: 'Pfeilhagel: Schaden', flat: 'number' },
  kingAbilityCooldown: { label: 'Pfeilhagel: Abklingzeit', flat: 'number' },
  kingMoveSpeed: { label: 'König: Lauftempo', flat: 'number' },
  kingHarvestSpeed: { label: 'König: Abbautempo', flat: 'number' },
  cardLuck: { label: 'Glück bei Karten', flat: 'number' },
  cardRerolls: { label: 'Karten-Neuwurf pro Nacht', flat: 'number' },
};

export const TAG_LABELS: Record<TowerTag, string> = {
  projectile: 'Projektiltürme',
  magic: 'Magie-Türme',
  bow: 'Bogentürme',
  cannon: 'Kanonentürme',
  mage: 'Magiertürme',
  frost: 'Frosttürme',
  antiair: 'Ballisten',
};

export function formatNumber(n: number, digits = 1): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: digits });
}

/** z. B. "+10 % Schaden (Bogentürme)" */
export function describeModifier(m: Modifier): string {
  let text = valueText(m, STAT_LABELS[m.stat].label);
  if (m.towerTags && m.towerTags.length > 0) {
    text += ` (${m.towerTags.map((t) => TAG_LABELS[t]).join(', ')})`;
  }
  return text;
}

function valueText(m: Modifier, label: string): string {
  const sign = m.value >= 0 ? '+' : '−';
  const abs = Math.abs(m.value);
  if (m.kind === 'pct' || STAT_LABELS[m.stat].flat === 'percent') return `${sign}${formatNumber(abs * 100, 0)} % ${label}`;
  return `${sign}${formatNumber(abs)} ${label}`;
}

/**
 * Kurzform für enge Stellen: fasst nach Ziel zusammen,
 * z. B. ["Bogentürme: +10 % Schaden, +4 % Reichweite"].
 */
export function describeModifiersCompact(mods: readonly Modifier[]): string[] {
  const groups = new Map<string, string[]>();
  for (const m of mods) {
    let label = STAT_LABELS[m.stat].label;
    let group = '';
    if (m.towerTags && m.towerTags.length > 0) {
      group = m.towerTags.map((t) => TAG_LABELS[t]).join(', ');
    } else if (label.includes(': ')) {
      [group, label] = label.split(': ');
    }
    const list = groups.get(group) ?? [];
    list.push(valueText(m, label));
    groups.set(group, list);
  }
  return [...groups.entries()].map(([group, parts]) => (group ? `${group}: ${parts.join(', ')}` : parts.join(', ')));
}
