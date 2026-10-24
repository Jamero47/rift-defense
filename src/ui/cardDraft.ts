import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { RARITIES, type CardDef } from '../data/cards';
import type { StatKey, TowerTag } from '../core/types';
import { shade } from '../game/textures';
import { Button, COLORS, addText } from './widgets';

// Auswahl von 1 aus 3 Upgrade-Karten. Erst antippen = auswählen, dann bestätigen.

export interface DraftOptions {
  cards: CardDef[];
  owned: readonly string[];
  rerolls: number;
  onReroll: () => CardDef[];
  onPick: (card: CardDef) => void;
}

const TAG_ICON: Partial<Record<TowerTag, string>> = {
  bow: 'top_bow', cannon: 'top_cannon', mage: 'top_mage', frost: 'top_frost', antiair: 'top_ballista',
};

const STAT_ICON: Partial<Record<StatKey, string>> = {
  damage: 'icon_hammer', attackSpeed: 'icon_bolt', range: 'icon_eye', projectiles: 'icon_arrows',
  goldGain: 'icon_gold', interest: 'icon_gold', kingDamage: 'icon_crown', kingAbilityCooldown: 'icon_crown',
  enemySpeed: 'icon_skull', airDamage: 'icon_air', splashRadius: 'top_cannon', chainTargets: 'top_mage',
  slowStrength: 'top_frost', armorPen: 'icon_metall', critChance: 'icon_kristall', towerCost: 'icon_wall',
};

export function cardIcon(card: CardDef): string {
  if (card.instant?.gold) return 'icon_gold';
  if (card.instant?.heal) return 'icon_heart';
  const m = card.modifiers?.[0];
  if (!m) return 'icon_kristall';
  if (m.towerTags?.length === 1 && TAG_ICON[m.towerTags[0]] && m.stat !== 'projectiles') return TAG_ICON[m.towerTags[0]]!;
  return STAT_ICON[m.stat] ?? 'icon_kristall';
}

export function showCardDraft(scene: Phaser.Scene, opts: DraftOptions): void {
  const root = scene.add.container(0, 0).setDepth(1000);
  root.add(scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05040c, 0.82).setInteractive());
  root.add(addText(scene, GAME_WIDTH / 2, 62, 'Wähle ein Upgrade', 40, { origin: [0.5, 0.5], color: COLORS.gold, stroke: true }));
  root.add(addText(scene, GAME_WIDTH / 2, 102, 'Es gilt für den Rest dieser Nacht.', 19, { origin: [0.5, 0.5], color: COLORS.muted, bold: false }));

  let cards = opts.cards;
  let rerolls = opts.rerolls;
  let selected = -1;
  let views: Phaser.GameObjects.Container[] = [];

  const confirm = new Button(scene, GAME_WIDTH / 2, 655, 380, 64, 'Karte antippen', () => {
    if (selected < 0) return;
    const card = cards[selected];
    root.destroy();
    opts.onPick(card);
  }, { enabled: false, fontSize: 24 });
  root.add(confirm);

  const reroll = new Button(scene, 1110, 655, 230, 56, `Neu würfeln (${rerolls})`, () => {
    if (rerolls <= 0) return;
    rerolls--;
    cards = opts.onReroll();
    render();
  }, { color: COLORS.buttonAlt, fontSize: 19 });
  reroll.setVisible(rerolls > 0);
  root.add(reroll);

  const select = (i: number) => {
    if (selected === i) {
      // Zweites Antippen derselben Karte = nehmen
      const card = cards[selected];
      root.destroy();
      opts.onPick(card);
      return;
    }
    selected = i;
    views.forEach((v, j) => {
      scene.tweens.add({ targets: v, scale: j === i ? 1.06 : 0.95, alpha: j === i ? 1 : 0.7, y: j === i ? 362 : 380, duration: 150 });
    });
    confirm.setEnabled(true).setLabel(`»${cards[i].name}« nehmen`);
  };

  const render = () => {
    views.forEach((v) => v.destroy());
    views = [];
    selected = -1;
    confirm.setEnabled(false).setLabel('Karte antippen');
    reroll.setLabel(`Neu würfeln (${rerolls})`).setEnabled(rerolls > 0);
    cards.forEach((card, i) => {
      const v = makeCard(scene, card, opts.owned.filter((id) => id === card.id).length);
      v.setPosition(GAME_WIDTH / 2 + (i - (cards.length - 1) / 2) * 330, 380);
      const zone = scene.add.zone(0, 0, 300, 380).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => select(i));
      v.add(zone);
      root.add(v);
      views.push(v);
      v.setScale(0.8).setAlpha(0);
      scene.tweens.add({ targets: v, scale: 1, alpha: 1, duration: 220, delay: i * 80, ease: 'Back.easeOut' });
    });
  };
  render();
}

function makeCard(scene: Phaser.Scene, card: CardDef, owned: number): Phaser.GameObjects.Container {
  const w = 300;
  const h = 380;
  const rarity = RARITIES[card.rarity];
  const c = scene.add.container(0, 0);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.45);
  g.fillRoundedRect(-w / 2 + 4, -h / 2 + 8, w, h, 18);
  g.fillStyle(0x1b1830, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
  g.fillStyle(rarity.color, 0.95);
  g.fillRoundedRect(-w / 2, -h / 2, w, 46, { tl: 18, tr: 18, bl: 0, br: 0 });
  g.fillStyle(shade(rarity.color, -0.6), 0.6);
  g.fillCircle(0, -62, 62);
  g.lineStyle(5, rarity.color, 1);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
  c.add(g);
  c.add(addText(scene, 0, -h / 2 + 23, rarity.name.toUpperCase(), 20, { origin: [0.5, 0.5], color: '#111111' }));
  const icon = scene.add.image(0, -62, cardIcon(card));
  icon.setScale(Math.min(2.2, 84 / icon.width));
  c.add(icon);
  c.add(addText(scene, 0, 30, card.name, 26, { origin: [0.5, 0.5], align: 'center', wrap: w - 30 }));
  c.add(addText(scene, 0, 64, card.description, 19, { origin: [0.5, 0], align: 'center', wrap: w - 36, bold: false }));
  if (owned > 0) c.add(addText(scene, 0, h / 2 - 24, `Bereits gewählt: ${owned}×`, 15, { origin: [0.5, 0.5], color: COLORS.muted }));
  return c;
}
