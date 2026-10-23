import Phaser from 'phaser';
import { Sound } from '../audio/audio';
import { Save } from '../core/save';
import { titleArt } from '../gfx/characters';
import { generateTextures } from '../gfx/textures';
import { getUI } from '../ui/instance';
import { h, spatialNav } from '../ui/ui';

let audioUnlocked = false;

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create() {
    generateTextures(this);
    const ui = getUI();
    ui.setHudVisible(false);
    ui.setTouchVisible(false);
    ui.red(0);
    void ui.fade(false, 0);
    this.cameras.main.setBackgroundColor('#000');
    Sound.setChase(false);
    Sound.setProximity(0);
    Sound.setAmbient('title');

    let menu!: HTMLElement;
    let started = audioUnlocked;
    const scr = ui.screen('title', (e) => {
      if (!started) { start(); return; }
      const map: Record<string, 'up' | 'down'> = { ArrowUp: 'up', ArrowDown: 'down', w: 'up', s: 'down', W: 'up', S: 'down' };
      if (map[e.key]) spatialNav(menu, map[e.key]);
      else if (['Enter', 'e', 'E', ' ', 'z', 'Z'].includes(e.key)) {
        const a = document.activeElement as HTMLElement;
        if (a && menu.contains(a)) a.click();
      }
    });
    const art = h('div', 'title-art', scr.el);
    art.style.backgroundImage = `url(${titleArt().toDataURL()})`;
    const inner = h('div', 'title-inner', scr.el);
    h('h1', 'title-name', inner, '鴉羽邸');
    h('div', 'title-sub', inner, '― 大首の館 ―');
    const tap = h('div', 'tap-start', inner, 'クリック / タップで はじめる');
    menu = h('div', 'title-menu hidden', inner);
    const meta = Save.meta();
    const foot = h('div', 'title-foot', scr.el,
      `ヘッドホン推奨　／　移動：WASD・矢印　走る：Shift　調べる：E・Enter　メニュー：Esc${meta.cleared ? `\n脱出回数 ${meta.cleared}回　最速 ${Math.floor(meta.bestTime / 60)}分${String(Math.floor(meta.bestTime % 60)).padStart(2, '0')}秒` : ''}`);
    foot.style.whiteSpace = 'pre-wrap';

    const go = (mode: 'new' | 'continue') => {
      Sound.sfx('select');
      void ui.fade(true, 700).then(() => {
        scr.close();
        this.scene.start('game', { mode });
      });
    };
    const buildMenu = () => {
      menu.innerHTML = '';
      const hasSave = Save.exists();
      if (hasSave) h('button', 'btn', menu, 'つづきから').addEventListener('click', () => go('continue'));
      h('button', 'btn', menu, 'はじめから').addEventListener('click', async () => {
        if (Save.exists()) {
          const r = await ui.choose('はじめから遊びますか？\n（今の記録は、最初のオートセーブで上書きされます）', ['はじめる', 'やめる'], 1);
          if (r !== 0) { (menu.querySelector('button') as HTMLElement)?.focus(); return; }
        }
        go('new');
      });
      h('button', 'btn', menu, 'あそびかた').addEventListener('click', async () => {
        await ui.say([
          { text: '深夜の洋館「鴉羽邸」に閉じ込められた。\n館を探索し、謎を解き、はぐれた友人と共に脱出しよう。', style: 'system' },
          { text: '館には「大首」と呼ばれる怪物がさまよっている。\n捕まれば、そこで終わりだ。', style: 'system' },
          { text: '足音や心臓の音が近づいたら警戒しよう。\n走れば振り切れるが、スタミナには限りがある。足音は怪物に聞こえてしまう。', style: 'system' },
          { text: 'クローゼットやロッカーに隠れられる。\nただし、隠れるところを見られていたら……。', style: 'system' },
          { text: '館の各所にある日記帳でセーブできる。重要な場面ではオートセーブされる。\nメニューでは持ち物・メモ・目的（手がかり）を確認できる。', style: 'system' },
        ]);
        (menu.querySelector('button') as HTMLElement)?.focus();
      });
      setTimeout(() => (menu.querySelector('button') as HTMLElement)?.focus(), 50);
    };
    const start = () => {
      if (started && !menu.classList.contains('hidden')) return;
      started = true;
      audioUnlocked = true;
      Sound.init();
      Sound.setAmbient('title');
      tap.classList.add('hidden');
      menu.classList.remove('hidden');
      buildMenu();
    };
    scr.el.addEventListener('pointerdown', () => { if (!audioUnlocked || menu.classList.contains('hidden')) start(); });
    if (started) start();
  }
}
