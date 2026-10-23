import { P, shade } from './pixel';

type Draw = (p: P) => void;
export const OBJ_TEX: Record<string, [number, number, Draw, boolean?]> = {};
const def = (key: string, w: number, h: number, d: Draw, noOutline = false) => { OBJ_TEX[key] = [w, h, d, noOutline]; };

const W = { d: '#2a190f', m: '#4a2f1c', l: '#654126', h: '#7d5634', x: '#1a0f08' };
const BR = { d: '#7a5a22', l: '#c09840', h: '#e8c868' };
const MET = { d: '#3a3e46', m: '#5a5f68', l: '#80868f', h: '#a8aeb6' };

function woodFront(p: P, x: number, y: number, w: number, h: number) {
  p.r(x, y, w, h, W.m);
  p.h(x, y, w, W.h);
  p.h(x, y + h - 1, w, W.d);
  for (let yy = y + 3; yy < y + h - 1; yy += 4) p.h(x + 1, yy, w - 2, shade(W.m, -0.12));
}

function frame(p: P, w: number, h: number) {
  p.r(0, 0, w, h, BR.d);
  p.h(0, 0, w, BR.h); p.v(0, 0, h, BR.l);
  p.h(1, h - 1, w - 1, '#4a3410'); p.v(w - 1, 1, h - 1, '#4a3410');
  p.r(2, 2, w - 4, h - 4, '#120c0a');
}

type FaceKind = 'girl' | 'boy' | 'woman' | 'man' | 'scratched' | 'creepy';
function face(p: P, x: number, y: number, skin: string, hair: string, kind: FaceKind) {
  p.r(x + 3, y + 3, 6, 6, skin);
  if (kind === 'girl') { p.r(x + 2, y + 1, 8, 3, hair); p.r(x + 2, y + 3, 1, 7, hair); p.r(x + 9, y + 3, 1, 7, hair); p.r(x + 3, y + 9, 6, 3, '#d8d4cc'); }
  if (kind === 'boy') { p.r(x + 3, y + 1, 6, 3, hair); p.r(x + 3, y + 9, 6, 3, '#26304a'); p.p(x + 5, y + 9, '#e0e0e0'); p.p(x + 6, y + 9, '#e0e0e0'); }
  if (kind === 'woman') { p.r(x + 3, y, 6, 4, hair); p.r(x + 4, y - 1, 4, 1, hair); p.r(x + 2, y + 9, 8, 3, '#3a1830'); }
  if (kind === 'man') { p.r(x + 3, y + 1, 6, 2, hair); p.p(x + 3, y + 3, hair); p.r(x + 4, y + 7, 4, 1, hair); p.r(x + 2, y + 9, 8, 3, '#1e1e22'); p.p(x + 6, y + 9, '#c0c0c0'); }
  if (kind === 'scratched' || kind === 'creepy') { p.r(x + 3, y + 1, 6, 2, hair); p.r(x + 2, y + 9, 8, 3, '#1e1416'); }
  if (kind === 'scratched') {
    for (let i = 0; i < 6; i++) { p.p(x + 3 + i, y + 3 + (i % 3), '#0a0606'); p.p(x + 4 + i, y + 4 + ((i + 1) % 3), '#7a6a5a'); }
  } else if (kind === 'creepy') {
    p.r(x + 4, y + 5, 1, 1, '#e8e0d0'); p.r(x + 7, y + 5, 1, 1, '#e8e0d0');
    p.p(x + 4, y + 5, '#c02020'); p.p(x + 7, y + 5, '#c02020');
    p.h(x + 4, y + 7, 4, '#3a1010');
  } else {
    p.p(x + 4, y + 5, '#201010'); p.p(x + 7, y + 5, '#201010');
    p.p(x + 5, y + 7, shade(skin, -0.3)); p.p(x + 6, y + 7, shade(skin, -0.3));
  }
}

function portrait(key: string, kind: FaceKind, bg: string, hair: string) {
  def(key, 16, 16, (p) => {
    frame(p, 16, 14);
    p.r(2, 2, 12, 10, bg);
    face(p, 2, 1, '#cdb4a0', hair, kind);
    p.r(2, 2, 12, 10, 'rgba(0,0,0,0)');
    // re-draw frame edges over overflow
    p.h(0, 0, 16, BR.h); p.h(1, 13, 15, '#4a3410');
    p.r(0, 14, 16, 2, 'rgba(0,0,0,0.0)');
  });
}

// ---------- bedroom ----------
def('bed', 32, 48, (p) => {
  // headboard
  p.r(1, 0, 30, 9, W.d);
  p.r(2, 1, 28, 6, W.m);
  p.h(2, 1, 28, W.h);
  p.r(4, 3, 24, 2, W.l);
  // frame
  p.r(1, 8, 30, 39, W.d);
  // sheets
  p.r(3, 9, 26, 35, '#a8a49c');
  p.r(5, 10, 10, 6, '#cfcbc2'); p.r(17, 10, 10, 6, '#cfcbc2');
  p.h(5, 15, 10, '#8e8a82'); p.h(17, 15, 10, '#8e8a82');
  // blanket
  p.r(3, 19, 26, 25, '#5a1a20');
  p.h(3, 19, 26, '#c0bcb2'); p.h(3, 20, 26, '#7a2a2c');
  for (let y = 24; y < 44; y += 5) p.h(4, y, 24, '#4a1418');
  p.speckle(3, 21, 26, 22, ['#6a2228', '#3c0e12'], 0.05, 4);
  // footboard
  p.r(1, 43, 30, 5, W.m); p.h(1, 43, 30, W.h); p.h(1, 47, 30, W.x);
  p.r(1, 0, 2, 48, W.d); p.r(29, 0, 2, 48, W.d);
  p.r(0, 0, 3, 3, W.h); p.r(29, 0, 3, 3, W.h);
});

def('bed_small', 32, 32, (p) => {
  p.r(2, 0, 28, 7, '#5a6670'); p.h(2, 0, 28, '#7a8890'); p.r(4, 2, 24, 2, '#46525a');
  p.r(2, 6, 28, 26, '#3a444c');
  p.r(4, 7, 24, 22, '#a8a29a');
  p.r(6, 8, 20, 5, '#cac4bc');
  p.r(4, 14, 24, 15, '#7a5a6a');
  p.h(4, 14, 24, '#c8c2b8');
  for (let y = 18; y < 29; y += 4) for (let x = 6; x < 28; x += 4) p.p(x, y, '#9a7a8a');
  // a teddy bear
  p.ellipse(22, 11, 3, 3, '#6a4a30'); p.p(20, 8, '#6a4a30'); p.p(24, 8, '#6a4a30');
  p.p(21, 11, '#120a08'); p.p(23, 11, '#120a08');
  p.r(2, 28, 28, 4, '#46525a'); p.h(2, 31, 28, '#20262c');
});

