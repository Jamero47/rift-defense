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
| Stadtplätze | 10 | große Gebäude | 1 frei, Rest über Thronsaal-Stufe (2–5) oder Gold |
| Bergbauplätze | 3 | Steinbruch, Mine | 1 frei, Rest über Thronsaal 3 oder Gold |
| Felder vor dem Tor | 6 | Bauernhof, Holzfäller, Fischerhütte | 1 frei, Rest über Gold / Thronsaal-Stufe |
| Mauerplätze (klein) | 6 | Wachtürme | über Thronsaal-Stufe oder Gold |

Insgesamt **26 Bauplätze**. Es gibt **14 Stadtgebäude, aber nur 10 Stadtplätze** – man muss sich entscheiden.

Zu Beginn sind **4 Bauplätze** frei und **4 Gebäude** verfügbar: Thronsaal, Bogenmacher, Steinbruch, Bauernhof.

- **Bauen und Ausbauen dauert** (Platzhalter: 5 Sekunden, `CITY.buildSeconds`). Es läuft immer nur ein Bauauftrag;
  die Zeit läuft auch weiter, wenn das Spiel geschlossen ist. „Baukunst“ (Forschung) und „Gelehrte“ (Universität) machen schneller.
- **Upgrades in den Gebäuden** werden mit Ressourcen gekauft und wirken sofort.
  Höhere Ränge brauchen eine höhere **Gebäudestufe**.
- **Neue Gebäude** kommen über den **Forschungsbaum** (Universität) oder **Story-Nächte** dazu.
  Die Universität selbst wird mit Thronsaal Stufe 2 frei.

### Entweder-oder: Spielstil wählen

Manche Gebäude schließen sich gegenseitig aus. Steht das eine, kann man das andere nicht bauen
(Feld `excludes` in `src/data/buildings.ts`, wirkt in beide Richtungen):

| Entweder | oder | Spielstil |
|---|---|---|
| Kanonengießerei (Kanonenturm) | Belagerungswerkstatt (Katapult) | kurze, schnelle Explosionen ↔ riesige Reichweite auf Gruppen |
| Alchemistenhütte (Giftturm) | Glockengießerei (Glockenturm) | Schaden über Zeit ↔ alle Türme schneller |
| Händlergilde (Rift-Sammler) | Kristallschmiede (Kristallmine) | Rohstoffe für die Stadt ↔ Rift-Kristalle für den Kampf |
| Orakel | Glücksbrunnen | Neuwürfe ↔ viel Glück |
| Kapelle | Taverne | Tor heilt nach jeder Welle ↔ Karte zu Beginn der Nacht |

### Tutorial

1. Thronsaal bauen (vorher geht nichts anderes).
2. Bogenmacher bauen → schaltet Bogenturm und Ballista frei (ohne Türme startet keine Nacht).
3. Erste Nacht – dort erklärt ein Tutorial Türme, Wellen, König und Karten.

### Gebäude

| Gebäude | Platz | Freischaltung | Wirkung | Upgrades (Auswahl) |
|---|---|---|---|---|
| Thronsaal | Thron | Start | Tor-Leben, neue Bauplätze, Universität | Königliche Klinge, Pfeilhagel-Training, Königsstiefel, Fleißige Hände, Eisenbeschlagenes Tor, Kriegskasse |
| Bogenmacher | Stadt | Start | **Bogenturm + Ballista** | Mehr Bogentürme/Ballisten, Verstärkte Türme, Scharfe Pfeile, Schwere Bolzen |
| Steinbruch | Berg | Start | Stein | Bessere Spitzhacken, Goldader, Steinmetze (Türme billiger) |
| Bauernhof | Feld | Start | Nahrung | Reiche Ernte, Gute Verpflegung, Erntefest (Glück) |
| Universität | Stadt | Thronsaal 2 | **Forschungsbaum** | Gelehrte (schneller bauen), Bibliothek (Neuwurf) |
| Holzfäller | Feld | Forstwirtschaft | Holz; Sammler-Trupp | Sammler-Trupp, Scharfe Äxte, Große Beute |
| Fischerhütte | Feld | Fischerei | viel Nahrung | Große Netze, Räucherei |
| Mine | Berg | Bergbau | Stein + Magiekristalle | Edelsteine, Tiefe Stollen |
| Kanonengießerei | Stadt | Schießpulver | **Kanonenturm** | Mehr/Verstärkte Kanonen, Schwarzpulver, Große Kugeln, Kartätschen |
| Belagerungswerkstatt | Stadt | Belagerungskunst | **Katapult** | Mehr/Verstärkte Katapulte, Felsbrocken, Spannseile |
| Alchemistenhütte | Stadt | Alchemie | **Giftturm**, Magiekristalle | Mehr Gifttürme, Starke Gifte, Giftküche, Destille |
| Glockengießerei | Stadt | Glockenguss | **Glockenturm** | Mehr/Große Glocken, Klangkörper, Weithall |
| Händlergilde | Stadt | Karawanen | **Rift-Sammler**, Gold | Mehr Sammler, Große Karawanen, Packesel, Marktstände |
| Kristallschmiede | Stadt | Kristallkunde | **Kristallmine** | Mehr Minen, Tiefe Schächte, Kristallbohrer, Kristallsäule |
| Magiergilde | Stadt | **Story Nacht 10** | **Magier- + Frostturm**, **Magiebaum** | Mehr Magier/Frost, Höhere Magie, Arkanes Wissen, Manakristalle |
| Wachturm | Mauer | Wehrtürme | Tor-Leben | Späher, Zinnen, Signalfeuer |
| Schatzkammer | Stadt | Handel | Start-Rift-Kristalle, Gold-Beute | Steuern, Kristalltresor (Zinsen) |
| Orakel | Stadt | Sterndeutung | Neuwürfe, +1 Glück | Sternkarten, Vorahnung (Startkarte) |
| Glücksbrunnen | Stadt | Glücksspiel | +2 Glück, seltene Funde | Münzwurf, Wunschmünzen |
| Kapelle | Stadt | Glaube | Tor heilt nach jeder Welle | Segen (Krit), Heilige Mauern |
| Taverne | Stadt | Gastfreundschaft | Karte zu Beginn der Nacht | Stammgäste, Heldenlieder |

