import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { describeModifiersCompact, scaleModifiers } from '../core/modifiers';
import { buildingCost, canAfford, pathCountForNight, riftForNight } from '../core/progression';
import { saveStore } from '../core/save';
import { RESOURCE_IDS } from '../core/types';
import { wavesForNight } from '../core/wavegen';
import { BUILDINGS, type BuildingDef } from '../data/buildings';
import { getEnemy } from '../data/enemies';
import { RESOURCES } from '../data/resources';
import { Button, COLORS, addText, drawPanel, floatText } from '../ui/widgets';
import { hex } from '../battle/hud';
import { drawBackdrop } from './backdrop';

// Die Stadt zwischen den Nächten: Gebäude dauerhaft ausbauen und die nächste Nacht starten.

const CARD_W = 214;
const CARD_H = 178;
const GAP = 12;
const GRID_X = 20;
const GRID_Y = 84;

export class CityScene extends Phaser.Scene {
  private resourceTexts: Phaser.GameObjects.Text[] = [];
  private cards: Phaser.GameObjects.Container[] = [];

  constructor() {
    super('City');
  }

  create(): void {
    const save = saveStore.get();
    const rift = riftForNight(save.seed, save.night);
    drawBackdrop(this, rift.color);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.35);

    // Kopfzeile
    const head = this.add.graphics();
    head.fillStyle(0x0b0d1a, 0.92);
    head.fillRect(0, 0, GAME_WIDTH, 70);
    new Button(this, 64, 35, 104, 48, 'Menü', () => this.scene.start('Menu'), { color: COLORS.buttonAlt, fontSize: 18 });
    addText(this, 130, 35, 'Deine Stadt', 30, { origin: [0, 0.5] });
    this.resourceTexts = RESOURCE_IDS.map((id, i) => {
      const x = 560 + i * 170;
      this.add.image(x, 35, RESOURCES[id].icon).setScale(0.85);
      return addText(this, x + 24, 35, '', 26, { origin: [0, 0.5] });
    });

