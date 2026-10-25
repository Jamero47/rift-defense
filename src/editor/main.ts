import Phaser from 'phaser';
import { RESOURCE_IDS } from '../core/types';
import {
  SECTION_DATA, deepMerge, diff, fetchProjectMod, loadLocalData, loadLocalImages, saveLocalData, saveLocalImages,
  type ModFile, type SectionId,
} from '../core/mod';
import { PLOT_KIND_LABELS, type PlotDef } from '../data/city';
import { ENEMIES } from '../data/enemies';
import { RIFTS } from '../data/rifts';
import { TOWERS } from '../data/towers';
import { generateAllTextures } from '../game/textures';
import { COLOR_KEYS, HINTS, LONG_TEXT, READONLY, label } from './labels';

// Toolbox: Spielwerte ändern und Grafiken austauschen – ohne Programmieren.
// Änderungen werden sofort in diesem Browser gespeichert und gelten beim nächsten Start des Spiels.
// "Exportieren" erzeugt eine Datei (mod.json), die man fest ins Projekt legen kann.

type Obj = Record<string, unknown>;
type Path = (string | number)[];

interface SectionDef {
  id: SectionId | 'graphics' | 'help';
  group: string;
  title: string;
  intro: string;
  /** Name eines Listeneintrags (für Listen-Bereiche) */
  itemName?: (item: Obj) => string;
}

const SECTIONS: SectionDef[] = [
  { id: 'help', group: 'Start', title: 'So funktioniert’s', intro: '' },
  { id: 'towers', group: 'Nacht-Sphäre', title: 'Türme', intro: 'Schaden, Tempo, Reichweite, Krit, Mana und Kosten (Rift-Kristalle) je Stufe.', itemName: (t) => String(t.name) },
  { id: 'enemies', group: 'Nacht-Sphäre', title: 'Gegner', intro: 'Leben, Tempo, Rüstung, Beute und Fähigkeiten der Gegner.', itemName: (e) => String(e.name) },
  { id: 'king', group: 'Nacht-Sphäre', title: 'König', intro: 'Grundwerte des Königs und seines Pfeilhagels.' },
  { id: 'cards', group: 'Nacht-Sphäre', title: 'Upgrade-Karten', intro: 'Die Karten, die man alle paar Wellen wählen darf.', itemName: (c) => String(c.name) },
  { id: 'rifts', group: 'Nacht-Sphäre', title: 'Rifts & Felder', intro: 'Felder mit Boni/Mali, Rohstoffe zum Abbauen, Sondereffekte.', itemName: (r) => String(r.name) },
  { id: 'balance', group: 'Nacht-Sphäre', title: 'Balancing', intro: 'Schwierigkeit, Startwerte, Beute, Werbung.' },
  { id: 'buildings', group: 'Tag-Sphäre', title: 'Gebäude', intro: 'Bau- und Ausbaukosten, Ertrag und Verbesserungen.', itemName: (b) => String(b.name) },
  { id: 'plots', group: 'Tag-Sphäre', title: 'Bauplätze', intro: 'Lage in der Stadt und Freischaltung (Gold oder Thronsaal-Stufe).', itemName: (p) => plotName(p as unknown as PlotDef) },
  { id: 'research', group: 'Tag-Sphäre', title: 'Forschung', intro: 'Forschungsbaum (Universität) und Magiebaum (Magiergilde). Spalte/Zeile = Lage im Baum.', itemName: (r) => String(r.name) },
  { id: 'story', group: 'Tag-Sphäre', title: 'Story-Nächte', intro: 'Texte und Nacht der Story-Kämpfe.', itemName: (s) => `Nacht ${s.night}: ${s.title}` },
  { id: 'city', group: 'Tag-Sphäre', title: 'Stadt-Einstellungen', intro: 'Bauzeit und Startressourcen eines neuen Spiels.' },
  { id: 'graphics', group: 'Grafik', title: 'Grafiken', intro: '' },
];

// ---------------------------------------------------------------- Zustand

