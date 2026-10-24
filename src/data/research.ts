import type { Resources } from '../core/types';

// Forschung in der Universität. Jede Forschung dauert BUILD_SECONDS und schaltet ein Gebäude frei.

export interface ResearchDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost: Partial<Resources>;
  /** Benötigte Stufe der Universität */
  requiredLevel: number;
  unlocksBuilding: string;
}

export const RESEARCH: readonly ResearchDef[] = [
  {
    id: 'forstwirtschaft', name: 'Forstwirtschaft', icon: 'icon_holz',
    description: 'Schaltet den Holzfäller frei (mit Sammler-Trupps für den Kampf).',
    cost: { gold: 60, holz: 50 }, requiredLevel: 1, unlocksBuilding: 'holzfaeller',
  },
  {
    id: 'schiesspulver', name: 'Schießpulver', icon: 'top_cannon',
    description: 'Schaltet die Kanonengießerei frei – und damit den Kanonenturm.',
    cost: { gold: 120, stein: 80, magie: 10 }, requiredLevel: 1, unlocksBuilding: 'giesserei',
  },
  {
    id: 'wehrtuerme', name: 'Wehrtürme', icon: 'icon_wall',
    description: 'Schaltet den Wachturm für die Mauerplätze frei.',
    cost: { holz: 60, stein: 100 }, requiredLevel: 1, unlocksBuilding: 'wachturm',
  },
  {
    id: 'handel', name: 'Handel', icon: 'icon_gold',
    description: 'Schaltet die Schatzkammer frei.',
    cost: { gold: 200, holz: 100 }, requiredLevel: 2, unlocksBuilding: 'schatzkammer',
  },
  {
    id: 'sterndeutung', name: 'Sterndeutung', icon: 'icon_eye',
    description: 'Schaltet das Orakel frei.',
    cost: { gold: 150, magie: 40 }, requiredLevel: 2, unlocksBuilding: 'orakel',
  },
];

export function getResearch(id: string): ResearchDef {
  const def = RESEARCH.find((r) => r.id === id);
  if (!def) throw new Error(`Unbekannte Forschung: ${id}`);
  return def;
}
