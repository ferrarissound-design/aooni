import { Sfx } from '../audio/audio';
import { Dir, TILE } from '../core/constants';
import { addNote, GameState, hasItem, ItemId, ITEMS, NoteId, safeCode } from '../core/state';
import { Line, UI } from '../ui/ui';
import { bookPuzzle, breakerPuzzle, keypadPuzzle, portraitPuzzle } from '../ui/puzzles';
import { DoorState, Grid } from '../world/grid';
import { DoorDef, ObjDef } from '../world/mapdata';
import { Actor, PathWalker } from './actors';
import { HideSpot, Monster, MState } from './monster';
import { NOTES, PLAYER_NAME } from './texts';

/** What the story layer needs from the game scene. */
export interface G {
  ui: UI;
  state: GameState;
  grid: Grid;
  monster: Monster;
  saki: Actor;
  sakiWalker: PathWalker;
  player: Actor & { hidden: boolean };
  portraitURL: string;
  wait(ms: number): Promise<void>;
  sfx(name: Sfx, o?: { vol?: number; pan?: number }): void;
  shake(ms: number, intensity: number): void;
  flicker(seconds: number): void;
  lightning(): void;
  setObjTex(id: string, tex: string): void;
  unlockDoor(id: string): void;
  doorById(id: string): DoorState;
  setDoorOpen(d: DoorState, open: boolean, sound?: boolean): void;
  autosave(label: string): void;
  saveGame(label: string): boolean;
  spawnMonster(tx: number, ty: number, state: MState, opts?: { life?: number; stare?: number; then?: MState; relentless?: boolean; quick?: boolean }): void;
  hideIn(spot: HideSpot): void;
  hideSpotFor(objId: string): HideSpot | undefined;
  isChasing(): boolean;
  refreshObjective(show?: boolean): void;
  startEnding(): void;
  teleportPlayer(tx: number, ty: number, dir: Dir): void;
  cutsceneDepth: number;
  pendingEvents: Set<string>;
  monsterVisibleToPlayer(): boolean;
  monsterStepSound(vol: number, pan: number): void;
}

const P = PLAYER_NAME;
const say = (g: G, ...lines: Line[]) => g.ui.say(lines);
const me = (text: string): Line => ({ name: P, text });
const saki = (text: string): Line => ({ name: 'サキ', text });
const sys = (text: string): Line => ({ text, style: 'system' });

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

/** Runs a cutscene; input is locked and is always restored, even on errors. */
export async function cutscene(g: G, fn: () => Promise<void>) {
  g.cutsceneDepth++;
  try {
    await fn();
  } catch (e) {
    console.error('cutscene error', e);
  } finally {
    g.cutsceneDepth = Math.max(0, g.cutsceneDepth - 1);
  }
}

export async function give(g: G, id: ItemId, text?: string) {
  const s = g.state;
  if (!s.items.includes(id)) s.items.push(id);
  g.sfx('pickup');
  await say(g, sys(text ?? `${ITEMS[id].name}を手に入れた。`));
  // flashlight + battery combine automatically
  if (hasItem(s, 'flashlight_dead') && hasItem(s, 'battery')) {
    s.items = s.items.filter((i) => i !== 'flashlight_dead' && i !== 'battery');
    s.items.push('flashlight');
    s.flags.flashlight_on = true;
    g.sfx('switch');
    await say(g, sys('懐中電灯に電池を入れた。\n……点いた！ 前方を照らせるようになった。'));
  }
  g.refreshObjective(false);
}

function take(g: G, id: ItemId) {
  g.state.items = g.state.items.filter((i) => i !== id);
}

async function note(g: G, id: NoteId, intro?: string) {
  if (intro) await say(g, intro);
  g.sfx('page');
  const first = addNote(g.state, id);
  await say(g, { text: NOTES[id].body(g.state) });
  if (first) g.ui.toast(`メモ「${NOTES[id].title}」を記録した`);
}

async function portrait(g: G, flag: string, who: string, digit: number, desc: string) {
  g.state.flags[flag] = true;
  await say(g, `${desc}\n額の隅に、小さく「${digit}」と刻まれている。`);
  if (addNote(g.state, 'digits')) g.ui.toast('メモ「肖像画の数字」を記録した');
  else g.ui.toast(`${who}の数字をメモに書き足した`);
}