def('nightstand', 16, 20, (p) => {
  p.r(1, 2, 14, 6, W.l); p.h(1, 2, 14, W.h);
  woodFront(p, 1, 8, 14, 12);
  p.r(3, 10, 10, 4, W.d); p.p(8, 12, BR.h);
  // flashlight on top
  p.r(4, 3, 7, 3, '#3a3a40'); p.r(10, 3, 2, 3, '#6a6a72'); p.p(11, 4, '#a0a0a8');
});
def('nightstand_empty', 16, 20, (p) => {
  p.r(1, 2, 14, 6, W.l); p.h(1, 2, 14, W.h);
  woodFront(p, 1, 8, 14, 12);
  p.r(3, 10, 10, 4, W.d); p.p(8, 12, BR.h);
  p.r(4, 4, 6, 1, shade(W.l, -0.2));
});

def('dresser', 32, 24, (p) => {
  // mirror on top
  p.r(8, 0, 16, 9, W.d); p.r(10, 1, 12, 7, '#2a3442'); p.p(12, 2, '#6a7a90'); p.p(13, 3, '#4a5a70');
  p.r(1, 8, 30, 4, W.l); p.h(1, 8, 30, W.h);
  woodFront(p, 1, 12, 30, 12);
  for (const x of [3, 17]) { p.r(x, 13, 12, 4, W.d); p.r(x, 18, 12, 4, W.d); p.p(x + 6, 15, BR.h); p.p(x + 6, 20, BR.h); }
  p.r(5, 6, 3, 2, '#6a5a8a'); p.r(25, 5, 2, 3, '#8a7a50');
});

def('wardrobe', 32, 40, (p) => {
  p.r(0, 0, 32, 4, W.d); p.h(0, 0, 32, W.h); p.r(1, 2, 30, 1, W.l);
  p.r(1, 4, 30, 36, W.m);
  p.v(15, 4, 36, W.x); p.v(16, 4, 36, W.x);
  for (const x of [3, 18]) {
    p.r(x, 7, 11, 12, shade(W.m, 0.08)); p.h(x, 7, 11, W.h); p.v(x, 7, 12, W.h); p.h(x, 18, 11, W.d);
    p.r(x, 22, 11, 14, shade(W.m, 0.08)); p.h(x, 22, 11, W.h); p.v(x, 22, 14, W.h); p.h(x, 35, 11, W.d);
  }
  p.r(13, 20, 1, 3, BR.h); p.r(18, 20, 1, 3, BR.h);
  p.h(1, 39, 30, W.x);
});

def('window', 16, 16, (p) => {
  p.r(1, 1, 14, 14, W.d);
  p.r(2, 2, 12, 12, '#0d1424');
  p.r(3, 3, 10, 5, '#141e36');
  p.p(10, 4, '#c8d0e0'); p.p(11, 4, '#8890a8'); p.p(10, 5, '#8890a8');
  p.v(7, 2, 12, W.m); p.h(2, 8, 12, W.m);
  // curtains
  p.r(0, 0, 3, 16, '#5a1418'); p.v(1, 1, 15, '#3a0c10');
  p.r(13, 0, 3, 16, '#5a1418'); p.v(14, 1, 15, '#3a0c10');
  p.h(0, 0, 16, '#2a0a0c');
});
def('window_flash', 16, 16, (p) => {
  p.r(1, 1, 14, 14, W.d);
  p.r(2, 2, 12, 12, '#b8c8ff');
  p.v(7, 2, 12, W.m); p.h(2, 8, 12, W.m);
  p.r(0, 0, 3, 16, '#5a1418'); p.r(13, 0, 3, 16, '#5a1418');
});

portrait('portrait_girl', 'girl', '#2a2a3a', '#1a1010');
portrait('portrait_boy', 'boy', '#2a3426', '#2a1a10');
portrait('portrait_woman', 'woman', '#3a2a2a', '#3a2010');
portrait('portrait_man', 'man', '#1e2a2a', '#141010');
portrait('portrait_scratched', 'scratched', '#2a1a1a', '#141010');
portrait('painting_creepy', 'creepy', '#1a1a20', '#0a0a0a');

def('painting_land', 16, 16, (p) => {
  frame(p, 16, 12);
  p.r(2, 2, 12, 8, '#1a2232');
  p.r(2, 7, 12, 3, '#1a2a1a');
  p.r(4, 4, 3, 4, '#0e1410'); p.r(5, 3, 1, 1, '#0e1410');
  p.p(11, 3, '#d0d0b0');
  p.r(9, 6, 3, 2, '#2a1a12'); p.p(10, 6, '#c0a040');
});

def('chair', 16, 20, (p) => {
  p.r(3, 1, 10, 8, W.d); p.r(4, 2, 8, 5, '#5a1a20'); p.h(3, 1, 10, W.h);
  p.r(2, 8, 12, 6, W.l); p.r(3, 9, 10, 4, '#6a2228'); p.h(2, 8, 12, W.h);
  p.v(3, 14, 5, W.d); p.v(12, 14, 5, W.d);
});
def('chair_back', 16, 20, (p) => {
  p.r(2, 4, 12, 6, W.l); p.r(3, 5, 10, 4, '#6a2228');
  p.v(3, 10, 8, W.d); p.v(12, 10, 8, W.d);
  p.r(3, 9, 10, 9, W.d); p.r(4, 10, 8, 6, '#4a1418'); p.h(3, 9, 10, W.h);
  p.h(3, 17, 10, W.x);
});
def('chair_side', 16, 20, (p) => {
  p.r(3, 2, 3, 14, W.d); p.h(3, 2, 3, W.h);
  p.r(5, 8, 9, 5, W.l); p.r(6, 9, 7, 3, '#6a2228');
  p.v(5, 13, 6, W.d); p.v(13, 13, 6, W.d);
});
def('chair_broken', 16, 16, (p) => {
  p.r(2, 9, 10, 4, W.l); p.h(2, 9, 10, W.h);
  p.v(3, 13, 3, W.d); p.v(11, 12, 2, W.d);
  p.r(9, 3, 3, 7, W.d); p.p(13, 13, W.m); p.p(14, 14, W.m);
});

def('plant', 16, 24, (p) => {
  p.r(4, 16, 8, 7, '#6a3a2a'); p.h(3, 16, 10, '#8a4e36'); p.h(4, 22, 8, '#3a1e14');
  const leaf = ['#1e2e1c', '#2a3e24', '#394a2a', '#4a4630'];
  p.ellipse(8, 9, 6, 7, leaf[0]);
  p.ellipse(6, 8, 3, 4, leaf[1]); p.ellipse(10, 6, 3, 4, leaf[1]); p.ellipse(9, 12, 3, 3, leaf[2]);
  p.p(4, 13, leaf[3]); p.p(12, 11, leaf[3]); p.p(5, 3, leaf[3]);
});

