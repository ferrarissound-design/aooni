import { Dir } from '../core/constants';
import { makeCanvas, outline, P, shade } from './pixel';

export const DIRS: Dir[] = ['down', 'left', 'right', 'up'];

interface HumanPal {
  hair: string; hairHi: string; hairLo: string;
  skin: string; skinSh: string;
  top: string; topHi: string; topLo: string; inner: string;
  bottom: string; bottomLo: string;
  shoe: string; shoeLo: string;
  eye: string;
  girl?: boolean;
  accent?: string; accentLo?: string;
}

export const PLAYER_PAL: HumanPal = {
  hair: '#2b2521', hairHi: '#54483f', hairLo: '#15110f',
  skin: '#e9c09d', skinSh: '#c39574',
  top: '#5d83ad', topHi: '#86abd2', topLo: '#3b5776', inner: '#e8e4dc',
  bottom: '#343a4e', bottomLo: '#212536',
  shoe: '#dcd8d0', shoeLo: '#8c887f',
  eye: '#161012',
};
export const SAKI_PAL: HumanPal = {
  hair: '#5c3825', hairHi: '#85563a', hairLo: '#38200f',
  skin: '#f2cbab', skinSh: '#cfa282',
  top: '#ece8e2', topHi: '#ffffff', topLo: '#bcb7ae', inner: '#ece8e2',
  bottom: '#34446c', bottomLo: '#222e4d',
  shoe: '#4d2e20', shoeLo: '#2c1a11',
  eye: '#1a0f0f',
  girl: true, accent: '#cc343c', accentLo: '#8e1f27',
};

