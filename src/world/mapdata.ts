import type { ItemId } from '../core/state';

export const MAP_W = 61;
export const MAP_H = 62;

export type FloorKind =
  | 'wood' | 'carpet' | 'carpet_blue' | 'tile_white' | 'tile_check' | 'parquet'
  | 'dirty' | 'stone' | 'hidden' | 'library' | 'runner';
export type WallTheme =
  | 'damask' | 'teal' | 'bath' | 'kitchen' | 'green' | 'panel' | 'burgundy'
  | 'olive' | 'study' | 'hall' | 'plaster' | 'brick' | 'blood';

export interface RoomDef {
  id: string;
  name: string;
  x0: number; y0: number; x1: number; y1: number;
  floor: FloorKind;
  wall: WallTheme;
  dark: number; // darkness alpha while in this room
  basement?: boolean;
}

export const ROOMS: RoomDef[] = [
  { id: 'corN', name: '北廊下', x0: 1, y0: 12, x1: 59, y1: 13, floor: 'runner', wall: 'green', dark: 0.94 },
  { id: 'corS', name: '南廊下', x0: 1, y0: 28, x1: 59, y1: 29, floor: 'runner', wall: 'green', dark: 0.94 },
  { id: 'bedroom', name: '寝室', x0: 1, y0: 2, x1: 14, y1: 9, floor: 'carpet', wall: 'damask', dark: 0.92 },
  { id: 'child', name: '子供部屋', x0: 16, y0: 2, x1: 29, y1: 9, floor: 'wood', wall: 'teal', dark: 0.92 },
  { id: 'bath', name: '浴室', x0: 31, y0: 2, x1: 41, y1: 9, floor: 'tile_white', wall: 'bath', dark: 0.92 },
  { id: 'kitchen', name: 'キッチン', x0: 43, y0: 2, x1: 59, y1: 9, floor: 'tile_check', wall: 'kitchen', dark: 0.92 },
  { id: 'library', name: '図書室', x0: 1, y0: 16, x1: 14, y1: 25, floor: 'library', wall: 'panel', dark: 0.93 },
  { id: 'living', name: 'リビング', x0: 16, y0: 16, x1: 29, y1: 25, floor: 'carpet_blue', wall: 'burgundy', dark: 0.88 },
  { id: 'dining', name: '食堂', x0: 31, y0: 16, x1: 59, y1: 25, floor: 'parquet', wall: 'olive', dark: 0.91 },
  { id: 'study', name: '書斎', x0: 1, y0: 32, x1: 14, y1: 41, floor: 'wood', wall: 'study', dark: 0.92 },
  { id: 'hall', name: '玄関ホール', x0: 16, y0: 32, x1: 44, y1: 41, floor: 'parquet', wall: 'hall', dark: 0.89 },
  { id: 'stair', name: '階段室', x0: 46, y0: 32, x1: 59, y1: 41, floor: 'dirty', wall: 'plaster', dark: 0.94 },
  { id: 'hidden', name: '隠し部屋', x0: 2, y0: 48, x1: 13, y1: 56, floor: 'hidden', wall: 'blood', dark: 0.9, basement: true },
  { id: 'basement', name: '地下室', x0: 16, y0: 48, x1: 47, y1: 59, floor: 'stone', wall: 'brick', dark: 0.975, basement: true },
  { id: 'cell', name: '地下倉庫', x0: 49, y0: 48, x1: 58, y1: 53, floor: 'stone', wall: 'brick', dark: 0.93, basement: true },
  { id: 'tunnel', name: '地下水路', x0: 49, y0: 57, x1: 59, y1: 59, floor: 'stone', wall: 'brick', dark: 0.93, basement: true },
];

export type LockKind = ItemId | 'power' | 'never';

export interface DoorDef {
  id: string;
  x: number;
  y: number; // for 'h' doors: the upper of the two wall rows
  kind: 'h' | 'v';
  lock?: LockKind;
  style?: 'wood' | 'iron' | 'shutter';
}

