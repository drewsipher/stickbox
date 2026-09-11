'use strict';
// dictionary.js — word registry, adjectives/modifiers, lookup with plurals, typo tolerance & suggestions.
(function () {
  SB.DEFS = {};      // name -> definition
  SB.WORDS = {};     // any word or alias -> name
  SB.NOSPACE = {};   // "firetruck" -> name
  SB.ORDER = [];     // registration order (for the help panel)

  SB.def = function (name, spec) {
    const def = Object.assign({
      name, cat: 'item', aliases: [], tags: [], mass: 1, move: 'none', speed: 0, temper: 'neutral',
      hunts: [], fears: [], eats: [], convert: null, say: [], roar: null, bounce: 0.25, friction: 4,
      special: null, gravity: 1, noCollide: false, jump: 420, flyMin: 0.12, flyMax: 0.6, creature: false,
      cruise: false, jumpy: 0, sleepy: false, roll: false, heldMood: null, hint: ''
    }, spec);
    if (spec.t) { def.w = spec.t.w; def.h = spec.t.h; def.draw = spec.t.draw; }
    def.tagSet = new Set([name, ...def.tags, ...def.aliases]);
    SB.DEFS[name] = def;
    SB.WORDS[name] = name;
    SB.NOSPACE[name.replace(/ /g, '')] = name;
    for (const a of def.aliases) { SB.WORDS[a] = name; SB.NOSPACE[a.replace(/ /g, '')] = name; }
    SB.ORDER.push(name);
    return def;
  };

  // helper: merge base spec with overrides, concatenating list fields
  SB.merge = function (base, spec) {
    const out = Object.assign({}, base, spec);
    for (const k of ['tags', 'fears', 'hunts', 'eats', 'aliases']) {
      if (base[k] && spec[k]) out[k] = [...base[k], ...spec[k]];
    }
    return out;
  };

  // ---- adjectives ----
  const big = s => ({ scale: s }), small = s => ({ scale: s });
  SB.MODS = {
    giant: big(2.3), huge: big(2), big: big(1.5), large: big(1.5), enormous: big(2.6), massive: big(2.3), mega: big(2.3),
    jumbo: big(2), gigantic: big(2.6), colossal: big(3), tall: big(1.5),
    tiny: small(0.5), small: small(0.7), mini: small(0.5), little: small(0.7), micro: small(0.35), teeny: small(0.4),
    baby: { scale: 0.55, mood: 'happy', cute: true }, young: small(0.75), short: small(0.75),
    flying: { fly: true }, winged: { fly: true }, floating: { fly: true },
    angry: { temper: 'hostile', mood: 'angry' }, mad: { temper: 'hostile', mood: 'angry' }, evil: { temper: 'hostile', mood: 'angry', tags: ['villain', 'scary'] },
    mean: { temper: 'hostile', mood: 'angry' }, scary: { temper: 'hostile', mood: 'angry', tags: ['scary'] }, grumpy: { mood: 'angry' },
    wild: { temper: 'hostile', mood: 'angry' }, hungry: { temper: 'hostile', mood: 'angry' }, killer: { temper: 'hostile', mood: 'angry', tags: ['scary'] },
    happy: { temper: 'curious', mood: 'happy' }, friendly: { temper: 'curious', mood: 'happy' }, nice: { temper: 'curious', mood: 'happy' },
    cute: { temper: 'curious', mood: 'happy' }, kind: { temper: 'curious', mood: 'happy' }, good: { temper: 'curious', mood: 'happy' },
    scared: { temper: 'timid', mood: 'scared' }, shy: { temper: 'timid' }, nervous: { temper: 'timid', mood: 'scared' }, brave: { temper: 'neutral' },
    fast: { speedMul: 2.2 }, speedy: { speedMul: 2.2 }, quick: { speedMul: 2.2 }, rapid: { speedMul: 2.2 }, super: { speedMul: 1.8, fly: true },
    slow: { speedMul: 0.4 }, lazy: { speedMul: 0.4, mood: 'sleep' }, old: { speedMul: 0.5 },
    sleepy: { sleep: true }, sleeping: { sleep: true }, tired: { sleep: true }, asleep: { sleep: true },
    bouncy: { bounce: 0.9 }, rubber: { bounce: 0.9 }, springy: { bounce: 0.9 },
    invisible: { invisible: true }, heavy: { massMul: 6 }, light: { massMul: 0.2 },
    zombie: { temper: 'hostile', mood: 'angry', tags: ['scary', 'villain', 'undead'], speedMul: 0.6, zombie: true },
    magic: { sparkle: true }, magical: { sparkle: true }, golden: { sparkle: true }, rainbow: { sparkle: true }, sparkly: { sparkle: true }, shiny: { sparkle: true },
    dizzy: { dizzy: true }, crazy: { speedMul: 2, mood: 'happy' }, silly: { mood: 'happy' }, sad: { mood: 'scared' },
    fat: { scale: 1.3 }, skinny: { scale: 0.85 }, toy: { scale: 0.45, mood: 'happy' }, stuffed: { scale: 0.5, mood: 'happy' }, pet: { temper: 'curious', mood: 'happy' }, wooden: {}, red: {}, blue: {}, green: {}, yellow: {}, pink: {}, purple: {}, black: {}, white: {}, orange: {}, brown: {}
  };
  SB.parseMods = function (words) {
    const m = { scale: 1, speedMul: 1, massMul: 1, tags: [] };
    for (const w of words) {
      const mod = SB.MODS[w];
      if (!mod) continue;
      for (const k in mod) {
        if (k === 'scale') m.scale *= mod.scale;
        else if (k === 'speedMul') m.speedMul *= mod.speedMul;
        else if (k === 'massMul') m.massMul *= mod.massMul;
        else if (k === 'tags') m.tags.push(...mod.tags);
        else m[k] = mod[k];
      }
    }
    m.scale = Math.max(0.25, Math.min(3.5, m.scale));
    return m;
  };

  const FILLER = new Set(['a', 'an', 'the', 'some', 'my', 'one', 'please', 'make', 'create', 'spawn', 'add', 'give', 'me', 'i', 'want', 'of']);

  SB.findWord = function (w) {
    if (SB.WORDS[w]) return SB.WORDS[w];
    if (w.endsWith('ies') && SB.WORDS[w.slice(0, -3) + 'y']) return SB.WORDS[w.slice(0, -3) + 'y'];
    if (w.endsWith('es') && SB.WORDS[w.slice(0, -2)]) return SB.WORDS[w.slice(0, -2)];
    if (w.endsWith('s') && SB.WORDS[w.slice(0, -1)]) return SB.WORDS[w.slice(0, -1)];
    const ns = w.replace(/ /g, '');
    if (SB.NOSPACE[ns]) return SB.NOSPACE[ns];
    return null;
  };

  function lev(a, b) {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > 2) return 99;
    let prev = new Array(n + 1), cur = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      cur[0] = i;
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      [prev, cur] = [cur, prev];
    }
    return prev[n];
  }
  SB.fuzzy = function (w) {
    if (w.length < 4) return null;
    const maxD = w.length >= 7 ? 2 : 1;
    let best = null, bd = 99;
    for (const k in SB.WORDS) {
      const d = lev(w, k);
      if (d < bd) { bd = d; best = SB.WORDS[k]; }
    }
    return bd <= maxD ? best : null;
  };

  SB.normalize = function (text) {
    return text.toLowerCase().replace(/[^a-z0-9 \-']/g, ' ').replace(/[-']/g, ' ').replace(/\s+/g, ' ').trim();
  };

  // returns { def, mods, label, fuzzy }
  SB.lookup = function (text) {
    const s = SB.normalize(text);
    if (!s) return null;
    const words = s.split(' ').filter(w => !FILLER.has(w));
    if (!words.length) return null;
    for (let k = Math.min(3, words.length); k >= 1; k--) {
      const phrase = words.slice(words.length - k).join(' ');
      const name = SB.findWord(phrase);
      if (name) return { def: SB.DEFS[name], mods: SB.parseMods(words.slice(0, words.length - k)), text: s };
    }
    // maybe the noun is first ("dog giant")
    const first = SB.findWord(words[0]);
    if (first && words.length > 1) return { def: SB.DEFS[first], mods: SB.parseMods(words.slice(1)), text: s };
    const last = words[words.length - 1];
    const fz = SB.fuzzy(last);
    if (fz) return { def: SB.DEFS[fz], mods: SB.parseMods(words.slice(0, -1)), text: s, fuzzy: true };
    return { def: null, mods: SB.parseMods(words.slice(0, -1)), text: s, label: last };
  };

  // autocomplete: names starting with the last token (deduplicated by def)
  SB.suggest = function (text, max) {
    const s = SB.normalize(text);
    if (!s) return [];
    const words = s.split(' ');
    const last = words[words.length - 1];
    const prefix = words.slice(0, -1).filter(w => SB.MODS[w]).join(' ');
    if (!last) return [];
    const seen = new Set(), out = [];
    const keys = Object.keys(SB.WORDS);
    for (const pass of [0, 1]) {
      for (const k of keys) {
        const hit = pass === 0 ? k.startsWith(last) : (k.includes(' ' + last) || (k.includes(last) && k !== last));
        if (!hit) continue;
        const name = SB.WORDS[k];
        if (seen.has(name)) continue;
        seen.add(name);
        out.push({ word: k, name, full: (prefix ? prefix + ' ' : '') + k });
        if (out.length >= (max || 8)) return out;
      }
    }
    return out;
  };

  // ---- unknown word log: remembers what people typed that we don't know yet ----
  const LS_KEY = 'stickbox.unknownWords';
  let unknownCache = null;
  function loadUnknown() {
    if (unknownCache) return unknownCache;
    try { unknownCache = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (e) { unknownCache = {}; }
    return unknownCache;
  }
  function saveUnknown() { try { localStorage.setItem(LS_KEY, JSON.stringify(unknownCache)); } catch (e) { /* storage blocked: list lives in memory for this session */ } }
  SB.logUnknown = function (word, typed) {
    const u = loadUnknown(), now = Date.now();
    const rec = u[word] || (u[word] = { count: 0, first: now, typed: [] });
    rec.count++; rec.last = now;
    if (typed && typed !== word && !rec.typed.includes(typed)) { rec.typed.push(typed); if (rec.typed.length > 5) rec.typed.shift(); }
    saveUnknown();
    return rec;
  };
  // sorted list; words that have since been added to the dictionary are pruned
  SB.unknownWords = function () {
    const u = loadUnknown();
    let changed = false;
    for (const w in u) { const r = SB.lookup(w); if (r && r.def && !r.fuzzy) { delete u[w]; changed = true; } }
    if (changed) saveUnknown();
    return Object.keys(u).map(w => Object.assign({ word: w }, u[w])).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
  };
  SB.clearUnknown = function () { unknownCache = {}; saveUnknown(); };
  SB.exportUnknown = function () {
    const rows = SB.unknownWords().map(r => `${r.word}\t${r.count}\t${(r.typed || []).join(' | ')}`);
    return 'word\ttimes typed\tfull phrases\n' + rows.join('\n');
  };

  SB.randomName = function () {
    const names = SB.ORDER.filter(n => !SB.DEFS[n].hidden);
    return names[Math.floor(Math.random() * names.length)];
  };
})();
