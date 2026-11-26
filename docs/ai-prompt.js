/* Word World: the adviser. The facts sent to the AI model, the words around them, the checked list of sources, and the
   check of what comes back.
   ONE copy for both paths:
     - the tutor's page on claude.ai (teacher.js, the page's own Claude ability), loaded by teacher.html;
     - the Edge Function on the real website (deploy/functions/weekly-analysis/index.ts), which imports prompt.js,
       a byte-for-byte copy of this file kept next to it. tests/test-analysis.js fails when the two differ.
   The facts are worked out here (facts), from the rows the page loaded: the model never counts rows.
   The word lists it guards against are in site/guard-words.js (window.WW_GUARD), loaded before this file.
   The adviser only advises: nothing it writes changes the game.
   This file is a plain script and an ES module at once: no import or export, no top-level `this`. */
(function (g) {
  "use strict";

  // ---------------------------------------------------------------- the checked list of sources
  // Only these may be cited, by key. Each was looked up with the PubMed tools on 25 November 2026 and its DOI taken from
  // that answer (PubMed numbers: spacing 16719566, testing 16507066, techniques 26173288, feedback 32038429,
  // morphology 18952810, self_monitoring 28301179). A source that could not be checked is not on the list.
  const SOURCES = [
    { key: "spacing", authors: "Cepeda, Pashler, Vul, Wixted, Rohrer", year: 2006, title: "Distributed practice in verbal recall tasks: A review and quantitative synthesis", journal: "Psychological Bulletin 132(3):354-380", doi: "10.1037/0033-2909.132.3.354",
      supports: "Practice spread over several days is remembered longer than the same practice in one go." },
    { key: "testing", authors: "Roediger, Karpicke", year: 2006, title: "Test-enhanced learning: Taking memory tests improves long-term retention", journal: "Psychological Science 17(3):249-255", doi: "10.1111/j.1467-9280.2006.01693.x",
      supports: "Recalling a word from memory (a small test) keeps it longer than looking at it again." },
    { key: "techniques", authors: "Dunlosky, Rawson, Marsh, Nathan, Willingham", year: 2013, title: "Improving students' learning with effective learning techniques: Promising directions from cognitive and educational psychology", journal: "Psychological Science in the Public Interest 14(1):4-58", doi: "10.1177/1529100612453266",
      supports: "Of ten study methods, practice testing and practice spread over time were rated the most useful, across ages; rereading was rated low." },
    { key: "feedback", authors: "Wisniewski, Zierer, Hattie", year: 2020, title: "The power of feedback revisited: A meta-analysis of educational feedback research", journal: "Frontiers in Psychology 10:3087", doi: "10.3389/fpsyg.2019.03087",
      supports: "Feedback helps learning on average, most when it carries clear information about the task." },
    { key: "morphology", authors: "Kirk, Gillon", year: 2009, title: "Integrated morphological awareness intervention as a tool for improving literacy", journal: "Language, Speech, and Hearing Services in Schools 40(3):341-351", doi: "10.1044/0161-1461(2008/08-0009)",
      supports: "A small randomised trial (16 children aged 8 to 11): teaching word parts (base word and endings) and the spelling rules for adding endings improved spelling, also of new words. One small study: say so." },
    { key: "self_monitoring", authors: "Guzman, Goldberg, Swanson", year: 2018, title: "A meta-analysis of self-monitoring on reading performance of K-12 students", journal: "School Psychology Quarterly 33(1):160-168", doi: "10.1037/spq0000199",
      supports: "Across 19 small single-pupil studies (67 pupils in all), pupils who kept track of their own work (for example ticking off what they did) did better in reading. It is about reading, not spelling: say so." }
  ];
  const sourceByKey = k => SOURCES.filter(s => s.key === k)[0] || null;

  // ---------------------------------------------------------------- the guard words (site/guard-words.js)
  const NEEDS_DEFAULT = "Short tasks. One clear step at a time. Few distractions.";
  const NEEDS_REFUSED = "Write what helps him, not a diagnosis.";
  const NEEDS_MAX = 400;
  const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const capsOnly = s => /^[A-Z]{2,5}$/.test(s);
  const reCache = {};
  function guardRes(which) {
    const list = ((g.WW_GUARD || {})[which] || []).filter(x => typeof x === "string" && x.trim());
    const sig = which + ":" + list.join("|");
    if (reCache[which] && reCache[which].sig === sig) return reCache[which];
    const wrap = parts => parts.length ? "(?<![A-Za-z'])(?:" + parts.join("|") + ")(?![A-Za-z])" : null;
    const ci = wrap(list.filter(x => !capsOnly(x)).map(esc)), cs = wrap(list.filter(capsOnly).map(esc));
    reCache[which] = { sig, ci: ci ? new RegExp(ci, "gi") : null, cs: cs ? new RegExp(cs, "g") : null, n: list.length };
    return reCache[which];
  }
  // Every guard word of that list in the text, as found.
  function findGuard(text, which) {
    if (typeof text !== "string" || !text) return [];
    const r = guardRes(which), out = [];
    [r.ci, r.cs].forEach(re => { if (!re) return; re.lastIndex = 0; let m; while ((m = re.exec(text))) out.push(m[0]); });
    return out;
  }
  const hasDiagnosis = s => findGuard(s, "diagnosis").length > 0;
  const hasLabel = s => findGuard(s, "labels").length > 0;
  const guardReady = () => guardRes("diagnosis").n > 0 && guardRes("labels").n > 0;
  const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/gu;
  const stripEmoji = s => String(s).replace(EMOJI, "");

  // The tutor's "What the adviser should keep in mind": every sentence that holds a diagnosis word or a name word is
  // dropped (the second net; the page refuses to save such a text). Empty -> the default. Returns { text, removed }.
  function cleanNeeds(raw, names) {
    const tokens = nameTokens(names);
    let s = stripEmoji(typeof raw === "string" ? raw : "").replace(/\s+/g, " ").trim().slice(0, NEEDS_MAX);
    let removed = 0;
    const parts = s.split(/(?<=[.!?;])\s+|\s*\n\s*/).filter(Boolean);
    const kept = parts.filter(p => { if (hasDiagnosis(p) || hasName(p, tokens)) { removed++; return false; } return true; });
    s = kept.join(" ").trim();
    return { text: s || NEEDS_DEFAULT, removed };
  }

  // ---------------------------------------------------------------- names and ids out
  const FIELDS = ["span", "game", "learning", "spelling", "behaviour"];
  // A field is dropped, at any depth, when any part of its name (split at "_" and at capitals) is one of these.
  const DENY = ["id", "ids", "uid", "uuid", "name", "names", "nickname", "email", "mail", "pin", "phone", "address",
    "student", "students", "teacher", "tutor", "parent", "mother", "note", "notes", "sentence", "sentences", "message",
    "messages", "letter", "letters", "reply", "picture", "drawing", "drawn", "handwriting", "voice", "build"];
  const keyParts = k => String(k).replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const deniedKey = k => keyParts(k).some(p => DENY.indexOf(p) >= 0);
  function nameTokens(names) {
    const out = [];
    (names || []).forEach(n => String(n == null ? "" : n).toLowerCase().split(/[^a-zÀ-ɏ一-鿿]+/).forEach(t => {
      if (t.length >= 2 && out.indexOf(t) < 0) out.push(t);
    }));
    return out;
  }
  function hasName(s, tokens) {
    if (typeof s !== "string" || !tokens.length) return false;
    const words = s.toLowerCase().split(/[^a-zÀ-ɏ一-鿿]+/);
    return tokens.some(t => words.indexOf(t) >= 0 || (/[一-鿿]/.test(t) && s.indexOf(t) >= 0));
  }
  const holdsName = (v, tokens) => typeof v === "string" ? hasName(v, tokens) :
    Array.isArray(v) ? v.some(x => holdsName(x, tokens)) :
    v && typeof v === "object" ? Object.keys(v).some(k => holdsName(v[k], tokens)) : false;
  // A clean copy of the facts: only FIELDS at the top, no field with a name-like name at any depth, no list item that
  // holds a name word, "(removed)" for any other text that does. Returns { data, removed }.
  function scrub(facts, names) {
    const tokens = nameTokens(names);
    let removed = 0;
    const walk = v => {
      if (typeof v === "string") { if (hasName(v, tokens)) { removed++; return "(removed)"; } return v; }
      if (typeof v === "number") return isFinite(v) ? v : null;
      if (v == null || typeof v === "boolean") return v;
      if (Array.isArray(v)) return v.filter(x => { if (holdsName(x, tokens)) { removed++; return false; } return true; }).map(walk);
      if (typeof v === "object") {
        const o = {};
        Object.keys(v).forEach(k => { if (deniedKey(k)) { removed++; return; } o[k] = walk(v[k]); });
        return o;
      }
      removed++; return null;
    };
    const data = {};
    const src = facts && typeof facts === "object" && !Array.isArray(facts) ? facts : {};
    Object.keys(src).forEach(k => { if (FIELDS.indexOf(k) < 0) { removed++; return; } data[k] = walk(src[k]); });
    return { data, removed };
  }

  // ---------------------------------------------------------------- the facts, worked out here
  const pad = n => (n < 10 ? "0" : "") + n;
  const dk = iso => { const d = new Date(iso); return isNaN(d) ? "" : d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  const hm = iso => { const d = new Date(iso); return isNaN(d) ? "" : pad(d.getHours()) + ":" + pad(d.getMinutes()); };
  const ms = iso => +new Date(iso);
  const dayNum = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5;
  const dayDiff = (a, b) => Math.round(dayNum(b) - dayNum(a));
  const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const weekdayOf = d => WEEKDAY[new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))).getUTCDay()];
  const mondayOf = d => { const n = dayNum(d), wd = (new Date(n * 864e5).getUTCDay() + 6) % 7, m = new Date((n - wd) * 864e5); return m.getUTCFullYear() + "-" + pad(m.getUTCMonth() + 1) + "-" + pad(m.getUTCDate()); };
  const wkey = w => String(w == null ? "" : w).toLowerCase().replace(/[‘’`´]/g, "'").replace(/[^a-z']/g, "");
  const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const r1 = x => x == null ? null : Math.round(x * 10) / 10;
  const byAt = (p, q) => ms(p.created_at) - ms(q.created_at);
  const PART = { review: "old words", "new": "new words", test: "island test", quick: "quick check" };
  const MODE = {
    missed: "only words he missed come back (after 1, 4 and 14 days); a new word that was right every time is finished when its level ends.",
    once: "a new word that was right comes back once, the next day; a missed word comes back after 1, 4 and 14 days.",
    all: "every word comes back after 1, 4 and 14 days."
  };
  const GAP_ACTIVE = 300, GAP_PACE = 120;   // seconds: a longer gap is a break, not time on his words / not an answer's pace

  // o: { attempts (all his tries, any time: needed to count meetings), events (at least those of the span), sessions,
  //      words, from, to (YYYY-MM-DD, local days), label ("this week" ...), reviewMode, top (the finished step, 6) }
  function facts(o) {
    o = o || {};
    const from = String(o.from || "0000-00-00"), to = String(o.to || "9999-99-99"), inSpan = d => !!d && d >= from && d <= to;
    const P = g.WW_PATTERNS || null, top = +o.top || 6;
    const A = (o.attempts || []).filter(a => a && a.created_at && a.word).slice().sort(byAt);
    const E = (o.events || []).filter(e => e && e.created_at && e.type).slice().sort(byAt);
    const S = (o.sessions || []).filter(s => s && s.day);
    const Wr = (o.words || []).filter(w => w && w.word);
    const As = A.filter(a => inSpan(dk(a.created_at))), Es = E.filter(e => inSpan(dk(e.created_at)));
    const chunksOf = {}; Wr.forEach(w => { if (w.chunks) chunksOf[wkey(w.word)] = w.chunks; });

    // the days each word was met, all time (to count meetings)
    const daysOf = {};
    A.forEach(a => { const k = wkey(a.word), d = dk(a.created_at); const l = daysOf[k] || (daysOf[k] = []); if (l.indexOf(d) < 0) l.push(d); });
    Object.keys(daysOf).forEach(k => daysOf[k].sort());
    // first try: his first answer to a word on a day; later tries: the rest of that day
    const seen = {}, firsts = [], laters = [];
    As.forEach(a => { const id = wkey(a.word) + "|" + dk(a.created_at); if (!seen[id]) { seen[id] = 1; firsts.push(a); } else laters.push(a); });
    const rightOf = arr => ({ right: arr.filter(a => a.correct).length, of: arr.length });

    // LEARNING
    const newWords = Wr.filter(w => inSpan(w.introduced_on)).sort((p, q) => p.introduced_on < q.introduced_on ? -1 : 1).map(w => w.word);
    const back = firsts.filter(a => a.kind === "review").map(a => {
      const d = dk(a.created_at), ds = daysOf[wkey(a.word)] || [], i = ds.indexOf(d);
      return { word: a.word, date: d, right_first_try: !!a.correct, days_since_last_met: i > 0 ? dayDiff(ds[i - 1], d) : null };
    });
    const finished = Wr.filter(w => (+w.level || 0) >= top && inSpan(w.last_seen)).map(w => w.word);
    const meet = [["met for the 1st time", 0], ["2nd meeting", 0], ["3rd meeting", 0], ["4th meeting or later", 0]].map(x => ({ meeting: x[0], right_first_try: 0, of: 0 }));
    firsts.forEach(a => { const ds = daysOf[wkey(a.word)] || [], n = Math.min(4, ds.indexOf(dk(a.created_at)) + 1); if (n < 1) return; meet[n - 1].of++; if (a.correct) meet[n - 1].right_first_try++; });
    const lvDone = Es.filter(e => e.type === "quest_complete");

    // SPELLING
    const misses = As.filter(a => !a.correct && typeof a.answer === "string" && wkey(a.answer) && wkey(a.answer) !== wkey(a.word));
    const groups = {};
    misses.forEach(a => {
      let codes = P && typeof P.classify === "function" ? P.classify(a.word, a.answer, chunksOf[wkey(a.word)] || null) : ["other"];
      if (!codes || !codes.length) codes = ["other"];
      codes.forEach(c => {
        const nm = P && P.NAMES && P.NAMES[c] ? P.NAMES[c] : null;
        const gr = groups[c] || (groups[c] = { code: c, kind: nm ? nm.en : "Not sorted", about: nm ? nm.about_en : "Slips not sorted by kind.", misses: 0, words: [], examples: [] });
        gr.misses++;
        if (gr.words.indexOf(wkey(a.word)) < 0) gr.words.push(wkey(a.word));
        if (gr.examples.length < 12 && !gr.examples.some(x => x.word === a.word && x.typed === a.answer)) gr.examples.push({ word: a.word, typed: a.answer });
      });
    });
    const metWords = Wr.filter(w => w.introduced_on);
    const byKind = Object.keys(groups).map(k => groups[k]).sort((p, q) => q.misses - p.misses).map(gr => {
      let more = [];
      if (P && typeof P.wordsFor === "function" && gr.code !== "other") more = P.wordsFor(gr.code, metWords).map(w => w.word).filter(w => gr.words.indexOf(wkey(w)) < 0).slice(0, 8);
      return { kind: gr.kind, about: gr.about, misses: gr.misses, different_words: gr.words.length, examples: gr.examples, more_of_his_words_with_it: more };
    });
    const hintEv = Es.filter(e => e.type === "hint" && e.detail);
    const presses = hintEv.filter(e => !e.detail.auto), auto = hintEv.filter(e => e.detail.auto);
    const hintWords = {}; presses.forEach(e => { const w = e.detail.word; if (w) hintWords[w] = (hintWords[w] || 0) + 1; });
    const rescue = Es.filter(e => e.type === "rescue" && e.detail);
    const rescueWords = []; rescue.forEach(e => { if (e.detail.word && rescueWords.indexOf(e.detail.word) < 0) rescueWords.push(e.detail.word); });

    // BEHAVIOUR: the days
    const days = [];
    As.forEach(a => { const d = dk(a.created_at); if (days.indexOf(d) < 0) days.push(d); });
    Es.forEach(e => { const d = dk(e.created_at); if (days.indexOf(d) < 0) days.push(d); });
    days.sort();
    const sessOf = d => S.filter(s => s.day === d)[0] || null;
    const dayRows = days.map(d => {
      const t = As.filter(a => dk(a.created_at) === d).map(a => ms(a.created_at)).concat(Es.filter(e => dk(e.created_at) === d).map(e => ms(e.created_at))).sort((x, y) => x - y);
      let act = 0; for (let i = 1; i < t.length; i++) { const gap = (t[i] - t[i - 1]) / 1000; if (gap <= GAP_ACTIVE) act += gap; }
      const ev = Es.filter(e => dk(e.created_at) === d), s = sessOf(d);
      return { date: d, weekday: weekdayOf(d), started: hm(new Date(t[0]).toISOString()), ended: hm(new Date(t[t.length - 1]).toISOString()),
        minutes_active: Math.round(act / 60), levels_started: ev.filter(e => e.type === "quest_start").length, levels_finished: ev.filter(e => e.type === "quest_complete").length,
        stops: ev.filter(e => e.type === "quest_pause").length, answers: As.filter(a => dk(a.created_at) === d).length,
        focus_he_gave: s && s.focus_score ? +s.focus_score : null, free_play_minutes: s && s.play_used != null ? Math.round(+s.play_used / 60) : null };
    });
    // BEHAVIOUR: each level he started, from its start to its end, stop, next start or the end of that day
    const runs = [];
    Es.forEach((e, i) => {
      if (e.type !== "quest_start") return;
      const lv = e.detail && e.detail.day, d = dk(e.created_at), t0 = ms(e.created_at);
      let end = null, how = "left";
      for (let j = i + 1; j < Es.length; j++) {
        const x = Es[j];
        if (dk(x.created_at) !== d) break;
        if (x.type === "quest_complete") { end = x; how = "finished"; break; }
        if (x.type === "quest_pause") { end = x; how = "stopped"; break; }
        if (x.type === "quest_start") { end = x; how = "left"; break; }
      }
      const t1 = end ? ms(end.created_at) : Math.max(t0, ...As.filter(a => dk(a.created_at) === d).map(a => ms(a.created_at)));
      const inRun = As.filter(a => ms(a.created_at) >= t0 && ms(a.created_at) <= t1);
      const parts = Es.filter(x => x.type === "part_done" && ms(x.created_at) >= t0 && ms(x.created_at) <= t1);
      const hints = presses.filter(x => ms(x.created_at) >= t0 && ms(x.created_at) <= t1);
      runs.push({ level: lv, date: d, time: hm(e.created_at), how, t0, t1, answers: inRun, parts, hints });
    });
    const stops = runs.filter(r => r.how !== "finished").map(r => {
      const last = r.parts.length ? r.parts[r.parts.length - 1].detail : null;
      return { date: r.date, time: r.time, level: r.level, how: r.how === "stopped" ? "pressed stop" : "left without finishing",
        after_part: last && PART[last.part] ? PART[last.part] : "before the first part was done", minutes_into_level: Math.round((r.t1 - r.t0) / 60000), answers_before: r.answers.length };
    });
    const firstAns = runs.filter(r => r.answers.length).map(r => Math.round((ms(r.answers[0].created_at) - r.t0) / 1000));
    const startGaps = [], endGaps = []; let paced = 0;
    runs.forEach(r => {
      if (r.answers.length < 6) return;
      paced++;
      const n = r.answers.length, third = Math.floor(n / 3);
      for (let i = 1; i < n; i++) {
        const gap = (ms(r.answers[i].created_at) - ms(r.answers[i - 1].created_at)) / 1000;
        if (gap > GAP_PACE) continue;
        if (i <= third) startGaps.push(gap); else if (i >= n - third) endGaps.push(gap);
      }
    });
    let h1 = 0, h2 = 0;
    runs.forEach(r => { const mid = (r.t0 + r.t1) / 2; r.hints.forEach(x => { if (ms(x.created_at) < mid) h1++; else h2++; }); });
    const focus = S.filter(s => inSpan(s.day) && s.focus_score).sort((p, q) => p.day < q.day ? -1 : 1).map(s => ({ date: s.day, focus: +s.focus_score }));
    const freePlay = S.filter(s => inSpan(s.day) && s.play_used != null).reduce((t, s) => t + (+s.play_used || 0), 0);

    const daysInSpan = dayDiff(from, to) + 1;
    return {
      span: { label: String(o.label || ""), from, to, week: mondayOf(to), days_in_span: daysInSpan, days_played: days.length, answers: As.length, levels_finished: lvDone.length },
      game: { review_mode: MODE[o.reviewMode] ? o.reviewMode : "missed", which_old_words_come_back: MODE[o.reviewMode] || MODE.missed },
      learning: {
        new_words_met: { count: newWords.length, words: newWords.slice(0, 40) },
        words_that_came_back: { count: back.length, right_first_try: back.filter(b => b.right_first_try).length, list: back.slice(0, 40) },
        words_finished: { about: "words that reached the last step and need no more practice", count: finished.length, words: finished.slice(0, 40) },
        first_try_by_meeting: { about: "his first answer to a word on a day, by how many days he had met that word", rows: meet },
        levels_finished: lvDone.map(e => e.detail && e.detail.day).filter(x => x != null)
      },
      spelling: {
        misses: misses.length, different_words_missed: Object.keys(misses.reduce((m, a) => (m[wkey(a.word)] = 1, m), {})).length,
        by_kind: byKind.slice(0, 10),
        first_try: rightOf(firsts), later_tries_same_day: rightOf(laters),
        hints: { presses: presses.length, marked_for_him_after_two_misses: auto.length, most_on: Object.keys(hintWords).sort((p, q) => hintWords[q] - hintWords[p]).slice(0, 10).map(w => ({ word: w, presses: hintWords[w] })) },
        look_and_copy: { times: rescue.length, words: rescueWords.slice(0, 20), then_right_from_memory: rescue.filter(e => e.detail.from_memory).length }
      },
      behaviour: {
        days: dayRows,
        levels_started: runs.length, levels_finished: runs.filter(r => r.how === "finished").length,
        stops: stops.slice(0, 30),
        seconds_to_first_answer: { median: median(firstAns), each_level: firstAns.slice(0, 30) },
        seconds_between_answers: { about: "median seconds from one answer to the next (gaps over 2 minutes left out), first third of a level against last third", start_of_level: r1(median(startGaps)), end_of_level: r1(median(endGaps)), levels_counted: paced },
        hint_presses_first_half_of_level: h1, hint_presses_second_half_of_level: h2,
        focus_he_gave: focus,
        free_play_minutes_total: Math.round(freePlay / 60)
      }
    };
  }

  // Every word of his that the facts name (practice ideas may only use these).
  function wordsIn(data) {
    const out = {}, add = w => { const k = wkey(w); if (k) out[k] = 1; };
    const L = (data && data.learning) || {}, Sp = (data && data.spelling) || {};
    ((L.new_words_met || {}).words || []).forEach(add);
    ((L.words_that_came_back || {}).list || []).forEach(x => add(x && x.word));
    ((L.words_finished || {}).words || []).forEach(add);
    (Sp.by_kind || []).forEach(k => { (k.examples || []).forEach(x => add(x && x.word)); (k.more_of_his_words_with_it || []).forEach(add); });
    ((Sp.hints || {}).most_on || []).forEach(x => add(x && x.word));
    ((Sp.look_and_copy || {}).words || []).forEach(add);
    return out;
  }

  // ---------------------------------------------------------------- the words around the facts
  const FORMAT = '{"summary": "one or two sentences", "data_note": "what this much data can and cannot show", ' +
    '"notice": {"learning": [{"pattern": "one or two plain sentences", "evidence": "the facts that show it, with numbers"}], "spelling": [...], "behaviour": [...]}, ' +
    '"try": [{"title": "a few words", "principle": "the principle in plain words", "why": "why it fits what you noticed", "what_to_do": "exactly what the tutor does: who, when, for how long", "source": "a key from the list, or empty"}], ' +
    '"practice": [{"pattern": "the kind of slip, in plain words", "words": ["4 to 6 of his words"], "five_minutes": "a five-minute way to practise it with him"}], ' +
    '"goal": "one small goal for next week"}';
  function text(data, needs) {
    const d = data || {}, sp = d.span || {}, mode = (d.game && d.game.which_old_words_come_back) || MODE.missed;
    const amount = "these facts cover " + (sp.days_played || 0) + " day(s) of play and " + (sp.answers || 0) + " answers (" + (sp.label || "the chosen time") + ").";
    return [
      "ROLE: You are an education specialist for spelling. You write a report for the tutor of one learner, a boy of 11. His first language is Mandarin and he is a beginner in English. Between weekly lessons he plays a short spelling game on most days. You track his learning, his spelling and how he plays, say what patterns you notice, and give research-based advice. The report is advice for his tutor only: nothing in the game changes because of it.",
      "",
      "HOW THE GAME WORKS NOW:",
      "- Each day there is one level. When it is finished he may play a second level the same day, which runs the same way.",
      "- A level: a short mail shows its new words (usually 2); a quick check of 4 short words; a pair game; each new word in steps (meet it, type it, put it together from pieces); the old words that are due; a last round; then an end page, a short story page and a few school spelling words.",
      "- He hears a word and types it. A miss shows \"Not yet\" and he tries again. He can press for a hint, which marks the part that is not yet right; after two misses that part is marked for him. \"Look and copy\" lets him copy the word, then type it from memory.",
      "- Which old words come back: " + mode,
      "- On island test days a monster game asks the words he missed most.",
      "- After a level he has some minutes of free play. Once a week the end page asks him how well he kept his focus, from 1 to 5.",
      "",
      "WHAT HELPS HIM (from his tutor; plan every suggestion around it): " + (typeof needs === "string" && needs.trim() ? needs.trim() : NEEDS_DEFAULT),
      "",
      "RULES FOR WHAT YOU WRITE:",
      "- Plain English a parent can read. Short sentences. No emoji. No technical words about the game's data.",
      "- Never suggest a diagnosis or a medical or psychological condition, and never hint that he may have one.",
      "- Never describe him with a word that judges or labels him (about his speed, his effort, his care, or how he compares with others). Describe what he did, not what he is.",
      "- A miss is \"not yet\": write \"not yet right\".",
      "- Use ONLY the facts below; they are already counted, do not count again. Every pattern quotes its evidence from them (for example \"on 3 of 4 days he stopped during the new words\").",
      "- Say what the data cannot carry: " + amount + " With few days or answers, say so plainly (for example \"With 2 days of play I can only say ...\").",
      "- \"What to try\": 3 to 5 suggestions. Each names its principle in plain words, says why it fits what you noticed, and exactly what the tutor does (who, when, how long). Cite a source ONLY by its key from the list below and only when it supports the suggestion; otherwise leave \"source\" empty. Never name any other study, author, book or website.",
      "- \"Practice ideas\": one for each kind of slip that came back 2 times or more (at most 3), with 4 to 6 of HIS words from the facts and a five-minute way to practise them with him.",
      "- \"Notice\": 0 to 3 patterns in each of learning, spelling and behaviour.",
      "",
      "SOURCES YOU MAY CITE (key: authors, year, title, journal. What it supports):",
      SOURCES.map(s => "- " + s.key + ": " + s.authors + ", " + s.year + ", \"" + s.title + "\", " + s.journal + ". " + s.supports).join("\n"),
      "",
      "FACTS (JSON):",
      JSON.stringify(d),
      "",
      "FORMAT: return only one JSON object, nothing before or after it:",
      FORMAT
    ].join("\n");
  }

  // ---------------------------------------------------------------- the check of what comes back
  // Takes the model's JSON (object or text). A diagnosis word anywhere: the whole report is refused. A label word: that
  // item is left out. A source key not on the list: the suggestion is kept without a source. Practice words: only his own.
  // Returns { ok: true, report, dropped, unknown_sources } or { ok: false, why, message }.
  const UNREAD = "The adviser's answer could not be read. Press the button again in a minute.";
  const REFUSED = "The adviser's answer used words it must never use, so it is not shown. Press the button again.";
  function parseAnswer(x) {
    if (x && typeof x === "object") return x;
    if (typeof x !== "string") return null;
    const a = x.indexOf("{"), z = x.lastIndexOf("}");
    if (a < 0 || z <= a) return null;
    try { return JSON.parse(x.slice(a, z + 1)); } catch (e) { return null; }
  }
  const allText = v => typeof v === "string" ? v : Array.isArray(v) ? v.map(allText).join(" ") : v && typeof v === "object" ? Object.keys(v).map(k => allText(v[k])).join(" ") : "";
  function check(answer, data) {
    const o = parseAnswer(answer);
    if (!o || typeof o !== "object" || Array.isArray(o)) return { ok: false, why: "not a JSON object", message: UNREAD };
    if (!guardReady()) return { ok: false, why: "the guard list (guard-words.js) is not loaded", message: UNREAD };
    if (hasDiagnosis(allText(o))) return { ok: false, why: "a diagnosis word in the answer", message: REFUSED };
    let dropped = 0, unknown = 0;
    const clean = s => typeof s === "string" ? stripEmoji(s).replace(/\s+/g, " ").trim().slice(0, 700) : "";
    const okText = s => { const c = clean(s); if (c && hasLabel(c)) { dropped++; return null; } return c; };
    const items = (arr, fn, max) => { const out = []; (Array.isArray(arr) ? arr : []).forEach(x => { const r = fn(x); if (r) out.push(r); }); return out.slice(0, max); };
    const notice = {};
    ["learning", "spelling", "behaviour"].forEach(k => {
      notice[k] = items(o.notice && o.notice[k], x => {
        const p = okText(typeof x === "string" ? x : x && x.pattern), e = okText(x && typeof x === "object" ? x.evidence : "");
        return p == null || e == null || !p ? null : { pattern: p, evidence: e };
      }, 4);
    });
    const tries = items(o.try, x => {
      if (!x || typeof x !== "object") return null;
      const f = {}; let bad = false;
      ["title", "principle", "why", "what_to_do"].forEach(k => { const v = okText(x[k]); if (v == null) bad = true; f[k] = v || ""; });
      if (bad || !f.principle || !f.what_to_do) return null;
      const key = typeof x.source === "string" ? x.source.trim() : "";
      if (key && !sourceByKey(key)) unknown++;
      f.source = key && sourceByKey(key) ? key : "";
      return f;
    }, 5);
    const his = wordsIn(data);
    const practice = items(o.practice, x => {
      if (!x || typeof x !== "object") return null;
      const p = okText(x.pattern), m = okText(x.five_minutes);
      if (p == null || m == null || !p || !m) return null;
      const ws = []; (Array.isArray(x.words) ? x.words : []).forEach(w => { if (typeof w === "string" && his[wkey(w)] && ws.indexOf(w.trim()) < 0) ws.push(w.trim()); });
      return ws.length ? { pattern: p, words: ws.slice(0, 6), five_minutes: m } : null;
    }, 4);
    const summary = okText(o.summary), note = okText(o.data_note), goal = okText(o.goal);
    const anyNotice = notice.learning.length + notice.spelling.length + notice.behaviour.length;
    if (!anyNotice && !tries.length) return { ok: false, why: "nothing usable in the answer", message: UNREAD };
    return { ok: true, report: { summary: summary || "", data_note: note || "", notice, try: tries, practice, goal: goal || "" }, dropped, unknown_sources: unknown };
  }
  // The record kept in analyses.json: the checked report with its span and the sources it used.
  function record(checked, data) {
    const sp = (data && data.span) || {};
    const used = [];
    checked.report.try.forEach(t => { if (t.source && used.indexOf(t.source) < 0) used.push(t.source); });
    return { v: 2, span: { label: sp.label || "", from: sp.from || "", to: sp.to || "" }, report: checked.report, sources: used, dropped: checked.dropped, unknown_sources: checked.unknown_sources };
  }

  g.WW_AI = { SOURCES, sourceByKey, NEEDS_DEFAULT, NEEDS_REFUSED, NEEDS_MAX, FIELDS, DENY, deniedKey, nameTokens, hasName, scrub,
    findGuard, hasDiagnosis, hasLabel, guardReady, cleanNeeds, facts, wordsIn, text, check, record, UNREAD, REFUSED, mondayOf };
})(typeof globalThis !== "undefined" ? globalThis : window);
