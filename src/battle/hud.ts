import Phaser from 'phaser';
import { GAME_WIDTH, HUD_HEIGHT } from '../config';
import type { WaveDef } from '../core/wavegen';
import { getEnemy } from '../data/enemies';
import { Button, COLORS, addText } from '../ui/widgets';
import { DEPTH, type BattleScene } from './BattleScene';

// Obere Leiste im Kampf: Nacht, Gold, Tor-Leben, Welle, Vorschau und Knöpfe.

export class Hud {
  private readonly goldText: Phaser.GameObjects.Text;
  private readonly gateText: Phaser.GameObjects.Text;
  private readonly waveText: Phaser.GameObjects.Text;
  private readonly startBtn: Button;
  private readonly speedBtn: Button;
  private readonly abilityBtn: Button;
  private readonly abilityGfx: Phaser.GameObjects.Graphics;
  private readonly abilityText: Phaser.GameObjects.Text;
  private readonly targetHint: Phaser.GameObjects.Text;
  private preview: Phaser.GameObjects.Container;
  private last = '';

  constructor(private readonly scene: BattleScene) {
    const s = scene;
    const d = DEPTH.hud;
    const g = s.add.graphics().setDepth(d);
    g.fillStyle(0x0b0d1a, 0.96);
    g.fillRect(0, 0, GAME_WIDTH, HUD_HEIGHT);
    g.fillStyle(s.rift.color, 0.9);
    g.fillRect(0, HUD_HEIGHT - 3, GAME_WIDTH, 3);

    addText(s, 16, 8, `Nacht ${s.setup.night}`, 24).setDepth(d);
    addText(s, 16, 40, s.rift.name, 16, { color: hex(s.rift.color) }).setDepth(d);

    s.add.image(232, 36, 'icon_gold').setDepth(d).setScale(0.8);
    this.goldText = addText(s, 254, 36, '', 28, { origin: [0, 0.5], color: COLORS.gold }).setDepth(d);
    s.add.image(372, 36, 'icon_heart').setDepth(d).setScale(0.75);
    this.gateText = addText(s, 393, 36, '', 24, { origin: [0, 0.5] }).setDepth(d);
    s.add.image(508, 36, 'icon_skull').setDepth(d).setScale(0.65);
    this.waveText = addText(s, 528, 36, '', 22, { origin: [0, 0.5] }).setDepth(d);

    this.preview = s.add.container(0, 0).setDepth(d);

    this.speedBtn = new Button(s, 980, 36, 70, 54, '1×', () => s.cycleSpeed(), { color: COLORS.buttonAlt }).setDepth(d);
    new Button(s, 1058, 36, 70, 54, 'II', () => s.togglePause(), { color: COLORS.buttonAlt }).setDepth(d);
    this.startBtn = new Button(s, 1190, 36, 162, 56, 'Welle starten', () => s.startWave(), { fontSize: 20 }).setDepth(d);

    // Königs-Fähigkeit unten links an der Mauer
    this.abilityBtn = new Button(s, 62, 640, 96, 96, '', () => s.setAbilityTargeting(!s.abilityTargeting), {
      icon: 'icon_arrows', iconScale: 1.4, color: 0x7c5a1e,
    }).setDepth(d);
    this.abilityGfx = s.add.graphics().setDepth(d + 1);
    this.abilityText = addText(s, 62, 640, '', 26, { origin: [0.5, 0.5], stroke: true }).setDepth(d + 2);
    addText(s, 62, 700, 'Pfeilhagel', 14, { origin: [0.5, 0.5], stroke: true }).setDepth(d);
    this.targetHint = addText(s, 640, 110, 'Tippe auf die Karte: Dort schlägt der Pfeilhagel ein!', 22, {
      origin: [0.5, 0.5], color: COLORS.gold, stroke: true,
    }).setDepth(DEPTH.menu).setVisible(false);
  }

  refresh(): void {
    const s = this.scene;
    const key = [s.gold, s.gateHp, s.gateMaxHp, s.waveIndex, s.phase, s.speed, Math.ceil(s.abilityCooldown), s.abilityTargeting].join('|');
    if (key === this.last) return;
    this.last = key;
    this.goldText.setText(String(s.gold));
    this.gateText.setText(`${s.gateHp}/${s.gateMaxHp}`);
    this.gateText.setColor(s.gateHp <= s.gateMaxHp * 0.3 ? COLORS.bad : COLORS.text);
    this.waveText.setText(`${Math.min(s.waveIndex + (s.phase === 'wave' ? 1 : 0), s.waves.length)}/${s.waves.length}`);
    this.speedBtn.setLabel(`${s.speed}×`);
    const canStart = s.phase === 'build';
    this.startBtn.setEnabled(canStart).setLabel(s.phase === 'wave' ? 'Welle läuft' : 'Welle starten');
    this.startBtn.setHighlighted(canStart);

    const cd = s.abilityCooldown;
    const max = s.kingStats().abilityCooldown;
    this.abilityGfx.clear();
    if (cd > 0) {
      this.abilityGfx.fillStyle(0x000000, 0.6);
      this.abilityGfx.slice(62, 640, 46, -Math.PI / 2, -Math.PI / 2 + (cd / max) * Math.PI * 2, false);
      this.abilityGfx.fillPath();
      this.abilityText.setText(String(Math.ceil(cd)));
    } else {
      this.abilityText.setText('');
    }
    this.abilityBtn.setHighlighted(s.abilityTargeting || cd <= 0);
    this.targetHint.setVisible(s.abilityTargeting);
  }

  /** Zeigt, welche Gegner in der nächsten Welle kommen. */
  setPreview(wave: WaveDef | undefined): void {
    const s = this.scene;
    this.preview.destroy();
    this.preview = s.add.container(0, 0).setDepth(DEPTH.hud);
    if (!wave) return;
    const counts = new Map<string, number>();
    for (const g of wave.groups) counts.set(g.enemyId, (counts.get(g.enemyId) ?? 0) + g.count);
    const label = wave.isBoss ? 'Nächste Welle: BOSS' : wave.hasAir ? 'Nächste Welle: mit Fluggegnern' : 'Nächste Welle';
    this.preview.add(addText(s, 616, 4, label, 14, { color: wave.isBoss ? COLORS.bad : wave.hasAir ? '#7dd3fc' : COLORS.muted }));
    let x = 632;
    for (const [id, n] of [...counts.entries()].slice(0, 4)) {
      const def = getEnemy(id);
      const img = s.add.image(x, 46, `enemy_${id}`);
      img.setScale(Math.min(1, 34 / img.width));
      this.preview.add(img);
      if (def.flying) this.preview.add(s.add.image(x + 14, 34, 'icon_air').setScale(0.4));
      this.preview.add(addText(s, x + 20, 46, `×${n}`, 16, { origin: [0, 0.5] }));
      x += 82;
    }
  }
}

export function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
