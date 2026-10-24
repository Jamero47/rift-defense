import Phaser from 'phaser';
import type { Route } from '../core/route';
import type { EnemyDef } from '../data/enemies';
import type { TileDef } from '../data/rifts';
import type { ProjectileStyle, TowerDef } from '../data/towers';

// Gegner, Türme und Geschosse im Kampf. Die Regeln dazu stehen in BattleScene.ts.

/** Fluggegner werden etwas höher gezeichnet; ihr Schatten zeigt die echte Position. */
export const FLY_HEIGHT = 10;

export interface EnemyInit {
  /** Lebenspunkte-Faktor der Welle (ohne Karten/Rift) */
  waveHpMult: number;
  /** Faktor aus Karten/Rift auf die Lebenspunkte */
  hpMod: number;
  speedMul: number;
  armorAdd: number;
  startDist?: number;
}

export class Enemy {
  readonly sprite: Phaser.GameObjects.Image;
  readonly shadow?: Phaser.GameObjects.Image;
  dist: number;
  x = 0;
  y = 0;
  hp: number;
  readonly maxHp: number;
  shield = 0;
  readonly maxShield: number;
  readonly armor: number;
  /** Felder pro Sekunde (inkl. Karten/Rift, ohne Verlangsamung) */
  readonly speed: number;
  readonly waveHpMult: number;
  slowFactor = 1;
  slowTimer = 0;
  boostFactor = 1;
  boostTimer = 0;
  /** Sekunden seit dem letzten Treffer */
  sinceHit = 99;
  flash = 0;
  readonly abilityTimers: number[];
  alive = true;

  constructor(
    scene: Phaser.Scene,
    readonly def: EnemyDef,
    readonly route: Route,
    init: EnemyInit,
    depth: number,
  ) {
    this.waveHpMult = init.waveHpMult;
    this.maxHp = Math.max(1, Math.round(def.hp * init.waveHpMult * init.hpMod));
    this.hp = this.maxHp;
    this.armor = Math.min(0.85, Math.max(0, def.armor + init.armorAdd));
    this.speed = def.speed * init.speedMul;
    this.dist = Math.max(0, init.startDist ?? 0);
    const shield = def.abilities?.find((a) => a.type === 'shield');
    this.maxShield = shield ? Math.round(shield.amount * init.waveHpMult * init.hpMod) : 0;
    this.shield = this.maxShield;
    // Fähigkeiten starten versetzt, damit nicht alle gleichzeitig auslösen
    this.abilityTimers = (def.abilities ?? []).map((a) => ('interval' in a ? a.interval * (0.4 + Math.random() * 0.6) : 0));

    if (def.flying) {
      this.shadow = scene.add.image(0, 0, 'shadow').setDepth(depth - 1).setScale(def.radius / 18);
    }
    this.sprite = scene.add.image(0, 0, `enemy_${def.id}`).setDepth(depth);
    this.place();
  }

  get flying(): boolean {
    return this.def.flying;
  }

  /** Reststrecke bis zum Tor in Pixeln */
  get remaining(): number {
    return this.route.length - this.dist;
  }

  place(): void {
    const p = this.route.at(this.dist);
    this.x = p.x;
    this.y = p.y;
    if (this.shadow) {
      this.shadow.setPosition(p.x + 4, p.y + 6);
      this.sprite.setPosition(p.x, p.y - FLY_HEIGHT);
    } else {
      this.sprite.setPosition(p.x, p.y);
    }
    this.sprite.setRotation(p.angle);
  }

  destroy(): void {
    this.alive = false;
    this.sprite.destroy();
    this.shadow?.destroy();
  }
}

export type TargetMode = 'first' | 'strong' | 'close';

export const TARGET_MODE_LABELS: Record<TargetMode, string> = {
  first: 'Vorderster',
  strong: 'Stärkster',
  close: 'Nächster',
};

/** Fertig berechnete Werte eines Turms (inkl. aller Boni). Reichweite/Radius in Pixeln. */
export interface TowerStats {
  physDamage: number;
  magicDamage: number;
  attackSpeed: number;
  range: number;
  critChance: number;
  /** Faktor bei kritischem Treffer (1.5 = 150 %) */
  critDamage: number;
  maxMana: number;
  manaRegen: number;
  projectiles: number;
  splash: number;
  slowStrength: number;
  slowDuration: number;
  chain: number;
  armorPen: number;
  airMul: number;
  projectileSpeed: number;
}

export class Tower {
  readonly base: Phaser.GameObjects.Image;
  readonly top: Phaser.GameObjects.Image;
  readonly hackIcon: Phaser.GameObjects.Image;
  level = 1;
  /** Ausgegebenes Gold (für den Verkaufswert) */
  spent = 0;
  cooldown = 0;
  /** Sekunden, die der Turm noch gehackt ist */
  disabled = 0;
  /** Aktuelles Mana; bei vollem Mana wird die Fähigkeit ausgelöst */
  mana = 0;
  targetMode: TargetMode = 'first';
  stats!: TowerStats;

  constructor(
    scene: Phaser.Scene,
    readonly def: TowerDef,
    readonly col: number,
    readonly row: number,
    readonly x: number,
    readonly y: number,
    readonly tile: TileDef,
    depth: number,
  ) {
    this.base = scene.add.image(x, y, 'tower_base_1').setDepth(depth);
    this.top = scene.add.image(x, y - 2, `top_${def.id}`).setDepth(depth + 1);
    // Rotation 0 = Blick nach rechts zum Rift
    this.hackIcon = scene.add.image(x + 18, y - 22, 'icon_bolt').setDepth(depth + 2).setScale(0.6).setVisible(false);
  }

  setLevel(level: number): void {
    this.level = level;
    this.base.setTexture(`tower_base_${level}`);
    this.top.setScale(1 + (level - 1) * 0.08);
  }

  setHacked(on: boolean): void {
    this.hackIcon.setVisible(on);
    if (on) this.top.setTint(0x555555);
    else this.top.clearTint();
    this.base.setAlpha(on ? 0.7 : 1);
  }

  destroy(): void {
    this.base.destroy();
    this.top.destroy();
    this.hackIcon.destroy();
  }
}

/** Was ein Treffer anrichtet. */
export interface HitInfo {
  /** Normaler Schaden (Rüstung schwächt ihn ab) */
  physDamage: number;
  /** Magischer Schaden (ignoriert Rüstung) */
  magicDamage: number;
  armorPen: number;
  critChance: number;
  critDamage: number;
  airMul: number;
  splash: number;
  slowStrength: number;
  slowDuration: number;
}

export class Projectile {
  readonly sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  tx: number;
  ty: number;
  alive = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    public target: Enemy | null,
    readonly speed: number,
    readonly hit: HitInfo,
    style: ProjectileStyle,
    depth: number,
  ) {
    this.x = x;
    this.y = y;
    this.tx = target?.x ?? x;
    this.ty = target?.y ?? y;
    this.sprite = scene.add.image(x, y, `proj_${style}`).setDepth(depth);
  }

  destroy(): void {
    this.alive = false;
    this.sprite.destroy();
  }
}