def('vase', 16, 20, (p) => {
  p.ellipse(8, 12, 5, 6, '#3a4a5a'); p.r(6, 3, 4, 4, '#3a4a5a'); p.h(5, 3, 6, '#5a6a7a');
  p.v(5, 9, 5, '#5a6a7a'); p.h(5, 12, 7, '#c0a050');
  p.v(7, 0, 4, '#3a2a1a'); p.v(9, 1, 3, '#3a2a1a'); p.p(6, 0, '#4a1a1a');
});

def('rug_red', 48, 32, (p) => {
  p.r(0, 0, 48, 32, '#5a1418'); p.r(2, 2, 44, 28, '#a07a3a'); p.r(3, 3, 42, 26, '#4a1014');
  for (let x = 6; x < 44; x += 6) for (let y = 6; y < 28; y += 6) { p.p(x, y, '#8a5a2a'); p.p(x + 1, y + 1, '#6a2a1e'); }
  p.ellipse(24, 16, 8, 5, '#6a1a1c'); p.ellipse(24, 16, 4, 2, '#a07a3a');
}, true);
def('rug_round', 48, 32, (p) => {
  p.ellipse(24, 16, 23, 15, '#5a4a5a'); p.ellipse(24, 16, 20, 12, '#7a6a6a'); p.ellipse(24, 16, 14, 8, '#6a5a6a');
  p.ellipse(24, 16, 6, 3, '#8a7a6a');
}, true);
def('rug_big', 80, 64, (p) => {
  p.r(0, 0, 80, 64, '#3a0e12'); p.r(2, 2, 76, 60, '#8a6a30'); p.r(4, 4, 72, 56, '#4a1216');
  p.r(8, 8, 64, 48, '#561a1c');
  for (let x = 10; x < 70; x += 8) { p.p(x, 6, '#a07a3a'); p.p(x, 57, '#a07a3a'); }
  p.ellipse(40, 32, 18, 12, '#6a2224'); p.ellipse(40, 32, 12, 8, '#4a1216'); p.ellipse(40, 32, 5, 3, '#a07a3a');
  p.speckle(4, 4, 72, 56, ['#2a0a0c'], 0.03, 3);
}, true);
def('doormat', 32, 16, (p) => {
  p.r(1, 2, 30, 12, '#3a2e22'); p.r(3, 4, 26, 8, '#4a3c2c');
  for (let x = 4; x < 28; x += 3) p.v(x, 4, 8, '#3a2e22');
}, true);

// ---------- child room ----------
def('toybox', 16, 16, (p) => {
  p.r(1, 6, 14, 10, '#7a4a3a'); p.h(1, 6, 14, '#9a6a4a'); p.h(1, 15, 14, '#3a2018');
  p.r(1, 10, 14, 1, '#c0a050');
  p.r(3, 2, 4, 5, '#a08870'); p.p(4, 3, '#100808'); p.p(5, 3, '#100808'); // doll head
  p.r(9, 3, 4, 3, '#4a6a9a');
});
def('small_desk', 16, 16, (p) => {
  p.r(1, 3, 14, 7, '#8a7a5a'); p.h(1, 3, 14, '#a8987a');
  p.v(2, 10, 6, '#5a4a3a'); p.v(13, 10, 6, '#5a4a3a');
  p.r(4, 4, 8, 5, '#2a3a6a'); p.r(8, 4, 1, 5, '#c0c0c0'); p.p(6, 6, '#d0a040'); p.p(10, 6, '#d0d0d0');
});
def('rocking_horse', 16, 16, (p) => {
  p.r(3, 13, 11, 2, '#5a3a22'); p.p(2, 12, '#5a3a22'); p.p(14, 12, '#5a3a22');
  p.r(4, 6, 8, 5, '#a08a70'); p.r(10, 2, 4, 5, '#a08a70'); p.p(13, 3, '#100808');
  p.v(5, 11, 2, '#5a4a3a'); p.v(10, 11, 2, '#5a4a3a'); p.r(9, 2, 2, 4, '#3a2418');
});
def('blocks', 16, 16, (p) => {
  p.r(2, 4, 4, 4, '#7a2a2a'); p.r(9, 2, 4, 4, '#2a4a7a'); p.r(6, 10, 4, 4, '#7a7a2a');
  p.p(3, 5, '#c0c0c0'); p.p(10, 3, '#c0c0c0'); p.p(7, 11, '#c0c0c0');
});
def('closet_child', 32, 40, (p) => {
  p.r(0, 0, 32, 4, '#4a5258'); p.h(0, 0, 32, '#7a868c');
  p.r(1, 4, 30, 36, '#6a7a80');
  p.v(15, 4, 36, '#20282c'); p.v(16, 4, 36, '#20282c');
  for (const x of [3, 18]) {
    p.r(x, 7, 11, 28, '#7a8a90'); p.h(x, 7, 11, '#9aa8ae'); p.h(x, 34, 11, '#4a5258');
    for (let y = 10; y < 32; y += 3) p.h(x + 2, y, 7, '#5a6a70');
  }
  p.r(13, 20, 1, 3, '#d0c080'); p.r(18, 20, 1, 3, '#d0c080');
  p.h(1, 39, 30, '#20282c');
  p.speckle(1, 4, 30, 36, ['#4a5258'], 0.04, 9);
});

