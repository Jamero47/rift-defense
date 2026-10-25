# Roadmap

## Erledigt (v0.1 – Grundlagen)

- [x] Projekt (Phaser 4, TypeScript, Vite), Tests, automatischer Browser-Test, GitHub-Pages-Veröffentlichung
- [x] Kampf: Karte pro Nacht, 1–2 Wege, Boden- und Fluggegner, 5 Türme, König + Pfeilhagel
- [x] 3 Rifts mit Sonderfeldern, Spezialgegnern, Bossen, Sondereffekt und Ressourcen
- [x] Upgrade-Karten (4 Seltenheiten), Stadt mit 12 Gebäuden, Belohnungen, Spielstand
- [x] Niederlage: Werbung (Platzhalter) → Welle wiederholen + Rift-Kristalle

## Erledigt (v0.2 – Metaprogression)

- [x] Tag-Sphäre: eigene Stadtkarte mit Berg, Mauer, Bauplätzen (Thronsaal-Stufe oder Gold zum Freischalten)
- [x] 11 Gebäude mit Bauzeit, Gebäudestufen und eigenen Upgrades; Universität mit Forschung
- [x] Türme werden durch Gebäude freigeschaltet, Limit und maximale Stufe pro Turmart
- [x] 5 Ressourcen (Gold, Holz, Stein, Magiekristalle, Nahrung), im Kampf Rift-Kristalle
- [x] Beute fliegt automatisch ein; König baut Rohstoff-Felder ab; Sammler-Trupps (Holzfäller)
- [x] Story-Nacht 10 „Der entführte Hofmagier“ schaltet die Magierakademie frei
- [x] Tutorial: Thronsaal → Bogenmacher → erste Nacht

## Erledigt (v0.3)

- [x] Turm-Werte: normaler/magischer Schaden, Crit Chance/DMG, Mana, Mana-Regeneration, Turmfenster
- [x] Toolbox (`editor.html`): Werte aller Bereiche und Grafiken ändern, Export als `mod.json`

## Erledigt (v0.4 – großes Inhalts-Update)

- [x] 7 neue Türme (Gift, Katapult, Glocke, Rift-Sammler, Kristallmine, Bann, Wind) und Fähigkeiten für alle 12 Türme
- [x] Passive Türme: Aura, Zivilisten sammeln Rohstoffe, Kristall-Förderung
- [x] Glück-System: seltenere Karten, Gold-Beute, seltene Funde; 47 Upgrade-Karten
- [x] 10 neue Gebäude, mehr Upgrades, Entweder-oder-Gebäude
- [x] 26 Bauplätze in der Stadt
- [x] Größere Karte (28 × 13) ohne sichtbares Raster, längere Wege, Karte mit dem Finger verschieben
- [x] Forschungsbaum (Universität) und Magiebaum (Magiergilde)

## Als Nächstes (Vorschläge)

1. **Selbst spielen und Balancing anpassen** – Zahlen in `src/config.ts` und `src/data/*`.
   Wichtig nach v0.2: Die Schwierigkeit späterer Nächte an Turm-Limits und Stadt-Fortschritt anpassen
   (der Test-Bot verliert Nacht 10 mit mittlerer Stadt in Welle 3). Bauzeiten (jetzt 5 s) festlegen.
2. **Sound & Musik** (Treffer, Bau, Welle, Sieg/Niederlage)
3. **Echte Grafik**: Sprites/Pixel-Art statt Code-Grafik (Textur-Schlüssel bleiben gleich, siehe `textures.ts`)
4. **Animationen**: laufende Gegner, Turm-Schuss-Animation, Tor-Schaden sichtbar
5. **Nächste Welle früher rufen** (für Bonus-Gold), Wellen-Vorschau mit Gegner-Infos zum Antippen
6. **Mehr Inhalte**: weitere Rifts (Eiszeit, Unterwelt, Unterwasser …), Türme (Kaserne mit Soldaten, Giftturm), Karten
7. **Rift-Wahl**: vor der Nacht zwischen 2 Rifts wählen (z. B. leichter vs. mehr Belohnung)
8. **Stadt lebendiger**: Gebäude-Grafiken auf den Bauplätzen, Bewohner, Umland ausbauen, weitere Story-Nächte
9. **Mehr Weg-Formen**: Schleifen, Kreuzungen, getrennte Ziele
10. **Fortschritt mitten in der Nacht speichern** (App schließen und weiterspielen)

## Später: echte App

- **Capacitor** einbinden → Android-/iOS-App aus demselben Code (`npx cap add android`)
- **Werbung**: AdMob über `@capacitor-community/admob`; nur `src/services/ads.ts` muss angepasst werden
- **Cloud-Spielstand** (Konto, mehrere Geräte): z. B. Firebase/Supabase oder Google Play Games – nur `src/core/save.ts`
- Scharfe Darstellung auf hochauflösenden Displays, Anpassung an sehr breite Handys (`Scale.EXPAND`)
- Datenschutz (DSGVO) für Werbung, Store-Einträge, Icons, Screenshots
