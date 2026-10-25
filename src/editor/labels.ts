// Deutsche Beschriftungen und Hilfetexte für die Felder in der Toolbox.

export const LABELS: Record<string, string> = {
  // allgemein
  name: 'Name', shortName: 'Kurzname', description: 'Beschreibung', color: 'Farbe', cost: 'Kosten', costs: 'Kosten je Rang',
  levels: 'Stufen', text: 'Text', title: 'Titel', icon: 'Symbol', id: 'Kennung',
  // Türme
  physDamage: 'Normaler Schaden', magicDamage: 'Magischer Schaden', attackSpeed: 'Attack Speed (pro Sekunde)',
  range: 'Range (Felder)', critChance: 'Crit Chance', critDamage: 'Crit DMG', mana: 'Mana', manaRegen: 'Mana Regeneration (pro Sekunde)',
  splashRadius: 'Explosionsradius (Felder)', slow: 'Verlangsamung', strength: 'Stärke', duration: 'Dauer (Sekunden)',
  chainTargets: 'Kettenziele', baseLimit: 'Anzahl pro Nacht (Start)', baseMaxLevel: 'Höchste Stufe im Kampf (Start)',
  targets: 'Ziele', ground: 'Bodengegner', air: 'Fluggegner', ability: 'Fähigkeit (bei vollem Mana)', projectile: 'Geschoss',
  speed: 'Tempo', style: 'Aussehen', tags: 'Gruppen', attack: 'Angriffsart', targetMode: 'Zielwahl (Start)',
  poison: 'Gift', dps: 'Schaden pro Sekunde', knockback: 'Rückstoß (Felder)', silence: 'Bann (Sekunden)', aura: 'Aura: Angriffstempo für Türme in Reichweite',
  gatherers: 'Zivilisten', crystalIncome: 'Rift-Kristalle alle 5 Sekunden', arrows: 'Pfeile', damageMul: 'Schaden ×', radiusMul: 'Radius ×',
  rocks: 'Steine', civilians: 'Zivilisten', duration_s: 'Dauer',
  // Gegner
  hp: 'Leben', armor: 'Rüstung', crystals: 'Rift-Kristalle beim Tod', gateDamage: 'Schaden am Tor', flying: 'Fliegt',
  boss: 'Boss', threat: 'Bedrohung (Kosten im Wellen-Budget)', radius: 'Größe (Pixel)', loot: 'Beute für die Stadt',
  look: 'Aussehen', family: 'Familie', variant: 'Variante', body: 'Körperfarbe', accent: 'Akzentfarbe', abilities: 'Fähigkeiten',
  interval: 'Abstand (Sekunden)', boost: 'Tempo-Bonus', maxTargets: 'Max. Ziele', amount: 'Menge', regenDelay: 'Lädt nach (Sekunden)',
  enemy: 'Gegner', count: 'Anzahl', type: 'Art',
  // König
  upgradeCosts: 'Kosten Stufe 2–5 (Rift-Kristalle)', perLevel: 'Zuwachs pro Stufe', hits: 'Salven',
  // Karten
  rarity: 'Seltenheit', modifiers: 'Wirkung', instant: 'Sofort-Effekt', heal: 'Tor-Leben', maxStacks: 'Höchstens so oft wählbar',
  stat: 'Wert', kind: 'Art', value: 'Stärke', towerTags: 'nur für',
  // Rifts
  tiles: 'Felder', buildable: 'bebaubar', path: 'Weg', deco: 'Optik', towerModifiers: 'Wirkung auf Türme', enemySpeedFactor: 'Tempo-Faktor für Gegner',
  harvest: 'Abbau bringt', effectText: 'Text im Spiel', generation: 'Karten-Erzeugung', blockedTiles: 'Hindernisse',
  blockedDensity: 'Anteil Hindernisse', resourceTiles: 'Rohstoff-Felder (Häufigkeit)', resourceDensity: 'Anteil Rohstoff-Felder',
  specials: 'Sonderfelder', tile: 'Feld', on: 'auf', enemies: 'Gegner', globalEffect: 'Sondereffekt der Nacht',
  normal: 'Normal', fast: 'Schnell', tank: 'Panzer', special: 'Spezial',
  // Gebäude
  plot: 'Bauplatz-Art', unique: 'nur einmal', unlock: 'Freischaltung', unlocksTowers: 'schaltet Türme frei', levelModifiers: 'Wirkung pro Stufe',
  income: 'Ertrag nach jedem Kampf (pro Stufe)', upgrades: 'Verbesserungen', maxRank: 'Höchster Rang', requiredLevel: 'nötige Gebäudestufe je Rang',
  level: 'Stufe', throneLevel: 'ab Thronsaal-Stufe', x: 'Position x', y: 'Position y',
  // Forschung / Story
  unlocksBuilding: 'schaltet Gebäude frei', requires: 'braucht vorher', tree: 'Baum', col: 'Spalte im Baum', row: 'Zeile im Baum',
  excludes: 'Entweder-oder mit', night: 'Nacht', riftId: 'Rift', intro: 'Text vor dem Kampf', outro: 'Text nach dem Sieg',
  // Ressourcen
  gold: 'Gold', holz: 'Holz', stein: 'Stein', magie: 'Magiekristalle', nahrung: 'Nahrung',
  // Balancing
  startCrystals: 'Start-Rift-Kristalle', startCrystalsPerNight: '+ pro Nacht', gateHp: 'Tor-Leben', sellRefund: 'Verkaufswert (Anteil)',
  waveClearCrystalsBase: 'Wellen-Bonus (Grundwert)', waveClearCrystalsPerWave: 'Wellen-Bonus pro Welle', cardEveryWaves: 'Karte alle … Wellen',
  wavesBase: 'Wellen pro Nacht (Grundwert)', wavesMax: 'Wellen pro Nacht (höchstens)', waveBudgetBase: 'Gegner-Budget (Grundwert)',
  waveBudgetPerWave: 'Gegner-Budget pro Welle', waveBudgetPerNight: 'Gegner-Budget-Zuwachs pro Nacht', hpPerWave: 'Gegner-Leben-Zuwachs pro Welle',
  hpPerNight: 'Gegner-Leben-Zuwachs pro Nacht', secondPathFromNight: 'Zweiter Weg möglich ab Nacht', maxPathsFromNight: 'Zwei Wege immer ab Nacht',
  adContinueCrystals: 'Werbung: Rift-Kristalle', defeatLootFactor: 'Beute bei Niederlage (Anteil)', victoryGoldBase: 'Siegprämie Gold (Grundwert)',
  victoryGoldPerNight: 'Siegprämie Gold pro Nacht', goldDropChance: 'Chance auf Gold-Beute', goldDropDivisor: 'Gold-Beute: Kristalle geteilt durch',
  dropLingerSeconds: 'Beute bleibt liegen (Sekunden)', kingMoveSpeed: 'König: Lauftempo (Felder/s)', harvestSeconds: 'Abbauzeit (Sekunden)',
  autoHarvestSeconds: 'Sammler: Sekunden pro Abbau', cardsPersistAcrossNights: 'Karten gelten über mehrere Nächte',
  buildSeconds: 'Bauzeit (Sekunden)', startResources: 'Startressourcen (neues Spiel)',
  civilianSpeed: 'Zivilisten: Lauftempo (Felder/s)', civilianHarvestSeconds: 'Zivilisten: Abbauzeit (Sekunden)',
  luckDropBonus: 'Glück: Gold-Chance pro Punkt', rareDropBase: 'Seltener Fund: Grundchance', rareDropPerLuck: 'Seltener Fund: pro Glückspunkt',
  poisonMaxStacks: 'Gift: höchstens so oft stapelbar',
};

