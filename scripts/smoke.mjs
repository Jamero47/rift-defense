// Rauchtest: startet das Spiel im unsichtbaren Browser, macht Screenshots
// und spielt automatisch eine Nacht. Bricht bei JavaScript-Fehlern ab.
//
//   npm run smoke                → Nacht 1 automatisch spielen
//   npm run smoke -- --night 3   → bestimmte Nacht
//   npm run smoke -- --quick     → nur Screenshots, nicht durchspielen
//   npm run smoke -- --defeat    → keine Türme bauen: Niederlage + Werbung testen
//
// Braucht Playwright (in Claude-Code-Cloud-Sitzungen vorinstalliert).
// Screenshots landen im Ordner screenshots/.

import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const night = Number(args[args.indexOf('--night') + 1]) || 1;
const quick = args.includes('--quick');
const defeatTest = args.includes('--defeat');
const PORT = 5199;
const OUT = 'screenshots';
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

  await page.goto(`http://localhost:${PORT}/?debug`);
  await page.waitForFunction(() => window.rift && window.rift.scenes().includes('Menu'));
  await page.evaluate(() => window.rift.save.reset());
  await page.evaluate(() => window.rift.go('Menu'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/1-menu.png` });

  await page.evaluate(() => window.rift.go('City'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/2-city.png` });

  await page.evaluate((n) => window.rift.go('Battle', { night: n }), night);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/3-battle-start.png` });

  // Baumenü öffnen (echter Klick auf ein Bau-Feld neben dem Weg)
  const cell = await page.evaluate(() => {
    const b = window.rift.battle();
    for (let row = 0; row < 9; row++) {
      for (let col = 2; col < 14; col++) {
        const t = b.tileAt(col, row);
        const near = [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dc, dr]) => b.setup.map.tiles[row + dr]?.[col + dc] && b.tileAt(col + dc, row + dr).path);
        if (t.buildable && near) return b.cellCenter({ col, row });
      }
    }
    return null;
  });
  await page.mouse.click(cell.x, cell.y);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/4-build-menu.png` });
  await page.mouse.click(5, 715); // Menü schließen

  if (defeatTest) {
    await page.evaluate(() => { const b = window.rift.battle(); b.cycleSpeed(); b.cycleSpeed(); b.gateHp = 3; });
    await page.mouse.click(1190, 36);
    await page.waitForFunction(() => window.rift.battle().phase === 'ended', null, { timeout: 60000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/7-defeat.png` });
    await page.mouse.click(640, 380); // »Werbung ansehen« (erster Knopf im Dialog)
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/7-ad.png` });
    await page.waitForTimeout(3000);
    const after = await page.evaluate(() => window.rift.battle().debugInfo());
    console.log('Nach der Werbung:', JSON.stringify(after));
    if (after.phase !== 'build' || after.gateHp !== 3) errors.push('Werbung: Welle wurde nicht korrekt wiederhergestellt');
  } else if (!quick) {
    await page.evaluate(() => window.rift.battle().cycleSpeed());
    await page.evaluate(() => window.rift.battle().cycleSpeed());
    let shots = 0;
    for (let tick = 0; tick < 600; tick++) {
      await page.waitForTimeout(400);
      const scenes = await page.evaluate(() => window.rift.scenes());
      if (scenes.includes('Result')) break;
      const info = await page.evaluate(() => window.rift.battle().debugInfo());
      if (info.phase === 'draft') {
        await page.screenshot({ path: `${OUT}/6-cards.png` });
        await page.mouse.click(640, 380);
        await page.waitForTimeout(250);
        await page.mouse.click(640, 655);
        continue;
      }
      if (info.phase === 'build') {
        await page.evaluate(autoBuild);
        await page.mouse.click(1190, 36); // »Welle starten«
      }
      if (info.outcome === 'defeat' || (info.phase === 'ended' && info.gateHp <= 0)) {
        await page.screenshot({ path: `${OUT}/7-defeat.png` });
        console.log('Niederlage in Welle', info.wave + 1, 'von', info.waves);
        await page.evaluate(() => window.rift.battle().giveUp());
      }
      if (info.phase === 'wave' && shots < 2 && info.enemies > 8) {
        await page.screenshot({ path: `${OUT}/5-battle-wave-${++shots}.png` });
      }
    }
    const last = await page.evaluate(() => window.rift.battle().debugInfo());
    console.log('Ende:', JSON.stringify({ outcome: last.outcome, gateHp: last.gateHp, wave: last.wave, cards: last.cards }));
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/8-result.png` });
    const save = await page.evaluate(() => window.rift.save.get());
    console.log('Spielstand nach der Nacht:', JSON.stringify({ night: save.night, resources: save.resources, stats: save.stats }));
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

/** Läuft im Browser: einfacher Bot, der Gold in Türme steckt. */
function autoBuild() {
  const b = window.rift.battle();
  const spots = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 16; col++) {
      const t = b.tileAt(col, row);
      if (!t.buildable) continue;
      let near = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const id = b.setup.map.tiles[row + dr]?.[col + dc];
        if (id && b.tileAt(col + dc, row + dr).path) near++;
      }
      if (near > 0) spots.push({ col, row, near });
    }
  }
  spots.sort((a, b2) => b2.near - a.near || a.col - b2.col);
  const order = ['bow', 'cannon', 'bow', 'ballista', 'mage', 'frost', 'bow', 'cannon', 'ballista', 'mage'];
  let built = b.towers.length;
  for (const s of spots) {
    if (b.towers.some((t) => t.col === s.col && t.row === s.row)) continue;
    const id = order[built % order.length];
    if (!b.tryBuild(id, s)) break;
    built++;
  }
  for (const t of b.towers) if (b.gold > 150) b.upgradeTower(t);
}