### Forschungsbaum (Universität)

Jede Forschung braucht ihre Vorgänger (Linien im Baum) und eine Universitäts-Stufe. Eine Forschung gleichzeitig.

```
Forstwirtschaft ─┬─ Fischerei ── Handel ── Karawanen
                 └─ Bergbau ── Kristallkunde ── Glücksspiel
Schießpulver ────┬─ Belagerungskunst ── Ballistik ─┬─ Baukunst
                 │                                └─ Meisterbaukunst (alle Türme +1 Stufe)
                 └─ Alchemie ── Sterndeutung
Wehrtürme ── Glockenguss ── Glaube ── Gastfreundschaft
```

### Magiebaum (Magiergilde)

Eigener Forschungsplatz – läuft parallel zur Universität. Bringt vor allem Boni und zwei Türme.

```
            ┌─ Bannzauber (Bannturm) ── Bannmeister
            ├─ Schutzrunen (Tor)
Manafluss ──┼─ Arkane Macht ── Mana-Echo ── Erzmagier
            ├─ Glückszauber ── Schicksalsweber ── Kristallfokus
            └─ Windzauber (Windturm) ── Sturmmeister
```

### Story-Nächte

Besondere Nächte mit festem Rift und Belohnung (`src/data/story.ts`).
Beispiel: **Nacht 10 – „Der entführte Hofmagier“** (Tech-Rift): Roboter haben den Hofmagier entführt.
Belohnung: Die **Magiergilde** (mit Magiebaum) wird freigeschaltet.

## Nacht-Sphäre: der Kampf

1. Ein Rift öffnet sich (Nacht 1–3: Urzeit, Tech, Weltraum; danach zufällig, Story-Nächte fest).
2. Eine neue Karte entsteht: Weg(e), Sonderfelder, **Rohstoff-Felder** (Bäume, Felsen, Kristalle …).
   Die Karte ist **28 × 13 Felder** groß (größer als der Bildschirm, ohne sichtbares Raster) –
   mit dem Finger verschieben. Die Wege winden sich wie Straßen: meist geradeaus, sanfte Kurven,
   ab und zu eine große Biegung oder ein schräges Stück; Ecken sind abgerundet, Gegner laufen die Kurven rund ab.
3. Man startet mit Rift-Kristallen (200 + 30 pro Nacht + Stadt-Boni) und **beschwört Türme**.
   - Nur Türme, die die Stadt freigeschaltet hat.
   - **Limit pro Turmart** (z. B. 2 Bogentürme) und **maximale Turmstufe** – beides steigt durch Gebäude-Upgrades.
4. Jede Welle startet man selbst. Nach jeder 3. Welle: 1 von 3 **Upgrade-Karten** (gilt für diese Nacht).
5. Letzte Welle = Boss-Welle.

### Beute

- Jeder Gegner lässt **Rift-Kristalle** fallen. Sie fliegen nach kurzer Zeit von selbst in die Leiste.
- Mit etwas Glück fällt **Gold** (Chance 15 %, mehr über Wachturm/Schatzkammer, jeder Glückspunkt +15 %).
- **Seltene Funde:** 1 % Grundchance + 0,5 % pro Glückspunkt: Magiekristalle und viel Gold.
- Spezialgegner und Bosse lassen **Ressourcen** fallen (z. B. Hacker: Magiekristalle und Gold).
- **Rohstoff-Felder** auf der Karte muss man abbauen: Feld antippen → **König schicken**.
  Der König läuft hin, baut ab (3 s) und kehrt zurück – **in der Zeit fehlt er am Tor**.
  Danach ist das Feld freies Bauland. Später übernehmen **Sammler-Trupps** (Holzfäller) und die
  **Zivilisten des Rift-Sammlers** das während der Wellen.