export const DOORS: DoorDef[] = [
  // band A <-> north corridor
  { id: 'door_bedroom', x: 7, y: 10, kind: 'h' },
  { id: 'door_child', x: 22, y: 10, kind: 'h' },
  { id: 'door_bath', x: 36, y: 10, kind: 'h' },
  { id: 'door_kitchen', x: 51, y: 10, kind: 'h' },
  // north corridor <-> band B
  { id: 'door_library', x: 7, y: 14, kind: 'h', lock: 'key_library' },
  { id: 'door_livingN', x: 22, y: 14, kind: 'h' },
  { id: 'door_diningN1', x: 38, y: 14, kind: 'h' },
  { id: 'door_diningN2', x: 53, y: 14, kind: 'h' },
  // band B <-> south corridor
  { id: 'door_livingS', x: 22, y: 26, kind: 'h' },
  { id: 'door_diningS', x: 40, y: 26, kind: 'h' },
  // south corridor <-> band C
  { id: 'door_study', x: 11, y: 30, kind: 'h', lock: 'key_study' },
  { id: 'door_hallW', x: 22, y: 30, kind: 'h' },
  { id: 'door_hallE', x: 38, y: 30, kind: 'h' },
  { id: 'door_stair', x: 52, y: 30, kind: 'h', lock: 'key_basement' },
  // side doors
  { id: 'door_bed_child', x: 15, y: 6, kind: 'v' },
  { id: 'door_living_dining', x: 30, y: 21, kind: 'v' },
  { id: 'door_shutter', x: 48, y: 50, kind: 'v', lock: 'power', style: 'shutter' },
  { id: 'door_gate', x: 48, y: 58, kind: 'v', lock: 'key_gate', style: 'iron' },
];

export interface PortalDef {
  id: string;
  tiles: [number, number][];
  dest: [number, number];
  flag?: string; // only active when flag set
  fade?: string; // message shown on transit
}

export const PORTALS: PortalDef[] = [
  { id: 'stairs_down', tiles: [[55, 34], [56, 34], [57, 34], [55, 35], [56, 35], [57, 35]], dest: [19, 50] },
  { id: 'stairs_up', tiles: [[18, 48], [19, 48], [20, 48]], dest: [56, 37] },
  { id: 'secret_down', tiles: [[4, 31], [5, 31]], dest: [7, 50], flag: 'portrait_solved' },
  { id: 'secret_up', tiles: [[7, 48], [8, 48]], dest: [4, 33] },
];

/** Tiles that are solid until a flag is set (then become floor). */
export const BREAKABLE: { tiles: [number, number][]; flag: string }[] = [
  { tiles: [[14, 52], [15, 52], [14, 53], [15, 53]], flag: 'wall_broken' },
];

export interface ObjDef {
  id: string;
  tex: string;
  x: number;
  y: number;
  w?: number; // footprint tiles
  h?: number;
  solid?: boolean; // default true
  decal?: boolean; // drawn flat under everything, not solid
  wall?: boolean; // hung on a wall face, not solid
  interact?: string;
  hide?: boolean;
  light?: { r: number; color?: number; flicker?: boolean; alpha?: number };
}

