import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { riftForNight } from '../core/progression';
import { activeMod } from '../core/mod';
import { saveStore } from '../core/save';
import { openDevPanel } from '../ui/devPanel';
import { Button, COLORS, addText, showDialog, soundToggle } from '../ui/widgets';
import { drawBackdrop } from './backdrop';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    const save = saveStore.get();
    drawBackdrop(this, riftForNight(save.seed, save.night).color);

    const title = addText(this, GAME_WIDTH / 2, 120, 'RIFT DEFENSE', 92, { origin: [0.5, 0.5], color: COLORS.gold, stroke: true });
    this.tweens.add({ targets: title, scale: 1.03, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    addText(
      this, GAME_WIDTH / 2, 205,
      'Du bist König der Stadt Eldenmark. Jede Nacht öffnet sich vor deinen Toren ein Rift\nund verwandelt das Land. Baue deine Türme neu – und halte das Tor!',
      22, { origin: [0.5, 0.5], align: 'center', bold: false, stroke: true },
    );

    const progress = save.stats.bestNight > 0
      ? `Nächste Nacht: ${save.night}   ·   Beste Nacht: ${save.stats.bestNight}`
      : 'Deine erste Nacht wartet.';
    addText(this, GAME_WIDTH / 2, 270, progress, 20, { origin: [0.5, 0.5], color: COLORS.muted, stroke: true });

    new Button(this, GAME_WIDTH / 2, 360, 340, 76, 'Spielen', () => this.scene.start('City'), { fontSize: 32 });
    new Button(this, GAME_WIDTH / 2 - 90, 455, 160, 56, 'Vollbild', () => this.toggleFullscreen(), { color: COLORS.buttonAlt, fontSize: 20 });
    new Button(this, GAME_WIDTH / 2 + 90, 455, 160, 56, 'Neues Spiel', () => this.confirmReset(), { color: COLORS.danger, fontSize: 20 });
    soundToggle(this, GAME_WIDTH / 2, 530, 340, 50);
    new Button(this, GAME_WIDTH - 236, 668, 160, 44, 'Entwickler', () => openDevPanel(this), { color: 0x0e7490, fontSize: 17 });
    new Button(this, GAME_WIDTH - 80, 668, 136, 44, 'Toolbox', () => window.open('./editor.html', '_blank'), {
      color: COLORS.buttonAlt, fontSize: 17,
    });
    addText(this, GAME_WIDTH - 12, 712, 'v0.2 · Prototyp', 14, { origin: [1, 1], color: COLORS.muted });
    if (activeMod.localActive) {
      addText(this, 12, 712, 'Toolbox-Änderungen aktiv (nur in diesem Browser)', 15, { origin: [0, 1], color: COLORS.gold, stroke: true });
    }
  }

  private toggleFullscreen(): void {
    if (this.scale.isFullscreen) {
      this.scale.stopFullscreen();
      return;
    }
    this.scale.startFullscreen();
    // Auf Android im Vollbild Querformat festhalten (geht nicht überall)
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    orientation.lock?.('landscape').catch(() => undefined);
  }

  private confirmReset(): void {
    showDialog(this, 'Neues Spiel?', 'Dein gesamter Fortschritt (Nächte, Ressourcen, Gebäude) wird gelöscht.', [
      { label: 'Ja, alles löschen', color: COLORS.danger, onClick: () => { saveStore.reset(); this.scene.restart(); } },
      { label: 'Abbrechen', color: COLORS.buttonAlt, onClick: () => undefined },
    ]);
  }
}