### Glück

Glück ist ein Wert in Punkten (Anzeige links unter der Beute). Es kommt aus Gebäuden (Glücksbrunnen, Orakel,
Bauernhof, Taverne), dem Magiebaum (Glückszauber) und Karten (Kleeblatt, Hufeisen, Glückspilz, Fortunas Gunst).

- **Karten:** Jeder Punkt macht seltene, epische und legendäre Karten wahrscheinlicher (`rarityWeights` in `src/core/draft.ts`).
  Spätere Karten in einer Nacht werden automatisch etwas besser.
- **Gold-Beute:** +15 % Chance pro Punkt (`BALANCE.luckDropBonus`).
- **Seltene Funde:** +0,5 % pro Punkt (`BALANCE.rareDropPerLuck`).
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

| Turm | Kosten | Ziele | Besonderheit | Fähigkeit bei vollem Mana | Freigeschaltet durch |
|---|---|---|---|---|---|
| Bogenturm | 70 | Boden + Luft | schnell, günstig | **Pfeilsalve**: 5 Pfeile auf verschiedene Gegner | Bogenmacher |
| Ballista | 100 | nur Luft | großer Schaden | **Durchbohren**: trifft alle Fluggegner in einer Linie | Bogenmacher |
| Kanonenturm | 110 | Boden | Flächenschaden | **Großkaliber**: doppelter Schaden und Radius | Kanonengießerei |
| Katapult | 140 | Boden | riesige Reichweite, zielt auf die **größte Gruppe** | **Felsenregen**: 5 Felsen | Belagerungswerkstatt |
| Giftturm | 90 | Boden | Gift stapelt sich (bis 5×), wirkt über Zeit | **Giftwolke** auf der dichtesten Gruppe | Alchemistenhütte |
| Magierturm | 120 | Boden | Kettenblitz, magisch | **Gewittersturm**: Blitz auf 8 Gegner | Magiergilde |
| Frostturm | 90 | Boden | verlangsamt | **Eiszeit**: friert alle in Reichweite ein | Magiergilde |
| Bannturm | 110 | Boden + Luft | entfernt Schilde, sperrt Gegner-Fähigkeiten | **Bannkreis**: alle in Reichweite 6 s gebannt | Magiebaum: Bannzauber |
| Windturm | 100 | Boden + Luft | stößt Gegner zurück | **Wirbelsturm**: Fluggegner stürzen ab, Bodengegner fliegen zurück | Magiebaum: Windzauber |
| Glockenturm | 100 | – | **passiv**: Türme in Reichweite +15/22/30 % Angriffstempo | **Sturmläuten**: alle Türme 5 s +50 % Tempo | Glockengießerei |
| Rift-Sammler | 80 | – | **passiv**: 1/2/3 Zivilisten sammeln Rohstoff-Felder | **Sammelzug**: 3 Zivilisten mehr bis Wellenende | Händlergilde |
| Kristallmine | 120 | – | **passiv**: alle 5 s Rift-Kristalle (4/7/11) | **Mutterader**: sofort 40 Rift-Kristalle | Kristallschmiede |
| König | – | Boden + Luft | am Tor, im Kampf verbesserbar, **Pfeilhagel**, baut Rohstoffe ab | – | – |

Zielwahl pro Turm (im Turmfenster umschaltbar): Erster · Stärkster · Nächster · Größte Gruppe.

### Turmstufen

| Stufe | Wie? | Was wird besser? |
|---|---|---|
| 1–3 | sofort im Kampf mit Rift-Kristallen | nur Grundwerte (Schaden, Tempo, Reichweite, Mana-Regeneration); passive Türme: Aura/Ertrag/Zivilisten |
| 4 | + Gebäude-Upgrade („Verstärkte …“) **oder** Forschung „Meisterbaukunst“ | Grundwerte + Spezialwerte (größere Explosion, mehr Kettenziele, stärkeres Gift …) |
| 5 | Gebäude-Upgrade **und** Forschung | noch stärker; Turmsockel leuchtet |

Neu beschworene Türme kommen aus einem kleinen Rift.

### Turm-Werte (Fenster beim Antippen eines Turms)

„Turm-Name Lvl. X“, darunter: Normaler Schaden · Magischer Schaden · Attack Speed · Range · Crit Chance ·
Crit DMG · Mana · Mana Regeneration · Beschreibung der Fähigkeit. Passive Türme zeigen stattdessen Aura,
Zivilisten bzw. Ertrag.

