import { Sound } from '../audio/audio';
import { h, UI } from './ui';

/** 4-digit safe. Resolves true when the right code is entered. */
export function keypadPuzzle(ui: UI, code: string, hint: string): Promise<boolean> {
  let solved = false;
  return ui.panel((box, close) => {
    h('h3', '', box, '金庫');
    h('div', 'hint', box, hint);
    const disp = h('div', 'display', box, '____');
    const pad = h('div', 'keypad', box);
    let input = '';
    const render = () => { disp.textContent = (input + '____').slice(0, 4); disp.classList.remove('err'); };
    const press = (k: string) => {
      if (solved) return;
      if (k === 'C') { input = ''; Sound.sfx('cancel'); render(); return; }
      if (k === 'OK') {
        if (input.length < 4) { Sound.sfx('wrong'); return; }
        if (input === code) {
          solved = true;
          Sound.sfx('safe');
          disp.textContent = 'OPEN';
          setTimeout(close, 700);
        } else {
          Sound.sfx('wrong');
          disp.textContent = 'ERROR';
          disp.classList.add('err');
          input = '';
          setTimeout(render, 700);
        }
        return;
      }
      if (input.length >= 4) return;
      input += k;
      Sound.sfx('switch', { vol: 0.5 });
      render();
    };
    for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK']) {
      const b = h('button', 'btn', pad, k);
      b.addEventListener('click', () => press(k));
    }
    const row = h('div', 'row', box);
    h('button', 'btn', row, 'やめる').addEventListener('click', () => { Sound.sfx('cancel'); close(); });
    setTimeout(() => (pad.querySelector('button') as HTMLElement).focus(), 0);
    return (e) => {
      if (/^[0-9]$/.test(e.key)) { press(e.key); return true; }
      if (e.key === 'Backspace') { input = input.slice(0, -1); Sound.sfx('cancel'); render(); return true; }
      // typed a full code: Enter submits instead of pressing the focused button
      if (e.key === 'Enter' && input.length === 4) { press('OK'); return true; }
      return false;
    };
  }).then(() => solved);
}

export const BOOK_COLORS = [
  { name: '赤', css: '#a02020' },
  { name: '青', css: '#2040a0' },
  { name: '緑', css: '#208030' },
  { name: '黄', css: '#c0a020' },
  { name: '白', css: '#d8d8d0' },
  { name: '黒', css: '#1c1c1c' },
];

/** Push books in the right order. answer: indices into BOOK_COLORS. */
export function bookPuzzle(ui: UI, answer: number[], hint: string): Promise<boolean> {
  let solved = false;
  return ui.panel((box, close) => {
    h('h3', '', box, '色のそろわない本棚');
    const hintEl = h('div', 'hint', box, hint);
    const shelf = h('div', 'shelf', box);
    let pressed: number[] = [];
    let fails = 0;
    const btns = BOOK_COLORS.map((c, i) => {
      const b = h('button', 'book', shelf);
      b.style.background = c.css;
      b.setAttribute('aria-label', `${c.name}い本`);
      b.title = c.name;
      b.addEventListener('click', () => push(i));
      return b;
    });
    const reset = () => { pressed = []; btns.forEach((b) => b.classList.remove('in')); };
    const push = (i: number) => {
      if (solved || pressed.includes(i)) return;
      pressed.push(i);
      btns[i].classList.add('in');
      Sound.sfx('book');
      if (pressed.length === answer.length) {
        if (pressed.every((v, k) => v === answer[k])) {
          solved = true;
          setTimeout(() => { Sound.sfx('solve'); }, 300);
          hintEl.textContent = 'カチリ、と棚の奥で何かが外れる音がした。';
          setTimeout(close, 1300);
        } else {
          fails++;
          setTimeout(() => {
            Sound.sfx('wrong');
            reset();
            hintEl.textContent = fails >= 3
              ? 'ガタン…本が押し戻された。\n（どこかで、色の順番が語られていた気がする）'
              : 'ガタン…本が押し戻された。';
          }, 350);
        }
      }
    };
    const row = h('div', 'row', box);
    h('button', 'btn', row, 'やめる').addEventListener('click', () => { Sound.sfx('cancel'); close(); });
    setTimeout(() => btns[0].focus(), 0);
  }).then(() => solved);
}

