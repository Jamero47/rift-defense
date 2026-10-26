import Phaser from 'phaser';
import { HUD_HEIGHT, TILE } from '../config';
import { formatNumber } from '../core/modifiers';
import { RESOURCE_IDS, type GridPos } from '../core/types';
import { KING, KING_MAX_LEVEL } from '../data/king';
import { RESOURCES } from '../data/resources';
import { TOWERS, type TowerDef } from '../data/towers';
import { Button, COLORS, addText, drawPanel } from '../ui/widgets';
import { DEPTH, type BattleScene } from './BattleScene';
import { TARGET_MODE_LABELS, type TargetMode, type Tower, type TowerStats } from './entities';

// Menüs auf der Karte: Turm beschwören, Turm verbessern/verkaufen, König verbessern, Rohstoffe abbauen.
// Bezahlt wird im Kampf mit Rift-Kristallen.

const TARGET_ORDER: TargetMode[] = ['first', 'strong', 'close', 'dense'];

export class BattleMenus {
  private root: Phaser.GameObjects.Container | null = null;
  /** Mana-Anzeige des offenen Turmfensters */
  private manaView: { tower: Tower; text: Phaser.GameObjects.Text; gfx: Phaser.GameObjects.Graphics; x: number; y: number; w: number } | null = null;

  constructor(private readonly scene: BattleScene) {}

  close(): void {
    this.root?.destroy();
    this.root = null;
    this.manaView = null;
    this.scene.rangeGfx.clear();
  }

  /** Sichtbarer Kartenausschnitt unter der oberen Leiste (Menüs liegen in der Welt) */
  private view(): { x: number; y: number; r: number; b: number } {
    const v = this.scene.cameras.main.worldView;
    return { x: v.x + 4, y: v.y + HUD_HEIGHT + 4, r: v.right - 4, b: v.bottom - 4 };
  }

  /** Menü über bzw. unter einem Feld, im sichtbaren Bereich */
  private placeNear(cx: number, cy: number, w: number, h: number): { x: number; y: number } {
    const v = this.view();
    const x = clamp(cx - w / 2, v.x, v.r - w);
    let y = cy - TILE / 2 - h - 6;
    if (y < v.y) y = cy + TILE / 2 + 6;
    return { x, y: clamp(y, v.y, v.b - h) };
  }

