import Phaser from 'phaser';
import { generateAllTextures } from '../game/textures';

/** Erzeugt alle Grafiken und öffnet dann das Hauptmenü. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    generateAllTextures(this);
    this.scene.start('Menu');
  }
}
