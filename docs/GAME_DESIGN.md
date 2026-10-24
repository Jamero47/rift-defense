# Rift Defense – Game Design

## Idee in einem Satz

Ein Tower-Defense-Roguelite: Am **Tag** baut man seine Stadt aus, in der **Nacht** verwandelt ein Rift das Land
vor dem Tor – man beschwört Türme, sammelt Beute und Rohstoffe und hält das Tor.

## Lore

Der Spieler ist König einer mittelalterlichen Fantasy-Stadt (Arbeitsname: *Eldenmark*, König *Aldric*).
Jede Nacht reißt vor den Toren ein Rift auf – ein Riss zu einer anderen Welt. Das Land vor der Stadt
verwandelt sich in diese Welt, und ihre Kreaturen stürmen auf das Tor zu. Der König steht selbst vor dem Tor –
als letzte Verteidigungslinie.

## Zwei Sphären

```
Menü → Tag-Sphäre (Stadt) → Nacht-Sphäre (Kampf) → Ergebnis → Tag-Sphäre → …
```

| | Tag-Sphäre (Stadt) | Nacht-Sphäre (Kampf) |
|---|---|---|
| Ziel | Stadt dauerhaft ausbauen | Tor verteidigen, Beute sammeln |
| Währung | Gold, Holz, Stein, Magiekristalle, Nahrung | **Rift-Kristalle** (verfallen nach der Nacht) |
| Woher | Beute aus der Nacht, Produktionsgebäude | Gegner lassen sie fallen, Wellen-Bonus |

## Tag-Sphäre: die Stadt

Eigene Karte: Die Stadt lehnt sich an einen **Berg** und ist von einer **Stadtmauer** umgeben.

| Bauplatz | Anzahl | Für | Freischaltung |
|---|---|---|---|
| Platz des Thronsaals | 1 | Thronsaal | von Anfang an |
| Stadtplätze | 6 | große Gebäude | 1 frei, Rest über Thronsaal-Stufe oder Gold |
| Bergbauplatz | 1 | Steinbruch | von Anfang an |
| Felder vor dem Tor | 3 | Bauernhof, Holzfäller | 1 frei, Rest über Gold / Thronsaal-Stufe |
| Mauerplätze (klein) | 6 | Wachtürme | über Thronsaal-Stufe oder Gold |

Zu Beginn sind **4 Bauplätze** frei und **4 Gebäude** verfügbar: Thronsaal, Bogenmacher, Steinbruch, Bauernhof.

- **Bauen und Ausbauen dauert** (Platzhalter: 5 Sekunden, `CITY.buildSeconds`). Es läuft immer nur ein Bauauftrag;
  die Zeit läuft auch weiter, wenn das Spiel geschlossen ist.
- **Upgrades in den Gebäuden** werden mit Ressourcen gekauft und wirken sofort.
  Höhere Ränge brauchen eine höhere **Gebäudestufe**.
- **Neue Gebäude** kommen über **Forschung** (Universität) oder **Story-Nächte** dazu.
  Die Universität selbst wird mit Thronsaal Stufe 2 frei.

### Tutorial

1. Thronsaal bauen (vorher geht nichts anderes).
2. Bogenmacher bauen → schaltet Bogenturm und Ballista frei (ohne Türme startet keine Nacht).
3. Erste Nacht – dort erklärt ein Tutorial Türme, Wellen, König und Karten.

### Gebäude

