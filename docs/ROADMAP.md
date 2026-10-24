# Roadmap

## Erledigt (v0.1 – Grundlagen)

- [x] Projekt (Phaser 4, TypeScript, Vite), Tests, automatischer Browser-Test, GitHub-Pages-Veröffentlichung
- [x] Kampf: Karte pro Nacht, 1–2 Wege, Boden- und Fluggegner, 5 Türme, König + Pfeilhagel
- [x] 3 Rifts mit Sonderfeldern, Spezialgegnern, Bossen, Sondereffekt und Ressourcen
- [x] Upgrade-Karten (4 Seltenheiten), Stadt mit 12 Gebäuden, Belohnungen, Spielstand
- [x] Niederlage: Werbung (Platzhalter) → Welle wiederholen + Gold

## Als Nächstes (Vorschläge)

1. **Selbst spielen und Balancing anpassen** – Zahlen in `src/config.ts` und `src/data/*` (der Test-Bot schafft Nacht 1, Nacht 7 ohne Gebäude nicht)
2. **Sound & Musik** (Treffer, Bau, Welle, Sieg/Niederlage)
3. **Echte Grafik**: Sprites/Pixel-Art statt Code-Grafik (Textur-Schlüssel bleiben gleich, siehe `textures.ts`)
4. **Animationen**: laufende Gegner, Turm-Schuss-Animation, Tor-Schaden sichtbar
5. **Nächste Welle früher rufen** (für Bonus-Gold), Wellen-Vorschau mit Gegner-Infos zum Antippen
6. **Mehr Inhalte**: weitere Rifts (Eiszeit, Unterwelt, Unterwasser …), Türme (Kaserne mit Soldaten, Giftturm), Karten
7. **Rift-Wahl**: vor der Nacht zwischen 2 Rifts wählen (z. B. leichter vs. mehr Belohnung)
8. **Stadt als Karte** statt Raster: Gebäude sichtbar in der Stadt, Umland ausbauen
9. **Mehr Weg-Formen**: Schleifen, Kreuzungen, getrennte Ziele
10. **Fortschritt mitten in der Nacht speichern** (App schließen und weiterspielen)

## Später: echte App

- **Capacitor** einbinden → Android-/iOS-App aus demselben Code (`npx cap add android`)
- **Werbung**: AdMob über `@capacitor-community/admob`; nur `src/services/ads.ts` muss angepasst werden
- **Cloud-Spielstand** (Konto, mehrere Geräte): z. B. Firebase/Supabase oder Google Play Games – nur `src/core/save.ts`
- Scharfe Darstellung auf hochauflösenden Displays, Anpassung an sehr breite Handys (`Scale.EXPAND`)
- Datenschutz (DSGVO) für Werbung, Store-Einträge, Icons, Screenshots
