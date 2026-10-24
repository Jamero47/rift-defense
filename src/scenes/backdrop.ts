import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Rng } from '../core/rng';

/** Nachthimmel mit Sternen, Burg-Silhouette und leuchtendem Rift – für Menü, Stadt und Ergebnis. */
export function drawBackdrop(scene: Phaser.Scene, riftColor = 0xc084fc): void {
  const g = scene.add.graphics();
  g.fillGradientStyle(0x0b1026, 0x0b1026, 0x2a1640, 0x2a1640, 1);
  g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  const rng = new Rng(7);
  for (let i = 0; i < 120; i++) {
    g.fillStyle(0xffffff, rng.float(0.2, 0.9));
    g.fillCircle(rng.float(0, GAME_WIDTH), rng.float(0, GAME_HEIGHT * 0.7), rng.float(0.6, 1.8));
  }
  // Rift am Horizont
  const rift = scene.add.image(GAME_WIDTH - 180, GAME_HEIGHT - 220, 'fx_glow').setTint(riftColor).setScale(9, 6).setAlpha(0.5);
  scene.tweens.add({ targets: rift, alpha: 0.75, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  // Burg-Silhouette
  const s = scene.add.graphics();
  s.fillStyle(0x07070f, 1);
  const base = GAME_HEIGHT - 120;
  s.fillRect(0, base, GAME_WIDTH, 120);
  const towers: [number, number, number][] = [[60, 90, 200], [180, 60, 140], [300, 110, 260], [430, 70, 170], [560, 50, 120]];
  for (const [x, w, h] of towers) {
    s.fillRect(x, base - h, w, h);
    for (let bx = x; bx < x + w; bx += 18) s.fillRect(bx, base - h - 12, 10, 12);
    s.fillTriangle(x - 6, base - h - 12, x + w / 2, base - h - 70, x + w + 6, base - h - 12);
  }
  s.fillRect(0, base - 60, 640, 60);
  s.fillStyle(0xfcd34d, 0.8);
  for (const [x, y] of [[90, base - 150], [205, base - 100], [340, base - 200], [460, base - 120], [580, base - 90], [120, base - 40], [500, base - 30]]) {
    s.fillRect(x, y, 8, 12);
  }
}
