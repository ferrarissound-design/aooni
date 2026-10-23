import { Dir } from '../core/constants';
import { makeCanvas, outline, P, shade } from './pixel';

export const DIRS: Dir[] = ['down', 'left', 'right', 'up'];

interface HumanPal {
  hair: string; skin: string; shirt: string; shirt2: string; pants: string; shoe: string; eye: string;
  long?: boolean; scarf?: string; skirt?: boolean;
}

export const PLAYER_PAL: HumanPal = {
  hair: '#1c1612', skin: '#dcb08e', shirt: '#c9c9cf', shirt2: '#2a2e44', pants: '#22232c', shoe: '#120e0c', eye: '#140c0a',
};
export const SAKI_PAL: HumanPal = {
  hair: '#3a2014', skin: '#e0b898', shirt: '#d0ccc8', shirt2: '#26304a', pants: '#26304a', shoe: '#2a1810', eye: '#140c0a',
  long: true, scarf: '#a02428', skirt: true,
};

/** 16x24 human frame. frame: 0 stand, 1 step A, 2 step B */
function drawHuman(p: P, dir: Dir, frame: number, c: HumanPal) {
  const step = frame === 0 ? 0 : frame === 1 ? 1 : -1;
  const bob = frame === 0 ? 0 : 1;
  const y0 = bob ? 1 : 0;
  const skinD = shade(c.skin, -0.18);
  if (dir === 'down' || dir === 'up') {
    // legs
    const lA = step === 1 ? 1 : 0, lB = step === -1 ? 1 : 0;
    if (c.skirt) {
      p.r(4, 16 + y0, 8, 3, c.pants); p.h(4, 18 + y0, 8, shade(c.pants, -0.3));
      p.r(5, 19 + y0, 2, 3 - lA, c.skin); p.r(9, 19 + y0, 2, 3 - lB, c.skin);
    } else {
      p.r(5, 17 + y0, 2, 5 - lA, c.pants); p.r(9, 17 + y0, 2, 5 - lB, c.pants);
    }
    p.r(5, 22 - lA, 2, 1, c.shoe); p.r(9, 22 - lB, 2, 1, c.shoe);
    p.r(4, 22 - lA, 1, 1, c.shoe); p.r(11, 22 - lB, 1, 1, c.shoe);
    // torso
    p.r(4, 10 + y0, 8, 7, c.shirt);
    p.h(4, 16 + y0, 8, shade(c.shirt, -0.25));
    if (dir === 'down') { p.v(7, 11 + y0, 4, shade(c.shirt, -0.15)); p.r(7, 10 + y0, 2, 2, c.shirt2); }
    // arms swing opposite to legs
    const aL = step === -1 ? 1 : 0, aR = step === 1 ? 1 : 0;
    p.r(2, 10 + y0 + aL, 2, 6, c.shirt); p.r(12, 10 + y0 + aR, 2, 6, c.shirt);
    p.r(2, 16 + y0 + aL, 2, 1, c.skin); p.r(12, 16 + y0 + aR, 2, 1, c.skin);
    if (c.scarf) { p.r(4, 10 + y0, 8, 2, c.scarf); if (dir === 'down') p.r(8, 12 + y0, 2, 3, c.scarf); }
    // head
    p.r(4, 2 + y0, 8, 8, c.skin);
    p.h(4, 9 + y0, 8, skinD);
    p.r(3, 1 + y0, 10, 3, c.hair);
    p.r(3, 3 + y0, 1, 5, c.hair); p.r(12, 3 + y0, 1, 5, c.hair);
    if (dir === 'down') {
      p.r(4, 4 + y0, 3, 1, c.hair); p.r(9, 4 + y0, 2, 1, c.hair);
      p.p(6, 6 + y0, c.eye); p.p(9, 6 + y0, c.eye);
      p.p(6, 7 + y0, shade(c.skin, -0.05)); p.p(9, 7 + y0, shade(c.skin, -0.05));
      if (c.long) { p.r(3, 8 + y0, 1, 4, c.hair); p.r(12, 8 + y0, 1, 4, c.hair); }
    } else {
      p.r(3, 1 + y0, 10, 8, c.hair);
      p.h(4, 8 + y0, 8, shade(c.hair, 0.12));
      if (c.long) { p.r(6, 9 + y0, 4, 4, c.hair); p.r(7, 2 + y0, 2, 1, c.scarf ?? c.hair); }
    }
    p.h(4, 1 + y0, 8, shade(c.hair, 0.15));
  } else {
    const flip = dir === 'left';
    const X = (x: number) => (flip ? 15 - x : x);
    const R = (x: number, y: number, w: number, h: number, col: string) => {
      if (flip) p.r(16 - x - w, y, w, h, col); else p.r(x, y, w, h, col);
    };
    // legs
    const fwd = step;
    if (c.skirt) {
      R(5, 16 + y0, 7, 3, c.pants);
      R(6 + fwd, 19 + y0, 2, 3, c.skin); R(8 - fwd, 19 + y0, 2, 3, shade(c.skin, -0.15));
    } else {
      R(6 + fwd, 17 + y0, 2, 5, c.pants); R(8 - fwd, 17 + y0, 2, 5, shade(c.pants, -0.2));
    }
    R(6 + fwd, 22, 3, 1, c.shoe); R(8 - fwd, 22, 3, 1, c.shoe);
    // torso
    R(5, 10 + y0, 6, 7, c.shirt); R(5, 16 + y0, 6, 1, shade(c.shirt, -0.25));
    if (c.scarf) R(5, 10 + y0, 6, 2, c.scarf);
    // arm
    R(7 - fwd, 11 + y0, 2, 5, shade(c.shirt, -0.1)); R(7 - fwd, 16 + y0, 2, 1, c.skin);
    // head
    R(4, 2 + y0, 8, 8, c.skin);
    R(4, 9 + y0, 8, 1, skinD);
    R(3, 1 + y0, 9, 3, c.hair);
    R(3, 3 + y0, 4, 6, c.hair);
    R(11, 4 + y0, 1, 1, c.hair);
    p.p(X(9), 6 + y0, c.eye);
    p.p(X(12), 7 + y0, c.skin);
    if (c.long) { R(2, 5 + y0, 3, 7, c.hair); R(1, 8 + y0, 2, 3, c.hair); }
  }
}

