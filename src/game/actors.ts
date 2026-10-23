import Phaser from 'phaser';
import { DEPTH, Dir, TILE } from '../core/constants';
import { Grid } from '../world/grid';

export class Actor {
  x: number;
  y: number;
  dir: Dir = 'down';
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  moving = false;
  visible = true;
  stepAcc = 0;

  constructor(
    public scene: Phaser.Scene,
    public key: string,
    x: number,
    y: number,
    public hw = 5,
    public hh = 4,
    shadowKey = 'shadow',
  ) {
    this.x = x;
    this.y = y;
    this.shadow = scene.add.image(x, y, shadowKey).setDepth(DEPTH.actor - 1);
    this.sprite = scene.add.sprite(x, y, key, 'down_0').setOrigin(0.5, 1);
    this.sync();
  }

  get tx() { return Math.floor(this.x / TILE); }
  get ty() { return Math.floor(this.y / TILE); }

  setPos(x: number, y: number) { this.x = x; this.y = y; this.sync(); }
  setTile(tx: number, ty: number) { this.setPos(tx * TILE + TILE / 2, ty * TILE + TILE / 2 + 2); }

  face(dir: Dir) {
    this.dir = dir;
    if (!this.moving) this.sprite.setFrame(`${dir}_0`);
  }

  faceToward(x: number, y: number) {
    const dx = x - this.x, dy = y - this.y;
    if (Math.abs(dx) > Math.abs(dy)) this.face(dx > 0 ? 'right' : 'left');
    else this.face(dy > 0 ? 'down' : 'up');
  }

  setVisible(v: boolean) {
    this.visible = v;
    this.sprite.setVisible(v);
    this.shadow.setVisible(v);
  }

  setAlpha(a: number) {
    this.sprite.setAlpha(a);
    this.shadow.setAlpha(a);
  }

  sync() {
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y + this.hh));
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y + this.hh - 1));
    this.sprite.setDepth(DEPTH.actor + this.y);
  }

  animate(moving: boolean, rate = 1) {
    this.moving = moving;
    const key = `${this.key}_walk_${this.dir}`;
    if (moving) {
      if (this.sprite.anims.currentAnim?.key !== key || !this.sprite.anims.isPlaying) this.sprite.play(key);
      this.sprite.anims.timeScale = rate;
    } else {
      this.sprite.anims.stop();
      this.sprite.setFrame(`${this.dir}_0`);
    }
  }

  /**
   * Moves with tile collision, axis-separated so the actor slides along walls.
   * With `assist`, nudges around corners so 1-tile doorways are easy to enter.
   */
  move(grid: Grid, dx: number, dy: number, assist = true): { mx: number; my: number } {
    const sx = this.x, sy = this.y;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 2));
    const ix = dx / steps, iy = dy / steps;
    let blockedX = false, blockedY = false;
    for (let s = 0; s < steps; s++) {
      if (ix && !blockedX) {
        if (!grid.boxBlocked(this.x + ix, this.y, this.hw, this.hh)) this.x += ix;
        else blockedX = true;
      }
      if (iy && !blockedY) {
        if (!grid.boxBlocked(this.x, this.y + iy, this.hw, this.hh)) this.y += iy;
        else blockedY = true;
      }
    }
    if (assist) {
      const amt = Math.max(Math.abs(dx), Math.abs(dy));
      if (blockedY && Math.abs(dx) < 0.01) this.nudge(grid, 'x', Math.sign(dy), amt);
      else if (blockedX && Math.abs(dy) < 0.01) this.nudge(grid, 'y', Math.sign(dx), amt);
    }
    this.sync();
    return { mx: this.x - sx, my: this.y - sy };
  }

  private nudge(grid: Grid, axis: 'x' | 'y', fwd: number, amt: number) {
    for (let k = 1; k <= 9; k++) {
      for (const side of [1, -1]) {
        const ox = axis === 'x' ? side * k : 0;
        const oy = axis === 'y' ? side * k : 0;
        const fx = axis === 'x' ? 0 : fwd * 2;
        const fy = axis === 'y' ? 0 : fwd * 2;
        if (!grid.boxBlocked(this.x + ox, this.y + oy, this.hw, this.hh) && !grid.boxBlocked(this.x + ox + fx, this.y + oy + fy, this.hw, this.hh)) {
          const step = Math.min(amt, k) * side;
          if (axis === 'x') { if (!grid.boxBlocked(this.x + step, this.y, this.hw, this.hh)) this.x += step; }
          else if (!grid.boxBlocked(this.x, this.y + step, this.hw, this.hh)) this.y += step;
          return;
        }
      }
    }
  }

  /** Moves toward a point; returns true when arrived. */
  moveToward(grid: Grid, tx: number, ty: number, speed: number, dt: number): boolean {
    const dx = tx - this.x, dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1.5) { this.x = tx; this.y = ty; this.sync(); return true; }
    const stepLen = Math.min(dist, speed * dt);
    const vx = (dx / dist) * stepLen, vy = (dy / dist) * stepLen;
    if (Math.abs(vx) > Math.abs(vy) * 1.1) this.dir = vx > 0 ? 'right' : 'left';
    else if (Math.abs(vy) > Math.abs(vx) * 1.1) this.dir = vy > 0 ? 'down' : 'up';
    this.move(grid, vx, vy, true);
    return Math.hypot(tx - this.x, ty - this.y) < 1.5;
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}

/** Simple scripted walker along an A* path (for NPCs and cutscenes). */
export class PathWalker {
  private pts: { x: number; y: number }[] = [];
  private i = 0;
  private resolve: (() => void) | null = null;
  constructor(public actor: Actor, public speed: number) {}

  go(grid: Grid, tx: number, ty: number): Promise<void> {
    const path = grid.findPath(this.actor.tx, this.actor.ty, tx, ty) ?? [[tx, ty]];
    this.pts = path.slice(1).map(([x, y]) => ({ x: x * TILE + 8, y: y * TILE + 10 }));
    this.i = 0;
    this.resolve?.();
    return new Promise((r) => { this.resolve = r; if (!this.pts.length) this.finish(); });
  }

  get busy() { return this.resolve !== null; }

  private finish() {
    this.actor.animate(false);
    const r = this.resolve;
    this.resolve = null;
    r?.();
  }

  update(grid: Grid, dt: number) {
    if (!this.resolve) return;
    const p = this.pts[this.i];
    if (!p) { this.finish(); return; }
    this.actor.animate(true, this.speed / 60);
    // walkers ignore collisions with other actors and pass through doors freely
    const dx = p.x - this.actor.x, dy = p.y - this.actor.y;
    const d = Math.hypot(dx, dy);
    const st = Math.min(d, this.speed * dt);
    if (d > 0.5) {
      this.actor.x += (dx / d) * st;
      this.actor.y += (dy / d) * st;
      if (Math.abs(dx) > Math.abs(dy)) this.actor.dir = dx > 0 ? 'right' : 'left';
      else this.actor.dir = dy > 0 ? 'down' : 'up';
      this.actor.sync();
    }
    if (d - st < 0.6) {
      this.i++;
      if (this.i >= this.pts.length) this.finish();
    }
    void grid;
  }
}
