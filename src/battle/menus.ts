import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, MAP_Y, TILE } from '../config';
import { formatNumber } from '../core/modifiers';
import { RESOURCE_IDS, type GridPos } from '../core/types';
import { KING, KING_MAX_LEVEL } from '../data/king';
import { RESOURCES } from '../data/resources';
import { TOWERS, type TowerDef } from '../data/towers';
import { Button, COLORS, addText, drawPanel } from '../ui/widgets';
import { DEPTH, type BattleScene } from './BattleScene';
import { TARGET_MODE_LABELS, type Tower, type TowerStats } from './entities';

// Menüs auf der Karte: Turm beschwören, Turm verbessern/verkaufen, König verbessern, Rohstoffe abbauen.
// Bezahlt wird im Kampf mit Rift-Kristallen.

const TARGET_ORDER = ['first', 'strong', 'close'] as const;

export class BattleMenus {
  private root: Phaser.GameObjects.Container | null = null;

  constructor(private readonly scene: BattleScene) {}

  close(): void {
    this.root?.destroy();
    this.root = null;
    this.scene.rangeGfx.clear();
  }

  private open(x: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
    this.close();
    const s = this.scene;
    const root = s.add.container(x, y).setDepth(DEPTH.menu);
    const g = s.add.graphics();
    drawPanel(g, 0, 0, w, h);
    // Fängt Taps ab, damit sie nicht auf der Karte landen
    const shield = s.add.zone(w / 2, h / 2, w, h).setInteractive();
    root.add([g, shield]);
    this.root = root;
    return root;
  }

  private drawRange(x: number, y: number, range: number, color = 0xffffff): void {
    const g = this.scene.rangeGfx;
    g.clear();
    g.fillStyle(color, 0.1);
    g.fillCircle(x, y, range);
    g.lineStyle(2, color, 0.7);
    g.strokeCircle(x, y, range);
  }

  // ---------------------------------------------------------------- Bauen

  openBuild(cell: GridPos): void {
    const s = this.scene;
    const tile = s.tileAt(cell.col, cell.row);
    const c = s.cellCenter(cell);
    const bw = 100;
    const bh = 112;
    const gap = 8;
    const pad = 12;
    const towers = TOWERS.filter((t) => s.availableTowers.includes(t.id));
    const w = Math.max(360, towers.length * bw + (towers.length - 1) * gap + pad * 2);
    const h = 44 + bh + 62;
    const x = clamp(c.x - w / 2, 8, GAME_WIDTH - w - 8);
    let y = c.y - TILE / 2 - h - 6;
    if (y < MAP_Y + 4) y = c.y + TILE / 2 + 6;
    const root = this.open(x, y, w, h);

    const good = tile.towerModifiers?.every((m) => m.value >= 0);
    const header = tile.effectText ?? `${tile.name} – Turm bauen`;
    root.add(addText(s, pad, 10, header, 19, { color: tile.effectText ? (good ? COLORS.good : COLORS.bad) : COLORS.text }));
    const info = addText(s, pad, 44 + bh + 10, 'Tippe einen Turm an für die Vorschau.', 16, { color: COLORS.muted, bold: false, wrap: w - pad * 2 });
    root.add(info);

    this.markCell(c.x, c.y);
    let selected: string | null = null;
    const buttons: Button[] = [];

    towers.forEach((def, i) => {
      const cost = s.towerCost(def.levels[0]);
      const count = s.towerCount(def);
      const limit = s.towerLimit(def);
      const bx = pad + i * (bw + gap) + bw / 2;
      const btn = new Button(s, bx, 40 + bh / 2, bw, bh, '', () => {
        if (selected === def.id) {
          if (s.tryBuild(def.id, cell)) this.close();
          return;
        }
        selected = def.id;
        buttons.forEach((b, j) => b.setHighlighted(j === i));
        const st = s.computeTowerStats(def, 1, tile);
        const hint = count >= limit ? `Limit erreicht (${count}/${limit}) – mehr im Gebäude ${s.towerSource(def)}` : 'Nochmal antippen = beschwören';
        info.setText(`${def.name}: ${summary(def, st)}\n${hint}`).setColor(count >= limit ? COLORS.bad : COLORS.text);
        this.drawRange(c.x, c.y, st.range, def.color);
        this.markCell(c.x, c.y);
      }, { color: 0x2a2540 });
      btn.add(s.add.image(0, -22, `top_${def.id}`).setScale(0.85));
      btn.add(addText(s, 0, 18, def.name.replace('turm', ''), 15, { origin: [0.5, 0.5] }));
      btn.add(s.add.image(-16, 40, 'icon_rift').setScale(0.38));
      btn.add(addText(s, -4, 40, `${cost}`, 18, { origin: [0, 0.5], color: s.crystals >= cost ? COLORS.text : COLORS.bad }));
      if (def.targets.air) btn.add(s.add.image(bw / 2 - 14, -bh / 2 + 14, 'icon_air').setScale(0.45));
      btn.add(addText(s, -bw / 2 + 8, -bh / 2 + 6, `${count}/${limit}`, 14, { color: count >= limit ? COLORS.bad : COLORS.muted }));
      root.add(btn);
      buttons.push(btn);
    });
  }

