# CLAUDE.md – Hinweise für Claude

## Projekt

Rift Defense: Tower-Defense-Roguelite fürs Handy (Querformat), gebaut mit **Phaser 4 + TypeScript + Vite**.
Die Besitzer:innen sind keine Profi-Programmierer:innen und entwickeln das Spiel mit Claude weiter.
Erklärungen an sie: auf Deutsch, einfach, ohne Fachjargon; Ergebnisse zeigen (Screenshots), nicht nur beschreiben.

Spielidee und Regeln: `docs/GAME_DESIGN.md`. Nächste Schritte: `docs/ROADMAP.md`.

## Befehle

```bash
npm install            # .npmrc setzt legacy-peer-deps (nötig wegen vitest-Peer-Deps)
npm run dev            # Dev-Server (Port 5173, --host)
npm test               # Vitest, nur src/core + data (Node, ohne Browser)
npm run typecheck
npm run build          # tsc + vite build → dist/
npm run smoke          # Playwright: Screenshots + Bot spielt Nacht 1 (Optionen: --night N, --quick, --defeat)
```

Nach Änderungen an Spiellogik: `npm test`. Nach Änderungen an Grafik/UI/Kampf: `npm run smoke` und Screenshots
in `screenshots/` ansehen. `smoke` bricht bei JavaScript-Fehlern im Browser ab.

## Architektur

- `src/data/*` – **alle Inhalte als Daten** (Türme, Gegner, Rifts inkl. Felder, Karten, Gebäude, König).
  Neue Inhalte gehören hierher; Anleitung in `docs/INHALTE_ERWEITERN.md`.
- `src/core/*` – reine Logik ohne Phaser (testbar): `mapgen` (Wege + Felder), `wavegen` (Wellen-Budget),
  `progression` (Rift pro Nacht, Belohnungen, Gebäudekosten/-boni), `draft` (Karten ziehen), `save` (localStorage),
  `modifiers` (Boni-System), `route` (Laufweg als Linienzug), `rng` (Seed-Zufall).
- **Boni-System:** Karten, Gebäude, Rift-Effekte und Felder liefern alle `Modifier { stat, kind: 'pct'|'flat', value, towerTags? }`.
  `Modifiers.apply(stat, base, tags)` = (base + flat) × (1 + pct). Neue Effekte möglichst als neuer `StatKey`
  in `core/types.ts` + Label in `core/modifiers.ts` + Auswertung in `BattleScene` umsetzen.
- `src/battle/BattleScene.ts` – Kampfregeln (Spawns, Bewegung, Zielwahl, Schaden, Fähigkeiten, Sieg/Niederlage,
  Snapshot pro Welle für „Werbung: Welle wiederholen“). `entities.ts` = Gegner/Turm/Projektil, `menus.ts` = Bau-/Turm-/Königsmenü,
  `hud.ts` = obere Leiste + Pfeilhagel-Knopf.
- Szenen: Boot (Texturen) → Menu → City → Battle → Result → City. `init()` setzt den Szenenzustand zurück
  (Phaser verwendet Szenen-Instanzen wieder – Klassenfelder werden NICHT neu initialisiert).
- Seeds: `setupNight(saveSeed, night)` ist deterministisch → Neustart einer Nacht = gleiche Karte und Wellen.
- Grafik: `src/game/textures.ts` zeichnet alles per Canvas-2D beim Start. Textur-Schlüssel:
  `tile_<rift>_<tile>`, `top_<tower>`, `tower_base_<1-3>`, `enemy_<id>`, `proj_<style>`, `portal_<rift>`, `icon_*`, `fx_*`.
  Echte Grafiken später unter denselben Schlüsseln laden.
- Layout: logisch 1280×720, `Scale.FIT`. Karte 16×9 Felder à 72 px ab (128, 72); links Mauer/Tor/König, oben HUD.
- Debug: `?debug` in der URL → `window.rift` (`go(scene, data)`, `battle()`, `save`). Wird von `scripts/smoke.mjs` genutzt.

## Konventionen

- Spieltexte und Code-Kommentare **Deutsch**, Bezeichner Englisch.
- Balancing-Zahlen nach `src/config.ts` (`BALANCE`) oder in die Daten, nicht in die Logik.
- Phaser 4 statt 3: `setTintFill()` gibt es nicht mehr (→ `setTint(c).setTintMode(Phaser.TintModes.FILL)`),
  `Geom.Point` → `Vector2`, `Math.TAU` = 2π. Doku liegt in `node_modules/phaser/skills/*/SKILL.md`.
- Taps: Knöpfe lösen bei `pointerup` aus; der Karten-Tap-Handler ignoriert Taps auf interaktive Objekte.
- Spielstand-Format ändern → `migrateSave()` in `core/save.ts` anpassen, damit alte Spielstände weiter laden.
