/* The word picker: which two words a level gets, by fixed rules (no language model). window.WW_PICKER.
   Pure: no DOM, no game variables, no clock. The game (src/js/87-picker.js) and the tutor's page both use it.
   Self-test: node site/picker.js

   1. The band of the day (1 easiest .. 9 hardest), worked out again each time from his finished levels; nothing is stored.
      Start at 5. After each finished level, in level order, look at his first tries on that level (the quest row's counters:
      new_right, new_wrong for the new words, reviews_right, reviews_wrong for the old words met that day):
        80% or more right -> up half a band; 50% or less -> down half a band; otherwise stay.
        a word that needed "Look and copy" on that level (event "rescue") -> down half a band more.
        the never-taught word at the end of the level (attempt kind "probe") right -> up a quarter band.
      Never more than one band away from where the day started (the day a level was finished); always within 1 to 9.
      The band used is the whole-number part.
   2. The words: from that band, words not his and never picked for him before; a word whose spelling features match
      his recent slips first (the error codes of site/patterns.js on his first tries of the last three levels); at least
      one of the two with a picture when possible; never two that start with the same three letters; nearest bands when
      the band has too few words left. Ties are broken by a random order seeded by the student and the level, so the
      same student and level always get the same words.
   Picker off (students.picker false), or no pool: the next words of the bank's fixed course. */
