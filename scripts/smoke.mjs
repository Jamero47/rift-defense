// Rauchtest: startet das Spiel im unsichtbaren Browser, baut die Stadt auf (wie im Tutorial),
// macht Screenshots und spielt automatisch eine Nacht. Bricht bei JavaScript-Fehlern ab.
//
//   npm run smoke                 → Tutorial-Stadt aufbauen, Nacht 1 automatisch spielen
//   npm run smoke -- --night 3    → bestimmte Nacht
//   npm run smoke -- --full-city  → Stadt mit allen Gebäuden (alle Türme verfügbar)
//   npm run smoke -- --quick      → nur Screenshots, nicht durchspielen
//   npm run smoke -- --defeat     → keine Türme bauen: Niederlage + Werbung testen
//
// Braucht Playwright (in Claude-Code-Cloud-Sitzungen vorinstalliert).
// Screenshots landen im Ordner screenshots/.

import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const night = Number(args[args.indexOf('--night') + 1]) || 1;
const quick = args.includes('--quick');
const defeatTest = args.includes('--defeat');
const fullCity = args.includes('--full-city');
const PORT = 5199;
const OUT = 'screenshots';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Vite direkt starten (nicht über npx), damit kill() den Server wirklich beendet
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Dev-Server startet nicht')), 30000);
  server.stdout.on('data', (d) => {
    if (String(d).includes('Local')) {
      clearTimeout(timer);
      resolve();
    }
  });
});