  private markCell(x: number, y: number): void {
    const g = this.scene.rangeGfx;
    g.lineStyle(3, 0xfacc15, 1);
    g.strokeRect(x - TILE / 2 + 2, y - TILE / 2 + 2, TILE - 4, TILE - 4);
  }

  // ---------------------------------------------------------------- Turm

  openTower(t: Tower): void {
    const s = this.scene;
    const w = 340;
    const h = 300;
    const x = t.x + TILE / 2 + 8 + w < GAME_WIDTH ? t.x + TILE / 2 + 8 : t.x - TILE / 2 - 8 - w;
    const y = clamp(t.y - h / 2, MAP_Y + 4, GAME_HEIGHT - h - 4);
    const root = this.open(x, y, w, h);
    this.drawRange(t.x, t.y, t.stats.range, t.def.color);

    const maxLevel = t.def.levels.length;
    const allowed = s.towerMaxLevel(t.def);
    root.add(addText(s, 16, 12, t.def.name, 24));
    root.add(addText(s, w - 16, 16, `Stufe ${t.level}/${allowed}`, 18, { origin: [1, 0], color: COLORS.gold }));
    let ly = 46;
    if (t.tile.effectText) {
      const good = t.tile.towerModifiers?.every((m) => m.value >= 0);
      root.add(addText(s, 16, ly, t.tile.effectText, 16, { color: good ? COLORS.good : COLORS.bad }));
      ly += 22;
    }
    if (t.disabled > 0) {
      root.add(addText(s, 16, ly, 'Gehackt! Turm ist kurz außer Betrieb.', 16, { color: '#4ade80' }));
      ly += 22;
    }
    const next = t.level < maxLevel ? s.computeTowerStats(t.def, t.level + 1, t.tile) : null;
    const lines = statLines(t.def, t.stats, next);
    root.add(addText(s, 16, ly, lines.join('\n'), 17, { bold: false, wrap: w - 32 }));

    const by = h - 98;
    if (next && t.level < allowed) {
      const cost = s.towerCost(t.def.levels[t.level]);
      root.add(new Button(s, 92, by, 156, 56, 'Verbessern', () => {
        if (s.upgradeTower(t)) this.openTower(t);
      }, { subLabel: `${cost} Kristalle`, fontSize: 19, enabled: s.crystals >= cost }));
    } else if (next) {
      root.add(new Button(s, 92, by, 156, 56, 'Gesperrt', () => {}, { enabled: false, fontSize: 19, subLabel: `Upgrade: ${s.towerSource(t.def)}` }));
    } else {
      root.add(new Button(s, 92, by, 156, 56, 'Max. Stufe', () => {}, { enabled: false, fontSize: 19 }));
    }
    root.add(new Button(s, 254, by, 140, 56, 'Verkaufen', () => {
      s.sellTower(t);
      this.close();
    }, { subLabel: `+${s.sellValue(t)} Kristalle`, color: COLORS.danger, fontSize: 19 }));
    const modeBtn = new Button(s, w / 2, h - 34, w - 32, 44, `Ziel: ${TARGET_MODE_LABELS[t.targetMode]}`, () => {
      t.targetMode = TARGET_ORDER[(TARGET_ORDER.indexOf(t.targetMode) + 1) % TARGET_ORDER.length];
      modeBtn.setLabel(`Ziel: ${TARGET_MODE_LABELS[t.targetMode]}`);
    }, { color: COLORS.buttonAlt, fontSize: 18 });
    root.add(modeBtn);
  }

  // ---------------------------------------------------------------- König