(function (root) {
  "use strict";
  const START = 5, MIN = 1, MAX = 9, HI = 0.8, LO = 0.5, STEP = 0.5, PROBE = 0.25, DAY_LIMIT = 1, SLIP_LEVELS = 3;
  // The band he gets is a whole number. It follows the running value only once the value is three quarters of a band away
  // from it, so one good level and one not-so-good level in turn do not make the words jump easier, harder, easier.
  const HOLD = 0.75;
  const key = s => String(s == null ? "" : s).toLowerCase().replace(/[‘’`´]/g, "'").replace(/[^a-z']/g, "");
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad = n => String(n).padStart(2, "0");
  const dayOf = iso => { if (!iso) return ""; if (String(iso).length <= 10) return String(iso); const d = new Date(iso); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  const ms = iso => iso ? new Date(iso).getTime() : NaN;

  // ---------- 1. the band ----------
  // in: { quests, attempts (kinds new/review/test/probe are enough), events (types rescue are enough), words, level }
  // Only levels before `level` count, so the answer for a level never changes once that level has opened.
  function bandFor(o) {
    o = o || {};
    const level = o.level || Infinity;
    const done = (o.quests || []).filter(q => q && q.completed && q.quest_day != null && q.quest_day < level && !q.kind)
      .sort((a, b) => a.quest_day - b.quest_day);
    const att = o.attempts || [], ev = (o.events || []).filter(e => e && e.type === "rescue");
    let value = START, dayStart = START, day = null, held = START;
    const steps = [];
    done.forEach((q, i) => {
      const ok = (q.new_right || 0) + (q.reviews_right || 0), total = ok + (q.new_wrong || 0) + (q.reviews_wrong || 0);
      let delta = 0;
      const share = total ? ok / total : null;
      if (share != null) delta = share >= HI ? STEP : share <= LO ? -STEP : 0;
      // the level's own words (its answers and its new words): a rescue counts when it is one of them, inside the level's time
      const mine = new Set(att.filter(a => a.quest_id === q.id).map(a => key(a.word)));
      (o.words || []).forEach(w => { if (w.quest_day === q.quest_day) mine.add(key(w.word)); });
      const from = ms(q.started_at), to = ms(q.finished_at), next = done[i + 1];
      const rescues = ev.filter(e => {
        const t = ms(e.created_at), d = e.detail || {};
        if (d.kind === "training") return false;
        if (!isNaN(from) && t < from) return false;
        if (!isNaN(to) && t > to) return false;
        if (isNaN(to) && next && !isNaN(ms(next.started_at)) && t >= ms(next.started_at)) return false;
        return !mine.size || mine.has(key(d.word));
      });
      if (rescues.length) delta -= STEP;
      const probe = att.find(a => a.quest_id === q.id && a.kind === "probe");
      if (probe && probe.correct) delta += PROBE;
      const d = dayOf(q.finished_at || q.started_at) || "level" + q.quest_day;
      if (d !== day) { day = d; dayStart = value; }
      const before = value;
      value = clamp(clamp(value + delta, dayStart - DAY_LIMIT, dayStart + DAY_LIMIT), MIN, MAX);
      if (Math.abs(value - held) >= HOLD) held = clamp(Math.round(value), MIN, MAX);
      steps.push({ level: q.quest_day, day: d, ok, total, rescue: rescues.length, probe: probe ? !!probe.correct : null, delta, before, after: value, band: held, held: value !== clamp(before + delta, MIN, MAX) });
    });
    const band = held;
    return { band, value, steps, reason: reasonFor(band, steps) };
  }
  const HALF = { 0.25: "a quarter band", 0.5: "half a band", 0.75: "three quarters of a band", 1: "one band", 1.25: "one band" };
  function reasonFor(band, steps) {
    const head = "Band " + band + " of 9. ";
    const s = steps[steps.length - 1];
    if (!s) return head + "No level finished yet, so the words start in the middle.";
    const parts = [];
    parts.push(s.total ? s.ok + " of " + s.total + " first tries were right" : "there were no first tries to count");
    if (s.rescue) parts.push(s.rescue === 1 ? "one word needed Look and copy" : s.rescue + " words needed Look and copy");
    if (s.probe) parts.push("the never-taught word was right");
    const moved = Math.round((s.after - s.before) * 100) / 100;
    const how = moved > 0 ? "so the band went up " + (HALF[moved] || moved + " of a band") : moved < 0 ? "so the band went down " + (HALF[-moved] || -moved + " of a band") : "so the band stayed";
    const held = s.held ? " (one band a day at most)" : "";
    const list = parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0];
    return head + "On level " + s.level + ", " + list + ", " + how + held + ".";
  }

  // ---------- his recent slips -> spelling features to prefer ----------
  const FEATURES_OF = { double: ["double"], silent_e: ["magic_e"], m_before_pb: ["m_pb"], vowel: ["vowel_team"], beat_missing: ["long"], ending: ["le_end", "y_end"] };
  // First tries not right on his last three finished levels before `level` (attempt kinds new, review, test), named by
  // patterns.classify. Tied to levels, not to the clock, so the answer for a level does not change from day to day.
  function slipCodes(o) {
    const P = o.patterns; if (!P || !P.classify) return [];
    const level = o.level || Infinity;
    const qs = (o.quests || []).filter(q => q && q.completed && q.quest_day != null && q.quest_day < level && !q.kind)
      .sort((a, b) => a.quest_day - b.quest_day).slice(-SLIP_LEVELS);
    const ids = new Set(qs.map(q => q.id)), beats = {};
    (o.words || []).forEach(w => { beats[key(w.word)] = w.chunks; });
    const n = {};
    (o.attempts || []).filter(a => ids.has(a.quest_id) && !a.correct && (a.kind === "new" || a.kind === "review" || a.kind === "test") && a.answer)
      .forEach(a => { let c = []; try { c = P.classify(a.word, a.answer, beats[key(a.word)]) || []; } catch (e) {} new Set(c).forEach(x => { n[x] = (n[x] || 0) + 1; }); });
    return Object.keys(n).filter(c => FEATURES_OF[c]).sort((a, b) => n[b] - n[a] || (a < b ? -1 : 1)).slice(0, 2);
  }

  // ---------- 2. the words ----------
  function rowOf(r) {   // a pool.js row as an object
    return { word: r[0], chunks: r[1], meaning_en: r[2], meaning_zh: r[3], sentence_en: r[4], sentence_zh: r[5], dialogue_q: r[7], dialogue_a: r[8],
      bank_level: r[9] || 0, focus: r[10] || "", sounds: r[11] || 0, rule_en: r[12], rule_zh: r[13], band: r[14] || null, cambridge: r[15] || "", feat: r[16] || [], beats: r[17] || 0, pic: !!r[18] };
  }
  function bankRowOf(b, i) {
    return { word: b[0], chunks: b[1], meaning_en: b[2], meaning_zh: b[3], sentence_en: b[4], sentence_zh: b[5], dialogue_q: b[7], dialogue_a: b[8],
      bank_level: b[9] || 0, focus: b[10] || "", sounds: b[11] || 0, rule_en: b[12], rule_zh: b[13], band: null, cambridge: "", feat: [], beats: 0, pic: false, order: i };
  }
  function seeded(seed) {   // mulberry32 on an FNV-1a hash of the seed text
    let h = 2166136261; const s = String(seed);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    let a = h >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const pre3 = w => key(w).replace(/'/g, "").slice(0, 3);
  // in: { student, level, band, pool (pool.js rows), bank (bank.js rows), mine (his words, strings), avoid (words picked
  //       for him before), have (words already on this level), slips (codes), pics (WW_PICS), need (default 2), on }
  // out: { words: [objects], spare: [objects], band, off, wide }
  function pickWords(o) {
    const need = o.need == null ? 2 : o.need;
    const pool = (o.pool || []).map(rowOf);
    const taken = new Set((o.mine || []).concat(o.avoid || []).map(key));
    const have = (o.have || []).map(pre3);
    const pics = o.pics || null;
    const picOf = w => pics ? !!pics[key(w.word).replace(/'/g, "")] : w.pic;
    const free = w => !taken.has(key(w.word));
    const fits = (w, chosen) => have.concat(chosen.map(c => pre3(c.word))).indexOf(pre3(w.word)) < 0;
    if (need <= 0) return { words: [], spare: [], band: o.band, off: false, wide: false };
    if (o.on === false || !pool.length) {   // the fixed course: the next bank words in the bank's order, levels 4 to 50
      const inPool = pool.length ? new Set(pool.map(w => key(w.word))) : null;
      const bandOf = {}; pool.forEach(w => { bandOf[key(w.word)] = w.band; });
      const list = (o.bank || []).map(bankRowOf).filter(w => w.bank_level >= 4 && free(w) && (!inPool || inPool.has(key(w.word))))
        .sort((a, b) => a.bank_level - b.bank_level || a.order - b.order);
      list.forEach(w => { w.band = bandOf[key(w.word)] || null; w.pic = pics ? picOf(w) : w.pic; });
      return { words: list.slice(0, need), spare: list.slice(need, need + 6), band: o.band, off: true, wide: false };
    }
    const band = clamp(Math.floor(o.band || START), MIN, MAX);
    const want = new Set([].concat(...(o.slips || []).map(c => FEATURES_OF[c] || [])));
    const top = new Set(FEATURES_OF[(o.slips || [])[0]] || []);   // his most frequent slip: a word that trains it comes before one that trains another slip
    const rnd = seeded((o.student || "") + "|" + o.level);
    const cands = pool.filter(free).map(w => ({ w, dist: Math.abs((w.band || START) - band), lower: (w.band || START) < band ? 0 : 1, match: w.feat.some(f => top.has(f)) ? 2 : w.feat.some(f => want.has(f)) ? 1 : 0, pic: picOf(w) ? 1 : 0, r: rnd() }));
    // the band itself first; when it has too few words left, the nearest bands (the easier one first on a tie)
    let reach = 0; while (reach < 8 && cands.filter(c => c.dist <= reach).length < need) reach++;
    const near = cands.filter(c => c.dist <= reach);
    const order = (a, b) => a.dist - b.dist || a.lower - b.lower || b.match - a.match || a.r - b.r;
    const chosen = [];
    while (chosen.length < need) {
      const wantPic = !chosen.some(c => picOf(c)) && chosen.length === need - 1 && !(o.havePic);
      const ok = near.filter(c => chosen.indexOf(c.w) < 0 && fits(c.w, chosen));
      if (!ok.length) break;
      ok.sort(wantPic ? (a, b) => a.dist - b.dist || b.pic - a.pic || order(a, b) : order);
      chosen.push(ok[0].w);
    }
    const spare = cands.filter(c => chosen.indexOf(c.w) < 0).sort(order).slice(0, 6).map(c => c.w);
    return { words: chosen, spare, band, off: false, wide: reach > 0, slips: Array.from(want) };
  }

  // Both steps, and the one sentence for the tutor.
  function plan(o) {
    const B = bandFor(o);
    const on = o.on !== false && (o.pool || []).length > 0;
    const p = pickWords(Object.assign({}, o, { band: B.band, on, slips: on ? slipCodes(o) : [] }));
    let reason = B.reason;
    if (!on) reason = (o.on === false ? "The picker is off" : "There is no word pool") + ", so the level gets the next words of the fixed course.";
    else if (p.wide) reason += " Band " + B.band + " had too few words left, so a nearby band helped.";
    return { level: o.level, band: B.band, value: B.value, steps: B.steps, words: p.words, spare: p.spare, reason, off: !on, slips: p.slips || [] };
  }

  const API = { bandFor, slipCodes, pickWords, plan, rowOf, key, seeded, START, MIN, MAX, FEATURES_OF };
  root.WW_PICKER = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;

  // ---------- self-test: node site/picker.js ----------
  if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) { if (process.argv.indexOf("--simulate") > 0) simulate(); else selfTest(); }
  // node site/picker.js --simulate: 40 days, one level a day, three made-up players; prints the band used each day.
  // Each answer is right with a chance that falls as the band rises above what the player can do (old words a little easier);
  // a new or old word not right needs "Look and copy" with the player's own chance. The numbers are fixed (seeded).
  function simulate() {
    const sig = x => 1 / (1 + Math.exp(-x));
    const run = (name, can, copyP, seed) => {
      const rnd = seeded(seed), quests = [], attempts = [], events = [], bands = [];
      for (let day = 1; day <= 40; day++) {
        const b = bandFor({ quests, attempts, events, level: day }).band; bands.push(b);
        const at = h => new Date(Date.UTC(2026, 0, day, h)).toISOString();
        const q = { id: "q" + day, quest_day: day, completed: true, started_at: at(8), finished_at: at(9), new_right: 0, new_wrong: 0, reviews_right: 0, reviews_wrong: 0 };
        const answer = (easier, kind, i) => { const ok = rnd() < sig((can - b) * 0.7 + easier); q[kind + (ok ? "_right" : "_wrong")]++; attempts.push({ quest_id: q.id, kind: kind === "new" ? "new" : "review", word: "w" + day + kind + i, correct: ok });
          if (!ok && rnd() < copyP) events.push({ type: "rescue", created_at: at(8), detail: { word: "w" + day + kind + i, kind: "new" } }); };
        for (let i = 0; i < 2; i++) answer(0, "new", i);
        for (let i = 0; i < 4; i++) answer(1.2, "reviews", i);
        attempts.push({ quest_id: q.id, kind: "probe", word: "p" + day, correct: rnd() < sig(can - b - 1) });
        quests.push(q);
      }
      const moves = bands.slice(1).filter((x, i) => x !== bands[i]).length;
      console.log((name + ":").padEnd(32) + bands.join(" ") + "   (band changed on " + moves + " of 39 days)");
    };
    run("Almost everything right", 13, 0.1, "a");
    run("In the middle", 5.5, 0.2, "b");
    run("Often needs Look and copy", 2.5, 0.6, "c");
  }
  function selfTest() {
    const fs = require("fs"), path = require("path"), vm = require("vm");
    const load = (f, name) => { const p = path.join(__dirname, f); if (!fs.existsSync(p)) return null; const box = { window: {} }; vm.runInNewContext(fs.readFileSync(p, "utf8"), box); return box.window[name]; };
    const POOL = load("pool.js", "WW_POOL") || [], BANK = load("bank.js", "WW_BANK") || [], PICS = load("img/words/pics.js", "WW_PICS") || {};
    let PAT = null; try { PAT = require("./patterns.js"); } catch (e) { PAT = null; } if (PAT && !PAT.classify) PAT = (global.WW_PATTERNS || null);
    let pass = 0, fail = 0;
    const ok = (name, c, info) => { console.log((c ? "PASS " : "FAIL ") + name + (c ? "" : "  -> " + JSON.stringify(info))); c ? pass++ : fail++; };
    const iso = (d, h) => new Date(Date.UTC(2026, 9, d, h || 9)).toISOString();
    const Q = (lv, d, nr, nw, rr, rw, extra) => Object.assign({ id: "q" + lv, quest_day: lv, completed: true, started_at: iso(d, 8), finished_at: iso(d, 9), new_right: nr, new_wrong: nw, reviews_right: rr, reviews_wrong: rw }, extra || {});

    ok("no history: band 5", bandFor({ quests: [], level: 4 }).band === 5);
    ok("no history: a reason in plain words", /^Band 5 of 9\. No level finished yet/.test(bandFor({ quests: [], level: 4 }).reason));
    let b = bandFor({ quests: [Q(1, 1, 2, 0, 0, 0)], level: 4 });
    ok("all right: up half a band (5.5, band 5)", b.value === 5.5 && b.band === 5, b);
    b = bandFor({ quests: [Q(1, 1, 2, 0, 0, 0), Q(2, 2, 2, 0, 4, 0)], level: 4 });
    ok("two good levels: band 6", b.value === 6 && b.band === 6, b);
    ok("the reason names the level and the count", b.reason === "Band 6 of 9. On level 2, 6 of 6 first tries were right, so the band went up half a band.", b.reason);
    b = bandFor({ quests: [Q(1, 1, 1, 1, 0, 0)], level: 4 });
    ok("50% right: the value goes down half a band; the band he gets waits for a second such level", b.value === 4.5 && b.band === 5, b);
    b = bandFor({ quests: [Q(1, 1, 2, 1, 2, 1)], level: 4 });
    ok("67% right: stays", b.value === 5, b);
    b = bandFor({ quests: [Q(1, 1, 2, 1, 2, 1)], attempts: [{ quest_id: "q1", kind: "new", word: "umbrella" }], events: [{ type: "rescue", created_at: iso(1, 8) + "", detail: { word: "umbrella", kind: "new" } }], level: 4 });
    ok("a rescue: down half a band more", b.value === 4.5, b);
    b = bandFor({ quests: [Q(1, 1, 2, 1, 2, 1)], events: [{ type: "rescue", created_at: iso(3, 8), detail: { word: "umbrella", kind: "new" } }], level: 4 });
    ok("a rescue on another day does not count", b.value === 5, b);
    b = bandFor({ quests: [Q(1, 1, 2, 1, 2, 1)], attempts: [{ quest_id: "q1", kind: "probe", word: "rocket", correct: true }], level: 4 });
    ok("the never-taught word right: up a quarter", b.value === 5.25, b);
    b = bandFor({ quests: [Q(1, 1, 1, 1, 0, 1), Q(2, 1, 0, 2, 0, 2), Q(3, 1, 0, 2, 1, 3)], events: [{ type: "rescue", created_at: iso(1, 8, 30), detail: { word: "x" } }], level: 9 });
    ok("one band a day at most (three bad levels the same day)", b.value === 4, b);
    const many = []; for (let i = 1; i <= 30; i++) many.push(Q(i, i, 2, 0, 4, 0));
    ok("never above 9", bandFor({ quests: many, level: 40 }).band === 9);
    const low = []; for (let i = 1; i <= 30; i++) low.push(Q(i, i, 0, 2, 0, 4));
    ok("never below 1", bandFor({ quests: low, level: 40 }).value === 1);
    ok("only levels before the asked level count", bandFor({ quests: many, level: 2 }).value === 5.5);
    ok("a stopped level (not finished) does not count", bandFor({ quests: [Q(1, 1, 2, 0, 0, 0, { completed: false })], level: 4 }).value === 5);

    if (!POOL.length) { console.log("SKIP word checks: site/pool.js is missing or empty (run tools/make_pool.py)"); }
    else {
      const mine = BANK.filter(r => r[9] <= 3).map(r => r[0]);
      const p1 = plan({ student: "s1", level: 4, quests: [], pool: POOL, bank: BANK, mine, pics: PICS });
      const p2 = plan({ student: "s1", level: 4, quests: [], pool: POOL, bank: BANK, mine, pics: PICS });
      ok("two words", p1.words.length === 2, p1.words.map(w => w.word));
      ok("the same student and level give the same words", JSON.stringify(p1.words.map(w => w.word)) === JSON.stringify(p2.words.map(w => w.word)));
      const p3 = plan({ student: "s2", level: 4, quests: [], pool: POOL, bank: BANK, mine, pics: PICS });
      ok("another student may get other words (seeded)", p3.words.length === 2);
      ok("the words come from the band of the day", p1.words.every(w => w.band === 5), p1.words.map(w => w.word + ":" + w.band));
      ok("at least one of the two has a picture", p1.words.some(w => PICS[key(w.word)]), p1.words.map(w => w.word));
      ok("not the same first three letters", pre3(p1.words[0].word) !== pre3(p1.words[1].word));
      const all = POOL.map(r => r[0]);
      const p4 = plan({ student: "s1", level: 9, quests: [], pool: POOL, bank: BANK, mine: all.slice(2) });
      ok("too few words left: the words that are left", p4.words.length === 2 && p4.words.every(w => all.slice(0, 2).indexOf(w.word) >= 0), p4.words.map(w => w.word));
      ok("too few in the band: a nearby band, said in the reason", /nearby band/.test(p4.reason), p4.reason);
      const avoid = p1.words.map(w => w.word);
      const p5 = plan({ student: "s1", level: 4, quests: [], pool: POOL, bank: BANK, mine, avoid, pics: PICS });
      ok("a word picked before is never picked again", p5.words.every(w => avoid.indexOf(w.word) < 0), p5.words.map(w => w.word));
      const p6 = plan({ student: "s1", level: 4, quests: [], pool: POOL, bank: BANK, mine, have: ["police"], need: 1, pics: PICS });
      ok("the tutor's word counts: only what is missing", p6.words.length === 1 && pre3(p6.words[0].word) !== "pol", p6.words.map(w => w.word));
      const off = plan({ student: "s1", level: 4, quests: [], pool: POOL, bank: BANK, mine, on: false });
      const inPool = new Set(POOL.map(r => r[0]));   // the fixed course keeps the bank's order but only gives words that are in the pool (Cambridge and the tutor's notes)
      ok("picker off: the next two bank words that are in the pool", off.words.map(w => w.word).join() === BANK.filter(r => r[9] >= 4 && inPool.has(r[0])).slice(0, 2).map(r => r[0]).join(), off.words.map(w => w.word));
      const nopool = plan({ student: "s1", level: 5, quests: [], pool: [], bank: BANK, mine: mine.concat(["police", "tulips"]) });
      ok("no pool: like picker off", nopool.off && nopool.words.map(w => w.word).join() === BANK.filter(r => r[9] === 5).map(r => r[0]).join(), nopool.words.map(w => w.word));
      if (PAT && PAT.classify) {
        const qs = [Q(1, 1, 0, 2, 0, 0), Q(2, 2, 0, 2, 0, 0)];
        const at = [{ quest_id: "q1", kind: "new", word: "lollipop", answer: "lolipop", correct: false }, { quest_id: "q2", kind: "new", word: "parrot", answer: "parot", correct: false },
          { quest_id: "q2", kind: "new", word: "camera", answer: "camra", correct: false }];
        const codes = slipCodes({ quests: qs, attempts: at, level: 4, patterns: PAT, words: [] });
        ok("his slips are named (double letters first)", codes[0] === "double", codes);
        const ps = plan({ student: "s1", level: 4, quests: qs, attempts: at, pool: POOL, bank: BANK, mine, pics: PICS, patterns: PAT });
        ok("a word that trains his slips comes first", ps.words.some(w => w.feat.indexOf("double") >= 0), ps.words.map(w => w.word + ":" + w.feat));
      } else console.log("SKIP slip checks: site/patterns.js could not be loaded in node");
      const seen = new Set(); let twice = false, jump = false, lastBand = 5; const mineAll = mine.slice();
      for (let lv = 4; lv <= 50; lv++) {
        const pl = plan({ student: "s1", level: lv, quests: [], pool: POOL, bank: BANK, mine: mineAll, pics: PICS });
        pl.words.forEach(w => { if (seen.has(w.word)) twice = true; seen.add(w.word); mineAll.push(w.word); });
        if (Math.abs(pl.band - lastBand) > 1) jump = true; lastBand = pl.band;
      }
      ok("47 levels: no word twice", !twice);
      ok("47 levels: no band jump of more than one", !jump);
    }
    console.log((fail ? fail + " FAILED, " : "ALL PASSED, ") + pass + " passed");
    if (fail) process.exitCode = 1;
  }
})(typeof window !== "undefined" ? window : globalThis);
