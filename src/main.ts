import Phaser from 'phaser';
import { BattleScene } from './battle/BattleScene';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { loadMods } from './core/mod';
import { installDebug } from './debug';
import { saveStore } from './core/save';
import { sfx } from './services/sound';
import { BootScene } from './scenes/BootScene';
import { CityScene } from './scenes/CityScene';
import { MenuScene } from './scenes/MenuScene';
import { ResultScene } from './scenes/ResultScene';

// Einstiegspunkt: startet Phaser mit allen Szenen.
// Ablauf: Boot → Menü → Stadt → Kampf (Nacht) → Ergebnis → Stadt → …
// Die Toolbox (editor.html) ist eine eigene Seite daneben.

// Erst Änderungen aus der Toolbox laden, dann das Spiel starten
await loadMods();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#05060d',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 2 },
  scene: [BootScene, MenuScene, CityScene, BattleScene, ResultScene],
});

installDebug(game);

// Ton: Browser erlauben ihn erst nach dem ersten Antippen
sfx.setEnabled(saveStore.get().settings.sound);
window.addEventListener('pointerdown', () => sfx.unlock());