// ---------------------------------------------------------------- interact
export async function interactObject(g: G, o: ObjDef) {
  const f = g.state.flags;
  const s = g.state;
  if (o.hide) { await hideSpot(g, o); return; }
  switch (o.interact) {
    case 'save': return savePoint(g);
    case 'bed': return void say(g, 'シーツが湿っている。真ん中に、誰かが寝ていたような窪みが残っている……');
    case 'nightstand':
      if (!f.got_flashlight) {
        f.got_flashlight = true;
        g.setObjTex('nightstand', 'nightstand_empty');
        await say(g, 'ナイトテーブルの上に、懐中電灯が置いてある。');
        g.sfx('switch');
        await say(g, '……スイッチを入れても点かない。電池が切れているようだ。');
        await give(g, 'flashlight_dead');
      } else await say(g, '引き出しには、古い薬の瓶が入っているだけだ。');
      return;
    case 'dresser': return void say(g, '鏡台。古い化粧道具が並んでいる。\n……鏡に映った自分の顔色は、ひどく悪い。');
    case 'window': {
      if (Math.random() < 0.25 && f.first_encounter_done) {
        g.lightning();
        await g.wait(300);
        return void say(g, '……稲光の中、窓に映った自分の背後に、何かが立っていた気がした。');
      }
      return void say(g, pick([
        '窓の外は真っ暗だ。雨が激しく窓を叩いている。',
        '窓は開かない。外から板が打ち付けられているようだ。',
        '曇ったガラスに、内側から付いた小さな手形がいくつも残っている。',
      ]));
    }
    case 'portrait_woman': return portrait(g, 'seen_woman', '婦人', s.portraitDigits.woman, '婦人の肖像画。冷たい目で、こちらを見下ろしている。');
    case 'portrait_girl': return portrait(g, 'seen_girl', '少女', s.portraitDigits.girl, '少女の肖像画。白いワンピースを着て、はにかんでいる。');
    case 'portrait_boy': return portrait(g, 'seen_boy', '少年', s.portraitDigits.boy, 'セーラー服の少年の肖像画。少しすました顔をしている。');
    case 'portrait_man': return portrait(g, 'seen_man', '紳士', s.portraitDigits.man, '口ひげの紳士の肖像画。……目だけが、やけに大きく描かれている。');
    case 'child_bed': return void say(g, '小さなベッド。枕元のテディベアは、片目が取れている。');
    case 'toybox':
      if (!f.toybox_seen) { f.toybox_seen = true; g.sfx('giggle', { vol: 0.8 }); }
      return void say(g, 'おもちゃ箱。首の取れた人形が入っている。\n……人形の首は、どこにも見当たらない。');
    case 'picturebook':
      f.seen_picturebook = true;
      return note(g, 'picturebook', '机の上に、絵本が開いたまま置かれている。');
    case 'rocking_horse':
      g.sfx('creak', { vol: 0.5 });
      return void say(g, '木馬。……触れてもいないのに、ゆっくりと揺れている。');
    case 'bathtub': return bathtub(g);
    case 'sink': return void say(g, '洗面台。蛇口をひねると、赤茶けた水が少しだけ出て、止まった。');
    case 'mirror':
      if (f.first_encounter_done && !f.mirror_msg) {
        f.mirror_msg = true;
        g.setObjTex('mirror', 'mirror_msg');
        g.sfx('whisper');
        g.shake(200, 0.004);
        return void say(g, '……！\n鏡に、さっきまで無かった赤い文字が浮かんでいる。\n『にげて』');
      }
      return void say(g, f.mirror_msg ? '鏡の赤い文字は、内側から書かれているように見える……' : 'ひびの入った鏡。自分の顔が少し歪んで映る。');
    case 'toilet': return void say(g, '古い便器。……覗き込むのはやめておこう。');
    case 'drawer':
      if (!f.got_battery) { f.got_battery = true; await say(g, '引き出しを開けると、電池が一本転がっていた。'); await give(g, 'battery'); }
      else await say(g, '引き出しは空っぽだ。');
      return;
    case 'counter': return void say(g, pick(['調理台。乾いた黒い染みが広がっている。', '包丁立てには、一本も包丁が残っていない。', 'まな板の上に、何かの骨が置かれている……']));
    case 'stove': return void say(g, '古いコンロ。鍋の底に、何かが黒く焦げ付いている。');
    case 'ksink': return void say(g, '流しに汚れた皿が積み上がっている。四人分……いや、五人分ある。');
    case 'fridge': return void say(g, '冷蔵庫を開けると、ひどい匂いが漂ってきた。\n……すぐに閉めた。');
    case 'ktable': return void say(g, 'テーブルの上に、食べかけの食事が残されている。どれもカビだらけだ。');
    case 'painting_land': return void say(g, '暗い森の絵。木々の間に、白い何かがぽつんと立っている。');
    case 'painting_creepy': return void say(g, pick(['人物画。……さっきまで、こちらを向いていなかった気がする。', '人物画の目が、赤く塗りつぶされている。']));
    case 'bookshelf': return void say(g, pick(['難しそうな洋書がぎっしり並んでいる。', '背表紙の題名は、どれもかすれて読めない。', '『家ヲ護ル法』……? 気味の悪い題名の本だ。', '一冊だけ抜き取られた跡がある。']));
    case 'color_shelf': return colorShelf(g);
    case 'clipping': return note(g, 'clipping', '机の上に、黄ばんだ新聞の切り抜きがある。');
    case 'library_memo': return note(g, 'library_memo', '書見台に、書き付けが挟まっている。');
    case 'clock':
      g.sfx('chime', { vol: 0.4 });
      return void say(g, '大きな柱時計。振り子は止まったまま、針は午前二時を指している。\n……なのに今、鐘が鳴った。');
    case 'fireplace': return void say(g, '暖炉で火が燃えている。\n……誰が、いつ火を点けたのだろう。');
    case 'sofa': return void say(g, 'ソファの座面が、誰かの重みで深く沈んでいる。');
    case 'coffee': return void say(g, 'ローテーブル。冷めきった紅茶のカップが置いてある。');
    case 'dining_table': return note(g, 'diary_dining', '長い食卓。テーブルの端に、ちぎれた日記のページが置かれている。');
    case 'china': return void say(g, '食器棚。割れた皿が何枚も、丁寧に重ねて仕舞われている。');
    case 'portrait_torn': return tornPortrait(g);
    case 'safe': return safe(g);
    case 'master_diary': return note(g, 'master_diary', '机の上に、革表紙の日記が開いている。');
    case 'globe': return void say(g, '地球儀。この町のあたりに、赤い丸印がつけられている。');
    case 'safe_memo': return note(g, 'safe_memo', '壁にメモが留められている。');
    case 'front_door':
      g.sfx('locked');
      return void say(g, f.intro_done ? '玄関の扉。外から何かで塞がれているのか、びくともしない。' : '……開かない。');
    case 'broken_stairs': return void say(g, '二階への階段は崩れ落ちている。とても上れそうにない。');
    case 'armor': return void say(g, '西洋の甲冑。……兜の隙間から、視線を感じる。');
    case 'stair_sign': return void say(g, '壁に貼り紙がある。\n『地下ニハ 決シテ 降リルナ』');
    case 'chair_broken': return void say(g, '壊れた椅子。脚が一本、噛みちぎられたように折れている。');
    case 'altar': return altar(g);
    case 'final_note': return note(g, 'final_note', '書見台に、震える字で書かれた書き置きがある。');
    case 'scratched': return void say(g, '肖像画。顔の部分だけが、爪で何度も何度も引っかかれている。');
    case 'cracked':
      if (!f.wall_broken) return void say(g, '壁に大きなひびが入っている。\n向こう側から、冷たい風が吹き込んでくる。');
      return;
    case 'breaker': return breaker(g);
    case 'chains': return void say(g, '壁から鎖が垂れ下がっている。先の枷は、子供の手首ほどの大きさだ……');
    case 'cell_bed': return void say(g, '粗末な寝床。……誰かが、ここに閉じ込められていた。');
    case 'bucket': return void say(g, 'バケツ。中を覗くのはやめておこう。');
    case 'grate': return void say(g, f.saki_found ? '床の排水溝。格子が外れかけている。サキなら通れるかもしれない。' : '床の排水溝。格子が外れかけている。下から水の流れる音がする。');
    case 'ladder': return void say(g, '梯子の上から、かすかに風が吹き込んでくる。');
  }
}

