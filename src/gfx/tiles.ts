import { TILE } from '../core/constants';
import { FloorKind, MAP_H, MAP_W, ROOMS, WallTheme } from '../world/mapdata';
import { Grid, T_FLOOR, T_WALL } from '../world/grid';
import { hash2, makeCanvas, P, shade } from './pixel';

function floorTile(p: P, kind: FloorKind, tx: number, ty: number) {
  const s = (n: number) => hash2(tx, ty, n);
  switch (kind) {
    case 'wood':
    case 'dirty':
    case 'runner': {
      const base = kind === 'dirty' ? '#3a332c' : kind === 'runner' ? '#2e2018' : '#3b2719';
      const alt = kind === 'dirty' ? '#332d27' : kind === 'runner' ? '#281b14' : '#34221a';
      const line = kind === 'dirty' ? '#221e1a' : '#1d140e';
      for (let row = 0; row < 4; row++) {
        const c = hash2(tx * 3 + (row % 2), ty * 4 + row, 7) > 0.5 ? base : alt;
        p.r(0, row * 4, 16, 4, c);
        p.h(0, row * 4 + 3, 16, line);
        const seam = Math.floor(hash2(tx, ty * 4 + row, 3) * 16);
        p.v(seam, row * 4, 3, line);
        p.h(0, row * 4, 16, shade(c, 0.06));
      }
      p.speckle(0, 0, 16, 16, [shade(base, -0.25), shade(base, 0.1)], 0.05, tx * 99 + ty);
      if (kind === 'dirty') p.speckle(0, 0, 16, 16, ['#4c463e'], 0.04, tx + ty * 77);
      if (kind === 'runner') {
        // faded red runner in the middle of corridors (rows aligned with tile parity)
        if (ty % 2 === 0) { p.r(0, 10, 16, 6, '#4a1a1c'); p.h(0, 10, 16, '#6a3020'); p.h(0, 12, 16, '#3a1214'); }
        else { p.r(0, 0, 16, 6, '#4a1a1c'); p.h(0, 5, 16, '#6a3020'); p.h(0, 3, 16, '#3a1214'); }
        if (s(2) < 0.15) p.p(Math.floor(s(4) * 16), 2 + Math.floor(s(5) * 10), '#2a0e0e');
      }
      break;
    }
    case 'carpet':
    case 'carpet_blue':
    case 'library': {
      const pal = kind === 'carpet' ? ['#3e1216', '#4f1a1e', '#2c0c0f', '#6a3a24']
        : kind === 'carpet_blue' ? ['#1a2038', '#232c4a', '#12172a', '#4a4a5c']
        : ['#1b261c', '#243324', '#121a13', '#3c4a30'];
      p.r(0, 0, 16, 16, pal[0]);
      // diamond lattice
      for (let i = 0; i < 16; i++) {
        p.p(i, (i + 8) % 16, pal[1]);
        p.p(i, (24 - i) % 16, pal[1]);
      }
      p.p(8, 8, pal[3]); p.p(0, 0, pal[3]);
      p.p(7, 8, pal[1]); p.p(9, 8, pal[1]); p.p(8, 7, pal[1]); p.p(8, 9, pal[1]);
      p.speckle(0, 0, 16, 16, [pal[2]], 0.08, tx * 31 + ty * 17);
      break;
    }
    case 'tile_white': {
      p.r(0, 0, 16, 16, '#5d6266');
      for (const [x, y] of [[0, 0], [8, 0], [0, 8], [8, 8]]) {
        const c = hash2(tx * 2 + x, ty * 2 + y, 1) > 0.8 ? '#7d8286' : '#878c90';
        p.r(x, y, 7, 7, c);
        p.h(x, y, 7, '#9da2a6');
      }
      if (s(9) < 0.25) p.speckle(0, 0, 16, 16, ['#4a3c30', '#3a2e26'], 0.06, tx * 7 + ty);
      break;
    }
    case 'tile_check': {
      for (const [x, y] of [[0, 0], [8, 0], [0, 8], [8, 8]]) {
        const dark = ((x + y) / 8) % 2 === 0;
        p.r(x, y, 8, 8, dark ? '#24221e' : '#5e5a4e');
        if (!dark) p.h(x, y, 8, '#6c6858');
      }
      p.speckle(0, 0, 16, 16, ['#3a3630'], 0.05, tx * 13 + ty * 5);
      break;
    }
    case 'parquet': {
      const a = '#4a2e1c', b = '#3e2617', l = '#24160d';
      for (const [x, y] of [[0, 0], [8, 0], [0, 8], [8, 8]]) {
        const vert = ((x + y) / 8) % 2 === 0;
        p.r(x, y, 8, 8, vert ? a : b);
        if (vert) { p.v(x + 3, y, 8, l); p.v(x + 7, y, 8, l); }
        else { p.h(x, y + 3, 8, l); p.h(x, y + 7, 8, l); }
      }
      p.speckle(0, 0, 16, 16, ['#2c1b10', '#583822'], 0.05, tx * 11 + ty * 3);
      break;
    }
    case 'stone':
    case 'hidden': {
      const base = kind === 'stone' ? '#34343a' : '#2e2428';
      const alt = kind === 'stone' ? '#2c2c31' : '#271e22';
      const mortar = '#18171b';
      p.r(0, 0, 16, 16, mortar);
      const off = ty % 2 === 0 ? 0 : 4;
      for (let row = 0; row < 2; row++) {
        for (let col = -1; col < 2; col++) {
          const x = col * 8 + off + (row ? 4 : 0);
          const c = hash2(tx * 4 + col, ty * 2 + row, 5) > 0.5 ? base : alt;
          p.r(x + 1, row * 8 + 1, 7, 7, c);
          p.h(x + 1, row * 8 + 1, 7, shade(c, 0.1));
        }
      }
      if (kind === 'stone') p.speckle(0, 0, 16, 16, ['#2c3a2a', '#3e4a36'], 0.03, tx * 5 + ty * 9);
      if (kind === 'hidden' && s(3) < 0.35) {
        p.speckle(2, 2, 12, 12, ['#4a1010', '#3a0c0c', '#5a1414'], 0.12, tx * 3 + ty * 21);
      }
      break;
    }
  }
}

