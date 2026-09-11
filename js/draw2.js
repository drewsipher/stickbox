'use strict';
// draw2.js — birds, bugs, sea life, reptiles and vehicles.
(function () {
  const D = SB.D;
  const TAU = SB.TAU;

  // ---------- birds ----------
  D.bird = function (o) {
    o = Object.assign({ s: 1, beak: 'short', crest: false, comb: false, wattle: false, tail: 'short', wing: 'feather', eyeR: 1.6, upright: false, legLen: 6, longNeck: false, longLegs: false, bigEyes: false, flap: 12, fan: false }, o);
    const s = o.s;
    const w = (o.longNeck ? 34 : 30) * s;
    const h = (o.upright ? 30 : o.longLegs ? 44 : o.longNeck ? 34 : 24) * s;
    return { w, h, draw(p, e, t) { D.drawBird(p, e, t, o, s, w, h); } };
  };
  D.drawBird = function (p, e, t, o, s, w, h) {
    const flying = e.flying, held = e.held, mood = e.mood;
    const walking = e.moving && e.grounded && !flying;
    const ph = e.phase;
    if (o.upright) {
      const by = h / 2 - 14 * s;
      const fl = held || flying ? Math.sin(t * 12) * 0.6 : walking ? Math.sin(ph) * 0.3 : 0;
      p.line(-6 * s, by - 4 * s, -12 * s, by + 6 * s - fl * 8 * s);
      p.ellipse(0, by, 8 * s, 12 * s, true);
      p.ellipse(1 * s, by + 2 * s, 5 * s, 8 * s, true);
      p.line(6 * s, by - 4 * s, 12 * s, by + 6 * s + fl * 8 * s);
      p.line(-4 * s, by + 12 * s, -8 * s, by + 14 * s); p.line(2 * s, by + 12 * s, 6 * s, by + 14 * s);
      p.poly([6 * s, by - 7 * s, 12 * s, by - 5.5 * s, 6 * s, by - 4 * s], true);
      D.eye(p, 3 * s, by - 8 * s, o.eyeR * s, e, 0);
      return;
    }
    const legL = (o.longLegs ? 24 : o.legLen) * s;
    const by = flying ? 0 : (h / 2 - legL - 6 * s);
    if (!flying) {
      const sw = walking ? Math.sin(ph) * 0.4 : held ? 0.3 : 0;
      for (let k = -1; k <= 1; k += 2) { const a = sw * k, lx = k * 2 * s; const fx = lx + Math.sin(a) * legL, fy = by + 5 * s + Math.cos(a) * legL; p.line(lx, by + 5 * s, fx, fy); p.line(fx - 2 * s, fy, fx + 4 * s, fy); }
    } else if (o.longLegs) { p.line(-2 * s, by + 5 * s, -16 * s, by + 8 * s); p.line(-2 * s, by + 5 * s, -16 * s, by + 11 * s); }
    const tl = o.tail === 'long' ? 3 : 2;
    for (let k = 0; k < tl; k++) p.line(-8 * s, by, -15 * s - (o.tail === 'long' ? 5 * s : 0), by - 4 * s + k * 4 * s);
    if (o.fan) p.fuzz(-10 * s, by - 4 * s, 8 * s, 9 * s, true, 9);
    p.ellipse(0, by, 9 * s, 6 * s, true, -0.2);
    const hx = o.longNeck ? 9 * s : 8 * s, hy = o.longNeck ? by - 17 * s : by - 5 * s;
    if (o.longNeck) { p.line(6 * s, by - 4 * s, hx - 1 * s, hy + 3 * s); p.line(8.5 * s, by - 3 * s, hx + 1.5 * s, hy + 3 * s); }
    const hr = (o.bigEyes ? 6.5 : 5) * s;
    p.circle(hx, hy, hr, true);
    if (o.crest) for (let k = 0; k < 3; k++) p.line(hx - 2 * s, hy - hr + 1 * s, hx - 6 * s - k * 2 * s, hy - hr - 5 * s + k * 2 * s);
    if (o.comb) p.zigzag(hx - 4 * s, hy - hr + 1, hx + 3 * s, hy - hr + 1, -4 * s, 4);
    const bx = hx + hr - 1 * s, byy = hy;
    switch (o.beak) {
      case 'long': p.poly([bx, byy - 1.5 * s, bx + 12 * s, byy + 1 * s, bx, byy + 2 * s], true); break;
      case 'flat': p.ellipse(bx + 3 * s, byy + 1 * s, 5 * s, 2 * s, true); break;
      case 'hook': p.poly([bx, byy - 2 * s, bx + 5 * s, byy - 1 * s, bx + 3 * s, byy + 4 * s, bx, byy + 1.5 * s], true); break;
      case 'tiny': p.poly([bx, byy - 1 * s, bx + 3 * s, byy + 0.5 * s, bx, byy + 1.5 * s], true); break;
      default: p.poly([bx, byy - 2 * s, bx + 6 * s, byy + 0.5 * s, bx, byy + 2.5 * s], true); if (mood === 'happy' || mood === 'scared') p.line(bx, byy + 0.5 * s, bx + 5 * s, byy + 0.5 * s);
    }
    if (o.wattle) p.ellipse(bx - 1 * s, byy + 4 * s, 1.5 * s, 3 * s, true);
    if (o.bigEyes) { D.eye(p, hx - 2.5 * s, hy - 1 * s, 2.6 * s, e, -1); D.eye(p, hx + 2.5 * s, hy - 1 * s, 2.6 * s, e, 1); }
    else D.eye(p, hx + 1 * s, hy - 1.5 * s, o.eyeR * s, e, 0);
    if (flying) {
      const f = Math.sin(t * o.flap);
      if (o.wing === 'bat') p.poly([0, by - 2 * s, -6 * s, by - 8 * s - 10 * s * f, -18 * s, by - 6 * s - 14 * s * f, -16 * s, by - 1 * s - 8 * s * f, -10 * s, by - 8 * s * f + 1 * s, -4 * s, by + 1 * s], true);
      else { p.curve(1 * s, by - 3 * s, -6 * s, by - 8 * s - 12 * s * f, -18 * s, by - 3 * s - 18 * s * f); p.curve(1 * s, by - 1 * s, -8 * s, by - 4 * s - 10 * s * f, -18 * s, by - 3 * s - 18 * s * f); p.line(-14 * s, by - 3 * s - 15 * s * f, -19 * s, by - 5 * s - 16 * s * f); }
    } else {
      p.curve(2 * s, by - 4 * s, -6 * s, by - 5 * s, -8 * s, by + 2 * s);
      if (held) { const f = Math.sin(t * 14); p.curve(1 * s, by - 3 * s, -6 * s, by - 8 * s - 10 * s * f, -16 * s, by - 3 * s - 14 * s * f); }
    }
  };

  // ---------- bugs ----------
  D.bug = function (kind, s) {
    s = s || 1;
    const sizes = { bee: [22, 16], fly: [16, 12], mosquito: [24, 12], butterfly: [30, 24], moth: [30, 24], spider: [30, 18], ant: [22, 10], ladybug: [18, 12], beetle: [18, 12], snail: [26, 18], worm: [26, 8], caterpillar: [28, 10], grasshopper: [28, 14], dragonfly: [30, 14], scorpion: [30, 16] };
    const [w, h] = sizes[kind] || [20, 14];
    return { w: w * s, h: h * s, draw(p, e, t) { p.ctx.scale(s, s); D.drawBug(p, e, t, kind); } };
  };
  D.drawBug = function (p, e, t, kind) {
    const flying = e.flying, held = e.held, walking = e.moving && e.grounded, ph = e.phase;
    const wf = Math.sin(t * 40);
    switch (kind) {
      case 'bee': case 'fly': case 'mosquito': {
        const rx = kind === 'bee' ? 8 : 5, ry = kind === 'bee' ? 5 : 4;
        for (let k = -1; k <= 1; k++) p.line(k * 3, 3, k * 3 - 2, 7 + (walking ? Math.sin(ph + k) * 2 : 0));
        p.ellipse(0, 0, rx, ry, true);
        if (kind === 'bee') { p.line(-3, -ry + 0.5, -3, ry - 0.5); p.line(0, -ry, 0, ry); p.line(3, -ry + 0.5, 3, ry - 0.5); p.poly([-rx, -1.5, -rx - 4, 0, -rx, 1.5], true); }
        p.circle(rx + 2, -1, 3.5, true);
        D.eye(p, rx + 3, -2, kind === 'fly' ? 2.2 : 1.4, e, 0);
        p.line(rx + 3, -4, rx + 6, -8); p.line(rx + 1, -4, rx + 2, -9);
        if (kind === 'mosquito') p.line(rx + 5, 0, rx + 14, 3);
        const wy = flying || held ? -ry - 2 - wf * 2 : -ry - 1;
        p.ellipse(-1, wy - 3, 6, 2.5, true, -0.3 - (flying ? wf * 0.25 : 0));
        p.ellipse(-4, wy - 2, 5, 2, true, -0.5 - (flying ? wf * 0.25 : 0));
        break;
      }
      case 'butterfly': case 'moth': {
        const f = flying || held ? Math.abs(Math.sin(t * 14)) * 0.6 + 0.4 : 0.9;
        const c = p.ctx;
        for (let sgn = -1; sgn <= 1; sgn += 2) {
          c.save(); c.scale(sgn * f, 1);
          p.ellipse(9, -5, 9, 7, true, 0.3); p.ellipse(7, 5, 6, 5, true, -0.3);
          if (kind === 'butterfly') { p.circle(10, -5, 2.5); p.dot(7, 5, 1.2); }
          c.restore();
        }
        p.ellipse(0, 0, 2, 9, true);
        p.circle(0, -10, 2.5, true);
        p.line(-1, -12, -5, -17); p.line(1, -12, 5, -17); p.dot(-5, -17, 1); p.dot(5, -17, 1);
        break;
      }
      case 'spider': {
        for (let k = 0; k < 4; k++) for (let sgn = -1; sgn <= 1; sgn += 2) {
          const a = -0.9 + k * 0.6, wob = walking ? Math.sin(ph + k * 1.5) * 2 : held ? Math.sin(t * 12 + k) * 3 : 0;
          const kx = sgn * (6 + Math.cos(a) * 9), ky = -9 + Math.sin(a) * 3 + wob * 0.3;
          p.line(sgn * 4, 0, kx, ky); p.line(kx, ky, kx + sgn * 4, 9 - wob * 0.5);
        }
        p.circle(-3, 0, 7, true); p.circle(6, 1, 4.5, true);
        D.eye(p, 5, -1, 1.5, e, -1); D.eye(p, 8.5, -1, 1.5, e, 1);
        if (e.mood === 'angry') p.zigzag(4, 3, 10, 3, 1.5, 4);
        break;
      }
      case 'ant': {
        for (let k = -1; k <= 1; k++) for (let sgn = -1; sgn <= 1; sgn += 2) { const wob = walking ? Math.sin(ph + k * 2) * 0.3 : 0; p.line(k * 5, 1, k * 5 + sgn * 4 + wob * 4, 5); }
        p.ellipse(-7, 0, 5, 3.5, true); p.circle(0, 0, 3, true); p.circle(6, -1, 3.5, true);
        p.line(7, -4, 9, -8); p.line(5, -4, 5, -8);
        D.eye(p, 7, -1.5, 1.2, e, 0);
        break;
      }
      case 'ladybug': case 'beetle': {
        for (let k = -1; k <= 1; k++) for (let sgn = -1; sgn <= 1; sgn += 2) p.line(k * 4, 2, k * 4 + sgn * 3, 6);
        p.arc(0, 2, 8, Math.PI, TAU); p.line(-8, 2, 8, 2); p.line(0, -6, 0, 2);
        if (kind === 'ladybug') { p.dot(-4, -2, 1.5); p.dot(4, -2, 1.5); p.dot(-3, 0.5, 1); p.dot(3, 0.5, 1); }
        p.circle(8.5, 0, 3, true); D.eye(p, 9, -1, 1.2, e, 0); p.line(10, -3, 12, -6);
        break;
      }
      case 'snail': {
        p.ellipse(2, 5, 11, 3.5, true);
        p.circle(-2, -3, 8, true); p.spiral(-2, -3, 7, 1.6, 0);
        p.line(10, 3, 12, -4); p.line(12, 3, 15, -3); p.dot(15, -4, 1.3);
        D.eye(p, 12, -5, 1.6, e, 0);
        break;
      }
      case 'worm': {
        const pts = []; for (let i = 0; i <= 8; i++) pts.push(-12 + i * 3, Math.sin(i * 1.2 + ph * 2) * 2.5);
        p.path(pts, false);
        p.circle(13, Math.sin(9.6 + ph * 2) * 2.5, 3, true); D.eye(p, 14, -1, 1.2, e, 0);
        break;
      }
      case 'caterpillar': {
        for (let i = 0; i < 5; i++) { const x = -10 + i * 5, y = Math.sin(i * 1.5 + ph * 2) * 1.5; p.circle(x, y, 3.5, true); p.line(x - 1, y + 3, x - 2, y + 6); p.line(x + 1, y + 3, x + 2, y + 6); }
        p.circle(13, 0, 4, true); D.eye(p, 14, -1, 1.4, e, 0); p.line(13, -4, 15, -8); p.line(11, -4, 11, -8);
        break;
      }
      case 'grasshopper': {
        p.ellipse(-2, 0, 11, 4, true); p.circle(9, -3, 4, true); D.eye(p, 10, -4, 1.5, e, 0);
        p.line(10, -7, 18, -11); p.line(8, -7, 12, -13);
        p.line(-4, 2, -12, -6); p.line(-12, -6, -14, 6); p.line(3, 2, 5, 6); p.line(-1, 3, -2, 6);
        break;
      }
      case 'dragonfly': {
        p.ellipse(-4, 0, 12, 2, true); p.circle(9, 0, 3.5, true); D.eye(p, 9, -1, 2.2, e, 0);
        const wv = flying ? wf * 3 : 0;
        p.ellipse(-3, -4 - wv, 10, 2.5, true, -0.2); p.ellipse(-7, -3 + wv * 0.5, 8, 2, true, 0.2);
        break;
      }
      case 'scorpion': {
        for (let k = -1; k <= 1; k++) for (let sgn = -1; sgn <= 1; sgn += 2) p.line(k * 4, 1, k * 4 + sgn * 4, 6);
        p.ellipse(-2, 0, 9, 4, true); p.curve(-10, -1, -18, -6, -14, -14); p.poly([-14, -14, -17, -16, -12, -17], true);
        p.line(6, -1, 12, -5); p.arc(14, -6, 3, 0.8, 5.5); p.line(6, 1, 12, 3); p.arc(14, 4, 3, 0.8, 5.5);
        D.eye(p, 5, -2, 1.2, e, 0);
        break;
      }
    }
  };

  // ---------- sea life ----------
  D.fish = function (kind, s) {
    s = s || 1;
    const sizes = { fish: [34, 18], goldfish: [36, 20], clownfish: [34, 18], shark: [74, 40], whale: [120, 56], dolphin: [66, 30], octopus: [36, 38], crab: [48, 28], jellyfish: [30, 36], starfish: [30, 30], lobster: [50, 22], seahorse: [16, 30], pufferfish: [34, 34] };
    const [w, h] = sizes[kind] || [30, 16];
    return { w: w * s, h: h * s, draw(p, e, t) { p.ctx.scale(s, s); D.drawFish(p, e, t, kind); } };
  };
  D.drawFish = function (p, e, t, kind) {
    const ph = e.phase, swim = Math.sin(t * 6 + e.seed);
    switch (kind) {
      case 'fish': case 'goldfish': case 'clownfish':
        if (kind === 'goldfish') p.poly([-10, 0, -18, -9 + swim * 2, -14, 0, -18, 9 - swim * 2], true);
        else p.poly([-10, 0, -16, -6 + swim * 2, -16, 6 - swim * 2], true);
        p.ellipse(0, 0, 12, 7, true);
        if (kind === 'clownfish') { p.line(-4, -6, -4, 6); p.line(4, -6, 4, 6); }
        p.poly([-2, -6, 2, -11, 6, -6], true);
        p.line(0, 3, -4, 7);
        D.eye(p, 6, -2, 1.7, e, 0);
        p.arc(10, 1, 2, 0.6, 2.6);
        break;
      case 'shark':
        p.poly([-24, -2, -34, -14, -32, 0, -36, 12, -24, 4], true);
        p.ellipse(0, 0, 30, 12, true);
        p.poly([-6, -11, 2, -26, 10, -11], true);
        p.poly([4, 8, 0, 18, 14, 10], true);
        p.line(-14, -8, -14, -2); p.line(-11, -9, -11, -2);
        p.line(8, 6, 26, 2); p.zigzag(9, 6, 25, 2.5, 3, 7);
        D.eye(p, 18, -4, 2, e, 0);
        break;
      case 'whale':
        p.ellipse(0, 2, 52, 22, true);
        p.poly([-46, -4, -60, -20, -54, -2, -60, 14], true);
        p.poly([10, 20, 2, 30, 24, 24], true);
        p.line(-10, 12, 40, 12);
        for (let k = 0; k < 4; k++) p.line(10 + k * 8, 12, 10 + k * 8, 20);
        p.line(20, -22, 20, -30); p.line(18, -23, 15, -31);
        D.eye(p, 36, -2, 2.4, e, 0);
        break;
      case 'dolphin':
        p.ellipse(0, 0, 26, 10, true, 0.05);
        p.poly([-22, -2, -32, -12, -30, 0, -32, 10], true);
        p.poly([-4, -9, 2, -20, 8, -9], true);
        p.poly([4, 6, 0, 14, 12, 8], true);
        p.poly([22, -4, 34, 0, 22, 4], true);
        p.line(24, 1, 32, 0);
        D.eye(p, 17, -3, 1.9, e, 0);
        break;
      case 'octopus':
        for (let k = 0; k < 7; k++) { const x = -15 + k * 5, s2 = Math.sin(t * 4 + k + e.seed) * 4; p.curve(x, 6, x + s2, 12, x + s2 * 1.5, 18); }
        p.ellipse(0, -4, 17, 14, true);
        D.eye(p, -5, -6, 2.6, e, -1); D.eye(p, 5, -6, 2.6, e, 1);
        D.mouth(p, 0, 2, 6, e);
        break;
      case 'crab':
        for (let k = 0; k < 3; k++) for (let sgn = -1; sgn <= 1; sgn += 2) { const wob = e.moving ? Math.sin(ph * 2 + k) * 2 : 0; p.line(sgn * (6 + k * 3), 2, sgn * (12 + k * 4), 8 + wob); }
        p.ellipse(0, 0, 14, 8, true);
        for (let sgn = -1; sgn <= 1; sgn += 2) { p.line(sgn * 12, -3, sgn * 20, -9); p.circle(sgn * 22, -11, 4, true); p.line(sgn * 22, -11, sgn * 26, -14); }
        p.line(-4, -7, -4, -12); p.line(4, -7, 4, -12);
        D.eye(p, -4, -13, 1.8, e, -1); D.eye(p, 4, -13, 1.8, e, 1);
        D.mouth(p, 0, 3, 5, e);
        break;
      case 'jellyfish':
        for (let k = 0; k < 5; k++) { const x = -8 + k * 4, s2 = Math.sin(t * 3 + k * 1.3) * 3; p.curve(x, 2, x + s2, 10, x - s2, 17); }
        p.arc(0, 0, 14, Math.PI, TAU); p.zigzag(-14, 0, 14, 0, 3, 7);
        D.eye(p, -5, -5, 2, e, -1); D.eye(p, 5, -5, 2, e, 1);
        break;
      case 'starfish':
        p.star(0, 0, 14, true);
        for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * TAU / 5; p.dot(Math.cos(a) * 8, Math.sin(a) * 8, 1.2); }
        D.eye(p, -3, -1, 1.6, e, -1); D.eye(p, 3, -1, 1.6, e, 1); D.mouth(p, 0, 4, 4, e);
        break;
      case 'lobster':
        for (let k = 0; k < 3; k++) for (let sgn = -1; sgn <= 1; sgn += 2) p.line(sgn * (4 + k * 3), 3, sgn * (8 + k * 4), 8);
        p.ellipse(-6, 0, 12, 5, true); for (let k = 0; k < 3; k++) p.line(-14 + k * 4, -4, -14 + k * 4, 4);
        p.poly([-18, 0, -24, -5, -24, 5], true);
        for (let sgn = -1; sgn <= 1; sgn += 2) { p.line(4, sgn * 3, 14, sgn * 8); p.circle(17, sgn * 10, 4, true); }
        p.line(5, -3, 8, -9); p.line(5, 3, 8, 9);
        D.eye(p, 7, -1, 1.5, e, 0);
        break;
      case 'seahorse':
        p.curve(0, -8, 8, 0, 0, 8); p.curve(0, 8, -6, 12, 2, 14); p.spiral(2, 13, 3, 1.2, 0);
        p.ellipse(2, -10, 5, 4, true); p.line(6, -10, 11, -9);
        p.zigzag(-1, -6, -2, 6, 3, 6);
        D.eye(p, 2, -11, 1.5, e, 0);
        break;
      case 'pufferfish': {
        const puff = (e.mood === 'scared' || e.mood === 'angry' || e.held) ? 1.3 : 1;
        p.poly([-12 * puff, 0, -18 * puff, -5, -18 * puff, 5], true);
        p.circle(0, 0, 12 * puff, true);
        if (puff > 1) for (let k = 0; k < 10; k++) { const a = k * TAU / 10; p.line(Math.cos(a) * 12 * puff, Math.sin(a) * 12 * puff, Math.cos(a) * 16 * puff, Math.sin(a) * 16 * puff); }
        D.eye(p, 5, -3, 2, e, 0); p.arc(10, 3, 2, 0.6, 2.6);
        break;
      }
    }
  };

  // ---------- reptiles & amphibians ----------
  D.snake = function (o) {
    o = Object.assign({ len: 50, s: 1, rattle: false, hood: false }, o);
    return { w: (o.len + 12) * o.s, h: 16 * o.s, draw(p, e, t) { p.ctx.scale(o.s, o.s); D.drawSnake(p, e, t, o); } };
  };
  D.drawSnake = function (p, e, t, o) {
    const len = o.len, ph = e.phase * 2 + t * 2;
    const pts = [], n = 12;
    for (let i = 0; i <= n; i++) pts.push(-len / 2 + (len - 12) * i / n, 4 + Math.sin(i * 1.1 - ph) * 3);
    p.path(pts, false);
    const hx = len / 2 - 8 + 4, hy = 4 + Math.sin(n * 1.1 - ph) * 3 - 4;
    if (o.hood) p.ellipse(hx - 2, hy + 2, 7, 9, true);
    p.ellipse(hx, hy, 6, 4, true);
    D.eye(p, hx + 2, hy - 1.5, 1.4, e, 0);
    if (Math.sin(t * 8) > 0.3) { p.line(hx + 6, hy + 1, hx + 12, hy + 1); p.line(hx + 12, hy + 1, hx + 14, hy - 1); p.line(hx + 12, hy + 1, hx + 14, hy + 3); }
    if (o.rattle) for (let k = 0; k < 3; k++) p.circle(-len / 2 - 2 - k * 3, 4, 2, true);
  };
  D.frog = function (s) {
    s = s || 1;
    return {
      w: 30 * s, h: 20 * s, draw(p, e, t) {
        p.ctx.scale(s, s);
        const inAir = !e.grounded && !e.held;
        if (inAir) { p.line(-8, 4, -18, -2); p.line(-18, -2, -22, 8); p.line(-22, 8, -27, 8); }
        else { p.line(-8, 4, -14, 8); p.line(-14, 8, -19, 8); p.line(-9, 6, -15, 9); }
        p.ellipse(0, 2, 13, 8, true);
        p.line(6, 6, 8, 10); p.line(8, 10, 12, 10); p.line(2, 7, 2, 10); p.line(2, 10, 5, 10);
        D.eye(p, -4, -6, 3, e, -1); D.eye(p, 5, -6, 3, e, 1);
        if (e.mood === 'happy') p.arc(2, -1, 8, 0.3, Math.PI - 0.3); else if (e.mood === 'scared') p.ellipse(3, 1, 3, 2, true); else p.line(-6, 1, 12, 0);
      }
    };
  };

  // ---------- vehicles ----------
  // A little stick rider. hip at (x,y); pedal circle optional.
  D.rider = function (p, e, t, x, y, o) {
    o = Object.assign({ handX: x + 16, handY: y - 8, pedalX: 0, pedalY: 0, pedalR: 0, stand: false, lean: 0 }, o);
    const held = e.held, moving = e.moving;
    const sx = x + 2 + o.lean * 6, sy = y - 16;
    p.line(x, y, sx, sy);                 // body
    p.circle(sx + 1, sy - 6, 5.5, true);  // head
    const ex = sx + 1, ey = sy - 7;
    D.eye(p, ex - 2, ey, 1.2, e, -1); D.eye(p, ex + 2, ey, 1.2, e, 1);
    D.mouth(p, ex, ey + 3, 4, e);
    if (held) { p.line(sx, sy + 2, sx - 8, sy - 10); p.line(sx, sy + 2, sx + 10, sy - 10); }
    else { p.line(sx, sy + 2, o.handX, o.handY); p.line(sx, sy + 2, o.handX - 2, o.handY + 1); }
    if (o.pedalR) {
      const a = e.wheel * 1.5;
      for (let k = 0; k < 2; k++) {
        const aa = a + k * Math.PI;
        const px = o.pedalX + Math.cos(aa) * o.pedalR, py = o.pedalY + Math.sin(aa) * o.pedalR;
        const kx = (x + px) / 2 + 6, ky = (y + py) / 2 - 4;
        p.line(x, y, kx, ky); p.line(kx, ky, px, py);
      }
    } else if (o.stand) {
      p.line(x, y, x - 7, y + 20); p.line(x, y, x + 7, y + 20);
    } else {
      p.line(x, y, x + 8, y + 8); p.line(x + 8, y + 8, x + 6, y + 16);
    }
  };

  D.vehicle = function (kind, o) {
    o = o || {};
    const sizes = {
      car: [92, 46], racecar: [104, 36], police: [92, 54], taxi: [92, 54], limo: [150, 46], truck: [124, 62], monstertruck: [112, 76],
      firetruck: [136, 66], ambulance: [116, 64], bus: [156, 62], tractor: [92, 66], tank: [114, 52], train: [128, 66], bike: [64, 68],
      motorcycle: [72, 58], scooter: [52, 68], skateboard: [46, 60], plane: [112, 48], jet: [112, 42], helicopter: [104, 62],
      rocket: [36, 92], ufo: [92, 36], boat: [92, 74], ship: [140, 110], submarine: [104, 46], hotairballoon: [72, 126],
      blimp: [124, 56], icecreamtruck: [124, 66], digger: [110, 70]
    };
    const [w, h] = sizes[kind] || [80, 40];
    return { w, h, draw(p, e, t) { p.ctx.translate(0, h / 2); D.drawVehicle(p, e, t, kind, o); } };
  };

  D.drawVehicle = function (p, e, t, kind, o) {
    const wa = e.wheel, c = p.ctx;
    const flying = e.flying;
    const carBody = (dy) => {
      p.poly([-44, -9 + dy, -44, -22 + dy, -30, -24 + dy, -20, -40 + dy, 14, -40 + dy, 26, -24 + dy, 44, -22 + dy, 44, -9 + dy], true);
      p.poly([-17, -37 + dy, -25, -25 + dy, -3, -25 + dy, -3, -37 + dy], true);
      p.poly([0, -37 + dy, 0, -25 + dy, 22, -25 + dy, 11, -37 + dy], true);
      p.line(-3, -25 + dy, -3, -12 + dy);
      p.dot(41, -17 + dy, 1.8);
    };
    switch (kind) {
      case 'car': carBody(0); D.wheel(p, -26, -9, 9, wa); D.wheel(p, 26, -9, 9, wa); break;
      case 'police':
        carBody(0); p.rect(-9, -46, 18, 6, true); p.line(0, -46, 0, -40);
        if (Math.floor(t * 4) % 2) p.rect(-9, -46, 9, 6, '#000'); else p.rect(0, -46, 9, 6, '#000');
        p.text('POLICE', 0, -16, 9); D.wheel(p, -26, -9, 9, wa); D.wheel(p, 26, -9, 9, wa); break;
      case 'taxi': carBody(0); p.rect(-9, -46, 18, 6, true); p.text('TAXI', 0, -16, 10); D.wheel(p, -26, -9, 9, wa); D.wheel(p, 26, -9, 9, wa); break;
      case 'limo':
        p.poly([-74, -9, -74, -22, -60, -24, -50, -40, 14, -40, 26, -24, 74, -22, 74, -9], true);
        for (let k = 0; k < 4; k++) p.rect(-47 + k * 16, -37, 12, 12, true);
        p.poly([18, -37, 18, -25, 22, -25, 11, -37], true);
        p.dot(71, -17, 1.8); D.wheel(p, -52, -9, 9, wa); D.wheel(p, 52, -9, 9, wa); break;
      case 'racecar':
        p.poly([-50, -8, -50, -14, -22, -16, -12, -28, 12, -28, 22, -16, 50, -14, 50, -8], true);
        p.poly([-10, -26, -18, -16, 12, -16, 8, -26], true);
        p.rect(-52, -34, 16, 3, true); p.line(-46, -31, -46, -16);
        p.text('1', 0, -22, 9); D.wheel(p, -30, -8, 8, wa); D.wheel(p, 30, -8, 8, wa); break;
      case 'monstertruck':
        c.save(); c.translate(0, -26); carBody(0); c.restore();
        p.line(-26, -35, -26, -22); p.line(26, -35, 26, -22);
        D.wheel(p, -30, -18, 18, wa); D.wheel(p, 30, -18, 18, wa); break;
      case 'truck': case 'icecreamtruck':
        p.rect(-62, -58, 80, 48, true);
        p.poly([20, -10, 20, -42, 30, -54, 60, -54, 60, -10], true);
        p.rect(34, -50, 22, 16, true);
        p.dot(58, -22, 1.8);
        if (kind === 'icecreamtruck') { p.text('ICE CREAM', -22, -36, 12); p.poly([-30, -58, -18, -58, -24, -74], true); p.circle(-24, -78, 7, true); }
        D.wheel(p, -44, -10, 10, wa); D.wheel(p, -20, -10, 10, wa); D.wheel(p, 42, -10, 10, wa); break;
      case 'firetruck':
        p.rect(-68, -54, 90, 44, true);
        p.poly([22, -10, 22, -44, 32, -56, 66, -56, 66, -10], true);
        p.rect(38, -52, 24, 16, true);
        p.line(-64, -58, 10, -58); p.line(-64, -64, 10, -64); for (let k = 0; k < 7; k++) p.line(-60 + k * 11, -58, -60 + k * 11, -64);
        p.text('FIRE', -22, -32, 14);
        p.circle(50, -60, 3, true);
        D.wheel(p, -48, -10, 10, wa); D.wheel(p, -20, -10, 10, wa); D.wheel(p, 46, -10, 10, wa); break;
      case 'ambulance':
        p.rect(-58, -56, 82, 46, true);
        p.poly([24, -10, 24, -44, 34, -56, 58, -56, 58, -10], true);
        p.rect(38, -52, 16, 16, true);
        p.line(-18, -42, -18, -24); p.line(-27, -33, -9, -33);
        p.rect(-6, -62, 12, 6, Math.floor(t * 4) % 2 ? '#000' : true);
        D.wheel(p, -40, -10, 10, wa); D.wheel(p, 40, -10, 10, wa); break;
      case 'bus':
        p.poly([-78, -10, -78, -52, -70, -58, 70, -58, 78, -52, 78, -10], true);
        for (let k = 0; k < 6; k++) p.rect(-68 + k * 22, -52, 16, 16, true);
        p.rect(64, -52, 10, 40, true);
        if (o.school) p.text('SCHOOL BUS', 0, -28, 12);
        p.dot(76, -22, 1.8);
        D.wheel(p, -50, -10, 10, wa); D.wheel(p, 50, -10, 10, wa); break;
      case 'tractor':
        p.poly([-40, -40, -2, -40, -2, -32, 20, -32, 42, -24, 42, -10, 12, -10, 12, -18, -12, -18, -12, -10, -40, -10], true);
        p.rect(-26, -66, 30, 26); p.line(-11, -66, -11, -40);
        p.line(14, -32, 14, -54); p.line(18, -32, 18, -54); p.line(12, -54, 20, -54);
        D.wheel(p, -20, -20, 20, wa * 0.5); D.wheel(p, 30, -10, 10, wa);
        D.rider(p, e, t, -14, -46, { handX: 4, handY: -50 }); break;
      case 'digger':
        p.rect(-48, -40, 50, 30, true); p.rect(-40, -36, 20, 16, true);
        p.line(2, -30, 30, -50); p.line(30, -50, 50, -20); p.poly([44, -22, 56, -22, 54, -8, 40, -8], true);
        p.poly([-54, -10, -50, -4, 4, -4, 8, -10], true);
        D.wheel(p, -42, -10, 7, wa); D.wheel(p, -22, -10, 7, wa); D.wheel(p, -2, -10, 7, wa); break;
      case 'tank':
        p.poly([-56, -22, -50, -3, 50, -3, 56, -22], true);
        for (let k = 0; k < 5; k++) D.wheel(p, -40 + k * 20, -12, 6, wa);
        p.poly([-46, -22, -40, -32, 40, -32, 46, -22], true);
        p.arc(-6, -32, 15, Math.PI, TAU);
        p.line(6, -41, 54, -46); p.line(6, -37, 54, -42); p.line(54, -46, 54, -42);
        break;
      case 'train':
        p.rect(-58, -58, 46, 48, true); p.rect(-50, -52, 30, 18, true);
        p.rect(-12, -44, 62, 34, true); p.arc(50, -27, 17, -Math.PI / 2, Math.PI / 2);
        p.rect(28, -60, 12, 18, true);
        p.poly([52, -12, 64, -2, 52, -2], true);
        D.wheel(p, -42, -10, 10, wa); D.wheel(p, -16, -10, 10, wa); D.wheel(p, 14, -10, 8, wa); D.wheel(p, 36, -10, 8, wa);
        p.line(-42 + Math.cos(wa) * 6, -10 + Math.sin(wa) * 6, 36 + Math.cos(wa) * 6, -10 + Math.sin(wa) * 6);
        break;
      case 'bike':
        D.wheel(p, -20, -13, 13, wa); D.wheel(p, 20, -13, 13, wa);
        p.line(-20, -13, -6, -36); p.line(-6, -36, 14, -38); p.line(14, -38, 20, -13);
        p.line(0, -13, -6, -36); p.line(0, -13, 14, -38); p.line(0, -13, -20, -13);
        p.line(-12, -37, -2, -37); p.line(14, -40, 22, -44);
        D.rider(p, e, t, -6, -40, { handX: 20, handY: -44, pedalX: 0, pedalY: -13, pedalR: 6 });
        break;
      case 'motorcycle':
        D.wheel(p, -22, -11, 11, wa); D.wheel(p, 22, -11, 11, wa);
        p.poly([-22, -16, -24, -28, 6, -32, 20, -24, 18, -14], true);
        p.line(14, -32, 26, -44); p.line(-14, -16, -30, -10);
        D.rider(p, e, t, -12, -32, { handX: 24, handY: -44, lean: 0.5 });
        break;
      case 'scooter':
        D.wheel(p, -16, -6, 6, wa); D.wheel(p, 16, -6, 6, wa);
        p.line(-16, -12, 12, -12); p.line(14, -12, 20, -54); p.line(12, -54, 28, -54);
        D.rider(p, e, t, -4, -34, { handX: 22, handY: -54, stand: true });
        break;
      case 'skateboard':
        p.poly([-22, -10, -18, -7, 18, -7, 22, -10], true);
        D.wheel(p, -12, -4, 4, wa); D.wheel(p, 12, -4, 4, wa);
        D.rider(p, e, t, -2, -30, { handX: 12, handY: -34, stand: true });
        break;
      case 'plane': {
        if (!flying) { p.line(20, -14, 20, -6); p.line(-20, -14, -20, -6); p.circle(20, -4, 4, true); p.circle(-20, -4, 4, true); }
        p.poly([-40, -20, -50, -44, -34, -44, -26, -22], true);
        p.line(-48, -30, -30, -30);
        p.ellipse(0, -22, 50, 10, true);
        p.poly([-6, -20, 12, -20, 16, -8, -16, -8], true);
        for (let k = 0; k < 4; k++) p.circle(-20 + k * 12, -25, 2.5, true);
        p.line(20, -29, 32, -26);
        const a = wa * 3 + t * (flying ? 40 : 0);
        p.line(50, -22 - Math.sin(a) * 14, 50, -22 + Math.sin(a) * 14);
        break;
      }
      case 'jet':
        p.poly([-52, -14, -44, -26, 28, -26, 54, -18, 30, -10, -52, -10], true);
        p.poly([-36, -26, -30, -42, -18, -42, -12, -26], true);
        p.poly([-10, -12, 20, -12, 6, -2, -24, -2], true);
        p.poly([14, -26, 30, -26, 26, -32, 18, -32], true);
        if (flying) { p.line(-54, -12, -66, -12); p.line(-54, -16, -70, -16); p.line(-54, -20, -62, -20); }
        else { p.line(10, -10, 10, -4); p.circle(10, -3, 3, true); p.line(-30, -10, -30, -4); p.circle(-30, -3, 3, true); }
        break;
      case 'helicopter': {
        p.line(-18, -8, 18, -8); p.line(-10, -8, -8, -14); p.line(10, -8, 8, -14);
        p.ellipse(0, -28, 24, 14, true);
        p.poly([8, -40, 22, -34, 20, -26, 8, -26], true);
        p.line(-22, -30, -50, -36); p.line(-20, -24, -50, -32);
        p.poly([-50, -36, -50, -48, -44, -48, -46, -36], true);
        p.line(0, -42, 0, -50);
        const spin = flying ? t * 30 : wa;
        p.line(-48 * Math.abs(Math.cos(spin)) - 2, -50, 48 * Math.abs(Math.cos(spin)) + 2, -50);
        p.line(-52, -44 - Math.sin(spin) * 6, -52, -44 + Math.sin(spin) * 6);
        break;
      }
      case 'rocket':
        p.poly([-10, -72, -10, -92, 0, -104, 10, -92, 10, -72], true);
        p.rect(-10, -72, 20, 60, true);
        p.poly([-10, -30, -20, -8, -10, -12], true); p.poly([10, -30, 20, -8, 10, -12], true);
        p.circle(0, -60, 5, true); p.line(-4, -40, -4, -20); p.line(4, -40, 4, -20);
        if (e.thrust > 0) { c.save(); c.translate(0, -12); c.scale(1, -1); D.flame(p, 0, 0, 10, t, e.seed); c.restore(); }
        break;
      case 'ufo': {
        p.arc(0, -20, 15, Math.PI, TAU);
        p.ellipse(0, -18, 44, 9, true);
        for (let k = 0; k < 5; k++) { const x = -32 + k * 16; if ((Math.floor(t * 3) + k) % 2) p.dot(x, -12, 2.2); else p.circle(x, -12, 2.2); }
        D.eye(p, -5, -26, 2.2, e, -1); D.eye(p, 5, -26, 2.2, e, 1);
        break;
      }
      case 'boat':
        p.line(0, -20, 0, -68); p.poly([3, -66, 32, -26, 3, -26], true);
        p.poly([-42, -22, -32, -2, 32, -2, 46, -22], true);
        p.line(-30, -14, 36, -14); p.circle(-14, -8, 2.5); p.circle(6, -8, 2.5);
        p.poly([0, -70, 8, -74, 0, -78], true);
        break;
      case 'ship':
        p.line(-30, -40, -30, -96); p.line(20, -40, 20, -86);
        p.poly([-27, -92, -4, -92, -8, -60, -27, -60], true); p.poly([23, -82, 44, -82, 40, -54, 23, -54], true);
        p.poly([-27, -104, -14, -100, -27, -96], true); p.circle(-21, -100, 2.5, true); p.line(-23, -99, -19, -101); p.line(-19, -99, -23, -101);
        p.poly([-66, -42, -54, -4, 54, -4, 70, -50, 50, -40], true);
        p.line(-52, -30, 60, -30); for (let k = 0; k < 4; k++) p.circle(-30 + k * 22, -18, 3);
        break;
      case 'submarine':
        p.ellipse(0, -18, 46, 14, true);
        p.rect(-10, -44, 20, 14, true); p.line(4, -44, 4, -56); p.line(4, -56, 12, -56);
        for (let k = 0; k < 3; k++) p.circle(-20 + k * 16, -18, 4);
        p.line(-46, -18, -56, -18); p.line(-56, -26 + Math.sin(wa * 4) * 4, -56, -10 - Math.sin(wa * 4) * 4);
        p.poly([-40, -32, -30, -26, -44, -24], true);
        break;
      case 'hotairballoon':
        p.ellipse(0, -90, 34, 34, true); for (let k = -2; k <= 2; k++) p.curve(0, -124, k * 22, -90, 0, -56);
        p.line(-12, -58, -12, -22); p.line(12, -58, 12, -22);
        p.rect(-14, -22, 28, 20, true); p.line(-14, -12, 14, -12);
        p.circle(0, -30, 5, true); D.eye(p, -2, -31, 1.2, e, -1); D.eye(p, 2, -31, 1.2, e, 1); p.line(0, -25, 0, -22); p.line(-6, -22, 0, -25); p.line(6, -22, 0, -25);
        break;
      case 'blimp':
        p.ellipse(0, -32, 58, 20, true);
        p.poly([-50, -40, -66, -50, -60, -32], true); p.poly([-50, -24, -66, -14, -60, -32], true);
        p.rect(-14, -14, 28, 10, true); p.line(-12, -14, -8, -12); p.line(12, -14, 8, -12);
        break;
    }
  };

  // ---------- werewolf: hunched, shaggy, clawed ----------
  D.werewolf = function (size) {
    const u = (size || 86) / 86;
    return { w: 60 * u, h: 86 * u, draw(p, e, t) { p.ctx.translate(-2 * u, 3 * u); D.drawWerewolf(p, e, t, u); } };
  };
  D.drawWerewolf = function (p, e, t, u) {
    const mood = e.mood, held = e.held;
    const walking = e.moving && e.grounded;
    const inAir = !e.grounded && !held;
    const ph = e.phase;
    const sw = walking ? Math.sin(ph) : 0;
    const fl = held ? Math.sin(t * 14) * 0.6 : 0;
    const angry = mood === 'angry' || e.mode === 'hunt' || mood === 'scared';
    const hipX = -2 * u, hipY = 6 * u;
    const claws = (hx, hy, dir) => { p.line(hx, hy, hx + dir * 3 * u, hy + 4 * u); p.line(hx, hy, hx + dir * 4.5 * u, hy + 2 * u); p.line(hx, hy, hx + dir * 4.5 * u, hy - 1.5 * u); };
    // digitigrade leg: hip -> knee (forward) -> hock (back) -> paw, drawn as furry slabs
    const leg = (a, off) => {
      const hx0 = hipX + off, hy0 = hipY;
      const kx = hx0 + 8 * u + a * 5 * u, ky = hipY + 12 * u;
      const ax = hx0 + 2 * u + a * 8 * u, ay = hipY + 24 * u;
      const lift = walking ? Math.max(0, a) * 4 * u : 0;
      const fx = ax + 5 * u + a * 4 * u, fy = 40 * u - lift;
      p.poly([hx0 - 4 * u, hy0, hx0 + 4 * u, hy0 + 1 * u, kx + 3 * u, ky, kx - 3 * u, ky + 2 * u], true);
      p.poly([kx - 3 * u, ky, kx + 3 * u, ky, ax + 2.5 * u, ay, ax - 2.5 * u, ay], true);
      p.line(ax, ay, fx, fy);
      p.line(fx, fy, fx + 9 * u, fy); p.line(fx + 9 * u, fy, fx + 11 * u, fy - 2.5 * u); p.line(fx + 5 * u, fy, fx + 6 * u, fy - 2.5 * u); p.line(fx + 1 * u, fy, fx + 2 * u, fy - 2 * u);
    };
    // arm: shoulder -> elbow -> clawed hand
    const arm = (front, a) => {
      const sx = 7 * u, sy = -16 * u;
      let ex, ey, hx, hy;
      if (held || inAir || mood === 'scared') {
        const k = held ? fl : 0;
        if (front) { ex = sx + 12 * u; ey = sy - 8 * u; hx = sx + 22 * u + k * 4 * u; hy = sy - 26 * u; }
        else { ex = sx - 6 * u; ey = sy - 8 * u; hx = sx - 11 * u - k * 4 * u; hy = sy - 24 * u; }
      } else if (mood === 'dizzy') { ex = sx + 10 * u; ey = sy - 2 * u; hx = sx + 20 * u; hy = sy - 4 * u; }
      else { const r = front ? 1 : 0.7; ex = sx + 9 * u * r + a * 3 * u; ey = sy + 9 * u; hx = sx + 17 * u * r + a * 5 * u; hy = sy + 17 * u - (angry ? 6 * u : 0); }
      p.line(sx, sy, ex, ey); p.line(ex, ey, hx, hy); claws(hx, hy, 1);
    };
    // tail (bushy, wagging)
    const c = p.ctx;
    c.save(); c.translate(-6 * u, 4 * u); c.rotate(-0.35 + Math.sin(t * 3 + e.seed) * 0.1);
    p.fuzz(-11 * u, 0, 12 * u, 5 * u, true, 7);
    c.restore();
    // back limbs
    arm(false, -sw * 0.5);
    const stance = walking ? 0 : inAir ? 0.5 : 0.25;
    leg(-sw - stance, -5 * u);
    leg(sw + stance, 3 * u);
    // hunched torso with shaggy back
    p.poly([-6 * u, 8 * u, -10 * u, -6 * u, -3 * u, -19 * u, 8 * u, -24 * u, 16 * u, -16 * u, 13 * u, -2 * u, 5 * u, 10 * u], true);
    p.zigzag(-6 * u, 8 * u, -3 * u, -19 * u, 4 * u, 9);
    p.line(4 * u, -10 * u, 7 * u, -6 * u); p.line(6 * u, -12 * u, 9 * u, -8 * u);
    // torn shorts
    p.poly([-7 * u, 2 * u, 9 * u, 1 * u, 10 * u, 14 * u, 6 * u, 12 * u, 4 * u, 17 * u, 0, 13 * u, -3 * u, 18 * u, -7 * u, 14 * u], true);
    // front arm
    arm(true, sw * 0.5);
    // neck + head (profile)
    const hx = 16 * u, hy = -29 * u, hr = 8 * u;
    p.line(6 * u, -20 * u, hx - 4 * u, hy + 4 * u); p.line(11 * u, -20 * u, hx + 1 * u, hy + 6 * u);
    p.poly([10 * u, -34 * u, 5 * u, -47 * u, 14 * u, -36 * u], true);
    p.circle(hx, hy, hr, true);
    p.poly([14 * u, -35 * u, 12 * u, -48 * u, 20 * u, -37 * u], true);
    p.zigzag(hx - hr, hy + 2 * u, hx - hr + 1 * u, hy - 6 * u, 3.5 * u, 4);
    // muzzle
    p.poly([hx + 4 * u, hy - 4 * u, hx + 15 * u, hy - 0.5 * u, hx + 16 * u, hy + 3 * u, hx + 5 * u, hy + 7 * u], true);
    p.dot(hx + 15 * u, hy + 1 * u, 1.5 * u);
    if (angry) {
      p.poly([hx + 5 * u, hy + 7 * u, hx + 15 * u, hy + 4 * u, hx + 13 * u, hy + 12 * u, hx + 5 * u, hy + 11 * u], true);
      p.zigzag(hx + 6 * u, hy + 7 * u, hx + 14 * u, hy + 4.5 * u, 3 * u, 5);
      p.zigzag(hx + 6 * u, hy + 10 * u, hx + 13 * u, hy + 9 * u, -2.5 * u, 4);
    } else {
      p.line(hx + 5 * u, hy + 7 * u, hx + 15 * u, hy + 4 * u);
      p.poly([hx + 7 * u, hy + 6.5 * u, hx + 9.5 * u, hy + 6 * u, hx + 8.5 * u, hy + 10 * u], true);
      p.poly([hx + 12 * u, hy + 5 * u, hx + 14 * u, hy + 4.5 * u, hx + 13.5 * u, hy + 8.5 * u], true);
    }
    D.eye(p, hx + 3 * u, hy - 2 * u, 2 * u, e, 0);
  };
})();
