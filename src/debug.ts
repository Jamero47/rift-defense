import type Phaser from 'phaser';
import type { BattleScene } from './battle/BattleScene';
import { saveStore } from './core/save';

// Hilfen für Tests und Entwicklung. Nur aktiv, wenn die Adresse "?debug" enthält,
// z. B. http://localhost:5173/?debug  → dann in der Browser-Konsole: rift.battle().debugInfo()

declare global {
  interface Window {
    rift?: Record<string, unknown>;
  }
}

export function installDebug(game: Phaser.Game): void {
  if (!new URLSearchParams(location.search).has('debug')) return;
  window.rift = {
    game,
    save: saveStore,
    scenes: () => game.scene.getScenes(true).map((s) => s.scene.key),
    battle: () => game.scene.getScene('Battle') as BattleScene,
    /** Wechselt direkt in eine Szene, z. B. rift.go('Battle', { night: 2 }) */
    go: (key: string, data?: object) => {
      for (const s of game.scene.getScenes(true)) s.scene.stop();
      game.scene.start(key, data);
    },
  };
}
