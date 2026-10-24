# Entwicklung

Gebaut mit **Phaser 4 + TypeScript + Vite**. Voraussetzung: [Node.js](https://nodejs.org) (Version 20 oder neuer).

```bash
npm install        # einmalig: Abhängigkeiten installieren
npm run dev        # Spiel starten → Adresse im Terminal im Browser öffnen
```

`npm run dev` zeigt auch eine **Network**-Adresse (z. B. `http://192.168.0.12:5173`).
Ist das Handy im selben WLAN, kann man das Spiel damit direkt auf dem Handy öffnen.

| Befehl | Was passiert |
|---|---|
| `npm test` | Automatische Tests der Spiellogik (Karten, Wellen, Belohnungen, Speichern) |
| `npm run build` | Fertige Version im Ordner `dist/` bauen |
| `npm run smoke` | Spiel im unsichtbaren Browser starten, Stadt wie im Tutorial aufbauen, eine Nacht automatisch spielen, Screenshots in `screenshots/` (Optionen: `--night N`, `--full-city`, `--quick`, `--defeat`) |

Mit `?debug` hinter der Adresse gibt es in der Browser-Konsole Hilfen, z. B. `rift.go('Battle', { night: 5 })`.

## Online-Version (GitHub Pages)

Der Workflow `.github/workflows/deploy.yml` baut das Spiel bei jedem Push auf `main` und veröffentlicht es.
Einmalig einschalten: **Settings → Pages → Source: „GitHub Actions“**.

## Projektaufbau

```
src/
  config.ts          Layout und Balancing (Startgold, Schwierigkeit, Werbung …)
  data/              Alle Spielinhalte: Türme, Gegner, Rifts, Karten, Gebäude, Bauplätze, Forschung, Story, König
  core/              Spiellogik ohne Grafik (Kartengenerator, Wellen, Stadt, Boni, Speichern) – mit Tests
  battle/            Der Kampf: Szene, Gegner/Türme, Menüs, obere Leiste
  scenes/            Menü, Stadt (Tag-Sphäre), Ergebnis
  game/textures.ts   Alle Grafiken (per Code gezeichnet)
  ui/                Knöpfe, Dialoge, Kartenauswahl
  services/ads.ts    Werbung (Platzhalter)
docs/
  GAME_DESIGN.md        Spielidee, Regeln, alle Werte im Überblick
  INHALTE_ERWEITERN.md  Anleitung: neue Türme, Gegner, Rifts, Karten, Gebäude
  ROADMAP.md            Nächste Schritte
tests/               Automatische Tests
```