async function hideSpot(g: G, o: ObjDef) {
  const f = g.state.flags;
  if (f.final_chase) { await say(g, me('隠れてる場合じゃない……！ 走れ！')); return; }
  const spot = g.hideSpotFor(o.id);
  const label: Record<string, string> = {
    wardrobe: '大きなクローゼットだ。', child_closet: '子供用の衣装棚だ。', pantry: '食料庫の戸棚だ。',
    lib_cabinet: '大きな戸棚だ。', coat_closet: 'コート掛けの物入れだ。', locker: '錆びたロッカーだ。', study_cabinet: '書類棚だ。',
  };
  const r = await g.ui.choose(`${label[o.interact ?? ''] ?? ''}中に入れそうだ。`, ['隠れる', '調べる', 'やめる'], 2);
  if (r === 0 && spot) { g.hideIn(spot); return; }
  if (r !== 1) return;
  switch (o.interact) {
    case 'wardrobe':
      if (!f.got_hanger) { f.got_hanger = true; await say(g, '古い服の間に、針金ハンガーが一本掛かっている。'); await give(g, 'hanger'); }
      else await say(g, '古い服が詰まっている。防虫剤の匂いに混じって、何かが腐ったような匂いがする。');
      return;
    case 'child_closet': return void say(g, '小さな服が並んでいる。\n奥の板に、子供の字で『おおきな かおが みてる』と彫られている。');
    case 'pantry': return void say(g, '缶詰が並んでいるが、どれも膨らんでいる。');
    case 'lib_cabinet': return void say(g, '古い地図や書類が詰め込まれている。');
    case 'coat_closet': return void say(g, 'コートが何着も掛かっている。ポケットは空っぽだ。');
    case 'locker': return void say(g, '中は空っぽだ。人ひとりなら入れそうだ。');
    case 'study_cabinet': return void say(g, '古い帳簿が詰まっている。奥に、人が入れる隙間がある。');
  }
}

