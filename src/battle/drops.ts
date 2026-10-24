import Phaser from 'phaser';
import { BALANCE } from '../config';
import type { ResourceId, Vec } from '../core/types';
import { RESOURCES, RIFT_CRYSTAL } from '../data/resources';

// Beute, die Gegner (oder abgebaute Felder) fallen lassen: Sie bleibt kurz liegen
// und fliegt dann von selbst in die Anzeige. Gutgeschrieben wird beim Ankommen.

export type DropKind = 'crystal' | ResourceId;

interface PendingDrop {
  sprite: Phaser.GameObjects.Image;
  kind: DropKind;
  amount: number;
  done: boolean;
}

export class DropManager {
  private pending: PendingDrop[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
    /** Wohin fliegt welche Beute? */
    private readonly target: (kind: DropKind) => Vec,
    /** Wird beim Ankommen aufgerufen */
    private readonly credit: (kind: DropKind, amount: number) => void,
  ) {}

  spawn(x: number, y: number, kind: DropKind, amount: number): void {
    if (amount <= 0) return;
    const icon = kind === 'crystal' ? RIFT_CRYSTAL.icon : RESOURCES[kind].icon;
    const sprite = this.scene.add.image(x, y, icon).setDepth(this.depth).setScale(kind === 'crystal' ? 0.4 : 0.5);
    const drop: PendingDrop = { sprite, kind, amount, done: false };
    this.pending.push(drop);
    // Kleiner Hüpfer beim Fallenlassen
    const ox = (Math.random() - 0.5) * 30;
    this.scene.tweens.add({ targets: sprite, x: x + ox, y: y - 16, duration: 180, ease: 'Quad.easeOut', yoyo: true });
    this.scene.time.delayedCall(BALANCE.dropLingerSeconds * 1000 + Math.random() * 300, () => this.fly(drop));
  }

  private fly(drop: PendingDrop): void {
    if (drop.done) return;
    const t = this.target(drop.kind);
    this.scene.tweens.add({
      targets: drop.sprite, x: t.x, y: t.y, scale: 0.3, duration: 550, ease: 'Cubic.easeIn',
      onComplete: () => this.finish(drop),
    });
  }

  private finish(drop: PendingDrop): void {
    if (drop.done) return;
    drop.done = true;
    this.credit(drop.kind, drop.amount);
    drop.sprite.destroy();
    this.pending = this.pending.filter((d) => d !== drop);
  }

  /** Alles sofort gutschreiben (z. B. am Ende der Nacht). */
  flushAll(): void {
    for (const d of [...this.pending]) {
      this.scene.tweens.killTweensOf(d.sprite);
      this.finish(d);
    }
  }
}