/** 3x3 tap-to-swap portrait. */
export function portraitPuzzle(ui: UI, imageURL: string): Promise<boolean> {
  let solved = false;
  return ui.panel((box, close) => {
    h('h3', '', box, '継ぎはぎの肖像画');
    const hintEl = h('div', 'hint', box, '切り刻まれた画布が、でたらめに貼り直されている。\n2枚を選ぶと入れ替えられる。');
    const grid = h('div', 'slide', box);
    // shuffle (guaranteed not solved)
    let order = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    do {
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    } while (order.filter((v, i) => v === i).length > 2);
    let sel = -1;
    const cells: HTMLButtonElement[] = [];
    const render = () => {
      order.forEach((piece, pos) => {
        const b = cells[pos];
        const px = piece % 3, py = Math.floor(piece / 3);
        b.style.backgroundImage = `url(${imageURL})`;
        b.style.backgroundPosition = `${px * 50}% ${py * 50}%`;
        b.classList.toggle('sel', pos === sel);
      });
    };
    for (let i = 0; i < 9; i++) {
      const b = h('button', '', grid);
      b.setAttribute('aria-label', `断片 ${i + 1}`);
      b.addEventListener('click', () => tap(i));
      cells.push(b);
    }
    const tap = (i: number) => {
      if (solved) return;
      if (sel === -1) { sel = i; Sound.sfx('cursor'); render(); return; }
      if (sel === i) { sel = -1; render(); return; }
      [order[sel], order[i]] = [order[i], order[sel]];
      sel = -1;
      Sound.sfx('page');
      render();
      if (order.every((v, k) => v === k)) {
        solved = true;
        hintEl.textContent = '…肖像画の男が、こちらを見て笑った気がした。';
        setTimeout(() => Sound.sfx('solve'), 200);
        setTimeout(close, 1600);
      }
    };
    render();
    const row = h('div', 'row', box);
    h('button', 'btn', row, 'やめる').addEventListener('click', () => { Sound.sfx('cancel'); close(); });
    setTimeout(() => cells[0].focus(), 0);
  }).then(() => solved);
}

/** Lights-out style breaker panel with 5 switches. */
export function breakerPuzzle(ui: UI): Promise<boolean> {
  let solved = false;
  const N = 5;
  // generate from the solved state by random presses so it is always solvable
  let state = new Array(N).fill(true);
  const toggle = (s: boolean[], i: number) => { for (const k of [i - 1, i, i + 1]) if (k >= 0 && k < N) s[k] = !s[k]; };
  do {
    state = new Array(N).fill(true);
    for (let n = 0; n < 4; n++) toggle(state, Math.floor(Math.random() * N));
  } while (state.every(Boolean) || state.filter(Boolean).length > 3);
  return ui.panel((box, close) => {
    h('h3', '', box, '配電盤');
    const hintEl = h('div', 'hint', box, 'レバーを倒すと、隣のレバーも連動して動く。\nすべてのランプを点けろ。');
    const panel = h('div', 'breaker', box);
    const lamps: HTMLElement[] = [];
    const levers: HTMLButtonElement[] = [];
    for (let i = 0; i < N; i++) {
      const sw = h('div', 'sw', panel);
      lamps.push(h('div', 'lamp', sw));
      const b = h('button', '', sw);
      b.setAttribute('aria-label', `レバー ${i + 1}`);
      b.addEventListener('click', () => flip(i));
      levers.push(b);
    }
    const render = () => {
      state.forEach((on, i) => {
        lamps[i].classList.toggle('on', on);
        levers[i].classList.toggle('up', on);
        levers[i].classList.toggle('down', !on);
      });
    };
    const flip = (i: number) => {
      if (solved) return;
      toggle(state, i);
      Sound.sfx('switch');
      render();
      if (state.every(Boolean)) {
        solved = true;
        hintEl.textContent = 'ブウン…と低い唸りを上げて、電気が通った。';
        setTimeout(() => Sound.sfx('solve'), 200);
        setTimeout(close, 1300);
      }
    };
    render();
    const row = h('div', 'row', box);
    h('button', 'btn', row, 'やめる').addEventListener('click', () => { Sound.sfx('cancel'); close(); });
    setTimeout(() => levers[0].focus(), 0);
  }).then(() => solved);
}