export const OBJECTS: ObjDef[] = [
  // ---------- 寝室 ----------
  { id: 'bed_rug', tex: 'rug_red', x: 6, y: 5, w: 3, h: 2, decal: true },
  { id: 'bed', tex: 'bed', x: 2, y: 2, w: 2, h: 3, interact: 'bed' },
  { id: 'nightstand', tex: 'nightstand', x: 4, y: 2, interact: 'nightstand' },
  { id: 'dresser', tex: 'dresser', x: 7, y: 2, w: 2, interact: 'dresser' },
  { id: 'wardrobe', tex: 'wardrobe', x: 11, y: 2, w: 2, interact: 'wardrobe', hide: true },
  { id: 'bed_win1', tex: 'window', x: 5, y: 0, wall: true, interact: 'window' },
  { id: 'bed_win2', tex: 'window', x: 9, y: 0, wall: true, interact: 'window' },
  { id: 'portrait_woman', tex: 'portrait_woman', x: 14, y: 0, wall: true, interact: 'portrait_woman' },
  { id: 'bed_chair', tex: 'chair', x: 12, y: 7 },
  { id: 'bed_plant', tex: 'plant', x: 1, y: 9 },

  // ---------- 子供部屋 ----------
  { id: 'child_rug', tex: 'rug_round', x: 21, y: 5, w: 3, h: 2, decal: true },
  { id: 'child_bed', tex: 'bed_small', x: 17, y: 2, w: 2, h: 2, interact: 'child_bed' },
  { id: 'toybox', tex: 'toybox', x: 20, y: 2, interact: 'toybox' },
  { id: 'portrait_girl', tex: 'portrait_girl', x: 19, y: 0, wall: true, interact: 'portrait_girl' },
  { id: 'portrait_boy', tex: 'portrait_boy', x: 25, y: 0, wall: true, interact: 'portrait_boy' },
  { id: 'child_win', tex: 'window', x: 22, y: 0, wall: true, interact: 'window' },
  { id: 'child_closet', tex: 'closet_child', x: 27, y: 2, w: 2, interact: 'child_closet', hide: true },
  { id: 'child_desk', tex: 'small_desk', x: 24, y: 7, interact: 'picturebook' },
  { id: 'rocking_horse', tex: 'rocking_horse', x: 28, y: 8, interact: 'rocking_horse' },
  { id: 'blocks', tex: 'blocks', x: 18, y: 7, decal: true },

  // ---------- 浴室 ----------
  { id: 'bathtub', tex: 'bathtub_full', x: 37, y: 2, w: 3, h: 2, interact: 'bathtub' },
  { id: 'sink', tex: 'sink', x: 32, y: 2, interact: 'sink' },
  { id: 'mirror', tex: 'mirror', x: 32, y: 0, wall: true, interact: 'mirror' },
  { id: 'toilet', tex: 'toilet', x: 34, y: 2, interact: 'toilet' },
  { id: 'bath_mat', tex: 'bathmat', x: 37, y: 5, w: 2, decal: true },
  { id: 'towel', tex: 'towel_rack', x: 41, y: 7 },

  // ---------- キッチン ----------
  { id: 'counter1', tex: 'counter_drawer', x: 44, y: 2, interact: 'drawer' },
  { id: 'counter2', tex: 'counter', x: 45, y: 2, interact: 'counter' },
  { id: 'stove', tex: 'stove', x: 46, y: 2, interact: 'stove' },
  { id: 'counter3', tex: 'counter', x: 47, y: 2, interact: 'counter' },
  { id: 'ksink', tex: 'kitchen_sink', x: 48, y: 2, interact: 'ksink' },
  { id: 'counter4', tex: 'counter', x: 49, y: 2, interact: 'counter' },
  { id: 'fridge', tex: 'fridge', x: 54, y: 2, interact: 'fridge' },
  { id: 'pantry', tex: 'cupboard', x: 57, y: 2, w: 2, interact: 'pantry', hide: true },
  { id: 'ktable', tex: 'ktable', x: 52, y: 6, w: 2, h: 2, interact: 'ktable' },
  { id: 'kcrate1', tex: 'crate', x: 59, y: 9 },
  { id: 'kcrate2', tex: 'crate', x: 58, y: 9 },
  { id: 'k_win', tex: 'window', x: 47, y: 0, wall: true, interact: 'window' },

  // ---------- 北廊下 ----------
  { id: 'cn_win1', tex: 'window', x: 4, y: 10, wall: true, interact: 'window' },
  { id: 'cn_win2', tex: 'window', x: 14, y: 10, wall: true, interact: 'window' },
  { id: 'cn_win3', tex: 'window', x: 28, y: 10, wall: true, interact: 'window' },
  { id: 'cn_win4', tex: 'window', x: 44, y: 10, wall: true, interact: 'window' },
  { id: 'cn_win5', tex: 'window', x: 57, y: 10, wall: true, interact: 'window' },
  { id: 'save_n', tex: 'save_desk', x: 30, y: 12, interact: 'save', light: { r: 46, color: 0xffb060, flicker: true } },
  { id: 'cn_paint1', tex: 'painting_land', x: 18, y: 10, wall: true, interact: 'painting_land' },
  { id: 'cn_paint2', tex: 'painting_creepy', x: 47, y: 10, wall: true, interact: 'painting_creepy' },

  // ---------- 図書室 ----------
  { id: 'lib_shelf1', tex: 'bookshelf', x: 1, y: 16, interact: 'bookshelf' },
  { id: 'lib_shelf2', tex: 'bookshelf', x: 2, y: 16, interact: 'bookshelf' },
  { id: 'lib_shelf3', tex: 'bookshelf', x: 3, y: 16, interact: 'bookshelf' },
  { id: 'lib_shelf4', tex: 'bookshelf', x: 4, y: 16, interact: 'bookshelf' },
  { id: 'lib_color', tex: 'bookshelf_color', x: 10, y: 16, w: 2, interact: 'color_shelf' },
  { id: 'lib_shelf5', tex: 'bookshelf', x: 12, y: 16, interact: 'bookshelf' },
  { id: 'lib_shelf6', tex: 'bookshelf', x: 13, y: 16, interact: 'bookshelf' },
  { id: 'lib_shelf7', tex: 'bookshelf', x: 14, y: 16, interact: 'bookshelf' },
  { id: 'lib_mid1', tex: 'shelf_mid', x: 2, y: 19, h: 2, interact: 'bookshelf' },
  { id: 'lib_mid2', tex: 'shelf_mid', x: 3, y: 19, h: 2, interact: 'bookshelf' },
  { id: 'lib_mid3', tex: 'shelf_mid', x: 4, y: 19, h: 2, interact: 'bookshelf' },
  { id: 'lib_mid4', tex: 'shelf_mid', x: 10, y: 19, h: 2, interact: 'bookshelf' },
  { id: 'lib_mid5', tex: 'shelf_mid', x: 11, y: 19, h: 2, interact: 'bookshelf' },
  { id: 'lib_mid6', tex: 'shelf_mid', x: 12, y: 19, h: 2, interact: 'bookshelf' },
  { id: 'lib_desk', tex: 'desk', x: 2, y: 23, w: 2, interact: 'clipping' },
  { id: 'lib_chair', tex: 'chair_back', x: 2, y: 24, solid: false, decal: true },
  { id: 'lib_cabinet', tex: 'cabinet', x: 13, y: 23, interact: 'lib_cabinet', hide: true },
  { id: 'lib_memo', tex: 'lectern', x: 7, y: 21, interact: 'library_memo' },
  { id: 'lib_rug', tex: 'rug_red', x: 6, y: 23, w: 3, h: 2, decal: true },

  // ---------- リビング ----------
  { id: 'liv_rug', tex: 'rug_big', x: 18, y: 19, w: 5, h: 4, decal: true },
  { id: 'clock', tex: 'clock', x: 16, y: 16, interact: 'clock' },
  { id: 'portrait_man', tex: 'portrait_man', x: 18, y: 14, wall: true, interact: 'portrait_man' },
  { id: 'fireplace', tex: 'fireplace', x: 26, y: 16, w: 2, interact: 'fireplace', light: { r: 72, color: 0xff7030, flicker: true, alpha: 0.85 } },
  { id: 'sofa', tex: 'sofa', x: 19, y: 22, w: 3, interact: 'sofa' },
  { id: 'coffee', tex: 'coffee_table', x: 19, y: 20, w: 2, interact: 'coffee' },
  { id: 'armchair', tex: 'armchair', x: 24, y: 21, interact: 'sofa' },
  { id: 'liv_plant', tex: 'plant', x: 29, y: 16 },
  { id: 'liv_plant2', tex: 'plant', x: 16, y: 25 },
  { id: 'liv_win', tex: 'window', x: 24, y: 14, wall: true, interact: 'window' },

  // ---------- 食堂 ----------
  { id: 'long_table', tex: 'long_table', x: 38, y: 20, w: 10, h: 2, interact: 'dining_table', light: { r: 64, color: 0xffa050, flicker: true, alpha: 0.7 } },
  { id: 'dchair1', tex: 'chair', x: 39, y: 19 },
  { id: 'dchair2', tex: 'chair', x: 42, y: 19 },
  { id: 'dchair3', tex: 'chair', x: 45, y: 19 },
  { id: 'dchair4', tex: 'chair_back', x: 39, y: 22 },
  { id: 'dchair5', tex: 'chair_back', x: 42, y: 22 },
  { id: 'dchair6', tex: 'chair_back', x: 45, y: 22 },
  { id: 'dchair7', tex: 'chair_side', x: 37, y: 20 },
  { id: 'china', tex: 'china_cabinet', x: 32, y: 16, w: 2, interact: 'china' },
  { id: 'china2', tex: 'china_cabinet', x: 56, y: 16, w: 2, interact: 'china' },
  { id: 'd_paint1', tex: 'painting_land', x: 35, y: 14, wall: true, interact: 'painting_land' },
  { id: 'd_paint2', tex: 'painting_creepy', x: 45, y: 14, wall: true, interact: 'painting_creepy' },
  { id: 'd_win1', tex: 'window', x: 42, y: 14, wall: true, interact: 'window' },
  { id: 'd_win2', tex: 'window', x: 49, y: 14, wall: true, interact: 'window' },
  { id: 'd_plant', tex: 'plant', x: 59, y: 25 },
  { id: 'd_plant2', tex: 'plant', x: 31, y: 25 },

  // ---------- 書斎 ----------
  { id: 'study_shelf1', tex: 'bookshelf', x: 1, y: 32, interact: 'bookshelf' },
  { id: 'study_shelf2', tex: 'bookshelf', x: 2, y: 32, interact: 'bookshelf' },
  { id: 'portrait_torn', tex: 'portrait_torn', x: 4, y: 30, w: 2, h: 2, wall: true, interact: 'portrait_torn' },
  { id: 'safe', tex: 'safe', x: 13, y: 32, interact: 'safe' },
  { id: 'study_desk', tex: 'desk', x: 7, y: 35, w: 2, interact: 'master_diary', light: { r: 40, color: 0xffc070, flicker: true, alpha: 0.6 } },
  { id: 'study_chair', tex: 'chair_back', x: 7, y: 36 },
  { id: 'globe', tex: 'globe', x: 12, y: 38, interact: 'globe' },
  { id: 'study_arm', tex: 'armchair', x: 2, y: 39, interact: 'sofa' },
  { id: 'study_rug', tex: 'rug_red', x: 6, y: 38, w: 3, h: 2, decal: true },
  { id: 'study_cabinet', tex: 'cabinet', x: 14, y: 40, interact: 'study_cabinet', hide: true },
  { id: 'study_safe_memo', tex: 'memo_wall', x: 12, y: 30, wall: true, interact: 'safe_memo' },

  // ---------- 玄関ホール ----------
  { id: 'hall_rug', tex: 'rug_big', x: 27, y: 35, w: 5, h: 4, decal: true },
  { id: 'front_door', tex: 'front_door', x: 29, y: 42, w: 2, wall: true, interact: 'front_door' },
  { id: 'hall_mat', tex: 'doormat', x: 29, y: 41, w: 2, decal: true },
  { id: 'coat_closet', tex: 'coat_closet', x: 17, y: 32, w: 2, interact: 'coat_closet', hide: true },
  { id: 'save_hall', tex: 'save_desk', x: 26, y: 32, interact: 'save', light: { r: 46, color: 0xffb060, flicker: true } },
  { id: 'broken_stairs', tex: 'broken_stairs', x: 41, y: 32, w: 3, h: 2, interact: 'broken_stairs' },
  { id: 'armor1', tex: 'armor', x: 20, y: 37, h: 2, interact: 'armor' },
  { id: 'armor2', tex: 'armor', x: 40, y: 37, h: 2, interact: 'armor' },
  { id: 'hall_plant1', tex: 'plant', x: 16, y: 41 },
  { id: 'hall_plant2', tex: 'plant', x: 44, y: 41 },
  { id: 'hall_win1', tex: 'window', x: 28, y: 30, wall: true, interact: 'window' },
  { id: 'hall_win2', tex: 'window', x: 32, y: 30, wall: true, interact: 'window' },
  { id: 'hall_paint', tex: 'painting_land', x: 34, y: 30, wall: true, interact: 'painting_land' },

  // ---------- 南廊下 ----------
  { id: 'cs_win1', tex: 'window', x: 4, y: 26, wall: true, interact: 'window' },
  { id: 'cs_win2', tex: 'window', x: 16, y: 26, wall: true, interact: 'window' },
  { id: 'cs_win3', tex: 'window', x: 33, y: 26, wall: true, interact: 'window' },
  { id: 'cs_win4', tex: 'window', x: 47, y: 26, wall: true, interact: 'window' },
  { id: 'cs_paint', tex: 'painting_creepy', x: 28, y: 26, wall: true, interact: 'painting_creepy' },
  { id: 'cs_vase', tex: 'vase', x: 59, y: 28 },
  { id: 'cs_vase2', tex: 'vase', x: 1, y: 28 },

  // ---------- 階段室 ----------
  { id: 'stairs_down', tex: 'stairs_down', x: 55, y: 34, w: 3, h: 2, decal: true },
  { id: 'stair_crate1', tex: 'crate', x: 47, y: 40 },
  { id: 'stair_crate2', tex: 'crate', x: 48, y: 40 },
  { id: 'stair_crate3', tex: 'crate', x: 47, y: 39 },
  { id: 'stair_sign', tex: 'memo_wall', x: 50, y: 30, wall: true, interact: 'stair_sign' },
  { id: 'stair_chair', tex: 'chair_broken', x: 58, y: 40, interact: 'chair_broken' },

  // ---------- 隠し部屋 ----------
  { id: 'secret_stairs', tex: 'stairs_up2', x: 7, y: 46, w: 2, h: 3, decal: true },
  { id: 'altar', tex: 'altar', x: 7, y: 53, w: 2, interact: 'altar' },
  { id: 'lectern_final', tex: 'lectern', x: 4, y: 50, interact: 'final_note' },
  { id: 'hid_candle1', tex: 'candle', x: 6, y: 54, solid: false, light: { r: 36, color: 0xff9040, flicker: true, alpha: 0.75 } },
  { id: 'hid_candle2', tex: 'candle', x: 9, y: 54, solid: false, light: { r: 36, color: 0xff9040, flicker: true, alpha: 0.75 } },
  { id: 'hid_p1', tex: 'portrait_scratched', x: 3, y: 46, wall: true, interact: 'scratched' },
  { id: 'hid_p2', tex: 'portrait_scratched', x: 11, y: 46, wall: true, interact: 'scratched' },
  { id: 'hid_p3', tex: 'portrait_scratched', x: 13, y: 46, wall: true, interact: 'scratched' },
  { id: 'cracked', tex: 'cracked_wall', x: 14, y: 52, w: 2, h: 2, wall: true, interact: 'cracked' },

  // ---------- 地下室 ----------
  { id: 'base_stairs', tex: 'stairs_up', x: 18, y: 46, w: 3, h: 3, decal: true },
  { id: 'save_base', tex: 'save_desk', x: 23, y: 48, interact: 'save', light: { r: 40, color: 0xffb060, flicker: true } },
  { id: 'pillar1', tex: 'pillar', x: 22, y: 51, h: 2 },
  { id: 'pillar2', tex: 'pillar', x: 28, y: 51, h: 2 },
  { id: 'pillar3', tex: 'pillar', x: 34, y: 51, h: 2 },
  { id: 'pillar4', tex: 'pillar', x: 40, y: 51, h: 2 },
  { id: 'pillar5', tex: 'pillar', x: 22, y: 55, h: 2 },
  { id: 'pillar6', tex: 'pillar', x: 28, y: 55, h: 2 },
  { id: 'pillar7', tex: 'pillar', x: 34, y: 55, h: 2 },
  { id: 'pillar8', tex: 'pillar', x: 40, y: 55, h: 2 },
  { id: 'breaker', tex: 'breaker', x: 44, y: 47, wall: true, interact: 'breaker' },
  { id: 'locker', tex: 'locker', x: 31, y: 48, interact: 'locker', hide: true },
  { id: 'b_barrel1', tex: 'barrel', x: 16, y: 59 },
  { id: 'b_barrel2', tex: 'barrel', x: 17, y: 59 },
  { id: 'b_barrel3', tex: 'barrel', x: 47, y: 48 },
  { id: 'b_crate1', tex: 'crate', x: 37, y: 59 },
  { id: 'b_crate2', tex: 'crate', x: 38, y: 59 },
  { id: 'b_crate3', tex: 'crate', x: 37, y: 58 },
  { id: 'puddle1', tex: 'puddle', x: 25, y: 54, w: 2, decal: true },
  { id: 'puddle2', tex: 'puddle', x: 43, y: 57, w: 2, decal: true },
  { id: 'chains', tex: 'chains', x: 27, y: 46, wall: true, interact: 'chains' },
  { id: 'chains2', tex: 'chains', x: 38, y: 46, wall: true, interact: 'chains' },

  // ---------- 地下倉庫 ----------
  { id: 'cell_bed', tex: 'cell_bed', x: 55, y: 48, w: 2, interact: 'cell_bed' },
  { id: 'bucket', tex: 'bucket', x: 50, y: 53, interact: 'bucket' },
  { id: 'cell_crate', tex: 'crate', x: 58, y: 53 },
  { id: 'cell_grate', tex: 'grate', x: 57, y: 51, decal: true, interact: 'grate' },

  // ---------- 地下水路 ----------
  { id: 'ladder', tex: 'ladder', x: 58, y: 55, h: 2, wall: true, interact: 'ladder' },
  { id: 'water1', tex: 'water', x: 50, y: 59, w: 2, decal: true },
  { id: 'water2', tex: 'water', x: 53, y: 59, w: 2, decal: true },
];

