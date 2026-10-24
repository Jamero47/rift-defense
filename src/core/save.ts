import { randomSeed } from './rng';
import { RESOURCE_IDS, emptyResources, type Resources } from './types';

// Spielstand: wird im Browser (localStorage) gespeichert.
// Später kann hier ein Cloud-Speicher angebunden werden (siehe docs/ROADMAP.md).

export const SAVE_VERSION = 1;
const STORAGE_KEY = 'riftdefense.save';

export interface SaveData {
  version: number;
  /** Startwert für alle Zufallskarten dieses Spielstands */
  seed: number;
  /** Die nächste (noch nicht geschaffte) Nacht */
  night: number;
  resources: Resources;
  /** Gebäude-ID → Stufe */
  buildings: Record<string, number>;
  /** Nur genutzt, wenn BALANCE.cardsPersistAcrossNights = true */
  cards: string[];
  stats: {
    bestNight: number;
    nightsWon: number;
    defeats: number;
    enemiesKilled: number;
  };
  settings: {
    speed: number;
    tutorialDone: boolean;
  };
}

export function defaultSave(seed = randomSeed()): SaveData {
  return {
    version: SAVE_VERSION,
    seed,
    night: 1,
    resources: emptyResources(),
    buildings: {},
    cards: [],
    stats: { bestNight: 0, nightsWon: 0, defeats: 0, enemiesKilled: 0 },
    settings: { speed: 1, tutorialDone: false },
  };
}

/** Ergänzt fehlende Felder, damit alte Spielstände nach Updates weiter funktionieren. */
export function migrateSave(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData>;
  const resources = emptyResources();
  for (const id of RESOURCE_IDS) resources[id] = num(r.resources?.[id], 0);
  return {
    version: SAVE_VERSION,
    seed: num(r.seed, base.seed),
    night: Math.max(1, Math.floor(num(r.night, 1))),
    resources,
    buildings: { ...(r.buildings ?? {}) },
    cards: Array.isArray(r.cards) ? r.cards.filter((c): c is string => typeof c === 'string') : [],
    stats: { ...base.stats, ...(r.stats ?? {}) },
    settings: { ...base.settings, ...(r.settings ?? {}) },
  };
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** Minimaler Speicher-Zugriff, damit Tests ohne Browser laufen. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): KeyValueStorage | null {
  try {
    const s = globalThis.localStorage;
    const probe = '__rift_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null; // z. B. privater Modus
  }
}

export class SaveStore {
  private data: SaveData;
  private readonly storage: KeyValueStorage | null;

  constructor(storage: KeyValueStorage | null = browserStorage()) {
    this.storage = storage;
    this.data = this.load();
  }

  get(): SaveData {
    return this.data;
  }

  /** Ändert den Spielstand und speichert sofort. */
  update(fn: (data: SaveData) => void): void {
    fn(this.data);
    this.persist();
  }

  reset(): void {
    this.data = defaultSave();
    this.persist();
  }

  private load(): SaveData {
    if (!this.storage) return defaultSave();
    try {
      const text = this.storage.getItem(STORAGE_KEY);
      return text ? migrateSave(JSON.parse(text)) : defaultSave();
    } catch {
      return defaultSave();
    }
  }

  private persist(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Speichern fehlgeschlagen (Speicher voll / blockiert) – Spiel läuft trotzdem weiter.
    }
  }
}

/** Der Spielstand für das ganze Spiel. */
export const saveStore = new SaveStore();