const clone = <T>(v: T): T => structuredClone(v);
/** Standardwerte aus dem Code */
const defaults = clone(SECTION_DATA) as unknown as Record<SectionId, unknown>;
/** Code + feste Projekt-Mod (public/mods/mod.json) */
let base = clone(defaults);
/** Was gerade in der Toolbox eingestellt ist */
let working = clone(defaults);
let projectImages: Record<string, string> = {};
let localImages: Record<string, string> = {};
let current: SectionDef = SECTIONS[0];
let currentItem = 0;
let generated: Record<string, { url: string; w: number; h: number }> = {};

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Obj = {}, ...children: (Node | string | null)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = String(v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v as EventListener);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null) e.append(c);
  return e;
}

function plotName(p: PlotDef): string {
  return `${PLOT_KIND_LABELS[p.kind] ?? p.kind} (${p.id})`;
}

// ---------------------------------------------------------------- Laden & Speichern

async function init(): Promise<void> {
  const project = await fetchProjectMod();
  projectImages = project.images;
  // Die Toolbox arbeitet auf Kopien – die echten Spieldaten bleiben unverändert
  base = clone(defaults);
  applyTo(base, project.data);
  working = clone(base);
  applyTo(working, loadLocalData());
  localImages = await loadLocalImages();
  renderNav();
  select(SECTIONS[0]);
  void generateTextures();
}

/** Wie applyModData im Spiel, aber auf eine Kopie der Daten. */
function applyTo(target: Record<SectionId, unknown>, data: ModFile['data']): void {
  for (const [id, value] of Object.entries(data)) {
    if (id in target && value !== undefined) deepMerge(target[id as SectionId], value);
  }
}

/** Unterschiede zu "base" speichern = Änderungen dieses Browsers. */
function persist(): void {
  const data: ModFile['data'] = {};
  for (const id of Object.keys(working) as SectionId[]) {
    const d = diff(base[id], working[id]);
    if (d !== undefined) data[id] = d;
  }
  saveLocalData(data);
  updateStatus();
}

function changedCount(): number {
  let n = 0;
  for (const id of Object.keys(working) as SectionId[]) if (diff(base[id], working[id]) !== undefined) n++;
  return n + (Object.keys(localImages).length > 0 ? 1 : 0);
}

function updateStatus(): void {
  const n = changedCount();
  const imgs = Object.keys(localImages).length;
  $('#status').textContent = n === 0
    ? 'Keine eigenen Änderungen.'
    : `Eigene Änderungen in diesem Browser${imgs ? ` (davon ${imgs} Grafik${imgs === 1 ? '' : 'en'})` : ''} – gelten beim nächsten Spielstart.`;
  for (const btn of document.querySelectorAll<HTMLElement>('[data-section]')) {
    const id = btn.dataset.section as SectionId;
    const changed = id === ('graphics' as SectionId)
      ? Object.keys(localImages).length > 0
      : id in working && diff(base[id], working[id]) !== undefined;
    btn.classList.toggle('changed', changed);
  }
}

// ---------------------------------------------------------------- Werte lesen/schreiben

function getAt(root: unknown, path: Path): unknown {
  let v: unknown = root;
  for (const p of path) {
    if (v === null || v === undefined) return undefined;
    v = (v as Record<string | number, unknown>)[p];
  }
  return v;
}

function setAt(root: unknown, path: Path, value: unknown): void {
  let v = root as Record<string | number, unknown>;
  for (const p of path.slice(0, -1)) v = v[p] as Record<string | number, unknown>;
  const last = path[path.length - 1];
  if (value === undefined) delete v[last];
  else v[last] = value;
}

// ---------------------------------------------------------------- Navigation

function renderNav(): void {
  const nav = $('#nav');
  nav.innerHTML = '';
  let group = '';
  for (const s of SECTIONS) {
    if (s.group !== group) {
      group = s.group;
      nav.append(el('div', { class: 'nav-group' }, group));
    }
    nav.append(el('button', { class: 'nav-item', 'data-section': s.id, onclick: () => select(s) }, s.title));
  }
}

function select(s: SectionDef, item = 0): void {
  current = s;
  currentItem = item;
  for (const b of document.querySelectorAll<HTMLElement>('.nav-item')) b.classList.toggle('active', b.dataset.section === s.id);
  render();
  updateStatus();
  $('#main').scrollTop = 0;
}

