# Neue Inhalte hinzufügen

Alle Inhalte stehen als Daten in `src/data/`. Meist reicht es, dort einen Eintrag zu ergänzen.
Danach `npm test` (prüft Karten/Wellen für alle Rifts) und `npm run smoke` (Screenshots ansehen).

> Am einfachsten: Claude sagen, was es werden soll, z. B.
> „Neuer Gegner für den Tech-Rift: ein Schild-Roboter, der Türme in der Nähe abschirmt.“

## Neuer Turm → `src/data/towers.ts`

1. Eintrag in `TOWERS` mit `id`, Name, `tags`, `targets` (Boden/Luft), `damageType`, `attack`, `projectile`, `color`, 3 `levels`.
2. Aussehen: in `src/game/textures.ts` → `drawTowerTop()` einen `case '<id>'` ergänzen.
3. Das Baumenü zeigt automatisch alle Türme (Platz für ca. 6–7 nebeneinander).

## Neuer Gegner → `src/data/enemies.ts`

1. Eintrag in `ENEMIES`: Leben, Tempo, Rüstung, Gold, Torschaden, `flying`, `threat` (Kosten im Wellen-Budget), `radius`.
2. `look`: `family` (dino / bot / alien) + `variant` bestimmen die gezeichnete Form; `body`/`accent` sind die Farben.
3. Optional `abilities`: `hack`, `roar`, `shield`, `spawnOnDeath`, `spawner`. Neue Fähigkeit:
   Typ in `EnemyAbility` ergänzen und in `BattleScene.triggerAbility()` umsetzen.
4. Im passenden Rift (`src/data/rifts.ts`) unter `enemies.<rolle>` eintragen – sonst taucht er nie auf.

## Neuer Rift → `src/data/rifts.ts`

1. Neues `RiftDef`-Objekt nach dem Muster von `URZEIT` anlegen und in `RIFTS` aufnehmen.
2. `tiles` braucht mindestens `ground` und `path`. Sonderfelder bekommen `towerModifiers` (Bau-Felder)
   oder `enemySpeedFactor` (Weg-Felder) und einen `effectText`.
3. Neue Feld-Optik: `TileDeco` erweitern und in `textures.ts` → `drawDeco()` zeichnen.
4. Für jede Rolle (normal, fast, tank, air, special, boss) mindestens einen Gegner angeben.
5. `globalEffect` = Sondereffekt der ganzen Nacht (Modifikatoren), `reward` = Ressource und Menge.
6. Neue Ressource? `ResourceId` in `src/core/types.ts` + `src/data/resources.ts` + Symbol in `textures.ts`.

## Neue Upgrade-Karte → `src/data/cards.ts`

Eintrag in `CARDS` mit `rarity` und `modifiers` (oder `instant` für Sofort-Effekte). Beispiele:

```ts
{ id: 'adlerauge', name: 'Adlerauge', rarity: 'epic',
  description: '+40 % Schaden gegen Fluggegner',
  modifiers: [{ stat: 'airDamage', kind: 'pct', value: 0.4 }] },

{ id: 'mehrfachschuss', name: 'Mehrfachschuss', rarity: 'legendary',
  description: 'Alle Projektiltürme: +1 Projektil',
  modifiers: [{ stat: 'projectiles', kind: 'flat', value: 1, towerTags: ['projectile'] }], maxStacks: 2 },
```

`kind: 'pct'` = Prozent (0.1 = +10 %), `kind: 'flat'` = fester Wert. `towerTags` beschränkt auf bestimmte Türme.
Alle möglichen Werte (`stat`) stehen in `src/core/types.ts` → `StatKey`.

## Neues Gebäude → `src/data/buildings.ts`

Eintrag in `BUILDINGS`: `maxLevel`, `baseCost` (Kosten Stufe 1), `growth` (Kostenanstieg), dazu
`modifiers` (Boni **pro Stufe**) und/oder `income` (Ressourcen nach jedem Kampf, pro Stufe).
Die Stadt zeigt 12 Gebäude im Raster 4 × 3 – für mehr muss `CityScene` scrollen oder Seiten bekommen.

## Balancing → `src/config.ts`

Startgold, Tor-Leben, Wellenanzahl, Schwierigkeitsanstieg, Karten-Rhythmus, Werbe-Belohnung usw.