| Gebäude | Platz | Freischaltung | Wirkung | Upgrades (Auswahl) |
|---|---|---|---|---|
| Thronsaal | Thron | Start | Tor-Leben, neue Bauplätze, Universität | Königliche Klinge, Pfeilhagel-Training, Königsstiefel, Fleißige Hände, Eisenbeschlagenes Tor, Kriegskasse |
| Bogenmacher | Stadt | Start | **Bogenturm + Ballista** | Mehr Bogentürme/Ballisten, Verstärkte Türme (höhere Stufen), Scharfe Pfeile, Schwere Bolzen |
| Steinbruch | Berg | Start | Stein nach jedem Kampf | Bessere Spitzhacken, Goldader |
| Bauernhof | Feld | Start | Nahrung nach jedem Kampf | Reiche Ernte, Gute Verpflegung (Angriffstempo) |
| Universität | Stadt | Thronsaal 2 | Forschung | – |
| Holzfäller | Feld | Forschung | Holz; **Sammler-Trupp** baut im Kampf automatisch ab | Sammler-Trupp, Scharfe Äxte |
| Kanonengießerei | Stadt | Forschung | **Kanonenturm** | Mehr Kanonen, Verstärkte Kanonen, Schwarzpulver, Große Kugeln |
| Magierakademie | Stadt | **Story Nacht 10** | **Magier- + Frostturm** | Mehr Magier/Frost, Höhere Magie, Arkanes Wissen |
| Wachturm | Mauer | Forschung | Tor-Leben | Späher (Gold-Beute) |
| Schatzkammer | Stadt | Forschung | Start-Rift-Kristalle, Gold-Beute | Steuern |
| Orakel | Stadt | Forschung | bessere Upgrade-Karten, Neuwürfe | – |

### Story-Nächte

Besondere Nächte mit festem Rift und Belohnung (`src/data/story.ts`).
Beispiel: **Nacht 10 – „Der entführte Hofmagier“** (Tech-Rift): Roboter haben den Hofmagier entführt.
Belohnung: Die **Magierakademie** wird freigeschaltet.

## Nacht-Sphäre: der Kampf

1. Ein Rift öffnet sich (Nacht 1–3: Urzeit, Tech, Weltraum; danach zufällig, Story-Nächte fest).
2. Eine neue Karte entsteht: Weg(e), Sonderfelder, **Rohstoff-Felder** (Bäume, Felsen, Kristalle …).
3. Man startet mit Rift-Kristallen (200 + 30 pro Nacht + Stadt-Boni) und **beschwört Türme**.
   - Nur Türme, die die Stadt freigeschaltet hat.
   - **Limit pro Turmart** (z. B. 2 Bogentürme) und **maximale Turmstufe** – beides steigt durch Gebäude-Upgrades.
4. Jede Welle startet man selbst. Nach jeder 3. Welle: 1 von 3 **Upgrade-Karten** (gilt für diese Nacht).
5. Letzte Welle = Boss-Welle.

### Beute

- Jeder Gegner lässt **Rift-Kristalle** fallen. Sie fliegen nach kurzer Zeit von selbst in die Leiste.
- Mit etwas Glück fällt **Gold** (Chance 15 %, mehr über Wachturm/Schatzkammer).
- Spezialgegner und Bosse lassen **Ressourcen** fallen (z. B. Hacker: Magiekristalle und Gold).
- **Rohstoff-Felder** auf der Karte muss man abbauen: Feld antippen → **König schicken**.
  Der König läuft hin, baut ab (3 s) und kehrt zurück – **in der Zeit fehlt er am Tor**.
  Danach ist das Feld freies Bauland. Später übernehmen **Sammler-Trupps** (Holzfäller) das während der Wellen.
- Alle Rifts bringen alle Ressourcen, nur die Mengen unterscheiden sich.

### Ende der Nacht

- **Sieg:** ganze Beute + Siegprämie (Gold) + Produktion der Stadt. Nächste Nacht wird frei.
- **Niederlage** (Tor auf 0): Werbung ansehen → letzte Welle wiederholen + 100 Rift-Kristalle (1× pro Nacht),
  oder aufgeben → 50 % der Beute + Produktion der Stadt; die Nacht muss wiederholt werden (gleiche Karte).

## Schwierigkeit

| Wert | Formel (siehe `src/config.ts`) |
|---|---|
| Wellen pro Nacht | 6 + ⌈Nacht/2⌉, höchstens 12 |
| Gegner-Budget pro Welle | (6 + 3 × Welle) × (1 + 0,15 × (Nacht − 1)) |
| Gegner-Leben | × (1 + 0,1 × (Welle − 1)) × (1 + 0,16 × (Nacht − 1)) |
| Fluggegner | in jeder 3. Welle, ab Nacht 4 öfter |
| Zwei Wege | ab Nacht 4 möglich (50 %), ab Nacht 7 immer |

## Türme