// ---------- bathroom ----------
const tub = (p: P, full: boolean) => {
  p.r(1, 2, 46, 26, '#c8c8c0'); p.h(2, 2, 44, '#e8e8e0');
  p.r(1, 26, 46, 2, '#8a8a84');
  p.r(4, 5, 40, 19, full ? '#0a0c0a' : '#6e6a60');
  if (full) {
    p.r(5, 6, 38, 17, '#141814');
    p.h(8, 9, 10, '#26302a'); p.h(24, 14, 8, '#26302a'); p.p(30, 18, '#a0a890');
    p.p(31, 18, '#506050');
  } else {
    p.speckle(5, 6, 38, 17, ['#4a4438', '#5a5244', '#3a2e26'], 0.15, 3);
    p.ellipse(39, 15, 2, 2, '#1a1a1a');
    p.r(30, 19, 6, 2, '#3a1a14');
  }
  p.r(42, 4, 3, 3, MET.l); p.p(43, 3, MET.h);
  p.r(2, 28, 3, 3, BR.l); p.r(43, 28, 3, 3, BR.l);
};
def('bathtub_full', 48, 32, (p) => tub(p, true));
def('bathtub_empty', 48, 32, (p) => tub(p, false));
def('sink', 16, 24, (p) => {
  p.r(5, 12, 6, 12, '#b8b8b0'); p.v(5, 12, 12, '#d8d8d0');
  p.ellipse(8, 8, 7, 5, '#c8c8c0'); p.ellipse(8, 8, 5, 3, '#6a6e6a'); p.p(8, 8, '#1a1a1a');
  p.r(7, 2, 2, 3, MET.l); p.p(7, 2, MET.h);
  p.speckle(3, 5, 10, 6, ['#6a3a2a'], 0.08, 4);
});
def('mirror', 16, 16, (p) => {
  p.r(2, 0, 12, 16, '#5a5040'); p.r(3, 1, 10, 14, '#3a4652');
  p.r(4, 2, 4, 3, '#6a7a8a'); p.p(9, 4, '#7a8a9a');
  // crack
  p.p(10, 6, '#d0d8e0'); p.p(9, 7, '#d0d8e0'); p.p(8, 8, '#d0d8e0'); p.p(9, 9, '#d0d8e0'); p.p(7, 10, '#d0d8e0'); p.p(11, 7, '#9aa8b0');
});
def('mirror_msg', 16, 16, (p) => {
  p.r(2, 0, 12, 16, '#5a5040'); p.r(3, 1, 10, 14, '#3a4652');
  p.p(10, 6, '#d0d8e0'); p.p(9, 7, '#d0d8e0'); p.p(8, 8, '#d0d8e0');
  // smeared red letters
  p.r(4, 4, 1, 4, '#8a1010'); p.r(5, 6, 2, 1, '#8a1010'); p.r(8, 4, 1, 5, '#8a1010'); p.r(10, 5, 2, 1, '#8a1010'); p.r(11, 4, 1, 4, '#8a1010');
  p.v(4, 8, 4, '#6a0808'); p.v(11, 8, 3, '#6a0808');
});
def('toilet', 16, 22, (p) => {
  p.r(3, 0, 10, 7, '#c0c0b8'); p.h(3, 0, 10, '#e0e0d8'); p.r(5, 2, 2, 1, MET.l);
  p.ellipse(8, 13, 6, 6, '#c8c8c0'); p.ellipse(8, 13, 4, 4, '#4a4e48'); p.ellipse(8, 14, 2, 2, '#1a1e1a');
  p.r(5, 18, 6, 4, '#a8a8a0');
});
def('bathmat', 32, 16, (p) => {
  p.r(1, 2, 30, 12, '#3a5a5a'); p.r(3, 4, 26, 8, '#4a6a6a'); p.speckle(3, 4, 26, 8, ['#2a4040'], 0.15, 2);
}, true);
def('towel_rack', 16, 24, (p) => {
  p.v(3, 2, 22, MET.m); p.v(12, 2, 22, MET.m); p.h(3, 4, 10, MET.l);
  p.r(4, 5, 8, 10, '#8a8270'); p.h(4, 5, 8, '#aaa290'); p.speckle(4, 6, 8, 9, ['#6a3a2a'], 0.1, 6);
});

// ---------- kitchen ----------
const counterTop = (p: P) => { p.r(0, 0, 16, 7, '#8a8678'); p.h(0, 0, 16, '#aaa696'); p.h(0, 6, 16, '#5a564c'); p.speckle(0, 1, 16, 5, ['#7a766a'], 0.15, 3); };
def('counter', 16, 24, (p) => { counterTop(p); woodFront(p, 0, 7, 16, 17); p.r(2, 9, 12, 13, shade(W.m, 0.06)); p.p(12, 15, BR.h); });
def('counter_drawer', 16, 24, (p) => {
  counterTop(p); woodFront(p, 0, 7, 16, 17);
  p.r(2, 9, 12, 4, W.d); p.r(7, 10, 2, 2, BR.h); p.r(2, 15, 12, 7, shade(W.m, 0.06));
});
def('stove', 16, 24, (p) => {
  p.r(0, 0, 16, 24, '#1e1e22'); p.h(0, 0, 16, '#3a3a40');
  p.ellipse(4.5, 4, 3, 2, '#0a0a0c'); p.ellipse(11.5, 4, 3, 2, '#0a0a0c');
  p.r(2, 10, 12, 10, '#2a2a30'); p.h(2, 10, 12, '#4a4a52'); p.r(5, 12, 6, 1, MET.l);
  p.speckle(0, 0, 16, 24, ['#4a2a1a'], 0.05, 3);
});
def('kitchen_sink', 16, 24, (p) => {
  counterTop(p); p.r(2, 1, 12, 5, '#4a4e50'); p.r(3, 2, 10, 3, '#2a2e30'); p.r(7, 0, 2, 2, MET.h);
  woodFront(p, 0, 7, 16, 17); p.v(8, 8, 15, W.d); p.p(6, 15, BR.h); p.p(10, 15, BR.h);
});
def('fridge', 16, 32, (p) => {
  p.r(0, 0, 16, 32, '#b0a890'); p.h(0, 0, 16, '#d0c8b0'); p.v(0, 0, 32, '#c8c0a8');
  p.h(1, 11, 14, '#6a6450'); p.r(12, 4, 2, 5, MET.l); p.r(12, 14, 2, 8, MET.l);
  p.speckle(0, 0, 16, 32, ['#7a6a4a', '#8a7a5a'], 0.05, 8);
  p.h(0, 31, 16, '#4a4436');
});
def('cupboard', 32, 36, (p) => {
  p.r(0, 0, 32, 3, W.d); p.h(0, 0, 32, W.h);
  p.r(1, 3, 30, 33, '#5a4630');
  p.v(15, 3, 33, W.x); p.v(16, 3, 33, W.x);
  for (const x of [3, 18]) { for (let y = 6; y < 34; y += 3) p.h(x, y, 11, '#4a3a26'); p.v(x, 5, 30, '#6e5a40'); }
  p.r(13, 18, 1, 3, BR.h); p.r(18, 18, 1, 3, BR.h);
});
def('ktable', 32, 32, (p) => {
  p.r(1, 3, 30, 20, W.l); p.h(1, 3, 30, W.h);
  p.r(3, 4, 26, 17, '#c8c0b0'); for (let x = 3; x < 29; x += 4) p.v(x, 4, 17, '#b0a898');
  p.ellipse(10, 10, 3, 2, '#e0e0e0'); p.ellipse(22, 14, 3, 2, '#e0e0e0'); p.p(22, 14, '#5a1a1a'); p.p(10, 10, '#3a3a2a');
  p.r(15, 7, 2, 4, '#5a4a7a');
  p.r(1, 23, 30, 3, W.d); p.v(2, 26, 6, W.d); p.v(29, 26, 6, W.d);
});
def('crate', 16, 18, (p) => {
  p.r(1, 2, 14, 16, '#5a4430'); p.h(1, 2, 14, '#7a6040'); p.r(1, 2, 14, 2, '#6a5236');
  p.h(1, 9, 14, '#3a2c1e'); p.v(1, 2, 16, '#3a2c1e'); p.v(14, 2, 16, '#3a2c1e');
  for (let i = 0; i < 12; i++) p.p(2 + i, 4 + Math.floor(i * 0.5), '#4a3826');
  p.h(1, 17, 14, '#22180e');
});
def('barrel', 16, 20, (p) => {
  p.ellipse(8, 4, 6, 3, '#6a4a2c'); p.ellipse(8, 4, 4, 2, '#3a2818');
  p.r(2, 4, 12, 14, '#5a3e24'); p.v(2, 4, 14, '#7a5636');
  p.h(2, 7, 12, MET.d); p.h(2, 14, 12, MET.d);
  p.ellipse(8, 18, 6, 2, '#3a2818');
});

