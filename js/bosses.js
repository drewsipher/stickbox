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
    c.save(); c.lineWidth = 3; c.strokeStyle = '#ff7a1a'; c.shadowColor = '#ff5a00'; c.shadowBlur = 8; p.zigzag(x0, y0, x1, y1, 3, n); c.strokeStyle = '#ffb347';
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
    c.save(); c.strokeStyle = 'rgba(240,200,190,0.55)'; c.lineWidth *= 1.2; p.line(-24, -74, -10, -50); p.line(-20, -70, -8, -66); p.line(12, -84, 24, -60); p.line(-28, -8, -20, 6); c.restore();   // old scars
    if (Math.sin(t * 1.3 + e.seed) > -0.3) { const dr = (t * 0.9) % 1; c.fillStyle = 'rgba(190,220,170,0.75)'; c.beginPath(); c.ellipse(1, 30 + dr * 16, 2, 3 + dr * 2, 0, 0, TAU); c.fill(); }   // drool
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
    p.circle(0, -36, 9, true); c.save(); c.shadowColor = '#ff3b1f'; c.shadowBlur = 12; p.circle(0, -36, 5, '#ff3b1f'); c.restore(); p.circle(0, -36, 1.5, '#ffe0d0');
    c.save(); c.globalAlpha *= 0.7; c.strokeStyle = '#7a3e1c'; c.lineWidth *= 1.6; p.line(-30, -40, -28, -8); p.line(-22, -12, -21, 6); p.line(26, -30, 28, -4); p.line(-6, 2, -4, 22); c.restore();
    c.save(); c.strokeStyle = 'rgba(220,225,230,0.6)'; p.line(14, -56, 30, -44); p.line(16, -52, 26, -46); p.line(-36, -24, -24, -34); c.restore();
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
    c.save(); c.strokeStyle = '#ff2a14'; c.shadowColor = '#ff2a14'; c.shadowBlur = 9; c.lineWidth = 2.8;
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
    c.save(); c.strokeStyle = 'rgba(200,170,160,0.75)'; c.lineWidth *= 1.2; p.line(-12, -20, 0, 2); p.line(-9, -20, 3, 0); p.line(10, 16, 18, 24); c.restore();   // claw scars
    if (mood !== 'sleep') { p.use('mouth'); p.poly([-8, 14, 19, 12, 16, 22, -5, 23], true); p.use('skin'); p.zigzag(-6, 14, 17, 12, 3.5, 6); p.zigzag(-4, 23, 15, 22, -3, 5); }
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
      const jaw = mood !== 'sleep';
      if (jaw && !breathing) { const dr = (t * 1.1 + i * 0.4) % 1; c.fillStyle = 'rgba(200,225,170,0.8)'; c.beginPath(); c.ellipse(10, 16 + dr * 12, 1.4, 2.2 + dr, 0, 0, TAU); c.fill(); }
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
  D.spiderMouth = [72, 22];   // template coords of the fangs (where webs are spat from)
  D.spider = function () { return { w: 320, h: 210, draw(p, e, t) { p.ctx.translate(-10, 0); D.drawSpider(p, e, t); } }; };
  D.drawSpider = function (p, e, t) {
    const c = p.ctx, mood = e.mood, held = e.held;
    const walking = e.moving && e.grounded && !held;
    const inAir = !e.grounded && !held;
    const angry = mood === 'angry' || e.mode === 'hunt' || e.spitT > 0;
    const G = 100, pal = p.pal || {};
    const BODY = pal.body || '#1c1512', LEG = pal.leg || '#21170f', BAND = pal.band || '#7a2416', EYE = pal.eye || '#ff2a14';
    const pulse = Math.sin(t * 2.2 + e.seed) * 1.6;
    // bristles sticking out of an outline
    const bristles = (pts, len, n, side) => { c.save(); c.strokeStyle = '#0d0907'; c.lineWidth = Math.max(0.8, c.lineWidth * 0.55); D.fur(p, pts, n, len, side, 0.35); c.restore(); };
    // ---- legs: tall arched knees, banded joints, hairy segments, hooked claws ----
    const ATT = [[52, 4], [40, 8], [26, 8], [14, 6]], KNEE = [[96, -78], [62, -94], [8, -96], [-42, -84]], FOOT = [[162, G], [112, G], [-62, G], [-142, G]];
    const leg = (i, far) => {
      const ph = e.phase * 1.4 + (i % 2 ? Math.PI : 0) + (far ? Math.PI : 0);
      const step = walking ? Math.sin(ph) * 18 : 0, lift = walking ? Math.max(0, Math.cos(ph)) * 16 : 0;
      const tw = Math.sin(t * 9 + i * 1.7 + (far ? 2.3 : 0)) * (angry ? 2.6 : 1.1);   // never quite still
      const fo = far ? -1 : 1;
      let [ax, ay] = ATT[i], [kx, ky] = KNEE[i], [fx, fy] = FOOT[i];
      if (far) { ax -= 4; ay -= 8; kx -= 10; ky -= 10; fx -= 14; fy -= 9; }
      kx += step * 0.4 + tw; ky += tw * 0.6; fx += step; fy -= lift;
      if (inAir) { fy -= 30; fx += (fx > ax ? -14 : 14); ky += 10; }
      if (held) { kx = ax + (kx - ax) * 0.55; ky = ay - 40 + Math.sin(t * 11 + i) * 8; fx = ax + (fx - ax) * 0.35 + Math.sin(t * 13 + i * 2) * 10; fy = 40 + Math.cos(t * 12 + i) * 10; }
      if (e.spitT > 0 && i === 0 && !held) { kx = 112; ky = -112; fx = 172; fy = -62 + Math.sin(t * 16) * 4; }
      const out = fx > kx ? 1 : -1;
      const mx = kx + (fx - kx) * 0.42 + out * 16, my = ky + (fy - ky) * 0.42 - 6;
      const w = far ? 0.82 : 1, col = far ? SB.shade(LEG, 0.35) : LEG, band = far ? SB.shade(BAND, 0.35) : BAND;
      p.fill = col;
      D.tube(p, ax, ay, (ax + kx) / 2 - out * 6, (ay + ky) / 2 - 8, kx, ky, 15 * w, 10 * w, 5, true);       // femur
      D.tube(p, kx, ky, (kx + mx) / 2 + out * 4, (ky + my) / 2 - 2, mx, my, 10 * w, 7 * w, 4, true);        // tibia
      D.tube(p, mx, my, (mx + fx) / 2 + out * 3, (my + fy) / 2, fx, fy - 4, 7 * w, 3 * w, 5, true);         // metatarsus
      p.fill = band;
      p.ellipse(kx, ky, 7 * w, 6 * w, true, 0); p.ellipse(mx, my, 5 * w, 4.5 * w, true, 0); p.ellipse(ax + (kx - ax) * 0.12, ay + (ky - ay) * 0.12, 6 * w, 5 * w, true, 0);
      if (!far) { bristles([ax, ay, kx, ky], 5, 6, -out); bristles([kx, ky, mx, my], 4.5, 6, out); bristles([mx, my, fx, fy - 4], 3.5, 6, out); }
      c.save(); c.strokeStyle = '#0d0907'; c.lineWidth *= 1.2; p.curve(fx, fy - 4, fx + out * 4, fy - 1, fx + out * 2, fy + 1); c.restore();   // hooked claw
    };
    for (let i = 3; i >= 0; i--) leg(i, true);
    // ---- abdomen: big, pulsing, hairy, with pale chevrons and a red hourglass ----
    c.save(); c.translate(-50, -8); c.rotate(-0.1);
    const arx = 64 + pulse, ary = 48 + pulse * 0.6;
    p.fill = BODY; p.ellipse(0, 0, arx, ary, true, 0);
    const outline = []; for (let k = 0; k <= 22; k++) { const a = Math.PI * 0.95 + k * (Math.PI * 1.1 / 22); outline.push(Math.cos(a) * arx, Math.sin(a) * ary); }
    bristles(outline, 7, 5, -1);
    c.save(); c.globalAlpha *= 0.85;
    for (let k = 0; k < 4; k++) { const x = -34 + k * 17, wch = 10 - k * 1.5; p.poly([x - wch, -26 + k * 2, x, -16 + k * 2, x + wch, -26 + k * 2, x + wch * 0.6, -21 + k * 2, x, -12 + k * 2, x - wch * 0.6, -21 + k * 2], '#c9bfa6'); }
    p.poly([-6, 18, 6, 18, 2, 25, 6, 32, -6, 32, -2, 25], '#c0281a');                                        // red hourglass
    c.restore();
    p.fill = SB.shade(BODY, 0.2); p.ellipse(-arx + 4, 8, 7, 5, true, 0.3); p.ellipse(-arx + 2, 16, 6, 4, true, 0.1);   // spinnerets
    c.restore();
    // ---- cephalothorax with radial grooves ----
    p.fill = BODY; p.ellipse(36, -6, 36, 27, true, -0.05);
    c.save(); c.globalAlpha *= 0.4; c.strokeStyle = '#4a3a30'; for (let k = 0; k < 6; k++) { const a = -2.6 + k * 0.42; p.line(34, -8, 34 + Math.cos(a) * 30, -8 + Math.sin(a) * 22); } c.restore();
    bristles([4, -12, 18, -28, 40, -33, 62, -26], 6, 5, -1);
    // pedipalps
    p.fill = LEG; D.tube(p, 62, 8, 78, 4, 84, 18, 7, 4, 4, true); D.tube(p, 58, 12, 70, 16, 74, 28, 6, 3.5, 4, true);
    // ---- near legs over the body ----
    for (let i = 3; i >= 0; i--) leg(i, false);
    // ---- face in front of the legs: chelicerae and fangs (spread wide and dripping when angry) ----
    const spread = angry ? 0.5 + Math.sin(t * 7) * 0.15 : 0.1;
    p.fill = SB.shade(BODY, 0.05); p.ellipse(62, 18, 11, 13, true, 0.2); p.ellipse(54, 20, 10, 12, true, 0.1);
    bristles([52, 10, 60, 6, 70, 12], 4, 4, -1);
    for (const [bx, by, sgn] of [[64, 28, 1], [55, 29, -1]]) {
      c.save(); c.translate(bx, by); c.rotate(sgn * spread);
      p.poly([-3, 0, 3, 0, 4, 8, 1, 16, -3, 20, -1, 12], '#0b0b0b');
      c.save(); c.globalAlpha *= 0.55; c.strokeStyle = '#8a8a8a'; c.lineWidth *= 0.7; p.line(1.5, 2, 2, 9); c.restore();
      if (angry) { const drip = (t * 1.5 + bx) % 1; p.ellipse(-3, 21 + drip * 14, 1.8, 2.6 + drip * 1.5, '#7ddc6a', 0); }
      c.restore();
    }
    // ---- eight glowing eyes: two big, six small ----
    const EYES = [[56, -16, 5.2], [47, -18, 4.6], [62, -24, 2.8], [41, -26, 2.6], [52, -28, 2.4], [66, -12, 2.2], [37, -18, 2.2], [58, -31, 1.8]];
    c.save();
    if (angry) { c.shadowColor = EYE; c.shadowBlur = 10; }
    const glow = angry ? 1 : 0.75 + Math.sin(t * 3 + e.seed) * 0.15;
    for (const [x, y, r] of EYES) {
      if (mood === 'dizzy') { p.line(x - r, y - r, x + r, y + r); p.line(x - r, y + r, x + r, y - r); continue; }
      if (mood === 'sleep') { p.arc(x, y, r, 0.2, Math.PI - 0.2); continue; }
      c.globalAlpha = glow; p.circle(x, y, r, EYE); c.globalAlpha = 1;
      c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(x - r * 0.35 + e.lookX * r * 0.2, y - r * 0.35, Math.max(0.6, r * 0.3), 0, TAU); c.fill();
    }
    c.restore();
    p.fill = BODY;
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
      p.circle(20, -52, 10, '#ded6c0'); p.circle(20, -52, 6, '#4a0c08'); p.circle(23, -55, 2, '#fff');
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
    p.fill = '#e6dcc0'; p.ellipse(3, 0, 9, 7.5, true, 0); p.ellipse(9, 0, 4, 4.5, true, 0);   // the skull marking
    c.fillStyle = '#1a1210'; c.beginPath(); c.arc(1, -3, 2.2, 0, TAU); c.arc(1, 3, 2.2, 0, TAU); c.fill(); c.fillRect(6, -2.5, 4, 5);
    p.fill = p.base;
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
    else { c.save(); c.shadowColor = '#7ff3ff'; c.shadowBlur = 12; p.poly([-16, -86, -6, -88, -4, -80, -14, -78], '#9ff7ff'); p.poly([4, -88, 16, -86, 14, -78, 6, -80], '#9ff7ff'); c.restore(); if (Math.floor(t * 5) % 2) { c.save(); c.strokeStyle = '#fff'; c.lineWidth = 1.2; p.line(-13, -84, -9, -83); p.line(7, -85, 11, -84); c.restore(); } }
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
    else { c.save(); c.shadowColor = '#ffd23f'; c.shadowBlur = 10; p.ellipse(hx + 12, hy - 6, 5, 3.6, '#ffd23f', 0); c.restore(); c.save(); c.lineWidth *= 1.6; p.line(hx + 12, hy - 9.5, hx + 12, hy - 2.5); c.restore(); }
    { const dr = (t * 1.2) % 1; c.fillStyle = 'rgba(125,220,106,0.85)'; c.beginPath(); c.ellipse(hx + 27, hy + 16 + dr * 14, 1.6, 2.4 + dr, 0, 0, TAU); c.fill(); }
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
    if (mood !== 'dizzy' && mood !== 'sleep') {
      c.save(); c.shadowColor = '#ff2a14'; c.shadowBlur = 10; p.circle(32, -8, 4.4, '#ff3b30'); c.restore(); p.dot(33.5, -8, 1.7);
      c.save(); c.lineWidth *= 1.8; p.line(20, -18, 42, -12); c.restore();
    } else D.eye(p, 32, -8, 3.6, e, 1);
    c.save(); c.strokeStyle = '#d4a017'; c.lineWidth *= 1.5; p.circle(63, 37, 6, false); c.restore();   // nose ring
    p.use('horn'); D.tube(p, 24, -24, 62, -30, 72, -68, 14, 3, 8, true);              // near horn
    p.use('hoof'); p.poly([67, -58, 75, -62, 72, -70], true);                          // dark horn tip
    c.restore();
    p.use('body');
  };

  // ---------- the giant scorpion: a glossy black emperor scorpion, three venom-glowing tails, huge pincers ----------
  const SK = 1.38;   // drawn larger than its working coordinates
  D.scorpTips = [[-103 * SK, -96 * SK], [-69 * SK, -82 * SK], [-37 * SK, -64 * SK]];   // template coords of the three stingers at rest
  D.scorpion = function () { return { w: 340 * SK, h: 200 * SK, draw(p, e, t) { p.ctx.scale(SK, SK); p.ctx.translate(-33, 14); D.drawScorpion(p, e, t); } }; };
  D.drawScorpion = function (p, e, t) {
    const c = p.ctx, mood = e.mood, held = e.held;
    const walking = e.moving && e.grounded && !held;
    const angry = mood === 'angry' || e.mode === 'hunt' || e.stingQ > 0 || e.clawT > 0;
    const G = 84, ph = e.phase * 2, pal = p.pal || {};
    const BODY = pal.body || '#141418', FAR = pal.far || '#0b0b0e', LEG = pal.leg || '#1d1b22', BAND = pal.band || '#5a1d14', VENOM = '#7dff6a';
    const gloss = (x0, y0, x1, y1, a) => { c.save(); c.globalAlpha *= a || 0.55; c.strokeStyle = 'rgba(190,205,230,0.9)'; c.lineWidth *= 1.3; p.curve(x0, y0, (x0 + x1) / 2, Math.min(y0, y1) - 3, x1, y1); c.restore(); };
    const bristles = (pts, len, n, side) => { c.save(); c.strokeStyle = '#050506'; c.lineWidth = Math.max(0.7, c.lineWidth * 0.5); D.fur(p, pts, n, len, side, 0.3); c.restore(); };
    const spikes = (x0, y0, x1, y1, n, len, side) => { const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, nx = -dy / d * side, ny = dx / d * side; p.fill = '#08080a'; for (let k = 1; k <= n; k++) { const u = k / (n + 1), x = x0 + dx * u, y = y0 + dy * u; p.poly([x - dx / d * 2, y - dy / d * 2, x + nx * len + dx / d * 2, y + ny * len + dy / d * 2, x + dx / d * 2, y + dy / d * 2], true); } };
    // walking leg: spiny, red-banded, twitching
    const leg = (ax, ay, i, far) => {
      const a = ph + i * 1.6 + (far ? Math.PI : 0);
      const step = walking ? Math.sin(a) * 12 : held ? Math.sin(t * 12 + i) * 8 : 0;
      const lift = walking ? Math.max(0, Math.cos(a)) * 9 : held ? 16 : 0;
      const tw = Math.sin(t * 8.5 + i * 1.9 + (far ? 2 : 0)) * (angry ? 2.2 : 0.9);
      const spread = (1.5 - i) * 24;
      const kx = ax + spread * 0.55 + step * 0.4 + tw, ky = ay - 34 - (far ? 6 : 0) + Math.abs(i - 1.5) * 4 + tw * 0.5;
      const fx = ax + spread * 1.5 + step, fy = G - lift - (far ? 6 : 0);
      const mx = kx + (fx - kx) * 0.5 + (fx > kx ? 5 : -5), my = ky + (fy - ky) * 0.45;
      p.fill = far ? FAR : LEG;
      D.tube(p, ax, ay, (ax + kx) / 2 - spread * 0.1, ky - 8, kx, ky, far ? 9 : 10, 8, 4, true);
      D.tube(p, kx, ky, (kx + mx) / 2, (ky + my) / 2 - 3, mx, my, 8, 6, 4, true);
      D.tube(p, mx, my, (mx + fx) / 2, (my + fy) / 2, fx, fy, 6, 2, 4, true);
      p.fill = far ? SB.shade(BAND, 0.4) : BAND; p.ellipse(kx, ky, 5, 4.5, true, 0); p.ellipse(mx, my, 4, 3.6, true, 0);
      if (!far) { spikes(ax, ay, kx, ky, 2, 4, -1); bristles([kx, ky, mx, my, fx, fy], 3, 5, fx > kx ? 1 : -1); }
      c.save(); c.strokeStyle = '#050506'; p.line(fx, fy, fx + (fx > ax ? 4 : -4), fy + 1); c.restore();
    };
    // pedipalp: knobbly arm segments with spikes, a swollen granular hand, serrated spiked fingers
    const claw = (far) => {
      const ck = e.clawT > 0 ? Math.sin((1 - e.clawT / 0.4) * Math.PI) : 0;
      const open = ck > 0 ? ck : angry ? 0.42 + Math.sin(t * 6 + (far ? 1.3 : 0)) * 0.2 : 0.14 + Math.sin(t * 1.3 + (far ? 1 : 0)) * 0.05;
      const reach = ck * 30, wig = held ? Math.sin(t * 10 + (far ? 1 : 0)) * 8 : Math.sin(t * 1.8 + (far ? 2 : 0) + e.seed) * 2;
      const bx = 82, by = far ? 2 : 12;
      const ex = 104 + reach * 0.4 + (far ? -6 : 0), ey = (far ? -26 : -16) + wig;
      const hx = 128 + reach + (far ? -10 : 0), hy = (far ? -24 : -12) + wig;
      const col = far ? FAR : BODY;
      p.fill = col; D.slab(p, bx, by, ex, ey, far ? 13 : 15); D.slab(p, ex, ey, hx - 10, hy, far ? 14 : 16);
      p.circle(ex, ey, far ? 6 : 7, true);
      if (!far) { spikes(bx, by, ex, ey, 2, 5, 1); spikes(ex, ey, hx - 10, hy, 2, 5, -1); gloss(ex + 2, ey - 6, hx - 14, hy - 7, 0.45); }
      c.save(); c.translate(hx, hy); c.rotate(-0.1); c.scale(1.45, 1.45);
      p.fill = col; p.ellipse(6, 0, 26, 17, true, 0);                                     // the swollen hand
      if (!far) { c.save(); c.globalAlpha *= 0.55; for (let k = 0; k < 9; k++) p.dot(-12 + (k % 3) * 9 + (k > 5 ? 3 : 0), -8 + Math.floor(k / 3) * 7, 1.3); c.restore(); gloss(-12, -9, 20, -10, 0.6); }
      p.fill = col; p.poly([22, 4, 62, 8, 68, 2, 28, -3], true);                         // fixed finger
      p.fill = '#d9d2c0'; c.save(); c.lineWidth *= 0.6; p.zigzag(26, 3, 60, 6, -3, 9); c.restore();
      c.save(); c.translate(22, -7); c.rotate(-open * 0.8);
      p.fill = col; p.poly([0, 0, 40, -7, 47, 1, 4, 8], true);                           // movable finger
      c.save(); c.lineWidth *= 0.6; p.zigzag(4, 5, 42, 0, 3, 9); c.restore();
      if (!far) spikes(4, -1, 40, -8, 3, 4, 1);
      c.restore();
      if (!far) bristles([-18, -10, 4, -17, 24, -12], 3.5, 4, -1);
      c.restore();
    };
    // three tails: spiked segments arching over the body, ending in venom bulbs that glow and drip
    const BASE = [[-74, -2], [-76, 6], [-72, 14]];
    const REST = [{ c1: [-132, -20], c2: [-150, -128], t: [-70, -110] }, { c1: [-124, 0], c2: [-128, -110], t: [-36, -96] }, { c1: [-112, 14], c2: [-104, -96], t: [-4, -78] }];
    if (!e.tips) e.tips = [];
    const tail = (i) => {
      const b = BASE[i], r = REST[i];
      const sway = Math.sin(t * 2 + i * 2.1 + e.seed) * 5 + (held ? Math.sin(t * 9 + i) * 10 : 0) + (angry ? Math.sin(t * 8 + i) * 3 : 0);
      const c1 = [r.c1[0], r.c1[1]], c2 = [r.c2[0] + sway * 0.5, r.c2[1] + sway * 0.4];
      let tx = r.t[0] + sway, ty = r.t[1] + sway * 0.6;
      const k = e.tailT && e.tailT[i] > 0 ? Math.sin((1 - e.tailT[i] / 0.35) * Math.PI) : 0;
      if (k > 0) { c2[0] += 70 * k; c2[1] -= 30 * k; tx += (175 - tx) * k; ty += (20 - ty) * k; }   // strike forward over the head
      const P = u => { const m = 1 - u; return [m * m * m * b[0] + 3 * m * m * u * c1[0] + 3 * m * u * u * c2[0] + u * u * u * tx, m * m * m * b[1] + 3 * m * m * u * c1[1] + 3 * m * u * u * c2[1] + u * u * u * ty]; };
      const n = 7, col = i === 1 ? BODY : SB.mixColor(BODY, '#000', 0.25);
      for (let sI = 0; sI < n; sI++) {
        const A = P(sI / n), Bp = P((sI + 1) / n);
        const x = (A[0] + Bp[0]) / 2, y = (A[1] + Bp[1]) / 2, dx = Bp[0] - A[0], dy = Bp[1] - A[1], d = Math.hypot(dx, dy) || 1;
        const rad = 15 - sI * 1.2, ang = Math.atan2(dy, dx), nx = dy / d, ny = -dx / d;
        p.fill = col; p.ellipse(x, y, d * 0.66, rad, true, ang);
        p.fill = '#08080a'; p.poly([x + nx * rad * 0.8 - dx * 0.12, y + ny * rad * 0.8 - dy * 0.12, x + nx * (rad + 6), y + ny * (rad + 6), x + nx * rad * 0.8 + dx * 0.12, y + ny * rad * 0.8 + dy * 0.12], true);   // a spine on each segment
        c.save(); c.globalAlpha *= 0.5; c.strokeStyle = 'rgba(190,205,230,0.9)'; p.arc(x, y, rad * 0.6, ang - 2.2, ang - 1.2); c.restore();
      }
      const Q = P(0.97), ang = Math.atan2(ty - Q[1], tx - Q[0]);
      c.save(); c.translate(tx, ty); c.rotate(ang);
      c.save(); if (angry) { c.shadowColor = VENOM; c.shadowBlur = 12; }
      const vg = c.createRadialGradient(5, -3, 1, 7, 0, 14); vg.addColorStop(0, '#d9ffcc'); vg.addColorStop(0.35, angry ? '#5ee84a' : '#3fae35'); vg.addColorStop(1, '#14400f');
      c.fillStyle = vg; c.beginPath(); c.ellipse(7, 0, 13, 9.5, 0, 0, TAU); c.fill(); c.strokeStyle = '#0a1a08'; c.stroke();   // glowing venom bulb
      c.restore();
      p.fill = '#050506'; p.poly([16, -5, 34, 2, 42, 16, 30, 6, 16, 5], true);         // black hooked stinger
      if (angry) { const drip = (t * 1.3 + i * 0.37) % 1; c.fillStyle = VENOM; c.globalAlpha *= 1 - drip * 0.6; c.beginPath(); c.ellipse(41, 18 + drip * 18, 2, 2.8 + drip * 1.5, 0, 0, TAU); c.fill(); }
      c.restore();
      e.tips[i] = [(tx - 33) * SK, (ty + 14) * SK];
    };
    for (let i = 0; i < 4; i++) leg(32 - i * 22, 16, i, true);
    claw(true);
    for (let i = 0; i < 3; i++) tail(i);
    // mesosoma: overlapping glossy armour plates with a spiked keel along the back
    p.fill = BODY;
    p.poly([-82, 16, -78, -6, -50, -18, 0, -22, 40, -18, 52, 6, 48, 34, 0, 42, -50, 40, -78, 32], true);
    for (let k = 0; k < 6; k++) { const x = -64 + k * 18; c.save(); c.strokeStyle = '#2c2c34'; p.curve(x, -18, x + 6, 12, x, 40); c.restore(); gloss(x - 14, -14 + Math.abs(k - 2.5), x - 3, -16 + Math.abs(k - 2.5), 0.5); }
    p.fill = '#08080a'; for (let k = 0; k < 7; k++) { const x = -70 + k * 17; p.poly([x - 3, -16 - (k === 3 ? 1 : 0), x + 1, -26 - (k % 2) * 3, x + 4, -17], true); }
    bristles([-78, 34, -40, 41, 0, 43, 40, 36], 4, 7, 1);
    // prosoma (carapace): glowing red median eyes, lateral eye clusters, twitching mouth pincers
    p.fill = BODY; p.poly([38, -16, 62, -20, 84, -10, 94, 10, 88, 32, 50, 38, 40, 20], true);
    gloss(44, -14, 84, -8, 0.6);
    c.save(); c.strokeStyle = '#2c2c34'; p.line(58, -18, 62, 32); c.restore();
    const blink = mood === 'sleep' || mood === 'dizzy';
    c.save(); if (angry) { c.shadowColor = '#ff2a14'; c.shadowBlur = 9; }
    const eyeAt = (x, y, r) => { if (blink) { p.line(x - r, y, x + r, y); return; } c.globalAlpha = angry ? 1 : 0.85; p.circle(x, y, r, '#ff2a14'); c.globalAlpha = 1; c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(x - r * 0.35, y - r * 0.35, Math.max(0.5, r * 0.3), 0, TAU); c.fill(); };
    eyeAt(66, -14, 3.6); eyeAt(73, -15, 3.4);
    for (const [x, y] of [[84, -6], [88, -2], [86, 2], [82, -9], [90, 3]]) eyeAt(x, y, 1.5);
    c.restore();
    const mw = Math.sin(t * 11 + e.seed) * (angry ? 0.35 : 0.12);
    for (const [bx, by, s2] of [[92, 12, 1], [92, 20, -1]]) { c.save(); c.translate(bx, by); c.rotate(s2 * mw); p.fill = BAND; p.poly([0, -4, 12, -3, 15, 0, 12, 3, 0, 4], true); p.line(12, -1, 16, -3); c.restore(); }
    for (let i = 0; i < 4; i++) leg(36 - i * 22, 24, i, false);
    claw(false);
    p.fill = BODY;
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
    p.use('dark'); c.save(); c.shadowColor = '#ff2a14'; c.shadowBlur = 9; p.ellipse(43, -10, 5, 8, '#b3140c', 0.2); c.restore(); p.circle(44.5, -13, 1.6, '#fff');
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
    if (mood !== 'dizzy' && mood !== 'sleep') { c.save(); c.shadowColor = '#ff2a14'; c.shadowBlur = 9; p.circle(70, 6, 3.4, '#ff3b30'); c.restore(); p.dot(70.5, 6, 1.2); } else D.eye(p, 70, 6, 2.8, e, 1);
    p.line(74, 16, 80, 20); p.line(76, 14, 82, 15);
    p.use('gold'); p.poly([32, -20, 32, -30, 36, -24, 40, -32, 44, -24, 48, -29, 48, -19], true);   // king's crown
    for (let i = 0; i < 3; i++) leg(32 - i * 30, i, false);
    p.use('body');
  };

  // ---------- the giant praying mantis: raised neck, triangle head, spiked folding forelegs ----------
  D.mantisClaw = [96, -26];   // template coords where the forelegs hold a grabbed victim
  D.mantis = function () { return { w: 250, h: 230, draw(p, e, t) { p.ctx.translate(-20, 12); D.drawMantis(p, e, t); } }; };
  D.drawMantis = function (p, e, t) {
    const c = p.ctx, mood = e.mood, held = e.held;
    const walking = e.moving && e.grounded && !held;
    const angry = mood === 'angry' || e.mode === 'hunt';
    const inAir = !e.grounded && !held;
    const G = 100, ph = e.phase * 1.6;
    if (e.camo > 0) c.globalAlpha *= 1 - e.camo * 0.72;                       // camouflage
    const sway = held ? Math.sin(t * 10) * 6 : Math.sin(t * 1.3 + e.seed) * 3; // mantises rock like a leaf in the wind
    const thin = (k) => { c.save(); c.lineWidth *= k; };
    // walking leg: thin femur up to a high knee, tibia down, then a jointed tarsus with a little claw
    const leg = (ax, ay, kx, ky, fx, fy, far) => {
      p.use(far ? 'far' : 'leg'); p.stroke(SB.shade(p.fill, 0.55)); thin(0.7);       // thin legs get a dark-green outline, not black
      D.tube(p, ax, ay, (ax + kx) / 2, (ay + ky) / 2 - 3, kx, ky, far ? 6.5 : 7.5, 5, 5, true);
      D.tube(p, kx, ky, (kx + fx) / 2 + (fx > kx ? 2 : -2), (ky + fy) / 2, fx, fy - 5, 4.6, 3, 6, true);
      const dir = fx > ax ? 1 : -1;
      p.path([fx, fy - 5, fx + dir * 2, fy - 1.5, fx + dir * 5, fy, fx + dir * 8, fy - 0.5], false); p.line(fx + dir * 8, fy - 0.5, fx + dir * 9.5, fy - 2.5);
      c.restore(); p.dot(kx, ky, far ? 1.4 : 1.8); p.stroke();
      p.use('body');
    };
    const walkLegs = (far) => {
      const a = ph + (far ? Math.PI : 0), up = inAir ? 16 : held ? 18 : 0, fo = far ? 6 : 0;
      const s1 = walking ? Math.sin(a) * 11 : 0, l1 = walking ? Math.max(0, Math.cos(a)) * 9 : 0;
      const s2 = walking ? Math.sin(a + Math.PI) * 11 : 0, l2 = walking ? Math.max(0, Math.cos(a + Math.PI)) * 9 : 0;
      leg(6, 20, 36 + s1 * 0.3, -2 - fo, 58 + s1, G - l1 - up - fo, far);        // middle leg
      leg(-10, 22, -50 + s2 * 0.3, -4 - fo, -92 + s2, G - l2 - up - fo, far);    // hind leg
    };
    // raptorial foreleg: long coxa hanging from the "shoulder", a thick femur lined with spines,
    // and a spined tibia that folds back against it like a pocket knife, ending in a hook
    const foreleg = (far) => {
      const sk = e.strikeT > 0 ? Math.min(1, (0.3 - e.strikeT) / 0.12) : 0;
      const sl = e.slashT > 0 ? Math.sin((1 - e.slashT / 0.35) * Math.PI) : 0;
      const o = far ? -5 : 0, bx = 48 + sway * 0.45 + o, by = -56 + o;
      let cx = bx + 8, cy = by + 30, fx = 92, fy = -64, tx = 70, ty = -38;
      if (e.grabbed) { fx = 112; fy = -54; tx = 120; ty = -28; }
      else if (sk > 0) { fx = 92 + 40 * sk; fy = -64 + 18 * sk; tx = 70 + 94 * sk; ty = -38 - 6 * sk; }
      else if (sl > 0) { fx = 92 + 22 * sl; fy = -64 - 36 * sl; tx = 70 + 78 * sl; ty = -38 - (far ? 10 : -6) * sl; }
      else if (held) { fx = 84; fy = -88 + Math.sin(t * 12 + o) * 6; tx = 102; ty = -98; }
      else if (angry) { fx = 98; fy = -78; tx = 82; ty = -52; }               // raised, ready to strike
      fx += sway * 0.5 + o; tx += sway * 0.5 + o; fy += o; ty += o;
      p.use(far ? 'far' : 'body');
      D.tube(p, bx, by, bx + 2, (by + cy) / 2, cx, cy, far ? 7 : 8.5, far ? 6 : 7, 4, true);   // coxa
      p.circle(cx, cy, far ? 3.2 : 3.8, true);                                                  // trochanter
      // femur: swollen in the middle, spines along the inner edge
      const fdx = fx - cx, fdy = fy - cy, fl = Math.hypot(fdx, fdy) || 1, ux = fdx / fl, uy = fdy / fl, nx = -uy, ny = ux;
      const fw = far ? 6 : 7.5, side = (ny > 0 ? 1 : -1);                                       // spines on the side facing down/inward
      p.poly([cx + nx * fw * 0.6, cy + ny * fw * 0.6, cx + fdx * 0.45 + nx * fw, cy + fdy * 0.45 + ny * fw, fx + nx * fw * 0.5, fy + ny * fw * 0.5,
        fx - nx * fw * 0.5, fy - ny * fw * 0.5, cx + fdx * 0.45 - nx * fw, cy + fdy * 0.45 - ny * fw, cx - nx * fw * 0.6, cy - ny * fw * 0.6], true);
      thin(0.75);
      for (let k = 1; k <= 7; k++) { const u = 0.12 + k * 0.11, w = fw * (0.55 + 0.45 * Math.sin(u * Math.PI)), big = k === 3 || k === 6 ? 1.7 : 1;
        const x = cx + fdx * u + nx * side * w, y = cy + fdy * u + ny * side * w;
        p.line(x, y, x + nx * side * 4 * big + ux * 1.5, y + ny * side * 4 * big + uy * 1.5); }
      c.restore();
      // tibia with fine spines and a hooked tip, plus the little tarsus
      const tdx = tx - fx, tdy = ty - fy, tl = Math.hypot(tdx, tdy) || 1, vx = tdx / tl, vy = tdy / tl, mx = -vy, my = vx;
      D.tube(p, fx, fy, (fx + tx) / 2, (fy + ty) / 2, tx, ty, far ? 5 : 6, far ? 3.5 : 4, 5, true);
      thin(0.7);
      const tside = (mx * nx + my * ny) > 0 ? side : -side;
      for (let k = 1; k <= 5; k++) { const u = k / 6, x = fx + tdx * u + mx * tside * 2.5, y = fy + tdy * u + my * tside * 2.5; p.line(x, y, x + mx * tside * 3 - vx, y + my * tside * 3 - vy); }
      c.restore();
      p.curve(tx, ty, tx + vx * 6 + mx * tside * 2, ty + vy * 6 + my * tside * 2, tx + vx * 4 + mx * tside * 6, ty + vy * 4 + my * tside * 6);   // hook
      thin(0.7); p.path([tx - vx * 4, ty - vy * 4, tx - vx * 4 - mx * tside * 6, ty - vy * 4 - my * tside * 6 + 3, tx - vx * 6 - mx * tside * 9, ty - vy * 6 - my * tside * 9 + 7], false); c.restore();   // tarsus
      p.dot(fx, fy, far ? 2 : 2.4);
      p.use('body');
    };
    walkLegs(true);
    foreleg(true);
    // abdomen: widest in the middle, tapering, the tip tilted up; pale underside with segment lines
    p.use('body');
    const ab = [-4, 12, -30, 4, -70, 2, -104, 6, -122, 12, -128, 8, -126, 18, -110, 28, -76, 34, -40, 32, -14, 24];
    p.poly(ab, true);
    p.use('belly'); p.poly([-14, 24, -40, 32, -76, 34, -110, 28, -122, 21, -100, 24, -70, 27, -36, 24], true);
    c.save(); c.globalAlpha *= 0.55; for (let k = 0; k < 7; k++) { const x = -26 - k * 13; p.line(x, 24 + Math.min(4, k * 0.8), x - 2, 31 + Math.min(3, k * 0.4)); } c.restore();
    D.hatch(p, -110, 26, -30, 28, 9, 3, -1.2);
    // wings: leathery forewings (tegmina) folded over the abdomen with a vein network, or spread while leaping
    p.use('wing');
    if (inAir && e.leapT > 0) {
      const f = Math.sin(t * 40);
      c.save(); c.globalAlpha *= 0.7;
      p.ellipse(-34, -30 - f * 8, 50, 19, true, -0.5 - f * 0.25); p.ellipse(-50, -20 - f * 5, 44, 16, true, -0.8 - f * 0.2);
      thin(0.6); for (let k = 0; k < 5; k++) p.line(-4, -8, -60 - k * 6, -46 + k * 9 - f * 6); c.restore();
      c.restore();
    } else {
      p.poly([-2, 6, -24, -2, -62, -4, -100, 0, -120, 8, -106, 14, -66, 14, -28, 12], true);
      thin(0.6); c.save(); c.globalAlpha *= 0.6;
      p.curve(-4, 7, -60, 2, -116, 8);
      for (let k = 0; k < 7; k++) { const x = -18 - k * 14; p.line(x, 4 - (k > 4 ? 1 : 0), x - 12, 11 + (k > 4 ? 0 : 1)); p.line(x - 4, 5, x - 10, 1); }
      c.restore(); c.restore();
      p.ellipse(-36, 4, 4, 2.2, '#e8f5c8', -0.1);                                        // stigma spot
    }
    walkLegs(false);
    // meso/metathorax, then the long slim prothorax that widens where the forelegs attach
    p.use('body');
    p.ellipse(-2, 15, 15, 9, true, -0.15);
    D.tube(p, 4, 12, 22, -18 + sway, 46 + sway * 0.45, -58, 11, 7, 8, true);
    p.ellipse(47 + sway * 0.45, -57, 8.5, 6.5, true, -0.9);
    p.use('belly'); D.tube(p, 8, 18, 24, -12 + sway, 46 + sway * 0.45, -50, 4, 3, 6, true); p.use('body');
    // head: rounded triangle with big bulging compound eyes on top and the mouth at the point
    const hx = 58 + sway * 0.5, hy = -76;
    thin(0.55); c.save(); c.globalAlpha *= 0.9; p.stroke('#2f5a20');
    p.curve(hx + 4, hy - 13, hx + 18, hy - 46, hx + 50, hy - 56); p.curve(hx, hy - 13, hx + 8, hy - 50, hx + 36, hy - 66);   // thin antennae
    c.restore(); c.restore();
    p.poly([hx - 9, hy - 5, hx - 3, hy - 13, hx + 9, hy - 15, hx + 16, hy - 8, hx + 13, hy + 4, hx + 7, hy + 15, hx + 1, hy + 9, hx - 5, hy + 3], true);
    p.use('eye'); c.save(); c.shadowColor = p.fill; c.shadowBlur = 10; p.ellipse(hx + 7, hy - 7, 7.5, 8.5, true, 0.3); c.restore();
    c.save(); c.globalAlpha *= 0.45; p.arc(hx + 7, hy - 7, 5.5, Math.PI + 0.5, Math.PI + 1.6); c.restore();
    p.dot(hx + 7 + e.lookX * 2.2, hy - 7 + e.lookY * 2.2, 1.9);              // the dark "pseudopupil" that seems to follow you
    p.dot(hx + 1, hy - 12, 0.9); p.dot(hx + 4, hy - 13.5, 0.9);             // ocelli
    if (angry) { thin(1.7); p.line(hx - 1, hy - 17, hx + 15, hy - 13); c.restore(); }
    p.use('body'); thin(0.7); p.line(hx + 7, hy + 15, hx + 10, hy + 20); p.line(hx + 5, hy + 14, hx + 4, hy + 20); c.restore();   // palps
    foreleg(false);
  };

  // ---------- the phoenix: a giant bird of living fire ----------
  D.phoenixBeak = [88, -30];   // template coords of the beak tip (where its fireballs come from)
  D.PHX_REBIRTH = 3.6;         // seconds from bursting into flame to rising from the ashes
  D.phoenix = function () { return { w: 170, h: 150, draw(p, e, t) { if (e.rebirthT > 0) D.drawPhoenixRebirth(p, e, t); else D.drawPhoenix(p, e, t); } }; };
  // a flame-shaped feather from (x,y) along angle a: the vane with a dark edge, and a glowing inner flame toward the tip.
  // Drawn straight onto the canvas (flat colour, soft dark edge): a phoenix wears a couple of hundred of them.
  const FEATHER_EDGE = new Map();
  const featherPath = (c, x, y, ca, sa, len, wid, P) => {   // smooth closed outline through (u,v) pairs, sharp at the tongue tips (v < -0.05 marks none)
    const n = P.length / 2, X = i => x + ca * P[i * 2] * len - sa * P[i * 2 + 1] * wid, Y = i => y + sa * P[i * 2] * len + ca * P[i * 2 + 1] * wid;
    c.beginPath(); c.moveTo((X(n - 1) + X(0)) / 2, (Y(n - 1) + Y(0)) / 2);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; c.quadraticCurveTo(X(i), Y(i), (X(i) + X(j)) / 2, (Y(i) + Y(j)) / 2); }
    c.closePath();
  };
  const FV = [0, -0.2, 0.3, -0.52, 0.62, -0.47, 0.84, -0.3, 1.08, -0.1, 0.9, 0.06, 1.02, 0.26, 0.8, 0.44, 0.45, 0.52, 0.12, 0.32], FV2 = FV.slice();
  const FT = [0.4, -0.22, 0.7, -0.24, 0.98, -0.1, 0.82, 0.08, 0.92, 0.24, 0.6, 0.24], FT2 = FT.slice();
  D.fireFeather = function (p, x, y, a, len, wid, col, tip, t, seed) {
    const c = p.ctx, ca = Math.cos(a), sa = Math.sin(a), fl = Math.sin(t * 12 + seed) * 0.07, fl2 = Math.sin(t * 17 + seed * 1.7) * 0.06;
    FV2[6] = FV[6] + fl; FV2[8] = FV[8] + fl * 2; FV2[12] = FV[12] + fl2 * 2;   // the tongues of the tip flicker
    let edge = FEATHER_EDGE.get(col); if (!edge) { edge = SB.shade(col, 0.5); FEATHER_EDGE.set(col, edge); }
    const lw = c.lineWidth;
    featherPath(c, x, y, ca, sa, len, wid, FV2); c.fillStyle = col; c.fill(); if (len > 21) { c.strokeStyle = edge; c.lineWidth = lw * 0.4; c.stroke(); }
    if (tip) { FT2[4] = FT[4] + fl * 2; FT2[8] = FT[8] + fl2 * 2; featherPath(c, x, y, ca, sa, len, wid, FT2); c.fillStyle = tip; c.fill(); }
    c.lineWidth = lw;
  };
  // a soft, glowing tongue of fire standing on (x,y): layered tongues, red-orange outside, white-hot inside
  const tongue = (c, x, y, r, h, sw) => {
    c.beginPath(); c.moveTo(x - r, y);
    c.bezierCurveTo(x - r * 1.15, y - h * 0.45, x + sw - r * 0.35, y - h * 0.72, x + sw, y - h);
    c.bezierCurveTo(x + sw * 0.6 + r * 0.25, y - h * 0.62, x + r * 1.15, y - h * 0.4, x + r, y);
    c.quadraticCurveTo(x, y + r * 0.7, x - r, y); c.fill();
  };
  D.softFlame = function (p, x, y, r, t, seed, alpha) {
    const c = p.ctx, f = 1 + Math.sin(t * 13 + seed) * 0.16 + Math.sin(t * 21 + seed * 2.3) * 0.08, sw = Math.sin(t * 9 + seed * 1.3) * r * 0.35, h = r * 2.7 * f;
    const a0 = c.globalAlpha; c.globalAlpha = a0 * (alpha == null ? 1 : alpha);
    c.fillStyle = 'rgba(235,70,15,0.45)'; tongue(c, x, y + r * 0.1, r * 1.25, h * 1.12, sw * 1.2);
    c.fillStyle = 'rgba(255,150,30,0.85)'; tongue(c, x, y, r, h, sw);
    c.fillStyle = 'rgba(255,215,90,0.95)'; tongue(c, x, y, r * 0.66, h * 0.66, sw * 0.6);
    c.fillStyle = 'rgba(255,250,215,0.95)'; tongue(c, x, y, r * 0.36, h * 0.36, sw * 0.3);
    c.globalAlpha = a0;
  };
  D.drawPhoenix = function (p, e, t) {
    const c = p.ctx, mood = e.mood, held = e.held, ko = e.ko;
    const flying = e.flying && !held, diving = e.diveT > 0, swoopUp = diving && e.divePh === 'up';
    const flapping = e.throwT > 0, windup = e.throwT > 0.32;
    const grounded = !flying && !held && !ko && e.grounded;
    const angry = mood === 'angry' || e.mode === 'hunt' || diving || flapping;
    const burnt = ko && e.reborn && !(e.rebirthT > 0);   // the final knock-out: the fire has gone out of it
    const tint = p.tint;   // hit flash and poison
    const ash = k => { if (burnt) k = SB.mixColor(k, '#3a3230', 0.72); return tint ? SB.mixColor(k, tint, 0.55) : k; };
    const col = r => ash(p.use(r).fill);
    const body = col('body'), wingC = col('wing'), tailC = col('tail'), beakC = col('beak'), legC = tint ? ash(p.use('leg').fill) : p.use('leg').fill;
    const gold = '#ffd23f', hot = '#fff1a8';
    const tipOf = k => burnt ? SB.shade(k, 0.1) : SB.mixColor(k, gold, 0.72);
    // wing beat: s is the wing's vertical stretch (1 = raised high over the back, negative = swept down below the body)
    let s, rot;
    if (held) { s = Math.sin(t * 16) * 0.9; rot = 0; }
    else if (ko) { s = -0.4; rot = -0.5; }
    else if (diving && !swoopUp) { s = 0.42 + Math.sin(t * 30) * 0.03; rot = -1.0; }
    else if (swoopUp) { s = Math.sin(t * 15); rot = -0.15; }
    else if (flapping) { s = windup ? 1 : -0.85; rot = windup ? 0.1 : 0.3; }
    else if (flying) { s = 0.15 + 0.85 * Math.sin(t * 6.5 + e.seed); rot = -0.1 + Math.cos(t * 6.5 + e.seed) * 0.14; }
    else { s = 0.36; rot = -0.85; }
    const s2 = held || flying ? s * 0.92 + 0.05 : s;
    c.save();
    c.rotate(e.pitch || 0);   // nose down in a dive, up as it pulls out
    // heat glow around the whole bird
    if (!burnt) {
      const gl = 0.24 + 0.06 * Math.sin(t * 9 + e.seed), g = c.createRadialGradient(0, -6, 10, 0, -6, 130);
      g.addColorStop(0, 'rgba(255,175,60,' + gl + ')'); g.addColorStop(1, 'rgba(255,90,20,0)');
      c.save(); c.fillStyle = g; c.beginPath(); c.arc(0, -6, 130, 0, TAU); c.fill(); c.restore();
    }
    // a wing in its own frame: shoulder at the origin, raised toward -y, the trailing edge toward -x
    const E = [-16, -30], Wr = [4, -54], Tp = [-44, -80];   // elbow, wrist, wing tip
    const wing = (sx, sy, s, rot, far) => {
      const k = far ? 0.3 : 0;
      const wc = SB.shade(wingC, k), bc = SB.shade(body, k), sc2 = SB.shade(tailC, k + 0.06), tc = far ? SB.shade(tipOf(wingC), 0.2) : tipOf(wingC);
      const cr = Math.cos(rot), sr = Math.sin(rot);
      const toG = (x, y) => [sx + x * cr - y * s * sr, sy + x * sr + y * s * cr];   // wing frame -> drawing
      c.save(); c.translate(sx, sy); c.rotate(rot); c.scale(1, s);
      // the web of the wing under the feathers, so no sky shows between them
      p.poly([0, 4, -18, 0, -38, -10, -52, -30, Tp[0] + 2, Tp[1] + 4, Wr[0] - 6, Wr[1] + 4, E[0], E[1]], SB.shade(wc, 0.45));
      // secondaries hang back from the forearm, primaries fan out from the hand like fingers of flame
      for (let i = 5; i >= 0; i--) { const f = i / 5, bx = -4 + (Wr[0] + 2) * f, by = -2 + (Wr[1] + 2) * f; D.fireFeather(p, bx - 4, by, Math.PI - 0.08 - f * 0.3, 44 + f * 6, 18, sc2, tc, t, e.seed + i); }
      for (let i = 0; i <= 5; i++) { const f = i / 5, bx = Wr[0] + (Tp[0] - Wr[0]) * f * 0.85, by = Wr[1] + (Tp[1] - Wr[1]) * f * 0.85; D.fireFeather(p, bx, by, Math.atan2(-0.3 - f * 0.65, -1 + f * 0.35), 48 + Math.sin(f * 2.6) * 14, 16, wc, tc, t, e.seed + 10 + i); }
      // the leading edge: shoulder, elbow, wrist and hand
      p.poly([-6, 6, 6, -4, 3, -26, 9, -46, 7, -56, -2, -59, Tp[0] - 2, Tp[1] - 2, Tp[0] + 4, Tp[1] + 5, -8, -50, -6, -30, -10, -8], bc);
      // coverts: overlapping rows of shorter feathers over the arm and hand, darker toward the edge
      for (let i = 0; i < 6; i++) { const f = (i + 0.5) / 6, bx = 0 + (Wr[0] - 2) * f, by = 0 + Wr[1] * f; D.fireFeather(p, bx, by, Math.PI - 0.05 - f * 0.2, 30, 14, SB.mixColor(wc, sc2, 0.4), tc, t, e.seed + 20 + i); }
      for (let i = 0; i < 4; i++) { const f = (i + 0.5) / 4, bx = Wr[0] + (Tp[0] - Wr[0]) * f * 0.75, by = Wr[1] + (Tp[1] - Wr[1]) * f * 0.75; D.fireFeather(p, bx, by, Math.atan2(-0.35 - f * 0.4, -1), 28, 12, wc, tc, t, e.seed + 30 + i); }
      c.save(); c.globalAlpha *= 0.35; p.curve(6, -6, 2, -28, 8, -52); c.restore();
      c.restore();
      if (!burnt && s > 0.2) { const [fx, fy] = toG(Tp[0] - 34, Tp[1] - 30); D.softFlame(p, fx, fy + 6, far ? 6 : 8, t, e.seed + (far ? 4 : 7), 0.85); }
    };
    // tail: long flowing plumes that stream out behind, each ending in a burning eye-feather
    const tail = back => {
      const n = 7;
      if (!back) for (let i = 0; i < 5; i++) D.fireFeather(p, -22, 0 + i * 3, Math.PI - 0.25 + i * 0.13, 40, 17, SB.shade(tailC, 0.12 - i * 0.02), tipOf(tailC), t, e.seed + 80 + i);   // tail coverts
      for (let i = back ? 0 : 3; i < (back ? 3 : n); i++) {
        const f = i / (n - 1), sway = Math.sin(t * 3 + i * 0.8 + e.seed) * (diving ? 3 : 8), sway2 = Math.sin(t * 2.4 + i * 1.1 + e.seed) * (diving ? 4 : 13);
        const droop = grounded ? 26 : diving ? -6 : 0;
        const x0 = -20, y0 = 2 + f * 6, cx = -64, cy = 4 + f * 16 + sway + droop * 0.5, x1 = -112 + f * 14, y1 = 2 + f * 36 + sway2 + droop;
        const tc = SB.shade(tailC, back ? 0.28 : (i % 2) * 0.1);
        const mid = D.tube(p, x0, y0, cx, cy, x1, y1, 13, 4, 8, tc);
        for (let j = 2; j < mid.length - 1; j += 3) { const [mx, my] = mid[j], [nx, ny] = mid[j + 1]; const a = Math.atan2(ny - my, nx - mx); D.fireFeather(p, mx, my, a + (j % 2 ? 0.3 : -0.3), 26 - j * 1.5, 8, SB.shade(tailC, back ? 0.32 : 0.04 + (j % 2) * 0.06), null, t, e.seed + i * 7 + j); }
        const [ex, ey] = mid[mid.length - 1], [px, py] = mid[mid.length - 2], a = Math.atan2(ey - py, ex - px);
        D.fireFeather(p, ex - Math.cos(a) * 6, ey - Math.sin(a) * 6, a, 40, 16, tc, tipOf(tailC), t, e.seed + 40 + i);
        if (back || i % 2) continue;
        c.save();
        p.ellipse(ex + Math.cos(a) * 12, ey + Math.sin(a) * 12, 6, 4.2, burnt ? '#4a3e38' : hot, a);
        p.ellipse(ex + Math.cos(a) * 12, ey + Math.sin(a) * 12, 3, 2.2, burnt ? '#2a2422' : SB.shade(body, 0.1), a); c.restore();
      }
    };
    // a leg: feathered thigh, scaly shank and four taloned toes (open: 0 curled .. 1 spread to grab)
    const leg = (hx, hy, kx, ky, fx, fy, ta, open, far) => {
      const k = far ? 0.3 : 0;
      for (let i = 0; i < 3; i++) D.fireFeather(p, hx - 6 + i * 6, hy - 4, Math.atan2(ky - hy, kx - hx) + (i - 1) * 0.3, 22, 12, SB.shade(body, k + 0.05), null, t, e.seed + 50 + i);
      D.cap(p, kx, ky, fx, fy, 7, 5, SB.shade(legC, k));
      c.save(); c.globalAlpha *= 0.4; D.hatch(p, kx + (fx - kx) * 0.15, ky + (fy - ky) * 0.15, kx + (fx - kx) * 0.9, ky + (fy - ky) * 0.9, 4, 3, Math.atan2(fy - ky, fx - kx) + 1.4); c.restore();
      const toe = (a, L) => {
        const tx = fx + Math.cos(a) * L, ty = fy + Math.sin(a) * L;
        D.cap(p, fx, fy, tx, ty, 4.2, 3.2, SB.shade(legC, k));
        const nx = -Math.sin(a), ny = Math.cos(a), ca = Math.cos(a + 1.1 - open * 0.4), sa = Math.sin(a + 1.1 - open * 0.4);   // a hooked black talon
        p.poly([tx - nx * 1.8, ty - ny * 1.8, tx + Math.cos(a) * 3 + ca * 6, ty + Math.sin(a) * 3 + sa * 6, tx + nx * 1.8, ty + ny * 1.8], '#1a1210');
      };
      const sp = 0.25 + open * 0.45;
      toe(ta - sp, 12); toe(ta + sp, 11); toe(ta, 14); toe(ta + Math.PI - 0.3, 8);
    };
    let L;   // leg pose: hip, knee, foot, toe direction, how open the talons are
    if (held) { const sw = Math.sin(t * 14) * 4; L = [2, 14, 2 + sw, 34, 4 - sw, 54, Math.PI / 2, 0.9]; }
    else if (diving && !swoopUp) L = [6, 14, 20, 30, 38, 42, 0.5, 1];
    else if (flying || swoopUp) L = [2, 14, -8, 26, -26, 30, Math.PI - 0.5, 0.15];
    else if (ko) L = [2, 14, -4, 34, -2, 52, Math.PI / 2, 0.3];
    else L = [2, 14, -6, 46, 4, 70, 0, 0.55];
    const legs = far => leg(L[0] + (far ? 6 : 0), L[1] - (far ? 2 : 0), L[2] + (far ? 6 : 0), L[3] - (far ? 2 : 0), L[4] + (far ? 7 : 0), L[5] - (far ? 2 : 0), L[6], L[7], far);
    // ---- paint, back to front ----
    tail(true);
    wing(18, -22, s2, rot - 0.08, true);
    legs(true);
    tail(false);
    // a body of glowing embers under the plumage
    p.poly([46, -14, 38, -25, 18, -27, -4, -23, -22, -13, -30, 0, -24, 12, -6, 21, 14, 23, 32, 13, 43, 1], body);
    p.poly([45, -10, 41, 2, 30, 12, 12, 19, 16, 4, 30, -6], SB.mixColor(body, tailC, 0.5));   // breast
    for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) D.fireFeather(p, 30 - i * 13 - j * 6, -2 + j * 10 - i * 2, Math.PI - 0.35 + j * 0.2, 20, 11, SB.mixColor(body, tailC, 0.32 - j * 0.12), null, t, e.seed + 90 + i + j * 4);   // breast and flank feathers
    if (!burnt) {   // embers glowing through
      c.save();
      for (let i = 0; i < 9; i++) { const x = -20 + ((i * 37) % 60), y = -16 + ((i * 23) % 34), k = 0.5 + 0.5 * Math.sin(t * 7 + i * 2.1 + e.seed); c.fillStyle = gold; c.globalAlpha = 0.25 * k; c.beginPath(); c.arc(x, y, 3 + k * 2, 0, TAU); c.fill(); c.fillStyle = hot; c.globalAlpha = 0.45 + 0.5 * k; c.beginPath(); c.arc(x, y, 1.2 + k, 0, TAU); c.fill(); }
      c.restore();
    }
    // neck under a ruff of flame hackles
    D.tube(p, 24, -12, 44, -18, 58, -32, 28, 18, 6, body);
    for (let i = 0; i < 7; i++) { const f = i / 6; D.fireFeather(p, 54 - f * 28, -36 + f * 22, 2.55 + f * 0.2, 28 - f * 4, 15, SB.mixColor(body, wingC, 0.35 + (i % 2) * 0.2), tipOf(wingC), t, e.seed + 60 + i); }
    legs(false);
    // head: crest of fire, hooked beak, glowing eye
    const hx = 62, hy = -37;
    for (let i = 0; i < 6; i++) D.fireFeather(p, hx - 6 + i * 2.4, hy - 7, -2.4 - i * 0.12 + Math.sin(t * 4 + i) * 0.05, 36 - i * 3 + (angry ? 5 : 0), 11, i % 2 ? wingC : tailC, tipOf(tailC), t, e.seed + 70 + i);
    p.ellipse(hx, hy, 14, 11, body, -0.25);
    D.fireFeather(p, hx + 4, hy + 6, 2.7, 18, 10, SB.shade(body, -0.1), null, t, e.seed + 77);   // cheek
    p.ellipse(hx + 2, hy - 1, 8.5, 5.5, SB.shade(body, 0.4), -0.2);   // dark mask around the eye
    const jaw = flapping && !windup ? 0.5 : diving && !swoopUp ? 0.3 : angry && Math.sin(t * 2.3 + e.seed) > 0.6 ? 0.25 : 0;
    c.save(); c.translate(71, -31); c.rotate(jaw);
    p.poly([-1, 1, 10, 2, 14, 4, 1, 6], SB.shade(beakC, 0.25)); c.restore();   // lower mandible
    if (jaw > 0.2 && !burnt) p.poly([72, -30, 84, -28, 82, -24 + jaw * 6, 73, -26], '#ffb02e');
    p.poly([68, -44, 78, -42, 86, -37, 90, -31, 89, -24, 86, -28, 81, -31, 70, -31], beakC);   // hooked upper mandible
    p.poly([67, -44, 73, -43, 72, -32, 67, -33], SB.shade(beakC, 0.3));   // cere
    p.dot(75, -38, 1.1);
    D.eye(p, hx + 3, hy - 2, 3.8, e, 1);
    wing(10, -18, s, rot, false);
    if (!burnt) { D.softFlame(p, -6, -20, 7, t, e.seed + 1, 0.9); D.softFlame(p, 14, -25, 6, t, e.seed + 2, 0.9); D.softFlame(p, hx - 12, hy - 26, 7, t, e.seed + 3, 0.9); }
    c.restore();
  };
  // the rebirth: the bird bursts into a pillar of flame, an egg glows in a heap of ash, then it hatches and rises again
  D.drawPhoenixRebirth = function (p, e, t) {
    const c = p.ctx, u = 1 - e.rebirthT / D.PHX_REBIRTH, gy = 75;
    const column = (h, a) => {   // a pillar of fire h tall standing on the ground
      c.save(); c.globalAlpha *= a;
      const g = c.createLinearGradient(0, gy, 0, gy - h); g.addColorStop(0, 'rgba(255,245,190,0.95)'); g.addColorStop(0.3, 'rgba(255,170,40,0.85)'); g.addColorStop(0.7, 'rgba(240,80,15,0.5)'); g.addColorStop(1, 'rgba(160,30,10,0)');
      c.fillStyle = g; c.beginPath(); const w = 32 + h * 0.1;
      c.moveTo(-w, gy); for (let i = 0; i <= 8; i++) { const f = i / 8; c.lineTo(-w * (1 - f * 0.75) + Math.sin(t * 9 + i * 1.7) * 7 * f, gy - h * f); }
      for (let i = 8; i >= 0; i--) { const f = i / 8; c.lineTo(w * (1 - f * 0.75) + Math.sin(t * 11 + i * 2.3) * 7 * f, gy - h * f); }
      c.closePath(); c.fill(); c.restore();
      for (let i = 0; i < 5; i++) D.softFlame(p, (i - 2) * 13 + Math.sin(i * 7.1) * 4, gy, 10 + ((i * 5) % 3) * 4 + h * 0.05, t, e.seed + i * 5, a);
    };
    const pile = () => {
      p.poly([-46, gy, -36, gy - 9, -18, gy - 16, 0, gy - 19, 20, gy - 15, 38, gy - 8, 48, gy], '#57504c');
      p.poly([-30, gy, -20, gy - 8, 0, gy - 12, 22, gy - 7, 32, gy], '#3c3633');
      c.save(); c.shadowColor = '#ff7a1a'; c.shadowBlur = 6;
      for (let i = 0; i < 10; i++) { const x = -38 + ((i * 29) % 76), y = gy - 2 - ((i * 13) % 12), k = 0.5 + 0.5 * Math.sin(t * 5 + i * 1.9); c.fillStyle = k > 0.6 ? '#ffd23f' : '#ff6a1a'; c.globalAlpha = 0.4 + 0.6 * k; c.beginPath(); c.arc(x, y, 1.3 + k, 0, TAU); c.fill(); }
      c.restore();
    };
    if (u < 0.22) {   // the old bird burns away inside a pillar of fire
      const a = 1 - u / 0.22;
      c.save(); c.globalAlpha *= a; c.translate(0, (1 - a) * 30); D.drawPhoenix(p, e, t); c.restore();
      column(70 + u / 0.22 * 130, 1);
      return;
    }
    pile();
    const egg = (crack, wob) => {
      c.save(); c.translate(0, gy - 26); c.rotate(Math.sin(t * 18) * wob);
      c.save(); c.shadowColor = '#ff8a1a'; c.shadowBlur = 16 + 8 * Math.sin(t * 6);
      p.ellipse(0, 0, 16, 21, '#c8431a', 0); c.restore();
      p.ellipse(-4, -6, 7, 10, '#e8752a', -0.3);
      c.save(); c.strokeStyle = '#ffe27a'; c.lineWidth = 1.6; c.shadowColor = '#ffb02e'; c.shadowBlur = 8;
      if (crack > 0) p.zigzag(-14, -3, 14, -5, 3.5, Math.max(2, Math.round(crack * 8)));
      if (crack > 0.5) { p.line(-5, -4, -8, 10); p.line(6, -5, 10, 8); }
      c.restore(); c.restore();
    };
    if (u < 0.78) {
      const k = (u - 0.22) / 0.56;
      if (k < 0.35) column(200 * (1 - k / 0.35) + 20, 1 - k / 0.35 * 0.8);
      egg(Math.max(0, (k - 0.3) / 0.7), k > 0.7 ? 0.12 : 0.03);
      return;
    }
    // hatching: the egg bursts and the phoenix rises out of a fresh pillar of fire
    const v = (u - 0.78) / 0.22;
    column(210 * Math.min(1, v * 2), 1 - v * 0.4);
    const kid = Object.assign(Object.create(e), { rebirthT: 0, ko: false, mood: 'angry', flying: true, held: false, diveT: 0, throwT: 0, pitch: -0.3 * (1 - v) });
    c.save(); c.globalAlpha *= Math.min(1, v * 1.6); c.translate(0, (1 - v) * 50); c.scale(0.45 + 0.55 * v, 0.45 + 0.55 * v); D.drawPhoenix(p, kid, t); c.restore();
  };

  // ---------- the giant dragon: a huge ancient black-red dragon that walks and flies ----------
  // Its pose (head, jaw, rearing up, landing crouch) comes from D.dragonPose, shared by the drawing, the 3D model
  // and the fire breath, so the fire always leaves from exactly between its jaws.
  //
  // The ice dragon is the same beast with a different element: def.drgEl = 'ice' picks its colours here, and its
  // breath, rain and stomp in the special below.
  // the dragons' elements: the colours of the fire (or frost) in their breath, throats and eyes. rgba(i, a) picks a
  // colour from the ramp (0 hot glow, 1 pale core, 2 bright, 3 mid, 4 deep, 5 dark, 6 darkest, 7 near-white, 8 white)
  D.DRG_FX = {};
  for (const [k, ramp, o] of [
    ['fire', [[255, 230, 140], [255, 236, 170], [255, 150, 35], [255, 120, 20], [255, 60, 0], [215, 55, 10], [110, 20, 5], [255, 255, 225], [255, 255, 255]], { ember: '#ff6a10', seam: '#ffd27a', scale: '#b0301a', wingRim: '#d0401c', scar: 'rgba(210,170,150,0.5)' }],
    ['ice', [[215, 245, 255], [235, 250, 255], [170, 228, 255], [120, 200, 250], [60, 150, 240], [90, 150, 215], [50, 80, 140], [245, 253, 255], [255, 255, 255]], { ember: '#6fd0ff', seam: '#e6fbff', scale: '#cfeeff', wingRim: '#a8dcff', scar: 'rgba(240,250,255,0.55)' }]]) {
    D.DRG_FX[k] = Object.assign({ ramp, rgba: (i, a) => 'rgba(' + ramp[i][0] + ',' + ramp[i][1] + ',' + ramp[i][2] + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')' }, o);
  }
  D.DRG = { inhale: 0.5, breath: 1.9, tail: 0.8, beat: 0.9, land: 0.6, reach: 250 };   // attack timings (s); breath reach (template units)
  D.DRG_PIVOT = [-44, 80];   // the hind feet: it rears up around them
  D.DRG_HS = 1.15;           // the head is drawn this much bigger than its own frame
  D.DRG_JAW = [-4, 5];       // the jaw hinge in the head's frame
  D.dragonBoss = function () { return { w: 230, h: 160, draw(p, e, t) { D.drawDragonBoss(p, e, t); } }; };
  const sm01 = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  // pose: rear (0..1, up on its hind legs), dy (crouch), head hinge (hx,hy), head angle ha, jaw opening
  D.dragonPose = function (e, t, o) {
    o = o || {};
    const R = D.DRG, held = e.held, ko = e.ko, br = e.breath > 0, inh = br && e.breath > R.breath, rain = e.rainT > 0;
    const air = !!e.flyPh && !held && !ko, seed = e.seed || 0;
    let rear = 0;
    if (e.beatT > 0 && !air) { const u = 1 - e.beatT / R.beat; rear = u < 0.5 ? sm01(u / 0.5) : u < 0.62 ? 1 : 1 - sm01((u - 0.62) / 0.38); }
    o.rear = rear;
    o.dy = e.poundT > 0 ? Math.sin(clamp(e.poundT / R.land, 0, 1) * Math.PI) * 12 : 0;
    const sw = br || rain ? 0 : Math.sin(t * 1.3 + seed) * 3;
    let hx = 100, hy = -64 + sw, ha = 0.22 + sw * 0.02, open = 0.1;
    if (ko) { hx = 100; hy = -26; ha = 0.85; open = 0.32; }
    else if (held) { hx = 98; hy = -56; ha = 0.45 + Math.sin(t * 8) * 0.25; open = 0.5; }
    else if (inh) { const u = sm01((R.inhale + R.breath - e.breath) / R.inhale); hx = 100 - u * 14; hy = -64 - u * 12; ha = 0.22 - u * 0.75; open = 0.15 + u * 0.2; }
    else if (br) { const u = sm01(1 - e.breath / R.breath), aim = air ? 0.3 - u * 0.4 : 0.6 - u * 0.75; open = 0.75; ha = aim - open / 2; hx = 112; hy = -52 + aim * 18; }   // sweeps from the ground at its feet up and out
    else if (rain) { open = 0.75; ha = 1.05 - open / 2; hx = 110; hy = -36; }   // flying over, breathing straight down
    else if (rear > 0) { hx = 100 - rear * 12; hy = -64 - rear * 14; ha = 0.22 - rear * 0.6; open = 0.1 + rear * 0.6; }
    else if (e.whipT > 0) { hx = 96; hy = -68; ha = 0.05; open = 0.45; }
    else if (e.sleeping || e.mood === 'sleep') { hx = 104; hy = -20; ha = 0.45; open = 0; }
    else if (air) { hx = 110; hy = -52 + sw; ha = 0.15; open = e.mood === 'angry' ? 0.3 : 0.12; }
    else {
      if (e.mood === 'angry' || e.mode === 'hunt') open = 0.16 + Math.max(0, Math.sin(t * 2.1 + seed)) * 0.32;
      if (e.moving && e.grounded) hy += Math.sin((e.phase || 0) * 2) * 2;
    }
    o.hx = hx; o.hy = hy; o.ha = ha; o.open = open;
    return o;
  };
  const DMP = {}, DMOUTH = [0, 0, 0];
  // where the fire comes from: halfway between the tips of the jaws, in template coords (facing +x, y down), and its direction
  D.dragonMouth = function (e, t) {
    const P = D.dragonPose(e, t, DMP), HS = D.DRG_HS, [jx, jy] = D.DRG_JAW, co = Math.cos(P.open), so = Math.sin(P.open);
    const lx = 54 - jx, ly = 7 - jy, bx = jx + lx * co - ly * so, by = jy + lx * so + ly * co;   // the lower tip, turned down with the jaw
    const x = (58 + bx) / 2 * HS, y = (2 + by) / 2 * HS, ca = Math.cos(P.ha), sa = Math.sin(P.ha);
    let X = P.hx + x * ca - y * sa, Y = P.hy + x * sa + y * ca, A = P.ha + P.open / 2;
    if (P.rear) { const r = -0.32 * P.rear, cr = Math.cos(r), sr = Math.sin(r), [px, py] = D.DRG_PIVOT, ux = X - px, uy = Y - py; X = px + ux * cr - uy * sr; Y = py + ux * sr + uy * cr; A += r; }
    DMOUTH[0] = X; DMOUTH[1] = Y + P.dy; DMOUTH[2] = A;
    return DMOUTH;
  };
  const qpt = (x0, y0, cx, cy, x1, y1, s, out) => { const m = 1 - s; out[0] = m * m * x0 + 2 * m * s * cx + s * s * x1; out[1] = m * m * y0 + 2 * m * s * cy + s * s * y1; return out; };
  // the wing in its own frame: shoulder at the origin, raised toward -y, trailing edge toward -x
  const DW = { E: [-24, -36], Wr: [6, -74], F: [[-30, -134], [-80, -118], [-116, -86], [-128, -40]], B: [-64, 6] };
  const DP = {}, Q = [0, 0], Q2 = [0, 0];
  D.drawDragonBoss = function (p, e, t) {
    const c = p.ctx, tint = p.tint, P = D.dragonPose(e, t, DP), R = D.DRG;
    const held = e.held, ko = e.ko, air = (!!e.flyPh || e.flying) && !held && !ko;
    const walking = e.moving && e.grounded && !held && !air, seed = e.seed || 0;
    const angry = e.mood === 'angry' || e.mode === 'hunt';
    const tn = k => tint ? SB.mixColor(k, tint, 0.55) : k, col = r => tn(p.use(r).fill);
    const body = col('body'), belly = col('belly'), wingC = col('wing'), spikeC = col('spike'), hornC = col('horn'), mouthC = col('mouth'), teethC = col('teeth'), clawC = col('claw');
    const FX = D.DRG_FX[e.def.drgEl] || D.DRG_FX.fire, emberC = (p.pal && p.pal.ember) || FX.ember, scaleHi = SB.mixColor(body, FX.scale, 0.45);
    const inh = e.breath > R.breath, firing = (e.breath > 0 && !inh) || e.rainT > 0;
    const ember = ko ? 0 : inh ? 0.35 + 0.65 * sm01((R.inhale + R.breath - e.breath) / R.inhale) : firing ? 0.95 : 0.2 + 0.08 * Math.sin(t * 2.2 + seed);
    const dy = P.dy, G = 80 - dy;   // the ground, in the (crouched) body's frame
    // ---- wing pose: ws = vertical stretch (1 raised high, negative swept down), wr = rotation ----
    let ws, wr, wx = 1;   // wx < 1: the fingers folded together
    const fl = t * (e.flyPh === 'up' ? 9 : 5.5) + seed;
    if (held) { ws = Math.sin(t * 12) * 0.8; wr = -0.3; }
    else if (ko) { ws = -0.25; wr = -0.9; }
    else if (e.beatT > 0 && !air) {
      const u = 1 - e.beatT / R.beat;
      if (u < 0.5) { const k = sm01(u / 0.5); ws = 0.45 + k * 0.62; wr = -1.25 + k * 1.3; wx = 0.5 + k * 0.5; }
      else if (u < 0.62) { const k = (u - 0.5) / 0.12; ws = 1.07 - k * 1.9; wr = 0.05 + k * 0.3; }
      else { const k = sm01((u - 0.62) / 0.38); ws = -0.83 + k * 1.28; wr = 0.35 - k * 1.6; wx = 1 - k * 0.5; }
    }
    else if (air) { ws = 0.1 + 0.9 * Math.sin(fl); wr = -0.2 + Math.cos(fl) * 0.12; }
    else if (e.breath > 0) { ws = 0.75; wr = -0.45; }
    else if (e.poundT > 0) { ws = 0.85; wr = -0.35; }
    else if (e.whipT > 0) { ws = 0.55; wr = -0.6; }
    else { ws = 0.45 + (angry ? 0.05 : 0) + Math.sin(t * 1.1 + seed) * 0.02; wr = -1.25; wx = 0.5; }   // folded along the flanks
    const wing = (sx, sy, far) => {
      const k = far ? 0.34 : 0, wc = SB.shade(wingC, k), bone = SB.shade(body, far ? 0.25 : 0), { E, Wr, F, B } = DW;
      c.save(); c.translate(sx, sy); c.rotate(wr + (far ? 0.06 : 0)); c.scale(wx, ws * (far ? 0.92 : 1));
      // the membrane: shoulder, leading edge to the wrist, out to each finger tip with scalloped edges between, back to the flank
      c.beginPath(); c.moveTo(2, 2); c.quadraticCurveTo(16, -38, Wr[0], Wr[1]); c.lineTo(F[0][0], F[0][1]);
      for (let i = 1; i <= F.length; i++) {
        const a = F[i - 1], b = i < F.length ? F[i] : B, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, pull = i < F.length ? 0.3 : 0.34;
        c.quadraticCurveTo(mx + (Wr[0] - mx) * pull, my + (Wr[1] - my) * pull, b[0], b[1]);
      }
      c.quadraticCurveTo(-30, 12, 2, 2); c.closePath();
      const g = c.createRadialGradient(Wr[0], Wr[1], 4, Wr[0] - 50, Wr[1] + 20, 140);
      g.addColorStop(0, SB.shade(wc, 0.4)); g.addColorStop(0.55, wc); g.addColorStop(1, SB.mixColor(wc, FX.wingRim, far ? 0.08 : 0.32));
      c.save(); c.globalAlpha *= 0.96; c.fillStyle = g; c.fill(); c.restore();
      c.strokeStyle = SB.shade(wc, 0.6); c.stroke();
      // veins and creases fanning out between the fingers
      c.save(); c.globalAlpha *= 0.45; c.strokeStyle = SB.shade(wc, 0.55); c.lineWidth *= 0.6;
      for (let i = 0; i < F.length; i++) {
        const a = F[i], b = i + 1 < F.length ? F[i + 1] : B;
        for (let j = 1; j <= 2; j++) { const s = j / 3; qpt(Wr[0], Wr[1], (a[0] + Wr[0]) / 2, (a[1] + Wr[1]) / 2, a[0], a[1], 0.55, Q); c.beginPath(); c.moveTo(Q[0], Q[1]); c.quadraticCurveTo((Q[0] + b[0]) / 2 + 6, (Q[1] + b[1]) / 2 + 6, Q[0] + (b[0] - Q[0]) * s * 0.9, Q[1] + (b[1] - Q[1]) * s * 0.9 + 8); c.stroke(); }
      }
      c.restore();
      // bones: upper arm, forearm, and four long fingers with a knuckle each; a hooked thumb claw at the wrist
      D.cap(p, 0, 0, E[0], E[1], 14, 10, bone); D.cap(p, E[0], E[1], Wr[0], Wr[1], 10, 7, bone);
      for (let i = 0; i < F.length; i++) {
        const f = F[i], kx = Wr[0] + (f[0] - Wr[0]) * 0.45 + 4, ky = Wr[1] + (f[1] - Wr[1]) * 0.45 - 3;
        D.cap(p, Wr[0], Wr[1], kx, ky, 5.5, 4, bone); D.cap(p, kx, ky, f[0], f[1], 4, 1.6, bone);
        p.poly([f[0] - 2, f[1], f[0] + (f[0] - Wr[0]) * 0.06, f[1] + (f[1] - Wr[1]) * 0.06 - 1, f[0] + 2, f[1] + 1], clawC);
      }
      p.poly([Wr[0] - 2, Wr[1] - 3, Wr[0] + 12, Wr[1] - 12, Wr[0] + 7, Wr[1] - 2, Wr[0] + 3, Wr[1] + 4], clawC);
      c.restore();
    };
    // ---- legs: heavy haunches, scaly shins, clawed feet ----
    const foot = (fx, fy, k, dir) => {
      const fc = SB.shade(body, k + 0.08);
      p.ellipse(fx, fy - 4, 9, 5, fc, 0);
      for (let i = 0; i < 3; i++) {
        const tx = fx + dir * (9 + i * 3), ty = fy - 6 + i * 2.5;
        D.cap(p, fx, fy - 4 + i * 1.5, tx, ty, 5.5, 3.6, fc);
        p.poly([tx - dir * 1, ty - 2.2, tx + dir * 6, ty + 1, tx + dir * 2, ty + 3.5], clawC);   // a hooked black claw
      }
      p.poly([fx - dir * 6, fy - 4, fx - dir * 12, fy - 1, fx - dir * 6, fy - 1], clawC);   // the dew claw behind
    };
    const hind = (a, far) => {
      const k = far ? 0.32 : 0, bc = SB.shade(body, k), o = far ? 10 : 0, H = [-46 + o, 4];
      let Kn, A, F, dir = 1;
      if (air) { Kn = [-30 + o, 34]; A = [-56 + o, 44]; F = [-74 + o, 50 + Math.sin(t * 3 + o) * 2]; dir = -1; }
      else if (held) { const s = Math.sin(t * 9 + o) * 6; Kn = [-34 + o, 38]; A = [-50 + o + s, 58]; F = [-44 + o + s, 78]; }
      else {
        const sx = walking ? Math.sin(a) * 16 : 0, lift = walking ? Math.max(0, Math.cos(a)) * 10 : 0;
        F = [-40 + o + sx, G - lift]; Kn = [-28 + o + sx * 0.35, 40 - lift * 0.3 + dy * 0.3]; A = [-50 + o + sx * 0.7, 62 - lift * 0.7 - dy * 0.4];
      }
      p.ellipse(H[0] + 2, H[1] + 12, 22, 27, bc, -0.35);   // the haunch
      D.cap(p, H[0], H[1] + 10, Kn[0], Kn[1], 26, 16, bc);
      D.cap(p, Kn[0], Kn[1], A[0], A[1], 15, 10, bc);
      D.cap(p, A[0], A[1], F[0], F[1] - 4, 10, 9, bc);
      if (!far) { c.save(); c.globalAlpha *= 0.4; p.curve(H[0] - 14, H[1] - 2, H[0] + 6, H[1] - 6, H[0] + 16, H[1] + 18); D.hatch(p, Kn[0], Kn[1] + 4, A[0] + 2, A[1] - 4, 4, 4, 0.3); c.restore(); }
      foot(F[0], F[1], k, dir);
    };
    const front = (a, far) => {
      const k = far ? 0.32 : 0, bc = SB.shade(body, k), o = far ? 10 : 0, S0 = [34 + o, 6];
      let E, Wt, F, dir = 1;
      if (air) { E = [42 + o, 30]; Wt = [56 + o, 40]; F = [68 + o, 38]; }
      else if (held) { const s = Math.sin(t * 9 + 2 + o) * 6; E = [30 + o, 40]; Wt = [40 + o + s, 60]; F = [44 + o + s, 78]; }
      else {
        const sx = walking ? Math.sin(a) * 16 : 0, lift = walking ? Math.max(0, Math.cos(a)) * 11 : 0;
        E = [26 + o + sx * 0.3, 42 - lift * 0.3 + dy * 0.3]; Wt = [40 + o + sx * 0.8, 66 - lift * 0.7 - dy * 0.4]; F = [46 + o + sx, G - lift];
        if (P.rear > 0) { const r = P.rear; E = [E[0] + (50 + o - E[0]) * r, E[1] + (26 - E[1]) * r]; Wt = [Wt[0] + (68 + o - Wt[0]) * r, Wt[1] + (28 - Wt[1]) * r]; F = [F[0] + (80 + o - F[0]) * r, F[1] + (22 - F[1]) * r]; }
      }
      p.ellipse(S0[0] - 2, S0[1] + 12, 18, 22, bc, 0.3);   // the shoulder
      D.cap(p, S0[0], S0[1] + 12, E[0], E[1], 22, 14, bc);
      D.cap(p, E[0], E[1], Wt[0], Wt[1], 13, 9, bc);
      D.cap(p, Wt[0], Wt[1], F[0], F[1] - 4, 9, 8, bc);
      if (!far) { c.save(); c.globalAlpha *= 0.4; p.curve(S0[0] - 12, S0[1] + 2, S0[0] - 4, S0[1] + 24, E[0] - 4, E[1] - 4); c.restore(); }
      foot(F[0], F[1], k, dir);
    };
    // ---- tail: a long, heavy, spiked tail ending in a blade of spikes ----
    let tx0 = -72, ty0 = -2, tcx, tcy, tx1, ty1;
    const wag = Math.sin(t * 1.5 + seed) * 6;
    if (e.whipT > 0) {
      const u = 1 - e.whipT / R.tail;
      if (u < 0.35) { const k = sm01(u / 0.35); tcx = -126; tcy = -6 - k * 50; tx1 = -168 + k * 34; ty1 = 36 - k * 136; }
      else if (u < 0.6) { const k = sm01((u - 0.35) / 0.25); tcx = -126 - k * 20; tcy = -56 + k * 50; tx1 = -134 - k * 60; ty1 = -100 + k * 158; }
      else { const k = sm01((u - 0.6) / 0.4); tcx = -146 + k * 20; tcy = -6; tx1 = -194 + k * 26; ty1 = 58 - k * 22; }
    }
    else if (air) { tcx = -130; tcy = 0 + wag * 0.5; tx1 = -186; ty1 = 12 + Math.sin(t * 3 + seed) * 12; }
    else if (held) { tcx = -100; tcy = 30; tx1 = -108 + wag; ty1 = 78; }
    else if (ko) { tcx = -120; tcy = 40; tx1 = -160; ty1 = 70; }
    else { tcx = -128; tcy = -6 + wag * 0.5; tx1 = -168; ty1 = G - 44 + wag * 1.5; }
    const tail = () => {
      // spikes along the top first, so their roots hide behind the tail
      for (let j = 1; j < 11; j++) {
        const s = j / 11; qpt(tx0, ty0, tcx, tcy, tx1, ty1, s, Q); qpt(tx0, ty0, tcx, tcy, tx1, ty1, s + 0.03, Q2);
        const ddx = Q2[0] - Q[0], ddy = Q2[1] - Q[1], d = Math.hypot(ddx, ddy) || 1, nx = ddy / d, ny = -ddx / d, r = (30 - 25 * s) / 2, h = 13 - s * 7;
        const bx = Q[0] + nx * r * 0.8, by = Q[1] + ny * r * 0.8;
        p.poly([bx - ddx / d * 4, by - ddy / d * 4, bx + nx * h - ddx / d * 3, by + ny * h - ddy / d * 3, bx + ddx / d * 4, by + ddy / d * 4], tn(spikeC));
      }
      const mid = D.tube(p, tx0, ty0, tcx, tcy, tx1, ty1, 30, 5, 12, body);
      c.save(); c.globalAlpha *= 0.35; for (let j = 2; j < mid.length - 1; j++) { const [x, y] = mid[j]; p.arc(x, y, 6 - j * 0.35, 0.4, 2.7); } c.restore();
      // the tail blade: three spikes fanning from the tip
      const [ex, ey] = mid[mid.length - 1], [qx, qy] = mid[mid.length - 2], a = Math.atan2(ey - qy, ex - qx);
      c.save(); c.translate(ex, ey); c.rotate(a);
      p.poly([-4, -3, 14, -14, 6, -2, 20, 0, 6, 2, 14, 14, -4, 3], tn(spikeC));
      c.restore();
    };
    // ---- the head: horned skull, long jaws full of teeth, glowing slit eye ----
    const head = () => {
      const open = P.open, HS = D.DRG_HS, [jx, jy] = D.DRG_JAW;
      c.save(); c.translate(P.hx, P.hy); c.rotate(P.ha); c.scale(HS, HS);
      D.tube(p, -2, -14, -28, -30, -46, -56, 8, 2, 8, SB.shade(hornC, 0.35));   // far horn
      if (open > 0.06) {   // the inside of the mouth, glowing when it is about to breathe fire
        const co = Math.cos(open), so = Math.sin(open), L = (x, y) => [jx + (x - jx) * co - (y - jy) * so, jy + (x - jx) * so + (y - jy) * co];
        const [ax, ay] = L(54, 7), [bx, by] = L(20, 9);
        p.poly([-6, 4, 30, 4, 57, 3, ax, ay, bx, by, -6, 9], mouthC);
        if (ember > 0.3) { const g = c.createRadialGradient(4, 6, 1, 4, 6, 30); g.addColorStop(0, FX.rgba(0, ember * 0.95)); g.addColorStop(0.5, FX.rgba(3, ember * 0.6)); g.addColorStop(1, FX.rgba(4, 0)); c.fillStyle = g; c.beginPath(); c.moveTo(-6, 4); c.lineTo(57, 3); c.lineTo(ax, ay); c.lineTo(bx, by); c.closePath(); c.fill(); }
      }
      // lower jaw on its hinge, teeth pointing up
      c.save(); c.translate(jx, jy); c.rotate(open); c.translate(-jx, -jy);
      for (let x = 8; x <= 50; x += 6) p.poly([x - 1.6, 5.5, x, x === 44 ? -2 : 1, x + 1.6, 5.5], teethC);
      p.poly([-14, 3, 4, 5, 24, 5, 42, 5, 54, 6, 56, 9, 46, 12, 28, 14, 8, 14, -10, 11], body);
      p.use('spike'); for (let i = 0; i < 3; i++) p.poly([-4 + i * 9, 12.5, -8 + i * 9, 19 - i, -1 + i * 9, 13], tn(spikeC));   // spines under the chin
      c.restore();
      // upper teeth, with long fangs
      for (let x = 6; x <= 54; x += 5.5) { const fang = x > 40 && x < 47; p.poly([x - 1.8, 3.5, x + 0.4, fang ? 12 : 8.5, x + 1.8, 3.5], teethC); }
      // the skull and upper jaw
      p.poly([-16, -4, -12, -13, 0, -17, 14, -15, 28, -10, 42, -7, 52, -5, 58, -2, 59, 2, 50, 4, 32, 4, 14, 4, -2, 4, -14, 4], body);
      c.save(); c.globalAlpha *= 0.4; for (let i = 0; i < 5; i++) p.arc(20 + i * 6, -3 + i * 0.5, 2.4, Math.PI + 0.4, TAU - 0.4); p.curve(0, 0, 18, -2, 40, -1); c.restore();
      p.poly([2, -15, 14, -18, 28, -12, 22, -8, 8, -10], SB.shade(body, 0.3));   // heavy brow ridge
      if (!ko && e.mood !== 'sleep') { const g = c.createRadialGradient(14, -8, 1, 14, -8, 12); g.addColorStop(0, FX.rgba(2, 0.55)); g.addColorStop(1, FX.rgba(4, 0)); c.fillStyle = g; c.beginPath(); c.arc(14, -8, 12, 0, TAU); c.fill(); }
      D.eye(p, 14, -8, 3.6, e, 1);
      p.dot(55, -3, 1.3);   // nostril
      // horns: two great swept-back horns, a cheek horn and a frill of spikes along the jaw
      D.tube(p, -6, -12, -34, -20, -58, -44, 10, 2.2, 9, hornC);
      c.save(); c.globalAlpha *= 0.4; for (let i = 1; i < 5; i++) { qpt(-6, -12, -34, -20, -58, -44, i / 6, Q); p.line(Q[0] - 3, Q[1] - 3, Q[0] + 2, Q[1] + 4); } c.restore();
      D.tube(p, -10, -2, -26, 2, -40, -4, 6, 1.5, 6, hornC);
      p.poly([-14, 0, -24, 10, -12, 6, -18, 16, -6, 6], tn(spikeC));
      c.save(); c.strokeStyle = FX.scar; p.line(24, -10, 34, -2); p.line(28, -11, 36, -6); c.restore();   // old scars
      c.restore();
    };
    // ---- the fire: a long roaring cone from the mouth ----
    const fire = () => {
      const [mx, my, a] = D.dragonMouth(e, t), L = Math.max(30, e.fireLen || R.reach), y0 = my - P.dy;   // dragonMouth includes the crouch, the body frame here already has it
      c.save(); c.translate(mx, y0);
      if (P.rear) { /* never breathes while reared up */ }
      c.rotate(a);
      const lay = (wEnd, len, stops, s0) => {
        const g = c.createLinearGradient(0, 0, len, 0); for (const [u, cl] of stops) g.addColorStop(u, cl); c.fillStyle = g;
        c.beginPath(); c.moveTo(0, -2.5);
        for (let i = 1; i <= 8; i++) { const u = i / 8, w = 2.5 + (wEnd - 2.5) * Math.pow(u, 0.75); c.lineTo(u * len, -w + Math.sin(t * 23 + i * 1.9 + s0) * w * 0.2); }
        c.quadraticCurveTo(len + wEnd * 0.7, 0, len, wEnd);
        for (let i = 8; i >= 1; i--) { const u = i / 8, w = 2.5 + (wEnd - 2.5) * Math.pow(u, 0.75); c.lineTo(u * len, w + Math.sin(t * 19 + i * 2.3 + s0) * w * 0.2); }
        c.lineTo(0, 2.5); c.closePath(); c.fill();
      };
      const fk = 1 + Math.sin(t * 17 + seed) * 0.06;
      lay(L * 0.3 * fk, L, [[0, FX.rgba(1, 0.9)], [0.22, FX.rgba(2, 0.85)], [0.7, FX.rgba(5, 0.6)], [1, FX.rgba(6, 0)]], seed);
      lay(L * 0.17, L * 0.82, [[0, FX.rgba(7, 0.95)], [0.4, FX.rgba(0, 0.8)], [1, FX.rgba(3, 0)]], seed + 3);
      lay(L * 0.06, L * 0.45, [[0, FX.rgba(8, 0.95)], [1, FX.rgba(1, 0)]], seed + 7);
      for (let i = 0; i < 6; i++) {   // billows of flame rolling along the cone
        const u = 0.3 + ((i / 6 + t * 1.7 + seed * 0.1) % 1) * 0.7, w = L * 0.3 * Math.pow(u, 0.75), x = u * L, y = Math.sin(t * 9 + i * 2.1) * w * 0.3, a = (1 - u) * 0.75 + 0.1;
        const g = c.createRadialGradient(x, y, 0, x, y, w * 0.9); g.addColorStop(0, FX.rgba(0, a)); g.addColorStop(0.6, FX.rgba(3, a * 0.6)); g.addColorStop(1, FX.rgba(6, 0));
        c.fillStyle = g; c.beginPath(); c.arc(x, y, w * 0.9, 0, TAU); c.fill();
      }
      c.restore();
    };
    // ---- paint, back to front ----
    c.save();
    if (dy) c.translate(0, dy);
    if (P.rear) { const [px, py] = D.DRG_PIVOT; c.translate(px, py); c.rotate(-0.32 * P.rear); c.translate(-px, -py); }
    const ph = e.phase || 0;
    wing(30, -32, true);
    tail();
    hind(ph + Math.PI, true); front(ph, true);
    // spines down the back, behind the body's outline
    const back = [-70, -14, -46, -30, -20, -27, 6, -28, 28, -35, 50, -28];
    for (let k = 0; k < 9; k++) {
      const s = k / 8 * 4.999, i = Math.floor(s), f = s - i, x = back[i * 2] + (back[i * 2 + 2] - back[i * 2]) * f, y = back[i * 2 + 1] + (back[i * 2 + 3] - back[i * 2 + 1]) * f;
      const h = 12 + Math.sin(k / 8 * Math.PI) * 9;
      p.poly([x - 6, y + 4, x - 4, y - h, x + 1, y - h * 0.55, x + 6, y + 4], tn(spikeC));
    }
    // the neck (rising from behind the chest): spines on its crest, plates under the throat
    const nx0 = 48, ny0 = 0, nx1 = P.hx - 9, ny1 = P.hy + 2, ncx = nx0 + (P.hx - nx0) * 0.3, ncy = Math.min(ny0, P.hy) + 2;
    for (let j = 1; j < 7; j++) {
      const s = j / 7; qpt(nx0, ny0, ncx, ncy, nx1, ny1, s, Q); qpt(nx0, ny0, ncx, ncy, nx1, ny1, s + 0.04, Q2);
      const ddx = Q2[0] - Q[0], ddy = Q2[1] - Q[1], d = Math.hypot(ddx, ddy) || 1, nx = ddy / d, ny = -ddx / d, r = (42 - 23 * s) / 2 * 0.8, h = 11 - s * 3;
      p.poly([Q[0] + nx * r - ddx / d * 4, Q[1] + ny * r - ddy / d * 4, Q[0] + nx * (r + h) - ddx / d * 5, Q[1] + ny * (r + h) - ddy / d * 5, Q[0] + nx * r + ddx / d * 4, Q[1] + ny * r + ddy / d * 4], tn(spikeC));
    }
    const nm = D.tube(p, nx0, ny0, ncx, ncy, nx1, ny1, 42, 19, 10, body);
    p.circle(nx1, ny1, 9.5, body);   // rounds off the top of the neck under the skull
    c.save(); c.globalAlpha *= 0.4; for (let j = 2; j < nm.length - 1; j++) { const [x, y] = nm[j]; p.arc(x - 3, y, 5.5 - j * 0.25, Math.PI * 0.9, Math.PI * 1.6); } c.restore();
    c.save();
    for (let j = 1; j < nm.length - 1; j++) {   // throat plates, glowing when the fire rises
      const [x, y] = nm[j], [x2, y2] = nm[j + 1], ddx = x2 - x, ddy = y2 - y, d = Math.hypot(ddx, ddy) || 1, nx = -ddy / d, ny = ddx / d, r = (42 - 23 * j / 10) / 2;
      c.globalAlpha = ember > 0.3 ? Math.min(1, ember) : 0.45; c.strokeStyle = ember > 0.3 ? SB.mixColor(emberC, FX.seam, 0.4) : SB.shade(belly, 0.5);
      p.line(x + nx * r * 0.2, y + ny * r * 0.2, x + nx * r * 0.95, y + ny * r * 0.95);
    }
    c.restore();
    // the body: deep chest, heavy belly, powerful hips
    p.poly([-80, -6, -64, -22, -44, -30, -20, -26, 4, -27, 26, -34, 46, -30, 60, -16, 64, -2, 60, 20, 46, 36, 20, 40, -10, 40, -40, 34, -62, 22, -78, 10], body);
    p.poly([60, 6, 62, 18, 48, 34, 20, 39, -10, 39, -40, 33, -62, 21, -72, 12, -52, 15, -22, 23, 8, 26, 38, 20], belly);   // armoured belly plates
    c.save();
    if (ember > 0.05) {   // the fire inside glows through the seams of the belly
      c.strokeStyle = SB.mixColor(emberC, FX.seam, ember * 0.5); c.globalAlpha *= Math.min(1, ember * 1.1); c.lineWidth *= 1.2; c.shadowColor = emberC; c.shadowBlur = 6 * ember;
      for (let k = 0; k < 9; k++) { const x = 52 - k * 13; p.curve(x, 22 - (k > 5 ? k - 5 : 0) * 2, x - 2, 30, x - 4, 38 - Math.abs(k - 3) * 1.2); }
    } else { c.globalAlpha *= 0.5; for (let k = 0; k < 9; k++) { const x = 52 - k * 13; p.curve(x, 22, x - 2, 30, x - 4, 38 - Math.abs(k - 3) * 1.2); } }
    c.restore();
    if (ember > 0.25) { const g = c.createRadialGradient(46, 14, 2, 46, 14, 34); g.addColorStop(0, FX.rgba(2, ember * 0.45)); g.addColorStop(1, FX.rgba(4, 0)); c.save(); c.fillStyle = g; c.beginPath(); c.arc(46, 14, 34, 0, TAU); c.fill(); c.restore(); }
    // armoured scales: overlapping rows, each with a dull red rim catching the light
    c.save();
    for (let r = 0; r < 4; r++) for (let k = 0; k < 10; k++) {
      const x = -64 + k * 13 + (r % 2) * 6.5, y = -18 + r * 10;
      if (((x - 2) / 66) ** 2 + ((y - 4) / 30) ** 2 > 0.85) continue;
      c.globalAlpha = 0.5; c.strokeStyle = SB.shade(body, 0.55); p.arc(x, y, 5.5, Math.PI + 0.25, TAU - 0.25);
      c.globalAlpha = 0.3; c.strokeStyle = scaleHi; p.arc(x, y - 1.2, 4.5, Math.PI + 0.6, TAU - 0.9);
    }
    c.restore();
    c.save(); c.globalAlpha *= 0.4; p.curve(24, -26, 50, 0, 30, 30); p.arc(-46, 8, 26, -2.2, 0.4); p.curve(-14, -22, -4, 8, -16, 36); c.restore();   // shoulder, haunch, ribs
    hind(ph, false); front(ph + Math.PI, false);
    wing(20, -30, false);
    head();
    if (firing) fire();
    c.restore();
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
  const B = (name, spec) => {
    const K = spec.drawK || 1;
    if (K !== 1) {
      const inner = spec.t;
      spec = Object.assign({}, spec, { t: { w: inner.w * K, h: inner.h * K, draw(p, e, t) { p.ctx.scale(K, K); inner.draw(p, e, t); } } });
      spec.mass = Math.round((spec.mass || 50) * K * K * 0.8); spec.hp = Math.round((spec.hp || 40) * (1 + (K - 1) * 0.6));
    }
    return SB.def(name, SB.merge({
      cat: 'boss', boss: true, creature: true, move: 'walk', temper: 'hostile', bounce: 0.05, friction: 6, huntR: 720,
      tags: ['boss', 'monster', 'big', 'scary', 'villain', 'predator'], fears: [], hunts: [], eats: [], heldMood: 'angry'
    }, spec));
  };
  const ks = e => e.scale * (e.def.drawK || 1);   // drawing scale: where mouths, eyes and hands really are

  B('kraken', {
    drawK: 1.4,
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
    drawK: 1.35,
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
    drawK: 1.35,
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
    drawK: 1.35,
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
    drawK: 1.35,
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
    move: 'crawl', speed: 135, mass: 95, hp: 52, jump: 520, tags: ['bug', 'creepy', 'arachnid', 'spider', 'hairy'], weak: ['fire', 'hot', 'boot', 'shoe'], special: 'webshot', venom: true, kin: ['spider'],
    hunts: ['bug', 'fly', 'bird', 'human', 'hero', 'animal', 'monster'], eats: ['fly', 'mosquito', 'bee', 'butterfly', 'moth', 'ant'],
    say: ['*skitter skitter*', 'Come into my parlour...', '*hisssk*', 'Eight legs, eight eyes, no mercy.'], roar: ['SKREEEE!', '*HISSSK!*', 'WEBBED!'],
    weakSay: ['Not fire! NOT FIRE!', 'SKREEE! Hot!', 'Squish?! Never!', 'Not the shoe!'],
    power: 'Spits sticky webs that wrap its prey so it can\'t move, bites with venom that leaves victims dizzy, and hatches spiderlings.', weakText: 'fire, and a good stomp with a boot or shoe',
    hint: 'The giant spider webs things up! Weak to fire and shoes.',
    onHurt(e, W) { if (Math.random() < 0.4) e.say('SKREE!'); e.setMood('angry', 1); }
  });
  B('giant moth', {
    drawK: 1.4,
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
    drawK: 1.35,
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
    drawK: 1.4,
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
    drawK: 1.3,
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
    move: 'crawl', speed: 120, mass: 125, hp: 60, jump: 360, tags: ['bug', 'arachnid', 'scorpion', 'creepy', 'armored'], weak: ['boot', 'shoe', 'cold', 'ice', 'snow', 'chicken', 'rooster'], special: 'scorpion', noBonk: true, poison: true, kin: ['scorpion'], roarSfx: 'screech',
    hunts: ['bug', 'spider', 'human', 'hero', 'animal', 'monster', 'vehicle'], eats: ['bug', 'fly', 'beetle', 'ant', 'grasshopper', 'spider', 'mouse'],
    say: ['*clack clack*', 'Three tails, no waiting.', '*skitter*', 'Pinch, pinch, sting.'], roar: ['SKREEEEK!', '*CLACK CLACK*', '*TRIPLE STING*'],
    weakSay: ['Not the boot!', 'Chickens?! RUN!', 'Too c-c-cold!'],
    power: 'Snaps its giant pincers to fling enemies over its back, strikes three times in a row with its three tails, and fires poison stingers at anything far away. Every sting poisons.', weakText: 'a stomp with a boot or shoe, cold, and chickens (they eat scorpions!)',
    hint: 'The three-tailed scorpion stings three times! Weak to boots and cold.',
    onHurt(e, W) { if (Math.random() < 0.35) e.say('SKREEK!'); }
  });
  B('wasp swarm', {
    drawK: 1.5,
    t: D.waspQueen(), aliases: ['wasps', 'swarm', 'swarm of wasps', 'wasp nest', 'wasp queen', 'queen wasp', 'angry wasps', 'killer wasps', 'giant wasp', 'wasp boss', 'hornets', 'hornet swarm', 'murder hornets', 'murder hornet', 'killer bees', 'bee swarm', 'swarm of bees', 'angry bees', 'killer bee swarm', 'bees', 'wasp army', 'hive'],
    move: 'fly', speed: 150, mass: 40, hp: 40, swarmCap: 90, jump: 300, flyMin: 0.12, flyMax: 0.5, tags: ['bug', 'insect', 'wasp', 'winged', 'swarm'], weak: ['fire', 'hot', 'water', 'rain', 'smoke', 'cold', 'ice', 'snow'], special: 'swarm', kin: ['bee', 'wasp', 'hornet'], roarSfx: 'buzz',
    hunts: ['human', 'hero', 'animal', 'monster', 'flower', 'honey'], eats: ['honey', 'flower'],
    say: ['*bzzzzzzz*', 'BZZZ! Get them, girls!', '*angry buzzing*', 'You disturbed the nest!'], roar: ['BZZZZZZZ!', 'SWARM!', 'STING THEM!'],
    weakSay: ['Not fire! BZZT!', 'My wings are wet!', 'SMOKE! Scatter!', 'Too c-c-cold to fly!'],
    power: 'A queen wasp and her swarm. The swarm splits up to mob up to three enemies at once, stinging over and over, while the queen hatches new wasps. Every wasp you take out weakens the swarm.', weakText: 'fire, smoke, water and rain (wasps that fly into them die), cold, fans that blow them away, and explosions. You can also SWAT wasps by clicking on them!',
    hint: 'The wasp swarm mobs everything! Click wasps to swat them, or use fire and water.',
    onHurt(e, W) { if (Math.random() < 0.3) e.say('BZZT!'); }
  });
  B('beetle swarm', {
    drawK: 1.5,
    t: D.beetleKing(), aliases: ['beetles', 'swarm of beetles', 'beetle army', 'beetle king', 'king beetle', 'giant beetle', 'beetle boss', 'bug swarm', 'swarm of bugs', 'bugs', 'cockroaches', 'roaches', 'cockroach swarm', 'scarabs', 'scarab swarm', 'rhino beetle', 'rhinoceros beetle', 'stag beetles', 'beatles', 'beetle swarm boss', 'creepy crawlies', 'insects'],
    move: 'crawl', speed: 90, mass: 60, hp: 44, swarmCap: 110, jump: 300, tags: ['bug', 'insect', 'beetle', 'swarm', 'armored'], weak: ['boot', 'shoe', 'chicken', 'rooster', 'water', 'rain', 'fire', 'hot'], special: 'swarm', swarmKind: 'beetle', kin: ['beetle', 'ladybug', 'scarab', 'cockroach'], roarSfx: 'skitter',
    hunts: ['human', 'hero', 'animal', 'monster', 'food', 'poop'], eats: ['food', 'poop', 'leaf'],
    say: ['*click click click*', 'Crawl, my beetles!', '*skitter skitter*', 'Our shells are unbreakable!'], roar: ['CHARGE, BEETLES!', '*CLICK CLICK*', 'SWARM THEM!'],
    weakSay: ['Not the boot! NOT THE BOOT!', 'A chicken?! Scatter!', 'We can\'t swim!', 'Our shells are melting!'],
    power: 'A king rhinoceros beetle and a carpet of armored beetles. They swarm across the ground, climb up their victims and bite, splitting up to attack three enemies at once, and fly up after anything in the air. Armored shells: a swat only cracks a beetle, the second one squashes it.', weakText: 'stomps (boots, shoes, and big ground-pounds crush them), chickens, birds and frogs (they eat beetles), water and rain, and fire. Click beetles to swat them twice!',
    hint: 'The beetle swarm crawls all over everything! Bring chickens, or stomp them.',
    onHurt(e, W) { if (Math.random() < 0.3) e.say('*CLICK!*'); }
  });
  B('giant praying mantis', {
    drawK: 1.35,
    t: D.mantis(), aliases: ['praying mantis', 'mantis', 'prayingmantis', 'prayingmantes', 'praying mantes', 'praying mantas', 'preying mantis', 'praying mantus', 'praing mantis', 'mantid', 'giant mantis', 'mantis boss', 'mantis queen', 'mantis king', 'giant praying mantes', 'orchid mantis', 'mantises', 'big mantis', 'huge mantis'],
    speed: 105, mass: 70, hp: 46, jump: 600, tags: ['bug', 'insect', 'mantis'], weak: ['eagle', 'hawk', 'crow', 'owl', 'chicken', 'rooster', 'cold', 'ice', 'snow'], special: 'mantis', noBonk: true, kin: ['mantis'], roarSfx: 'screech',
    hunts: ['bug', 'human', 'hero', 'animal', 'monster'], eats: ['fly', 'mosquito', 'bee', 'moth', 'butterfly', 'grasshopper', 'beetle', 'ant', 'ladybug', 'mouse', 'frog', 'lizard', 'hummingbird'],
    say: ['*sways like a leaf*', '...', '*watches you*', 'Patience. Patience.'], roar: ['SKREEEE!', '*SNATCH*', 'GOTCHA!'],
    weakSay: ['A bird?! Not a bird!', 'Too c-c-cold!', 'SKREE! Get away, bird!'],
    power: 'An ambush hunter: it holds still and fades into camouflage until something comes close, then its spiked forelegs strike faster than you can see. It grabs a victim and bites it over and over, eats small bugs and mice in one bite, slashes big enemies, and leaps across the screen on its wings.', weakText: 'birds (eagles, owls, crows and chickens eat mantises) and cold',
    hint: 'The praying mantis hides in plain sight, then strikes! Weak to birds and cold.',
    onHurt(e, W) { if (Math.random() < 0.35) e.say('SKREE!'); }
  });
  B('phoenix', {
    drawK: 1.4,
    t: D.phoenix(), aliases: ['phoenix boss', 'fire bird', 'firebird', 'giant phoenix', 'flame bird', 'flaming bird', 'burning bird', 'sun bird', 'sunbird', 'fenix', 'pheonix', 'phenix', 'phoneix', 'phoenix bird', 'pheonix bird', 'fire phoenix', 'flame phoenix', 'the phoenix', 'firebird boss', 'fire hawk', 'fire eagle', 'flame eagle', 'fawkes', 'phoenixes'],
    move: 'fly', speed: 165, mass: 55, hp: 42, jump: 300, flyMin: 0.06, flyMax: 0.4, tags: ['fire', 'hot', 'bird', 'winged', 'light'], weak: ['water', 'rain', 'ice', 'snow', 'cold'], special: 'phoenix', fireproof: true, roarSfx: 'screech',
    hunts: ['human', 'hero', 'animal', 'monster', 'vehicle', 'snowman'], eats: [],
    say: ['*crackle*', 'From the ashes I rise...', '*the air shimmers with heat*', 'Burn bright. Burn forever.'], roar: ['SKREEEEEE!', '*FWOOOSH*', 'BURN!', 'KREEEAAAH!'],
    weakSay: ['HSSSS! Water!', 'My flames! NO!', 'Too c-c-cold!', '*sizzle* Not the rain!'],
    power: 'Rules the sky. Swoops down in blazing dives that set everything it touches alight and leave a trail of fire on the ground, and beats its wings to hurl fireballs from its beak. Knock it out and it bursts into a pillar of flame and is REBORN from an egg in the ashes with half its health: you have to beat it twice!', weakText: 'water, rain, snow, ice and anything cold (a rain cloud over it puts its fire out)',
    hint: 'The phoenix dives in fire and is reborn from its ashes: beat it twice! Weak to water and rain.',
    onHurt(e, W) { W.burst('flame', e.x, e.y, 5, 140, { size: 7, life: 0.5, vy: -80 }); if (Math.random() < 0.4) e.say(pick(['SKREE!', 'KRAAH!'])); }
  });
  B('giant dragon', {
    drawK: 1.4,
    t: D.dragonBoss(), aliases: ['dragon boss', 'boss dragon', 'huge dragon', 'mega dragon', 'dragon king', 'king dragon', 'elder dragon', 'black dragon', 'red dragon boss', 'black dragon boss', 'colossal dragon', 'ancient dragon', 'great dragon', 'enormous dragon', 'gigantic dragon', 'massive dragon', 'titan dragon', 'dragon lord', 'dragon queen', 'monster dragon', 'giant fire dragon', 'giant black dragon', 'giant red dragon', 'ancient black dragon', 'smaug', 'dragn boss', 'dragon bos', 'dargon boss', 'dragen boss', 'drago boss', 'dragon boos', 'giant dragn', 'giant dargon', 'giant dragen', 'gaint dragon'],
    speed: 85, mass: 110, hp: 50, jump: 420, flyMin: 0.06, flyMax: 0.4, tags: ['dragon', 'reptile', 'scaly', 'fire', 'winged', 'scary'], weak: ['ice', 'cold', 'snow', 'knight', 'sword'], special: 'dragonboss', drgEl: 'fire', fireproof: true, kin: ['drake', 'fire'], roarSfx: 'roar',   // kin: the ordinary dragon and fire things, but not the ice dragon
    hunts: ['knight', 'princess', 'human', 'hero', 'ice', 'frost', 'animal', 'monster', 'vehicle'], eats: ['sheep', 'cow', 'pig', 'goat', 'deer', 'horse', 'chicken'],
    say: ['*smoke curls from its nostrils*', 'I am older than your kingdoms.', '*a deep, rumbling growl*', 'Bring me gold. And knights.', 'Mmm. Roast knight.'], roar: ['ROOOAAARRR!', '*FWOOOOSH*', 'BURN!', 'GRAAAAH!'],
    weakSay: ['ARGH! My weakness!', 'Not the cold! NOT THE COLD!', 'Brrr! My fire... it\'s freezing!', 'Curse you!'],
    power: 'A huge ancient dragon that rules the ground and the sky. Sweeps a long cone of fire from its jaws that sets everything alight, whips its spiked tail at anything behind it, rears up and beats its wings into a gale, and takes off to rain fire from above before crashing back down with a ground-shaking stomp. Fireproof, and anything that touches it burns.', weakText: 'ice, snow and anything cold (it stuns it), and knights and swords (dragon slayers!)',
    hint: 'The giant dragon breathes fire, whips its tail and rains fire from the sky! Weak to ice, cold and knights.',
    onHurt(e, W) { W.burst('spark', e.x, e.y, 4, 120, { size: 5 }); if (Math.random() < 0.35) e.say(pick(['GRAAH!', 'RRRAAH!', '*SNARL*'])); }
  });
  // the same great beast, born of the frozen north: the same drawing, model and attacks with frost for fire (def.drgEl)
  B('ice dragon', {
    drawK: 1.4,
    t: D.dragonBoss(), aliases: ['frost dragon', 'ice dragon boss', 'frost dragon boss', 'snow dragon', 'frost wyrm', 'ice wyrm', 'blizzard dragon', 'glacier dragon', 'giant ice dragon', 'giant frost dragon', 'giant snow dragon', 'white dragon', 'ice wyvern', 'frost wyvern', 'winter dragon', 'freezing dragon', 'frozen dragon', 'crystal dragon', 'arctic dragon', 'cold dragon', 'blue dragon', 'ice dragon king', 'dragon of ice', 'ice dragn', 'ice dargon', 'ice dragen', 'ice drago', 'frost dragn', 'ice dragons', 'iced dragon'],
    speed: 85, mass: 110, hp: 50, jump: 420, flyMin: 0.06, flyMax: 0.4, tags: ['dragon', 'reptile', 'scaly', 'ice', 'cold', 'frost', 'winged', 'scary'], weak: ['fire', 'hot', 'lava'], special: 'dragonboss', drgEl: 'ice', frost: true, kin: ['frost'], roarSfx: 'roar',
    hunts: ['fire', 'hot', 'dragon', 'knight', 'princess', 'human', 'hero', 'animal', 'monster', 'vehicle'], eats: ['sheep', 'cow', 'pig', 'goat', 'deer', 'horse', 'chicken', 'fish', 'penguin', 'seal'],
    say: ['*frost curls from its nostrils*', 'Winter never ends.', '*ice creaks along its back*', 'Everything freezes in the end.', 'Your fire means nothing here.'], roar: ['SKRAAAAAH!', '*KSSHHHH*', 'FREEZE!', 'GRAAAAH!'],
    weakSay: ['ARGH! It burns!', 'Not the fire! NOT THE FIRE!', 'I\'m... melting!', 'Hot! HOT!'],
    power: 'The fire dragon\'s frozen twin, a huge ancient dragon of ice. Sweeps a freezing breath from its jaws that freezes everything solid, whips its crystal-spiked tail at anything behind it, rears up and beats its wings into a gale, and takes off to rain icicles from above before crashing back down with a stomp that shatters everything frozen. Cold can\'t touch it, and it snuffs out fires.', weakText: 'fire, lava and anything hot (it stuns it) — and the fire dragon is its worst enemy',
    hint: 'The ice dragon freezes everything with its breath and rains icicles from the sky! Weak to fire and heat.',
    onHurt(e, W) { W.burst('shard', e.x, e.y, 5, 180, { size: 5, g: 900, life: 0.7 }); if (Math.random() < 0.35) e.say(pick(['GRAAH!', 'SKRAAH!', '*SNARL*'])); }
  });
  SB.BOSSES = ['kraken', 'mega robot', 'king kong', 'hydra', 'lava golem', 'giant spider', 'giant moth', 'ice golem', 'giant snake', 'giant angry bull', 'giant scorpion', 'wasp swarm', 'beetle swarm', 'giant praying mantis', 'phoenix', 'giant dragon', 'ice dragon'];
  SB.WORDS.boss = SB.WORDS.bosses = 'kraken'; // typing "boss" summons a random one (see SB.findWord)

  // ---------- boss attacks (run every frame by the game loop via SB.SPECIALS) ----------
  const S = SB.SPECIALS = SB.SPECIALS || {};
  const ready = e => !(e.ko || e.held || e.dizzy > 0 || e.sleeping || e.spawnT < 1 || e.frozenT > 0 || e.webT > 0);
  const foe = (e, o) => o !== e && o.alive && !o.dying && !o.static && !o.held && !o.invisible && o.def.name !== e.def.name;

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
      if (Math.random() < dt * 25) W.particle('spark', e.x + e.facing * 22 * ks(e), e.y - 82 * ks(e), { vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80, life: 0.2, size: 5 });
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
    const ex = e.x + e.facing * 24 * ks(e), ey = e.y - 84 * ks(e);
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
      const ex = e.x + e.facing * 60 * ks(e), ey = e.y;
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
        const mx = e.x + e.facing * M[0] * ks(e), my = e.y + M[1] * ks(e);
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
        const mx = e.x + e.facing * D.spiderMouth[0] * e.scale, my = e.y + D.spiderMouth[1] * e.scale;
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
      const mx = e.x + e.facing * 30 * ks(e), my = e.y - 78 * ks(e), dx = e.facing, dy = 0.18, R = 430 * e.scale;
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
    const hx = e.x + e.facing * 46 * ks(e), hy = e.y - 70 * ks(e);
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
    const mx = e.x + e.facing * D.snakeMouth[0] * ks(e), my = e.y + D.snakeMouth[1] * ks(e);
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
      const sx = e.x + e.facing * D.snakeMouth[0] * ks(e), sy = my;
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
    const nx = e.x + e.facing * D.bullNose[0] * ks(e), ny = e.y + D.bullNose[1] * ks(e);
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
  const waspMax = e => Math.min(e.def.swarmCap || 48, e.hpMax);
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
    const s = ks(e), ws = e.wasps || (e.wasps = []);
    if (!e.stingAcc) e.stingAcc = new Map();
    const live = ws.filter(w => !w.dead);
    // keep the number of wasps in step with the swarm's health (the queen hatches more as it heals)
    const want = e.ko ? 0 : Math.ceil(waspMax(e) * Math.max(0, e.hp) / e.hpMax);
    if (live.length > want + 1) for (let k = live.length - 1; k >= 0 && live.length > want; k--) { killWasp(e, live[k], W, false); live.pop(); }
    else if (live.length < want) for (let k = live.length; k < want; k++) {
      // a new one hatches from the queen / king
      const beetle = e.def.swarmKind === 'beetle';
      const hx = e.x - e.facing * (beetle ? 30 : 36) * ks(e), hy = beetle ? W.groundY - 5 : e.y + 12 * ks(e);
      const w = newWasp(e, hx, hy); ws.push(w); live.push(w);
      if (!e.held && e.spawnT >= 1) W.burst('sparkle', hx, hy, 3, 60, { size: 4, life: 0.5 });
    }
    // the swarm never stops breeding: heal first, then keep growing past its starting size up to its cap
    e.regenT -= dt;
    if (e.regenT <= 0) {
      e.regenT = 1.5;
      if (!e.ko && !e.held) {
        if (e.hp < e.hpMax) e.hp++;
        else if (e.hpMax < (e.def.swarmCap || 48)) { e.hpMax++; e.hp++; }
        e.lastHp = e.hp; e.hpShown = Math.max(e.hpShown || 0, e.hp - 1);
        if (Math.random() < 0.08) e.say(e.def.swarmKind === 'beetle' ? pick(['More beetles!', '*click* Hatch, my children!', 'The swarm grows!']) : pick(['More wasps! Bzzz!', 'Hatch, my children!', 'The swarm grows!']));
      }
    }
    // choose up to three victims and split the swarm between them
    e.specT -= dt;
    if (e.specT <= 0) {
      e.specT = 0.5;
      let foes = [];
      if (ready(e)) {
        if (SB.battle) foes = W.entities.filter(o => o !== e && o.alive && !o.dying && o.creature && !o.ko && !o.held && !o.invisible && !SB.kin(e, o) && Math.hypot(o.x - e.x, o.y - e.y) < 560 * s)
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
      const T = w.tgt && w.tgt.alive && !w.tgt.dying && !w.tgt.ko && !w.tgt.invisible ? w.tgt : null;
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
  SB.DEFS['beetle swarm'].drawWorld = function (p, ctx, e, t) { if (!e.wasps) return; ctx.strokeStyle = '#000'; for (const w of e.wasps) { D.miniBeetle(p, w.x, w.y - 3, Math.max(1.75, e.scale * 1.75), w.vx >= 0 ? 1 : -1, t, w.seed, w.dead ? Math.max(0, w.life / 1.2) : 1, w.fly, w.col); if (w.cracked && !w.dead) { ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; p.line(w.x - 3, w.y - 4, w.x + 1, w.y - 1); ctx.restore(); } } };
  // ground stomps crush beetles
  SB.swarmCrush = function (x, y, r, src) {
    const W = SB.world;
    for (const e of W.entities) if (e.wasps && e.alive && !e.ko && e.def.swarmKind === 'beetle' && e !== src) for (const w of e.wasps) if (!w.dead && !w.fly && Math.abs(w.x - x) < r && w.y > W.groundY - 40) { if (Math.random() < 0.5) { killWasp(e, w, W, true); w.vy = -120; } else { w.vy = -320; w.vx = (w.x - x) * 3; } }
  };
  SB.DEFS['wasp swarm'].drawWorld = function (p, ctx, e, t) { if (!e.wasps) return; ctx.strokeStyle = '#000'; for (const w of e.wasps) D.wasp(p, w.x, w.y, Math.max(1.3, e.scale * 1.3), w.vx >= 0 ? 1 : -1, t, w.seed, w.dead ? Math.max(0, w.life / 1.2) : 1); };

  // giant praying mantis: camouflage ambush, lightning grab, slashes, leaps
  S.mantis = function (e, dt, W) {
    const s = e.scale;
    e.specT -= dt; e.leapCd -= dt; if (e.ambushT > 0) e.ambushT -= dt; if (e.leapT > 0) e.leapT -= dt;
    // camouflage: fades in while it keeps still and calm, drops the instant it moves, attacks or gets hurt
    const hurtNow = e.hp < (e.prevHp == null ? e.hp : e.prevHp); e.prevHp = e.hp;
    if (hurtNow || e.strikeT > 0 || e.slashT > 0 || e.grabbed || Math.abs(e.vx) > 30 || !e.grounded || e.held) e.calmT = 0; else e.calmT += dt;
    const want = e.calmT > 1.2 && !e.ko ? 0.85 : 0;
    e.camo += (want - e.camo) * Math.min(1, dt * (want > e.camo ? 1.2 : 8));
    if (e.camo > 0.6 && !e.camoSaid) { e.camoSaid = true; e.say('*blends in*'); }
    if (e.camo < 0.2) e.camoSaid = false;
    if (e.strikeT > 0) { const was = e.strikeT; e.strikeT -= dt; if (was > 0.15 && e.strikeT <= 0.15) mantisStrike(e, W); }
    if (e.slashT > 0) { const was = e.slashT; e.slashT -= dt; if (was > 0.18 && e.slashT <= 0.18) mantisSlash(e, W); }
    // holding a victim: pin it in the forelegs and bite
    if (e.grabbed) {
      const v = e.grabbed;
      if (!v.alive || v.dying || v.held || v.ko || e.ko || e.held || e.dizzy > 0 || e.frozenT > 0) { mantisRelease(e, W, false); return; }
      e.grabT -= dt; e.grabTick -= dt;
      v.x = e.x + e.facing * D.mantisClaw[0] * ks(e); v.y = Math.min(e.y + D.mantisClaw[1] * ks(e), W.groundY - v.h / 2);
      v.vx = 0; v.vy = 0; v.grounded = false; v.angle = e.facing * 0.5;
      if (e.grabTick <= 0) { e.grabTick = 0.45; W.hurt(v, 2, e, { quiet: true }); W.sfx('snip', v.x, 0.8); if (Math.random() < 0.5) v.say(pick(['HELP!', 'Let me go!', 'AAAH!', 'It\'s got me!'])); }
      if (v.ko || e.grabT <= 0) mantisRelease(e, W, true);
      return;
    }
    if (!ready(e) || !e.grounded) return;
    const tg = e.target;
    if (!(tg && tg.alive && !tg.dying && !tg.ko)) { if (e.ambushT <= 0 && Math.random() < dt * 0.3) e.ambushT = 3; return; }
    const dx = tg.x - e.x, ad = Math.abs(dx), reach = e.w * 0.5 + 45 * s + tg.w * 0.5;   // measured from the front of the body
    const level = tg.bottom > e.top + e.h * 0.1 && tg.top < e.bottom;
    if (ad < reach + 40 * s && level && e.specT > 0) { e.ambushT = Math.max(e.ambushT, 0.2); e.facing = dx >= 0 ? 1 : -1; }   // in range: hold still and wait to strike, don't blunder into it
    if (e.specT <= 0 && ad < reach && level) {
      e.facing = dx >= 0 ? 1 : -1; e.camo = 0; e.calmT = 0; e.ambushT = 0;
      if (!tg.def.boss && !tg.static && tg.mass < 40) { e.strikeT = 0.3; e.specT = 3; }
      else { e.slashT = 0.35; e.specT = 1.4; }
      W.sfx('swing', e.x);
      return;
    }
    if (e.leapCd <= 0 && ad > 260 * s && ad < 700 * s && Math.abs(tg.y - e.y) < 260 * s) {
      e.facing = dx >= 0 ? 1 : -1; e.leapCd = 5; e.leapT = 0.9; e.specT = 0; e.camo = 0; e.ambushT = 0;
      const T = 2 * 620 / 1700;
      e.vx = e.facing * clamp((ad - reach * 0.7) / T, 250, 950); e.vy = -620; e.grounded = false;
      e.say(pick(['*LEAP*', 'SKREEE!'])); W.sfx('whoosh', e.x); W.sfx('wind', e.x, 0.4);
      return;
    }
    // prey nearby but out of reach: freeze and wait for it to wander closer
    if (ad < 450 * s && e.ambushT <= 0 && Math.random() < dt * 0.5) e.ambushT = 2.5;
  };
  function mantisStrike(e, W) {
    const s = e.scale, reach = e.w * 0.5 + 55 * s;
    let best = null, bd = Infinity;
    for (const o of W.entities) {
      if (o === e || !o.alive || o.dying || !o.creature || o.ko || o.held || o.static || o.invisible || SB.kin(e, o)) continue;
      const dx = (o.x - e.x) * e.facing;
      if (dx < 0 || dx > reach + o.w * 0.5 || o.bottom < e.top || o.top > e.bottom) continue;
      if (dx < bd) { bd = dx; best = o; }
    }
    if (!best) { W.sfx('swing', e.x, 0.5); return; }
    W.particle('slash', (e.x + best.x) / 2, best.y, { life: 0.2, size: 50, rot: e.facing, col: '#c8f08a' });
    if (best.mass < 1.5 || SB.matches(best, e.eats)) {                          // small prey: one bite
      W.remove(best, 'eaten'); e.say(pick(['*CRUNCH*', 'Delicious.', '*munch munch*'])); e.hp = Math.min(e.hpMax, e.hp + 4); e.prevHp = e.hp;
      W.sfx('snip', best.x); W.popText(best.x, best.top - 10, 'CHOMP!', 22); return;
    }
    if (best.def.boss || best.mass >= 40) { mantisSlash(e, W); return; }
    e.grabbed = best; e.grabT = 1.4; e.grabTick = 0.2;
    W.hurt(best, 2, e, { quiet: true }); best.dizzy = Math.max(best.dizzy, 0.6);
    best.say(pick(['WHOA!', 'HEY!', 'AAAH!'])); e.say(pick(['GOTCHA!', '*SNATCH*']));
    W.popText(best.x, best.top - 14, 'SNATCH!', 24); W.sfx('snip', best.x); W.shake(4);
  }
  function mantisRelease(e, W, toss) {
    const v = e.grabbed; e.grabbed = null; e.grabT = 0;
    if (!v || !v.alive) return;
    v.angle = 0;
    if (toss) { v.vx = e.facing * (420 + Math.random() * 160); v.vy = -460; v.angVel = e.facing * 10; v.grounded = false; W.sfx('whoosh', v.x); e.say(pick(['Next!', '*tosses it away*', 'Hmph.'])); }
  }
  function mantisSlash(e, W) {
    const s = e.scale, reach = e.w * 0.5 + 60 * s; let hits = 0;
    for (const o of W.entities) {
      if (o === e || !o.alive || o.dying || !o.creature || o.ko || o.held || SB.kin(e, o)) continue;
      const dx = (o.x - e.x) * e.facing;
      if (dx < e.w * 0.1 || dx > reach + o.w * 0.5 || o.bottom < e.top - 30 || o.top > e.bottom) continue;
      W.hurt(o, o.def.boss ? 4 : 3, e, { quiet: true });
      if (!o.def.boss) { o.vx = e.facing * 380; o.vy = -300; o.grounded = false; }
      hits++;
    }
    W.particle('slash', e.x + e.facing * e.w * 0.45, e.y - e.h * 0.25, { life: 0.25, size: 70, rot: e.facing, col: '#c8f08a' });
    W.sfx(hits ? 'heavy' : 'swing', e.x + e.facing * e.w * 0.4);
  }

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
    const hx = e.x + e.facing * 46 * ks(e), hy = e.y - 60 * ks(e);
    const f = W.spawn('fireball', hx, hy, { scale: Math.max(0.6, e.scale), quiet: true }); if (!f) return;
    f.owner = e; f.y = hy;
    const ax = tg && tg.alive ? tg.x + tg.vx * 0.5 : e.x + e.facing * 300, ay = tg && tg.alive ? Math.min(W.groundY - tg.h / 2, tg.y + tg.vy * 0.5) : W.groundY;
    const T = 0.9, g = 1700 * f.gravity;
    f.vx = clamp((ax - hx) / T, -900, 900); f.vy = (ay - hy) / T - 0.5 * g * T; f.grounded = false;
    W.shake(3); W.sfx('whoosh', e.x); W.sfx('fire', e.x, 0.6); e.say('*FWOOM*'); W.burst('spark', hx, hy, 6, 120, { size: 5 });
  }

  // phoenix: rules the sky. Fiery dives that leave the ground burning, wing-beats that hurl fireballs from its
  // beak, and REBIRTH: the first knock-out turns it to flame and ash, and it hatches again with half its health.
  const phxTrail = [];   // fires its dives leave on the ground: [fire, when it burns out]
  S.phoenix = function (e, dt, W) {
    phoenixHooks(W);
    for (let i = phxTrail.length - 1; i >= 0; i--) { const [f, until] = phxTrail[i]; if (!f.alive || f.dying || W.time > until) { if (f.alive && !f.dying) W.remove(f, 'poof'); phxTrail.splice(i, 1); } }
    if (e.rebirthT > 0) { rebirthTick(e, dt, W); return; }
    e.pitch = e.pitch || 0;
    if (e.ko) { e.pitch *= 0.9; return; }
    const K = ks(e);
    e.specT -= dt;
    if (Math.random() < dt * 9) W.particle('flame', e.x - e.facing * (50 + Math.random() * 70) * K, e.y + Math.random() * 30 * K, { vx: -e.facing * 50, vy: -70, life: 0.45, size: 5 + Math.random() * 6 });
    if (Math.random() < dt * 5) W.particle('spark', e.x + (Math.random() - 0.5) * e.w * 0.7, e.y + (Math.random() - 0.5) * e.h * 0.4, { vy: -70, life: 0.6, size: 3 });
    if (e.diveT > 0) { diveTick(e, dt, W); return; }
    if (e.throwT > 0) {   // rearing back on beating wings, then the fireballs
      const was = e.throwT; e.throwT -= dt; e.pitch += (-0.15 - e.pitch) * Math.min(1, dt * 6);
      if (was > 0.32 && e.throwT <= 0.32) phoenixVolley(e, W);
      return;
    }
    e.pitch += (0 - e.pitch) * Math.min(1, dt * 4);
    if (!ready(e)) return;
    const tg = e.target;
    if (!(tg && tg.alive && !tg.dying && !tg.ko)) { if (e.specT <= 0) e.specT = 0.3; return; }
    const dx = tg.x - e.x, dy = tg.y - e.y;
    // circle high above and off to one side of its prey, out of reach of swords
    if (e.flying && !e.controlled) {
      const hy = clamp(tg.top - 170 * e.scale - e.h * 0.3, W.groundY * 0.08 + e.h / 2, W.groundY - e.h / 2 - 40);
      const hx = tg.x + (dx >= 0 ? -1 : 1) * 230 * e.scale, k = Math.min(1, dt * 6);
      e.vy += (clamp((hy - e.y) * 2.5, -420, 420) - e.vy) * k;
      e.vx += (clamp((hx - e.x) * 2, -260, 260) - e.vx) * k * 0.6;
    }
    if (e.specT > 0) return;
    const d = Math.hypot(dx, dy);
    if (e.flying && dy > 80 * e.scale && Math.abs(dx) < 700 * e.scale && (e.lastAtk !== 'dive' || Math.random() < 0.35)) phoenixDive(e, tg, W);
    else if (d < 780 * e.scale && Math.abs(dx) > 40) {
      e.throwT = 0.8; e.specT = 3.2; e.aim = tg; e.facing = dx >= 0 ? 1 : -1; e.lastAtk = 'volley';
      W.sfx('screech', e.x, 0.6); W.sfx('wind', e.x, 0.5); e.say(pick(['*WINGS OF FIRE*', 'BURN!', 'KREEEAAAH!']));
    } else e.specT = 0.4;
  };
  function phoenixDive(e, tg, W) {
    e.facing = tg.x >= e.x ? 1 : -1;
    const ax = tg.x + tg.vx * 0.25, ay = Math.min(W.groundY - e.h * 0.3, tg.y), dx = ax - e.x, dy = ay - e.y, d = Math.hypot(dx, dy) || 1;
    const V = 950 * Math.sqrt(e.scale);
    e.diveVx = dx / d * V; e.diveVy = dy / d * V; e.diveDown = d / V + 0.08; e.diveT = 3; e.divePh = 'down';
    e.diveId = (e.diveId || 0) + 1; e.diveFires = 0; e.diveLastX = -1e9; e.specT = 3.6; e.lastAtk = 'dive';
    W.sfx('screech', e.x); W.sfx('whoosh', e.x); W.shake(4);
    e.say(pick(['SKREEEEEE!', '*DIVES*', 'FROM ABOVE!', 'FEEL THE SUN!']));
  }
  function diveTick(e, dt, W) {
    const K = ks(e), sq = Math.sqrt(e.scale);
    e.diveT -= dt;
    if (e.divePh === 'down') {
      e.vx = e.diveVx || 0; e.vy = e.diveVy || 0; e.diveDown -= dt;
      if (e.diveDown <= 0 || e.bottom >= W.groundY - 6) { e.divePh = 'up'; e.upT = 0.8; W.sfx('whoosh', e.x); W.sfx('fire', e.x, 0.7); }
    } else {
      e.upT -= dt; e.vx = e.facing * 720 * sq; e.vy = -620 * sq * Math.min(1, e.upT * 2 + 0.3);
      if (e.upT <= 0) { e.diveT = 0; e.vx *= 0.4; e.vy *= 0.4; }
    }
    if (e.diveT <= 0) e.diveT = 0;
    const wp = clamp(Math.atan2(e.vy, Math.abs(e.vx)), -0.6, 1.0);
    e.pitch += (wp - e.pitch) * Math.min(1, dt * 10);
    // everything the burning bird touches catches fire and gets bowled aside
    const hx = e.x + e.facing * 30 * K, hy = e.y + 12 * K, R = 62 * K;
    for (const o of W.entities) {
      if (o === e || !o.alive || o.dying || o.held || SB.kin(e, o) || o.special === 'fireball' || o.special === 'fire') continue;
      if (Math.abs(o.x - hx) > R + o.w * 0.45 || Math.abs(o.y - hy) > R + o.h * 0.45) continue;
      W.burn(o, e, dt);
      if (o.creature && !o.ko && o.diveHit !== e.diveId) {
        o.diveHit = e.diveId; W.hurt(o, 3, e, { quiet: true });
        if (!o.static) { o.vx = e.facing * 420 * Math.min(1.5, 4 / Math.sqrt(o.mass)); o.vy = -380; o.grounded = false; }
        o.say(pick(['AAAH! FIRE!', 'Yeow!', 'Hot hot hot!', 'Duck!'])); W.popText(o.x, o.top - 20, 'SCORCH!', 22); W.shake(5);
      }
    }
    // skimming the ground: set it ablaze
    if (e.bottom > W.groundY - 60 * e.scale && e.diveFires < 4 && Math.abs(e.x - e.diveLastX) > 75 * e.scale) {
      const f = W.spawn('fire', e.x - e.facing * 20 * K, W.groundY - 20, { quiet: true, scale: 0.8 + Math.random() * 0.3 });
      if (f) { f.spawnT = 0.6; phxTrail.push([f, W.time + 5 + Math.random() * 2]); e.diveFires++; e.diveLastX = e.x; W.sfx('fire', e.x, 0.5); }
    }
    for (let k = 0; k < 2; k++) W.particle('flame', e.x - e.facing * (Math.random() * 60) * K, e.y + (Math.random() - 0.3) * 40 * K, { vx: -e.vx * 0.25 + (Math.random() - 0.5) * 60, vy: -e.vy * 0.25 - 40, life: 0.5, size: 9 + Math.random() * 10 * e.scale });
    if (Math.random() < dt * 30) W.particle('streak', e.x, e.y, { tx: e.vx, ty: e.vy, life: 0.2, size: 50 });
  }
  // a beat of the wings: three fireballs from the beak, fanned around the target
  function phoenixVolley(e, W) {
    const tg = e.aim; e.aim = null;
    const K = ks(e), pc = Math.cos(e.pitch || 0), ps = Math.sin(e.pitch || 0), [mx, my] = D.phoenixBeak;   // the beak, turned with the bird's pitch
    const bx = e.x + e.facing * (mx * pc - my * ps) * K, by = e.y + (mx * ps + my * pc) * K;
    const live = tg && tg.alive && !tg.dying;
    const tx = live ? tg.x + tg.vx * 0.5 : e.x + e.facing * 300, ty = live ? Math.min(W.groundY - tg.h / 2, tg.y) : W.groundY - 20;
    for (let i = -1; i <= 1; i++) {
      const f = W.spawn('fireball', bx, by, { scale: Math.max(0.6, e.scale * 0.9), quiet: true }); if (!f) continue;
      f.owner = e; f.x = bx; f.y = by;
      const T = 0.7 + Math.abs(i) * 0.12, g = 1700 * f.gravity, ax = tx + i * 95 * e.scale;
      f.vx = clamp((ax - bx) / T, -1000, 1000); f.vy = (ty - by) / T - 0.5 * g * T; f.grounded = false;
    }
    W.shake(4); W.sfx('fire', e.x); W.sfx('whoosh', e.x); W.burst('flame', bx, by, 8, 160, { size: 8, life: 0.4 }); W.burst('spark', bx, by, 6, 140, { size: 5 });
    e.say(pick(['*FWOOM*', 'BURN!', 'SKREEE!']));
  }
  // first knock-out: it bursts into a pillar of flame instead (the K.O. and the mess come the second time)
  function phoenixBurst(e, by, W) {
    e.reborn = true; e.ko = true; e.hp = 0; e.target = e.threat = e.victim = null; e.dizzy = 0; e.sleeping = false; e.thrust = 0;
    e.koAngle = 0; e.diveT = e.throwT = 0; e.poisonT = 0; e.onFire = 0; e.webT = 0; e.pitch = 0;
    e.rebirthT = D.PHX_REBIRTH; e.vy = Math.min(e.vy, -150); e.grounded = false;
    W.sfx('screech', e.x); W.sfx('fire', e.x); W.sfx('boom', e.x, 0.6); W.flash = 0.3; W.shake(10);
    W.burst('flame', e.x, e.y, 26, 320, { size: 13, life: 0.7 }); W.burst('spark', e.x, e.y, 12, 260, { size: 6 });
    W.particle('impact', e.x, e.top - 24, { life: 1.0, size: 58, text: 'K.O.?' });
    e.say(pick(['I... will... RISE!', 'This is not the end!', 'From the ashes...']));
    if (by && by.creature && by.alive) { by.say(pick(['We did it!', 'Victory!', 'Is it over?'])); by.setMood('happy', 2); }
  }
  function rebirthTick(e, dt, W) {
    if (!e.ko) { e.rebirthT = 0; return; }   // brought back some other way
    const R = D.PHX_REBIRTH, u0 = 1 - e.rebirthT / R;
    e.rebirthT -= dt;
    const u = 1 - Math.max(0, e.rebirthT) / R, K = ks(e), gy = e.bottom;
    e.angle = 0; e.angVel = 0; e.koAngle = 0;
    if (u < 0.3 || u >= 0.78) { if (Math.random() < dt * 50) W.particle('flame', e.x + (Math.random() - 0.5) * 60 * K, gy - Math.random() * 60 * K, { vx: (Math.random() - 0.5) * 40, vy: -300 - Math.random() * 250, life: 0.6, size: 10 + Math.random() * 14 }); }
    else { if (Math.random() < dt * 5) W.particle('smoke', e.x + (Math.random() - 0.5) * 50 * K, gy - 20 * K, { vy: -40, life: 1.2, size: 8 }); if (Math.random() < dt * 6) W.particle('spark', e.x + (Math.random() - 0.5) * 40 * K, gy - 25 * K, { vy: -80, life: 0.6, size: 3 }); }
    if (u0 < 0.6 && u >= 0.6) { W.sfx('fire', e.x, 0.5); e.say('*crack... crack...*'); }
    if (u0 < 0.78 && u >= 0.78) {   // the egg bursts
      W.sfx('boom', e.x, 0.7); W.sfx('screech', e.x); W.flash = 0.35; W.shake(12);
      W.burst('flame', e.x, gy - 30 * K, 30, 360, { size: 12, life: 0.7 }); W.burst('spark', e.x, gy - 30 * K, 14, 300, { size: 6 });
      W.popText(e.x, e.top - 40, 'REBIRTH!', 40);
    }
    if (e.rebirthT <= 0) phoenixReborn(e, W);
  }
  function phoenixReborn(e, W) {
    e.rebirthT = 0; e.ko = false; e.hp = Math.ceil(e.hpMax / 2); e.lastHp = e.hp; e.angle = 0; e.dizzy = 0; e.spawnT = 1;
    e.y = Math.min(e.y, W.groundY - e.h / 2); e.vy = -650; e.grounded = false; e.specT = 1.2; e.lastAtk = 'dive';
    e.setMood('angry', 3); e.say(pick(['I RISE AGAIN!', 'REBORN IN FIRE!', 'You cannot kill a phoenix!']));
    W.sfx('screech', e.x); W.sfx('fire', e.x); W.sfx('heal', e.x);
    W.particle('ring', e.x, e.bottom, { life: 0.5, size: 260 * e.scale }); W.burst('sparkle', e.x, e.y, 10, 160, { size: 6, life: 0.8 });
    // a ring of fire blasts out from the nest
    for (const o of W.entities) {
      if (o === e || !o.alive || o.dying || o.static || o.held || SB.kin(e, o)) continue;
      const dx = o.x - e.x, d = Math.hypot(dx, o.y - e.y);
      if (d > 240 * e.scale) continue;
      W.burn(o, e, 0.1); o.vx += (dx < 0 ? -1 : 1) * 380; o.vy = Math.min(o.vy, -300); o.grounded = false;
      if (o.creature) { W.hurt(o, 2, e, { quiet: true }); o.say(pick(['It\'s BACK!', 'No way!', 'AAAH!'])); }
    }
  }
  // hooks into the world (installed once): rebirth on the first knock-out, a click hurries the rebirth along,
  // and in control mode E fires its special
  function phoenixHooks(W) {
    if (!W || W.phoenixHooked || !W.knockOut) return;
    W.phoenixHooked = true;
    const ko = W.knockOut, revive = W.revive, ctrlSpecial = W.ctrlSpecial;
    W.knockOut = function (e, by) {
      if (e.special === 'phoenix' && !e.ko && e.alive && !e.dying) {
        if (!e.reborn) { phoenixBurst(e, by, W); return; }
        e.diveT = 0; e.pitch = 0;
        ko.call(W, e, by);
        W.burst('smoke', e.x, e.y, 12, 80, { size: 12, life: 1.4 });
        return;
      }
      return ko.call(W, e, by);
    };
    if (revive) W.revive = function (e) { if (e.rebirthT > 0) { e.rebirthT = Math.min(e.rebirthT, 0.4); return; } return revive.call(W, e); };
    if (ctrlSpecial) W.ctrlSpecial = function () {
      const e = W.ctrl && W.ctrl.e;
      if (!e || e.special !== 'phoenix') return ctrlSpecial.call(W);
      if (e.ko || e.dying || W.ctrl.atkCd > 0) return;
      W.ctrl.atkCd = 0.6;
      let best = null, bd = Infinity;
      for (const o of W.entities) {
        if (o === e || !o.alive || o.dying || !o.creature || o.ko || o.held) continue;
        const dx = (o.x - e.x) * e.facing; if (dx < -o.w * 0.3 || dx > 900) continue;
        const dd = Math.abs(dx) + Math.abs(o.y - e.y) * 0.5; if (dd < bd) { bd = dd; best = o; }
      }
      if (!best) { e.say('Nothing to attack!'); return; }
      e.target = best; e.ctrlTargetT = 2; e.facing = best.x >= e.x ? 1 : -1; e.specT = 0;
    };
  }
  window.addEventListener('DOMContentLoaded', () => phoenixHooks(SB.world));

  // giant dragon: the terror of the ground and the sky. Sweeps a long cone of fire from its jaws, whips its spiked
  // tail round at anything behind it, rears up and beats its wings into a gale, and takes off to rain fire from
  // above before crashing back down with a ground-shaking stomp. Timers: breath (inhale, then fire), whipT (tail),
  // beatT (wing-beat gust), rainT (fire rain from the air), poundT (landing crouch); flyPh = 'up' | 'air' | 'down' |
  // 'ctrl' (flown by the player) while it is in the air (e.move is switched to 'fly' for that, back to 'walk' on landing).
  const drgFires = [];   // fires its breath leaves on the ground: [fire, when it burns out]
  const DMW = [0, 0, 0];
  // the two elements (def.drgEl): what the breath does, what rains from the sky, what it says and sounds like
  const DRG_EL = {
    fire: { hits: ['fire', 'hot'], hurtBy: ['ice', 'cold', 'snow'], sfx: 'fire', drop: 'fireball', breathSay: ['*FWOOOOOSH*', 'BURN!', 'ROOOAAAR!'], rainSay: ['RAIN OF FIRE!', 'BURN FROM ABOVE!', '*FWOOOOSH*'], snuffSay: '*its fire sputters out*' },
    ice: { hits: ['ice', 'cold', 'snow'], hurtBy: ['fire', 'hot', 'lava'], sfx: 'freeze', drop: 'icicle', breathSay: ['*KSSHHHHHH*', 'FREEZE!', 'WINTER COMES!'], rainSay: ['RAIN OF ICE!', 'FREEZE FROM ABOVE!', '*KSSHHHH*'], snuffSay: '*its frost melts away*' }
  };
  const drgEl = e => DRG_EL[e.def.drgEl] || DRG_EL.fire;
  // where its mouth is in the world right now and which way the fire goes (the same transform as the drawing)
  function dragonMouthWorld(e, W) {
    const M = D.dragonMouth(e, W.time), K = ks(e), f = e.facing, th = (e.angle || 0) + (e.tilt || 0), c = Math.cos(th), s = Math.sin(th);
    const x = M[0] * f * K, y = M[1] * K, dx = Math.cos(M[2]) * f, dy = Math.sin(M[2]);
    DMW[0] = e.x + x * c - y * s; DMW[1] = e.y + x * s + y * c; DMW[2] = Math.atan2(dx * s + dy * c, dx * c - dy * s);
    return DMW;
  }
  // one frame of fire from the mouth: everything in the cone burns, and where it hits the ground the grass catches
  function dragonFire(e, dt, W, R) {
    const M = dragonMouthWorld(e, W), mx = M[0], my = M[1], a = M[2], dx = Math.cos(a), dy = Math.sin(a), K = ks(e);
    let L = R, ground = false;
    if (dy > 0.05) { const g = (W.groundY - 6 - my) / dy; if (g < L) { L = Math.max(20, g); ground = true; } }
    e.fireLen = L / K;   // for the drawings: how long the cone is
    const ice = e.def.drgEl === 'ice', el = drgEl(e);
    for (let k = 0; k < 3; k++) {
      const sp = 480 + Math.random() * 260, sd = (Math.random() - 0.5) * 0.36, life = Math.min(0.8, L / sp) * (0.7 + Math.random() * 0.35);
      if (ice) W.particle('puff', mx, my, { vx: Math.cos(a + sd) * sp, vy: Math.sin(a + sd) * sp, life: life * 1.1, size: 7 + Math.random() * 10 * e.scale });
      else W.particle('flame', mx, my, { vx: Math.cos(a + sd) * sp, vy: Math.sin(a + sd) * sp, life, size: 9 + Math.random() * 12 * e.scale });
    }
    if (ice) { if (Math.random() < dt * 30) { const u = Math.random(); W.particle('sparkle', mx + dx * L * u, my + dy * L * u + (Math.random() - 0.5) * 40 * u, { vx: dx * 160, vy: 40, life: 0.6, size: 4 }); } }
    else if (Math.random() < dt * 10) W.particle('smoke', mx + dx * L, my + dy * L - 10, { vx: (Math.random() - 0.5) * 40, vy: -60, life: 1, size: 9 });
    for (const o of W.entities) {
      if (o === e || !o.alive || o.dying || SB.kin(e, o) || (!ice && (o.special === 'fire' || o.special === 'fireball'))) continue;
      const px = o.x - mx, py = o.y - my, s = px * dx + py * dy;
      if (s < -o.w * 0.3 || s > L + o.w * 0.4) continue;
      if (Math.abs(px * dy - py * dx) > 16 * K + s * 0.26 + Math.min(o.w, o.h) * 0.4) continue;
      if (o.def.weak && o.weakT <= 0 && o.def.weak.some(w => el.hits.includes(w))) W.weaken(o, e);   // fire on an ice dragon, frost on a fire dragon
      if (ice) {   // frost: freezes creatures solid (and slows them), snuffs out fires
        if (o.creature) { W.freeze(o, e, 2.5); if (!o.static && !o.held) o.vx *= Math.max(0, 1 - dt * 4); }
        else if (o.special === 'fire') { o.meltT = (o.meltT || 0) + dt * 3; if (o.meltT > 1) W.extinguish(o); }
        else if (o.special === 'fireball') { W.popText(o.x, o.y - 10, 'Fizz!', 14); W.remove(o, 'poof'); }
        if (o.onFire > 0) W.douse(o, true);
      } else { W.burn(o, e, dt); if (o.frozenT > 0) W.thaw(o); }
      if (o.creature && !o.static && !o.held && !o.def.boss) o.vx += dx * 500 * dt;
    }
    if (ice) {   // frost spreads where it hits the ground
      if (ground && Math.random() < dt * 14) W.particle('sparkle', mx + dx * L + (Math.random() - 0.5) * 60, W.groundY - 6, { vy: -30, life: 0.9, size: 5 });
      return;
    }
    if (ground && (e.fireN || 0) < 6) {
      const gx = mx + dx * L;
      if (Math.abs(gx - (e.fireLastX == null ? -1e9 : e.fireLastX)) > 85 * e.scale && gx > 20 && gx < W.W - 20) {
        const f = W.spawn('fire', gx, W.groundY - 20, { quiet: true, scale: 0.8 + Math.random() * 0.35 });
        if (f) { f.spawnT = 0.6; drgFires.push([f, W.time + 4 + Math.random() * 2.5]); e.fireN = (e.fireN || 0) + 1; e.fireLastX = gx; }
      }
    }
  }
  // the tail lashes round: everything behind it (or under its belly) is knocked flying
  function dragonTail(e, W) {
    const f = e.facing, K = ks(e); let n = 0;
    for (const o of W.entities) {
      if (o === e || !o.alive || o.dying || o.static || o.held || SB.kin(e, o) || (o.noCollide && !o.creature)) continue;
      const rx = (o.x - e.x) * f;
      if (rx > e.w * 0.22 + o.w * 0.3 || rx < -(e.w * 0.5 + 200 * e.scale + o.w * 0.5)) continue;
      if (o.bottom < e.y - e.h * 0.4 || o.top > e.bottom + 8) continue;
      const dir = rx < 0 ? -f : f, m = Math.min(1.6, 4.5 / Math.sqrt(Math.max(0.3, o.mass)));
      o.vx = dir * (520 + Math.random() * 260) * m; o.vy = -(480 + Math.random() * 220) * m; o.grounded = false; o.angVel = (Math.random() - 0.5) * 16;
      if (o.creature) { W.hurt(o, 3, e, { quiet: true }); o.dizzy = Math.max(o.dizzy, 1); o.say(pick(['WHOAAA!', 'OOF!', 'The tail!', 'Aaaah!'])); }
      n++;
    }
    const tx = e.x - f * 150 * K, ty = e.y + 30 * K;
    W.sfx('heavy', tx); W.sfx('whoosh', e.x); W.shake(n ? 9 : 4);
    if (n) { W.popText(tx, ty - 40, 'WHACK!', 30); W.burst('spark', tx, ty, 8, 200, { size: 6 }); }
    W.puff(tx, W.groundY - 4, 6, 12);
    e.say(pick(['*TAIL SWIPE*', 'BEHIND ME? FOOL!', 'GRAAH!']));
  }
  // the downbeat of the wings: a gale that blows everything in front of it away
  function dragonGust(e, W) {
    const f = e.facing, R = 560 * e.scale; let n = 0;
    for (const o of W.entities) {
      if (o === e || !o.alive || o.dying || o.static || o.held || SB.kin(e, o) || o.special === 'fire') continue;
      const rx = (o.x - e.x) * f; if (rx < -e.w * 0.1 || rx > R) continue;
      if (Math.abs(o.y - e.y) > 260 * e.scale) continue;
      const k = 1 - Math.max(0, rx) / R, m = Math.min(2.2, 6 / Math.sqrt(Math.max(0.3, o.mass)));
      o.vx += f * (300 + 650 * k) * m; o.vy = Math.min(o.vy, -(140 + 260 * k) * m); o.grounded = false; o.angVel += (Math.random() - 0.5) * 6 * m;
      if (o.creature) { o.dizzy = Math.max(o.dizzy, 0.5 + k * 0.6); if (Math.random() < 0.6) o.say(pick(['WHOAAA!', 'So windy!', 'Hold on!', 'Blown away!'])); }
      n++;
    }
    for (let i = 0; i < 14; i++) { const x = e.x + f * (e.w * 0.3 + Math.random() * R * 0.8), y = e.y + (Math.random() - 0.6) * e.h; W.particle('streak', x, y, { vx: f * 700, tx: f * 900, ty: 0, life: 0.3 + Math.random() * 0.2, size: 60 + Math.random() * 40 }); }
    for (let i = 0; i < 5; i++) W.puff(e.x + f * (e.w * 0.4 + i * 70 * e.scale), W.groundY - 4, 3, 12);
    W.sfx('wind', e.x); W.sfx('whoosh', e.x); W.shake(6);
    W.popText(e.x + f * 180 * e.scale, e.top, 'WHOOOSH!', 30);
    if (n) e.say(pick(['BE GONE!', '*WINGS BEAT*', 'FLY, LITTLE ONES!']));
  }
  function dragonTakeOff(e, W, ctrl) {
    e.move = 'fly'; e.flyPh = ctrl ? 'ctrl' : 'up'; e.flyT = ctrl ? 0.4 : 0.8; e.rains = 0; e.grounded = false; e.lastAtk = 'fly';
    if (!ctrl) { e.vy = -560 * Math.sqrt(e.scale); e.specT = 1; }
    W.sfx('wind', e.x); W.sfx('whoosh', e.x); W.sfx('roar', e.x, 0.6); W.shake(6);
    W.puff(e.x, e.bottom, 10, 16); W.burst('puff', e.x, e.bottom - 6, 10, 260, { size: 12, life: 0.7, vy: -40 });
    e.say(pick(['To the skies!', 'ROOOAAAR!', '*great wings unfold*', 'You cannot hide from above!']));
  }
  function dragonLand(e, W, hard) {
    e.move = 'walk'; e.flyPh = null; e.rainT = 0; e.fireLen = 0; e.poundT = D.DRG.land; e.specT = Math.max(e.specT, 1.1); e.lastAtk = 'land';
    if (e.def.drgEl === 'ice') {   // the ice dragon's stomp shatters everything frozen around it
      for (const o of W.entities) if (o !== e && o.frozenT > 0 && Math.abs(o.x - e.x) < (hard ? 480 : 300) * e.scale && o.bottom > e.y) { W.thaw(o, 'shatter'); W.hurt(o, hard ? 3 : 2, e, { quiet: true }); W.popText(o.x, o.top - 20, 'SHATTER!', 24); }
      W.burst('shard', e.x, e.bottom - 4, 14, 320, { size: 6, g: 900, life: 0.8 });
    }
    W.stompWave(e, (hard ? 440 : 260) * e.scale, hard ? 720 : 420, hard ? 3 : 1);
    W.shake(hard ? 22 : 10); W.puff(e.x - e.w * 0.3, e.bottom, 6, 16); W.puff(e.x + e.w * 0.3, e.bottom, 6, 16);
    if (hard) { W.flash = 0.12; W.sfx('boom', e.x, 0.6); W.popText(e.x, e.top - 30, 'THOOOM!', 42); e.say(pick(e.def.roar)); }
    else W.popText(e.x, e.top - 20, 'CRASH!', 30);
  }
  function dragonFlight(e, dt, W) {
    const sq = Math.sqrt(e.scale), k = Math.min(1, dt * 6), down = e.bottom >= W.groundY - 3;
    e.flyT -= dt;
    if (e.flyPh === 'ctrl') { if (down && e.flyT <= 0) dragonLand(e, W, true); return; }
    if (!e.flying) { if (down && e.flyT < 0.6) dragonLand(e, W, false); return; }   // stunned, frozen or webbed in the air: it drops out of the sky
    if (e.controlled) { e.flyPh = 'ctrl'; return; }
    const tg = e.target, live = tg && tg.alive && !tg.dying && !tg.ko;
    if (e.flyPh === 'up') {
      e.vy += (-520 * sq - e.vy) * k; e.vx += (e.facing * 90 - e.vx) * k;
      if (e.flyT <= 0 || e.y < W.groundY * 0.35) { e.flyPh = 'air'; e.flyT = 5 + Math.random() * 2; e.rainDir = live ? (tg.x >= e.x ? 1 : -1) : e.facing; }
    } else if (e.flyPh === 'air') {
      const hy = clamp(live ? tg.top - 210 * e.scale - e.h * 0.3 : W.groundY * 0.3, W.groundY * 0.08 + e.h / 2, W.groundY - e.h / 2 - 140 * e.scale);
      if (e.rainT > 0) {   // strafing over its prey, breathing fire straight down
        e.facing = e.rainDir; e.faceT = 0;
        e.vx += (e.rainDir * 250 * sq - e.vx) * k; e.vy += (clamp((hy - e.y) * 2.5, -300, 300) - e.vy) * k;
      } else if (e.breath <= 0) {
        const dir = e.rainDir || 1, hx = live ? tg.x - dir * 170 * e.scale : e.x;
        e.vx += (clamp((hx - e.x) * 2.2, -340, 340) - e.vx) * k; e.vy += (clamp((hy - e.y) * 2.5, -420, 420) - e.vy) * k;
        if (live && Math.abs(e.x - hx) < 140 * e.scale) { e.facing = dir; e.faceT = 0; }
        if (live && e.specT <= 0 && Math.abs(e.x - hx) < 80 * e.scale && Math.abs(e.y - hy) < 110 * e.scale && (e.rains || 0) < 2) {
          e.rainT = 2.3; e.dropT = 0.35; e.drops = 0; e.fireN = 0; e.fireLastX = null; e.facing = dir; e.specT = 1;
          W.sfx(drgEl(e).sfx, e.x); W.sfx('roar', e.x, 0.7); W.shake(4); e.say(pick(drgEl(e).rainSay));
        } else if (live && e.specT <= 0 && (tg.flying || tg.bottom < W.groundY - 60) && Math.abs(tg.y - e.y) < 130 * e.scale && (tg.x - e.x) * e.facing > 0 && Math.abs(tg.x - e.x) < D.DRG.reach * ks(e) * 0.9) {
          dragonAttack(e, W, 'breath');   // something else up here with it: fire straight at it
        }
      }
      if (e.rainT <= 0 && e.breath <= 0 && (e.flyT <= 0 || !live && e.flyT < 3 || (e.rains || 0) >= 2 || ((e.rains || 0) >= 1 && Math.random() < dt * 0.8))) {
        e.flyPh = 'down'; W.sfx('whoosh', e.x); e.say(pick(['HERE I COME!', '*dives*', 'FEEL MY WEIGHT!']));
      }
    } else if (e.flyPh === 'down') {
      const lx = live ? tg.x : e.x;
      e.vx += (clamp((lx - e.x) * 2.2, -420, 420) - e.vx) * k; e.vy += (780 * sq - e.vy) * Math.min(1, dt * 4);
      if (down) dragonLand(e, W, true);
    }
  }
  function dragonAttack(e, W, kind) {
    const tg = e.target;
    if (tg && tg.alive && kind !== 'tail') { e.facing = tg.x >= e.x ? 1 : -1; e.faceT = 0; }
    e.lastAtk = kind;
    if (kind === 'breath') { e.breath = D.DRG.inhale + D.DRG.breath; e.specT = 3.2 + Math.random(); e.fireN = 0; e.fireLastX = null; W.sfx('roar', e.x, 0.5); e.say(pick(['*deep breath*', '*inhales*', 'Hhhhhhh...'])); }
    else if (kind === 'tail') { e.whipT = D.DRG.tail; e.specT = 1.6; W.sfx('swing', e.x); }
    else if (kind === 'gust') { e.beatT = D.DRG.beat; e.specT = 3; W.sfx('wind', e.x, 0.5); e.say(pick(['*rears up*', 'ROOOAR!', '*spreads its wings*'])); }
    else if (kind === 'fly') dragonTakeOff(e, W, false);
    else if (kind === 'rain') { e.rainT = 2.3; e.dropT = 0.35; e.drops = 0; e.fireN = 0; e.fireLastX = null; e.rainDir = e.facing; W.sfx(drgEl(e).sfx, e.x); e.say(drgEl(e).rainSay[0]); }
  }
  // a foe close behind it, or right under its belly where the fire can't reach: time for the tail
  function dragonBehind(e, W) {
    const f = e.facing;
    for (const o of W.entities) {
      if (o === e || !o.alive || o.dying || o.static || o.held || !o.creature || o.ko || SB.kin(e, o) || o.invisible) continue;
      const rx = (o.x - e.x) * f;
      if (rx > e.w * 0.22 || rx < -(e.w * 0.5 + 170 * e.scale)) continue;
      if (o.bottom < e.y - e.h * 0.3 || o.top > e.bottom) continue;
      return o;
    }
    return null;
  }
  S.dragonboss = function (e, dt, W) {
    dragonHooks(W);
    for (let i = drgFires.length - 1; i >= 0; i--) { const [f, until] = drgFires[i]; if (!f.alive || f.dying || W.time > until) { if (f.alive && !f.dying) W.remove(f, 'poof'); drgFires.splice(i, 1); } }
    if (e.ko || e.held) {   // knocked out or picked up: it drops out of the sky and stops mid-attack
      if (e.flyPh || e.move === 'fly') { e.flyPh = null; e.move = 'walk'; }
      e.rainT = 0; e.whipT = 0; e.beatT = 0; e.breath = 0; e.fireLen = 0; e.prevWeakT = e.weakT;
      return;
    }
    const R = D.DRG, K = ks(e);
    e.specT -= dt;
    // a knight's sword stings, but only its opposite element (cold for fire, heat for ice) stuns a dragon for long
    const el = drgEl(e);
    if (e.weakT > (e.prevWeakT || 0) + 0.3) {
      let sword = false, elem = false;
      for (const o of W.entities) {
        if (o === e || !o.alive || Math.abs(o.x - e.x) > (e.w + o.w) / 2 + 24 || Math.abs(o.y - e.y) > (e.h + o.h) / 2 + 24) continue;
        if (SB.matches(o, el.hurtBy)) elem = true; else if (o.tags.has('knight') || o.tags.has('sword')) sword = true;
      }
      if (sword && !elem) { e.dizzy = Math.min(e.dizzy, 0.35); e.hp = Math.min(e.hpMax, e.hp + 2); e.say(pick(['Curse you, sir knight!', 'A knight?! AGAIN?!', 'Ow! That sword!', 'Dragon slayers... GRR!'])); }
      else { if (e.breath > 0 || e.rainT > 0) e.say(el.snuffSay); e.breath = 0; e.rainT = 0; e.fireLen = 0; W.burst('smoke', e.x + e.facing * 60 * K, e.y - 40 * K, 6, 60, { size: 10, life: 1 }); }   // its opposite snuffs out its breath
    }
    e.prevWeakT = e.weakT;
    // smoke curls from its nostrils; embers spit from its jaws as it draws breath
    if (Math.random() < dt * 2.5 || (e.breath > R.breath && Math.random() < dt * 18)) {
      const M = dragonMouthWorld(e, W), inh = e.breath > R.breath;
      W.particle(inh ? (e.def.drgEl === 'ice' ? 'sparkle' : 'spark') : (e.def.drgEl === 'ice' ? 'puff' : 'smoke'), M[0], M[1] - 6 * K, { vx: e.facing * 20 + (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 30, life: inh ? 0.4 : 1.1, size: inh ? 3 : 5 });
    }
    // ---- the attacks in progress ----
    if (e.breath > 0) {
      const was = e.breath; e.breath -= dt;
      if (was > R.breath && e.breath <= R.breath) { W.sfx(el.sfx, e.x); W.sfx(el.sfx === 'fire' ? 'fire' : 'wind', e.x, 0.7); W.sfx('roar', e.x, 0.6); W.shake(5); e.say(pick(el.breathSay)); }
      if (e.breath > 0 && e.breath <= R.breath) { dragonFire(e, dt, W, R.reach * K); if (Math.random() < dt * 3) W.sfx(el.sfx === 'fire' ? 'fire' : 'wind', e.x, 0.5); }
      else e.fireLen = 0;
    }
    if (e.rainT > 0) {
      e.rainT -= dt; dragonFire(e, dt, W, 900 * e.scale);
      if (Math.random() < dt * 3) W.sfx(el.sfx === 'fire' ? 'fire' : 'wind', e.x, 0.5);
      e.dropT -= dt;
      if (e.dropT <= 0 && (e.drops || 0) < 4) {   // and gobbets of fire that burst where they land (or a hail of icicles)
        e.dropT = 0.5; e.drops = (e.drops || 0) + 1;
        const M = dragonMouthWorld(e, W), n = el.drop === 'icicle' ? 3 : 1;
        for (let i = 0; i < n; i++) {
          const fb = W.spawn(el.drop, M[0], M[1], { scale: Math.max(0.6, e.scale * 0.8), quiet: true }); if (!fb) break;
          fb.owner = e; fb.x = M[0]; fb.y = M[1]; fb.vx = e.vx * 0.5 + Math.cos(M[2]) * 160 + (i - (n - 1) / 2) * 140; fb.vy = 220 + Math.sin(M[2]) * 200; fb.grounded = false;
          if (n > 1) { fb.facing = 1; fb.angle = Math.atan2(fb.vy, fb.vx); }
        }
        if (n > 1) W.sfx('whoosh', M[0], 0.5);
      }
      if (e.rainT <= 0) { e.rainT = 0; e.fireLen = 0; e.rains = (e.rains || 0) + 1; e.rainDir = -(e.rainDir || e.facing); e.specT = 0.8; }
    }
    if (e.whipT > 0) {
      const was = e.whipT; e.whipT -= dt;
      if (was > 0.42 && e.whipT <= 0.42) dragonTail(e, W);
      if (e.whipT > 0.3 && e.whipT < 0.52 && Math.random() < dt * 40) W.particle('streak', e.x - e.facing * (100 + Math.random() * 90) * K, e.y + (Math.random() - 0.3) * 50 * K, { tx: -e.facing * 300, ty: 600, life: 0.2, size: 60 });
    }
    if (e.beatT > 0) {
      const was = e.beatT; e.beatT -= dt;
      if (was > 0.45 && e.beatT <= 0.45) dragonGust(e, W);
      if (was > 0.12 && e.beatT <= 0.12 && e.grounded) { W.stompWave(e, 260 * e.scale, 460, 1); W.shake(10); W.popText(e.x + e.facing * 60 * K, e.top, 'STOMP!', 26); }   // and down come the front feet
    }
    if (e.poundT > 0) e.poundT -= dt;
    // ---- flight: take off, circle, rain fire, land ----
    if (e.flyPh) dragonFlight(e, dt, W);
    else if (e.controlled && !e.grounded && e.move === 'walk' && W.ctrl.up && e.vy > -160 && !e.dizzy) dragonTakeOff(e, W, true);   // the player holds jump: up into the air
    if (e.breath > 0 || e.whipT > 0 || e.beatT > 0 || e.rainT > 0 || e.poundT > 0 || e.flyPh) return;
    if (!ready(e) || e.controlled || e.specT > 0) return;   // the player's dragon attacks with the E key (see dragonHooks)
    // ---- choose the next attack (on the ground) ----
    const tg = e.target;
    if (!(tg && tg.alive && !tg.dying && !tg.ko)) { e.specT = 0.3; return; }
    const dx = tg.x - e.x, dy = tg.y - e.y, adx = Math.abs(dx), ahead = dx * e.facing > 0;
    if (dragonBehind(e, W) && (e.lastAtk !== 'tail' || Math.random() < 0.45)) return dragonAttack(e, W, 'tail');
    if ((tg.flying || tg.bottom < e.top - 40 * e.scale) && e.lastAtk !== 'fly') return dragonAttack(e, W, 'fly');
    if (adx < e.w * 0.3 && Math.abs(dy) < e.h && e.lastAtk !== 'tail' && Math.random() < 0.7) return dragonAttack(e, W, 'tail');   // right under its feet: the tail sweeps round underneath
    if (!ahead && adx > e.w * 0.25) { e.specT = 0.2; return; }   // let it turn round first
    const inReach = adx < R.reach * K * 0.95 && Math.abs(dy) < 220 * e.scale && adx > e.w * 0.2;
    if (inReach && (e.lastAtk !== 'breath' || Math.random() < 0.4)) return dragonAttack(e, W, 'breath');
    if (adx < 480 * e.scale && e.lastAtk !== 'gust' && Math.random() < 0.6) return dragonAttack(e, W, 'gust');
    if (adx > 380 * e.scale && e.lastAtk !== 'fly' && e.lastAtk !== 'land' && Math.random() < 0.55) return dragonAttack(e, W, 'fly');
    if (inReach) return dragonAttack(e, W, 'breath');
    e.specT = 0.4;
  };
  // in control mode, E makes the dragon attack: tail at anything behind, fire at anything in front, a gale otherwise;
  // in the air it rains fire. Holding jump in the air takes off; it lands with a stomp.
  function dragonHooks(W) {
    if (!W || W.dragonHooked || !W.ctrlSpecial) return;
    W.dragonHooked = true;
    const ctrlSpecial = W.ctrlSpecial;
    W.ctrlSpecial = function () {
      const e = W.ctrl && W.ctrl.e;
      if (!e || e.special !== 'dragonboss') return ctrlSpecial.apply(W, arguments);
      if (e.ko || e.dying || W.ctrl.atkCd > 0) return;
      W.ctrl.atkCd = 0.6;
      if (e.breath > 0 || e.whipT > 0 || e.beatT > 0 || e.rainT > 0 || e.poundT > 0) return;
      e.target = null;
      if (e.flyPh) { dragonAttack(e, W, 'rain'); return; }
      if (dragonBehind(e, W)) { dragonAttack(e, W, 'tail'); return; }
      let near = Infinity;
      for (const o of W.entities) { if (o === e || !o.alive || o.dying || !o.creature || o.ko) continue; const rx = (o.x - e.x) * e.facing; if (rx > 0 && rx < near) near = rx; }
      dragonAttack(e, W, near < D.DRG.reach * ks(e) * 0.95 || near === Infinity ? 'breath' : 'gust');
    };
  }
  window.addEventListener('DOMContentLoaded', () => dragonHooks(SB.world));
})();
