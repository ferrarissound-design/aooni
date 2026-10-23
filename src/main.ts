import Phaser from 'phaser';
import { Sound } from './audio/audio';
import { Save } from './core/save';
import { GameScene } from './game/GameScene';
import { TitleScene } from './game/TitleScene';
import './style.css';

const DPR = Math.min(2, window.devicePixelRatio || 1);
const size = () => ({ w: Math.max(320, Math.floor(window.innerWidth * DPR)), h: Math.max(240, Math.floor(window.innerHeight * DPR)) });
const s0 = size();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: s0.w,
  height: s0.h,
  backgroundColor: '#000000',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: { mode: Phaser.Scale.NONE },
  input: { keyboard: true, mouse: false, touch: false },
  audio: { noAudio: true },
  render: { powerPreference: 'high-performance' },
  scene: [TitleScene, GameScene],
});

function fitCanvas() {
  const c = game.canvas;
  if (!c) return;
  c.style.width = `${window.innerWidth}px`;
  c.style.height = `${window.innerHeight}px`;
}

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    const s = size();
    game.scale.resize(s.w, s.h);
    fitCanvas();
  }, 80);
});
game.events.once('ready', fitCanvas);
fitCanvas();

document.addEventListener('visibilitychange', () => {
  const ctx = Sound.ctx;
  if (!ctx) return;
  if (document.hidden) void ctx.suspend();
  else void ctx.resume();
});
// iOS sometimes suspends the audio context; resume on any touch
window.addEventListener('pointerdown', () => { if (Sound.ctx && Sound.ctx.state !== 'running') void Sound.ctx.resume(); });

(window as any).__phaser = game;
(window as any).__save = Save;
