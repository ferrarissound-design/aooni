import Phaser from 'phaser';
import {
  CATCH_DIST, MONSTER_ALERT, MONSTER_CHASE, MONSTER_CHASE_FINAL, MONSTER_SEARCH, MONSTER_WANDER, TILE,
} from '../core/constants';
import { DoorState, Grid } from '../world/grid';
import { ROOMS } from '../world/mapdata';
import { Actor } from './actors';

export type MState = 'absent' | 'stare' | 'wander' | 'alert' | 'chase' | 'search' | 'leave' | 'scripted';

export interface HideSpot {
  id: string;
  /** center of the tile in front of the spot, in pixels */
  fx: number;
  fy: number;
  room: number;
}

export interface MonsterWorld {
  grid: Grid;
  player: { x: number; y: number; hidden: boolean; hideSpot: HideSpot | null; hiddenSince: number };
  hideSpots: HideSpot[];
  time: number;
  openDoor(d: DoorState, byMonster: boolean): void;
  monsterCaught(reason: 'touch' | 'found'): void;
  monsterEvent(ev: 'spotted' | 'lost' | 'check_hide' | 'leave' | 'step' | 'breath' | 'arrive_portal'): void;
  playerRoomIndex(): number;
}

interface Waypoint { x: number; y: number; tx: number; ty: number; jump: boolean }

export class Monster extends Actor {
  state: MState = 'absent';
  stateT = 0;
  private path: Waypoint[] = [];
  private pi = 0;
  private goalTile: [number, number] | null = null;
  private repathT = 0;
  private waitT = 0;
  private doorWaitT = 0;
  private pendingDoor: DoorState | null = null;
  private stuckT = 0;
  private stuckCount = 0;
  private lastProgress = { x: 0, y: 0 };
  private chaseSpeedT = 0;
  lastSeen: { x: number; y: number; t: number } | null = null;
  lostT = 0;
  private seenRecently = 0; // time since last sighting
  sawHide: HideSpot | null = null;
  private searchQueue: ({ kind: 'point'; x: number; y: number } | { kind: 'hide'; spot: HideSpot })[] = [];
  private checking: HideSpot | null = null;
  private checkT = 0;
  life = 0;
  relentless = false;
  quickGiveUp = false;
  canSee = false;
  private perceptT = 0;
  private stepDist = 0;
  private breathT = 3;
  private facing = { x: 0, y: 1 };
  stareT = 0;
  stareThen: MState = 'chase';
  lastChaseEnd = -999;
  private wanderPause = 0;
  noiseTarget: { x: number; y: number } | null = null;
  private nextHide: HideSpot | null = null;

  constructor(scene: Phaser.Scene, private world: MonsterWorld) {
    super(scene, 'monster', -100, -100, 5, 4, 'shadow_big');
    this.setVisible(false);
  }

  get present() { return this.state !== 'absent'; }

  spawn(tx: number, ty: number, state: MState, opts: { life?: number; stare?: number; then?: MState } = {}) {
    this.setTile(tx, ty);
    this.setVisible(true);
    this.setAlpha(1);
    this.path = [];
    this.pi = 0;
    this.goalTile = null;
    this.lastSeen = null;
    this.sawHide = null;
    this.searchQueue = [];
    this.checking = null;
    this.stuckT = 0;
    this.stuckCount = 0;
    this.lastProgress = { x: this.x, y: this.y };
    this.life = opts.life ?? 45 + Math.random() * 25;
    this.waitT = 0;
    this.doorWaitT = 0;
    this.pendingDoor = null;
    if (state === 'stare') {
      this.stareT = opts.stare ?? 1.4;
      this.stareThen = opts.then ?? 'chase';
    }
    this.setState(state);
  }

  despawn() {
    this.state = 'absent';
    this.setVisible(false);
    this.animate(false);
    this.setPos(-100, -100);
    this.relentless = false;
    this.quickGiveUp = false;
  }

  setState(s: MState) {
    const prev = this.state;
    this.state = s;
    this.stateT = 0;
    if (s === 'chase') {
      this.chaseSpeedT = prev === 'chase' ? this.chaseSpeedT : 0;
      this.lostT = 0;
      this.path = [];
      this.repathT = 0;
    }
    if (prev === 'chase' && s !== 'chase') this.lastChaseEnd = this.world.time;
  }