// ---------- library / study ----------
const BOOK = ['#5a1a1a', '#1a2a4a', '#2a3a1a', '#4a3a1a', '#3a1a3a', '#1a3a3a', '#6a5a3a', '#2a2a2a'];
function shelfRows(p: P, x: number, y: number, w: number, h: number, seed: number, rows: number) {
  const rowH = Math.floor(h / rows);
  for (let r = 0; r < rows; r++) {
    const yy = y + r * rowH;
    p.r(x, yy, w, rowH, '#120a06');
    let bx = x;
    let k = seed + r * 7;
    while (bx < x + w) {
      const bw = 1 + ((k * 7) % 3);
      const bh = rowH - 1 - ((k * 3) % 2);
      p.r(bx, yy + (rowH - bh), Math.min(bw, x + w - bx), bh, BOOK[k % BOOK.length]);
      p.p(bx, yy + rowH - bh, shade(BOOK[k % BOOK.length], 0.25));
      bx += bw; k = (k * 13 + 5) % 97;
    }
    p.h(x, yy + rowH - 1, w, W.l);
  }
}
def('bookshelf', 16, 36, (p) => {
  p.r(0, 0, 16, 36, W.d); p.h(0, 0, 16, W.h); p.r(0, 1, 16, 2, W.m);
  shelfRows(p, 2, 4, 12, 30, 3, 4);
  p.v(0, 0, 36, W.m); p.v(15, 0, 36, W.x); p.h(0, 35, 16, W.x);
});
def('shelf_mid', 16, 32, (p) => {
  p.r(0, 0, 16, 32, W.d); p.r(0, 0, 16, 5, W.m); p.h(0, 0, 16, W.h);
  shelfRows(p, 2, 6, 12, 24, 11, 3);
  p.v(15, 0, 32, W.x); p.h(0, 31, 16, W.x);
});
def('bookshelf_color', 32, 36, (p) => {
  p.r(0, 0, 32, 36, W.d); p.h(0, 0, 32, W.h); p.r(0, 1, 32, 2, W.m);
  shelfRows(p, 2, 4, 28, 9, 21, 1);
  // the special row
  p.r(2, 13, 28, 11, '#120a06');
  const cols = ['#a02020', '#2040a0', '#208030', '#c0a020', '#d8d8d0', '#181818'];
  cols.forEach((c, i) => { p.r(3 + i * 4 + (i > 2 ? 2 : 0), 14, 3, 10, c); p.v(3 + i * 4 + (i > 2 ? 2 : 0), 14, 10, shade(c, 0.3)); });
  p.h(2, 23, 28, W.l);
  shelfRows(p, 2, 24, 28, 10, 33, 1);
  p.v(31, 0, 36, W.x); p.h(0, 35, 32, W.x);
});
def('bookshelf_color_open', 32, 36, (p) => {
  OBJ_TEX['bookshelf_color'][2](p);
  p.r(10, 25, 12, 8, '#050302'); p.r(14, 28, 5, 2, BR.l); p.p(19, 28, BR.h);
});
def('desk', 32, 24, (p) => {
  p.r(0, 2, 32, 9, W.l); p.h(0, 2, 32, W.h);
  p.r(3, 3, 8, 6, '#d0c8b0'); p.r(4, 4, 6, 1, '#6a6050'); p.r(4, 6, 5, 1, '#6a6050');
  p.r(22, 4, 2, 4, '#e0d8c0'); p.p(22, 3, '#ffc060');
  p.r(14, 4, 5, 4, '#2a1a3a');
  woodFront(p, 0, 11, 32, 13);
  p.r(2, 13, 10, 9, W.d); p.r(20, 13, 10, 9, W.d); p.p(7, 17, BR.h); p.p(25, 17, BR.h);
});
def('cabinet', 16, 32, (p) => {
  p.r(0, 0, 16, 32, W.d); p.h(0, 0, 16, W.h);
  p.r(2, 3, 12, 27, W.m); p.v(8, 3, 27, W.x);
  p.r(3, 5, 4, 10, shade(W.m, 0.08)); p.r(9, 5, 4, 10, shade(W.m, 0.08));
  p.r(3, 18, 4, 10, shade(W.m, 0.08)); p.r(9, 18, 4, 10, shade(W.m, 0.08));
  p.p(7, 16, BR.h); p.p(9, 16, BR.h); p.h(0, 31, 16, W.x);
});
def('lectern', 16, 20, (p) => {
  p.r(2, 2, 12, 7, W.l); p.h(2, 2, 12, W.h);
  p.r(3, 3, 5, 5, '#d0c8b0'); p.r(8, 3, 5, 5, '#c8c0a8'); p.v(8, 3, 5, '#6a6050');
  p.h(4, 5, 3, '#5a5040'); p.h(9, 5, 3, '#5a5040');
  p.r(6, 9, 4, 9, W.d); p.r(4, 17, 8, 3, W.m);
});
def('clock', 16, 36, (p) => {
  p.r(2, 0, 12, 36, W.d); p.r(1, 0, 14, 4, W.m); p.h(1, 0, 14, W.h);
  p.ellipse(8, 9, 5, 5, '#c8c0a0'); p.ellipse(8, 9, 4, 4, '#d8d0b0');
  p.v(8, 6, 3, '#101010'); p.h(8, 9, 3, '#101010'); p.p(8, 9, '#801010');
  p.r(4, 16, 8, 14, '#0a0806'); p.v(8, 17, 9, BR.d); p.ellipse(8, 26, 2, 2, BR.l);
  p.r(1, 32, 14, 4, W.m); p.h(1, 35, 14, W.x);
});
const fireFrame = (n: number) => (p: P) => {
  p.r(0, 0, 32, 32, '#3a3632'); p.h(0, 0, 32, '#5a5650'); p.r(0, 2, 32, 3, '#4a4642');
  p.speckle(0, 0, 32, 32, ['#2a2622', '#4a463e'], 0.08, 2);
  p.r(5, 9, 22, 23, '#0a0604');
  p.r(5, 9, 22, 2, '#1a1410');
  const R = [[8, 6], [13, 9], [18, 7], [23, 5]];
  R.forEach(([x, h], i) => {
    const hh = h + ((n + i) % 3) - 1;
    p.r(x - 1, 30 - hh, 3, hh, '#a03010');
    p.r(x, 30 - hh + 2, 1, hh - 2, '#e07020');
    if ((n + i) % 2) p.p(x, 30 - hh - 1, '#ffb040');
  });
  p.r(7, 29, 18, 2, '#3a1a0c'); p.r(9, 28, 14, 1, '#ff9030');
  p.r(1, 5, 4, 27, '#4a4642'); p.r(27, 5, 4, 27, '#4a4642');
};
for (let i = 0; i < 3; i++) def(`fireplace_${i}`, 32, 32, fireFrame(i));
def('fireplace', 32, 32, fireFrame(0));
def('sofa', 48, 24, (p) => {
  p.r(1, 2, 46, 12, '#5a1820'); p.h(1, 2, 46, '#7a2a30');
  for (const x of [3, 18, 33]) { p.r(x, 4, 13, 8, '#6a2028'); p.h(x, 4, 13, '#8a3038'); }
  p.r(0, 12, 48, 10, '#4a1218'); p.h(0, 12, 48, '#6a2028');
  p.r(0, 2, 3, 20, '#4a1218'); p.r(45, 2, 3, 20, '#4a1218');
  p.h(0, 21, 48, '#200608'); p.v(2, 22, 2, W.d); p.v(45, 22, 2, W.d);
});
def('coffee_table', 32, 16, (p) => {
  p.r(1, 2, 30, 8, W.l); p.h(1, 2, 30, W.h); p.r(1, 10, 30, 2, W.d);
  p.v(2, 12, 4, W.d); p.v(29, 12, 4, W.d);
  p.ellipse(9, 6, 3, 2, '#d8d8d0'); p.p(9, 6, '#3a2a1a'); p.r(18, 4, 7, 4, '#c0b090');
});
def('armchair', 16, 20, (p) => {
  p.r(1, 1, 14, 9, '#3a2440'); p.h(1, 1, 14, '#5a3a60');
  p.r(1, 9, 14, 7, '#4a2e50'); p.r(0, 6, 3, 10, '#3a2440'); p.r(13, 6, 3, 10, '#3a2440');
  p.h(0, 15, 16, '#1a1020'); p.v(2, 16, 3, W.d); p.v(13, 16, 3, W.d);
});
def('long_table', 160, 32, (p) => {
  p.r(0, 2, 160, 24, W.d);
  p.r(1, 3, 158, 21, '#c8c2b4'); p.h(1, 3, 158, '#e0dacc');
  for (let x = 6; x < 156; x += 12) p.v(x, 3, 21, '#b8b2a4');
  p.speckle(1, 4, 158, 19, ['#6a2a24', '#5a4a3a'], 0.012, 5);
  for (const x of [16, 48, 64, 96, 112, 144]) {
    p.ellipse(x, 8, 4, 2.5, '#e8e8e0'); p.ellipse(x, 8, 2, 1, '#a8a8a0');
    p.ellipse(x, 18, 4, 2.5, '#e8e8e0'); p.ellipse(x, 18, 2, 1, '#a8a8a0');
  }
  p.ellipse(64, 18, 2, 1, '#5a1010');
  p.r(76, 10, 8, 6, BR.d); p.r(79, 6, 2, 6, BR.l);
  for (const x of [74, 79, 85]) { p.r(x, 4, 2, 6, '#e8e0c8'); p.p(x, 3, '#ffc060'); p.p(x + 1, 2, '#ff9030'); }
  p.r(0, 24, 160, 4, '#a8a294'); for (let x = 2; x < 158; x += 4) p.p(x, 27, '#8a8476');
  p.r(2, 28, 3, 4, W.d); p.r(155, 28, 3, 4, W.d);
});
def('china_cabinet', 32, 36, (p) => {
  p.r(0, 0, 32, 36, W.d); p.h(0, 0, 32, W.h);
  p.r(2, 3, 28, 18, '#141a20'); p.v(16, 3, 18, W.d);
  for (const y of [9, 15]) p.h(2, y, 28, W.m);
  for (const [x, y] of [[5, 6], [10, 6], [21, 6], [26, 6], [7, 12], [24, 12], [12, 18], [20, 18]]) { p.ellipse(x, y, 2, 2, '#c8c8c0'); }
  p.p(5, 5, '#8a9aaa'); p.p(21, 5, '#8a9aaa');
  woodFront(p, 2, 22, 28, 12); p.v(16, 22, 12, W.x); p.p(14, 27, BR.h); p.p(18, 27, BR.h);
});
def('globe', 16, 20, (p) => {
  p.ellipse(8, 7, 6, 6, '#2a4a5a'); p.ellipse(6, 5, 2, 2, '#5a6a3a'); p.r(9, 8, 3, 2, '#5a6a3a');
  p.ellipse(8, 7, 7, 7, 'rgba(0,0,0,0)');
  for (let a = 0; a < 20; a++) { const t = (a / 20) * Math.PI; p.p(Math.round(8 + Math.cos(t) * 7), Math.round(7 - Math.sin(t) * 7), BR.l); }
  p.v(8, 14, 4, W.d); p.r(4, 18, 8, 2, W.m);
});
def('memo_wall', 16, 16, (p) => {
  p.r(4, 3, 8, 10, '#c8c0a0'); p.h(4, 3, 8, '#e0d8b8');
  for (let y = 5; y < 12; y += 2) p.h(5, y, 6, '#5a5040');
  p.p(8, 2, '#a02020'); p.p(8, 3, '#c03030');
  p.r(10, 11, 2, 2, '#a89e80');
});
def('save_desk', 16, 20, (p) => {
  p.ellipse(8, 7, 7, 4, W.l); p.ellipse(8, 6, 6, 3, W.h);
  p.r(4, 5, 5, 3, '#2a1a3a'); p.r(6, 5, 1, 3, '#c0b090'); p.r(4, 5, 2, 2, '#e8e0c8');
  p.r(10, 1, 2, 5, '#e8e0c8'); p.p(10, 0, '#ffd070'); p.p(11, 0, '#ff9030');
  p.v(8, 11, 7, W.d); p.r(5, 17, 6, 2, W.m);
});

