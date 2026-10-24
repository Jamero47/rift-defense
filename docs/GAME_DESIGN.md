# Rift Defense – Game Design

## Idee in einem Satz

Ein Tower-Defense-Roguelite: Jede Nacht verwandelt ein Rift das Land vor dem Stadttor, man baut seine
Verteidigung neu, wählt Upgrade-Karten – und baut mit der Beute dauerhaft seine Stadt aus.

## Lore

Der Spieler ist König einer mittelalterlichen Fantasy-Stadt (Arbeitsname: *Eldenmark*, König *Aldric*).
Jede Nacht reißt vor den Toren ein Rift auf – ein Riss zu einer anderen Welt. Das Land vor der Stadt
verwandelt sich in diese Welt, und ihre Kreaturen stürmen auf das Tor zu. Der König steht selbst vor dem Tor –
als letzte Verteidigungslinie.

## Spielablauf

```
Menü → Stadt (Gebäude ausbauen, Rift der nächsten Nacht ansehen) → Nacht (Kampf) → Ergebnis → Stadt → …
```

### Eine Nacht

1. Ein Rift öffnet sich (Nacht 1–3: Urzeit, Tech, Weltraum; danach zufällig, nie zweimal derselbe hintereinander).
2. Eine neue Karte entsteht: Weg(e) vom Rift (rechts) zum Tor (links), Hindernisse, Ressourcen-Felder, Sonderfelder.
3. Man startet mit Gold (200 + 30 pro Nacht + Schatzkammer) und baut Türme.
4. Man startet jede Welle selbst. Gegner geben Gold, jede geschaffte Welle gibt Bonus-Gold.
5. **Nach jeder 3. Welle**: 1 von 3 Upgrade-Karten wählen (gilt für den Rest der Nacht).
6. Letzte Welle = Boss-Welle.
7. **Sieg** → volle Belohnung, nächste Nacht wird freigeschaltet.
   **Niederlage** (Tor auf 0) → Werbung ansehen (letzte Welle wiederholen + 100 Gold, 1× pro Nacht)
   oder aufgeben (Teilbelohnung, Nacht muss erneut gespielt werden – auf derselben Karte).

### Dauerhafter Fortschritt

- Nächte bauen aufeinander auf (Nacht 1, 2, 3 …), die Schwierigkeit steigt.
- Ressourcen (Holz, Metall, Kristall) aus den Rifts → Gebäude in der Stadt → wirken in jeder Nacht.
- Upgrade-Karten gelten nur für eine Nacht (umstellbar: `BALANCE.cardsPersistAcrossNights`).

## Schwierigkeit

| Wert | Formel (siehe `src/config.ts`) |
|---|---|
| Wellen pro Nacht | 6 + ⌈Nacht/2⌉, höchstens 12 |
| Gegner-Budget pro Welle | (6 + 3 × Welle) × (1 + 0,15 × (Nacht − 1)) |
| Gegner-Leben | × (1 + 0,1 × (Welle − 1)) × (1 + 0,16 × (Nacht − 1)) |
| Fluggegner | in jeder 3. Welle, ab Nacht 4 öfter |
| Zwei Wege | ab Nacht 4 möglich (50 %), ab Nacht 7 immer |
| Erste Wellen | Welle 1 nur normale Gegner, Panzer ab Welle 3–4, Spezialgegner ab Welle 3 |

## Türme

| Turm | Kosten | Ziele | Besonderheit |
|---|---|---|---|
| Bogenturm | 70 | Boden + Luft | schnell, günstig |
| Kanonenturm | 110 | Boden | Flächenschaden |
| Magierturm | 120 | Boden | Kettenblitz, ignoriert Rüstung |
| Frostturm | 90 | Boden | verlangsamt (Bosse nur halb), ignoriert Rüstung |
| Ballista | 100 | **nur Luft** | großer Schaden, große Reichweite |
| König | – | Boden + Luft | steht am Tor, im Kampf verbesserbar, Fähigkeit **Pfeilhagel** (Zielgebiet antippen) |

Jeder Turm hat 3 Stufen. Verkaufen gibt 60 % zurück. Zielwahl: Vorderster / Stärkster / Nächster.
Physischer Schaden wird durch Rüstung verringert, magischer nicht.

## Rifts

| Rift | Ressource | Sondereffekt | Sonderfelder | Gegner (Spezial / Boss) |
|---|---|---|---|---|
| Urzeit | Holz (Bäume) | Herdentiere: +25 % Gegner, −15 % Leben | Hügel +20 % Reichweite, Sumpf −15 % Tempo, Teergrube (Weg) Gegner −40 % | Parasaurolophus (Brüllen: Gegner schneller) / T-Rex |
| Tech | Metall (Schrott) | Roboter-Panzerung: +10 % Rüstung | Energiefeld +25 % Tempo, Störsender −20 % Schaden, Förderband (Weg) Gegner +35 % | **Hacker** (legt Türme lahm) / Mech-Titan (EMP) |
| Weltraum | Kristall | Niedrige Schwerkraft: Projektile +30 %, Gegner +10 % | Kristallfeld +30 % Schaden, Sternenstaub −20 % Reichweite, Schwerkraftfeld (Weg) Gegner −30 % | Brüter (platzt in Krabbler) / Brutkönigin |

Jeder Rift hat: normal, schnell, Panzer, Flug, Spezial, Boss. Grüner Rahmen = Bonus-Feld, roter Rahmen = Nachteil.

## Upgrade-Karten (Auswahl)

| Seltenheit | Farbe | Chance | Beispiele |
|---|---|---|---|
| Gewöhnlich | Grau | 60 % | Bogentürme +15 % Schaden, Sofort +80 Gold, Tor +5 Leben |
| Selten | Blau | 28 % | Alle Türme +10 % Schaden, Türme 10 % billiger, Kopfgeld +20 % Gold |
| Episch | Lila | 10 % | Kettenblitz +1 Ziel, Panzerbrecher, Zinsen |
| Legendär | Orange | 2 % | Alle Projektiltürme +1 Projektil, Zeitverzerrung, Göttlicher Segen |

Glück (Orakel, spätere Karten in der Nacht) verschiebt die Chancen nach oben. Orakel gibt außerdem Neuwürfe.

## Stadt-Gebäude

Holzfäller · Schrottplatz · Kristallschleiferei (liefern nach **jedem** Kampf Ressourcen) ·
Bogenmacher · Kanonengießerei · Magierakademie · Ballistenwerkstatt (Turm-Boni) ·
Stadtmauer (Tor-Leben) · Schatzkammer (Startgold) · Thronsaal (König) · Orakel (Karten) · Waffenschmiede (alle Türme).
Je 3–5 Stufen, Kosten steigen pro Stufe.

## Offene Design-Fragen

- Sollen Upgrade-Karten doch über mehrere Nächte gelten? (ein Schalter in `config.ts`)
- Soll man zwischen zwei Rifts wählen können (Risiko vs. Belohnung)?
- Kann der König sterben / blockiert er Gegner (Nahkampf)?
- Weitere Rifts: Eiszeit, Unterwelt, Unterwasser, Wilder Westen, Zuckerwelt …?
- Monetarisierung: nur Belohnungs-Werbung, oder auch kosmetische Käufe?