    this.drawBuildings();
    this.drawNightPanel();
    const st = save.stats;
    addText(this, GRID_X, GAME_HEIGHT - 38,
      `Beste Nacht: ${st.bestNight}   ·   Siege: ${st.nightsWon}   ·   Niederlagen: ${st.defeats}   ·   Besiegte Gegner: ${st.enemiesKilled}`,
      17, { origin: [0, 0.5], color: COLORS.muted, stroke: true });
    this.refreshResources();
  }

  private refreshResources(): void {
    const res = saveStore.get().resources;
    RESOURCE_IDS.forEach((id, i) => this.resourceTexts[i].setText(String(res[id])));
  }

  private drawBuildings(): void {
    this.cards.forEach((c) => c.destroy());
    this.cards = BUILDINGS.map((def, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      return this.buildingCard(def, GRID_X + col * (CARD_W + GAP), GRID_Y + row * (CARD_H + GAP));
    });
  }

  private buildingCard(def: BuildingDef, x: number, y: number): Phaser.GameObjects.Container {
    const save = saveStore.get();
    const level = save.buildings[def.id] ?? 0;
    const maxed = level >= def.maxLevel;
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    drawPanel(g, 0, 0, CARD_W, CARD_H, { border: level > 0 ? 0x8b6f3e : 0x3f3a4f, fill: level > 0 ? 0x1c1828 : 0x15131d });
    c.add(g);
    const icon = this.add.image(32, 34, def.icon);
    icon.setScale(Math.min(1.1, 46 / icon.width));
    c.add(icon);
    c.add(fitText(addText(this, 62, 12, def.name, 18), CARD_W - 70));
    // Stufen-Punkte
    for (let i = 0; i < def.maxLevel; i++) {
      const dot = this.add.circle(66 + i * 15, 48, 5, i < level ? 0xfacc15 : 0x3f3a4f).setStrokeStyle(1, 0x000000);
      c.add(dot);
    }
    c.add(addText(this, 12, 62, effectText(def, Math.max(1, level)), 14, { bold: false, wrap: CARD_W - 24, color: level > 0 ? COLORS.text : COLORS.muted }));

    if (maxed) {
      c.add(addText(this, CARD_W / 2, CARD_H - 26, 'Maximale Stufe', 17, { origin: [0.5, 0.5], color: COLORS.gold }));
    } else {
      const cost = buildingCost(def, level);
      const affordable = canAfford(save.resources, cost);
      let cx = 12;
      for (const id of RESOURCE_IDS) {
        if (cost[id] <= 0) continue;
        c.add(this.add.image(cx + 9, CARD_H - 26, RESOURCES[id].icon).setScale(0.45));
        const t = addText(this, cx + 20, CARD_H - 26, String(cost[id]), 15, {
          origin: [0, 0.5], color: save.resources[id] >= cost[id] ? COLORS.text : COLORS.bad,
        });
        c.add(t);
        cx += 30 + t.width;
      }
      c.add(new Button(this, CARD_W - 52, CARD_H - 26, 92, 40, level === 0 ? 'Bauen' : 'Ausbau', () => this.upgrade(def), {
        enabled: affordable, fontSize: 16,
      }));
    }
    return c;
  }

  private upgrade(def: BuildingDef): void {
    const save = saveStore.get();
    const level = save.buildings[def.id] ?? 0;
    const cost = buildingCost(def, level);
    if (level >= def.maxLevel || !canAfford(save.resources, cost)) return;
    saveStore.update((d) => {
      for (const id of RESOURCE_IDS) d.resources[id] -= cost[id];
      d.buildings[def.id] = level + 1;
    });
    const i = BUILDINGS.indexOf(def);
    floatText(this, GRID_X + (i % 4) * (CARD_W + GAP) + CARD_W / 2, GRID_Y + Math.floor(i / 4) * (CARD_H + GAP) + 40,
      level === 0 ? 'Gebaut!' : `Stufe ${level + 1}!`, COLORS.gold, 24);
    this.drawBuildings();
    this.refreshResources();
  }

  private drawNightPanel(): void {
    const save = saveStore.get();
    const night = save.night;
    const rift = riftForNight(save.seed, night);
    const x = 930;
    const y = GRID_Y;
    const w = 330;
    const h = 3 * CARD_H + 2 * GAP;
    const g = this.add.graphics();
    drawPanel(g, x, y, w, h, { border: rift.color, borderWidth: 4 });
    addText(this, x + w / 2, y + 26, `Nacht ${night}`, 32, { origin: [0.5, 0.5] });
    const portal = this.add.image(x + 46, y + 92, `portal_${rift.id}`).setScale(0.55);
    this.tweens.add({ targets: portal, scale: 0.6, duration: 1000, yoyo: true, repeat: -1 });
    addText(this, x + 84, y + 78, 'Heute öffnet sich:', 15, { color: COLORS.muted });
    addText(this, x + 84, y + 98, rift.name, 22, { color: hex(rift.color), wrap: w - 96 });
    addText(this, x + 16, y + 140, rift.description, 15, { bold: false, wrap: w - 32 });

    let ly = y + 214;
    addText(this, x + 16, ly, `Sondereffekt: ${rift.globalEffect.name}`, 16, { color: COLORS.gold });
    addText(this, x + 16, ly + 21, rift.globalEffect.text, 14, { bold: false, wrap: w - 32 });
    ly += 64;
    addText(this, x + 16, ly, 'Besondere Felder:', 16, { color: COLORS.gold });
    const tileTexts = Object.values(rift.tiles).filter((t) => t.effectText).map((t) => `• ${t.effectText}`);
    addText(this, x + 16, ly + 21, tileTexts.join('\n'), 14, { bold: false, wrap: w - 32 });
    ly += 26 + tileTexts.length * 19;

    addText(this, x + 16, ly, 'Gegner:', 16, { color: COLORS.gold });
    const ids = [...rift.enemies.normal, ...rift.enemies.fast, ...rift.enemies.tank, ...rift.enemies.air, ...rift.enemies.special, ...rift.enemies.boss];
    ids.forEach((id, i) => {
      const img = this.add.image(x + 30 + i * 49, ly + 44, `enemy_${id}`);
      img.setScale(Math.min(1, 40 / img.width));
      if (getEnemy(id).flying) this.add.image(x + 46 + i * 49, ly + 30, 'icon_air').setScale(0.4);
    });
    ly += 72;
    const paths = pathCountForNight(save.seed, night);
    addText(this, x + 16, ly, `${wavesForNight(night)} Wellen  ·  ${paths === 1 ? '1 Weg' : `${paths} Wege`}  ·  Belohnung: ${RESOURCES[rift.reward.resource].name}`, 14, {
      color: COLORS.muted, wrap: w - 32,
    });

    new Button(this, x + w / 2, y + h - 44, w - 36, 68, 'Verteidigen!', () => this.scene.start('Battle', { night }), { fontSize: 28 });
  }
}

function effectText(def: BuildingDef, level: number): string {
  const parts: string[] = [];
  if (def.income) {
    for (const id of RESOURCE_IDS) {
      const v = def.income[id];
      if (v) parts.push(`+${v * level} ${RESOURCES[id].name} nach jedem Kampf`);
    }
  }
  if (def.modifiers) parts.push(...describeModifiersCompact(scaleModifiers(def.modifiers, level)));
  // Noch nicht gebaut: Vorschau auf Stufe 1 (grau dargestellt)
  return parts.join('\n');
}

/** Verkleinert die Schrift, bis der Text in eine Zeile passt. */
function fitText(t: Phaser.GameObjects.Text, maxWidth: number): Phaser.GameObjects.Text {
  let size = parseInt(String(t.style.fontSize), 10);
  while (t.width > maxWidth && size > 12) {
    size--;
    t.setFontSize(size);
  }
  return t;
}