function render(): void {
  const main = $('#main');
  main.innerHTML = '';
  main.append(el('h1', {}, current.title));
  if (current.intro) main.append(el('p', { class: 'intro' }, current.intro));
  if (current.id === 'help') return renderHelp(main);
  if (current.id === 'graphics') return renderGraphics(main);
  const id = current.id as SectionId;
  const data = working[id];
  if (Array.isArray(data)) {
    const list = el('div', { class: 'items' });
    data.forEach((item, i) => {
      const changed = diff((base[id] as unknown[])[i], item) !== undefined;
      list.append(el('button', {
        class: `item${i === currentItem ? ' active' : ''}${changed ? ' changed' : ''}`,
        onclick: () => select(current, i),
      }, current.itemName?.(item as Obj) ?? `Eintrag ${i + 1}`));
    });
    main.append(list);
    const item = data[currentItem] as Obj;
    const card = el('div', { class: 'card' });
    card.append(el('div', { class: 'card-head' },
      el('h2', {}, current.itemName?.(item) ?? ''),
      el('button', { class: 'small', onclick: () => resetPath([currentItem]) }, 'Diesen Eintrag zurücksetzen')));
    renderObject(card, id, [currentItem], item);
    main.append(card);
  } else {
    const card = el('div', { class: 'card' });
    card.append(el('div', { class: 'card-head' }, el('span', {}), el('button', { class: 'small', onclick: () => resetPath([]) }, 'Bereich zurücksetzen')));
    renderObject(card, id, [], data as Obj);
    main.append(card);
  }
}

function resetPath(path: Path): void {
  const id = current.id as SectionId;
  if (path.length === 0) working[id] = clone(base[id]);
  else setAt(working[id], path, clone(getAt(base[id], path)));
  persist();
  render();
}

// ---------------------------------------------------------------- Formulare

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isResourceObj = (v: unknown) => isObj(v) && Object.keys(v).length > 0 && Object.keys(v).every((k) => (RESOURCE_IDS as readonly string[]).includes(k));
const RESOURCE_KEYS = new Set(['cost', 'income', 'harvest', 'loot', 'startResources']);

function renderObject(parent: HTMLElement, id: SectionId, path: Path, obj: Obj): void {
  const grid = el('div', { class: 'grid' });
  parent.append(grid);
  // Wichtigstes zuerst: Stufen-Tabellen direkt unter den Grundwerten
  const first = ['levels', 'upgrades'];
  const entries = Object.entries(obj).sort(([a], [b]) => Number(first.includes(b)) - Number(first.includes(a)));
  for (const [key, value] of entries) {
    const p = [...path, key];
    if (key === 'id') continue;
    if (Array.isArray(value)) {
      parent.append(renderArray(id, p, key, value));
    } else if (isObj(value) && (RESOURCE_KEYS.has(key) || isResourceObj(value))) {
      parent.append(fieldset(key, renderResources(id, p, value)));
    } else if (isObj(value)) {
      const box = el('div', {});
      renderObject(box, id, p, value);
      parent.append(fieldset(key, box));
    } else {
      grid.append(field(id, p, key, value));
    }
  }
}

function fieldset(key: string, content: HTMLElement): HTMLElement {
  return el('fieldset', {}, el('legend', {}, label(key)), content);
}

function isChanged(id: SectionId, path: Path): boolean {
  return JSON.stringify(getAt(base[id], path)) !== JSON.stringify(getAt(working[id], path));
}

function field(id: SectionId, path: Path, key: string, value: unknown): HTMLElement {
  const wrap = el('label', { class: `field${isChanged(id, path) ? ' changed' : ''}` });
  wrap.append(el('span', { class: 'label' }, label(key)));
  wrap.append(input(id, path, key, value, wrap));
  if (HINTS[key]) wrap.append(el('span', { class: 'hint' }, HINTS[key]));
  return wrap;
}