async function savePoint(g: G) {
  if (g.isChasing() || g.state.flags.final_chase) { await say(g, me('今はそれどころじゃない……！')); return; }
  const r = await g.ui.choose('古い日記帳が置かれている。\nここまでの記録を書き残しますか？', ['セーブする', 'やめる'], 1);
  if (r !== 0) return;
  const label = g.grid.roomAt(g.player.tx, g.player.ty)?.name ?? '館';
  if (g.saveGame(label)) { g.sfx('save'); await say(g, sys('記録を書き残した。')); }
  else await say(g, sys('記録できなかった……（ブラウザの保存領域が使えない可能性があります）'));
}

async function bathtub(g: G) {
  const f = g.state.flags;
  if (f.bath_drained) return void say(g, '空になった浴槽。底に長い黒髪がこびりついている。');
  f.bath_seen = true;
  await say(g, '浴槽に、黒く濁った水が張られている。\n底のほうで、何かが鈍く光った。');
  if (!hasItem(g.state, 'hanger')) {
    await say(g, me('手を入れるのは……ちょっと無理だ。'), sys('栓の鎖が切れていて、手では届かない。\n何か長いものがあれば、引っかけられそうだ。'));
    g.refreshObjective(false);
    return;
  }
  const r = await g.ui.choose('針金ハンガーを伸ばして、栓の鎖を引っかけますか？', ['引っかける', 'やめる'], 1);
  if (r !== 0) return;
  await cutscene(g, async () => {
    take(g, 'hanger');
    g.sfx('gurgle');
    await say(g, '針金の先を曲げて、底の鎖に引っかけた。\n……ゴボゴボと音を立てて、水が抜けていく。');
    g.setObjTex('bathtub', 'bathtub_empty');
    f.bath_drained = true;
    await g.wait(500);
    await give(g, 'key_library', '排水口に、鍵が引っかかっていた。\n『図書室の鍵』を手に入れた。');
    g.autosave('浴室');
  });
}

