import Phaser from 'phaser';
import { BALANCE, COLS, GAME_HEIGHT, GAME_WIDTH, GATE_ROW, GATE_X, HUD_HEIGHT, MAP_X, MAP_Y, ROWS, TILE, WORLD_HEIGHT, WORLD_WIDTH } from '../config';
import { rollCards } from '../core/draft';
import { cityModifiers, towerSourceName, unlockedTowers } from '../core/city';
import { Modifiers } from '../core/modifiers';
import { cardModifiers, computeRewards, setupNight, type NightSetup } from '../core/progression';
import { Rng, randomSeed } from '../core/rng';
import { Route, simplifyPoints } from '../core/route';
import { saveStore } from '../core/save';
import { DEV_CRYSTALS } from '../core/dev';
import { RESOURCE_IDS, addResources, emptyResources, type GridPos, type Modifier, type Resources, type Vec } from '../core/types';
import type { WaveDef } from '../core/wavegen';
import type { CardDef } from '../data/cards';
import { getCard } from '../data/cards';
import { getEnemy, type EnemyAbility } from '../data/enemies';
import { KING, KING_MAX_LEVEL } from '../data/king';
import type { RiftDef, TileDef } from '../data/rifts';
import { RIFT_CRYSTAL } from '../data/resources';
import { getTower, type TowerDef, type TowerLevel } from '../data/towers';
import { GROUND_VARIANTS, shade, tileKey } from '../game/textures';
import { ads } from '../services/ads';
import { sfx, type SoundName } from '../services/sound';
import { showCardDraft } from '../ui/cardDraft';
import { riftBurst, warpIn, warpOut } from '../ui/warp';
import { COLORS, addText, floatText, pin, showDialog } from '../ui/widgets';
import { DropManager, type DropKind } from './drops';
import { Civilian, Enemy, FLY_HEIGHT, Projectile, Tower, type HitInfo, type TargetMode, type TowerStats } from './entities';
import { Hud, LOOT_PANEL } from './hud';
import { BattleMenus } from './menus';
import type { ResultData } from '../scenes/ResultScene';

export type Phase = 'build' | 'wave' | 'draft' | 'ended';

export const DEPTH = {
  tiles: 0,
  pathEdge: 1,
  range: 5,
  towers: 10,
  ground: 20,
  air: 50,
  hp: 55,
  proj: 60,
  fx: 70,
  wall: 80,
  king: 85,
  hud: 100,
  menu: 200,
  overlay: 1000,
};

/** Zustand zu Beginn einer Welle – für "Werbung ansehen: Welle wiederholen". */
interface Snapshot {
  crystals: number;
  gateHp: number;
  cards: string[];
  kingLevel: number;
  draftsDone: number;
  rerollsLeft: number;
  towers: { id: string; col: number; row: number; level: number; spent: number; targetMode: TargetMode }[];
}

interface Strike {
  t: number;
  x: number;
  y: number;
  damage: number;
  radius: number;
  /** Trifft auch Fluggegner (Pfeilhagel) */
  air?: boolean;
}

/** Giftwolke auf dem Boden */
interface Cloud {
  x: number;
  y: number;
  radius: number;
  dps: number;
  t: number;
  tick: number;
}

interface Beam {
  points: Vec[];
  color: number;
  t: number;
  width: number;
}

export type KingMode = 'home' | 'walking' | 'harvesting' | 'returning';

export interface KingStats {
  damage: number;
  attackSpeed: number;
  range: number;
  abilityDamage: number;
  abilityCooldown: number;
}

export class BattleScene extends Phaser.Scene {
  setup!: NightSetup;
  rift!: RiftDef;
  waves!: WaveDef[];
  routes: Route[] = [];
  airRoute!: Route;
  /** Alle Boni dieser Nacht: Stadt + Rift + Karten */
  mods = new Modifiers();
  private staticMods: Modifier[] = [];
  cards: string[] = [];
  /** Türme, die die Stadt freigeschaltet hat */
  availableTowers: string[] = [];
  /** Aktuelle Felder (abgebaute Rohstoffe werden zu Boden) */
  private tiles: string[][] = [];
  /** Entwicklermodus: mit dieser Welle beginnen */
  private startWaveDev = 1;
  /** Beim Start aus dem Rift hereinwarpen (Wechsel Tag → Nacht) */
  private warpOnStart = false;
  /** Mittellinie der Straßen (mit runden Kurven) */
  private roadLines: Vec[][] = [];
  private tileImages: Phaser.GameObjects.Image[][] = [];

  /** Rift-Kristalle: Währung im Kampf */
  crystals = 0;
  /** Gesammelte Beute für die Stadt */
  loot: Resources = emptyResources();
  private drops!: DropManager;
  gateHp = 0;
  gateMaxHp = 0;
  /** Anzahl geschaffter Wellen */
  waveIndex = 0;
  phase: Phase = 'build';
  /** Ausgang der Nacht – verhindert z. B. "Aufgeben" nach einem Sieg */
  outcome: 'open' | 'victory' | 'defeat' = 'open';
  speed = 1;
  paused = false;

  enemies: Enemy[] = [];
  towers: Tower[] = [];
  projectiles: Projectile[] = [];
  private towerAt: (Tower | null)[][] = [];
  private spawnQueue: { t: number; enemyId: string; route: number }[] = [];
  private waveTime = 0;
  private currentWave: WaveDef | null = null;

  kingLevel = 1;
  /** Platz des Königs vor dem Tor */
  readonly kingHome: Vec = { x: MAP_X - 6, y: MAP_Y + GATE_ROW * TILE + TILE / 2 - 30 };
  kingPos: Vec = { ...this.kingHome };
  kingMode: KingMode = 'home';
  /** Feld, das der König gerade abbauen soll */
  kingTarget: GridPos | null = null;
  harvestLeft = 0;
  harvestTotal = 1;
  private autoHarvestTimer = 0;
  private kingCooldown = 0;
  abilityCooldown = 0;
  abilityTargeting = false;
  private strikes: Strike[] = [];
  private clouds: Cloud[] = [];
  private beams: Beam[] = [];
  civilians: Civilian[] = [];
  /** Sturmläuten: zusätzliches Angriffstempo für alle Türme */
  private rallyBonus = 0;
  private rallyTimer = 0;
  /** Noch offene Karten zu Beginn der Nacht (Taverne) */
  private startDrafts = 0;
  /** Kamera ziehen: Startpunkt und ob gerade gezogen wird */
  private drag: { x: number; y: number; sx: number; sy: number; moved: boolean } | null = null;

  draftsDone = 0;
  rerollsLeft = 0;
  private snapshots: Snapshot[] = [];
  private adUsed = false;
  kills = 0;
  private rng = new Rng(1);

