import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { hex } from '../battle/hud';
import {
  buildingLevel, buildingUnlockText, buildingsForPlot, buyPlot, buyUpgrade, canBuild, canBuyPlot, canBuyUpgrade,
  canStartNight, canStartResearch, canUpgradeBuilding, cityModifiers, cityTutorialHint, completeJobs, isPlotUnlocked,
  jobDuration, jobProgress, levelCost, plotUnlockText, researchJob, researchStatus, rivals, startBuild, startResearch,
  startUpgradeBuilding, throneLevel, unlockedTowers, upgradeRank,
} from '../core/city';
import { Modifiers, describeModifiersCompact, scaleModifiers } from '../core/modifiers';
import { pathCountForNight, riftForNight } from '../core/progression';
import { Rng } from '../core/rng';
import { saveStore, type SaveData } from '../core/save';
import { RESOURCE_IDS, type Resources } from '../core/types';
import { wavesForNight } from '../core/wavegen';
import { getBuilding, type BuildingDef } from '../data/buildings';
import { PLOTS, PLOT_KIND_LABELS, PLOT_SIZE, getPlot, type PlotDef } from '../data/city';
import { getEnemy } from '../data/enemies';
import { RESEARCH, RESEARCH_TREES, getResearch, type ResearchDef, type ResearchTree } from '../data/research';
import { RESOURCES } from '../data/resources';
import { storyForNight } from '../data/story';
import { getTower } from '../data/towers';
import { Button, COLORS, addText, drawPanel } from '../ui/widgets';

// Die Tag-Sphäre: die eigene Stadt mit Bauplätzen.
// Bauplätze antippen → bauen, ausbauen, Upgrades kaufen, forschen. Rechts geht es in die Nacht.

const HUD_H = 64;
const MODAL_DEPTH = 500;
const ROW_H = 78;

interface Panel {
  /** Inhalt des Fensters (Koordinaten relativ zur Fensterecke) */
  root: Phaser.GameObjects.Container;
  /** Alles inkl. Abdunkelung – wird beim Schließen zerstört */
  outer: Phaser.GameObjects.Container;
  /** Werden regelmäßig aufgerufen (z. B. Fortschrittsanzeigen) */
  updaters: (() => void)[];
  /** Panel mit aktuellem Stand neu aufbauen */
  reopen: () => void;
}

interface RowOptions {
  icon: string;
  title: string;
  badge?: string;
  description: string;
  cost?: Partial<Resources>;
  reason?: string;
  status?: string;
  button?: { label: string; enabled: boolean; onClick: () => void };
  dim?: boolean;
}

export class CityScene extends Phaser.Scene {
  private plotLayer!: Phaser.GameObjects.Container;
  private progressGfx!: Phaser.GameObjects.Graphics;
  private highlightGfx!: Phaser.GameObjects.Graphics;
  private resTexts: Phaser.GameObjects.Text[] = [];
  private subtitle!: Phaser.GameObjects.Text;
  private panel: Panel | null = null;
  private hint: Phaser.GameObjects.Container | null = null;
  private nightBtn!: Button;
  private lastTick = 0;
  private toastCount = 0;

  constructor() {
    super('City');
  }

  create(): void {
    this.panel = null;
    this.hint = null;
    this.resTexts = [];
    this.toastCount = 0;
    this.finishJobs(false);
    this.drawWorld();
    this.plotLayer = this.add.container(0, 0).setDepth(10);
    this.progressGfx = this.add.graphics().setDepth(12);
    this.highlightGfx = this.add.graphics().setDepth(11);
    this.tweens.add({ targets: this.highlightGfx, alpha: 0.35, duration: 650, yoyo: true, repeat: -1 });
    this.drawHud();
    this.drawNightButton();
    this.renderPlots();
    this.renderHint();
  }

  update(time: number): void {
    if (time - this.lastTick < 200) return;
    this.lastTick = time;
    this.finishJobs(true);
    this.drawProgress();
    for (const u of this.panel?.updaters ?? []) u();
  }

  // ================================================================ Ablauf

  /** Fertige Bauaufträge abschließen (auch solche, die fertig wurden, während das Spiel zu war). */
  private finishJobs(announce: boolean): void {
    const city = saveStore.get().city;
    const now = Date.now();
    const due = [city.job, city.researchJob, city.magicJob].some((j) => j && j.finishAt <= now);
    if (!due) return;
    let messages: string[] = [];
    saveStore.update((d) => (messages = completeJobs(d, now)));
    if (!announce) return;
    for (const m of messages) this.toast(m);
    this.refreshAll();
  }

  private refreshAll(): void {
    this.refreshResources();
    this.renderPlots();
    this.renderHint();
    this.panel?.reopen();
    const ok = canStartNight(saveStore.get().city).ok;
    this.nightBtn.setColor(ok ? COLORS.royal : 0x3b3552);
  }

  /** Führt eine Aktion am Spielstand aus. closePanel: Fenster danach schließen (z. B. nach »Bauen«). */
  private act(fn: (save: SaveData) => { ok: boolean; reason?: string }, closePanel = false): void {
    let result: { ok: boolean; reason?: string } = { ok: false };
    saveStore.update((d) => (result = fn(d)));
    if (!result.ok && result.reason) this.toast(result.reason, COLORS.bad);
    if (result.ok && closePanel) this.closePanel();
    this.refreshAll();
  }

  // ================================================================ Welt