export function humanSheet(pal: HumanPal): HTMLCanvasElement {
  const [cv, ctx] = makeCanvas(16 * 3, 24 * 4);
  DIRS.forEach((d, di) => {
    for (let f = 0; f < 3; f++) {
      drawHuman(new P(ctx, f * 16, di * 24), d, f, pal);
    }
  });
  for (let di = 0; di < 4; di++) for (let f = 0; f < 3; f++) outline(ctx, f * 16, di * 24, 16, 24);
  return cv;
}

// ---------------- monster 「大首」 ----------------
export const MON_W = 32;
export const MON_H = 40;
const MS = { base: '#b4a7b9', mid: '#9a8ca2', shade: '#76687f', dark: '#4f4258', hi: '#d8ccdb', hair: '#0e0a0e', mouth: '#24080e', tooth: '#e2dcc8', eyeW: '#ece6d6', vein: '#a8303a' };

function drawMonster(p: P, dir: Dir, frame: number) {
  const bob = frame === 0 ? 0 : 1;
  const sw = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const hy = bob; // head offset
  // --- body (drawn first, head overlaps) ---
  const by = 26;
  // legs: short bent
  p.r(12 + (sw > 0 ? -1 : 0), by + 7, 3, 6 - (sw > 0 ? 1 : 0), MS.shade);
  p.r(17 + (sw < 0 ? 1 : 0), by + 7, 3, 6 - (sw < 0 ? 1 : 0), MS.shade);
  p.r(11 + (sw > 0 ? -1 : 0), by + 12 - (sw > 0 ? 1 : 0), 4, 1, MS.dark);
  p.r(17 + (sw < 0 ? 1 : 0), by + 12 - (sw < 0 ? 1 : 0), 4, 1, MS.dark);
  // torso: narrow and hunched
  p.r(11, by, 10, 8, MS.mid);
  p.v(11, by, 8, MS.shade);
  p.h(12, by + 7, 8, MS.shade);
  if (dir !== 'up') { p.p(14, by + 3, MS.shade); p.p(17, by + 3, MS.shade); p.p(15, by + 5, MS.shade); }
  // arms: very long and thin, hanging to the ground with long fingers
  const armL = (dir === 'right') ? 0 : 1, armR = (dir === 'left') ? 0 : 1;
  if (armL) {
    const s = sw;
    for (let i = 0; i < 12; i++) p.r(9 - Math.floor(i / 4) + (i > 6 ? s : 0), by + 1 + i, 2, 1, i % 3 ? MS.mid : MS.shade);
    p.r(5 + s, by + 13, 3, 1, MS.dark); p.v(5 + s, by + 13, 2, MS.dark); p.v(7 + s, by + 13, 2, MS.dark);
  }
  if (armR) {
    const s = -sw;
    for (let i = 0; i < 12; i++) p.r(21 + Math.floor(i / 4) + (i > 6 ? s : 0), by + 1 + i, 2, 1, i % 3 ? MS.mid : MS.shade);
    p.r(24 + s, by + 13, 3, 1, MS.dark); p.v(24 + s, by + 13, 2, MS.dark); p.v(26 + s, by + 13, 2, MS.dark);
  }
  // --- giant head ---
  const cx = dir === 'left' ? 15 : dir === 'right' ? 17 : 16;
  const cy = 13 + hy;
  for (let y = 0; y < 28; y++) {
    for (let x = 0; x < 32; x++) {
      const dx = (x + 0.5 - cx) / 14.5, dy = (y + 0.5 - cy) / 13;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      // lumpy silhouette
      if (d > 0.86 && ((x * 7 + y * 3) % 5 === 0)) continue;
      // lighting from top-left
      const l = -dx * 0.5 - dy * 0.8 + (1 - d) * 0.6;
      const col = l > 0.75 ? MS.hi : l > 0.25 ? MS.base : l > -0.25 ? MS.mid : l > -0.6 ? MS.shade : MS.dark;
      p.p(x, y, col);
    }
  }
  // sparse hair
  const hairRows = dir === 'up' ? 18 : 6;
  for (let x = 4; x < 28; x++) {
    const len = ((x * 37) % 7) + (dir === 'up' ? 6 : 1);
    if ((x * 13) % 3 === 0 && dir !== 'up') continue;
    for (let y = 0; y < Math.min(hairRows, len); y++) {
      const yy = Math.round(cy - 12.5 + y + Math.abs(x - cx) * 0.18 * (1 - y / 10));
      const dx = (x + 0.5 - cx) / 14.5, dy = (yy + 0.5 - cy) / 13;
      if (dx * dx + dy * dy <= 1) p.p(x, yy, MS.hair);
    }
  }
  if (dir === 'up') {
    // back of the head: a few strands and a bald scarred patch
    p.ellipse(cx, cy + 3, 4, 3, MS.mid);
    p.h(cx - 2, cy + 3, 4, MS.dark);
    for (const x of [6, 9, 24, 27]) p.v(x, cy + 2, 7, MS.hair);
    // ears
    p.r(1, cy, 2, 4, MS.shade); p.r(29, cy, 2, 4, MS.shade);
    return;
  }
  const eye = (ex: number, ey: number, rx: number, ry: number, look: number) => {
    p.ellipse(ex, ey + 1, rx + 1, ry + 0.6, MS.dark);
    p.ellipse(ex, ey, rx, ry, MS.eyeW);
    p.p(Math.round(ex - rx + 1), Math.round(ey), MS.vein); p.p(Math.round(ex + rx - 2), Math.round(ey - 1), MS.vein);
    p.p(Math.round(ex - rx + 2), Math.round(ey + 1), MS.vein);
    p.r(Math.round(ex - 1 + look), Math.round(ey - 1), 2, 2, '#050305');
    p.p(Math.round(ex - 1 + look), Math.round(ey - 1), '#6a5a5a');
  };
  if (dir === 'down') {
    // brow ridge
    p.h(6, cy - 6, 8, MS.shade); p.h(18, cy - 6, 8, MS.shade);
    eye(10.5, cy - 2, 4.2, 3.2, 0);
    eye(21.5, cy - 2, 4.2, 3.2, 0);
    // nose
    p.p(15, cy + 3, MS.dark); p.p(17, cy + 3, MS.dark); p.h(15, cy + 2, 3, MS.mid);
    // enormous grin
    const my = cy + 7;
    for (let x = 6; x <= 26; x++) {
      const curve = Math.round(Math.pow((x - 16) / 10, 2) * -3);
      p.p(x, my + curve, MS.mouth);
      p.p(x, my + curve + 1, MS.mouth);
      if (x > 7 && x < 25) {
        p.p(x, my + curve + 2, MS.mouth);
        if (x % 2 === 0) p.p(x, my + curve, MS.tooth);
        if (x % 2 === 1 && x > 9 && x < 23) p.p(x, my + curve + 2, MS.tooth);
      }
    }
    p.p(5, my - 3, MS.dark); p.p(27, my - 3, MS.dark);
  } else {
    const f = dir === 'right' ? 1 : -1;
    const X = (x: number) => (f > 0 ? x : 31 - x);
    // one huge eye on the facing side, one smaller further eye
    eye(X(22), cy - 2, 4.5, 3.4, f);
    eye(X(13), cy - 2, 2.4, 3, f);
    // nose bump
    p.p(X(30), cy + 1, MS.mid); p.p(X(30), cy + 2, MS.shade);
    // grin along the side
    const my = cy + 7;
    for (let x = 12; x <= 28; x++) {
      const curve = Math.round(Math.pow((x - 28) / 12, 2) * 3);
      p.p(X(x), my - curve, MS.mouth); p.p(X(x), my - curve + 1, MS.mouth);
      if (x % 2 === 0) p.p(X(x), my - curve, MS.tooth);
    }
    // ear on the back side
    p.r(X(4), cy, 2, 4, MS.shade);
  }
}

