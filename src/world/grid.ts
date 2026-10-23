import { TILE } from '../core/constants';
import { BREAKABLE, DOORS, DoorDef, MAP_H, MAP_W, OBJECTS, PORTALS, PortalDef, ROOMS, RoomDef } from './mapdata';

export const T_VOID = 0;
export const T_WALL = 1;
export const T_FLOOR = 2;

export interface DoorState {
  def: DoorDef;
  tiles: [number, number][];
  open: boolean;
  openAmount: number; // 0..1 visual
  closeTimer: number;
  locked: boolean;
}

class MinHeap {
  private items: number[] = [];
  private prio: number[] = [];
  get size() { return this.items.length; }
  push(item: number, p: number) {
    const a = this.items, pr = this.prio;
    a.push(item); pr.push(p);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (pr[parent] <= pr[i]) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      [pr[parent], pr[i]] = [pr[i], pr[parent]];
      i = parent;
    }
  }
  pop(): number {
    const a = this.items, pr = this.prio;
    const top = a[0];
    const lastI = a.pop()!, lastP = pr.pop()!;
    if (a.length > 0) {
      a[0] = lastI; pr[0] = lastP;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && pr[l] < pr[m]) m = l;
        if (r < a.length && pr[r] < pr[m]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        [pr[m], pr[i]] = [pr[i], pr[m]];
        i = m;
      }
    }
    return top;
  }
}

export class Grid {
  readonly w = MAP_W;
  readonly h = MAP_H;
  tiles = new Uint8Array(MAP_W * MAP_H);
  room = new Int16Array(MAP_W * MAP_H).fill(-1);
  objSolid = new Uint8Array(MAP_W * MAP_H);
  doorIdx = new Int16Array(MAP_W * MAP_H).fill(-1);
  portalIdx = new Int16Array(MAP_W * MAP_H).fill(-1);
  breakIdx = new Int16Array(MAP_W * MAP_H).fill(-1);
  doors: DoorState[] = [];
  flags: Record<string, boolean> = {};

  constructor() {
    const { tiles } = this;
    // walls around every room (2 rows on top for the wall face)
    for (const r of ROOMS) {
      for (let y = r.y0 - 2; y <= r.y1 + 1; y++) {
        for (let x = r.x0 - 1; x <= r.x1 + 1; x++) {
          if (this.inb(x, y) && tiles[this.i(x, y)] === T_VOID) tiles[this.i(x, y)] = T_WALL;
        }
      }
    }
    ROOMS.forEach((r, ri) => {
      for (let y = r.y0; y <= r.y1; y++) {
        for (let x = r.x0; x <= r.x1; x++) {
          tiles[this.i(x, y)] = T_FLOOR;
          this.room[this.i(x, y)] = ri;
        }
      }
    });
    DOORS.forEach((d, di) => {
      const t: [number, number][] = d.kind === 'h' ? [[d.x, d.y], [d.x, d.y + 1]] : [[d.x, d.y]];
      for (const [x, y] of t) this.doorIdx[this.i(x, y)] = di;
      this.doors.push({ def: d, tiles: t, open: false, openAmount: 0, closeTimer: 0, locked: !!d.lock });
    });
    PORTALS.forEach((p, pi) => {
      for (const [x, y] of p.tiles) this.portalIdx[this.i(x, y)] = pi;
    });
    BREAKABLE.forEach((b, bi) => {
      for (const [x, y] of b.tiles) this.breakIdx[this.i(x, y)] = bi;
    });
    for (const o of OBJECTS) {
      if (o.decal || o.wall || o.solid === false) continue;
      const w = o.w ?? 1, h = o.h ?? 1;
      for (let y = o.y; y < o.y + h; y++) for (let x = o.x; x < o.x + w; x++) this.objSolid[this.i(x, y)] = 1;
    }
  }

  i(x: number, y: number) { return y * this.w + x; }
  inb(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  setFlags(flags: Record<string, boolean>) { this.flags = flags; }

  portalActive(p: PortalDef) { return !p.flag || !!this.flags[p.flag]; }

  portalAt(tx: number, ty: number): PortalDef | null {
    if (!this.inb(tx, ty)) return null;
    const pi = this.portalIdx[this.i(tx, ty)];
    if (pi < 0) return null;
    const p = PORTALS[pi];
    return this.portalActive(p) ? p : null;
  }

  doorAt(tx: number, ty: number): DoorState | null {
    if (!this.inb(tx, ty)) return null;
    const di = this.doorIdx[this.i(tx, ty)];
    return di < 0 ? null : this.doors[di];
  }

  isWallish(tx: number, ty: number): boolean {
    if (!this.inb(tx, ty)) return true;
    const k = this.i(tx, ty);
    if (this.doorIdx[k] >= 0) return false;
    const t = this.tiles[k];
    if (t === T_FLOOR) return false;
    const bi = this.breakIdx[k];
    if (bi >= 0 && this.flags[BREAKABLE[bi].flag]) return false;
    const pi = this.portalIdx[k];
    if (pi >= 0 && this.portalActive(PORTALS[pi])) return false;
    return true;
  }

  /** Solid for movement. */
  solid(tx: number, ty: number): boolean {
    if (this.isWallish(tx, ty)) return true;
    const k = this.i(tx, ty);
    if (this.objSolid[k]) return true;
    const di = this.doorIdx[k];
    if (di >= 0 && this.doors[di].locked) return true;
    return false;
  }

  blocksSight(tx: number, ty: number): boolean {
    if (!this.inb(tx, ty)) return true;
    const k = this.i(tx, ty);
    const di = this.doorIdx[k];
    if (di >= 0) return !this.doors[di].open;
    return this.isWallish(tx, ty);
  }

  roomAt(tx: number, ty: number): RoomDef | null {
    if (!this.inb(tx, ty)) return null;
    const ri = this.room[this.i(tx, ty)];
    return ri < 0 ? null : ROOMS[ri];
  }

  roomIndexAt(tx: number, ty: number): number {
    if (!this.inb(tx, ty)) return -1;
    return this.room[this.i(tx, ty)];
  }

  /** Line of sight between two world points (pixels). */
  los(x0: number, y0: number, x1: number, y1: number): boolean {
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.ceil(dist / 4);
    let lastK = -1;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const tx = Math.floor((x0 + dx * t) / TILE), ty = Math.floor((y0 + dy * t) / TILE);
      const k = ty * this.w + tx;
      if (k === lastK) continue;
      lastK = k;
      if (this.blocksSight(tx, ty)) return false;
    }
    return true;
  }

