import Phaser from 'phaser';
import { Sfx, Sound } from '../audio/audio';
import {
  DEPTH, Dir, DIR_VEC, PLAYER_DASH, PLAYER_WALK, STAMINA_MAX, STAMINA_REGEN, STAMINA_REGEN_DELAY, TILE,
} from '../core/constants';
import { Save } from '../core/save';
import { GameState, hasItem, ITEMS, newGameState } from '../core/state';
import { masterPortrait, monsterCloseup } from '../gfx/characters';
import { objDataURL } from '../gfx/textures';
import { renderMapBase } from '../gfx/tiles';
import { getUI } from '../ui/instance';
import { h, UI } from '../ui/ui';
import { DoorState, Grid } from '../world/grid';
import { MAP_H, MAP_W, OBJECTS, ObjDef, ROOMS, STATIC_LIGHTS } from '../world/mapdata';
import { Actor, PathWalker } from './actors';
import { Director } from './director';
import { HideSpot, Monster, MonsterWorld, MState } from './monster';
import * as story from './story';
import { G } from './story';
import { NOTES, objective } from './texts';

class Player extends Actor {
  hidden = false;
  hideSpot: HideSpot | null = null;
  hiddenSince = 0;
  stamina = STAMINA_MAX;
  staminaDelay = 0;
  exhausted = false;
  dashing = false;
}

type Target =
  | { kind: 'obj'; obj: ObjDef; x: number; y: number }
  | { kind: 'door'; door: DoorState; x: number; y: number }
  | { kind: 'saki'; x: number; y: number };

interface LightSrc { x: number; y: number; r: number; color: number; alpha: number; flicker: boolean; room: number; flag?: string; glow?: Phaser.GameObjects.Image }

export class GameScene extends Phaser.Scene implements G {
  ui!: UI;
  state!: GameState;
  grid!: Grid;
  monster!: Monster;
  saki!: Actor;
  sakiWalker!: PathWalker;
  player!: Player;
  portraitURL = '';
  cutsceneDepth = 0;
  pendingEvents = new Set<string>();
  director!: Director;

  private objSprites = new Map<string, Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>();
  private objRects: { obj: ObjDef; x0: number; y0: number; x1: number; y1: number }[] = [];
  private doorSprites: Phaser.GameObjects.Image[] = [];
  private fogRects: Phaser.GameObjects.Rectangle[] = [];
  private visibleRooms = new Set<number>();
  private dark!: Phaser.GameObjects.RenderTexture;
  private lightImg!: Phaser.GameObjects.Image;
  private coneImg!: Phaser.GameObjects.Image;
  private lamps: LightSrc[] = [];
  private playerGlow!: Phaser.GameObjects.Image;
  private glint!: Phaser.GameObjects.Image;
  private mark!: Phaser.GameObjects.Image;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private hideSpots: HideSpot[] = [];
  private currentRoom = -1;
  worldTime = 0;
  private flickerT = 0;
  private flickerVal = 1;
  private flickerTick = 0;
  private gameOver = false;
  private ending = false;
  private transiting = false;
  private busy = false;
  private stepAcc = 0;
  private chaseOffT = 0;
  private chaseOn = false;
  private lastSting = -99;
  private monsterAlpha = 0;
  private settings = Save.settings();
  private iconCache = new Map<string, string>();
  private closeupURL = '';
  private mode: 'new' | 'continue' = 'new';
  private target: Target | null = null;
  private lastSaveToast = 0;
  /** test hooks: time multiplier and a simple autopilot that drives the real input path */
  timeScale = 1;
  autopilot: { pts: { x: number; y: number }[]; i: number; dash: boolean } | null = null;

  constructor() {
    super('game');
  }

  init(data: { mode?: 'new' | 'continue' }) {
    this.mode = data?.mode ?? 'new';
  }