/** Eingabefeld passend zum Wert. `marker` bekommt die Klasse "changed", wenn der Wert vom Projektstand abweicht. */
function input(id: SectionId, path: Path, key: string, value: unknown, marker: HTMLElement): HTMLElement {
  const commit = (v: unknown) => {
    setAt(working[id], path, v);
    marker.classList.toggle('changed', isChanged(id, path));
    persist();
    if (key === 'name' || key === 'title') render();
  };
  if (READONLY.has(key) || (typeof value === 'string' && /^[a-z_]+$/.test(value) && !LONG_TEXT.has(key) && key !== 'name')) {
    return el('span', { class: 'readonly' }, value === undefined ? '–' : String(value));
  }
  if (typeof value === 'boolean') {
    const i = el('input', { type: 'checkbox' }) as HTMLInputElement;
    i.checked = value;
    i.addEventListener('change', () => commit(i.checked));
    return i;
  }
  if (typeof value === 'number' && COLOR_KEYS.has(key)) {
    const i = el('input', { type: 'color', value: `#${value.toString(16).padStart(6, '0')}` }) as HTMLInputElement;
    i.addEventListener('input', () => commit(parseInt(i.value.slice(1), 16)));
    return i;
  }
  if (typeof value === 'number' || value === undefined) {
    const i = el('input', { type: 'number', step: 'any', value: value ?? '', placeholder: '–' }) as HTMLInputElement;
    i.addEventListener('change', () => {
      if (i.value.trim() === '') return commit(undefined);
      const n = Number(i.value.replace(',', '.'));
      if (Number.isFinite(n)) commit(n);
    });
    return i;
  }
  if (typeof value === 'string') {
    const long = LONG_TEXT.has(key) || value.length > 50;
    const i = (long ? el('textarea', { rows: 3 }) : el('input', { type: 'text' })) as HTMLInputElement;
    i.value = value;
    i.addEventListener('change', () => commit(i.value));
    return i;
  }
  return el('span', { class: 'readonly' }, JSON.stringify(value));
}

/** Gold/Holz/Stein/Magie/Nahrung als eine Zeile */
function renderResources(id: SectionId, path: Path, obj: Obj): HTMLElement {
  const row = el('div', { class: 'resources' });
  for (const r of RESOURCE_IDS) {
    const p = [...path, r];
    const wrap = el('label', { class: `field res${isChanged(id, p) ? ' changed' : ''}` }, el('span', { class: 'label' }, label(r)));
    wrap.append(input(id, p, r, obj[r], wrap));
    row.append(wrap);
  }
  return row;
}

function renderArray(id: SectionId, path: Path, key: string, arr: unknown[]): HTMLElement {
  // Liste aus Texten (z. B. Kennungen) → nur anzeigen
  if (arr.every((v) => typeof v === 'string')) {
    return el('div', { class: 'field wide' }, el('span', { class: 'label' }, label(key)), el('span', { class: 'readonly' }, arr.join(', ') || '–'));
  }
  // Liste aus Zahlen → nebeneinander
  if (arr.every((v) => typeof v === 'number')) {
    const row = el('div', { class: 'inline' });
    arr.forEach((v, i) => {
      const p = [...path, i];
      const w = el('label', { class: `field mini${isChanged(id, p) ? ' changed' : ''}` }, el('span', { class: 'label' }, `${i + 1}.`));
      w.append(input(id, p, key, v, w));
      row.append(w);
    });
    return fieldset(key, row);
  }
  const objs = arr.filter(isObj);
  // Kosten-Listen (z. B. Gebäudestufen) → Tabelle mit allen Ressourcen
  if (objs.length === arr.length && objs.every((o) => Object.keys(o).every((k) => (RESOURCE_IDS as readonly string[]).includes(k)))) {
    return fieldset(key, table(id, path, objs, [...RESOURCE_IDS], key));
  }
  // Flache Objekte (z. B. Turmstufen) → Tabelle
  const flat = objs.length === arr.length && objs.every((o) => Object.values(o).every((v) => !Array.isArray(v) && (!isObj(v) || Object.values(v).every((x) => typeof x !== 'object'))));
  if (flat && objs.length > 0) {
    const rows: string[] = [];
    for (const o of objs) {
      for (const [k, v] of Object.entries(o)) {
        if (isObj(v)) for (const sub of Object.keys(v)) { if (!rows.includes(`${k}.${sub}`)) rows.push(`${k}.${sub}`); }
        else if (!rows.includes(k)) rows.push(k);
      }
    }
    return fieldset(key, table(id, path, objs, rows, key));
  }
  // Sonst: jeder Eintrag als eigener Block
  const box = el('div', { class: 'blocks' });
  objs.forEach((o, i) => {
    const b = el('div', { class: 'block' }, el('div', { class: 'block-title' }, String(o.name ?? o.type ?? `${label(key)} ${i + 1}`)));
    renderObject(b, id, [...path, i], o);
    box.append(b);
  });
  return fieldset(key, box);
}

