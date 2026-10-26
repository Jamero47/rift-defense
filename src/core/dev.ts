import { RESOURCE_IDS } from './types';
import type { SaveData } from './save';

// Entwicklermodus: Hilfen zum Testen (unendliche Ressourcen, sofort bauen, Nacht/Welle wählen).
// Die echten Ressourcen werden beim Einschalten gesichert und beim Ausschalten zurückgegeben.

/** So viel gibt es von allem, solange „unendlich“ an ist */
export const DEV_AMOUNT = 999_999;
/** Rift-Kristalle im Kampf bei „unendlich“ */
export const DEV_CRYSTALS = 99_999;

export function setInfinite(save: SaveData, on: boolean): void {
  const dev = save.settings.dev;
  if (on === dev.infinite) return;
  dev.infinite = on;
  if (on) {
    dev.backup = { ...save.resources };
    applyDevCheats(save);
  } else if (dev.backup) {
    save.resources = { ...dev.backup };
    dev.backup = null;
  }
}

/** Füllt die Ressourcen wieder auf, wenn „unendlich“ an ist. */
export function applyDevCheats(save: SaveData): void {
  if (!save.settings.dev.infinite) return;
  for (const id of RESOURCE_IDS) save.resources[id] = DEV_AMOUNT;
}

/** Laufende Bauaufträge und Forschungen sofort fertig machen (für „sofort bauen“). */
export function finishJobsNow(save: SaveData, now: number): void {
  if (!save.settings.dev.instant) return;
  for (const job of [save.city.job, save.city.researchJob, save.city.magicJob]) if (job) job.finishAt = Math.min(job.finishAt, now);
}