async function colorShelf(g: G) {
  const f = g.state.flags;
  if (f.books_solved) return void say(g, '隠し棚は空っぽだ。');
  await say(g, '背表紙の色がそろわない本棚。\n赤、青、緑、黄、白、黒……六冊だけ、色鮮やかな本が並んでいる。');
  const r = await g.ui.choose('本を押してみますか？', ['押してみる', 'やめる'], 1);
  if (r !== 0) return;
  const ok = await bookPuzzle(g.ui, [5, 4, 3, 0], '本は奥に押し込めるようだ。\n正しい順番で押せば、何かが起きるかもしれない。');
  if (!ok) return;
  await cutscene(g, async () => {
    f.books_solved = true;
    g.setObjTex('lib_color', 'bookshelf_color_open');
    await say(g, '棚の下段が手前に開き、隠し棚が現れた。');
    await give(g, 'key_study', '隠し棚に、真鍮の鍵が入っていた。\n『書斎の鍵』を手に入れた。');
    g.autosave('図書室');
  });
}

async function safe(g: G) {
  const f = g.state.flags;
  if (f.safe_opened) return void say(g, '金庫は空っぽだ。');
  await say(g, '頑丈な金庫だ。4桁の番号で開くらしい。');
  const ok = await keypadPuzzle(g.ui, safeCode(g.state), f.seen_safe_memo || g.state.notes.includes('safe_memo') ? '番号は家族の肖像画に。並べる順番は……' : 'ダイヤル式ではなく、数字のボタンが並んでいる。');
  if (!ok) return;
  await cutscene(g, async () => {
    f.safe_opened = true;
    await give(g, 'key_basement', '金庫の中に、重い鍵が入っていた。\n『地下室の鍵』を手に入れた。');
    g.autosave('書斎');
    await g.wait(900);
    g.sfx('door_slam', { vol: 0.5, pan: 0.6 });
    g.shake(300, 0.004);
    await say(g, me('……！ 今、どこかで扉の閉まる音が……'));
    if (!g.monster.present) {
      const p = g.player;
      const east = p.x < 30 * TILE;
      g.spawnMonster(east ? 58 : 2, 29, 'wander', { life: 50 });
      g.monster.hear(11 * TILE + 8, 29 * TILE + 8, 99999);
    }
  });
}

async function tornPortrait(g: G) {
  const f = g.state.flags;
  if (f.portrait_solved) return void say(g, '肖像画の裏に、下へ続く階段が口を開けている。');
  if (!hasItem(g.state, 'piece')) {
    return void say(g, '切り刻まれた肖像画が、でたらめに貼り直されている。\n……真ん中の一片が、どこにもない。');
  }
  await say(g, '継ぎはぎの肖像画。サキから受け取った切れ端が、欠けた部分にぴたりと合いそうだ。');
  const r = await g.ui.choose('肖像画を元に戻しますか？', ['戻してみる', 'やめる'], 1);
  if (r !== 0) return;
  const ok = await portraitPuzzle(g.ui, g.portraitURL);
  if (!ok) return;
  await cutscene(g, async () => {
    take(g, 'piece');
    f.portrait_solved = true;
    g.sfx('creak');
    g.shake(500, 0.004);
    g.setObjTex('portrait_torn', 'portrait_open');
    await say(g, 'ギィ……と、肖像画が扉のように開いた。\n奥に、下へと続く階段が隠されている。');
    g.autosave('書斎');
  });
}