export function monsterSheet(): HTMLCanvasElement {
  const [cv, ctx] = makeCanvas(MON_W * 3, MON_H * 4);
  DIRS.forEach((d, di) => {
    for (let f = 0; f < 3; f++) drawMonster(new P(ctx, f * MON_W, di * MON_H), d, f);
  });
  for (let di = 0; di < 4; di++) for (let f = 0; f < 3; f++) outline(ctx, f * MON_W, di * MON_H, MON_W, MON_H, '#08050a');
  return cv;
}

/** Close-up face for the game-over screen (pixel art, scaled up by CSS). */
export function monsterCloseup(): HTMLCanvasElement {
  const Wd = 120, Hd = 96;
  const [cv, ctx] = makeCanvas(Wd, Hd);
  const p = new P(ctx);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, Wd, Hd);
  const cx = 60, cy = 50;
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) {
    const dx = (x - cx) / 62, dy = (y - cy) / 54;
    const d = dx * dx + dy * dy;
    if (d > 1) continue;
    const l = -dx * 0.4 - dy * 0.7 + (1 - d) * 0.7 + (((x * 13 + y * 7) % 11) / 60);
    p.p(x, y, l > 0.8 ? MS.hi : l > 0.35 ? MS.base : l > -0.05 ? MS.mid : l > -0.45 ? MS.shade : MS.dark);
  }
  for (let x = 0; x < Wd; x += 2) {
    const len = 4 + ((x * 31) % 13);
    for (let y = 0; y < len; y++) p.p(x + (y % 3 === 0 ? 1 : 0), y, MS.hair);
  }
  const bigEye = (ex: number, ey: number) => {
    p.ellipse(ex, ey + 2, 17, 12, MS.dark);
    p.ellipse(ex, ey, 15, 10.5, MS.eyeW);
    for (let i = 0; i < 9; i++) {
      let x = ex - 15 + (i % 2 ? 0 : 29), y = ey - 4 + i;
      for (let k = 0; k < 7; k++) { p.p(Math.round(x), Math.round(y), MS.vein); x += (i % 2 ? 1 : -1) * 1.2; y += ((k + i) % 3) - 1; }
    }
    p.ellipse(ex, ey, 3.5, 3.5, '#120608');
    p.ellipse(ex, ey, 2, 2, '#000');
    p.p(ex - 2, ey - 2, '#b0a0a0');
  };
  bigEye(34, 34);
  bigEye(86, 34);
  // nostrils
  p.ellipse(54, 54, 2, 1.5, MS.dark); p.ellipse(66, 54, 2, 1.5, MS.dark);
  // open mouth with teeth
  for (let x = 14; x <= 106; x++) {
    const t = (x - 60) / 46;
    const top = 66 - Math.round((1 - t * t) * 2) - Math.round(t * t * 8);
    const bot = 66 + Math.round((1 - t * t) * 22);
    for (let y = top; y <= bot; y++) p.p(x, y, y > top + 3 && y < bot - 3 ? '#16040a' : MS.mouth);
    if (x % 5 < 3) { for (let y = top; y < top + 5; y++) p.p(x, y, y === top + 4 ? '#a8a290' : MS.tooth); }
    if (x % 5 > 1 && Math.abs(t) < 0.85) { for (let y = bot - 4; y <= bot; y++) p.p(x, y, y === bot - 4 ? '#a8a290' : MS.tooth); }
  }
  p.speckle(30, 74, 60, 10, ['#5a0a14'], 0.08, 4);
  return cv;
}

