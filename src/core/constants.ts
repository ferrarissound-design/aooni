export const TILE = 16;

export const PLAYER_WALK = 66;
export const PLAYER_DASH = 112;
export const STAMINA_MAX = 3.4; // seconds of dash
export const STAMINA_REGEN = 0.75; // per second
export const STAMINA_REGEN_DELAY = 0.7;

export const MONSTER_WANDER = 40;
export const MONSTER_ALERT = 58;
export const MONSTER_SEARCH = 48;
export const MONSTER_CHASE = 90;
export const MONSTER_CHASE_FINAL = 86;

export const CATCH_DIST = 11;

export const DEPTH = {
  map: 0,
  decal: 1,
  object: 10,
  fog: 3000,
  door: 3100,
  actor: 3200,
  dark: 6000,
  glint: 6100,
  fx: 6200,
} as const;

export type Dir = 'down' | 'left' | 'right' | 'up';

export const DIR_VEC: Record<Dir, { x: number; y: number }> = {
  down: { x: 0, y: 1 },
  up: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