  /** Called when the world hears a noise (running, doors). */
  hear(x: number, y: number, radius: number) {
    if (!this.present || this.state === 'chase' || this.state === 'scripted' || this.state === 'stare') return;
    if (Math.hypot(x - this.x, y - this.y) > radius) return;
    this.noiseTarget = { x, y };
    this.lastSeen = { x, y, t: this.world.time };
    this.setState('alert');
    this.setGoal(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  private setGoal(tx: number, ty: number) {
    const g = this.world.grid;
    const path = g.findPath(this.tx, this.ty, tx, ty, 9000);
    this.goalTile = [tx, ty];
    if (!path) { this.path = []; this.pi = 0; return false; }
    this.path = path.map(([x, y], i) => {
      const prev = path[i - 1];
      const jump = !!prev && (Math.abs(prev[0] - x) > 1 || Math.abs(prev[1] - y) > 1);
      return { x: x * TILE + 8, y: y * TILE + 9, tx: x, ty: y, jump };
    });
    this.pi = 1;
    this.smooth();
    return true;
  }

  /** Skip waypoints that are directly reachable (straight walkable line). */
  private smooth() {
    const g = this.world.grid;
    let k = this.pi;
    for (let look = 0; look < 6; look++) {
      const nxt = this.path[k + 1];
      if (!nxt || nxt.jump) break;
      const cur = this.path[k];
      if (g.doorAt(cur.tx, cur.ty)) break;
      if (g.portalAt(cur.tx, cur.ty)) break;
      if (!g.walkableLine(this.x, this.y, nxt.x, nxt.y, this.hw + 1, this.hh + 1)) break;
      k++;
    }
    this.pi = k;
  }

  private followPath(speed: number, dt: number): 'moving' | 'arrived' | 'nopath' {
    if (this.waitT > 0) { this.waitT -= dt; this.animate(false); return 'moving'; }
    if (this.doorWaitT > 0) {
      this.doorWaitT -= dt;
      this.animate(false);
      if (this.doorWaitT <= 0 && this.pendingDoor) { this.world.openDoor(this.pendingDoor, true); this.pendingDoor = null; }
      return 'moving';
    }
    const wp = this.path[this.pi];
    if (!wp) return this.path.length ? 'arrived' : 'nopath';
    // closed door ahead: pause briefly to "open" it
    const d = this.world.grid.doorAt(wp.tx, wp.ty);
    if (d && !d.open && !d.locked && Math.hypot(wp.x - this.x, wp.y - this.y) < 22) {
      this.doorWaitT = this.state === 'chase' ? 0.32 : 0.6;
      this.pendingDoor = d;
      return 'moving';
    }
    const arrived = this.moveToward(this.world.grid, wp.x, wp.y, speed, dt);
    this.animate(true, speed / 50);
    this.stepDist += speed * dt;
    if (this.stepDist > 15) { this.stepDist = 0; this.world.monsterEvent('step'); }
    if (arrived || (Math.abs(wp.x - this.x) < 3 && Math.abs(wp.y - this.y) < 3)) {
      this.pi++;
      if (this.pi >= this.path.length) return 'arrived';
      this.smooth();
    }
    // stuck detection
    this.stuckT += dt;
    if (this.stuckT > 0.8) {
      const moved = Math.hypot(this.x - this.lastProgress.x, this.y - this.lastProgress.y);
      this.lastProgress = { x: this.x, y: this.y };
      this.stuckT = 0;
      if (moved < 4) {
        this.stuckCount++;
        if (this.stuckCount >= 3) {
          // unstick: hop onto the current waypoint centre
          const w = this.path[this.pi];
          if (w && !this.world.grid.solid(w.tx, w.ty)) this.setPos(w.x, w.y);
          this.stuckCount = 0;
        } else if (this.goalTile) {
          this.setGoal(this.goalTile[0], this.goalTile[1]);
        }
      } else this.stuckCount = 0;
    }
    return 'moving';
  }

  /** Re-sync path after a portal teleport. */
  onTeleported() {
    const idx = this.path.findIndex((w, i) => i >= this.pi && w.tx === this.tx && w.ty === this.ty);
    if (idx >= 0) { this.pi = idx + 1; this.smooth(); }
    else if (this.goalTile) this.setGoal(this.goalTile[0], this.goalTile[1]);
    this.world.monsterEvent('arrive_portal');
  }

  private perceive(dt: number) {
    this.perceptT -= dt;
    this.seenRecently += dt;
    if (this.perceptT > 0) return;
    this.perceptT = 0.1;
    const p = this.world.player;
    const g = this.world.grid;
    const dx = p.x - this.x, dy = p.y - this.y;
    const dist = Math.hypot(dx, dy);
    let see = false;
    if (!p.hidden) {
      const range = this.state === 'chase' ? 13 * TILE : 9 * TILE;
      if (dist < range) {
        const fl = Math.hypot(this.facing.x, this.facing.y) || 1;
        const dot = (dx * this.facing.x + dy * this.facing.y) / (fl * Math.max(dist, 1));
        const inFov = dot > Math.cos((62 * Math.PI) / 180) || dist < 2.6 * TILE || this.state === 'chase';
        if (inFov && g.los(this.x, this.y - 6, p.x, p.y - 4)) see = true;
      }
    }
    this.canSee = see;
    if (see) {
      this.lastSeen = { x: p.x, y: p.y, t: this.world.time };
      this.seenRecently = 0;
    }
  }

  update(dt: number) {
    if (this.state === 'absent') return;
    this.stateT += dt;
    if (this.state === 'scripted') return;
    const p = this.world.player;
    const g = this.world.grid;
    // facing vector for vision
    const fv = { down: { x: 0, y: 1 }, up: { x: 0, y: -1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[this.dir];
    this.facing.x += (fv.x - this.facing.x) * Math.min(1, dt * 8);
    this.facing.y += (fv.y - this.facing.y) * Math.min(1, dt * 8);
    this.perceive(dt);

    // noticed the player slipping into a hiding place
    if (p.hidden && p.hideSpot && !this.sawHide && this.state !== 'stare') {
      const justHid = this.world.time - p.hiddenSince < 0.35;
      if (justHid && this.seenRecently < 0.6 && Math.hypot(p.hideSpot.fx - this.x, p.hideSpot.fy - this.y) < 12 * TILE) {
        this.sawHide = p.hideSpot;
      }
    }

    // touching the player
    if (!p.hidden && Math.hypot(p.x - this.x, p.y - this.y) < CATCH_DIST && this.state !== 'stare') {
      this.world.monsterCaught('touch');
      return;
    }

    if (this.state !== 'chase' && this.state !== 'stare' && this.canSee) {
      this.world.monsterEvent('spotted');
      this.setState('chase');
    }

    switch (this.state) {
      case 'stare': {
        this.animate(false);
        this.faceToward(p.x, p.y);
        this.stareT -= dt;
        if (this.stareT <= 0) {
          if (this.stareThen === 'chase') this.world.monsterEvent('spotted');
          this.setState(this.stareThen);
          if (this.stareThen === 'chase') this.lastSeen = { x: p.x, y: p.y, t: this.world.time };
        }
        break;
      }
      case 'wander': this.updateWander(dt); break;
      case 'alert': {
        const r = this.followPath(MONSTER_ALERT, dt);
        if (r !== 'moving' || this.stateT > 14) this.startSearch(this.noiseTarget ?? { x: this.x, y: this.y }, false);
        break;
      }
      case 'chase': this.updateChase(dt); break;
      case 'search': this.updateSearch(dt); break;
      case 'leave': {
        const r = this.followPath(MONSTER_WANDER + 4, dt);
        const far = Math.hypot(p.x - this.x, p.y - this.y) > 10 * TILE;
        if (r !== 'moving' || (far && this.stateT > 4) || this.stateT > 25) {
          this.world.monsterEvent('leave');
          this.despawn();
        }
        break;
      }
    }

    // breathing when close
    this.breathT -= dt;
    if (this.breathT <= 0) {
      this.breathT = 2.5 + Math.random() * 3;
      this.world.monsterEvent('breath');
    }
    void g;
  }

  private updateWander(dt: number) {
    this.life -= dt;
    if (this.life <= 0) { this.startLeave(); return; }
    if (this.wanderPause > 0) {
      this.wanderPause -= dt;
      this.animate(false);
      if (Math.random() < dt * 0.8) this.face((['up', 'down', 'left', 'right'] as const)[Math.floor(Math.random() * 4)]);
      return;
    }
    const r = this.followPath(MONSTER_WANDER, dt);
    if (r !== 'moving') {
      this.wanderPause = 0.8 + Math.random() * 1.8;
      this.pickWanderGoal();
    }
  }

  pickWanderGoal() {
    const g = this.world.grid;
    const pr = this.world.playerRoomIndex();
    let ri: number;
    const roll = Math.random();
    if (roll < 0.45 && pr >= 0) ri = pr; // drift toward the player's room
    else if (roll < 0.75) {
      // a room adjacent to the player's (rooms that share a door)
      const adj = adjacentRooms(g, pr);
      ri = adj.length ? adj[Math.floor(Math.random() * adj.length)] : Math.floor(Math.random() * ROOMS.length);
    } else ri = Math.floor(Math.random() * ROOMS.length);
    // stay on the same floor as the monster unless heading to the player
    const mr = g.roomIndexAt(this.tx, this.ty);
    if (mr >= 0 && ri >= 0 && !!ROOMS[mr].basement !== !!ROOMS[ri].basement && ri !== pr) ri = mr;
    const t = g.randomTileInRoom(Math.max(0, ri));
    if (t) this.setGoal(t[0], t[1]);
  }

  private updateChase(dt: number) {
    const p = this.world.player;
    this.chaseSpeedT += dt;
    const top = this.relentless ? MONSTER_CHASE_FINAL : MONSTER_CHASE;
    const speed = Phaser.Math.Linear(60, top, Math.min(1, this.chaseSpeedT / 2.2));
    if (this.canSee) this.lostT = 0;
    else this.lostT += dt;
    // where to go: the real player position while tracking, else last seen
    const tracking = this.relentless || this.lostT < 1.6;
    let target: { x: number; y: number } | null = null;
    if (p.hidden && p.hideSpot) {
      // chased into a hiding spot
      if (this.sawHide === p.hideSpot) target = { x: p.hideSpot.fx, y: p.hideSpot.fy };
      else target = this.lastSeen;
    } else target = tracking ? { x: p.x, y: p.y } : this.lastSeen;
    if (!target) { this.startSearch({ x: this.x, y: this.y }, false); return; }
    this.repathT -= dt;
    const ttx = Math.floor(target.x / TILE), tty = Math.floor(target.y / TILE);
    if (this.repathT <= 0 || !this.goalTile || this.goalTile[0] !== ttx || this.goalTile[1] !== tty) {
      if (this.repathT <= 0 || this.path.length === 0) {
        this.setGoal(ttx, tty);
        this.repathT = this.canSee ? 0.25 : 0.5;
      }
    }
    // in the open with clear sight: go straight for it
    const direct = this.canSee && this.world.grid.walkableLine(this.x, this.y, p.x, p.y, this.hw, this.hh);
    let r: 'moving' | 'arrived' | 'nopath';
    if (direct && !p.hidden) {
      this.moveToward(this.world.grid, p.x, p.y, speed, dt);
      this.animate(true, speed / 50);
      this.stepDist += speed * dt;
      if (this.stepDist > 15) { this.stepDist = 0; this.world.monsterEvent('step'); }
      this.path = [];
      r = 'moving';
    } else {
      r = this.followPath(speed, dt);
    }
    // arrived at the hiding spot it saw the player enter
    if (p.hidden && p.hideSpot && this.sawHide === p.hideSpot && Math.hypot(p.hideSpot.fx - this.x, p.hideSpot.fy - this.y) < 14) {
      this.startCheck(p.hideSpot);
      this.setState('search');
      return;
    }
    const giveUp = this.relentless ? Infinity : this.quickGiveUp ? 3.5 : 7;
    if (!this.relentless && ((r !== 'moving' && !tracking) || this.lostT > giveUp)) {
      this.world.monsterEvent('lost');
      this.startSearch(this.lastSeen ?? { x: this.x, y: this.y }, true);
    }
  }

  startSearch(at: { x: number; y: number }, afterChase: boolean) {
    this.setState('search');
    const g = this.world.grid;
    this.searchQueue = [];
    const atx = Math.floor(at.x / TILE), aty = Math.floor(at.y / TILE);
    const spots = this.world.hideSpots
      .map((s) => ({ s, d: Math.hypot(s.fx - at.x, s.fy - at.y) }))
      .filter((o) => o.d < 7 * TILE)
      .sort((a, b) => a.d - b.d);
    const pts: typeof this.searchQueue = [];
    pts.push({ kind: 'point', x: at.x, y: at.y });
    for (const { s, d } of spots) {
      const chance = this.sawHide === s ? 1 : afterChase ? (d < 4 * TILE ? 0.55 : 0.3) : 0.2;
      if (Math.random() < chance) pts.push({ kind: 'hide', spot: s });
    }
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const ox = Math.floor(Math.random() * 11) - 5, oy = Math.floor(Math.random() * 9) - 4;
      const t = g.nearestOpen(atx + ox, aty + oy, 2);
      if (t) pts.push({ kind: 'point', x: t[0] * TILE + 8, y: t[1] * TILE + 9 });
    }
    // seen-hiding spot is checked first
    pts.sort((a, b) => (a.kind === 'hide' && a.spot === this.sawHide ? -1 : 0) - (b.kind === 'hide' && b.spot === this.sawHide ? -1 : 0));
    this.searchQueue = pts;
    this.nextSearchTarget();
  }

  private nextSearchTarget() {
    const q = this.searchQueue.shift();
    this.nextHide = null;
    if (!q) { this.startLeave(); return; }
    if (q.kind === 'point') this.setGoal(Math.floor(q.x / TILE), Math.floor(q.y / TILE));
    else { this.setGoal(Math.floor(q.spot.fx / TILE), Math.floor(q.spot.fy / TILE)); this.checking = null; this.nextHide = q.spot; }
  }

  private startCheck(spot: HideSpot) {
    this.checking = spot;
    this.checkT = 1.1;
    this.path = [];
    this.animate(false);
    this.world.monsterEvent('check_hide');
  }

  private updateSearch(dt: number) {
    const p = this.world.player;
    if (this.checking) {
      this.checkT -= dt;
      this.animate(false);
      if (this.checkT <= 0) {
        const spot = this.checking;
        this.checking = null;
        if (p.hidden && p.hideSpot === spot) {
          const caught = this.sawHide === spot ? Math.random() < 0.92 : Math.random() < 0.2;
          if (caught) { this.world.monsterCaught('found'); return; }
        }
        if (this.sawHide === spot) this.sawHide = null;
        this.waitT = 0.5;
        this.nextSearchTarget();
      }
      return;
    }
    if (this.stateT > (this.quickGiveUp ? 9 : 22)) { this.startLeave(); return; }
    const r = this.followPath(MONSTER_SEARCH, dt);
    if (r !== 'moving') {
      const hs = this.nextHide;
      if (hs) { this.nextHide = null; this.faceToward(hs.fx, hs.fy - 16); this.startCheck(hs); return; }
      this.waitT = 0.6 + Math.random() * 1.0;
      this.face((['up', 'down', 'left', 'right'] as const)[Math.floor(Math.random() * 4)]);
      this.nextSearchTarget();
    }
  }

  startLeave() {
    const g = this.world.grid;
    const p = this.world.player;
    // walk to the farthest nearby exit-ish tile (a door on the far side) then vanish
    const doors = g.doors.filter((d) => !d.locked);
    let best: [number, number] | null = null, bestScore = -Infinity;
    for (const d of doors) {
      const [tx, ty] = d.tiles[d.tiles.length - 1];
      const dm = Math.hypot(tx * TILE - this.x, ty * TILE - this.y);
      const dp = Math.hypot(tx * TILE - p.x, ty * TILE - p.y);
      if (dm > 18 * TILE) continue;
      const score = dp - dm * 0.5;
      if (score > bestScore) { bestScore = score; best = [tx, ty]; }
    }
    this.setState('leave');
    if (best) this.setGoal(best[0], best[1]);
  }
}

export function adjacentRooms(g: Grid, ri: number): number[] {
  if (ri < 0) return [];
  const out = new Set<number>();
  for (const d of g.doors) {
    const ends: [number, number][] = d.def.kind === 'h'
      ? [[d.def.x, d.def.y - 1], [d.def.x, d.def.y + 2]]
      : [[d.def.x - 1, d.def.y], [d.def.x + 1, d.def.y]];
    const rs = ends.map(([x, y]) => g.roomIndexAt(x, y));
    if (rs.includes(ri)) rs.forEach((r) => { if (r >= 0 && r !== ri) out.add(r); });
  }
  return [...out];
}
