import Phaser from 'phaser';
import { BALANCE, COLS, GAME_HEIGHT, GAME_WIDTH, GATE_ROW, GATE_X, MAP_X, MAP_Y, ROWS, TILE } from '../config';
import { rollCards } from '../core/draft';
import { Modifiers } from '../core/modifiers';
import { buildingModifiers, cardModifiers, computeRewards, setupNight, type NightSetup } from '../core/progression';
import { Rng, randomSeed } from '../core/rng';
import { Route, simplifyPoints } from '../core/route';
import { saveStore } from '../core/save';
import type { GridPos, Modifier, Vec } from '../core/types';
import type { WaveDef } from '../core/wavegen';
import type { CardDef } from '../data/cards';
import { getCard } from '../data/cards';
import { getEnemy, type EnemyAbility } from '../data/enemies';
import { KING, KING_MAX_LEVEL } from '../data/king';
import type { RiftDef, TileDef } from '../data/rifts';
import { getTower, type TowerDef, type TowerLevel } from '../data/towers';
import { tileKey } from '../game/textures';
import { ads } from '../services/ads';
import { showCardDraft } from '../ui/cardDraft';
import { COLORS, addText, floatText, showDialog } from '../ui/widgets';
import { Enemy, FLY_HEIGHT, Projectile, Tower, type HitInfo, type TargetMode, type TowerStats } from './entities';
import { Hud } from './hud';
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
  gold: number;
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
}

