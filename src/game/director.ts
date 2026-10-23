import { TILE } from '../core/constants';
import { ROOMS, SPAWN_POINTS } from '../world/mapdata';
import type { G } from './story';

/**
 * Schedules monster appearances and ambient scares. The rules keep spawns fair:
 * never in the player's room, never in view, and never closer than ~14 tiles by path.
 */
export class Director {
  cooldown = 40;
  ambientT = 18;
  grace = 6;
  enabled = false;
  private fakeSteps: { t: number; n: number; pan: number; vol: number } | null = null;

  constructor(private g: G) {}

  resetAfterLoad() {
    this.cooldown = 35 + Math.random() * 20;
    this.grace = 8;
    this.ambientT = 12 + Math.random() * 10;
  }

  onMonsterGone() {
    const f = this.g.state.flags;
    // later in the story the monster returns faster
    const progress = (f.books_solved ? 1 : 0) + (f.safe_opened ? 1 : 0) + (f.power_on ? 1 : 0) + (f.portrait_solved ? 1 : 0);
    const base = 70 - progress * 9;
    this.cooldown = base + Math.random() * 40;
  }

  update(dt: number) {
    const g = this.g;
    const f = g.state.flags;
    this.grace -= dt;
    this.updateFakeSteps(dt);
    if (!f.intro_done || f.escaped) return;

    // ambient scares
    this.ambientT -= dt;
    if (this.ambientT <= 0) {
      this.ambientT = 22 + Math.random() * 35;
      if (!g.monster.present || !g.monsterVisibleToPlayer()) this.ambientEvent();
    }

    if (!f.first_encounter_done || f.final_chase) return;
    if (g.monster.present) return;
    if (this.grace > 0) return;
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    if (this.trySpawn()) this.cooldown = 9999;
    else this.cooldown = 4;
  }

  trySpawn(): boolean {
    const g = this.g;
    const grid = g.grid;
    const p = g.player;
    const pr = grid.roomIndexAt(p.tx, p.ty);
    const playerBasement = pr >= 0 && !!ROOMS[pr].basement;
    const cands: { tx: number; ty: number; d: number }[] = [];
    for (const [tx, ty] of SPAWN_POINTS) {
      if (grid.solid(tx, ty)) continue;
      const ri = grid.roomIndexAt(tx, ty);
      if (ri === pr) continue;
      if (ri >= 0 && ri === grid.roomIndexAt(p.tx, p.ty)) continue;
      // spawn on the same floor as the player (the monster can still use the stairs)
      if (ri >= 0 && !!ROOMS[ri].basement !== playerBasement) continue;
      // the hidden room and cell stay out of the rotation
      if (ri >= 0 && ['hidden', 'cell', 'tunnel'].includes(ROOMS[ri].id)) continue;
      const wx = tx * TILE + 8, wy = ty * TILE + 8;
      if (grid.los(wx, wy, p.x, p.y)) continue;
      const path = grid.findPath(tx, ty, p.tx, p.ty, 7000);
      if (!path) continue;
      const d = path.length;
      if (d < 14 || d > 48) continue;
      cands.push({ tx, ty, d });
    }
    if (!cands.length) return false;
    // prefer mid-range spawns, with randomness so it is not predictable
    cands.sort((a, b) => Math.abs(a.d - 24) - Math.abs(b.d - 24));
    const top = cands.slice(0, Math.min(4, cands.length));
    const c = top[Math.floor(Math.random() * top.length)];
    g.spawnMonster(c.tx, c.ty, 'wander', { life: 40 + Math.random() * 30 });
    // announce faintly: a door somewhere, footsteps
    g.sfx('creak', { vol: 0.35, pan: Math.max(-1, Math.min(1, (c.tx * TILE - p.x) / 300)) });
    return true;
  }

  private ambientEvent() {
    const g = this.g;
    const p = g.player;
    const room = g.grid.roomAt(p.tx, p.ty);
    const basement = !!room?.basement;
    const options: (() => void)[] = [
      () => { g.flicker(0.4 + Math.random() * 0.9); g.sfx('buzz', { vol: 0.6 }); },
      () => this.startFakeSteps(),
      () => g.sfx('knock', { vol: 0.5, pan: Math.random() * 2 - 1 }),
      () => g.sfx('whisper', { vol: 0.7, pan: Math.random() * 2 - 1 }),
      () => g.sfx('crash', { vol: 0.3, pan: Math.random() * 2 - 1 }),
      () => this.slamNearbyDoor(),
    ];
    if (!basement) {
      options.push(() => g.lightning());
      options.push(() => g.lightning());
      if (room && ['child', 'bedroom', 'corN'].includes(room.id)) options.push(() => g.sfx('giggle', { vol: 0.5, pan: Math.random() * 2 - 1 }));
      if (room && ['living', 'corN', 'corS', 'hall'].includes(room.id)) options.push(() => g.sfx('chime', { vol: 0.3 }));
    } else {
      options.push(() => g.sfx('drip', { vol: 1 }));
    }
    options[Math.floor(Math.random() * options.length)]();
  }

  private slamNearbyDoor() {
    const g = this.g;
    const p = g.player;
    const doors = g.grid.doors.filter((d) => {
      if (d.locked) return false;
      const [tx, ty] = d.tiles[0];
      const dist = Math.hypot(tx * TILE - p.x, ty * TILE - p.y);
      return dist > 5 * TILE && dist < 16 * TILE;
    });
    if (!doors.length) { g.sfx('door_slam', { vol: 0.3 }); return; }
    const d = doors[Math.floor(Math.random() * doors.length)];
    const pan = Math.max(-1, Math.min(1, (d.tiles[0][0] * TILE - p.x) / 250));
    g.setDoorOpen(d, true, false);
    g.sfx('creak', { vol: 0.5, pan });
    setTimeout(() => {
      g.setDoorOpen(d, false, false);
      g.sfx('door_slam', { vol: 0.55, pan });
      g.shake(160, 0.003);
    }, 900);
  }

  /** Footsteps that walk past behind a wall, without an actual monster. */
  startFakeSteps() {
    this.fakeSteps = { t: 0, n: 7 + Math.floor(Math.random() * 5), pan: Math.random() < 0.5 ? -0.9 : 0.9, vol: 0.25 + Math.random() * 0.2 };
  }

  private updateFakeSteps(dt: number) {
    const fs = this.fakeSteps;
    if (!fs) return;
    fs.t -= dt;
    if (fs.t > 0) return;
    fs.t = 0.48;
    this.g.monsterStepSound(fs.vol, fs.pan);
    // the steps drift from one side to the other
    fs.pan = Math.max(-1, Math.min(1, fs.pan - Math.sign(fs.pan || 1) * 0.22));
    fs.n--;
    if (fs.n <= 0) this.fakeSteps = null;
  }
}