  /** Menü neben einem Objekt (rechts, sonst links) */
  private placeBeside(cx: number, cy: number, w: number, h: number, gap: number): { x: number; y: number } {
    const v = this.view();
    const x = cx + gap + w < v.r ? cx + gap : cx - gap - w;
    return { x: clamp(x, v.x, v.r - w), y: clamp(cy - h / 2, v.y, v.b - h) };
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
    // Bis zu 6 Türme pro Reihe
    const perRow = Math.min(6, Math.max(1, Math.ceil(towers.length / Math.ceil(towers.length / 6))));
    const rowsN = Math.max(1, Math.ceil(towers.length / perRow));
    const w = Math.max(360, perRow * bw + (perRow - 1) * gap + pad * 2);
    const gridH = rowsN * bh + (rowsN - 1) * gap;
    const h = 44 + gridH + 62;
    const pos = this.placeNear(c.x, c.y, w, h);
    const root = this.open(pos.x, pos.y, w, h);

    const good = tile.towerModifiers?.every((m) => m.value >= 0);
    const header = tile.effectText ?? `${tile.name} – Turm bauen`;
    root.add(addText(s, pad, 10, header, 19, { color: tile.effectText ? (good ? COLORS.good : COLORS.bad) : COLORS.text }));
    const info = addText(s, pad, 44 + gridH + 10, 'Tippe einen Turm an für die Vorschau.', 16, { color: COLORS.muted, bold: false, wrap: w - pad * 2 });
    root.add(info);

    this.markCell(c.x, c.y);
    let selected: string | null = null;
    const buttons: Button[] = [];

    towers.forEach((def, i) => {
      const cost = s.towerCost(def.levels[0]);
      const count = s.towerCount(def);
      const limit = s.towerLimit(def);
      const bx = pad + (i % perRow) * (bw + gap) + bw / 2;
      const by = 40 + bh / 2 + Math.floor(i / perRow) * (bh + gap);
      const btn = new Button(s, bx, by, bw, bh, '', () => {
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
      btn.add(addText(s, 0, 18, shortName(def.name), 15, { origin: [0.5, 0.5] }));
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
    const w = 400;
    const pad = 16;
    const next = t.level < t.def.levels.length ? s.computeTowerStats(t.def, t.level + 1, t.tile) : null;
    const allowed = s.towerMaxLevel(t.def);
    const notes: { text: string; color: string }[] = [];
    if (t.tile.effectText) notes.push({ text: t.tile.effectText, color: t.tile.towerModifiers?.every((m) => m.value >= 0) ? COLORS.good : COLORS.bad });
    if (t.disabled > 0) notes.push({ text: 'Gehackt! Turm ist kurz außer Betrieb.', color: '#4ade80' });
    const rows = statRows(t.def, t.stats, next);
    const extras = extraLines(t.def, t.stats, next);
    const abilityText = addText(s, pad, 0, t.def.ability.description, 15, { bold: false, wrap: w - pad * 2 });
    const rowH = 23;
    const h = 52 + notes.length * 22 + rows.length * rowH + 14 + 26 + abilityText.height + 10 + (extras ? 24 : 0) + 120;
    const pos = this.placeBeside(t.x, t.y, w, h, TILE / 2 + 8);
    const root = this.open(pos.x, pos.y, w, h);
    this.drawRange(t.x, t.y, t.stats.range, t.def.color);

    // Titel: "Turm-Name Lvl. X"
    root.add(addText(s, pad, 12, `${t.def.name} Lvl. ${t.level}`, 24));
    root.add(addText(s, w - pad, 18, `max. Lvl. ${allowed}`, 15, { origin: [1, 0], color: COLORS.muted }));
    let ly = 48;
    for (const n of notes) {
      root.add(addText(s, pad, ly, n.text, 15, { color: n.color }));
      ly += 22;
    }

    // Werte-Tabelle
    const g = s.add.graphics();
    root.add(g);
    for (const [i, row] of rows.entries()) {
      if (i % 2 === 0) {
        g.fillStyle(0xffffff, 0.05);
        g.fillRect(pad - 6, ly - 2, w - pad * 2 + 12, rowH);
      }
      root.add(addText(s, pad, ly, `${row.label}:`, 16, { bold: false, color: COLORS.muted }));
      const value = addText(s, w - pad, ly, row.value, 16, { origin: [1, 0] });
      root.add(value);
      if (row.label === 'Mana') this.manaView = { tower: t, text: value, gfx: g, x: pad + 70, y: ly + 8, w: 150 };
      ly += rowH;
    }
    this.tick();

    // Fähigkeit bei vollem Mana
    ly += 10;
    root.add(addText(s, pad, ly, `Fähigkeit: ${t.def.ability.name}`, 17, { color: '#93c5fd' }));
    ly += 24;
    abilityText.setY(ly);
    root.add(abilityText);
    ly += abilityText.height + 6;
    if (extras) {
      root.add(addText(s, pad, ly, extras, 14, { bold: false, color: COLORS.muted, wrap: w - pad * 2 }));
    }

    // Knöpfe
    const by = h - 92;
    if (next && t.level < allowed) {
      const cost = s.towerCost(t.def.levels[t.level]);
      root.add(new Button(s, 100, by, 170, 54, 'Verbessern', () => {
        if (s.upgradeTower(t)) this.openTower(t);
      }, { subLabel: `${cost} Kristalle`, fontSize: 19, enabled: s.crystals >= cost }));
    } else if (next) {
      root.add(new Button(s, 100, by, 170, 54, 'Gesperrt', () => {}, { enabled: false, fontSize: 19, subLabel: `Stufe ${t.level + 1}: Upgrade in der Stadt` }));
    } else {
      root.add(new Button(s, 100, by, 170, 54, 'Max. Stufe', () => {}, { enabled: false, fontSize: 19 }));
    }
    root.add(new Button(s, 290, by, 190, 54, 'Verkaufen', () => {
      s.sellTower(t);
      this.close();
    }, { subLabel: `+${s.sellValue(t)} Kristalle`, color: COLORS.danger, fontSize: 19 }));
    const modeBtn = new Button(s, w / 2, h - 32, w - 32, 42, `Ziel: ${TARGET_MODE_LABELS[t.targetMode]}`, () => {
      t.targetMode = TARGET_ORDER[(TARGET_ORDER.indexOf(t.targetMode) + 1) % TARGET_ORDER.length];
      modeBtn.setLabel(`Ziel: ${TARGET_MODE_LABELS[t.targetMode]}`);
    }, { color: COLORS.buttonAlt, fontSize: 18 });
    // Passive Türme greifen nicht an – Zielwahl ergibt keinen Sinn
    modeBtn.setVisible(t.def.attack !== 'none');
    root.add(modeBtn);
  }

  /** Aktualisiert die Mana-Anzeige im offenen Turmfenster (jedes Bild aufgerufen). */
  tick(): void {
    const v = this.manaView;
    if (!v || !this.root) return;
    const st = v.tower.stats;
    v.text.setText(`${Math.floor(v.tower.mana)}/${Math.round(st.maxMana)}`);
    const p = Math.min(1, v.tower.mana / st.maxMana);
    v.gfx.fillStyle(0x000000, 0.6);
    v.gfx.fillRect(v.x, v.y - 4, v.w, 8);
    v.gfx.fillStyle(0x3b82f6, 1);
    v.gfx.fillRect(v.x, v.y - 4, v.w * p, 8);
  }

  // ---------------------------------------------------------------- König

  openKing(): void {
    const s = this.scene;
    const w = 340;
    const away = !s.isKingHome() || s.kingMode !== 'home';
    const h = away ? 324 : 262;
    const pos = this.placeBeside(s.kingPos.x, s.kingPos.y, w, h, 36);
    const root = this.open(pos.x, pos.y, w, h);
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
    const pos = this.placeNear(c.x, c.y, w, h);
    const root = this.open(pos.x, pos.y, w, h);
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

/** Kurzname für die Bauknöpfe */
function shortName(name: string): string {
  return name.replace(/turm$/, '').replace('Rift-', '');
}

function summary(def: TowerDef, st: TowerStats): string {
  if (def.attack === 'none') return `${def.description} · Reichweite ${formatNumber(st.range / TILE)}`;
  const dmg = [st.physDamage > 0 ? `${formatNumber(st.physDamage)} normal` : '', st.magicDamage > 0 ? `${formatNumber(st.magicDamage)} magisch` : '']
    .filter(Boolean).join(' + ');
  const parts = [`Schaden ${dmg}`, `${formatNumber(st.attackSpeed)}/s`, `Reichweite ${formatNumber(st.range / TILE)}`];
  parts.push(def.targets.ground && def.targets.air ? 'Boden + Luft' : def.targets.air ? 'nur Luft' : 'nur Boden');
  return parts.join(' · ');
}

/** Werte-Tabelle des Turmfensters in fester Reihenfolge; "→" zeigt die nächste Stufe. */
function statRows(def: TowerDef, st: TowerStats, next: TowerStats | null): { label: string; value: string }[] {
  const arrow = (a: number, b: number | undefined, digits = 1, unit = '') => {
    const fa = `${formatNumber(a, digits)}${unit}`;
    return b === undefined || Math.abs(a - b) < 0.001 ? fa : `${fa} → ${formatNumber(b, digits)}${unit}`;
  };
  if (def.attack === 'none') {
    // Unterstützungs- und Wirtschaftstürme: keine Schadenswerte
    const rows = [{ label: 'Range', value: arrow(st.range / TILE, next ? next.range / TILE : undefined, 1, ' Felder') }];
    if (st.aura > 0) rows.push({ label: 'Aura: Angriffstempo', value: arrow(st.aura * 100, next ? next.aura * 100 : undefined, 0, ' %') });
    if (st.gatherers > 0) rows.push({ label: 'Zivilisten', value: arrow(st.gatherers, next?.gatherers, 0) });
    if (st.crystalIncome > 0) rows.push({ label: 'Kristalle alle 5 s', value: arrow(st.crystalIncome, next?.crystalIncome, 0) });
    rows.push({ label: 'Mana', value: '' }, { label: 'Mana Regeneration', value: arrow(st.manaRegen, next?.manaRegen, 1, '/s') });
    return rows;
  }
  return [
    { label: 'Normaler Schaden', value: arrow(st.physDamage, next?.physDamage) },
    { label: 'Magischer Schaden', value: arrow(st.magicDamage, next?.magicDamage) },
    { label: 'Attack Speed', value: arrow(st.attackSpeed, next?.attackSpeed, 2, '/s') },
    { label: 'Range', value: arrow(st.range / TILE, next ? next.range / TILE : undefined, 1, ' Felder') },
    { label: 'Crit Chance', value: arrow(st.critChance * 100, next ? next.critChance * 100 : undefined, 0, ' %') },
    { label: 'Crit DMG', value: arrow(st.critDamage * 100, next ? next.critDamage * 100 : undefined, 0, ' %') },
    { label: 'Mana', value: '' },
    { label: 'Mana Regeneration', value: arrow(st.manaRegen, next?.manaRegen, 1, '/s') },
  ];
}

/** Besonderheiten des Turms in einer Zeile (Explosion, Verlangsamung, Ziele …). */
function extraLines(def: TowerDef, st: TowerStats, next: TowerStats | null): string {
  const parts: string[] = [];
  if (st.splash > 0) parts.push(`Explosion ${formatNumber(st.splash / TILE)} Felder`);
  if (st.slowStrength > 0) parts.push(`verlangsamt um ${formatNumber(st.slowStrength * 100, 0)} %`);
  if (def.attack === 'chain') parts.push(`springt auf ${st.chain}${next && next.chain !== st.chain ? ` → ${next.chain}` : ''} weitere Ziele`);
  if (st.projectiles > 1) parts.push(`${st.projectiles} Projektile pro Schuss`);
  if (st.poisonDps > 0) parts.push(`Gift ${formatNumber(st.poisonDps)}/s für ${formatNumber(st.poisonDuration)} s (stapelbar)`);
  if (st.knockback > 0) parts.push(`stößt ${formatNumber(st.knockback / TILE)} Felder zurück`);
  if (st.silence > 0) parts.push(`bannt ${formatNumber(st.silence)} s (Schilde weg, keine Fähigkeiten)`);
  if (def.targetMode === 'dense') parts.push('zielt auf die größte Gruppe');
  if (def.attack === 'none') return parts.length ? parts.join(' · ') : '';
  parts.push(def.targets.ground && def.targets.air ? 'trifft Boden + Luft' : def.targets.air ? 'trifft nur Fluggegner' : 'trifft nur Bodengegner');
  return parts.join(' · ');
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
