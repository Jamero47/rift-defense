import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { addText, pin } from '../ui/widgets';

// Werbung für Belohnungen ("Rewarded Ads").
// Aktuell nur ein Platzhalter mit Countdown. Für die echte App wird hier
// z. B. AdMob über Capacitor angebunden (siehe docs/ROADMAP.md) – der Rest des Spiels bleibt gleich.

export interface AdService {
  /** Zeigt eine Werbung. true = bis zum Ende angesehen → Belohnung geben. */
  showRewarded(scene: Phaser.Scene): Promise<boolean>;
}

class PlaceholderAdService implements AdService {
  showRewarded(scene: Phaser.Scene): Promise<boolean> {
    return new Promise((resolve) => {
      const root = scene.add.container(0, 0).setDepth(5000);
      const bg = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.92).setInteractive();
      const title = addText(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'Werbung (Platzhalter)', 36, { origin: [0.5, 0.5] });
      const count = addText(scene, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, '3', 48, { origin: [0.5, 0.5], color: '#facc15' });
      root.add([bg, title, count]);
      pin(root);
      let left = 3;
      scene.time.addEvent({
        delay: 1000,
        repeat: 2,
        callback: () => {
          left--;
          count.setText(String(left));
          if (left <= 0) {
            root.destroy();
            resolve(true);
          }
        },
      });
    });
  }
}

export const ads: AdService = new PlaceholderAdService();
