'use strict';
// bosses.js — giant boss monsters: how they look, what they are, and their signature attacks.
// Each boss is a normal creature with lots of health, a special attack (registered in SB.SPECIALS
// and run by the game loop) and a weakness (things tagged with one of def.weak hurt it a lot).
(function () {
  const D = SB.D, TAU = SB.TAU;
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // ---------- drawing helpers ----------
  // thick limb: a filled quad from (x0,y0) to (x1,y1), w wide
  D.slab = function (p, x0, y0, x1, y1, w) {
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d * w / 2, ny = dx / d * w / 2;
    p.poly([x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny], true);
  };
  // tapered tube along a quadratic curve (tentacles, necks, tails); returns the centre-line points
  D.tube = function (p, x0, y0, cx, cy, x1, y1, w0, w1, n, fill) {
    const L = [], R = [], mid = [];
    for (let i = 0; i <= n; i++) {
      const s = i / n, ms = 1 - s;
      const x = ms * ms * x0 + 2 * ms * s * cx + s * s * x1, y = ms * ms * y0 + 2 * ms * s * cy + s * s * y1;
      const dx = 2 * ms * (cx - x0) + 2 * s * (x1 - cx), dy = 2 * ms * (cy - y0) + 2 * s * (y1 - cy);
      const d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
      const w = (w0 + (w1 - w0) * s) * 0.5;
      L.push(x + nx * w, y + ny * w); R.unshift(x - nx * w, y - ny * w); mid.push([x, y]);
    }
    p.poly(L.concat(R), fill === undefined ? true : fill);
    return mid;
  };
  // n short shading strokes along the line (x0,y0)-(x1,y1), each pointing in direction ang
  D.hatch = function (p, x0, y0, x1, y1, n, len, ang) {
    const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;
    for (let k = 0; k < n; k++) { const s = (k + 0.5) / n; const x = x0 + (x1 - x0) * s, y = y0 + (y1 - y0) * s; p.line(x, y, x + dx, y + dy); }
  };
  // fur: short strokes sticking out of a polyline, swept back by tilt
  D.fur = function (p, pts, step, len, side, tilt) {
    for (let i = 2; i < pts.length; i += 2) {
      const x0 = pts[i - 2], y0 = pts[i - 1], x1 = pts[i], y1 = pts[i + 1];
      const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1;
      const tx = dx / d, ty = dy / d, nx = -ty * side, ny = tx * side;
      const ox = nx * Math.cos(tilt) + tx * Math.sin(tilt), oy = ny * Math.cos(tilt) + ty * Math.sin(tilt);
      const n = Math.max(1, Math.floor(d / step));
      for (let k = 0; k < n; k++) { const s = (k + 0.5) / n; const x = x0 + dx * s, y = y0 + dy * s; p.line(x, y, x + ox * len, y + oy * len); }
    }
  };
  // glowing crack: a heavy zigzag seam with little heat ticks
  D.crack = function (p, x0, y0, x1, y1, n) {
    const c = p.ctx;
    c.save(); c.lineWidth = 3; c.strokeStyle = '#ff7a1a'; p.zigzag(x0, y0, x1, y1, 3, n); c.strokeStyle = '#ffb347';
    for (let k = 0; k < n; k += 2) { const s = (k + 0.5) / n; const x = x0 + (x1 - x0) * s, y = y0 + (y1 - y0) * s; p.line(x - 3, y - 1, x - 6, y - 4); p.line(x + 3, y + 1, x + 6, y + 4); }
    c.restore();
  };

  // ---------- the kraken: a giant squid rearing up on its arms ----------
  D.kraken = function () { return { w: 170, h: 180, draw(p, e, t) { D.drawKraken(p, e, t); } }; };
  D.drawKraken = function (p, e, t) {
    p.use('body');
    const c = p.ctx, mood = e.mood, held = e.held;
    const angry = mood === 'angry' || e.mode === 'hunt';
    const wob = t * 2 + (e.moving && e.grounded ? e.phase : 0);
    const armBaseY = 16;
    const arm = (i, front) => {
      const k = i - 3.5, s = k / 3.5;
      const ph = wob + i * 0.8 + e.seed;
      const w1 = Math.sin(ph) * 6, w2 = Math.cos(ph * 0.8) * 5;
      const bx = s * 22, by = armBaseY;
      let cx, cy, tx, ty;
      if (held) { cx = s * 30 + w1; cy = 50; tx = s * 40 + w2; ty = 88; }
      else { cx = s * 52 + w1; cy = 46 + w2 * 0.4; tx = s * 74 + w2; ty = 86 - (1 - Math.abs(s)) * 4; }
      const pts = D.tube(p, bx, by, cx, cy, tx, ty, front ? 14 : 10, 3, 9, true);
      for (let j = 1; j < pts.length - 1; j++) { const r = 1.7 - j * 0.13; if (r > 0.6) { p.circle(pts[j][0] - 2, pts[j][1], r, false); if (j % 2) p.circle(pts[j][0] + 2, pts[j][1] + 1, r * 0.8, false); } }
      p.spiral(tx, ty, 4, 1, s < 0 ? Math.PI : 0);
    };
    const tentacle = side => {
      const ph = wob * 0.7 + side * 2 + e.seed;
      const w1 = Math.sin(ph) * 8;
      const bx = side * 8, by = armBaseY + 2;
      let cx, cy, tx, ty, ang;
      if (held) { cx = side * 20; cy = 60; tx = side * 26 + w1; ty = 96; ang = Math.PI / 2; }
      else if (e.whipT > 0 && side > 0) { const up = Math.sin(e.whipT / 0.5 * Math.PI); cx = 40 + up * 40; cy = 40 - up * 110; tx = 84 + up * 10; ty = 70 - up * 170; ang = -0.4 - up * 1.4; }
      else { cx = side * 40 + w1; cy = 70; tx = side * 84; ty = 30 + w1; ang = side > 0 ? -1.1 : Math.PI + 1.1; }
      D.tube(p, bx, by, cx, cy, tx, ty, 7, 4, 10, true);
      c.save(); c.translate(tx, ty); c.rotate(ang);
      p.ellipse(0, 0, 14, 5, true, 0);
      for (let j = -2; j <= 2; j++) p.circle(j * 5, 0, 1.4, false);
      c.restore();
    };
    for (let i = 0; i < 8; i += 2) arm(i, false);
    tentacle(-1);
    // mantle with fins
    p.use('fin'); p.poly([-26, -84, -58, -60, -30, -42], true); p.poly([26, -84, 58, -60, 30, -42], true);
    p.use('body'); p.poly([-30, -14, -34, -46, -26, -76, -10, -94, 10, -94, 26, -76, 34, -46, 30, -14], true);
    p.curve(-16, -74, -20, -50, -14, -20); p.curve(0, -88, 2, -60, 0, -20); p.curve(16, -74, 20, -50, 14, -20);
    for (let j = 0; j < 9; j++) p.dot(-22 + ((j * 37) % 44), -80 + ((j * 53) % 60), 0.9);
    D.hatch(p, -32, -44, -28, -18, 5, 5, 0.3);
    p.line(-30, -60, -50, -60); p.line(30, -60, 50, -60);
    // head, siphon, eyes, beak
    p.poly([-30, -14, 30, -14, 32, 8, 22, 20, -22, 20, -32, 8], true);
    p.poly([-30, -6, -44, -2, -44, 4, -30, 4], true);
    D.eye(p, -16, -2, 9.5, e, -1); D.eye(p, 16, -2, 9.5, e, 1);
    p.use('beak');
    if (angry || mood === 'scared') { p.poly([-8, 18, 8, 18, 0, 28], '#3b2416'); p.poly([-5, 24, 5, 24, 0, 32], '#fff'); }
    else { p.poly([-6, 18, 6, 18, 0, 26], true); }
    p.use('body');
    for (let i = 1; i < 8; i += 2) arm(i, true);
    tentacle(1);
  };

  // ---------- the mega robot: an armored battle mech ----------
  D.megaRobot = function () { return { w: 140, h: 210, draw(p, e, t) { D.drawMegaRobot(p, e, t); } }; };
  D.drawMegaRobot = function (p, e, t) {
    p.use('body');
    const c = p.ctx, mood = e.mood, held = e.held;
    const walking = e.moving && e.grounded && !held;
    const sw = walking ? Math.sin(e.phase) : 0;
    const inAir = !e.grounded && !held;
    const angry = mood === 'angry' || e.mode === 'hunt' || e.charge > 0 || e.laserT > 0;
    const joint = (x, y, r) => { p.circle(x, y, r, true); p.circle(x, y, r * 0.4, true); };
    const piston = (x0, y0, x1, y1) => { const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d; p.line(x0, y0, x1, y1); D.slab(p, x0 + ux * d * 0.15, y0 + uy * d * 0.15, x0 + ux * d * 0.6, y0 + uy * d * 0.6, 6); };
    const leg = (off, a) => {
      const hx = off, hy = 34;
      const kx = off + 6 + a * 10, ky = 66 - (inAir ? 6 : 0);
      const lift = walking ? Math.max(0, a) * 7 : held ? 8 : inAir ? 10 : 0;
      const ax = off + a * 16, ay = 96 - lift;
      D.slab(p, hx, hy, kx, ky, 20);
      piston(hx - 8, hy + 6, kx - 10, ky - 2);
      p.use('armor'); p.poly([kx - 12, ky - 2, kx + 12, ky - 2, ax + 9, ay - 4, ax - 9, ay - 4], true); p.use('body');
      p.line(kx - 4, ky + 8, ax - 3, ay - 8);
      joint(kx, ky, 7);
      p.poly([kx - 10, ky - 10, kx + 12, ky - 8, kx + 14, ky + 6, kx - 6, ky + 8], true);
      p.poly([ax - 16, ay - 4, ax + 12, ay - 4, ax + 24, ay + 4, ax + 26, ay + 10, ax - 18, ay + 10], true);
      p.line(ax + 4, ay - 2, ax + 8, ay + 10); p.line(ax + 14, ay + 2, ax + 17, ay + 10);
      joint(ax, ay, 4);
    };
    const arm = (front, a) => {
      const sx = front ? 44 : -44, sy = -50, f = front ? 1 : -1;
      let ex, ey, hx, hy;
      if (held) { ex = sx + f * 8; ey = sy - 34; hx = sx + f * 14 + Math.sin(t * 12) * 4; hy = sy - 68; }
      else if (front && angry && !inAir) { ex = sx + 16; ey = sy + 8; hx = sx + 46; hy = sy + 2; }
      else if (mood === 'dizzy') { ex = sx + f * 14; ey = sy + 34; hx = sx + f * 20; hy = sy + 66; }
      else { ex = sx + f * 12 + a * 6; ey = sy + 40; hx = sx + f * 10 + a * 16; hy = sy + 84; }
      D.slab(p, sx, sy, ex, ey, 16);
      piston(sx + f * 10, sy + 4, ex + f * 8, ey - 4);
      joint(sx, sy, 8);
      const dx = hx - ex, dy = hy - ey, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
      p.poly([ex + nx * 11, ey + ny * 11, hx + nx * 9, hy + ny * 9, hx - nx * 9, hy - ny * 9, ex - nx * 11, ey - ny * 11], true);
      p.line(ex + nx * 4 + dx * 0.2, ey + ny * 4 + dy * 0.2, hx + nx * 3 - dx * 0.1, hy + ny * 3 - dy * 0.1);
      joint(ex, ey, 6);
      c.save(); c.translate(hx, hy); c.rotate(Math.atan2(dy, dx));
      if (front) {
        p.rect(-2, -9, 20, 18, true); p.rect(18, -7, 16, 6, true); p.rect(18, 1, 16, 6, true); p.line(34, -7, 34, 7); p.line(6, -9, 6, 9);
        D.hatch(p, 0, 9, 18, 9, 4, 3, -Math.PI / 2);
        if (e.charge > 0 && Math.floor(t * 20) % 2) { p.circle(38, -4, 3, false); p.circle(38, 4, 3, false); }
      } else {
        p.rect(-3, -8, 12, 16, true);
        for (let k = -1; k <= 1; k++) { const y = k * 6; p.line(9, y, 18, y + k * 3); p.line(18, y + k * 3, 24, y + k * 6); p.circle(18, y + k * 3, 1.8, true); }
      }
      c.restore();
    };
    leg(-14, -sw); arm(false, -sw);
    p.poly([-22, 22, 22, 22, 26, 36, -26, 36], true); joint(-14, 34, 5); joint(14, 34, 5);
    for (let k = 0; k < 3; k++) p.poly([-20 + k * 2, 4 + k * 6, 20 - k * 2, 4 + k * 6, 20 - k * 2, 10 + k * 6, -20 + k * 2, 10 + k * 6], true);
    p.use('armor'); p.poly([-38, -60, 38, -60, 48, -34, 42, 0, 26, 8, -26, 8, -42, 0, -48, -34], true);
    p.line(-38, -60, -30, -20); p.line(38, -60, 30, -20);
    p.use('body'); p.poly([-16, -52, 16, -52, 20, -20, -20, -20], true);
    p.circle(0, -36, 9, true); p.circle(0, -36, 5, '#4cc9f0'); p.circle(0, -36, 1.5, '#fff');
    D.hatch(p, -34, -28, -34, -6, 4, 6, 0); D.hatch(p, 34, -28, 34, -6, 4, 6, Math.PI);
    p.dot(-40, -50, 1.4); p.dot(40, -50, 1.4); p.dot(-36, -8, 1.4); p.dot(36, -8, 1.4);
    p.use('armor'); p.poly([-64, -52, -52, -72, -30, -74, -28, -50, -40, -40, -62, -42], true); p.line(-58, -54, -36, -56);
    p.poly([64, -52, 52, -72, 30, -74, 28, -50, 40, -40, 62, -42], true); p.line(58, -54, 36, -56);
    p.use('body');
    p.rect(-60, -92, 24, 18, true); for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) p.circle(-53 + k * 10, -87 + j * 8, 2.6, false);
    leg(14, sw); arm(true, sw);
    p.poly([-16, -60, 16, -60, 12, -70, -12, -70], true);
    p.use('armor'); p.poly([-20, -70, -20, -96, -12, -104, 12, -104, 20, -96, 20, -70], true); p.use('body');
    p.line(-20, -78, 20, -78);
    p.rect(-16, -94, 32, 12, '#000');
    c.save(); c.strokeStyle = angry ? '#ff3b3b' : '#4cc9f0'; c.lineWidth = 2.6;
    const lx = e.lookX * 4, ly = e.lookY * 2;
    if (mood === 'dizzy') { p.line(-11 + lx, -91, -5 + lx, -85); p.line(-5 + lx, -91, -11 + lx, -85); p.line(5 + lx, -91, 11 + lx, -85); p.line(11 + lx, -91, 5 + lx, -85); }
    else if (mood === 'sleep') { p.line(-12, -88, -4, -88); p.line(4, -88, 12, -88); }
    else if (angry) { p.line(-12 + lx, -91 + ly, -3 + lx, -86 + ly); p.line(12 + lx, -91 + ly, 3 + lx, -86 + ly); }
    else { p.line(-12 + lx, -88 + ly, -3 + lx, -88 + ly); p.line(3 + lx, -88 + ly, 12 + lx, -88 + ly); }
    if (e.charge > 0 && Math.floor(t * 24) % 2) { p.line(-15, -88, -13, -88); p.line(13, -88, 15, -88); }
    c.restore();
    D.hatch(p, -12, -76, 12, -76, 5, 4, Math.PI / 2);
    p.poly([20, -100, 30, -96, 30, -88, 20, -90], true); p.poly([-20, -100, -30, -96, -30, -88, -20, -90], true);
    p.line(-8, -104, -8, -118); p.circle(-8, -121, 3, Math.floor(t * 4) % 2 ? '#000' : true);
    p.curve(-14, -70, -30, -60, -34, -44); p.curve(14, -70, 30, -60, 34, -44);
    if (e.laserT > 0) { c.save(); c.lineWidth = 5; p.line(20, -88, 64, -88); c.restore(); }
  };

  // ---------- king kong: a great ape standing tall ----------
  D.kong = function () { return { w: 170, h: 200, draw(p, e, t) { D.drawKong(p, e, t); } }; };
  D.drawKong = function (p, e, t) {
    p.use('body');
    const c = p.ctx, mood = e.mood, held = e.held;
    const walking = e.moving && e.grounded && !held;
    const inAir = !e.grounded && !held;
    const sw = walking ? Math.sin(e.phase) : 0;
    const angry = mood === 'angry' || e.mode === 'hunt';
    const beat = e.beatT > 0, pound = e.poundT > 0, swat = e.swatT > 0;
    const poundUp = pound && e.poundT > 0.25;
    const G = 100;
    // fist: knuckles down on the ground, or clenched in the air
    const fist = (hx, hy, onGround, f) => {
      p.use('skin');
      if (onGround) { p.poly([hx - 15, hy - 11, hx + 13, hy - 13, hx + 19, hy - 3, hx + 15, hy, hx - 14, hy, hx - 18, hy - 5], true); for (let k = -1; k <= 1; k++) p.arc(hx + k * 8 + 1, hy - 12 + (k === 0 ? -1 : 0), 4, Math.PI, TAU); p.line(hx - 14, hy - 5, hx + 13, hy - 6); }
      else { p.poly([hx - 13, hy - 10, hx + 11, hy - 13, hx + 16, hy + 1, hx + 9, hy + 11, hx - 10, hy + 10, hx - 16, hy + 2], true); for (let k = -1; k <= 1; k++) p.arc(hx + k * 7 + f * 2, hy - 11 + (k === 0 ? -1 : 0), 3.5, Math.PI, TAU); p.line(hx - 10, hy + 2, hx + 10, hy); }
    };
    // leg: thick, bent, wide stance, big flat foot
    const leg = (off, a, far) => {
      const hx = off, hy = 28;
      const kx = off + 12 + a * 10, ky = 66;
      const fx = off + 4 + a * 16, fy = G - (walking ? Math.max(0, a) * 6 : 0) - (inAir ? 10 : 0);
      D.slab(p, hx, hy, kx, ky, 30); D.slab(p, kx, ky, fx, fy - 6, 20);
      p.use('skin'); p.poly([fx - 13, fy - 9, fx + 14, fy - 9, fx + 24, fy - 3, fx + 22, fy, fx - 15, fy], true); p.use('body');
      p.line(fx + 8, fy - 3, fx + 8, fy); p.line(fx + 14, fy - 4, fx + 15, fy); p.line(fx + 19, fy - 4, fx + 20, fy);
      if (!far) { p.curve(hx - 6, hy + 14, kx - 6, ky - 6, kx + 4, ky + 6); D.fur(p, [hx - 15, hy + 4, kx - 12, ky - 2], 7, 6, 1, 0.5); }
    };
    // arm: long and heavy, knuckles reaching the ground at rest
    const arm = (front, a) => {
      const f = front ? 1 : -1;
      const sx = front ? 30 : -16, sy = front ? -48 : -54;
      let ex, ey, hx, hy;
      if (held) { ex = sx + f * 22; ey = sy - 36; hx = sx + f * 34 + Math.sin(t * 12) * 5; hy = sy - 78; }
      else if (poundUp) { ex = sx + f * 16; ey = sy - 42; hx = sx + f * 6; hy = sy - 86; }
      else if (pound) { ex = sx + f * 34; ey = sy + 46; hx = sx + f * 40; hy = 96; }
      else if (beat) { const k = Math.sin(t * 22) * f; ex = sx + f * 30; ey = sy + 20; hx = 18 + f * 12; hy = -26 + k * 8; }
      else if (swat && front) { ex = sx + 30; ey = sy - 36; hx = sx + 46; hy = sy - 80; }
      else if (mood === 'dizzy') { ex = sx + f * 26; ey = sy + 46; hx = sx + f * 30; hy = 90; }
      else if (angry && front && !walking) { ex = sx + 32; ey = sy - 30; hx = sx + 26; hy = sy - 76; }
      else { ex = sx + f * 24 + a * 14; ey = sy + 52; hx = sx + f * 30 + a * 22; hy = 88 - (inAir ? 20 : 0) - (walking ? Math.max(0, -a) * 8 : 0); }
      const onGround = hy > 80;
      D.slab(p, sx, sy, ex, ey, 32); D.slab(p, ex, ey, hx, hy - (onGround ? 9 : 0), 25);
      p.curve(sx + f * 6, sy + 16, (sx + ex) / 2 + f * 12, (sy + ey) / 2, ex - f * 2, ey - 8);   // bicep
      p.curve(ex + f * 8, ey + 8, (ex + hx) / 2 + f * 10, (ey + hy) / 2, hx + f * 5, hy - 16);   // forearm
      D.fur(p, [sx - f * 14, sy + 4, ex - f * 13, ey - 2], 7, 7, f, 0.5);
      fist(hx, hy, onGround, f); p.use('body');
    };
    leg(-12, -sw, true); leg(12, sw, false); arm(false, -sw);
    // torso: massive shoulders and a hump behind the neck, barrel chest, narrow hips
    p.poly([-24, 42, -34, 4, -32, -36, -22, -62, -2, -72, 24, -70, 44, -58, 52, -30, 50, 2, 42, 36], true);
    D.fur(p, [-2, -72, -22, -62, -32, -36, -34, 4, -24, 42], 7, 8, 1, 0.5);
    p.arc(16, -36, 14, Math.PI + 0.4, TAU - 0.4); p.arc(40, -30, 8, Math.PI + 0.4, TAU - 0.4);   // chest
    p.curve(0, 10, 24, 26, 46, 8); p.line(26, -16, 24, 22);                                        // belly / midline
    D.hatch(p, -26, -20, -20, 26, 5, 8, 0.5);                                                       // shading on the flank
    arm(true, sw);
    // head: set forward of the hump; sagittal crest, heavy brow, wide muzzle
    c.save(); c.translate(34, -74); c.scale(1.1, 1.1);
    p.use('body'); p.poly([-19, 5, -20, -10, -14, -26, -3, -32, 9, -26, 17, -12, 19, 2, 15, 15, 3, 22, -12, 19], true);
    D.fur(p, [-20, -10, -14, -26, -3, -32, 9, -26], 5, 5, 1, 0.5);
    p.use('gold'); p.poly([-9, -28, -7, -40, -2, -33, 1, -42, 5, -33, 9, -38, 8, -26], true);   // crown
    p.use('skin'); p.circle(-20, -3, 4.5, true); p.arc(-20, -3, 2.2, 0.2, Math.PI - 0.2);      // ear
    c.save(); c.lineWidth = 4; p.curve(-16, -12, 2, -21, 19, -10); c.restore();  // brow ridge
    D.eye(p, -7, -6, 3, e, -1); D.eye(p, 9, -6, 3, e, 1);
    p.use('skin'); p.poly([-12, 2, 16, 0, 24, 7, 20, 21, 4, 26, -10, 21, -15, 10], true);        // muzzle
    p.arc(4, 7, 2.6, Math.PI, TAU); p.arc(12, 7, 2.6, Math.PI, TAU); p.dot(4, 8, 1.2); p.dot(12, 8, 1.2);
    if (angry || beat || pound || mood === 'scared') { p.use('mouth'); p.poly([-8, 14, 19, 12, 16, 22, -5, 23], true); p.use('skin'); p.zigzag(-6, 14, 17, 12, 3.5, 6); p.zigzag(-4, 23, 15, 22, -3, 5); }
    else D.mouth(p, 5, 17, 12, e);
    c.restore();
  };

  // ---------- the hydra: a three-necked dragon ----------
  // mouth positions (template coords) and breath directions while breathing fire, used by the special
  D.hydraMouths = [[55, -81, -0.3], [87, -54, 0], [105, -16, 0.3]];
  D.hydra = function () { return { w: 210, h: 190, draw(p, e, t) { p.ctx.translate(-8, 0); D.drawHydra(p, e, t); } }; };
  D.drawHydra = function (p, e, t) {
    p.use('body');
    const c = p.ctx, mood = e.mood, held = e.held;
    const walking = e.moving && e.grounded && !held;
    const inAir = !e.grounded && !held;
    const sw = walking ? Math.sin(e.phase) : 0;
    const angry = mood === 'angry' || e.mode === 'hunt';
    const breathing = e.breath > 0;
    const G = 95;
    const wag = Math.sin(t * 1.6 + e.seed) * 5;
    D.tube(p, -62, 40, -104, 46 + wag, -98, -6 + wag * 2, 26, 5, 8, true);
    p.use('spike'); for (let k = 0; k < 5; k++) { const s = k / 5; const x = -66 - s * 36 + (s > 0.6 ? (s - 0.6) * 20 : 0), y = 30 - s * 10 - (s > 0.6 ? (s - 0.6) * 70 : 0) + wag * s; p.poly([x - 4, y + 2, x - 1, y - 9, x + 4, y + 2], true); } p.use('body');
    const claws = (fx, fy) => { p.poly([fx - 10, fy - 6, fx + 10, fy - 6, fx + 12, fy, fx - 12, fy], true); p.line(fx - 8, fy, fx - 10, fy + 4); p.line(fx, fy, fx, fy + 5); p.line(fx + 8, fy, fx + 10, fy + 4); };
    const hind = (off, a, far) => {
      const hx = -40 + off, hy = 30;
      const kx = hx - 14 + a * 6, ky = 60, ax = hx + 6 + a * 12, ay = 80, fx = ax + 10 + a * 6, fy = G - (walking ? Math.max(0, a) * 4 : 0) - (inAir ? 8 : 0);
      p.poly([hx - 16, hy - 10, hx + 18, hy - 4, hx + 14, hy + 26, kx + 8, ky + 4, kx - 8, ky - 2, hx - 20, hy + 16], true);
      D.slab(p, kx, ky, ax, ay, 12); D.slab(p, ax, ay, fx, fy - 4, 10);
      claws(fx, fy);
      if (!far) { p.curve(hx - 8, hy + 2, hx + 2, hy + 12, hx + 8, hy + 22); D.hatch(p, hx - 14, hy + 12, hx - 4, hy + 22, 3, 5, 0.2); }
    };
    const front = (off, a, far) => {
      const sx = 26 + off, sy = 10;
      const ex = sx + 4 + a * 8, ey = 50, fx = sx + 8 + a * 14, fy = G - (walking ? Math.max(0, a) * 4 : 0) - (inAir ? 8 : 0);
      D.slab(p, sx, sy, ex, ey, 20); D.slab(p, ex, ey, fx, fy - 4, 15);
      claws(fx, fy);
      if (!far) p.curve(sx - 4, sy + 10, ex - 2, ey - 14, ex + 4, ey - 2);
    };
    hind(8, -sw, true); front(8, sw, true);
    p.poly([-62, 46, -74, 20, -68, -6, -40, -18, -6, -24, 26, -26, 48, -14, 56, 12, 50, 44, 30, 62, -10, 66, -40, 62], true);
    for (let k = 0; k < 5; k++) { const x0 = -42 + k * 18; p.curve(x0, 60 - Math.abs(k - 2) * 2, x0 + 9, 66, x0 + 18, 60 - Math.abs(k - 1.5) * 2); }
    for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) { const x = -50 + k * 16 + (r % 2) * 8, y = 4 + r * 14; p.arc(x, y, 5, Math.PI + 0.3, TAU - 0.3); }
    const back = [-68, -6, -40, -18, -6, -24, 26, -26];
    p.use('spike');
    for (let k = 0; k < 6; k++) { const s = k / 5; const i = Math.min(2, Math.floor(s * 3)); const f = s * 3 - i; const x = back[i * 2] + (back[i * 2 + 2] - back[i * 2]) * f, y = back[i * 2 + 1] + (back[i * 2 + 3] - back[i * 2 + 1]) * f; p.poly([x - 5, y + 2, x - 1, y - 12 - (k === 2 || k === 3 ? 4 : 0), x + 5, y + 2], true); }
    p.use('body');
    hind(-8, sw, false); front(-6, -sw, false);
    const heads = [[22, -76], [54, -60], [76, -32]];
    const baseAng = [-0.45, -0.1, 0.3];
    for (let i = 0; i < 3; i++) {
      const sway = held ? Math.sin(t * 10 + i * 2) * 8 : Math.sin(t * 1.6 + i * 2.1 + e.seed) * 4;
      let hx = heads[i][0], hy = heads[i][1], ang = baseAng[i];
      if (breathing) { hx += 6; ang = D.hydraMouths[i][2]; } else { hx += sway * 0.4; hy += sway; }
      const bx = 22 + i * 8, by = -18 + i * 2;
      const cx = (bx + hx) * 0.5 + 16 - i * 4, cy = (by + hy) * 0.5 - 16 + i * 6;
      const pts = D.tube(p, bx, by, cx, cy, hx - Math.cos(ang) * 10, hy - Math.sin(ang) * 10, 22, 14, 8, true);
      p.use('spike'); for (let j = 1; j < pts.length - 1; j += 2) { const [x, y] = pts[j]; p.poly([x - 3, y - 6, x + 1, y - 14, x + 4, y - 5], true); } p.use('body');
      for (let j = 2; j < pts.length - 1; j += 2) { const [x, y] = pts[j]; p.line(x - 6, y + 6, x + 5, y + 7); }
      c.save(); c.translate(hx, hy); c.rotate(ang); c.scale(1.45, 1.45);
      p.poly([-13, -6, -6, -12, 4, -13, 14, -8, 22, -3, 24, 2, 16, 5, 4, 7, -8, 8, -14, 2], true);
      p.use('horn'); p.poly([-8, -11, -6, -22, 0, -11], true); p.poly([0, -12, 6, -21, 9, -10], true); p.use('body');
      p.line(-6, -6, 6, -8); p.curve(6, -2, 14, -4, 22, -1);
      p.dot(20, -1, 1.1);
      const jaw = angry || breathing || mood === 'scared' || mood === 'happy';
      if (jaw) { p.use('mouth'); p.poly([-10, 8, 4, 7, 16, 5, 24, 4, 20, 14, 6, 17, -8, 13], true); p.use('body'); p.zigzag(-6, 7, 22, 4, 3, 7); p.zigzag(-4, 13, 19, 13, -3, 6); }
      else p.zigzag(-10, 6, 22, 3, 2.2, 8);
      D.eye(p, 1, -4, 2.6, e, 1);
      if (breathing) D.flame(p, 28, 5, 8, t, e.seed + i);
      c.restore();
    }
  };

  // ---------- the lava golem: faceted stone plates with glowing seams ----------
  D.lavaGolem = function () { return { w: 150, h: 200, draw(p, e, t) { D.drawLavaGolem(p, e, t); } }; };
  D.drawLavaGolem = function (p, e, t) {
    p.use('body');
    const c = p.ctx, mood = e.mood, held = e.held;
    const walking = e.moving && e.grounded && !held;
    const inAir = !e.grounded && !held;
    const sw = walking ? Math.sin(e.phase) : 0;
    const angry = mood === 'angry' || e.mode === 'hunt';
    const throwing = e.throwT > 0, windup = e.throwT > 0.25;
    const glow = Math.floor(t * 6) % 2;
    const leg = (off, a) => {
      const fx = off + a * 12, lift = walking ? Math.max(0, a) * 6 : inAir ? 8 : 0;
      p.poly([off - 16, 44, off + 14, 40, off + 18 + a * 4, 70 - lift / 2, off - 12 + a * 4, 74 - lift / 2], true);
      p.poly([fx - 14, 68 - lift, fx + 14, 66 - lift, fx + 16, 92 - lift, fx - 16, 94 - lift], true);
      p.poly([fx - 22, 90 - lift, fx + 22, 88 - lift, fx + 26, 100 - lift, fx - 20, 100 - lift], true);
      p.line(fx - 4, 72 - lift, fx, 90 - lift); D.hatch(p, fx - 12, 94 - lift, fx + 12, 94 - lift, 4, 4, Math.PI / 2);
      D.crack(p, off - 2 + a * 2, 48, fx - 2, 66 - lift, 4);
    };
    const seg = (x0, y0, x1, y1, w0, w1, k) => {   // an irregular stone block between two joints
      const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, tx = dx / d, ty = dy / d;
      const j = i => Math.sin(k * 7.3 + i * 2.9) * 3;
      p.poly([x0 + nx * w0 + tx * j(1), y0 + ny * w0 + ty * j(1), x0 + tx * d * 0.5 + nx * (w0 + w1) * 0.6, y0 + ty * d * 0.5 + ny * (w0 + w1) * 0.6, x1 + nx * w1 + tx * j(2), y1 + ny * w1 + ty * j(2),
        x1 - nx * w1 * 0.8 + tx * j(3), y1 - ny * w1 * 0.8 + ty * j(3), x0 + tx * d * 0.45 - nx * (w0 + w1) * 0.5, y0 + ty * d * 0.45 - ny * (w0 + w1) * 0.5, x0 - nx * w0 * 1.1 + tx * j(4), y0 - ny * w0 * 1.1 + ty * j(4)], true);
    };
    const arm = (front, a) => {
      const sx = front ? 50 : -50, sy = -46, f = front ? 1 : -1;
      let ex, ey, hx, hy;
      if (held) { ex = sx + f * 12; ey = sy - 34; hx = sx + f * 16 + Math.sin(t * 11) * 4; hy = sy - 74; }
      else if (front && windup) { ex = sx + 10; ey = sy - 36; hx = sx + 20; hy = sy - 78; }
      else if (front && throwing) { ex = sx + 22; ey = sy - 4; hx = sx + 50; hy = sy - 12; }
      else if (mood === 'dizzy') { ex = sx + f * 14; ey = sy + 36; hx = sx + f * 20; hy = sy + 76; }
      else if (angry && !walking) { ex = sx + f * 16; ey = sy + 12; hx = sx + f * 14; hy = sy - 34; }
      else { ex = sx + f * 14 + a * 5; ey = sy + 40; hx = sx + f * 12 + a * 12; hy = sy + 82; }
      seg(sx, sy, ex, ey, 13, 10, front ? 1 : 2);
      seg(ex, ey, hx, hy, 15, 12, front ? 3 : 4);
      D.crack(p, (sx + ex) / 2, (sy + ey) / 2, (ex + hx) / 2 + f * 3, (ey + hy) / 2, 4);
      p.poly([sx - 18, sy - 6, sx - 10, sy - 22, sx + 8, sy - 26, sx + 22, sy - 12, sx + 20, sy + 6, sx + 4, sy + 12, sx - 14, sy + 8], true);
      p.line(sx - 10, sy - 22, sx + 2, sy - 8); p.line(sx + 2, sy - 8, sx + 20, sy + 6);
      p.poly([hx - 17, hy - 10, hx - 10, hy - 19, hx + 2, hy - 22, hx + 14, hy - 17, hx + 21, hy - 6, hx + 19, hy + 8, hx + 10, hy + 16, hx - 6, hy + 17, hx - 16, hy + 9, hx - 20, hy - 2], true);
      p.line(hx - 10, hy - 19, hx - 2, hy - 6); p.line(hx - 2, hy - 6, hx + 19, hy + 8); p.line(hx - 2, hy - 6, hx - 6, hy + 17); p.line(hx + 2, hy - 22, hx + 6, hy - 10);
      if (front && windup) D.flame(p, hx, hy - 16, 13 + Math.sin(t * 20) * 2, t, e.seed + 9);
      D.flame(p, sx - 4, sy - 26, 6, t, e.seed + (front ? 1 : 2));
      p.dot(hx + 10, hy + 18 + (Math.sin(t * 3 + e.seed) + 1) * 3, 1.3);
    };
    leg(-18, -sw); arm(false, -sw);
    p.poly([-46, 40, -56, 6, -50, -34, -30, -56, 0, -62, 30, -58, 52, -36, 56, 4, 46, 42], true);
    p.poly([-42, -30, -22, -52, 24, -54, 46, -32, 40, -4, -38, -2], true);
    p.poly([-36, 2, 38, 0, 44, 40, -44, 40], true);
    p.line(-8, -54, -4, -4); p.line(0, 2, 4, 40);
    D.crack(p, -30, -20, -14, 8, 5); D.crack(p, 18, -44, 34, -14, 4); D.crack(p, -24, 10, -10, 36, 4); D.crack(p, 14, 8, 30, 34, 4);
    D.hatch(p, -50, -20, -46, 30, 6, 6, 0.2); D.hatch(p, -40, 40, 40, 40, 8, 4, Math.PI / 2);
    for (let k = 0; k < 5; k++) p.dot(-30 + k * 15, -58 + (k % 2) * 6, 1.2);
    leg(18, sw);
    p.poly([-22, -58, -28, -80, -18, -100, 4, -108, 22, -100, 30, -80, 24, -58], true);
    p.line(-18, -100, -10, -80); p.line(-10, -80, 24, -58); p.line(4, -108, -10, -80);
    c.save(); c.lineWidth = 3.5; p.line(-20, -86, 26, -88); c.restore();
    if (mood === 'dizzy') { p.line(-16, -84, -6, -74); p.line(-6, -84, -16, -74); p.line(6, -84, 16, -74); p.line(16, -84, 6, -74); }
    else if (mood === 'sleep') { p.line(-16, -78, -6, -78); p.line(6, -78, 16, -78); }
    else { p.poly([-18, -84, -4, -82, -14, -74], '#ff9f1c'); p.poly([4, -82, 18, -84, 10, -74], '#ff9f1c'); if (glow) { p.line(-20, -80, -22, -76); p.line(20, -80, 22, -76); } }
    if (angry || throwing || mood === 'scared') { p.poly([-14, -70, 16, -70, 12, -62, -12, -62], '#ff6a00'); c.save(); c.strokeStyle = '#fff'; c.lineWidth = 1.5; p.zigzag(-12, -70, 14, -70, -3, 6); p.zigzag(-10, -62, 10, -62, 3, 5); c.restore(); }
    else p.zigzag(-12, -68, 14, -68, 3, 7);
    D.flame(p, 2, -106, 13, t, e.seed); D.flame(p, -14, -98, 7, t, e.seed + 3); D.flame(p, 16, -98, 6, t, e.seed + 5);
    arm(true, sw);
  };

  // ---------- the giant spider: a tarantula the size of a truck ----------
  D.spider = function () { return { w: 200, h: 140, draw(p, e, t) { p.ctx.translate(-8, 4); D.drawSpider(p, e, t); } }; };
  D.drawSpider = function (p, e, t) {
    p.use('body');
    const c = p.ctx, mood = e.mood, held = e.held;
    const walking = e.moving && e.grounded && !held;
    const inAir = !e.grounded && !held;
    const angry = mood === 'angry' || e.mode === 'hunt';
    const spit = e.spitT > 0;
    const breathe = Math.sin(t * 2 + e.seed) * 1.5;
    const tapered = (x0, y0, x1, y1, w0, w1) => { const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d; p.poly([x0 + nx * w0 / 2, y0 + ny * w0 / 2, x1 + nx * w1 / 2, y1 + ny * w1 / 2, x1 - nx * w1 / 2, y1 - ny * w1 / 2, x0 - nx * w0 / 2, y0 - ny * w0 / 2], true); };
    const ATT = [[34, -4], [24, -2], [12, -2], [2, -4]], KNEE = [[76, -58], [50, -70], [10, -72], [-34, -62]], FOOT = [[98, 64], [60, 66], [-4, 66], [-64, 60]];
    const leg = (i, far) => {
      const ph = e.phase * 1.4 + i * Math.PI + (far ? Math.PI : 0);
      let ax = ATT[i][0] + (far ? 6 : 0), ay = ATT[i][1] - (far ? 10 : 0);
      let kx = KNEE[i][0] + (far ? 6 : 0), ky = KNEE[i][1] - (far ? 8 : 0) + breathe;
      let fx = FOOT[i][0] + (far ? 6 : 0), fy = FOOT[i][1] - (far ? 8 : 0);
      if (held) { kx = ax + (kx - ax) * 0.5; ky = ay - 30; fx = ax + (fx - ax) * 0.3; fy = 30 + Math.sin(t * 9 + i) * 3; }
      else if (inAir) { fy -= 14; kx += 4; }
      else if (walking) { fx += Math.cos(ph) * 10; fy -= Math.max(0, Math.sin(ph)) * 12; ky -= Math.max(0, Math.sin(ph)) * 4; }
      if (spit && i === 0 && !held) { kx = 60; ky = -84; fx = 112; fy = -46 + Math.sin(t * 14) * 3; }
      const s = i < 2 ? 1 : -1;
      const mx = kx + (fx - kx) * 0.55 + 12 * s, my = ky + (fy - ky) * 0.55;
      const w = far ? 0.85 : 1;
      tapered(ax, ay, kx, ky, 15 * w, 11 * w);
      tapered(kx, ky, mx, my, 11 * w, 8 * w);
      tapered(mx, my, fx, fy, 8 * w, 3.5 * w);
      D.fur(p, [ax, ay, kx, ky], 5, 3, s, 0.3); D.fur(p, [kx, ky, mx, my], 5, 3, -s, 0.3);
      p.circle(kx, ky, 5 * w, true); p.circle(mx, my, 3.5 * w, true);
      p.line(fx, fy, fx + s * 3, fy + 3); p.line(fx, fy, fx - s * 2, fy + 3);
    };
    for (let i = 3; i >= 0; i--) leg(i, true);
    // far chelicera and pedipalp
    p.poly([36, 0, 48, -2, 50, 8, 44, 14, 36, 10], true);
    // abdomen: big, hairy, patterned; spinnerets at the tip
    c.save(); c.translate(-42, -12); c.rotate(-0.12);
    p.ellipse(0, 0, 46, 32, true, 0);
    const top = []; for (let k = 0; k <= 8; k++) { const a = Math.PI * 1.02 + k * (Math.PI * 0.96 / 8); top.push(Math.cos(a) * 46, Math.sin(a) * 32); }
    D.fur(p, top, 7, 6, -1, 0.2);
    p.stroke('#c0392b'); c.lineWidth *= 1.4; for (let k = 0; k < 3; k++) { const x = -22 + k * 16; p.path([x - 7, -14, x, -22, x + 7, -14], false); } c.lineWidth /= 1.4; p.stroke();
    p.curve(-30, 6, 0, 14, 30, 4); D.hatch(p, -20, 20, 16, 26, 5, 4, -1.2);
    p.poly([-46, 2, -54, 0, -55, 5, -46, 8], true); p.poly([-46, 8, -53, 8, -53, 13, -45, 13], true);
    c.restore();
    // cephalothorax
    p.ellipse(22, -8, 26, 19, true, 0);
    p.curve(14, -22, 20, -14, 26, -22); p.line(-2, -10, -2, -2);
    // near chelicera with fang, pedipalp
    p.poly([40, 4, 52, 2, 54, 12, 48, 18, 40, 14], true);
    if (angry || spit || mood === 'scared') { p.curve(50, 18, 58, 24, 56, 32); p.curve(44, 14, 48, 22, 42, 30); p.dot(56, 34 + (Math.sin(t * 4) + 1) * 2, 1.2); }
    else { p.curve(50, 18, 52, 26, 46, 28); }
    tapered(44, -2, 58, -12, 5, 4); tapered(58, -12, 66, -2, 4, 3); tapered(66, -2, 64, 10, 3, 2);
    // eyes: two big forward eyes and a cluster of small ones
    D.eye(p, 40, -14, 3.6, e, 1); D.eye(p, 31, -17, 2.4, e, -1);
    p.dot(46, -9, 1.4); p.dot(36, -21, 1.2); p.dot(27, -21, 1.1); p.dot(44, -19, 1.2);
    for (let i = 3; i >= 0; i--) leg(i, false);
  };

  // ---------- the giant moth: seen from above, wings beating, feathered antennae ----------
  D.moth = function () { return { w: 150, h: 160, draw(p, e, t) { D.drawMoth(p, e, t); } }; };
  D.drawMoth = function (p, e, t) {
    const c = p.ctx, mood = e.mood, held = e.held;
    const flying = e.flying && !held;
    const angry = mood === 'angry' || e.mode === 'hunt';
    const gust = e.gustT > 0;
    const flap = held ? 0.35 : flying ? (gust ? 0.5 + 0.5 * Math.abs(Math.sin(t * 22)) : 0.55 + 0.45 * Math.abs(Math.sin(t * 11 + e.seed))) : e.grounded ? 0.42 : 0.8;
    const wing = side => {
      c.save(); c.scale(1, side * flap); p.use('wing');
      // hindwing (behind), scalloped margin, veins
      p.poly([-8, -8, -34, -26, -56, -44, -70, -36, -76, -20, -62, -8, -36, -2], true);
      p.zigzag(-56, -44, -76, -20, 2.5, 6);
      for (let k = 0; k < 3; k++) p.line(-12, -8, -42 - k * 9, -34 + k * 9);
      // forewing: leading edge to the apex, scalloped outer margin, back to the abdomen
      p.poly([-2, -8, 30, -34, 68, -62, 60, -76, 30, -84, 0, -78, -26, -62, -38, -38, -28, -14], true);
      p.zigzag(66, -64, 2, -78, 3, 12);
      for (let k = 0; k < 4; k++) p.curve(0, -10, 16 - k * 6, -36 - k * 8, 52 - k * 16, -70 + k * 3);
      // bands and the big eyespot
      p.curve(-22, -54, 12, -66, 56, -70); p.curve(-32, -40, 0, -50, 40, -58);
      p.circle(20, -52, 10, '#f6d13b'); p.circle(20, -52, 6, '#2b6cb0'); p.circle(23, -55, 2, '#fff');
      p.circle(-12, -36, 3.5, '#2b6cb0');
      D.fur(p, [-2, -8, 30, -34], 6, 4, 1, 0.4);
      c.restore();
    };
    wing(-1); wing(1); p.use('body');
    // legs (tucked while flying)
    if (!flying) for (let k = 0; k < 3; k++) for (const sd of [-1, 1]) { const x = 14 - k * 10; p.line(x, sd * 10, x - 4, sd * 20); p.line(x - 4, sd * 20, x + 6, sd * 26); }
    // abdomen: segmented, hairy, tufted tip
    D.tube(p, -8, 0, -34, 0, -64, 0, 22, 8, 6, true);
    for (let k = 1; k <= 6; k++) { const x = -12 - k * 8, w = 10.5 - k * 1.1; p.line(x, -w, x, w); }
    D.fur(p, [-14, -10, -58, -4], 6, 4, -1, -0.3); D.fur(p, [-58, 4, -14, 10], 6, 4, -1, 0.3);
    p.fuzz(-64, 0, 6, 4, true, 6);
    // thorax: a ball of fur
    p.fuzz(4, 0, 18, 13, true, 10);
    p.fuzz(14, 0, 9, 10, true, 7);
    // head, eyes, palps
    p.circle(27, 0, 8, true);
    D.eye(p, 30, -5, 3.4, e, -1); D.eye(p, 30, 5, 3.4, e, 1);
    p.curve(34, -2, 39, -6, 41, -2); p.curve(34, 2, 39, 6, 41, 2);
    // feathered (bipectinate) antennae
    for (const sd of [-1, 1]) {
      const vib = angry ? Math.sin(t * 30 + sd) * 1.5 : 0;
      const x0 = 31, y0 = sd * 3, x1 = 66, y1 = sd * (28 + vib);
      const a = Math.atan2(y1 - y0, x1 - x0);
      p.line(x0, y0, x1, y1);
      D.hatch(p, x0 + 6, y0 + (y1 - y0) * 0.17, x1 - 3, y1 - (y1 - y0) * 0.08, 9, 5, a + Math.PI / 2);
      D.hatch(p, x0 + 6, y0 + (y1 - y0) * 0.17, x1 - 3, y1 - (y1 - y0) * 0.08, 9, 5, a - Math.PI / 2);
      if (e.laserT > 0 && Math.floor(t * 30) % 2) p.circle(x1, y1, 4, false);
    }
  };

  // ---------- the ice golem: a giant of faceted ice crystals, spikes and icicles ----------
  D.iceGolem = function () { return { w: 150, h: 210, draw(p, e, t) { D.drawIceGolem(p, e, t); } }; };
  D.drawIceGolem = function (p, e, t) {
    p.use('body');
    const c = p.ctx, mood = e.mood, held = e.held;
    const walking = e.moving && e.grounded && !held;
    const inAir = !e.grounded && !held;
    const sw = walking ? Math.sin(e.phase) : 0;
    const angry = mood === 'angry' || e.mode === 'hunt';
    const throwing = e.throwT > 0, windup = e.throwT > 0.25, breathing = e.breath > 0;
    // a crystal: filled facet with a faint inner outline so it reads as glassy
    const crystal = pts => {
      p.poly(pts, true);
      let cx = 0, cy = 0; const n = pts.length / 2;
      for (let i = 0; i < pts.length; i += 2) { cx += pts[i]; cy += pts[i + 1]; } cx /= n; cy /= n;
      const inner = []; for (let i = 0; i < pts.length; i += 2) inner.push(cx + (pts[i] - cx) * 0.62, cy + (pts[i + 1] - cy) * 0.62);
      c.save(); c.globalAlpha = 0.4; c.lineWidth *= 0.7; p.poly(inner, false); c.restore();
    };
    const spike = (x, y, w, h, ang) => { c.save(); c.translate(x, y); c.rotate(ang || 0); p.use('spike'); p.poly([-w / 2, 0, 0, -h, w / 2, 0], true); p.use('body'); c.restore(); };
    const icicles = (x0, y, x1, n, len) => { for (let k = 0; k < n; k++) { const x = x0 + (x1 - x0) * (k + 0.5) / n; p.poly([x - 3, y, x + 3, y, x, y + len * (0.6 + ((k * 7) % 3) * 0.2)], true); } };
    const seg = (x0, y0, x1, y1, w0, w1) => { const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, tx = dx / d, ty = dy / d; crystal([x0 + nx * w0, y0 + ny * w0, x0 + tx * d * 0.5 + nx * (w0 + w1) * 0.62, y0 + ty * d * 0.5 + ny * (w0 + w1) * 0.62, x1 + nx * w1, y1 + ny * w1, x1 - nx * w1, y1 - ny * w1, x0 + tx * d * 0.5 - nx * (w0 + w1) * 0.55, y0 + ty * d * 0.5 - ny * (w0 + w1) * 0.55, x0 - nx * w0, y0 - ny * w0]); };
    const leg = (off, a) => {
      const fx = off + a * 12, lift = walking ? Math.max(0, a) * 6 : inAir ? 8 : 0;
      crystal([off - 15, 44, off + 15, 40, off + 19 + a * 4, 72 - lift / 2, off + 4 + a * 4, 78 - lift / 2, off - 12 + a * 4, 74 - lift / 2]);
      crystal([fx - 13, 70 - lift, fx + 13, 68 - lift, fx + 17, 96 - lift, fx - 15, 98 - lift]);
      crystal([fx - 22, 94 - lift, fx + 20, 92 - lift, fx + 30, 104 - lift, fx - 20, 105 - lift]);
    };
    const arm = (front, a) => {
      const sx = front ? 50 : -50, sy = -50, f = front ? 1 : -1;
      let ex, ey, hx, hy;
      if (held) { ex = sx + f * 12; ey = sy - 34; hx = sx + f * 16 + Math.sin(t * 11) * 4; hy = sy - 74; }
      else if (front && windup) { ex = sx + 10; ey = sy - 36; hx = sx + 20; hy = sy - 78; }
      else if (front && throwing) { ex = sx + 22; ey = sy - 4; hx = sx + 50; hy = sy - 12; }
      else if (breathing) { ex = sx + f * 18; ey = sy + 10; hx = sx + f * 30; hy = sy - 20; }
      else if (mood === 'dizzy') { ex = sx + f * 14; ey = sy + 36; hx = sx + f * 20; hy = sy + 76; }
      else if (angry && !walking) { ex = sx + f * 16; ey = sy + 12; hx = sx + f * 14; hy = sy - 34; }
      else { ex = sx + f * 14 + a * 5; ey = sy + 40; hx = sx + f * 12 + a * 12; hy = sy + 82; }
      seg(sx, sy, ex, ey, 12, 9); seg(ex, ey, hx, hy, 13, 11);
      crystal([sx - 18, sy - 4, sx - 8, sy - 20, sx + 10, sy - 24, sx + 22, sy - 10, sx + 18, sy + 8, sx - 12, sy + 10]);
      spike(sx - 6, sy - 20, 10, 22, -0.5 * f); spike(sx + 8, sy - 22, 10, 30, -0.15 * f); spike(sx + 18, sy - 12, 8, 18, 0.35 * f);
      crystal([hx - 16, hy - 12, hx - 6, hy - 20, hx + 12, hy - 18, hx + 20, hy - 4, hx + 16, hy + 12, hx - 4, hy + 16, hx - 18, hy + 6]);
      icicles(hx - 10, hy + 14, hx + 14, 3, 12);
      if (front && windup) { spike(hx, hy - 18, 10, 30, 0); spike(hx - 8, hy - 16, 8, 22, -0.4); spike(hx + 9, hy - 16, 8, 22, 0.4); }
    };
    leg(-18, -sw); arm(false, -sw);
    crystal([-42, 40, -50, -8, -38, -54, -4, -68, 32, -60, 52, -14, 46, 40]);
    c.save(); c.globalAlpha = 0.5; c.lineWidth *= 0.7; p.line(-38, -54, -6, -10); p.line(-6, -10, 46, 40); p.line(32, -60, -6, -10); p.line(-6, -10, -42, 40); c.restore();
    p.line(-20, -30, -14, -40); p.line(-24, -22, -16, -36);
    icicles(-38, 40, 40, 5, 16);
    spike(-30, -50, 10, 22, -0.5); spike(-12, -62, 9, 20, -0.25); spike(12, -62, 9, 18, 0.2);
    leg(18, sw);
    crystal([-20, -66, -26, -88, -14, -106, 8, -110, 24, -100, 28, -80, 20, -66]);
    spike(-14, -104, 10, 24, -0.5); spike(-2, -110, 10, 32, -0.1); spike(12, -106, 9, 22, 0.35); spike(22, -96, 7, 14, 0.7);
    c.save(); c.lineWidth = 3; p.line(-20, -90, 22, -92); c.restore();
    if (mood === 'dizzy') { p.line(-16, -88, -6, -78); p.line(-6, -88, -16, -78); p.line(6, -88, 16, -78); p.line(16, -88, 6, -78); }
    else if (mood === 'sleep') { p.line(-16, -84, -6, -84); p.line(6, -84, 16, -84); }
    else { p.poly([-16, -86, -6, -88, -4, -80, -14, -78], '#1b4d80'); p.poly([4, -88, 16, -86, 14, -78, 6, -80], '#1b4d80'); if (Math.floor(t * 5) % 2) { c.save(); c.strokeStyle = '#fff'; c.lineWidth = 1.2; p.line(-13, -84, -9, -83); p.line(7, -85, 11, -84); c.restore(); } }
    if (angry || throwing || breathing || mood === 'scared') { p.poly([-14, -74, 16, -74, 12, -66, -12, -66], '#1b4d80'); c.save(); c.strokeStyle = '#fff'; c.lineWidth = 1.5; p.zigzag(-12, -74, 14, -74, -3, 6); p.zigzag(-10, -66, 10, -66, 3, 5); c.restore(); }
    else p.zigzag(-12, -72, 14, -72, 3, 7);
    icicles(-8, -66, 18, 3, 8);
    if (breathing) for (let k = 0; k < 3; k++) p.circle(30 + k * 10, -72 + Math.sin(t * 9 + k) * 4, 3 + k, false);
    arm(true, sw);
  };

  // ---------- fireball (what the lava golem throws; you can type it too) ----------
  SB.def('fireball', {
    cat: 'item', aliases: ['fire ball', 'ball of fire', 'flaming ball', 'fireballs'], tags: ['item', 'fire', 'hot'], mass: 3, gravity: 0.6, bounce: 0, noCollide: true, special: 'fireball',
    t: { w: 26, h: 26, draw(p, e, t) { D.flame(p, 0, 12, 12, t, e.seed); p.circle(0, 2, 7, true); p.dot(-2, 1, 1.2); p.dot(3, 3, 1); } },
    hint: 'Kaboom when it lands!'
  });

  // ---------- the giant snake: a cobra the size of a bus, coiled and rearing ----------
  D.snakeMouth = [98, -65];   // template coords of the open mouth (for spitting)
  D.snakeBoss = function () { return { w: 230, h: 170, draw(p, e, t) { p.ctx.translate(-4, 10); D.drawSnakeBoss(p, e, t); } }; };
  D.drawSnakeBoss = function (p, e, t) {
    const c = p.ctx, mood = e.mood, held = e.held;
    const angry = mood === 'angry' || e.mode === 'hunt';
    const spit = e.spitT > 0, breathing = e.breath > 0;
    const sway = held ? Math.sin(t * 9) * 6 : Math.sin(t * 1.7 + e.seed) * 4;
    const lunge = spit ? Math.sin(Math.min(1, (0.45 - e.spitT) / 0.45) * Math.PI) * 16 : 0;
    p.use('body');
    const scales = (x0, y0, x1, y1, n, amp) => { c.save(); c.globalAlpha = 0.35; p.zigzag(x0, y0, x1, y1, amp, n); p.zigzag(x0, y0 + amp, x1, y1 + amp, -amp, n); c.restore(); };
    const br = Math.sin(t * 2 + e.seed) * 1.5;
    const coil = (cx, cy, rx, ry) => {
      p.ellipse(cx, cy, rx, ry, true, 0);
      p.use('belly'); p.ellipse(cx, cy + ry * 0.35, rx * 0.92, ry * 0.42, true, 0); p.use('body');
      for (let k = -3; k <= 3; k++) p.line(cx + k * rx * 0.28, cy + ry * 0.05, cx + k * rx * 0.28 + 2, cy + ry * 0.75);
      scales(cx - rx * 0.8, cy - ry * 0.55, cx + rx * 0.8, cy - ry * 0.55, 10, 3);
    };
    coil(-46, 58 + br, 62, 17); coil(-40, 36 + br * 0.5, 54, 15); coil(-30, 18, 44, 13);
    const nx = 52 + sway * 0.4 + lunge, ny = -30 + sway;
    const path = D.tube(p, -10, 6, 30, 0, nx, ny, 30, 22, 9, true);
    p.use('belly'); D.tube(p, -8, 14, 32, 8, nx - 2, ny + 6, 12, 10, 9, true); p.use('body');
    for (let j = 1; j < path.length; j += 2) { const [x, y] = path[j]; p.line(x - 9, y + 4, x + 8, y + 6); }
    for (let j = 1; j < path.length - 1; j += 3) { const [x, y] = path[j]; scales(x - 12, y - 9, x + 12, y - 11, 6, 2.5); }
    const hf = angry || spit || breathing ? 1.25 : 1;
    p.use('hood');
    p.poly([nx - 8, ny + 10, nx - 26 * hf, ny - 14, nx - 22 * hf, ny - 44, nx, ny - 56, nx + 24 * hf, ny - 44, nx + 28 * hf, ny - 14, nx + 10, ny + 10], true);
    c.save(); c.globalAlpha = 0.6; p.stroke('#2b3a1a'); p.circle(nx - 9, ny - 26, 6, false); p.circle(nx + 9, ny - 26, 6, false); p.curve(nx - 9, ny - 20, nx, ny - 14, nx + 9, ny - 20); c.restore(); p.stroke();
    p.use('body');
    D.tube(p, nx - 4, ny + 8, nx + 6, ny - 24, nx + 14, ny - 44, 22, 18, 5, true);
    const hx = nx + 14, hy = ny - 50;
    p.poly([hx - 14, hy - 6, hx - 8, hy - 16, hx + 14, hy - 18, hx + 34, hy - 8, hx + 38, hy + 2, hx + 26, hy + 10, hx - 2, hy + 12, hx - 16, hy + 4], true);
    p.line(hx - 6, hy - 12, hx + 30, hy - 8);
    p.dot(hx + 32, hy - 3, 1.4);
    if (mood === 'dizzy') { p.line(hx + 8, hy - 9, hx + 16, hy - 3); p.line(hx + 16, hy - 9, hx + 8, hy - 3); }
    else { p.ellipse(hx + 12, hy - 6, 5, 3.6, '#f6d13b', 0); p.line(hx + 12, hy - 9.5, hx + 12, hy - 2.5); }
    if (angry || spit) { c.save(); c.lineWidth *= 1.3; p.line(hx + 4, hy - 12, hx + 20, hy - 10); c.restore(); }
    const open = angry || spit || breathing || mood === 'scared';
    if (open) { p.use('mouth'); p.poly([hx - 4, hy + 8, hx + 30, hy + 4, hx + 36, hy + 6, hx + 30, hy + 20, hx + 6, hy + 22, hx - 6, hy + 14], true); p.use('body'); p.poly([hx + 24, hy + 5, hx + 30, hy + 5, hx + 27, hy + 16], '#fff'); p.poly([hx + 14, hy + 6, hx + 20, hy + 6, hx + 17, hy + 15], '#fff'); }
    else p.line(hx - 6, hy + 8, hx + 34, hy + 4);
    if (Math.sin(t * 6 + e.seed) > 0.2 || spit) { p.stroke('#c0392b'); p.line(hx + 36, hy + 5, hx + 50, hy + 6); p.line(hx + 50, hy + 6, hx + 56, hy + 2); p.line(hx + 50, hy + 6, hx + 56, hy + 10); p.stroke(); }
    if (breathing) { c.save(); c.globalAlpha = 0.5; for (let k = 0; k < 3; k++) p.circle(hx + 44 + k * 12, hy + 6 + Math.sin(t * 8 + k) * 5, 4 + k * 2, '#8fd39a'); c.restore(); }
  };

  // ---------- venom (what the giant snake spits; you can type it too) ----------
  SB.def('venom', {
    cat: 'item', aliases: ['poison', 'venom glob', 'poison glob', 'acid', 'toxic goo', 'poison ball', 'venom ball', 'toxic waste', 'slime ball'], tags: ['item', 'poison', 'wet', 'goo'],
    mass: 0.5, gravity: 0.5, bounce: 0, noCollide: true, special: 'venom',
    t: { w: 18, h: 18, draw(p, e, t) { p.fuzz(0, 0, 8, 7, true, 6); p.dot(-2, -2, 1.2); p.circle(3, 2, 1.5, false); } },
    hint: 'Poison! It makes whatever it hits sick.'
  });

  // ---------- the giant angry bull: a fighting bull the size of a barn ----------
  D.bullNose = [142, -10];   // template coords of the nostrils (for steam)
  D.bullBoss = function () { return { w: 300, h: 200, draw(p, e, t) { p.ctx.translate(-12, 0); D.drawBullBoss(p, e, t); } }; };
  D.drawBullBoss = function (p, e, t) {
    const c = p.ctx, mood = e.mood, held = e.held;
    const walking = e.moving && e.grounded && !held;
    const inAir = !e.grounded && !held;
    const charging = e.chargeT > 0, pawing = e.pawT > 0, rear = e.rearT > 0;
    const angry = mood === 'angry' || e.mode === 'hunt' || charging || pawing;
    const ph = e.phase * (charging ? 1.5 : 1);
    const G = 100;
    p.use('body');
    if (rear) { const k = Math.sin(Math.min(1, (0.7 - e.rearT) / 0.45) * Math.PI / 2) * (e.rearT < 0.2 ? e.rearT / 0.2 : 1); c.translate(-90, G); c.rotate(-0.34 * k); c.translate(90, -G); }
    const hoof = (x, y) => { p.use('hoof'); p.poly([x - 10, y - 10, x + 9, y - 10, x + 13, y, x - 11, y], true); p.line(x + 1, y - 9, x + 2, y); };
    const hindLeg = (hx, hy, a, far) => {
      const lift = (walking || charging) ? Math.max(0, Math.sin(a)) * 13 : inAir ? 10 : 0;
      const sx = Math.sin(a) * (charging ? 28 : 16);
      const kx = hx + 12 + sx * 0.3, ky = hy + 40;
      const jx = hx - 8 + sx * 0.6, jy = hy + 66 - lift * 0.4;
      const fx = hx - 2 + sx, fy = 90 - lift;
      p.use(far ? 'far' : 'body');
      D.slab(p, hx, hy, kx, ky, far ? 32 : 36); D.slab(p, kx, ky, jx, jy, far ? 18 : 21); D.slab(p, jx, jy, fx, fy, far ? 12 : 14);
      hoof(fx + 3, G - lift); p.use('body');
    };
    const foreLeg = (sx0, sy0, a, far, paw) => {
      let lift = (walking || charging) ? Math.max(0, Math.sin(a)) * 15 : inAir ? 12 : 0;
      let sx = Math.sin(a) * (charging ? 30 : 16);
      if (paw) { const s = Math.sin(t * 13); lift = 12 + s * 7; sx = -8 + s * 16; }
      if (rear) { lift = far ? 34 : 42; sx = far ? 18 : 28; }
      const ex = sx0 - 2 + sx * 0.3, ey = sy0 + 42 - lift * 0.3;
      const kx = sx0 + 2 + sx * 0.7, ky = sy0 + 64 - lift * 0.7;
      const fx = sx0 + 4 + sx, fy = 90 - lift;
      p.use(far ? 'far' : 'body');
      D.slab(p, sx0, sy0, ex, ey, far ? 30 : 34); D.slab(p, ex, ey, kx, ky, far ? 16 : 19); D.slab(p, kx, ky, fx, fy, far ? 12 : 14);
      hoof(fx + 2, G - lift); p.use('body');
    };
    // tail with a tuft
    const sw = Math.sin(t * 2.4 + e.seed) * 6 + (charging ? -16 : 0) + (angry ? Math.sin(t * 9) * 4 : 0);
    D.tube(p, -116, -34, -142 + sw * 0.4, 0, -134 + sw, 42, 7, 3, 7, true);
    p.use('hair'); p.fuzz(-134 + sw, 48, 6, 9, true, 7); p.use('body');
    // far legs
    hindLeg(-74, 4, ph + Math.PI, true); foreLeg(64, 6, ph, true, false);
    // body: rump, belly, deep chest and the big shoulder hump
    p.use('body');
    p.poly([-118, -40, -127, -6, -118, 28, -94, 46, -40, 52, 22, 54, 64, 46, 90, 24, 98, -10, 88, -44, 64, -72, 36, -82, 6, -72, -40, -58, -92, -52], true);
    D.fur(p, [6, -72, 36, -82, 64, -72, 88, -44], 6, 5, -1, 0.35);
    c.save(); c.globalAlpha = 0.55;
    p.curve(46, -62, 76, -16, 58, 36);             // shoulder muscle
    p.arc(-84, 0, 32, -2.3, 0.7);                   // haunch
    p.curve(-20, -50, -6, 0, -24, 46);              // ribs / barrel
    p.curve(10, -54, 24, -4, 14, 48);
    c.restore();
    D.hatch(p, -86, 46, 58, 50, 10, 6, -1.35);
    // near legs
    hindLeg(-90, 10, ph, false); foreLeg(54, 10, ph + Math.PI, false, pawing);
    // dewlap
    p.curve(84, 22, 102, 42, 116, 22);
    // head on a pivot at the neck: lowered to charge, tossed back when rearing
    const down = charging ? 0.55 : pawing ? 0.4 + Math.sin(t * 7) * 0.05 : rear ? -0.3 : angry ? 0.24 : 0.08 + Math.sin(t * 1.4 + e.seed) * 0.03;
    c.save(); c.translate(92, -34); c.rotate(down);
    p.use('horn'); D.tube(p, 14, -22, -12, -44, 2, -72, 12, 3, 7, true);              // far horn
    p.use('body');
    p.poly([-14, -22, 6, -30, 26, -30, 44, -22, 58, -4, 68, 18, 66, 34, 52, 42, 34, 36, 16, 24, -6, 30, -16, 6], true);
    p.poly([6, -20, -16, -34, -4, -12], true);                                         // ear
    p.use('hair'); p.fuzz(26, -27, 10, 5, true, 7);                                    // curly forelock
    p.use('snout'); p.poly([52, 6, 69, 14, 69, 34, 54, 41, 44, 28], true);
    p.dot(63, 17, 2.4); p.line(48, 34, 64, 32);
    if (angry || mood === 'scared') {
      p.circle(32, -8, 4.4, '#ff3b30'); p.dot(33.5, -8, 1.7);
      c.save(); c.lineWidth *= 1.8; p.line(20, -18, 42, -12); c.restore();
    } else D.eye(p, 32, -8, 3.6, e, 1);
    c.save(); c.strokeStyle = '#d4a017'; c.lineWidth *= 1.5; p.circle(63, 37, 6, false); c.restore();   // nose ring
    p.use('horn'); D.tube(p, 24, -24, 62, -30, 72, -68, 14, 3, 8, true);              // near horn
    p.use('hoof'); p.poly([67, -58, 75, -62, 72, -70], true);                          // dark horn tip
    c.restore();
    p.use('body');
  };

  // ---------- the giant scorpion: three tails, two huge pincers ----------
  D.scorpTips = [[-103, -96], [-69, -82], [-37, -64]];   // template coords of the three stingers at rest
  D.scorpion = function () { return { w: 340, h: 200, draw(p, e, t) { p.ctx.translate(-33, 14); D.drawScorpion(p, e, t); } }; };
  D.drawScorpion = function (p, e, t) {
    const c = p.ctx, mood = e.mood, held = e.held;
    const walking = e.moving && e.grounded && !held;
    const angry = mood === 'angry' || e.mode === 'hunt';
    const G = 84, ph = e.phase * 2;
    p.use('body');
    // walking leg: hip on the body, knee high above it, foot planted wide (front legs reach forward, back legs back)
    const leg = (ax, ay, i, far) => {
      const a = ph + i * 1.6 + (far ? Math.PI : 0);
      const step = walking ? Math.sin(a) * 12 : held ? Math.sin(t * 12 + i) * 8 : 0;
      const lift = walking ? Math.max(0, Math.cos(a)) * 9 : held ? 16 : 0;
      const spread = (1.5 - i) * 24;
      const kx = ax + spread * 0.55 + step * 0.4, ky = ay - 34 - (far ? 6 : 0) + Math.abs(i - 1.5) * 4;
      const fx = ax + spread * 1.5 + step, fy = G - lift - (far ? 6 : 0);
      p.use(far ? 'far' : 'leg');
      D.tube(p, ax, ay, (ax + kx) / 2 - spread * 0.1, ky - 8, kx, ky, far ? 9 : 10, 8, 4, true);
      D.tube(p, kx, ky, (kx + fx) / 2 + spread * 0.15, (ky + fy) / 2 - 6, fx, fy, 8, 2.5, 5, true);
      p.circle(kx, ky, far ? 4 : 4.5, true);
      p.use('body');
    };
    // pedipalp: upper arm, forearm, and the big pincer held forward
    const claw = (far) => {
      const ck = e.clawT > 0 ? Math.sin((1 - e.clawT / 0.4) * Math.PI) : 0;
      const open = ck > 0 ? ck : angry ? 0.35 + Math.sin(t * 6 + (far ? 1.3 : 0)) * 0.18 : 0.12;
      const reach = ck * 30, wig = held ? Math.sin(t * 10 + (far ? 1 : 0)) * 8 : Math.sin(t * 1.8 + (far ? 2 : 0) + e.seed) * 2;
      const bx = 82, by = far ? 2 : 12;
      const ex = 104 + reach * 0.4 + (far ? -6 : 0), ey = (far ? -26 : -16) + wig;
      const hx = 128 + reach + (far ? -10 : 0), hy = (far ? -24 : -12) + wig;
      p.use(far ? 'far' : 'body');
      D.slab(p, bx, by, ex, ey, far ? 13 : 15); D.slab(p, ex, ey, hx - 10, hy, far ? 14 : 16);
      p.circle(ex, ey, far ? 6 : 7, true);
      c.save(); c.translate(hx, hy); c.rotate(-0.1); c.scale(1.3, 1.3);
      p.ellipse(6, 0, 26, 17, true, 0);                                   // the swollen hand
      p.poly([22, 4, 62, 8, 68, 2, 28, -3], true);                         // fixed finger
      p.zigzag(26, 3, 58, 6, -2.5, 7);
      c.save(); c.translate(22, -7); c.rotate(-open * 0.75);
      p.poly([0, 0, 40, -7, 47, 1, 4, 8], true);                           // movable finger
      p.zigzag(4, 5, 40, 0, 2.5, 7);
      c.restore();
      c.save(); c.globalAlpha = 0.5; p.curve(-14, -8, 4, -15, 22, -8); p.dot(-4, 4, 1.4); p.dot(8, 7, 1.4); c.restore();
      c.restore();
      p.use('body');
    };
    // three tails: each arcs back, up and forward over the body, ending in a bulb and a curved stinger
    const BASE = [[-74, -2], [-76, 6], [-72, 14]];
    const REST = [{ c1: [-132, -20], c2: [-150, -128], t: [-70, -110] }, { c1: [-124, 0], c2: [-128, -110], t: [-36, -96] }, { c1: [-112, 14], c2: [-104, -96], t: [-4, -78] }];
    if (!e.tips) e.tips = [];
    const tail = (i) => {
      const b = BASE[i], r = REST[i];
      const sway = Math.sin(t * 2 + i * 2.1 + e.seed) * 5 + (held ? Math.sin(t * 9 + i) * 10 : 0) + (angry ? Math.sin(t * 8 + i) * 2.5 : 0);
      const c1 = [r.c1[0], r.c1[1]], c2 = [r.c2[0] + sway * 0.5, r.c2[1] + sway * 0.4];
      let tx = r.t[0] + sway, ty = r.t[1] + sway * 0.6;
      const k = e.tailT && e.tailT[i] > 0 ? Math.sin((1 - e.tailT[i] / 0.35) * Math.PI) : 0;
      if (k > 0) { c2[0] += 70 * k; c2[1] -= 30 * k; tx += (175 - tx) * k; ty += (20 - ty) * k; }   // strike forward over the head
      const P = u => { const m = 1 - u; return [m * m * m * b[0] + 3 * m * m * u * c1[0] + 3 * m * u * u * c2[0] + u * u * u * tx, m * m * m * b[1] + 3 * m * m * u * c1[1] + 3 * m * u * u * c2[1] + u * u * u * ty]; };
      const n = 7;
      p.use('body');
      for (let s = 0; s < n; s++) {
        const u0 = s / n, u1 = (s + 1) / n, A = P(u0), Bp = P(u1);
        const x = (A[0] + Bp[0]) / 2, y = (A[1] + Bp[1]) / 2, dx = Bp[0] - A[0], dy = Bp[1] - A[1];
        const rad = 15 - s * 1.2;
        p.ellipse(x, y, Math.hypot(dx, dy) * 0.66, rad, true, Math.atan2(dy, dx));
        c.save(); c.globalAlpha = 0.45; p.dot(x - dy * 0.15, y + dx * 0.15, 1.2); c.restore();
      }
      const Q = P(0.97), ang = Math.atan2(ty - Q[1], tx - Q[0]);
      c.save(); c.translate(tx, ty); c.rotate(ang);
      p.use('telson'); p.ellipse(7, 0, 13, 9, true, 0);
      p.use('stinger'); p.poly([16, -5, 34, 2, 41, 15, 30, 6, 16, 5], true);
      if (angry && Math.floor(t * 3 + i) % 3 === 0) p.circle(40, 20, 2.4, '#7bd88f');
      c.restore();
      e.tips[i] = [tx - 33, ty + 14];
      p.use('body');
    };
    for (let i = 0; i < 4; i++) leg(32 - i * 22, 16, i, true);
    claw(true);
    for (let i = 0; i < 3; i++) tail(i);
    // mesosoma: overlapping armour plates
    p.poly([-82, 16, -78, -6, -50, -18, 0, -22, 40, -18, 52, 6, 48, 34, 0, 42, -50, 40, -78, 32], true);
    for (let k = 0; k < 6; k++) { const x = -64 + k * 18; p.curve(x, -18, x + 6, 12, x, 40); }
    c.save(); c.globalAlpha = 0.45; p.curve(-72, -2, -10, -16, 42, -6); c.restore();
    D.hatch(p, -68, 32, 42, 36, 8, 5, -1.4);
    // prosoma (carapace) with eyes and jaws
    p.poly([38, -16, 62, -20, 84, -10, 94, 10, 88, 32, 50, 38, 40, 20], true);
    c.save(); c.globalAlpha = 0.5; p.line(58, -18, 62, 32); c.restore();
    D.eye(p, 70, -10, 3.4, e, 1);
    p.dot(82, -6, 1.5); p.dot(86, -2, 1.3); p.dot(84, 2, 1.2);
    p.poly([90, 12, 104, 10, 104, 22, 90, 26], true);
    for (let i = 0; i < 4; i++) leg(36 - i * 22, 24, i, false);
    claw(false);
  };

  // ---------- the wasp swarm: a queen wasp leading a swarm of real, individually flying wasps ----------
  // one small wasp (drawn in world coordinates by the swarm, and around the queen on the boss card)
  D.wasp = function (p, x, y, s, dir, t, seed, alpha) {
    const c = p.ctx;
    c.save(); c.translate(x, y); c.scale(dir * s, s); c.lineWidth = 1.3 / s;
    if (alpha != null) c.globalAlpha *= alpha;
    const f = Math.sin(t * 70 + seed * 7);
    c.save(); c.globalAlpha *= 0.55; p.ellipse(-1, -6 - f * 1.6, 5.2, 2.4, '#eef6ff', -0.4); p.ellipse(-4, -5 - f, 4, 2, '#eef6ff', -0.8); c.restore();
    p.ellipse(-6, 1.5, 6.2, 3.6, '#f6c90e', 0.25);
    c.save(); c.strokeStyle = '#2b1d08'; c.lineWidth = 1.6 / s; p.line(-8.5, -1.5, -9.5, 4.5); p.line(-5, -1.5, -5.5, 5); c.restore();
    p.line(-12, 3.5, -15, 5);
    p.ellipse(1, 0, 3.4, 3, '#3a2a10'); p.circle(5, -0.5, 2.6, '#f6c90e'); p.dot(6, -1.2, 1);
    p.line(6, -2.6, 9, -6);
    c.restore();
  };
  D.waspQueen = function () { return { w: 130, h: 100, draw(p, e, t) { D.drawWaspQueen(p, e, t); } }; };
  D.drawWaspQueen = function (p, e, t) {
    const c = p.ctx, mood = e.mood, held = e.held;
    const angry = mood === 'angry' || e.mode === 'hunt';
    const flying = e.flying || held, f = flying ? Math.sin(t * 55 + e.seed) : 0.4;
    // the swarm on a boss card (in the game the real wasps are drawn in world coordinates)
    if (!e.wasps) for (let k = 0; k < 16; k++) { const a = k * 2.399 + t * 0.6; const r = 52 + (k % 4) * 9; D.wasp(p, Math.cos(a) * r * 1.15, Math.sin(a) * r * 0.75, 1.15, Math.cos(a + 1.6) > 0 ? 1 : -1, t, k); }
    // wings (two pairs, a blur when flying)
    c.save(); c.globalAlpha *= 0.55; p.use('wing');
    p.ellipse(4, -30 - f * 6, 30, 10, true, -0.5 - f * 0.2); p.ellipse(-8, -24 - f * 4, 24, 8, true, -0.85 - f * 0.15);
    c.restore();
    // legs dangling under the thorax
    p.use('dark');
    for (let k = 0; k < 3; k++) { const x = 6 + k * 9, sw = Math.sin(t * 6 + k) * 3; p.line(x, 6, x - 4 + sw, 22); p.line(x - 4 + sw, 22, x - 8 + sw, 34); }
    // abdomen with black bands and a stinger
    p.use('body');
    p.ellipse(-30, 12, 34, 20, true, 0.32);
    c.save(); c.strokeStyle = '#2b1d08'; c.lineWidth *= 2.6;
    p.curve(-22, -6, -14, 14, -26, 32); p.curve(-38, -2, -30, 18, -44, 30); p.curve(-52, 6, -46, 20, -58, 26);
    c.restore();
    p.use('dark'); p.poly([-62, 22, -80, 30, -62, 30], true);
    p.ellipse(4, 2, 5, 4, true, 0);                                 // waist
    p.ellipse(18, -4, 16, 13, true, 0);                             // thorax
    p.use('body'); p.circle(12, -10, 3, true); p.circle(24, -12, 2.5, true);
    // head
    p.ellipse(40, -6, 12, 13, true, 0);
    p.use('dark'); p.ellipse(43, -10, 5, 8, true, 0.2); p.circle(44.5, -13, 1.6, '#fff');
    if (angry) { c.save(); c.lineWidth *= 1.6; p.line(36, -22, 50, -16); c.restore(); }
    p.poly([46, 4, 56, 8, 48, 10], true); p.poly([44, 6, 52, 13, 44, 12], true);   // mandibles
    p.curve(42, -18, 52, -34, 62, -36); p.curve(38, -18, 44, -36, 54, -42);      // antennae
    p.use('gold'); p.poly([31, -17, 31, -27, 35, -21, 39, -29, 43, -21, 47, -26, 47, -16], true);   // queen's crown
    p.use('body');
  };

  // ---------- the beetle swarm: a king rhinoceros beetle and a carpet of crawling, climbing, biting beetles ----------
  const SHELLS = ['#2e8b57', '#1f6f8b', '#6a3d9a', '#8b3a1f', '#2f7d32', '#b8860b'];
  D.miniBeetle = function (p, x, y, s, dir, t, seed, alpha, flying, col) {
    const c = p.ctx;
    c.save(); c.translate(x, y); c.scale(dir * s, s); c.lineWidth = 1.3 / s;
    if (alpha != null) c.globalAlpha *= alpha;
    const ph = t * 22 + seed;
    for (let k = -1; k <= 1; k++) { const a = flying ? 0.6 : Math.sin(ph + k * 2) * 1.4; p.line(k * 3, 1, k * 3 - 2 + a, 5); }
    if (flying) { const f = Math.sin(t * 60 + seed * 5); c.save(); c.globalAlpha *= 0.55; p.ellipse(-2, -6 - f * 2, 6, 2.3, '#eef6ff', -0.6); p.ellipse(-5, -5 - f, 5, 2, '#eef6ff', -0.9); c.restore(); }
    const pts = []; for (let k = 0; k <= 8; k++) { const a = Math.PI + k * Math.PI / 8; pts.push(-1 + Math.cos(a) * 7, 1.5 + Math.sin(a) * 5.2); }
    p.poly(pts, col || '#2e8b57');
    c.save(); c.globalAlpha *= 0.6; c.strokeStyle = '#fff'; p.arc(-2, 1.5, 4, Math.PI + 0.6, Math.PI + 1.4); c.restore();
    p.circle(7, 0.5, 2.4, '#1a1a1a'); p.line(8.5, -0.5, 10.5, -4);
    c.restore();
  };
  D.beetleKing = function () { return { w: 170, h: 120, draw(p, e, t) { p.ctx.translate(-10, 4); D.drawBeetleKing(p, e, t); } }; };
  D.drawBeetleKing = function (p, e, t) {
    const c = p.ctx, mood = e.mood, held = e.held;
    const walking = e.moving && e.grounded && !held;
    const angry = mood === 'angry' || e.mode === 'hunt';
    const G = 56, ph = e.phase * 2;
    if (!e.wasps) for (let k = 0; k < 14; k++) { const x = -78 + k * 13 + (k % 2) * 4; D.miniBeetle(p, x, G - 4 - (k % 3 === 0 ? 0 : 0), 1.2, k % 2 ? 1 : -1, t, k, 1, false, SHELLS[k % SHELLS.length]); }
    const leg = (ax, i, far) => {
      const a = ph + i * 2.1 + (far ? Math.PI : 0), step = walking ? Math.sin(a) * 9 : held ? Math.sin(t * 12 + i) * 8 : 0, lift = walking ? Math.max(0, Math.cos(a)) * 6 : held ? 12 : 0;
      const spread = (1 - i) * 22, kx = ax + spread * 0.5 + step * 0.4, ky = 6 + (far ? -4 : 0), fx = ax + spread * 1.3 + step, fy = G - lift - (far ? 4 : 0);
      p.use(far ? 'far' : 'dark');
      D.slab(p, ax, 10, kx, ky, far ? 6 : 7); D.slab(p, kx, ky, fx, fy, far ? 4 : 5);
      for (let k = 1; k <= 2; k++) { const u = k / 3, x = kx + (fx - kx) * u, y = ky + (fy - ky) * u; p.line(x, y, x - 4, y - 2); }
      p.use('body');
    };
    for (let i = 0; i < 3; i++) leg(28 - i * 30, i, true);
    // wing cases (elytra): a big glossy dome
    p.use('body');
    const dome = []; for (let k = 0; k <= 16; k++) { const a = Math.PI + k * Math.PI / 16; dome.push(-14 + Math.cos(a) * 56, 18 + Math.sin(a) * 44); }
    p.poly(dome, true);
    c.save(); c.globalAlpha *= 0.45; p.curve(-60, 12, -14, -30, 38, 8); c.restore();
    c.save(); c.globalAlpha *= 0.7; c.strokeStyle = '#fff'; c.lineWidth *= 1.6; p.arc(-22, 16, 34, Math.PI + 0.5, Math.PI + 1.2); c.restore();
    for (let k = 0; k < 6; k++) p.dot(-50 + k * 14, 6 - Math.abs(k - 2.5) * 4, 1.2);
    // pronotum with its own short horn
    p.ellipse(44, 0, 22, 20, true, 0);
    p.use('horn'); p.poly([40, -18, 54, -30, 50, -14], true);
    // head and the great curved horn
    p.use('dark'); p.ellipse(66, 10, 11, 10, true, 0);
    p.use('horn'); D.tube(p, 70, 4, 96, -6, 92, -46, 12, 4, 8, true);
    p.poly([90, -44, 98, -56, 94, -42], true); p.poly([88, -42, 84, -56, 92, -44], true);
    if (angry) { p.circle(70, 6, 3.2, '#ff3b30'); p.dot(70.5, 6, 1.2); } else D.eye(p, 70, 6, 2.8, e, 1);
    p.line(74, 16, 80, 20); p.line(76, 14, 82, 15);
    p.use('gold'); p.poly([32, -20, 32, -30, 36, -24, 40, -32, 44, -24, 48, -29, 48, -19], true);   // king's crown
    for (let i = 0; i < 3; i++) leg(32 - i * 30, i, false);
    p.use('body');
  };

  // ---------- stinger (what the giant scorpion fires; you can type it too) ----------
  SB.def('stinger', {
    cat: 'item', aliases: ['scorpion stinger', 'stingers', 'poison spine', 'poison barb', 'poison dart'], tags: ['item', 'poison', 'sharp'],
    mass: 0.5, gravity: 0.5, bounce: 0, noCollide: true, special: 'venom',
    t: { w: 30, h: 12, draw(p) { p.poly([-14, -3, 6, -4, 15, 0, 6, 4, -14, 3], true); p.line(-14, 0, -19, -4); p.line(-14, 0, -19, 4); } },
    hint: 'A poison stinger!'
  });

  // ---------- icicle (what the ice golem throws; you can type it too) ----------
  SB.def('icicle', {
    cat: 'item', aliases: ['ice shard', 'ice spike', 'ice spear', 'icicles', 'ice dagger', 'frost shard', 'ice shards', 'ice dart'], tags: ['item', 'ice', 'cold', 'sharp'],
    mass: 1, gravity: 0.7, bounce: 0, noCollide: true, special: 'icicle',
    t: { w: 14, h: 40, draw(p) { p.poly([-6, -18, 6, -18, 2, 4, 0, 20, -2, 4], true); p.line(-2, -14, -1, 0); } },
    hint: 'Sharp and freezing cold!'
  });

  // ---------- web (what the giant spider spits; you can type it too) ----------
  SB.def('web', {
    cat: 'item', aliases: ['spider web', 'spiderweb', 'cobweb', 'webbing', 'sticky web', 'spider net', 'webs', 'cob web'], tags: ['item', 'web', 'sticky'],
    mass: 0.3, gravity: 0.15, bounce: 0, friction: 30, noCollide: true, special: 'web',
    t: { w: 44, h: 44, draw(p, e, t) {
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; p.line(0, 0, Math.cos(a) * 22, Math.sin(a) * 22); }
      for (let r = 7; r <= 21; r += 7) { const pts = []; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + 0.2; pts.push(Math.cos(a) * r, Math.sin(a) * r); } p.poly(pts, false); }
    } },
    hint: 'Sticky! Traps whatever touches it.'
  });

  // ---------- boss definitions ----------
  const B = (name, spec) => SB.def(name, SB.merge({
    cat: 'boss', boss: true, creature: true, move: 'walk', temper: 'hostile', bounce: 0.05, friction: 6, huntR: 720,
    tags: ['boss', 'monster', 'big', 'scary', 'villain', 'predator'], fears: [], hunts: [], eats: [], heldMood: 'angry'
  }, spec));

  B('kraken', {
    t: D.kraken(), aliases: ['the kraken', 'giant octopus', 'giant squid', 'sea monster', 'sea beast', 'kracken', 'craken', 'cthulhu', 'leviathan', 'tentacle monster'],
    move: 'crawl', speed: 55, mass: 90, hp: 45, jump: 200, tags: ['sea', 'wet'], weak: ['fire', 'hot'], special: 'tentacles',
    hunts: ['boat', 'ship', 'pirate', 'sailor', 'fish', 'human'], eats: ['boat', 'ship', 'fish'],
    say: ['*gurgle*', 'Mine. All mine.', 'Release the kraken!', '*sloosh*'], roar: ['RAAAWWWR!', '*SPLOOSH!*', 'GRAAAB!'],
    weakSay: ['Not fire! Calamari!', 'Hsss! Too hot!', 'I\'m cooking!'],
    power: 'Grabs anything nearby with a tentacle and flings it across the sky. Eats boats.', weakText: 'fire and anything hot',
    hint: 'The kraken flings things with its tentacles! Weak to fire.',
    onHurt(e, W) { W.burst('ink', e.x, e.y + 20, 8, 160, { size: 9, life: 0.9, g: 300 }); if (Math.random() < 0.4) e.say('*INK!*'); }
  });
  B('mega robot', {
    t: D.megaRobot(), aliases: ['giant robot', 'megabot', 'mecha', 'mech', 'robot boss', 'war robot', 'battle robot', 'huge robot', 'big robot', 'killer robot', 'evil robot', 'megatron', 'megarobot', 'titan robot', 'giant mech'],
    speed: 60, mass: 120, hp: 50, jump: 260, tags: ['robot', 'metal', 'machine'], weak: ['water', 'magnet', 'lightning', 'electric'], special: 'laser',
    hunts: ['human', 'hero', 'animal', 'monster', 'vehicle', 'robot'], eats: ['battery'],
    say: ['DESTROY. DESTROY.', 'SCANNING...', 'RESISTANCE IS FUTILE', 'BEEP. BOOP. DOOM.'], roar: ['EXTERMINATE!', 'LASER ONLINE!', 'CRUSH!'],
    weakSay: ['ERROR! ERROR!', 'SHORT CIRCUIT!', 'DOES NOT COMPUTE!', 'SYSTEM FAILURE!'],
    power: 'Locks on, charges up, and fires an eye laser that zaps and burns everything in its path.', weakText: 'water, magnets and lightning',
    hint: 'The mega robot fires eye lasers! Weak to water and magnets.',
    onHurt(e, W) { W.burst('spark', e.x + (Math.random() - 0.5) * e.w * 0.5, e.y, 6, 180, { size: 6 }); }
  });
  B('king kong', {
    t: D.kong(), aliases: ['kong', 'giant ape', 'giant gorilla', 'gorilla king', 'ape king', 'big ape', 'mega gorilla', 'kingkong', 'monster ape', 'giant monkey', 'huge gorilla'],
    speed: 100, mass: 100, hp: 55, jump: 560, tags: ['ape', 'furry'], weak: ['plane', 'jet', 'helicopter'], special: 'pound',
    hunts: ['plane', 'helicopter', 'jet', 'human', 'hero', 'vehicle', 'monster', 'animal'], eats: ['banana'],
    say: ['*chest thump*', 'ME KING!', 'Grunt.', 'Hrrmph!'], roar: ['RAAAAAAAH!', 'KONG SMASH!', 'GRAAAH!'],
    weakSay: ['Curse those planes!', 'RAAAGH! Planes!', 'Not the planes!'],
    power: 'Beats its chest, leaps, and slams the ground so hard everything nearby goes flying. Swats anything that flies too close.', weakText: 'planes, jets and helicopters',
    hint: 'King Kong ground-pounds! Weak to planes.',
    onHurt(e, W) { e.setMood('angry', 1.5); if (Math.random() < 0.3) e.say(pick(['GRRR!', 'RAAH!'])); }
  });
  B('hydra', {
    t: D.hydra(), aliases: ['three headed dragon', '3 headed dragon', 'three headed monster', 'three headed snake', 'hidra', 'hydra dragon', 'many headed dragon', 'the hydra', 'multi headed dragon', 'triple dragon', 'three head dragon'],
    speed: 80, mass: 95, hp: 40, jump: 380, tags: ['dragon', 'reptile', 'scaly'], weak: ['cold', 'ice', 'snow'], special: 'hydra', fireproof: true,
    hunts: ['knight', 'hero', 'human', 'animal', 'monster', 'vehicle'], eats: ['sheep', 'cow', 'pig', 'goat', 'chicken', 'deer'],
    say: ['Hisssss...', 'Three heads are better than one.', '*hiss hiss hiss*', 'Which head is talking?'], roar: ['HISSSSS!', 'ROAAAR!', '*TRIPLE ROAR*'],
    weakSay: ['Too c-c-cold!', 'Brrr! Hsss!', 'I hate snow!'],
    power: 'Three heads, three streams of fire. Slowly heals itself, so hit it hard and fast.', weakText: 'snow, ice and anything cold',
    hint: 'The hydra breathes fire from three heads and heals itself! Weak to cold.',
    onHurt(e, W) { if (Math.random() < 0.4) e.say('HISSS!'); }
  });
  B('lava golem', {
    t: D.lavaGolem(), aliases: ['lava monster', 'magma golem', 'rock monster', 'rock golem', 'golem', 'stone giant', 'lava giant', 'magma monster', 'volcano monster', 'fire golem', 'fire monster', 'molten monster', 'stone golem', 'rock giant', 'lava man', 'magma man', 'fire giant'],
    speed: 45, mass: 130, hp: 50, jump: 220, tags: ['fire', 'hot', 'rock', 'stone'], weak: ['water', 'cold', 'rain', 'snow', 'ice'], special: 'lob', fireproof: true,
    hunts: ['human', 'hero', 'animal', 'monster', 'vehicle', 'snowman', 'tree'], eats: [],
    say: ['*rumble*', 'Burn... burn...', '*crackle*', 'Hot enough for you?'], roar: ['GRRRAAAH!', 'BURN!', '*ERUPTION*'],
    weakSay: ['HSSSSSS!', 'I\'m cooling down!', 'No! Water!', '*sizzle*'],
    power: 'Everything it touches catches fire, and it lobs exploding fireballs at anything it sees.', weakText: 'water, rain, snow and ice',
    hint: 'The lava golem sets things on fire and throws fireballs! Weak to water.',
    onHurt(e, W) { W.burst('rock', e.x, e.y, 5, 200, { size: 6, g: 900, life: 0.8 }); }
  });
  B('giant spider', {
    t: D.spider(), aliases: ['spider boss', 'huge spider', 'big spider', 'spider queen', 'spider king', 'giant tarantula', 'monster spider', 'mega spider', 'shelob', 'aragog', 'spider monster', 'huge tarantula', 'giant spyder', 'enormous spider', 'massive spider', 'giant arachnid', 'giant tarantula spider'],
    move: 'crawl', speed: 130, mass: 70, hp: 45, jump: 500, tags: ['bug', 'creepy', 'arachnid', 'spider', 'hairy'], weak: ['fire', 'hot', 'boot', 'shoe'], special: 'webshot', venom: true, kin: ['spider'],
    hunts: ['bug', 'fly', 'bird', 'human', 'hero', 'animal', 'monster'], eats: ['fly', 'mosquito', 'bee', 'butterfly', 'moth', 'ant'],
    say: ['*skitter skitter*', 'Come into my parlour...', '*hisssk*', 'Eight legs, eight eyes, no mercy.'], roar: ['SKREEEE!', '*HISSSK!*', 'WEBBED!'],
    weakSay: ['Not fire! NOT FIRE!', 'SKREEE! Hot!', 'Squish?! Never!', 'Not the shoe!'],
    power: 'Spits sticky webs that wrap its prey so it can\'t move, bites with venom that leaves victims dizzy, and hatches spiderlings.', weakText: 'fire, and a good stomp with a boot or shoe',
    hint: 'The giant spider webs things up! Weak to fire and shoes.',
    onHurt(e, W) { if (Math.random() < 0.4) e.say('SKREE!'); e.setMood('angry', 1); }
  });
  B('giant moth', {
    t: D.moth(), aliases: ['mothra', 'moth boss', 'huge moth', 'mega moth', 'monster moth', 'moth queen', 'queen moth', 'kaiju moth', 'moth kaiju', 'moth monster', 'enormous moth', 'motra', 'mothera', 'giant butterfly', 'butterfly boss', 'giant moth monster', 'flying boss', 'sky boss'],
    move: 'fly', speed: 170, mass: 60, hp: 45, jump: 300, flyMin: 0.08, flyMax: 0.5, tags: ['bug', 'insect', 'moth', 'winged'], weak: ['fire', 'hot', 'cold', 'ice', 'snow'], special: 'moth', kin: ['moth', 'butterfly'],
    hunts: ['light', 'lamp', 'human', 'hero', 'monster', 'vehicle', 'animal'], eats: ['flower'],
    say: ['*flutter flutter*', '*shimmer*', 'The light... the light...', '*wings beating like thunder*'], roar: ['SCREEEE!', '*PRISM BEAM*', '*HURRICANE WINGS*'],
    weakSay: ['My wings! Fire!', 'SCREE! Hot!', 'Too cold to fly!', 'Not the flame...'],
    power: 'Hovers out of reach and fires prism beams from its antennae at long range, then beats its wings into a gale of poison scales that sweeps everything away.', weakText: 'fire and cold (it can\'t resist a bright light, which is how it ends up in a flame)',
    hint: 'The giant moth fires antenna beams from the sky! Weak to fire and cold.',
    onHurt(e, W) { W.burst('sparkle', e.x, e.y, 6, 120, { size: 4, life: 0.8, g: 200 }); if (Math.random() < 0.4) e.say('SCREE!'); }
  });
  B('ice golem', {
    t: D.iceGolem(), aliases: ['ice monster', 'frost golem', 'ice giant', 'frost giant', 'ice titan', 'snow golem', 'frost monster', 'ice man', 'iceman', 'ice boss', 'frost boss', 'ice elemental', 'glacier golem', 'ice king', 'frost king', 'crystal golem', 'ice golum', 'ice golam'],
    speed: 50, mass: 120, hp: 50, jump: 240, tags: ['ice', 'cold', 'snow', 'frost', 'golem', 'elemental'], weak: ['hammer', 'pickaxe', 'baseball bat', 'bowling ball'], special: 'frost', fireproof: true, frost: true,
    hunts: ['fire', 'hot', 'dragon', 'human', 'hero', 'monster', 'animal', 'vehicle'], eats: ['ice cream', 'snowball'],
    say: ['*creak*', 'Cold... so cold...', '*crackle*', 'Winter is here.'], roar: ['FREEZE!', '*SHATTER*', 'ICE AGE!'],
    weakSay: ['CRACK! My crystals!', 'Not the hammer!', '*shatter*', 'I\'m cracking!'],
    power: 'Hurls volleys of icicles that freeze whatever they hit, and breathes a blizzard that freezes everything in front of it. Fire can\'t touch it, and it snuffs out flames and burning things on contact.', weakText: 'hammers, pickaxes, bats and bowling balls (cannonballs shatter it)',
    hint: 'The ice golem freezes things solid and laughs at fire! Weak to hammers.',
    onHurt(e, W) { W.burst('shard', e.x, e.y, 6, 200, { size: 6, g: 900, life: 0.8 }); if (Math.random() < 0.3) e.say('*crack*'); }
  });
  B('giant snake', {
    t: D.snakeBoss(), aliases: ['king snake', 'huge snake', 'giant cobra', 'big snake', 'snake boss', 'serpent boss', 'giant serpent', 'basilisk', 'monster snake', 'mega snake', 'titanoboa', 'poison snake', 'venom snake', 'giant python', 'giant anaconda', 'nagini', 'kaa', 'snake king', 'cobra king', 'poisonous snake', 'venomous snake'],
    move: 'crawl', speed: 110, mass: 80, hp: 48, jump: 260, tags: ['snake', 'reptile', 'scaly', 'poisonous'], weak: ['cold', 'ice', 'snow', 'eagle', 'hawk', 'mongoose', 'radio', 'guitar', 'piano', 'drum', 'flute', 'music'], special: 'spitvenom', poison: true, kin: ['snake', 'cobra', 'python', 'rattlesnake'],
    hunts: ['mouse', 'rat', 'rabbit', 'bird', 'frog', 'egg', 'human', 'hero', 'animal', 'monster'], eats: ['mouse', 'rat', 'egg', 'frog', 'chick', 'rabbit'],
    say: ['Sssssss...', 'Trussst in me...', '*hiss*', 'Ssso many sssnacks.'], roar: ['HISSSSSS!', '*STRIKE*', 'SSSPIT!'],
    weakSay: ['Too c-c-cold!', 'Not the mussssic!', 'Sssstop that!', 'An eagle?! Ssscatter!'],
    power: 'Spits venom at long range, breathes a poison cloud up close, and every bite poisons. Poisoned creatures turn green, slow down and keep losing health until it wears off, or until a doctor, ambulance or bucket of water cures them.', weakText: 'cold, eagles, and music (snake charmers!)',
    hint: 'The giant snake spits venom that poisons! Weak to cold and music.',
    onHurt(e, W) { if (Math.random() < 0.4) e.say('HISSS!'); }
  });
  B('giant angry bull', {
    t: D.bullBoss(), aliases: ['angry bull', 'angry giant bull', 'huge angry bull', 'big angry bull', 'enormous angry bull', 'mad bull', 'giant mad bull', 'raging bull', 'giant raging bull', 'bull boss', 'angry bull boss', 'mega bull', 'monster bull', 'bull king', 'king bull', 'el toro', 'toro', 'fighting bull', 'super bull', 'colossal bull', 'titan bull', 'angry bulls'],
    speed: 120, chargeSpeed: 720, mass: 140, hp: 60, jump: 300, tags: ['bull', 'cattle', 'horned', 'furry'], weak: ['cowboy', 'farmer'], special: 'bullcharge', kin: ['bull', 'cow'], roarSfx: 'bellow',
    hunts: ['flag', 'human', 'hero', 'animal', 'vehicle', 'monster'], eats: ['grass', 'hay'],
    say: ['*SNORT*', 'MOOOOO.', '*stamps hoof*', 'Seeing red...'], roar: ['MOOOOOOO!', '*SNORT*', 'CHARGE!'],
    weakSay: ['A lasso?! No!', 'Not a cowboy!', 'MOO! Let go!'],
    power: 'Paws the ground and snorts steam, then charges across the screen tossing everything in its path into the sky. Rears up and stomps anything that gets too close.', weakText: 'charging into trees, houses and walls (it knocks itself silly), and cowboys',
    hint: 'The angry bull charges! Lure it into a tree or a house.',
    onHurt(e, W) { if (Math.random() < 0.35) e.say(pick(['SNORT!', 'MOO!'])); e.setMood('angry', 2); }
  });
  B('giant scorpion', {
    t: D.scorpion(), aliases: ['three tailed scorpion', '3 tailed scorpion', 'three tail scorpion', 'triple tailed scorpion', 'triple tail scorpion', 'tri tail scorpion', 'scorpion boss', 'scorpion king', 'huge scorpion', 'mega scorpion', 'big scorpion', 'monster scorpion', 'emperor scorpion', 'giant skorpion', 'giant scorpian', 'scorpian boss', 'three tailed scorpian'],
    move: 'crawl', speed: 115, mass: 90, hp: 52, jump: 340, tags: ['bug', 'arachnid', 'scorpion', 'creepy', 'armored'], weak: ['boot', 'shoe', 'cold', 'ice', 'snow', 'chicken', 'rooster'], special: 'scorpion', poison: true, kin: ['scorpion'], roarSfx: 'screech',
    hunts: ['bug', 'spider', 'human', 'hero', 'animal', 'monster', 'vehicle'], eats: ['bug', 'fly', 'beetle', 'ant', 'grasshopper', 'spider', 'mouse'],
    say: ['*clack clack*', 'Three tails, no waiting.', '*skitter*', 'Pinch, pinch, sting.'], roar: ['SKREEEEK!', '*CLACK CLACK*', '*TRIPLE STING*'],
    weakSay: ['Not the boot!', 'Chickens?! RUN!', 'Too c-c-cold!'],
    power: 'Snaps its giant pincers to fling enemies over its back, strikes three times in a row with its three tails, and fires poison stingers at anything far away. Every sting poisons.', weakText: 'a stomp with a boot or shoe, cold, and chickens (they eat scorpions!)',
    hint: 'The three-tailed scorpion stings three times! Weak to boots and cold.',
    onHurt(e, W) { if (Math.random() < 0.35) e.say('SKREEK!'); }
  });
  B('wasp swarm', {
    t: D.waspQueen(), aliases: ['wasps', 'swarm', 'swarm of wasps', 'wasp nest', 'wasp queen', 'queen wasp', 'angry wasps', 'killer wasps', 'giant wasp', 'wasp boss', 'hornets', 'hornet swarm', 'murder hornets', 'murder hornet', 'killer bees', 'bee swarm', 'swarm of bees', 'angry bees', 'killer bee swarm', 'bees', 'wasp army', 'hive'],
    move: 'fly', speed: 150, mass: 40, hp: 40, jump: 300, flyMin: 0.12, flyMax: 0.5, tags: ['bug', 'insect', 'wasp', 'winged', 'swarm'], weak: ['fire', 'hot', 'water', 'rain', 'smoke', 'cold', 'ice', 'snow'], special: 'swarm', kin: ['bee', 'wasp', 'hornet'], roarSfx: 'buzz',
    hunts: ['human', 'hero', 'animal', 'monster', 'flower', 'honey'], eats: ['honey', 'flower'],
    say: ['*bzzzzzzz*', 'BZZZ! Get them, girls!', '*angry buzzing*', 'You disturbed the nest!'], roar: ['BZZZZZZZ!', 'SWARM!', 'STING THEM!'],
    weakSay: ['Not fire! BZZT!', 'My wings are wet!', 'SMOKE! Scatter!', 'Too c-c-cold to fly!'],
    power: 'A queen wasp and her swarm. The swarm splits up to mob up to three enemies at once, stinging over and over, while the queen hatches new wasps. Every wasp you take out weakens the swarm.', weakText: 'fire, smoke, water and rain (wasps that fly into them die), cold, fans that blow them away, and explosions. You can also SWAT wasps by clicking on them!',
    hint: 'The wasp swarm mobs everything! Click wasps to swat them, or use fire and water.',
    onHurt(e, W) { if (Math.random() < 0.3) e.say('BZZT!'); }
  });
  B('beetle swarm', {
    t: D.beetleKing(), aliases: ['beetles', 'swarm of beetles', 'beetle army', 'beetle king', 'king beetle', 'giant beetle', 'beetle boss', 'bug swarm', 'swarm of bugs', 'bugs', 'cockroaches', 'roaches', 'cockroach swarm', 'scarabs', 'scarab swarm', 'rhino beetle', 'rhinoceros beetle', 'stag beetles', 'beatles', 'beetle swarm boss', 'creepy crawlies', 'insects'],
    move: 'crawl', speed: 90, mass: 60, hp: 44, jump: 300, tags: ['bug', 'insect', 'beetle', 'swarm', 'armored'], weak: ['boot', 'shoe', 'chicken', 'rooster', 'water', 'rain', 'fire', 'hot'], special: 'swarm', swarmKind: 'beetle', kin: ['beetle', 'bug', 'ant', 'ladybug', 'scarab', 'cockroach'], roarSfx: 'skitter',
    hunts: ['human', 'hero', 'animal', 'monster', 'food', 'poop'], eats: ['food', 'poop', 'leaf'],
    say: ['*click click click*', 'Crawl, my beetles!', '*skitter skitter*', 'Our shells are unbreakable!'], roar: ['CHARGE, BEETLES!', '*CLICK CLICK*', 'SWARM THEM!'],
    weakSay: ['Not the boot! NOT THE BOOT!', 'A chicken?! Scatter!', 'We can\'t swim!', 'Our shells are melting!'],
    power: 'A king rhinoceros beetle and a carpet of armored beetles. They swarm across the ground, climb up their victims and bite, splitting up to attack three enemies at once, and fly up after anything in the air. Armored shells: a swat only cracks a beetle, the second one squashes it.', weakText: 'stomps (boots, shoes, and big ground-pounds crush them), chickens, birds and frogs (they eat beetles), water and rain, and fire. Click beetles to swat them twice!',
    hint: 'The beetle swarm crawls all over everything! Bring chickens, or stomp them.',
    onHurt(e, W) { if (Math.random() < 0.3) e.say('*CLICK!*'); }
  });
  SB.BOSSES = ['kraken', 'mega robot', 'king kong', 'hydra', 'lava golem', 'giant spider', 'giant moth', 'ice golem', 'giant snake', 'giant angry bull', 'giant scorpion', 'wasp swarm', 'beetle swarm'];
  SB.WORDS.boss = SB.WORDS.bosses = 'kraken'; // typing "boss" summons a random one (see SB.findWord)

  // ---------- boss attacks (run every frame by the game loop via SB.SPECIALS) ----------
  const S = SB.SPECIALS = SB.SPECIALS || {};
  const ready = e => !(e.ko || e.held || e.dizzy > 0 || e.sleeping || e.spawnT < 1 || e.frozenT > 0 || e.webT > 0);
  const foe = (e, o) => o !== e && o.alive && !o.dying && !o.static && !o.held && o.def.name !== e.def.name;

  // kraken: grab the nearest thing and fling it
  S.tentacles = function (e, dt, W) {
    e.specT -= dt; if (e.whipT > 0) e.whipT -= dt;
    if (e.specT > 0 || !ready(e)) return;
    const R = 150 * e.scale; let best = null, bd = R;
    for (const o of W.entities) { if (!foe(e, o) || o.mass > 60 || o.def.boss || o.special === 'fireball') continue; const d = Math.hypot(o.x - e.x, o.y - e.y); if (d < bd) { bd = d; best = o; } }
    if (!best) { e.specT = 0.4; return; }
    W.sfx('whoosh', e.x); e.specT = 2.8; e.whipT = 0.5; e.facing = best.x >= e.x ? 1 : -1;
    const dir = Math.random() < 0.5 ? -1 : 1;
    best.vx = dir * (450 + Math.random() * 350); best.vy = -(600 + Math.random() * 300); best.grounded = false; best.angVel = (Math.random() - 0.5) * 18;
    if (best.creature) { W.hurt(best, 2, e, { quiet: true }); best.say(pick(['Wheeee!', 'AAAAH!', 'Put me down!', 'Whoa!'])); best.dizzy = Math.max(best.dizzy, 1); }
    else W.popText(best.x, best.top, 'Fling!', 16);
    e.say(pick(e.def.roar)); W.shake(6); W.burst('drop', best.x, best.y, 6, 150, { size: 5, g: 600 });
  };

  // mega robot: charge, then fire an eye laser along a line
  S.laser = function (e, dt, W) {
    e.specT -= dt; if (e.laserT > 0) e.laserT -= dt;
    if (e.charge > 0) {
      e.charge -= dt;
      if (Math.random() < dt * 25) W.particle('spark', e.x + e.facing * 22 * e.scale, e.y - 82 * e.scale, { vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80, life: 0.2, size: 5 });
      if (e.charge <= 0) fireLaser(e, W);
      return;
    }
    if (e.specT > 0 || !ready(e)) return;
    const tg = e.target;
    if (tg && tg.alive && !tg.dying && !tg.ko) {
      const dx = (tg.x - e.x) * e.facing;
      if (dx > 20 && dx < 480 * e.scale && Math.abs(tg.y - e.y) < 220 * e.scale) { e.charge = 0.6; e.specT = 4.5; e.aim = tg; e.say(pick(['TARGET LOCKED', 'CHARGING LASER...', 'INITIATE DESTRUCTION'])); return; }
    }
    e.specT = 0.3;
  };
  // a straight energy beam from (ex,ey) along (ax,ay): everything near the line gets zapped
  function beam(e, W, ex, ey, ax, ay, L, dmg, burn) {
    const tx = ex + ax * L, ty = ey + ay * L;
    let hits = 0;
    for (const o of W.entities) {
      if (o === e || !o.alive || o.dying || o.static || SB.kin(e, o)) continue;
      const px = o.x - ex, py = o.y - ey, s = px * ax + py * ay;
      if (s < 0 || s > L) continue;
      const dist = Math.hypot(o.x - (ex + ax * s), o.y - (ey + ay * s));
      if (dist > 26 + Math.max(o.w, o.h) * 0.35) continue;
      const m = Math.min(1, 6 / Math.sqrt(o.mass));
      o.vx += ax * 380 * m; o.vy -= 320 * m; o.grounded = false; o.angVel += (Math.random() - 0.5) * 10;
      if (o.creature) { W.hurt(o, dmg, e, { quiet: true }); o.say(pick(['ZAP!', 'AAAH!', 'Yeow!'])); o.dizzy = Math.max(o.dizzy, 1); }
      if (burn) W.burn(o, e, 0.1);
      if (o.special === 'bomb') o.fuse = Math.min(o.fuse, 0.1);
      W.burst('spark', o.x, o.y, 8, 200, { size: 7 }); hits++;
    }
    W.particle('beamline', ex, ey, { life: 0.35, size: 0, tx, ty }); W.particle('beamline', ex, ey + 4, { life: 0.3, size: 0, tx, ty: ty + 4 });
    return hits;
  }
  function fireLaser(e, W) {
    const ex = e.x + e.facing * 24 * e.scale, ey = e.y - 84 * e.scale;
    const tg = e.aim; let ax = e.facing, ay = 0;
    if (tg && tg.alive) { const dx = tg.x - ex, dy = tg.y - ey, d = Math.hypot(dx, dy) || 1; if (dx * e.facing > 0) { ax = dx / d; ay = dy / d; } }
    e.laserT = 0.35; e.aim = null; W.sfx('laser', e.x);
    const hits = beam(e, W, ex, ey, ax, ay, 560 * e.scale, 4, true);
    W.flash = 0.35; W.shake(9); W.popText(ex + ax * 90, ey - 30, hits ? 'ZZZAP!' : 'PEW!', 26);
    e.say(pick(e.def.roar));
  }

  // giant moth: prism beams from the antennae, and a gale of poison scales from its wings
  S.moth = function (e, dt, W) {
    e.specT -= dt; e.galeT -= dt; if (e.laserT > 0) e.laserT -= dt;
    if (e.flying && Math.random() < dt * 5) W.particle('sparkle', e.x + (Math.random() - 0.5) * e.w * 0.9, e.y + (Math.random() - 0.5) * e.h * 0.5, { vy: 40, life: 0.9, size: 4, g: 60 });
    if (e.gustT > 0) {
      e.gustT -= dt;
      const R = 560 * e.scale;
      for (const o of W.entities) {
        if (o === e || !o.alive || o.dying || o.static || o.held || SB.kin(e, o)) continue;
        const dx = (o.x - e.x) * e.facing;
        if (dx < -60 || dx > R || o.y < e.y - 80 * e.scale) continue;
        const k = 1 - Math.max(0, dx) / R, m = Math.min(1, 4 / Math.sqrt(o.mass));
        o.vx += e.facing * 1500 * dt * k * m; o.vy -= 350 * dt * k * m; o.grounded = false;
        if (o.creature && o.gustId !== e.galeId) { o.gustId = e.galeId; W.hurt(o, 1, e, { quiet: true }); o.dizzy = Math.max(o.dizzy, 0.8); o.say(pick(['Whoa!', 'Aaah!', '*cough* scales!'])); }
      }
      for (let k = 0; k < 2; k++) W.particle('wind', e.x + e.facing * (40 + Math.random() * R * 0.8), e.y + (Math.random() - 0.2) * 220, { vx: e.facing * 420, life: 0.4, size: 16 });
      if (Math.random() < dt * 30) W.particle('sparkle', e.x + e.facing * Math.random() * R * 0.8, e.y + (Math.random() - 0.3) * 160, { vx: e.facing * 150, vy: 60, g: 120, life: 0.9, size: 5 });
      return;
    }
    if (!ready(e)) return;
    const tg = e.target;
    if (!(tg && tg.alive && !tg.dying)) { if (e.specT <= 0) e.specT = 0.3; return; }
    const dx = tg.x - e.x, dy = tg.y - e.y, d = Math.hypot(dx, dy);
    if (e.galeT <= 0 && Math.abs(dx) < 520 * e.scale && d > 60) {
      W.sfx('wind', e.x); e.galeT = 8; e.gustT = 1.2; e.galeId = (e.galeId || 0) + 1; e.facing = dx >= 0 ? 1 : -1;
      e.say('*HURRICANE WINGS*'); W.shake(5); return;
    }
    if (e.specT <= 0 && d < 660 * e.scale && d > 70) {
      e.facing = dx >= 0 ? 1 : -1;
      const ex = e.x + e.facing * 60 * e.scale, ey = e.y;
      const ax = dx / d, ay = dy / d;
      e.laserT = 0.35; e.specT = 4;
      const hits = beam(e, W, ex, ey, ax, ay, 700 * e.scale, 3, false); W.sfx('laser', e.x, 0.8);
      W.flash = 0.25; W.shake(6); W.popText(ex + ax * 80, ey + ay * 80 - 20, hits ? 'ZZZAP!' : 'PEW!', 24);
      e.say(pick(['*PRISM BEAM*', 'SCREEEE!']));
      return;
    }
    if (e.specT <= 0) e.specT = 0.3;
  };

  // king kong: chest beat, leap, ground pound; swats flyers
  S.pound = function (e, dt, W) {
    e.specT -= dt; if (e.swatT > 0) e.swatT -= dt; e.swatCd = (e.swatCd || 0) - dt;
    if (e.beatT > 0) {
      e.beatT -= dt;
      if (Math.random() < dt * 10) W.particle('text', e.x + (Math.random() - 0.5) * 40, e.top + 30, { text: '!', size: 20, life: 0.4, vy: -40 });
      if (e.beatT <= 0 && e.grounded) { e.poundT = 0.55; e.vy = -230; e.grounded = false; }
      else if (e.beatT <= 0) e.beatT = 0.05;
      return;
    }
    if (e.poundT > 0) { const was = e.poundT; e.poundT -= dt; if (was > 0.25 && e.poundT <= 0.25) slam(e, W); return; }
    if (!ready(e)) return;
    if (e.swatCd <= 0) for (const o of W.entities) {
      if (!foe(e, o) || !o.flying) continue;
      if (Math.abs(o.x - e.x) < 90 * e.scale && o.y < e.y && o.y > e.top - 120 * e.scale) {
        W.sfx('heavy', o.x); e.swatT = 0.45; e.swatCd = 1.6; e.facing = o.x >= e.x ? 1 : -1;
        o.vx = e.facing * 500; o.vy = 520; o.angVel = 16; o.grounded = false;
        if (o.creature) { W.hurt(o, 3, e, { quiet: true }); o.say('Aaah!'); o.dizzy = Math.max(o.dizzy, 1.5); }
        W.popText(o.x, o.y - 20, 'SWAT!', 24); W.burst('spark', o.x, o.y, 8, 180, { size: 6 }); W.shake(6); e.say(pick(['RAAAH!', 'No planes!', 'Swat!']));
        break;
      }
    }
    if (e.specT > 0) return;
    const tg = e.target;
    if (tg && tg.alive && !tg.dying && !tg.flying && Math.abs(tg.x - e.x) < 300 * e.scale && e.grounded) { e.beatT = 1.0; e.specT = 6; W.sfx('beat', e.x); W.sfx('roar', e.x, 0.6); e.say(pick(['RAAAAAAH!', '*THUMP THUMP THUMP*', 'ME KING!'])); W.shake(4); }
    else e.specT = 0.4;
  };
  function slam(e, W) { W.stompWave(e, 360 * e.scale, 620, 3); W.popText(e.x, e.top - 30, 'THOOM!', 36); W.shake(20); W.flash = 0.15; e.say(pick(e.def.roar)); }

  // hydra: fire from three heads; regenerates
  S.hydra = function (e, dt, W) {
    e.specT -= dt; e.regenT -= dt;
    if (e.regenT <= 0) { e.regenT = 2.5; if (!e.ko && e.hp < e.hpMax) { e.hp++; e.lastHp = e.hp; W.particle('sparkle', e.x + (Math.random() - 0.5) * e.w * 0.5, e.top + 20, { vy: -30, life: 0.6, size: 6 }); } }
    if (e.breath > 0) {
      e.breath -= dt;
      for (let i = 0; i < 3; i++) {
        const M = D.hydraMouths[i];
        const mx = e.x + e.facing * M[0] * e.scale, my = e.y + M[1] * e.scale;
        const dx = Math.cos(M[2]) * e.facing, dy = Math.sin(M[2]);
        for (let k = 0; k < 2; k++) { const sp = 280 + Math.random() * 220; W.particle('flame', mx, my, { vx: dx * sp + (Math.random() - 0.5) * 60, vy: dy * sp + (Math.random() - 0.5) * 60, life: 0.35 + Math.random() * 0.2, size: 8 + Math.random() * 10 * e.scale }); }
        const R = 230 * e.scale;
        for (const o of W.entities) {
          if (o === e || !o.alive || o.dying || o.def.name === e.def.name) continue;
          const px = o.x - mx, py = o.y - my, s = px * dx + py * dy;
          if (s < 0 || s > R) continue;
          if (Math.abs(px * dy - py * dx) > 45 * e.scale + o.w * 0.3) continue;
          W.burn(o, e, dt);
        }
      }
      return;
    }
    if (e.specT > 0 || !ready(e)) return;
    const tg = e.target;
    if (tg && tg.alive && !tg.dying && (tg.x - e.x) * e.facing > 0 && Math.abs(tg.x - e.x) < 280 * e.scale && Math.abs(tg.y - e.y) < 220 * e.scale) { e.breath = 1.4; e.specT = 5.5; W.sfx('fire', e.x); W.sfx('roar', e.x, 0.5); e.say(pick(['HISSSSS!', '*FWOOSH FWOOSH FWOOSH*', 'Triple trouble!'])); }
    else e.specT = 0.3;
  };

  // giant spider: spit webs at prey, hatch spiderlings now and then
  S.webshot = function (e, dt, W) {
    e.specT -= dt; if (e.spitT > 0) e.spitT -= dt; e.eggT -= dt;
    if (e.eggT <= 0) {
      e.eggT = 12;
      if (ready(e) && W.entities.filter(o => o.alive && o.def.name === 'spider').length < 6) {
        for (let k = 0; k < 2; k++) { const s = W.spawn('spider', e.x - e.facing * 40 * e.scale, e.y, { quiet: true }); if (s) { s.vx = (k ? 1 : -1) * 180; s.vy = -260; s.grounded = false; } }
        e.say('*skitter skitter*'); W.popText(e.x, e.top - 30, 'Spiderlings!', 18);
      }
    }
    if (e.specT > 0 || !ready(e)) return;
    const tg = e.target;
    if (tg && tg.alive && !tg.dying && tg.creature && !(tg.webT > 0) && !tg.def.boss) {
      const dx = tg.x - e.x, dy = tg.y - e.y, d = Math.hypot(dx, dy);
      if (d > 60 && d < 420 * e.scale) {
        e.facing = dx >= 0 ? 1 : -1; e.spitT = 0.45; e.specT = 3.5; W.sfx('web', e.x); e.aim = tg; e.say(pick(['*THWIP*', 'Stay still...', '*ptoo!*']));
        const mx = e.x + e.facing * 44 * e.scale, my = e.y + 6 * e.scale;
        const w = W.spawn('web', mx, my, { scale: Math.max(0.7, e.scale), quiet: true }); if (!w) return;
        w.owner = e; w.y = my;
        const T = Math.max(0.25, d / 800), g = 1700 * w.gravity;
        w.vx = (tg.x - mx) / T; w.vy = (tg.y - my) / T - 0.5 * g * T; w.grounded = false; w.angVel = 6;
        return;
      }
    }
    e.specT = 0.3;
  };

  // ice golem: icicle volleys at range, blizzard breath up close; fire is nothing to it
  S.frost = function (e, dt, W) {
    e.specT -= dt; e.galeT -= dt;
    if (Math.random() < dt * 4) W.particle('sparkle', e.x + (Math.random() - 0.5) * e.w * 0.8, e.y + (Math.random() - 0.5) * e.h * 0.8, { vy: 25, life: 0.8, size: 4 });
    if (e.breath > 0) {
      e.breath -= dt;
      const mx = e.x + e.facing * 30 * e.scale, my = e.y - 78 * e.scale, dx = e.facing, dy = 0.18, R = 430 * e.scale;
      for (let k = 0; k < 3; k++) { const sp = 320 + Math.random() * 260; W.particle('puff', mx, my, { vx: dx * sp + (Math.random() - 0.5) * 80, vy: dy * sp + (Math.random() - 0.5) * 140, life: 0.45 + Math.random() * 0.3, size: 5 + Math.random() * 8 }); }
      if (Math.random() < dt * 40) W.particle('sparkle', mx + dx * Math.random() * R * 0.8, my + (Math.random() - 0.3) * 120, { vx: dx * 200, vy: 60, life: 0.6, size: 4 });
      for (const o of W.entities) {
        if (o === e || !o.alive || o.dying || SB.kin(e, o)) continue;
        const px = o.x - mx, py = o.y - my, s = px * dx + py * dy;
        if (s < 0 || s > R) continue;
        if (Math.abs(px * dy - py * dx) > 45 * e.scale + s * 0.22 + o.w * 0.3) continue;
        if (o.creature) { W.freeze(o, e, 2.5); if (!o.static && !o.held) o.vx += e.facing * 500 * dt * Math.min(1, 4 / Math.sqrt(o.mass)); }
        else if (o.special === 'fire') { o.meltT += dt * 3; if (o.meltT > 1) W.extinguish(o); }
        else if (o.special === 'fireball') { W.popText(o.x, o.y - 10, 'Fizz!', 14); W.remove(o, 'poof'); }
        if (o.onFire > 0) W.douse(o);
      }
      return;
    }
    if (e.throwT > 0) { const was = e.throwT; e.throwT -= dt; if (was > 0.25 && e.throwT <= 0.25) volley(e, W); return; }
    if (!ready(e)) return;
    const tg = e.target;
    if (!(tg && tg.alive && !tg.dying)) { if (e.specT <= 0) e.specT = 0.3; return; }
    const dx = tg.x - e.x, d = Math.abs(dx);
    if (e.galeT <= 0 && d < 380 * e.scale && tg.y > e.y - 220 * e.scale) { e.galeT = 9; e.breath = 1.5; W.sfx('wind', e.x, 0.8); W.sfx('freeze', e.x); e.facing = dx >= 0 ? 1 : -1; e.say('*BLIZZARD BREATH*'); W.shake(4); return; }
    if (e.specT <= 0 && d > 90 && d < 720 * e.scale) { e.throwT = 0.7; e.specT = 4.5; e.aim = tg; e.facing = dx >= 0 ? 1 : -1; e.say(pick(['FREEZE!', 'SHATTER!', '*ice cracking*'])); return; }
    if (e.specT <= 0) e.specT = 0.3;
  };
  function volley(e, W) {
    const tg = e.aim; e.aim = null;
    const hx = e.x + e.facing * 46 * e.scale, hy = e.y - 70 * e.scale;
    // lead the target a little so a moving (or falling) target still gets hit
    const ax = tg && tg.alive ? tg.x + tg.vx * 0.45 : e.x + e.facing * 400;
    const ay = tg && tg.alive ? Math.min(W.groundY - tg.h / 2, tg.y + tg.vy * 0.45) : W.groundY - 20;
    for (let k = -1; k <= 1; k++) {
      const f = W.spawn('icicle', hx, hy, { scale: Math.max(0.8, e.scale), quiet: true }); if (!f) return;
      f.owner = e; f.y = hy; f.facing = 1;
      const T = 0.7 + Math.abs(k) * 0.1, g = 1700 * f.gravity;
      f.vx = clamp((ax - hx) / T + k * 90, -1100, 1100); f.vy = (ay - hy) / T - 0.5 * g * T - Math.abs(k) * 60; f.grounded = false;
    }
    W.shake(3); W.sfx('whoosh', e.x); e.say('*SHINK SHINK SHINK*'); W.burst('sparkle', hx, hy, 8, 140, { size: 5 });
  }

  // giant snake: venom spit at range, poison breath up close
  S.spitvenom = function (e, dt, W) {
    e.specT -= dt; e.galeT -= dt; if (e.spitT > 0) e.spitT -= dt;
    const mx = e.x + e.facing * D.snakeMouth[0] * e.scale, my = e.y + D.snakeMouth[1] * e.scale;
    if (e.breath > 0) {
      e.breath -= dt;
      const R = 240 * e.scale;
      for (let k = 0; k < 2; k++) W.particle('smoke', mx, my, { vx: e.facing * (120 + Math.random() * 160), vy: (Math.random() - 0.5) * 120, life: 0.9 + Math.random() * 0.5, size: 8 + Math.random() * 10, col: '#8fd39a' });
      for (const o of W.entities) {
        if (o === e || !o.alive || o.dying || !o.creature || SB.kin(e, o)) continue;
        const dx = (o.x - mx) * e.facing, dy = o.y - my;
        if (dx < -30 || dx > R || Math.abs(dy) > 90 * e.scale + dx * 0.3) continue;
        W.poison(o, e, 5);
      }
      return;
    }
    if (!ready(e)) return;
    const tg = e.target;
    if (!(tg && tg.alive && !tg.dying)) { if (e.specT <= 0) e.specT = 0.3; return; }
    const dx = tg.x - e.x, d = Math.hypot(dx, tg.y - e.y);
    if (e.galeT <= 0 && Math.abs(dx) < 260 * e.scale && tg.y > e.y - 200 * e.scale) { e.galeT = 10; e.breath = 2; W.sfx('hiss', e.x); e.facing = dx >= 0 ? 1 : -1; e.say('*HISSSSSS*'); return; }
    if (e.specT <= 0 && d > 90 && d < 650 * e.scale && tg.creature && !(tg.poisonT > 0)) {
      e.facing = dx >= 0 ? 1 : -1; e.spitT = 0.45; e.specT = 4; W.sfx('spit', e.x);
      const sx = e.x + e.facing * D.snakeMouth[0] * e.scale, sy = my;
      const v = W.spawn('venom', sx, sy, { scale: Math.max(0.8, e.scale), quiet: true }); if (!v) return;
      v.owner = e; v.y = sy;
      const ax = tg.x + tg.vx * 0.4, ay = Math.min(W.groundY - tg.h / 2, tg.y + tg.vy * 0.4);
      const T = Math.max(0.35, d / 900), g = 1700 * v.gravity;
      v.vx = (ax - sx) / T; v.vy = (ay - sy) / T - 0.5 * g * T; v.grounded = false;
      e.say(pick(['SSSPIT!', '*ptooey*', 'Tasssste thisss!'])); return;
    }
    if (e.specT <= 0) e.specT = 0.3;
  };

  // giant angry bull: paw and snort, then a screen-crossing charge; rears up and stomps up close
  S.bullcharge = function (e, dt, W) {
    e.specT -= dt; e.galeT -= dt;
    const nx = e.x + e.facing * D.bullNose[0] * e.scale, ny = e.y + D.bullNose[1] * e.scale;
    if ((e.pawT > 0 || e.chargeT > 0 || e.mood === 'angry') && Math.random() < dt * (e.pawT > 0 ? 14 : 3)) W.particle('smoke', nx, ny, { vx: e.facing * (40 + Math.random() * 60), vy: -20 - Math.random() * 30, life: 0.7, size: 5 + Math.random() * 4, col: '#ffffff' });
    if (e.rearT > 0) {
      const was = e.rearT; e.rearT -= dt;
      if (was > 0.2 && e.rearT <= 0.2) { W.stompWave(e, 320 * e.scale, 650, 4); W.popText(e.x, e.top - 30, 'STOMP!', 34); W.shake(18); }
      return;
    }
    if (e.pawT > 0) {
      e.pawT -= dt;
      if (Math.random() < dt * 10) W.particle('puff', e.x + e.facing * 60 * e.scale, e.bottom - 4, { vx: -e.facing * (80 + Math.random() * 120), vy: -40 - Math.random() * 60, life: 0.6, size: 7 });
      if (e.pawT <= 0) { e.chargeT = 1.7; e.hitIds = new Set(); e.say(pick(['CHAAARGE!', '*THUNDERING HOOVES*', 'MOOOOOO!'])); W.sfx('charge', e.x); W.sfx('bellow', e.x, 0.7); }
      return;
    }
    if (e.chargeT > 0) {
      e.chargeT -= dt;
      W.shake(3);
      if (Math.random() < dt * 30) W.particle('puff', e.x - e.facing * e.w * 0.3, e.bottom - 4, { vx: -e.facing * (60 + Math.random() * 100), vy: -30 - Math.random() * 50, life: 0.7, size: 9 + Math.random() * 6 });
      if (Math.random() < dt * 25) W.particle('streak', e.x - e.facing * e.w * 0.4, e.y + (Math.random() - 0.5) * e.h * 0.6, { tx: e.facing * 800, ty: 0, life: 0.22, size: 50 });
      const fx = e.x + e.facing * e.w * 0.42;
      for (const o of W.entities) {
        if (o === e || !o.alive || o.dying || o.held || SB.kin(e, o) || (o.noCollide && !o.creature) || e.hitIds.has(o.id)) continue;
        if (Math.abs(o.x - fx) > o.w / 2 + 34 * e.scale) continue;
        if (o.bottom < e.top + e.h * 0.2 || o.top > e.bottom) continue;
        if (o.static) { bullCrash(e, W, o); return; }
        e.hitIds.add(o.id);
        const m = Math.min(1.4, 7 / Math.sqrt(o.mass));
        o.vx = e.facing * (520 + Math.random() * 200) * m; o.vy = -(620 + Math.random() * 260) * m; o.grounded = false; o.angVel = (Math.random() - 0.5) * 18;
        if (o.creature) { W.hurt(o, o.def.boss ? 4 : 5, e, { quiet: true }); o.dizzy = Math.max(o.dizzy, 1.4); o.say(pick(['WAAAH!', 'Yeeeow!', 'Whoaaa!'])); }
        else W.sfx('heavy', o.x);
        W.popText(o.x, o.top - 20, pick(['TOSSED!', 'BAM!', 'YEEHAW!']), 22);
      }
      if ((e.facing < 0 && e.x <= e.w / 2 + 6) || (e.facing > 0 && e.x >= W.W - e.w / 2 - 6)) { e.chargeT = 0; e.vx = -e.facing * 120; W.shake(8); W.sfx('thud', e.x); }
      if (e.chargeT <= 0) { e.specT = 3; W.burst('puff', e.x + e.facing * e.w * 0.3, e.bottom, 8, 150, { size: 9, life: 0.7 }); }
      return;
    }
    if (!ready(e) || !e.grounded) return;
    const tg = e.target;
    if (!(tg && tg.alive && !tg.dying)) { if (e.specT <= 0) e.specT = 0.3; return; }
    const dx = tg.x - e.x, ad = Math.abs(dx);
    if (e.galeT <= 0 && ad < e.w / 2 + 90 && tg.bottom > e.top) { e.galeT = 6; e.rearT = 0.7; e.facing = dx >= 0 ? 1 : -1; e.say(pick(['MOOOOO!', 'STOMP!'])); W.sfx('bellow', e.x, 0.6); return; }
    if (e.specT <= 0 && ad > e.w / 2 + 40 && ad < 820 * e.scale && Math.abs(tg.y - e.y) < 260 * e.scale) { e.facing = dx >= 0 ? 1 : -1; e.pawT = 0.9; e.specT = 99; e.say(pick(['*SNORT SNORT*', '*paws the ground*', 'You\'re mine!'])); W.sfx('snort', e.x); return; }
    if (e.specT <= 0) e.specT = 0.3;
  };
  // the bull ran headfirst into something that doesn't move
  function bullCrash(e, W, o) {
    e.chargeT = 0; e.specT = 4; e.vx = -e.facing * 260; e.vy = -220; e.grounded = false;
    W.hurt(e, 6, null, { quiet: true }); e.dizzy = Math.max(e.dizzy, 2.5);
    e.say(pick(['OOF! Stars...', '*CRASH*', 'Ow, my horns!']));
    W.popText(e.x + e.facing * e.w * 0.4, e.top - 20, 'CRASH!', 38); W.shake(22); W.flash = 0.2;
    W.burst('rock', o.x, o.y, 10, 260, { size: 7, g: 900, life: 0.9 }); W.burst('star', e.x, e.top, 6, 120, { size: 7, life: 1 });
    W.sfx('crash', e.x);
    if (o.mass < 25) { W.remove(o, 'poof'); W.popText(o.x, o.top - 10, 'Smashed!', 20); }   // fences, signs and doors break
  }

  // giant scorpion: pincer fling up close, a triple sting at mid range, poison stingers at long range
  S.scorpion = function (e, dt, W) {
    e.specT -= dt; e.galeT -= dt; e.clawCd -= dt;
    if (e.clawT > 0) e.clawT -= dt;
    for (let i = 0; i < 3; i++) if (e.tailT[i] > 0) {
      const was = e.tailT[i]; e.tailT[i] -= dt;
      if (e.tailHit[i] && was > 0.17 && e.tailT[i] <= 0.17) { e.tailHit[i] = false; scorpSting(e, W); }
    }
    if (e.stingQ > 0) {
      e.stingQT -= dt;
      if (e.stingQT <= 0) { const i = 3 - e.stingQ; e.stingQ--; e.stingQT = 0.22; e.tailT[i] = 0.35; e.tailHit[i] = true; W.sfx('swing', e.x, 0.7); }
      return;
    }
    if (!ready(e) || !e.grounded) return;
    const tg = e.target;
    if (!(tg && tg.alive && !tg.dying)) { if (e.specT <= 0) e.specT = 0.3; return; }
    const dx = tg.x - e.x, ad = Math.abs(dx), d = Math.hypot(dx, tg.y - e.y);
    const reach = e.w / 2 + 40 * e.scale;
    if (e.clawCd <= 0 && ad < reach && tg.bottom > e.top - 40) {
      e.facing = dx >= 0 ? 1 : -1; e.clawT = 0.4; e.clawCd = 3.2;
      W.sfx('snip', tg.x); W.hurt(tg, 3, e, { quiet: true });
      if (!tg.def.boss && !tg.static && tg.creature) { tg.vx = -e.facing * (420 + Math.random() * 120); tg.vy = -720; tg.angVel = 12; tg.grounded = false; tg.dizzy = Math.max(tg.dizzy, 1.2); tg.say(pick(['PINCHED!', 'Ow ow ow!', 'Let goooo!'])); }
      e.say(pick(['SNIP SNIP!', '*CLACK*'])); W.popText(tg.x, tg.top - 20, 'SNIP!', 26);
      return;
    }
    if (e.galeT <= 0 && ad < reach + 140 * e.scale) { e.facing = dx >= 0 ? 1 : -1; e.stingQ = 3; e.stingQT = 0; e.galeT = 4.5; e.say('*TRIPLE STING*'); return; }
    if (e.specT <= 0 && ad > reach && d < 720 * e.scale) {
      e.facing = dx >= 0 ? 1 : -1; e.specT = 4.5;
      for (let i = 0; i < 3; i++) {
        e.tailT[i] = 0.3; e.tailHit[i] = false;
        const tip = (e.tips && e.tips[i]) || D.scorpTips[i];
        const sx = e.x + e.facing * tip[0] * e.scale, sy = e.y + tip[1] * e.scale;
        const f = W.spawn('stinger', sx, sy, { scale: Math.max(0.8, e.scale), quiet: true }); if (!f) continue;
        f.owner = e; f.y = sy; f.facing = 1;
        const ax = tg.x + tg.vx * 0.4 + (i - 1) * 40, ay = Math.min(W.groundY - tg.h / 2, tg.y + tg.vy * 0.4);
        const T = Math.max(0.35, Math.hypot(ax - sx, ay - sy) / 950), g = 1700 * f.gravity;
        f.vx = (ax - sx) / T; f.vy = (ay - sy) / T - 0.5 * g * T; f.grounded = false;
      }
      e.say(pick(['*THWIP THWIP THWIP*', 'SKREEK!'])); W.sfx('sting', e.x); W.sfx('spit', e.x, 0.7);
      return;
    }
    if (e.specT <= 0) e.specT = 0.3;
  };
  function scorpSting(e, W) {
    let hits = 0;
    for (const o of W.entities) {
      if (o === e || !o.alive || o.dying || !o.creature || o.ko || SB.kin(e, o)) continue;
      const dx = (o.x - e.x) * e.facing;
      if (dx < e.w * 0.15 || dx > e.w / 2 + 180 * e.scale) continue;
      if (o.bottom < e.top - 60 * e.scale || o.top > e.bottom) continue;
      W.hurt(o, 2, e, { quiet: true }); W.poison(o, e, 4);
      if (!o.def.boss) { o.vx += e.facing * 260; o.vy = Math.min(o.vy, -220); o.grounded = false; }
      hits++;
    }
    W.sfx('sting', e.x + e.facing * e.w * 0.5);
    if (hits) W.shake(5);
  }

  // ---------- wasp swarm: every wasp flies on its own, the swarm hunts as a group ----------
  const waspMax = e => Math.min(48, e.hpMax);
  function newWasp(e, x, y) {
    const a = Math.random() * TAU, beetle = e.def.swarmKind === 'beetle';
    return { x: x == null ? e.x + Math.cos(a) * (beetle ? 70 : 40) : x, y: y == null ? (beetle ? SB.world.groundY - 5 : e.y + Math.sin(a) * 30) : y, vx: (Math.random() - 0.5) * 200, vy: beetle ? 0 : (Math.random() - 0.5) * 200,
      ph: Math.random() * TAU, r: Math.random() * 60, sp: Math.random() * 1.5, seed: Math.random() * 100, tgt: null, cd: Math.random(), dead: false, life: 0,
      armor: beetle ? 1 : 0, col: SHELLS[Math.floor(Math.random() * SHELLS.length)], fly: false };
  }
  // a wasp dies (swatted, burnt, drowned, blown up): the swarm loses that much health
  function killWasp(e, w, W, hurt) {
    if (w.dead) return;
    w.dead = true; w.life = 1.2; w.vy = -60; w.tgt = null;
    if (hurt) {
      e.waspDebt = (e.waspDebt || 0) + e.hpMax / waspMax(e);
      if (e.waspDebt >= 1 && !e.ko) { const d = Math.floor(e.waspDebt); e.waspDebt -= d; W.hurt(e, d, null, { quiet: true, soft: true, col: '#c98a00' }); }
    }
  }
  S.swarm = function (e, dt, W) {
    const s = e.scale, ws = e.wasps || (e.wasps = []);
    if (!e.stingAcc) e.stingAcc = new Map();
    const live = ws.filter(w => !w.dead);
    // keep the number of wasps in step with the swarm's health (the queen hatches more as it heals)
    const want = e.ko ? 0 : Math.ceil(waspMax(e) * Math.max(0, e.hp) / e.hpMax);
    if (live.length > want + 1) for (let k = live.length - 1; k >= 0 && live.length > want; k--) { killWasp(e, live[k], W, false); live.pop(); }
    else if (live.length < want - 1) for (let k = live.length; k < want; k++) { const w = newWasp(e); ws.push(w); live.push(w); }
    e.regenT -= dt;
    if (e.regenT <= 0) { e.regenT = 4; if (!e.ko && e.hp < e.hpMax) { e.hp++; e.lastHp = e.hp; } }
    // choose up to three victims and split the swarm between them
    e.specT -= dt;
    if (e.specT <= 0) {
      e.specT = 0.5;
      let foes = [];
      if (ready(e)) {
        if (SB.battle) foes = W.entities.filter(o => o !== e && o.alive && !o.dying && o.creature && !o.ko && !o.held && !SB.kin(e, o) && Math.hypot(o.x - e.x, o.y - e.y) < 560 * s)
          .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y)).slice(0, 3);
        else if (e.target && e.target.creature && e.target.alive && !e.target.ko && Math.hypot(e.target.x - e.x, e.target.y - e.y) < 560 * s) foes = [e.target];
      }
      const quota = foes.length ? Math.max(2, Math.floor(live.length * 0.75 / foes.length)) : 0;
      const count = new Map(foes.map(f => [f, 0]));
      for (const w of live) { if (w.tgt && count.has(w.tgt)) count.set(w.tgt, count.get(w.tgt) + 1); else w.tgt = null; }
      for (const f of foes) {
        let n = count.get(f);
        if (n < quota) {
          const free = live.filter(w => !w.tgt).sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y));
          for (const w of free) { if (n >= quota) break; w.tgt = f; n++; }
        } else if (n > quota + 2) for (const w of live) { if (n <= quota) break; if (w.tgt === f) { w.tgt = null; n--; } }
      }
      if (foes.length && Math.random() < 0.25) e.say(pick(e.def.roar));
    }
    // hazards the wasps can fly into
    const kind = e.def.swarmKind || 'wasp';
    const fires = [], fans = [], rains = [], eaters = [];
    for (const o of W.entities) {
      if (!o.alive || o.dying || o === e) continue;
      if (kind === 'beetle' && o.creature && !o.ko && !o.held && SB.matches(o, ['chicken', 'rooster', 'bird', 'frog', 'duck', 'turkey', 'chick'])) eaters.push(o);
      if (o.tags.has('fire') || o.onFire > 0 || o.special === 'fireball') fires.push(o);
      else if (o.special === 'fan') fans.push(o);
      else if (o.special === 'rain') rains.push(o);
    }
    const hits = new Map();
    for (const w of ws) {
      if (w.dead) { w.vy += 900 * dt; w.vx *= 0.97; w.x += w.vx * dt; w.y = Math.min(W.groundY - 3, w.y + w.vy * dt); w.life -= dt; continue; }
      const T = w.tgt && w.tgt.alive && !w.tgt.dying && !w.tgt.ko ? w.tgt : null;
      if (!T) w.tgt = null;
      w.ph += dt * (2.2 + w.sp);
      let gx, gy, max, ny = 900;
      if (kind === 'beetle') {
        // beetles crawl along the ground, climb up whoever they attack, and only fly to reach things in the air
        const gy0 = W.groundY - 5;
        const air = T && T.bottom < W.groundY - 40;
        if (T) {
          gx = T.x + Math.cos(w.ph * 1.7) * T.w * 0.45;
          if (air) { gy = T.y + Math.sin(w.ph * 1.9) * T.h * 0.45; max = 300; }
          else if (Math.abs(w.x - T.x) < T.w * 0.5 + 10) { gy = T.y + Math.sin(w.ph * 1.3) * T.h * 0.45; max = 150; }   // climbing
          else { gy = gy0; max = 260; }
        } else { gx = e.x + Math.cos(w.ph * 0.6) * (56 + w.r * 1.6) * s; gy = gy0; max = e.ko ? 60 : 200; }
        w.fly = !!air && w.y < gy0 - 12;
        ny = w.fly ? 700 : 120;
      } else if (T) { gx = T.x + Math.cos(w.ph * 2.3) * T.w * 0.55; gy = T.y + Math.sin(w.ph * 1.9) * T.h * 0.5; max = 430; }
      else { gx = e.x + Math.cos(w.ph) * (46 + w.r) * s; gy = e.y + Math.sin(w.ph * 1.3) * (30 + w.r * 0.55) * s; max = e.ko ? 120 : 320; }
      w.vx += ((gx - w.x) * 9 - w.vx * 2.2 + (Math.random() - 0.5) * 900) * dt;
      w.vy += ((gy - w.y) * 9 - w.vy * 2.2 + (Math.random() - 0.5) * ny) * dt;
      for (const fn of fans) { const dx = (w.x - fn.x) * fn.facing; if (dx > 0 && dx < 360 * fn.scale && Math.abs(w.y - fn.y) < 120 * fn.scale) w.vx += fn.facing * 2600 * dt; }
      const sp = Math.hypot(w.vx, w.vy); const lim = fans.length ? max * 3 : max;
      if (sp > lim) { w.vx *= lim / sp; w.vy *= lim / sp; }
      w.x += w.vx * dt; w.y += w.vy * dt;
      if (w.x < 4) { w.x = 4; w.vx = Math.abs(w.vx); } else if (w.x > W.W - 4) { w.x = W.W - 4; w.vx = -Math.abs(w.vx); }
      if (w.y < 4) { w.y = 4; w.vy = Math.abs(w.vy); } else if (w.y > W.groundY - 6) { w.y = W.groundY - 6; w.vy = -Math.abs(w.vy); }
      // fire burns them, rain drowns them
      let gone = false;
      for (const f of fires) if (Math.abs(w.x - f.x) < f.w * 0.5 + 8 && Math.abs(w.y - f.y) < f.h * 0.5 + 10) { killWasp(e, w, W, true); W.particle('flame', w.x, w.y, { vy: -40, life: 0.3, size: 5 }); gone = true; break; }
      if (!gone) for (const r of rains) if (Math.abs(w.x - r.x) < r.w * 0.5 && w.y > r.y && Math.random() < dt * 1.5) { killWasp(e, w, W, true); W.particle('drop', w.x, w.y, { vy: 200, life: 0.3, size: 4 }); gone = true; break; }
      if (!gone) for (const o of eaters) if (Math.abs(w.x - o.x) < o.w * 0.5 + 6 && Math.abs(w.y - o.y) < o.h * 0.5 + 8 && Math.random() < dt * 6) {
        killWasp(e, w, W, true); w.life = 0; o.say(pick(['Nom!', 'Crunchy!', 'Yum, bugs!', 'Gulp!'])); o.setMood('happy', 1); W.particle('heart', o.x, o.top, { vy: -40, life: 0.8, size: 6 }); W.sfx('pop', o.x, 0.5); gone = true; break;
      }
      if (gone) continue;
      // sting
      w.cd -= dt;
      if (T && w.cd <= 0 && Math.abs(w.x - T.x) < T.w * 0.5 + 6 && Math.abs(w.y - T.y) < T.h * 0.5 + 6) {
        w.cd = 1.1 + Math.random() * 1.2;
        hits.set(T, (hits.get(T) || 0) + 1);
        if (Math.random() < 0.3) W.particle('spark', w.x, w.y, { vx: (Math.random() - 0.5) * 80, vy: -40, life: 0.2, size: 4 });
      }
    }
    for (let k = ws.length - 1; k >= 0; k--) if (ws[k].dead && ws[k].life <= 0) ws.splice(k, 1);
    // stings add up: every three stings cost a point of health; a swarmed creature panics
    for (const [T, n] of hits) {
      const acc = (e.stingAcc.get(T) || 0) + n * 0.34;
      if (acc >= 1) {
        const d = Math.floor(acc); e.stingAcc.set(T, acc - d);
        W.hurt(T, d, e, { quiet: true, soft: true, col: '#d68a00' }); W.sfx('sting', T.x, 0.6);
        if (Math.random() < 0.35) T.say(pick(kind === 'beetle' ? ['They\'re crawling on me!', 'Bugs! BUGS!', 'Ow, they bite!', 'EWWW!', 'Get them off!'] : ['OW OW OW!', 'Get them off!', 'Bees! BEES!', 'Ouch! Ouch!', 'AAAH!']));
        T.setMood('scared', 1);
      } else e.stingAcc.set(T, acc);
    }
    // the buzz: louder the bigger the swarm
    if (live.length && !e.ko) W.sfx(kind === 'beetle' ? 'skitter' : 'buzz', e.x, Math.min(0.9, 0.25 + live.length / 50));
  };
  // swat wasps with the cursor
  SB.swat = function (x, y) {
    const W = SB.world; let n = 0;
    let clink = 0;
    for (const e of W.entities) if (e.wasps && e.alive && !e.ko) for (const w of e.wasps) if (!w.dead && Math.hypot(w.x - x, w.y - y) < 28) {
      if (w.armor > 0) { w.armor--; w.vy = -260; w.vx = (Math.random() - 0.5) * 300; w.cracked = true; clink++; } else { killWasp(e, w, W, true); n++; }
    }
    if (clink && !n) { W.popText(x, y - 18, clink > 1 ? 'CLINK x' + clink + '!' : 'CLINK!', 18); W.sfx('crit', x, 0.6); W.particle('impact', x, y, { life: 0.15, size: 14 }); return clink; }
    if (n) { W.popText(x, y - 18, n > 1 ? 'SWAT x' + n + '!' : 'SWAT!', 20); W.sfx('hit', x); W.particle('impact', x, y, { life: 0.2, size: 18 }); }
    return n;
  };
  // explosions take out wasps in the blast
  SB.waspBlast = function (x, y, r) {
    const W = SB.world;
    for (const e of W.entities) if (e.wasps && e.alive && !e.ko) for (const w of e.wasps) if (!w.dead && Math.hypot(w.x - x, w.y - y) < r) { killWasp(e, w, W, true); w.vx = (w.x - x) * 4; w.vy = (w.y - y) * 4 - 200; }
  };
  // the swarm is drawn over the world (wasps fly far from the queen)
  SB.DEFS['beetle swarm'].drawWorld = function (p, ctx, e, t) { if (!e.wasps) return; ctx.strokeStyle = '#000'; for (const w of e.wasps) { D.miniBeetle(p, w.x, w.y - 2, Math.max(1.45, e.scale * 1.45), w.vx >= 0 ? 1 : -1, t, w.seed, w.dead ? Math.max(0, w.life / 1.2) : 1, w.fly, w.col); if (w.cracked && !w.dead) { ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; p.line(w.x - 3, w.y - 4, w.x + 1, w.y - 1); ctx.restore(); } } };
  // ground stomps crush beetles
  SB.swarmCrush = function (x, y, r) {
    const W = SB.world;
    for (const e of W.entities) if (e.wasps && e.alive && !e.ko && e.def.swarmKind === 'beetle') for (const w of e.wasps) if (!w.dead && !w.fly && Math.abs(w.x - x) < r && w.y > W.groundY - 40) { if (Math.random() < 0.5) { killWasp(e, w, W, true); w.vy = -120; } else { w.vy = -320; w.vx = (w.x - x) * 3; } }
  };
  SB.DEFS['wasp swarm'].drawWorld = function (p, ctx, e, t) { if (!e.wasps) return; ctx.strokeStyle = '#000'; for (const w of e.wasps) D.wasp(p, w.x, w.y, Math.max(1, e.scale), w.vx >= 0 ? 1 : -1, t, w.seed, w.dead ? Math.max(0, w.life / 1.2) : 1); };

  // lava golem: lob a fireball at the target
  S.lob = function (e, dt, W) {
    e.specT -= dt;
    if (e.throwT > 0) { const was = e.throwT; e.throwT -= dt; if (was > 0.25 && e.throwT <= 0.25) throwFireball(e, W); return; }
    if (Math.random() < dt * 6) W.particle('flame', e.x + (Math.random() - 0.5) * e.w * 0.6, e.top + 10 + Math.random() * 30, { vy: -50, life: 0.4, size: 5 });
    if (Math.random() < dt * 3) W.particle('smoke', e.x + (Math.random() - 0.5) * 20, e.top, { vy: -40, life: 1, size: 6 });
    if (e.specT > 0 || !ready(e)) return;
    const tg = e.target;
    if (tg && tg.alive && !tg.dying) {
      const d = Math.abs(tg.x - e.x);
      if (d > 80 * e.scale && d < 560 * e.scale) { e.throwT = 0.7; e.specT = 4; e.aim = tg; e.facing = tg.x >= e.x ? 1 : -1; e.say(pick(['BURN!', 'GRRRAAAH!', 'Catch!'])); return; }
    }
    e.specT = 0.3;
  };
  function throwFireball(e, W) {
    const tg = e.aim; e.aim = null;
    const hx = e.x + e.facing * 46 * e.scale, hy = e.y - 60 * e.scale;
    const f = W.spawn('fireball', hx, hy, { scale: Math.max(0.6, e.scale), quiet: true }); if (!f) return;
    f.owner = e; f.y = hy;
    const ax = tg && tg.alive ? tg.x + tg.vx * 0.5 : e.x + e.facing * 300, ay = tg && tg.alive ? Math.min(W.groundY - tg.h / 2, tg.y + tg.vy * 0.5) : W.groundY;
    const T = 0.9, g = 1700 * f.gravity;
    f.vx = clamp((ax - hx) / T, -900, 900); f.vy = (ay - hy) / T - 0.5 * g * T; f.grounded = false;
    W.shake(3); W.sfx('whoosh', e.x); W.sfx('fire', e.x, 0.6); e.say('*FWOOM*'); W.burst('spark', hx, hy, 6, 120, { size: 5 });
  }
})();
