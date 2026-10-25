import Phaser from 'phaser';
import type { BattleScene } from './battle/BattleScene';
import { saveStore } from './core/save';
import { Button } from './ui/widgets';

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
    /** Findet einen sichtbaren Knopf nach Beschriftung und gibt seine Bildschirm-Position zurück */
    button: (label: string) => {
      const found: { x: number; y: number; enabled: boolean }[] = [];
      const visit = (list: Phaser.GameObjects.GameObject[], cam: Phaser.Cameras.Scene2D.Camera) => {
        for (const o of list) {
          if (o instanceof Button && o.visible && o.labelText.includes(label)) {
            // Knöpfe in der Welt (Kampfmenüs) verschieben sich mit der Kamera, angeheftete nicht
            const m = o.getWorldTransformMatrix();
            found.push({ x: m.tx - cam.scrollX * o.scrollFactorX, y: m.ty - cam.scrollY * o.scrollFactorY, enabled: o.isEnabled() });
          }
          const children = (o as Phaser.GameObjects.Container).list;
          if (Array.isArray(children)) visit(children, cam);
        }
      };
      for (const s of game.scene.getScenes(true)) visit(s.children.list, s.cameras.main);
      return found.find((b) => b.enabled) ?? found[0] ?? null;
    },
    /** Wechselt direkt in eine Szene, z. B. rift.go('Battle', { night: 2 }) */
    go: (key: string, data?: object) => {
      for (const s of game.scene.getScenes(true)) if (s.scene.key !== key) s.scene.stop();
      const target = game.scene.getScene(key);
      if (target.scene.isActive()) target.scene.restart(data);
      else game.scene.start(key, data);
    },
  };
}
