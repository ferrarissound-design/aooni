import { Sound } from '../audio/audio';

export type Line = string | { name?: string; text: string; style?: 'think' | 'system' };

type KeyHandler = (e: KeyboardEvent) => void;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  if (parent) parent.appendChild(el);
  return el;
}

export interface MenuContext {
  items: { name: string; desc: string; icon: string }[];
  notes: { title: string; body: string }[];
  objective: string;
  hint: string;
  playTime: string;
  volume: number;
  shake: boolean;
  onSettings: (v: { volume: number; shake: boolean }) => void;
  onTitle: () => void;
}

/** Moves keyboard focus among buttons inside `root` in the given direction. */
export function spatialNav(root: HTMLElement, dir: 'up' | 'down' | 'left' | 'right') {
  const btns = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), input')).filter((b) => b.offsetParent !== null);
  if (!btns.length) return;
  const cur = document.activeElement as HTMLElement;
  if (!btns.includes(cur)) { btns[0].focus(); return; }
  const r0 = cur.getBoundingClientRect();
  const c0 = { x: r0.left + r0.width / 2, y: r0.top + r0.height / 2 };
  let best: HTMLElement | null = null, bestScore = Infinity;
  for (const b of btns) {
    if (b === cur) continue;
    const r = b.getBoundingClientRect();
    const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const dx = c.x - c0.x, dy = c.y - c0.y;
    let primary = 0, secondary = 0;
    if (dir === 'up') { primary = -dy; secondary = Math.abs(dx); }
    if (dir === 'down') { primary = dy; secondary = Math.abs(dx); }
    if (dir === 'left') { primary = -dx; secondary = Math.abs(dy); }
    if (dir === 'right') { primary = dx; secondary = Math.abs(dy); }
    if (primary <= 2) continue;
    const score = primary + secondary * 2.5;
    if (score < bestScore) { bestScore = score; best = b; }
  }
  if (best) { best.focus(); Sound.sfx('cursor'); }
}

export class UI {
  root: HTMLElement;
  hud: HTMLElement;
  private locEl: HTMLElement;
  private toastEl: HTMLElement;
  private objEl: HTMLElement;
  private staminaEl: HTMLElement;
  private staminaBar: HTMLElement;
  private hideEl: HTMLElement;
  private fadeEl: HTMLElement;
  private flashEl: HTMLElement;
  private redEl: HTMLElement;
  private keyStack: KeyHandler[] = [];
  private modalCount = 0;
  lastClose = 0;
  touchEnabled = false;
  touch = { x: 0, y: 0, dash: false, act: false, menu: false };
  private touchEl: HTMLElement | null = null;
  private toastTimer = 0;
  private locTimer = 0;

  constructor() {
    this.root = document.getElementById('ui')!;
    h('div', 'vignette passthru', this.root);
    h('div', 'grain passthru', this.root);
    this.hud = h('div', 'passthru', this.root);
    this.hud.id = 'hud';
    this.locEl = h('div', 'loc', this.hud);
    this.toastEl = h('div', 'toast', this.hud);
    this.objEl = h('div', 'objective', this.hud);
    this.staminaEl = h('div', 'stamina', this.hud);
    this.staminaBar = h('div', '', this.staminaEl);
    this.hideEl = h('div', 'hidebar', this.hud);
    h('div', 'label', this.hideEl, '― 息を殺している ―');
    this.flashEl = h('div', 'flash passthru', this.root);
    this.redEl = h('div', 'redflash passthru', this.root);
    this.fadeEl = h('div', 'fade passthru', this.root);
    window.addEventListener('keydown', (e) => {
      const top = this.keyStack[this.keyStack.length - 1];
      if (top) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter', 'Escape', 'Tab'].includes(e.key)) e.preventDefault();
        if (e.repeat && !e.key.startsWith('Arrow')) return;
        top(e);
      } else if (e.key === ' ' || e.key.startsWith('Arrow')) {
        e.preventDefault();
      }
    });
    // iOS: prevent pinch/double-tap zoom gestures
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    this.touchEnabled = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  get blocking(): boolean { return this.modalCount > 0; }

  private pushModal(handler: KeyHandler) {
    this.modalCount++;
    this.keyStack.push(handler);
    this.updateTouchVisibility();
  }
  private popModal(handler: KeyHandler) {
    this.modalCount = Math.max(0, this.modalCount - 1);
    this.keyStack = this.keyStack.filter((k) => k !== handler);
    this.lastClose = performance.now();
    this.updateTouchVisibility();
  }

