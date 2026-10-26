import Phaser from 'phaser';
import { saveStore } from '../core/save';
import { sfx } from '../services/sound';
import { FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { css, shade } from '../game/textures';

// Wiederverwendbare Bausteine für Menüs: Text, Knopf, Panel, Dialog.

export const COLORS = {
  text: '#f3e6c4',
  muted: '#a8a29e',
  gold: '#facc15',
  good: '#86efac',
  bad: '#fca5a5',
  panel: 0x14121f,
  panelBorder: 0x5b4a2e,
  button: 0x2f5d3a,
  buttonAlt: 0x3b3552,
  danger: 0x7f1d1d,
  royal: 0x8b5cf6,
};

export interface TextOptions {
  color?: string;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  origin?: [number, number];
  wrap?: number;
  stroke?: boolean;
  /** Höchstbreite: längere Texte werden verkleinert statt umbrochen */
  fit?: number;
}

export function addText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  size = 20,
  opts: TextOptions = {},
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, value, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    fontStyle: opts.bold === false ? 'normal' : 'bold',
    color: opts.color ?? COLORS.text,
    align: opts.align ?? 'left',
    wordWrap: opts.wrap ? { width: opts.wrap, useAdvancedWrap: true } : undefined,
    stroke: opts.stroke ? '#000000' : undefined,
    strokeThickness: opts.stroke ? 4 : 0,
    padding: { x: 2, y: 2 },
  });
  const [ox, oy] = opts.origin ?? [0, 0];
  t.setOrigin(ox, oy);
  if (opts.fit && t.width > opts.fit) t.setScale(opts.fit / t.width);
  return t;
}

export function drawPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fill?: number; alpha?: number; border?: number; radius?: number; borderWidth?: number } = {},
): void {
  const r = opts.radius ?? 14;
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(x + 3, y + 5, w, h, r);
  g.fillStyle(opts.fill ?? COLORS.panel, opts.alpha ?? 0.96);
  g.fillRoundedRect(x, y, w, h, r);
  g.lineStyle(opts.borderWidth ?? 3, opts.border ?? COLORS.panelBorder, 1);
  g.strokeRoundedRect(x, y, w, h, r);
}

export interface ButtonOptions {
  color?: number;
  fontSize?: number;
  icon?: string;
  iconScale?: number;
  enabled?: boolean;
  /** Zweite, kleinere Zeile (z. B. Kosten) */
  subLabel?: string;
}

/** Ein Knopf, der beim Loslassen auslöst (gut für Touch). */
export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly sub?: Phaser.GameObjects.Text;
  private readonly icon?: Phaser.GameObjects.Image;
  private readonly zone: Phaser.GameObjects.Zone;
  private enabled = true;
  private pressed = false;
  private color: number;
  private highlighted = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly w: number,
    readonly h: number,
    label: string,
    onClick: () => void,
    opts: ButtonOptions = {},
  ) {
    super(scene, x, y);
    this.color = opts.color ?? COLORS.button;
    this.bg = scene.add.graphics();
    this.add(this.bg);

    const size = opts.fontSize ?? 22;
    let labelY = opts.subLabel ? -size * 0.4 : 0;
    if (opts.icon) {
      const iconScale = opts.iconScale ?? 0.8;
      this.icon = scene.add.image(0, 0, opts.icon).setScale(iconScale);
      if (label) {
        this.icon.setPosition(-w / 2 + 10 + this.icon.displayWidth / 2, labelY);
      }
      this.add(this.icon);
    }
    this.label = addText(scene, this.icon && label ? 12 : 0, labelY, label, size, { origin: [0.5, 0.5], align: 'center' });
    this.add(this.label);
    if (opts.subLabel) {
      labelY = size * 0.55;
      this.sub = addText(scene, 0, labelY, opts.subLabel, Math.round(size * 0.7), { origin: [0.5, 0.5], color: COLORS.gold });
      this.add(this.sub);
    }

    this.zone = scene.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
    this.add(this.zone);
    this.zone.on('pointerdown', () => {
      if (!this.enabled) return;
      this.pressed = true;
      this.setScale(0.95);
    });
    this.zone.on('pointerup', () => {
      const fire = this.pressed && this.enabled;
      this.release();
      if (fire) {
        sfx.play('click');
        onClick();
      }
    });
    this.zone.on('pointerout', () => this.release());

    this.setEnabled(opts.enabled ?? true);
    scene.add.existing(this);
  }

  private release(): void {
    this.pressed = false;
    this.setScale(1);
  }

  private redraw(): void {
    const g = this.bg;
    const { w, h } = this;
    const base = this.enabled ? this.color : 0x3a3a3f;
    g.clear();
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, 12);
    g.fillStyle(base, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    g.fillStyle(shade(base, 0.18), 1);
    g.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.42, { tl: 10, tr: 10, bl: 4, br: 4 });
    g.lineStyle(this.highlighted ? 4 : 2, this.highlighted ? 0xfacc15 : shade(base, -0.45), 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    this.label.setAlpha(enabled ? 1 : 0.5);
    this.sub?.setAlpha(enabled ? 1 : 0.5);
    this.icon?.setAlpha(enabled ? 1 : 0.5);
    this.redraw();
    return this;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Beschriftung (für Tests) */
  get labelText(): string {
    return this.label.text;
  }

  setHighlighted(on: boolean): this {
    this.highlighted = on;
    this.redraw();
    return this;
  }

  setLabel(value: string): this {
    this.label.setText(value);
    return this;
  }

  setSubLabel(value: string): this {
    this.sub?.setText(value);
    return this;
  }

  setColor(color: number): this {
    this.color = color;
    this.redraw();
    return this;
  }
}