// ---------- hall ----------
def('front_door', 32, 16, (p) => {
  p.r(0, 0, 32, 16, '#0e0a0a');
  p.r(2, 2, 28, 12, W.m); p.v(16, 2, 12, W.x);
  for (const x of [4, 18]) { p.r(x, 4, 10, 8, shade(W.m, 0.08)); p.h(x, 4, 10, W.h); }
  p.r(13, 7, 2, 3, BR.h); p.r(17, 7, 2, 3, BR.h);
  // planks nailed across from outside, seen through the gap
  p.h(0, 0, 32, '#2a2228'); p.h(0, 15, 32, '#2a2228');
});
def('coat_closet', 32, 40, (p) => {
  OBJ_TEX['wardrobe'][2](p);
  p.r(2, 2, 3, 2, BR.l); p.r(27, 2, 3, 2, BR.l);
});
def('broken_stairs', 48, 32, (p) => {
  for (let i = 0; i < 6; i++) {
    const y = i * 5;
    p.r(4, y, 40, 5, shade('#4a2e1c', -i * 0.05)); p.h(4, y, 40, '#6a4426');
  }
  p.r(0, 0, 4, 32, W.d); p.r(44, 0, 4, 32, W.d); p.h(0, 0, 4, W.h); p.h(44, 0, 4, W.h);
  p.r(12, 4, 18, 12, '#0a0606');
  p.r(10, 18, 6, 3, '#5a3a22'); p.r(28, 20, 8, 2, '#5a3a22'); p.r(18, 24, 4, 4, '#3a3a3e'); p.r(32, 14, 5, 3, '#3a3a3e');
  p.speckle(4, 16, 40, 16, ['#2a2622', '#4a463e'], 0.12, 8);
});
def('armor', 16, 32, (p) => {
  p.r(5, 1, 6, 7, MET.m); p.h(5, 1, 6, MET.h); p.h(6, 4, 4, '#0a0a0c'); p.p(8, 0, '#8a1a1a');
  p.r(4, 8, 8, 9, MET.m); p.v(4, 8, 9, MET.l); p.h(4, 8, 8, MET.h);
  p.r(2, 9, 2, 8, MET.d); p.r(12, 9, 2, 8, MET.d);
  p.r(5, 17, 2, 11, MET.d); p.r(9, 17, 2, 11, MET.d); p.v(5, 17, 11, MET.l);
  p.v(14, 0, 30, '#4a3a2a'); p.r(13, 0, 3, 4, MET.l);
  p.r(3, 28, 10, 3, '#2a2a2e');
});

