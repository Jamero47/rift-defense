# Neue Inhalte hinzufügen

Alle Inhalte stehen als Daten in `src/data/`. Meist reicht es, dort einen Eintrag zu ergänzen.
Danach `npm test` (prüft Karten/Wellen für alle Rifts) und `npm run smoke` (Screenshots ansehen).

> Am einfachsten: Claude sagen, was es werden soll, z. B.
> „Neuer Gegner für den Tech-Rift: ein Schild-Roboter, der Türme in der Nähe abschirmt.“

## Neuer Turm → `src/data/towers.ts`

1. Eintrag in `TOWERS` mit `id`, Name, `tags`, `targets` (Boden/Luft), `attack`, `ability` (Name + Beschreibung),
   `projectile`, `color`, `baseLimit` (wie viele pro Nacht), `baseMaxLevel` (bis zu welcher Stufe im Kampf)
   und 3 `levels`. Jede Stufe hat: `cost` (Rift-Kristalle), `physDamage` (normaler Schaden), `magicDamage`,
   `attackSpeed`, `range`, `critChance`, `critDamage`, `mana`, `manaRegen`.
2. Aussehen: in `src/game/textures.ts` → `drawTowerTop()` einen `case '<id>'` ergänzen.
3. **Freischalten:** Ein Gebäude muss den Turm in `unlocksTowers` haben (`src/data/buildings.ts`) – sonst taucht er nie auf.
4. Limit und Stufe erhöhen: Gebäude-Upgrades mit `towerLimit` bzw. `towerMaxLevel` und passendem `towerTags`.

## Neuer Gegner → `src/data/enemies.ts`

1. Eintrag in `ENEMIES`: Leben, Tempo, Rüstung, `crystals` (Rift-Kristalle beim Tod), Torschaden, `flying`, `threat`, `radius`.
2. Optional `loot`: sichere Beute für die Stadt, z. B. `{ magie: 3, gold: 5 }` (für Spezialgegner und Bosse).
3. `look`: `family` (dino / bot / alien) + `variant` bestimmen die gezeichnete Form; `body`/`accent` sind die Farben.
4. Optional `abilities`: `hack`, `roar`, `shield`, `spawnOnDeath`, `spawner`. Neue Fähigkeit:
   Typ in `EnemyAbility` ergänzen und in `BattleScene.triggerAbility()` umsetzen.
5. Im passenden Rift (`src/data/rifts.ts`) unter `enemies.<rolle>` eintragen – sonst taucht er nie auf.

## Neuer Rift → `src/data/rifts.ts`

1. Neues `RiftDef`-Objekt nach dem Muster von `URZEIT` anlegen und in `RIFTS` aufnehmen.
2. `tiles` braucht mindestens `ground` und `path`. Sonderfelder bekommen `towerModifiers` (Bau-Felder)
   oder `enemySpeedFactor` (Weg-Felder) und einen `effectText`.
3. **Rohstoff-Felder** bekommen `harvest`, z. B. `{ holz: 8 }`, und stehen in `generation.resourceTiles` (mit Häufigkeit).
4. Neue Feld-Optik: `TileDeco` erweitern und in `textures.ts` → `drawDeco()` zeichnen.
5. Für jede Rolle (normal, fast, tank, air, special, boss) mindestens einen Gegner angeben.
6. `globalEffect` = Sondereffekt der ganzen Nacht (Modifikatoren).

## Neue Upgrade-Karte (Nacht) → `src/data/cards.ts`

Eintrag in `CARDS` mit `rarity` und `modifiers` (oder `instant` für Sofort-Effekte: `crystals`, `heal`). Beispiel:

```ts
{ id: 'mehrfachschuss', name: 'Mehrfachschuss', rarity: 'legendary',
  description: 'Alle Projektiltürme: +1 Projektil',
  modifiers: [{ stat: 'projectiles', kind: 'flat', value: 1, towerTags: ['projectile'] }], maxStacks: 2 },
```

`kind: 'pct'` = Prozent (0.1 = +10 %), `kind: 'flat'` = fester Wert. `towerTags` beschränkt auf bestimmte Türme.
Alle möglichen Werte (`stat`) stehen in `src/core/types.ts` → `StatKey`.

## Neues Gebäude (Stadt) → `src/data/buildings.ts`

```ts
{
  id: 'kaserne', name: 'Kaserne', icon: 'icon_wall', plot: 'inner', unique: true,
  description: '…',
  unlock: { type: 'research', id: 'militaer' },     // oder 'start', { type: 'story', id }, { type: 'throne', level }
  levels: [{ holz: 80, stein: 60 }, { … }],          // Index 0 = Baukosten, dann Ausbau-Kosten je Stufe
  unlocksTowers: ['…'],                              // optional: Türme für die Nacht
  levelModifiers: [ … ],                             // optional: Wirkung pro Gebäudestufe
  income: { gold: 10 },                              // optional: nach jedem Kampf pro Stufe
  upgrades: [
    { id: 'drill', name: 'Drill', icon: 'icon_hammer', maxRank: 3,
      description: '…', costs: costs({ gold: 40 }, 3), requiredLevel: [1, 2, 3],
      modifiers: [{ stat: 'damage', kind: 'pct', value: 0.05 }] },
  ],
}
```

- `plot`: `throne`, `inner` (Stadtplatz), `mountain` (Berg), `wall` (Mauer, klein), `field` (vor dem Tor).
- Das Gebäude-Fenster zeigt bis zu 6 Upgrades.
- Freischaltung über Forschung: zusätzlich einen Eintrag in `src/data/research.ts` (`unlocksBuilding`).

## Neue Forschung → `src/data/research.ts`

Eintrag mit Kosten, benötigter Universitäts-Stufe und `unlocksBuilding`.

## Neue Story-Nacht → `src/data/story.ts`

Eintrag mit `night`, `riftId`, `title`, `intro` (vor dem Kampf), `outro` (nach dem Sieg) und optional `unlocksBuilding`.

## Bauplätze → `src/data/city.ts`

Position (Bildschirm 1280 × 720), Art und Freischaltung (`start`, `throne` mit Stufe, `gold` mit Preis).

## Balancing → `src/config.ts`

`BALANCE` (Nacht: Start-Rift-Kristalle, Schwierigkeit, Beute, König, Sammler, Werbung)
und `CITY` (Bauzeit, Startressourcen).