const THEMES: Record<WallTheme, { paper: string; pat: string; panel: string; panelHi: string; style: 'paper' | 'tile' | 'brick' | 'wood' | 'plaster' }> = {
  damask: { paper: '#3a1820', pat: '#4f2430', panel: '#2e1c14', panelHi: '#4a3020', style: 'paper' },
  teal: { paper: '#1d3634', pat: '#28474a', panel: '#3a3024', panelHi: '#54473a', style: 'paper' },
  bath: { paper: '#7a8084', pat: '#8e9498', panel: '#5a6064', panelHi: '#9aa0a4', style: 'tile' },
  kitchen: { paper: '#5e5644', pat: '#6e6650', panel: '#3c3428', panelHi: '#5a4e3c', style: 'tile' },
  green: { paper: '#1c2a20', pat: '#27392b', panel: '#2a1c12', panelHi: '#46301e', style: 'paper' },
  panel: { paper: '#33221a', pat: '#3f2b20', panel: '#2a1a12', panelHi: '#4a3222', style: 'wood' },
  burgundy: { paper: '#3c121a', pat: '#511a24', panel: '#2c1a12', panelHi: '#4a2e1e', style: 'paper' },
  olive: { paper: '#2c2e1e', pat: '#3a3d27', panel: '#2a1c12', panelHi: '#46301e', style: 'paper' },
  study: { paper: '#2e2118', pat: '#3b2b1f', panel: '#24170f', panelHi: '#3e2a1a', style: 'wood' },
  hall: { paper: '#381a1a', pat: '#6a5030', panel: '#2c1a12', panelHi: '#52361f', style: 'paper' },
  plaster: { paper: '#4a4640', pat: '#3a3630', panel: '#38342e', panelHi: '#56524a', style: 'plaster' },
  brick: { paper: '#3a2a26', pat: '#211816', panel: '#2a201c', panelHi: '#4a3a32', style: 'brick' },
  blood: { paper: '#2e2426', pat: '#1a1416', panel: '#241c1e', panelHi: '#3a3032', style: 'brick' },
};