| Turm | Kosten | Ziele | Besonderheit | Freigeschaltet durch |
|---|---|---|---|---|
| Bogenturm | 70 | Boden + Luft | schnell, günstig | Bogenmacher |
| Ballista | 100 | **nur Luft** | großer Schaden, große Reichweite | Bogenmacher |
| Kanonenturm | 110 | Boden | Flächenschaden | Kanonengießerei |
| Magierturm | 120 | Boden | Kettenblitz, ignoriert Rüstung | Magierakademie |
| Frostturm | 90 | Boden | verlangsamt, ignoriert Rüstung | Magierakademie |
| König | – | Boden + Luft | am Tor, im Kampf verbesserbar, **Pfeilhagel**, baut Rohstoffe ab | – |

### Turm-Werte (Fenster beim Antippen eines Turms)

„Turm-Name Lvl. X“, darunter: Normaler Schaden · Magischer Schaden · Attack Speed · Range · Crit Chance ·
Crit DMG · Mana · Mana Regeneration · Beschreibung der Fähigkeit.

- Normaler Schaden wird durch Rüstung verringert, magischer nicht. Ein Turm kann beides haben.
- Kritischer Treffer: Mit „Crit Chance“ wird der Schaden mit „Crit DMG“ multipliziert (150 % = 1,5-fach).
- Mana füllt sich mit „Mana Regeneration“ pro Sekunde. Bei vollem Mana löst der Turm seine Fähigkeit aus.
  **Stand:** Die Fähigkeiten sind nur beschrieben, ihre Wirkung ist noch ein Platzhalter.

| Turm | Fähigkeit (Entwurf) |
|---|---|
| Bogenturm | Pfeilsalve: 5 Pfeile auf verschiedene Gegner |
| Kanonenturm | Großkaliber: doppelter Schaden und Explosionsradius |
| Magierturm | Gewittersturm: Blitz auf bis zu 8 Gegner ohne Abschwächung |
| Frostturm | Eiszeit: friert Bodengegner in Reichweite 2 s ein |
| Ballista | Durchbohren: Bolzen trifft alle Fluggegner in einer Linie |

## Rifts

| Rift | Sondereffekt | Sonderfelder | Rohstoff-Felder | Spezial / Boss |
|---|---|---|---|---|
| Urzeit | +25 % Gegner, −15 % Leben | Hügel, Sumpf, Teergrube | Baum, Felsen, Riesenfarn, Bernstein | Parasaurolophus / T-Rex |
| Tech | +10 % Rüstung | Energiefeld, Störsender, Förderband | Schrott, Vorratskiste, Energiezelle | Hacker / Mech-Titan |
| Weltraum | Projektile +30 %, Gegner +10 % | Kristallfeld, Sternenstaub, Schwerkraftfeld | Meteorit, Kristallader, Alien-Ranken | Brüter / Brutkönigin |

## Upgrade-Karten (in der Nacht)

| Seltenheit | Farbe | Chance | Beispiele |
|---|---|---|---|
| Gewöhnlich | Grau | 60 % | Bogentürme +15 % Schaden, Sofort +80 Rift-Kristalle, Tor +5 Leben |
| Selten | Blau | 28 % | Alle Türme +10 % Schaden, Türme 10 % billiger |
| Episch | Lila | 10 % | Kettenblitz, Panzerbrecher, Zinsen |
| Legendär | Orange | 2 % | Alle Projektiltürme +1 Projektil, Zeitverzerrung |

## Offene Design-Fragen

- **Balancing** der Nächte zum neuen Freischalt-System: Mit Turm-Limits wird die Stadt wichtiger –
  die Schwierigkeit späterer Nächte muss beim Testen angepasst werden.
- Rohstoffe in der Bauphase abbauen ist ohne Risiko. Soll Abbauen nur während der Wellen gehen,
  oder soll es einen Countdown zwischen den Wellen geben?
- Wofür überschüssige Rift-Kristalle? (z. B. Nachkauf von Karten, Reparatur des Tors)
- Bauzeiten: echte Zeiten, Beschleunigen (z. B. per Werbung)?
- Weitere Story-Nächte und Gebäude (Mine am Berg, Kaserne mit Soldaten, Tempel …)
