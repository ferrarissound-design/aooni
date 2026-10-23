import { GameState, NoteId } from '../core/state';

export const PLAYER_NAME = 'アキラ';

export const NOTES: Record<NoteId, { title: string; body: (s: GameState) => string }> = {
  digits: {
    title: '肖像画の数字',
    body: (s) => {
      const d = s.portraitDigits;
      const f = s.flags;
      const line = (seen: boolean, who: string, n: number) => `${who}の肖像画：${seen ? n : '？'}`;
      return `館の肖像画の額には、小さな数字が刻まれていた。\n\n${line(!!f.seen_girl, '少女', d.girl)}\n${line(!!f.seen_boy, '少年', d.boy)}\n${line(!!f.seen_woman, '婦人', d.woman)}\n${line(!!f.seen_man, '紳士', d.man)}`;
    },
  },
  picturebook: {
    title: '絵本『よるのえほん』',
    body: () => 'まっくらな よるが おわると\nまっしろな あさが きて\nおひさまいろの おひるの あとに\nゆうやけが おそらを そめるの\n\n（子供部屋の机に置かれていた絵本。最後のページに、小さな字で「さよの ひみつ」と書かれている）',
  },
  library_memo: {
    title: '図書室の書き付け',
    body: () => '小夜は、お気に入りの絵本のとおりに背表紙を押して遊ぶ。\nあの子の「ひみつの棚」は、今もその順番でしか開かない。\n\n― 鴉羽 千代',
  },
  clipping: {
    title: '新聞の切り抜き',
    body: () => '【鴉羽邸の一家 四人が行方不明】\n\n町外れの洋館に住む鴉羽宗一郎さん（42）、妻の千代さん、長女の小夜ちゃん（9）、長男の伊織くん（6）の行方が分からなくなっている。\n\n屋敷に食料を届けた業者は「窓から、人の背丈ほどもある顔がこちらを覗いていた」と話しており、警察は……\n\n（ここから先は破り取られている）',
  },
  diary_dining: {
    title: '食卓の日記',
    body: () => '私は何よりも、娘を愛した。\nその次に、息子を愛した。\n妻のことは……三番目にしか愛せなかった。\n\nそして私自身を、私は最も愛さなかった。\nだからこそ、この顔が膨らんでいくのを止められなかったのだ。',
  },
  safe_memo: {
    title: '書斎の金庫の覚え書き',
    body: () => '金庫の番号は、家族の肖像画の額に刻んである。\n愛の深い順に並べること。\n\n― 宗一郎',
  },
  master_diary: {
    title: '主人の日記',
    body: () => '〇月〇日\n家族が寝静まったあと鏡を覗くと、私の顔は昨日より少し大きくなっていた。\n\n〇月〇日\n家を守るには、大きな顔が要る。全ての部屋を見渡せる、大きな目が要る。\n誰ひとり、この家から出ていかぬように。\n\n〇月〇日\n地下室の鍵は金庫へ。あそこには、もう誰も入れてはならない。',
  },
  breaker_memo: {
    title: '配電盤の注意書き',
    body: () => '【注意】\nこの配電盤は古く、レバーが隣と連動して動く。\nすべての灯りを点ければ、倉庫の電動シャッターが開く。',
  },
  final_note: {
    title: '最後の書き置き',
    body: () => 'これを読む者へ。\n\n私はもう、人の顔を保てない。\n鉄格子の鍵は祭壇に置いた。鉄格子の向こうの水路をたどれば、外へ出られる。\n\nだが、鍵を取れば「私」は気づくだろう。\n地下を駆け抜けろ。決して、振り返るな。\n\n― 鴉羽 宗一郎',
  },
};

export function objective(s: GameState): { text: string; hint: string } {
  const f = s.flags;
  const has = (i: string) => s.items.includes(i as never);
  const light = has('flashlight');
  if (!f.first_encounter_done) {
    if (f.bath_drained) return { text: 'サキを探す', hint: '図書室の鍵を手に入れた。北廊下の図書室を調べよう。' };
    if (f.bath_seen) return { text: 'サキを探す', hint: '浴槽の底で何かが光っていた。手では届かない。何か長いもので引っかけられないだろうか。' };
    return { text: 'サキを探す', hint: '館の部屋を一つずつ調べてみよう。鍵のかかった部屋もあるようだ。' };
  }
  if (!f.books_solved) {
    if (!s.unlocked.includes('door_library')) return { text: '図書室に入る', hint: '図書室の扉は北廊下にある。浴槽で見つけた鍵が使えるはずだ。' };
    return { text: '図書室を調べる', hint: f.seen_picturebook ? '色のそろわない本棚。子供部屋の絵本に出てきた色の順番は……' : '色のそろわない本棚がある。この家の子供が遊んでいたらしい。子供部屋に何か手がかりがあるかもしれない。' };
  }
  if (!f.safe_opened) {
    if (!s.unlocked.includes('door_study')) return { text: '書斎に入る', hint: '書斎は南廊下の西側にある。' };
    return { text: '書斎の金庫を開ける', hint: '番号は家族の肖像画に。並べる順番は、食堂のどこかに書かれていたはずだ。（メモはメニューから見直せる）' };
  }
  if (!f.power_on) {
    if (!light) return { text: '地下室へ向かう', hint: '地下は真っ暗だろう。明かりが必要だ。寝室の懐中電灯と、キッチンに電池はなかったか。' };
    if (!s.unlocked.includes('door_stair')) return { text: '地下室へ向かう', hint: '階段室は南廊下の東側にある。' };
    return { text: '地下室を調べる', hint: '地下室の奥に配電盤があった。レバーは隣のレバーと連動して動く。' };
  }
  if (!f.saki_found) return { text: 'サキの声がした方へ', hint: '地下室の東、シャッターが開いた倉庫から声がした。' };
  if (!f.portrait_solved) return { text: '書斎の肖像画を元に戻す', hint: '継ぎはぎの肖像画。サキから受け取った切れ端で、元の絵に戻せるはずだ。' };
  if (!f.got_gate_key) return { text: '隠し部屋を調べる', hint: '肖像画の裏の階段。その先に、この館の秘密がある。' };
  return { text: '地下の鉄格子から脱出する！', hint: '地下室の東南、鉄格子の向こうに水路が続いている。走れ！' };
}
