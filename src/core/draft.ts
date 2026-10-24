import { CARDS, RARITIES, RARITY_ORDER, type CardDef, type Rarity } from '../data/cards';
import type { Rng } from './rng';

// Zieht Upgrade-Karten. "Glück" verschiebt die Chancen hin zu selteneren Karten.

export function rarityWeights(luck: number): Record<Rarity, number> {
  return {
    common: Math.max(10, RARITIES.common.weight - luck * 8),
    rare: RARITIES.rare.weight + luck * 4,
    epic: RARITIES.epic.weight + luck * 3,
    legendary: RARITIES.legendary.weight + luck * 1,
  };
}

/** Kann diese Karte noch gewählt werden? */
export function isCardAvailable(card: CardDef, owned: readonly string[]): boolean {
  if (card.maxStacks === undefined) return true;
  return owned.filter((id) => id === card.id).length < card.maxStacks;
}

/** Zieht `count` verschiedene Karten. */
export function rollCards(rng: Rng, owned: readonly string[], luck: number, count = 3): CardDef[] {
  const picked: CardDef[] = [];
  const weights = rarityWeights(luck);
  for (let i = 0; i < count; i++) {
    const rarity = rng.weighted(weights);
    const card = pickOfRarity(rng, rarity, owned, picked);
    if (card) picked.push(card);
  }
  return picked;
}

function pickOfRarity(rng: Rng, rarity: Rarity, owned: readonly string[], taken: CardDef[]): CardDef | null {
  // Gewünschte Seltenheit zuerst, sonst die nächstniedrigere, dann beliebig
  const start = RARITY_ORDER.indexOf(rarity);
  const order = [...RARITY_ORDER.slice(0, start + 1).reverse(), ...RARITY_ORDER.slice(start + 1)];
  for (const r of order) {
    const pool = CARDS.filter((c) => c.rarity === r && isCardAvailable(c, owned) && !taken.includes(c));
    if (pool.length > 0) return rng.pick(pool);
  }
  return null;
}