// ---------- stairwell / basement ----------
def('stairs_down', 48, 32, (p) => {
  for (let i = 0; i < 8; i++) {
    const y = i * 4;
    const c = shade('#4a3a2c', -0.12 * i);
    p.r(3, y, 42, 4, c); p.h(3, y, 42, shade(c, 0.15));
  }
  p.r(0, 0, 3, 32, W.d); p.r(45, 0, 3, 32, W.d); p.v(1, 0, 32, W.h); p.v(46, 0, 32, W.h);
  p.r(3, 24, 42, 8, 'rgba(0,0,0,0.6)');
}, true);
const stairsUp = (w: number) => (p: P) => {
  const n = 12;
  for (let i = 0; i < n; i++) {
    const y = i * 4;
    const c = shade('#4a4642', -0.07 * (n - i));
    p.r(3, y, w - 6, 4, c); p.h(3, y + 3, w - 6, shade(c, -0.3)); p.h(3, y, w - 6, shade(c, 0.1));
  }
  p.r(0, 0, 3, 48, '#2a2622'); p.r(w - 3, 0, 3, 48, '#2a2622');
  p.r(3, 0, w - 6, 10, 'rgba(0,0,0,0.65)');
};
def('stairs_up', 48, 48, stairsUp(48), true);
def('stairs_up2', 32, 48, stairsUp(32), true);
def('pillar', 16, 32, (p) => {
  p.r(1, 0, 14, 4, '#5a5a60'); p.h(1, 0, 14, '#7a7a80');
  p.r(3, 4, 10, 24, '#46464c'); p.v(3, 4, 24, '#5e5e64'); p.v(12, 4, 24, '#2e2e34');
  p.speckle(3, 4, 10, 24, ['#3a3a40', '#2a3a2a'], 0.08, 7);
  p.r(1, 28, 14, 4, '#3a3a40'); p.h(1, 28, 14, '#5a5a60'); p.h(1, 31, 14, '#1a1a1e');
});
def('breaker', 16, 16, (p) => {
  p.r(2, 1, 12, 14, MET.d); p.r(3, 2, 10, 12, MET.m); p.h(3, 2, 10, MET.l);
  for (let i = 0; i < 5; i++) p.r(4 + i * 2, 6, 1, 4, i % 2 ? '#a02020' : '#202020');
  p.r(5, 3, 6, 2, '#c0a020'); p.p(7, 3, '#1a1a1a');
  p.v(14, 4, 12, '#1a1a1a');
});
def('breaker_on', 16, 16, (p) => {
  p.r(2, 1, 12, 14, MET.d); p.r(3, 2, 10, 12, MET.m); p.h(3, 2, 10, MET.l);
  for (let i = 0; i < 5; i++) { p.r(4 + i * 2, 6, 1, 4, '#30a040'); p.p(4 + i * 2, 5, '#80ff90'); }
  p.r(5, 3, 6, 2, '#c0a020');
  p.v(14, 4, 12, '#1a1a1a');
});
def('locker', 16, 32, (p) => {
  p.r(1, 0, 14, 32, '#3a4a46'); p.h(1, 0, 14, '#5a6a66'); p.v(1, 0, 32, '#4a5a56');
  for (let y = 4; y < 10; y += 2) p.h(4, y, 8, '#1e2a28');
  p.r(11, 14, 2, 4, MET.l);
  p.speckle(1, 0, 14, 32, ['#5a3a2a', '#4a2e22'], 0.06, 3);
  p.h(1, 31, 14, '#141c1a');
});
def('puddle', 32, 16, (p) => {
  p.ellipse(16, 8, 14, 5, '#141a20'); p.ellipse(13, 7, 6, 2, '#1e2830'); p.p(20, 6, '#5a6a80'); p.p(8, 9, '#3a4a5a');
}, true);
def('water', 32, 16, (p) => {
  p.r(0, 2, 32, 12, '#0e161a'); p.h(3, 6, 8, '#2a3a44'); p.h(18, 9, 10, '#2a3a44'); p.p(12, 4, '#6a7a88');
}, true);
def('chains', 16, 16, (p) => {
  for (const x of [4, 11]) {
    for (let y = 0; y < 12; y += 2) { p.p(x, y, MET.l); p.p(x + 1, y + 1, MET.m); }
    p.r(x - 1, 12, 4, 3, MET.d); p.r(x, 13, 2, 1, '#0a0a0a');
  }
});
def('cell_bed', 32, 16, (p) => {
  p.r(1, 3, 30, 10, '#6a5a3a'); p.speckle(1, 3, 30, 10, ['#8a7a4a', '#4a3e2a'], 0.25, 4);
  p.r(2, 4, 8, 4, '#8a8070');
});
def('bucket', 16, 16, (p) => {
  p.ellipse(8, 5, 5, 2, MET.m); p.ellipse(8, 5, 4, 1, '#1a1410');
  p.r(3, 5, 10, 8, MET.d); p.v(3, 5, 8, MET.l); p.h(4, 13, 8, '#1a1a1e');
  p.speckle(3, 6, 10, 7, ['#5a3a1a'], 0.12, 2);
});
def('grate', 16, 16, (p) => {
  p.r(2, 2, 12, 12, '#1a1a1e'); for (let x = 3; x < 14; x += 2) p.v(x, 3, 10, MET.d);
  p.h(2, 2, 12, MET.m); p.h(2, 13, 12, MET.m);
}, true);
def('ladder', 16, 32, (p) => {
  p.r(2, 0, 12, 32, '#0c0e10');
  p.r(4, 0, 8, 6, '#3a4a5a');
  p.v(3, 0, 32, MET.m); p.v(12, 0, 32, MET.m);
  for (let y = 2; y < 32; y += 4) p.h(3, y, 10, MET.l);
});
def('altar', 32, 24, (p) => {
  p.r(1, 4, 30, 18, '#3a3436'); p.h(1, 4, 30, '#5a5456');
  p.r(1, 8, 30, 10, '#3a0c10'); p.h(1, 8, 30, '#5a1418');
  for (let x = 3; x < 30; x += 4) p.v(x, 9, 9, '#2a080a');
  p.r(1, 22, 30, 2, '#1a1618');
  // key
  p.r(12, 5, 7, 2, '#8a6a3a'); p.ellipse(20, 6, 2, 2, '#a07a40'); p.p(20, 6, '#2a1a10'); p.p(13, 7, '#8a6a3a'); p.p(15, 7, '#8a6a3a');
});
def('altar_empty', 32, 24, (p) => {
  p.r(1, 4, 30, 18, '#3a3436'); p.h(1, 4, 30, '#5a5456');
  p.r(1, 8, 30, 10, '#3a0c10'); p.h(1, 8, 30, '#5a1418');
  for (let x = 3; x < 30; x += 4) p.v(x, 9, 9, '#2a080a');
  p.r(1, 22, 30, 2, '#1a1618');
});
def('candle', 16, 16, (p) => {
  p.r(6, 6, 4, 9, '#d8d0b8'); p.v(6, 6, 9, '#f0e8d0'); p.p(8, 5, '#2a2a2a');
  p.p(8, 3, '#ffd070'); p.p(8, 4, '#ff9030'); p.p(7, 4, '#ffb050');
  p.ellipse(8, 15, 4, 1, '#8a7a5a');
});
def('cracked_wall', 32, 32, (p) => {
  p.r(0, 0, 32, 32, '#110d10');
  const pts = [[16, 0], [15, 4], [17, 8], [14, 12], [16, 16], [13, 20], [17, 24], [15, 28], [16, 32]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    for (let t = 0; t <= 4; t++) p.p(Math.round(ax + (bx - ax) * t / 4), Math.round(ay + (by - ay) * t / 4), '#4a3a36');
  }
  p.h(9, 12, 6, '#3a2e2a'); p.h(18, 20, 7, '#3a2e2a'); p.p(8, 13, '#3a2e2a'); p.p(25, 21, '#3a2e2a');
}, true);
def('rubble', 32, 32, (p) => {
  p.r(0, 0, 32, 32, '#2a2628');
  p.speckle(0, 0, 32, 32, ['#3a3438', '#1a1618', '#4a4246'], 0.35, 12);
  for (const [x, y, w, h] of [[3, 4, 5, 4], [20, 2, 6, 5], [10, 20, 7, 5], [24, 22, 5, 6]]) { p.r(x, y, w, h, '#3e383c'); p.h(x, y, w, '#5a5458'); }
}, true);