async function breaker(g: G) {
  const f = g.state.flags;
  if (f.power_on) return void say(g, '配電盤のランプが、すべて点いている。');
  if (!g.state.notes.includes('breaker_memo')) await note(g, 'breaker_memo', '古い配電盤だ。扉の内側に注意書きが貼られている。');
  const r = await g.ui.choose('レバーを操作しますか？', ['操作する', 'やめる'], 1);
  if (r !== 0) return;
  const ok = await breakerPuzzle(g.ui);
  if (!ok) return;
  await cutscene(g, async () => {
    g.flicker(1.2);
    g.sfx('buzz');
    await g.wait(1200);
    f.power_on = true;
    g.setObjTex('breaker', 'breaker_on');
    g.sfx('shutter', { pan: 0.5 });
    g.unlockDoor('door_shutter');
    g.setDoorOpen(g.doorById('door_shutter'), true, false);
    await g.wait(1500);
    await say(g, sys('地下室に明かりが灯った。\n……東の方で、シャッターの開く音がした。'));
    g.saki.setTile(54, 50);
    g.saki.face('down');
    g.saki.setVisible(true);
    await g.wait(400);
    await say(g, { name: '？？？', text: '……だれか……いるの……？' });
    await say(g, me('今の声……サキ!?'));
    g.autosave('地下室');
    g.refreshObjective(true);
  });
}

export async function talkSaki(g: G) {
  const f = g.state.flags;
  if (f.saki_found) {
    await say(g, saki(pick(['気をつけて……あいつ、走る足音に気づくみたい。', '出口を見つけたら、迎えに来て。絶対だよ。', '肖像画……書斎の、だよね。あいつ、あの絵を怖がってたのかも。'])));
    return;
  }
  await cutscene(g, async () => {
    g.saki.faceToward(g.player.x, g.player.y);
    await say(g,
      saki('……アキラ？ アキラなの……!?'),
      me('サキ！ 無事だったのか！'),
      saki('あいつに……あの、顔の大きな化け物に捕まって……ここに放り込まれたの。'),
      saki('逃げようとして、足をくじいちゃった。うまく走れない……'),
      saki('それより、これ。ここに落ちてたの。絵の切れ端……みたい。'),
    );
    await give(g, 'piece', '『肖像画の切れ端』を受け取った。');
    await say(g,
      saki('あいつ、ここに来るたびに何かを探してた。\n「かおを かえせ」……って。'),
      me('……書斎の肖像画だ。切り刻まれて、真ん中だけ欠けてた。'),
      saki('私はここで隠れてる。暗いところなら、たぶん見つからない。'),
      saki('出口を見つけたら……必ず、迎えに来て。'),
      me('ああ。必ず戻る。'),
    );
    f.saki_found = true;
    f.got_piece = true;
    g.pendingEvents.add('basement_ambush');
    g.autosave('地下倉庫');
    g.refreshObjective(true);
  });
}

async function altar(g: G) {
  const f = g.state.flags;
  if (f.got_gate_key) return void say(g, '祭壇には、もう何もない。');
  await say(g, '祭壇の上に、錆びた大きな鍵が置かれている。');
  const r = await g.ui.choose('鍵を取りますか？', ['取る', 'やめる'], 1);
  if (r !== 0) return;
  await cutscene(g, async () => {
    f.got_gate_key = true;
    g.state.items.push('key_gate');
    g.setObjTex('altar', 'altar_empty');
    g.sfx('pickup');
    await say(g, sys('『鉄格子の鍵』を手に入れた。'));
    await g.wait(400);
    g.sfx('crumble');
    g.shake(1800, 0.012);
    g.flicker(2);
    await g.wait(900);
    f.wall_broken = true;
    g.setObjTex('cracked', 'rubble');
    await g.wait(900);
    await say(g, sys('ゴゴゴゴゴ……！\n東の壁が崩れ落ち、地下室へ続く穴が開いた！'));
    g.sfx('door_slam', { vol: 0.7, pan: -0.3 });
    await g.wait(500);
    g.spawnMonster(7, 49, 'stare', { stare: 1.7, then: 'chase', relentless: true });
    g.sfx('sting');
    g.shake(400, 0.008);
    f.final_chase = true;
    await say(g, me('――ッ！！'));
    g.refreshObjective(true);
  });
}

// ---------------------------------------------------------------- doors
const DOOR_LABEL: Record<string, string> = {
  door_library: '扉の札に『図書室』とある。鍵がかかっている。',
  door_study: '扉の札に『書斎』とある。鍵がかかっている。',
  door_stair: '頑丈な扉だ。札に『地下』とある。鍵がかかっている。',
};

