'use strict';
// draw.js — procedural stick-figure templates. Every template returns
// { w, h, draw(pen, entity, time) } drawing centered at (0,0), facing +x.
(function () {
  const D = SB.D = {};
  const TAU = SB.TAU;

  // ---------- faces ----------
  D.eye = function (p, x, y, r, e, side) {
    const m = e.mood;
    if (m === 'sleep') { p.arc(x, y, r, 0.3, Math.PI - 0.3); return; }
    if (m === 'dizzy') { p.line(x - r, y - r, x + r, y + r); p.line(x - r, y + r, x + r, y - r); return; }
    const rr = m === 'scared' ? r * 1.35 : r;
    p.circle(x, y, rr, true);
    const k = rr * 0.42;
    p.dot(x + e.lookX * k, y + e.lookY * k, Math.max(0.9, rr * 0.45));
    if (m === 'angry') {
      if (side > 0) p.line(x - rr * 1.3, y - rr * 0.9, x + rr * 1.3, y - rr * 1.8);
      else p.line(x - rr * 1.3, y - rr * 1.8, x + rr * 1.3, y - rr * 0.9);
    }
  };
  D.mouth = function (p, x, y, w, e) {
    switch (e.mood) {
      case 'happy': p.arc(x, y - w * 0.35, w * 0.65, 0.35, Math.PI - 0.35); break;
      case 'scared': p.ellipse(x, y + 1, w * 0.22, w * 0.32, true); break;
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
    else if (m === 'scared') p.ellipse(x - w * 0.2, y + 1, w * 0.3, w * 0.4, true);
    else p.line(x - w * 0.6, y, x + w * 0.2, y + 1);
  };
  D.flame = function (p, x, y, r, t, seed) {
    const f = 1 + Math.sin(t * 14 + seed) * 0.18, g = 1 + Math.sin(t * 11 + seed * 2) * 0.2;
    p.poly([x - r * 0.8, y, x - r * 0.55, y - r * 0.9 * f, x - r * 0.1, y - r * 1.9 * g, x + r * 0.45, y - r * 1.1 * f, x + r * 0.8, y], true);
    p.poly([x - r * 0.35, y, x - r * 0.05, y - r * 0.9 * g, x + r * 0.3, y], true);
  };
  D.wheel = function (p, x, y, r, ang) {
    p.circle(x, y, r, true);
    const c = Math.cos(ang) * r * 0.8, s = Math.sin(ang) * r * 0.8;
    p.line(x - c, y - s, x + c, y + s);
    p.line(x + s, y - c, x - s, y + c);
    p.dot(x, y, Math.max(1.2, r * 0.15));
  };
  D.wings = function (p, e, t, x, y, u, kind, flying) {
    const f = flying ? Math.sin(t * (kind === 'fairy' ? 30 : 10)) * 0.5 + 0.5 : 0.15;
    const c = p.ctx;
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
    return { w, h: o.size, draw(p, e, t) { D.drawHumanoid(p, e, t, o, u); } };
  };

  D.drawHumanoid = function (p, e, t, o, u) {
    const mood = e.mood, held = e.held, flying = e.flying;
    const inAir = !e.grounded && !flying && !held;
    const walking = e.moving && e.grounded && !flying;
    const ph = e.phase;
    const hr = o.headR * u * (o.bigHead ? 1.35 : 1);
    const hcy = -35 * u + hr;
    const ny = hcy + hr;
    const sy = ny + 3 * u;
    const hy = 8 * u;
    const legL = 27 * u, armL = 19 * u;
    let l1, l2;
    if (held) { l1 = Math.sin(t * 9) * 0.25; l2 = -l1; }
    else if (inAir) { l1 = 0.45; l2 = -0.35; }
    else if (flying) { l1 = 0.15; l2 = -0.05 + Math.sin(t * 3) * 0.08; }
    else if (walking) { const a = o.zombie ? 0.3 : 0.55; l1 = Math.sin(ph) * a; l2 = -l1; }
    else { l1 = 0.12; l2 = -0.12; }
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
    else { a1 = 0.15; a2 = -0.15; }
    const holding = o.item !== 'none' && !held && mood !== 'scared' && mood !== 'dizzy' && !o.zombie;
    if (holding) {
      a1 = Math.max(a1, 0.95);
      if (['staff', 'cane', 'broom', 'pitchfork', 'shovel', 'balloon', 'flag', 'scythe'].includes(o.item)) a1 = 0.55;
    }
    const hx1 = Math.sin(a1) * armL, hy1 = sy + Math.cos(a1) * armL;
    const hx2 = Math.sin(a2) * armL, hy2 = sy + Math.cos(a2) * armL;
    const fx1 = Math.sin(l1) * legL, fy1 = hy + Math.cos(l1) * legL;
    const fx2 = Math.sin(l2) * legL, fy2 = hy + Math.cos(l2) * legL;

    // behind the body
    if (o.cape) {
      const wave = Math.sin(t * 6 + e.seed) * 2 * u + (e.moving ? 4 * u : 0) + (flying ? 12 * u : 0);
      p.poly([-1 * u, sy, -12 * u - wave, sy + 14 * u, -9 * u - wave * 0.6, hy + 12 * u, -4 * u, hy + 4 * u], true);
    }
    if (o.wings !== 'none') D.wings(p, e, t, 0, sy + 2 * u, u * (o.wings === 'fairy' ? 0.8 : 1), o.wings, flying);
    if (o.bag) p.fuzz(-9 * u, sy + 6 * u, 9 * u, 10 * u, true, 7);
    if (o.backpack) p.rect(-9 * u, sy - 2 * u, 7 * u, 16 * u, true);
    if (o.tail === 'devil') { p.curve(-2 * u, hy, -14 * u, hy + 4 * u, -12 * u, hy - 14 * u); p.poly([-14 * u, hy - 12 * u, -10 * u, hy - 12 * u, -12 * u, hy - 17 * u], true); }
    if (o.tail === 'monkey') { const s = Math.sin(t * 4) * 2 * u; p.curve(-2 * u, hy, -14 * u, hy + 4 * u, -14 * u + s, hy - 12 * u); p.arc(-14 * u + s, hy - 15 * u, 3 * u, 0.5, 5.5); }
    if (o.tail === 'cat') p.curve(-2 * u, hy, -14 * u, hy - 2 * u, -12 * u, hy - 16 * u);
    if (o.fur) p.fuzz(0, sy + 9 * u, 15 * u, 18 * u, true, 12);
    if (o.belly) p.circle(0, sy + 10 * u, 9.5 * u, true);
    // back limbs
    if (o.fishTail) { const sw = Math.sin(t * 5 + e.seed) * 3 * u; p.poly([-4 * u, hy - 2 * u, 4 * u, hy - 2 * u, 3 * u, hy + 14 * u, 12 * u, hy + 24 * u + sw, 2 * u, hy + 20 * u, -8 * u, hy + 26 * u + sw, -3 * u, hy + 14 * u], true); p.line(-2 * u, hy + 6 * u, 2 * u, hy + 6 * u); p.line(-2 * u, hy + 11 * u, 2 * u, hy + 11 * u); }
    else p.line(0, hy, fx2, fy2);
    if (!o.fur) p.line(0, sy, hx2, hy2);
    if (o.shield) { p.ellipse(hx2 + 2 * u, hy2 - 2 * u, 5.5 * u, 7 * u, true); p.line(hx2 + 2 * u, hy2 - 7 * u, hx2 + 2 * u, hy2 + 3 * u); p.line(hx2 - 2 * u, hy2 - 3 * u, hx2 + 6 * u, hy2 - 3 * u); }
    // body
    if (o.boxy) { p.rect(-6 * u, ny, 12 * u, hy - ny, true); p.line(-3 * u, ny + 5 * u, 3 * u, ny + 5 * u); p.dot(0, ny + 10 * u, 1.2 * u); p.dot(-2 * u, ny + 14 * u, 1 * u); p.dot(2 * u, ny + 14 * u, 1 * u); }
    else p.line(0, ny, 0, hy);
    if (o.dress) p.poly([0, sy + 2 * u, -11 * u, hy + 4 * u, 11 * u, hy + 4 * u], true);
    if (o.ribs) for (let k = 0; k < 3; k++) { const y = sy + 3 * u + k * 4 * u; p.line(-5 * u, y, 5 * u, y); }
    if (o.wrap) for (let k = 0; k < 5; k++) { const y = ny + 2 * u + k * 4.5 * u; p.line(-3 * u, y - 1 * u, 3 * u, y + 1 * u); }
    if (o.tie) p.poly([0, ny, -2 * u, ny + 3 * u, 0, ny + 12 * u, 2 * u, ny + 3 * u], true);
    if (o.bowtie) { p.poly([-1 * u, ny + 1.5 * u, -5 * u, ny - 1 * u, -5 * u, ny + 4 * u], true); p.poly([1 * u, ny + 1.5 * u, 5 * u, ny - 1 * u, 5 * u, ny + 4 * u], true); }
    if (o.badge) p.star(3.5 * u, sy + 4 * u, 2.5 * u, true);
    if (o.emblem) p.star(0, sy + 6 * u, 3.5 * u, true);
    if (o.stethoscope) { p.curve(-3 * u, ny, -6 * u, sy + 8 * u, 0, sy + 10 * u); p.circle(0, sy + 11 * u, 2 * u, true); }
    if (o.apron) p.rect(-5 * u, sy + 4 * u, 10 * u, 12 * u, true);
    if (o.stripes) for (let k = 0; k < 3; k++) { const y = sy + 3 * u + k * 5 * u; p.line(-2.5 * u, y, 2.5 * u, y); }
    // front limbs
    if (!o.fishTail) p.line(0, hy, fx1, fy1);
    if (o.robe) {
      const pts = [-4 * u, sy + 3 * u, 4 * u, sy + 3 * u, 13 * u, 35 * u];
      if (o.tattered) { for (let k = 1; k < 6; k++) pts.push(13 * u - k * 4.3 * u, (k % 2) ? 29 * u : 35 * u); }
      pts.push(-13 * u, 35 * u);
      p.poly(pts, true);
      p.line(-2 * u, sy + 10 * u, -6 * u, 33 * u); p.line(3 * u, sy + 12 * u, 6 * u, 33 * u);
    }
    if (o.fur) p.line(8 * u, sy + 2 * u, hx1 + 6 * u, hy1); else p.line(0, sy, hx1, hy1);
    if (holding) D.handItem(p, e, t, o.item, hx1 + (o.fur ? 6 * u : 0), hy1, u);
    if (o.hook) p.arc(hx1, hy1 + 2 * u, 2.5 * u, -1.2, 3.5);
    // head
    if (o.halo) p.ellipse(0, hcy - hr - 5 * u, 7 * u, 2 * u);
    if (o.hair === 'long') p.ellipse(0, hcy + 3 * u, hr + 2 * u, hr + 8 * u, true);
    if (o.beard === 'long') p.fuzz(0, hcy + hr + 4 * u, hr * 0.9, hr * 1.1, true, 8);
    if (o.earsRound) { p.circle(-hr * 0.95, hcy - hr * 0.2, 3 * u, true); p.circle(hr * 0.95, hcy - hr * 0.2, 3 * u, true); }
    if (o.hood) p.poly([-hr - 4 * u, hcy + hr + 4 * u, -hr - 3 * u, hcy - hr * 0.5, -hr * 0.45, hcy - hr - 5 * u, hr * 0.45, hcy - hr - 5 * u, hr + 3 * u, hcy - hr * 0.5, hr + 4 * u, hcy + hr + 4 * u], '#000');
    if (o.boxy) p.rect(-hr, hcy - hr, hr * 2, hr * 2, true);
    else p.circle(0, hcy, hr * (o.hood ? 0.82 : 1), true);
    if (o.beard === 'short') p.zigzag(-hr * 0.85, hcy + hr * 0.45, hr * 0.85, hcy + hr * 0.45, 5 * u, 7);
    D.hair(p, e, t, o.hair, hcy, hr, u);
    D.face(p, e, t, o, hcy, hr, u);
    D.hat(p, e, t, o.hat, hcy, hr, u);
    if (o.horns) { p.curve(-hr * 0.6, hcy - hr * 0.8, -hr * 1.2, hcy - hr * 1.4, -hr * 0.9, hcy - hr * 2.1); p.curve(hr * 0.6, hcy - hr * 0.8, hr * 1.2, hcy - hr * 1.4, hr * 0.9, hcy - hr * 2.1); }
    if (o.antenna) for (let k = 0; k < o.antenna; k++) { const x = o.antenna === 1 ? 0 : (k ? 4 * u : -4 * u); p.line(x, hcy - hr, x * 1.6, hcy - hr - 8 * u); p.circle(x * 1.6, hcy - hr - 9.5 * u, 1.6 * u, true); }
  };

  D.face = function (p, e, t, o, hcy, hr, u) {
    const ey = hcy - hr * 0.15, ex = hr * 0.42, er = o.eyeR * u;
    if (o.mask === 'hero') p.rect(-hr * 0.9, ey - er * 1.7, hr * 1.8, er * 3.4, '#000');
    if (o.mask === 'ninja') { p.rect(-hr * 0.95, hcy + hr * 0.15, hr * 1.9, hr * 0.8, '#000'); p.line(-hr, hcy - hr * 0.55, hr, hcy - hr * 0.55); }
    if (o.oneEye) D.eye(p, 0, ey, er * 1.9, e, 0);
    else if (o.eyes === 'sockets') { p.dot(-ex, ey, er * 1.3); p.dot(ex, ey, er * 1.3); }
    else if (o.mask === 'eyepatch') { p.dot(-ex, ey, er * 1.5); p.line(-hr, ey - er * 1.8, ex - er, ey - er * 0.8); D.eye(p, ex, ey, er, e, 1); }
    else { D.eye(p, -ex, ey, er, e, -1); D.eye(p, ex, ey, er, e, 1); }
    if (o.glasses) { p.circle(-ex, ey, er * 1.9); p.circle(ex, ey, er * 1.9); p.line(-ex + er * 1.9, ey, ex - er * 1.9, ey); }
    if (o.nose) p.circle(0, hcy + hr * 0.2, 2.2 * u, true);
    if (o.mustache) { p.curve(0, hcy + hr * 0.35, -3 * u, hcy + hr * 0.15, -5.5 * u, hcy + hr * 0.45); p.curve(0, hcy + hr * 0.35, 3 * u, hcy + hr * 0.15, 5.5 * u, hcy + hr * 0.45); }
    if (o.mask !== 'ninja') {
      const my = hcy + hr * 0.5;
      if (o.eyes === 'sockets') p.zigzag(-hr * 0.5, my, hr * 0.5, my, 2 * u, 6);
      else if (o.boxy) p.zigzag(-hr * 0.5, my, hr * 0.5, my, 2.5 * u, 5);
      else D.mouth(p, 0, my, hr * 0.9, e);
      if (o.fangs) { p.poly([-2.5 * u, my, -0.5 * u, my, -1.5 * u, my + 3.5 * u], true); p.poly([0.5 * u, my, 2.5 * u, my, 1.5 * u, my + 3.5 * u], true); }
      if (o.tusks) { p.poly([-3.5 * u, my + 1 * u, -1.5 * u, my + 1 * u, -2.5 * u, my - 3.5 * u], true); p.poly([1.5 * u, my + 1 * u, 3.5 * u, my + 1 * u, 2.5 * u, my - 3.5 * u], true); }
    }
  };

  D.hair = function (p, e, t, kind, hcy, hr, u) {
    switch (kind) {
      case 'short': case 'long': p.arc(0, hcy, hr + 1.5 * u, Math.PI + 0.25, TAU - 0.25); break;
      case 'spiky': { const pts = [], n = 7; for (let i = 0; i <= n; i++) { const a = Math.PI + 0.2 + (Math.PI - 0.4) * i / n; const rr = (i % 2) ? hr + 6 * u : hr; pts.push(Math.cos(a) * rr, hcy + Math.sin(a) * rr); } p.path(pts, false); break; }
      case 'ponytail': p.arc(0, hcy, hr + 1.5 * u, Math.PI + 0.25, TAU - 0.25); p.curve(-hr, hcy - hr * 0.3, -hr - 6 * u, hcy + 2 * u, -hr - 3 * u + Math.sin(t * 5) * u, hcy + hr + 6 * u); break;
      case 'curly': for (let k = -2; k <= 2; k++) { const a = -Math.PI / 2 + k * 0.45; p.circle(Math.cos(a) * hr, hcy + Math.sin(a) * hr, 3 * u, true); } break;
      case 'bun': p.arc(0, hcy, hr + 1.5 * u, Math.PI + 0.25, TAU - 0.25); p.circle(-hr * 0.5, hcy - hr - 2 * u, 3.5 * u, true); break;
      case 'mohawk': { const pts = []; for (let i = 0; i <= 8; i++) { const x = -hr * 0.6 + hr * 1.2 * i / 8; pts.push(x, hcy - hr - ((i % 2) ? 9 * u : 1 * u)); } p.path(pts, false); break; }
      case 'tuft': p.line(0, hcy - hr, 2 * u, hcy - hr - 5 * u); p.line(0, hcy - hr, -2 * u, hcy - hr - 4 * u); break;
      case 'pigtails': p.arc(0, hcy, hr + 1.5 * u, Math.PI + 0.25, TAU - 0.25); p.line(-hr, hcy - hr * 0.3, -hr - 6 * u, hcy + hr * 0.6); p.line(hr, hcy - hr * 0.3, hr + 6 * u, hcy + hr * 0.6); break;
    }
  };

  D.hat = function (p, e, t, kind, hcy, hr, u) {
    const top = hcy - hr;
    switch (kind) {
      case 'cap': p.arc(0, hcy, hr + 1.5 * u, Math.PI + 0.15, TAU - 0.15); p.line(hr * 0.6, hcy - hr * 0.6, hr + 7 * u, hcy - hr * 0.55); break;
      case 'top': p.rect(-7 * u, top - 12 * u, 14 * u, 12.5 * u, true); p.line(-10 * u, top + 0.5 * u, 10 * u, top + 0.5 * u); break;
      case 'crown': p.poly([-7 * u, top + 1.5 * u, -7 * u, top - 7 * u, -3.5 * u, top - 2 * u, 0, top - 8 * u, 3.5 * u, top - 2 * u, 7 * u, top - 7 * u, 7 * u, top + 1.5 * u], true); p.dot(0, top - 4 * u, 1 * u); break;
      case 'tiara': p.poly([-5 * u, top + 1 * u, -4 * u, top - 3 * u, 0, top - 6 * u, 4 * u, top - 3 * u, 5 * u, top + 1 * u], true); break;
      case 'wizard': p.poly([-12 * u, top + 2 * u, 12 * u, top + 2 * u, 2 * u, top - 22 * u], true); p.ellipse(0, top + 2 * u, 13 * u, 3 * u, true); p.star(0, top - 6 * u, 2.5 * u); break;
      case 'witch': p.poly([-12 * u, top + 2 * u, 12 * u, top + 2 * u, 4 * u, top - 12 * u, -6 * u, top - 22 * u, 2 * u, top - 14 * u], true); p.ellipse(0, top + 2 * u, 13 * u, 3 * u, true); break;
      case 'helmet': p.arc(0, hcy, hr + 2.5 * u, Math.PI, TAU); p.line(-hr - 2.5 * u, hcy, -hr - 2.5 * u, hcy + 5 * u); p.line(hr + 2.5 * u, hcy, hr + 2.5 * u, hcy + 5 * u); p.line(hr * 0.3, hcy - 1 * u, hr + 2.5 * u, hcy - 1 * u); p.line(hr * 0.3, hcy + 2 * u, hr + 2.5 * u, hcy + 2 * u); p.curve(0, top - 2 * u, -6 * u, top - 12 * u, -14 * u, top - 6 * u); break;
      case 'hardhat': p.arc(0, hcy - 1 * u, hr + 2 * u, Math.PI + 0.1, TAU - 0.1); p.line(-hr - 5 * u, hcy - hr * 0.45, hr + 5 * u, hcy - hr * 0.45); break;
      case 'police': p.poly([-hr, top + 2 * u, -hr + 1 * u, top - 4 * u, hr, top - 5 * u, hr, top + 2 * u], true); p.line(hr * 0.5, top + 2 * u, hr + 6 * u, top + 2.5 * u); p.dot(0, top - 1 * u, 1.3 * u); break;
      case 'chef': p.circle(-5 * u, top - 8 * u, 4.5 * u, true); p.circle(5 * u, top - 8 * u, 4.5 * u, true); p.circle(0, top - 11 * u, 5 * u, true); p.rect(-7 * u, top - 4 * u, 14 * u, 5 * u, true); break;
      case 'cowboy': p.arc(0, hcy - 2 * u, hr * 0.8, Math.PI, TAU); p.curve(-hr - 7 * u, top + 1 * u, 0, top + 6 * u, hr + 7 * u, top + 1 * u); p.line(-hr * 0.8, top + 3 * u, hr * 0.8, top + 3 * u); break;
      case 'pirate': p.poly([-13 * u, top + 3 * u, -9 * u, top - 8 * u, 0, top - 5 * u, 9 * u, top - 8 * u, 13 * u, top + 3 * u], true); p.dot(0, top - 1.5 * u, 1.5 * u); break;
      case 'bandana': p.line(-hr, hcy - hr * 0.5, hr, hcy - hr * 0.5); p.line(-hr, hcy - hr * 0.5, -hr - 7 * u, hcy - hr * 0.2 + Math.sin(t * 7) * u); p.line(-hr, hcy - hr * 0.5, -hr - 6 * u, hcy + Math.sin(t * 7 + 1) * u); break;
      case 'astronaut': p.circle(0, hcy, hr + 5 * u); p.arc(0, hcy, hr + 3 * u, Math.PI * 1.15, Math.PI * 1.35); break;
      case 'santa': p.poly([-hr, top + 3 * u, hr, top + 3 * u, 6 * u, top - 8 * u, -10 * u, top - 14 * u], true); p.circle(-11 * u, top - 15 * u, 3 * u, true); p.rect(-hr - 1 * u, top + 1 * u, hr * 2 + 2 * u, 4 * u, true); break;
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
  };

  D.handItem = function (p, e, t, kind, hx, hy, u) {
    const dx = 0.72, dy = -0.69;
    switch (kind) {
      case 'sword': { const L = 24 * u; p.poly([hx + dy * 1.5 * u, hy - dx * 1.5 * u, hx + dx * L, hy + dy * L - 1, hx + dx * (L + 4 * u), hy + dy * (L + 4 * u), hx - dy * 1.5 * u, hy + dx * 1.5 * u], true); p.line(hx + dy * 4 * u, hy - dx * 4 * u, hx - dy * 4 * u, hy + dx * 4 * u); p.line(hx, hy, hx - dx * 5 * u, hy - dy * 5 * u); break; }
      case 'lightsaber': { const L = 26 * u; p.line(hx, hy, hx - dx * 5 * u, hy - dy * 5 * u); p.poly([hx + dy * 2 * u, hy - dx * 2 * u, hx + dx * L + dy * 2 * u, hy + dy * L - dx * 2 * u, hx + dx * L - dy * 2 * u, hy + dy * L + dx * 2 * u, hx - dy * 2 * u, hy + dx * 2 * u], true); break; }
      case 'wand': p.line(hx, hy, hx + 8 * u, hy - 8 * u); p.star(hx + 10 * u, hy - 10 * u, 3 * u, true); break;
      case 'staff': p.line(hx, hy + 18 * u, hx, hy - 30 * u); p.circle(hx, hy - 33 * u, 3.5 * u, true); break;
      case 'cane': p.line(hx, hy, hx, hy + 26 * u); p.arc(hx + 3 * u, hy, 3 * u, Math.PI, TAU); break;
      case 'hammer': p.line(hx, hy, hx + 8 * u, hy - 14 * u); p.poly([hx + 3 * u, hy - 20 * u, hx + 15 * u, hy - 16 * u, hx + 13 * u, hy - 10 * u, hx + 1 * u, hy - 14 * u], true); break;
      case 'axe': p.line(hx, hy, hx + 8 * u, hy - 16 * u); p.poly([hx + 6 * u, hy - 18 * u, hx + 15 * u, hy - 23 * u, hx + 13 * u, hy - 11 * u], true); break;
      case 'broom': p.line(hx - 6 * u, hy + 20 * u, hx + 12 * u, hy - 22 * u); p.poly([hx - 4 * u, hy + 15 * u, hx - 13 * u, hy + 27 * u, hx - 3 * u, hy + 32 * u, hx + 3 * u, hy + 20 * u], true); break;
      case 'club': p.line(hx, hy, hx + 8 * u, hy - 14 * u); p.ellipse(hx + 11 * u, hy - 19 * u, 5 * u, 8 * u, true, 0.5); break;
      case 'pitchfork': p.line(hx, hy + 18 * u, hx, hy - 26 * u); p.line(hx - 4 * u, hy - 22 * u, hx + 4 * u, hy - 22 * u); p.line(hx - 4 * u, hy - 22 * u, hx - 4 * u, hy - 30 * u); p.line(hx, hy - 26 * u, hx, hy - 31 * u); p.line(hx + 4 * u, hy - 22 * u, hx + 4 * u, hy - 30 * u); break;
      case 'shovel': p.line(hx, hy - 8 * u, hx, hy + 22 * u); p.poly([hx - 4 * u, hy + 22 * u, hx + 4 * u, hy + 22 * u, hx + 3 * u, hy + 30 * u, hx - 3 * u, hy + 30 * u], true); break;
      case 'guitar': p.line(hx - 4 * u, hy, hx + 14 * u, hy - 10 * u); p.ellipse(hx - 6 * u, hy + 2 * u, 6 * u, 5 * u, true); p.circle(hx - 6 * u, hy + 2 * u, 1.5 * u); break;
      case 'balloon': p.line(hx, hy, hx + 4 * u, hy - 30 * u); p.ellipse(hx + 4 * u, hy - 38 * u, 7 * u, 8.5 * u, true); break;
      case 'football': p.ellipse(hx + 2 * u, hy, 5.5 * u, 3.5 * u, true, -0.4); p.line(hx, hy, hx + 4 * u, hy); break;
      case 'basketball': p.circle(hx + 3 * u, hy, 5 * u, true); p.line(hx - 2 * u, hy, hx + 8 * u, hy); p.line(hx + 3 * u, hy - 5 * u, hx + 3 * u, hy + 5 * u); break;
      case 'flag': p.line(hx, hy + 14 * u, hx, hy - 28 * u); p.poly([hx, hy - 28 * u, hx + 16 * u + Math.sin(t * 6) * 2 * u, hy - 22 * u, hx, hy - 16 * u], true); break;
      case 'magnifier': p.line(hx, hy, hx + 6 * u, hy - 6 * u); p.circle(hx + 10 * u, hy - 10 * u, 5 * u, true); break;
      case 'bat': p.line(hx, hy, hx + 10 * u, hy - 18 * u); p.line(hx + 2.5 * u, hy + 1 * u, hx + 12.5 * u, hy - 17 * u); p.line(hx + 10 * u, hy - 18 * u, hx + 12.5 * u, hy - 17 * u); break;
      case 'torch': p.line(hx, hy, hx + 3 * u, hy - 12 * u); D.flame(p, hx + 3 * u, hy - 14 * u, 5 * u, t, e.seed); break;
      case 'book': p.rect(hx - 4 * u, hy - 6 * u, 8 * u, 6 * u, true); p.line(hx, hy - 6 * u, hx, hy); break;
      case 'letter': p.rect(hx - 1 * u, hy - 5 * u, 8 * u, 6 * u, true); p.line(hx - 1 * u, hy - 5 * u, hx + 3 * u, hy - 1 * u); p.line(hx + 7 * u, hy - 5 * u, hx + 3 * u, hy - 1 * u); break;
      case 'trident': p.line(hx, hy + 18 * u, hx, hy - 26 * u); p.arc(hx, hy - 24 * u, 4 * u, Math.PI, TAU); p.line(hx - 4 * u, hy - 24 * u, hx - 4 * u, hy - 30 * u); p.line(hx, hy - 26 * u, hx, hy - 32 * u); p.line(hx + 4 * u, hy - 24 * u, hx + 4 * u, hy - 30 * u); break;
      case 'racket': p.line(hx, hy, hx + 6 * u, hy - 8 * u); p.ellipse(hx + 10 * u, hy - 14 * u, 5 * u, 7 * u, true, -0.6); p.line(hx + 7 * u, hy - 18 * u, hx + 13 * u, hy - 10 * u); break;
      case 'lollipop': p.line(hx, hy, hx + 4 * u, hy - 10 * u); p.circle(hx + 5 * u, hy - 14 * u, 4 * u, true); p.spiral(hx + 5 * u, hy - 14 * u, 3 * u, 1.5, 0); break;
      case 'brush': p.line(hx, hy, hx + 8 * u, hy - 12 * u); p.poly([hx + 7 * u, hy - 14 * u, hx + 11 * u, hy - 12 * u, hx + 12 * u, hy - 18 * u], true); break;
      case 'mic': p.line(hx, hy, hx + 6 * u, hy - 8 * u); p.circle(hx + 8 * u, hy - 11 * u, 3.5 * u, '#000'); break;
      case 'stick': p.line(hx, hy, hx + 12 * u, hy - 12 * u); break;
      case 'scythe': p.line(hx - 1 * u, hy + 24 * u, hx + 3 * u, hy - 36 * u); p.curve(hx + 3 * u, hy - 36 * u, hx + 16 * u, hy - 42 * u, hx + 26 * u, hy - 30 * u); p.curve(hx + 3 * u, hy - 36 * u, hx + 14 * u, hy - 36 * u, hx + 26 * u, hy - 30 * u); p.line(hx, hy + 8 * u, hx + 6 * u, hy + 6 * u); break;
      case 'bolt': p.poly([hx + 3 * u, hy - 14 * u, hx + 8 * u, hy - 14 * u, hx + 4 * u, hy - 6 * u, hx + 9 * u, hy - 6 * u, hx - 1 * u, hy + 6 * u, hx + 2 * u, hy - 3 * u, hx - 2 * u, hy - 3 * u], true); break;
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
    return { w, h, draw(p, e, t) { p.ctx.translate(ox, oy); D.drawQuad(p, e, t, o, g); } };
  };

  D.drawQuad = function (p, e, t, o, g) {
    const mood = e.mood, held = e.held, flying = e.flying;
    const inAir = !e.grounded && !held && !flying;
    const walking = e.moving && e.grounded && !flying;
    const ph = e.phase;
    const bw = o.bodyW, bh = o.bodyH, hr = o.headR;
    const sw = walking ? Math.sin(ph) * 0.5 : held ? Math.sin(t * 10) * 0.3 : inAir ? 0.5 : flying ? 0.35 : 0;
    const lx1 = bw * o.legSpread, lx2 = -bw * o.legSpread;
    const ly = bh / 2 - 2;
    const leg = (x, a, far) => {
      const off = far ? 2.5 : 0;
      const fx = x + Math.sin(a) * o.legLen, fy = ly + Math.cos(a) * o.legLen;
      p.line(x + off, ly, fx + off, fy);
      if (o.thickLegs) { p.line(x + off + 3.5, ly, fx + off + 3.5, fy); p.line(fx + off - 1, fy, fx + off + 4.5, fy); }
    };
    D.tail(p, e, t, o, -bw / 2 + 2, -bh / 4);
    leg(lx1, -sw, true); leg(lx2, sw, true);
    if (o.wings) {
      const f = flying ? Math.sin(t * 7) * 0.5 + 0.5 : 0.15;
      const sp = 0.5 + f * 0.7;
      p.poly([-4, -bh / 2, -8 - 6 * sp, -bh / 2 - 22 * sp, -28 * sp - 4, -bh / 2 - 8 * sp, -22 * sp - 4, -bh / 2 + 2, -14, -bh / 2 + 1], true);
      p.line(-8 - 6 * sp, -bh / 2 - 22 * sp, -20 * sp - 4, -bh / 2 + 1);
    }
    if (o.wool) p.fuzz(0, 0, bw / 2, bh / 2, true, 10);
    else p.ellipse(0, 0, bw / 2, bh / 2, true, o.bodyRot);
    if (o.hedgehog) for (let k = 0; k < 9; k++) { const a = Math.PI + 0.3 + k * (Math.PI - 0.6) / 8; const x = Math.cos(a) * bw / 2, y = Math.sin(a) * bh / 2; p.line(x, y, x * 1.3, y * 1.45 - 2); }
    if (o.shell) { p.arc(0, 2, bw / 2 - 2, Math.PI + 0.1, TAU - 0.1); p.line(-bw / 2 + 2, 2, bw / 2 - 2, 2); if (o.shellPattern) { p.line(-bw * 0.2, 2, -bw * 0.25, -bh * 0.4); p.line(bw * 0.2, 2, bw * 0.25, -bh * 0.4); p.line(-bw * 0.25, -bh * 0.4, bw * 0.25, -bh * 0.4); } }
    if (o.hump) for (let k = 0; k < o.hump; k++) { const cx = o.hump === 1 ? 0 : (k ? 8 : -8); p.arc(cx, -bh / 2 + 3, 8, Math.PI + 0.2, TAU - 0.2); }
    if (o.spikes) for (let k = 0; k < 4; k++) { const x = -bw * 0.35 + k * bw * 0.2; p.poly([x - 3, -bh / 2 + 1, x, -bh / 2 - 6, x + 3, -bh / 2 + 1], true); }
    if (o.spots) for (let k = 0; k < o.spots; k++) { const a = k * 2.4 + 1; p.circle(Math.cos(a) * bw * 0.28, Math.sin(a) * bh * 0.3, 2.5 + (k % 2), (o.spotsDark || k % 3 === 0) ? '#000' : false); }
    if (o.patches) { p.circle(-bw * 0.2, -bh * 0.15, bh * 0.28, '#000'); p.circle(bw * 0.15, bh * 0.15, bh * 0.22, '#000'); }
    if (o.stripes) for (let k = 0; k < o.stripes; k++) { const x = -bw * 0.3 + k * bw * 0.6 / (o.stripes - 1); const yy = Math.sqrt(Math.max(0, 1 - (x / (bw / 2)) ** 2)) * bh / 2; p.line(x, -yy + 1, x + 2, yy * 0.4); }
    if (o.udder) p.arc(-bw * 0.1, bh / 2 - 1, 4, 0.2, Math.PI - 0.2);
    if (o.saddle) p.rect(-6, -bh / 2 - 2, 12, 4, true);
    leg(lx1, sw, false); leg(lx2, -sw, false);
    const nx2 = g.hx - g.cosN * g.headRx * 0.6, ny2 = g.hy + g.sinN * hr * 0.6;
    if (o.thickNeck) { p.line(g.neckX - 3, g.neckY + 1, nx2 - 2, ny2 + 2); p.line(g.neckX + 2, g.neckY - 1, nx2 + 2, ny2 - 1); }
    else p.line(g.neckX, g.neckY, nx2, ny2);
    if (o.hairMane) for (let k = 0; k < 5; k++) { const tt = k / 4; const x = g.neckX + (nx2 - g.neckX) * tt, y = g.neckY + (ny2 - g.neckY) * tt; p.line(x, y, x - 3, y - 5); }
    if (o.collar) p.line(g.neckX - 1, g.neckY - 3, g.neckX + 2, g.neckY + 4);
    D.ears(p, e, t, o, g, true);
    if (o.mane) p.fuzz(g.hx, g.hy, hr * 1.9, hr * 1.9, true, 12);
    if (o.head === 'long') p.ellipse(g.hx, g.hy, g.headRx, hr * 0.8, true, 0.3);
    else if (o.head === 'croc') p.poly([g.hx - hr, g.hy - hr * 0.7, g.hx + g.headRx, g.hy - hr * 0.4, g.hx + g.headRx, g.hy + hr * 0.5, g.hx - hr, g.hy + hr * 0.7], true);
    else p.circle(g.hx, g.hy, hr, true);
    D.ears(p, e, t, o, g, false);
    let mx = g.hx + hr * 0.9, my = g.hy + hr * 0.35;
    if (o.head === 'long') { mx = g.hx + g.headRx * 0.9; my = g.hy + hr * 0.45; p.dot(mx + 1, my - 3, 1.4); if (o.nostrils) p.dot(mx - 2, my - 3, 1); }
    else if (o.head === 'croc') {
      my = g.hy + hr * 0.1;
      p.line(g.hx - hr * 0.3, my, g.hx + g.headRx, my);
      if (mood === 'angry' || mood === 'happy') p.poly([g.hx - hr * 0.3, my, g.hx + g.headRx, my + hr * 1.0, g.hx - hr * 0.3, my + hr * 0.9], true);
      p.zigzag(g.hx, my, g.hx + g.headRx - 2, my, 2.5, 8);
      p.dot(g.hx + g.headRx - 3, g.hy - hr * 0.3, 1.3);
    } else if (o.snout) {
      const ss = o.snoutSize;
      p.ellipse(mx + 1, my - 1, hr * 0.55 * ss, hr * 0.42 * ss, true);
      if (o.nostrils) { p.dot(mx + hr * 0.3 * ss, my - 1, 1); p.dot(mx + hr * 0.3 * ss - 3, my - 1, 1); }
      else p.dot(mx + hr * 0.45 * ss, my - hr * 0.2 * ss, 1.5);
      if (o.whiskers) for (let k = -1; k <= 1; k++) p.line(mx - 2, my + k * 2, mx + 9, my + k * 3.5 - 1);
    } else p.dot(mx + 1, my - 2, 1.3);
    if (o.trunk) { const s2 = Math.sin(t * 3 + e.seed) * 2; p.curve(g.hx + hr * 0.9, g.hy + hr * 0.2, g.hx + hr * 1.5, g.hy + hr * 1.2, g.hx + hr * 0.9 + s2, g.hy + hr * 2.1); p.curve(g.hx + hr * 0.9, g.hy + hr * 0.6, g.hx + hr * 1.1, g.hy + hr * 1.3, g.hx + hr * 0.6 + s2, g.hy + hr * 2.0); }
    if (o.tusks) p.curve(g.hx + hr * 0.7, g.hy + hr * 0.7, g.hx + hr * 1.3, g.hy + hr * 1.1, g.hx + hr * 1.5, g.hy + hr * 0.4);
    if (o.beard) p.zigzag(g.hx + hr * 0.5, g.hy + hr * 0.9, g.hx + hr * 0.9, g.hy + hr * 1.9, 2, 4);
    if (o.head !== 'croc') D.animalMouth(p, e, mx + (o.snout ? hr * 0.2 : 0), my + (o.snout ? hr * 0.35 : hr * 0.25), hr * 0.5, o.teeth);
    if (o.mask) p.ellipse(g.hx + hr * 0.3, g.hy - hr * 0.3, hr * 0.5, hr * 0.32, '#000');
    D.eye(p, g.hx + hr * 0.3, g.hy - hr * 0.3, o.eyeR, e, 0);
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
      case 'point': for (const dx of [-3, 2]) p.poly([ex + dx - 3 * s, ey + 2, ex + dx, ey - 6 * s, ex + dx + 3 * s, ey + 2], true); break;
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
    return { w, h, draw(p, e, t) { p.ctx.translate(ox, oy); D.drawBiped(p, e, t, o, g); } };
  };

  D.drawBiped = function (p, e, t, o, g) {
    const mood = e.mood, held = e.held;
    const inAir = !e.grounded && !held && !e.flying;
    const walking = e.moving && e.grounded;
    const ph = e.phase;
    const bw = o.bodyW, bh = o.bodyH, hr = o.headR, L = o.legLen;
    const sw = walking ? Math.sin(ph) * 0.5 : held ? Math.sin(t * 10) * 0.3 : inAir ? 0.45 : 0;
    const ly = bh / 2 - 3;
    const leg = (x, a, far) => {
      const off = far ? 3 : 0;
      const kx = x + Math.sin(a) * L * 0.5 + 2, ky = ly + Math.cos(a) * L * 0.5;
      const fx = kx + Math.sin(a * 0.4) * L * 0.5 - 2, fy = ky + Math.cos(a * 0.4) * L * 0.5;
      p.line(x + off, ly, kx + off, ky); p.line(kx + off, ky, fx + off, fy); p.line(fx + off - 2, fy, fx + off + 7, fy);
    };
    // tail
    const wag = Math.sin(t * 2 + e.seed) * 2;
    p.poly([-bw / 2 + 3, -bh * 0.3, -bw / 2 - o.tailLen, bh * 0.15 + wag, -bw / 2 + 3, bh * 0.3], true);
    if (o.spikes) for (let k = 0; k < 3; k++) { const x = -bw / 2 - 4 - k * o.tailLen * 0.28; p.poly([x - 3, -bh * 0.1 + k * 2, x, -bh * 0.1 - 6 + k * 2, x + 3, -bh * 0.1 + k * 2], true); }
    leg(bw * 0.05, -sw, true);
    if (o.wings) { const f = e.flying ? Math.sin(t * 7) * 0.5 + 0.5 : 0.15; const sp = 0.5 + f * 0.7; p.poly([-2, -bh / 2, -8 - 6 * sp, -bh / 2 - 22 * sp, -26 * sp - 4, -bh / 2 - 8 * sp, -20 * sp - 4, -bh / 2 + 2], true); }
    p.ellipse(0, 0, bw / 2, bh / 2, true, -0.35);
    if (o.spikes) for (let k = 0; k < 4; k++) { const a = -2.6 + k * 0.45; const x = Math.cos(a) * bw / 2, y = Math.sin(a) * bh / 2 - 1; p.poly([x - 3, y + 1, x + 1, y - 7, x + 4, y + 1], true); }
    if (o.plates) for (let k = 0; k < 4; k++) { const a = -2.7 + k * 0.5; const x = Math.cos(a) * bw / 2, y = Math.sin(a) * bh / 2 - 1; p.poly([x - 4, y + 1, x - 2, y - 9, x + 3, y - 9, x + 5, y + 1], true); }
    if (o.pouch) p.arc(bw * 0.05, bh * 0.15, bh * 0.28, 0.1, Math.PI - 0.1);
    leg(bw * 0.05, sw, false);
    // tiny arms
    if (o.arms === 'tiny') { const aa = held ? Math.sin(t * 15) * 0.5 : 0; p.line(bw * 0.3, -bh * 0.15, bw * 0.3 + 7, -bh * 0.15 + 5 + aa * 4); p.line(bw * 0.3, -bh * 0.1, bw * 0.3 + 6, -bh * 0.1 + 6 - aa * 4); }
    else if (o.arms === 'kangaroo') { const aa = held ? Math.sin(t * 15) * 0.5 : (mood === 'angry' ? -0.8 : 0); p.line(bw * 0.3, -bh * 0.2, bw * 0.3 + 6, -bh * 0.2 + 8 - aa * 8); p.line(bw * 0.3 + 6, -bh * 0.2 + 8 - aa * 8, bw * 0.3 + 12, -bh * 0.2 + 6 - aa * 12); }
    // neck + head
    const nx2 = g.hx - hr * 0.6, ny2 = g.hy + hr * 0.5;
    if (o.longNeck) { p.line(g.nx - 3, g.ny, nx2 - 3, ny2); p.line(g.nx + 3, g.ny + 1, nx2 + 2, ny2 + 1); } else { p.line(g.nx, g.ny, nx2, ny2); p.line(g.nx + 4, g.ny + 3, nx2 + 4, ny2 + 3); }
    if (o.ears === 'long') { p.ellipse(g.hx - hr * 0.4 - 4, g.hy - hr - 6, 2.4, 8, true, -0.4); p.ellipse(g.hx - hr * 0.4 + 1, g.hy - hr - 6, 2.4, 8, true, -0.15); }
    p.ellipse(g.hx, g.hy, hr * o.headLen, hr, true, 0.1);
    if (o.crest) p.poly([g.hx - hr * 0.5, g.hy - hr + 1, g.hx - hr * 1.2, g.hy - hr - 8, g.hx + hr * 0.2, g.hy - hr + 1], true);
    const jaw = mood === 'angry' || mood === 'happy' || mood === 'scared';
    const mx0 = g.hx - hr * 0.2, mxe = g.hx + hr * o.headLen - 1, my = g.hy + hr * 0.25;
    p.line(mx0, my, mxe, my);
    if (jaw) { p.poly([mx0, my, mxe, my + hr * 0.7, mx0, my + hr * 0.7], true); if (o.teeth) p.zigzag(mx0 + 2, my + hr * 0.7, mxe - 1, my + hr * 0.7, -2.5, 6); }
    if (o.teeth) p.zigzag(mx0 + 2, my, mxe - 1, my, 2.5, 6);
    p.dot(mxe - 2, g.hy - hr * 0.35, 1.2);
    D.eye(p, g.hx + hr * 0.35, g.hy - hr * 0.3, o.eyeR, e, 0);
  };
  // wrap a template at a different scale
  D.scaled = function (tpl, s) {
    return { w: tpl.w * s, h: tpl.h * s, draw(p, e, t) { p.ctx.scale(s, s); tpl.draw(p, e, t); } };
  };
})();
