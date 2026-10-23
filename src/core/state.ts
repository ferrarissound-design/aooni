export type ItemId =
  | 'flashlight_dead'
  | 'flashlight'
  | 'battery'
  | 'hanger'
  | 'key_library'
  | 'key_study'
  | 'key_basement'
  | 'piece'
  | 'key_gate';

export interface ItemDef {
  name: string;
  desc: string;
  icon: string; // texture key for the inventory icon
}

export const ITEMS: Record<ItemId, ItemDef> = {
  flashlight_dead: { name: '懐中電灯（電池切れ）', desc: '古い懐中電灯。スイッチを入れても点かない。電池さえあれば…', icon: 'icon_flashlight' },
  flashlight: { name: '懐中電灯', desc: '電池を入れた懐中電灯。前方を照らしてくれる。', icon: 'icon_flashlight' },
  battery: { name: '単一電池', desc: 'キッチンの引き出しにあった電池。まだ使えそうだ。', icon: 'icon_battery' },
  hanger: { name: '針金ハンガー', desc: '伸ばせば長い針金になる。先を曲げれば何かを引っかけられそうだ。', icon: 'icon_hanger' },
  key_library: { name: '図書室の鍵', desc: '浴槽の排水口に引っかかっていた鍵。札に「図書室」とある。', icon: 'icon_key' },
  key_study: { name: '書斎の鍵', desc: '本棚の隠し棚にあった真鍮の鍵。札に「書斎」とある。', icon: 'icon_key' },
  key_basement: { name: '地下室の鍵', desc: '金庫に入っていた重い鍵。札に「地下」とある。', icon: 'icon_key_big' },
  piece: { name: '肖像画の切れ端', desc: 'サキが地下で拾った絵の切れ端。誰かの顔の一部が描かれている。', icon: 'icon_piece' },
  key_gate: { name: '鉄格子の鍵', desc: '錆びついた大きな鍵。地下の鉄格子に合いそうだ。', icon: 'icon_key_big' },
};

export type NoteId =
  | 'digits'
  | 'picturebook'
  | 'library_memo'
  | 'clipping'
  | 'diary_dining'
  | 'safe_memo'
  | 'master_diary'
  | 'breaker_memo'
  | 'final_note';

export interface GameState {
  version: 1;
  flags: Record<string, boolean>;
  items: ItemId[];
  notes: NoteId[];
  portraitDigits: { girl: number; boy: number; woman: number; man: number };
  px: number;
  py: number;
  facing: 'down' | 'left' | 'right' | 'up';
  playTime: number;
  deaths: number;
  saveLabel: string;
  unlocked: string[]; // door ids
}

export function rndDigit(): number {
  return 1 + Math.floor(Math.random() * 9);
}

export function newGameState(): GameState {
  return {
    version: 1,
    flags: {},
    items: [],
    notes: [],
    portraitDigits: { girl: rndDigit(), boy: rndDigit(), woman: rndDigit(), man: rndDigit() },
    px: 30 * 16 + 8,
    py: 37 * 16 + 12,
    facing: 'up',
    playTime: 0,
    deaths: 0,
    saveLabel: '玄関ホール',
    unlocked: [],
  };
}

export function safeCode(s: GameState): string {
  const d = s.portraitDigits;
  // 「愛した順」: 娘 → 息子 → 妻 → 主人
  return `${d.girl}${d.boy}${d.woman}${d.man}`;
}

export function hasItem(s: GameState, id: ItemId): boolean {
  return s.items.includes(id);
}

export function addItem(s: GameState, id: ItemId): void {
  if (!s.items.includes(id)) s.items.push(id);
}

export function removeItem(s: GameState, id: ItemId): void {
  s.items = s.items.filter((i) => i !== id);
}

export function addNote(s: GameState, id: NoteId): boolean {
  if (s.notes.includes(id)) return false;
  s.notes.push(id);
  return true;
}

/**
 * Validates a loaded state and repairs anything that could make the game
 * unwinnable (missing keys, inconsistent flags). Returns a list of repairs.
 */
export function repairProgress(s: GameState): string[] {
  const fixes: string[] = [];
  const f = s.flags;
  const ensure = (cond: boolean, item: ItemId, label: string) => {
    if (cond && !hasItem(s, item)) {
      addItem(s, item);
      fixes.push(label);
    }
  };
  if (!Array.isArray(s.items)) s.items = [];
  if (!Array.isArray(s.notes)) s.notes = [];
  if (!Array.isArray(s.unlocked)) s.unlocked = [];
  s.items = s.items.filter((i) => i in ITEMS);
  const unlocked = (id: string) => s.unlocked.includes(id);

  // flashlight chain
  if (hasItem(s, 'flashlight') && hasItem(s, 'flashlight_dead')) removeItem(s, 'flashlight_dead');
  if (f.flashlight_on && !hasItem(s, 'flashlight')) { addItem(s, 'flashlight'); fixes.push('flashlight'); }

  ensure(!!f.bath_drained && !unlocked('door_library'), 'key_library', 'key_library');
  ensure(!!f.books_solved && !unlocked('door_study'), 'key_study', 'key_study');
  ensure(!!f.safe_opened && !unlocked('door_stair'), 'key_basement', 'key_basement');
  ensure(!!f.got_piece && !f.portrait_solved, 'piece', 'piece');
  ensure(!!f.got_gate_key && !unlocked('door_gate'), 'key_gate', 'key_gate');

  // flags implied by later flags
  if (f.final_chase && !f.got_gate_key) { f.got_gate_key = true; ensure(!unlocked('door_gate'), 'key_gate', 'key_gate'); }
  if (f.portrait_solved) f.got_piece = true;
  if (f.got_piece) { f.power_on = true; f.saki_found = true; }
  if (f.power_on) f.basement_visited = true;
  if (f.library_unlocked || unlocked('door_library')) f.first_encounter_done = true;

  const d = s.portraitDigits;
  for (const k of ['girl', 'boy', 'woman', 'man'] as const) {
    if (!Number.isInteger(d?.[k]) || d[k] < 1 || d[k] > 9) {
      s.portraitDigits = { girl: rndDigit(), boy: rndDigit(), woman: rndDigit(), man: rndDigit() };
      fixes.push('digits');
      break;
    }
  }
  return fixes;
}