export async function interactDoor(g: G, d: DoorState) {
  const def: DoorDef = d.def;
  const s = g.state;
  if (!d.locked) {
    g.setDoorOpen(d, !d.open, true);
    return;
  }
  if (def.lock === 'power') {
    g.sfx('locked');
    return void say(g, '電動のシャッターだ。電気が来ていないのか、びくともしない。');
  }
  if (def.lock === 'key_gate') {
    if (hasItem(s, 'key_gate')) {
      take(g, 'key_gate');
      g.unlockDoor('door_gate');
      g.sfx('unlock');
      g.setDoorOpen(d, true, false);
      g.sfx('gate');
      g.ui.toast('鉄格子の鍵を開けた！');
      return;
    }
    g.sfx('locked');
    return void say(g, '頑丈な鉄格子だ。大きな南京錠がかかっている。\n向こうに、水路が続いている……');
  }
  const key = def.lock as ItemId | undefined;
  if (key && hasItem(s, key)) {
    if (def.id === 'door_stair' && !hasItem(s, 'flashlight')) {
      await say(g, '鍵は合いそうだ。……でも、この先は真っ暗だろう。', me('明かりになる物を探してからにしよう。'));
      g.refreshObjective(false);
      return;
    }
    const r = await g.ui.choose(`『${ITEMS[key].name}』を使いますか？`, ['使う', 'やめる'], 1);
    if (r !== 0) return;
    take(g, key);
    g.unlockDoor(def.id);
    g.sfx('unlock');
    await say(g, sys(`${ITEMS[key].name}で扉を開けた。`));
    if (def.id === 'door_library') g.state.flags.library_unlocked = true;
    g.setDoorOpen(d, true, true);
    g.autosave(g.grid.roomAt(g.player.tx, g.player.ty)?.name ?? '館');
    g.refreshObjective(false);
    return;
  }
  g.sfx('locked');
  await say(g, DOOR_LABEL[def.id] ?? '鍵がかかっている。');
}

// ---------------------------------------------------------------- events
export async function introScene(g: G) {
  await cutscene(g, async () => {
    const p = g.player;
    p.setTile(29, 37);
    p.face('up');
    g.saki.setTile(31, 37);
    g.saki.face('up');
    g.saki.setVisible(true);
    await g.ui.fade(false, 1500);
    await say(g,
      saki('うわ……中、思ったより広いね。'),
      saki('ねえアキラ、本当にここなんだよね？ 噂の“大首の館”って。'),
      me('……噂だろ。夜中に入ると、二度と出られなくなるってやつ。'),
      saki('動画撮ったらすぐ帰るから！ ちょっとだけ、ね？'),
    );
    await g.wait(400);
    g.sfx('door_slam');
    g.shake(500, 0.012);
    g.flicker(0.6);
    p.face('down');
    g.saki.face('down');
    await g.wait(700);
    await say(g, saki('きゃっ!?'), me('……扉が、閉まった。'));
    g.sakiWalker.go(g.grid, 30, 40);
    await g.wait(900);
    g.sfx('locked');
    await g.wait(500);
    await say(g, saki('うそ……開かない。なんで？ 鍵なんて掛かってなかったのに……'));
    g.saki.face('up');
    await say(g,
      saki('わ、私、ほかに出口がないか見てくる！ アキラはここで待ってて！'),
      me('おい、待て、サキ！ 一人で行くな！'),
    );
    const walk = g.sakiWalker.go(g.grid, 22, 30);
    g.sakiWalker.speed = 95;
    await walk;
    g.setDoorOpen(g.doorById('door_hallW'), true, true);
    await g.sakiWalker.go(g.grid, 22, 28);
    g.saki.setVisible(false);
    g.sakiWalker.speed = 60;
    await g.wait(900);
    g.setDoorOpen(g.doorById('door_hallW'), false, true);
    await g.wait(2200);
    g.sfx('scream', { vol: 0.25, pan: -0.4 });
    g.flicker(1.4);
    await g.wait(1400);
    await say(g,
      me('……今の、サキの声……？'),
      me('サキ！ どこだ！'),
    );
    await say(g, sys('サキを探して、館の中を調べよう。\n〔移動〕WASD／矢印キー　〔調べる〕E／Enter　〔走る〕Shift　〔メニュー〕Esc\n（スマホ：画面左をドラッグで移動、右下のボタンで調べる・走る）'));
    g.state.flags.intro_done = true;
    g.autosave('玄関ホール');
    g.refreshObjective(true);
  });
}

