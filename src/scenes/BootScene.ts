import Phaser from 'phaser';
import { activeMod } from '../core/mod';
import { generateAllTextures } from '../game/textures';

/** Erzeugt alle Grafiken, ersetzt sie durch eigene Bilder aus der Toolbox und öffnet dann das Hauptmenü. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    generateAllTextures(this);
    void applyCustomImages(this, activeMod.images).then(() => this.scene.start('Menu'));
  }
}

/**
 * Eigene Bilder werden auf die Größe der Platzhalter-Grafik gebracht,
 * damit im Spiel nichts verrutscht (Felder füllen das Feld, alles andere wird eingepasst).
 */
export async function applyCustomImages(scene: Phaser.Scene, images: Record<string, string>): Promise<void> {
  await Promise.all(
    Object.entries(images).map(async ([key, url]) => {
      const img = await loadImage(url);
      if (!img) return;
      const old = scene.textures.exists(key) ? (scene.textures.get(key).getSourceImage() as HTMLImageElement) : null;
      const w = old?.width ?? img.width;
      const h = old?.height ?? img.height;
      if (scene.textures.exists(key)) scene.textures.remove(key);
      const tex = scene.textures.createCanvas(key, w, h);
      if (!tex) return;
      const ctx = tex.getContext();
      const cover = key.startsWith('tile_');
      const scale = cover ? Math.max(w / img.width, h / img.height) : Math.min(w / img.width, h / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      tex.refresh();
    }),
  );
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
