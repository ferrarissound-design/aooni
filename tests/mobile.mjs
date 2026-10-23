/* Touch-device playtest: iPhone-sized viewports, real touch events via CDP. */
import fs from 'fs';
import { chromium } from 'playwright-core';

const URL = process.env.GAME_URL ?? 'http://localhost:4173/';
const OUT = new globalThis.URL('./out/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const base = '/opt/pw-browsers';
const d = fs.existsSync(base) && fs.readdirSync(base).find((x) => x.startsWith('chromium_headless_shell'));
const exe = process.env.CHROMIUM ?? (d ? `${base}/${d}/chrome-linux/headless_shell` : undefined);

const results = [];
const check = (name, ok, info = '') => { results.push(!!ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`); };

const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const cdp = await ctx.newCDPSession(page);
const sleep = (ms) => page.waitForTimeout(ms);
const G = (expr) => page.evaluate(`(() => { const g = window.__game; return ${expr}; })()`);
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
async function tapAt(x, y) { await touch('touchStart', x, y); await sleep(60); await touch('touchEnd', x, y); await sleep(120); }

try {
  // regression: opening dist/index.html straight from disk must not leave a blank page
  if (fs.existsSync(new globalThis.URL('../dist/index.html', import.meta.url).pathname)) {
    const fp = await ctx.newPage();
    await fp.goto(new globalThis.URL('../dist/index.html', import.meta.url).href);
    await fp.waitForTimeout(1500);
    check('dist/index.html works from file:// (no blank page)', await fp.$('.title-name'));
    await fp.close();
  }
  await page.goto(URL);
  await sleep(1200);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await sleep(1200);
  await tapAt(422, 200);
  await sleep(400);
  const btn = await page.$('.title-menu button');
  const bb = await btn.boundingBox();
  await tapAt(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.waitForFunction(() => window.__game && window.__game.cutsceneDepth > 0, null, { timeout: 15000 });
  for (let i = 0; i < 300; i++) {
    if (await G('g.state.flags.intro_done && !g.ui.blocking && g.cutsceneDepth === 0')) break;
    await tapAt(422, 330);
    await sleep(120);
  }
  check('intro advanced by tapping', await G('g.state.flags.intro_done'));
  check('touch controls shown', await page.$eval('.touch', (e) => getComputedStyle(e).display !== 'none' && !e.classList.contains('hidden')));
  await page.screenshot({ path: `${OUT}m_landscape.png` });

  // joystick drag to the right
  const x0 = await G('g.player.x');
  await touch('touchStart', 120, 280);
  await sleep(50);
  for (let k = 1; k <= 6; k++) { await touch('touchMove', 120 + k * 10, 280); await sleep(30); }
  await sleep(700);
  await touch('touchEnd', 180, 280);
  const x1 = await G('g.player.x');
  check('virtual stick moves the player', x1 - x0 > 15, `${Math.round(x1 - x0)}px`);

  // interact button
  await page.evaluate(() => window.__game.teleportPlayer(4, 3, 'up'));
  await sleep(300);
  const act = await (await page.$('.touch .act')).boundingBox();
  await tapAt(act.x + act.width / 2, act.y + act.height / 2);
  await sleep(500);
  check('調べる button interacts', await page.$('.dialog'));
  for (let i = 0; i < 20 && (await G('g.ui.blocking')); i++) { await tapAt(422, 330); await sleep(150); }
  check('item obtained via touch', await G('g.state.items.includes("flashlight_dead")'));

  // menu button
  const mb = await (await page.$('.touch .menub')).boundingBox();
  await tapAt(mb.x + mb.width / 2, mb.y + mb.height / 2);
  await sleep(500);
  check('MENU button opens the menu', await page.$('.menu'));
  check('menu opens on the items tab (no ghost tap)', (await page.$eval('.menu .tabs button.on', (b) => b.textContent)) === '持ち物');
  await page.screenshot({ path: `${OUT}m_menu.png` });
  const close = await (await page.$('.menu .foot button')).boundingBox();
  await tapAt(close.x + close.width / 2, close.y + close.height / 2);
  await sleep(400);
  check('menu closes', !(await page.$('.menu')));

  // dash button while steering
  await page.evaluate(() => window.__game.teleportPlayer(30, 37, 'right'));
  await sleep(200);
  const st0 = await G('g.player.stamina');
  const dash = await (await page.$('.touch .dash')).boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 120, y: 280, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 175, y: 280, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 175, y: 280, id: 1 }, { x: dash.x + dash.width / 2, y: dash.y + dash.height / 2, id: 2 }] });
  await sleep(800);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const st1 = await G('g.player.stamina');
  check('走る button dashes (multi-touch)', st1 < st0 - 0.2, `${st0.toFixed(2)} -> ${st1.toFixed(2)}`);

  // puzzle UI fits on the phone screen
  await page.evaluate(() => { const g = window.__game; g.state.flags.books_solved = false; g.teleportPlayer(10, 17, 'up'); });
  await sleep(300);
  await tapAt(act.x + act.width / 2, act.y + act.height / 2);
  for (let i = 0; i < 10 && !(await page.$('.puzzle')); i++) { await tapAt(422, 330); await sleep(200); if (await page.$('.choice')) { const o = await (await page.$('.choice button')).boundingBox(); await tapAt(o.x + 10, o.y + 10); } }
  const box = await page.$('.puzzle .box');
  const bbx = box && (await box.boundingBox());
  check('puzzle panel fits the landscape phone screen', bbx && bbx.height <= 390 && bbx.width <= 844, bbx ? `${Math.round(bbx.width)}x${Math.round(bbx.height)}` : 'none');
  await page.screenshot({ path: `${OUT}m_puzzle.png` });
  await page.keyboard.press('Escape');
  await sleep(400);
  check('Esc closing a puzzle does not open the menu', !(await page.$('.menu')) && !(await page.$('.puzzle')));

  // portrait orientation
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(800);
  await page.screenshot({ path: `${OUT}m_portrait.png` });
  check('portrait layout renders the game', (await G('g.cameras.main.zoom')) >= 1);
} catch (e) {
  console.error(e);
  check('mobile run completed', false, String(e));
}
check('no errors', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n${results.filter(Boolean).length}/${results.length} checks passed`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
