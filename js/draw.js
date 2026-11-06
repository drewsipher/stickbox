'use strict';
// draw.js — procedural stick-figure templates. Every template returns
// { w, h, draw(pen, entity, time) } drawing centered at (0,0), facing +x.
(function () {
  const D = SB.D = {};
  const TAU = SB.TAU;

  // ---------- faces ----------
  const IRIS = ['#5b3a1f', '#3b6ea8', '#4f7d3a', '#8a6a2f', '#6b4423', '#2e2e2e', '#5a8fa8'];
  D.eye = function (p, x, y, r, e, side) {
    const m = e.mood, c = p.ctx;
    if (m === 'sleep') { p.arc(x, y, r, 0.3, Math.PI - 0.3); return; }
    if (m === 'dizzy') { p.line(x - r, y - r, x + r, y + r); p.line(x - r, y + r, x + r, y - r); return; }
    if (e.def && e.def.boss) {   // a boss's eye: glowing, with a slit pupil and a heavy brow
      const rr = r * (m === 'scared' ? 1.2 : 1), gcol = (p.pal && p.pal.eyeGlow) || '#ffcf33';
      c.save(); c.shadowColor = gcol; c.shadowBlur = Math.max(5, rr * 1.8);
      const g = c.createRadialGradient(x - rr * 0.3, y - rr * 0.3, rr * 0.1, x, y, rr * 1.25); g.addColorStop(0, '#fffbe0'); g.addColorStop(0.35, gcol); g.addColorStop(1, SB.shade(gcol, 0.55));
      c.fillStyle = g; c.beginPath(); c.ellipse(x, y, rr * 1.15, rr * 0.85, 0, 0, TAU); c.fill(); c.restore();
      c.fillStyle = '#0a0503'; c.beginPath(); c.ellipse(x + e.lookX * rr * 0.35, y + e.lookY * rr * 0.2, rr * 0.2, rr * 0.75, 0, 0, TAU); c.fill();
      c.save(); c.lineWidth *= 1.7;
      if (side > 0) p.line(x - rr * 1.4, y - rr * 0.7, x + rr * 1.3, y - rr * 1.5); else if (side < 0) p.line(x - rr * 1.3, y - rr * 1.5, x + rr * 1.4, y - rr * 0.7); else p.line(x - rr * 1.3, y - rr * 1.4, x + rr * 1.3, y - rr * 0.8);
      c.restore();
      return;
    }
    const rr = m === 'scared' ? r * 1.3 : r;
    if (rr < 1.4) { p.dot(x + e.lookX * rr * 0.3, y + e.lookY * rr * 0.3, Math.max(0.8, rr * 0.7)); return; }   // tiny eyes: just a bead
    const iris = (p.pal && p.pal.iris) || (e.def && e.def.cat === 'person' ? IRIS[Math.floor((e.seed || 0) * 13) % IRIS.length] : '#8a5a1a');
    // almond-shaped white, coloured iris, pupil, a glint, and the upper lid
    const ax = rr * 1.25, ay = rr * (m === 'scared' ? 1.0 : 0.82);
    const pts = []; for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; pts.push(x + Math.cos(a) * ax, y + Math.sin(a) * ay * (Math.sin(a) < 0 ? 1 : 0.85)); }
    c.save(); c.lineWidth *= 0.7; p.poly(pts, '#fbfaf5'); c.restore();
    const ix = x + e.lookX * rr * 0.45, iy = y + e.lookY * rr * 0.3, ir = rr * 0.68;
    c.save(); c.beginPath(); c.ellipse(x, y, ax, ay, 0, 0, TAU); c.clip();
    c.fillStyle = iris; c.beginPath(); c.arc(ix, iy, ir, 0, TAU); c.fill();
    c.fillStyle = SB.shade(iris, 0.35); c.beginPath(); c.arc(ix, iy, ir, Math.PI, TAU); c.arc(ix, iy, ir * 0.7, TAU, Math.PI, true); c.fill();
    c.fillStyle = '#0d0d0d'; c.beginPath(); c.arc(ix, iy, ir * 0.45, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(ix - ir * 0.35, iy - ir * 0.35, Math.max(0.5, ir * 0.22), 0, TAU); c.fill();
    c.restore();
    c.save(); c.lineWidth *= 1.15; p.arc(x, y + ay * 0.15, ax * 0.98, Math.PI + 0.25, TAU - 0.25); c.restore();   // upper lid
    if (m === 'angry') {
      if (side > 0) p.line(x - rr * 1.4, y - rr * 0.9, x + rr * 1.4, y - rr * 1.8);
      else p.line(x - rr * 1.4, y - rr * 1.8, x + rr * 1.4, y - rr * 0.9);
    }
  };
  D.mouth = function (p, x, y, w, e) {
    switch (e.mood) {
      case 'happy': p.arc(x, y - w * 0.35, w * 0.65, 0.35, Math.PI - 0.35); break;
      case 'scared': p.ellipse(x, y + 1, w * 0.22, w * 0.32, '#5a2a2a'); break;
      case 'angry': p.arc(x, y + w * 0.55, w * 0.5, Math.PI + 0.45, TAU - 0.45); break;
      case 'dizzy': p.zigzag(x - w * 0.4, y, x + w * 0.4, y, 2, 4); break;
      case 'sleep': p.circle(x, y + 1, 1.3); break;
      default: p.arc(x, y - w * 0.25, w * 0.45, 0.55, Math.PI - 0.55);
    }
  };
  D.animalMouth = function (p, e, x, y, w, teeth) {
    const m = e.mood;
    if (m === 'happy') p.arc(x - w * 0.4, y - w * 0.5, w * 0.7, 0.4, 2.4);
    else if (m === 'angry' || (teeth && m !== 'sleep')) { p.line(x - w, y, x + w * 0.3, y); p.zigzag(x - w, y, x + w * 0.3, y, 3, 5); }
    else if (m === 'scared') p.ellipse(x - w * 0.2, y + 1, w * 0.3, w * 0.4, '#5a2a2a');
    else p.line(x - w * 0.6, y, x + w * 0.2, y + 1);
  };
  D.flame = function (p, x, y, r, t, seed) {
    const f = 1 + Math.sin(t * 14 + seed) * 0.18, g = 1 + Math.sin(t * 11 + seed * 2) * 0.2;
    p.poly([x - r * 0.8, y, x - r * 0.55, y - r * 0.9 * f, x - r * 0.1, y - r * 1.9 * g, x + r * 0.45, y - r * 1.1 * f, x + r * 0.8, y], '#ff8c1a');
    p.poly([x - r * 0.35, y, x - r * 0.05, y - r * 0.9 * g, x + r * 0.3, y], '#ffd23f');
  };
  D.wheel = function (p, x, y, r, ang) {
    p.circle(x, y, r, '#2e2e2e'); p.circle(x, y, r * 0.58, '#c9ced3');
    if (r > 6) { const c = p.ctx; c.save(); c.globalAlpha *= 0.5; for (let k = 0; k < 5; k++) { const a = ang + k * TAU / 5; p.dot(x + Math.cos(a) * r * 0.36, y + Math.sin(a) * r * 0.36, Math.max(0.6, r * 0.06)); } c.restore(); }
    const c = Math.cos(ang) * r * 0.8, s = Math.sin(ang) * r * 0.8;
    p.line(x - c, y - s, x + c, y + s);
    p.line(x + s, y - c, x - s, y + c);
    p.dot(x, y, Math.max(1.2, r * 0.15));
  };
  D.wings = function (p, e, t, x, y, u, kind, flying) {
    const f = flying ? Math.sin(t * (kind === 'fairy' ? 30 : 10)) * 0.5 + 0.5 : 0.15;
    const c = p.ctx;
    p.use(kind === 'bat' ? 'batwing' : kind === 'fairy' ? 'fairywing' : 'wing');
    for (let s = -1; s <= 1; s += 2) {
      c.save(); c.translate(x, y); c.scale(s, 1);
      const sp = 0.6 + f * 0.6;
      if (kind === 'fairy') { p.ellipse(8 * u * sp, -6 * u, 8 * u * sp, 5 * u, true, -0.5); p.ellipse(7 * u * sp, 4 * u, 6 * u * sp, 4 * u, true, 0.4); }
      else if (kind === 'bat') p.poly([2 * u, 0, 12 * u * sp, -12 * u * sp, 24 * u * sp, -6 * u * sp, 20 * u * sp, 2 * u, 14 * u * sp, 0, 10 * u * sp, 4 * u], true);
      else { p.poly([2 * u, 0, 8 * u * sp, -12 * u * sp, 22 * u * sp, -10 * u * sp, 20 * u * sp, -2 * u, 16 * u * sp, 4 * u, 8 * u * sp, 4 * u], true); p.line(8 * u * sp, 4 * u, 12 * u * sp, -6 * u * sp); }
      c.restore();
    }
  };

  // ---------- humanoid ----------
  D.humanoid = function (o) {
    o = Object.assign({
      size: 70, headR: 9, hair: 'none', hat: 'none', beard: 'none', mustache: false, cape: false, wings: 'none',
      halo: false, horns: false, dress: false, item: 'none', shield: false, mask: 'none', glasses: false, antenna: 0,
      boxy: false, ribs: false, wrap: false, fangs: false, tail: 'none', eyes: 2, eyeR: 1.7, fur: false, bowtie: false,
      nose: false, zombie: false, badge: false, tie: false, stethoscope: false, belly: false, emblem: false, bag: false,
      apron: false, bigHead: false, oneEye: false, backpack: false, stripes: false, earsRound: false, hook: false, tusks: false, fishTail: false, hood: false, robe: false, tattered: false
    }, o);
    const u = o.size / 70;
    let w = 30 * u;
    if (o.cape) w = 38 * u;
    if (o.wings !== 'none') w = Math.max(w, 48 * u);
    if (o.fur) w = Math.max(w, 40 * u);
    if (['staff', 'broom', 'pitchfork', 'flag', 'balloon', 'scythe'].includes(o.item)) w = Math.max(w, 44 * u);
    return { kind: 'humanoid', o, w, h: o.size, draw(p, e, t) { D.drawHumanoid(p, e, t, o, u); } };
  };

  // a tapered limb segment with rounded ends (upper arm, shin, ...)
  D.cap = function (p, x0, y0, x1, y1, w0, w1, fill) {
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, nx = -uy, ny = ux, r0 = w0 / 2, r1 = w1 / 2, pts = [];
    for (let k = 0; k <= 4; k++) { const b = k * Math.PI / 4, cb = Math.cos(b), sb = Math.sin(b); pts.push(x0 + nx * r0 * cb - ux * r0 * sb, y0 + ny * r0 * cb - uy * r0 * sb); }   // round back end
    for (let k = 0; k <= 4; k++) { const b = k * Math.PI / 4, cb = Math.cos(b), sb = Math.sin(b); pts.push(x1 - nx * r1 * cb + ux * r1 * sb, y1 - ny * r1 * cb + uy * r1 * sb); }   // round front end
    p.poly(pts, fill === undefined ? true : fill);
  };

  D.drawHumanoid = function (p, e, t, o, u) {
    const c = p.ctx, mood = e.mood, held = e.held, flying = e.flying;
    const inAir = !e.grounded && !flying && !held;
    const walking = e.moving && e.grounded && !flying;
    const ph = e.phase;
    const hr = o.headR * u * (o.bigHead ? 1.35 : 1) * 0.8;
    const hcy = -35 * u + hr;
    const ny = hcy + hr;              // chin
    const sy = ny + 3.2 * u;           // shoulders
    const hy = 8 * u;                  // hips
    const legL = 27 * u, armL = 19 * u;
    let l1, l2;
    if (held) { l1 = Math.sin(t * 9) * 0.25; l2 = -l1; }
    else if (inAir) { l1 = 0.45; l2 = -0.35; }
    else if (flying) { l1 = 0.15; l2 = -0.05 + Math.sin(t * 3) * 0.08; }
    else if (walking) { const a = o.zombie ? 0.3 : 0.55; l1 = Math.sin(ph) * a; l2 = -l1; }
    else { l1 = 0.1; l2 = -0.12; }
    let a1, a2;
    const flail = Math.sin(t * 16) * 0.35;
    if (held) { a1 = 2.5 + flail; a2 = -2.5 - flail; }
    else if (o.zombie) { a1 = 1.5 + Math.sin(t * 2) * 0.05; a2 = 1.3; }
    else if (mood === 'scared') { a1 = 2.5 + flail * 0.5; a2 = -2.5 - flail * 0.5; }
    else if (mood === 'dizzy') { a1 = 1.3; a2 = -1.3; }
    else if (mood === 'angry') { a1 = 1.3; a2 = -0.5; }
    else if (mood === 'happy') { a1 = 2.3; a2 = -2.3; }
    else if (inAir) { a1 = 2.2; a2 = -2.2; }
    else if (flying) { a1 = 2.9; a2 = 0.4; }
    else if (walking) { a1 = -Math.sin(ph) * 0.5; a2 = Math.sin(ph) * 0.5; }
    else { a1 = 0.12; a2 = -0.12; }
    const holding = o.item !== 'none' && !held && mood !== 'scared' && mood !== 'dizzy' && !o.zombie;
    if (holding) {
      a1 = Math.max(a1, 0.95);
      if (['staff', 'cane', 'broom', 'pitchfork', 'shovel', 'balloon', 'flag', 'scythe'].includes(o.item)) a1 = 0.55;
    }
    if (e.lungeT > 0 && !held && !o.zombie) { const pr = 1 - e.lungeT / 0.24; a1 = 2.9 - 2.4 * pr; a2 = -0.5 - 0.6 * pr; }   // attack swing: wind up high, slash down and forward

    // body build
    const furry = o.fur, bony = o.ribs, robot = o.boxy;
    const armW = furry ? 6 * u : bony ? 1.8 * u : robot ? 4 * u : 3.6 * u;
    const legW = furry ? 6.5 * u : bony ? 2 * u : robot ? 4.4 * u : 4.4 * u;
    const shX = 0.4 * u, shY = sy + 1.2 * u;
    const sleeve = furry ? 'fur' : bony ? 'skin' : robot ? 'metal' : o.wrap ? 'skin' : 'cloth';
    const pants = furry ? 'fur' : bony ? 'skin' : robot ? 'metal' : o.wrap ? 'skin' : o.dress || o.robe ? 'skin' : 'pants';
    // arm: upper arm + forearm with the elbow bent back a little, then the hand
    const arm = (ang, front) => {
      const dx = Math.sin(ang), dy = Math.cos(ang), px = Math.cos(ang), py = -Math.sin(ang);
      const bend = (walking || held) ? -1.6 * u : -1 * u;
      const ex = shX + dx * armL * 0.5 + px * bend, ey = shY + dy * armL * 0.5 + py * bend;
      const hx = shX + dx * armL, hy2 = shY + dy * armL;
      const sh = () => { if (!front) p.fill = SB.shade(p.fill, 0.2); };   // the far arm sits in shadow
      p.use(sleeve); sh(); D.cap(p, shX, shY, ex, ey, armW, armW * 0.92);
      p.use(sleeve); sh(); D.cap(p, ex, ey, hx, hy2, armW * 0.9, armW * 0.75);
      if (o.wrap) { c.save(); c.globalAlpha *= 0.6; p.line(ex - 1.5 * u, ey + 2 * u, ex + 1.5 * u, ey + 3 * u); p.line(shX - 1.5 * u, shY + 3 * u, shX + 1.5 * u, shY + 4.5 * u); c.restore(); }
      return [hx, hy2];
    };
    const hand = (x, y, far) => { if (robot) p.use('metal'); else if (furry) p.use('fur'); else p.use('skin'); if (far) p.fill = SB.shade(p.fill, 0.2); p.circle(x, y, (robot ? 2 : furry ? 2.6 : bony ? 1.4 : 1.9) * u, true); };
    // leg: thigh + shin with the knee bent forward, then a shoe
    const leg = (ang, far) => {
      const sh = () => { if (far) p.fill = SB.shade(p.fill, 0.2); };
      const dx = Math.sin(ang), dy = Math.cos(ang), px = Math.cos(ang), py = -Math.sin(ang);
      const bend = walking ? (1.2 + Math.max(0, -ang) * 4) * u : inAir ? 2.5 * u : 0.5 * u;
      const kx = dx * legL * 0.5 + px * bend, ky = hy + 1 * u + dy * legL * 0.5 + py * bend;
      const fx = dx * legL, fy = hy + dy * legL;
      p.use(pants); sh(); D.cap(p, 0, hy + 1 * u, kx, ky, legW, legW * 0.9);
      D.cap(p, kx, ky, fx, fy - 1 * u, legW * 0.88, legW * 0.72);
      if (bony) { p.circle(kx, ky, 1.5 * u, true); }
      if (furry) { p.use('fur'); p.ellipse(fx + 1.5 * u, fy, 3.8 * u, 2 * u, true, 0); }
      else if (robot) { p.use('metal'); p.rect(fx - 2 * u, fy - 1.5 * u, 6.5 * u, 3 * u, true); }
      else if (bony) { p.use('skin'); p.ellipse(fx + 1.5 * u, fy, 3 * u, 1.2 * u, true, 0); }
      else { p.use('shoe'); p.ellipse(fx + 1.6 * u, fy, 3.6 * u, 1.7 * u, true, 0); }
    };
    const hx1 = shX + Math.sin(a1) * armL, hy1 = shY + Math.cos(a1) * armL;

    // ---- behind the body ----
    if (o.cape) {
      const wave = Math.sin(t * 6 + e.seed) * 2 * u + (e.moving ? 4 * u : 0) + (flying ? 12 * u : 0);
      p.use('cape'); p.poly([-1 * u, sy, -12 * u - wave, sy + 14 * u, -9 * u - wave * 0.6, hy + 12 * u, -4 * u, hy + 4 * u], true);
    }
    if (o.hair === 'long') { p.use('hair'); p.poly([-hr - 1.2 * u, hcy - hr * 0.4, -hr - 2.6 * u, sy + 7 * u, -hr * 0.3, sy + 8.5 * u, hr * 0.3, sy + 8.5 * u, hr + 2.6 * u, sy + 7 * u, hr + 1.2 * u, hcy - hr * 0.4, 0, hcy - hr - 1.5 * u], true); }
    if (o.wings !== 'none') D.wings(p, e, t, 0, sy + 2 * u, u * (o.wings === 'fairy' ? 0.8 : 1), o.wings, flying);
    if (o.bag) { p.use('bag'); p.fuzz(-9 * u, sy + 6 * u, 9 * u, 10 * u, true, 7); }
    if (o.backpack) { p.use('cloth2'); p.rect(-10 * u, sy, 7 * u, 15 * u, true); p.line(-10 * u, sy + 5 * u, -3 * u, sy + 5 * u); }
    if (o.tail === 'devil') { p.use('skin'); p.curve(-3 * u, hy, -14 * u, hy + 4 * u, -12 * u, hy - 14 * u); p.poly([-14 * u, hy - 12 * u, -10 * u, hy - 12 * u, -12 * u, hy - 17 * u], true); }
    if (o.tail === 'monkey') { const s = Math.sin(t * 4) * 2 * u; p.curve(-3 * u, hy, -14 * u, hy + 4 * u, -14 * u + s, hy - 12 * u); p.arc(-14 * u + s, hy - 15 * u, 3 * u, 0.5, 5.5); }
    if (o.tail === 'cat') p.curve(-3 * u, hy, -14 * u, hy - 2 * u, -12 * u, hy - 16 * u);
    // back arm, back leg
    const [bx2, by2] = arm(a2, false); hand(bx2, by2, true);
    if (o.shield) { p.use('shield'); p.ellipse(bx2 + 2 * u, by2 - 2 * u, 5.5 * u, 7 * u, true); p.use('gold'); p.line(bx2 + 2 * u, by2 - 7 * u, bx2 + 2 * u, by2 + 3 * u); p.line(bx2 - 2 * u, by2 - 3 * u, bx2 + 6 * u, by2 - 3 * u); }
    if (o.fishTail) { const sw = Math.sin(t * 5 + e.seed) * 3 * u; p.use('tail'); p.poly([-4.4 * u, hy - 2 * u, 4.4 * u, hy - 2 * u, 3.5 * u, hy + 14 * u, 12 * u, hy + 24 * u + sw, 2 * u, hy + 20 * u, -8 * u, hy + 26 * u + sw, -3.5 * u, hy + 14 * u], true); c.save(); c.globalAlpha *= 0.5; for (let k = 0; k < 4; k++) p.arc(0, hy + k * 4 * u, 3 * u, 0.3, Math.PI - 0.3); c.restore(); }
    else leg(l2, true);
    // pelvis / trousers top
    if (!o.fishTail && !bony) { p.use(pants); p.poly([-5 * u, hy - 2.5 * u, 5 * u, hy - 2.5 * u, 5.2 * u, hy + 2.8 * u, -5.2 * u, hy + 2.8 * u], true); }
    if (!o.fishTail) leg(l1);
    // neck
    if (!robot) { p.use(furry ? 'fur' : 'skin'); D.cap(p, 0, ny - 1.5 * u, 0.4 * u, sy + 1 * u, (bony ? 1.6 : 3.4) * u, (bony ? 1.6 : 3.8) * u); }
    // torso
    if (furry) { p.use('fur'); p.fuzz(0, (sy + hy) / 2 + 1 * u, 8.5 * u, (hy - sy) / 2 + 3 * u, true, 12); c.save(); c.globalAlpha *= 0.5; p.use('skin'); p.ellipse(1.5 * u, (sy + hy) / 2 + 2 * u, 4.5 * u, (hy - sy) / 2 - 1 * u, true, 0); c.restore(); }
    else if (robot) { p.use('metal'); p.rect(-5.5 * u, sy - 1 * u, 11 * u, hy - sy + 3.5 * u, true); p.rect(-3 * u, sy + 3 * u, 6 * u, 5 * u, true); p.dot(-1.2 * u, sy + 5.5 * u, 0.9 * u); p.dot(1.4 * u, sy + 5.5 * u, 0.9 * u); p.line(-5.5 * u, hy - 3 * u, 5.5 * u, hy - 3 * u); }
    else if (bony) {
      p.use('skin');
      p.line(0, sy, 0, hy + 1 * u);
      for (let k = 0; k < 4; k++) { const y = sy + 2 * u + k * 3 * u; p.curve(-0.2 * u, y, 4.5 * u, y + 0.5 * u, 3 * u, y + 2.2 * u); p.curve(-0.2 * u, y, -4 * u, y + 0.5 * u, -3 * u, y + 2.2 * u); }
      p.poly([-3.6 * u, hy - 1 * u, 3.6 * u, hy - 1 * u, 2.6 * u, hy + 2.6 * u, -2.6 * u, hy + 2.6 * u], true);
    } else {
      const bw = o.belly ? 1.35 : 1;
      p.use('cloth');
      const torso = [-5.2 * u, sy - 0.4 * u, 4.8 * u, sy + 0.1 * u, 5.8 * u * bw, sy + 4.5 * u, 5.2 * u * bw, hy - 3.5 * u, 5.2 * u, hy + 1.6 * u, -5.2 * u, hy + 1.6 * u, -5.2 * u, hy - 5 * u, -5.8 * u, sy + 3 * u];
      p.poly(torso, true);
      if (o.zombie) { c.save(); c.globalAlpha *= 0.7; p.zigzag(-4.6 * u, hy + 1.2 * u, 4.6 * u, hy + 1.2 * u, -1.8 * u, 7); p.line(1 * u, sy + 6 * u, 2.6 * u, sy + 9 * u); c.restore(); }
      else { c.save(); c.globalAlpha *= 0.35; p.curve(-1 * u, sy + 1 * u, 1 * u, sy + 3 * u, 3 * u, sy + 1 * u); p.line(-3.5 * u, hy - 1.5 * u, 4 * u, hy - 1.5 * u); c.restore(); }
      if (o.wrap) { c.save(); c.globalAlpha *= 0.6; for (let k = 0; k < 5; k++) { const y = sy + 1 * u + k * 3.2 * u; p.line(-4.4 * u, y - 0.8 * u, 4.4 * u, y + 0.8 * u); } c.restore(); }
    }
    if (o.dress) { p.use('cloth'); p.poly([-4.4 * u, hy - 4 * u, 4.4 * u, hy - 4 * u, 11 * u, hy + 13 * u, -11 * u, hy + 13 * u], true); c.save(); c.globalAlpha *= 0.4; p.line(-2 * u, hy - 2 * u, -5 * u, hy + 12 * u); p.line(2 * u, hy - 2 * u, 5 * u, hy + 12 * u); c.restore(); }
    if (o.tie) { p.use('cloth2'); p.poly([0, sy - 0.5 * u, -1.6 * u, sy + 2 * u, 0, sy + 10 * u, 1.6 * u, sy + 2 * u], true); }
    if (o.bowtie) { p.use('cloth2'); p.poly([0, sy + 0.5 * u, -4 * u, sy - 1.5 * u, -4 * u, sy + 2.5 * u], true); p.poly([0, sy + 0.5 * u, 4 * u, sy - 1.5 * u, 4 * u, sy + 2.5 * u], true); }
    if (o.badge) { p.use('gold'); p.star(2.6 * u, sy + 4 * u, 2 * u, true); }
    if (o.emblem) { p.use('gold'); p.star(0.5 * u, sy + 5 * u, 3 * u, true); }
    if (o.stethoscope) { p.use('metal'); p.curve(-2.5 * u, sy - 0.5 * u, -4 * u, sy + 7 * u, 0.5 * u, sy + 9 * u); p.circle(0.5 * u, sy + 10 * u, 1.6 * u, true); }
    if (o.apron) { p.use('apron'); p.poly([-3.6 * u, sy + 3 * u, 3.8 * u, sy + 3 * u, 4.8 * u, hy + 6 * u, -4.4 * u, hy + 6 * u], true); }
    if (o.stripes) { c.save(); c.lineWidth *= 1.6; for (let k = 0; k < 4; k++) { const y = sy + 2 * u + k * 3.3 * u; p.line(-4.4 * u, y, 4.4 * u, y); } c.restore(); }
    if (o.belly && !furry) { c.save(); c.globalAlpha *= 0.4; p.arc(1.5 * u, (sy + hy) / 2 + 1 * u, 4 * u, -1.2, 1.2); c.restore(); }
    if (o.robe) {
      p.use('cloth');
      const pts = [-4.6 * u, sy + 1 * u, 4.4 * u, sy + 1 * u, 13 * u, 35 * u];
      if (o.tattered) { for (let k = 1; k < 6; k++) pts.push(13 * u - k * 4.3 * u, (k % 2) ? 29 * u : 35 * u); }
      pts.push(-13 * u, 35 * u);
      p.poly(pts, true);
      c.save(); c.globalAlpha *= 0.45; p.line(-2 * u, sy + 10 * u, -6 * u, 33 * u); p.line(3 * u, sy + 12 * u, 6 * u, 33 * u); c.restore();
    }
    // front arm, item, hand
    const [fx1, fy1] = arm(a1, true);
    if (holding) D.handItem(p, e, t, o.item, fx1, fy1, u);
    if (o.hook) { p.use('metal'); c.save(); c.lineWidth *= 1.4; p.arc(fx1, fy1 + 2.2 * u, 2.4 * u, -1.2, 3.5); c.restore(); }
    else hand(fx1, fy1);
    // ---- head ----
    if (o.halo) { c.save(); c.strokeStyle = '#d4a017'; c.lineWidth *= 1.5; p.ellipse(0, hcy - hr - 5 * u, 7 * u, 2 * u); c.restore(); }
    if (o.beard === 'long') { p.use('hair'); p.fuzz(0, hcy + hr + 4 * u, hr * 0.9, hr * 1.1, true, 8); }
    if (o.earsRound) { p.use(furry ? 'fur' : 'skin'); p.circle(-hr * 0.95, hcy - hr * 0.55, 3 * u, true); p.circle(hr * 0.95, hcy - hr * 0.55, 3 * u, true); }
    if (o.hood) p.poly([-hr - 4 * u, hcy + hr + 4 * u, -hr - 3 * u, hcy - hr * 0.5, -hr * 0.45, hcy - hr - 5 * u, hr * 0.45, hcy - hr - 5 * u, hr + 3 * u, hcy - hr * 0.5, hr + 4 * u, hcy + hr + 4 * u], '#1a1a1a');
    if (robot) { p.use('metal'); p.rect(-hr, hcy - hr, hr * 2, hr * 2, true); }
    else {
      // ears, then a head that is a little taller than wide with a defined jaw
      const sk = furry ? 'fur' : 'skin';
      if (!o.earsRound && !o.hood && !bony) { p.use(sk); p.ellipse(-hr * 0.98, hcy + hr * 0.05, hr * 0.2, hr * 0.3, true, 0); p.ellipse(hr * 0.98, hcy + hr * 0.05, hr * 0.2, hr * 0.3, true, 0); }
      p.use(sk);
      const k = o.hood ? 0.82 : 1, R = hr * k;
      const head = []; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; const jaw = Math.sin(a) > 0 ? 1 - 0.12 * Math.sin(a) * Math.abs(Math.cos(a)) * 2 : 1; head.push(Math.cos(a) * R * 0.94 * jaw, hcy + Math.sin(a) * R * (Math.sin(a) > 0 ? 1.06 : 1)); }
      p.poly(head, true);
      if (!bony && !o.zombie && !o.nose) { c.save(); c.globalAlpha *= 0.4; c.lineWidth *= 0.8; c.beginPath(); c.moveTo(hr * 0.08, hcy + hr * 0.08); c.quadraticCurveTo(hr * 0.2, hcy + hr * 0.3, hr * 0.02, hcy + hr * 0.32); c.stroke(); c.restore(); }
      if (o.zombie) { c.save(); c.globalAlpha *= 0.5; p.line(-hr * 0.5, hcy - hr * 0.6, -hr * 0.2, hcy - hr * 0.4); p.line(hr * 0.2, hcy + hr * 0.2, hr * 0.5, hcy + hr * 0.35); c.restore(); }
    }
    if (o.beard === 'short') { p.use('hair'); p.poly([-hr * 0.92, hcy + hr * 0.05, -hr * 0.75, hcy + hr * 0.75, 0, hcy + hr * 1.12, hr * 0.75, hcy + hr * 0.75, hr * 0.92, hcy + hr * 0.05, hr * 0.5, hcy + hr * 0.62, -hr * 0.5, hcy + hr * 0.62], true); }
    D.hair(p, e, t, o.hair, hcy, hr, u);
    D.face(p, e, t, o, hcy, hr, u);
    D.hat(p, e, t, o.hat, hcy, hr, u);
    if (o.horns) { p.use('horn'); p.poly([-hr * 0.55, hcy - hr * 0.75, -hr * 1.3, hcy - hr * 1.5, -hr * 0.9, hcy - hr * 2.15, -hr * 0.95, hcy - hr * 1.45, -hr * 0.3, hcy - hr * 0.9], true); p.poly([hr * 0.55, hcy - hr * 0.75, hr * 1.3, hcy - hr * 1.5, hr * 0.9, hcy - hr * 2.15, hr * 0.95, hcy - hr * 1.45, hr * 0.3, hcy - hr * 0.9], true); }
    if (o.antenna) for (let k = 0; k < o.antenna; k++) { const x = o.antenna === 1 ? 0 : (k ? 4 * u : -4 * u); p.line(x, hcy - hr, x * 1.6, hcy - hr - 8 * u); p.use('metal'); p.circle(x * 1.6, hcy - hr - 9.5 * u, 1.6 * u, true); }
  };

  D.face = function (p, e, t, o, hcy, hr, u) {
    const ey = hcy - hr * 0.12, ex = hr * 0.4, er = Math.min(o.eyeR * u, hr * 0.19) * (o.eyeR > 2.5 ? 1.5 : 1);
    if (o.mask === 'hero') p.rect(-hr * 0.9, ey - er * 1.7, hr * 1.8, er * 3.4, '#000');
    if (o.mask === 'ninja') { p.rect(-hr * 0.95, hcy + hr * 0.15, hr * 1.9, hr * 0.8, '#000'); p.line(-hr, hcy - hr * 0.55, hr, hcy - hr * 0.55); }
    if (o.oneEye) D.eye(p, 0, ey, er * 1.9, e, 0);
    else if (o.eyes === 'sockets') { p.dot(-ex, ey, er * 1.3); p.dot(ex, ey, er * 1.3); }
    else if (o.mask === 'eyepatch') { p.dot(-ex, ey, er * 1.5); p.line(-hr, ey - er * 1.8, ex - er, ey - er * 0.8); D.eye(p, ex, ey, er, e, 1); }
    else { D.eye(p, -ex, ey, er, e, -1); D.eye(p, ex, ey, er, e, 1); }
    if (o.glasses) { p.circle(-ex, ey, er * 1.9); p.circle(ex, ey, er * 1.9); p.line(-ex + er * 1.9, ey, ex - er * 1.9, ey); }
    if (o.nose) { p.use('nose'); p.circle(0, hcy + hr * 0.2, 2.2 * u, true); p.use('skin'); }
    if (o.mustache) { p.curve(0, hcy + hr * 0.35, -3 * u, hcy + hr * 0.15, -5.5 * u, hcy + hr * 0.45); p.curve(0, hcy + hr * 0.35, 3 * u, hcy + hr * 0.15, 5.5 * u, hcy + hr * 0.45); }
    if (o.mask !== 'ninja') {
      const my = hcy + hr * 0.5;
      if (o.eyes === 'sockets') p.zigzag(-hr * 0.5, my, hr * 0.5, my, 2 * u, 6);
      else if (o.boxy) p.zigzag(-hr * 0.5, my, hr * 0.5, my, 2.5 * u, 5);
      else D.mouth(p, 0, my, hr * 0.9, e);
      p.use('teeth');
      if (o.fangs) { p.poly([-2.5 * u, my, -0.5 * u, my, -1.5 * u, my + 3.5 * u], true); p.poly([0.5 * u, my, 2.5 * u, my, 1.5 * u, my + 3.5 * u], true); }
      if (o.tusks) { p.poly([-3.5 * u, my + 1 * u, -1.5 * u, my + 1 * u, -2.5 * u, my - 3.5 * u], true); p.poly([1.5 * u, my + 1 * u, 3.5 * u, my + 1 * u, 2.5 * u, my - 3.5 * u], true); }
    }
  };

  D.hair = function (p, e, t, kind, hcy, hr, u) {
    if (kind === 'none' || kind === 'bald') return;
    p.use('hair');
    // a filled cap of hair over the top of the head with a fringe of bangs
    const cap = (fringe) => {
      const pts = [];
      for (let i = 0; i <= 12; i++) { const a = Math.PI + 0.12 - 0.24 * (i / 12) + i / 12 * Math.PI; pts.push(Math.cos(a) * (hr + 1.3 * u), hcy + Math.sin(a) * (hr + 1.5 * u)); }
      const n = 6; for (let i = 0; i <= n; i++) { const x = hr * 0.98 - i * (hr * 1.96 / n); pts.push(x, hcy - hr * 0.42 + ((i % 2) ? fringe : 0)); }
      p.poly(pts, true);
    };
    switch (kind) {
      case 'short': cap(1.6 * u); break;
      case 'long': cap(1.2 * u); break;
      case 'spiky': { const pts = []; const n = 9; for (let i = 0; i <= n; i++) { const a = Math.PI + 0.15 + (Math.PI - 0.3) * i / n; const rr = (i % 2) ? hr + 6 * u : hr + 0.8 * u; pts.push(Math.cos(a) * rr, hcy + Math.sin(a) * rr); } pts.push(hr * 0.9, hcy - hr * 0.35, -hr * 0.9, hcy - hr * 0.35); p.poly(pts, true); break; }
      case 'ponytail': cap(1.2 * u); p.curve(-hr, hcy - hr * 0.3, -hr - 6 * u, hcy + 2 * u, -hr - 3 * u + Math.sin(t * 5) * u, hcy + hr + 6 * u); p.ellipse(-hr - 4 * u + Math.sin(t * 5) * u, hcy + hr * 0.6, 2.6 * u, 6 * u, true, 0.2); break;
      case 'curly': cap(0.8 * u); for (let k = -3; k <= 3; k++) { const a = -Math.PI / 2 + k * 0.42; p.circle(Math.cos(a) * (hr + 0.5 * u), hcy + Math.sin(a) * (hr + 0.5 * u), 3 * u, true); } break;
      case 'bun': cap(1 * u); p.circle(-hr * 0.4, hcy - hr - 2.5 * u, 3.6 * u, true); break;
      case 'mohawk': { const pts = []; for (let i = 0; i <= 8; i++) { const x = -hr * 0.6 + hr * 1.2 * i / 8; pts.push(x, hcy - hr - ((i % 2) ? 9 * u : 1 * u)); } pts.push(hr * 0.6, hcy - hr + 2 * u, -hr * 0.6, hcy - hr + 2 * u); p.poly(pts, true); break; }
      case 'tuft': p.poly([-1.5 * u, hcy - hr + 0.5 * u, 2 * u, hcy - hr - 5 * u, 1 * u, hcy - hr + 0.5 * u, -2.5 * u, hcy - hr - 4 * u], true); break;
      case 'pigtails': cap(1.2 * u); p.ellipse(-hr - 3 * u, hcy + hr * 0.3, 2.6 * u, 6 * u, true, 0.5); p.ellipse(hr + 3 * u, hcy + hr * 0.3, 2.6 * u, 6 * u, true, -0.5); break;
    }
  };

  D.hat = function (p, e, t, kind, hcy, hr, u) {
    const top = hcy - hr;
    if (kind === 'none') return;
    p.use('hat'); p.stroke(SB.shade(p.fill, 0.5));
    switch (kind) {
      case 'cap': p.arc(0, hcy, hr + 1.5 * u, Math.PI + 0.15, TAU - 0.15); p.line(hr * 0.6, hcy - hr * 0.6, hr + 7 * u, hcy - hr * 0.55); break;
      case 'top': p.rect(-7 * u, top - 12 * u, 14 * u, 12.5 * u, true); p.line(-10 * u, top + 0.5 * u, 10 * u, top + 0.5 * u); break;
      case 'crown': p.poly([-7 * u, top + 1.5 * u, -7 * u, top - 7 * u, -3.5 * u, top - 2 * u, 0, top - 8 * u, 3.5 * u, top - 2 * u, 7 * u, top - 7 * u, 7 * u, top + 1.5 * u], true); p.dot(0, top - 4 * u, 1 * u); break;
      case 'tiara': p.poly([-5 * u, top + 1 * u, -4 * u, top - 3 * u, 0, top - 6 * u, 4 * u, top - 3 * u, 5 * u, top + 1 * u], true); break;
      case 'wizard': p.poly([-12 * u, top + 2 * u, 12 * u, top + 2 * u, 2 * u, top - 22 * u], true); p.ellipse(0, top + 2 * u, 13 * u, 3 * u, true); p.star(0, top - 6 * u, 2.5 * u); break;
      case 'witch': p.poly([-12 * u, top + 2 * u, 12 * u, top + 2 * u, 4 * u, top - 12 * u, -6 * u, top - 22 * u, 2 * u, top - 14 * u], true); p.ellipse(0, top + 2 * u, 13 * u, 3 * u, true); break;
      case 'helmet': p.arc(0, hcy, hr + 2.5 * u, Math.PI, TAU); p.line(-hr - 2.5 * u, hcy, -hr - 2.5 * u, hcy + 5 * u); p.line(hr + 2.5 * u, hcy, hr + 2.5 * u, hcy + 5 * u); p.line(hr * 0.3, hcy - 1 * u, hr + 2.5 * u, hcy - 1 * u); p.line(hr * 0.3, hcy + 2 * u, hr + 2.5 * u, hcy + 2 * u); p.curve(0, top - 2 * u, -6 * u, top - 12 * u, -14 * u, top - 6 * u); break;
      case 'hardhat': p.use('gold'); p.stroke(SB.shade(p.fill, 0.5)); p.arc(0, hcy - 1 * u, hr + 2 * u, Math.PI + 0.1, TAU - 0.1); p.line(-hr - 5 * u, hcy - hr * 0.45, hr + 5 * u, hcy - hr * 0.45); break;
      case 'police': p.poly([-hr, top + 2 * u, -hr + 1 * u, top - 4 * u, hr, top - 5 * u, hr, top + 2 * u], true); p.line(hr * 0.5, top + 2 * u, hr + 6 * u, top + 2.5 * u); p.dot(0, top - 1 * u, 1.3 * u); break;
      case 'chef': p.use('paper'); p.stroke('#888'); p.circle(-5 * u, top - 8 * u, 4.5 * u, true); p.circle(5 * u, top - 8 * u, 4.5 * u, true); p.circle(0, top - 11 * u, 5 * u, true); p.rect(-7 * u, top - 4 * u, 14 * u, 5 * u, true); break;
      case 'cowboy': p.arc(0, hcy - 2 * u, hr * 0.8, Math.PI, TAU); p.curve(-hr - 7 * u, top + 1 * u, 0, top + 6 * u, hr + 7 * u, top + 1 * u); p.line(-hr * 0.8, top + 3 * u, hr * 0.8, top + 3 * u); break;
      case 'pirate': p.poly([-13 * u, top + 3 * u, -9 * u, top - 8 * u, 0, top - 5 * u, 9 * u, top - 8 * u, 13 * u, top + 3 * u], true); p.dot(0, top - 1.5 * u, 1.5 * u); break;
      case 'bandana': p.line(-hr, hcy - hr * 0.5, hr, hcy - hr * 0.5); p.line(-hr, hcy - hr * 0.5, -hr - 7 * u, hcy - hr * 0.2 + Math.sin(t * 7) * u); p.line(-hr, hcy - hr * 0.5, -hr - 6 * u, hcy + Math.sin(t * 7 + 1) * u); break;
      case 'astronaut': p.circle(0, hcy, hr + 5 * u); p.arc(0, hcy, hr + 3 * u, Math.PI * 1.15, Math.PI * 1.35); break;
      case 'santa': p.poly([-hr, top + 3 * u, hr, top + 3 * u, 6 * u, top - 8 * u, -10 * u, top - 14 * u], true); p.circle(-11 * u, top - 15 * u, 3 * u, '#fff'); p.rect(-hr - 1 * u, top + 1 * u, hr * 2 + 2 * u, 4 * u, '#fff'); break;
      case 'party': p.poly([-5 * u, top + 1 * u, 5 * u, top + 1 * u, 0, top - 14 * u], true); p.dot(0, top - 6 * u, 1 * u); p.dot(-1.5 * u, top - 2 * u, 1 * u); break;
      case 'viking': p.arc(0, hcy, hr + 2 * u, Math.PI, TAU); p.curve(-hr - 1 * u, hcy - 2 * u, -hr - 8 * u, hcy - 6 * u, -hr - 5 * u, hcy - 14 * u); p.curve(hr + 1 * u, hcy - 2 * u, hr + 8 * u, hcy - 6 * u, hr + 5 * u, hcy - 14 * u); break;
      case 'bow': p.poly([-hr * 0.7, top + 2 * u, -hr * 0.7 - 6 * u, top - 2 * u, -hr * 0.7 - 6 * u, top + 6 * u], true); p.poly([-hr * 0.7, top + 2 * u, -hr * 0.7 + 4 * u, top - 3 * u, -hr * 0.7 + 5 * u, top + 3 * u], true); break;
      case 'fire': p.curve(-hr - 6 * u, top + 4 * u, 0, top - 1 * u, hr + 6 * u, top + 4 * u); p.arc(0, hcy - 1 * u, hr * 0.9, Math.PI, TAU); p.rect(-2 * u, top - 3 * u, 4 * u, 4 * u, true); break;
      case 'beanie': p.arc(0, hcy, hr + 2 * u, Math.PI + 0.2, TAU - 0.2); p.line(-hr, hcy - hr * 0.4, hr, hcy - hr * 0.4); p.circle(0, top - 3 * u, 2.5 * u, true); break;
      case 'flower': for (let k = 0; k < 5; k++) { const a = k * TAU / 5; p.circle(hr * 0.8 + Math.cos(a) * 3.2 * u, hcy - hr * 0.8 + Math.sin(a) * 3.2 * u, 1.6 * u, true); } p.dot(hr * 0.8, hcy - hr * 0.8, 1.3 * u); break;
      case 'grad': p.poly([-hr - 3 * u, top + 1 * u, 0, top - 4 * u, hr + 3 * u, top + 1 * u, 0, top + 5 * u], true); p.line(hr + 3 * u, top + 1 * u, hr + 4 * u, top + 8 * u); break;
      case 'bunny': p.ellipse(-4 * u, top - 8 * u, 2.5 * u, 9 * u, true, -0.15); p.ellipse(4 * u, top - 8 * u, 2.5 * u, 9 * u, true, 0.15); break;
      case 'headphones': p.arc(0, hcy, hr + 2 * u, Math.PI + 0.1, TAU - 0.1); p.circle(-hr - 1 * u, hcy, 2.5 * u, true); p.circle(hr + 1 * u, hcy, 2.5 * u, true); break;
      case 'mailman': p.arc(0, hcy, hr + 1.5 * u, Math.PI + 0.15, TAU - 0.15); p.line(hr * 0.6, hcy - hr * 0.6, hr + 6 * u, hcy - hr * 0.55); break;
    }
    p.stroke();
  };

  D.handItem = function (p, e, t, kind, hx, hy, u) {
    const dx = 0.72, dy = -0.69;
    p.use('item');
    switch (kind) {
      case 'sword': { const L = 24 * u; p.use('metal'); p.poly([hx + dy * 1.5 * u, hy - dx * 1.5 * u, hx + dx * L, hy + dy * L - 1, hx + dx * (L + 4 * u), hy + dy * (L + 4 * u), hx - dy * 1.5 * u, hy + dx * 1.5 * u], true); p.line(hx + dy * 4 * u, hy - dx * 4 * u, hx - dy * 4 * u, hy + dx * 4 * u); p.line(hx, hy, hx - dx * 5 * u, hy - dy * 5 * u); break; }
      case 'lightsaber': { const L = 26 * u; p.line(hx, hy, hx - dx * 5 * u, hy - dy * 5 * u); p.use('saber'); p.poly([hx + dy * 2 * u, hy - dx * 2 * u, hx + dx * L + dy * 2 * u, hy + dy * L - dx * 2 * u, hx + dx * L - dy * 2 * u, hy + dy * L + dx * 2 * u, hx - dy * 2 * u, hy + dx * 2 * u], true); break; }
      case 'wand': p.line(hx, hy, hx + 8 * u, hy - 8 * u); p.use('gold'); p.star(hx + 10 * u, hy - 10 * u, 3 * u, true); break;
      case 'staff': p.line(hx, hy + 18 * u, hx, hy - 30 * u); p.use('gem'); p.circle(hx, hy - 33 * u, 3.5 * u, true); break;
      case 'cane': p.line(hx, hy, hx, hy + 26 * u); p.arc(hx + 3 * u, hy, 3 * u, Math.PI, TAU); break;
      case 'hammer': p.line(hx, hy, hx + 8 * u, hy - 14 * u); p.use('metal'); p.poly([hx + 3 * u, hy - 20 * u, hx + 15 * u, hy - 16 * u, hx + 13 * u, hy - 10 * u, hx + 1 * u, hy - 14 * u], true); break;
      case 'axe': p.line(hx, hy, hx + 8 * u, hy - 16 * u); p.use('metal'); p.poly([hx + 6 * u, hy - 18 * u, hx + 15 * u, hy - 23 * u, hx + 13 * u, hy - 11 * u], true); break;
      case 'broom': p.line(hx - 6 * u, hy + 20 * u, hx + 12 * u, hy - 22 * u); p.use('straw'); p.poly([hx - 4 * u, hy + 15 * u, hx - 13 * u, hy + 27 * u, hx - 3 * u, hy + 32 * u, hx + 3 * u, hy + 20 * u], true); break;
      case 'club': p.line(hx, hy, hx + 8 * u, hy - 14 * u); p.use('wood'); p.ellipse(hx + 11 * u, hy - 19 * u, 5 * u, 8 * u, true, 0.5); break;
      case 'pitchfork': p.line(hx, hy + 18 * u, hx, hy - 26 * u); p.line(hx - 4 * u, hy - 22 * u, hx + 4 * u, hy - 22 * u); p.line(hx - 4 * u, hy - 22 * u, hx - 4 * u, hy - 30 * u); p.line(hx, hy - 26 * u, hx, hy - 31 * u); p.line(hx + 4 * u, hy - 22 * u, hx + 4 * u, hy - 30 * u); break;
      case 'shovel': p.line(hx, hy - 8 * u, hx, hy + 22 * u); p.use('metal'); p.poly([hx - 4 * u, hy + 22 * u, hx + 4 * u, hy + 22 * u, hx + 3 * u, hy + 30 * u, hx - 3 * u, hy + 30 * u], true); break;
      case 'guitar': p.line(hx - 4 * u, hy, hx + 14 * u, hy - 10 * u); p.use('wood'); p.ellipse(hx - 6 * u, hy + 2 * u, 6 * u, 5 * u, true); p.circle(hx - 6 * u, hy + 2 * u, 1.5 * u); break;
      case 'balloon': p.line(hx, hy, hx + 4 * u, hy - 30 * u); p.use('balloon'); p.ellipse(hx + 4 * u, hy - 38 * u, 7 * u, 8.5 * u, true); break;
      case 'football': p.use('leather'); p.ellipse(hx + 2 * u, hy, 5.5 * u, 3.5 * u, true, -0.4); p.line(hx, hy, hx + 4 * u, hy); break;
      case 'basketball': p.use('orange'); p.circle(hx + 3 * u, hy, 5 * u, true); p.line(hx - 2 * u, hy, hx + 8 * u, hy); p.line(hx + 3 * u, hy - 5 * u, hx + 3 * u, hy + 5 * u); break;
      case 'flag': p.line(hx, hy + 14 * u, hx, hy - 28 * u); p.use('cloth2'); p.poly([hx, hy - 28 * u, hx + 16 * u + Math.sin(t * 6) * 2 * u, hy - 22 * u, hx, hy - 16 * u], true); break;
      case 'magnifier': p.line(hx, hy, hx + 6 * u, hy - 6 * u); p.use('window'); p.circle(hx + 10 * u, hy - 10 * u, 5 * u, true); break;
      case 'bat': p.line(hx, hy, hx + 10 * u, hy - 18 * u); p.line(hx + 2.5 * u, hy + 1 * u, hx + 12.5 * u, hy - 17 * u); p.line(hx + 10 * u, hy - 18 * u, hx + 12.5 * u, hy - 17 * u); break;
      case 'torch': p.line(hx, hy, hx + 3 * u, hy - 12 * u); D.flame(p, hx + 3 * u, hy - 14 * u, 5 * u, t, e.seed); break;
      case 'book': p.use('book'); p.rect(hx - 4 * u, hy - 6 * u, 8 * u, 6 * u, true); p.line(hx, hy - 6 * u, hx, hy); break;
      case 'letter': p.use('paper'); p.rect(hx - 1 * u, hy - 5 * u, 8 * u, 6 * u, true); p.line(hx - 1 * u, hy - 5 * u, hx + 3 * u, hy - 1 * u); p.line(hx + 7 * u, hy - 5 * u, hx + 3 * u, hy - 1 * u); break;
      case 'trident': p.line(hx, hy + 18 * u, hx, hy - 26 * u); p.arc(hx, hy - 24 * u, 4 * u, Math.PI, TAU); p.line(hx - 4 * u, hy - 24 * u, hx - 4 * u, hy - 30 * u); p.line(hx, hy - 26 * u, hx, hy - 32 * u); p.line(hx + 4 * u, hy - 24 * u, hx + 4 * u, hy - 30 * u); break;
      case 'racket': p.line(hx, hy, hx + 6 * u, hy - 8 * u); p.use('window'); p.ellipse(hx + 10 * u, hy - 14 * u, 5 * u, 7 * u, true, -0.6); p.line(hx + 7 * u, hy - 18 * u, hx + 13 * u, hy - 10 * u); break;
      case 'lollipop': p.line(hx, hy, hx + 4 * u, hy - 10 * u); p.use('candy'); p.circle(hx + 5 * u, hy - 14 * u, 4 * u, true); p.spiral(hx + 5 * u, hy - 14 * u, 3 * u, 1.5, 0); break;
      case 'brush': p.line(hx, hy, hx + 8 * u, hy - 12 * u); p.use('cloth2'); p.poly([hx + 7 * u, hy - 14 * u, hx + 11 * u, hy - 12 * u, hx + 12 * u, hy - 18 * u], true); break;
      case 'mic': p.line(hx, hy, hx + 6 * u, hy - 8 * u); p.circle(hx + 8 * u, hy - 11 * u, 3.5 * u, '#000'); break;
      case 'stick': p.line(hx, hy, hx + 12 * u, hy - 12 * u); break;
      case 'scythe': p.line(hx - 1 * u, hy + 24 * u, hx + 3 * u, hy - 36 * u); p.curve(hx + 3 * u, hy - 36 * u, hx + 16 * u, hy - 42 * u, hx + 26 * u, hy - 30 * u); p.curve(hx + 3 * u, hy - 36 * u, hx + 14 * u, hy - 36 * u, hx + 26 * u, hy - 30 * u); p.line(hx, hy + 8 * u, hx + 6 * u, hy + 6 * u); break;
      case 'bolt': p.use('gold'); p.poly([hx + 3 * u, hy - 14 * u, hx + 8 * u, hy - 14 * u, hx + 4 * u, hy - 6 * u, hx + 9 * u, hy - 6 * u, hx - 1 * u, hy + 6 * u, hx + 2 * u, hy - 3 * u, hx - 2 * u, hy - 3 * u], true); break;
    }
  };

  // ---------- quadruped ----------
  D.quad = function (o) {
    o = Object.assign({
      bodyW: 36, bodyH: 16, legLen: 16, legSpread: 0.33, neckLen: 7, neckAng: 0.8, headR: 7, head: 'round',
      ears: 'point', earSize: 1, tail: 'up', tailLen: 12, snout: true, snoutSize: 1, mane: false, hairMane: false,
      trunk: false, horns: 'none', spots: 0, stripes: 0, hump: 0, shell: false, wool: false, tusks: false,
      whiskers: false, spikes: false, wings: false, udder: false, beard: false, tuftTail: false, thickLegs: false,
      teeth: false, eyeR: 1.5, wag: false, mask: false, patches: false, thickNeck: false, collar: false,
      nostrils: false, bodyRot: 0, hedgehog: false, shellPattern: false, saddle: false, spotsDark: false
    }, o);
    const cosN = Math.cos(o.neckAng), sinN = Math.sin(o.neckAng);
    const neckX = o.bodyW / 2 - 3, neckY = -o.bodyH / 2 + 3;
    const headRx = o.head === 'long' ? o.headR * 1.35 : o.head === 'croc' ? o.headR * 2.4 : o.headR;
    const hx = neckX + cosN * (o.neckLen + o.headR * 0.7), hy = neckY - sinN * (o.neckLen + o.headR * 0.7);
    const feetY = o.bodyH / 2 + o.legLen;
    const topY = Math.min(
      hy - o.headR - (o.ears !== 'none' ? 7 * o.earSize : 0) - (o.horns !== 'none' ? 9 : 0) - (o.mane ? 7 : 0),
      -o.bodyH / 2 - (o.hump ? 8 : 0) - (o.wings ? 20 : 0) - (o.spikes ? 6 : 0) - (o.shell ? 7 : 0) - (o.hedgehog ? 5 : 0),
      o.tail === 'up' ? -o.bodyH / 2 - o.tailLen * 0.7 : 0);
    const right = hx + headRx + (o.snout ? 4 * o.snoutSize : 0) + (o.trunk ? 5 : 0) + (o.horns === 'unicorn' ? 8 : 0) + (o.horns === 'rhino' ? 5 : 0);
    const left = -o.bodyW / 2 - ((['long', 'fan', 'thick', 'bushy', 'thin'].includes(o.tail)) ? o.tailLen * 0.7 : 5);
    const w = right - left, h = feetY - topY;
    const ox = -(right + left) / 2, oy = -(feetY + topY) / 2;
    const g = { hx, hy, headRx, neckX, neckY, cosN, sinN };
    return { kind: 'quad', o, g, ox, oy, w, h, draw(p, e, t) { p.ctx.translate(ox, oy); D.drawQuad(p, e, t, o, g); } };
  };

  D.drawQuad = function (p, e, t, o, g) {
    p.use('body');
    const c = p.ctx, mood = e.mood, held = e.held, flying = e.flying;
    const inAir = !e.grounded && !held && !flying;
    const walking = e.moving && e.grounded && !flying;
    const ph = e.phase;
    const bw = o.bodyW, bh = o.bodyH, hr = o.headR;
    const base = p.fill;
    const sw = walking ? Math.sin(ph) * 0.5 : held ? Math.sin(t * 10) * 0.3 : inAir ? 0.5 : flying ? 0.35 : 0;
    const lx1 = bw * o.legSpread, lx2 = -bw * o.legSpread;
    const ly = bh / 2 - 2;
    const hoofed = o.head === 'long' || ['cow', 'goat', 'antlers', 'ossicone'].includes(o.horns) || o.hump > 0 || o.saddle;
    const big = o.thickLegs, croc = o.head === 'croc', shelly = o.shell;
    const lw = Math.max(2.6, Math.min(bh * 0.3, o.legLen * 0.38)) * (big ? 1.55 : 1);
    const light = (k) => SB.mixColor(base, '#fff', k), dark = (k) => SB.shade(base, k);
    // leg: upper and lower segments with a joint; hind legs bend backward at the hock
    const leg = (x, a, far, hind) => {
      const L = o.legLen + 4, off = far ? 2.5 : 0, hx = x + off, hy0 = ly - 2;
      const dx = Math.sin(a), dy = Math.cos(a), px = Math.cos(a), py = -Math.sin(a);
      const bend = croc || shelly ? L * 0.15 : hind ? -L * 0.13 : L * 0.05;
      const kx = hx + dx * L * 0.5 + px * bend, ky = hy0 + dy * L * 0.5 + py * bend;
      const fx = hx + dx * L, fy = hy0 + dy * L;
      p.fill = far ? dark(0.22) : base;
      D.cap(p, hx, hy0, kx, ky, lw * (hind ? 1.3 : 1.08), lw * 0.82);
      D.cap(p, kx, ky, fx, fy - 1.5, lw * 0.78, lw * 0.6);
      if (hoofed) { p.use('hoof'); p.poly([fx - lw * 0.42, fy - 3, fx + lw * 0.42, fy - 3, fx + lw * 0.55, fy, fx - lw * 0.5, fy], true); }
      else if (big) { p.fill = far ? dark(0.22) : base; p.ellipse(fx + 0.5, fy - 1.2, lw * 0.55, 1.8, true, 0); c.save(); c.globalAlpha *= 0.6; for (let k = -1; k <= 1; k++) p.dot(fx + k * lw * 0.25 + 1, fy - 1, 0.7); c.restore(); }
      else { p.fill = far ? dark(0.22) : base; p.ellipse(fx + lw * 0.25, fy - 1.1, lw * 0.5, Math.max(1.3, lw * 0.28), true, 0); c.save(); c.globalAlpha *= 0.5; p.line(fx + lw * 0.35, fy - 2, fx + lw * 0.4, fy - 0.3); p.line(fx + lw * 0.05, fy - 2, fx + lw * 0.1, fy - 0.3); c.restore(); }
      p.fill = base;
    };
    D.tail(p, e, t, o, -bw / 2 + 2, -bh / 4);
    leg(lx1, -sw, true, false); leg(lx2, sw, true, true);
    if (o.wings) {
      const f = flying ? Math.sin(t * 7) * 0.5 + 0.5 : 0.15;
      const sp = 0.5 + f * 0.7;
      p.use('wing'); p.poly([-4, -bh / 2, -8 - 6 * sp, -bh / 2 - 22 * sp, -28 * sp - 4, -bh / 2 - 8 * sp, -22 * sp - 4, -bh / 2 + 2, -14, -bh / 2 + 1], true);
      p.line(-8 - 6 * sp, -bh / 2 - 22 * sp, -20 * sp - 4, -bh / 2 + 1);
      p.use('body');
    }
    // body: deep chest, tucked belly, rounded rump
    if (o.wool) { p.use('wool'); p.fuzz(0, 0, bw / 2, bh / 2, true, 10); p.use('body'); }
    else {
      const pts = [], cr = Math.cos(o.bodyRot || 0), sr = Math.sin(o.bodyRot || 0);
      for (let i = 0; i < 26; i++) {
        const a = i / 26 * TAU, ca = Math.cos(a), sa = Math.sin(a);
        let x = ca * bw / 2, y = sa * bh / 2;
        if (sa > 0) { y *= 1 - 0.16 * (1 - Math.abs(ca)) * (croc || shelly ? 0 : 1); if (ca > 0.25) y *= 1.07; }
        else if (ca > 0.05 && ca < 0.75 && !croc) y *= 1.05;
        pts.push(x * cr - y * sr, x * sr + y * cr);
      }
      p.poly(pts, true);
      if (!croc && !shelly && !o.patches) { c.save(); c.globalAlpha *= 0.45; p.fill = (p.pal && p.pal.belly) || light(0.4); p.ellipse(bw * 0.06, bh * 0.28, bw * 0.34, bh * 0.15, true, 0); c.restore(); p.fill = base; }
      if (!croc && !shelly && !o.hedgehog && !o.spikes) { c.save(); c.globalAlpha *= 0.3; p.arc(bw * 0.3, -bh * 0.05, bh * 0.42, -1.1, 1.0); p.arc(-bw * 0.3, -bh * 0.02, bh * 0.45, Math.PI - 1.0, Math.PI + 1.0); c.restore(); }   // shoulder and haunch
    }
    if (o.hedgehog) for (let k = 0; k < 9; k++) { const a = Math.PI + 0.3 + k * (Math.PI - 0.6) / 8; const x = Math.cos(a) * bw / 2, y = Math.sin(a) * bh / 2; p.line(x, y, x * 1.3, y * 1.45 - 2); }
    if (o.shell) { p.use('shell'); p.poly((() => { const q = []; for (let k = 0; k <= 12; k++) { const a = Math.PI + 0.1 + k * (Math.PI - 0.2) / 12; q.push(Math.cos(a) * (bw / 2 - 1), 2 + Math.sin(a) * (bh / 2 + 5)); } return q; })(), true); p.use('body'); if (o.shellPattern) { p.line(-bw * 0.2, 2, -bw * 0.25, -bh * 0.4); p.line(bw * 0.2, 2, bw * 0.25, -bh * 0.4); p.line(-bw * 0.25, -bh * 0.4, bw * 0.25, -bh * 0.4); } }
    if (o.hump) for (let k = 0; k < o.hump; k++) { const cx = o.hump === 1 ? 0 : (k ? 8 : -8); p.ellipse(cx, -bh / 2 + 1, 9, 7, true, 0); }
    if (o.spikes) { p.use('spike'); for (let k = 0; k < 4; k++) { const x = -bw * 0.35 + k * bw * 0.2; p.poly([x - 3, -bh / 2 + 1, x, -bh / 2 - 6, x + 3, -bh / 2 + 1], true); } p.use('body'); }
    if (o.spots) for (let k = 0; k < o.spots; k++) { const a = k * 2.4 + 1; p.ellipse(Math.cos(a) * bw * 0.28, Math.sin(a) * bh * 0.3, 3 + (k % 2), 2.4 + (k % 2) * 0.6, (o.spotsDark || k % 3 === 0) ? dark(0.55) : light(0.35), a); }
    if (o.patches) { p.fill = '#222'; p.ellipse(-bw * 0.18, -bh * 0.1, bh * 0.32, bh * 0.36, true, 0.3); p.ellipse(bw * 0.2, bh * 0.1, bh * 0.25, bh * 0.3, true, 0); p.fill = base; }
    if (o.stripes) { c.save(); c.strokeStyle = dark(0.6); c.lineWidth *= 1.5; for (let k = 0; k < o.stripes; k++) { const x = -bw * 0.32 + k * bw * 0.64 / (o.stripes - 1); const yy = Math.sqrt(Math.max(0, 1 - (x / (bw / 2)) ** 2)) * bh / 2; p.curve(x, -yy + 1, x + 3, 0, x + 1, yy * 0.5); } c.restore(); }
    if (o.udder) { p.fill = '#f2a7b3'; p.ellipse(-bw * 0.1, bh / 2, 4.5, 3, true, 0); p.fill = base; }
    if (o.saddle) { p.use('saddle'); p.rect(-6, -bh / 2 - 2, 12, 4, true); p.use('body'); }
    leg(lx1, sw, false, false); leg(lx2, -sw, false, true);
    // neck: tapered from the shoulders up to the head
    const nx2 = g.hx - g.cosN * g.headRx * 0.55, ny2 = g.hy + g.sinN * hr * 0.55;
    const nw0 = Math.min(bh * 0.62, bw * 0.4) * (o.thickNeck ? 1.25 : 1), nw1 = hr * (o.thickNeck ? 1.4 : 1.1);
    if (o.neckLen > 1.5) D.cap(p, g.neckX - 2, g.neckY + 2, nx2, ny2, nw0, nw1);
    if (o.hairMane) { p.fill = dark(0.45); for (let k = 0; k < 6; k++) { const tt = k / 5; const x = g.neckX - 3 + (nx2 - g.neckX) * tt, y = g.neckY - nw0 * 0.3 + (ny2 - g.neckY) * tt - 2; p.poly([x - 2, y + 2, x - 5, y - 5, x + 2, y], true); } p.fill = base; }
    if (o.collar) { p.fill = '#d62828'; D.cap(p, g.neckX - 1, g.neckY - nw0 * 0.45, g.neckX + 2, g.neckY + nw0 * 0.45, 3, 3); p.fill = '#f2b632'; p.circle(g.neckX + 2.5, g.neckY + nw0 * 0.5, 1.6, true); p.fill = base; }
    D.ears(p, e, t, o, g, true);
    if (o.mane) { p.use('mane'); p.fuzz(g.hx - 2, g.hy, hr * 1.9, hr * 1.9, true, 12); p.use('body'); }
    // head
    if (o.head === 'long') {
      const R = g.headRx, rot = 0.32, cs = Math.cos(rot), sn = Math.sin(rot);
      const raw = [-hr * 0.85, -hr * 0.62, R * 0.15, -hr * 0.78, R * 0.85, -hr * 0.42, R * 1.12, hr * 0.05, R * 1.05, hr * 0.5, R * 0.7, hr * 0.72, -hr * 0.2, hr * 0.78, -hr * 0.95, hr * 0.15];
      const hp = []; for (let i = 0; i < raw.length; i += 2) hp.push(g.hx + raw[i] * cs - raw[i + 1] * sn, g.hy + raw[i] * sn + raw[i + 1] * cs);
      p.poly(hp, true);
      p.fill = (p.pal && p.pal.snout) || dark(0.15);
      p.ellipse(g.hx + R * 0.82 * cs - hr * 0.2 * sn, g.hy + R * 0.82 * sn + hr * 0.2 * cs, hr * 0.42, hr * 0.48, true, rot);
      p.fill = base;
    }
    else if (croc) p.poly([g.hx - hr, g.hy - hr * 0.7, g.hx + g.headRx, g.hy - hr * 0.4, g.hx + g.headRx, g.hy + hr * 0.5, g.hx - hr, g.hy + hr * 0.7], true);
    else p.ellipse(g.hx, g.hy, hr * 1.05, hr * 0.95, true, 0);
    D.ears(p, e, t, o, g, false);
    let mx = g.hx + hr * 0.9, my = g.hy + hr * 0.35;
    if (o.head === 'long') { mx = g.hx + g.headRx * 0.9; my = g.hy + hr * 0.45; p.dot(mx + 1, my - 3, 1.5); if (o.nostrils) p.dot(mx - 2, my - 3, 1.1); }
    else if (croc) {
      my = g.hy + hr * 0.1;
      p.line(g.hx - hr * 0.3, my, g.hx + g.headRx, my);
      if (mood === 'angry' || mood === 'happy') { p.use('mouth'); p.poly([g.hx - hr * 0.3, my, g.hx + g.headRx, my + hr * 1.0, g.hx - hr * 0.3, my + hr * 0.9], true); p.fill = base; }
      p.zigzag(g.hx, my, g.hx + g.headRx - 2, my, 2.5, 8);
      p.dot(g.hx + g.headRx - 3, g.hy - hr * 0.3, 1.3);
      c.save(); c.globalAlpha *= 0.4; for (let k = 0; k < 5; k++) p.dot(-bw * 0.3 + k * bw * 0.15, -bh * 0.25, 1.2); c.restore();
    } else if (o.snout) {
      const ss = o.snoutSize;
      p.fill = (p.pal && p.pal.snout) || light(0.3);
      p.ellipse(mx + 1, my - 1, hr * 0.58 * ss, hr * 0.44 * ss, true, 0.1);
      p.fill = base;
      if (o.nostrils) { p.dot(mx + hr * 0.3 * ss, my - 1, 1); p.dot(mx + hr * 0.3 * ss - 3, my - 1, 1); }
      else { p.fill = '#2a1a14'; p.ellipse(mx + hr * 0.45 * ss, my - hr * 0.22 * ss, 1.9 * Math.max(0.8, ss), 1.4 * Math.max(0.8, ss), true, 0); p.fill = base; }
      if (o.whiskers) { c.save(); c.globalAlpha *= 0.6; c.lineWidth *= 0.6; for (let k = -1; k <= 1; k++) p.line(mx - 1, my + k * 2, mx + 10, my + k * 3.5 - 1); c.restore(); }
    } else p.dot(mx + 1, my - 2, 1.3);
    if (o.trunk) { const s2 = Math.sin(t * 3 + e.seed) * 2; D.tube(p, g.hx + hr * 0.75, g.hy + hr * 0.2, g.hx + hr * 1.5, g.hy + hr * 1.1, g.hx + hr * 0.8 + s2, g.hy + hr * 2.1, hr * 0.6, hr * 0.32, 8, true); c.save(); c.globalAlpha *= 0.4; for (let k = 0; k < 4; k++) p.line(g.hx + hr * (1.05 + k * 0.05), g.hy + hr * (0.6 + k * 0.32), g.hx + hr * (1.3 + k * 0.04), g.hy + hr * (0.55 + k * 0.32)); c.restore(); }
    if (o.tusks) { p.fill = '#f5efe0'; p.poly([g.hx + hr * 0.6, g.hy + hr * 0.6, g.hx + hr * 1.4, g.hy + hr * 1.2, g.hx + hr * 1.6, g.hy + hr * 0.4, g.hx + hr * 1.3, g.hy + hr * 0.9, g.hx + hr * 0.8, g.hy + hr * 0.4], true); p.fill = base; }
    if (o.beard) p.zigzag(g.hx + hr * 0.5, g.hy + hr * 0.9, g.hx + hr * 0.9, g.hy + hr * 1.9, 2, 4);
    if (!croc) D.animalMouth(p, e, mx + (o.snout ? hr * 0.2 : 0), my + (o.snout ? hr * 0.35 : hr * 0.25), hr * 0.5, o.teeth);
    if (o.mask) { p.fill = '#222'; p.ellipse(g.hx + hr * 0.3, g.hy - hr * 0.3, hr * 0.5, hr * 0.34, true, 0); p.fill = base; }
    D.eye(p, g.hx + hr * 0.3, g.hy - hr * 0.3, o.eyeR, e, 0);
    if (!o.mask && !croc) { c.save(); c.globalAlpha *= 0.4; p.arc(g.hx + hr * 0.3, g.hy - hr * 0.3, o.eyeR + 1.4, Math.PI + 0.4, TAU - 0.4); c.restore(); }   // brow
    D.horns(p, e, t, o, g);
  };

  D.ears = function (p, e, t, o, g, behind) {
    const hr = o.headR, s = o.earSize;
    const ex = g.hx - hr * 0.35, ey = g.hy - hr * 0.85;
    const k = o.ears;
    if (behind) {
      if (k === 'big') p.ellipse(g.hx - hr * 0.7, g.hy + hr * 0.1, hr * 0.75, hr * 0.95, true, 0.1);
      if (k === 'long') p.ellipse(ex - 4, ey - 8 * s, 2.4 * s, 9 * s, true, -0.35);
      if (k === 'floppy') p.ellipse(ex - 4, ey + 5, 2.6 * s, 5.5 * s, true, 0.25);
      if (k === 'round') p.circle(ex - 4, ey - 1, 3.5 * s, true);
      return;
    }
    switch (k) {
      case 'point': for (const dx of [-3, 2]) { p.poly([ex + dx - 3 * s, ey + 2, ex + dx, ey - 6 * s, ex + dx + 3 * s, ey + 2], true); const f = p.fill; p.fill = '#e9a3a3'; p.poly([ex + dx - 1.5 * s, ey + 1, ex + dx, ey - 3.5 * s, ex + dx + 1.5 * s, ey + 1], true); p.fill = f; } break;
      case 'floppy': p.ellipse(ex + 1, ey + 5, 2.6 * s, 5.5 * s, true, 0.25); break;
      case 'round': p.circle(ex + 1, ey - 1, 3.5 * s, true); break;
      case 'long': p.ellipse(ex + 1, ey - 8 * s, 2.4 * s, 9 * s, true, -0.15); break;
      case 'tuft': p.line(ex, ey, ex - 2, ey - 4 * s); p.line(ex + 3, ey, ex + 3, ey - 4 * s); break;
      case 'small': p.arc(ex + 1, ey + 1, 2.2 * s, Math.PI, TAU); break;
    }
  };

  D.tail = function (p, e, t, o, tx, ty) {
    const L = o.tailLen;
    const wag = (o.wag && (e.mood === 'happy' || e.mode === 'approach')) ? Math.sin(t * 14) * 4 : Math.sin(t * 2 + e.seed) * 1.5;
    switch (o.tail) {
      case 'up': p.curve(tx, ty, tx - 5, ty - L * 0.5, tx - 3 + wag, ty - L); break;
      case 'down': p.curve(tx, ty, tx - 4, ty + L * 0.5, tx - 3 + wag * 0.5, ty + L); if (o.tuftTail) p.circle(tx - 3 + wag * 0.5, ty + L + 2, 2.5, '#000'); break;
      case 'curl': p.spiral(tx - 3, ty - 2, 4, 1.3, 1.5); break;
      case 'fluff': p.fuzz(tx - 2, ty + 1, 3.5, 3.5, true, 6); break;
      case 'long': p.curve(tx, ty, tx - L * 0.8, ty + 2, tx - L * 0.55 + wag, ty - L * 0.9); break;
      case 'fan': for (let k = 0; k < 4; k++) p.curve(tx, ty - 2, tx - 5 - k * 2, ty + L * 0.3, tx - 3 - k * 3 + wag * 0.5, ty + L * 0.85); break;
      case 'thick': p.poly([tx, ty - o.bodyH * 0.25, tx - L, ty + o.bodyH * 0.1 + wag * 0.5, tx, ty + o.bodyH * 0.3], true); break;
      case 'bushy': p.fuzz(tx - L * 0.45, ty - 3 + wag * 0.3, L * 0.55, 5, true, 8); break;
      case 'thin': p.curve(tx, ty, tx - L * 0.6, ty + 4, tx - L + wag, ty + 2); break;
    }
  };

  D.horns = function (p, e, t, o, g) {
    const hr = o.headR, hx = g.hx, hy = g.hy;
    p.use('horn');
    switch (o.horns) {
      case 'cow': p.curve(hx - 2, hy - hr, hx - 7, hy - hr - 5, hx - 4, hy - hr - 9); p.curve(hx + 3, hy - hr, hx + 8, hy - hr - 5, hx + 5, hy - hr - 9); break;
      case 'goat': p.curve(hx - 1, hy - hr, hx - 3, hy - hr - 7, hx - 8, hy - hr - 8); p.curve(hx + 2, hy - hr, hx + 1, hy - hr - 7, hx - 4, hy - hr - 9); break;
      case 'unicorn': p.poly([hx + 1, hy - hr + 1, hx + 5, hy - hr + 1, hx + 11, hy - hr - 10], true); p.line(hx + 3, hy - hr - 2, hx + 6, hy - hr - 3); p.line(hx + 5, hy - hr - 5, hx + 8, hy - hr - 6); break;
      case 'antlers': for (const s of [-1, 1]) { const bx = hx + s * 2; p.line(bx, hy - hr, bx + s * 3, hy - hr - 12); p.line(bx + s * 1.2, hy - hr - 5, bx + s * 6, hy - hr - 9); p.line(bx + s * 2.2, hy - hr - 9, bx + s * 6, hy - hr - 14); } break;
      case 'rhino': p.poly([hx + hr * 0.7, hy + hr * 0.1, hx + hr * 1.3, hy + hr * 0.1, hx + hr * 1.6, hy - hr * 0.9], true); break;
      case 'dragon': p.curve(hx - 3, hy - hr + 1, hx - 6, hy - hr - 5, hx - 10, hy - hr - 7); p.curve(hx + 1, hy - hr, hx + 1, hy - hr - 6, hx - 3, hy - hr - 10); break;
      case 'ossicone': p.line(hx - 2, hy - hr, hx - 3, hy - hr - 5); p.dot(hx - 3, hy - hr - 6, 1.3); p.line(hx + 2, hy - hr, hx + 2, hy - hr - 5); p.dot(hx + 2, hy - hr - 6, 1.3); break;
      case 'ram': p.spiral(hx - 3, hy - hr + 1, 5, 1.2, 3); break;
    }
  };

  // ---------- biped (dinosaurs, kangaroo) ----------
  D.biped = function (o) {
    o = Object.assign({ bodyW: 30, bodyH: 20, legLen: 18, tailLen: 30, neckLen: 8, headR: 9, headLen: 1.5, teeth: true, spikes: false, arms: 'tiny', ears: 'none', pouch: false, crest: false, plates: false, eyeR: 1.6, longNeck: false, wings: false, fins: false }, o);
    const bw = o.bodyW, bh = o.bodyH;
    const nx = bw / 2 - 3, ny = -bh / 2 + 3;
    const hx = nx + o.neckLen * 0.6 + o.headR * 0.8, hy = ny - o.neckLen - o.headR * 0.4;
    const feetY = bh / 2 + o.legLen;
    const topY = Math.min(hy - o.headR - (o.crest ? 8 : 0) - (o.ears !== 'none' ? 10 : 0), -bh / 2 - (o.spikes || o.plates ? 8 : 0) - (o.wings ? 16 : 0));
    const right = hx + o.headR * o.headLen + 2, left = -bw / 2 - o.tailLen;
    const w = right - left, h = feetY - topY;
    const ox = -(right + left) / 2, oy = -(feetY + topY) / 2;
    const g = { hx, hy, nx, ny, feetY };
    return { kind: 'biped', o, g, ox, oy, w, h, draw(p, e, t) { p.ctx.translate(ox, oy); D.drawBiped(p, e, t, o, g); } };
  };

  D.drawBiped = function (p, e, t, o, g) {
    p.use('body');
    const c = p.ctx, base = p.fill, mood = e.mood, held = e.held;
    const inAir = !e.grounded && !held && !e.flying;
    const walking = e.moving && e.grounded;
    const ph = e.phase;
    const bw = o.bodyW, bh = o.bodyH, hr = o.headR, L = o.legLen;
    const dark = k => SB.shade(base, k), light = k => SB.mixColor(base, '#fff', k);
    const sw = walking ? Math.sin(ph) * 0.5 : held ? Math.sin(t * 10) * 0.3 : inAir ? 0.45 : 0;
    const ly = bh / 2 - 3, kanga = o.arms === 'kangaroo';
    // leg: a big muscled thigh, a shin, a long foot bone and clawed toes (bent like a bird's)
    const leg = (x, a, far) => {
      const off = far ? 3 : 0, hx = x + off, hy0 = ly - 4;
      const kx = hx + Math.sin(a) * L * 0.45 + L * 0.16, ky = hy0 + Math.cos(a) * L * 0.42;
      const ax = hx + Math.sin(a) * L * 0.7 - L * 0.12, ay = hy0 + (L + 4) * 0.8;
      const fy = bh / 2 + L, tx = ax + (kanga ? 12 : 8);
      p.fill = far ? dark(0.22) : base;
      D.cap(p, hx, hy0, kx, ky, bh * 0.55, bh * 0.36);
      D.cap(p, kx, ky, ax, ay, bh * 0.3, bh * 0.2);
      D.cap(p, ax, ay, ax + 1.5, fy - 1.5, bh * 0.18, bh * 0.14);
      p.poly([ax - 2, fy - 3, tx, fy - 2.5, tx + 2, fy, ax - 3, fy], true);
      p.fill = '#3a3a3a'; for (let k = 0; k < 3; k++) p.poly([tx - 2 - k * 3, fy - 2, tx + 1.5 - k * 3, fy - 0.5, tx - 2 - k * 3, fy], true);
      p.fill = base;
    };
    // tail: thick at the hips, tapering to a point
    const wag = Math.sin(t * 2 + e.seed) * 2;
    D.tube(p, -bw / 2 + 4, -bh * 0.05, -bw / 2 - o.tailLen * 0.5, bh * 0.05 + wag * 0.5, -bw / 2 - o.tailLen, bh * 0.18 + wag, bh * 0.62, 2, 10, true);
    if (o.spikes) { p.use('spike'); for (let k = 0; k < 3; k++) { const x = -bw / 2 - 4 - k * o.tailLen * 0.28; p.poly([x - 3, -bh * 0.18 + k * 2.5, x, -bh * 0.18 - 7 + k * 2.5, x + 3, -bh * 0.18 + k * 2.5], true); } p.fill = base; }
    leg(bw * 0.02, -sw, true);
    if (o.wings) { const f = e.flying ? Math.sin(t * 7) * 0.5 + 0.5 : 0.15; const sp = 0.5 + f * 0.7; p.use('wing'); p.poly([-2, -bh / 2, -8 - 6 * sp, -bh / 2 - 22 * sp, -26 * sp - 4, -bh / 2 - 8 * sp, -20 * sp - 4, -bh / 2 + 2], true); p.fill = base; }
    // body
    const bp = []; for (let i = 0; i < 22; i++) { const a2 = i / 22 * TAU, ca = Math.cos(a2), sa = Math.sin(a2); let x = ca * bw / 2, y = sa * bh / 2; if (sa > 0 && ca > 0) y *= 1.08; const r = -0.3; bp.push(x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)); }
    p.poly(bp, true);
    c.save(); c.globalAlpha *= 0.4; p.fill = (p.pal && p.pal.belly && p.pal.belly !== SB.ROLES.belly) ? p.pal.belly : light(0.4); p.ellipse(bw * 0.1, bh * 0.25, bw * 0.3, bh * 0.2, true, -0.3); c.restore(); p.fill = base;
    if (!kanga) { c.save(); c.globalAlpha *= 0.35; for (let k = 0; k < 6; k++) p.arc(-bw * 0.3 + k * bw * 0.12, -bh * 0.05 + (k % 2) * 3, 2.5, Math.PI, TAU); c.restore(); }   // scales
    if (o.spikes) { p.use('spike'); for (let k = 0; k < 4; k++) { const a2 = -2.6 + k * 0.45; const x = Math.cos(a2) * bw / 2, y = Math.sin(a2) * bh / 2 - 1; p.poly([x - 3, y + 1, x + 1, y - 7, x + 4, y + 1], true); } p.fill = base; }
    if (o.plates) { p.use('spike'); for (let k = 0; k < 4; k++) { const a2 = -2.7 + k * 0.5; const x = Math.cos(a2) * bw / 2, y = Math.sin(a2) * bh / 2 - 1; p.poly([x - 4, y + 1, x - 2, y - 9, x + 3, y - 9, x + 5, y + 1], true); } p.fill = base; }
    if (o.pouch) { c.save(); c.globalAlpha *= 0.6; p.arc(bw * 0.05, bh * 0.15, bh * 0.28, 0.1, Math.PI - 0.1); c.restore(); }
    leg(bw * 0.02, sw, false);
    // arms: two segments with claws (tiny for a T. rex, boxing arms for a kangaroo)
    if (o.arms === 'tiny' || kanga) {
      const aa = held ? Math.sin(t * 15) * 0.5 : kanga && mood === 'angry' ? -0.8 : 0;
      const sx = bw * 0.3, sy2 = -bh * 0.15, ex = sx + 5, ey = sy2 + 6 - aa * 4, hx2 = ex + (kanga ? 7 : 5), hy2 = ey - (kanga ? 2 + aa * 6 : -2);
      D.cap(p, sx, sy2, ex, ey, bh * 0.18, bh * 0.14); D.cap(p, ex, ey, hx2, hy2, bh * 0.13, bh * 0.1);
      p.line(hx2, hy2, hx2 + 2, hy2 + 2); p.line(hx2, hy2, hx2 + 2.5, hy2);
    }
    // neck and head: skull, brow, jaw
    const nx2 = g.hx - hr * 0.6, ny2 = g.hy + hr * 0.5;
    D.cap(p, g.nx - 1, g.ny + 1, nx2, ny2, o.longNeck ? bh * 0.35 : bh * 0.5, hr * 1.05);
    if (o.ears === 'long') { p.ellipse(g.hx - hr * 0.4 - 4, g.hy - hr - 6, 2.6, 8.5, true, -0.4); p.ellipse(g.hx - hr * 0.4 + 1, g.hy - hr - 6, 2.6, 8.5, true, -0.15); c.save(); c.globalAlpha *= 0.5; p.fill = '#e9a3a3'; p.ellipse(g.hx - hr * 0.4 + 1, g.hy - hr - 6, 1.2, 6, true, -0.15); c.restore(); p.fill = base; }
    const hl = o.headLen, hx = g.hx, hy = g.hy;
    const jaw = mood === 'angry' || mood === 'happy' || mood === 'scared';
    const mx0 = hx - hr * 0.2, mxe = hx + hr * hl - 1, my = hy + hr * 0.25;
    if (jaw) { p.use('mouth'); p.poly([mx0, my, mxe - 1, my + hr * 0.15, mxe - 3, my + hr * 0.75, mx0, my + hr * 0.7], true); p.fill = base; p.poly([mx0 - 2, my + hr * 0.55, mxe - 2, my + hr * 0.7, mxe - 4, my + hr * 0.95, mx0 - 2, my + hr * 0.9], true); if (o.teeth) { p.fill = '#fff'; p.zigzag(mx0 + 2, my + hr * 0.6, mxe - 3, my + hr * 0.7, -2.5, 6); } p.fill = base; }
    p.poly([hx - hr * 0.95, hy + hr * 0.4, hx - hr * 0.9, hy - hr * 0.35, hx - hr * 0.3, hy - hr * 0.95, hx + hr * 0.5 * hl, hy - hr * 0.8, hx + hr * hl, hy - hr * 0.25, hx + hr * hl + 0.5, hy + hr * 0.3, hx + hr * 0.4, hy + hr * 0.55, hx - hr * 0.5, hy + (jaw ? hr * 0.5 : hr * 0.85)], true);
    if (o.crest) { p.use('spike'); p.poly([hx - hr * 0.5, hy - hr + 1, hx - hr * 1.2, hy - hr - 8, hx + hr * 0.2, hy - hr + 1], true); p.fill = base; }
    p.line(mx0, my, mxe, my);
    if (o.teeth && !jaw) { p.fill = '#fff'; p.zigzag(mx0 + 2, my, mxe - 1, my, 2.5, 6); }
    p.dot(mxe - 2, hy - hr * 0.35, 1.2);
    D.eye(p, hx + hr * 0.35, hy - hr * 0.3, o.eyeR, e, 0);
    c.save(); c.lineWidth *= 1.3; p.line(hx + hr * 0.05, hy - hr * 0.62, hx + hr * 0.7, hy - hr * 0.5); c.restore();   // heavy brow
  };
  // wrap a template at a different scale
  D.scaled = function (tpl, s) {
    return { kind: tpl.kind, o: tpl.o, g: tpl.g, ox: tpl.ox, oy: tpl.oy, inner: tpl, k: s * (tpl.k || 1), w: tpl.w * s, h: tpl.h * s, draw(p, e, t) { p.ctx.scale(s, s); tpl.draw(p, e, t); } };
  };
})();