/** Kleine Erklärungen unter dem Feld */
export const HINTS: Record<string, string> = {
  critChance: '0,1 = 10 %', critDamage: '1,5 = 150 % Schaden', armor: '0 bis 0,9 – Anteil des normalen Schadens, der abgehalten wird',
  strength: '0,4 = 40 % langsamer', value: 'bei Art „pct“: 0,1 = +10 %', sellRefund: '0,6 = 60 %', defeatLootFactor: '0,5 = 50 %',
  goldDropChance: '0,15 = 15 %', hpPerWave: '0,1 = +10 % pro Welle', hpPerNight: '0,16 = +16 % pro Nacht', waveBudgetPerNight: '0,15 = +15 % pro Nacht',
  enemySpeedFactor: '0,6 = 40 % langsamer, 1,3 = 30 % schneller', blockedDensity: '0,05 = 5 % der Felder', resourceDensity: '0,2 = 20 % der Felder',
  threat: 'Je höher, desto weniger dieser Gegner pro Welle', x: 'von 0 (links) bis 1280 (rechts)', y: 'von 0 (oben) bis 720 (unten)',
  buildSeconds: 'gilt für Bauen, Ausbauen und Forschen',
  luckDropBonus: '0,15 = +15 % Gold-Chance je Glückspunkt', rareDropBase: '0,01 = 1 % pro Gegner', rareDropPerLuck: '0,005 = +0,5 % je Glückspunkt',
  aura: '0,15 = +15 % Angriffstempo', requires: 'Kennungen anderer Forschungen', excludes: 'Kennungen anderer Gebäude',
};

/** Diese Felder sind technisch und werden nur angezeigt, nicht verändert. */
export const READONLY = new Set([
  'id', 'tags', 'stat', 'kind', 'type', 'attack', 'style', 'family', 'variant', 'plot', 'unique', 'towerTags', 'unlocksTowers',
  'unlocksBuilding', 'riftId', 'deco', 'icon', 'path', 'buildable', 'blockedTiles', 'on', 'tile', 'enemy', 'rarity', 'night',
  'normal', 'fast', 'tank', 'special', 'boss_list', 'flying', 'boss', 'tree', 'requires', 'excludes', 'targetMode',
]);

/** Felder mit Farbwert (Zahl wie 0x5fa844) */
export const COLOR_KEYS = new Set(['color', 'body', 'accent']);

/** Lange Texte bekommen ein größeres Eingabefeld */
export const LONG_TEXT = new Set(['description', 'intro', 'outro', 'text', 'effectText']);

export function label(key: string): string {
  return LABELS[key] ?? key;
}