  private hpGfx!: Phaser.GameObjects.Graphics;
  private fxGfx!: Phaser.GameObjects.Graphics;
  rangeGfx!: Phaser.GameObjects.Graphics;
  private gateFlash!: Phaser.GameObjects.Rectangle;
  private kingSprite!: Phaser.GameObjects.Image;
  hud!: Hud;
  menus!: BattleMenus;
  private tutorialStep = -1;
  private tutorialBox: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('Battle');
  }

  /** Phaser verwendet die Szene wieder – deshalb hier alles zurücksetzen. */
  init(data: { night?: number; warp?: boolean; startWave?: number }): void {
    const save = saveStore.get();
    this.warpOnStart = !!data.warp;
    this.startWaveDev = data.startWave ?? 1;
    this.setup = setupNight(save.seed, data.night ?? save.night);
    this.rift = this.setup.rift;
    this.waves = this.setup.waves;
    this.staticMods = [...cityModifiers(save.city), ...this.rift.globalEffect.modifiers];
    this.availableTowers = unlockedTowers(save.city);
    this.tiles = this.setup.map.tiles.map((row) => [...row]);
    this.tileImages = [];
    this.cards = BALANCE.cardsPersistAcrossNights ? [...save.cards] : [];
    this.recomputeMods();
    this.crystals = Math.round(this.mods.apply('startCrystals', BALANCE.startCrystals + BALANCE.startCrystalsPerNight * (this.setup.night - 1)));
    this.loot = emptyResources();
    this.gateHp = this.gateMaxHp;
    this.waveIndex = 0;
    this.phase = 'build';
    this.outcome = 'open';
    this.speed = save.settings.speed || 1;
    this.paused = false;
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.towerAt = Array.from({ length: ROWS }, () => Array<Tower | null>(COLS).fill(null));
    this.spawnQueue = [];
    this.waveTime = 0;
    this.currentWave = null;
    this.kingLevel = 1;
    this.kingPos = { ...this.kingHome };
    this.kingMode = 'home';
    this.kingTarget = null;
    this.harvestLeft = 0;
    this.autoHarvestTimer = BALANCE.autoHarvestSeconds / 2;
    this.kingCooldown = 0;
    this.abilityCooldown = 0;
    this.abilityTargeting = false;
    this.strikes = [];
    this.clouds = [];
    this.beams = [];
    this.civilians = [];
    this.rallyBonus = 0;
    this.rallyTimer = 0;
    this.startDrafts = Math.floor(this.mods.flat('startCards'));
    this.drag = null;
    this.draftsDone = 0;
    this.rerollsLeft = Math.floor(this.mods.flat('cardRerolls'));
    this.snapshots = [];
    this.adUsed = false;
    this.kills = 0;
    this.rng = new Rng(randomSeed());
    this.tutorialStep = this.setup.night === 1 && !save.settings.tutorialDone ? 0 : -1;
    this.tutorialBox = null;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#05060d');
    this.buildRoutes();
    this.drawMap();
    this.drawWall();
    this.rangeGfx = this.add.graphics().setDepth(DEPTH.range);
    this.hpGfx = this.add.graphics().setDepth(DEPTH.hp);
    this.fxGfx = this.add.graphics().setDepth(DEPTH.fx);
    this.kingSprite = this.add.image(this.kingPos.x, this.kingPos.y, 'king').setDepth(DEPTH.king);

    this.setupCamera();
    this.hud = new Hud(this);
    this.drops = new DropManager(this, DEPTH.fx + 5, (kind) => this.dropTarget(kind), (kind, amount) => this.creditDrop(kind, amount));
    this.menus = new BattleMenus(this);
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('wheel', (_p: unknown, _o: unknown, dx: number, dy: number) => {
      this.cameras.main.scrollX += dx;
      this.cameras.main.scrollY += dy;
    });
    // Entwicklermodus: Nacht ab einer späteren Welle beginnen
    if (this.startWaveDev > 1) this.waveIndex = Math.min(this.waves.length - 1, this.startWaveDev - 1);
    this.hud.setPreview(this.waves[this.waveIndex]);
    this.showTutorial();
    if (this.warpOnStart) warpIn(this, this.rift.color, 1100, () => this.banner(`Nacht ${this.setup.night}`, this.rift.name, this.rift.color));
    else this.banner(`Nacht ${this.setup.night}`, this.rift.name, this.rift.color);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.drops.flushAll());
    const story = this.setup.story;
    if (story && !saveStore.get().city.story.includes(story.id)) {
      this.paused = true;
      showDialog(this, story.title, story.intro, [{ label: 'Zur Verteidigung!', onClick: () => { this.paused = false; this.nextStartDraft(); } }], { titleColor: COLORS.gold });
    } else {
      this.nextStartDraft();
    }
  }

  update(_time: number, deltaMs: number): void {
    if (saveStore.get().settings.dev.infinite) this.crystals = Math.max(this.crystals, DEV_CRYSTALS);
    const dt = Math.min(deltaMs / 1000, 0.05);
    if (!this.paused && this.phase !== 'ended' && this.phase !== 'draft') {
      // Bei 2×/3× Tempo mehrere kleine Schritte statt eines großen (genauere Treffer)
      for (let i = 0; i < this.speed; i++) this.step(dt);
    }
    this.drawOverlay(dt);
    this.hud.refresh();
    this.menus.tick();
  }

  // ================================================================ Aufbau

  private buildRoutes(): void {
    const center = (p: GridPos): Vec => ({ x: MAP_X + p.col * TILE + TILE / 2, y: MAP_Y + p.row * TILE + TILE / 2 });
    const gate: Vec = { x: GATE_X, y: MAP_Y + GATE_ROW * TILE + TILE / 2 };
    const spawnX = MAP_X + COLS * TILE + 26;
    // Laufweg mit runden Kurven – genau dort, wo auch die Straße gezeichnet wird
    this.roadLines = this.setup.map.paths.map((path) => {
      const pts = path.map(center);
      return smoothCorners(straightenStairs(simplifyPoints([{ x: spawnX, y: pts[0].y }, ...pts, gate])), TILE / 2);
    });
    this.routes = this.roadLines.map((pts) => new Route(pts));
    const start = this.setup.map.paths[0][0];
    this.airRoute = new Route([{ x: spawnX, y: center(start).y }, gate]);
  }

  private drawMap(): void {
    const { tiles, paths } = this.setup.map;
    // Laufrichtung je Wegfeld (für Förderbänder o. Ä.)
    const direction = new Map<string, number>();
    for (const path of paths) {
      path.forEach((p, i) => {
        const next = path[i + 1] ?? { col: p.col - 1, row: p.row };
        direction.set(`${p.col},${p.row}`, Math.atan2(next.row - p.row, next.col - p.col));
      });
    }
    for (let row = 0; row < ROWS; row++) {
      this.tileImages.push([]);
      for (let col = 0; col < COLS; col++) {
        const tile = this.tileAt(col, row);
        const img = this.add.image(MAP_X + col * TILE + TILE / 2, MAP_Y + row * TILE + TILE / 2, this.tileTexture(col, row, tiles[row][col]))
          .setDepth(tile.path && tiles[row][col] !== 'path' ? DEPTH.pathEdge + 0.5 : DEPTH.tiles);
        // Texturen zeigen nach links (Winkel π) – passend zur Laufrichtung drehen
        if (tile.deco === 'conveyor') img.setRotation((direction.get(`${col},${row}`) ?? Math.PI) - Math.PI);
        this.tileImages[row].push(img);
      }
    }
    this.drawRoads();
    // Portale am Wegbeginn
    const starts = new Set(this.setup.map.paths.map((p) => p[0].row));
    for (const row of starts) {
      const y = MAP_Y + row * TILE + TILE / 2;
      const portal = this.add.image(WORLD_WIDTH - 14, y, `portal_${this.rift.id}`).setDepth(DEPTH.wall).setScale(0.75);
      const swirl = this.add.image(WORLD_WIDTH - 14, y, 'portal_swirl').setDepth(DEPTH.wall).setScale(0.55).setTint(this.rift.color);
      this.tweens.add({ targets: swirl, angle: 360, duration: 4000, repeat: -1 });
      this.tweens.add({ targets: portal, scale: 0.82, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  /**
   * Straßen als weiche Linien über dem Boden: Rand, Belag und ein paar Steinchen.
   * Einmal in ein Bild gezeichnet (Canvas), damit es auf dem Handy nicht jedes Bild neu berechnet wird.
   */
  private drawRoads(): void {
    const key = 'roads';
    if (this.textures.exists(key)) this.textures.remove(key);
    const tex = this.textures.createCanvas(key, WORLD_WIDTH, WORLD_HEIGHT);
    if (!tex) return;
    const ctx = tex.getContext();
    const color = this.rift.tiles.path.color;
    const width = TILE * 0.8;
    const rgb = (c: number, a = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
    const stroke = (w: number, style: string) => {
      ctx.lineWidth = w;
      ctx.strokeStyle = style;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (const line of this.roadLines) {
        ctx.beginPath();
        ctx.moveTo(line[0].x, line[0].y);
        for (const p of line.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    };
    stroke(width + 10, rgb(shade(color, -0.45), 0.55));
    stroke(width, rgb(color));
    stroke(width * 0.35, rgb(shade(color, 0.08), 0.5)); // hellere Mitte (festgetretene Spur)
    const rng = new Rng(this.setup.seed ^ 0x5eed);
    for (const line of this.roadLines) {
      for (const p of densify(line, 14)) {
        ctx.fillStyle = rgb(shade(color, rng.next() < 0.5 ? 0.22 : -0.22), 0.5);
        ctx.beginPath();
        ctx.ellipse(p.x + (rng.next() - 0.5) * width * 0.75, p.y + (rng.next() - 0.5) * width * 0.75, rng.float(1.5, 3.5), rng.float(1, 2.2), rng.next() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    tex.refresh();
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(DEPTH.pathEdge);
  }

  private drawWall(): void {
    const g = this.add.graphics().setDepth(DEPTH.wall);
    const gateY = MAP_Y + GATE_ROW * TILE + TILE / 2;
    // Stadt hinter der Mauer
    g.fillStyle(0x0d0f1c, 1);
    g.fillRect(0, MAP_Y, 72, WORLD_HEIGHT - MAP_Y);
    const roofs = [0x5b2a2a, 0x3d3a5c, 0x4a3b2a];
    for (let i = 0; i < ROWS; i++) {
      const y = MAP_Y + 18 + i * 72;
      const x = 8 + (i % 2) * 18;
      g.fillStyle(0x2a2633, 1);
      g.fillRect(x, y + 14, 34, 30);
      g.fillStyle(roofs[i % 3], 1);
      g.fillTriangle(x - 4, y + 16, x + 17, y - 4, x + 38, y + 16);
      g.fillStyle(0xfcd34d, 0.85);
      g.fillRect(x + 6, y + 22, 7, 8);
      g.fillRect(x + 21, y + 22, 7, 8);
    }
    // Mauer
    g.fillStyle(0x6b6f7a, 1);
    g.fillRect(72, MAP_Y, 44, WORLD_HEIGHT - MAP_Y);
    g.lineStyle(1, 0x3f434b, 1);
    for (let y = MAP_Y; y < WORLD_HEIGHT; y += 16) {
      g.lineBetween(72, y, 116, y);
      const off = ((y - MAP_Y) / 16) % 2 ? 11 : 0;
      for (let x = 72 + off; x < 116; x += 22) g.lineBetween(x, y, x, y + 16);
    }
    g.fillStyle(0x7d828e, 1);
    for (let y = MAP_Y + 4; y < WORLD_HEIGHT; y += 24) g.fillRect(114, y, 10, 14);
    // Tor
    g.fillStyle(0x1a1208, 1);
    g.fillRoundedRect(70, gateY - 34, 50, 68, { tl: 24, tr: 24, bl: 0, br: 0 });
    g.fillStyle(0x7a4a24, 1);
    g.fillRoundedRect(76, gateY - 28, 38, 62, { tl: 18, tr: 18, bl: 0, br: 0 });
    g.lineStyle(3, 0x3b2412, 1);
    for (const y of [gateY - 12, gateY + 12]) g.lineBetween(76, y, 114, y);
    g.lineBetween(95, gateY - 28, 95, gateY + 34);
    this.gateFlash = this.add.rectangle(95, gateY + 3, 44, 66, 0xff0000, 0).setDepth(DEPTH.wall + 1);
  }

  // ================================================================ Eingabe

  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.setZoom(1).setRotation(0);
    cam.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    // Start: Tor in der Mitte des sichtbaren Bereichs (unter der Leiste)
    const gateY = MAP_Y + GATE_ROW * TILE + TILE / 2;
    cam.setScroll(0, gateY - (HUD_HEIGHT + GAME_HEIGHT) / 2);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (over.length > 0) return;
    const cam = this.cameras.main;
    this.drag = { x: pointer.x, y: pointer.y, sx: cam.scrollX, sy: cam.scrollY, moved: false };
  }

  /** Karte mit dem Finger verschieben */
  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.drag || !pointer.isDown) return;
    const dx = pointer.x - this.drag.x;
    const dy = pointer.y - this.drag.y;
    if (!this.drag.moved && Math.hypot(dx, dy) < 12) return;
    this.drag.moved = true;
    const cam = this.cameras.main;
    cam.setScroll(cam.clampX(this.drag.sx - dx), cam.clampY(this.drag.sy - dy));
  }

  /** Bildschirmposition → Kartenposition */
  toWorld(sx: number, sy: number): Vec {
    const cam = this.cameras.main;
    return { x: sx + cam.scrollX, y: sy + cam.scrollY };
  }

  /** Verschiebt die Kamera, sodass das Feld sichtbar ist, und gibt dessen Bildschirmposition zurück (für Tests). */
  focusCell(cell: GridPos): Vec {
    const c = this.cellCenter(cell);
    const cam = this.cameras.main;
    // Grenzen sofort anwenden (Phaser macht das sonst erst beim nächsten Bild)
    cam.setScroll(cam.clampX(c.x - GAME_WIDTH / 2), cam.clampY(c.y - (HUD_HEIGHT + GAME_HEIGHT) / 2));
    return { x: c.x - cam.scrollX, y: c.y - cam.scrollY };
  }

  private onPointerUp(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    const dragged = this.drag?.moved;
    this.drag = null;
    if (dragged) return; // war ein Verschieben, kein Tippen
    if (over.length > 0) return; // Knopf oder Menü wurde getroffen
    if (this.phase === 'ended' || this.phase === 'draft' || this.paused) return;
    if (pointer.y < HUD_HEIGHT) return;
    const { x, y } = this.toWorld(pointer.x, pointer.y);

    if (this.abilityTargeting) {
      if (this.inMap(x, y)) this.castAbility(x, y);
      else this.setAbilityTargeting(false);
      return;
    }
    if (Math.hypot(x - this.kingPos.x, y - this.kingPos.y) < 40) {
      this.menus.openKing();
      return;
    }
    const cell = this.toCell(x, y);
    if (!cell) {
      this.menus.close();
      return;
    }
    const tower = this.towerAt[cell.row][cell.col];
    const tile = this.tileAt(cell.col, cell.row);
    if (tower) this.menus.openTower(tower);
    else if (tile.buildable) this.menus.openBuild(cell);
    else if (tile.harvest) this.menus.openHarvest(cell);
    else {
      this.menus.close();
      const c = this.cellCenter(cell);
      floatText(this, c.x, c.y - 10, tile.effectText ?? tile.name, COLORS.text, 16);
    }
  }

  // ================================================================ Hilfen

  /** Boden bekommt eine von mehreren Varianten, damit kein Raster sichtbar ist */
  private tileTexture(col: number, row: number, id: string): string {
    if (id === 'path') id = 'ground'; // die Straße wird darüber gezeichnet (drawRoads)
    if (id !== 'ground') return tileKey(this.rift.id, id);
    const v = Math.abs((col * 73856093) ^ (row * 19349663) ^ this.setup.seed) % GROUND_VARIANTS;
    return v === 0 ? tileKey(this.rift.id, id) : `${tileKey(this.rift.id, id)}_${v}`;
  }

  tileAt(col: number, row: number): TileDef {
    return this.rift.tiles[this.tiles[row][col]];
  }

  toCell(x: number, y: number): GridPos | null {
    const col = Math.floor((x - MAP_X) / TILE);
    const row = Math.floor((y - MAP_Y) / TILE);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    return { col, row };
  }

  cellCenter(c: GridPos): Vec {
    return { x: MAP_X + c.col * TILE + TILE / 2, y: MAP_Y + c.row * TILE + TILE / 2 };
  }

  inMap(x: number, y: number): boolean {
    return x >= MAP_X && x < MAP_X + COLS * TILE && y >= MAP_Y && y < MAP_Y + ROWS * TILE;
  }

  towerCost(level: TowerLevel): number {
    return Math.round(level.cost * Math.max(0.3, 1 + this.mods.pct('towerCost')));
  }

  /** Wie viele Türme dieser Art darf man bauen? */
  towerLimit(def: TowerDef): number {
    return Math.max(0, Math.round(this.mods.apply('towerLimit', def.baseLimit, def.tags)));
  }

  towerCount(def: TowerDef): number {
    return this.towers.filter((t) => t.def.id === def.id).length;
  }

  /** Bis zu welcher Stufe darf man diesen Turm verbessern? */
  towerMaxLevel(def: TowerDef): number {
    return Math.min(def.levels.length, Math.max(1, Math.round(this.mods.apply('towerMaxLevel', def.baseMaxLevel, def.tags))));
  }

  /** Welches Gebäude schaltet diesen Turm frei? (für Hinweise) */
  towerSource(def: TowerDef): string {
    return towerSourceName(def.id);
  }

  recomputeMods(): void {
    this.mods = new Modifiers([...this.staticMods, ...cardModifiers(this.cards)]);
    this.gateMaxHp = Math.round(this.mods.apply('gateMaxHp', BALANCE.gateHp));
    for (const t of this.towers) t.stats = this.computeTowerStats(t.def, t.level, t.tile);
  }

  computeTowerStats(def: TowerDef, level: number, tile: TileDef): TowerStats {
    const lvl = def.levels[level - 1];
    const tags = def.tags;
    const m = this.mods.clone().add(...(tile.towerModifiers ?? []));
    // 'damage' wirkt auf beide Schadensarten, 'physDamage'/'magicDamage' nur auf eine
    const dmgMul = Math.max(0, 1 + m.pct('damage', tags));
    return {
      physDamage: lvl.physDamage > 0 ? m.apply('physDamage', lvl.physDamage, tags) * dmgMul : 0,
      magicDamage: lvl.magicDamage > 0 ? m.apply('magicDamage', lvl.magicDamage, tags) * dmgMul : 0,
      attackSpeed: Math.max(0.05, m.apply('attackSpeed', lvl.attackSpeed, tags)),
      range: m.apply('range', lvl.range, tags) * TILE,
      critChance: Math.min(1, m.apply('critChance', lvl.critChance, tags)),
      critDamage: m.apply('critDamage', lvl.critDamage, tags),
      maxMana: Math.max(1, m.apply('maxMana', lvl.mana, tags)),
      manaRegen: m.apply('manaRegen', lvl.manaRegen, tags),
      poisonDps: lvl.poison ? m.apply('poisonDamage', lvl.poison.dps, tags) * dmgMul : 0,
      poisonDuration: lvl.poison?.duration ?? 0,
      knockback: lvl.knockback ? m.apply('knockback', lvl.knockback, tags) * TILE : 0,
      silence: lvl.silence ?? 0,
      aura: lvl.aura ? m.apply('auraStrength', lvl.aura, tags) : 0,
      gatherers: lvl.gatherers ? Math.round(m.apply('gatherers', lvl.gatherers, tags)) : 0,
      crystalIncome: lvl.crystalIncome ? m.apply('mineIncome', lvl.crystalIncome, tags) : 0,
      projectiles: def.attack === 'projectile' ? Math.max(1, Math.round(m.apply('projectiles', 1, tags))) : 1,
      splash: lvl.splashRadius ? m.apply('splashRadius', lvl.splashRadius, tags) * TILE : 0,
      slowStrength: lvl.slow ? Math.min(0.85, m.apply('slowStrength', lvl.slow.strength, tags)) : 0,
      slowDuration: lvl.slow?.duration ?? 0,
      chain: lvl.chainTargets !== undefined ? Math.round(m.apply('chainTargets', lvl.chainTargets, tags)) : 0,
      armorPen: Math.min(1, m.flat('armorPen', tags)),
      airMul: 1 + m.pct('airDamage', tags),
      projectileSpeed: m.apply('projectileSpeed', def.projectile.speed, tags) * TILE,
    };
  }

  kingStats(): KingStats {
    const l = this.kingLevel - 1;
    return {
      damage: this.mods.apply('kingDamage', KING.damage * (1 + KING.perLevel.damage * l)),
      attackSpeed: this.mods.apply('kingAttackSpeed', KING.attackSpeed * (1 + KING.perLevel.attackSpeed * l)),
      range: this.mods.apply('kingRange', KING.range + KING.perLevel.range * l) * TILE,
      abilityDamage: this.mods.apply('kingAbilityDamage', KING.ability.damage * (1 + 0.2 * l)),
      abilityCooldown: Math.max(5, this.mods.apply('kingAbilityCooldown', KING.ability.cooldown)),
    };
  }

  // ================================================================ Bauen

  tryBuild(towerId: string, cell: GridPos): boolean {
    if (this.phase === 'ended' || this.towerAt[cell.row][cell.col]) return false;
    const tile = this.tileAt(cell.col, cell.row);
    if (!tile.buildable) return false;
    const def = getTower(towerId);
    const cost = this.towerCost(def.levels[0]);
    const c = this.cellCenter(cell);
    if (!this.availableTowers.includes(def.id)) return false;
    if (this.towerCount(def) >= this.towerLimit(def)) {
      floatText(this, c.x, c.y, `Höchstens ${this.towerLimit(def)} – mehr im Gebäude ${this.towerSource(def)}`, COLORS.bad, 16);
      return false;
    }
    if (this.crystals < cost) {
      floatText(this, c.x, c.y, 'Nicht genug Rift-Kristalle', COLORS.bad);
      sfx.play('error');
      return false;
    }
    this.crystals -= cost;
    const tower = new Tower(this, def, cell.col, cell.row, c.x, c.y, tile, DEPTH.towers);
    // Der Turm kommt aus einem kleinen Rift
    riftBurst(this, c.x, c.y + 4, this.rift.color, 90, 650, DEPTH.towers - 1);
    for (const img of [tower.base, tower.top]) {
      img.setScale(0).setAlpha(0);
      this.tweens.add({ targets: img, scale: 1, alpha: 1, duration: 380, delay: 160, ease: 'Back.easeOut' });
    }
    sfx.play('build');
    tower.spent = cost;
    tower.stats = this.computeTowerStats(def, 1, tile);
    if (def.targetMode) tower.targetMode = def.targetMode;
    tower.mana = tower.stats.maxMana * Math.min(1, this.mods.flat('startMana'));
    if (def.attack === 'none') tower.top.setRotation(-Math.PI / 2);
    this.towers.push(tower);
    this.towerAt[cell.row][cell.col] = tower;
    if (this.tutorialStep === 0) this.advanceTutorial();
    return true;
  }

  upgradeTower(t: Tower): boolean {
    if (t.level >= this.towerMaxLevel(t.def)) return false;
    const cost = this.towerCost(t.def.levels[t.level]);
    if (this.crystals < cost) {
      floatText(this, t.x, t.y, 'Nicht genug Rift-Kristalle', COLORS.bad);
      sfx.play('error');
      return false;
    }
    this.crystals -= cost;
    t.spent += cost;
    t.setLevel(t.level + 1);
    t.stats = this.computeTowerStats(t.def, t.level, t.tile);
    this.ringFx(t.x, t.y, 0xfacc15, 0.7);
    sfx.play('upgrade');
    return true;
  }

  sellValue(t: Tower): number {
    return Math.round(t.spent * BALANCE.sellRefund);
  }

  sellTower(t: Tower): void {
    sfx.play('sell');
    this.crystals += this.sellValue(t);
    floatText(this, t.x, t.y, `+${this.sellValue(t)}`, RIFT_CRYSTAL.color);
    this.towerAt[t.row][t.col] = null;
    this.towers = this.towers.filter((x) => x !== t);
    this.removeCivilians((c) => c.home === t);
    t.destroy();
  }

  kingUpgradeCost(): number | null {
    if (this.kingLevel >= KING_MAX_LEVEL) return null;
    return Math.round(KING.upgradeCosts[this.kingLevel - 1] * Math.max(0.3, 1 + this.mods.pct('towerCost')));
  }

  upgradeKing(): boolean {
    const cost = this.kingUpgradeCost();
    if (cost === null) return false;
    if (this.crystals < cost) {
      floatText(this, this.kingPos.x + 40, this.kingPos.y, 'Nicht genug Rift-Kristalle', COLORS.bad);
      return false;
    }
    this.crystals -= cost;
    this.kingLevel++;
    this.ringFx(this.kingPos.x, this.kingPos.y, 0xfacc15, 0.8);
    return true;
  }

  // ================================================================ Wellen

  startWave(): void {
    if (this.phase !== 'build') return;
    this.menus.close();
    this.snapshots[this.waveIndex] = this.makeSnapshot();
    const wave = this.waves[this.waveIndex];
    this.currentWave = wave;
    this.spawnQueue = [];
    for (const g of wave.groups) {
      for (let i = 0; i < g.count; i++) this.spawnQueue.push({ t: g.delay + i * g.interval, enemyId: g.enemyId, route: g.route });
    }
    this.spawnQueue.sort((a, b) => a.t - b.t);
    this.waveTime = 0;
    this.phase = 'wave';
    const sub = wave.isBoss ? 'Ein Boss kommt!' : wave.hasAir ? 'Achtung: Fluggegner!' : '';
    sfx.play('waveStart');
    this.banner(`Welle ${wave.number}`, sub, wave.isBoss ? 0xef4444 : wave.hasAir ? 0x7dd3fc : 0xf3e6c4);
    if (this.tutorialStep === 1) this.advanceTutorial();
  }

  private onWaveCleared(): void {
    this.waveIndex++;
    const bonus = BALANCE.waveClearCrystalsBase + BALANCE.waveClearCrystalsPerWave * this.waveIndex;
    const interest = Math.min(50, Math.floor(this.crystals * this.mods.flat('interest')));
    this.crystals += bonus + interest;
    sfx.play('waveClear');
    floatText(this, GAME_WIDTH / 2, MAP_Y + 140, `Welle geschafft! +${bonus + interest} Rift-Kristalle`, RIFT_CRYSTAL.color, 26, true);
    const heal = Math.floor(this.mods.flat('gateRegen'));
    if (heal > 0 && this.gateHp < this.gateMaxHp) {
      this.gateHp = Math.min(this.gateMaxHp, this.gateHp + heal);
      floatText(this, GAME_WIDTH / 2, MAP_Y + 180, `Tor +${heal}`, COLORS.good, 22, true);
    }
    this.removeCivilians((c) => c.temporary);
    this.rallyTimer = 0;
    this.clouds = [];
    this.currentWave = null;

    if (this.waveIndex >= this.waves.length) {
      this.victory();
      return;
    }
    this.hud.setPreview(this.waves[this.waveIndex]);
    if (this.tutorialStep === 2 && this.waveIndex >= 2) this.advanceTutorial();
    if (this.waveIndex % BALANCE.cardEveryWaves === 0) this.openDraft();
    else this.phase = 'build';
  }

  openDraft(): void {
    this.phase = 'draft';
    sfx.play('cards');
    this.menus.close();
    const luck = this.luck() + this.draftsDone; // spätere Karten werden besser
    const tags = new Set(this.availableTowers.flatMap((id) => getTower(id).tags));
    const roll = () => rollCards(this.rng, this.cards, luck, 3, tags);
    showCardDraft(this, {
      cards: roll(),
      owned: this.cards,
      rerolls: this.rerollsLeft,
      onReroll: () => {
        this.rerollsLeft--;
        return roll();
      },
      onPick: (card) => this.pickCard(card),
    });
    if (this.tutorialStep === 3) this.advanceTutorial();
  }

  pickCard(card: CardDef): void {
    this.cards.push(card.id);
    this.draftsDone++;
    if (card.instant?.crystals) this.crystals += card.instant.crystals;
    if (card.instant?.heal) this.gateHp = Math.min(this.gateMaxHp, this.gateHp + card.instant.heal);
    this.recomputeMods();
    this.phase = 'build';
    this.nextStartDraft();
  }

  /** Karten zu Beginn der Nacht (Taverne) nacheinander anbieten */
  private nextStartDraft(): void {
    if (this.startDrafts <= 0 || this.waveIndex > 0 || this.phase !== 'build') return;
    this.startDrafts--;
    this.openDraft();
  }

  /** Glück: aus Stadt, Forschung, Karten */
  luck(): number {
    return this.mods.flat('luck');
  }

  private makeSnapshot(): Snapshot {
    return {
      crystals: this.crystals,
      gateHp: this.gateHp,
      cards: [...this.cards],
      kingLevel: this.kingLevel,
      draftsDone: this.draftsDone,
      rerollsLeft: this.rerollsLeft,
      towers: this.towers.map((t) => ({ id: t.def.id, col: t.col, row: t.row, level: t.level, spent: t.spent, targetMode: t.targetMode })),
    };
  }

  private restoreSnapshot(s: Snapshot): void {
    this.drops.flushAll();
    this.removeCivilians(() => true);
    this.clouds = [];
    this.rallyTimer = 0;
    for (const e of this.enemies) e.destroy();
    for (const p of this.projectiles) p.destroy();
    for (const t of this.towers) t.destroy();
    this.enemies = [];
    this.projectiles = [];
    this.towers = [];
    this.strikes = [];
    this.towerAt = Array.from({ length: ROWS }, () => Array<Tower | null>(COLS).fill(null));
    this.cards = [...s.cards];
    this.recomputeMods();
    this.crystals = s.crystals;
    this.gateHp = s.gateHp;
    this.kingLevel = s.kingLevel;
    this.draftsDone = s.draftsDone;
    this.rerollsLeft = s.rerollsLeft;
    for (const st of s.towers) {
      if (!this.tileAt(st.col, st.row).buildable) continue;
      const def = getTower(st.id);
      const c = this.cellCenter(st);
      const tile = this.tileAt(st.col, st.row);
      const t = new Tower(this, def, st.col, st.row, c.x, c.y, tile, DEPTH.towers);
      t.setLevel(st.level);
      t.spent = st.spent;
      t.targetMode = st.targetMode;
      t.stats = this.computeTowerStats(def, st.level, tile);
      this.towers.push(t);
      this.towerAt[st.row][st.col] = t;
    }
    this.spawnQueue = [];
    this.currentWave = null;
    this.phase = 'build';
    this.hud.setPreview(this.waves[this.waveIndex]);
  }

  // ================================================================ Spielschritt

  private step(dt: number): void {
    if (this.phase === 'wave') {
      this.waveTime += dt;
      while (this.spawnQueue.length > 0 && this.spawnQueue[0].t <= this.waveTime) {
        const s = this.spawnQueue.shift()!;
        this.spawnEnemy(s.enemyId, s.route, 0, this.currentWave?.hpMultiplier ?? 1);
      }
    }
    this.updateEnemies(dt);
    if (this.phase === 'ended') return;
    this.updateTowers(dt);
    this.updateKing(dt);
    this.updateProjectiles(dt);
    this.updateStrikes(dt);
    this.updateClouds(dt);
    this.updateCivilians(dt);
    this.updateAutoHarvest(dt);
    if (this.rallyTimer > 0) this.rallyTimer -= dt;
    this.abilityCooldown = Math.max(0, this.abilityCooldown - dt);
    if (this.phase === 'wave' && this.spawnQueue.length === 0 && this.enemies.length === 0) this.onWaveCleared();
  }

  spawnEnemy(enemyId: string, routeIndex: number, startDist: number, waveHpMult: number, route?: Route): Enemy {
    const def = getEnemy(enemyId);
    const r = route ?? (def.flying || routeIndex < 0 ? this.airRoute : this.routes[routeIndex] ?? this.routes[0]);
    const e = new Enemy(this, def, r, {
      waveHpMult,
      hpMod: Math.max(0.1, 1 + this.mods.pct('enemyHp')),
      speedMul: Math.max(0.2, 1 + this.mods.pct('enemySpeed')),
      armorAdd: this.mods.flat('enemyArmor'),
      startDist,
    }, def.flying ? DEPTH.air : DEPTH.ground + (def.boss ? 1 : 0));
    this.enemies.push(e);
    return e;
  }

  private updateEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.sinceHit += dt;
      if (e.slowTimer > 0 && (e.slowTimer -= dt) <= 0) e.slowFactor = 1;
      if (e.boostTimer > 0 && (e.boostTimer -= dt) <= 0) e.boostFactor = 1;
      if (e.silenced > 0) e.silenced -= dt;
      if (e.frozen > 0) e.frozen -= dt;
      if (e.grounded > 0) e.grounded -= dt;
      // Gift wirkt über Zeit
      if (e.poisonTimer > 0) {
        e.poisonTimer -= dt;
        this.dotDamage(e, e.poisonDps * dt);
        if (e.poisonTimer <= 0) e.poisonDps = 0;
        if (!e.alive) continue;
      }
      const abilities = e.silenced > 0 ? [] : e.def.abilities ?? [];
      for (let i = 0; i < abilities.length; i++) {
        const a = abilities[i];
        if (a.type === 'shield') {
          if (e.sinceHit >= a.regenDelay && e.shield < e.maxShield) e.shield = Math.min(e.maxShield, e.shield + e.maxShield * 0.5 * dt);
        } else if ('interval' in a) {
          e.abilityTimers[i] -= dt;
          if (e.abilityTimers[i] <= 0) {
            e.abilityTimers[i] = a.interval;
            this.triggerAbility(e, a);
          }
        }
      }
      let tileFactor = 1;
      if (!e.flying) {
        const cell = this.toCell(e.x, e.y);
        if (cell) tileFactor = this.tileAt(cell.col, cell.row).enemySpeedFactor ?? 1;
      }
      if (e.frozen <= 0) e.dist += e.speed * e.slowFactor * e.boostFactor * tileFactor * TILE * dt;
      e.place();
      if (e.flash > 0) e.flash -= dt;
      this.applyTint(e);
      if (e.dist >= e.route.length) this.reachGate(e);
    }
    if (this.enemies.some((e) => !e.alive)) this.enemies = this.enemies.filter((e) => e.alive);
  }

  private applyTint(e: Enemy): void {
    if (e.flash > 0) e.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    else if (e.frozen > 0) e.sprite.setTint(0x7dd3fc).setTintMode(Phaser.TintModes.MULTIPLY);
    else if (e.poisonTimer > 0) e.sprite.setTint(0xa3e635).setTintMode(Phaser.TintModes.MULTIPLY);
    else if (e.silenced > 0) e.sprite.setTint(0xf0abfc).setTintMode(Phaser.TintModes.MULTIPLY);
    else if (e.slowFactor < 1) e.sprite.setTint(0x9fdcff).setTintMode(Phaser.TintModes.MULTIPLY);
    else if (e.boostFactor > 1) e.sprite.setTint(0xffb38a).setTintMode(Phaser.TintModes.MULTIPLY);
    else e.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
  }

  private triggerAbility(e: Enemy, a: EnemyAbility): void {
    switch (a.type) {
      case 'hack': {
        const r = a.radius * TILE;
        const targets = this.towers
          .filter((t) => t.disabled <= 0 && Math.hypot(t.x - e.x, t.y - e.y) <= r)
          .sort((p, q) => Math.hypot(p.x - e.x, p.y - e.y) - Math.hypot(q.x - e.x, q.y - e.y))
          .slice(0, a.maxTargets);
        for (const t of targets) {
          t.disabled = a.duration;
          t.setHacked(true);
          this.beams.push({ points: zigzag(e, t, this.rng), color: 0x4ade80, t: 0.35, width: 3 });
        }
        if (targets.length > 0) {
          floatText(this, e.x, e.y - 24, a.maxTargets > 1 ? 'EMP!' : 'Gehackt!', '#4ade80', 18);
          if (a.maxTargets > 1) this.ringFx(e.x, e.y, 0x4ade80, r / 60);
        }
        break;
      }
      case 'roar': {
        const r = a.radius * TILE;
        for (const o of this.enemies) {
          if (o.alive && Math.hypot(o.x - e.x, o.y - e.y) <= r) {
            o.boostFactor = Math.max(o.boostFactor, 1 + a.boost);
            o.boostTimer = Math.max(o.boostTimer, a.duration);
          }
        }
        this.ringFx(e.x, e.y, 0xfb923c, r / 60);
        break;
      }
      case 'spawner':
        if (!e.flying) this.spawnEnemy(a.enemy, 0, e.dist - 12, e.waveHpMult, e.route);
        break;
      case 'shield':
      case 'spawnOnDeath':
        break;
    }
  }

  private reachGate(e: Enemy): void {
    e.destroy();
    this.gateHp = Math.max(0, this.gateHp - e.def.gateDamage);
    this.cameras.main.shake(140, 0.005);
    sfx.play('gateHit');
    this.gateFlash.setFillStyle(0xff0000, 0.6);
    this.tweens.add({ targets: this.gateFlash, fillAlpha: 0, duration: 300 });
    floatText(this, 120, this.kingPos.y + 60, `−${e.def.gateDamage}`, COLORS.bad, 24);
    if (this.gateHp <= 0) this.defeat();
  }

  /** Gegner in Reichweite, sortiert nach Zielmodus. */
  findTargets(x: number, y: number, range: number, targets: { ground: boolean; air: boolean }, mode: TargetMode): Enemy[] {
    const list: Enemy[] = [];
    for (const e of this.enemies) {
      if (!e.alive || (e.flying ? !targets.air : !targets.ground)) continue;
      if (e.x > MAP_X + COLS * TILE) continue; // noch im Portal
      if (Math.hypot(e.x - x, e.y - y) <= range + e.def.radius * 0.5) list.push(e);
    }
    if (mode === 'first') list.sort((a, b) => a.remaining - b.remaining);
    else if (mode === 'strong') list.sort((a, b) => b.hp + b.shield - (a.hp + a.shield));
    else if (mode === 'dense') {
      // Gegner mit den meisten Nachbarn zuerst (für Flächenschaden)
      const crowd = new Map(list.map((e) => [e, list.filter((o) => Math.hypot(o.x - e.x, o.y - e.y) <= TILE * 1.2).length]));
      list.sort((a, b) => crowd.get(b)! - crowd.get(a)! || a.remaining - b.remaining);
    } else list.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    return list;
  }

  /** Schaden über Zeit (Gift, Wolken) – ohne Krit und Rüstung */
  private dotDamage(e: Enemy, amount: number): void {
    if (!e.alive || amount <= 0) return;
    e.hp -= amount;
    if (e.hp <= 0) this.killEnemy(e);
  }

  /** Aura-Bonus der Glockentürme für einen Turm (der stärkste zählt) */
  private auraBonus(t: Tower): number {
    let best = 0;
    for (const b of this.towers) {
      if (b === t || b.stats.aura <= 0 || b.disabled > 0) continue;
      if (Math.hypot(b.x - t.x, b.y - t.y) <= b.stats.range) best = Math.max(best, b.stats.aura);
    }
    return best;
  }

  private updateTowers(dt: number): void {
    for (const t of this.towers) {
      if (t.disabled > 0) {
        t.disabled -= dt;
        if (t.disabled <= 0) t.setHacked(false);
        continue;
      }
      // Mana füllt sich während der Wellen; bei vollem Mana Fähigkeit auslösen
      if (this.phase === 'wave') {
        t.mana = Math.min(t.stats.maxMana, t.mana + t.stats.manaRegen * dt);
        if (t.mana >= t.stats.maxMana) this.castTowerAbility(t);
        // Kristallmine fördert alle 5 Sekunden
        if (t.stats.crystalIncome > 0 && (t.incomeTimer += dt) >= 5) {
          t.incomeTimer -= 5;
          this.drops.spawn(t.x, t.y - 10, 'crystal', Math.round(t.stats.crystalIncome));
        }
      }
      if (t.def.attack === 'none') continue;
      t.cooldown -= dt * (1 + this.auraBonus(t) + (this.rallyTimer > 0 ? this.rallyBonus : 0));
      if (t.cooldown > 0) continue;
      const targets = this.findTargets(t.x, t.y, t.stats.range, t.def.targets, t.targetMode);
      if (targets.length === 0) continue;
      t.top.setRotation(Math.atan2(targets[0].y - t.y, targets[0].x - t.x));
      this.fireTower(t, targets);
      t.cooldown = 1 / t.stats.attackSpeed;
    }
  }

  /** Fähigkeit bei vollem Mana (Werte in data/towers.ts → ability, in der Toolbox änderbar). */
  private castTowerAbility(t: Tower): void {
    const refund = Math.min(0.9, this.mods.flat('abilityRefund'));
    t.mana = this.rng.chance(refund) ? t.stats.maxMana * 0.5 : 0;
    const a = t.def.ability;
    const power = Math.max(0.1, 1 + this.mods.pct('abilityPower', t.def.tags));
    const info = this.hitInfo(t);
    const inRange = (targets = t.def.targets) => this.findTargets(t.x, t.y, t.stats.range, targets, t.targetMode);
    let cast = true;
    switch (a.type) {
      case 'volley': {
        const targets = inRange();
        if (targets.length === 0) { cast = false; break; }
        for (let i = 0; i < Math.round(a.arrows * power); i++) {
          const target = targets[i % targets.length];
          this.projectiles.push(new Projectile(this, t.x, t.y - 4 + (i % 3) * 6 - 6, target, t.stats.projectileSpeed, info, t.def.projectile.style, DEPTH.proj));
        }
        break;
      }
      case 'bigshot': {
        const target = inRange()[0];
        if (!target) { cast = false; break; }
        const big = { ...info, physDamage: info.physDamage * a.damageMul * power, splash: info.splash * a.radiusMul };
        const p = new Projectile(this, t.x, t.y, target, t.stats.projectileSpeed * 0.8, big, t.def.projectile.style, DEPTH.proj);
        p.sprite.setScale(2.2);
        this.projectiles.push(p);
        break;
      }
      case 'storm': {
        const first = inRange()[0];
        if (!first) { cast = false; break; }
        this.chainLightning(t, first, { ...info, magicDamage: info.magicDamage * power }, a.targets, 1);
        break;
      }
      case 'freeze': {
        const targets = inRange();
        if (targets.length === 0) { cast = false; break; }
        for (const e of targets) e.frozen = Math.max(e.frozen, a.duration * power * (e.def.boss ? 0.5 : 1));
        this.ringFx(t.x, t.y, 0x7dd3fc, t.stats.range / 60);
        break;
      }
      case 'pierce': {
        const first = inRange()[0];
        if (!first) { cast = false; break; }
        // Linie vom Turm über das Ziel hinaus
        const ang = Math.atan2(first.y - t.y, first.x - t.x);
        const len = t.stats.range * 1.6;
        const end = { x: t.x + Math.cos(ang) * len, y: t.y + Math.sin(ang) * len };
        for (const e of this.enemies) {
          if (e.alive && (e.flying ? t.def.targets.air : t.def.targets.ground) && distToSegment(e, t, end) <= 30) {
            this.damageEnemy(e, { ...info, physDamage: info.physDamage * a.damageMul * power });
          }
        }
        this.beams.push({ points: [{ x: t.x, y: t.y }, end], color: 0xfdba74, t: 0.3, width: 5 });
        break;
      }
      case 'poisonCloud': {
        const target = this.findTargets(t.x, t.y, t.stats.range, t.def.targets, 'dense')[0];
        if (!target) { cast = false; break; }
        this.clouds.push({ x: target.x, y: target.y, radius: a.radius * TILE, dps: a.dps * power, t: a.duration, tick: 0 });
        break;
      }
      case 'rockRain': {
        const targets = inRange();
        if (targets.length === 0) { cast = false; break; }
        for (let i = 0; i < a.rocks; i++) {
          const e = this.rng.pick(targets);
          this.strikes.push({ t: 0.3 + i * 0.2, x: e.x, y: e.y, damage: info.physDamage * a.damageMul * power, radius: Math.max(info.splash, TILE * 0.8) });
          const rock = this.add.image(e.x, e.y - 220, 'proj_rock').setDepth(DEPTH.fx).setScale(1.6);
          this.tweens.add({ targets: rock, y: e.y, duration: 300 + i * 200, ease: 'Quad.easeIn', onComplete: () => rock.destroy() });
        }
        break;
      }
      case 'rally':
        this.rallyBonus = a.attackSpeed * power;
        this.rallyTimer = a.duration;
        for (const o of this.towers) if (o.def.attack !== 'none') this.ringFx(o.x, o.y, 0xfacc15, 0.5);
        break;
      case 'caravan':
        for (let i = 0; i < Math.round(a.civilians * power); i++) this.civilians.push(new Civilian(this, t, true, DEPTH.ground + 2));
        break;
      case 'motherlode':
        this.drops.spawn(t.x, t.y - 10, 'crystal', Math.round(a.crystals * power));
        break;
      case 'banish': {
        const targets = this.findTargets(t.x, t.y, t.stats.range, { ground: true, air: true }, 'first');
        for (const e of targets) {
          e.shield = 0;
          e.silenced = Math.max(e.silenced, a.duration * power);
        }
        this.ringFx(t.x, t.y, 0xf0abfc, t.stats.range / 60);
        break;
      }
      case 'tornado': {
        const targets = this.findTargets(t.x, t.y, t.stats.range, { ground: true, air: true }, 'first');
        for (const e of targets) {
          if (e.def.flying) e.grounded = Math.max(e.grounded, a.duration * power);
          else this.knockBack(e, a.knockback * TILE * power);
        }
        this.ringFx(t.x, t.y, 0x7dd3fc, t.stats.range / 60);
        break;
      }
    }
    if (!cast) {
      t.mana = t.stats.maxMana; // nichts in Reichweite: Mana bleibt voll
      return;
    }
    floatText(this, t.x, t.y - 34, a.name, '#93c5fd', 15);
    sfx.play('ability');
  }

  private knockBack(e: Enemy, px: number): void {
    e.dist = Math.max(0, e.dist - px * (e.def.boss ? 0.3 : 1));
    e.place();
  }

  private hitInfo(t: Tower): HitInfo {
    const s = t.stats;
    return {
      physDamage: s.physDamage,
      magicDamage: s.magicDamage,
      armorPen: s.armorPen,
      critChance: s.critChance,
      critDamage: s.critDamage,
      airMul: s.airMul,
      splash: s.splash,
      slowStrength: s.slowStrength,
      slowDuration: s.slowDuration,
      poisonDps: s.poisonDps,
      poisonDuration: s.poisonDuration,
      knockback: s.knockback,
      silence: s.silence,
    };
  }

  private fireTower(t: Tower, targets: Enemy[]): void {
    const info = this.hitInfo(t);
    sfx.play(t.def.attack === 'chain' ? 'zap' : SHOOT_SOUND[t.def.projectile.style] ?? 'shootArrow');
    if (t.def.attack === 'chain') {
      this.chainLightning(t, targets[0], info);
      return;
    }
    for (let i = 0; i < t.stats.projectiles; i++) {
      const target = targets[i % targets.length];
      const spread = i >= targets.length ? (i - targets.length + 1) * 8 : 0;
      const p = new Projectile(this, t.x, t.y - 4 + spread, target, t.stats.projectileSpeed, info, t.def.projectile.style, DEPTH.proj);
      this.projectiles.push(p);
    }
  }

  private chainLightning(t: Tower, first: Enemy, info: HitInfo, jumps = t.stats.chain, falloffStep = 0.75): void {
    const hit: Enemy[] = [first];
    let current = first;
    for (let i = 0; i < jumps; i++) {
      const next = this.enemies
        .filter((e) => e.alive && !e.flying && !hit.includes(e) && Math.hypot(e.x - current.x, e.y - current.y) <= TILE * 1.6)
        .sort((a, b) => Math.hypot(a.x - current.x, a.y - current.y) - Math.hypot(b.x - current.x, b.y - current.y))[0];
      if (!next) break;
      hit.push(next);
      current = next;
    }
    const pts: Vec[] = [{ x: t.x, y: t.y - 6 }];
    let falloff = 1;
    for (const e of hit) {
      pts.push({ x: e.x, y: e.y });
      this.damageEnemy(e, { ...info, physDamage: info.physDamage * falloff, magicDamage: info.magicDamage * falloff });
      falloff *= falloffStep;
    }
    for (let i = 1; i < pts.length; i++) {
      this.beams.push({ points: zigzag(pts[i - 1], pts[i], this.rng), color: 0xd8b4fe, t: 0.14, width: 3 });
    }
  }

  private updateKing(dt: number): void {
    this.moveKing(dt);
    this.kingCooldown -= dt;
    if (this.kingCooldown > 0 || this.kingMode === 'harvesting') return;
    const k = this.kingStats();
    const targets = this.findTargets(this.kingPos.x, this.kingPos.y, k.range, { ground: true, air: true }, 'first');
    if (targets.length === 0) return;
    const info: HitInfo = {
      physDamage: k.damage, magicDamage: 0, armorPen: this.mods.flat('armorPen'),
      critChance: Math.min(1, this.mods.apply('critChance', 0.05)), critDamage: this.mods.apply('critDamage', 1.5),
      airMul: 1, splash: 0, slowStrength: 0, slowDuration: 0,
    };
    this.projectiles.push(new Projectile(this, this.kingPos.x + 12, this.kingPos.y, targets[0], 10 * TILE, info, 'royal', DEPTH.proj));
    this.kingCooldown = 1 / k.attackSpeed;
  }

  /** Schickt den König zu einem Rohstoff-Feld. Dort baut er es ab und kehrt dann zum Tor zurück. */
  sendKing(cell: GridPos): boolean {
    if (!this.tileAt(cell.col, cell.row).harvest || this.phase === 'ended') return false;
    this.kingTarget = cell;
    this.kingMode = 'walking';
    this.menus.close();
    if (this.tutorialStep === 2) this.advanceTutorial();
    return true;
  }

  recallKing(): void {
    this.kingTarget = null;
    this.kingMode = this.isKingHome() ? 'home' : 'returning';
  }

  isKingHome(): boolean {
    return Math.hypot(this.kingPos.x - this.kingHome.x, this.kingPos.y - this.kingHome.y) < 2;
  }

  private moveKing(dt: number): void {
    const speed = BALANCE.kingMoveSpeed * TILE * Math.max(0.2, 1 + this.mods.pct('kingMoveSpeed'));
    if (this.kingMode === 'walking' && this.kingTarget) {
      const t = this.cellCenter(this.kingTarget);
      if (this.stepKingTowards(t.x, t.y - 8, speed * dt)) {
        if (!this.tileAt(this.kingTarget.col, this.kingTarget.row).harvest) {
          this.recallKing(); // wurde inzwischen von einem Sammler abgebaut
          return;
        }
        this.kingMode = 'harvesting';
        this.harvestTotal = BALANCE.harvestSeconds / Math.max(0.2, 1 + this.mods.pct('kingHarvestSpeed'));
        this.harvestLeft = this.harvestTotal;
      }
    } else if (this.kingMode === 'harvesting' && this.kingTarget) {
      this.harvestLeft -= dt;
      if (this.harvestLeft <= 0) {
        this.harvestCell(this.kingTarget);
        this.kingTarget = null;
        this.kingMode = 'returning';
      }
    } else if (this.kingMode === 'returning') {
      if (this.stepKingTowards(this.kingHome.x, this.kingHome.y, speed * dt)) this.kingMode = 'home';
    }
  }

  /** Bewegt den König; true = angekommen. */
  private stepKingTowards(x: number, y: number, maxStep: number): boolean {
    const dx = x - this.kingPos.x;
    const dy = y - this.kingPos.y;
    const d = Math.hypot(dx, dy);
    if (d <= maxStep) {
      this.kingPos = { x, y };
      return true;
    }
    this.kingPos = { x: this.kingPos.x + (dx / d) * maxStep, y: this.kingPos.y + (dy / d) * maxStep };
    if (Math.abs(dx) > 1) this.kingSprite.setFlipX(dx < 0);
    return false;
  }

  /** Baut ein Rohstoff-Feld ab: Beute fällt heraus, das Feld wird zu freiem Bauland. */
  harvestCell(cell: GridPos): void {
    const tile = this.tileAt(cell.col, cell.row);
    if (!tile.harvest) return;
    const c = this.cellCenter(cell);
    const mul = Math.max(0, 1 + this.mods.pct('harvestYield'));
    let offset = -10;
    for (const id of RESOURCE_IDS) {
      const v = tile.harvest[id];
      if (!v) continue;
      this.drops.spawn(c.x + offset, c.y, id, Math.max(1, Math.round(v * mul)));
      offset += 20;
    }
    this.tiles[cell.row][cell.col] = 'ground';
    sfx.play('harvest');
    this.tileImages[cell.row]?.[cell.col]?.setTexture(tileKey(this.rift.id, 'ground'));
    this.burstFx(c.x, c.y, 0xfde68a, 1.2);
  }

  /** Sammler aus dem Holzfäller bauen während der Wellen selbstständig ab. */
  private updateAutoHarvest(dt: number): void {
    const workers = Math.floor(this.mods.flat('autoHarvest'));
    if (workers <= 0 || this.phase !== 'wave') return;
    this.autoHarvestTimer -= dt;
    if (this.autoHarvestTimer > 0) return;
    this.autoHarvestTimer = BALANCE.autoHarvestSeconds / workers;
    const cells: GridPos[] = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (this.tileAt(col, row).harvest && !this.isReserved(col, row)) cells.push({ col, row });
      }
    }
    if (cells.length === 0) return;
    const cell = this.rng.pick(cells);
    const c = this.cellCenter(cell);
    floatText(this, c.x, c.y - 20, 'Sammler!', COLORS.good, 15);
    this.harvestCell(cell);
  }

  /** Ist das Feld schon Ziel des Königs oder eines Zivilisten? */
  private isReserved(col: number, row: number, except?: Civilian): boolean {
    if (this.kingTarget && this.kingTarget.col === col && this.kingTarget.row === row) return true;
    return this.civilians.some((c) => c !== except && c.target?.col === col && c.target.row === row);
  }

  // ================================================================ Zivilisten (Rift-Sammler)

  /** Zivilisten laufen während der Wellen zu Rohstoff-Feldern, bauen ab und kehren zurück. */
  private updateCivilians(dt: number): void {
    // Anzahl der festen Zivilisten an die Turmwerte anpassen
    for (const t of this.towers) {
      if (t.stats.gatherers <= 0) continue;
      const own = this.civilians.filter((c) => c.home === t && !c.temporary);
      for (let i = own.length; i < Math.floor(t.stats.gatherers); i++) this.civilians.push(new Civilian(this, t, false, DEPTH.ground + 2));
    }
    if (this.phase !== 'wave') return;
    const speed = BALANCE.civilianSpeed * TILE * Math.max(0.2, 1 + this.mods.pct('gatherSpeed'));
    const harvestTime = BALANCE.civilianHarvestSeconds / Math.max(0.2, 1 + this.mods.pct('gatherSpeed'));
    for (const c of this.civilians) {
      if (c.state === 'idle') {
        const cell = this.nearestHarvestCell(c);
        if (!cell) continue;
        c.target = cell;
        c.state = 'walking';
      }
      if (c.state === 'walking' && c.target) {
        if (!this.tileAt(c.target.col, c.target.row).harvest) {
          c.state = 'idle'; // jemand anderes war schneller
          c.target = null;
          continue;
        }
        const goal = this.cellCenter(c.target);
        if (this.stepCivilian(c, goal.x, goal.y + 10, speed * dt)) {
          c.state = 'harvesting';
          c.timer = harvestTime;
        }
      } else if (c.state === 'harvesting' && c.target) {
        c.timer -= dt;
        c.sprite.setAngle(Math.sin(this.time.now / 80) * 12);
        if (c.timer <= 0) {
          c.sprite.setAngle(0);
          if (this.tileAt(c.target.col, c.target.row).harvest) this.harvestCell(c.target);
          c.target = null;
          c.state = 'returning';
        }
      } else if (c.state === 'returning') {
        if (this.stepCivilian(c, c.home.x, c.home.y + 16, speed * dt)) c.state = 'idle';
      }
    }
  }

  private stepCivilian(c: Civilian, x: number, y: number, maxStep: number): boolean {
    const dx = x - c.x;
    const dy = y - c.y;
    const d = Math.hypot(dx, dy);
    if (d <= maxStep) {
      c.x = x;
      c.y = y;
    } else {
      c.x += (dx / d) * maxStep;
      c.y += (dy / d) * maxStep;
      if (Math.abs(dx) > 1) c.sprite.setFlipX(dx < 0);
    }
    c.sprite.setPosition(c.x, c.y + Math.sin(this.time.now / 100 + c.x) * 1.5);
    return d <= maxStep;
  }

  private nearestHarvestCell(c: Civilian): GridPos | null {
    let best: GridPos | null = null;
    let bestD = Infinity;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (!this.tileAt(col, row).harvest || this.isReserved(col, row, c)) continue;
        const p = this.cellCenter({ col, row });
        const d = Math.hypot(p.x - c.home.x, p.y - c.home.y);
        if (d < bestD) {
          bestD = d;
          best = { col, row };
        }
      }
    }
    return best;
  }

  private removeCivilians(pred: (c: Civilian) => boolean): void {
    for (const c of this.civilians) if (pred(c)) c.destroy();
    this.civilians = this.civilians.filter((c) => !pred(c));
  }

  /** Giftwolken: Schaden an Bodengegnern im Kreis */
  private updateClouds(dt: number): void {
    for (const cl of this.clouds) {
      cl.t -= dt;
      for (const e of this.enemies) {
        if (e.alive && !e.flying && Math.hypot(e.x - cl.x, e.y - cl.y) <= cl.radius) this.dotDamage(e, cl.dps * dt);
      }
    }
    this.clouds = this.clouds.filter((cl) => cl.t > 0);
  }

  /** Beute fliegt zur Anzeige – die liegt auf dem Bildschirm, die Beute in der Welt. */
  private dropTarget(kind: DropKind): Vec {
    const cam = this.cameras.main;
    if (kind === 'crystal') return { x: 232 + cam.scrollX, y: 36 + cam.scrollY };
    const i = RESOURCE_IDS.indexOf(kind);
    return { x: LOOT_PANEL.x + 18 + cam.scrollX, y: LOOT_PANEL.y + 34 + i * LOOT_PANEL.row + cam.scrollY };
  }

  private creditDrop(kind: DropKind, amount: number): void {
    sfx.play(kind === 'crystal' ? 'crystal' : 'gold');
    if (kind === 'crystal') this.crystals += amount;
    else this.loot[kind] += amount;
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      if (p.target?.alive) {
        p.tx = p.target.x;
        p.ty = p.target.y - (p.target.flying ? FLY_HEIGHT : 0);
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      const stepLen = p.speed * dt;
      if (d <= stepLen + 4) {
        this.impact(p);
        continue;
      }
      p.x += (dx / d) * stepLen;
      p.y += (dy / d) * stepLen;
      p.sprite.setPosition(p.x, p.y).setRotation(Math.atan2(dy, dx));
    }
    if (this.projectiles.some((p) => !p.alive)) this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  private impact(p: Projectile): void {
    const info = p.hit;
    if (info.splash > 0) {
      for (const e of this.enemies) {
        if (e.alive && !e.flying && Math.hypot(e.x - p.tx, e.y - p.ty) <= info.splash) {
          this.applyEffects(e, info);
          this.damageEnemy(e, info);
        }
      }
      this.burstFx(p.tx, p.ty, 0xf59e0b, info.splash / 30);
      sfx.play('explosion');
    } else if (p.target?.alive) {
      this.applyEffects(p.target, info);
      this.damageEnemy(p.target, info);
      if (info.slowStrength > 0) this.applySlow(p.target, info.slowStrength, info.slowDuration);
    }
    p.destroy();
  }

  /** Gift, Rückstoß und Bann eines Treffers */
  private applyEffects(e: Enemy, info: HitInfo): void {
    if (!e.alive) return;
    if (info.poisonDps && info.poisonDuration) {
      // Gift stapelt sich bis zu einer Obergrenze
      e.poisonDps = Math.min(info.poisonDps * BALANCE.poisonMaxStacks, e.poisonDps + info.poisonDps);
      e.poisonTimer = Math.max(e.poisonTimer, info.poisonDuration);
    }
    if (info.knockback) this.knockBack(e, info.knockback);
    if (info.silence) {
      e.shield = 0;
      e.silenced = Math.max(e.silenced, info.silence);
    }
  }

  private applySlow(e: Enemy, strength: number, duration: number): void {
    if (!e.alive) return;
    const s = e.def.boss ? strength * 0.5 : strength;
    e.slowFactor = Math.min(e.slowFactor, 1 - s);
    e.slowTimer = Math.max(e.slowTimer, duration);
  }

  damageEnemy(e: Enemy, info: HitInfo): void {
    if (!e.alive) return;
    // Normaler Schaden wird von Rüstung abgeschwächt, magischer nicht
    let dmg = info.physDamage * (1 - e.armor * (1 - info.armorPen)) + info.magicDamage;
    if (e.flying) dmg *= info.airMul;
    if (info.critChance > 0 && this.rng.chance(info.critChance)) {
      dmg *= info.critDamage;
      floatText(this, e.x, e.y - 20, 'Krit!', '#fde047', 14);
    }
    if (e.shield > 0) {
      const absorbed = Math.min(e.shield, dmg);
      e.shield -= absorbed;
      dmg -= absorbed;
    }
    e.hp -= dmg;
    e.sinceHit = 0;
    e.flash = 0.06;
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy): void {
    if (!e.alive) return;
    const crystals = Math.round(e.def.crystals * Math.max(0, 1 + this.mods.pct('crystalGain')) + this.mods.flat('crystalsPerKill'));
    this.kills++;
    this.drops.spawn(e.x, e.y, 'crystal', crystals);
    // Beute für die Stadt: manchmal Gold, Spezialgegner und Bosse bringen Ressourcen.
    // Glück erhöht die Chance auf Gold und seltene Funde.
    const lootMul = Math.max(0, 1 + this.mods.pct('lootGain'));
    const luck = this.luck();
    const goldChance = (BALANCE.goldDropChance + this.mods.flat('goldDropChance')) * (1 + luck * BALANCE.luckDropBonus);
    if (this.rng.chance(goldChance)) {
      this.drops.spawn(e.x + 8, e.y, 'gold', Math.max(1, Math.round((e.def.crystals / BALANCE.goldDropDivisor) * lootMul)));
    }
    const rareChance = BALANCE.rareDropBase + luck * BALANCE.rareDropPerLuck + this.mods.flat('rareDropChance');
    if (this.rng.chance(rareChance)) {
      this.drops.spawn(e.x, e.y - 10, 'magie', Math.max(1, Math.round(2 * lootMul)));
      this.drops.spawn(e.x + 12, e.y - 10, 'gold', Math.max(2, Math.round((e.def.crystals / 2) * lootMul)));
      floatText(this, e.x, e.y - 34, 'Seltener Fund!', '#4ade80', 16);
      sfx.play('rare');
    }
    for (const id of RESOURCE_IDS) {
      const v = e.def.loot?.[id];
      if (v) this.drops.spawn(e.x - 8, e.y, id, Math.round(v * lootMul));
    }
    this.burstFx(e.x, e.y, e.def.look.body, e.def.radius / 22);
    sfx.play(e.def.boss ? 'bossDeath' : 'death');
    e.destroy();
    for (const a of e.def.abilities ?? []) {
      if (a.type === 'spawnOnDeath') {
        for (let i = 0; i < a.count; i++) this.spawnEnemy(a.enemy, 0, e.dist - i * 10, e.waveHpMult, e.route);
      }
    }
  }

  // ================================================================ König: Pfeilhagel

  setAbilityTargeting(on: boolean): void {
    if (on && (this.abilityCooldown > 0 || this.phase === 'ended')) return;
    this.abilityTargeting = on;
    if (on) this.menus.close();
  }

  castAbility(x: number, y: number): void {
    const k = this.kingStats();
    this.abilityTargeting = false;
    this.abilityCooldown = k.abilityCooldown;
    const radius = KING.ability.radius * TILE;
    const hits = KING.ability.hits;
    sfx.play('arrowRain');
    for (let i = 0; i < hits; i++) this.strikes.push({ t: 0.25 + i * 0.25, x, y, damage: k.abilityDamage / hits, radius });
    // Pfeile regnen herab
    for (let i = 0; i < 14; i++) {
      const ox = (this.rng.next() - 0.5) * radius * 1.6;
      const oy = (this.rng.next() - 0.5) * radius * 1.6;
      const arrow = this.add.image(x + ox - 60, y + oy - 160, 'proj_arrow').setDepth(DEPTH.fx).setRotation(Math.atan2(160, 60));
      this.tweens.add({
        targets: arrow, x: x + ox, y: y + oy, duration: 260, delay: i * 45,
        onComplete: () => this.tweens.add({ targets: arrow, alpha: 0, duration: 200, onComplete: () => arrow.destroy() }),
      });
    }
    this.ringFx(x, y, 0xfacc15, radius / 60);
  }

  private updateStrikes(dt: number): void {
    for (const s of this.strikes) {
      s.t -= dt;
      if (s.t > 0) continue;
      for (const e of this.enemies) {
        if (e.alive && Math.hypot(e.x - s.x, e.y - s.y) <= s.radius) {
          this.damageEnemy(e, {
            physDamage: s.damage, magicDamage: 0, armorPen: 0.5, critChance: 0, critDamage: 1, airMul: 1, splash: 0, slowStrength: 0, slowDuration: 0,
          });
        }
      }
    }
    this.strikes = this.strikes.filter((s) => s.t > 0);
  }

  // ================================================================ Ende der Nacht

  private victory(): void {
    this.phase = 'ended';
    this.outcome = 'victory';
    this.drops.flushAll();
    const save = saveStore.get();
    const rewards = computeRewards({ night: this.setup.night, victory: true, loot: this.loot, city: save.city });
    const story = this.setup.story;
    const newStory = story && !save.city.story.includes(story.id) ? story : undefined;
    saveStore.update((d) => {
      addResources(d.resources, rewards.total);
      if (newStory) d.city.story.push(newStory.id);
      if (d.night === this.setup.night) d.night++;
      d.stats.nightsWon++;
      d.stats.bestNight = Math.max(d.stats.bestNight, this.setup.night);
      d.stats.enemiesKilled += this.kills;
      d.settings.tutorialDone = true;
      if (BALANCE.cardsPersistAcrossNights) d.cards = [...this.cards];
    });
    this.banner('Sieg!', 'Die Nacht ist überstanden', 0xfacc15);
    sfx.play('victory');
    this.time.delayedCall(1800, () => this.goToResult(true, rewards, newStory?.outro, newStory?.unlocksBuilding));
  }

  private defeat(): void {
    this.phase = 'ended';
    sfx.play('defeat');
    this.menus.close();
    this.setAbilityTargeting(false);
    const waveNo = this.waveIndex + 1;
    const buttons = [];
    if (!this.adUsed && this.snapshots[this.waveIndex]) {
      buttons.push({
        label: 'Werbung ansehen',
        subLabel: `Welle ${waveNo} wiederholen + ${BALANCE.adContinueCrystals} Rift-Kristalle`,
        color: COLORS.royal,
        onClick: () => {
          void ads.showRewarded(this).then((ok) => {
            if (!ok) return this.defeat();
            this.adUsed = true;
            this.restoreSnapshot(this.snapshots[this.waveIndex]);
            this.crystals += BALANCE.adContinueCrystals;
            floatText(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, `+${BALANCE.adContinueCrystals} Rift-Kristalle`, RIFT_CRYSTAL.color, 30);
          });
        },
      });
    }
    buttons.push({ label: 'Aufgeben', subLabel: `${Math.round(BALANCE.defeatLootFactor * 100)} % der Beute retten`, color: COLORS.danger, onClick: () => this.giveUp() });
    showDialog(this, 'Das Tor ist gefallen!', `Welle ${waveNo} von ${this.waves.length} hat die Stadt überrannt.`, buttons, { titleColor: COLORS.bad });
  }

  /** Nacht verloren/abgebrochen: Teilbelohnung, dann Ergebnis-Bildschirm. */
  giveUp(): void {
    if (this.outcome !== 'open') return;
    this.phase = 'ended';
    this.outcome = 'defeat';
    this.drops.flushAll();
    const save = saveStore.get();
    const rewards = computeRewards({ night: this.setup.night, victory: false, loot: this.loot, city: save.city });
    saveStore.update((d) => {
      addResources(d.resources, rewards.total);
      d.stats.defeats++;
      d.stats.enemiesKilled += this.kills;
    });
    this.goToResult(false, rewards);
  }

  private goToResult(victory: boolean, rewards: ResultData['rewards'], storyText?: string, unlockedBuilding?: string): void {
    const data: ResultData = {
      victory, night: this.setup.night, riftId: this.rift.id, wavesCleared: this.waveIndex,
      totalWaves: this.waves.length, kills: this.kills, rewards, storyText, unlockedBuilding,
    };
    // Die Nachtkarte wird zurück in den Rift gesaugt
    const cam = this.cameras.main;
    this.menus.close();
    warpOut(this, cam.scrollX + cam.width / 2, cam.scrollY + cam.height / 2, this.rift.color, () => this.scene.start('Result', data), 1000);
  }

  togglePause(): void {
    if (this.phase === 'ended' || this.phase === 'draft') return;
    this.paused = true;
    this.menus.close();
    showDialog(this, 'Pause', `Nacht ${this.setup.night} · ${this.rift.name}\nWelle ${Math.min(this.waveIndex + 1, this.waves.length)} von ${this.waves.length}`, [
      { label: 'Weiter', onClick: () => (this.paused = false) },
      { label: 'Nacht neu starten', color: COLORS.buttonAlt, onClick: () => this.scene.restart({ night: this.setup.night }) },
      { label: 'Aufgeben', subLabel: `${Math.round(BALANCE.defeatLootFactor * 100)} % der Beute retten`, color: COLORS.danger, onClick: () => this.giveUp() },
    ]);
  }

  cycleSpeed(): void {
    this.speed = this.speed >= 3 ? 1 : this.speed + 1;
    saveStore.update((d) => (d.settings.speed = this.speed));
  }

  // ================================================================ Anzeige

  private drawOverlay(dt: number): void {
    const g = this.hpGfx;
    g.clear();
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const boss = e.def.boss;
      if (e.hp >= e.maxHp && e.shield <= 0 && !boss) continue;
      const w = boss ? 64 : Math.max(26, e.def.radius * 2);
      const x = e.x - w / 2;
      const y = e.y - e.def.radius - (e.flying ? FLY_HEIGHT : 0) - 10;
      const pct = Math.max(0, e.hp / e.maxHp);
      g.fillStyle(0x000000, 0.7);
      g.fillRect(x - 1, y - 1, w + 2, 7);
      g.fillStyle(pct > 0.5 ? 0x4ade80 : pct > 0.25 ? 0xfacc15 : 0xef4444, 1);
      g.fillRect(x, y, w * pct, 5);
      if (e.maxShield > 0 && e.shield > 0) {
        g.fillStyle(0x60a5fa, 1);
        g.fillRect(x, y - 4, w * (e.shield / e.maxShield), 3);
        g.lineStyle(2, 0x93c5fd, 0.6);
        g.strokeCircle(e.x, e.y, e.def.radius + 4);
      }
    }

    // König: Position (sanftes Wippen am Tor) und Abbau-Fortschritt
    const bob = this.kingMode === 'home' ? Math.sin(this.time.now / 450) * 2 : Math.sin(this.time.now / 90) * 1.5;
    this.kingSprite.setPosition(this.kingPos.x, this.kingPos.y + bob);
    if (this.kingMode === 'home') this.kingSprite.setFlipX(false);
    if (this.kingMode === 'harvesting') {
      const p = 1 - this.harvestLeft / this.harvestTotal;
      g.fillStyle(0x000000, 0.7);
      g.fillRect(this.kingPos.x - 26, this.kingPos.y - 50, 52, 8);
      g.fillStyle(0xfacc15, 1);
      g.fillRect(this.kingPos.x - 25, this.kingPos.y - 49, 50 * p, 6);
    }
    if (this.kingTarget && this.kingMode === 'walking') {
      const t = this.cellCenter(this.kingTarget);
      g.lineStyle(3, 0xfacc15, 0.8);
      g.strokeRect(t.x - TILE / 2 + 3, t.y - TILE / 2 + 3, TILE - 6, TILE - 6);
    }

    const fx = this.fxGfx;
    fx.clear();
    for (const cl of this.clouds) {
      const a = Math.min(1, cl.t) * 0.35;
      fx.fillStyle(0x84cc16, a);
      fx.fillCircle(cl.x, cl.y, cl.radius);
      fx.fillStyle(0xbef264, a * 0.8);
      fx.fillCircle(cl.x + Math.sin(this.time.now / 300) * 10, cl.y + Math.cos(this.time.now / 370) * 8, cl.radius * 0.55);
    }
    for (const b of this.beams) {
      b.t -= dt;
      fx.lineStyle(b.width, b.color, Math.min(1, b.t * 6));
      fx.beginPath();
      fx.moveTo(b.points[0].x, b.points[0].y);
      for (const p of b.points.slice(1)) fx.lineTo(p.x, p.y);
      fx.strokePath();
    }
    this.beams = this.beams.filter((b) => b.t > 0);
    if (this.abilityTargeting) {
      const p = this.input.activePointer;
      fx.lineStyle(3, 0xfacc15, 0.8);
      const w = this.toWorld(p.x, p.y);
      fx.strokeCircle(w.x, w.y, KING.ability.radius * TILE);
    }
  }

  ringFx(x: number, y: number, color: number, scale: number): void {
    const ring = this.add.image(x, y, 'fx_ring').setDepth(DEPTH.fx).setTint(color).setScale(scale * 0.3).setAlpha(0.9);
    this.tweens.add({ targets: ring, scale, alpha: 0, duration: 450, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  }

  burstFx(x: number, y: number, color: number, scale: number): void {
    const c = this.add.image(x, y, 'fx_glow').setDepth(DEPTH.fx).setTint(color).setScale(scale * 0.4).setAlpha(0.9);
    this.tweens.add({ targets: c, scale: scale * 1.2, alpha: 0, duration: 320, ease: 'Cubic.easeOut', onComplete: () => c.destroy() });
  }

  banner(title: string, sub: string, color: number): void {
    const root = this.add.container(GAME_WIDTH / 2, MAP_Y + 220).setDepth(DEPTH.overlay - 10);
    const t = addText(this, 0, 0, title, 56, { origin: [0.5, 0.5], color: `#${color.toString(16).padStart(6, '0')}`, stroke: true });
    root.add(t);
    if (sub) root.add(addText(this, 0, 46, sub, 24, { origin: [0.5, 0.5], stroke: true }));
    root.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: root, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: root, alpha: 0, delay: 1400, duration: 400, onComplete: () => root.destroy() });
    pin(root);
  }

  // ================================================================ Tutorial (nur Nacht 1)

  private static readonly TUTORIAL = [
    'Tippe auf ein freies Feld neben dem Weg und beschwöre einen Turm mit Rift-Kristallen.\nErst Turm antippen = Vorschau, nochmal antippen = bauen.',
    'Gut gemacht! Tippe oben rechts auf »Welle starten«.',
    'Tipp: Tippe auf einen Baum oder Felsen und schicke den König zum Abbauen – das bringt Holz und Stein für die Stadt. Aber dann fehlt er am Tor!',
    'Halte durch! Nach jeder 3. Welle darfst du eine Upgrade-Karte wählen.',
  ];

  private showTutorial(): void {
    this.tutorialBox?.destroy();
    this.tutorialBox = null;
    const text = BattleScene.TUTORIAL[this.tutorialStep];
    if (this.tutorialStep < 0 || !text) return;
    const box = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT - 52).setDepth(DEPTH.menu - 1);
    const label = addText(this, 0, 0, text, 20, { origin: [0.5, 0.5], align: 'center', wrap: 1000 });
    const bg = this.add.rectangle(0, 0, label.width + 40, label.height + 20, 0x000000, 0.75).setStrokeStyle(2, 0xfacc15);
    box.add([bg, label]);
    this.tutorialBox = pin(box);
  }

  private advanceTutorial(): void {
    this.tutorialStep++;
    if (this.tutorialStep >= BattleScene.TUTORIAL.length) this.tutorialStep = -1;
    this.showTutorial();
  }

  // ================================================================ Entwicklermodus

  /** Springt zu einer Welle (nur zwischen den Wellen). */
  devJumpToWave(wave: number): void {
    if (this.phase !== 'build') {
      floatText(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Nur zwischen den Wellen möglich', COLORS.bad, 24, true);
      return;
    }
    this.waveIndex = Phaser.Math.Clamp(wave - 1, 0, this.waves.length - 1);
    this.hud.setPreview(this.waves[this.waveIndex]);
    floatText(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, `Weiter mit Welle ${this.waveIndex + 1}`, '#22d3ee', 28, true);
  }

  private devClearEnemies(): void {
    this.spawnQueue = [];
    for (const e of this.enemies) e.destroy();
    this.enemies = [];
  }

  /** Laufende Welle sofort gewinnen. */
  devWinWave(): void {
    if (this.phase !== 'wave') {
      floatText(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Erst eine Welle starten', COLORS.bad, 24, true);
      return;
    }
    this.devClearEnemies();
  }

  /** Ganze Nacht sofort gewinnen. */
  devWinNight(): void {
    if (this.outcome !== 'open' || this.phase === 'ended') return;
    this.devClearEnemies();
    this.menus.close();
    this.waveIndex = this.waves.length;
    this.victory();
  }

  /** Für Tests/Entwicklung: aktuelle Karten-Infos. */
  debugInfo(): Record<string, unknown> {
    return {
      night: this.setup.night, rift: this.rift.id, phase: this.phase, outcome: this.outcome, crystals: this.crystals, gateHp: this.gateHp,
      loot: { ...this.loot }, king: this.kingMode, available: this.availableTowers,
      wave: this.waveIndex, waves: this.waves.length, enemies: this.enemies.length, towers: this.towers.length,
      cards: this.cards.map((c) => getCard(c).name),
    };
  }
}

/** Zickzack-Linie für Blitze. */
function zigzag(a: Vec, b: Vec, rng: Rng): Vec[] {
  const pts: Vec[] = [{ x: a.x, y: a.y }];
  const n = 5;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    pts.push({ x: a.x + (b.x - a.x) * t + (rng.next() - 0.5) * 14, y: a.y + (b.y - a.y) * t + (rng.next() - 0.5) * 14 });
  }
  pts.push({ x: b.x, y: b.y });
  return pts;
}

