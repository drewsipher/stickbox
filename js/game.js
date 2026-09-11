'use strict';
// game.js — world, physics, specials, particles, input, trash bin, UI and the render loop.
(function () {
  const D = SB.D, pick = SB.pick, TAU = SB.TAU;
  const G = 1700; // gravity px/s^2
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  const W = SB.world = {
    entities: [], particles: [], time: 0, W: 800, H: 600, groundY: 540, dpr: 1,
    cursor: { x: -1000, y: -1000, in: false, vx: 0, vy: 0, down: false, hist: [] },
    held: null, hoverE: null, shakeT: 0, shakeA: 0, flash: 0, bin: { x: 0, y: 0, w: 66, h: 74, open: 0, wob: 0 },
    hint: '', hintT: 0, stats: { spawned: 0, trashed: 0 }
  };
  let canvas, ctx, pen, lastT = 0, boil = 0;

  // ---------- helpers ----------
  W.shake = function (a) { W.shakeA = Math.max(W.shakeA, a); W.shakeT = 0.25; };
  W.toast = function (msg, dur) { W.hint = msg; W.hintT = dur || 2.5; const el = document.getElementById('toast'); if (el) { el.textContent = msg; el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => { el.hidden = true; }, (dur || 2.5) * 1000); } };

  W.particle = function (type, x, y, o) {
    o = o || {};
    if (W.particles.length > 600) W.particles.shift();
    W.particles.push({ type, x, y, vx: o.vx || 0, vy: o.vy || 0, life: o.life || 0.6, max: o.life || 0.6, size: o.size || 6, text: o.text || '', rot: o.rot || 0, rv: o.rv || 0, g: o.g == null ? 0 : o.g, seed: Math.random() * 100, tx: o.tx || 0, ty: o.ty || 0 });
  };
  W.burst = function (type, x, y, n, speed, o) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = speed * (0.4 + Math.random() * 0.8);
      W.particle(type, x, y, Object.assign({ vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + Math.random() * 0.5, size: (o && o.size) || 5, rv: (Math.random() - 0.5) * 10 }, o || {}));
    }
  };
  W.puff = function (x, y, n, size) { for (let i = 0; i < (n || 6); i++) W.particle('puff', x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20, { vx: (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 40, life: 0.5 + Math.random() * 0.3, size: size || 8 }); };
  W.popText = function (x, y, text, size) { W.particle('text', x, y, { text, size: size || 22, life: 0.9, vy: -40 }); };

  // ---------- spawning / removing ----------
  W.spawn = function (nameOrDef, x, y, mods) {
    const def = typeof nameOrDef === 'string' ? SB.DEFS[nameOrDef] : nameOrDef;
    if (!def) return null;
    mods = mods || {};
    const e = new SB.Entity(def, 0, 0, mods);
    e.x = clamp(x == null ? W.W / 2 : x, e.w / 2 + 4, W.W - e.w / 2 - 4);
    e.y = y == null ? W.groundY - e.h / 2 - 20 : Math.min(y, W.groundY - e.h / 2);
    if (e.y < e.h / 2) e.y = e.h / 2;
    if (def.special === 'meteor' || def.special === 'lightning') { e.y = -e.h; e.vy = def.special === 'meteor' ? 450 : 1100; e.vx = def.special === 'meteor' ? (Math.random() - 0.5) * 300 : 0; }
    if (def.special === 'firework') e.specT = 0;
    if (def.special === 'rocket') e.specT = 0;
    W.entities.push(e);
    W.stats.spawned++;
    W.puff(e.x, e.y, 6, 8 * Math.sqrt(e.scale));
    if (def.hint && !mods.quiet) W.toast(def.hint, 2.2);
    return e;
  };
  W.remove = function (e, how) {
    if (!e.alive || e.dying) return;
    e.dying = 0.0001; e.dieHow = how || 'poof';
    if (e === W.held) { W.held = null; e.held = false; }
    if (how === 'trash') W.stats.trashed++;
  };
  W.convert = function (e, name, mods) {
    const def = SB.DEFS[name]; if (!def || !e.alive) return null;
    const n = new SB.Entity(def, e.x, e.y, Object.assign({}, e.mods, { scale: e.scale }, mods || {}));
    n.vx = e.vx; n.vy = e.vy; n.facing = e.facing; n.spawnT = 0.5;
    n.y = Math.min(n.y, W.groundY - n.h / 2);
    const i = W.entities.indexOf(e);
    if (i >= 0) W.entities[i] = n; else W.entities.push(n);
    if (e === W.held) { W.held = n; n.held = true; W.heldOff = { x: 0, y: 0 }; }
    e.alive = false;
    W.puff(e.x, e.y, 8, 8);
    return n;
  };
  W.explode = function (x, y, r, power) {
    for (const e of W.entities) {
      if (!e.alive || e.dying || e.static) continue;
      const dx = e.x - x, dy = e.y - y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d > r) continue;
      const k = (1 - d / r) * Math.min(1.5, 6 / Math.sqrt(e.mass));
      e.vx += dx / d * power * k; e.vy += (dy / d * power - power * 0.6) * k;
      e.grounded = false; e.held = false; if (W.held === e) W.held = null;
      e.angVel += (Math.random() - 0.5) * 12 * k;
      if (e.creature) { e.dizzy = Math.max(e.dizzy, 1.5 + k); e.say(pick(['!', 'Whoa!', 'Aaah!'])); }
      if (e.special === 'balloon') W.pop(e);
    }
    W.burst('spark', x, y, 22, 420, { size: 12, life: 0.5 });
    W.burst('puff', x, y, 10, 160, { size: 20, life: 0.8 });
    W.popText(x, y - 20, 'BOOM!', 34);
    W.shake(14);
  };
  W.pop = function (e) { if (!e.alive || e.dying) return; W.burst('spark', e.x, e.y - 6, 8, 160, { size: 6 }); W.popText(e.x, e.y - 20, 'Pop!', 20); W.remove(e, 'pop'); };
  W.extinguish = function (fire) { if (!fire.alive || fire.dying) return; W.burst('smoke', fire.x, fire.y - 10, 8, 40, { size: 10, life: 1.2 }); W.popText(fire.x, fire.y - 30, 'Psssh!', 18); W.remove(fire, 'poof'); };
  W.zap = function (e) { if (!e.alive || e.dying) return; e.vy -= 260; e.grounded = false; if (e.creature) { e.dizzy = Math.max(e.dizzy, 2); e.say('Zap!'); } W.burst('spark', e.x, e.y, 8, 200, { size: 8 }); };
  W.burn = function (e, src, dt) {
    if (!e.alive || e.dying || e === src) return;
    if (e.special === 'balloon' || e.special === 'bubble') { W.pop(e); return; }
    if (e.special === 'meltable') { e.meltT += dt * 4; if (e.meltT > 3) W.melt(e); return; }
    if (e.special === 'bomb') { e.fuse = Math.min(e.fuse, 0.2); return; }
    if (e.creature) {
      if (e.tags.has('fire') || e.tags.has('hot') || e.def.fireproof || e.ko) return;
      if (e.burnT <= 0) W.ignite(e, src);
      return;
    }
    if (e.tags.has('wood') || e.tags.has('paper') || e.tags.has('plant') || e.tags.has('hay')) { e.burnT += dt; if (Math.random() < dt * 8) W.particle('flame', e.x + (Math.random() - 0.5) * e.w, e.y + (Math.random() - 0.5) * e.h, { vy: -60, life: 0.5, size: 8 }); if (e.burnT > 2.5) { W.burst('smoke', e.x, e.y, 8, 40, { size: 10, life: 1 }); W.popText(e.x, e.y - 20, 'Burnt!', 18); W.remove(e, 'poof'); } }
  };
  W.ignite = function (e, src) {
    e.burnT = 1.0;
    e.onFire = 2.2; e.fireSrc = src; e.fireTick = 0.9;
    e.hp -= 1;
    e.say(pick(['Hot!', 'Yeow!', "I'm on fire!", 'Aaah! Hot!'])); e.setMood('scared', 2.5);
    e.vy = Math.min(e.vy, -320); e.vx = (e.x < src.x ? -1 : 1) * 260; e.grounded = false; e.threat = src;
    if (e.sleeping) e.sleeping = false;
    W.burst('spark', e.x, e.y, 5, 120, { size: 5 });
    if (e.hp <= 0) W.knockOut(e, null);
  };
  W.douse = function (e, quiet) {
    if (e.onFire <= 0) return;
    e.onFire = 0; e.fireSrc = null;
    if (!quiet) { e.say(pick(['Phew!', 'Ahh, better.', 'Thanks!'])); e.setMood('happy', 1); }
    W.burst('smoke', e.x, e.top, 6, 50, { size: 7, life: 0.9 });
    for (let i = 0; i < 5; i++) W.particle('drop', e.x + (Math.random() - 0.5) * e.w, e.y, { vx: (Math.random() - 0.5) * 120, vy: -80, g: 600, life: 0.5, size: 4 });
  };
  W.melt = function (e) { if (!e.alive || e.dying) return; W.particle('puddle', e.x, e.bottom - 2, { life: 3, size: e.w * 0.6 }); W.popText(e.x, e.y - 20, 'Melted!', 18); W.remove(e, 'melt'); };

  // ---------- catching things ----------
  function catchTarget(A, B) {
    if (A.victim === B || A.victimT > 0 && A.victim === B) return;
    A.victim = B; A.victimT = SB.battle ? 1.4 : 2.5; A.target = null; A.scanT = 0.5;
    if (SB.matches(B, A.eats) && !B.held) {
      if (B.creature && B.mass > A.mass * 1.2) { bonk(A, B); return; }
      W.remove(B, 'eaten'); A.say(pick(['Nom!', 'Gulp!', 'Yum!', 'Burp!', 'Munch!'])); A.setMood('happy', 1.5);
      W.puff(B.x, B.y, 5, 6);
      return;
    }
    if (A.convert && SB.matches(B, A.convert) && !B.tags.has('undead') && B.creature) { const z = W.convert(B, 'zombie'); if (z) z.say('Uuurgh...'); A.say('Braaains!'); W.shake(3); return; }
    if (A.special === 'extinguish' && B.special === 'fire') { W.extinguish(B); A.say('Psssh!'); return; }
    if (A.special === 'heal' && B.creature) { if (B.ko) { W.revive(B); A.say('All better!'); } else if (B.dizzy > 0 || B.hp < B.hpMax) { B.dizzy = 0; B.hp = B.hpMax; B.say('Thanks!'); A.say('All better!'); } return; }
    if (!B.creature) { // play with an item: kick it
      B.vy -= 160 * Math.min(2, A.mass / Math.max(0.2, B.mass)); B.vx += A.facing * 120; B.grounded = false;
      A.say(pick(A.def.say)); A.setMood('happy', 1);
      if (B.special === 'balloon' && A.tags.has('sharp')) W.pop(B);
      return;
    }
    bonk(A, B);
  }
  function bonk(A, B) {
    const dir = B.x >= A.x ? 1 : -1;
    const power = clamp(Math.sqrt(A.mass / Math.max(0.1, B.mass)), 0.4, 2.2);
    B.vx = dir * 240 * power; B.vy = -280 * Math.min(1.6, power); B.grounded = false;
    let dmg = clamp(Math.round(power), 1, 3);
    if (A.special === 'reap' && B.creature) { dmg = Math.max(dmg, B.hp); A.say('Reaped!'); }
    if (B.creature) B.hp -= dmg;
    if (SB.battle) { B.say(pick(['Ouch!', 'Hey!', 'Grr!', 'Oof!', 'Take that!', 'You\'ll pay!'])); B.setMood('angry', 1.5); B.attacker = A; B.target = A; B.victim = null; B.scanT = 0.6; }
    else { B.say(pick(['Ouch!', 'Yikes!', 'Eek!', 'Help!', 'Hey!'])); B.setMood('scared', 2); B.threat = A; B.scanT = 1; }
    if (power > 1.3) B.dizzy = Math.max(B.dizzy, 1.2);
    A.say(pick(A.def.roar || A.def.say)); A.setMood(A.tags.has('hero') || A.tags.has('pet') ? 'happy' : 'angry', 1);
    W.shake(2);
    W.burst('spark', B.x, B.y, 4, 120, { size: 5 });
    if (B.creature && B.hp <= 0) W.knockOut(B, A);
  }
  W.snap = function (trap, v) {
    if (!trap.armed || !trap.alive || trap.dying || trap.held || !v.creature || v.ko || v.held || v.flying || v.special === 'trap') return;
    if (v.bottom < trap.y - 4 || Math.abs(v.x - trap.x) > trap.w * 0.5) return;
    trap.armed = false; trap.snapT = 0;
    v.hp -= 2; v.dizzy = Math.max(v.dizzy, 2.5); v.vx = 0; v.vy = Math.min(v.vy, -180); v.grounded = false; v.x = trap.x;
    v.say(pick(['YEOW!', 'OUCH!!', 'My foot!'])); v.setMood('scared', 2.5);
    W.popText(trap.x, trap.top - 14, 'SNAP!', 24); W.burst('spark', trap.x, trap.y, 6, 140, { size: 5 }); W.shake(4);
    if (v.hp <= 0) W.knockOut(v, null);
  };
  W.knockOut = function (e, by) {
    if (e.ko || !e.alive || e.dying) return;
    e.ko = true; e.hp = 0; e.target = null; e.threat = null; e.dizzy = 0; e.sleeping = false; e.thrust = 0;
    e.koAngle = -Math.PI / 2 * e.facing;
    const w = e.w; e.w = e.h; e.h = w;                     // lies down
    e.y = Math.min(e.y, W.groundY - e.h / 2);
    e.vy = Math.min(e.vy, -160); e.grounded = false;
    e.say(pick(['X_X', 'Ugh...', 'I give up!', 'Nooo...']));
    W.burst('star', e.x, e.top, 6, 90, { size: 6, life: 1.2 });
    W.popText(e.x, e.top - 16, 'K.O.!', 24);
    if (by && by.creature && by.alive) { by.say(pick(['Victory!', 'Ha!', 'Winner!', 'Who\'s next?'])); by.setMood('happy', 2); }
    W.shake(3);
  };
  W.revive = function (e) {
    if (!e.ko || !e.alive) return;
    e.ko = false; e.hp = e.hpMax;
    const w = e.w; e.w = e.h; e.h = w;
    e.y = Math.min(e.y, W.groundY - e.h / 2); e.angle = 0; e.vy = -250; e.grounded = false;
    e.say(pick(['I\'m back!', 'Round two!', 'Ready!'])); e.setMood('angry', 1);
    W.burst('sparkle', e.x, e.y, 8, 100, { size: 5, life: 0.7 });
  };

  // ---------- poke (click without drag) ----------
  W.poke = function (e) {
    if (!e.alive || e.dying) return;
    if (e.ko) { W.revive(e); return; }
    if (e.sleeping) { e.sleeping = false; e.say('Huh?!'); e.setMood('scared', 1); e.vy = -200; e.grounded = false; return; }
    switch (e.special) {
      case 'balloon': W.pop(e); return;
      case 'bubble': W.pop(e); return;
      case 'rocket': if (e.thrust <= 0) { e.thrust = 2.6; e.say('BLAST OFF!'); W.shake(4); } return;
      case 'firework': if (e.thrust <= 0) { e.thrust = 1.3; } return;
      case 'cannon': case 'tank': fireCannon(e); return;
      case 'toilet': flush(e); return;
      case 'bell': e.ring = 1.2; e.say(pick(['Ding dong!', 'DING!', 'Ring ring!'])); W.shake(2); for (const o of W.entities) if (o.creature && Math.hypot(o.x - e.x, o.y - e.y) < 260) o.setMood('happy', 1.5); return;
      case 'phone': e.ring = 1.5; e.say('Ring ring!'); for (const o of W.entities) if (o.tags.has('human') && Math.hypot(o.x - e.x, o.y - e.y) < 260) { o.say('Hello?'); o.target = e; o.mode = 'hunt'; } return;
      case 'present': {
        const names = SB.ORDER.filter(n => { const d = SB.DEFS[n]; return !d.hidden && !d.static && d.special !== 'blackhole' && d.special !== 'meteor' && d.special !== 'tornado' && d.mass < 30; });
        const n = pick(names); W.popText(e.x, e.y - 30, 'Surprise!', 20); W.burst('confetti', e.x, e.y, 16, 220, { size: 5, g: 600, life: 1.2 });
        const s = W.spawn(n, e.x, e.y - 10, { scale: Math.min(1, e.scale), quiet: true }); if (s) s.vy = -250;
        W.remove(e, 'poof'); return;
      }
      case 'chest': if (!e.opened) { e.opened = true; W.popText(e.x, e.y - 30, 'Treasure!', 20); for (let i = 0; i < 6; i++) { const c = W.spawn('coin', e.x, e.y - 20, { quiet: true }); if (c) { c.vx = (Math.random() - 0.5) * 400; c.vy = -300 - Math.random() * 250; } } } else { e.opened = false; } return;
      case 'potion': {
        const names = SB.ORDER.filter(n => (SB.DEFS[n].cat === 'animal' || SB.DEFS[n].cat === 'creature') && !SB.DEFS[n].hidden && SB.DEFS[n].mass < 20);
        W.popText(e.x, e.y - 30, 'Glug! POOF!', 20); W.burst('sparkle', e.x, e.y, 12, 120, { size: 6, life: 0.8 });
        W.spawn(pick(names), e.x, e.y - 10, { quiet: true }); W.remove(e, 'poof'); return;
      }
      case 'camera': e.flash = 1; W.flash = 1; e.say('Click!'); for (const o of W.entities) if (o.creature && Math.hypot(o.x - e.x, o.y - e.y) < 300) { o.setMood(o.temper === 'timid' ? 'scared' : 'happy', 1.5); if (o.tags.has('monster') && o.temper === 'timid') o.threat = e; } return;
      case 'grave': { const z = W.spawn('zombie', e.x, e.y - 20, { quiet: true }); if (z) { z.vy = -300; z.say('Uuurgh...'); } W.shake(5); W.puff(e.x, e.y, 8, 10); return; }
      case 'fan': e.facing *= -1; e.say('Whirr!'); return;
      case 'trap': if (!e.armed) { e.armed = true; e.say('*click*'); } else { e.armed = false; e.snapT = 0; W.popText(e.x, e.top - 14, 'SNAP!', 20); W.shake(2); } return;
      case 'water': W.burst('drop', e.x, e.y - 10, 10, 160, { size: 6, g: 700 }); e.say('Splash!'); return;
      case 'dice': e.face = 1 + Math.floor(Math.random() * 6); e.vy = -260; e.angVel = (Math.random() - 0.5) * 20; e.grounded = false; return;
    }
    if (e.creature) {
      if (e.grounded && !e.flying) { e.vy = -Math.min(320, 160 + 60 / Math.sqrt(e.mass) * 4); e.grounded = false; }
      if (e.temper === 'hostile') { e.say(pick(e.def.roar || e.def.say)); e.setMood('angry', 1); W.shake(2); }
      else { e.say(pick(e.def.say) || pick(['!', '?', 'Hey!'])); e.setMood(e.temper === 'timid' ? 'scared' : 'happy', 1.2); }
      if (e.tags.has('pet') || e.tags.has('human')) W.particle('heart', e.x, e.top - 6, { vy: -40, life: 0.9, size: 7 });
    } else {
      if (!e.static) { e.vy = -180; e.angVel = (Math.random() - 0.5) * 6; e.grounded = false; }
      W.burst('spark', e.x, e.y, 3, 60, { size: 4 });
    }
  };
  function fireCannon(e) {
    const dir = e.facing;
    const b = W.spawn('bowling ball', e.x + dir * e.w * 0.4, e.y - e.h * 0.3, { scale: 0.7 * e.scale, quiet: true });
    if (!b) return;
    b.vx = dir * 1100; b.vy = e.special === 'tank' ? -200 : -560; b.grounded = false;
    W.burst('smoke', b.x, b.y, 8, 80, { size: 10, life: 0.8 }); W.popText(b.x + dir * 30, b.y - 20, 'BOOM!', 24); W.shake(8);
    e.vx -= dir * 120;
  }
  function flush(e) {
    e.say('Flush!'); W.shake(3);
    for (let i = 0; i < 8; i++) W.particle('drop', e.x + (Math.random() - 0.5) * 20, e.y - 6, { vx: (Math.random() - 0.5) * 100, vy: -60 - Math.random() * 60, g: 400, life: 0.6, size: 4 });
    for (const o of W.entities) if (o !== e && o.alive && !o.dying && !o.static && o.mass < 4 && Math.abs(o.x - e.x) < 30 && o.bottom <= e.y + 6 && o.bottom > e.top - 40) { W.remove(o, 'hole'); W.popText(o.x, o.y - 20, 'Bye bye!', 16); }
  }

  // ---------- physics ----------
  function impact(e, v) {
    if (v < 260) return;
    if (v > 300 && !e.creature) W.puff(e.x, e.bottom, 3, 5);
    if (e.special === 'dice') e.face = 1 + Math.floor(Math.random() * 6);
    if (e.special === 'bomb' && v > 700) e.fuse = Math.min(e.fuse, 0.05);
    if (e.special === 'egg' && v > 420) e.specT = 100;
    if (e.special === 'meteor') { W.explode(e.x, e.bottom, 260 * e.scale, 1000); W.remove(e, 'boom'); return; }
    if (e.special === 'lightning') { for (const o of W.entities) if (o !== e && o.alive && Math.abs(o.x - e.x) < 90 && o.bottom > e.y - 60) W.zap(o); W.burst('spark', e.x, e.bottom, 14, 300, { size: 10 }); W.popText(e.x, e.y - 30, 'ZAP!', 26); W.remove(e, 'poof'); return; }
    if (e.creature && v > 980 && e.age > 1.2) {
      e.dizzy = Math.max(e.dizzy, 1.2 + Math.min(2, (v - 980) / 500));
      e.say(pick(['Ouch!', 'Oof!', 'Ow!', '@_@']));
      W.burst('star', e.x, e.top, 3, 60, { size: 6, life: 1 });
    }
  }

  function integrate(e, dt) {
    if (e.held || e.dying || !e.alive) return;
    const flying = (e.move === 'fly' || e.move === 'float') && !e.sleeping && e.dizzy <= 0 && e.spawnT >= 0.15 && !e.static && !e.ko;
    e.flying = flying;
    if (e.static && e.grounded) { e.vx = 0; e.vy = 0; }
    else if (flying) {
      const acc = e.move === 'float' ? 1.5 : 3;
      e.vx += (e.wantVx - e.vx) * Math.min(1, acc * dt);
      e.vy += ((e.wantVy != null ? e.wantVy : 0) - e.vy) * Math.min(1, acc * dt);
      if (e.move === 'float') e.vy += G * e.gravity * dt;
    } else {
      e.vy += G * e.gravity * dt;
      if (e.move !== 'none' && !e.sleeping && e.dizzy <= 0 && !e.ko) {
        const acc = e.grounded ? (e.move === 'drive' ? 2.5 : 8) : 1.5;
        e.vx += (e.wantVx - e.vx) * Math.min(1, acc * dt);
        if (e.wantJump && e.grounded && e.jumpCd <= 0) { e.vy = -e.jump * (e.move === 'drive' ? 1 : 1); e.grounded = false; e.jumpCd = 0.7; }
      }
      if (e.grounded && (e.move === 'none' || e.wantVx === 0 || e.sleeping || e.dizzy > 0 || e.ko)) e.vx -= e.vx * Math.min(1, e.friction * dt);
    }
    if (e.thrust > 0) { e.thrust -= dt; e.vy -= (e.special === 'rocket' ? G + 900 : G + 700) * dt; e.vx -= e.vx * Math.min(1, 2 * dt); e.grounded = false; e.angle -= e.angle * Math.min(1, 8 * dt); e.angVel = 0; }
    const maxV = 2600;
    e.vx = clamp(e.vx, -maxV, maxV); e.vy = clamp(e.vy, -maxV, maxV);
    e.x += e.vx * dt; e.y += e.vy * dt;
    // rotation
    if (e.def.roll) { if (e.grounded) e.angle += e.vx / (e.w * 0.5) * dt; else e.angle += e.angVel * dt; }
    else if (e.grounded || flying || e.thrust > 0) { const ta = e.ko ? e.koAngle : 0; e.angle += (ta - e.angle) * Math.min(1, 10 * dt); if (Math.abs(e.angle - ta) < 0.01) e.angle = ta; e.angVel = 0; }
    else e.angle += e.angVel * dt;
    // tilt for flyers
    const wantTilt = flying ? clamp(e.vy / 900, -0.35, 0.35) * e.facing : 0;
    e.tilt += (wantTilt - e.tilt) * Math.min(1, 4 * dt);
    e.moving = Math.abs(e.vx) > 8 || (flying && Math.abs(e.vx) + Math.abs(e.vy) > 8);
    if (e.grounded) e.phase += Math.abs(e.vx) * dt * 0.09;
    e.wheel += e.vx * dt / 10;
    // bounds
    const gy = W.groundY;
    e.grounded = false;
    if (e.bottom >= gy) {
      e.y = gy - e.h / 2;
      if (e.vy > 0) {
        const v = e.vy;
        e.vy = -v * e.bounce;
        if (Math.abs(e.vy) < 40) e.vy = 0;
        impact(e, v);
        if (!e.alive || e.dying) return;
      }
      if (e.vy <= 0.01 && e.vy >= -0.01) e.grounded = true;
      if (e.vy === 0) e.grounded = true;
    }
    if (e.left < 0) { e.x = e.w / 2; if (e.vx < 0) e.vx = -e.vx * 0.4; e.dir = 1; }
    if (e.right > W.W) { e.x = W.W - e.w / 2; if (e.vx > 0) e.vx = -e.vx * 0.4; e.dir = -1; }
    if (e.top < 0) { e.y = e.h / 2; if (e.vy < 0) { e.vy = -e.vy * 0.3; if (e.thrust > 0) { e.thrust = 0; e.angVel = (Math.random() - 0.5) * 10; e.say('Bonk!'); W.shake(3); } } }
  }

  function contact(A, B, dt) {
    if (A.mode === 'hunt' && A.target === B) catchTarget(A, B);
    else if (B.mode === 'hunt' && B.target === A) catchTarget(B, A);
    if (A.tags.has('fire')) W.burn(B, A, dt); else if (B.tags.has('fire')) W.burn(A, B, dt);
    if (A.onFire > 0 && (B.special === 'water' || B.tags.has('cold'))) W.douse(A); else if (B.onFire > 0 && (A.special === 'water' || A.tags.has('cold'))) W.douse(B);
    if (A.special === 'trap') W.snap(A, B); else if (B.special === 'trap') W.snap(B, A);
    if (A.special === 'balloon' && B.tags.has('sharp')) W.pop(A); else if (B.special === 'balloon' && A.tags.has('sharp')) W.pop(B);
    if (A.special === 'bubble' && !B.noCollide) W.pop(A); else if (B.special === 'bubble' && !A.noCollide) W.pop(B);
    if (A.special === 'water' && B.special === 'fire') W.extinguish(B); else if (B.special === 'water' && A.special === 'fire') W.extinguish(A);
    if (A.special === 'lightning' && B.creature) { W.zap(B); W.remove(A, 'poof'); } else if (B.special === 'lightning' && A.creature) { W.zap(A); W.remove(B, 'poof'); }
    if (A.tags.has('hot') && A.special !== 'fire' && B.special === 'meltable') { B.meltT += dt * 2; if (B.meltT > 3) W.melt(B); }
    else if (B.tags.has('hot') && B.special !== 'fire' && A.special === 'meltable') { A.meltT += dt * 2; if (A.meltT > 3) W.melt(A); }
  }

  function collide(A, B, dt) {
    const ox = Math.min(A.right - B.left, B.right - A.left);
    if (ox <= 0) return;
    const oy = Math.min(A.bottom - B.top, B.bottom - A.top);
    if (oy <= 0) return;
    contact(A, B, dt);
    if (A.noCollide || B.noCollide || !A.alive || !B.alive || A.dying || B.dying) return;
    const ia = (A.held || (A.static && A.grounded)) ? 0 : 1 / A.mass;
    const ib = (B.held || (B.static && B.grounded)) ? 0 : 1 / B.mass;
    const sum = ia + ib; if (sum === 0) return;
    const avy = A.vy, bvy = B.vy;
    let nx = 0, ny = 0, pen;
    if (ox < oy) { nx = A.x < B.x ? 1 : -1; pen = ox; } else { ny = A.y < B.y ? 1 : -1; pen = oy; }
    const ca = pen * ia / sum, cb = pen * ib / sum;
    A.x -= nx * ca; A.y -= ny * ca; B.x += nx * cb; B.y += ny * cb;
    const rvx = B.vx - A.vx, rvy = B.vy - A.vy;
    const rel = rvx * nx + rvy * ny;
    if (rel < 0) {
      const rest = Math.max(A.bounce, B.bounce) * 0.5;
      const j = -(1 + rest) * rel / sum;
      A.vx -= j * ia * nx; A.vy -= j * ia * ny; B.vx += j * ib * nx; B.vy += j * ib * ny;
      const tx = -ny, ty = nx;
      const rt = rvx * tx + rvy * ty;
      const jt = -rt / sum * 0.35;
      A.vx -= jt * ia * tx; A.vy -= jt * ia * ty; B.vx += jt * ib * tx; B.vy += jt * ib * ty;
      const hit = -rel;
      if (hit > 480) {
        if (A.creature && B.mass >= A.mass * 0.4) impact(A, hit * 1.4);
        if (B.creature && A.mass >= B.mass * 0.4) impact(B, hit * 1.4);
        if (hit > 700 && (A.special === 'bomb' || B.special === 'bomb')) { (A.special === 'bomb' ? A : B).fuse = 0.05; }
      }
    }
    if (ny !== 0) {
      const top = ny > 0 ? A : B, bot = ny > 0 ? B : A;
      const inVy = ny > 0 ? avy : bvy;
      if (bot.special === 'trampoline' && inVy > 120 && !top.held) {
        top.vy = -Math.max(700, inVy * 1.3); top.grounded = false; bot.squash = 1;
        if (top.creature) { top.say(pick(['Boing!', 'Wheee!', 'Yippee!'])); top.setMood('happy', 1); } else W.popText(top.x, top.top, 'Boing!', 16);
      } else if (top.vy >= bot.vy - 2) { top.grounded = true; if (top.vy > bot.vy) top.vy = bot.vy; }
      if (bot.creature && top !== bot && top.mass > bot.mass * 3 && inVy > 300 && !bot.dizzy) { bot.dizzy = 1.5; bot.say('Oof!'); }
    }
  }

  function physicsStep(dt) {
    const ents = W.entities;
    for (const e of ents) { if (e.alive && !e.dying) SB.think(e, dt, W); }
    for (const e of ents) integrate(e, dt);
    // sort & sweep
    ents.sort((a, b) => a.left - b.left);
    for (let i = 0; i < ents.length; i++) {
      const A = ents[i];
      if (!A.alive || A.dying) continue;
      const ar = A.right;
      for (let j = i + 1; j < ents.length; j++) {
        const B = ents[j];
        if (B.left > ar) break;
        if (!B.alive || B.dying) continue;
        collide(A, B, dt);
      }
    }
    // static things settle when they touch ground
    for (const e of ents) if (e.static && e.grounded) { e.vx = 0; e.vy = 0; }
  }

  // ---------- specials ----------
  function updateSpecial(e, dt) {
    const t = W.time;
    switch (e.special) {
      case 'bomb':
        e.fuse -= dt;
        if (Math.random() < dt * 30) W.particle('spark', e.x + e.facing * 0 + 10 * e.scale, e.y - 18 * e.scale, { vx: (Math.random() - 0.5) * 80, vy: -50 - Math.random() * 60, life: 0.3, size: 5 });
        if (e.fuse <= 0) { W.explode(e.x, e.y, 210 * Math.sqrt(e.scale), 950); W.remove(e, 'boom'); }
        break;
      case 'firework':
        e.specT += dt;
        if (e.specT > 1.5 && e.thrust <= 0 && !e.launched) { e.thrust = 1.3; e.launched = true; }
        if (e.thrust > 0) {
          if (Math.random() < dt * 40) W.particle('spark', e.x, e.bottom, { vx: (Math.random() - 0.5) * 60, vy: 100, life: 0.3, size: 4 });
          if (e.thrust - dt <= 0) { W.burst('sparkle', e.x, e.y, 30, 260, { size: 8, life: 1.1, g: 120 }); W.burst('star', e.x, e.y, 8, 200, { size: 7, life: 1.2, g: 120 }); W.popText(e.x, e.y, 'POP!', 26); W.explode(e.x, e.y, 120, 300); W.remove(e, 'boom'); }
        }
        break;
      case 'rocket':
        e.specT += dt;
        if (!e.launched && e.grounded) { const c = Math.floor(e.specT); if (c !== e.count) { e.count = c; if (c === 1) e.say('3...'); if (c === 2) e.say('2...'); if (c === 3) e.say('1...'); if (c === 4) { e.thrust = 2.6; e.say('BLAST OFF!'); W.shake(4); e.launched = true; } } }
        if (e.thrust > 0 && Math.random() < dt * 60) { W.particle('smoke', e.x + (Math.random() - 0.5) * 12 * e.scale, e.bottom, { vx: (Math.random() - 0.5) * 60, vy: 120, life: 0.7, size: 8 }); }
        if (e.thrust <= 0 && e.grounded && e.launched && e.specT > 6) { e.launched = false; e.specT = 0; e.count = -1; }
        break;
      case 'egg':
        e.specT += dt;
        if (e.specT > 6) {
          const big = e.scale >= 1.4;
          const c = W.spawn(big ? 'dinosaur' : 'chick', e.x, e.y, { scale: big ? 0.45 * e.scale : Math.max(0.6, e.scale), mood: 'happy', quiet: true });
          if (c) { c.say(big ? 'Rawr!' : 'Peep!'); c.vy = -200; }
          W.popText(e.x, e.y - 20, 'Crack!', 18); W.burst('puff', e.x, e.y, 6, 60, { size: 5 }); W.remove(e, 'poof');
        }
        break;
      case 'fire':
        if (Math.random() < dt * 25) W.particle('smoke', e.x + (Math.random() - 0.5) * e.w * 0.5, e.top, { vx: (Math.random() - 0.5) * 20, vy: -40 - Math.random() * 30, life: 1 + Math.random(), size: 5 + Math.random() * 6 * e.scale });
        break;
      case 'rain':
        if (Math.random() < dt * 60) W.particle('drop', e.x + (Math.random() - 0.5) * e.w * 0.9, e.bottom, { vy: 500 + Math.random() * 200, life: (W.groundY - e.bottom) / 600, size: 6 });
        e.specT += dt;
        if (e.specT > 5 + (e.seed % 4)) { e.specT = 0; W.particle('bolt', e.x, e.bottom, { life: 0.25, size: W.groundY - e.bottom }); for (const o of W.entities) if (o !== e && o.alive && !o.static && Math.abs(o.x - e.x) < 40 && o.y > e.y) W.zap(o); W.shake(5); }
        for (const o of W.entities) { if (Math.abs(o.x - e.x) < e.w * 0.5 && o.y > e.y) { if (o.special === 'fire') { o.meltT += dt; if (o.meltT > 2) W.extinguish(o); } else if (o.onFire > 0) W.douse(o); } }
        break;
      case 'sun':
        e.goal = { x: 80, y: 80 }; e.timer = 5;
        if (Math.random() < dt * 3) W.particle('sparkle', e.x + (Math.random() - 0.5) * 70, e.y + (Math.random() - 0.5) * 70, { life: 0.5, size: 4 });
        for (const o of W.entities) if (o.special === 'meltable' && Math.hypot(o.x - e.x, o.y - e.y) < 320) { o.meltT += dt * 0.25; if (o.meltT > 3) W.melt(o); }
        break;
      case 'moon':
        e.goal = { x: W.W - 90, y: 80 }; e.timer = 5;
        if (Math.random() < dt * 2) W.particle('sparkle', e.x + (Math.random() - 0.5) * 120, e.y + (Math.random() - 0.5) * 90, { life: 0.6, size: 3 });
        break;
      case 'bubble':
        e.specT += dt; if (e.specT > 8) W.pop(e);
        break;
      case 'blackhole':
        for (const o of W.entities) {
          if (o === e || !o.alive || o.dying || o.static || o.held) continue;
          const dx = e.x - o.x, dy = e.y - o.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
          const R = 280 * e.scale;
          if (d < R) { const k = (1 - d / R); o.vx += dx / d * 900 * k * dt * (1 + k); o.vy += dy / d * 900 * k * dt * (1 + k) - 200 * k * dt; o.grounded = false; if (d < 26 * e.scale) { W.remove(o, 'hole'); } else if (d < 80 * e.scale) o.angVel = 10; }
        }
        if (Math.random() < dt * 8) { const a = Math.random() * TAU; W.particle('sparkle', e.x + Math.cos(a) * 100, e.y + Math.sin(a) * 100, { vx: -Math.cos(a) * 120, vy: -Math.sin(a) * 120, life: 0.7, size: 4 }); }
        break;
      case 'tornado':
        for (const o of W.entities) {
          if (o === e || !o.alive || o.dying || o.static || o.held || o.special === 'tornado') continue;
          const dx = e.x - o.x; const R = 90 * e.scale;
          if (Math.abs(dx) < R && o.y > e.top - 40 && o.mass < 80) {
            o.vy -= 2600 * dt; o.vx += ((dx * 4 + Math.sin(t * 9 + o.seed) * 260) - o.vx) * 4 * dt; o.grounded = false; o.angVel = 12;
            if (o.creature && o.dizzy <= 0) { o.dizzy = 1; o.say(pick(['Wheee!', 'Aaah!', 'Whoa!'])); }
          }
        }
        if (Math.random() < dt * 20) W.particle('puff', e.x + (Math.random() - 0.5) * 40, e.bottom, { vx: (Math.random() - 0.5) * 200, vy: -100, life: 0.5, size: 6 });
        break;
      case 'fan':
        for (const o of W.entities) {
          if (o === e || !o.alive || o.dying || o.static || o.held) continue;
          const dx = (o.x - e.x) * e.facing;
          if (dx > 0 && dx < 320 * e.scale && Math.abs(o.y - e.y) < 100 * e.scale) { o.vx += e.facing * 1000 * dt * (1 - dx / (320 * e.scale)) * Math.min(1, 3 / o.mass); }
        }
        if (Math.random() < dt * 30) W.particle('wind', e.x + e.facing * 30, e.y - 10 + (Math.random() - 0.5) * 60, { vx: e.facing * 350, life: 0.5, size: 14 });
        break;
      case 'magnet':
        for (const o of W.entities) {
          if (o === e || !o.alive || o.dying || o.static || o.held || !o.tags.has('metal')) continue;
          const dx = e.x - o.x, dy = e.y - o.y, d = Math.sqrt(dx * dx + dy * dy) || 1; const R = 240 * e.scale;
          if (d < R && d > 10) { const k = (1 - d / R) * Math.min(1, 6 / o.mass); o.vx += dx / d * 800 * k * dt; o.vy += dy / d * 800 * k * dt - 100 * k * dt; }
        }
        break;
      case 'music':
        if (Math.random() < dt * 3) W.particle('note', e.x + (Math.random() - 0.5) * 20, e.top, { vx: (Math.random() - 0.5) * 30, vy: -50, life: 1.4, size: 16 });
        for (const o of W.entities) if (o !== e && o.creature && !o.sleeping && Math.hypot(o.x - e.x, o.y - e.y) < 220) { o.setMood('happy', 0.5); if (o.grounded && Math.random() < dt * 1.2 && o.move !== 'none') { o.vy = -220; o.grounded = false; } }
        break;
      case 'sparkle': break;
      case 'trap':
        if (!e.armed) { e.snapT += dt; if (e.snapT > 7) { e.armed = true; e.say('*click*'); } }
        break;
      case 'smite': {
        e.specT += dt;
        if (e.specT > 4.5) {
          let best = null, bd = 520;
          for (const o of W.entities) { if (o === e || !o.alive || o.dying || o.ko || !o.creature) continue; if (!(o.tags.has('villain') || o.tags.has('scary') || o.tags.has('undead') || o.temper === 'hostile')) continue; const d = Math.hypot(o.x - e.x, o.y - e.y); if (d < bd) { bd = d; best = o; } }
          if (best) {
            e.specT = 0; e.say(pick(['SMITE!', 'Begone!', 'Behold my wrath!'])); e.setMood('angry', 1.5);
            W.particle('beamline', e.x + e.facing * 10, e.y, { life: 0.3, size: 0, tx: best.x, ty: best.top });
            W.zap(best); best.hp -= 3; W.popText(best.x, best.top - 30, 'ZAP!', 24); W.flash = 0.5;
            if (best.hp <= 0) W.knockOut(best, e);
          }
        }
        if (Math.random() < dt * 5) W.particle('sparkle', e.x + (Math.random() - 0.5) * e.w * 1.6, e.y + (Math.random() - 0.5) * e.h * 1.2, { vy: -20, life: 0.6, size: 5 });
        break;
      }
      case 'beam': {
        let caught = false;
        for (const o of W.entities) {
          if (o === e || !o.alive || o.dying || o.static || o.held || o.mass > 60) continue;
          if (Math.abs(o.x - e.x) < 30 * e.scale && o.y > e.y && o.y - e.y < 300) {
            caught = true; o.vy -= 900 * dt; o.vy = Math.max(o.vy, -260); o.vx += (e.x - o.x) * 3 * dt; o.grounded = false;
            if (o.top <= e.bottom + 6) { o.vx = (Math.random() < 0.5 ? -1 : 1) * 520; o.vy = -150; if (o.creature) o.say(pick(['Wheee!', 'Whoa!', 'Put me down!'])); }
            else if (o.creature && Math.random() < dt * 2) o.say('?');
          }
        }
        e.beam = caught ? 1 : Math.max(0, (e.beam || 0) - dt * 3);
        break;
      }
      case 'firebreath': {
        e.specT -= dt;
        const tg = e.target;
        if (e.breath <= 0 && e.specT <= 0 && tg && Math.abs(tg.x - e.x) < 200 * e.scale && Math.abs(tg.y - e.y) < 90 * e.scale && (tg.x - e.x) * e.facing > 0) { e.breath = 1.1; e.specT = 4; e.say('*FWOOSH*'); }
        if (e.breath > 0) {
          e.breath -= dt;
          const mx = e.x + e.facing * e.w * 0.45, my = e.y - e.h * 0.3;
          for (let i = 0; i < 3; i++) W.particle('flame', mx, my, { vx: e.facing * (300 + Math.random() * 200), vy: (Math.random() - 0.5) * 80, life: 0.35 + Math.random() * 0.2, size: 8 + Math.random() * 10 * e.scale });
          for (const o of W.entities) { if (o === e || !o.alive) continue; const dx = (o.x - mx) * e.facing; if (dx > 0 && dx < 200 * e.scale && Math.abs(o.y - my) < 60 * e.scale) { W.burn(o, e, dt); if (o.creature && o.burnT <= 0) o.vx += e.facing * 300; } }
        }
        break;
      }
      case 'layegg':
        e.specT += dt;
        if (e.specT > 14 + (e.seed % 8) && e.grounded) { e.specT = 0; const g = W.spawn('egg', e.x - e.facing * e.w * 0.6, e.y, { scale: e.scale, quiet: true }); if (g) g.specT = -4; e.say('Bawk!'); }
        break;
      case 'metamorph':
        e.specT += dt;
        if (e.specT > 20) { const b = W.convert(e, 'butterfly'); if (b) { b.say('Ta-da!'); W.burst('sparkle', b.x, b.y, 10, 100, { size: 5, life: 0.8 }); } }
        break;
      case 'spout':
        e.specT += dt;
        if (e.specT > 3) { e.specT = 0; for (let i = 0; i < 10; i++) W.particle('drop', e.x + e.facing * e.w * 0.15, e.top, { vx: (Math.random() - 0.5) * 120, vy: -250 - Math.random() * 200, g: 700, life: 0.9, size: 5 }); }
        break;
      case 'boo':
        e.specT += dt; if (e.specT > 5 && !e.bubble) { e.specT = 0; e.say('Boo!'); for (const o of W.entities) if (o !== e && o.creature && Math.hypot(o.x - e.x, o.y - e.y) < 150 && !o.tags.has('undead')) { o.setMood('scared', 1.5); o.threat = e; } }
        break;
      case 'dance':
        if (e.grounded && e.mode === 'wander' && Math.random() < dt * 1.5) { e.vy = -260; e.grounded = false; e.setMood('happy', 1); if (Math.random() < 0.3) W.particle('note', e.x, e.top, { vy: -50, life: 1.2, size: 14 }); }
        break;
      case 'smoke':
        if (e.moving && Math.random() < dt * 8) W.particle('smoke', e.x + (e.def.name === 'train' ? e.facing * 34 * e.scale : -e.facing * 10 * e.scale), e.top, { vx: -e.facing * 20, vy: -60, life: 1.2, size: 7 });
        break;
      case 'clock': case 'water': case 'toilet': case 'bell': case 'present': case 'chest': case 'potion': case 'camera': case 'grave': case 'phone': case 'dice': case 'trampoline': case 'cannon': case 'meltable': case 'balloon': case 'extinguish': case 'heal': case 'meteor': case 'lightning':
        break;
    }
    if (e.sparkle && Math.random() < dt * 4) W.particle('sparkle', e.x + (Math.random() - 0.5) * e.w * 1.3, e.y + (Math.random() - 0.5) * e.h * 1.3, { vy: -20, life: 0.6, size: 4 });
    if (e.ring > 0) e.ring -= dt;
    if (e.flash > 0) e.flash -= dt * 3;
    if (e.squash > 0) e.squash -= dt * 4;
    if (e.meltT > 0 && e.special === 'meltable') e.meltT = Math.max(0, e.meltT - dt * 0.05);
  }

  // ---------- per-frame entity bookkeeping ----------
  function updateEntity(e, dt) {
    e.age += dt;
    if (e.spawnT < 1) e.spawnT = Math.min(1, e.spawnT + dt * 3.5);
    if (e.bubble) { e.bubble.t -= dt; if (e.bubble.t <= 0) e.bubble = null; }
    if (e.burnT > 0) e.burnT -= dt;
    if (e.onFire > 0) {
      e.onFire -= dt; e.fireTick -= dt;
      if (Math.random() < dt * 14) W.particle('flame', e.x + (Math.random() - 0.5) * e.w * 0.6, e.y + (Math.random() - 0.5) * e.h * 0.6, { vx: (Math.random() - 0.5) * 30, vy: -70, life: 0.35, size: 6 + Math.random() * 5 });
      if (Math.random() < dt * 6) W.particle('smoke', e.x, e.top, { vy: -50, life: 0.9, size: 5 });
      if (e.fireTick <= 0 && !e.ko) { e.fireTick = 0.9; e.hp -= 1; e.say(pick(['Ow ow ow!', 'Hot hot hot!', 'Aaah!'])); if (e.hp <= 0) W.knockOut(e, null); }
      if (e.onFire <= 0) { e.onFire = 0; e.fireSrc = null; W.burst('smoke', e.x, e.top, 4, 40, { size: 6, life: 0.8 }); }
    }
    if (e.dizzy > 0) { e.dizzy -= dt; if (Math.random() < dt * 4) W.particle('star', e.x + (Math.random() - 0.5) * e.w, e.top - 4, { vx: (Math.random() - 0.5) * 30, vy: -25, life: 0.8, size: 5 }); }
    if (e.sleeping && Math.random() < dt * 1.2) W.particle('z', e.x + e.w * 0.3, e.top, { vx: 10, vy: -25, life: 1.5, size: 12 + Math.random() * 6 });
    if (e.dying) {
      e.dying += dt;
      if (e.dieHow === 'trash') { const b = W.bin; e.x += (b.x - e.x) * Math.min(1, 12 * dt); e.y += (b.y - 10 - e.y) * Math.min(1, 12 * dt); e.angle += 14 * dt; }
      if (e.dieHow === 'hole') { e.angle += 20 * dt; }
      if (e.dying > 0.35) { e.alive = false; if (e.dieHow === 'eaten' || e.dieHow === 'poof' || e.dieHow === 'pop') W.puff(e.x, e.y, 4, 5); if (e.dieHow === 'trash') { W.bin.wob = 1; W.puff(W.bin.x, W.bin.y - 30, 5, 6); } }
      return;
    }
    // mood resolution
    if (e.ko && e.grounded && Math.random() < dt * 1.5) W.particle('star', e.x + (Math.random() - 0.5) * e.w, e.top - 4, { vx: (Math.random() - 0.5) * 20, vy: -25, life: 1, size: 5 });
    e.mood = e.ko ? 'dizzy' : e.dizzy > 0 ? 'dizzy' : e.sleeping ? 'sleep' : e.held ? (e.heldMood || (e.temper === 'curious' ? 'happy' : e.temper === 'hostile' ? 'angry' : e.temper === 'timid' ? 'scared' : 'normal')) : (e.tmpMood || e.baseMood);
    // look at cursor
    const cur = W.cursor;
    let lx = 0, ly = 0.3;
    if (cur.in && !e.sleeping) { const dx = cur.x - e.x, dy = cur.y - (e.y - e.h * 0.3), d = Math.sqrt(dx * dx + dy * dy) || 1; lx = dx / d; ly = dy / d; }
    else if (e.moving) { lx = e.facing * 0.6; ly = 0.1; }
    e.look.x += (lx - e.look.x) * Math.min(1, 10 * dt); e.look.y += (ly - e.look.y) * Math.min(1, 10 * dt);
    e.lookX = e.look.x * e.facing; e.lookY = e.look.y;
    // idle chatter
    if (e.creature && !e.sleeping && e.def.say.length) {
      e.chatT -= dt;
      if (e.chatT <= 0) { e.chatT = 8 + Math.random() * 14 + W.entities.length * 0.3; if (!e.bubble && e.mode === 'wander' && Math.random() < 0.7) e.say(pick(e.def.say)); }
    }
    if (e.special) updateSpecial(e, dt);
    else if (e.sparkle && Math.random() < dt * 4) W.particle('sparkle', e.x + (Math.random() - 0.5) * e.w * 1.3, e.y + (Math.random() - 0.5) * e.h * 1.3, { vy: -20, life: 0.6, size: 4 });
  }

  function updateParticles(dt) {
    const ps = W.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { ps.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.rv * dt;
      if (p.type === 'drop' && p.y > W.groundY) { p.life = 0; }
    }
  }

  // ---------- input ----------
  function cursorPos(ev) {
    const r = canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left), y: (ev.clientY - r.top) };
  }
  function topmostAt(x, y) {
    let best = null, bestA = Infinity;
    for (const e of W.entities) {
      if (!e.alive || e.dying) continue;
      const pad = Math.max(0, 8 - e.w * 0.1);
      if (e.contains(x, y, pad)) { const a = e.w * e.h; if (a < bestA) { bestA = a; best = e; } }
    }
    return best;
  }
  let pressInfo = null;
  function onDown(ev) {
    if (ev.button != null && ev.button !== 0) return;
    const p = cursorPos(ev);
    W.cursor.x = p.x; W.cursor.y = p.y; W.cursor.in = true; W.cursor.down = true;
    canvas.setPointerCapture && canvas.setPointerCapture(ev.pointerId);
    const e = topmostAt(p.x, p.y);
    pressInfo = { x: p.x, y: p.y, t: W.time, e, moved: false };
    if (e) {
      W.held = e; e.held = true; W.heldOff = { x: p.x - e.x, y: p.y - e.y }; e.grounded = false; e.vx = 0; e.vy = 0;
      const i = W.entities.indexOf(e); if (i >= 0) { W.entities.splice(i, 1); W.entities.push(e); }
      if (e.creature && !e.sleeping && Math.random() < 0.6) e.say(pick(e.heldMood === 'happy' || e.temper === 'curious' ? ['Wheee!', 'Hi!', 'Up we go!'] : e.temper === 'hostile' ? ['Put me down!', 'Grrr!', 'Let go!'] : ['Eek!', 'Whoa!', 'Aaah!']));
    }
    document.getElementById('suggest').innerHTML = '';
  }
  function onMove(ev) {
    const p = cursorPos(ev);
    const c = W.cursor;
    c.x = p.x; c.y = p.y; c.in = true;
    if (pressInfo && Math.hypot(p.x - pressInfo.x, p.y - pressInfo.y) > 6) pressInfo.moved = true;
    c.hist.push({ x: p.x, y: p.y, t: performance.now() / 1000 });
    if (c.hist.length > 12) c.hist.shift();
  }
  function onUp(ev) {
    const p = cursorPos(ev);
    const c = W.cursor; c.down = false;
    const e = W.held;
    if (e) {
      e.held = false; W.held = null;
      const b = W.bin;
      const overBin = p.x > b.x - b.w * 0.6 && p.x < b.x + b.w * 0.6 && p.y > b.y - b.h * 0.9 && p.y < b.y + 20;
      if (overBin) { W.remove(e, 'trash'); W.popText(b.x, b.y - b.h - 10, pick(['Bye!', 'Gone!', 'Poof!']), 18); }
      else {
        e.vx = c.vx; e.vy = c.vy;
        if (!e.creature || e.move === 'none') e.angVel = clamp(c.vx * 0.01, -12, 12);
        else if (Math.hypot(c.vx, c.vy) > 700) e.angVel = clamp(c.vx * 0.006, -8, 8);
        if (pressInfo && !pressInfo.moved && W.time - pressInfo.t < 0.35) W.poke(e);
      }
    }
    pressInfo = null;
  }
  function onLeave() { W.cursor.in = false; if (W.held) { const e = W.held; e.held = false; W.held = null; e.vx = 0; e.vy = 0; } W.cursor.down = false; pressInfo = null; }

  function updateCursorVelocity() {
    const c = W.cursor, h = c.hist, now = performance.now() / 1000;
    while (h.length && now - h[0].t > 0.12) h.shift();
    if (h.length >= 2) { const a = h[0], b = h[h.length - 1]; const dt = Math.max(0.016, b.t - a.t); c.vx = clamp((b.x - a.x) / dt, -2600, 2600); c.vy = clamp((b.y - a.y) / dt, -2600, 2600); }
    else { c.vx *= 0.8; c.vy *= 0.8; }
  }

  // ---------- creating from text ----------
  W.create = function (text) {
    const r = SB.lookup(text);
    if (!r) return;
    const c = W.cursor;
    const x = c.in ? c.x : W.W / 2 + (Math.random() - 0.5) * 200;
    const y = c.in ? c.y : W.groundY * 0.4;
    const mods = r.mods;
    let e;
    if (r.def) {
      e = W.spawn(r.def, x, y, mods);
      if (r.fuzzy) W.toast(`Did you mean "${r.def.name}"?`, 2.2);
    } else {
      mods.label = r.label;
      e = W.spawn('box', x, y, mods);
      SB.logUnknown(r.label, r.text);
      W.toast(`I don't know "${r.label}" yet... here's a box! (added to the wish list)`, 3);
    }
    if (e) { e.vy = -120; if (e.def.special !== 'meteor') e.y = Math.min(e.y, W.groundY - e.h / 2); }
    return e;
  };

  // ---------- UI ----------
  function setupUI() {
    const input = document.getElementById('word');
    const sug = document.getElementById('suggest');
    const go = document.getElementById('go');
    const renderSuggest = () => {
      const items = SB.suggest(input.value, 8);
      sug.innerHTML = '';
      for (const s of items) {
        const b = document.createElement('button'); b.className = 'chip'; b.textContent = s.full; b.type = 'button';
        b.addEventListener('mousedown', ev => ev.preventDefault());
        b.addEventListener('click', () => { W.create(s.full); input.value = ''; sug.innerHTML = ''; input.focus(); });
        sug.appendChild(b);
      }
    };
    input.addEventListener('input', renderSuggest);
    input.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { const v = input.value.trim(); if (v) { W.create(v); input.value = ''; sug.innerHTML = ''; } ev.preventDefault(); }
      else if (ev.key === 'Escape') { input.value = ''; sug.innerHTML = ''; input.blur(); }
      else if (ev.key === 'Tab') { const items = SB.suggest(input.value, 1); if (items.length) { input.value = items[0].full; renderSuggest(); ev.preventDefault(); } }
    });
    go.addEventListener('click', () => { const v = input.value.trim(); if (v) { W.create(v); input.value = ''; sug.innerHTML = ''; } input.focus(); });
    document.getElementById('random').addEventListener('click', () => { const n = SB.randomName(); W.create(n); W.toast(n + '!', 1.5); });
    document.getElementById('clear').addEventListener('click', () => { for (const e of W.entities) W.remove(e, 'poof'); W.toast('All clear!', 1.5); });
    const battleBtn = document.getElementById('battle');
    const setBattle = v => {
      SB.battle = v; battleBtn.textContent = 'Battle: ' + (v ? 'ON' : 'OFF'); battleBtn.classList.toggle('on', v);
      try { localStorage.setItem('stickbox.battle', v ? '1' : '0'); } catch (e) { /* ignore */ }
      for (const e of W.entities) { e.target = null; e.threat = null; e.attacker = null; e.scanT = 0; }
    };
    try { const sv = localStorage.getItem('stickbox.battle'); if (sv != null) SB.battle = sv === '1'; } catch (e) { /* ignore */ }
    setBattle(SB.battle);
    battleBtn.addEventListener('click', () => { setBattle(!SB.battle); W.toast(SB.battle ? 'Battle mode: everyone fights everyone (except their own kind)!' : 'Peace mode: back to normal', 2.5); });
    const koBtn = document.getElementById('clearKo');
    koBtn.addEventListener('click', () => {
      const down = W.entities.filter(e => e.alive && !e.dying && e.ko);
      if (!down.length) { W.toast('Nobody is knocked out!', 1.5); return; }
      for (const e of down) W.remove(e, 'trash');
      W.popText(W.bin.x, W.bin.y - W.bin.h - 10, 'Bye!', 18);
      W.toast('Swept up ' + down.length + ' knocked-out ' + (down.length === 1 ? 'creature' : 'creatures'), 2);
    });
    W.koBtn = koBtn; W.koCount = -1;
    const help = document.getElementById('help');
    const wish = document.getElementById('wishList');
    const renderWish = () => {
      const rows = SB.unknownWords();
      wish.innerHTML = '';
      if (!rows.length) { wish.textContent = 'Nothing yet. Every word the game does not recognize will show up here.'; return; }
      for (const r of rows) {
        const b = document.createElement('span'); b.className = 'chip wish';
        b.textContent = r.word + (r.count > 1 ? ' ×' + r.count : '');
        if (r.typed && r.typed.length) b.title = 'typed as: ' + r.typed.join(', ');
        wish.appendChild(b);
      }
    };
    document.getElementById('helpBtn').addEventListener('click', () => { help.hidden = !help.hidden; if (!help.hidden) renderWish(); });
    document.getElementById('wishCopy').addEventListener('click', () => {
      const text = SB.exportUnknown();
      const done = () => W.toast('Wish list copied!', 1.5);
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => window.prompt('Copy your wish list:', text));
      else window.prompt('Copy your wish list:', text);
    });
    document.getElementById('wishDownload').addEventListener('click', () => {
      const blob = new Blob([SB.exportUnknown()], { type: 'text/plain' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'stickbox-wishlist.txt';
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    });
    document.getElementById('wishClear').addEventListener('click', () => { if (window.confirm('Clear the wish list?')) { SB.clearUnknown(); renderWish(); } });
    document.getElementById('closeHelp').addEventListener('click', () => { help.hidden = true; });
    // word list
    const cats = { animal: 'Animals', person: 'People', creature: 'Creatures', vehicle: 'Vehicles', item: 'Things' };
    const list = document.getElementById('wordList');
    for (const key in cats) {
      const h = document.createElement('h3'); h.textContent = cats[key]; list.appendChild(h);
      const wrap = document.createElement('div'); wrap.className = 'words';
      for (const n of SB.ORDER) { const d = SB.DEFS[n]; if (d.cat !== key || d.hidden) continue; const b = document.createElement('button'); b.className = 'chip'; b.textContent = n; b.type = 'button'; b.addEventListener('click', () => { W.create(n); }); wrap.appendChild(b); }
      list.appendChild(wrap);
    }
    const adj = document.getElementById('adjList');
    for (const m of ['giant', 'tiny', 'flying', 'angry', 'happy', 'scared', 'fast', 'slow', 'sleepy', 'bouncy', 'invisible', 'zombie', 'magic', 'baby', 'heavy']) { const b = document.createElement('button'); b.className = 'chip'; b.textContent = m; b.type = 'button'; b.addEventListener('click', () => { input.value = m + ' '; input.focus(); renderSuggest(); }); adj.appendChild(b); }
    window.addEventListener('keydown', ev => {
      if (document.activeElement === input) return;
      if (ev.key === 'Delete' || ev.key === 'Backspace') { const e = W.held || W.hoverE; if (e) { W.remove(e, 'poof'); ev.preventDefault(); } }
      else if (ev.key.length === 1 && /[a-z0-9 ]/i.test(ev.key) && !ev.ctrlKey && !ev.metaKey && !ev.altKey) { input.focus(); input.value += ev.key; renderSuggest(); ev.preventDefault(); }
      else if (ev.key === 'Escape') { help.hidden = true; }
    });
    input.focus();
  }

  // ---------- rendering ----------
  function drawBackground(t) {
    const gy = W.groundY;
    pen.begin(7, boil);
    ctx.lineWidth = 2.2;
    // distant hills
    ctx.save(); ctx.globalAlpha = 0.35; ctx.lineWidth = 1.8;
    pen.curve(-40, gy - 6, W.W * 0.22, gy - 70, W.W * 0.5, gy - 8);
    pen.curve(W.W * 0.4, gy - 6, W.W * 0.7, gy - 95, W.W + 40, gy - 4);
    ctx.restore();
    ctx.lineWidth = 2.6;
    pen.line(-10, gy, W.W + 10, gy);
    // grass tufts
    ctx.lineWidth = 1.8;
    const n = Math.floor(W.W / 46);
    for (let i = 0; i <= n; i++) {
      const x = i * 46 + ((i * 37) % 23); const s = 4 + (i % 3) * 2;
      pen.line(x - s, gy, x - s * 0.4, gy - s * 1.6); pen.line(x - s * 0.4, gy - s * 1.6, x + s * 0.2, gy); pen.line(x + s * 0.4, gy, x + s * 1.1, gy - s * 1.3);
    }
    // dirt dots
    for (let i = 0; i < n; i++) { const x = i * 46 + ((i * 53) % 40); pen.dot(x, gy + 12 + (i % 4) * 7, 1.3); }
  }
  function drawBin(t) {
    const b = W.bin;
    const wob = b.wob > 0 ? Math.sin(t * 40) * b.wob * 0.08 : 0;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(wob);
    pen.begin(99, boil); ctx.lineWidth = 2.6;
    const w = b.w, h = b.h;
    pen.poly([-w / 2, -h + 12, w / 2, -h + 12, w / 2 - 6, 0, -w / 2 + 6, 0], true);
    for (let k = -1; k <= 1; k++) pen.line(k * 14, -h + 20, k * 12, -8);
    const open = b.open;
    ctx.save(); ctx.translate(-w / 2 - 2, -h + 12); ctx.rotate(-open * 1.1);
    pen.rect(0, -8, w + 4, 8, true); pen.line(w / 2 - 6, -8, w / 2 - 6, -14); pen.line(w / 2 + 6, -8, w / 2 + 6, -14); pen.line(w / 2 - 6, -14, w / 2 + 6, -14);
    ctx.restore();
    pen.text('TRASH', 0, -h * 0.45, 12);
    if (open > 0.5 && W.held) pen.text('drop it!', 0, -h - 22, 14);
    ctx.restore();
  }
  function drawEntity(e, t) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const st = e.spawnT < 1 ? (1 + Math.sin(e.spawnT * Math.PI) * 0.25) * Math.min(1, e.spawnT * 4) : 1;
    const ds = e.dying ? Math.max(0, 1 - e.dying / 0.35) : 1;
    ctx.rotate(e.angle + e.tilt + (e.held ? clamp(W.cursor.vx / 4000, -0.3, 0.3) : 0));
    const hv = (e.hover && !e.held && !e.dying) ? 1.04 : 1;
    ctx.scale(e.scale * st * ds * hv * e.facing, e.scale * st * ds * hv);
    if (e.invisible) ctx.globalAlpha = 0.28;
    ctx.lineWidth = 2.4 / Math.sqrt(Math.max(0.5, e.scale));
    pen.begin(e.seed, boil);
    pen.wobble = 1.1 / Math.sqrt(Math.max(0.5, e.scale));
    if (e.wingsMod) D.wings(pen, e, t, 0, -e.def.h * 0.15, Math.max(0.5, e.def.h / 70), 'bird', e.flying);
    if (e.special === 'beam' && e.beam > 0) { ctx.save(); ctx.globalAlpha = 0.5 * e.beam; ctx.setLineDash([6, 6]); pen.line(-10, e.def.h / 2, -46, e.def.h / 2 + 300 / e.scale); pen.line(10, e.def.h / 2, 46, e.def.h / 2 + 300 / e.scale); ctx.restore(); }
    e.def.draw(pen, e, t);
    if (e.onFire > 0) {
      for (let k = 0; k < 3; k++) {
        const fx = (((k * 37 + e.seed * 10) % 100) / 100 - 0.5) * e.def.w * 0.7, fy = (((k * 53 + e.seed * 7) % 100) / 100 - 0.2) * e.def.h * 0.6;
        D.flame(pen, fx, fy, 5 + k * 2 + Math.min(10, e.def.h * 0.06), t, e.seed + k);
      }
    }
    ctx.restore();
    pen.wobble = 1.1;
  }
  function drawBubble(e) {
    const b = e.bubble; if (!b) return;
    const size = clamp(13 + e.h * 0.05, 13, 20);
    const tw = pen.width(b.text, size) + 16, th = size + 12;
    const bx = clamp(e.x, tw / 2 + 4, W.W - tw / 2 - 4), by = e.top - 16 - th / 2 - (e.dizzy > 0 ? 10 : 0);
    const fade = Math.min(1, b.t / 0.25);
    ctx.save(); ctx.globalAlpha = fade; ctx.lineWidth = 2;
    pen.begin(e.seed + 5, boil);
    pen.poly([bx - tw / 2, by - th / 2, bx + tw / 2, by - th / 2, bx + tw / 2, by + th / 2, bx + 8, by + th / 2, bx + 2, by + th / 2 + 8, bx - 2, by + th / 2, bx - tw / 2, by + th / 2], true);
    pen.text(b.text, bx, by + 1, size);
    ctx.restore();
  }
  function drawParticle(p, t) {
    const k = p.life / p.max;
    ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.5);
    pen.begin(p.seed, boil); ctx.lineWidth = 2;
    switch (p.type) {
      case 'puff': pen.circle(p.x, p.y, p.size * (1.6 - k), false); break;
      case 'smoke': pen.circle(p.x, p.y, p.size * (1.8 - k * 0.8), true); break;
      case 'spark': { const a = Math.atan2(p.vy, p.vx); pen.line(p.x, p.y, p.x - Math.cos(a) * p.size, p.y - Math.sin(a) * p.size); break; }
      case 'star': ctx.translate(p.x, p.y); ctx.rotate(p.rot); pen.star(0, 0, p.size, true); break;
      case 'sparkle': { const s = p.size * (0.5 + k); pen.line(p.x - s, p.y, p.x + s, p.y); pen.line(p.x, p.y - s, p.x, p.y + s); break; }
      case 'drop': pen.line(p.x, p.y, p.x - p.vx * 0.01, p.y - p.size); break;
      case 'flame': D.flame(pen, p.x, p.y + p.size * 0.5, p.size * (0.4 + k * 0.6), t, p.seed); break;
      case 'heart': pen.heart(p.x, p.y, p.size, true); break;
      case 'z': pen.text('z', p.x, p.y, p.size); break;
      case 'note': pen.text(p.seed > 50 ? '♪' : '♫', p.x, p.y, p.size); break;
      case 'text': pen.text(p.text, p.x, p.y, p.size * (1 + (1 - k) * 0.3)); break;
      case 'wind': pen.line(p.x, p.y, p.x - p.size * Math.sign(p.vx), p.y); break;
      case 'confetti': ctx.translate(p.x, p.y); ctx.rotate(p.rot); pen.rect(-p.size / 2, -p.size / 4, p.size, p.size / 2, p.seed > 50 ? '#000' : true); break;
      case 'bolt': { const pts = [p.x, p.y]; let y = p.y, x = p.x; const n = 6; for (let i = 1; i <= n; i++) { y = p.y + p.size * i / n; x = p.x + (i % 2 ? -14 : 12); pts.push(x, y); } ctx.lineWidth = 4; pen.path(pts, false); break; }
      case 'puddle': ctx.globalAlpha = Math.min(1, k * 2); pen.ellipse(p.x, p.y, p.size, 3, true); break;
      case 'beamline': { const pts = [p.x, p.y]; const n = 7; for (let i = 1; i < n; i++) { const f = i / n; pts.push(p.x + (p.tx - p.x) * f + (i % 2 ? -12 : 12), p.y + (p.ty - p.y) * f); } pts.push(p.tx, p.ty); ctx.lineWidth = 4; pen.path(pts, false); break; }
    }
    ctx.restore();
  }

  function render(t) {
    const dpr = W.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W.W, W.H);
    ctx.strokeStyle = '#000'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (W.shakeT > 0) { const a = W.shakeA * (W.shakeT / 0.25); ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a); }
    drawBackground(t);
    drawBin(t);
    for (const e of W.entities) if (e.alive && e !== W.held) drawEntity(e, t);
    if (W.held && W.held.alive) drawEntity(W.held, t);
    for (const p of W.particles) drawParticle(p, t);
    for (const e of W.entities) if (e.alive && e.creature && !e.ko && !e.dying && e.hp < e.hpMax) {
      const bw = clamp(e.w, 24, 60); pen.begin(e.seed + 9, boil); ctx.lineWidth = 1.6;
      pen.rect(e.x - bw / 2, e.top - 10, bw, 5, true); ctx.fillStyle = '#000'; ctx.fillRect(e.x - bw / 2, e.top - 10, bw * Math.max(0, e.hp) / e.hpMax, 5);
    }
    for (const e of W.entities) if (e.alive) drawBubble(e);
    if (W.flash > 0) { ctx.save(); ctx.globalAlpha = W.flash; ctx.fillStyle = '#fff'; ctx.fillRect(-20, -20, W.W + 40, W.H + 40); ctx.restore(); }
    // welcome hint
    if (W.entities.length === 0 && W.stats.spawned === 0) {
      pen.begin(3, boil); ctx.lineWidth = 2;
      pen.text('Type a word up there and press Enter!', W.W / 2, W.H * 0.36, 26);
      pen.text('try: dog, dragon, race car, giant angry cat, flying pig, bomb...', W.W / 2, W.H * 0.36 + 34, 18);
      pen.text('drag things around  ·  throw them  ·  click them  ·  drop them in the trash', W.W / 2, W.H * 0.36 + 62, 16);
    }
    // counter
    ctx.save(); ctx.globalAlpha = 0.6; pen.begin(1, 0); pen.text(W.entities.length + ' things', 12, W.H - 14, 13, 'left'); ctx.restore();
  }

  // ---------- main loop ----------
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W.dpr = dpr;
    const barH = document.getElementById('bar').getBoundingClientRect().height;
    W.W = window.innerWidth; W.H = window.innerHeight - barH;
    canvas.width = Math.floor(W.W * dpr); canvas.height = Math.floor(W.H * dpr);
    canvas.style.width = W.W + 'px'; canvas.style.height = W.H + 'px';
    W.groundY = Math.floor(W.H - Math.max(44, W.H * 0.09));
    W.bin.x = W.W - 52; W.bin.y = W.groundY;
    for (const e of W.entities) { e.x = clamp(e.x, e.w / 2, W.W - e.w / 2); e.y = Math.min(e.y, W.groundY - e.h / 2); }
  }
  let acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const nowS = now / 1000;
    let dt = lastT ? nowS - lastT : 0.016; lastT = nowS;
    if (dt > 0.1) dt = 0.1;
    boil = Math.floor(nowS * 8) % 3;
    updateCursorVelocity();
    // held entity follows cursor
    if (W.held) { const e = W.held, c = W.cursor; e.x += (c.x - W.heldOff.x - e.x) * 0.7; e.y += (c.y - W.heldOff.y - e.y) * 0.7; e.x = clamp(e.x, e.w / 2 - e.w * 0.3, W.W - e.w / 2 + e.w * 0.3); e.y = clamp(e.y, e.h / 2 - e.h * 0.3, W.H + e.h); e.vx = c.vx; e.vy = c.vy; e.grounded = false; }
    // fixed step physics
    acc += dt;
    const step = 1 / 120;
    let n = 0;
    while (acc >= step && n < 6) { W.time += step; physicsStep(step); acc -= step; n++; }
    if (n === 6) acc = 0;
    for (const e of W.entities) if (e.alive) updateEntity(e, dt);
    // remove dead
    for (let i = W.entities.length - 1; i >= 0; i--) if (!W.entities[i].alive) W.entities.splice(i, 1);
    updateParticles(dt);
    // hover
    const c = W.cursor;
    const hv = c.in && !W.held ? topmostAt(c.x, c.y) : null;
    for (const e of W.entities) { const was = e.hover; e.hover = e === hv; if (e.hover && !was && e.creature && !e.sleeping && !e.bubble && Math.random() < 0.35) { e.say(e.temper === 'timid' ? '!' : e.temper === 'hostile' ? pick(e.def.roar || ['Grr!']) : pick(e.def.say)); } }
    W.hoverE = hv;
    canvas.style.cursor = W.held ? 'grabbing' : hv ? 'grab' : 'default';
    // live count on the Clear K.O. button
    if (W.koBtn) { let n = 0; for (const e of W.entities) if (e.ko && e.alive && !e.dying) n++; if (n !== W.koCount) { W.koCount = n; W.koBtn.textContent = 'Clear K.O.' + (n ? ' (' + n + ')' : ''); } }
    // bin
    const b = W.bin;
    const overBin = W.held && c.x > b.x - b.w * 0.6 && c.x < b.x + b.w * 0.6 && c.y > b.y - b.h * 0.9 && c.y < b.y + 20;
    b.open += ((overBin ? 1 : 0) - b.open) * Math.min(1, 12 * dt);
    if (b.wob > 0) b.wob -= dt * 2.5;
    if (W.shakeT > 0) { W.shakeT -= dt; if (W.shakeT <= 0) W.shakeA = 0; }
    if (W.flash > 0) W.flash -= dt * 2.5;
    render(W.time);
  }

  window.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('c');
    ctx = canvas.getContext('2d');
    pen = new SB.Pen(ctx);
    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onLeave);
    canvas.addEventListener('pointerleave', ev => { if (!W.cursor.down) W.cursor.in = false; });
    canvas.addEventListener('contextmenu', ev => ev.preventDefault());
    setupUI();
    requestAnimationFrame(frame);
  });
})();
