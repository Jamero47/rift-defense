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
    await page.mouse.click(620, 385); // Thronsaal-Platz
    await wait(300);
    await shot('03-build-choice');
    await press('Bauen');
    await wait(1500);
    await shot('04-construction');
    await wait(4200);
    await page.mouse.click(460, 222); // Stadtplatz 1
    await press('Bauen');
    await wait(5600);
    await page.mouse.click(460, 222);
    await wait(300);
    await shot('05-bogenmacher');
    await press('Kaufen'); // erstes Upgrade (Mehr Bogentürme)
    await press('X');
  }
  await shot('06-city');
  await page.evaluate((n) => window.rift.save.update((d) => { d.night = n; }), night);
  await page.evaluate(() => window.rift.go('City'));
  await wait(300);
  await page.mouse.click(1180, 300); // Nacht-Knopf
  await wait(300);
  await shot('07-night-preview');
  await press('Verteidigen');
  await wait(2200);
  // Story-Dialog wegklicken, falls vorhanden
  const story = await page.evaluate(() => window.rift.button('Zur Verteidigung'));
  if (story) await press('Zur Verteidigung');
  await shot('08-battle-start');

  // ---------- Kampf
  const cell = await page.evaluate(() => {
    const b = window.rift.battle();
    for (let row = 0; row < 9; row++) {
      for (let col = 2; col < 14; col++) {
        const near = [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dc, dr]) => b.setup.map.tiles[row + dr]?.[col + dc] && b.tileAt(col + dc, row + dr).path);
        if (b.tileAt(col, row).buildable && near) return b.cellCenter({ col, row });
      }
    }
    return null;
  });
  await page.mouse.click(cell.x, cell.y);
  await wait(300);
  await shot('09-build-menu');
  await page.mouse.click(5, 715); // Menü schließen

  // König zu einem Rohstoff schicken
  const res = await page.evaluate(() => {
    const b = window.rift.battle();
    let best = null;
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 16; col++) {
        if (!b.tileAt(col, row).harvest) continue;
        const c = b.cellCenter({ col, row });
        const d = Math.hypot(c.x - b.kingHome.x, c.y - b.kingHome.y);
        if (!best || d < best.d) best = { ...c, d };
      }
    }
    return best;
  });
  if (res) {
    await page.mouse.click(res.x, res.y);
    await wait(300);
    await shot('10-harvest-menu');
    await press('König schicken');
    await wait(1200);
    await shot('11-king-walking');
  }

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
    await page.evaluate(() => { const b = window.rift.battle(); b.cycleSpeed(); b.cycleSpeed(); });
    let shots = 0;
    for (let tick = 0; tick < 700; tick++) {
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
        console.log('Niederlage in Welle', info.wave + 1, 'von', info.waves);
        await page.evaluate(() => window.rift.battle().giveUp());
      }
      if (info.phase === 'wave' && shots < 2 && info.enemies > 8) await shot(`12-battle-wave-${++shots}`);
    }
    const last = await page.evaluate(() => window.rift.battle().debugInfo());
    console.log('Ende:', JSON.stringify({ outcome: last.outcome, gateHp: last.gateHp, wave: last.wave, loot: last.loot, cards: last.cards }));
    await wait(2500);
    await shot('17-result');
    const save = await page.evaluate(() => window.rift.save.get());
    console.log('Spielstand nach der Nacht:', JSON.stringify({ night: save.night, resources: save.resources, stats: save.stats }));
    await press('Zur Stadt');
    await wait(600);
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
      thron: { building: 'thronsaal', level: 3 },
      stadt_1: { building: 'bogenmacher', level: 2 },
      stadt_2: { building: 'universitaet', level: 1 },
      stadt_3: { building: 'giesserei', level: 1 },
      stadt_4: { building: 'akademie', level: 1 },
      berg: { building: 'steinbruch', level: 2 },
      feld_1: { building: 'bauernhof', level: 1 },
      feld_2: { building: 'holzfaeller', level: 1 },
    };
    d.city.boughtPlots = ['stadt_3', 'feld_2'];
    d.city.research = ['forstwirtschaft', 'schiesspulver'];
    d.city.story = [];
    d.city.upgrades = { mehr_bogentuerme: 2, bogenturm_stufen: 1, sammler_trupp: 1, koenigsklinge: 2 };
  });
}

/** Läuft im Browser: einfacher Bot, der Rift-Kristalle in Türme steckt. */
function autoBuild() {
  const b = window.rift.battle();
  const spots = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 16; col++) {
      if (!b.tileAt(col, row).buildable) continue;
      let near = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const id = b.setup.map.tiles[row + dr]?.[col + dc];
        if (id && b.tileAt(col + dc, row + dr).path) near++;
      }
      if (near > 0) spots.push({ col, row, near });
    }
  }
  spots.sort((a, b2) => b2.near - a.near || a.col - b2.col);
  // Jede Turmart der Reihe nach probieren; tryBuild prüft Limit und Rift-Kristalle selbst
  const order = ['bow', 'ballista', 'cannon', 'mage', 'frost'].filter((t) => b.availableTowers.includes(t));
  for (const s of spots) {
    if (b.towers.some((t) => t.col === s.col && t.row === s.row)) continue;
    if (!order.some((id) => b.tryBuild(id, s))) break;
  }
  for (const t of b.towers) if (b.crystals > 150) b.upgradeTower(t);
  if (b.crystals > 200) b.upgradeKing();
}
