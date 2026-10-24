import Phaser from 'phaser';
import { TILE } from '../config';
import { Rng, hashSeed } from '../core/rng';
import { ENEMIES, type EnemyDef } from '../data/enemies';
import { RIFTS, type RiftDef, type TileDef } from '../data/rifts';
import { TOWERS } from '../data/towers';

// Alle Grafiken werden beim Start per Code gezeichnet (Platzhalter-Stil).
// Später können hier echte Bilder geladen werden – die Textur-Schlüssel bleiben gleich.

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

export function css(color: number, alpha = 1): string {
  return `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${alpha})`;
}

/** f > 0 hellt auf, f < 0 dunkelt ab (−1 … 1). */
export function shade(color: number, f: number): number {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  const t = f < 0 ? 0 : 255;
  const p = Math.abs(f);
  return (Math.round((t - r) * p + r) << 16) | (Math.round((t - g) * p + g) << 8) | Math.round((t - b) * p + b);
}

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  draw(ctx);
  tex.refresh();
}

function circle(ctx: Ctx, x: number, y: number, r: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, rot = 0): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fill();
}

function poly(ctx: Ctx, pts: number[], fill: string, stroke?: string, lw = 2): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function glow(ctx: Ctx, x: number, y: number, r: number, color: number, alpha = 0.8): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, css(color, alpha));
  g.addColorStop(1, css(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

export function generateAllTextures(scene: Phaser.Scene): void {
  for (const rift of RIFTS) {
    for (const tile of Object.values(rift.tiles)) {
      make(scene, tileKey(rift.id, tile.id), TILE, TILE, (ctx) => drawTile(ctx, tile, rift));
    }
    make(scene, `portal_${rift.id}`, 96, 128, (ctx) => drawPortal(ctx, rift.color));
  }
  make(scene, 'portal_swirl', 96, 128, drawSwirl);
  for (let lvl = 1; lvl <= 3; lvl++) make(scene, `tower_base_${lvl}`, 64, 64, (ctx) => drawTowerBase(ctx, lvl));
  for (const t of TOWERS) make(scene, `top_${t.id}`, 64, 64, (ctx) => drawTowerTop(ctx, t.id, t.color));
  for (const e of ENEMIES) {
    const size = Math.ceil(e.radius * 3);
    make(scene, `enemy_${e.id}`, size, size, (ctx) => drawEnemy(ctx, e, size / 2));
  }
  make(scene, 'shadow', 48, 24, (ctx) => ellipse(ctx, 24, 12, 22, 10, 'rgba(0,0,0,0.35)'));
  drawProjectiles(scene);
  make(scene, 'king', 64, 76, drawKing);
  drawIcons(scene);
  drawFx(scene);
}

export function tileKey(riftId: string, tileId: string): string {
  return `tile_${riftId}_${tileId}`;
}

// ---------------------------------------------------------------- Felder

function drawTile(ctx: Ctx, def: TileDef, rift: RiftDef): void {
  const S = TILE;
  const rng = new Rng(hashSeed(def.id.length * 31 + def.color, rift.color));
  ctx.fillStyle = css(def.color);
  ctx.fillRect(0, 0, S, S);
  // Struktur
  for (let i = 0; i < 22; i++) {
    circle(ctx, rng.float(0, S), rng.float(0, S), rng.float(1, 3.2), css(shade(def.color, rng.float(-0.2, 0.12)), 0.7));
  }
  if (def.path) {
    for (let i = 0; i < 6; i++) {
      ellipse(ctx, rng.float(6, S - 6), rng.float(6, S - 6), rng.float(2, 4), rng.float(1.5, 3), css(shade(def.color, 0.25), 0.5));
    }
  }
  if (def.buildable) {
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
  }
  drawDeco(ctx, def, rng);
  // Sonderfelder bekommen einen farbigen Rahmen: grün = Bonus, rot = Nachteil
  if (def.towerModifiers) {
    const good = def.towerModifiers.every((m) => m.value >= 0);
    ctx.strokeStyle = good ? 'rgba(134,239,172,0.85)' : 'rgba(248,113,113,0.85)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 6]);
    ctx.strokeRect(4, 4, S - 8, S - 8);
    ctx.setLineDash([]);
  }
}

function drawDeco(ctx: Ctx, def: TileDef, rng: Rng): void {
  const S = TILE;
  const c = S / 2;
  switch (def.deco) {
    case 'tree': {
      ellipse(ctx, c + 4, c + 18, 22, 8, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = '#5b3a1e';
      ctx.fillRect(c - 4, c + 2, 8, 18);
      const greens = [0x1f5d2a, 0x2c7a37, 0x3f9a45];
      for (let i = 0; i < 6; i++) {
        circle(ctx, c + rng.float(-14, 14), c - 6 + rng.float(-12, 8), rng.float(10, 15), css(greens[i % 3]));
      }
      circle(ctx, c - 6, c - 14, 6, 'rgba(160,230,140,0.35)');
      break;
    }
    case 'fern':
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU;
        ellipse(ctx, c + Math.cos(a) * 12, c + Math.sin(a) * 12, 15, 5, css(i % 2 ? 0x3d8b3d : 0x2f6f32), a);
      }
      circle(ctx, c, c, 5, '#24572a');
      break;
    case 'rock':
    case 'meteor': {
      const col = def.deco === 'rock' ? 0x77787c : 0x3b3450;
      ellipse(ctx, c + 3, c + 14, 22, 7, 'rgba(0,0,0,0.3)');
      poly(ctx, [c - 20, c + 10, c - 14, c - 12, c + 4, c - 18, c + 20, c - 4, c + 16, c + 14], css(col), css(shade(col, -0.4)));
      poly(ctx, [c - 12, c - 8, c + 2, c - 14, c + 8, c - 6], css(shade(col, 0.3), 0.7));
      if (def.deco === 'meteor') {
        ctx.strokeStyle = 'rgba(251,146,60,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(c - 10, c + 4);
        ctx.lineTo(c, c - 2);
        ctx.lineTo(c + 8, c + 6);
        ctx.stroke();
      }
      break;
    }
    case 'hill': {
      const g = ctx.createRadialGradient(c, c, 4, c, c, 34);
      g.addColorStop(0, css(shade(def.color, 0.3)));
      g.addColorStop(1, css(def.color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      for (const [x, y] of [[12, 14], [58, 16], [14, 58], [56, 56]]) {
        poly(ctx, [x - 4, y + 3, x, y - 5, x + 4, y + 3], '#7fb069');
      }
      break;
    }
    case 'swamp':
      for (let i = 0; i < 4; i++) ellipse(ctx, rng.float(14, 58), rng.float(14, 58), rng.float(8, 14), rng.float(5, 8), 'rgba(30,70,60,0.85)');
      for (let i = 0; i < 5; i++) circle(ctx, rng.float(10, 62), rng.float(10, 62), 2, 'rgba(160,220,190,0.5)');
      break;
    case 'tar':
      for (let i = 0; i < 4; i++) ellipse(ctx, rng.float(16, 56), rng.float(16, 56), rng.float(12, 18), rng.float(8, 12), 'rgba(10,8,8,0.9)');
      for (let i = 0; i < 4; i++) circle(ctx, rng.float(14, 58), rng.float(14, 58), 2.5, 'rgba(255,255,255,0.25)');
      break;
    case 'scrap':
      ellipse(ctx, c, c + 14, 24, 8, 'rgba(0,0,0,0.3)');
      for (let i = 0; i < 7; i++) {
        const x = c + rng.float(-16, 14);
        const y = c + rng.float(-14, 10);
        const col = rng.pick([0x8b949e, 0x6e7681, 0xa0522d, 0x57606a]);
        poly(ctx, [x, y, x + rng.float(8, 16), y + rng.float(-4, 4), x + rng.float(4, 12), y + rng.float(8, 14)], css(col), 'rgba(0,0,0,0.4)', 1);
      }
      break;
    case 'pipes':
      for (const y of [c - 12, c + 12]) {
        ctx.fillStyle = '#56606b';
        ctx.fillRect(0, y - 7, S, 14);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(0, y - 6, S, 4);
        ctx.fillStyle = '#3c444d';
        ctx.fillRect(c - 4, y - 9, 8, 18);
      }
      break;
    case 'crate':
      ellipse(ctx, c + 2, c + 18, 22, 6, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(c - 18, c - 18, 36, 36);
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 3;
      ctx.strokeRect(c - 18, c - 18, 36, 36);
      ctx.beginPath();
      ctx.moveTo(c - 18, c - 18);
      ctx.lineTo(c + 18, c + 18);
      ctx.moveTo(c + 18, c - 18);
      ctx.lineTo(c - 18, c + 18);
      ctx.stroke();
      break;
    case 'energy':
      glow(ctx, c, c, 30, 0x22d3ee, 0.45);
      ctx.strokeStyle = 'rgba(103,232,249,0.8)';
      ctx.lineWidth = 2;
      for (const [x1, y1, x2, y2] of [[8, 20, 26, 20], [26, 20, 26, 8], [64, 50, 46, 50], [46, 50, 46, 64], [8, 52, 20, 52], [52, 8, 52, 22]]) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      break;
    case 'jammer':
      ctx.strokeStyle = 'rgba(248,113,113,0.7)';
      ctx.lineWidth = 2;
      for (const r of [10, 16]) {
        ctx.beginPath();
        ctx.arc(14, 14, r, 0, Math.PI / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(58, 58, r, Math.PI, Math.PI * 1.5);
        ctx.stroke();
      }
      break;
    case 'conveyor': {
      ctx.fillStyle = '#2a2d33';
      ctx.fillRect(0, 12, S, S - 24);
      ctx.strokeStyle = 'rgba(250,204,21,0.75)';
      ctx.lineWidth = 4;
      for (let x = 6; x < S; x += 22) {
        ctx.beginPath();
        ctx.moveTo(x + 10, c - 12);
        ctx.lineTo(x, c);
        ctx.lineTo(x + 10, c + 12);
        ctx.stroke();
      }
      break;
    }
    case 'crystal':
      glow(ctx, c, c, 32, 0x67e8f9, 0.35);
      for (const [x, y, h, col] of [[c - 10, c + 10, 26, 0x67e8f9], [c + 6, c + 12, 34, 0xa78bfa], [c + 16, c + 14, 18, 0x67e8f9], [c - 2, c + 16, 16, 0xe9d5ff]] as const) {
        poly(ctx, [x - 6, y, x, y - h, x + 6, y], css(col, 0.95), css(shade(col, -0.4)), 1);
        poly(ctx, [x - 2, y - 2, x, y - h + 4, x + 2, y - 2], 'rgba(255,255,255,0.5)');
      }
      break;
    case 'crater':
      ellipse(ctx, c, c, 26, 20, css(shade(def.color, 0.18)));
      ellipse(ctx, c + 2, c + 3, 21, 15, css(shade(def.color, -0.45)));
      break;
    case 'crystalfield':
      glow(ctx, c, c, 34, 0xc084fc, 0.35);
      for (const [x, y] of [[12, 16], [60, 14], [10, 58], [60, 60]]) {
        poly(ctx, [x - 4, y + 5, x, y - 7, x + 4, y + 5], 'rgba(216,180,254,0.95)');
      }
      break;
    case 'stardust':
      for (let i = 0; i < 16; i++) {
        const x = rng.float(4, S - 4);
        const y = rng.float(4, S - 4);
        circle(ctx, x, y, rng.float(0.8, 2), 'rgba(255,255,255,0.75)');
      }
      break;
    case 'gravity':
      ctx.strokeStyle = 'rgba(192,132,252,0.6)';
      ctx.lineWidth = 2;
      for (const r of [8, 16, 24, 32]) {
        ctx.beginPath();
        ctx.arc(c, c, r, 0, TAU);
        ctx.stroke();
      }
      break;
    case 'none':
      break;
  }
}

// ---------------------------------------------------------------- Portal

function drawPortal(ctx: Ctx, color: number): void {
  glow(ctx, 48, 64, 48, color, 0.55);
  ellipse(ctx, 48, 64, 30, 50, css(shade(color, 0.3), 0.9));
  ellipse(ctx, 48, 64, 24, 43, css(shade(color, -0.55)));
  ellipse(ctx, 48, 64, 15, 30, css(0x05030a));
}

function drawSwirl(ctx: Ctx): void {
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 3;
  for (let arm = 0; arm < 3; arm++) {
    ctx.beginPath();
    for (let t = 0; t < 1; t += 0.04) {
      const a = arm * (TAU / 3) + t * 4;
      const x = 48 + Math.cos(a) * t * 26;
      const y = 64 + Math.sin(a) * t * 42;
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- Türme

function drawTowerBase(ctx: Ctx, level: number): void {
  ellipse(ctx, 34, 38, 28, 26, 'rgba(0,0,0,0.35)');
  const g = ctx.createLinearGradient(0, 4, 0, 60);
  g.addColorStop(0, '#9aa0aa');
  g.addColorStop(1, '#5d626c');
  ctx.fillStyle = g;
  roundRect(ctx, 6, 6, 52, 52, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  for (const y of [20, 34, 48]) {
    ctx.beginPath();
    ctx.moveTo(8, y);
    ctx.lineTo(56, y);
    ctx.stroke();
  }
  const trim = level === 1 ? '#3f434b' : level === 2 ? '#d7dde8' : '#f5c542';
  ctx.strokeStyle = trim;
  ctx.lineWidth = level === 1 ? 3 : 4;
  roundRect(ctx, 6, 6, 52, 52, 12);
  ctx.stroke();
}

function drawTowerTop(ctx: Ctx, id: string, color: number): void {
  const c = 32;
  switch (id) {
    case 'bow':
      circle(ctx, c, c, 18, '#7a4a24');
      circle(ctx, c, c, 15, '#94603a');
      circle(ctx, c - 3, c, 7, css(color));
      ctx.strokeStyle = '#3b2412';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(c + 2, c, 16, -1.1, 1.1);
      ctx.stroke();
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(c + 2 + Math.cos(-1.1) * 16, c + Math.sin(-1.1) * 16);
      ctx.lineTo(c + 2 + Math.cos(1.1) * 16, c + Math.sin(1.1) * 16);
      ctx.stroke();
      ctx.strokeStyle = '#d6b48a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(c - 4, c);
      ctx.lineTo(c + 24, c);
      ctx.stroke();
      poly(ctx, [c + 28, c, c + 22, c - 4, c + 22, c + 4], '#cbd5e1');
      break;
    case 'cannon':
      circle(ctx, c, c, 17, '#2f3238');
      circle(ctx, c, c, 13, '#474b54');
      ctx.fillStyle = '#25282d';
      roundRect(ctx, c - 2, c - 7, 30, 14, 4);
      ctx.fill();
      ctx.fillStyle = '#5b5f6b';
      ctx.fillRect(c + 22, c - 9, 6, 18);
      circle(ctx, c - 3, c - 4, 4, 'rgba(255,255,255,0.25)');
      break;
    case 'mage': {
      circle(ctx, c, c, 18, css(shade(color, -0.45)));
      ctx.strokeStyle = css(shade(color, 0.3));
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 2 * TAU) / 5;
        const x = c + Math.cos(a) * 15;
        const y = c + Math.sin(a) * 15;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      glow(ctx, c, c, 16, 0xe9d5ff, 0.9);
      circle(ctx, c, c, 7, '#f5f3ff');
      break;
    }
    case 'frost': {
      glow(ctx, c, c, 26, color, 0.6);
      const pts: number[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        pts.push(c + Math.cos(a) * 17, c + Math.sin(a) * 17);
      }
      poly(ctx, pts, css(shade(color, -0.25)), css(shade(color, 0.5)), 2);
      ctx.strokeStyle = '#f0f9ff';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * 12, c + Math.sin(a) * 12);
        ctx.lineTo(c - Math.cos(a) * 12, c - Math.sin(a) * 12);
        ctx.stroke();
      }
      break;
    }
    case 'ballista':
      ctx.fillStyle = '#6b4423';
      ctx.fillRect(c - 16, c - 4, 32, 8);
      ctx.fillRect(c - 4, c - 16, 8, 32);
      ctx.strokeStyle = css(color);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(c - 8, c, 22, -0.95, 0.95);
      ctx.stroke();
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(c - 8 + Math.cos(-0.95) * 22, c + Math.sin(-0.95) * 22);
      ctx.lineTo(c - 12, c);
      ctx.lineTo(c - 8 + Math.cos(0.95) * 22, c + Math.sin(0.95) * 22);
      ctx.stroke();
      ctx.fillStyle = '#d6d3d1';
      ctx.fillRect(c - 12, c - 2, 38, 4);
      poly(ctx, [c + 30, c, c + 23, c - 6, c + 23, c + 6], '#94a3b8');
      break;
  }
}

// ---------------------------------------------------------------- Gegner (Blickrichtung rechts)

function drawEnemy(ctx: Ctx, def: EnemyDef, c: number): void {
  const r = def.radius;
  const { body, accent, family, variant } = def.look;
  const B = css(body);
  const A = css(accent);
  const dark = css(shade(body, -0.45));
  const eye = (x: number, y: number, s = 2.5) => {
    circle(ctx, x, y, s, '#fff');
    circle(ctx, x + s * 0.3, y, s * 0.55, '#111');
  };
  if (!def.flying) ellipse(ctx, c + 2, c + 3, r * 1.05, r * 0.8, 'rgba(0,0,0,0.28)');

  if (family === 'dino') {
    if (variant === 'air') {
      poly(ctx, [c - r * 0.2, c, c - r * 0.7, c - r * 1.4, c + r * 0.4, c - r * 0.2], A, dark, 1);
      poly(ctx, [c - r * 0.2, c, c - r * 0.7, c + r * 1.4, c + r * 0.4, c + r * 0.2], A, dark, 1);
      ellipse(ctx, c, c, r * 0.7, r * 0.35, B);
      poly(ctx, [c + r * 0.5, c - r * 0.15, c + r * 1.3, c, c + r * 0.5, c + r * 0.15], '#f5deb3');
      poly(ctx, [c + r * 0.3, c, c - r * 0.3, c - r * 0.1, c + r * 0.3, c - r * 0.25], A);
      eye(c + r * 0.45, c - r * 0.1, 2);
      return;
    }
    const slim = variant === 'fast' ? 0.5 : variant === 'tank' ? 0.8 : variant === 'boss' ? 0.72 : 0.62;
    // Schwanz
    poly(ctx, [c - r * 0.7, c - r * 0.25, c - r * (variant === 'fast' ? 1.5 : 1.35), c, c - r * 0.7, c + r * 0.25], B, dark, 1);
    ellipse(ctx, c, c, r, r * slim, B);
    if (variant === 'fast') {
      ctx.strokeStyle = A;
      ctx.lineWidth = 2;
      for (const x of [-0.4, 0, 0.4]) {
        ctx.beginPath();
        ctx.moveTo(c + r * x, c - r * 0.45);
        ctx.lineTo(c + r * x, c + r * 0.45);
        ctx.stroke();
      }
    } else {
      ellipse(ctx, c - r * 0.1, c, r * 0.6, r * slim * 0.35, css(accent, 0.6));
    }
    if (variant === 'tank') {
      ellipse(ctx, c + r * 0.55, c, r * 0.35, r * 0.85, A);
      for (const dy of [-0.3, 0.3]) poly(ctx, [c + r * 0.85, c + r * dy - 3, c + r * 1.55, c + r * dy, c + r * 0.85, c + r * dy + 3], '#f8fafc');
      poly(ctx, [c + r * 1.0, c - 2, c + r * 1.35, c, c + r * 1.0, c + 2], '#f8fafc');
    }
    if (variant === 'special') {
      ctx.strokeStyle = A;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(c + r * 0.9, c);
      ctx.quadraticCurveTo(c + r * 0.4, c - r * 0.2, c - r * 0.3, c - r * 0.1);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
    const headR = variant === 'boss' ? r * 0.55 : r * 0.42;
    circle(ctx, c + r * 0.95, c, headR, B);
    if (variant === 'boss') {
      for (const dy of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          poly(ctx, [c + r * (1.05 + i * 0.12), c + dy * headR * 0.55, c + r * (1.1 + i * 0.12), c + dy * headR * 0.2, c + r * (1.15 + i * 0.12), c + dy * headR * 0.55], '#fff');
        }
      }
      ctx.strokeStyle = A;
      ctx.lineWidth = 3;
      for (const x of [-0.5, -0.15, 0.2]) {
        ctx.beginPath();
        ctx.moveTo(c + r * x, c - r * 0.5);
        ctx.lineTo(c + r * (x + 0.15), c);
        ctx.lineTo(c + r * x, c + r * 0.5);
        ctx.stroke();
      }
    }
    eye(c + r * 1.05, c - headR * 0.45);
    eye(c + r * 1.05, c + headR * 0.45);
    return;
  }

  if (family === 'bot') {
    if (variant === 'air') {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(c - r, c - r);
      ctx.lineTo(c + r, c + r);
      ctx.moveTo(c + r, c - r);
      ctx.lineTo(c - r, c + r);
      ctx.stroke();
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        circle(ctx, c + dx * r, c + dy * r, r * 0.45, 'rgba(203,213,225,0.35)');
        circle(ctx, c + dx * r, c + dy * r, 2, '#e2e8f0');
      }
      circle(ctx, c, c, r * 0.5, B);
      circle(ctx, c + r * 0.15, c, r * 0.22, A);
      return;
    }
    if (variant === 'special') {
      circle(ctx, c, c, r * 0.95, B);
      circle(ctx, c - r * 0.1, c, r * 0.55, '#111827');
      glow(ctx, c + r * 0.75, c, r * 0.9, accent, 0.5);
      ctx.fillStyle = A;
      ctx.fillRect(c + r * 0.45, c - r * 0.55, r * 0.35, r * 1.1);
      ctx.fillStyle = '#052e16';
      ctx.font = `bold ${Math.round(r * 0.5)}px monospace`;
      ctx.fillText('01', c + r * 0.43, c + r * 0.15);
      return;
    }
    const w = variant === 'tank' || variant === 'boss' ? r * 1.7 : variant === 'fast' ? r * 1.4 : r * 1.5;
    const h = variant === 'fast' ? r * 1.1 : w;
    // Ketten / Räder
    ctx.fillStyle = '#1f2937';
    if (variant === 'fast') {
      for (const [dx, dy] of [[-0.45, -0.6], [0.45, -0.6], [-0.45, 0.6], [0.45, 0.6]]) circle(ctx, c + dx * w, c + dy * h, r * 0.28, '#111827');
    } else {
      ctx.fillRect(c - w / 2, c - h / 2 - 4, w, 7);
      ctx.fillRect(c - w / 2, c + h / 2 - 3, w, 7);
    }
    ctx.fillStyle = B;
    roundRect(ctx, c - w / 2, c - h / 2, w, h, 5);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (variant === 'tank' || variant === 'boss') {
      ctx.fillStyle = '#374151';
      ctx.fillRect(c + w * 0.2, c - 3, w * 0.55, 6);
      ctx.fillStyle = A;
      ctx.fillRect(c - w / 2 + 3, c - 2, w * 0.4, 4);
    }
    if (variant === 'boss') {
      for (const dy of [-1, 1]) {
        ctx.fillStyle = '#334155';
        ctx.fillRect(c - w * 0.15, c + dy * h * 0.42 - 5, w * 0.75, 10);
      }
      glow(ctx, c - w * 0.1, c, r * 0.6, accent, 0.9);
    }
    ctx.fillStyle = A;
    ctx.fillRect(c + w / 2 - 6, c - h * 0.3, 4, h * 0.6);
    if (variant === 'normal') {
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(c - 2, c);
      ctx.lineTo(c - w * 0.45, c - h * 0.45);
      ctx.stroke();
      circle(ctx, c - w * 0.45, c - h * 0.45, 2.5, A);
    }
    return;
  }

  // Aliens
  if (variant === 'air') {
    glow(ctx, c, c, r * 1.3, accent, 0.35);
    ellipse(ctx, c, c, r * 1.15, r * 1.15, B);
    ellipse(ctx, c, c, r * 1.15, r * 1.15, css(shade(body, -0.3), 0.5));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      circle(ctx, c + Math.cos(a) * r * 0.9, c + Math.sin(a) * r * 0.9, 2, i % 2 ? '#fde047' : A);
    }
    circle(ctx, c, c, r * 0.55, css(accent, 0.85));
    circle(ctx, c - r * 0.15, c - r * 0.15, r * 0.18, 'rgba(255,255,255,0.7)');
    return;
  }
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  const legs = variant === 'normal' ? 3 : variant === 'boss' ? 4 : 2;
  for (let i = 0; i < legs; i++) {
    const x = c + r * (-0.5 + i * (1 / Math.max(1, legs - 1)));
    for (const dy of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x, c);
      ctx.lineTo(x - r * 0.25, c + dy * r * 1.25);
      ctx.stroke();
    }
  }
  const rx = variant === 'fast' ? r * 1.15 : r;
  const ry = variant === 'fast' ? r * 0.6 : r * 0.9;
  ellipse(ctx, c, c, rx, ry, B);
  if (variant === 'special' || variant === 'boss') {
    for (const [dx, dy, s] of [[-0.4, -0.4, 0.3], [-0.5, 0.35, 0.25], [0.1, 0.5, 0.2], [0.05, -0.55, 0.22]]) {
      circle(ctx, c + dx * r, c + dy * r, s * r, css(accent, 0.85));
    }
  }
  if (variant === 'tank') {
    ctx.strokeStyle = A;
    ctx.lineWidth = 3;
    for (const x of [-0.35, 0.05]) {
      ctx.beginPath();
      ctx.arc(c + x * r, c, r * 0.7, -1.2, 1.2);
      ctx.stroke();
    }
  }
  if (variant === 'boss') {
    for (let i = -2; i <= 2; i++) {
      const y = c + i * r * 0.28;
      poly(ctx, [c - r * 0.85, y - 4, c - r * 1.35, y, c - r * 0.85, y + 4], A);
    }
  }
  const eyes = variant === 'boss' ? 4 : 2;
  for (let i = 0; i < eyes; i++) {
    const dy = (i - (eyes - 1) / 2) * r * 0.32;
    eye(c + rx * 0.6, c + dy, variant === 'boss' ? 3.5 : 2.5);
  }
}

// ---------------------------------------------------------------- Projektile

function drawProjectiles(scene: Phaser.Scene): void {
  make(scene, 'proj_arrow', 22, 8, (ctx) => {
    ctx.fillStyle = '#c8a27a';
    ctx.fillRect(2, 3, 14, 2);
    poly(ctx, [22, 4, 15, 0, 15, 8], '#e2e8f0');
    poly(ctx, [0, 1, 5, 4, 0, 7], '#f1f5f9');
  });
  make(scene, 'proj_ball', 14, 14, (ctx) => {
    circle(ctx, 7, 7, 6, '#1f2328');
    circle(ctx, 5, 5, 2, 'rgba(255,255,255,0.45)');
  });
  make(scene, 'proj_bolt', 32, 10, (ctx) => {
    ctx.fillStyle = '#d6d3d1';
    ctx.fillRect(2, 4, 22, 3);
    poly(ctx, [32, 5, 22, 0, 22, 10], '#94a3b8');
    poly(ctx, [0, 1, 7, 5, 0, 9], '#f97316');
  });
  make(scene, 'proj_shard', 18, 12, (ctx) => {
    glow(ctx, 9, 6, 9, 0x7fd3f7, 0.7);
    poly(ctx, [18, 6, 9, 1, 0, 6, 9, 11], '#e0f2fe', '#7dd3fc', 1);
  });
  make(scene, 'proj_royal', 22, 22, (ctx) => {
    glow(ctx, 11, 11, 11, 0xfde047, 0.8);
    const pts: number[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const rr = i % 2 ? 4 : 9;
      pts.push(11 + Math.cos(a) * rr, 11 + Math.sin(a) * rr);
    }
    poly(ctx, pts, '#facc15', '#a16207', 1);
  });
}

// ---------------------------------------------------------------- König

function drawKing(ctx: Ctx): void {
  const c = 32;
  ellipse(ctx, c, 70, 20, 5, 'rgba(0,0,0,0.35)');
  // Umhang
  poly(ctx, [c - 18, 70, c - 10, 30, c + 10, 30, c + 18, 70], '#b91c1c', '#7f1d1d');
  poly(ctx, [c - 12, 70, c - 7, 36, c + 7, 36, c + 12, 70], '#1e3a8a');
  // Hermelin-Kragen
  ellipse(ctx, c, 33, 13, 5, '#f8fafc');
  for (const x of [-7, 0, 7]) circle(ctx, c + x, 33, 1.3, '#111');
  // Kopf
  circle(ctx, c, 22, 9, '#f1c27d');
  ellipse(ctx, c, 29, 7, 4, '#8b5a2b');
  circle(ctx, c - 3, 21, 1.3, '#111');
  circle(ctx, c + 3, 21, 1.3, '#111');
  // Krone
  poly(ctx, [c - 10, 15, c - 10, 5, c - 5, 10, c, 2, c + 5, 10, c + 10, 5, c + 10, 15], '#facc15', '#a16207', 1.5);
  circle(ctx, c, 11, 1.8, '#ef4444');
  // Schwert
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(c + 17, 24, 4, 30);
  ctx.fillStyle = '#a16207';
  ctx.fillRect(c + 13, 52, 12, 4);
  ctx.fillRect(c + 17, 55, 4, 8);
}

// ---------------------------------------------------------------- Symbole

function drawIcons(scene: Phaser.Scene): void {
  const S = 40;
  make(scene, 'icon_gold', S, S, (ctx) => {
    circle(ctx, 20, 20, 16, '#b45309');
    circle(ctx, 20, 20, 14, '#facc15');
    circle(ctx, 20, 20, 9, '#eab308');
    circle(ctx, 15, 14, 4, 'rgba(255,255,255,0.6)');
  });
  make(scene, 'icon_holz', S, S, (ctx) => {
    ctx.fillStyle = '#8b5a2b';
    roundRect(ctx, 4, 12, 30, 16, 6);
    ctx.fill();
    ellipse(ctx, 33, 20, 5, 8, '#d6a76c');
    ctx.strokeStyle = '#8b5a2b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(33, 20, 2.5, 4.5, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#5b3a1e';
    ctx.beginPath();
    ctx.moveTo(8, 18);
    ctx.lineTo(24, 18);
    ctx.moveTo(10, 23);
    ctx.lineTo(26, 23);
    ctx.stroke();
  });
  make(scene, 'icon_metall', S, S, (ctx) => {
    poly(ctx, [6, 30, 11, 14, 29, 14, 34, 30], '#9aa5b1', '#4b5563');
    poly(ctx, [11, 14, 29, 14, 27, 18, 13, 18], '#e5e7eb');
  });
  make(scene, 'icon_kristall', S, S, (ctx) => {
    glow(ctx, 20, 20, 18, 0x67e8f9, 0.5);
    poly(ctx, [20, 3, 32, 15, 20, 37, 8, 15], '#67e8f9', '#0e7490');
    poly(ctx, [20, 3, 24, 15, 20, 37, 16, 15], '#cffafe');
  });
  make(scene, 'icon_heart', S, S, (ctx) => {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(20, 34);
    ctx.bezierCurveTo(2, 22, 6, 6, 20, 13);
    ctx.bezierCurveTo(34, 6, 38, 22, 20, 34);
    ctx.fill();
    circle(ctx, 13, 15, 3, 'rgba(255,255,255,0.5)');
  });
  make(scene, 'icon_wall', S, S, (ctx) => {
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(4, 14, 32, 22);
    for (const x of [4, 15, 26]) ctx.fillRect(x, 8, 8, 8);
    ctx.fillStyle = '#4b2e14';
    roundRect(ctx, 15, 22, 10, 14, 4);
    ctx.fill();
  });
  make(scene, 'icon_crown', S, S, (ctx) => {
    poly(ctx, [5, 31, 5, 12, 13, 21, 20, 8, 27, 21, 35, 12, 35, 31], '#facc15', '#a16207');
    circle(ctx, 20, 24, 3, '#ef4444');
  });
  make(scene, 'icon_eye', S, S, (ctx) => {
    glow(ctx, 20, 20, 18, 0xc084fc, 0.4);
    ctx.fillStyle = '#f5f3ff';
    ctx.beginPath();
    ctx.moveTo(3, 20);
    ctx.quadraticCurveTo(20, 4, 37, 20);
    ctx.quadraticCurveTo(20, 36, 3, 20);
    ctx.fill();
    circle(ctx, 20, 20, 7, '#7c3aed');
    circle(ctx, 20, 20, 3, '#111');
  });
  make(scene, 'icon_hammer', S, S, (ctx) => {
    ctx.save();
    ctx.translate(20, 20);
    ctx.rotate(-0.7);
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(-3, -4, 6, 22);
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(-12, -14, 24, 11);
    ctx.fillStyle = '#d1d5db';
    ctx.fillRect(-12, -14, 24, 3);
    ctx.restore();
  });
  make(scene, 'icon_skull', S, S, (ctx) => {
    circle(ctx, 20, 17, 13, '#e5e7eb');
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(13, 24, 14, 10);
    circle(ctx, 15, 17, 4, '#111');
    circle(ctx, 25, 17, 4, '#111');
    ctx.fillStyle = '#111';
    for (const x of [15, 19, 23]) ctx.fillRect(x, 29, 2, 5);
  });
  make(scene, 'icon_air', S, S, (ctx) => {
    ctx.fillStyle = '#bae6fd';
    ctx.beginPath();
    ctx.moveTo(4, 26);
    ctx.quadraticCurveTo(18, 4, 36, 10);
    ctx.quadraticCurveTo(26, 16, 30, 20);
    ctx.quadraticCurveTo(20, 22, 22, 28);
    ctx.quadraticCurveTo(12, 26, 4, 26);
    ctx.fill();
  });
  make(scene, 'icon_bolt', S, S, (ctx) => {
    glow(ctx, 20, 20, 18, 0x4ade80, 0.5);
    poly(ctx, [23, 2, 9, 22, 19, 22, 15, 38, 31, 16, 21, 16], '#4ade80', '#14532d', 1.5);
  });
  make(scene, 'icon_arrows', S, S, (ctx) => {
    for (const x of [10, 20, 30]) {
      ctx.fillStyle = '#d6b48a';
      ctx.fillRect(x - 1, 4, 2, 24);
      poly(ctx, [x, 36, x - 5, 26, x + 5, 26], '#e5e7eb');
    }
  });
}

// ---------------------------------------------------------------- Effekte

function drawFx(scene: Phaser.Scene): void {
  make(scene, 'fx_circle', 64, 64, (ctx) => circle(ctx, 32, 32, 30, '#ffffff'));
  make(scene, 'fx_glow', 64, 64, (ctx) => glow(ctx, 32, 32, 32, 0xffffff, 1));
  make(scene, 'fx_ring', 128, 128, (ctx) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, TAU);
    ctx.stroke();
  });
}