  private drawWorld(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x6a9c4c, 0x6a9c4c, 0x46773a, 0x46773a, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const rng = new Rng(11);
    for (let i = 0; i < 70; i++) {
      g.fillStyle(rng.chance(0.5) ? 0x55883f : 0x7aaa58, 0.45);
      g.fillEllipse(rng.float(0, GAME_WIDTH), rng.float(HUD_H, GAME_HEIGHT), rng.float(30, 90), rng.float(14, 36));
    }
    // Straße vom Tor zum Rift
    g.fillStyle(0x9b7b52, 1);
    g.fillRect(900, 357, GAME_WIDTH - 900, 56);
    g.lineStyle(3, 0x6f5536, 0.6);
    g.lineBetween(900, 357, GAME_WIDTH, 357);
    g.lineBetween(900, 413, GAME_WIDTH, 413);

    // Bäume außerhalb der Mauer (Deko)
    for (const [x, y] of [[1255, 210], [1250, 600], [1160, 680], [930, 700], [1255, 440]]) {
      g.fillStyle(0x000000, 0.2);
      g.fillEllipse(x + 4, y + 16, 40, 12);
      g.fillStyle(0x2f6b2a, 1);
      g.fillCircle(x, y, 20);
      g.fillStyle(0x3f8a38, 1);
      g.fillCircle(x - 6, y - 6, 12);
    }

    // Berg, an den sich die Stadt lehnt
    const mountain = [
      { x: 0, y: GAME_HEIGHT }, { x: 0, y: 150 }, { x: 55, y: 105 }, { x: 115, y: 150 }, { x: 175, y: 82 },
      { x: 240, y: 150 }, { x: 290, y: 118 }, { x: 352, y: 210 }, { x: 352, y: 600 }, { x: 300, y: GAME_HEIGHT },
    ];
    const vec = (pts: { x: number; y: number }[]) => pts.map((p) => new Phaser.Math.Vector2(p.x, p.y));
    g.fillStyle(0x6d6a66, 1);
    g.fillPoints(vec(mountain), true);
    g.fillStyle(0x5a5753, 1);
    g.fillPoints(vec([{ x: 175, y: 82 }, { x: 240, y: 150 }, { x: 290, y: 118 }, { x: 352, y: 210 }, { x: 352, y: 600 }, { x: 220, y: 420 }]), true);
    g.fillStyle(0xf1f5f9, 1);
    for (const [px, py] of [[55, 105], [175, 82], [290, 118]]) g.fillTriangle(px - 22, py + 26, px, py, px + 22, py + 26);
    for (let i = 0; i < 26; i++) {
      g.fillStyle(0x4a4744, 0.5);
      const x = rng.float(20, 320);
      const y = rng.float(200, 690);
      g.fillTriangle(x, y, x + rng.float(10, 24), y + rng.float(-8, 8), x + rng.float(4, 14), y + rng.float(8, 18));
    }

    // Stadtboden und Mauer
    g.fillStyle(0x9a8f7c, 1);
    g.fillRoundedRect(345, 122, 555, 526, 30);
    g.lineStyle(1, 0x7d7465, 0.35);
    for (let y = 140; y < 640; y += 22) g.lineBetween(360, y, 885, y);
    g.lineStyle(18, 0x7d828e, 1);
    g.strokeRoundedRect(345, 122, 555, 526, 30);
    g.lineStyle(2, 0x4b5058, 1);
    g.strokeRoundedRect(336, 113, 573, 544, 36);
    g.strokeRoundedRect(354, 131, 537, 508, 24);
    // Tor zur Straße
    g.fillStyle(0x3b2412, 1);
    g.fillRect(888, 350, 26, 70);
    g.fillStyle(0x7a4a24, 1);
    g.fillRect(892, 356, 18, 58);

    // Rift-Schimmer am Ende der Straße
    const save = saveStore.get();
    const rift = riftForNight(save.seed, save.night);
    const glow = this.add.image(GAME_WIDTH - 10, 385, 'fx_glow').setTint(rift.color).setScale(3.2).setAlpha(0.45);
    this.tweens.add({ targets: glow, alpha: 0.75, duration: 1400, yoyo: true, repeat: -1 });
    this.add.image(GAME_WIDTH - 6, 385, `portal_${rift.id}`).setScale(0.5).setAlpha(0.8);
  }

  private drawHud(): void {
    const g = this.add.graphics().setDepth(50);
    g.fillStyle(0x0b0d1a, 0.92);
    g.fillRect(0, 0, GAME_WIDTH, HUD_H);
    new Button(this, 56, 32, 96, 46, 'Menü', () => this.scene.start('Menu'), { color: COLORS.buttonAlt, fontSize: 18 }).setDepth(51);
    addText(this, 116, 20, 'Deine Stadt', 24, { origin: [0, 0.5] }).setDepth(51);
    this.subtitle = addText(this, 116, 46, '', 14, { origin: [0, 0.5], color: COLORS.muted }).setDepth(51);
    this.resTexts = RESOURCE_IDS.map((id, i) => {
      const x = 430 + i * 168;
      this.add.image(x, 32, RESOURCES[id].icon).setScale(0.75).setDepth(51);
      return addText(this, x + 22, 32, '', 22, { origin: [0, 0.5] }).setDepth(51);
    });
    this.refreshResources();
  }

  private refreshResources(): void {
    const save = saveStore.get();
    RESOURCE_IDS.forEach((id, i) => this.resTexts[i]?.setText(String(save.resources[id])));
    this.subtitle?.setText(`Tag-Sphäre · Thronsaal Stufe ${throneLevel(save.city)}`);
  }

  private drawNightButton(): void {
    const save = saveStore.get();
    const rift = riftForNight(save.seed, save.night);
    const ok = canStartNight(save.city).ok;
    this.nightBtn = new Button(this, 1180, 300, 176, 78, `Nacht ${save.night}`, () => this.openNight(), {
      subLabel: rift.shortName, color: ok ? COLORS.royal : 0x3b3552, fontSize: 26,
    }).setDepth(20);
  }