  openKing(): void {
    const s = this.scene;
    const w = 340;
    const away = !s.isKingHome() || s.kingMode !== 'home';
    const h = away ? 324 : 262;
    const x = s.kingPos.x + 36 + w < GAME_WIDTH ? s.kingPos.x + 36 : s.kingPos.x - 36 - w;
    const root = this.open(x, clamp(s.kingPos.y - h / 2, MAP_Y + 4, GAME_HEIGHT - h - 4), w, h);
    const k = s.kingStats();
    this.drawRange(s.kingPos.x, s.kingPos.y, k.range, 0xfacc15);
    root.add(addText(s, 16, 12, KING.name, 24));
    root.add(addText(s, w - 16, 16, `Stufe ${s.kingLevel}/${KING_MAX_LEVEL}`, 18, { origin: [1, 0], color: COLORS.gold }));
    const status = { home: 'Wacht am Tor.', walking: 'Unterwegs zum Rohstoff …', harvesting: 'Baut ab …', returning: 'Kehrt zum Tor zurück …' }[s.kingMode];
    const lines = [
      `Schaden: ${formatNumber(k.damage)} · Tempo: ${formatNumber(k.attackSpeed)}/s`,
      `Reichweite: ${formatNumber(k.range / TILE)} Felder · Boden + Luft`,
      `${KING.ability.name}: ${formatNumber(k.abilityDamage, 0)} Schaden, alle ${formatNumber(k.abilityCooldown, 0)} s`,
      status,
    ];
    root.add(addText(s, 16, 48, lines.join('\n'), 17, { bold: false, wrap: w - 32 }));
    const cost = s.kingUpgradeCost();
    root.add(new Button(s, w / 2, 202, w - 32, 58, cost === null ? 'Max. Stufe' : 'König verbessern', () => {
      if (s.upgradeKing()) this.openKing();
    }, { subLabel: cost === null ? undefined : `${cost} Kristalle`, enabled: cost !== null && s.crystals >= cost, fontSize: 20 }));
    if (away) {
      root.add(new Button(s, w / 2, 270, w - 32, 52, 'Zurück zum Tor', () => {
        s.recallKing();
        this.close();
      }, { color: COLORS.buttonAlt, fontSize: 20 }));
    }
  }

  // ---------------------------------------------------------------- Rohstoffe abbauen

  openHarvest(cell: GridPos): void {
    const s = this.scene;
    const tile = s.tileAt(cell.col, cell.row);
    if (!tile.harvest) return;
    const c = s.cellCenter(cell);
    const w = 300;
    const h = 176;
    const x = clamp(c.x - w / 2, 8, GAME_WIDTH - w - 8);
    let y = c.y - TILE / 2 - h - 6;
    if (y < MAP_Y + 4) y = c.y + TILE / 2 + 6;
    const root = this.open(x, y, w, h);
    this.markCell(c.x, c.y);
    root.add(addText(s, 16, 12, tile.name, 22));
    let ix = 16;
    for (const id of RESOURCE_IDS) {
      const v = tile.harvest[id];
      if (!v) continue;
      root.add(s.add.image(ix + 12, 56, RESOURCES[id].icon).setScale(0.55));
      const t = addText(s, ix + 28, 56, `+${v}`, 19, { origin: [0, 0.5], color: COLORS.gold });
      root.add(t);
      ix += 40 + t.width + 8;
    }
    root.add(addText(s, 16, 76, 'Der König verlässt dafür das Tor!', 15, { color: COLORS.muted, bold: false }));
    const busy = s.kingMode !== 'home';
    root.add(new Button(s, w / 2, h - 40, w - 32, 56, 'König schicken', () => {
      s.sendKing(cell);
    }, { fontSize: 21, subLabel: busy ? 'bricht seinen aktuellen Auftrag ab' : undefined }));
  }
}

function summary(def: TowerDef, st: TowerStats): string {
  const parts = [`Schaden ${formatNumber(st.damage)}`, `${formatNumber(st.attackSpeed)}/s`, `Reichweite ${formatNumber(st.range / TILE)}`];
  parts.push(def.targets.ground && def.targets.air ? 'Boden + Luft' : def.targets.air ? 'nur Luft' : 'nur Boden');
  return parts.join(' · ');
}

function statLines(def: TowerDef, st: TowerStats, next: TowerStats | null): string[] {
  const arrow = (a: number, b: number | undefined, digits = 1) =>
    b === undefined || Math.abs(a - b) < 0.001 ? formatNumber(a, digits) : `${formatNumber(a, digits)} → ${formatNumber(b, digits)}`;
  const lines = [
    `Schaden: ${arrow(st.damage, next?.damage)}`,
    `Tempo: ${arrow(st.attackSpeed, next?.attackSpeed, 2)} pro Sekunde`,
    `Reichweite: ${arrow(st.range / TILE, next ? next.range / TILE : undefined)} Felder`,
  ];
  if (st.splash > 0) lines.push(`Explosion: ${arrow(st.splash / TILE, next ? next.splash / TILE : undefined)} Felder`);
  if (st.slowStrength > 0) lines.push(`Verlangsamt um ${arrow(st.slowStrength * 100, next ? next.slowStrength * 100 : undefined, 0)} %`);
  if (def.attack === 'chain') lines.push(`Springt auf ${arrow(st.chain, next?.chain, 0)} weitere Ziele`);
  if (st.projectiles > 1) lines.push(`${st.projectiles} Projektile pro Schuss`);
  lines.push(def.targets.ground && def.targets.air ? 'Trifft Boden + Luft' : def.targets.air ? 'Trifft nur Fluggegner' : 'Trifft nur Bodengegner');
  return lines;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
