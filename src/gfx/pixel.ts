export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Thin painter over a 2D context with an origin offset. */
export class P {
  constructor(public ctx: CanvasRenderingContext2D, public ox = 0, public oy = 0) {}
  at(ox: number, oy: number) { return new P(this.ctx, ox, oy); }
  r(x: number, y: number, w: number, h: number, c: string) {
    if (w <= 0 || h <= 0) return;
    this.ctx.fillStyle = c;
    this.ctx.fillRect(this.ox + x, this.oy + y, w, h);
  }
  p(x: number, y: number, c: string) { this.r(x, y, 1, 1, c); }
  h(x: number, y: number, w: number, c: string) { this.r(x, y, w, 1, c); }
  v(x: number, y: number, h: number, c: string) { this.r(x, y, 1, h, c); }
  box(x: number, y: number, w: number, h: number, fill: string, line: string) {
    this.r(x, y, w, h, line);
    this.r(x + 1, y + 1, w - 2, h - 2, fill);
  }
  /** bevelled block: light top/left edge, dark bottom/right edge */
  bevel(x: number, y: number, w: number, h: number, base: string, hi: string, lo: string) {
    this.r(x, y, w, h, base);
    this.h(x, y, w, hi);
    this.v(x, y, h, hi);
    this.h(x, y + h - 1, w, lo);
    this.v(x + w - 1, y, h, lo);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.p(x, y, c);
      }
    }
  }
  speckle(x: number, y: number, w: number, h: number, colors: string[], density: number, seed: number) {
    const R = rng(seed);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      if (R() < density) this.p(x + xx, y + yy, colors[Math.floor(R() * colors.length)]);
    }
  }
}

/** Adds a 1px dark outline around opaque pixels of a region. */
export function outline(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color = '#0b090c', alphaMin = 40) {
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  const out = new Uint8ClampedArray(d);
  const [cr, cg, cb] = hexToRgb(color);
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const k = (yy * w + xx) * 4;
      if (d[k + 3] > alphaMin) continue;
      let near = false;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = xx + ox, ny = yy + oy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (d[(ny * w + nx) * 4 + 3] > alphaMin) { near = true; break; }
      }
      if (near) { out[k] = cr; out[k + 1] = cg; out[k + 2] = cb; out[k + 3] = 255; }
    }
  }
  img.data.set(out);
  ctx.putImageData(img, x, y);
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function shade(hex: string, f: number): string {
  const [r, g, b] = hexToRgb(hex);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return `#${[c(r), c(g), c(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