function table(id: SectionId, path: Path, objs: Obj[], rows: string[], key: string): HTMLElement {
  const colName = (i: number) => (key === 'levels' ? (id === 'buildings' ? (i === 0 ? 'Bauen' : `→ Stufe ${i + 1}`) : `Stufe ${i + 1}`) : key === 'costs' ? `Rang ${i + 1}` : `${i + 1}`);
  const t = el('table', {});
  t.append(el('tr', {}, el('th', {}), ...objs.map((_, i) => el('th', {}, colName(i)))));
  for (const r of rows) {
    const [k, sub] = r.split('.');
    const tr = el('tr', {}, el('th', { class: 'row-label' }, sub ? `${label(k)}: ${label(sub)}` : label(k)));
    objs.forEach((o, i) => {
      const p = sub ? [...path, i, k, sub] : [...path, i, k];
      const v = sub ? (o[k] as Obj | undefined)?.[sub] : o[k];
      const td = el('td', { class: isChanged(id, p) ? 'changed' : '' });
      if (sub && !isObj(o[k])) td.append(el('span', { class: 'readonly' }, '–'));
      else td.append(input(id, p, sub ?? k, v, td));
      tr.append(td);
    });
    t.append(tr);
  }
  return el('div', { class: 'table-wrap' }, t);
}

// ---------------------------------------------------------------- Grafiken

/** Erzeugt die Platzhalter-Grafiken des Spiels in einem unsichtbaren Phaser, um sie als Vorschau zu zeigen. */
function generateTextures(): Promise<void> {
  return new Promise((resolve) => {
    const holder = el('div', { style: 'position:absolute;left:-9999px;width:2px;height:2px;overflow:hidden' });
    document.body.append(holder);
    new Phaser.Game({
      type: Phaser.CANVAS, parent: holder, width: 2, height: 2, banner: false, audio: { noAudio: true },
      scene: {
        create(this: Phaser.Scene) {
          generateAllTextures(this);
          for (const key of this.textures.getTextureKeys()) {
            if (key.startsWith('__')) continue;
            const src = this.textures.get(key).getSourceImage() as HTMLCanvasElement;
            if (src instanceof HTMLCanvasElement) generated[key] = { url: src.toDataURL(), w: src.width, h: src.height };
          }
          this.game.destroy(true);
          holder.remove();
          if (current.id === 'graphics') render();
          resolve();
        },
      },
    });
  });
}

const GRAPHIC_GROUPS: { title: string; test: (k: string) => boolean }[] = [
  { title: 'Türme (Sockel + drehbarer Aufsatz)', test: (k) => k.startsWith('top_') || k.startsWith('tower_base') },
  { title: 'Gegner (Blick nach rechts)', test: (k) => k.startsWith('enemy_') },
  { title: 'König, Portale, Geschosse', test: (k) => k === 'king' || k.startsWith('portal') || k.startsWith('proj_') },
  { title: 'Felder: Urzeit', test: (k) => k.startsWith('tile_urzeit') },
  { title: 'Felder: Tech', test: (k) => k.startsWith('tile_tech') },
  { title: 'Felder: Weltraum', test: (k) => k.startsWith('tile_weltraum') },
  { title: 'Symbole (Ressourcen, Gebäude, Knöpfe)', test: (k) => k.startsWith('icon_') },
  { title: 'Effekte', test: (k) => k.startsWith('fx_') || k === 'shadow' },
];