export interface DialogButton {
  label: string;
  color?: number;
  subLabel?: string;
  onClick: () => void;
}

/** Ein Fenster in der Bildschirmmitte, das alles dahinter blockiert. */
export function showDialog(
  scene: Phaser.Scene,
  title: string,
  body: string,
  buttons: DialogButton[],
  opts: { width?: number; depth?: number; titleColor?: string } = {},
): Phaser.GameObjects.Container {
  const w = opts.width ?? 620;
  const root = scene.add.container(0, 0).setDepth(opts.depth ?? 1000);
  const shield = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6);
  shield.setInteractive();
  root.add(shield);

  const titleText = addText(scene, GAME_WIDTH / 2, 0, title, 34, { origin: [0.5, 0], color: opts.titleColor });
  const bodyText = addText(scene, GAME_WIDTH / 2, 0, body, 21, { origin: [0.5, 0], align: 'center', wrap: w - 60, bold: false });
  const btnH = 64;
  const h = 40 + titleText.height + 16 + bodyText.height + 28 + buttons.length * (btnH + 12) + 16;
  const x = GAME_WIDTH / 2 - w / 2;
  const y = Math.max(10, GAME_HEIGHT / 2 - h / 2);

  const g = scene.add.graphics();
  drawPanel(g, x, y, w, h, { border: 0x8b6f3e });
  root.add(g);
  titleText.setY(y + 28);
  bodyText.setY(titleText.y + titleText.height + 12);
  root.add([titleText, bodyText]);

  let by = bodyText.y + bodyText.height + 28 + btnH / 2;
  for (const b of buttons) {
    const btn = new Button(scene, GAME_WIDTH / 2, by, w - 80, btnH, b.label, () => {
      root.destroy();
      b.onClick();
    }, { color: b.color, subLabel: b.subLabel, fontSize: 22 });
    root.add(btn);
    by += btnH + 12;
  }
  return pin(root);
}

/**
 * Hält ein Objekt (und alle Kinder) am Bildschirm fest, auch wenn die Kamera die Karte verschiebt.
 * Für Leisten, Dialoge und Einblendungen.
 */
export function pin<T extends Phaser.GameObjects.GameObject>(obj: T): T {
  const o = obj as unknown as Phaser.GameObjects.Components.ScrollFactor & { list?: Phaser.GameObjects.GameObject[] };
  if (typeof o.setScrollFactor === 'function') o.setScrollFactor(0);
  if (Array.isArray(o.list)) for (const child of o.list) pin(child);
  return obj;
}

/** Kurzer Hinweis, der nach oben schwebt und verschwindet. screen = am Bildschirm statt auf der Karte. */
export function floatText(scene: Phaser.Scene, x: number, y: number, value: string, color = COLORS.gold, size = 18, screen = false): void {
  const t = addText(scene, x, y, value, size, { origin: [0.5, 0.5], color, stroke: true }).setDepth(900);
  if (screen) pin(t);
  scene.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
}

export { css };

/** Knopf „Ton: An/Aus“ – speichert die Einstellung im Spielstand. */
export function soundToggle(scene: Phaser.Scene, x: number, y: number, w: number, h: number, short = false): Button {
  const label = () => (short ? (sfx.isEnabled() ? 'Ton' : 'Stumm') : `Ton: ${sfx.isEnabled() ? 'An' : 'Aus'}`);
  const btn: Button = new Button(scene, x, y, w, h, label(), () => {
    const on = !sfx.isEnabled();
    sfx.setEnabled(on);
    saveStore.update((d) => (d.settings.sound = on));
    btn.setLabel(label());
    if (on) sfx.play('click');
  }, { color: COLORS.buttonAlt, fontSize: short ? 16 : 20 });
  return btn;
}