/** 16x24 human frame. frame: 0 stand, 1 step A, 2 step B (contact poses swing legs and arms). */
function drawHuman(p: P, dir: Dir, frame: number, c: HumanPal) {
  const st = frame === 0 ? 0 : frame === 1 ? 1 : -1; // which leg leads
  const dy = frame === 0 ? 0 : 1; // body drops slightly on contact frames
  const girl = !!c.girl;

  if (dir === 'down' || dir === 'up') {
    const front = dir === 'down';
    // ---- legs
    const lLift = st === -1 ? 1 : 0, rLift = st === 1 ? 1 : 0;
    const legTop = (girl ? 19 : 17) + dy;
    const legCol = girl ? c.skin : c.bottom;
    const legLo = girl ? c.skinSh : c.bottomLo;
    p.r(5, legTop, 3, 22 - legTop - lLift, legCol); p.r(8, legTop, 3, 22 - legTop - rLift, legCol);
    p.v(7, legTop, 22 - legTop - lLift, legLo); p.v(8, legTop, 22 - legTop - rLift, legLo);
    if (girl) { p.r(5, 21 - lLift, 3, 1, '#eeeae6'); p.r(8, 21 - rLift, 3, 1, '#eeeae6'); }
    // shoes
    p.r(4, 22 - lLift, 4, 2, c.shoe); p.h(4, 23 - lLift, 4, c.shoeLo); p.p(4, 22 - lLift, c.shoeLo);
    p.r(8, 22 - rLift, 4, 2, c.shoe); p.h(8, 23 - rLift, 4, c.shoeLo); p.p(11, 22 - rLift, c.shoeLo);
    // ---- torso
    const ty = 10 + dy;
    p.r(4, ty, 8, 7, c.top);
    p.v(4, ty, 7, c.topHi); p.v(11, ty, 7, c.topLo); p.h(4, ty + 6, 8, c.topLo);
    if (girl) {
      // pleated skirt
      p.r(3, 16 + dy, 10, 3, c.bottom); p.h(3, 18 + dy, 10, c.bottomLo);
      for (const x of [5, 7, 9, 11]) p.v(x, 16 + dy, 3, c.bottomLo);
      p.h(4, 16 + dy, 8, c.bottomLo);
    } else {
      p.h(4, 16 + dy, 8, c.bottomLo); // belt line
    }
    if (front) {
      if (girl) {
        p.r(6, ty, 4, 2, c.inner); // sailor collar flap
        p.r(4, ty, 8, 1, c.accent!); p.r(7, ty + 1, 2, 4, c.accent!); p.p(7, ty + 4, c.accentLo!); p.p(8, ty + 5, c.accentLo!);
      } else {
        p.r(7, ty, 2, 1, c.skinSh); // neck
        p.r(6, ty + 1, 4, 2, c.inner); p.p(7, ty + 3, c.inner); p.p(8, ty + 3, c.inner);
        p.p(6, ty, c.topHi); p.p(9, ty, c.topHi); // collar
        p.v(7, ty + 4, 3, c.topLo); // zipper
      }
    } else {
      if (girl) { p.r(4, ty, 8, 2, c.accent!); p.p(7, ty + 2, c.accentLo!); }
      else { p.r(5, ty - 1, 6, 3, c.topHi); p.h(5, ty + 2, 6, c.topLo); } // hood bunched at the nape
    }
    // ---- arms (swing opposite to the legs), with hands
    const aL = st === 1 ? -1 : st === -1 ? 1 : 0, aR = -aL;
    p.r(2, ty + 1 + aL, 2, 5, c.top); p.v(2, ty + 1 + aL, 5, c.topHi); p.h(2, ty + 5 + aL, 2, c.topLo);
    p.r(12, ty + 1 + aR, 2, 5, c.top); p.v(13, ty + 1 + aR, 5, c.topLo);
    p.r(2, ty + 6 + aL, 2, 2, c.skin); p.r(12, ty + 6 + aR, 2, 2, c.skin); p.h(2, ty + 7 + aL, 2, c.skinSh); p.h(12, ty + 7 + aR, 2, c.skinSh);
    // ---- head
    const hy = 1 + dy;
    p.r(4, hy + 1, 8, 8, c.skin);
    p.r(5, hy + 9, 6, 1, c.skin);
    p.h(4, hy + 8, 8, c.skinSh); p.h(5, hy + 9, 6, c.skinSh);
    if (front) {
      p.r(4, hy, 8, 1, c.hairLo); p.r(3, hy + 1, 10, 3, c.hair); p.r(4, hy, 8, 1, c.hair);
      p.h(5, hy, 4, c.hairHi); p.h(4, hy + 1, 3, c.hairHi);
      p.v(3, hy + 4, 4, c.hair); p.v(12, hy + 4, 4, c.hairLo);
      // fringe
      for (const x of [4, 6, 7, 9, 11]) p.p(x, hy + 4, c.hair);
      p.p(5, hy + 4, c.hairLo); p.p(10, hy + 4, c.hairLo);
      // eyes
      p.r(5, hy + 5, 2, 2, '#f4f0ea'); p.r(9, hy + 5, 2, 2, '#f4f0ea');
      p.r(5, hy + 5, 1, 2, c.eye); p.r(10, hy + 5, 1, 2, c.eye);
      p.p(6, hy + 5, c.eye); p.p(9, hy + 5, c.eye);
      if (girl) { p.p(5, hy + 4, c.eye); p.p(10, hy + 4, c.eye); p.p(4, hy + 7, '#f0a89a'); p.p(11, hy + 7, '#f0a89a'); }
      p.p(7, hy + 7, c.skinSh); p.h(7, hy + 8, 2, '#a85e58');
      if (girl) {
        p.v(3, hy + 7, 4, c.hair); p.v(12, hy + 7, 4, c.hairLo); // long locks beside the neck
        p.r(11, hy + 1, 2, 2, c.accent!); p.p(11, hy + 1, c.accentLo!); // hair clip
      }
    } else {
      p.r(3, hy, 10, 9, c.hair); p.r(4, hy - 0, 8, 1, c.hairHi);
      p.r(3, hy + 8, 10, 1, c.hairLo); p.r(5, hy + 9, 6, 1, c.hairLo);
      p.h(5, hy + 2, 3, c.hairHi); p.v(8, hy + 3, 5, c.hairLo); p.h(4, hy + 6, 3, c.hairLo);
      if (girl) {
        p.r(4, hy + 9, 8, 4, c.hair); p.v(7, hy + 9, 4, c.hairLo); p.v(4, hy + 9, 4, c.hairHi);
        p.r(7, hy + 1, 2, 2, c.accent!);
      }
    }
  } else {
    // ---- side view (drawn facing right, mirrored for left)
    const R = (x: number, y: number, w: number, h: number, col: string) => {
      if (dir === 'left') p.r(16 - x - w, y, w, h, col); else p.r(x, y, w, h, col);
    };
    const X = (x: number) => (dir === 'left' ? 15 - x : x);
    const sw = st; // leading leg offset
    const legTop = (girl ? 19 : 17) + dy;
    const legCol = girl ? c.skin : c.bottom;
    const legLo = girl ? c.skinSh : c.bottomLo;
    // far leg (darker), then near leg
    const farX = 7 - sw * 2, nearX = 7 + sw * 2;
    R(farX, legTop, 3, 22 - legTop - (sw === 1 ? 1 : 0), legLo);
    R(farX - 1, 22 - (sw === 1 ? 1 : 0), 5, 2, c.shoeLo); R(farX + 1, 22 - (sw === 1 ? 1 : 0), 3, 1, c.shoe);
    R(nearX, legTop, 3, 22 - legTop - (sw === -1 ? 1 : 0), legCol);
    R(nearX - 1, 22 - (sw === -1 ? 1 : 0), 5, 2, c.shoe); R(nearX - 1, 23 - (sw === -1 ? 1 : 0), 5, 1, c.shoeLo);
    if (girl) R(nearX, 21 - (sw === -1 ? 1 : 0), 3, 1, '#eeeae6');
    // torso
    const ty = 10 + dy;
    R(5, ty, 6, 7, c.top); R(5, ty, 1, 7, c.topLo); R(10, ty, 1, 7, c.topHi); R(5, ty + 6, 6, 1, c.topLo);
    if (girl) { R(4, 16 + dy, 8, 3, c.bottom); R(4, 18 + dy, 8, 1, c.bottomLo); R(5, ty, 6, 2, c.accent!); R(9, ty + 2, 2, 3, c.accent!); }
    else { R(5, 16 + dy, 6, 1, c.bottomLo); R(8, ty, 3, 2, c.inner); }
    // arm swings front/back
    const ax = 7 + (st === 1 ? 2 : st === -1 ? -2 : 0);
    R(ax, ty + 1, 3, 5, c.top); R(ax, ty + 1, 1, 5, c.topHi); R(ax, ty + 5, 3, 1, c.topLo);
    R(ax, ty + 6, 3, 2, c.skin); R(ax, ty + 7, 3, 1, c.skinSh);
    // head
    const hy = 1 + dy;
    R(4, hy + 1, 8, 8, c.skin); R(5, hy + 9, 5, 1, c.skin); R(4, hy + 8, 8, 1, c.skinSh); R(5, hy + 9, 5, 1, c.skinSh);
    R(12, hy + 5, 1, 2, c.skin); // nose
    R(3, hy, 8, 4, c.hair); R(4, hy, 7, 1, c.hairHi); R(3, hy + 4, 5, 5, c.hair); R(3, hy + 8, 5, 1, c.hairLo);
    R(10, hy + 3, 2, 1, c.hair); R(8, hy + 4, 1, 3, c.hairLo); // fringe + ear shadow
    R(8, hy + 5, 1, 2, c.skinSh); // ear
    p.r(X(10), hy + 5, 1, 2, c.eye); p.p(X(11), hy + 5, '#f4f0ea');
    if (girl) {
      p.p(X(10), hy + 4, c.eye);
      R(2, hy + 5, 3, 8, c.hair); R(3, hy + 5, 1, 8, c.hairHi); R(2, hy + 12, 3, 1, c.hairLo);
      R(7, hy + 1, 2, 2, c.accent!);
    }
    R(11, hy + 7, 1, 1, '#a85e58');
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
