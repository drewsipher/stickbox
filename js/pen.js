'use strict';
// pen.js — sketchy, hand-drawn black & white drawing helper for Canvas 2D.
// Every primitive gets a small deterministic wobble seeded per entity that
// "boils" a few times a second (like a hand-drawn stick figure animation).
const SB = window.SB = window.SB || {};
SB.FONT = "'Patrick Hand', 'Comic Sans MS', 'Chalkboard SE', 'Segoe Print', cursive";
SB.TAU = Math.PI * 2;

SB.Pen = class Pen {
  constructor(ctx) {
    this.ctx = ctx;
    this.seed = 1;
    this.boil = 0;
    this.i = 0;
    this.wobble = 1.1;   // px amplitude of the wobble
    this.segLen = 12;    // px between wobble control points
  }
  begin(seed, boil) { this.seed = seed; this.boil = boil; this.i = 0; }
  // deterministic pseudo-random in [-1, 1]
  n() {
    this.i++;
    const x = Math.sin(this.seed * 12.9898 + this.i * 78.233 + this.boil * 37.719) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1;
  }
  _seg(x1, y1, x2, y2) {
    const c = this.ctx;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const n = Math.round(len / this.segLen);
    if (n <= 1) { c.lineTo(x2, y2); return; }
    const nx = -dy / len * this.wobble, ny = dx / len * this.wobble;
    for (let i = 1; i < n; i++) {
      const t = i / n, w = this.n();
      c.lineTo(x1 + dx * t + nx * w, y1 + dy * t + ny * w);
    }
    c.lineTo(x2, y2);
  }
  line(x1, y1, x2, y2) {
    const c = this.ctx;
    c.beginPath(); c.moveTo(x1, y1); this._seg(x1, y1, x2, y2); c.stroke();
  }
  // polyline; pts = [x0,y0,x1,y1,...]; fill: true => white, or a color string
  path(pts, closed, fill) {
    const c = this.ctx;
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) this._seg(pts[i - 2], pts[i - 1], pts[i], pts[i + 1]);
    if (closed) { this._seg(pts[pts.length - 2], pts[pts.length - 1], pts[0], pts[1]); c.closePath(); }
    if (fill) { c.fillStyle = fill === true ? '#fff' : fill; c.fill(); }
    c.stroke();
  }
  poly(pts, fill) { this.path(pts, true, fill); }
  rect(x, y, w, h, fill) { this.poly([x, y, x + w, y, x + w, y + h, x, y + h], fill); }
  circle(cx, cy, r, fill) { this.ellipse(cx, cy, r, r, fill, 0); }
  ellipse(cx, cy, rx, ry, fill, rot) {
    const c = this.ctx;
    c.beginPath();
    if (rx + ry < 6) { // tiny: exact ellipse, wobble would just look like noise
      c.ellipse(cx, cy, rx, ry, rot || 0, 0, SB.TAU);
    } else {
      const per = Math.PI * (rx + ry);
      const n = Math.max(8, Math.round(per / this.segLen));
      const w = this.wobble * 0.7;
      const cr = rot ? Math.cos(rot) : 1, sr = rot ? Math.sin(rot) : 0;
      let fx = 0, fy = 0;
      for (let i = 0; i < n; i++) {
        const a = i / n * SB.TAU, j = this.n() * w;
        const px = Math.cos(a) * (rx + j), py = Math.sin(a) * (ry + j);
        const x = cx + px * cr - py * sr, y = cy + px * sr + py * cr;
        if (i === 0) { c.moveTo(x, y); fx = x; fy = y; } else c.lineTo(x, y);
      }
      c.lineTo(fx, fy);
    }
    c.closePath();
    if (fill) { c.fillStyle = fill === true ? '#fff' : fill; c.fill(); }
    c.stroke();
  }
  arc(cx, cy, r, a0, a1) {
    const c = this.ctx;
    const n = Math.max(3, Math.round(Math.abs(a1 - a0) * r / this.segLen));
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n;
      const j = (i === 0 || i === n) ? 0 : this.n() * this.wobble * 0.7;
      const x = cx + Math.cos(a) * (r + j), y = cy + Math.sin(a) * (r + j);
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
  }
  // quadratic curve with wobble
  curve(x1, y1, cx, cy, x2, y2) {
    const c = this.ctx;
    const len = Math.hypot(cx - x1, cy - y1) + Math.hypot(x2 - cx, y2 - cy);
    const n = Math.max(3, Math.round(len / this.segLen));
    c.beginPath(); c.moveTo(x1, y1);
    for (let i = 1; i <= n; i++) {
      const t = i / n, mt = 1 - t;
      let x = mt * mt * x1 + 2 * mt * t * cx + t * t * x2;
      let y = mt * mt * y1 + 2 * mt * t * cy + t * t * y2;
      if (i < n) { x += this.n() * this.wobble * 0.6; y += this.n() * this.wobble * 0.6; }
      c.lineTo(x, y);
    }
    c.stroke();
  }
  // zigzag between two points (teeth, beards, grass, crowns)
  zigzag(x1, y1, x2, y2, amp, n) {
    const c = this.ctx;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len * amp, ny = dx / len * amp;
    c.beginPath(); c.moveTo(x1, y1);
    for (let i = 1; i < n; i++) {
      const t = i / n, s = (i % 2) ? 1 : 0;
      c.lineTo(x1 + dx * t + nx * s, y1 + dy * t + ny * s);
    }
    c.lineTo(x2, y2); c.stroke();
  }
  spiral(cx, cy, r, turns, rot) {
    const c = this.ctx;
    const n = Math.round(turns * 14);
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = t * turns * SB.TAU + (rot || 0), rr = r * t;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke();
  }
  star(cx, cy, r, fill) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = (i % 2) ? r * 0.45 : r;
      pts.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    this.poly(pts, fill);
  }
  heart(cx, cy, r, fill) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(cx, cy + r);
    c.bezierCurveTo(cx - r * 1.6, cy - r * 0.2, cx - r * 0.7, cy - r * 1.2, cx, cy - r * 0.4);
    c.bezierCurveTo(cx + r * 0.7, cy - r * 1.2, cx + r * 1.6, cy - r * 0.2, cx, cy + r);
    c.closePath();
    if (fill) { c.fillStyle = fill === true ? '#fff' : fill; c.fill(); }
    c.stroke();
  }
  // fuzzy / woolly closed blob (sheep, lion mane, bushes)
  fuzz(cx, cy, rx, ry, fill, bumps) {
    const c = this.ctx;
    const n = bumps || Math.max(8, Math.round((rx + ry) / 4));
    c.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = i / n * SB.TAU;
      const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      if (i === 0) c.moveTo(x, y);
      else {
        const am = a - Math.PI / n;
        const bx = cx + Math.cos(am) * rx * 1.28, by = cy + Math.sin(am) * ry * 1.28;
        c.quadraticCurveTo(bx, by, x, y);
      }
    }
    c.closePath();
    if (fill) { c.fillStyle = fill === true ? '#fff' : fill; c.fill(); }
    c.stroke();
  }
  dot(x, y, r) {
    const c = this.ctx;
    c.beginPath(); c.arc(x, y, r, 0, SB.TAU); c.fillStyle = '#000'; c.fill();
  }
  text(str, x, y, size, align) {
    const c = this.ctx;
    c.font = `${size}px ${SB.FONT}`;
    c.textAlign = align || 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#000';
    c.fillText(str, x, y);
  }
  width(str, size) {
    this.ctx.font = `${size}px ${SB.FONT}`;
    return this.ctx.measureText(str).width;
  }
};