  // ================================================================ Bauplätze

  private renderPlots(): void {
    this.plotLayer.removeAll(true);
    const save = saveStore.get();
    const city = save.city;
    for (const plot of PLOTS) {
      const { w, h } = PLOT_SIZE[plot.kind];
      const c = this.add.container(plot.x, plot.y);
      const g = this.add.graphics();
      c.add(g);
      const unlocked = isPlotUnlocked(city, plot);
      const state = city.plots[plot.id];
      const job = city.job?.plotId === plot.id ? city.job : null;
      const small = plot.kind === 'wall';
      if (!unlocked) {
        g.fillStyle(0x000000, 0.38);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
        g.lineStyle(2, 0xcbd5e1, 0.35);
        g.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
        c.add(this.add.image(0, small ? 0 : -10, 'icon_lock').setScale(small ? 0.6 : 0.8).setAlpha(0.85));
        if (!small) {
          const u = plot.unlock;
          const label = u.type === 'gold' ? `${u.cost} Gold` : u.type === 'throne' ? `Thronsaal ${u.level}` : '';
          c.add(addText(this, 0, 26, label, 14, { origin: [0.5, 0.5], color: COLORS.muted, stroke: true }));
        }
      } else if (state || job) {
        const def = getBuilding(state?.building ?? job!.id);
        const building = job?.kind === 'build';
        g.fillStyle(building ? 0x8b6a3e : 0x2b2433, building ? 0.85 : 0.92);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
        if (building) {
          g.lineStyle(3, 0x5b3a1e, 0.8);
          for (let x = -w / 2 + 10; x < w / 2; x += 22) g.lineBetween(x, -h / 2 + 4, x + 14, h / 2 - 4);
        }
        g.lineStyle(3, building ? 0x5b3a1e : 0xc9a24a, 1);
        g.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
        const icon = this.add.image(0, small ? -2 : -16, def.icon).setAlpha(building ? 0.6 : 1);
        icon.setScale(Math.min(1.2, (small ? 40 : 52) / icon.width));
        c.add(icon);
        if (!small) c.add(addText(this, 0, 20, building ? 'Baustelle' : def.name, 15, { origin: [0.5, 0.5], stroke: true, fit: w - 8 }));
        if (state) {
          for (let i = 0; i < state.level; i++) {
            c.add(this.add.circle(-((state.level - 1) * 9) / 2 + i * 9, h / 2 - (small ? 8 : 12), 3.5, 0xfacc15).setStrokeStyle(1, 0x000000));
          }
        }
      } else {
        g.fillStyle(0xffffff, 0.14);
        g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
        g.lineStyle(2, 0xffffff, 0.75);
        g.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
        c.add(addText(this, 0, small ? 0 : -8, '+', small ? 26 : 34, { origin: [0.5, 0.5], stroke: true }));
        if (!small) c.add(addText(this, 0, 24, PLOT_KIND_LABELS[plot.kind], 13, { origin: [0.5, 0.5], stroke: true }));
      }
      const zone = this.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => this.openPlot(plot.id));
      c.add(zone);
      this.plotLayer.add(c);
    }
    this.drawProgress();
  }

  private drawProgress(): void {
    const g = this.progressGfx;
    g.clear();
    const city = saveStore.get().city;
    const now = Date.now();
    const bar = (plot: PlotDef, p: number, color: number) => {
      const { w, h } = PLOT_SIZE[plot.kind];
      const bw = w - 16;
      g.fillStyle(0x000000, 0.75);
      g.fillRect(plot.x - bw / 2 - 1, plot.y + h / 2 + 3, bw + 2, 9);
      g.fillStyle(color, 1);
      g.fillRect(plot.x - bw / 2, plot.y + h / 2 + 4, bw * p, 7);
    };
    if (city.job?.plotId) bar(getPlot(city.job.plotId), jobProgress(city.job, now), 0xfacc15);
    for (const tree of ['uni', 'magic'] as const) {
      const job = researchJob(city, tree);
      const home = Object.entries(city.plots).find(([, s]) => s.building === RESEARCH_TREES[tree].building);
      if (job && home) bar(getPlot(home[0]), jobProgress(job, now), RESEARCH_TREES[tree].color);
    }
    // Tutorial-Hervorhebung
    const hg = this.highlightGfx;
    hg.clear();
    const target = this.tutorialTarget();
    if (target) {
      hg.lineStyle(5, 0xfacc15, 1);
      hg.strokeRoundedRect(target.x - target.w / 2 - 6, target.y - target.h / 2 - 6, target.w + 12, target.h + 12, 16);
    }
  }

  private tutorialTarget(): { x: number; y: number; w: number; h: number } | null {
    const save = saveStore.get();
    const city = save.city;
    if (city.job) return null;
    if (throneLevel(city) === 0) return { ...getPlot('thron'), ...PLOT_SIZE.throne };
    if (buildingLevel(city, 'bogenmacher') === 0) {
      const free = PLOTS.find((p) => p.kind === 'inner' && isPlotUnlocked(city, p) && !city.plots[p.id]);
      return free ? { ...free, ...PLOT_SIZE.inner } : null;
    }
    if (save.stats.nightsWon === 0 && save.stats.defeats === 0) return { x: 1180, y: 300, w: 176, h: 78 };
    return null;
  }

  private renderHint(): void {
    this.hint?.destroy();
    this.hint = null;
    const text = cityTutorialHint(saveStore.get());
    if (!text) return;
    const box = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT - 20).setDepth(40);
    const label = addText(this, 0, 0, text, 17, { origin: [0.5, 0.5], align: 'center', wrap: 980 });
    box.add([this.add.rectangle(0, 0, label.width + 32, label.height + 10, 0x000000, 0.8).setStrokeStyle(2, 0xfacc15), label]);
    this.hint = box;
  }

  private toast(text: string, color: string = COLORS.gold): void {
    const y = 100 + (this.toastCount++ % 4) * 44;
    const box = this.add.container(GAME_WIDTH / 2, y).setDepth(900);
    const label = addText(this, 0, 0, text, 19, { origin: [0.5, 0.5], color, wrap: 900, align: 'center' });
    box.add([this.add.rectangle(0, 0, label.width + 36, label.height + 14, 0x0b0d1a, 0.92).setStrokeStyle(2, 0xc9a24a), label]);
    box.setAlpha(0);
    this.tweens.add({ targets: box, alpha: 1, duration: 200 });
    this.tweens.add({ targets: box, alpha: 0, delay: 2600, duration: 400, onComplete: () => box.destroy() });
  }

  // ================================================================ Fenster (Modal)

  private closePanel(): void {
    this.panel?.outer.destroy();
    this.panel = null;
  }

  private openModal(w: number, h: number, title: string, reopen: () => void): Panel {
    this.closePanel();
    const x = (GAME_WIDTH - w) / 2;
    const y = Math.max(HUD_H + 4, (GAME_HEIGHT - h) / 2 + 10);
    const root = this.add.container(0, 0).setDepth(MODAL_DEPTH);
    const shield = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setInteractive();
    shield.on('pointerup', () => this.closePanel());
    root.add(shield);
    const inner = this.add.container(x, y);
    const g = this.add.graphics();
    drawPanel(g, 0, 0, w, h, { border: 0xc9a24a });
    inner.add(g);
    inner.add(this.add.zone(w / 2, h / 2, w, h).setInteractive());
    inner.add(addText(this, 24, 18, title, 26));
    inner.add(new Button(this, w - 34, 32, 52, 44, 'X', () => this.closePanel(), { color: COLORS.danger, fontSize: 20 }));
    root.add(inner);
    const panel: Panel = { root: inner, outer: root, updaters: [], reopen };
    this.panel = panel;
    return panel;
  }

  /** Kosten als Reihe von Symbolen; rot, wenn es nicht reicht. Gibt die Breite zurück. */
  private costRow(parent: Phaser.GameObjects.Container, x: number, y: number, cost: Partial<Resources>, size = 15): number {
    const have = saveStore.get().resources;
    let cx = x;
    for (const id of RESOURCE_IDS) {
      const v = cost[id];
      if (!v) continue;
      parent.add(this.add.image(cx + 9, y, RESOURCES[id].icon).setScale(0.42));
      const t = addText(this, cx + 20, y, String(v), size, { origin: [0, 0.5], color: have[id] >= v ? COLORS.text : COLORS.bad });
      parent.add(t);
      cx += 28 + t.width;
    }
    return cx - x;
  }

  private row(parent: Phaser.GameObjects.Container, x: number, y: number, w: number, o: RowOptions): void {
    const g = this.add.graphics();
    g.fillStyle(0x1f1b2b, o.dim ? 0.6 : 1);
    g.fillRoundedRect(x, y, w, ROW_H - 6, 10);
    parent.add(g);
    const icon = this.add.image(x + 34, y + (ROW_H - 6) / 2, o.icon).setAlpha(o.dim ? 0.5 : 1);
    icon.setScale(Math.min(1.1, 46 / Math.max(icon.width, icon.height)));
    parent.add(icon);
    const title = addText(this, x + 66, y + 8, o.title, 18, { color: o.dim ? COLORS.muted : COLORS.text });
    parent.add(title);
    if (o.badge) parent.add(addText(this, x + 74 + title.width, y + 10, o.badge, 15, { color: COLORS.gold }));
    // Rechts: Kosten (oben), Hinweis (darunter), Knopf ganz rechts
    const right = 330;
    const btnW = 104;
    parent.add(addText(this, x + 66, y + 34, o.description, 14, { bold: false, wrap: w - 66 - right - 8, color: o.dim ? COLORS.muted : COLORS.text }));
    if (o.cost) this.costRow(parent, x + w - right, y + 20, o.cost);
    if (o.reason) parent.add(addText(this, x + w - right, y + 40, o.reason, 13, { color: COLORS.bad, wrap: right - btnW - 20 }));
    const bx = x + w - btnW / 2 - 8;
    if (o.status) parent.add(addText(this, bx, y + (ROW_H - 6) / 2, o.status, 15, { origin: [0.5, 0.5], color: COLORS.good, align: 'center', wrap: btnW }));
    if (o.button) {
      parent.add(new Button(this, bx, y + (ROW_H - 6) / 2, btnW, 48, o.button.label, o.button.onClick, {
        enabled: o.button.enabled, fontSize: 15,
      }));
    }
  }

  // ================================================================ Bauplatz antippen

  private openPlot(plotId: string): void {
    const save = saveStore.get();
    const plot = getPlot(plotId);
    if (!isPlotUnlocked(save.city, plot)) return this.openLockedPlot(plot);
    const state = save.city.plots[plot.id];
    if (state) return this.openBuilding(plot);
    if (save.city.job?.plotId === plot.id) return this.openConstruction(plot);
    this.openBuildChoice(plot);
  }

  private openLockedPlot(plot: PlotDef): void {
    const p = this.openModal(560, 260, 'Gesperrter Bauplatz', () => this.openLockedPlot(plot));
    const save = saveStore.get();
    p.root.add(addText(this, 24, 66, PLOT_KIND_LABELS[plot.kind], 18, { color: COLORS.muted }));
    p.root.add(addText(this, 24, 96, plotUnlockText(plot), 19, { bold: false, wrap: 510 }));
    if (plot.unlock.type === 'gold') {
      const check = canBuyPlot(save, plot);
      if (!check.ok && check.reason) p.root.add(addText(this, 24, 132, check.reason, 15, { color: COLORS.bad }));
      p.root.add(new Button(this, 280, 205, 300, 60, 'Freischalten', () => this.act((d) => buyPlot(d, plot.id), true), {
        subLabel: `${plot.unlock.cost} Gold`, enabled: check.ok, fontSize: 22,
      }));
    }
  }

  private openConstruction(plot: PlotDef): void {
    const save = saveStore.get();
    const job = save.city.job!;
    const def = getBuilding(job.id);
    const p = this.openModal(520, 220, `${def.name} wird gebaut`, () => this.openPlot(plot.id));
    const text = addText(this, 24, 80, '', 20, { bold: false });
    const g = this.add.graphics();
    p.root.add([text, g]);
    const update = () => {
      const j = saveStore.get().city.job;
      if (!j) return;
      const left = Math.max(0, Math.ceil((j.finishAt - Date.now()) / 1000));
      text.setText(`Fertig in ${left} s`);
      g.clear();
      g.fillStyle(0x000000, 0.6);
      g.fillRect(24, 130, 472, 18);
      g.fillStyle(0xfacc15, 1);
      g.fillRect(26, 132, 468 * jobProgress(j, Date.now()), 14);
    };
    update();
    p.updaters.push(update);
  }

  private openBuildChoice(plot: PlotDef): void {
    const save = saveStore.get();
    const options = buildingsForPlot(plot);
    const cardH = 74;
    const cols = options.length > 3 ? 2 : 1;
    const colW = cols === 2 ? 575 : 760;
    const w = cols * colW + (cols - 1) * 10 + 40;
    const rowsN = Math.ceil(options.length / cols);
    const h = 72 + rowsN * (cardH + 4) + 8;
    const p = this.openModal(w, h, `${PLOT_KIND_LABELS[plot.kind]}: Was soll hier entstehen?`, () => this.openPlot(plot.id));
    const seconds = Math.round(jobDuration(save.city) / 1000);
    options.forEach((def, i) => {
      const x = 20 + (i % cols) * (colW + 10);
      const y = 64 + Math.floor(i / cols) * (cardH + 4);
      this.buildCard(p.root, x, y, colW, cardH, plot, def, seconds);
    });
  }

  /** Kompakte Karte in der Bauauswahl: Symbol, Name, Text, Kosten und Knopf */
  private buildCard(parent: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, plot: PlotDef, def: BuildingDef, seconds: number): void {
    const save = saveStore.get();
    const check = canBuild(save, plot.id, def.id);
    const locked = !!check.reason?.startsWith('Noch gesperrt');
    const rivalDefs = rivals(def);
    const blocked = !!check.reason?.startsWith('Entweder-oder');
    const g = this.add.graphics();
    g.fillStyle(0x1f1b2b, locked ? 0.6 : 1);
    g.fillRoundedRect(x, y, w, h, 10);
    if (rivalDefs.length > 0) {
      g.lineStyle(2, blocked ? 0xef4444 : 0xf59e0b, 0.8);
      g.strokeRoundedRect(x, y, w, h, 10);
    }
    parent.add(g);
    const icon = this.add.image(x + 34, y + h / 2, def.icon).setAlpha(locked ? 0.5 : 1);
    icon.setScale(Math.min(1.1, 46 / Math.max(icon.width, icon.height)));
    parent.add(icon);
    const right = 150;
    const textW = w - 66 - right - 6;
    parent.add(addText(this, x + 66, y + 4, def.name, 16, { color: locked ? COLORS.muted : COLORS.text }));
    const towers = def.unlocksTowers?.map((t) => getTower(t).name).join(', ');
    let desc = towers ? `Türme: ${towers}. ${def.description.replace(/^Schaltet [^.:]*(:|\.)\s*/, '')}` : def.description;
    if (rivalDefs.length > 0) desc += ` ⚔ Entweder-oder mit: ${rivalDefs.map((b) => b.name).join(', ')}`;
    parent.add(addText(this, x + 66, y + 25, desc, 12, { bold: false, wrap: textW, color: locked ? COLORS.muted : COLORS.text }));
    const rx = x + w - right;
    if (locked) {
      parent.add(addText(this, rx, y + 10, buildingUnlockText(def), 12, { color: COLORS.muted, wrap: right - 10 }));
      parent.add(this.add.image(rx + right - 22, y + h - 22, 'icon_lock').setScale(0.5).setAlpha(0.7));
      return;
    }
    this.costRow(parent, rx, y + 14, def.levels[0], 13);
    if (!check.ok && check.reason) {
      parent.add(addText(this, rx, y + 30, check.reason, 11, { color: COLORS.bad, wrap: right - 8 }));
      return;
    }
    parent.add(new Button(this, rx + (right - 10) / 2, y + h - 26, right - 10, 38, `Bauen (${seconds} s)`, () => {
      this.act((d) => startBuild(d, plot.id, def.id, Date.now()), true);
    }, { fontSize: 15 }));
  }

  // ================================================================ Gebäude-Fenster

  private openBuilding(plot: PlotDef): void {
    const save = saveStore.get();
    const state = save.city.plots[plot.id];
    const def = getBuilding(state.building);
    const p = this.openModal(1000, 600, '', () => this.openPlot(plot.id));
    const root = p.root;
    const maxLevel = def.levels.length;

    // Linke Spalte: Gebäude und Ausbau
    const icon = this.add.image(58, 70, def.icon);
    icon.setScale(Math.min(1.6, 70 / Math.max(icon.width, icon.height)));
    root.add(icon);
    root.add(addText(this, 106, 40, def.name, 26));
    root.add(addText(this, 106, 74, `Stufe ${state.level} von ${maxLevel}`, 17, { color: COLORS.gold }));
    root.add(addText(this, 24, 112, def.description, 15, { bold: false, wrap: 272 }));
    const effects = this.effectLines(def, state.level, save);
    root.add(addText(this, 24, 196, 'Wirkt jetzt:', 16, { color: COLORS.gold }));
    root.add(addText(this, 24, 220, effects.join('\n') || '–', 14, { bold: false, wrap: 272 }));

    const g = this.add.graphics();
    g.fillStyle(0x1f1b2b, 1);
    g.fillRoundedRect(16, 420, 290, 164, 10);
    root.add(g);
    const job = save.city.job;
    if (job?.kind === 'upgrade' && job.plotId === plot.id) {
      const text = addText(this, 30, 440, '', 17, { wrap: 260 });
      root.add(text);
      const update = () => {
        const j = saveStore.get().city.job;
        if (j) text.setText(`Ausbau auf Stufe ${state.level + 1} läuft …\nFertig in ${Math.max(0, Math.ceil((j.finishAt - Date.now()) / 1000))} s`);
      };
      update();
      p.updaters.push(update);
    } else if (state.level >= maxLevel) {
      root.add(addText(this, 30, 440, 'Maximale Stufe erreicht.', 17, { color: COLORS.good }));
    } else {
      const cost = levelCost(def, state.level)!;
      const check = canUpgradeBuilding(save, plot.id);
      root.add(addText(this, 30, 432, `Ausbau auf Stufe ${state.level + 1}`, 17));
      const next = this.levelGainText(def);
      root.add(addText(this, 30, 456, next, 13, { bold: false, wrap: 262, color: COLORS.muted }));
      this.costRow(root, 30, 498, cost);
      if (!check.ok && check.reason) root.add(addText(this, 30, 518, check.reason, 13, { color: COLORS.bad, wrap: 262 }));
      root.add(new Button(this, 161, 556, 262, 44, `Ausbauen (${Math.round(jobDuration(save.city) / 1000)} s)`, () => {
        this.act((d) => startUpgradeBuilding(d, plot.id, Date.now()), true);
      }, { enabled: check.ok, fontSize: 17 }));
    }

    // Rechte Spalte: Upgrades bzw. Forschung
    const rx = 322;
    const rw = 660;
    const tree = (Object.keys(RESEARCH_TREES) as ResearchTree[]).find((t) => RESEARCH_TREES[t].building === def.id);
    if (tree) {
      // Universität / Magiergilde: Knopf zum Baum
      const done = RESEARCH.filter((r) => r.tree === tree && save.city.research.includes(r.id)).length;
      const total = RESEARCH.filter((r) => r.tree === tree).length;
      root.add(new Button(this, rx + rw - 140, 30, 280, 50, `${RESEARCH_TREES[tree].name} öffnen`, () => this.openTree(tree), {
        color: RESEARCH_TREES[tree].color, fontSize: 18, subLabel: `${done}/${total} erforscht`,
      }));
    }
    if (def.upgrades.length === 0 && tree) {
      root.add(addText(this, rx, 22, 'Forschung', 22, { color: COLORS.gold }));
    } else if (def.upgrades.length > 0) {
      root.add(addText(this, rx, 22, 'Verbesserungen', 22, { color: COLORS.gold }));
      def.upgrades.slice(0, 6).forEach((u, i) => {
        const rank = upgradeRank(save.city, u.id);
        const check = canBuyUpgrade(save, def, u);
        const maxed = rank >= u.maxRank;
        this.row(root, rx, 60 + i * 86, rw, {
          icon: u.icon,
          title: u.name,
          badge: `${rank}/${u.maxRank}`,
          description: u.description,
          cost: maxed ? undefined : check.cost,
          reason: maxed || check.ok ? undefined : check.reason,
          status: maxed ? 'Maximal' : undefined,
          button: maxed ? undefined : { label: 'Kaufen', enabled: check.ok, onClick: () => this.act((d) => buyUpgrade(d, def.id, u.id)) },
        });
      });
    } else {
      root.add(addText(this, rx, 22, 'Dieses Gebäude wirkt über seine Stufe.', 18, { color: COLORS.muted }));
    }
  }

  /** Was das Gebäude auf dieser Stufe bewirkt. */
  private effectLines(def: BuildingDef, level: number, save: SaveData): string[] {
    const lines: string[] = [];
    if (def.unlocksTowers) {
      const mods = new Modifiers(cityModifiers(save.city));
      for (const id of def.unlocksTowers) {
        const t = getTower(id);
        const limit = Math.round(mods.apply('towerLimit', t.baseLimit, t.tags));
        const maxLvl = Math.min(t.levels.length, Math.round(mods.apply('towerMaxLevel', t.baseMaxLevel, t.tags)));
        lines.push(`${t.name}: ${limit}× pro Nacht, bis Stufe ${maxLvl}`);
      }
    }
    if (def.levelModifiers) lines.push(...describeModifiersCompact(scaleModifiers(def.levelModifiers, level)));
    if (def.income) {
      for (const id of RESOURCE_IDS) {
        const v = def.income[id];
        if (v) lines.push(`+${v * level} ${RESOURCES[id].name} nach jedem Kampf`);
      }
    }
    if (def.id === 'thronsaal') lines.push('Höhere Stufen: neue Bauplätze, Universität ab Stufe 2');
    if (def.id === 'universitaet') lines.push(`Forschungsbaum bis Stufe ${level}`);
    if (def.id === 'akademie') lines.push(`Magiebaum bis Stufe ${level}`);
    const rivalDefs = rivals(def);
    if (rivalDefs.length > 0) lines.push(`Entweder-oder: ${rivalDefs.map((b) => b.name).join(', ')} kann nicht gebaut werden`);
    return lines;
  }

  private levelGainText(def: BuildingDef): string {
    const parts: string[] = [];
    if (def.levelModifiers) parts.push(...describeModifiersCompact(def.levelModifiers));
    if (def.income) {
      for (const id of RESOURCE_IDS) if (def.income[id]) parts.push(`+${def.income[id]} ${RESOURCES[id].name} pro Kampf`);
    }
    parts.push(def.upgrades.length > 0 ? 'schaltet höhere Upgrades frei' : '');
    if (def.id === 'universitaet' || def.id === 'akademie') parts.push('neue Forschungen im Baum');
    if (def.id === 'thronsaal') parts.push('neue Bauplätze');
    return parts.filter(Boolean).join(' · ');
  }

  // ================================================================ Forschungsbaum & Magiebaum

  private openTree(tree: ResearchTree, selectedId?: string): void {
    const save = saveStore.get();
    const info = RESEARCH_TREES[tree];
    const nodes = RESEARCH.filter((r) => r.tree === tree);
    const p = this.openModal(1240, 640, `${info.name} – ${getBuilding(info.building).name}`, () => this.openTree(tree, selected?.id));
    const root = p.root;
    const job = researchJob(save.city, tree);
    let selected: ResearchDef | undefined = selectedId ? getResearch(selectedId) : undefined;
    selected ??= nodes.find((r) => r.id === job?.id) ?? nodes.find((r) => researchStatus(save, r).status === 'available') ?? nodes[0];
    root.add(addText(this, 24, 50, 'Tippe einen Knoten an. Linien zeigen, was vorher erforscht sein muss.', 14, { color: COLORS.muted, bold: false }));

    const nodeW = 170;
    const nodeH = 70;
    const pos = (r: ResearchDef) => ({ x: 30 + r.col * 205, y: 84 + r.row * 106 });
    const colors: Record<string, number> = { done: 0x22c55e, running: info.color, available: 0xfacc15, locked: 0x6b7280 };

    // Verbindungslinien
    const lines = this.add.graphics();
    root.add(lines);
    for (const r of nodes) {
      for (const req of r.requires) {
        const from = pos(getResearch(req));
        const to = pos(r);
        const done = save.city.research.includes(req);
        lines.lineStyle(4, done ? 0x22c55e : 0x4b5563, done ? 0.9 : 0.7);
        const x1 = from.x + nodeW;
        const y1 = from.y + nodeH / 2;
        const x2 = to.x;
        const y2 = to.y + nodeH / 2;
        const mx = (x1 + x2) / 2;
        lines.beginPath();
        lines.moveTo(x1, y1);
        lines.lineTo(mx, y1);
        lines.lineTo(mx, y2);
        lines.lineTo(x2, y2);
        lines.strokePath();
      }
    }

    // Knoten
    for (const r of nodes) {
      const { x, y } = pos(r);
      const st = researchStatus(save, r).status;
      const c = this.add.container(x, y);
      const g = this.add.graphics();
      g.fillStyle(st === 'locked' ? 0x1a1724 : 0x2a2440, 1);
      g.fillRoundedRect(0, 0, nodeW, nodeH, 12);
      g.lineStyle(selected?.id === r.id ? 5 : 3, selected?.id === r.id ? 0xffffff : colors[st], 1);
      g.strokeRoundedRect(0, 0, nodeW, nodeH, 12);
      c.add(g);
      const icon = this.add.image(32, nodeH / 2, r.icon).setAlpha(st === 'locked' ? 0.45 : 1);
      icon.setScale(Math.min(1, 40 / Math.max(icon.width, icon.height)));
      c.add(icon);
      c.add(addText(this, 60, 14, r.name, 15, { fit: nodeW - 64, color: st === 'locked' ? COLORS.muted : COLORS.text }));
      const label = { done: '✔ Erforscht', running: 'Läuft …', available: 'Verfügbar', locked: 'Gesperrt' }[st];
      c.add(addText(this, 60, nodeH - 22, label, 12, { color: hex(colors[st]) }));
      const zone = this.add.zone(nodeW / 2, nodeH / 2, nodeW, nodeH).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => this.openTree(tree, r.id));
      c.add(zone);
      root.add(c);
    }

    // Detailbereich rechts
    if (!selected) return;
    const dx = 850;
    const dw = 370;
    const g = this.add.graphics();
    g.fillStyle(0x1f1b2b, 1);
    g.fillRoundedRect(dx, 84, dw, 530, 12);
    root.add(g);
    const r = selected;
    const st = researchStatus(save, r);
    const icon = this.add.image(dx + 44, 128, r.icon);
    icon.setScale(Math.min(1.4, 60 / Math.max(icon.width, icon.height)));
    root.add(icon);
    root.add(addText(this, dx + 86, 104, r.name, 22, { wrap: dw - 96 }));
    root.add(addText(this, dx + 86, 140, `Braucht ${getBuilding(info.building).name} Stufe ${r.requiredLevel}`, 13, { color: COLORS.muted }));
    let y = 178;
    const desc = addText(this, dx + 18, y, r.description, 16, { bold: false, wrap: dw - 36 });
    root.add(desc);
    y += desc.height + 12;
    const effects: string[] = [];
    if (r.unlocksBuilding) effects.push(`Neues Gebäude: ${getBuilding(r.unlocksBuilding).name}`);
    if (r.unlocksTowers) effects.push(`Neuer Turm: ${r.unlocksTowers.map((t) => getTower(t).name).join(', ')}`);
    if (r.modifiers) effects.push(...describeModifiersCompact(r.modifiers));
    if (effects.length) {
      const t = addText(this, dx + 18, y, effects.map((e) => `• ${e}`).join('\n'), 14, { color: '#86efac', wrap: dw - 36 });
      root.add(t);
      y += t.height + 12;
    }
    if (r.requires.length) {
      const t = addText(this, dx + 18, y, `Voraussetzung: ${r.requires.map((id) => getResearch(id).name).join(', ')}`, 13, { color: COLORS.muted, wrap: dw - 36 });
      root.add(t);
      y += t.height + 12;
    }
    if (st.status === 'done') {
      root.add(addText(this, dx + dw / 2, 560, 'Bereits erforscht', 20, { origin: [0.5, 0.5], color: COLORS.good }));
      return;
    }
    if (st.status === 'running') {
      const text = addText(this, dx + 18, 500, '', 17);
      const bar = this.add.graphics();
      root.add([text, bar]);
      const update = () => {
        const j = researchJob(saveStore.get().city, tree);
        if (!j) return;
        text.setText(`Wird erforscht … noch ${Math.max(0, Math.ceil((j.finishAt - Date.now()) / 1000))} s`);
        bar.clear();
        bar.fillStyle(0x000000, 0.6);
        bar.fillRect(dx + 18, 534, dw - 36, 16);
        bar.fillStyle(info.color, 1);
        bar.fillRect(dx + 20, 536, (dw - 40) * jobProgress(j, Date.now()), 12);
      };
      update();
      p.updaters.push(update);
      return;
    }
    this.costRow(root, dx + 18, 486, r.cost, 16);
    const check = canStartResearch(save, r.id);
    if (!check.ok && check.reason) root.add(addText(this, dx + 18, 506, check.reason, 13, { color: COLORS.bad, wrap: dw - 36 }));
    const seconds = Math.round(jobDuration(save.city) / 1000);
    root.add(new Button(this, dx + dw / 2, 570, dw - 36, 54, `Forschen (${seconds} s)`, () => {
      this.act((d) => startResearch(d, r.id, Date.now()));
    }, { enabled: check.ok, fontSize: 20, color: info.color }));
  }

  // ================================================================ Nacht-Vorschau

  private openNight(): void {
    const save = saveStore.get();
    const night = save.night;
    const rift = riftForNight(save.seed, night);
    const story = storyForNight(night);
    const p = this.openModal(680, 600, `Nacht ${night}`, () => this.openNight());
    const root = p.root;
    const portal = this.add.image(70, 120, `portal_${rift.id}`).setScale(0.6);
    root.add(portal);
    root.add(addText(this, 120, 70, 'Heute öffnet sich:', 15, { color: COLORS.muted }));
    root.add(addText(this, 120, 90, rift.name, 26, { color: hex(rift.color) }));
    root.add(addText(this, 120, 128, rift.description, 15, { bold: false, wrap: 530 }));
    let y = 190;
    if (story && !save.city.story.includes(story.id)) {
      const t = addText(this, 24, y, `Story: ${story.title}\n${story.intro}`, 16, { color: COLORS.gold, wrap: 630 });
      root.add(t);
      y += t.height + 10;
    }
    root.add(addText(this, 24, y, `Sondereffekt: ${rift.globalEffect.name} – ${rift.globalEffect.text}`, 15, { bold: false, wrap: 630 }));
    y += 46;
    const special = Object.values(rift.tiles).filter((t) => t.effectText).map((t) => t.effectText).join(' · ');
    root.add(addText(this, 24, y, `Besondere Felder: ${special}`, 15, { bold: false, wrap: 630 }));
    y += 46;
    const harvest = Object.values(rift.tiles).filter((t) => t.harvest);
    root.add(addText(this, 24, y, 'Rohstoffe zum Abbauen:', 15, { color: COLORS.gold }));
    let hx = 210;
    for (const t of harvest) {
      root.add(this.add.image(hx + 14, y + 10, `tile_${rift.id}_${t.id}`).setScale(0.38));
      hx += 40;
    }
    y += 40;
    root.add(addText(this, 24, y, 'Gegner:', 15, { color: COLORS.gold }));
    const ids = [...rift.enemies.normal, ...rift.enemies.fast, ...rift.enemies.tank, ...rift.enemies.air, ...rift.enemies.special, ...rift.enemies.boss];
    ids.forEach((id, i) => {
      const img = this.add.image(120 + i * 50, y + 12, `enemy_${id}`);
      img.setScale(Math.min(1, 40 / img.width));
      root.add(img);
      if (getEnemy(id).flying) root.add(this.add.image(136 + i * 50, y - 2, 'icon_air').setScale(0.4));
    });
    y += 44;
    const paths = pathCountForNight(save.seed, night);
    const towers = unlockedTowers(save.city).map((t) => getTower(t).name).join(', ') || 'keine';
    root.add(addText(this, 24, y, `${wavesForNight(night)} Wellen · ${paths === 1 ? '1 Weg' : `${paths} Wege`} · Deine Türme: ${towers}`, 15, {
      color: COLORS.muted, wrap: 630,
    }));
    const check = canStartNight(save.city);
    if (!check.ok && check.reason) root.add(addText(this, 24, 470, check.reason, 16, { color: COLORS.bad, wrap: 630 }));
    root.add(new Button(this, 340, 548, 400, 70, 'Verteidigen!', () => this.scene.start('Battle', { night }), {
      enabled: check.ok, fontSize: 30,
    }));
  }
}
