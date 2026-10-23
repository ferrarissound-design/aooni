/*
 * End-to-end playtest. Drives the built game in headless Chromium through the
 * whole story using real inputs (keyboard, DOM clicks) plus a few test hooks
 * (teleport for long walks, time scale, autopilot that feeds the real movement code).
 *
 * usage: npm run build && npx vite preview --port 4173 & node tests/playtest.mjs
 */
import fs from 'fs';
import { chromium } from 'playwright-core';

const URL = process.env.GAME_URL ?? 'http://localhost:4173/';
const OUT = new globalThis.URL('./out/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

function findChromium() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const base = '/opt/pw-browsers';
  if (fs.existsSync(base)) {
    const d = fs.readdirSync(base).find((x) => x.startsWith('chromium_headless_shell'));
    if (d) return `${base}/${d}/chrome-linux/headless_shell`;
  }
  return undefined;
}

const results = [];
function check(name, ok, info = '') {
  results.push({ name, ok: !!ok, info });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`);
}

const browser = await chromium.launch({
  executablePath: findChromium(),
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const sleep = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const G = (expr) => page.evaluate(`(() => { const g = window.__game; return ${expr}; })()`);
const shot = (name) => page.screenshot({ path: `${OUT}${name}.png` });

/** Presses Enter through dialogs/choices until the game is free (or `until` holds). */
async function advance(maxMs = 20000, until = null) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const st = await G('({ b: g.ui.blocking, c: g.cutsceneDepth, busy: g.busy, tr: g.transiting, puzzle: !!document.querySelector(".puzzle"), over: !!document.querySelector(".gameover"), end: !!document.querySelector(".ending") })');
    if (st.over || st.end || st.puzzle) return st;
    if (until && (await G(until))) return st;
    if (!st.b && !st.c && !st.busy && !st.tr) return st;
    if (st.b) await page.keyboard.press('Enter');
    await sleep(140);
  }
  return null;
}

async function tp(x, y, dir) {
  await ev(([x, y, d]) => window.__game.teleportPlayer(x, y, d), [x, y, dir]);
  await sleep(150);
}

async function interact(x, y, dir) {
  await tp(x, y, dir);
  await sleep(100);
  await page.keyboard.press('e');
  await sleep(350);
}

async function hold(key, ms) {
  await page.keyboard.down(key);
  await sleep(ms);
  await page.keyboard.up(key);
}

/** Holds a key until `cond` (a page expression) is true, so slow frames don't make the test flaky. */
async function holdUntil(key, cond, maxMs = 6000) {
  await page.keyboard.down(key);
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs && !(await G(cond))) await sleep(60);
  await page.keyboard.up(key);
}

async function autopilotTo(tx, ty, dash = false, timeout = 30000) {
  await ev(([tx, ty, dash]) => {
    const g = window.__game;
    const path = g.grid.findPath(g.player.tx, g.player.ty, tx, ty) || [];
    g.autopilot = { pts: path.slice(1).map(([x, y]) => ({ x: x * 16 + 8, y: y * 16 + 9 })), i: 0, dash };
  }, [tx, ty, dash]);
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const st = await G('({ ap: !!g.autopilot, over: !!document.querySelector(".gameover"), tx: g.player.tx, ty: g.player.ty, b: g.ui.blocking })');
    if (st.over) return 'caught';
    if (!st.ap) return 'arrived';
    await sleep(100);
  }
  await ev(() => { window.__game.autopilot = null; });
  return 'timeout';
}

const flag = (k) => G(`!!g.state.flags[${JSON.stringify(k)}]`);
const hasItem = (k) => G(`g.state.items.includes(${JSON.stringify(k)})`);
const room = () => G('(g.grid.roomAt(g.player.tx, g.player.ty) || {}).id');

try {
  // ------------------------------------------------------------ title
  await page.goto(URL);
  await sleep(1200);
  await ev(() => localStorage.clear());
  await page.reload();
  await sleep(1200);
  await shot('e2e_01_title');
  check('title screen shows', await page.$('.title-name'));
  await page.mouse.click(640, 360);
  await sleep(400);
  const btns = await page.$$eval('.title-menu button', (b) => b.map((x) => x.textContent));
  check('title menu has new game (no save yet)', btns.includes('はじめから') && !btns.includes('つづきから'), btns.join(','));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game && window.__game.cutsceneDepth > 0, null, { timeout: 15000 });
  await ev(() => { window.__game.timeScale = 1; });

  // ------------------------------------------------------------ intro
  await advance(60000, 'g.state.flags.intro_done && !g.ui.blocking && g.cutsceneDepth === 0');
  check('intro finished', await flag('intro_done'));
  check('autosave after intro', await ev(() => window.__save.exists()));
  await shot('e2e_02_after_intro');

  // ------------------------------------------------------------ movement & collision
  await tp(30, 37, 'right');
  const x0 = await G('g.player.x');
  await hold('ArrowRight', 600);
  const x1 = await G('g.player.x');
  check('walks with arrow keys', x1 - x0 > 15, `moved ${Math.round(x1 - x0)}px`);
  const st0 = await G('g.player.stamina');
  await page.keyboard.down('Shift');
  await hold('a', 700);
  await page.keyboard.up('Shift');
  const st1 = await G('g.player.stamina');
  check('dash drains stamina', st1 < st0 - 0.3, `${st0.toFixed(2)} -> ${st1.toFixed(2)}`);
  await tp(17, 36, 'left');
  await hold('ArrowLeft', 1200);
  const wallOk = await G('!g.grid.boxBlocked(g.player.x, g.player.y, g.player.hw, g.player.hh) && g.player.x >= 16*16 + 4');
  check('wall collision stops the player', wallOk, `x=${Math.round(await G('g.player.x'))}`);
  // walk through a door with the keyboard (hall -> south corridor)
  await tp(22, 33, 'up');
  await holdUntil('ArrowUp', '(g.grid.roomAt(g.player.tx, g.player.ty) || {}).id === "corS"');
  check('walks through a door into the corridor', (await room()) === 'corS', await room());
  // corner assist: slightly off-centre still enters the doorway
  await ev(() => { const g = window.__game; g.teleportPlayer(22, 33, 'up'); g.player.setPos(g.player.x + 5, g.player.y); });
  await holdUntil('ArrowUp', '(g.grid.roomAt(g.player.tx, g.player.ty) || {}).id === "corS"');
  check('corner assist slides into doorway', (await room()) === 'corS', await room());

  // ------------------------------------------------------------ items
  await interact(4, 3, 'up');
  await advance();
  check('nightstand gives dead flashlight', await hasItem('flashlight_dead'));
  await interact(44, 3, 'up');
  await advance();
  check('drawer gives battery -> working flashlight', (await hasItem('flashlight')) && !(await hasItem('battery')) && !(await hasItem('flashlight_dead')));
  await interact(11, 3, 'up');
  await sleep(300);
  check('wardrobe offers hide/search choice', await page.$('.choice'));
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await sleep(300);
  await advance();
  check('wardrobe search gives hanger', await hasItem('hanger'));

  // ------------------------------------------------------------ puzzle 1: bathtub
  await interact(38, 4, 'up');
  await advance();
  check('bathtub drained with hanger', await flag('bath_drained'));
  check('got library key', await hasItem('key_library'));

  // ------------------------------------------------------------ first encounter, chase and capture
  await tp(36, 12, 'down');
  await sleep(400);
  await advance(15000);
  check('first encounter triggered', await flag('first_encounter_done'));
  const ms0 = await G('g.monster.state');
  check('monster appears (stare/chase)', ['stare', 'chase'].includes(ms0), ms0);
  await ev(() => { window.__game.timeScale = 2; });
  await sleep(1500);
  check('monster switches to chase', (await G('g.monster.state')) === 'chase', await G('g.monster.state'));
  const d0 = await G('Math.hypot(g.monster.x - g.player.x, g.monster.y - g.player.y)');
  await sleep(1500);
  const d1 = await G('Math.hypot(g.monster.x - g.player.x, g.monster.y - g.player.y)');
  check('monster closes distance while chasing', d1 < d0 - 20, `${Math.round(d0)} -> ${Math.round(d1)}`);
  await shot('e2e_03_chase');
  await page.waitForSelector('.gameover', { timeout: 30000 }).catch(() => null);
  check('monster catches a standing player -> game over', await page.$('.gameover'));
  await sleep(2600);
  await shot('e2e_04_gameover');
  await page.click('.gameover button');
  await page.waitForFunction(() => window.__game && !document.querySelector('.gameover'), null, { timeout: 10000 });
  await sleep(1200);
  check('retry restores the last save', (await hasItem('key_library')) && !(await flag('first_encounter_done')));
  check('death counter persisted', (await ev(() => window.__save.read().state.deaths)) === 1);

  // ------------------------------------------------------------ hiding unseen, monster searches and gives up
  await tp(36, 12, 'down');
  await sleep(400);
  await advance(15000);
  check('encounter re-triggers after retry', await flag('first_encounter_done'));
  // slip away out of sight and hide in the bedroom wardrobe
  await interact(11, 3, 'up');
  await sleep(300);
  await page.keyboard.press('Enter'); // 隠れる
  await sleep(300);
  check('player hides in wardrobe', await G('g.player.hidden'));
  await ev(() => { window.__game.timeScale = 3; });
  let gone = false;
  const seenStates = new Set();
  for (let i = 0; i < 300; i++) {
    seenStates.add(await G('g.monster.state'));
    if (await page.$('.gameover')) break;
    if (!(await G('g.monster.present'))) { gone = true; break; }
    await sleep(150);
  }
  check('monster searches then gives up while player hides', gone && !(await page.$('.gameover')), [...seenStates].join('>'));
  await ev(() => { window.__game.timeScale = 1; });
  await page.keyboard.press('e'); // leave hiding spot
  await sleep(400);
  check('player leaves hiding spot', !(await G('g.player.hidden')));
  await sleep(500);
  await advance(15000);
  check('post-escape monologue shown', await flag('first_escape_msg'));
  await ev(() => { window.__game.director.cooldown = 99999; });

  // ------------------------------------------------------------ library door + puzzle 2: bookshelf
  await interact(7, 13, 'down');
  await advance();
  check('library unlocked with key', await G('!g.doorById("door_library").locked'));
  await tp(7, 17, 'up');
  check('inside library', (await room()) === 'library');
  await interact(10, 17, 'up');
  await advance();
  check('bookshelf puzzle opens', await page.$('.puzzle .shelf'));
  const books = await page.$$('.book');
  for (const i of [0, 1, 2, 3]) { await books[i].click(); await sleep(120); }
  await sleep(700);
  check('wrong order is rejected', !(await flag('books_solved')) && (await page.$$('.book.in')).length === 0);
  for (const i of [5, 4, 3, 0]) { await books[i].click(); await sleep(150); }
  await sleep(1800);
  await advance();
  check('bookshelf solved -> study key', (await flag('books_solved')) && (await hasItem('key_study')));

  // ------------------------------------------------------------ clues for puzzle 3
  for (const [x, y] of [[19, 2], [25, 2], [14, 2], [18, 16]]) { await interact(x, y, 'up'); await advance(); }
  check('all four portraits read', (await flag('seen_girl')) && (await flag('seen_boy')) && (await flag('seen_woman')) && (await flag('seen_man')));
  await interact(40, 19, 'down');
  await advance();
  check('dining diary note recorded', await G('g.state.notes.includes("diary_dining")'));

  // ------------------------------------------------------------ study + puzzle 3: safe (multi-room code)
  await interact(11, 29, 'down');
  await advance();
  check('study unlocked', await G('!g.doorById("door_study").locked'));
  await interact(13, 33, 'up');
  await advance();
  check('safe keypad opens', await page.$('.keypad'));
  for (const k of '0000') await page.keyboard.press(k);
  await page.keyboard.press('Enter');
  await sleep(900);
  check('wrong code rejected', !(await flag('safe_opened')));
  const code = await G('"" + g.state.portraitDigits.girl + g.state.portraitDigits.boy + g.state.portraitDigits.woman + g.state.portraitDigits.man');
  for (const k of code) await page.keyboard.press(k);
  await page.keyboard.press('Enter');
  await sleep(1300);
  await advance(15000);
  check('safe opened with the portrait code -> basement key', (await flag('safe_opened')) && (await hasItem('key_basement')), code);
  check('monster is drawn to the study after the safe', await G('g.monster.present'), await G('g.monster.state'));
  // hide in the study cabinet until it leaves
  await interact(14, 41, 'up');
  await sleep(300);
  await page.keyboard.press('Enter');
  await sleep(200);
  await ev(() => { window.__game.timeScale = 3; });
  for (let i = 0; i < 300; i++) {
    if (await page.$('.gameover')) break;
    if (!(await G('g.monster.present'))) break;
    await sleep(150);
  }
  // being found here is possible by design (20%); recover by retrying from the autosave
  if (await page.$('.gameover')) {
    check('note: monster found the hidden player (allowed, low chance)', true);
    await sleep(2600);
    await page.click('.gameover button');
    await sleep(2000);
    await ev(() => { const g = window.__game; g.monster.despawn(); });
  } else check('survived the post-safe visit', true);
  await ev(() => { const g = window.__game; g.timeScale = 1; g.director.cooldown = 99999; });
  if (await G('g.player.hidden')) { await page.keyboard.press('e'); await sleep(400); }
  await advance();
  check('out of hiding after the visit', !(await G('g.player.hidden')));

  // ------------------------------------------------------------ basement
  await interact(52, 29, 'down');
  await advance();
  check('stair door unlocked (requires flashlight)', await G('!g.doorById("door_stair").locked'), await G('JSON.stringify({items: g.state.items, hid: g.player.hidden, room: (g.grid.roomAt(g.player.tx,g.player.ty)||{}).id})'));
  await tp(56, 37, 'up');
  await hold('ArrowUp', 900);
  await sleep(800);
  await advance(10000);
  check('stairs lead to the basement', (await room()) === 'basement', await room());
  await shot('e2e_05_basement_dark');

  // ------------------------------------------------------------ puzzle 4: breaker (lights out)
  await interact(44, 48, 'up');
  await advance();
  check('breaker panel opens', await page.$('.breaker'));
  const lamps = await page.$$eval('.breaker .lamp', (l) => l.map((x) => x.classList.contains('on')));
  let sol = null;
  for (let m = 0; m < 32 && !sol; m++) {
    const s = [...lamps];
    for (let i = 0; i < 5; i++) if (m & (1 << i)) for (const k of [i - 1, i, i + 1]) if (k >= 0 && k < 5) s[k] = !s[k];
    if (s.every(Boolean)) sol = m;
  }
  const levers = await page.$$('.breaker button');
  for (let i = 0; i < 5; i++) if (sol & (1 << i)) { await levers[i].click(); await sleep(120); }
  await sleep(1600);
  await advance(15000);
  check('breaker solved -> power on, shutter open', (await flag('power_on')) && (await G('!g.doorById("door_shutter").locked')), `lamps ${lamps.map(Number).join('')}`);
  await shot('e2e_06_basement_lit');

  // ------------------------------------------------------------ Saki
  const r1 = await autopilotTo(53, 50);
  check('walks through the shutter into the cell', r1 === 'arrived' && (await room()) === 'cell', `${r1} ${await room()}`);
  await interact(53, 50, 'right');
  await advance(20000);
  check('found Saki, got portrait piece', (await flag('saki_found')) && (await hasItem('piece')));
  await autopilotTo(44, 51);
  await sleep(300);
  await advance(10000);
  check('ambush on leaving the cell', (await flag('ambush_done')) && (await G('g.monster.present')));
  await shot('e2e_07_ambush');
  // sneak (walking, quietly) to the east locker and hide before it spots us
  const rh = await autopilotTo(45, 57, false, 15000);
  await interact(45, 57, 'up');
  await sleep(300);
  await page.keyboard.press('Enter');
  await sleep(300);
  check('hid in the basement locker before being spotted', rh === 'arrived' && (await G('g.player.hidden')), `${rh} state=${await G('g.monster.state')}`);
  await ev(() => { window.__game.timeScale = 3; });
  let foundInLocker = false;
  for (let i = 0; i < 300; i++) {
    if (await page.$('.gameover')) { foundInLocker = true; break; }
    if (!(await G('g.monster.present'))) break;
    await sleep(150);
  }
  if (foundInLocker) {
    check('note: monster checked the locker (allowed, low chance)', true);
    await sleep(2600);
    await page.click('.gameover button');
    await sleep(2000);
    await advance(10000);
    await ev(() => { const g = window.__game; g.monster.despawn(); g.pendingEvents.delete('basement_ambush'); });
  } else check('ambush monster gave up', !(await G('g.monster.present')));
  await ev(() => { window.__game.timeScale = 1; window.__game.director.cooldown = 99999; });
  if (await G('g.player.hidden')) { await page.keyboard.press('e'); await sleep(400); }
  const r2 = await autopilotTo(19, 48, false, 30000);
  await sleep(900);
  await advance(5000);
  check('back up the stairs', r2 !== 'caught' && (await room()) === 'stair', `${r2} ${await room()}`);
  await ev(() => { const g = window.__game; g.monster.despawn(); g.director.cooldown = 99999; });

  // ------------------------------------------------------------ puzzle 5: portrait
  await interact(4, 32, 'up');
  await advance();
  check('portrait puzzle opens', await page.$('.slide'));
  for (let pos = 0; pos < 9; pos++) {
    const order = await page.$$eval('.slide button', (bs) => bs.map((b) => {
      const [px, py] = b.style.backgroundPosition.split(' ').map((v) => Math.round(parseFloat(v) / 50));
      return px + py * 3;
    }));
    if (order[pos] === pos) continue;
    const j = order.indexOf(pos);
    const cells = await page.$$('.slide button');
    await cells[pos].click(); await sleep(80);
    await cells[j].click(); await sleep(120);
  }
  await sleep(2000);
  await advance();
  check('portrait restored -> secret passage', await flag('portrait_solved'));
  await tp(4, 32, 'up');
  await hold('ArrowUp', 800);
  await sleep(900);
  await advance(8000);
  check('secret stairs lead to the hidden room', (await room()) === 'hidden', await room());
  check('autosave on entering the hidden room', (await ev(() => window.__save.read().state.saveLabel)) === '隠し部屋');

  // ------------------------------------------------------------ final chase
  await interact(7, 54, 'up');
  await advance(20000);
  check('took gate key, wall collapsed, final chase begins', (await flag('final_chase')) && (await flag('wall_broken')) && (await G('g.monster.relentless')));
  await shot('e2e_08_final_chase');
  const r3 = await autopilotTo(47, 58, true, 40000);
  check('outran the monster to the gate (fairness check)', r3 === 'arrived', `${r3}, monster dist ${Math.round(await G('Math.hypot(g.monster.x-g.player.x,g.monster.y-g.player.y)'))}px`);
  if (r3 === 'arrived') {
    await ev(() => window.__game.player.face('right'));
    await page.keyboard.press('e');
    await sleep(300);
    check('gate unlocked with the key', await G('!g.doorById("door_gate").locked'));
    await autopilotTo(53, 58, true, 10000);
    await advance(30000);
    await page.waitForSelector('.ending', { timeout: 15000 }).catch(() => null);
    await sleep(2500);
    await shot('e2e_09_ending');
    check('ending reached', (await page.$('.ending')) && (await flag('escaped')));
    check('clear recorded', (await ev(() => window.__save.meta().cleared)) >= 1);
  }

  // ------------------------------------------------------------ save robustness
  const corrupt = await ev(() => {
    const S = window.__save;
    const good = S.read();
    S.write(good.state); // ensure a backup exists
    localStorage.setItem('karasuba.save.v1', '{"v":1,"sum":"bad","data":"{}"}');
    const r = S.read();
    return { ok: !!r, restored: r?.restoredFromBackup };
  });
  check('corrupted save falls back to backup', corrupt.ok && corrupt.restored, JSON.stringify(corrupt));
  const repaired = await ev(() => {
    const S = window.__save;
    const st = S.read().state;
    st.flags.bath_drained = true;
    st.unlocked = [];
    st.items = [];
    S.write(st);
    const r = S.read();
    return r.state.items.includes('key_library') && r.fixes.includes('key_library');
  });
  check('lost key is restored on load', repaired);
} catch (e) {
  console.error(e);
  check('test run completed without exceptions', false, String(e));
  await shot('e2e_error');
}

check('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