  // ======================================================================== create
  create() {
    this.ui = getUI();
    this.ui.buildTouch();
    this.ui.setTouchVisible(true);
    this.ui.setHudVisible(true);
    this.cutsceneDepth = 0;
    this.pendingEvents = new Set();
    this.objSprites = new Map();
    this.objRects = [];
    this.doorSprites = [];
    this.fogRects = [];
    this.lamps = [];
    this.hideSpots = [];
    this.currentRoom = -1;
    this.worldTime = 0;
    this.flickerT = 0;
    this.gameOver = false;
    this.ending = false;
    this.transiting = false;
    this.busy = false;
    this.chaseOn = false;
    this.monsterAlpha = 0;
    this.settings = Save.settings();
    Sound.setVolume(this.settings.volume);
    Sound.setChase(false);

    // ---- state
    let loaded = false;
    if (this.mode === 'continue') {
      const r = Save.read();
      if (r) {
        this.state = r.state;
        loaded = true;
        if (r.restoredFromBackup) this.time.delayedCall(800, () => this.ui.toast('セーブデータが破損していたため、1つ前の記録から復元しました', 4000));
        else if (r.fixes.length) console.info('save repaired', r.fixes);
      }
    }
    if (!loaded) this.state = newGameState();

    this.grid = new Grid();
    this.grid.setFlags(this.state.flags);
    for (const d of this.grid.doors) if (this.state.unlocked.includes(d.def.id)) d.locked = false;
    if (this.state.flags.power_on) this.grid.doors.find((d) => d.def.id === 'door_shutter')!.locked = false;

    // ---- map & objects
    if (this.textures.exists('mapbase')) this.textures.remove('mapbase');
    this.textures.addCanvas('mapbase', renderMapBase(this.grid));
    this.add.image(0, 0, 'mapbase').setOrigin(0).setDepth(DEPTH.map);
    this.buildObjects();
    this.buildDoors();
    this.buildFog();
    this.applyFlagVisuals();

    // ---- actors
    this.player = new Player(this, 'player', this.state.px, this.state.py);
    this.player.face(this.state.facing);
    this.saki = new Actor(this, 'saki', -100, -100);
    this.saki.setVisible(false);
    this.sakiWalker = new PathWalker(this.saki, 60);
    this.monster = new Monster(this, this.monsterWorld());
    if (this.state.flags.power_on && !this.state.flags.escaped) {
      this.saki.setTile(54, 50);
      this.saki.setVisible(true);
    }

    // ---- lighting
    this.lightImg = this.make.image({ key: 'light', add: false }).setOrigin(0.5);
    this.coneImg = this.make.image({ key: 'cone', add: false }).setOrigin(0, 0.5);
    this.createDarkness();
    this.playerGlow = this.add.image(0, 0, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe0b0).setDepth(DEPTH.dark + 1).setAlpha(0.06);
    this.glint = this.add.image(0, 0, 'glint').setDepth(DEPTH.glint).setVisible(false);
    this.mark = this.add.image(0, 0, 'mark').setDepth(DEPTH.fx).setVisible(false);

    // ---- camera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    cam.setRoundPixels(true);
    cam.startFollow(this.player.sprite, true, 0.18, 0.18, 0, 8);
    cam.setBackgroundColor('#000');
    this.applyZoom();
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
      Sound.setChase(false);
      this.ui.red(0);
      this.ui.setHidden(false);
    });

    // ---- input
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys({
      up: 'W', down: 'S', left: 'A', right: 'D',
      up2: 'UP', down2: 'DOWN', left2: 'LEFT', right2: 'RIGHT',
      dash: 'SHIFT', act: 'E', act2: 'ENTER', act3: 'SPACE', act4: 'Z', menu: 'ESC', menu2: 'TAB',
    }) as Record<string, Phaser.Input.Keyboard.Key>;

    this.director = new Director(this);
    this.portraitURL = masterPortrait().toDataURL();
    this.closeupURL = monsterCloseup().toDataURL();
    (window as any).__game = this;

    // ---- start
    this.updateRoom(true);
    if (!loaded) {
      this.ui.fade(true, 0);
      void story.introScene(this);
    } else {
      this.director.resetAfterLoad();
      if (this.state.flags.saki_found && !this.state.flags.ambush_done) this.pendingEvents.add('basement_ambush');
      void this.ui.fade(false, 900);
      this.ui.showLocation(this.grid.roomAt(this.player.tx, this.player.ty)?.name ?? '');
      this.refreshObjective(true);
      if (this.state.flags.final_chase && !this.state.flags.escaped) {
        this.time.delayedCall(1500, () => this.spawnMonster(7, 49, 'chase', { relentless: true }));
      }
    }
  }

  private monsterWorld(): MonsterWorld {
    const self = this;
    return {
      get grid() { return self.grid; },
      get player() { return self.player; },
      get hideSpots() { return self.hideSpots; },
      get time() { return self.worldTime; },
      openDoor: (d, byMonster) => this.setDoorOpen(d, true, true, byMonster),
      monsterCaught: (r) => this.onCaught(r),
      monsterEvent: (ev) => this.onMonsterEvent(ev),
      playerRoomIndex: () => this.grid.roomIndexAt(this.player.tx, this.player.ty),
    };
  }

  // ======================================================================== world building
  private buildObjects() {
    for (const o of OBJECTS) {
      const w = o.w ?? 1, hgt = o.h ?? 1;
      let sp: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
      if (o.decal) {
        sp = this.add.image(o.x * TILE, o.y * TILE, o.tex).setOrigin(0).setDepth(DEPTH.decal);
      } else if (o.wall) {
        sp = this.add.image(o.x * TILE, o.y * TILE, o.tex).setOrigin(0).setDepth(DEPTH.object + 1);
      } else {
        const by = (o.y + hgt) * TILE;
        sp = o.tex === 'fireplace'
          ? this.add.sprite(o.x * TILE, by, 'fireplace_0').setOrigin(0, 1).play('fire')
          : this.add.image(o.x * TILE, by, o.tex).setOrigin(0, 1);
        sp.setDepth(DEPTH.object + by / 4);
      }
      this.objSprites.set(o.id, sp);
      if (o.interact) {
        let y1 = (o.y + hgt) * TILE;
        if (o.wall) {
          // extend the hit area down through the wall face to the floor
          let ty = o.y + hgt;
          while (ty < MAP_H && this.grid.isWallish(o.x, ty) && !this.grid.doorAt(o.x, ty)) ty++;
          y1 = ty * TILE + 2;
        }
        this.objRects.push({ obj: o, x0: o.x * TILE, y0: o.y * TILE, x1: (o.x + w) * TILE, y1 });
      }
      if (o.hide) {
        const fx = o.x + Math.floor((w - 1) / 2);
        const fy = o.y + hgt;
        this.hideSpots.push({ id: o.id, fx: fx * TILE + 8, fy: fy * TILE + 9, room: this.grid.roomIndexAt(fx, fy) });
      }
      if (o.light) {
        const cx = (o.x + w / 2) * TILE;
        const cy = o.wall ? (o.y + hgt) * TILE : (o.y + hgt / 2) * TILE;
        const ri = this.grid.roomIndexAt(Math.floor(cx / TILE), Math.min(MAP_H - 1, Math.floor(cy / TILE) + (o.wall ? 1 : 0)));
        const glow = this.add.image(cx, cy, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(o.light.color ?? 0xffb060).setDepth(DEPTH.dark + 1);
        glow.setScale((o.light.r * 2.4) / 256);
        this.lamps.push({ x: cx, y: cy, r: o.light.r, color: o.light.color ?? 0xffb060, alpha: o.light.alpha ?? 0.8, flicker: !!o.light.flicker, room: ri, glow });
      }
    }
    for (const l of STATIC_LIGHTS) {
      const ri = this.grid.roomIndexAt(Math.floor(l.x / TILE), Math.floor(l.y / TILE));
      const glow = this.add.image(l.x, l.y, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(l.color).setDepth(DEPTH.dark + 1).setScale((l.r * 2.4) / 256);
      this.lamps.push({ x: l.x, y: l.y, r: l.r, color: l.color, alpha: l.alpha, flicker: !!l.flicker, room: ri, flag: l.flag, glow });
    }
  }

  private doorTex(d: DoorState): string {
    const style = d.def.style ?? 'wood';
    if (style === 'shutter') return d.open ? 'shutter_open' : 'shutter_closed';
    if (style === 'iron') return d.open ? 'gate_open' : 'gate_closed';
    return d.def.kind === 'h' ? (d.open ? 'door_h_open' : 'door_h_closed') : (d.open ? 'door_v_open' : 'door_v_closed');
  }

  private buildDoors() {
    this.grid.doors.forEach((d) => {
      const [x, y] = d.tiles[0];
      const img = this.add.image(x * TILE, y * TILE, this.doorTex(d)).setOrigin(0).setDepth(DEPTH.door + y);
      this.doorSprites.push(img);
    });
  }

  private buildFog() {
    ROOMS.forEach((r) => {
      const rect = this.add.rectangle(r.x0 * TILE, (r.y0 - 2) * TILE, (r.x1 - r.x0 + 1) * TILE, (r.y1 - r.y0 + 3) * TILE, 0x000000, 1)
        .setOrigin(0).setDepth(DEPTH.fog);
      this.fogRects.push(rect);
    });
  }

  private createDarkness() {
    this.dark?.destroy();
    const cam = this.cameras.main;
    const w = Math.ceil(cam.width / Math.max(1, cam.zoom)) + 48;
    const hh = Math.ceil(cam.height / Math.max(1, cam.zoom)) + 48;
    this.dark = this.add.renderTexture(0, 0, w, hh).setOrigin(0).setDepth(DEPTH.dark);
  }

  private applyZoom() {
    const cam = this.cameras.main;
    const W = this.scale.width, H = this.scale.height;
    const portrait = H > W;
    const z = portrait ? W / (15 * TILE) : Math.min(W / (20 * TILE), H / (12.5 * TILE));
    cam.setZoom(Phaser.Math.Clamp(Math.round(z), 1, 14));
    this.createDarkness();
  }

  private onResize() {
    this.cameras.main.setSize(this.scale.width, this.scale.height);
    this.applyZoom();
  }

  /** Object textures and grid state that depend on flags. */
  private applyFlagVisuals() {
    const f = this.state.flags;
    if (f.got_flashlight) this.setObjTex('nightstand', 'nightstand_empty');
    if (f.bath_drained) this.setObjTex('bathtub', 'bathtub_empty');
    if (f.mirror_msg) this.setObjTex('mirror', 'mirror_msg');
    if (f.books_solved) this.setObjTex('lib_color', 'bookshelf_color_open');
    if (f.portrait_solved) this.setObjTex('portrait_torn', 'portrait_open');
    if (f.power_on) this.setObjTex('breaker', 'breaker_on');
    if (f.got_gate_key) this.setObjTex('altar', 'altar_empty');
    if (f.wall_broken) this.setObjTex('cracked', 'rubble');
  }

  // ======================================================================== G implementation
  wait(ms: number) { return new Promise<void>((r) => this.time.delayedCall(ms, r)); }

  sfx(name: Sfx, o?: { vol?: number; pan?: number }) { Sound.sfx(name, o); }

  shake(ms: number, intensity: number) { if (this.settings.shake) this.cameras.main.shake(ms, intensity); }

  flicker(seconds: number) { this.flickerT = Math.max(this.flickerT, seconds); }

  lightning() {
    const r = this.grid.roomAt(this.player.tx, this.player.ty);
    if (r?.basement) return;
    this.ui.flash('#c8d4ff', 0.55, 420);
    for (const o of OBJECTS) if (o.tex === 'window') this.objSprites.get(o.id)?.setTexture('window_flash');
    this.time.delayedCall(140, () => { for (const o of OBJECTS) if (o.tex === 'window') this.objSprites.get(o.id)?.setTexture('window'); });
    this.time.delayedCall(350 + Math.random() * 600, () => { Sound.sfx('thunder', { pan: Math.random() - 0.5 }); this.shake(400, 0.002); });
  }

  setObjTex(id: string, tex: string) {
    const sp = this.objSprites.get(id);
    if (sp && this.textures.exists(tex)) sp.setTexture(tex);
  }

  doorById(id: string): DoorState { return this.grid.doors.find((d) => d.def.id === id)!; }

  unlockDoor(id: string) {
    const d = this.doorById(id);
    d.locked = false;
    if (!this.state.unlocked.includes(id)) this.state.unlocked.push(id);
  }

  setDoorOpen(d: DoorState, open: boolean, sound = true, byMonster = false) {
    if (d.open === open) { if (open) d.closeTimer = 3; return; }
    d.open = open;
    d.closeTimer = open ? 3.2 : 0;
    const i = this.grid.doors.indexOf(d);
    this.doorSprites[i]?.setTexture(this.doorTex(d));
    if (!sound) return;
    const [tx, ty] = d.tiles[d.tiles.length - 1];
    const { vol, pan } = this.spatial(tx * TILE + 8, ty * TILE + 8, 20 * TILE);
    if (vol <= 0.01) return;
    if (d.def.style === 'iron') Sound.sfx('gate', { vol, pan });
    else if (d.def.style === 'shutter') Sound.sfx('shutter', { vol, pan });
    else Sound.sfx(open ? 'door_open' : 'door_close', { vol: vol * (byMonster ? 1.2 : 0.8), pan });
    if (open && !byMonster && this.monster.present) this.monster.hear(tx * TILE + 8, ty * TILE + 8, 6 * TILE);
  }

  private spatial(x: number, y: number, range: number) {
    const dx = x - this.player.x, dy = y - this.player.y;
    const d = Math.hypot(dx, dy);
    let vol = Math.max(0, 1 - d / range);
    vol = vol * vol;
    if (!this.grid.los(this.player.x, this.player.y, x, y)) vol *= 0.55;
    return { vol, pan: Phaser.Math.Clamp(dx / 220, -1, 1) };
  }

  monsterStepSound(vol: number, pan: number) { Sound.monsterStep(vol, pan); }

  saveGame(label: string): boolean {
    const s = this.state;
    const p = this.player;
    if (p.hidden && p.hideSpot) { s.px = p.hideSpot.fx; s.py = p.hideSpot.fy; } else { s.px = p.x; s.py = p.y; }
    s.facing = p.dir;
    s.saveLabel = label;
    return Save.write(s);
  }

  autosave(label: string) {
    if (this.state.flags.final_chase || this.isChasing() || this.gameOver) return;
    if (this.saveGame(label) && this.worldTime - this.lastSaveToast > 2) {
      this.lastSaveToast = this.worldTime;
      this.ui.toast('オートセーブしました', 1600);
    }
  }

  spawnMonster(tx: number, ty: number, state: MState, opts: { life?: number; stare?: number; then?: MState; relentless?: boolean; quick?: boolean } = {}) {
    this.monster.spawn(tx, ty, state, opts);
    this.monster.relentless = !!opts.relentless;
    this.monster.quickGiveUp = !!opts.quick;
    if (state === 'wander') this.monster.pickWanderGoal();
    if (state === 'chase') this.monster.lastSeen = { x: this.player.x, y: this.player.y, t: this.worldTime };
  }

  hideIn(spot: HideSpot) {
    const p = this.player;
    p.hidden = true;
    p.hideSpot = spot;
    p.hiddenSince = this.worldTime;
    p.setPos(spot.fx, spot.fy);
    p.setVisible(false);
    p.animate(false);
    this.ui.setHidden(true);
    Sound.sfx('hide');
    if (this.monster.present) this.monster.hear(spot.fx, spot.fy, 2.5 * TILE);
  }

  private unhide() {
    const p = this.player;
    if (!p.hidden) return;
    p.hidden = false;
    p.hideSpot = null;
    p.setVisible(true);
    p.face('down');
    this.ui.setHidden(false);
    Sound.sfx('hide', { vol: 0.7 });
  }

  hideSpotFor(objId: string) { return this.hideSpots.find((s) => s.id === objId); }

  isChasing() { return this.monster.present && (this.monster.state === 'chase' || this.monster.state === 'stare'); }

  monsterVisibleToPlayer() { return this.monsterAlpha > 0.3; }

  refreshObjective(show = true) {
    if (!show) return;
    const o = objective(this.state);
    this.ui.objective(o.text);
  }

  teleportPlayer(tx: number, ty: number, dir: Dir) {
    this.player.setTile(tx, ty);
    this.player.face(dir);
    this.cameras.main.centerOn(this.player.x, this.player.y);
    this.updateRoom(true);
  }

  // ======================================================================== update
  update(_t: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.05) * this.timeScale;
    Sound.update(dt);
    this.updateFlicker(dt);
    if (this.gameOver || this.ending) { this.drawLighting(); return; }
    const ui = this.ui;
    const inCut = this.cutsceneDepth > 0;
    const blocked = ui.blocking;

    const menuPressed = Phaser.Input.Keyboard.JustDown(this.keys.menu) || Phaser.Input.Keyboard.JustDown(this.keys.menu2) || ui.consumeTouchMenu();
    if (menuPressed && !blocked && !inCut && !this.transiting && !this.busy) void this.openMenu();

    if (!blocked) {
      this.worldTime += dt;
      this.state.playTime += dt;
    }
    this.sakiWalker.update(this.grid, dt);

    const canControl = !blocked && !inCut && !this.transiting && !this.busy;
    if (canControl) this.updatePlayer(dt);
    else if (!this.transiting) { this.player.animate(false); this.player.dashing = false; }

    const actPressed = Phaser.Input.Keyboard.JustDown(this.keys.act) || Phaser.Input.Keyboard.JustDown(this.keys.act2)
      || Phaser.Input.Keyboard.JustDown(this.keys.act3) || Phaser.Input.Keyboard.JustDown(this.keys.act4) || ui.consumeTouchAct();
    this.target = canControl && !this.player.hidden ? this.findTarget() : null;
    if (actPressed && canControl && performance.now() - ui.lastClose > 220) this.doInteract();

    if (!blocked) {
      this.monster.update(dt);
      this.updateDoors(dt);
      this.updatePortals();
      if (!inCut) {
        this.director.update(dt);
        this.checkTriggers();
      }
    }
    this.updateRoom(false);
    this.updateMonsterPresentation(dt);
    this.drawLighting();
    this.updateMark();
    ui.setStamina(this.player.stamina / STAMINA_MAX);
  }

  private inputVec(): { x: number; y: number } {
    const ap = this.autopilot;
    if (ap) {
      let wp = ap.pts[ap.i];
      while (wp && Math.hypot(wp.x - this.player.x, wp.y - this.player.y) < 3) wp = ap.pts[++ap.i];
      if (!wp) { this.autopilot = null; return { x: 0, y: 0 }; }
      const dx = wp.x - this.player.x, dy = wp.y - this.player.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: dx / len, y: dy / len };
    }
    const k = this.keys;
    let x = 0, y = 0;
    if (k.left.isDown || k.left2.isDown) x -= 1;
    if (k.right.isDown || k.right2.isDown) x += 1;
    if (k.up.isDown || k.up2.isDown) y -= 1;
    if (k.down.isDown || k.down2.isDown) y += 1;
    const t = this.ui.touch;
    if (Math.abs(t.x) > 0.01 || Math.abs(t.y) > 0.01) { x = t.x; y = t.y; }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    const v = this.inputVec();
    const moving = Math.hypot(v.x, v.y) > 0.15;
    if (p.hidden) {
      if (moving && this.worldTime - p.hiddenSince > 0.45) this.unhide();
      return;
    }
    const wantDash = (this.keys.dash.isDown || this.ui.touch.dash || !!this.autopilot?.dash) && moving;
    if (p.exhausted && p.stamina > STAMINA_MAX * 0.3) p.exhausted = false;
    const dash = wantDash && !p.exhausted && p.stamina > 0;
    if (dash) {
      p.stamina -= dt;
      p.staminaDelay = STAMINA_REGEN_DELAY;
      if (p.stamina <= 0) { p.stamina = 0; p.exhausted = true; }
    } else {
      p.staminaDelay -= dt;
      if (p.staminaDelay <= 0) p.stamina = Math.min(STAMINA_MAX, p.stamina + STAMINA_REGEN * dt * (moving ? 1 : 1.6));
    }
    p.dashing = dash;
    if (!moving) { p.animate(false); return; }
    const mag = Math.min(1, Math.hypot(v.x, v.y) * 1.25);
    const speed = (dash ? PLAYER_DASH : PLAYER_WALK) * mag;
    if (Math.abs(v.x) > Math.abs(v.y)) p.dir = v.x > 0 ? 'right' : 'left';
    else p.dir = v.y > 0 ? 'down' : 'up';
    const m = p.move(this.grid, v.x * speed * dt, v.y * speed * dt, true);
    const dist = Math.hypot(m.mx, m.my);
    p.animate(dist > 0.05, dash ? 1.7 : 1);
    this.stepAcc += dist;
    if (this.stepAcc > (dash ? 17 : 14)) {
      this.stepAcc = 0;
      const room = this.grid.roomAt(p.tx, p.ty);
      const fl = room?.floor ?? 'wood';
      const surface = fl === 'stone' || fl === 'hidden' ? 'stone' : fl === 'tile_white' || fl === 'tile_check' ? 'tile' : fl.startsWith('carpet') || fl === 'library' ? 'carpet' : 'wood';
      Sound.step(surface, dash ? 1 : 0.55);
      if (this.monster.present) this.monster.hear(p.x, p.y, dash ? 6.5 * TILE : 1.6 * TILE);
    }
  }

  private findTarget(): Target | null {
    const p = this.player;
    const dv = DIR_VEC[p.dir];
    for (const reach of [10, 16]) {
      const px = p.x + dv.x * reach, py = p.y + dv.y * reach - 1;
      if (this.saki.visible && Math.hypot(this.saki.x - px, this.saki.y - py) < 12 && !this.sakiWalker.busy) {
        return { kind: 'saki', x: this.saki.x, y: this.saki.y - 26 };
      }
      const d = this.grid.doorAt(Math.floor(px / TILE), Math.floor(py / TILE));
      if (d && (d.locked || !d.open)) {
        const [tx, ty] = d.tiles[0];
        return { kind: 'door', door: d, x: tx * TILE + 8, y: ty * TILE - 2 };
      }
      for (const r of this.objRects) {
        if (px >= r.x0 && px < r.x1 && py >= r.y0 && py < r.y1) {
          const sp = this.objSprites.get(r.obj.id);
          const top = sp ? sp.getBounds().top : r.y0;
          return { kind: 'obj', obj: r.obj, x: (r.x0 + r.x1) / 2, y: top - 3 };
        }
      }
    }
    return null;
  }

  private doInteract() {
    const p = this.player;
    if (p.hidden) { this.unhide(); return; }
    const t = this.target;
    if (!t) return;
    this.busy = true;
    p.animate(false);
    let job: Promise<void>;
    if (t.kind === 'obj') job = story.interactObject(this, t.obj);
    else if (t.kind === 'door') job = story.interactDoor(this, t.door);
    else job = story.talkSaki(this);
    job.catch((e) => console.error(e)).finally(() => { this.busy = false; });
  }

  private updateMark() {
    const t = this.target;
    if (!t || this.ui.blocking || this.cutsceneDepth > 0) { this.mark.setVisible(false); return; }
    this.mark.setVisible(true);
    this.mark.setPosition(Math.round(t.x), Math.round(t.y - 4 + Math.sin(this.worldTime * 5) * 1.5));
  }

  // ---------------------------------------------------------------- doors / portals
  private actorOverDoor(a: Actor, d: DoorState): boolean {
    if (!a.visible) return false;
    for (const [tx, ty] of d.tiles) {
      const x0 = tx * TILE - a.hw - 1, x1 = (tx + 1) * TILE + a.hw + 1;
      const y0 = ty * TILE - a.hh - 1, y1 = (ty + 1) * TILE + a.hh + 1;
      if (a.x > x0 && a.x < x1 && a.y > y0 && a.y < y1) return true;
    }
    return false;
  }

  private updateDoors(dt: number) {
    for (const d of this.grid.doors) {
      if (d.locked) continue;
      const pOn = !this.player.hidden && this.actorOverDoor(this.player, d);
      const mOn = this.monster.present && this.actorOverDoor(this.monster, d);
      const sOn = this.saki.visible && this.actorOverDoor(this.saki, d);
      const occupied = pOn || mOn || sOn;
      if (occupied) {
        if (!d.open) this.setDoorOpen(d, true, true, mOn && !pOn);
        d.closeTimer = 2.6;
      } else if (d.open) {
        d.closeTimer -= dt;
        if (d.closeTimer <= 0 && d.def.style !== 'iron' && d.def.style !== 'shutter') this.setDoorOpen(d, false, true);
      }
    }
  }

  private updatePortals() {
    const p = this.player;
    if (!this.transiting && !p.hidden && this.cutsceneDepth === 0) {
      const portal = this.grid.portalAt(p.tx, p.ty);
      if (portal) void this.transit(portal.dest, portal.id);
    }
    const m = this.monster;
    if (m.present && m.state !== 'scripted') {
      const portal = this.grid.portalAt(m.tx, m.ty);
      if (portal) {
        m.setTile(portal.dest[0], portal.dest[1]);
        m.onTeleported();
      }
    }
  }

  private async transit(dest: [number, number], id: string) {
    this.transiting = true;
    this.player.animate(false);
    Sound.step('wood', 0.8);
    await this.ui.fade(true, 220);
    const dir: Dir = id === 'stairs_up' || id === 'secret_up' ? 'down' : 'down';
    this.teleportPlayer(dest[0], dest[1], dir);
    // a chasing monster keeps tracking the player through the stairs
    await this.wait(120);
    await this.ui.fade(false, 260);
    this.transiting = false;
  }

  // ---------------------------------------------------------------- rooms / triggers
  private updateRoom(force: boolean) {
    const p = this.player;
    const ri = this.grid.roomIndexAt(p.tx, p.ty);
    const vis = new Set<number>();
    const cur = ri >= 0 ? ri : this.currentRoom;
    if (cur >= 0) vis.add(cur);
    // standing in a doorway reveals both sides
    const d = this.grid.doorAt(p.tx, p.ty) ?? this.grid.doorAt(p.tx, Math.floor((p.y - 6) / TILE)) ?? this.grid.doorAt(p.tx, Math.floor((p.y + 6) / TILE));
    if (d && !d.locked) {
      const ends: [number, number][] = d.def.kind === 'h' ? [[d.def.x, d.def.y - 1], [d.def.x, d.def.y + 2]] : [[d.def.x - 1, d.def.y], [d.def.x + 1, d.def.y]];
      for (const [x, y] of ends) { const r = this.grid.roomIndexAt(x, y); if (r >= 0) vis.add(r); }
    }
    this.visibleRooms = vis;
    this.fogRects.forEach((rect, i) => {
      const target = vis.has(i) ? 0 : 1;
      const a = rect.alpha + (target - rect.alpha) * (force ? 1 : 0.25);
      rect.setAlpha(Math.abs(a - target) < 0.02 ? target : a);
    });
    if (ri >= 0 && ri !== this.currentRoom) {
      const prev = this.currentRoom;
      this.currentRoom = ri;
      const room = ROOMS[ri];
      if (!force && (prev < 0 || ROOMS[prev].name !== room.name)) this.ui.showLocation(room.name);
      Sound.setAmbient(room.basement ? 'basement' : 'house');
      this.onEnterRoom(room.id);
    }
  }

  private onEnterRoom(id: string) {
    const f = this.state.flags;
    if (id === 'hidden' && !f.got_gate_key && !f.hidden_visited) {
      f.hidden_visited = true;
      this.autosave('隠し部屋');
      this.time.delayedCall(300, () => void this.ui.say(['……空気が重い。壁一面に、顔を引っかかれた肖像画が掛けられている。']));
    }
  }

  private checkTriggers() {
    const f = this.state.flags;
    if (this.busy || this.transiting) return;
    const room = ROOMS[this.currentRoom]?.id;
    if (room === 'corN' && f.bath_drained && !f.first_encounter_done && !this.player.hidden) {
      void story.firstEncounter(this);
      return;
    }
    if (room === 'basement' && !f.basement_visited) {
      this.busy = true;
      void story.basementArrival(this).finally(() => { this.busy = false; });
      return;
    }
    if (room === 'basement' && this.pendingEvents.has('basement_ambush') && !this.monster.present) {
      this.pendingEvents.delete('basement_ambush');
      f.ambush_done = true;
      void story.basementAmbush(this);
      return;
    }
    if (room === 'tunnel' && !f.escaped && this.player.tx >= 51) {
      void story.endingScene(this);
      return;
    }
    if (this.pendingEvents.has('first_escape') && !this.monster.present) {
      this.pendingEvents.delete('first_escape');
      this.busy = true;
      void story.afterFirstEscape(this).finally(() => { this.busy = false; });
    }
  }

  // ---------------------------------------------------------------- monster presentation & audio
  private onMonsterEvent(ev: 'spotted' | 'lost' | 'check_hide' | 'leave' | 'step' | 'breath' | 'arrive_portal') {
    const m = this.monster;
    switch (ev) {
      case 'spotted':
        if (this.worldTime - this.lastSting > 12) {
          this.lastSting = this.worldTime;
          Sound.sfx('sting', { vol: 0.75 });
          this.shake(250, 0.004);
        }
        break;
      case 'step': {
        const { vol, pan } = this.spatial(m.x, m.y, 18 * TILE);
        Sound.monsterStep(vol * (m.state === 'chase' ? 1 : 0.75), pan);
        if (vol > 0.5 && m.state === 'chase') this.shake(60, 0.0015);
        break;
      }
      case 'breath': {
        const { vol, pan } = this.spatial(m.x, m.y, 7 * TILE);
        Sound.monsterBreath(vol, pan);
        break;
      }
      case 'check_hide': {
        const { vol, pan } = this.spatial(m.x, m.y, 14 * TILE);
        Sound.sfx('creak', { vol: Math.max(0.3, vol), pan });
        if (this.player.hidden && this.player.hideSpot && Math.hypot(this.player.hideSpot.fx - m.x, this.player.hideSpot.fy - m.y) < 30) this.shake(900, 0.003);
        break;
      }
      case 'leave':
        this.director.onMonsterGone();
        if (this.state.flags.first_encounter_done && !this.state.flags.first_escape_msg) this.pendingEvents.add('first_escape');
        break;
      case 'arrive_portal': {
        const { vol, pan } = this.spatial(m.x, m.y, 16 * TILE);
        if (vol > 0.02) Sound.sfx('door_open', { vol, pan });
        break;
      }
      case 'lost':
        break;
    }
  }

  private updateMonsterPresentation(dt: number) {
    const m = this.monster;
    const p = this.player;
    let prox = 0;
    let targetAlpha = 0;
    if (m.present) {
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      const mr = this.grid.roomIndexAt(m.tx, m.ty);
      const visible = (mr >= 0 && this.visibleRooms.has(mr)) || (d < 11 * TILE && this.grid.los(p.x, p.y - 4, m.x, m.y - 8));
      targetAlpha = visible ? 1 : 0;
      prox = Math.max(0, 1 - d / (15 * TILE));
      if (m.state === 'chase') prox = Math.max(prox, 0.55);
      // glowing eyes when it stands in the dark
      const lightR = hasItem(this.state, 'flashlight') ? 70 : 60;
      if (visible && d > lightR && m.dir !== 'up' && m.state !== 'scripted') {
        this.glint.setVisible(true);
        this.glint.setPosition(Math.round(m.x + (m.dir === 'left' ? -4 : m.dir === 'right' ? 4 : 0)), Math.round(m.y + m.hh - 28 + (m.sprite.anims.isPlaying ? 0 : 0)));
        this.glint.setAlpha(0.55 + Math.sin(this.worldTime * 9) * 0.15);
        this.glint.setScale(m.dir === 'down' ? 1 : 0.6, 1);
      } else this.glint.setVisible(false);
    } else this.glint.setVisible(false);
    this.monsterAlpha += (targetAlpha - this.monsterAlpha) * Math.min(1, dt * 10);
    m.setAlpha(this.monsterAlpha);
    // saki visibility follows the same rule
    if (this.saki.visible) {
      const sr = this.grid.roomIndexAt(this.saki.tx, this.saki.ty);
      const sv = this.cutsceneDepth > 0 || (sr >= 0 && this.visibleRooms.has(sr));
      this.saki.setAlpha(sv ? 1 : 0);
    }
    Sound.setProximity(prox);
    const chasing = m.present && m.state === 'chase';
    if (chasing) { this.chaseOffT = 1.8; if (!this.chaseOn) { this.chaseOn = true; Sound.setChase(true); } }
    else if (this.chaseOn) {
      this.chaseOffT -= dt;
      if (this.chaseOffT <= 0) { this.chaseOn = false; Sound.setChase(false); }
    }
    this.ui.red(chasing ? 0.12 + prox * 0.25 : 0);
  }

  // ---------------------------------------------------------------- lighting
  private updateFlicker(dt: number) {
    this.flickerTick -= dt;
    if (this.flickerT > 0) {
      this.flickerT -= dt;
      if (this.flickerTick <= 0) {
        this.flickerTick = 0.05 + Math.random() * 0.08;
        this.flickerVal = Math.random() < 0.45 ? 0.1 + Math.random() * 0.25 : 0.75 + Math.random() * 0.25;
      }
    } else this.flickerVal = 1;
  }

  private drawLighting() {
    const cam = this.cameras.main;
    const rt = this.dark;
    const view = cam.worldView;
    const ox = Math.floor(view.x) - 24, oy = Math.floor(view.y) - 24;
    rt.setPosition(ox, oy);
    const p = this.player;
    const room = ROOMS[this.currentRoom];
    const f = this.state.flags;
    let darkA = room ? room.dark : 0.94;
    if (room?.basement && room.id === 'basement') darkA = f.power_on ? 0.9 : 0.978;
    if (p.hidden) darkA = 0.985;
    const fv = this.flickerVal;
    rt.clear();
    rt.fill(0x000000, Math.min(0.995, darkA + (1 - fv) * 0.08));
    const L = this.lightImg;
    const t = this.worldTime;
    const torch = hasItem(this.state, 'flashlight');
    const px = p.x, py = p.y - 8;
    // personal light
    const pr = p.hidden ? 22 : torch ? 50 : 64;
    const wob = torch ? 1 : 1 + Math.sin(t * 7.3) * 0.03 + Math.sin(t * 13.1) * 0.02;
    L.setScale((pr * 2 * wob) / 256).setAlpha(fv * (p.hidden ? 0.5 : 0.96));
    rt.erase(L, px - ox, py - oy);
    if (torch && !p.hidden) {
      const ang = { down: Math.PI / 2, up: -Math.PI / 2, left: Math.PI, right: 0 }[p.dir];
      this.coneImg.setRotation(ang).setAlpha(fv * 0.95).setScale(1.05);
      rt.erase(this.coneImg, px - ox, py - oy);
    }
    this.playerGlow.setPosition(px, py).setScale((pr * 2.4) / 256).setAlpha(p.hidden ? 0 : 0.05 * fv);
    // environmental lights (only in rooms the player can see)
    for (const l of this.lamps) {
      const on = (!l.flag || f[l.flag]) && (l.room < 0 || this.visibleRooms.has(l.room));
      if (!on) { l.glow?.setVisible(false); continue; }
      const fl = l.flicker ? 0.88 + Math.sin(t * 9 + l.x) * 0.06 + Math.sin(t * 23 + l.y) * 0.05 : 1;
      if (l.x < ox - l.r || l.x > ox + rt.width + l.r || l.y < oy - l.r || l.y > oy + rt.height + l.r) { l.glow?.setVisible(false); continue; }
      L.setScale((l.r * 2 * fl) / 256).setAlpha(l.alpha * fv * fl);
      rt.erase(L, l.x - ox, l.y - oy);
      if (l.glow) l.glow.setVisible(true).setAlpha(0.2 * l.alpha * fv * fl);
    }
  }

  // ---------------------------------------------------------------- menu
  private icon(key: string) {
    if (!this.iconCache.has(key)) this.iconCache.set(key, objDataURL(key, 2));
    return this.iconCache.get(key)!;
  }

  private async openMenu() {
    this.busy = true;
    const s = this.state;
    const o = objective(s);
    const tm = Math.floor(s.playTime);
    await this.ui.openMenu({
      items: s.items.map((id) => ({ name: ITEMS[id].name, desc: ITEMS[id].desc, icon: this.icon(ITEMS[id].icon) })),
      notes: s.notes.map((n) => ({ title: NOTES[n].title, body: NOTES[n].body(s) })),
      objective: `目的：${o.text}`,
      hint: o.hint,
      playTime: `${Math.floor(tm / 60)}分${String(tm % 60).padStart(2, '0')}秒`,
      volume: this.settings.volume,
      shake: this.settings.shake,
      onSettings: (v) => { this.settings = v; Sound.setVolume(v.volume); Save.saveSettings(v); },
      onTitle: () => { this.toTitle(); },
    });
    this.busy = false;
  }

  private toTitle() {
    Sound.setChase(false);
    this.ui.setHidden(false);
    this.scene.start('title');
  }

  // ---------------------------------------------------------------- game over / ending
  private onCaught(_reason: 'touch' | 'found') {
    if (this.gameOver || this.ending) return;
    this.gameOver = true;
    this.player.animate(false);
    this.monster.animate(false);
    Sound.setChase(false);
    Sound.setProximity(0);
    Sound.sfx('scream');
    this.shake(700, 0.02);
    this.ui.setHidden(false);
    this.ui.red(0);
    // persist the death count on top of the last save
    const r = Save.read();
    if (r) { r.state.deaths = (r.state.deaths ?? 0) + 1; Save.write(r.state); }
    let ready = false;
    let b1!: HTMLButtonElement, b2!: HTMLButtonElement;
    const scr = this.ui.screen('gameover', (e) => {
      if (!ready) return;
      if (['ArrowUp', 'ArrowDown', 'w', 's', 'W', 'S'].includes(e.key)) (document.activeElement === b1 ? b2 : b1).focus();
      else if (['Enter', 'e', 'E', ' '].includes(e.key)) (document.activeElement === b2 ? b2 : b1).click();
    });
    const face = h('div', 'face', scr.el);
    face.style.backgroundImage = `url(${this.closeupURL})`;
    const inner = h('div', 'inner', scr.el);
    h('h2', '', inner, 'GAME OVER');
    h('div', '', inner, '大首に捕まってしまった……').style.cssText = 'color:var(--dim);margin-bottom:18px';
    b1 = h('button', 'btn', inner, Save.exists() ? '最後の記録から再開' : 'はじめから');
    b2 = h('button', 'btn', inner, 'タイトルへ');
    b1.style.minWidth = '240px'; b2.style.minWidth = '240px';
    b1.style.textAlign = 'center'; b2.style.textAlign = 'center';
    b1.addEventListener('click', () => { if (!ready) return; scr.close(); this.scene.restart({ mode: Save.exists() ? 'continue' : 'new' }); });
    b2.addEventListener('click', () => { if (!ready) return; scr.close(); this.scene.start('title'); });
    setTimeout(() => { face.classList.add('fade'); }, 1500);
    setTimeout(() => { inner.classList.add('show'); ready = true; b1.focus(); }, 2200);
  }

  startEnding() {
    this.ending = true;
    this.monster.despawn();
    Sound.setChase(false);
    Sound.setProximity(0);
    Sound.setAmbient('ending');
    const s = this.state;
    Save.recordClear(s.playTime);
    const r = Save.read();
    const deaths = Math.max(s.deaths, r?.state.deaths ?? 0);
    this.ui.setTouchVisible(false);
    let btn!: HTMLButtonElement;
    const scr = this.ui.screen('ending', (e) => {
      if (['Enter', 'e', 'E', ' '].includes(e.key) && document.activeElement === btn) btn.click();
    });
    const sc = h('div', 'scroll', scr.el);
    const tm = Math.floor(s.playTime);
    sc.innerHTML = '';
    const lines = [
      '梯子を上りきると、そこは館の裏手にある古井戸だった。',
      '東の空が、白み始めている。',
      '',
      '振り返ると、鴉羽邸の窓という窓から――',
      '大きな顔が、こちらを見下ろしていた。',
      '',
      '二人は一度も振り返らずに、夜明けの坂道を駆け下りた。',
      '',
      '……あの館には、今も大きな顔の主が棲んでいるという。',
      '誰ひとり、出ていかぬように。',
    ];
    const body = h('div', '', sc);
    body.textContent = lines.join('\n');
    h('h2', '', sc, '― 脱出成功 ―');
    h('div', '', sc, `プレイ時間　${Math.floor(tm / 60)}分${String(tm % 60).padStart(2, '0')}秒\n捕まった回数　${deaths}回`).style.color = 'var(--dim)';
    h('div', '', sc, '\n鴉羽邸 ― 大首の館 ―\nThank you for playing.').style.color = 'var(--dim)';
    btn = h('button', 'btn', sc, 'タイトルへ');
    btn.style.marginTop = '20px';
    btn.style.textAlign = 'center';
    btn.addEventListener('click', () => { scr.close(); this.ui.fade(false, 0); this.scene.start('title'); });
    setTimeout(() => { sc.classList.add('show'); void this.ui.fade(false, 400); }, 300);
    setTimeout(() => btn.focus(), 2500);
  }
}
