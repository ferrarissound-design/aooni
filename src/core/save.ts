import { GameState, repairProgress } from './state';

const KEY = 'karasuba.save.v1';
const BAK = 'karasuba.save.v1.bak';
const META = 'karasuba.meta.v1';
const SETTINGS = 'karasuba.settings.v1';

function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

interface Envelope {
  v: 1;
  t: number;
  sum: string;
  data: string;
}

function storage(): Storage | null {
  try {
    const s = window.localStorage;
    const probe = '__karasuba_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

function parseEnvelope(raw: string | null): GameState | null {
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as Envelope;
    if (!env || env.v !== 1 || typeof env.data !== 'string') return null;
    if (fnv1a(env.data) !== env.sum) return null;
    const st = JSON.parse(env.data) as GameState;
    if (!st || st.version !== 1 || typeof st.flags !== 'object') return null;
    if (!Number.isFinite(st.px) || !Number.isFinite(st.py)) return null;
    return st;
  } catch {
    return null;
  }
}

export const Save = {
  available(): boolean {
    return storage() !== null;
  },

  write(state: GameState): boolean {
    const s = storage();
    if (!s) return false;
    try {
      const data = JSON.stringify(state);
      const env: Envelope = { v: 1, t: Date.now(), sum: fnv1a(data), data };
      const prev = s.getItem(KEY);
      // keep the previous good save as a backup before overwriting
      if (prev && parseEnvelope(prev)) s.setItem(BAK, prev);
      s.setItem(KEY, JSON.stringify(env));
      // verify the write
      return parseEnvelope(s.getItem(KEY)) !== null;
    } catch {
      return false;
    }
  },

  /** Loads the save; falls back to the backup when the main slot is corrupt. */
  read(): { state: GameState; restoredFromBackup: boolean; fixes: string[] } | null {
    const s = storage();
    if (!s) return null;
    let st = parseEnvelope(s.getItem(KEY));
    let restored = false;
    if (!st) {
      st = parseEnvelope(s.getItem(BAK));
      restored = st !== null && s.getItem(KEY) !== null;
    }
    if (!st) return null;
    const fixes = repairProgress(st);
    return { state: st, restoredFromBackup: restored, fixes };
  },

  exists(): boolean {
    const s = storage();
    if (!s) return false;
    return parseEnvelope(s.getItem(KEY)) !== null || parseEnvelope(s.getItem(BAK)) !== null;
  },

  clear(): void {
    const s = storage();
    if (!s) return;
    s.removeItem(KEY);
    s.removeItem(BAK);
  },

  meta(): { cleared: number; bestTime: number } {
    const s = storage();
    try {
      const m = JSON.parse(s?.getItem(META) ?? '{}');
      return { cleared: Number(m.cleared) || 0, bestTime: Number(m.bestTime) || 0 };
    } catch {
      return { cleared: 0, bestTime: 0 };
    }
  },

  recordClear(time: number): void {
    const s = storage();
    if (!s) return;
    const m = Save.meta();
    m.cleared += 1;
    if (!m.bestTime || time < m.bestTime) m.bestTime = time;
    try { s.setItem(META, JSON.stringify(m)); } catch { /* ignore */ }
  },

  settings(): { volume: number; shake: boolean } {
    const s = storage();
    try {
      const m = JSON.parse(s?.getItem(SETTINGS) ?? '{}');
      return {
        volume: typeof m.volume === 'number' ? Math.min(1, Math.max(0, m.volume)) : 0.8,
        shake: m.shake !== false,
      };
    } catch {
      return { volume: 0.8, shake: true };
    }
  },

  saveSettings(v: { volume: number; shake: boolean }): void {
    const s = storage();
    try { s?.setItem(SETTINGS, JSON.stringify(v)); } catch { /* ignore */ }
  },
};