- Normaler Schaden wird durch Rüstung verringert, magischer nicht. Ein Turm kann beides haben.
- Kritischer Treffer: Mit „Crit Chance“ wird der Schaden mit „Crit DMG“ multipliziert (150 % = 1,5-fach).
- Mana füllt sich **während der Wellen** mit „Mana Regeneration“ pro Sekunde. Bei vollem Mana löst der Turm
  seine Fähigkeit aus. Ist kein Gegner in Reichweite, wartet er mit vollem Mana.
- Boni für Fähigkeiten: „Stärke der Fähigkeiten“ (Arkane Macht, Karten) und „Chance auf kostenlose Fähigkeit“ (Mana-Echo).

## Übergang Tag ↔ Nacht

- **Tag → Nacht:** Vor der Stadt öffnet sich ein Rift. Felder, Straße und Bäume werden hineingesaugt,
  das Bild verzerrt sich, und die Kampfkarte „warpt“ aus dem Rift heraus (`src/ui/warp.ts`).
- **Nacht → Tag:** Die Kampfkarte wird zurück in den Rift gezogen; in der Stadt kommt das Land vor dem Tor wieder heraus.

## Sound

Soundeffekte werden im Browser erzeugt (`src/services/sound.ts`, noch keine Audiodateien): Knöpfe, Schüsse je Turmart,
Explosionen, Treffer am Tor, Beute, Wellen, Karten, Fähigkeiten, Bauen, Sieg/Niederlage, Rift-Übergang.
„Ton: An/Aus“ im Hauptmenü und oben rechts in der Stadt. Später können echte Sounds unter denselben Namen eingesetzt werden.

## Entwicklermodus (zum Testen)

Hauptmenü → **Entwickler**. Dort:
- **DEV-Knöpfe in Stadt und Kampf** – öffnen dasselbe Fenster direkt im Spiel.
- **Unendliche Ressourcen** – Ressourcen und Rift-Kristalle werden immer aufgefüllt (Anzeige ∞).
  Beim Ausschalten kommen die echten Ressourcen zurück.
- **Sofort bauen & forschen** – keine Wartezeit.
- **Nacht** und **Start-Welle** einstellen, dann „Nacht … ab Welle … starten“.
- Im Kampf zusätzlich: zu einer Welle springen (zwischen den Wellen), Welle gewinnen, Nacht gewinnen.

## Rifts

| Rift | Sondereffekt | Sonderfelder | Rohstoff-Felder | Spezial / Boss |
|---|---|---|---|---|
| Urzeit | +25 % Gegner, −15 % Leben | Hügel, Sumpf, Teergrube | Baum, Felsen, Riesenfarn, Bernstein | Parasaurolophus / T-Rex |
| Tech | +10 % Rüstung | Energiefeld, Störsender, Förderband | Schrott, Vorratskiste, Energiezelle | Hacker / Mech-Titan |
| Weltraum | Projektile +30 %, Gegner +10 % | Kristallfeld, Sternenstaub, Schwerkraftfeld | Meteorit, Kristallader, Alien-Ranken | Brüter / Brutkönigin |

## Upgrade-Karten (in der Nacht)

| Seltenheit | Farbe | Chance (Glück 0) | Beispiele |
|---|---|---|---|
| Gewöhnlich | Grau | 60 % | Bogentürme +15 % Schaden, Kleeblatt (+1 Glück), Flickwerk (Tor heilt), Kristallsplitter |
| Selten | Blau | 28 % | Hufeisen, Scharfe Klingen (Krit-Schaden), Zauberverstärker, Vorgeladen (Start-Mana) |
| Episch | Lila | 10 % | Kettenblitz, Zinsen, Glückspilz, Manaschleife, Große Familie, Seuche |
| Legendär | Orange | 2 % | Mehrfachschuss, Zeitverzerrung, Fortunas Gunst, Erzmagie, Blutkristalle |

47 Karten insgesamt. Karten für Türme, die man nicht hat, werden nicht angeboten.

## Offene Design-Fragen

- **Balancing** der Nächte zum neuen Freischalt-System: Mit Turm-Limits wird die Stadt wichtiger –
  die Schwierigkeit späterer Nächte muss beim Testen angepasst werden.
- Rohstoffe in der Bauphase abbauen ist ohne Risiko. Soll Abbauen nur während der Wellen gehen,
  oder soll es einen Countdown zwischen den Wellen geben?
- Wofür überschüssige Rift-Kristalle? (z. B. Nachkauf von Karten, Reparatur des Tors)
- Bauzeiten: echte Zeiten, Beschleunigen (z. B. per Werbung)?
- Weitere Story-Nächte und Gebäude (Kaserne mit Soldaten, Rift-Observatorium …)
- Balancing der neuen Türme und Entweder-oder-Paare beim Selbstspielen prüfen.