const errors = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
  const wait = (ms) => page.waitForTimeout(ms);
  /** Klickt einen Knopf anhand seiner Beschriftung */
  const press = async (label) => {
    const b = await page.evaluate((l) => window.rift.button(l), label);
    if (!b) throw new Error(`Knopf nicht gefunden: ${label}`);
    if (!b.enabled) throw new Error(`Knopf ist gesperrt: ${label}`);
    await page.mouse.click(b.x, b.y);
    await wait(250);
  };

  await page.goto(`http://localhost:${PORT}/?debug`);
  await page.waitForFunction(() => window.rift && window.rift.scenes().includes('Menu'));
  await page.evaluate(() => window.rift.save.reset());
  await page.evaluate(() => window.rift.go('Menu'));
  await wait(500);
  await shot('01-menu');

  // ---------- Stadt (Tag-Sphäre) wie im Tutorial
  await press('Spielen');
  await wait(400);
  await shot('02-city-start');
  if (fullCity) {
    await page.evaluate(buildFullCity);
    await page.evaluate(() => window.rift.go('City'));
    await wait(400);
  } else {
    await page.mouse.click(610, 385); // Thronsaal-Platz
    await wait(300);
    await shot('03-build-choice');
    await press('Bauen');
    await wait(1500);
    await shot('04-construction');
    await wait(4200);
    await page.mouse.click(550, 200); // Stadtplatz 1
    await press('Bauen');
    await wait(5600);
    await page.mouse.click(550, 200);
    await wait(300);
    await shot('05-bogenmacher');
    await press('Kaufen'); // erstes Upgrade (Mehr Bogentürme)
    await press('X');
  }
  await shot('06-city');
  if (fullCity) {
    // Forschungsbaum und Magiebaum ansehen
    await page.mouse.click(670, 200); // Universität (stadt_2)
    await wait(300);
    await shot('06a-universitaet');
    await press('Forschungsbaum');
    await wait(300);
    await shot('06b-forschungsbaum');
    await press('X');
    await page.mouse.click(790, 200); // Magiergilde (stadt_4)
    await wait(300);
    await press('Magiebaum');
    await wait(300);
    await shot('06c-magiebaum');
    await press('X');
    await page.mouse.click(670, 570); // freier Stadtplatz → Bauauswahl
    await wait(300);
    await shot('06d-bauauswahl');
    await press('X');
  }
  await page.evaluate((n) => window.rift.save.update((d) => { d.night = n; }), night);
  await page.evaluate(() => window.rift.go('City'));
  await wait(300);
  await page.mouse.click(1180, 300); // Nacht-Knopf
  await wait(300);
  await shot('07-night-preview');
  await press('Verteidigen');
  await wait(1100);
  await shot('07b-rift-warp-out');
  await wait(1300);
  await shot('07c-rift-warp-in');
  await wait(1500);
  // Story-Dialog wegklicken, falls vorhanden
  const story = await page.evaluate(() => window.rift.button('Zur Verteidigung'));
  if (story) await press('Zur Verteidigung');
  await shot('08-battle-start');

  // ---------- Kampf
  const cell = await page.evaluate(() => {
    const b = window.rift.battle();
    const tiles = b.setup.map.tiles;
    for (let row = 0; row < tiles.length; row++) {
      for (let col = 2; col < tiles[0].length - 2; col++) {
        const near = [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dc, dr]) => tiles[row + dr]?.[col + dc] && b.tileAt(col + dc, row + dr).path);
        if (b.tileAt(col, row).buildable && near) return b.focusCell({ col, row });
      }
    }
    return null;
  });
  await wait(100);
  await page.mouse.click(cell.x, cell.y);
  await wait(300);
  await shot('09-build-menu');
  await page.evaluate(() => window.rift.battle().menus.close()); // Menü schließen

  // König zu einem Rohstoff schicken
  const res = await page.evaluate(() => {
    const b = window.rift.battle();
    const tiles = b.setup.map.tiles;
    let best = null;
    for (let row = 0; row < tiles.length; row++) {
      for (let col = 0; col < tiles[0].length; col++) {
        if (!b.tileAt(col, row).harvest) continue;
        const c = b.cellCenter({ col, row });
        const d = Math.hypot(c.x - b.kingHome.x, c.y - b.kingHome.y);
        if (!best || d < best.d) best = { col, row, d };
      }
    }
    return best && b.focusCell(best);
  });
  if (res) {
    await wait(100);
    await page.mouse.click(res.x, res.y);
    await wait(300);
    await shot('10-harvest-menu');
    await press('König schicken');
    await wait(1200);
    await shot('11-king-walking');
  }
  // Karte verschieben (Ziehen mit dem Finger)
  await page.mouse.move(900, 500);
  await page.mouse.down();
  await page.mouse.move(600, 380, { steps: 8 });
  await page.mouse.up();
  await wait(200);
  await shot('11b-map-scrolled');

  if (defeatTest) {
    await page.evaluate(() => { const b = window.rift.battle(); b.cycleSpeed(); b.cycleSpeed(); b.gateHp = 3; });
    await press('Welle starten');
    await page.waitForFunction(() => window.rift.battle().phase === 'ended', null, { timeout: 60000 });
    await wait(400);
    await shot('15-defeat');
    await press('Werbung ansehen');
    await wait(1200);
    await shot('16-ad');
    await wait(3000);
    const after = await page.evaluate(() => window.rift.battle().debugInfo());
    console.log('Nach der Werbung:', JSON.stringify(after));
    if (after.phase !== 'build' || after.gateHp !== 3) errors.push('Werbung: Welle wurde nicht korrekt wiederhergestellt');
  } else if (!quick) {
    // Kamera zurück zum Tor, dort stehen die Türme
    await page.evaluate(() => { const b = window.rift.battle(); b.cycleSpeed(); b.cycleSpeed(); b.cameras.main.setScroll(0, b.cameras.main.scrollY); });
    let shots = 0;
    for (let tick = 0; tick < 1400; tick++) {
      await wait(400);
      const scenes = await page.evaluate(() => window.rift.scenes());
      if (scenes.includes('Result')) break;
      const info = await page.evaluate(() => window.rift.battle().debugInfo());
      if (info.phase === 'draft') {
        await shot('13-cards');
        await page.mouse.click(640, 380);
        await wait(250);
        await page.mouse.click(640, 655);
        continue;
      }
      if (info.phase === 'build') {
        await page.evaluate(autoBuild);
        await press('Welle starten');
      }
      if (info.outcome === 'defeat' || (info.phase === 'ended' && info.gateHp <= 0)) {
        await shot('15-defeat');
        console.log('Niederlage in Welle', info.wave + 1, 'von', info.waves, '– Türme:', info.towers, 'Kristalle:', info.crystals);
        await page.evaluate(() => window.rift.battle().giveUp());
      }
      if (info.phase === 'wave' && shots < 2 && info.enemies > 8) await shot(`12-battle-wave-${++shots}`);
    }
    const last = await page.evaluate(() => window.rift.battle().debugInfo());
    console.log('Ende:', JSON.stringify({ outcome: last.outcome, gateHp: last.gateHp, wave: last.wave, loot: last.loot, cards: last.cards }));
    await wait(4000);
    await shot('17-result');
    const save = await page.evaluate(() => window.rift.save.get());
    console.log('Spielstand nach der Nacht:', JSON.stringify({ night: save.night, resources: save.resources, stats: save.stats }));
    await press('Zur Stadt');
    await wait(700);
    await shot('18a-city-warp-in');
    await wait(1500);
    await shot('18-city-after');
  }
} finally {
  await browser.close();
  server.kill();
}