/** Abstand eines Punktes zu einer Strecke a–b. */
function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/** Rundet die Ecken eines Linienzugs ab (Bogen mit höchstens `radius`), für Straßen und Laufwege. */
function smoothCorners(pts: readonly Vec[], radius: number): Vec[] {
  if (pts.length < 3) return [...pts];
  const out: Vec[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const lab = Math.hypot(a.x - b.x, a.y - b.y);
    const lbc = Math.hypot(c.x - b.x, c.y - b.y);
    const rad = Math.min(radius, lab / 2, lbc / 2);
    const p1 = { x: b.x + ((a.x - b.x) / lab) * rad, y: b.y + ((a.y - b.y) / lab) * rad };
    const p2 = { x: b.x + ((c.x - b.x) / lbc) * rad, y: b.y + ((c.y - b.y) / lbc) * rad };
    // Quadratische Kurve p1 → (b) → p2
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      const u = 1 - t;
      out.push({ x: u * u * p1.x + 2 * u * t * b.x + t * t * p2.x, y: u * u * p1.y + 2 * u * t * b.y + t * t * p2.y });
    }
  }
  out.push(pts[pts.length - 1]);
  // doppelte Punkte entfernen (Route braucht Abstände > 0)
  return out.filter((p, i) => i === 0 || Math.hypot(p.x - out[i - 1].x, p.y - out[i - 1].y) > 0.01);
}

/** Treppen aus lauter 1-Feld-Stufen werden zu einer geraden, schrägen Linie. */
function straightenStairs(pts: readonly Vec[]): Vec[] {
  const short = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y) <= TILE + 1;
  return pts.filter((p, i) => i === 0 || i === pts.length - 1 || !(short(pts[i - 1], p) && short(p, pts[i + 1])));
}

/** Punkte im Abstand `step` entlang eines Linienzugs. */
function densify(pts: readonly Vec[], step: number): Vec[] {
  const out: Vec[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  if (pts.length) out.push(pts[pts.length - 1]);
  return out;
}

/** Schuss-Geräusch je Geschoss-Art */
const SHOOT_SOUND: Partial<Record<string, SoundName>> = {
  arrow: 'shootArrow', bolt: 'shootArrow', ball: 'shootHeavy', rock: 'shootHeavy', shard: 'shootMagic',
  orb: 'shootMagic', royal: 'shootArrow', glob: 'shootGlob', gust: 'shootGust',
};