function graphicName(key: string): string {
  if (key.startsWith('top_')) return `${TOWERS.find((t) => `top_${t.id}` === key)?.name ?? key} – Aufsatz`;
  if (key.startsWith('tower_base_')) return `Turmsockel Stufe ${key.slice(-1)}`;
  if (key.startsWith('enemy_')) return ENEMIES.find((e) => `enemy_${e.id}` === key)?.name ?? key;
  if (key.startsWith('tile_')) {
    for (const r of RIFTS) for (const t of Object.values(r.tiles)) if (key === `tile_${r.id}_${t.id}`) return t.name;
  }
  const names: Record<string, string> = {
    king: 'König', portal_swirl: 'Portal-Wirbel', icon_gold: 'Gold', icon_holz: 'Holz', icon_stein: 'Stein', icon_kristall: 'Magiekristalle',
    icon_nahrung: 'Nahrung', icon_rift: 'Rift-Kristall', icon_heart: 'Tor-Leben', icon_crown: 'Krone (Thronsaal)', icon_wall: 'Mauer',
    icon_eye: 'Auge (Orakel)', icon_hammer: 'Hammer', icon_pick: 'Spitzhacke', icon_book: 'Buch (Universität)', icon_boot: 'Stiefel',
    icon_lock: 'Schloss', icon_skull: 'Totenkopf (Welle)', icon_air: 'Flügel (Luft)', icon_bolt: 'Blitz', icon_arrows: 'Pfeile (Pfeilhagel)',
    proj_arrow: 'Pfeil', proj_ball: 'Kanonenkugel', proj_bolt: 'Bolzen', proj_shard: 'Eissplitter', proj_royal: 'Königsgeschoss',
    shadow: 'Schatten', fx_circle: 'Kreis', fx_glow: 'Leuchten', fx_ring: 'Ring',
  };
  if (key.startsWith('portal_') && key !== 'portal_swirl') return `Portal ${RIFTS.find((r) => `portal_${r.id}` === key)?.shortName ?? ''}`;
  return names[key] ?? key;
}

function renderGraphics(main: HTMLElement): void {
  main.append(el('p', { class: 'intro' },
    'Tippe bei einem Bild auf „Bild wählen“ und lade ein eigenes Bild hoch (am besten PNG mit transparentem Hintergrund). ',
    'Es wird automatisch auf die richtige Größe gebracht. Gegner und Turm-Aufsätze sollten nach rechts schauen.'));
  if (Object.keys(generated).length === 0) {
    main.append(el('p', {}, 'Grafiken werden geladen …'));
    return;
  }
  const keys = Object.keys(generated);
  for (const g of GRAPHIC_GROUPS) {
    const groupKeys = keys.filter(g.test);
    if (groupKeys.length === 0) continue;
    main.append(el('h2', {}, g.title));
    const gallery = el('div', { class: 'gallery' });
    for (const key of groupKeys) gallery.append(graphicCard(key));
    main.append(gallery);
  }
}

function graphicCard(key: string): HTMLElement {
  const info = generated[key];
  const custom = localImages[key] ?? projectImages[key];
  const isLocal = key in localImages;
  const file = el('input', { type: 'file', accept: 'image/png,image/webp,image/jpeg,image/gif', style: 'display:none' }) as HTMLInputElement;
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    localImages[key] = await resizeImage(f, info.w * 2, info.h * 2, key.startsWith('tile_'));
    await saveLocalImages(localImages);
    render();
    updateStatus();
  });
  const card = el('div', { class: `gcard${isLocal ? ' changed' : ''}` },
    el('div', { class: 'gpreview' }, el('img', { src: custom ?? info.url, alt: graphicName(key) })),
    el('div', { class: 'gname' }, graphicName(key)),
    el('div', { class: 'gsize' }, `${key} · empfohlen ${info.w * 2}×${info.h * 2} px`),
    el('div', { class: 'gbuttons' },
      el('button', { onclick: () => file.click() }, 'Bild wählen'),
      isLocal ? el('button', {
        class: 'small', onclick: async () => {
          delete localImages[key];
          await saveLocalImages(localImages);
          render();
          updateStatus();
        },
      }, 'Zurücksetzen') : null,
      custom && !isLocal ? el('span', { class: 'hint' }, 'aus dem Projekt') : null),
    file);
  return card;
}