// ---------------- doors ----------------
export function doorTextures(): Record<string, HTMLCanvasElement> {
  const out: Record<string, HTMLCanvasElement> = {};
  const mk = (k: string, w: number, h: number, d: (p: P) => void, ol = true) => {
    const [c, ctx] = makeCanvas(w, h); d(new P(ctx)); if (ol) outline(ctx, 0, 0, w, h); out[k] = c;
  };
  const wood = '#4e321e', woodH = '#6e4a2c', woodD = '#2a1a0e';
  mk('door_h_closed', 16, 32, (p) => {
    p.r(0, 0, 16, 32, '#1a100a');
    p.r(1, 1, 14, 31, wood); p.v(1, 1, 31, woodH); p.v(14, 1, 31, woodD);
    p.r(3, 3, 10, 11, shade(wood, 0.08)); p.h(3, 3, 10, woodH); p.h(3, 13, 10, woodD);
    p.r(3, 17, 10, 12, shade(wood, 0.08)); p.h(3, 17, 10, woodH); p.h(3, 28, 10, woodD);
    p.r(11, 15, 2, 2, '#d8b050'); p.p(11, 15, '#fff0a0');
  }, false);
  mk('door_h_open', 16, 32, (p) => {
    p.r(0, 0, 16, 32, '#1a100a');
    p.r(1, 1, 14, 31, '#060406');
    p.r(1, 26, 14, 6, '#0e0a0a');
    p.r(1, 1, 3, 31, wood); p.v(1, 1, 31, woodH); p.v(3, 1, 31, woodD);
  }, false);
  mk('door_v_closed', 16, 16, (p) => {
    p.r(0, 0, 16, 16, '#110d10');
    p.r(5, 0, 6, 16, wood); p.v(5, 0, 16, woodH); p.v(10, 0, 16, woodD);
    p.r(4, 7, 1, 2, '#d8b050'); p.r(11, 7, 1, 2, '#d8b050');
  }, false);
  mk('door_v_open', 16, 16, (p) => {
    p.r(0, 0, 16, 16, '#1a1612');
    p.r(0, 0, 16, 3, '#110d10');
    p.r(2, 0, 12, 3, wood); p.h(2, 0, 12, woodH);
  }, false);
  mk('shutter_closed', 16, 16, (p) => {
    p.r(0, 0, 16, 16, '#110d10');
    p.r(4, 0, 8, 16, '#4a4e54'); for (let y = 0; y < 16; y += 2) p.h(4, y, 8, '#2e3238');
    p.v(4, 0, 16, '#6a6e74'); p.r(6, 6, 4, 4, '#a02020'); p.p(7, 7, '#ff6060');
  }, false);
  mk('shutter_open', 16, 16, (p) => {
    p.r(0, 0, 16, 16, '#1e1e22'); p.r(0, 0, 16, 2, '#4a4e54'); p.h(0, 2, 16, '#2e3238');
  }, false);
  mk('gate_closed', 16, 16, (p) => {
    p.r(0, 0, 16, 16, '#141416');
    for (let y = 0; y < 16; y += 3) { p.r(5, y, 6, 2, '#3a3a40'); p.h(5, y, 6, '#6a6a72'); }
    p.v(7, 0, 16, '#5a5a62'); p.v(8, 0, 16, '#2a2a30');
    p.r(9, 6, 5, 5, '#7a6a4a'); p.r(10, 4, 3, 2, '#5a5a62'); p.p(11, 8, '#1a1408');
  }, false);
  mk('gate_open', 16, 16, (p) => {
    p.r(0, 0, 16, 16, '#1e1e22');
    for (let x = 1; x < 16; x += 3) { p.r(x, 0, 2, 3, '#3a3a40'); p.p(x, 0, '#6a6a72'); }
  }, false);
  return out;
}