if (errors.length) {
  console.error('FEHLER im Spiel:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`OK – Screenshots in ${OUT}/`);

/** Läuft im Browser: Stadt mit allen Gebäuden für Tests späterer Nächte. */
function buildFullCity() {
  window.rift.save.update((d) => {
    d.city.plots = {
      thron: { building: 'thronsaal', level: 5 },
      stadt_1: { building: 'bogenmacher', level: 2 },
      stadt_2: { building: 'universitaet', level: 1 },
      stadt_3: { building: 'giesserei', level: 1 },
      stadt_4: { building: 'akademie', level: 2 },
      // Zum Testen ALLE Türme – im echten Spiel schließen sich manche Gebäude gegenseitig aus
      stadt_5: { building: 'alchemistenhuette', level: 1 },
      stadt_7: { building: 'belagerungswerkstatt', level: 1 },
      stadt_8: { building: 'glockengiesserei', level: 1 },
      stadt_9: { building: 'haendlergilde', level: 1 },
      stadt_10: { building: 'kristallschmiede', level: 1 },
      berg: { building: 'steinbruch', level: 2 },
      feld_1: { building: 'bauernhof', level: 1 },
      feld_2: { building: 'holzfaeller', level: 1 },
    };
    d.city.boughtPlots = ['stadt_3', 'stadt_5', 'stadt_7', 'stadt_9', 'stadt_10', 'feld_2'];
    d.city.research = ['forstwirtschaft', 'schiesspulver', 'manafluss', 'bannzauber', 'windzauber', 'glueckszauber'];
    d.city.story = ['hofmagier'];
    d.city.upgrades = { mehr_bogentuerme: 2, bogenturm_stufen: 1, sammler_trupp: 1, koenigsklinge: 2 };
  });
}

/** Läuft im Browser: einfacher Bot, der Rift-Kristalle in Türme steckt. */
function autoBuild() {
  const b = window.rift.battle();
  const spots = [];
  const tiles = b.setup.map.tiles;
  for (let row = 0; row < tiles.length; row++) {
    for (let col = 0; col < tiles[0].length; col++) {
      if (!b.tileAt(col, row).buildable) continue;
      let near = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const id = tiles[row + dr]?.[col + dc];
        if (id && b.tileAt(col + dc, row + dr).path) near++;
      }
      if (near > 0) spots.push({ col, row, near });
    }
  }
  // Nah am Tor zuerst (dort kommen alle Gegner vorbei)
  const gate = b.kingHome;
  const score = (s) => s.near * 2 - Math.hypot(b.cellCenter(s).x - gate.x, b.cellCenter(s).y - gate.y) / 72;
  spots.sort((a, b2) => score(b2) - score(a));
  // Jede Turmart der Reihe nach probieren; tryBuild prüft Limit und Rift-Kristalle selbst
  // Erst Angriffstürme; Wirtschaft und Unterstützung erst mit Polster
  const attack = ['bow', 'ballista', 'cannon', 'catapult', 'poison', 'mage', 'frost', 'banner', 'wind'];
  const extra = b.crystals > 250 ? ['bell', 'mine', 'gatherer'] : [];
  const order = [...attack, ...extra].filter((t) => b.availableTowers.includes(t));
  for (const s of spots) {
    if (b.towers.some((t) => t.col === s.col && t.row === s.row)) continue;
    if (!order.some((id) => b.tryBuild(id, s))) break;
  }
  for (const t of b.towers) if (b.crystals > 150) b.upgradeTower(t);
  if (b.crystals > 200) b.upgradeKing();
}