export const SPAWN_POINTS: [number, number][] = [
  [2, 12], [58, 13], [2, 29], [58, 28], [32, 24], [58, 24], [33, 17],
  [43, 40], [17, 40], [58, 8], [2, 8], [17, 5], [16, 24], [29, 24],
  [44, 8], [31, 9], [50, 38], [58, 32],
  [46, 50], [17, 58], [46, 58],
];

/** Hall chandelier etc.: purely decorative lights not tied to objects. */
export const STATIC_LIGHTS: { x: number; y: number; r: number; color: number; alpha: number; flicker?: boolean; flag?: string }[] = [
  { x: 30 * 16, y: 36 * 16, r: 80, color: 0xffd090, alpha: 0.35, flicker: true },
  { x: 25 * 16, y: 52 * 16, r: 70, color: 0xfff0b0, alpha: 0.5, flag: 'power_on' },
  { x: 37 * 16, y: 52 * 16, r: 70, color: 0xfff0b0, alpha: 0.5, flag: 'power_on' },
  { x: 31 * 16, y: 57 * 16, r: 70, color: 0xfff0b0, alpha: 0.45, flag: 'power_on' },
  { x: 44 * 16, y: 58 * 16, r: 60, color: 0xfff0b0, alpha: 0.45, flag: 'power_on' },
  { x: 54 * 16, y: 50 * 16, r: 60, color: 0xfff0b0, alpha: 0.45, flag: 'power_on' },
];
