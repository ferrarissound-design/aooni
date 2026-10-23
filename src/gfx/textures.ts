import Phaser from 'phaser';
import { coneTexture, DIRS, doorTextures, humanSheet, lightTexture, MON_H, MON_W, monsterSheet, PLAYER_PAL, SAKI_PAL } from './characters';
import { OBJ_TEX } from './objects';
import { makeCanvas, outline, P } from './pixel';

function addSheet(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement, fw: number, fh: number) {
  const tex = scene.textures.addCanvas(key, canvas)!;
  DIRS.forEach((d, di) => {
    for (let f = 0; f < 3; f++) tex.add(`${d}_${f}`, 0, f * fw, di * fh, fw, fh);
  });
  DIRS.forEach((d) => {
    scene.anims.create({
      key: `${key}_walk_${d}`,
      frames: [1, 0, 2, 0].map((f) => ({ key, frame: `${d}_${f}` })),
      frameRate: 8,
      repeat: -1,
    });
  });
}

export function generateTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('player')) return;
  for (const [key, [w, h, draw, noOutline]] of Object.entries(OBJ_TEX)) {
    const [c, ctx] = makeCanvas(w, h);
    draw(new P(ctx));
    if (!noOutline) outline(ctx, 0, 0, w, h);
    scene.textures.addCanvas(key, c);
  }
  for (const [key, c] of Object.entries(doorTextures())) scene.textures.addCanvas(key, c);
  addSheet(scene, 'player', humanSheet(PLAYER_PAL), 16, 24);
  addSheet(scene, 'saki', humanSheet(SAKI_PAL), 16, 24);
  addSheet(scene, 'monster', monsterSheet(), MON_W, MON_H);
  scene.textures.addCanvas('light', lightTexture(256));
  scene.textures.addCanvas('cone', coneTexture(200, 70));
  scene.anims.create({
    key: 'fire',
    frames: [0, 1, 2, 1].map((i) => ({ key: `fireplace_${i}` })),
    frameRate: 7,
    repeat: -1,
  });
}

/** data URL for a texture drawn from OBJ_TEX (used by DOM UI icons). */
export function objDataURL(key: string, scale = 1): string {
  const def = OBJ_TEX[key];
  if (!def) return '';
  const [w, h, draw, noOutline] = def;
  const [c, ctx] = makeCanvas(w, h);
  draw(new P(ctx));
  if (!noOutline) outline(ctx, 0, 0, w, h);
  if (scale === 1) return c.toDataURL();
  const [c2, ctx2] = makeCanvas(w * scale, h * scale);
  ctx2.imageSmoothingEnabled = false;
  ctx2.drawImage(c, 0, 0, w * scale, h * scale);
  return c2.toDataURL();
}