// ---------------- lights ----------------
export function lightTexture(size: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export function coneTexture(len: number, half: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(len, half * 2);
  const img = ctx.createImageData(len, half * 2);
  for (let y = 0; y < half * 2; y++) {
    for (let x = 0; x < len; x++) {
      const t = x / len;
      const spread = 4 + t * (half - 4);
      const dy = Math.abs(y + 0.5 - half) / spread;
      if (dy > 1) continue;
      let a = (1 - dy * dy) * (1 - Math.pow(t, 1.6));
      if (x < 6) a *= x / 6;
      img.data[(y * len + x) * 4 + 3] = Math.round(Math.max(0, Math.min(1, a)) * 255);
      img.data[(y * len + x) * 4] = 255; img.data[(y * len + x) * 4 + 1] = 255; img.data[(y * len + x) * 4 + 2] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** The master's portrait used for the sliding puzzle (96x96). */
export function masterPortrait(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(96, 96);
  const p = new P(ctx);
  p.r(0, 0, 96, 96, '#5a4214');
  p.r(2, 2, 92, 92, '#c09840'); p.r(4, 4, 88, 88, '#7a5a22');
  p.r(7, 7, 82, 82, '#16221e');
  for (let y = 7; y < 89; y++) p.h(7, y, 82, `rgb(${22 + y / 6},${30 + y / 5},${28 + y / 6})`);
  // shoulders / suit
  p.ellipse(48, 92, 38, 22, '#141418');
  p.r(42, 70, 12, 19, '#c8c4bc'); p.r(46, 72, 4, 14, '#5a1010');
  // neck
  p.r(40, 60, 16, 12, '#a8908a');
  // head: subtly too large
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const dx = (x - 48) / 25, dy = (y - 40) / 27;
    const d = dx * dx + dy * dy;
    if (d > 1) continue;
    const l = -dx * 0.5 - dy * 0.6 + (1 - d) * 0.6;
    p.p(x, y, l > 0.7 ? '#e0cabc' : l > 0.2 ? '#cbb2a2' : l > -0.3 ? '#a88e82' : '#7a6460');
  }
  // slicked hair
  p.ellipse(48, 20, 25, 10, '#141010'); p.r(23, 18, 6, 18, '#141010'); p.r(67, 18, 6, 14, '#141010');
  p.h(36, 16, 20, '#3a3030'); p.h(30, 22, 10, '#2a2020');
  // eyes: wide, staring
  for (const ex of [38, 58]) {
    p.ellipse(ex, 40, 6, 4.5, '#3a2a2a');
    p.ellipse(ex, 40, 5, 3.5, '#ece4d4');
    p.r(ex - 1, 39, 3, 3, '#100808');
    p.p(ex - 4, 40, '#a03030'); p.p(ex + 3, 41, '#a03030');
  }
  p.h(31, 33, 13, '#2a1a18'); p.h(52, 33, 13, '#2a1a18');
  // nose
  p.v(48, 42, 8, '#8a7266'); p.r(45, 50, 7, 2, '#7a6258');
  // mustache and thin smile that stretches too far
  p.r(39, 54, 18, 3, '#141010'); p.p(38, 56, '#141010'); p.p(57, 56, '#141010');
  for (let x = 32; x <= 64; x++) {
    const t = (x - 48) / 16;
    p.p(x, 60 - Math.round(t * t * 4), '#4a1414');
  }
  // signature
  p.r(70, 82, 12, 2, '#a08040');
  return c;
}

/** Title screen art: mansion silhouette under the moon. */
export function titleArt(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(240, 135);
  const p = new P(ctx);
  for (let y = 0; y < 135; y++) p.h(0, y, 240, `rgb(${6 + y / 12},${8 + y / 14},${18 + y / 8})`);
  p.speckle(0, 0, 240, 70, ['#5a6070', '#8a90a0'], 0.006, 4);
  p.ellipse(186, 30, 13, 13, '#d8d4c4'); p.ellipse(182, 27, 3, 2, '#b8b4a4'); p.ellipse(190, 34, 2, 2, '#c0bcac');
  ctx.globalAlpha = 0.12; p.ellipse(186, 30, 26, 26, '#d8d4c4'); ctx.globalAlpha = 1;
  // trees
  for (let x = 0; x < 240; x += 6) {
    const h = 18 + ((x * 37) % 17);
    p.r(x, 135 - h, 7, h, '#06070a');
    p.ellipse(x + 3, 135 - h, 5, 6, '#06070a');
  }
  // mansion
  const m = '#0a0a10';
  p.r(60, 60, 120, 75, m);
  p.r(90, 40, 60, 25, m);
  for (let i = 0; i < 20; i++) p.h(90 + i, 40 - i, 60 - i * 2, m);
  p.r(60, 52, 22, 10, m); for (let i = 0; i < 10; i++) p.h(60 + i, 52 - i, 22 - i * 2, m);
  p.r(158, 52, 22, 10, m); for (let i = 0; i < 10; i++) p.h(158 + i, 52 - i, 22 - i * 2, m);
  p.r(112, 10, 4, 14, m); p.r(128, 14, 4, 10, m);
  // windows
  const win = (x: number, y: number, lit: boolean) => { p.r(x, y, 6, 9, lit ? '#a8702a' : '#141824'); p.v(x + 3, y, 9, m); p.h(x, y + 4, 6, m); };
  for (const [x, y] of [[68, 72], [84, 72], [148, 72], [164, 72], [68, 100], [84, 100], [148, 100], [164, 100], [104, 48], [130, 48]]) win(x, y, false);
  win(117, 48, true);
  // the face in the lit window
  p.r(118, 49, 4, 3, '#b4a7b9'); p.p(118, 50, '#f0e8d8'); p.p(121, 50, '#f0e8d8'); p.h(118, 52, 4, '#24080e');
  p.r(112, 108, 16, 27, '#140c08'); p.v(120, 108, 27, m);
  for (let x = 0; x < 240; x += 3) p.r(x, 128 + ((x * 7) % 3), 3, 7, '#040406');
  return c;
}