  // ---------------- HUD ----------------
  showLocation(name: string) {
    this.locEl.textContent = name;
    this.locEl.classList.add('show');
    clearTimeout(this.locTimer);
    this.locTimer = window.setTimeout(() => this.locEl.classList.remove('show'), 2200);
  }
  toast(text: string, ms = 2200) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }
  objective(text: string) {
    this.objEl.textContent = text ? `目的：${text}` : '';
    this.objEl.classList.toggle('show', !!text);
    window.setTimeout(() => this.objEl.classList.remove('show'), 6000);
  }
  setStamina(frac: number) {
    this.staminaBar.style.width = `${Math.round(frac * 100)}%`;
    this.staminaEl.classList.toggle('show', frac < 0.999);
  }
  setHidden(on: boolean) { this.hideEl.classList.toggle('show', on); }
  setHudVisible(on: boolean) { this.hud.style.display = on ? '' : 'none'; }

  fade(on: boolean, ms = 500): Promise<void> {
    this.fadeEl.style.transitionDuration = `${ms}ms`;
    this.fadeEl.classList.toggle('on', on);
    return new Promise((r) => setTimeout(r, ms + 30));
  }
  flash(color = '#c8d4ff', peak = 0.85, ms = 380) {
    const el = this.flashEl;
    el.style.background = color;
    el.style.transition = 'none';
    el.style.opacity = String(peak);
    void el.offsetWidth;
    el.style.transition = `opacity ${ms}ms ease-out`;
    el.style.opacity = '0';
  }
  red(intensity: number) {
    this.redEl.style.opacity = String(Math.max(0, Math.min(1, intensity)));
  }

  // ---------------- dialog ----------------
  async say(lines: Line[]): Promise<void> {
    for (const l of lines) await this.sayOne(typeof l === 'string' ? { text: l } : l);
  }

  private sayOne(line: { name?: string; text: string; style?: 'think' | 'system' }): Promise<void> {
    return new Promise((resolve) => {
      const layer = h('div', '', this.root);
      layer.style.cssText = 'position:absolute;inset:0;';
      const box = h('div', `dialog ${line.style ?? ''}`, layer);
      if (line.name) h('div', 'name', box, line.name);
      const textEl = h('div', 'text', box);
      const next = h('div', 'next', box, '▼');
      next.style.visibility = 'hidden';
      const full = line.text;
      let shown = 0;
      let done = false;
      const opened = performance.now();
      const timer = window.setInterval(() => {
        shown = Math.min(full.length, shown + 2);
        textEl.textContent = full.slice(0, shown);
        if (shown >= full.length) finishType();
      }, 30);
      const finishType = () => {
        if (done) return;
        done = true;
        clearInterval(timer);
        textEl.textContent = full;
        next.style.visibility = 'visible';
      };
      const advance = () => {
        if (performance.now() - opened < 180) return;
        if (!done) { finishType(); return; }
        cleanup();
        Sound.sfx('cursor', { vol: 0.6 });
        resolve();
      };
      const key: KeyHandler = (e) => {
        if (['e', 'E', 'Enter', ' ', 'z', 'Z', 'Escape'].includes(e.key)) advance();
      };
      const onPointer = (e: PointerEvent) => { e.preventDefault(); advance(); };
      layer.addEventListener('pointerdown', onPointer);
      const cleanup = () => {
        clearInterval(timer);
        layer.removeEventListener('pointerdown', onPointer);
        layer.remove();
        this.popModal(key);
      };
      this.pushModal(key);
    });
  }

  // ---------------- choice ----------------
  choose(prompt: string, options: string[], cancelIndex = -1): Promise<number> {
    return new Promise((resolve) => {
      const layer = h('div', '', this.root);
      layer.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.35)';
      const box = h('div', 'choice', layer);
      if (prompt) h('div', 'prompt', box, prompt);
      const opened = performance.now();
      const btns = options.map((o, i) => {
        const b = h('button', 'opt', box, o);
        b.addEventListener('click', () => pick(i));
        return b;
      });
      const pick = (i: number) => {
        if (performance.now() - opened < 350) return;
        layer.remove();
        this.popModal(key);
        Sound.sfx(i === cancelIndex || i < 0 ? 'cancel' : 'select');
        resolve(i);
      };
      const key: KeyHandler = (e) => {
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') spatialNav(box, 'up');
        else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') spatialNav(box, 'down');
        else if (['e', 'E', 'Enter', ' ', 'z', 'Z'].includes(e.key)) {
          const idx = btns.indexOf(document.activeElement as HTMLButtonElement);
          pick(idx >= 0 ? idx : 0);
        } else if (e.key === 'Escape' || e.key === 'x' || e.key === 'X') pick(cancelIndex);
      };
      this.pushModal(key);
      setTimeout(() => btns[0]?.focus(), 0);
    });
  }

  /** Generic modal panel for puzzles. Returns a close function. */
  panel(build: (box: HTMLElement, close: () => void) => ((e: KeyboardEvent) => boolean | void) | void): Promise<void> {
    return new Promise((resolve) => {
      const layer = h('div', 'puzzle', this.root);
      const box = h('div', 'box', layer);
      let custom: ((e: KeyboardEvent) => boolean | void) | void;
      const close = () => {
        layer.remove();
        this.popModal(key);
        resolve();
      };
      const key: KeyHandler = (e) => {
        if (custom && custom(e) === true) return;
        const map: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
        if (map[e.key]) spatialNav(box, map[e.key]);
        else if (['e', 'E', 'Enter', ' ', 'z', 'Z'].includes(e.key)) {
          const a = document.activeElement as HTMLElement;
          if (a && box.contains(a) && a.tagName === 'BUTTON') a.click();
          else (box.querySelector('button') as HTMLElement | null)?.focus();
        } else if (e.key === 'Escape' || e.key === 'x' || e.key === 'X') {
          Sound.sfx('cancel');
          close();
        }
      };
      this.pushModal(key);
      custom = build(box, close);
    });
  }

  // ---------------- menu ----------------
  openMenu(ctx: MenuContext): Promise<void> {
    return new Promise((resolve) => {
      const layer = h('div', '', this.root);
      layer.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.6)';
      const menu = h('div', 'menu', layer);
      const tabs = h('div', 'tabs', menu);
      const body = h('div', 'body', menu);
      const foot = h('div', 'foot', menu);
      h('span', '', foot, `プレイ時間 ${ctx.playTime}`);
      const closeBtn = h('button', 'btn', foot, '閉じる [Esc]');
      closeBtn.addEventListener('click', () => { if (!fresh()) close(); });
      const names = ['持ち物', 'メモ', '目的', '設定'];
      let cur = 0;
      const openedAt = performance.now();
      // ignore the synthetic click that follows the touch that opened the menu
      const fresh = () => performance.now() - openedAt < 400;
      const tabBtns = names.map((n, i) => {
        const b = h('button', '', tabs, n);
        b.addEventListener('click', () => { if (fresh()) return; show(i); Sound.sfx('cursor'); });
        return b;
      });
      const listDetail = (entries: { label: string; icon?: string; detail: string }[], empty: string) => {
        const list = h('div', 'list', body);
        const detail = h('div', 'detail', body);
        if (!entries.length) { h('div', 'empty', list, empty); detail.remove(); return; }
        entries.forEach((en, i) => {
          const b = h('button', 'opt item', list);
          if (en.icon) { const img = h('img', '', b); img.src = en.icon; }
          h('span', '', b, en.label);
          const sel = () => { detail.textContent = en.detail; };
          b.addEventListener('focus', sel);
          b.addEventListener('click', () => { sel(); Sound.sfx('page'); });
          if (i === 0) sel();
        });
      };
      const show = (i: number) => {
        cur = i;
        tabBtns.forEach((b, k) => b.classList.toggle('on', k === i));
        body.innerHTML = '';
        if (i === 0) listDetail(ctx.items.map((it) => ({ label: it.name, icon: it.icon, detail: it.desc })), '何も持っていない。');
        if (i === 1) listDetail(ctx.notes.map((n) => ({ label: n.title, icon: undefined, detail: n.body })), 'まだ何も記録していない。');
        if (i === 2) {
          const d = h('div', 'detail', body);
          d.style.borderLeft = 'none';
          d.textContent = `${ctx.objective}\n\n${ctx.hint ? `― 手がかり ―\n${ctx.hint}` : ''}`;
        }
        if (i === 3) {
          const d = h('div', 'detail', body);
          d.style.borderLeft = 'none';
          const r1 = h('label', 'setting', d);
          h('span', '', r1, '音量');
          const vol = h('input', '', r1) as HTMLInputElement;
          vol.type = 'range'; vol.min = '0'; vol.max = '100'; vol.value = String(Math.round(ctx.volume * 100));
          const r2 = h('label', 'setting', d);
          const sh = h('input', '', r2) as HTMLInputElement;
          sh.type = 'checkbox'; sh.checked = ctx.shake;
          h('span', '', r2, '画面の揺れ');
          const apply = () => { ctx.volume = Number(vol.value) / 100; ctx.shake = sh.checked; ctx.onSettings({ volume: ctx.volume, shake: ctx.shake }); };
          vol.addEventListener('input', apply);
          sh.addEventListener('change', apply);
          const help = h('div', '', d);
          help.style.cssText = 'margin-top:18px;color:var(--dim);font-size:14px;line-height:1.9';
          help.textContent = '操作：移動 WASD/矢印　ダッシュ Shift　調べる E/Enter　メニュー Esc\nスマホ：左側をドラッグで移動、右下のボタンで調べる・走る\nセーブは館の各所にある日記帳で行えます。';
          const t = h('button', 'btn', d, 'タイトルへ戻る');
          t.style.marginTop = '16px';
          t.addEventListener('click', async () => {
            const r = await this.choose('タイトルへ戻りますか？\n（セーブしていない進行は失われます）', ['戻る', 'やめる'], 1);
            if (r === 0) { close(); ctx.onTitle(); }
          });
        }
        (body.querySelector('button') as HTMLElement | null)?.focus();
      };
      const close = () => {
        layer.remove();
        this.popModal(key);
        Sound.sfx('cancel');
        resolve();
      };
      const key: KeyHandler = (e) => {
        if (e.key === 'Escape' || e.key === 'x' || e.key === 'X' || e.key === 'Tab') { close(); return; }
        if (e.key === 'q' || e.key === 'Q' || e.key === '[') { show((cur + 3) % 4); Sound.sfx('cursor'); return; }
        if (e.key === ']' || e.key === 'r' || e.key === 'R') { show((cur + 1) % 4); Sound.sfx('cursor'); return; }
        const map: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
        if (map[e.key]) {
          const a = document.activeElement as HTMLElement;
          if (a?.tagName === 'INPUT' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
          spatialNav(menu, map[e.key]);
        } else if (['e', 'E', 'Enter', ' '].includes(e.key)) {
          const a = document.activeElement as HTMLElement;
          if (a && menu.contains(a)) a.click();
        }
      };
      this.pushModal(key);
      Sound.sfx('select');
      show(0);
    });
  }

  // ---------------- touch controls ----------------
  buildTouch() {
    if (!this.touchEnabled || this.touchEl) return;
    const t = h('div', 'touch', this.root);
    this.touchEl = t;
    const zone = h('div', 'zone', t);
    const stick = h('div', 'stick idle', t);
    const knob = h('div', 'knob', stick);
    const home = () => { stick.style.left = `calc(90px + var(--sal))`; stick.style.top = `calc(100% - 110px - var(--sab))`; };
    home();
    let pid = -1, sx = 0, sy = 0;
    zone.addEventListener('pointerdown', (e) => {
      if (pid !== -1) return;
      pid = e.pointerId; sx = e.clientX; sy = e.clientY;
      stick.style.left = `${sx}px`; stick.style.top = `${sy}px`;
      stick.classList.add('on'); stick.classList.remove('idle');
      zone.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pid) return;
      let dx = e.clientX - sx, dy = e.clientY - sy;
      const len = Math.hypot(dx, dy);
      const max = 48;
      if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const m = Math.min(1, len / max);
      if (len < 8) { this.touch.x = 0; this.touch.y = 0; }
      else { this.touch.x = (dx / Math.max(len, 1)) * m; this.touch.y = (dy / Math.max(len, 1)) * m; }
      // pushing the stick to the rim also runs
      this.touch.dash = this.touch.dash || false;
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      pid = -1; this.touch.x = 0; this.touch.y = 0;
      knob.style.transform = '';
      stick.classList.remove('on'); stick.classList.add('idle');
      home();
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    const btn = (cls: string, label: string, down: () => void, up?: () => void) => {
      const b = h('div', `tbtn ${cls}`, t, label);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('on'); down(); b.setPointerCapture(e.pointerId); });
      const u = () => { b.classList.remove('on'); up?.(); };
      b.addEventListener('pointerup', u);
      b.addEventListener('pointercancel', u);
      return b;
    };
    btn('act', '調べる', () => { this.touch.act = true; });
    btn('dash', '走る', () => { this.touch.dash = true; }, () => { this.touch.dash = false; });
    btn('menub', 'MENU', () => { this.touch.menu = true; });
    this.updateTouchVisibility();
  }

  private updateTouchVisibility() {
    if (!this.touchEl) return;
    this.touchEl.classList.toggle('hidden', this.modalCount > 0);
    if (this.modalCount > 0) { this.touch.x = 0; this.touch.y = 0; this.touch.dash = false; }
  }
  setTouchVisible(on: boolean) {
    if (this.touchEl) this.touchEl.style.display = on ? '' : 'none';
  }

  consumeTouchAct(): boolean { const a = this.touch.act; this.touch.act = false; return a; }
  consumeTouchMenu(): boolean { const a = this.touch.menu; this.touch.menu = false; return a; }

  /** Full-screen layer (title, game over, ending). */
  screen(cls: string, onKey?: KeyHandler): { el: HTMLElement; close: () => void } {
    const el = h('div', `screen ${cls}`, this.root);
    const key: KeyHandler = (e) => onKey?.(e);
    this.pushModal(key);
    let closed = false;
    return {
      el,
      close: () => {
        if (closed) return;
        closed = true;
        el.remove();
        this.popModal(key);
      },
    };
  }
}