export async function firstEncounter(g: G) {
  const f = g.state.flags;
  f.first_encounter_done = true;
  await cutscene(g, async () => {
    const p = g.player;
    g.flicker(1.5);
    g.sfx('buzz');
    await g.wait(600);
    const east = p.x < 30 * TILE;
    g.spawnMonster(east ? 58 : 2, east ? 13 : 12, 'stare', { stare: 1.9, then: 'chase', quick: true });
    g.monster.faceToward(p.x, p.y);
    await g.wait(250);
    g.sfx('sting');
    g.shake(350, 0.006);
    p.faceToward(g.monster.x, g.monster.y);
    await say(g, me('……なんだ、あれ……'));
    await say(g, sys('【逃げろ！】\n〔走る〕Shift／「走る」ボタン（スタミナに注意）\nクローゼットなどを調べると隠れられる。\nただし、見られながら隠れると見つかってしまう。'));
  });
}

export async function afterFirstEscape(g: G) {
  g.state.flags.first_escape_msg = true;
  await say(g, me('はぁ、はぁ……行った、のか……？'), me('なんなんだ、あの化け物は……。\nサキは、あいつに……？'), me('……とにかく、図書室だ。'));
  g.autosave(g.grid.roomAt(g.player.tx, g.player.ty)?.name ?? '館');
}

export async function basementArrival(g: G) {
  g.state.flags.basement_visited = true;
  await say(g, '……ひどく暗い。それに、寒い。', '奥の方で、水の滴る音がする。');
  g.autosave('地下室');
}

export async function basementAmbush(g: G) {
  await cutscene(g, async () => {
    g.sfx('door_slam', { vol: 0.6, pan: -0.6 });
    await g.wait(500);
    g.spawnMonster(19, 50, 'stare', { stare: 1.6, then: 'chase' });
    g.sfx('sting');
    g.shake(300, 0.006);
    await say(g, me('……！ 階段から、あいつが……！'));
  });
}

export async function endingScene(g: G) {
  const f = g.state.flags;
  f.escaped = true;
  await cutscene(g, async () => {
    const gate = g.doorById('door_gate');
    g.setDoorOpen(gate, false, false);
    gate.locked = true;
    g.sfx('gate');
    g.shake(500, 0.01);
    const m = g.monster;
    if (m.present) {
      m.setState('scripted');
      m.animate(false);
      m.setTile(46, 58);
      m.face('right');
    } else {
      g.spawnMonster(46, 58, 'scripted');
      m.face('right');
    }
    await say(g, sys('ガシャァン！！'));
    g.player.face('left');
    await g.wait(400);
    g.sfx('scream', { vol: 0.7 });
    g.shake(800, 0.01);
    await say(g, '鉄格子の隙間から、大首がこちらを覗き込んでいる。\n……格子が、ぎしぎしと軋んでいる。');
    g.saki.setTile(59, 58);
    g.saki.face('left');
    g.saki.setVisible(true);
    await say(g, saki('アキラ！ こっち！'));
    g.player.face('right');
    await g.sakiWalker.go(g.grid, 57, 58);
    await say(g,
      saki('倉庫の排水溝、ここに繋がってたの！ 梯子があるよ！'),
      me('サキ！ よし……上に出よう！'),
    );
    g.sfx('crash', { vol: 0.6 });
    g.shake(600, 0.012);
    await g.ui.fade(true, 1800);
  });
  g.startEnding();
}

/** Ambient monster-presence lines etc. */
export function nearlyCaughtLine(g: G) {
  return say(g, me(pick(['はぁ……はぁ……撒いた、か……？', '……足音が、遠ざかっていく。', '心臓がうるさい……'])));
}

export type { HideSpot };