interface Beam {
  points: Vec[];
  color: number;
  t: number;
  width: number;
}

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

  gold = 0;
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
  readonly kingPos: Vec = { x: MAP_X - 6, y: MAP_Y + GATE_ROW * TILE + TILE / 2 - 30 };
  private kingCooldown = 0;
  abilityCooldown = 0;
  abilityTargeting = false;
  private strikes: Strike[] = [];
  private beams: Beam[] = [];

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
  init(data: { night?: number }): void {
    const save = saveStore.get();
    this.setup = setupNight(save.seed, data.night ?? save.night);
    this.rift = this.setup.rift;
    this.waves = this.setup.waves;
    this.staticMods = [...buildingModifiers(save.buildings), ...this.rift.globalEffect.modifiers];
    this.cards = BALANCE.cardsPersistAcrossNights ? [...save.cards] : [];
    this.recomputeMods();
    this.gold = Math.round(this.mods.apply('startGold', BALANCE.startGold + BALANCE.startGoldPerNight * (this.setup.night - 1)));
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
    this.kingCooldown = 0;
    this.abilityCooldown = 0;
    this.abilityTargeting = false;
    this.strikes = [];
    this.beams = [];
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
    this.tweens.add({ targets: this.kingSprite, y: this.kingPos.y - 3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.hud = new Hud(this);
    this.menus = new BattleMenus(this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.hud.setPreview(this.waves[0]);
    this.showTutorial();
    this.banner(`Nacht ${this.setup.night}`, this.rift.name, this.rift.color);
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    if (!this.paused && this.phase !== 'ended' && this.phase !== 'draft') {
      // Bei 2×/3× Tempo mehrere kleine Schritte statt eines großen (genauere Treffer)
      for (let i = 0; i < this.speed; i++) this.step(dt);
    }
    this.drawOverlay(dt);
    this.hud.refresh();
  }

  // ================================================================ Aufbau

  private buildRoutes(): void {
    const center = (p: GridPos): Vec => ({ x: MAP_X + p.col * TILE + TILE / 2, y: MAP_Y + p.row * TILE + TILE / 2 });
    const gate: Vec = { x: GATE_X, y: MAP_Y + GATE_ROW * TILE + TILE / 2 };
    const spawnX = MAP_X + COLS * TILE + 26;
    this.routes = this.setup.map.paths.map((path) => {
      const pts = path.map(center);
      return new Route(simplifyPoints([{ x: spawnX, y: pts[0].y }, ...pts, gate]));
    });
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
      for (let col = 0; col < COLS; col++) {
        const tile = this.tileAt(col, row);
        const img = this.add.image(MAP_X + col * TILE + TILE / 2, MAP_Y + row * TILE + TILE / 2, tileKey(this.rift.id, tiles[row][col])).setDepth(DEPTH.tiles);
        // Texturen zeigen nach links (Winkel π) – passend zur Laufrichtung drehen
        if (tile.deco === 'conveyor') img.setRotation((direction.get(`${col},${row}`) ?? Math.PI) - Math.PI);
      }
    }
    // Wegränder
    const g = this.add.graphics().setDepth(DEPTH.pathEdge);
    const isPath = (c: number, r: number) => {
      if (c >= COLS || c < 0) return r >= 0 && r < ROWS && this.tileAt(c < 0 ? 0 : COLS - 1, r).path;
      if (r < 0 || r >= ROWS) return false;
      return this.tileAt(c, r).path;
    };
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (!this.tileAt(col, row).path) continue;
        const x = MAP_X + col * TILE;
        const y = MAP_Y + row * TILE;
        g.lineStyle(4, 0x000000, 0.28);
        if (!isPath(col, row - 1)) g.lineBetween(x, y + 2, x + TILE, y + 2);
        if (!isPath(col, row + 1)) g.lineBetween(x, y + TILE - 2, x + TILE, y + TILE - 2);
        if (!isPath(col - 1, row) && col > 0) g.lineBetween(x + 2, y, x + 2, y + TILE);
        if (!isPath(col + 1, row) && col < COLS - 1) g.lineBetween(x + TILE - 2, y, x + TILE - 2, y + TILE);
      }
    }
    // Portale am Wegbeginn
    const starts = new Set(this.setup.map.paths.map((p) => p[0].row));
    for (const row of starts) {
      const y = MAP_Y + row * TILE + TILE / 2;
      const portal = this.add.image(GAME_WIDTH - 14, y, `portal_${this.rift.id}`).setDepth(DEPTH.wall).setScale(0.75);
      const swirl = this.add.image(GAME_WIDTH - 14, y, 'portal_swirl').setDepth(DEPTH.wall).setScale(0.55).setTint(this.rift.color);
      this.tweens.add({ targets: swirl, angle: 360, duration: 4000, repeat: -1 });
      this.tweens.add({ targets: portal, scale: 0.82, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private drawWall(): void {
    const g = this.add.graphics().setDepth(DEPTH.wall);
    const gateY = MAP_Y + GATE_ROW * TILE + TILE / 2;
    // Stadt hinter der Mauer
    g.fillStyle(0x0d0f1c, 1);
    g.fillRect(0, MAP_Y, 72, GAME_HEIGHT - MAP_Y);
    const roofs = [0x5b2a2a, 0x3d3a5c, 0x4a3b2a];
    for (let i = 0; i < 9; i++) {
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
    g.fillRect(72, MAP_Y, 44, GAME_HEIGHT - MAP_Y);
    g.lineStyle(1, 0x3f434b, 1);
    for (let y = MAP_Y; y < GAME_HEIGHT; y += 16) {
      g.lineBetween(72, y, 116, y);
      const off = ((y - MAP_Y) / 16) % 2 ? 11 : 0;
      for (let x = 72 + off; x < 116; x += 22) g.lineBetween(x, y, x, y + 16);
    }
    g.fillStyle(0x7d828e, 1);
    for (let y = MAP_Y + 4; y < GAME_HEIGHT; y += 24) g.fillRect(114, y, 10, 14);
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

  private onPointerUp(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (over.length > 0) return; // Knopf oder Menü wurde getroffen
    if (this.phase === 'ended' || this.phase === 'draft' || this.paused) return;
    const { x, y } = pointer;

    if (this.abilityTargeting) {
      if (this.inMap(x, y)) this.castAbility(x, y);
      else this.setAbilityTargeting(false);
      return;
    }
    if (Math.hypot(x - this.kingPos.x, y - this.kingPos.y) < 42) {
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
    else {
      this.menus.close();
      const c = this.cellCenter(cell);
      const info = tile.effectText ?? (tile.resource ? `${tile.name}: bringt ${this.resourceName()} nach dem Kampf` : tile.name);
      floatText(this, c.x, c.y - 10, info, COLORS.text, 16);
    }
  }

  private resourceName(): string {
    return { holz: 'Holz', metall: 'Metall', kristall: 'Kristall' }[this.rift.reward.resource];
  }

  // ================================================================ Hilfen

  tileAt(col: number, row: number): TileDef {
    return this.rift.tiles[this.setup.map.tiles[row][col]];
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

  recomputeMods(): void {
    this.mods = new Modifiers([...this.staticMods, ...cardModifiers(this.cards)]);
    this.gateMaxHp = Math.round(this.mods.apply('gateMaxHp', BALANCE.gateHp));
    for (const t of this.towers) t.stats = this.computeTowerStats(t.def, t.level, t.tile);
  }

  computeTowerStats(def: TowerDef, level: number, tile: TileDef): TowerStats {
    const lvl = def.levels[level - 1];
    const tags = def.tags;
    const m = this.mods.clone().add(...(tile.towerModifiers ?? []));
    return {
      damage: m.apply('damage', lvl.damage, tags),
      attackSpeed: Math.max(0.05, m.apply('attackSpeed', lvl.attackSpeed, tags)),
      range: m.apply('range', lvl.range, tags) * TILE,
      projectiles: def.attack === 'projectile' ? Math.max(1, Math.round(m.apply('projectiles', 1, tags))) : 1,
      splash: lvl.splashRadius ? m.apply('splashRadius', lvl.splashRadius, tags) * TILE : 0,
      slowStrength: lvl.slow ? Math.min(0.85, m.apply('slowStrength', lvl.slow.strength, tags)) : 0,
      slowDuration: lvl.slow?.duration ?? 0,
      chain: lvl.chainTargets !== undefined ? Math.round(m.apply('chainTargets', lvl.chainTargets, tags)) : 0,
      armorPen: Math.min(1, m.flat('armorPen', tags)),
      crit: m.flat('critChance', tags),
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
    if (this.gold < cost) {
      floatText(this, c.x, c.y, 'Nicht genug Gold', COLORS.bad);
      return false;
    }
    this.gold -= cost;
    const tower = new Tower(this, def, cell.col, cell.row, c.x, c.y, tile, DEPTH.towers);
    tower.spent = cost;
    tower.stats = this.computeTowerStats(def, 1, tile);
    this.towers.push(tower);
    this.towerAt[cell.row][cell.col] = tower;
    this.ringFx(c.x, c.y, 0xffffff, 0.6);
    if (this.tutorialStep === 0) this.advanceTutorial();
    return true;
  }

  upgradeTower(t: Tower): boolean {
    if (t.level >= t.def.levels.length) return false;
    const cost = this.towerCost(t.def.levels[t.level]);
    if (this.gold < cost) {
      floatText(this, t.x, t.y, 'Nicht genug Gold', COLORS.bad);
      return false;
    }
    this.gold -= cost;
    t.spent += cost;
    t.setLevel(t.level + 1);
    t.stats = this.computeTowerStats(t.def, t.level, t.tile);
    this.ringFx(t.x, t.y, 0xfacc15, 0.7);
    return true;
  }

  sellValue(t: Tower): number {
    return Math.round(t.spent * BALANCE.sellRefund);
  }

  sellTower(t: Tower): void {
    this.gold += this.sellValue(t);
    floatText(this, t.x, t.y, `+${this.sellValue(t)}`, COLORS.gold);
    this.towerAt[t.row][t.col] = null;
    this.towers = this.towers.filter((x) => x !== t);
    t.destroy();
  }

  kingUpgradeCost(): number | null {
    if (this.kingLevel >= KING_MAX_LEVEL) return null;
    return Math.round(KING.upgradeCosts[this.kingLevel - 1] * Math.max(0.3, 1 + this.mods.pct('towerCost')));
  }

  upgradeKing(): boolean {
    const cost = this.kingUpgradeCost();
    if (cost === null) return false;
    if (this.gold < cost) {
      floatText(this, this.kingPos.x + 40, this.kingPos.y, 'Nicht genug Gold', COLORS.bad);
      return false;
    }
    this.gold -= cost;
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
    this.banner(`Welle ${wave.number}`, sub, wave.isBoss ? 0xef4444 : wave.hasAir ? 0x7dd3fc : 0xf3e6c4);
    if (this.tutorialStep === 1) this.advanceTutorial();
  }

  private onWaveCleared(): void {
    this.waveIndex++;
    const bonus = BALANCE.waveClearGoldBase + BALANCE.waveClearGoldPerWave * this.waveIndex;
    const interest = Math.min(50, Math.floor(this.gold * this.mods.flat('interest')));
    this.gold += bonus + interest;
    floatText(this, GAME_WIDTH / 2, MAP_Y + 140, `Welle geschafft! +${bonus + interest} Gold`, COLORS.gold, 26);
    this.currentWave = null;

    if (this.waveIndex >= this.waves.length) {
      this.victory();
      return;
    }
    this.hud.setPreview(this.waves[this.waveIndex]);
    if (this.waveIndex % BALANCE.cardEveryWaves === 0) this.openDraft();
    else this.phase = 'build';
  }

  private openDraft(): void {
    this.phase = 'draft';
    this.menus.close();
    const luck = this.mods.flat('cardLuck') + this.draftsDone * 0.4;
    const roll = () => rollCards(this.rng, this.cards, luck);
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
    if (this.tutorialStep === 2) this.advanceTutorial();
  }

  pickCard(card: CardDef): void {
    this.cards.push(card.id);
    this.draftsDone++;
    if (card.instant?.gold) this.gold += card.instant.gold;
    if (card.instant?.heal) this.gateHp = Math.min(this.gateMaxHp, this.gateHp + card.instant.heal);
    this.recomputeMods();
    this.phase = 'build';
  }

  private makeSnapshot(): Snapshot {
    return {
      gold: this.gold,
      gateHp: this.gateHp,
      cards: [...this.cards],
      kingLevel: this.kingLevel,
      draftsDone: this.draftsDone,
      rerollsLeft: this.rerollsLeft,
      towers: this.towers.map((t) => ({ id: t.def.id, col: t.col, row: t.row, level: t.level, spent: t.spent, targetMode: t.targetMode })),
    };
  }

  private restoreSnapshot(s: Snapshot): void {
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
    this.gold = s.gold;
    this.gateHp = s.gateHp;
    this.kingLevel = s.kingLevel;
    this.draftsDone = s.draftsDone;
    this.rerollsLeft = s.rerollsLeft;
    for (const st of s.towers) {
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
      const abilities = e.def.abilities ?? [];
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
      e.dist += e.speed * e.slowFactor * e.boostFactor * tileFactor * TILE * dt;
      e.place();
      if (e.flash > 0) e.flash -= dt;
      this.applyTint(e);
      if (e.dist >= e.route.length) this.reachGate(e);
    }
    if (this.enemies.some((e) => !e.alive)) this.enemies = this.enemies.filter((e) => e.alive);
  }

  private applyTint(e: Enemy): void {
    if (e.flash > 0) e.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
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
    else list.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    return list;
  }

  private updateTowers(dt: number): void {
    for (const t of this.towers) {
      if (t.disabled > 0) {
        t.disabled -= dt;
        if (t.disabled <= 0) t.setHacked(false);
        continue;
      }
      t.cooldown -= dt;
      if (t.cooldown > 0) continue;
      const targets = this.findTargets(t.x, t.y, t.stats.range, t.def.targets, t.targetMode);
      if (targets.length === 0) continue;
      t.top.setRotation(Math.atan2(targets[0].y - t.y, targets[0].x - t.x));
      this.fireTower(t, targets);
      t.cooldown = 1 / t.stats.attackSpeed;
    }
  }

  private hitInfo(t: Tower): HitInfo {
    const s = t.stats;
    return {
      damage: s.damage,
      type: t.def.damageType,
      armorPen: s.armorPen,
      crit: s.crit,
      airMul: s.airMul,
      splash: s.splash,
      slowStrength: s.slowStrength,
      slowDuration: s.slowDuration,
    };
  }

  private fireTower(t: Tower, targets: Enemy[]): void {
    const info = this.hitInfo(t);
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

  private chainLightning(t: Tower, first: Enemy, info: HitInfo): void {
    const hit: Enemy[] = [first];
    let current = first;
    for (let i = 0; i < t.stats.chain; i++) {
      const next = this.enemies
        .filter((e) => e.alive && !e.flying && !hit.includes(e) && Math.hypot(e.x - current.x, e.y - current.y) <= TILE * 1.6)
        .sort((a, b) => Math.hypot(a.x - current.x, a.y - current.y) - Math.hypot(b.x - current.x, b.y - current.y))[0];
      if (!next) break;
      hit.push(next);
      current = next;
    }
    const pts: Vec[] = [{ x: t.x, y: t.y - 6 }];
    let dmg = info.damage;
    for (const e of hit) {
      pts.push({ x: e.x, y: e.y });
      this.damageEnemy(e, { ...info, damage: dmg });
      dmg *= 0.75;
    }
    for (let i = 1; i < pts.length; i++) {
      this.beams.push({ points: zigzag(pts[i - 1], pts[i], this.rng), color: 0xd8b4fe, t: 0.14, width: 3 });
    }
  }

  private updateKing(dt: number): void {
    this.kingCooldown -= dt;
    if (this.kingCooldown > 0) return;
    const k = this.kingStats();
    const targets = this.findTargets(this.kingPos.x, this.kingPos.y, k.range, { ground: true, air: true }, 'first');
    if (targets.length === 0) return;
    const info: HitInfo = {
      damage: k.damage, type: 'physical', armorPen: this.mods.flat('armorPen'), crit: this.mods.flat('critChance'),
      airMul: 1, splash: 0, slowStrength: 0, slowDuration: 0,
    };
    this.projectiles.push(new Projectile(this, this.kingPos.x + 20, this.kingPos.y, targets[0], 10 * TILE, info, 'royal', DEPTH.proj));
    this.kingCooldown = 1 / k.attackSpeed;
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
        if (e.alive && !e.flying && Math.hypot(e.x - p.tx, e.y - p.ty) <= info.splash) this.damageEnemy(e, info);
      }
      this.burstFx(p.tx, p.ty, 0xf59e0b, info.splash / 30);
    } else if (p.target?.alive) {
      this.damageEnemy(p.target, info);
      if (info.slowStrength > 0) this.applySlow(p.target, info.slowStrength, info.slowDuration);
    }
    p.destroy();
  }

  private applySlow(e: Enemy, strength: number, duration: number): void {
    if (!e.alive) return;
    const s = e.def.boss ? strength * 0.5 : strength;
    e.slowFactor = Math.min(e.slowFactor, 1 - s);
    e.slowTimer = Math.max(e.slowTimer, duration);
  }

  damageEnemy(e: Enemy, info: HitInfo): void {
    if (!e.alive) return;
    let dmg = info.damage;
    if (e.flying) dmg *= info.airMul;
    if (info.crit > 0 && this.rng.chance(info.crit)) {
      dmg *= 2;
      floatText(this, e.x, e.y - 20, 'Krit!', '#fde047', 14);
    }
    if (info.type === 'physical') dmg *= 1 - e.armor * (1 - info.armorPen);
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
    const gold = Math.round(e.def.gold * Math.max(0, 1 + this.mods.pct('goldGain')));
    this.gold += gold;
    this.kills++;
    floatText(this, e.x, e.y - 12, `+${gold}`, COLORS.gold, e.def.boss ? 26 : 16);
    this.burstFx(e.x, e.y, e.def.look.body, e.def.radius / 22);
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
          this.damageEnemy(e, { damage: s.damage, type: 'physical', armorPen: 0.5, crit: 0, airMul: 1, splash: 0, slowStrength: 0, slowDuration: 0 });
        }
      }
    }
    this.strikes = this.strikes.filter((s) => s.t > 0);
  }

  // ================================================================ Ende der Nacht

  private victory(): void {
    this.phase = 'ended';
    this.outcome = 'victory';
    const save = saveStore.get();
    const rewards = computeRewards({
      rift: this.rift, map: this.setup.map, night: this.setup.night, victory: true,
      wavesCleared: this.waves.length, totalWaves: this.waves.length, buildingLevels: save.buildings,
    });
    saveStore.update((d) => {
      for (const [id, v] of Object.entries(rewards.total)) d.resources[id as keyof typeof d.resources] += v;
      if (d.night === this.setup.night) d.night++;
      d.stats.nightsWon++;
      d.stats.bestNight = Math.max(d.stats.bestNight, this.setup.night);
      d.stats.enemiesKilled += this.kills;
      d.settings.tutorialDone = true;
      if (BALANCE.cardsPersistAcrossNights) d.cards = [...this.cards];
    });
    this.banner('Sieg!', 'Die Nacht ist überstanden', 0xfacc15);
    this.time.delayedCall(1800, () => this.goToResult(true, rewards));
  }

  private defeat(): void {
    this.phase = 'ended';
    this.menus.close();
    this.setAbilityTargeting(false);
    const waveNo = this.waveIndex + 1;
    const buttons = [];
    if (!this.adUsed && this.snapshots[this.waveIndex]) {
      buttons.push({
        label: 'Werbung ansehen',
        subLabel: `Welle ${waveNo} wiederholen + ${BALANCE.adContinueGold} Gold`,
        color: COLORS.royal,
        onClick: () => {
          void ads.showRewarded(this).then((ok) => {
            if (!ok) return this.defeat();
            this.adUsed = true;
            this.restoreSnapshot(this.snapshots[this.waveIndex]);
            this.gold += BALANCE.adContinueGold;
            floatText(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, `+${BALANCE.adContinueGold} Gold`, COLORS.gold, 30);
          });
        },
      });
    }
    buttons.push({ label: 'Aufgeben', subLabel: 'Teilbelohnung erhalten', color: COLORS.danger, onClick: () => this.giveUp() });
    showDialog(this, 'Das Tor ist gefallen!', `Welle ${waveNo} von ${this.waves.length} hat die Stadt überrannt.`, buttons, { titleColor: COLORS.bad });
  }

  /** Nacht verloren/abgebrochen: Teilbelohnung, dann Ergebnis-Bildschirm. */
  giveUp(): void {
    if (this.outcome !== 'open') return;
    this.phase = 'ended';
    this.outcome = 'defeat';
    const save = saveStore.get();
    const rewards = computeRewards({
      rift: this.rift, map: this.setup.map, night: this.setup.night, victory: false,
      wavesCleared: this.waveIndex, totalWaves: this.waves.length, buildingLevels: save.buildings,
    });
    saveStore.update((d) => {
      for (const [id, v] of Object.entries(rewards.total)) d.resources[id as keyof typeof d.resources] += v;
      d.stats.defeats++;
      d.stats.enemiesKilled += this.kills;
    });
    this.goToResult(false, rewards);
  }

  private goToResult(victory: boolean, rewards: ResultData['rewards']): void {
    const data: ResultData = {
      victory, night: this.setup.night, riftId: this.rift.id, wavesCleared: this.waveIndex,
      totalWaves: this.waves.length, kills: this.kills, rewards,
    };
    this.scene.start('Result', data);
  }

  togglePause(): void {
    if (this.phase === 'ended' || this.phase === 'draft') return;
    this.paused = true;
    this.menus.close();
    showDialog(this, 'Pause', `Nacht ${this.setup.night} · ${this.rift.name}\nWelle ${Math.min(this.waveIndex + 1, this.waves.length)} von ${this.waves.length}`, [
      { label: 'Weiter', onClick: () => (this.paused = false) },
      { label: 'Nacht neu starten', color: COLORS.buttonAlt, onClick: () => this.scene.restart({ night: this.setup.night }) },
      { label: 'Aufgeben', subLabel: 'Teilbelohnung erhalten', color: COLORS.danger, onClick: () => this.giveUp() },
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

    const fx = this.fxGfx;
    fx.clear();
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
      fx.strokeCircle(p.x, p.y, KING.ability.radius * TILE);
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
  }

  // ================================================================ Tutorial (nur Nacht 1)

  private static readonly TUTORIAL = [
    'Tippe auf ein freies Feld neben dem Weg, um einen Turm zu bauen.\nErst Turm antippen = Vorschau, nochmal antippen = bauen.',
    'Gut gemacht! Tippe oben rechts auf »Welle starten«.',
    'Halte durch! Nach jeder 3. Welle darfst du eine Upgrade-Karte wählen.',
  ];

  private showTutorial(): void {
    this.tutorialBox?.destroy();
    this.tutorialBox = null;
    const text = BattleScene.TUTORIAL[this.tutorialStep];
    if (this.tutorialStep < 0 || !text) return;
    const box = this.add.container(MAP_X + (COLS * TILE) / 2, GAME_HEIGHT - 52).setDepth(DEPTH.menu - 1);
    const label = addText(this, 0, 0, text, 20, { origin: [0.5, 0.5], align: 'center' });
    const bg = this.add.rectangle(0, 0, label.width + 40, label.height + 20, 0x000000, 0.75).setStrokeStyle(2, 0xfacc15);
    box.add([bg, label]);
    this.tutorialBox = box;
  }

  private advanceTutorial(): void {
    this.tutorialStep++;
    if (this.tutorialStep >= BattleScene.TUTORIAL.length) this.tutorialStep = -1;
    this.showTutorial();
  }

  /** Für Tests/Entwicklung: aktuelle Karten-Infos. */
  debugInfo(): Record<string, unknown> {
    return {
      night: this.setup.night, rift: this.rift.id, phase: this.phase, outcome: this.outcome, gold: this.gold, gateHp: this.gateHp,
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
