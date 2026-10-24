import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import type { RewardBreakdown } from '../core/progression';
import { RESOURCE_IDS } from '../core/types';
import { getRift } from '../data/rifts';
import { RESOURCES } from '../data/resources';
import { Button, COLORS, addText, drawPanel } from '../ui/widgets';
import { drawBackdrop } from './backdrop';

export interface ResultData {
  victory: boolean;
  night: number;
  riftId: string;
  wavesCleared: number;
  totalWaves: number;
  kills: number;
  rewards: RewardBreakdown;
}

/** Ergebnis einer Nacht mit allen Belohnungen. */
export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result');
  }

  create(data: ResultData): void {
    const rift = getRift(data.riftId);
    drawBackdrop(this, rift.color);
    this.add.rectangle(GAME_WIDTH / 2, 360, GAME_WIDTH, 720, 0x000000, 0.4);

    addText(this, GAME_WIDTH / 2, 70, data.victory ? 'Sieg!' : 'Das Tor ist gefallen', 64, {
      origin: [0.5, 0.5], color: data.victory ? COLORS.gold : COLORS.bad, stroke: true,
    });
    addText(this, GAME_WIDTH / 2, 130, `Nacht ${data.night} · ${rift.name}`, 24, { origin: [0.5, 0.5], stroke: true });
    addText(this, GAME_WIDTH / 2, 166, `Wellen: ${data.wavesCleared}/${data.totalWaves}   ·   Besiegte Gegner: ${data.kills}`, 20, {
      origin: [0.5, 0.5], color: COLORS.muted, stroke: true,
    });

    const w = 640;
    const lines = data.rewards.lines;
    const h = 90 + Math.max(1, lines.length) * 40 + 60;
    const x = GAME_WIDTH / 2 - w / 2;
    const y = 200;
    const g = this.add.graphics();
    drawPanel(g, x, y, w, h);
    addText(this, x + 24, y + 18, 'Belohnungen für die Stadt', 24, { color: COLORS.gold });
    let ly = y + 70;
    if (lines.length === 0) addText(this, x + 24, ly, 'Diesmal leider nichts.', 18, { color: COLORS.muted });
    for (const line of lines) {
      addText(this, x + 24, ly, line.label, 19, { origin: [0, 0.5], bold: false });
      this.resourceRow(x + w - 24, ly, line.resources);
      ly += 40;
    }
    g.lineStyle(2, 0x5b4a2e, 1);
    g.lineBetween(x + 20, ly - 12, x + w - 20, ly - 12);
    addText(this, x + 24, ly + 14, 'Gesamt', 22, { origin: [0, 0.5] });
    this.resourceRow(x + w - 24, ly + 14, data.rewards.total);

    const by = Math.min(660, y + h + 60);
    if (data.victory) {
      new Button(this, GAME_WIDTH / 2, by, 340, 70, 'Zur Stadt', () => this.scene.start('City'), { fontSize: 28 });
    } else {
      new Button(this, GAME_WIDTH / 2 - 180, by, 320, 70, 'Zur Stadt', () => this.scene.start('City'), { fontSize: 26, color: COLORS.buttonAlt });
      new Button(this, GAME_WIDTH / 2 + 180, by, 320, 70, 'Nochmal versuchen', () => this.scene.start('Battle', { night: data.night }), { fontSize: 26 });
    }
  }

  /** Rechtsbündige Reihe: Symbol + Menge je Ressource */
  private resourceRow(right: number, y: number, res: Record<string, number>): void {
    let x = right;
    for (const id of [...RESOURCE_IDS].reverse()) {
      const v = res[id];
      if (!v) continue;
      const t = addText(this, x, y, `+${v}`, 20, { origin: [1, 0.5], color: COLORS.gold });
      x -= t.width + 4;
      this.add.image(x - 12, y, RESOURCES[id].icon).setScale(0.6);
      x -= 40;
    }
  }
}