// ---------- misc icons ----------
def('icon_flashlight', 16, 16, (p) => { p.r(2, 6, 9, 4, '#3a3a40'); p.r(11, 5, 3, 6, '#6a6a72'); p.v(13, 6, 4, '#e0e0a0'); p.h(3, 6, 7, '#5a5a62'); });
def('icon_battery', 16, 16, (p) => { p.r(3, 5, 10, 6, '#c08020'); p.r(3, 5, 4, 6, '#2a2a2a'); p.r(13, 7, 1, 2, '#a0a0a0'); p.h(3, 5, 10, '#e0a040'); });
def('icon_hanger', 16, 16, (p) => { p.v(8, 2, 3, MET.l); p.p(9, 2, MET.l); for (let i = 0; i < 7; i++) { p.p(8 - i, 5 + i, MET.h); p.p(8 + i, 5 + i, MET.h); } p.h(1, 12, 15, MET.h); });
def('icon_key', 16, 16, (p) => { p.ellipse(4.5, 8, 3, 3, BR.l); p.p(4, 8, '#1a1408'); p.h(7, 8, 7, BR.l); p.v(12, 9, 2, BR.l); p.v(10, 9, 2, BR.l); p.h(7, 7, 7, BR.h); });
def('icon_key_big', 16, 16, (p) => { p.ellipse(4.5, 8, 4, 4, '#7a6a5a'); p.ellipse(4.5, 8, 2, 2, '#1a1410'); p.r(8, 7, 7, 3, '#7a6a5a'); p.r(12, 10, 2, 3, '#7a6a5a'); p.r(9, 10, 2, 2, '#7a6a5a'); p.h(8, 7, 7, '#9a8a7a'); });
def('icon_piece', 16, 16, (p) => { p.r(3, 3, 10, 10, '#2a2a20'); p.r(4, 4, 8, 8, '#cdb4a0'); p.p(6, 7, '#c02020'); p.p(9, 7, '#c02020'); p.h(6, 10, 4, '#3a1010'); p.p(3, 3, 'rgba(0,0,0,0)'); p.p(12, 12, 'rgba(0,0,0,0)'); });
def('icon_note', 16, 16, (p) => { p.r(3, 2, 10, 12, '#c8c0a0'); for (let y = 4; y < 13; y += 2) p.h(4, y, 8, '#5a5040'); });

// shadow under characters
def('shadow', 16, 6, (p) => { p.ellipse(8, 3, 7, 2.5, 'rgba(0,0,0,0.45)'); }, true);
def('shadow_big', 28, 8, (p) => { p.ellipse(14, 4, 13, 3.5, 'rgba(0,0,0,0.5)'); }, true);
def('glint', 12, 4, (p) => { p.r(1, 1, 2, 2, '#ff3030'); p.r(9, 1, 2, 2, '#ff3030'); p.p(1, 1, '#ffd0d0'); p.p(9, 1, '#ffd0d0'); }, true);
def('mark', 8, 8, (p) => { p.r(3, 0, 2, 5, '#f0e0a0'); p.r(3, 6, 2, 2, '#f0e0a0'); p.v(2, 0, 5, '#5a4a20'); });

def('portrait_torn', 32, 32, (p) => {
  frame(p, 32, 30);
  const cols = ['#2a3a30', '#cbb2a2', '#141010', '#a88e82', '#3a2a2a', '#1e2a24'];
  for (let i = 0; i < 9; i++) {
    const x = 3 + (i % 3) * 9, y = 3 + Math.floor(i / 3) * 8;
    if (i === 4) { p.r(x, y, 8, 7, '#050404'); continue; }
    p.r(x, y, 8, 7, cols[(i * 5) % cols.length]);
    p.p(x + (i % 4), y + 2, '#ece4d4');
    p.h(x, y + 6, 8, '#0a0808');
  }
  p.h(3, 10, 26, '#7a5a22'); p.v(11, 3, 24, '#7a5a22'); p.v(20, 3, 24, '#7a5a22');
});
def('portrait_open', 32, 32, (p) => {
  p.r(2, 0, 28, 32, '#050304');
  for (let i = 0; i < 6; i++) p.r(6, 18 + i * 2, 20, 2, shade('#3a3436', -0.12 * i));
  p.r(6, 4, 20, 14, '#020102');
  // the frame swung open to the left
  p.r(0, 0, 4, 32, BR.d); p.v(1, 0, 32, BR.l);
  p.r(28, 0, 4, 32, '#2a1a10');
});
