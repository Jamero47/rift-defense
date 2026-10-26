import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { sfx } from '../services/sound';
import { pin } from './widgets';

// Rift-Effekte für den Wechsel zwischen Tag und Nacht und für neu beschworene Türme.
// Verzerrung über den Barrel-Filter der Kamera (nur WebGL); ohne WebGL bleiben Zoom, Drehung und Lichtblitz.

/** Wirbelndes Rift-Portal: wächst auf, dreht sich und verschwindet wieder. */
export function riftBurst(scene: Phaser.Scene, x: number, y: number, color: number, size: number, duration: number, depth: number): void {
  const glow = scene.add.image(x, y, 'fx_glow').setTint(color).setDepth(depth).setScale(0).setAlpha(0.9);
  const swirl = scene.add.image(x, y, 'portal_swirl').setTint(color).setDepth(depth + 0.1).setScale(0);
  const core = scene.add.image(x, y, 'fx_glow').setTint(0x05040c).setDepth(depth + 0.05).setScale(0).setAlpha(0.85);
  const s = size / 96;
  scene.tweens.add({ targets: swirl, angle: 540, duration, ease: 'Sine.easeInOut' });
  scene.tweens.add({ targets: [glow, swirl], scale: s, duration: duration * 0.4, ease: 'Back.easeOut', yoyo: true, hold: duration * 0.2 });
  scene.tweens.add({ targets: core, scale: s * 0.6, duration: duration * 0.4, yoyo: true, hold: duration * 0.2 });
  scene.time.delayedCall(duration + 50, () => [glow, swirl, core].forEach((o) => o.destroy()));
}

type Barrel = { amount: number };

function addBarrel(cam: Phaser.Cameras.Scene2D.Camera): Barrel | null {
  try {
    const filters = (cam as unknown as { filters?: { internal: { addBarrel(a: number): Barrel; remove(f: unknown): void } } }).filters;
    return filters?.internal.addBarrel(1) ?? null;
  } catch {
    return null;
  }
}

function removeBarrel(cam: Phaser.Cameras.Scene2D.Camera, barrel: Barrel | null): void {
  if (!barrel) return;
  try {
    (cam as unknown as { filters: { internal: { remove(f: unknown): void } } }).filters.internal.remove(barrel);
  } catch {
    // Kamera schon weg
  }
}

/** Lichtblitz in Rift-Farbe über dem ganzen Bildschirm */
function flash(scene: Phaser.Scene, color: number, from: number, to: number, duration: number, delay = 0): Phaser.GameObjects.Rectangle {
  const rect = pin(scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH * 3, GAME_HEIGHT * 3, color, 1).setDepth(9000).setAlpha(from));
  scene.tweens.add({ targets: rect, alpha: to, duration, delay, ease: 'Quad.easeIn' });
  return rect;
}

/**
 * Die Welt wird in einen Rift bei (x, y) gesaugt: Verzerrung, Zoom, Drehung, Lichtblitz.
 * Danach `onDone` (z. B. Szenenwechsel).
 */
export function warpOut(scene: Phaser.Scene, x: number, y: number, color: number, onDone: () => void, duration = 1300): void {
  const cam = scene.cameras.main;
  const barrel = addBarrel(cam);
  sfx.play('warpOut');
  riftBurst(scene, x, y, color, 520, duration * 1.4, 8000);
  cam.pan(x, y, duration, 'Sine.easeIn');
  cam.zoomTo(2.6, duration, 'Cubic.easeIn');
  scene.tweens.add({ targets: cam, rotation: 0.5, duration, ease: 'Cubic.easeIn' });
  if (barrel) scene.tweens.add({ targets: barrel, amount: 0.15, duration, ease: 'Cubic.easeIn' });
  flash(scene, color, 0, 1, duration * 0.45, duration * 0.55);
  scene.time.delayedCall(duration + 60, () => {
    removeBarrel(cam, barrel);
    onDone();
  });
}

/** Die neue Welt „warpt“ aus dem Rift herein: Lichtblitz verblasst, Verzerrung und Zoom lösen sich auf. */
export function warpIn(scene: Phaser.Scene, color: number, duration = 1100, onDone?: () => void): void {
  const cam = scene.cameras.main;
  const barrel = addBarrel(cam);
  sfx.play('warpIn');
  const zoom = cam.zoom;
  cam.setZoom(zoom * 2.4);
  cam.setRotation(-0.5);
  if (barrel) {
    barrel.amount = 0.15;
    scene.tweens.add({ targets: barrel, amount: 1, duration, ease: 'Cubic.easeOut' });
  }
  scene.tweens.add({ targets: cam, zoom, rotation: 0, duration, ease: 'Cubic.easeOut' });
  const rect = flash(scene, color, 1, 0, duration * 0.7);
  riftBurst(scene, cam.scrollX + cam.width / 2, cam.scrollY + cam.height / 2, color, 420, duration, 8000);
  scene.time.delayedCall(duration + 60, () => {
    removeBarrel(cam, barrel);
    rect.destroy();
    onDone?.();
  });
}