function wallFace(p: P, theme: WallTheme, upper: boolean, tx: number, ty: number) {
  const t = THEMES[theme];
  if (t.style === 'paper') {
    p.r(0, 0, 16, 16, t.paper);
    for (let y = upper ? 3 : 0; y < 16; y += 6) {
      for (let x = (y / 6) % 2 === 0 ? 2 : 6; x < 16; x += 8) {
        p.p(x, y, t.pat); p.p(x - 1, y + 1, t.pat); p.p(x + 1, y + 1, t.pat); p.p(x, y + 2, t.pat);
      }
    }
    if (theme === 'hall') { p.v(0, 0, 16, '#4a2a22'); }
  } else if (t.style === 'tile') {
    p.r(0, 0, 16, 16, t.panel);
    for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 ? 0 : -2; x < 16; x += 4) {
      p.r(x, y, 3, 3, t.paper);
      p.p(x, y, t.pat);
    }
  } else if (t.style === 'wood') {
    p.r(0, 0, 16, 16, t.paper);
    p.v(0, 0, 16, t.panel); p.v(8, 0, 16, t.panel);
    p.v(1, 0, 16, t.pat); p.v(9, 0, 16, t.pat);
  } else if (t.style === 'plaster') {
    p.r(0, 0, 16, 16, t.paper);
    p.speckle(0, 0, 16, 16, ['#55514a', '#403c36'], 0.12, tx * 7 + ty * 3);
    if (hash2(tx, ty, 9) < 0.4) {
      let x = Math.floor(hash2(tx, ty, 1) * 12) + 2;
      for (let y = 0; y < 16; y++) { p.p(x, y, t.pat); if (hash2(x, y, 2) < 0.4) x += hash2(x, y, 3) < 0.5 ? -1 : 1; }
    }
  } else {
    p.r(0, 0, 16, 16, t.pat);
    for (let row = 0; row < 4; row++) {
      const off = (row + ty * 4) % 2 ? 0 : 4;
      for (let x = -8 + off; x < 16; x += 8) {
        const c = hash2(tx * 3 + x, ty * 4 + row, 4) > 0.5 ? t.paper : shade(t.paper, -0.12);
        p.r(x + 1, row * 4 + 1, 7, 3, c);
        p.h(x + 1, row * 4 + 1, 7, shade(c, 0.08));
      }
    }
    if (theme === 'blood' && hash2(tx, ty, 6) < 0.5) {
      const x = 2 + Math.floor(hash2(tx, ty, 8) * 12);
      const len = 4 + Math.floor(hash2(tx, ty, 10) * 10);
      p.v(x, upper ? 0 : 0, len, '#5a1010');
      p.p(x, len, '#3a0808');
    }
  }
  if (upper) {
    // crown molding
    p.h(0, 0, 16, '#0e0a0a');
    p.h(0, 1, 16, t.panel);
    p.h(0, 2, 16, t.panelHi);
  } else if (t.style !== 'tile' && t.style !== 'brick') {
    // wainscot + chair rail + baseboard
    p.r(0, 6, 16, 10, t.panel);
    p.h(0, 5, 16, t.panelHi);
    p.h(0, 6, 16, shade(t.panel, -0.3));
    p.r(2, 8, 5, 5, shade(t.panel, 0.08));
    p.r(10, 8, 5, 5, shade(t.panel, 0.08));
    p.h(2, 8, 5, t.panelHi); p.h(10, 8, 5, t.panelHi);
    p.r(0, 14, 16, 2, '#100b08');
  } else {
    p.r(0, 14, 16, 2, '#121012');
  }
}

function wallTop(p: P, mask: number, tx: number, ty: number) {
  p.r(0, 0, 16, 16, '#110d10');
  p.speckle(0, 0, 16, 16, ['#161216'], 0.15, tx * 3 + ty * 11);
  const edge = '#2c2329', hi = '#3b3036';
  if (mask & 1) { p.h(0, 0, 16, hi); p.h(0, 1, 16, edge); }
  if (mask & 4) { p.h(0, 15, 16, hi); p.h(0, 14, 16, edge); }
  if (mask & 8) { p.v(0, 0, 16, hi); p.v(1, 0, 16, edge); }
  if (mask & 2) { p.v(15, 0, 16, hi); p.v(14, 0, 16, edge); }
}

/** Renders floors and walls of the whole map into one canvas. */
export function renderMapBase(grid: Grid): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(MAP_W * TILE, MAP_H * TILE);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, c.width, c.height);
  const kindAt = (x: number, y: number) => grid.inb(x, y) ? grid.tiles[grid.i(x, y)] : 0;
  const isFaceSurface = (x: number, y: number) => kindAt(x, y) === T_WALL;
  // theme of the room the face looks into
  const faceTheme = (x: number, y: number): WallTheme | null => {
    for (let dy = 1; dy <= 2; dy++) {
      const ri = grid.roomIndexAt(x, y + dy);
      if (ri >= 0) {
        // only count if every tile between is wall
        for (let k = 1; k < dy; k++) if (!isFaceSurface(x, y + k)) return null;
        return ROOMS[ri].wall;
      }
    }
    return null;
  };
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const k = kindAt(x, y);
      const p = new P(ctx, x * TILE, y * TILE);
      if (k === T_FLOOR) {
        const r = grid.roomAt(x, y)!;
        floorTile(p, r.floor, x, y);
      } else if (k === T_WALL) {
        const below = kindAt(x, y + 1);
        const below2 = kindAt(x, y + 2);
        if (below === T_FLOOR && faceTheme(x, y)) {
          wallFace(p, faceTheme(x, y)!, false, x, y);
        } else if (below === T_WALL && below2 === T_FLOOR && faceTheme(x, y)) {
          wallFace(p, faceTheme(x, y)!, true, x, y);
        } else {
          let mask = 0;
          const open = (xx: number, yy: number) => kindAt(xx, yy) === T_FLOOR;
          if (open(x, y - 1)) mask |= 1;
          if (open(x + 1, y)) mask |= 2;
          if (open(x, y + 1)) mask |= 4;
          if (open(x - 1, y)) mask |= 8;
          // face tops count as walls; a top directly above a face gets no south edge
          wallTop(p, mask, x, y);
        }
      }
    }
  }
  // soft shadow cast by walls onto floors
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (kindAt(x, y) !== T_FLOOR) continue;
      if (kindAt(x, y - 1) === T_WALL) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x * TILE, y * TILE, TILE, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x * TILE, y * TILE + 2, TILE, 3);
      }
      if (kindAt(x - 1, y) === T_WALL) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x * TILE, y * TILE, 3, TILE);
      }
      if (kindAt(x + 1, y) === T_WALL) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x * TILE + 14, y * TILE, 2, TILE);
      }
    }
  }
  return c;
}