  /** Whether a box of half-size (hw,hh) can slide straight from a to b (pixels). */
  walkableLine(ax: number, ay: number, bx: number, by: number, hw: number, hh: number): boolean {
    const dist = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(dist / 4));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      if (this.boxBlocked(x, y, hw, hh, true)) return false;
    }
    return true;
  }

  /** Box centered at (x,y). avoidPortals: treat active portal tiles as blocked (for smoothing). */
  boxBlocked(x: number, y: number, hw: number, hh: number, avoidPortals = false): boolean {
    const x0 = Math.floor((x - hw) / TILE), x1 = Math.floor((x + hw - 0.01) / TILE);
    const y0 = Math.floor((y - hh) / TILE), y1 = Math.floor((y + hh - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (this.solid(tx, ty)) return true;
        if (avoidPortals && this.portalAt(tx, ty)) return true;
      }
    }
    return false;
  }

  /** A* over tiles with 8-way movement (no corner cutting) and portal edges. */
  findPath(sx: number, sy: number, gx: number, gy: number, maxNodes = 6000): [number, number][] | null {
    if (!this.inb(sx, sy) || !this.inb(gx, gy)) return null;
    if (this.solid(gx, gy)) {
      const n = this.nearestOpen(gx, gy, 3);
      if (!n) return null;
      [gx, gy] = n;
    }
    const W = this.w;
    const start = sy * W + sx, goal = gy * W + gx;
    if (start === goal) return [[sx, sy]];
    const g = new Float32Array(W * this.h).fill(Infinity);
    const came = new Int32Array(W * this.h).fill(-1);
    const closed = new Uint8Array(W * this.h);
    const open = new MinHeap();
    const hfn = (k: number) => {
      const x = k % W, y = (k / W) | 0;
      const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
      return Math.max(dx, dy) + 0.4142 * Math.min(dx, dy);
    };
    g[start] = 0;
    open.push(start, hfn(start));
    let expanded = 0;
    while (open.size) {
      const cur = open.pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (++expanded > maxNodes) return null;
      const cx = cur % W, cy = (cur / W) | 0;
      const portal = cur !== start ? this.portalAt(cx, cy) : null;
      if (portal) {
        const [dx, dy] = portal.dest;
        const nk = dy * W + dx;
        const ng = g[cur] + 1;
        if (ng < g[nk]) { g[nk] = ng; came[nk] = cur; open.push(nk, ng + hfn(nk)); }
        continue;
      }
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const nx = cx + ox, ny = cy + oy;
          if (!this.inb(nx, ny) || this.solid(nx, ny)) continue;
          if (ox && oy) {
            if (this.solid(cx + ox, cy) || this.solid(cx, cy + oy)) continue;
            // diagonals through door frames feel wrong
            if (this.doorAt(nx, ny) || this.doorAt(cx, cy)) continue;
          }
          const nk = ny * W + nx;
          if (closed[nk]) continue;
          let cost = ox && oy ? 1.4142 : 1;
          const d = this.doors[this.doorIdx[nk]];
          if (d && !d.open) cost += 0.6;
          const ng = g[cur] + cost;
          if (ng < g[nk]) { g[nk] = ng; came[nk] = cur; open.push(nk, ng + hfn(nk)); }
        }
      }
    }
    if (came[goal] < 0) return null;
    const path: [number, number][] = [];
    let k = goal;
    while (k !== -1 && k !== start) { path.push([k % W, (k / W) | 0]); k = came[k]; }
    path.push([sx, sy]);
    path.reverse();
    return path;
  }

  nearestOpen(tx: number, ty: number, radius: number): [number, number] | null {
    for (let r = 0; r <= radius; r++) {
      for (let oy = -r; oy <= r; oy++) {
        for (let ox = -r; ox <= r; ox++) {
          if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
          const x = tx + ox, y = ty + oy;
          if (this.inb(x, y) && !this.solid(x, y) && !this.portalAt(x, y) && this.tiles[this.i(x, y)] === T_FLOOR) return [x, y];
        }
      }
    }
    return null;
  }

  /** Random walkable floor tile inside a room. */
  randomTileInRoom(ri: number): [number, number] | null {
    const r = ROOMS[ri];
    for (let n = 0; n < 30; n++) {
      const x = r.x0 + Math.floor(Math.random() * (r.x1 - r.x0 + 1));
      const y = r.y0 + Math.floor(Math.random() * (r.y1 - r.y0 + 1));
      if (!this.solid(x, y) && !this.portalAt(x, y)) return [x, y];
    }
    return null;
  }
}
