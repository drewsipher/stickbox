'use strict';
// entity.js — Entity class and the AI "brain" (temperaments, cursor reactions, hunting, fleeing).
(function () {
  SB.uid = 0;
  SB.battle = true; // creatures attack everything that isn't their own kind
  const pick = a => a[Math.floor(Math.random() * a.length)];
  SB.pick = pick;

  SB.matches = function (o, list) {
    if (!list || !list.length) return false;
    for (let i = 0; i < list.length; i++) if (o.tags.has(list[i])) return true;
    return false;
  };
  // same kind, or family (a giant spider and its spiderlings) — they never fight each other
  SB.kin = function (a, b) {
    return a.def.name === b.def.name || (a.def.kin && SB.matches(b, a.def.kin)) || (b.def.kin && SB.matches(a, b.def.kin));
  };

  SB.Entity = class Entity {
    constructor(def, x, y, mods) {
      mods = mods || {};
      this.def = def; this.id = ++SB.uid; this.seed = Math.random() * 1000;
      this.x = x; this.y = y; this.vx = 0; this.vy = 0;
      this.scale = mods.scale || 1;
      if (def.boss) this.scale = Math.min(this.scale, 1.5); // bosses are already giant
      this.w = def.w * this.scale; this.h = def.h * this.scale;
      this.mass = (def.mass || 1) * this.scale * this.scale * (mods.massMul || 1);
      this.angle = 0; this.angVel = 0; this.tilt = 0;
      this.facing = Math.random() < 0.5 ? -1 : 1;
      this.grounded = false; this.held = false; this.alive = true; this.dying = 0; this.dieHow = null;
      this.move = (mods.fly && def.move !== 'float') ? 'fly' : def.move;
      this.wingsMod = !!(mods.fly && def.move !== 'fly' && def.move !== 'float');
      this.speed = (def.speed || (mods.fly ? 110 : 0)) * (mods.speedMul || 1);
      if (mods.fly && this.speed < 60) this.speed = 110;
      this.temper = mods.temper || def.temper;
      this.baseMood = mods.mood || (this.temper === 'hostile' ? 'angry' : 'normal');
      this.sleeping = !!(mods.sleep || def.sleepy);
      this.mood = this.baseMood; this.tmpMood = null; this.moodT = 0;
      this.tags = new Set(def.tagSet);
      for (const t of (mods.tags || [])) this.tags.add(t);
      this.hunts = def.hunts.slice(); this.fears = def.fears.slice(); this.eats = def.eats.slice();
      if (mods.temper === 'hostile') { this.hunts.push('human', 'animal', 'pet'); this.fears = []; this.tags.add('scary'); }
      if (mods.temper === 'timid') { this.hunts = this.hunts.filter(h => h === 'food'); this.fears.push('human', 'animal'); }
      if (mods.zombie) { this.hunts.push('human'); this.convert = ['human']; } else this.convert = def.convert;
      this.state = 'idle'; this.timer = Math.random() * 2; this.dir = this.facing;
      this.phase = 0; this.moving = false; this.wheel = 0;
      this.look = { x: 0, y: 0.3 }; this.lookX = 0; this.lookY = 0.3;
      this.bubble = null; this.dizzy = 0; this.spawnT = 0; this.age = 0;
      this.target = null; this.threat = null; this.scanT = Math.random() * 0.3;
      this.mode = 'wander'; this.goal = null; this.jumpCd = 0; this.atkT = 0; this.victim = null; this.victimT = 0;
      this.stuckT = 0; this.chatT = 4 + Math.random() * 10; this.fleeT = 0; this.fleeFrom = null; this.faceT = 0;
      this.hpMax = this.hp = def.hp ? Math.round(def.hp * Math.max(0.5, Math.min(1.5, this.scale))) : Math.max(2, Math.round(2 + Math.sqrt(this.mass) * 1.2)); this.ko = false;
      this.lastHp = this.hp; this.weakT = 0; this.stepT = 0; this.owner = null; this.aim = null;
      this.whipT = 0; this.charge = 0; this.laserT = 0; this.beatT = 0; this.poundT = 0; this.swatT = 0; this.swatCd = 0; this.throwT = 0; this.regenT = 0; this.spitT = 0; this.eggT = 6; this.galeT = 3; this.gustT = 0; this.galeId = 0; this.gustId = -1; // boss attack timers
      this.webT = 0; this.frozenT = 0; this.poisonT = 0; this.poisonTick = 0; this.poisonBy = null; // wrapped in a web / frozen solid / poisoned
      this.koAngle = 0; this.attacker = null; this.armed = true; this.snapT = 0; this.onFire = 0; this.fireTick = 0; this.fireSrc = null; this.panicT = 0; this.panicDir = 1;
      this.chargeT = 0; this.pawT = 0; this.rearT = 0; this.hitIds = null;                                       // bull
      this.stingQ = 0; this.stingQT = 0; this.clawT = 0; this.clawCd = 0; this.tailT = [0, 0, 0]; this.tailHit = [false, false, false]; this.tips = null; // scorpion
      this.hitT = 0; this.lungeT = 0; this.lungeDir = 1; this.hpShown = this.hp;                                // fight animation
      this.fuse = def.fuse || 0; this.thrust = 0; this.special = def.special; this.specT = 0; this.breath = 0;
      this.noCollide = def.noCollide; this.gravity = def.gravity;
      this.bounce = mods.bounce != null ? mods.bounce : def.bounce; this.friction = def.friction;
      this.static = !!def.static; this.creature = !!def.creature;
      this.label = mods.label || null;
      this.invisible = !!mods.invisible;
      this.sparkle = !!(mods.sparkle || def.special === 'sparkle');
      this.flying = false; this.hover = false; this.wasHover = false;
      this.jump = def.jump; this.heldMood = def.heldMood;
      this.opened = false; this.face = 1 + Math.floor(Math.random() * 6); this.ring = 0; this.flash = 0; this.squash = 0;
      this.meltT = 0; this.burnT = 0; this.wantVx = 0; this.wantVy = null; this.wantJump = false;
      this.mods = mods;
      if (mods.dizzy) this.dizzy = 3;
    }
    get left() { return this.x - this.w / 2; }
    get right() { return this.x + this.w / 2; }
    get top() { return this.y - this.h / 2; }
    get bottom() { return this.y + this.h / 2; }
    setMood(m, dur) { this.tmpMood = m; this.moodT = Math.max(this.moodT, dur); }
    say(text, dur) { if (!text) return; this.bubble = { text, t: dur || 1.7, total: dur || 1.7 }; }
    contains(px, py, pad) {
      pad = pad || 0;
      return px >= this.left - pad && px <= this.right + pad && py >= this.top - pad && py <= this.bottom + pad;
    }
  };

  // find the nearest thing to chase and the nearest thing to run from
  SB.scan = function (e, W) {
    e.target = null; e.threat = null;
    let bt = Infinity, bh = Infinity;
    const huntR = e.def.huntR || 420, fearR = 240;   // bosses see much further (their ranged attacks need it)
    const ents = W.entities;
    const battle = SB.battle && e.creature && e.move !== 'none' && !e.ko;
    for (let i = 0; i < ents.length; i++) {
      const o = ents[i];
      if (o === e || !o.alive || o.dying || o.ko || o.held && o.creature === false) continue;
      const dx = o.x - e.x, dy = o.y - e.y;
      const d = Math.sqrt(dx * dx + dy * dy) - o.w * 0.5;
      if (battle) {
        // fight anything that isn't the same kind of creature; prefer creatures, natural prey and whoever hit us last
        if (SB.kin(e, o) || o.static || (o.noCollide && !o.creature) || o === e.victim) continue;
        let wgt = o.creature ? 1 : 2.2;
        if (SB.matches(o, e.hunts)) wgt *= 0.6;
        if (o === e.attacker) wgt *= 0.3;
        const dw = d * wgt;
        if (d < huntR && dw < bh) { bh = dw; e.target = o; }
        continue;
      }
      if (e.hunts.length && d < huntR && d < bh && o !== e.victim && SB.matches(o, e.hunts) && !SB.kin(e, o)) { bh = d; e.target = o; }
      if (e.fears.length && d < fearR && d < bt && !o.sleeping && SB.matches(o, e.fears) && !SB.matches(o, e.hunts)) { bt = d; e.threat = o; }
    }
  };

  SB.think = function (e, dt, W) {
    e.wantVx = 0; e.wantVy = null; e.wantJump = false;
    e.moodT -= dt; if (e.moodT <= 0) e.tmpMood = null;
    e.jumpCd -= dt; e.atkT -= dt; e.victimT -= dt; if (e.victimT <= 0) e.victim = null;
    if (!e.alive || e.held || e.dying || e.static || e.ko) { e.moving = false; return; }
    if (e.dizzy > 0 || e.sleeping || e.move === 'none' || e.spawnT < 0.15) { e.moving = false; return; }
    if (e.charge > 0 || e.beatT > 0 || e.poundT > 0 || e.throwT > 0 || e.whipT > 0) { e.moving = false; return; } // winding up an attack: stand still
    if (e.webT > 0 || e.frozenT > 0) { e.moving = false; return; } // wrapped in a web or frozen solid: can't move
    if (e.pawT > 0 || e.rearT > 0 || e.stingQ > 0 || e.clawT > 0) { e.moving = false; return; } // pawing, rearing, stinging, pinching: stand still
    if (e.chargeT > 0) { e.wantVx = e.facing * (e.def.chargeSpeed || 650) * (e.poisonT > 0 ? 0.6 : 1); e.moving = true; e.mode = 'hunt'; return; } // charging: full speed ahead
    if (e.breath > 0 && e.def.boss) { e.moving = false; return; } // breathing fire/ice: stand still
    e.scanT -= dt;
    if (e.scanT <= 0) { e.scanT = 0.25 + Math.random() * 0.2; SB.scan(e, W); }
    const cur = W.cursor, t = W.time;
    const dxC = cur.x - e.x, dyC = cur.y - e.y, dC = Math.sqrt(dxC * dxC + dyC * dyC);
    const range = 90 + e.h * 0.8;
    let mode = 'wander', tx = e.x, ty = e.y, tgt = null;
    e.fleeT -= dt;
    let fleeSrc = null;
    if (e.threat && e.threat.alive && !e.threat.dying) {
      const d = Math.hypot(e.threat.x - e.x, e.threat.y - e.y);
      if (d < 170 + e.threat.w * 0.5 + e.w * 0.5) fleeSrc = e.threat;
    }
    if (!fleeSrc && cur.in && e.creature && e.temper === 'timid' && dC < range * 1.3) fleeSrc = 'cursor';
    if (fleeSrc) { e.fleeT = 0.7; e.fleeFrom = fleeSrc; }
    else if (e.fleeT > 0 && e.fleeFrom) {
      fleeSrc = e.fleeFrom;
      if (fleeSrc === 'cursor' ? !cur.in : (!fleeSrc.alive || fleeSrc.dying)) { fleeSrc = null; e.fleeT = 0; }
    }
    if (fleeSrc) { mode = 'flee'; if (fleeSrc === 'cursor') { tx = cur.x; ty = cur.y; } else { tx = fleeSrc.x; ty = fleeSrc.y; } }
    if (e.onFire > 0 && e.creature) {
      // on fire: run from the fire if it's close, otherwise panic in random directions
      e.panicT -= dt;
      if (e.panicT <= 0) { e.panicT = 0.3 + Math.random() * 0.5; e.panicDir = Math.random() < 0.5 ? -1 : 1; }
      const fs = e.fireSrc;
      mode = 'flee';
      if (fs && fs.alive && !fs.dying && Math.hypot(fs.x - e.x, fs.y - e.y) < 160) { tx = fs.x; ty = fs.y; }
      else { tx = e.x - e.panicDir * 60; ty = e.y + 20; }
    }
    if (mode === 'wander' && e.target) { mode = 'hunt'; tgt = e.target; tx = tgt.x; ty = tgt.y; }
    if (mode === 'wander' && cur.in && e.creature && e.temper === 'hostile' && dC < range * 3) { mode = 'hunt'; tx = cur.x; ty = cur.y; }
    if (mode === 'wander' && cur.in && e.creature && e.temper === 'curious' && dC < range * 2.2 && dC > 34 + e.w * 0.5) { mode = 'approach'; tx = cur.x; ty = cur.y; }
    e.mode = mode;
    if (mode === 'flee') e.setMood('scared', 0.4);
    else if (mode === 'hunt') e.setMood((tgt && SB.matches(tgt, e.eats) && !e.tags.has('predator')) || (tgt && !tgt.creature) ? 'happy' : 'angry', 0.4);
    else if (mode === 'approach') e.setMood('happy', 0.4);

    const sp = e.speed * (e.poisonT > 0 ? 0.55 : 1);   // poisoned creatures are sluggish
    switch (e.move) {
      case 'walk': case 'drive': case 'crawl': {
        if (mode === 'flee') {
          e.dir = e.x < tx ? -1 : 1; e.wantVx = e.dir * sp * 1.5; e.state = 'walk'; e.timer = 0.5;
          if (e.grounded && Math.abs(e.x - tx) < 50 && e.move === 'walk') e.wantJump = true;
        } else if (mode === 'hunt' || mode === 'approach') {
          const dx = tx - e.x;
          const stop = tgt ? (tgt.w + e.w) * 0.3 : 26 + e.w * 0.3;
          if (Math.abs(dx) > stop) { e.dir = dx > 0 ? 1 : -1; e.wantVx = e.dir * sp * (mode === 'approach' ? 0.7 : 1.2); }
          else {
            e.wantVx = 0; if (Math.abs(dx) > 10) { e.dir = dx > 0 ? 1 : -1; e.facing = e.dir; }
            if (!tgt && mode === 'hunt' && e.atkT <= 0) { e.atkT = 1.4; e.say(pick(e.def.roar || ['Rawr!'])); e.wantJump = true; W.shake(4); }
          }
          if (tgt && tgt.y < e.y - e.h * 0.6 && Math.abs(dx) < 70) e.wantJump = true;
        } else {
          e.timer -= dt;
          if (e.timer <= 0) {
            if (e.state === 'walk') { e.state = 'idle'; e.timer = e.move === 'drive' ? 0.3 + Math.random() * 1.5 : 0.8 + Math.random() * 2.5; }
            else { e.state = 'walk'; e.timer = 1 + Math.random() * 3; e.dir = Math.random() < 0.5 ? -1 : 1; }
          }
          if (e.x < 70 && e.dir < 0) e.dir = 1;
          if (e.x > W.W - 70 && e.dir > 0) e.dir = -1;
          e.wantVx = e.state === 'walk' ? e.dir * sp * (e.move === 'drive' ? 1 : 0.75) : 0;
        }
        if (e.def.jumpy && e.grounded && Math.random() < e.def.jumpy * dt) e.wantJump = true;
        // stuck against something? hop over it
        if (Math.abs(e.wantVx) > 10 && Math.abs(e.vx) < 6 && e.grounded) { e.stuckT += dt; if (e.stuckT > 0.5) { e.wantJump = true; e.stuckT = 0; } } else e.stuckT = 0;
        break;
      }
      case 'hop': {
        if (e.grounded) {
          e.timer -= dt;
          const urgent = mode !== 'wander';
          if (e.timer <= 0 || (urgent && e.timer < 0.5)) {
            let dir;
            if (mode === 'flee') dir = e.x < tx ? -1 : 1;
            else if (mode === 'hunt' || mode === 'approach') dir = tx > e.x ? 1 : -1;
            else dir = Math.random() < 0.5 ? -1 : 1;
            if (e.x < 70) dir = 1; if (e.x > W.W - 70) dir = -1;
            const near = (mode === 'approach' || mode === 'hunt') && Math.abs(tx - e.x) < 40;
            if (near && mode === 'approach') { e.timer = 0.6; e.facing = dir; }
            else {
              e.dir = dir; e.facing = dir;
              e.vx = dir * sp * (urgent ? 1.3 : 1) * (near ? 0.3 : 1);
              e.vy = -e.jump * (0.85 + Math.random() * 0.3) * (urgent ? 1.1 : 1);
              e.grounded = false;
              e.timer = urgent ? 0.2 : 0.5 + Math.random() * 2;
            }
          }
          e.wantVx = 0;
        } else e.wantVx = e.vx;
        break;
      }
      case 'fly': case 'float': {
        const gy = W.groundY;
        const minY = gy * e.def.flyMin + 30, maxY = Math.max(minY + 10, gy * e.def.flyMax);
        let fx = tx, fy = ty;
        if (mode === 'flee') { fx = e.x + (e.x < tx ? -1 : 1) * 250; fy = Math.max(minY, Math.min(maxY, e.y - 100)); }
        else if (mode === 'approach') { const d = Math.hypot(tx - e.x, ty - e.y); if (d < 50 + e.w * 0.5) { fx = e.x; fy = e.y; } }
        else if (mode === 'hunt') { if (tgt) fy = tgt.y - (tgt.h + e.h) * 0.25; }
        else {
          e.timer -= dt;
          if (e.timer <= 0 || !e.goal) { e.timer = 1.5 + Math.random() * 3; e.goal = { x: 60 + Math.random() * (W.W - 120), y: minY + Math.random() * Math.max(10, maxY - minY) }; }
          fx = e.goal.x; fy = e.goal.y;
        }
        if (e.def.cruise) {
          if (e.x < 90 && e.facing < 0) e.facing = 1;
          if (e.x > W.W - 90 && e.facing > 0) e.facing = -1;
          const goalY = mode === 'wander' ? fy : Math.max(minY, Math.min(maxY, fy));
          e.wantVx = e.facing * sp;
          e.wantVy = Math.max(-sp * 0.4, Math.min(sp * 0.4, (goalY - e.y) * 1.5));
        } else {
          const dx = fx - e.x, dy = fy - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
          const s = sp * (mode === 'flee' ? 1.5 : mode === 'hunt' ? 1.2 : 1);
          const k = Math.min(1, d / 100);
          e.wantVx = dx / d * s * k;
          e.wantVy = dy / d * s * k + Math.sin(t * 2.5 + e.seed) * (e.move === 'float' ? 8 : 25);
        }
        break;
      }
      case 'flop': {
        if (e.grounded) {
          e.timer -= dt;
          if (e.timer <= 0) {
            e.timer = 0.4 + Math.random() * 2.2;
            const urgent = mode === 'flee';
            e.vy = -(150 + Math.random() * 220);
            e.vx = (Math.random() - 0.5) * 260;
            if (urgent) e.vx = (e.x < tx ? -1 : 1) * 220;
            if (e.x < 70) e.vx = Math.abs(e.vx); if (e.x > W.W - 70) e.vx = -Math.abs(e.vx);
            e.angVel = (Math.random() - 0.5) * 14;
            e.grounded = false; e.facing = e.vx > 0 ? 1 : -1;
            e.setMood('scared', 0.6);
          }
          e.wantVx = 0;
        } else e.wantVx = e.vx;
        break;
      }
    }
    if (e.move !== 'hop' && e.move !== 'flop' && !e.def.cruise) {
      const fth = Math.max(3, sp * 0.08);
      const want = e.wantVx > fth ? 1 : e.wantVx < -fth ? -1 : 0;
      if (want && want !== e.facing) { e.faceT += dt; if (e.faceT > 0.15) { e.facing = want; e.faceT = 0; } }
      else e.faceT = 0;
    }
  };
})();
