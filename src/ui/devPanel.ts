import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { applyDevCheats, setInfinite } from '../core/dev';
import { saveStore } from '../core/save';
import { wavesForNight } from '../core/wavegen';
import { Button, COLORS, addText, drawPanel, pin } from './widgets';

// Entwickler-Fenster: Entwicklermodus an/aus, unendliche Ressourcen, sofort bauen,
// Nacht und Start-Welle wählen. Im Kampf zusätzlich: zu einer Welle springen, Welle/Nacht gewinnen.

export interface DevPanelOptions {
  /** Nur im Kampf: aktuelle Nacht und Welle, plus Aktionen */
  battle?: {
    night: number;
    waveCount: number;
    jumpToWave: (wave: number) => void;
    winWave: () => void;
    winNight: () => void;
  };
  /** Wird nach jeder Änderung aufgerufen (z. B. Anzeige auffrischen) */
  onChange?: () => void;
}

const MAX_NIGHT = 99;

export function openDevPanel(scene: Phaser.Scene, opts: DevPanelOptions = {}): void {
  const root = pin(scene.add.container(0, 0).setDepth(6000));
  const render = () => {
    root.removeAll(true);
    const save = saveStore.get();
    const dev = save.settings.dev;
    const battle = opts.battle;
    const night = battle?.night ?? save.night;
    const waves = battle?.waveCount ?? wavesForNight(night);
    const w = 600;
    const h = 500;
    const x = (GAME_WIDTH - w) / 2;
    const y = (GAME_HEIGHT - h) / 2;
    const shield = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setInteractive();
    const g = scene.add.graphics();
    drawPanel(g, x, y, w, h, { border: 0x22d3ee });
    root.add([shield, g, scene.add.zone(x + w / 2, y + h / 2, w, h).setInteractive()]);
    root.add(addText(scene, x + 24, y + 18, 'Entwicklermodus', 28, { color: '#22d3ee' }));
    root.add(new Button(scene, x + w - 34, y + 34, 52, 44, 'X', () => root.destroy(), { color: COLORS.danger, fontSize: 20 }));

    const change = (fn: () => void) => {
      saveStore.update(() => fn());
      opts.onChange?.();
      render();
    };
    const toggle = (cy: number, label: string, on: boolean, set: (v: boolean) => void) => {
      root.add(new Button(scene, x + w / 2, cy, w - 48, 50, `${label}: ${on ? 'AN' : 'aus'}`, () => change(() => set(!on)), {
        color: on ? 0x0e7490 : COLORS.buttonAlt, fontSize: 20,
      }));
    };
    const stepper = (cy: number, label: string, value: number, min: number, max: number, set: (v: number) => void) => {
      root.add(addText(scene, x + 24, cy, label, 20, { origin: [0, 0.5] }));
      const bx = x + w - 236;
      for (const [dx, d, txt] of [[-70, -10, '−10'], [-10, -1, '−'], [110, 1, '+'], [170, 10, '+10']] as const) {
        root.add(new Button(scene, bx + dx, cy, d === 1 || d === -1 ? 50 : 56, 44, txt, () => change(() => set(Phaser.Math.Clamp(value + d, min, max))), {
          color: COLORS.buttonAlt, fontSize: 18,
        }));
      }
      root.add(addText(scene, bx + 50, cy, String(value), 26, { origin: [0.5, 0.5], color: COLORS.gold }));
    };

    let cy = y + 96;
    toggle(cy, 'DEV-Knöpfe in Stadt und Kampf', dev.enabled, (v) => (saveStore.get().settings.dev.enabled = v));
    cy += 62;
    toggle(cy, 'Unendliche Ressourcen', dev.infinite, (v) => setInfinite(saveStore.get(), v));
    cy += 62;
    toggle(cy, 'Sofort bauen & forschen', dev.instant, (v) => (saveStore.get().settings.dev.instant = v));
    cy += 70;
    if (!battle) {
      stepper(cy, 'Nacht', save.night, 1, MAX_NIGHT, (v) => {
        const d = saveStore.get();
        d.night = v;
        d.settings.dev.startWave = Math.min(d.settings.dev.startWave, wavesForNight(v));
      });
      cy += 62;
    }
    stepper(cy, battle ? 'Welle' : 'Start-Welle', Math.min(dev.startWave, waves), 1, waves, (v) => (saveStore.get().settings.dev.startWave = v));
    cy += 70;
    if (battle) {
      root.add(new Button(scene, x + w / 2, cy, w - 48, 52, `Zu Welle ${Math.min(dev.startWave, waves)} springen`, () => {
        battle.jumpToWave(Math.min(saveStore.get().settings.dev.startWave, waves));
        root.destroy();
      }, { fontSize: 20 }));
      cy += 64;
      root.add(new Button(scene, x + w / 2 - 140, cy, 264, 52, 'Welle gewinnen', () => {
        battle.winWave();
        root.destroy();
      }, { fontSize: 20, color: 0x15803d }));
      root.add(new Button(scene, x + w / 2 + 140, cy, 264, 52, 'Nacht gewinnen', () => {
        battle.winNight();
        root.destroy();
      }, { fontSize: 20, color: 0x15803d }));
      cy += 64;
    } else {
      root.add(new Button(scene, x + w / 2, cy, w - 48, 58, `Nacht ${night} ab Welle ${Math.min(dev.startWave, waves)} starten`, () => {
        root.destroy();
        scene.scene.start('Battle', { night, startWave: Math.min(saveStore.get().settings.dev.startWave, waves), warp: true });
      }, { fontSize: 22, color: COLORS.royal }));
      cy += 70;
    }
    root.add(addText(scene, x + w / 2, y + h - 22, 'Nur zum Testen – „Unendlich“ aus = echte Ressourcen zurück.', 14, {
      origin: [0.5, 0.5], color: COLORS.muted, bold: false,
    }));
    pin(root);
  };
  saveStore.update((d) => applyDevCheats(d));
  render();
}