/** Verkleinert das Bild auf höchstens die doppelte Spielgröße (spart Speicher). */
function resizeImage(file: File, maxW: number, maxH: number, cover: boolean): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = maxW;
        c.height = maxH;
        const ctx = c.getContext('2d')!;
        const s = cover ? Math.max(maxW / img.width, maxH / img.height) : Math.min(maxW / img.width, maxH / img.height);
        ctx.drawImage(img, (maxW - img.width * s) / 2, (maxH - img.height * s) / 2, img.width * s, img.height * s);
        resolve(c.toDataURL('image/png'));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------- Hilfe, Export, Import

function renderHelp(main: HTMLElement): void {
  main.append(el('div', { class: 'card help' },
    el('h2', {}, 'Werte ändern'),
    el('p', {}, 'Wähle links einen Bereich, z. B. „Türme“, dann einen Eintrag. Ändere die Zahlen – sie werden sofort in diesem Browser gespeichert. Geänderte Felder sind gelb markiert, mit „zurücksetzen“ kommt der alte Wert zurück.'),
    el('h2', {}, 'Im Spiel ausprobieren'),
    el('p', {}, 'Tippe oben auf „Spiel öffnen“. Das Spiel lädt deine Änderungen beim Start. Im Hauptmenü steht dann unten links „Toolbox-Änderungen aktiv“. Läuft das Spiel schon, lade die Seite neu.'),
    el('h2', {}, 'Grafiken austauschen'),
    el('p', {}, 'Unter „Grafiken“ siehst du alle Bilder des Spiels. Bei jedem Bild kannst du ein eigenes hochladen (PNG mit transparentem Hintergrund ist am besten).'),
    el('h2', {}, 'Für alle Spieler:innen übernehmen'),
    el('p', {}, 'Deine Änderungen gelten zunächst nur in diesem Browser. Um sie fest ins Spiel zu übernehmen: „Exportieren“ tippen – es wird die Datei mod.json heruntergeladen. Diese Datei auf GitHub im Ordner public/mods hochladen (Repository → public → mods → Add file → Upload files) oder Claude schicken. Danach gilt sie für alle.'),
    el('h2', {}, 'Wichtig'),
    el('p', {}, 'Die Toolbox ändert nur Werte, Texte und Bilder – keine neuen Türme oder Gebäude. Dafür und für neue Spielregeln: Claude fragen. Spielstände bleiben erhalten; bei großen Änderungen (z. B. Gebäudekosten) kann ein „Neues Spiel“ sinnvoll sein.'),
  ));
}

function exportMod(): void {
  const data: ModFile['data'] = {};
  for (const id of Object.keys(working) as SectionId[]) {
    const d = diff(defaults[id], working[id]);
    if (d !== undefined) data[id] = d;
  }
  const mod: ModFile = { version: 1, data, images: { ...projectImages, ...localImages } };
  const blob = new Blob([JSON.stringify(mod, null, 2)], { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: 'mod.json' });
  document.body.append(a);
  a.click();
  a.remove();
}

function importMod(file: File): void {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const mod = JSON.parse(String(reader.result)) as Partial<ModFile>;
      working = clone(defaults);
      applyTo(working, mod.data ?? {});
      localImages = {};
      for (const [k, v] of Object.entries(mod.images ?? {})) if (projectImages[k] !== v) localImages[k] = v;
      await saveLocalImages(localImages);
      persist();
      render();
      alert('Datei geladen. Die Änderungen sind jetzt in diesem Browser aktiv.');
    } catch {
      alert('Diese Datei konnte nicht gelesen werden.');
    }
  };
  reader.readAsText(file);
}

async function resetAll(): Promise<void> {
  if (!confirm('Alle eigenen Änderungen in diesem Browser löschen (Werte und Grafiken)?')) return;
  working = clone(base);
  localImages = {};
  await saveLocalImages({});
  persist();
  render();
}

// ---------------------------------------------------------------- Start

$('#btn-export').addEventListener('click', exportMod);
$('#btn-reset').addEventListener('click', () => void resetAll());
const importInput = $('#import-file') as HTMLInputElement;
$('#btn-import').addEventListener('click', () => importInput.click());
importInput.addEventListener('change', () => {
  const f = importInput.files?.[0];
  if (f) importMod(f);
  importInput.value = '';
});
void init();
