import { BALANCE, CITY } from '../config';
import { BUILDINGS } from '../data/buildings';
import { CARDS } from '../data/cards';
import { PLOTS } from '../data/city';
import { ENEMIES } from '../data/enemies';
import { KING } from '../data/king';
import { RESEARCH } from '../data/research';
import { RIFTS } from '../data/rifts';
import { STORY_NIGHTS } from '../data/story';
import { TOWERS } from '../data/towers';

// Änderungen aus der Toolbox ("Mod"). Sie werden beim Spielstart auf die Spieldaten angewendet:
//   1. public/mods/mod.json  – fest im Projekt (gilt für alle Spieler:innen)
//   2. dieser Browser        – eigene Tests aus der Toolbox (localStorage + IndexedDB)
// Gespeichert werden nur die Unterschiede zu den Standardwerten im Code.

export const SECTION_DATA = {
  towers: TOWERS,
  enemies: ENEMIES,
  king: KING,
  cards: CARDS,
  rifts: RIFTS,
  balance: BALANCE,
  buildings: BUILDINGS,
  plots: PLOTS,
  research: RESEARCH,
  story: STORY_NIGHTS,
  city: CITY,
} as const;

export type SectionId = keyof typeof SECTION_DATA;

export interface ModFile {
  /** Format-Version der Datei */
  version: 1;
  /** Nur die geänderten Werte je Bereich */
  data: Partial<Record<SectionId, unknown>>;
  /** Ersetzte Grafiken: Textur-Schlüssel → Bild als data-URL */
  images: Record<string, string>;
}

export function emptyMod(): ModFile {
  return { version: 1, data: {}, images: {} };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const hasId = (v: unknown): v is Obj & { id: string } => isObj(v) && typeof v.id === 'string';

/** Schreibt `src` in `target` (Listen mit id werden über die id zugeordnet). Verändert `target`. */
export function deepMerge(target: unknown, src: unknown): unknown {
  if (Array.isArray(target) && Array.isArray(src)) {
    if (src.every(hasId)) {
      for (const item of src) {
        const match = target.find((t) => hasId(t) && t.id === item.id);
        if (match) deepMerge(match, item);
      }
      return target;
    }
    src.forEach((v, i) => {
      if (i >= target.length) return; // Länge bleibt gleich (keine neuen Einträge)
      if (isObj(target[i]) || Array.isArray(target[i])) deepMerge(target[i], v);
      else target[i] = v;
    });
    return target;
  }
  if (isObj(target) && isObj(src)) {
    for (const [k, v] of Object.entries(src)) {
      if (k === 'id') continue;
      if ((isObj(target[k]) || Array.isArray(target[k])) && (isObj(v) || Array.isArray(v))) deepMerge(target[k], v);
      else if (v === null) delete target[k];
      else target[k] = v;
    }
  }
  return target;
}

/**
 * Unterschiede zwischen Standardwert und aktuellem Wert (undefined = keine Änderung).
 * Gelöschte Schlüssel werden als null gespeichert.
 */
export function diff(base: unknown, current: unknown): unknown {
  if (Array.isArray(base) && Array.isArray(current)) {
    if (current.every(hasId)) {
      const out: Obj[] = [];
      for (const item of current) {
        const b = base.find((x) => hasId(x) && x.id === item.id);
        const d = diff(b, item);
        if (d !== undefined) out.push({ id: item.id, ...(d as Obj) });
      }
      return out.length ? out : undefined;
    }
    if (JSON.stringify(base) === JSON.stringify(current)) return undefined;
    // Listen ohne id (z. B. Stufen): Eintrag für Eintrag, damit auch gelöschte Werte (null) ankommen
    return current.map((c, i) => (isObj(c) || Array.isArray(c) ? diff(base[i], c) ?? {} : c));
  }
  if (isObj(base) && isObj(current)) {
    const out: Obj = {};
    for (const k of new Set([...Object.keys(base), ...Object.keys(current)])) {
      if (!(k in current)) {
        out[k] = null;
        continue;
      }
      const d = diff(base[k], current[k]);
      if (d !== undefined) out[k] = d;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return base === current ? undefined : current;
}

/** Wendet die Daten einer Mod-Datei auf die Spieldaten an. */
export function applyModData(data: ModFile['data']): void {
  for (const [id, value] of Object.entries(data)) {
    const target = SECTION_DATA[id as SectionId];
    if (target && value !== undefined) deepMerge(target, value);
  }
}

// ---------------------------------------------------------------- Speicher im Browser

const LOCAL_KEY = 'riftdefense.mod';
const DB_NAME = 'riftdefense';
const DB_STORE = 'mod';

export function loadLocalData(): ModFile['data'] {
  try {
    const text = globalThis.localStorage?.getItem(LOCAL_KEY);
    const parsed = text ? JSON.parse(text) : null;
    return isObj(parsed) ? (parsed as ModFile['data']) : {};
  } catch {
    return {};
  }
}

export function saveLocalData(data: ModFile['data']): void {
  try {
    if (Object.keys(data).length === 0) globalThis.localStorage?.removeItem(LOCAL_KEY);
    else globalThis.localStorage?.setItem(LOCAL_KEY, JSON.stringify(data));
  } catch {
    // Speicher voll oder blockiert
  }
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Grafiken liegen in IndexedDB, weil sie für localStorage zu groß sind. */
export async function loadLocalImages(): Promise<Record<string, string>> {
  const db = await openDb();
  if (!db) return {};
  return new Promise((resolve) => {
    const req = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get('images');
    req.onsuccess = () => resolve(isObj(req.result) ? (req.result as Record<string, string>) : {});
    req.onerror = () => resolve({});
  });
}

export async function saveLocalImages(images: Record<string, string>): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(images, 'images');
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/** Die feste Mod-Datei im Projekt (public/mods/mod.json), falls vorhanden. */
export async function fetchProjectMod(): Promise<ModFile> {
  try {
    const res = await fetch('mods/mod.json', { cache: 'no-store' });
    if (!res.ok) return emptyMod();
    const json = (await res.json()) as Partial<ModFile>;
    return { version: 1, data: json.data ?? {}, images: json.images ?? {} };
  } catch {
    return emptyMod();
  }
}

// ---------------------------------------------------------------- Start des Spiels

/** Ersetzte Grafiken für das laufende Spiel (von BootScene genutzt). */
export const activeMod = { images: {} as Record<string, string>, localActive: false };

/** Lädt Projekt-Mod und Browser-Änderungen und wendet sie an. Vor dem Start von Phaser aufrufen. */
export async function loadMods(): Promise<void> {
  const project = await fetchProjectMod();
  applyModData(project.data);
  const local = loadLocalData();
  applyModData(local);
  const localImages = await loadLocalImages();
  activeMod.images = { ...project.images, ...localImages };
  activeMod.localActive = Object.keys(local).length > 0 || Object.keys(localImages).length > 0;
}
