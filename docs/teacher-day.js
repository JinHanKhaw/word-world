/* Word World, the tutor's page: THE DAY VIEW on the Today tab ("Every answer"). Owner: the day-view builder.
   window.WW_TEACHER_DAY = { render(container, ctx), stop() }; ctx = { sb, student, W: window.WT, day, words }.
   It loads what it needs itself, one query per table for the chosen day (attempts, events) and one for the list of days and
   the levels (sessions, quests), and draws: the "Now" line, a day chooser, and every answer of that day, grouped by level and,
   inside a level, by part in the order of his day. It refreshes by itself every 30 seconds while the tab is open and visible.
   Plain words for a tutor who is not technical. Never a word that labels the child: "Right" or "Not yet", what happened.

   WHAT THE GAME SAVES, AND WHERE IT SHOWS HERE (from src/js, 25 November)
   attempts (kind / step):
     review/listen, retry/listen (after a review), game/bubbles|gap|talk (an old word's small extra game) -> Old words
     training/listen, retry/training ............................................ -> Orbit's training (older saves)
     quick/quick ................................................................ -> Quick check
     new/type, retry/type ....................................................... -> New words: Type
     game/bubbles on a word typed as new in the same level ...................... -> New words: Build
     mixed/<picture|zh|sentence|sound> .......................................... -> Last round
     sentence/tiles ............................................................. -> Sentences (the tiles)
     probe/probe ................................................................ -> The never-taught word
     test/listen, retry/listen (after a test) ................................... -> Island test
     again/again, retry/again ................................................... -> One more time (older saves)
     school, school_retry (drill), school_test (dictation on the laptop) ........ -> School words
   events (type, the logEvent calls in src/js and site/audio.js):
     Mail: mail_opened, card_turned, card_heard, flashcard_viewed, say, voice_ok, voice_self, voice (with a word), card_game_done,
           game_meaning, game_sentence, ready; piece_tapped outside a level; letter_reply (he wrote back to her letter: one line, his text is on the Letters tab)
     Level frame (start, stop, end): quest_start, quest_pause, part_done, quest_complete; practice_start (practice, nothing saved)
     Hints on a typing page: hint (n, auto), rescue ("Look and copy") -> joined to the try they came before
     New words: Meet: clap (on: "meet"), piece_tapped inside a level
     Old words: step_done (bubbles, gap, talk) -> only the try it closes; Orbit's training: training_start, training_done
     Quick check: quick, quick_done; Pair game: pair, pairs_done
     Sentences: step_done (tiles), sentence_copied, sentence_skipped, sentence_none, sentence_saved (older saves: his own sentence)
     Never-taught word: probe, probe_slow; One more time: again
     Story: story_opened, story_heard, story_zh, story_answer, story_choice (the answer he tapped, and the question), story_done, hut_story_tab
     School words: school_open, school_drill_start, school_back, school_copy, school_slowly, school_drill_done, school_pause,
                   school_test_start, school_test, school_retype_done
     Free play: asleep (and sessions.play_used); bought, build3d_open, build3d_moved (his island) -> only for the "Now" line
     Old words only ("No new words for now"): old_start, old_done
     Not shown as answers (the "Now" line still sees them): login, zh_toggle, zh_shown, guide_zh, guide_again, speech, sound,
       voice (recorded), voice_test, voice_test_device, ladder_moved, picked, pin_wrong, watch, card_viewed
   sessions: the day, play_used (seconds of free play). quests: one row per level (quest_day, started_at, finished_at,
   completed, diamonds_earned); kind "old" for old words only; school rows have no level. */
(function () {
  "use strict";
  const REFRESH_MS = 30000, NOW_MS = 3 * 60 * 1000;
  let st = null, timer = null, storyAsked = false;
  const folds = {};   // fold key -> open (what she opened or closed stays so across a refresh and a change of day)

  // ---------- small helpers ----------
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const key = w => String(w || "").toLowerCase().replace(/[‘’`´]/g, "'").replace(/[^a-z']/g, "");
  const ms = iso => new Date(iso).getTime();
  const pad = n => String(n).padStart(2, "0");
  const clock = iso => { const d = new Date(iso); const h = d.getHours(); return ((h % 12) || 12) + ":" + pad(d.getMinutes()) + " " + (h < 12 ? "am" : "pm"); };
  const many = (n, one, more) => n + " " + (n === 1 ? one : (more || one + "s"));
  const times = n => n === 1 ? "once" : n === 2 ? "twice" : n + " times";
  const ORD = ["first", "second", "third", "fourth", "fifth"];
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const q1 = s => "‘" + s + "’";

  // His answer exactly as saved: a fixed-width face; a space at the start or end, or two together, shows as a mark; capitals
  // are marked; an empty answer reads "(nothing typed)". A short line in words says what the marks mean.
  function typedHtml(s) {
    if (s == null || s === "") return '<code class="tdv-ans tdv-none">(nothing typed)</code>';
    s = String(s);
    const ch = Array.from(s), sp = c => /\s/.test(c), notes = [];
    let out = "";
    ch.forEach((c, i) => {
      if (sp(c)) {
        const shown = i === 0 || i === ch.length - 1 || sp(ch[i - 1] || "") || sp(ch[i + 1] || "") || c !== " ";
        out += shown ? '<span class="tdv-sp" title="a space">␣</span>' : " ";
      } else if (/[A-Z]/.test(c)) out += '<span class="tdv-cap" title="a capital letter">' + esc(c) + "</span>";
      else out += esc(c);
    });
    if (!s.trim()) notes.push("only spaces");
    else {
      if (sp(ch[0])) notes.push("a space at the start");
      if (sp(ch[ch.length - 1])) notes.push("a space at the end");
      if (/\S\s{2,}\S/.test(s)) notes.push("two spaces together");
      const caps = ch.filter(c => /[A-Z]/.test(c)).length;
      if (caps) notes.push(caps === 1 ? "a capital letter" : caps + " capital letters");
    }
    return '<code class="tdv-ans">' + out + "</code>" + (notes.length ? '<span class="tdv-note">' + esc(notes.join(", ")) + "</span>" : "");
  }
  const verdict = ok => ok ? '<span class="tdv-v tdv-ok">Right</span>' : '<span class="tdv-v tdv-ny">Not yet</span>';
  function hintsText(n, look, auto) {
    if (!n && !look) return "";
    let t = n ? many(n, "hint") : "";
    if (look) t += (t ? ", then " : "") + "Look and copy";
    if (auto) t += " (the game gave " + (auto === 1 ? "one" : "them") + " by itself after his second try)";
    return t;
  }

  // ---------- the parts of his day, in the game's order ----------
  const PARTS = [
    ["mail", "Mail: his new words"], ["review", "Old words"], ["training", "Orbit's training"], ["quick", "Quick check"],
    ["pairs", "Pair game: which word did he hear?"], ["new", "New words: Meet, Type, Build"], ["mix", "Last round"],
    ["sentence", "Sentences"], ["probe", "A word never taught"], ["test", "Island test"], ["again", "One more time"],
    ["story", "Story"], ["school", "School words"], ["play", "Free play"]
  ];
  const PART_NAME = {}; PARTS.forEach(p => { PART_NAME[p[0]] = p[1]; });
  const NOW_NAME = { mail: "the mail (his new words)", review: "old words", training: "Orbit's training", quick: "the quick check", pairs: "the pair game",
    "new": "new words", mix: "the last round", sentence: "sentences", probe: "the word never taught", test: "the island test", again: "one more time",
    story: "the story", school: "school words", play: "free play", island: "building his island", start: "the start of the game", old: "old words" };
  const EV_PART = {
    mail_opened: "mail", card_turned: "mail", card_heard: "mail", flashcard_viewed: "mail", say: "mail", voice_ok: "mail", voice_self: "mail",
    card_game_done: "mail", game_meaning: "mail", game_sentence: "mail", ready: "mail", letter_reply: "mail",
    clap: "new", training_start: "training", training_done: "training", quick: "quick", quick_done: "quick", pair: "pairs", pairs_done: "pairs",
    sentence_copied: "sentence", sentence_skipped: "sentence", sentence_none: "sentence", sentence_saved: "sentence",
    probe: "probe", probe_slow: "probe", again: "again",
    story_opened: "story", story_heard: "story", story_zh: "story", story_answer: "story", story_choice: "story", story_done: "story", hut_story_tab: "story",
    school_open: "school", school_drill_start: "school", school_back: "school", school_copy: "school", school_slowly: "school", school_drill_done: "school",
    school_pause: "school", school_test_start: "school", school_test: "school", school_retype_done: "school",
    asleep: "play", bought: "island", build3d_open: "island", build3d_moved: "island", login: "start", old_start: "old", old_done: "old"
  };
  const LEVEL_EV = ["quest_start", "quest_pause", "part_done", "quest_complete"];
  const KIND_PART = { review: "review", training: "training", quick: "quick", "new": "new", mixed: "mix", sentence: "sentence", probe: "probe", test: "test", again: "again", school: "school", school_retry: "school", school_test: "school" };

  // ---------- the model of one day: groups (levels) of parts of questions of tries ----------
  function model(day, A, E, sessions, quests) {
    const qById = {}; quests.forEach(x => { qById[x.id] = x; });
    const all = A.map(a => ({ t: ms(a.created_at), a })).concat(E.map(e => ({ t: ms(e.created_at), e })))
      .sort((x, y) => x.t - y.t || (x.a ? 1 : 0) - (y.a ? 1 : 0));   // at the same moment an event (a hint) comes before the try it led to
    // the words typed as new in each level (their "Build" is saved as a small game, like an old word's extra game)
    const newIn = {}; A.forEach(a => { if (a.kind === "new") (newIn[a.quest_id || ""] = newIn[a.quest_id || ""] || new Set()).add(key(a.word)); });
    const lastFirst = {};   // quest|word -> the kind of his last first try (a retry belongs to it)
    let lvl = null, practice = false;
    const gkey = g => g == null ? "day" : g;
    all.forEach(x => {
      if (x.a) {
        const a = x.a, qr = a.quest_id ? qById[a.quest_id] : null;
        if (qr) { lvl = qr.quest_day != null ? "L" + qr.quest_day : qr.kind === "old" ? "old" : lvl; practice = false; }
        let part = KIND_PART[a.kind], sub = "";
        const wk = (a.quest_id || "") + "|" + key(a.word);
        if (a.kind === "game") {
          const asNew = newIn[a.quest_id || ""] && newIn[a.quest_id || ""].has(key(a.word)) && a.step === "bubbles";
          part = asNew ? "new" : "review"; sub = asNew ? "build" : "game:" + a.step;
        } else if (a.kind === "retry") {
          part = a.step === "type" ? "new" : a.step === "training" ? "training" : a.step === "again" ? "again" : lastFirst[wk] === "test" ? "test" : "review";
          sub = part === "new" ? "type" : "";
        } else {
          if (a.kind === "new") sub = "type";
          if (a.kind === "mixed") sub = "clue:" + a.step;
          if (a.kind === "school_test") sub = "dictation";
          if (["review", "test", "training", "again"].indexOf(a.kind) >= 0) lastFirst[wk] = a.kind;
        }
        if (!part) part = "review";
        x.part = part; x.sub = sub;
        x.g = gkey(lvl);   // school words come after a level now (after every level): they join the level played before them
      } else {
        const e = x.e, d = e.detail || {};
        if ((e.type === "quest_start" || e.type === "quest_complete") && d.day != null) { lvl = "L" + d.day; practice = false; }
        if (e.type === "practice_start") practice = true;
        if (e.type === "old_start") { lvl = "old"; practice = false; }
        let part = EV_PART[e.type] || null;
        if (e.type === "piece_tapped") part = lvl && !practice ? "new" : "mail";
        if (e.type === "voice" && d.word) part = "mail";
        if (e.type === "step_done") part = d.step === "tiles" ? "sentence" : null;
        if (e.type === "hint" || e.type === "rescue") part = "hint";
        if (LEVEL_EV.indexOf(e.type) >= 0) part = "frame";
        x.part = part;
        x.g = part === "mail" ? "start" : part === "story" && d.level != null ? "L" + d.level : part === "play" ? "end" : gkey(lvl);
        if (practice && part && part !== "frame") x.practice = true;   // practice saves no answers; its events are not his record
      }
    });

    // the mail (and the login) belong to the level that comes after them: a day with two levels may have two mails
    for (let i = all.length - 1, nx = null; i >= 0; i--) { const x = all[i]; if (/^L\d+$|^old$/.test(x.g)) nx = x.g; else if (x.g === "start" && nx) x.g = nx; }
    // ---- groups: one per level he played that day, in the order he first played it ----
    const order = [];
    all.forEach(x => { if (/^L\d+$|^old$/.test(x.g) && order.indexOf(x.g) < 0) order.push(x.g); });
    quests.forEach(qr => { if (qr.quest_day != null && (ld(qr.started_at) === day || ld(qr.finished_at) === day) && order.indexOf("L" + qr.quest_day) < 0 && all.some(x => x.g === "L" + qr.quest_day)) order.push("L" + qr.quest_day); });
    const first = order[0] || "day", last = order[order.length - 1] || "day";
    const where = g => g === "start" || g === "end" ? last : g === "day" ? (order.length ? first : "day") : g;
    const groups = {};
    const group = g => groups[g] || (groups[g] = { key: g, items: [] });
    all.forEach(x => { if (x.part && !x.practice) group(where(x.g)).items.push(x); });
    const sess = sessions.find(s => s.day === day) || null;
    if (sess && +sess.play_used > 0) group(last).items.push({ t: Infinity, part: "play", session: sess });
    const keys = order.filter(k => groups[k]).concat(groups.day && order.indexOf("day") < 0 ? ["day"] : []);
    const out = keys.map((k, i) => buildGroup(groups[k], i, keys.length, quests, day, E));
    return { groups: out.filter(g => g.parts.length), all };
  }
  const ld = iso => !iso ? "" : String(iso).length <= 10 ? String(iso) : st.W.dkey(new Date(iso));

  function buildGroup(g, i, n, quests, day, E) {
    const items = g.items, hints = items.filter(x => x.part === "hint");
    let title, sub = [];
    if (/^L\d+$/.test(g.key)) {
      const d = +g.key.slice(1), qr = quests.find(x => x.quest_day === d) || null;
      title = "Level " + d + (n > 1 ? " (his " + (ORD[i] || (i + 1) + "th") + " level that day)" : "");
      if (d % 10 === 0) sub.push("an island test");
      const starts = items.filter(x => x.e && x.e.type === "quest_start");
      const from = starts[0] ? starts[0].t : items.length ? items[0].t : null;
      if (from != null && isFinite(from)) sub.push("started " + clock(new Date(from).toISOString()));
      if (qr && qr.completed && ld(qr.finished_at) === day) sub.push("finished " + clock(qr.finished_at) + (qr.diamonds_earned ? ", " + many(qr.diamonds_earned, "diamond") + " earned" : ""));
      else if (qr && qr.completed) sub.push("finished on an earlier day");
      else sub.push("not finished yet");
      const stops = items.filter(x => x.e && x.e.type === "quest_pause").length;
      if (stops) sub.push("he pressed Stop here " + times(stops));
    } else if (g.key === "old") { title = "Old words only (no new words for now)"; }
    else title = "His day";
    const parts = [];
    PARTS.forEach(([p]) => {
      const its = items.filter(x => x.part === p || (p === "review" && x.part === "old"));
      const P = buildPart(p, its, hints, E);
      if (P) parts.push(P);
    });
    return { key: g.key, title, sub: sub.join(" · "), parts };
  }

  // Tries in a row on the same question make one question; the hints and "Look and copy" are joined to the try they led to.
  function questions(its, hints) {
    const qs = []; let cur = null;
    its.filter(x => x.a).forEach(x => {
      const a = x.a, qid = key(a.word) + "|" + x.sub + "|" + (a.kind === "school_test" ? "t" : "");
      if (!cur || cur.qid !== qid) { cur = { qid, word: a.word, sub: x.sub, kind: a.kind, tries: [], from: x.t }; qs.push(cur); }
      cur.tries.push(x);
    });
    qs.forEach((q, qi) => {
      const bound = qi > 0 ? qs[qi - 1].tries[qs[qi - 1].tries.length - 1].t : -Infinity;
      let prev = Math.max(bound, q.from - 15 * 60 * 1000);
      q.tries.forEach((x, k) => {
        // a press of Hint comes before the try it helped; the game's own hints (auto) come right after the miss that brought
        // them, so they belong to the next try; "Look and copy" is saved a moment before the try it ends in
        const a = x.a, same = h => key((h.e.detail || {}).word) === key(a.word);
        const hEv = hints.filter(h => same(h) && h.e.type === "hint" && ((h.e.detail || {}).auto ? h.t >= prev && h.t < x.t : h.t > prev && h.t <= x.t));
        const rEv = hints.filter(h => same(h) && h.e.type === "rescue" && h.t > prev && h.t <= x.t + 2000);
        x.n = k + 1;
        x.hints = a.hints != null ? +a.hints || 0 : (k ? q.tries[k - 1].hints : 0) + hEv.length;
        x.look = rEv.length > 0;
        x.auto = hEv.filter(h => (h.e.detail || {}).auto).length;
        x.secs = k ? Math.round((x.t - q.tries[k - 1].t) / 1000) : null;
        prev = x.t;
      });
      const lastT = q.tries[q.tries.length - 1];
      q.right = !!lastT.a.correct; q.firstRight = !!q.tries[0].a.correct; q.maxHints = Math.max.apply(null, q.tries.map(x => x.hints || 0));
      q.look = q.tries.some(x => x.look);
    });
    return qs;
  }
  function triesHtml(q, o) {
    o = o || {};
    return '<ol class="tdv-tries">' + q.tries.map(x => {
      const a = x.a, bits = [];
      const h = hintsText(x.hints, x.look, x.auto && x.hints ? x.auto : 0);
      return "<li>" + (q.tries.length > 1 ? '<span class="tdv-n">Try ' + x.n + "</span> " : "") +
        '<span class="tdv-a">' + (o.answer ? o.answer(x) : typedHtml(a.answer)) + "</span> " + (o.verdict ? o.verdict(x) : verdict(a.correct)) + " " +
        (h ? '<span class="tdv-h">' + esc(h) + "</span> " : "") + bits.join("") +
        '<span class="tdv-t">' + clock(a.created_at) + (x.secs != null && x.secs >= 0 ? " · " + x.secs + " s after try " + (x.n - 1) : "") + "</span></li>";
    }).join("") + "</ol>";
  }
  function qHtml(head, how, q, o) {
    const res = o && o.res ? o.res(q) : q.firstRight ? "Right the first time" : q.right ? "Right on try " + q.tries.length : "Not yet right";
    return '<div class="tdv-q"><div class="tdv-qh"><b class="tdv-w">' + head + "</b>" + (how ? '<span class="tdv-how">' + how + "</span>" : "") +
      '<span class="tdv-res ' + (q.firstRight ? "tdv-ok" : "") + '">' + res + "</span></div>" + triesHtml(q, o) + "</div>";
  }
  function typingSummary(qs, one, more) {
    const n = qs.length, fr = qs.filter(q => q.firstRight).length, later = qs.filter(q => !q.firstRight && q.right), never = qs.filter(q => !q.right).length;
    const two = later.every(q => q.tries.length === 2);
    const bits = [];
    if (fr) bits.push(fr + " right the first time");
    if (later.length) bits.push(later.length + " needed " + (two ? "a second try" : "more than one try"));
    if (never) bits.push(never + " not yet right");
    const h = qs.reduce((s, q) => s + q.maxHints, 0), lk = qs.filter(q => q.look).length;
    if (h) bits.push(many(h, "hint"));
    if (lk) bits.push("Look and copy " + times(lk));
    return many(n, one, more) + (bits.length ? ": " + bits.join(", ") : "");
  }
  const MIX_CLUE = { picture: "clue: a picture", zh: "clue: the meaning in Chinese", sentence: "clue: a sentence with a gap", sound: "clue: the sound" };
  const GAME = { bubbles: "Build it: the beats in order", gap: "Fill the gap in a sentence", talk: "A short chat: the missing word" };

  function buildPart(p, its, hints, E) {
    const evs = its.filter(x => x.e).map(x => x.e), ev = t => evs.filter(e => e.type === t);
    const qs = questions(its, hints);
    let rows = [], summary = "", note = "";
    if (p === "mail") {
      const wordsOf = []; evs.forEach(e => { const w = (e.detail || {}).word; if (w && wordsOf.map(key).indexOf(key(w)) < 0) wordsOf.push(w); });
      if (!evs.length) return null;
      const heardN = wordsOf.filter(w => ev("card_heard").some(e => key(e.detail.word) === key(w))).length;
      rows = wordsOf.map(w => {
        const of = t => ev(t).filter(e => key((e.detail || {}).word) === key(w));
        const says = of("say").filter(e => !e.detail.reason), self = of("voice_self").length, ok = of("voice_ok")[0];
        const L = [];
        L.push(of("card_heard").length ? "He heard the word." : "He did not tap to hear it on the card.");
        if (says.length) L.push("He said it " + times(says.length) + " into the microphone." + (says.some(e => e.detail.heard) ? " The laptop heard: " + says.map(e => e.detail.heard ? typedHtml(e.detail.heard) : '<code class="tdv-ans tdv-none">(nothing)</code>').join(" / ") : ""));
        if (self) L.push("He said it out loud 3 times and tapped “I said it” each time (the laptop could not check his speech).");
        if (!says.length && !self && ok) L.push("He said it.");
        const gm = of("game_meaning"), gs = of("game_sentence");
        const gl = (list, name) => { if (!list.length) return; const r = list.findIndex(e => e.detail.correct); L.push(name + (r < 0 ? ": not yet right" : r === 0 ? ": right the first time" : ": right on try " + (r + 1)) + "."); };
        gl(gm, "Meaning game"); gl(gs, "Sentence game");
        const t = evs.filter(e => key((e.detail || {}).word) === key(w)).map(e => e.created_at).sort()[0];
        return '<div class="tdv-q"><div class="tdv-qh"><b class="tdv-w">' + esc(w) + '</b><span class="tdv-t">' + (t ? clock(t) : "") + "</span></div>" +
          '<ul class="tdv-lines">' + L.map(x => "<li>" + x + "</li>").join("") + "</ul>" +
          '<div class="tdv-voice" data-voice-word="' + esc(w) + '"></div></div>';
      });
      const saidN = wordsOf.filter(w => evs.some(e => (e.type === "say" && !e.detail.reason || e.type === "voice_self" || e.type === "voice_ok") && key(e.detail.word) === key(w))).length;
      summary = wordsOf.length ? many(wordsOf.length, "new word") + ": he heard " + (heardN === wordsOf.length ? (wordsOf.length === 2 ? "both" : wordsOf.length === 1 ? "it" : "all") : heardN) +
        ", said " + (saidN === wordsOf.length ? (wordsOf.length === 1 ? "it" : "each") : saidN) : "He opened his mail" + (ev("mail_opened").length ? " at " + clock(ev("mail_opened")[0].created_at) : "") + ".";
      if (!wordsOf.length && ev("mail_opened").length) rows = [];
      // he wrote back to her letter (event letter_reply { letter, length }); his text itself is on the Letters tab only
      ev("letter_reply").forEach(e => rows.push('<div class="tdv-q tdv-reply"><div class="tdv-qh"><span class="tdv-rl">He wrote back to your letter.</span><span class="tdv-t">' + clock(e.created_at) + "</span></div></div>"));
    } else if (p === "review") {
      if (!qs.length && !ev("old_start").length) return null;
      const main = qs.filter(q => !/^game:/.test(q.sub)), extra = qs.filter(q => /^game:/.test(q.sub));
      rows = qs.map(q => /^game:/.test(q.sub) ? qHtml(esc(q.word), esc(GAME[q.sub.slice(5)] || "A small extra game"), q, q.sub === "game:bubbles" ? { answer: x => typedHtml(x.a.answer), verdict: x => x.a.correct ? verdict(true) : '<span class="tdv-v tdv-ny">Not yet at first (a beat tapped out of order), then in order</span>' } : null)
        : qHtml(esc(q.word), "Listen and type", q));
      summary = main.length ? typingSummary(main, "old word") : "";
      if (extra.length) summary += (summary ? "; " : "") + many(extra.length, "small extra game");
    } else if (p === "training") {
      if (!qs.length && !evs.length) return null;
      rows = qs.map(q => qHtml(esc(q.word), "Listen and type", q));
      summary = qs.length ? typingSummary(qs, "word") : "He read Orbit's tip.";
      note = "Orbit's training is from an older version of the game.";
    } else if (p === "quick") {
      if (!qs.length) return null;
      rows = qs.map(q => qHtml(esc(q.word), "Listen and type, one try", q));
      const known = qs.filter(q => q.firstRight && !q.maxHints).length;
      summary = typingSummary(qs, "short word") + (known ? "; " + known + " right with no hint (these count as known)" : "");
    } else if (p === "pairs") {
      const taps = its.filter(x => x.e && x.e.type === "pair");
      if (!taps.length) return null;
      const pq = []; let cur = null;
      taps.forEach(x => { const d = x.e.detail || {}, id = key(d.a) + "|" + key(d.b); if (!cur || cur.id !== id || d.try === 1 || (cur.tries.length && cur.tries[cur.tries.length - 1].e.detail.right)) { cur = { id, d, tries: [] }; pq.push(cur); } cur.tries.push(x); });
      rows = pq.map(q => '<div class="tdv-q"><div class="tdv-qh"><b class="tdv-w">' + esc(q.d.a) + " or " + esc(q.d.b) + "?</b>" +
        '<span class="tdv-res ' + (q.tries[0].e.detail.right ? "tdv-ok" : "") + '">' + (q.tries[0].e.detail.right ? "Right the first time" : q.tries.some(x => x.e.detail.right) ? "Right on try " + q.tries.length : "Not yet right; the game then showed him") + "</span></div>" +
        '<ol class="tdv-tries">' + q.tries.map((x, k) => { const d = x.e.detail; return "<li>" + (q.tries.length > 1 ? '<span class="tdv-n">Try ' + (k + 1) + "</span>" : "") +
          '<span class="tdv-a">He heard <b>' + esc(d.target) + "</b>, he chose " + typedHtml(d.chosen) + "</span>" + verdict(!!d.right) +
          '<span class="tdv-t">' + clock(x.e.created_at) + (k ? " · " + Math.round((x.t - q.tries[k - 1].t) / 1000) + " s after try " + k : "") + "</span></li>"; }).join("") + "</ol></div>");
      const fr = pq.filter(q => q.tries[0].e.detail.right).length;
      summary = many(pq.length, "pair") + (fr ? ": " + fr + " right the first time" : "") + (pq.length - fr ? (fr ? ", " : ": ") + (pq.length - fr) + " needed another listen" : "");
    } else if (p === "new") {
      const claps = ev("clap").filter(e => (e.detail || {}).on === "meet" || !(e.detail || {}).on);
      const typeQ = qs.filter(q => q.sub === "type"), buildQ = qs.filter(q => q.sub === "build");
      if (!claps.length && !typeQ.length && !buildQ.length && !ev("piece_tapped").length) return null;
      const met = [];
      claps.forEach(e => { if (met.map(key).indexOf(key(e.detail.word)) < 0) met.push(e.detail.word); });
      ev("piece_tapped").forEach(e => { const w = (e.detail || {}).word; if (w && met.map(key).indexOf(key(w)) < 0 && !typeQ.length && !buildQ.length) met.push(w); });
      if (met.length) rows.push('<h4 class="tdv-sub">Meet the word</h4>');
      met.forEach(w => { const c = claps.find(e => key(e.detail.word) === key(w));
        rows.push('<div class="tdv-q"><div class="tdv-qh"><b class="tdv-w">' + esc(w) + '</b><span class="tdv-how">' + (c ? "He tapped all " + many(+c.detail.beats || 0, "beat") + " in turn." : "He tapped some of its beats.") + '</span><span class="tdv-t">' + (c ? clock(c.created_at) : "") + "</span></div></div>"); });
      if (typeQ.length) rows.push('<h4 class="tdv-sub">Type it</h4>');
      typeQ.forEach(q => rows.push(qHtml(esc(q.word), "Type the new word", q)));
      if (buildQ.length) rows.push('<h4 class="tdv-sub">Build it (the beats in order)</h4>');
      buildQ.forEach(q => rows.push(qHtml(esc(q.word), "", q, { verdict: x => x.a.correct ? verdict(true) : '<span class="tdv-v tdv-ny">Not yet at first (a beat tapped out of order), then in order</span>', res: q => q.firstRight ? "In order the first time" : "Built it; not in order at first" })));
      const bits = [];
      if (met.length) bits.push("met " + (met.length === 2 ? "both" : met.length === 1 ? "1" : met.length) + " (every beat tapped" + (claps.length < met.length ? " for " + claps.length : "") + ")");
      if (typeQ.length) bits.push("typed " + typeQ.length + ": " + (typeQ.filter(q => q.firstRight).length || "none") + " right the first time" + (typeQ.reduce((s, q) => s + q.maxHints, 0) ? " (" + many(typeQ.reduce((s, q) => s + q.maxHints, 0), "hint") + ")" : ""));
      if (buildQ.length) bits.push("built " + buildQ.length + (buildQ.filter(q => q.firstRight).length === buildQ.length ? ", each with the beats in order at once" : ""));
      const nw = Math.max(met.length, new Set(typeQ.map(q => key(q.word))).size, new Set(buildQ.map(q => key(q.word))).size);
      summary = many(nw, "new word") + (bits.length ? ": " + bits.join("; ") : "");
    } else if (p === "mix") {
      if (!qs.length) return null;
      rows = qs.map(q => qHtml(esc(q.word), esc(MIX_CLUE[q.sub.slice(5)] || "a clue"), q));
      summary = typingSummary(qs, "question");
    } else if (p === "sentence") {
      const tq = qs, cp = ev("sentence_copied"), sk = ev("sentence_skipped"), none = ev("sentence_none"), own = ev("sentence_saved");
      if (!tq.length && !cp.length && !sk.length && !own.length) return null;
      const wordsOf = []; tq.map(q => q.word).concat(cp.concat(sk, own).map(e => e.detail.word)).forEach(w => { if (w && wordsOf.map(key).indexOf(key(w)) < 0) wordsOf.push(w); });
      rows = wordsOf.map(w => {
        const t = tq.find(q => key(q.word) === key(w)), c = cp.find(e => key(e.detail.word) === key(w)), s = sk.find(e => key(e.detail.word) === key(w)), o = own.filter(e => key(e.detail.word) === key(w));
        const L = [];
        if (t) L.push("The tiles: " + '<code class="tdv-ans">' + esc(t.tries[0].a.answer) + "</code> " + (t.tries[0].a.correct ? verdict(true) + " in order at once" : '<span class="tdv-v tdv-ny">Not yet at first</span> then in order') + ' <span class="tdv-t">' + clock(t.tries[0].a.created_at) + "</span>");
        if (c) L.push("He copied the sentence" + (+c.detail.misses ? " after " + many(+c.detail.misses, "try", "tries") + " that were not yet right" : " right the first time") + '. <span class="tdv-t">' + clock(c.created_at) + (t ? " · " + Math.round((ms(c.created_at) - ms(t.tries[0].a.created_at)) / 1000) + " s after the tiles" : "") + "</span>");
        if (s) L.push("He pressed Skip instead of copying" + (+s.detail.misses ? ", after " + many(+s.detail.misses, "try", "tries") : "") + '. <span class="tdv-t">' + clock(s.created_at) + "</span>");
        if (c || s) L.push('<span class="tdv-small">The game does not keep the line he typed, only that he copied it.</span>');
        o.forEach(e => L.push("His own sentence: " + typedHtml(e.detail.sentence) + ' <span class="tdv-t">' + clock(e.created_at) + "</span>"));
        return '<div class="tdv-q"><div class="tdv-qh"><b class="tdv-w">' + esc(w) + '</b></div><ul class="tdv-lines">' + L.map(x => "<li>" + x + "</li>").join("") + "</ul></div>";
      });
      const n = wordsOf.length, inOrder = tq.filter(q => q.firstRight).length;
      summary = many(n, "sentence") + ": " + [tq.length ? "tiles in order at once for " + inOrder + " of " + tq.length : "", cp.length ? "copied " + cp.length : "", sk.length ? "skipped " + sk.length : ""].filter(Boolean).join(", ");
      if (none.length) note = "A word with no example sentence has nothing to copy.";
    } else if (p === "probe") {
      if (!qs.length) return null;
      const slow = ev("probe_slow");
      rows = qs.map(q => qHtml(esc(q.word), "Never taught; one try" + (slow.some(e => key(e.detail.word) === key(q.word)) ? "; he pressed Slowly " + times(slow.filter(e => key(e.detail.word) === key(q.word)).length) : ""), q));
      summary = qs.length === 1 ? "1 word he was never taught: " + (qs[0].firstRight ? "right" : "not yet") : typingSummary(qs, "word");
    } else if (p === "test" || p === "again") {
      if (!qs.length) return null;
      rows = qs.map(q => qHtml(esc(q.word), "Listen and type", q));
      summary = typingSummary(qs, "word");
      if (p === "again") note = "Each word that was not right the first time in this level, asked once more.";
    } else if (p === "story") {
      if (!evs.length) return null;
      const S = window.WW_STORY || null, lv = [];
      evs.forEach(e => { const l = (e.detail || {}).level; if (l != null && lv.indexOf(l) < 0) lv.push(l); });
      if (!S) askStory();
      rows = lv.map(l => {
        const pg = S && S[l], ans = ev("story_answer").filter(e => e.detail.level === l), L = [];
        const op = ev("story_opened").find(e => e.detail.level === l);
        // story_choice (newer games): the answer he tapped and the question, one per try; own: true = the tutor's own page
        const chs = ev("story_choice").filter(e => e.detail.level === l);
        const own = evs.some(e => (e.detail || {}).level === l && e.detail.own === true);
        const title = own ? ((op && op.detail.title) || "Your story, page " + l) : (pg && pg.title ? pg.title : "Page " + l);
        const q = (chs[0] && chs[0].detail.q) || (!own && pg && pg.q) || "";
        L.push("He opened page " + l + (own ? " (your own story)" : "") + (op ? " at " + clock(op.created_at) : "") + "." + (ev("story_heard").some(e => e.detail.level === l) ? " He pressed Hear it." : "") + (ev("story_zh").some(e => e.detail.level === l) ? " He looked at the Chinese." : ""));
        if (q) L.push("The question: <b>" + esc(q) + "</b>");
        ans.forEach((e, k) => {
          const c = chs.find(x => x.detail.tries === e.detail.tries) || chs[k] || null, said = c && c.detail.answer ? typedHtml(c.detail.answer) : "";
          const line = e.detail.right ? "He chose " + (said || (!own && pg && pg.a ? typedHtml(pg.a) : "the right answer")) + " " + verdict(true)
            : "He chose " + (said || "another answer") + " " + verdict(false) + (said ? "" : ' <span class="tdv-small">(this older game did not save which one)</span>');
          L.push('<span class="tdv-n">Try ' + (k + 1) + "</span> " + line + ' <span class="tdv-t">' + clock(e.created_at) + (k ? " · " + Math.round((ms(e.created_at) - ms(ans[k - 1].created_at)) / 1000) + " s after try " + k : "") + "</span>");
        });
        if (!ans.length && ev("story_done").some(e => e.detail.level === l)) L.push("He finished the page.");
        return '<div class="tdv-q"><div class="tdv-qh"><b class="tdv-w">' + esc(title) + "</b></div><ul class=\"tdv-lines\">" + L.map(x => "<li>" + x + "</li>").join("") + "</ul></div>";
      });
      const a1 = ev("story_answer");
      summary = many(lv.length, "story page") + (a1.length ? ": " + (a1[0].detail.right ? "the question right the first time" : a1.some(e => e.detail.right) ? "the question right on try " + (a1.findIndex(e => e.detail.right) + 1) : "the question not answered yet") : "");
    } else if (p === "school") {
      if (!qs.length && !evs.length) return null;
      const drill = qs.filter(q => q.sub !== "dictation"), dict = qs.filter(q => q.sub === "dictation"), copies = ev("school_copy");
      if (drill.length) rows.push('<h4 class="tdv-sub">Listen and type</h4>');
      drill.forEach(q => rows.push(qHtml(esc(q.word), copies.some(e => key(e.detail.word) === key(q.word)) ? "he also copied it" : "", q)));
      if (dict.length) rows.push('<h4 class="tdv-sub">Practice dictation</h4>');
      dict.forEach(q => rows.push(qHtml(esc(q.word), "", q)));
      const bits = [];
      if (drill.length) bits.push(typingSummary(drill, "school word"));
      if (dict.length) bits.push("practice dictation: " + dict.filter(q => q.firstRight).length + " of " + dict.length + " right");
      const pt = ev("school_test")[0];
      if (pt && pt.detail && pt.detail.total) bits.push("paper dictation he marked himself: " + (+pt.detail.score || 0) + " of " + pt.detail.total);
      summary = bits.join("; ") || "He opened the school words.";
    } else if (p === "play") {
      const s = its.find(x => x.session), asleep = ev("asleep")[0];
      const sec = s ? +s.session.play_used || 0 : asleep ? +asleep.detail.play_used || 0 : 0;
      if (!sec) return null;
      summary = "About " + many(Math.max(1, Math.round(sec / 60)), "minute") + " of free play" + (asleep ? "; the island went to sleep at " + clock(asleep.created_at) : "") + ".";
    }
    if (!rows.length && !summary) return null;
    return { id: p, title: PART_NAME[p], summary, note, rows, count: qs.reduce((s, q) => s + q.tries.length, 0) };
  }

  // ---------- "Now": the last thing saved ----------
  function nowLine(day, all, groupsOrder) {
    const W = st.W, today = W.today(), seen = all.filter(x => x.part !== "frame" || true);
    if (!seen.length) return day === today ? "Nothing saved today yet." : "Nothing saved on this day.";
    const last = seen[seen.length - 1];
    let named = null;
    for (let i = seen.length - 1; i >= 0; i--) { const x = seen[i]; if (x.part && x.part !== "hint" && x.part !== "frame" && !x.practice) { named = x; break; } if (x.part === "hint" && !named) { named = x; break; } }
    const where = x => {
      if (!x) return "the game";
      let part = x.part;
      if (part === "hint") part = (seen.slice(0, seen.indexOf(x)).reverse().find(y => y.a) || {}).part || "review";
      const lv = /^L\d+$/.test(x.g) ? "Level " + x.g.slice(1) + ", " : "";
      const w = x.a ? x.a.word : x.e && x.e.detail && (x.e.detail.word || x.e.detail.target);
      const nm = NOW_NAME[part] || "the game";
      return (lv ? lv + nm : cap(nm)) + (w ? ": " + q1(esc(w)) : "");
    };
    const t = last.t, isNow = day === today && Date.now() - t <= NOW_MS;
    if (isNow) return "<b>He is playing now:</b> " + where(named);
    return (day === today ? "Last seen at " : "Last seen that day at ") + "<b>" + clock(new Date(t).toISOString()) + "</b>, in " + where(named).replace(/^[A-Z]/, c => c === "L" ? c : c.toLowerCase()) + ".";
  }

  // ---------- drawing ----------
  function partHtml(gk, P, open) {
    const k = gk + "|" + P.id;
    return '<details class="tdv-part" data-k="' + esc(k) + '" data-open="' + (open ? 1 : 0) + '"><summary>' +
      '<span class="tdv-pt">' + esc(P.title) + "</span>" + (P.summary ? '<span class="tdv-ps">' + P.summary + "</span>" : "") + "</summary>" +
      (P.note ? '<p class="tdv-small">' + esc(P.note) + "</p>" : "") + (P.rows.length ? '<div class="tdv-rows">' + P.rows.join("") + "</div>" : "") + "</details>";
  }
  function bodyHtml(m) {
    if (!m.groups.length) return '<p class="tdv-empty">' + (m.all && m.all.length ? "He opened the game" + (st.day === st.W.today() ? " today" : " that day") + ", but no answers are saved yet." + (st.day === st.W.today() ? " They show here as soon as he plays." : "") : st.day === st.W.today() ? "He has not played today yet. His answers show here as soon as he plays." : "Nothing was saved on this day.") + "</p>";
    return m.groups.map((g, i) => {
      const k = "G|" + st.day + "|" + g.key;
      return '<details class="tdv-level" data-k="' + esc(k) + '" data-open="' + (i === 0 ? 1 : 0) + '"><summary>' +
        '<span class="tdv-lt">' + esc(g.title) + "</span>" + (g.sub ? '<span class="tdv-ls">' + esc(g.sub) + "</span>" : "") +
        '<span class="tdv-ls">' + g.parts.map(P => esc(P.title.replace(/:.*$/, ""))).join(" · ") + "</span></summary>" +
        g.parts.map(P => partHtml(st.day + "|" + g.key, P, true)).join("") + "</details>";
    }).join("");
  }
  function chooserHtml() {
    const W = st.W, t = W.today(), days = st.days;
    const label = d => (d === t ? "Today, " : d === W.addDays(t, -1) ? "Yesterday, " : "") + W.niceDate(d);
    const i = days.indexOf(st.day);
    return '<div class="tdv-choose"><button type="button" class="mini" id="tdvPrev" aria-label="An earlier day"' + (i < days.length - 1 ? "" : " disabled") + ">‹ Earlier</button>" +
      '<label class="tdv-sel"><span>Day</span><select id="tdvDay">' + days.map(d => '<option value="' + d + '"' + (d === st.day ? " selected" : "") + ">" + esc(label(d)) + "</option>").join("") + "</select></label>" +
      '<button type="button" class="mini" id="tdvNext" aria-label="A later day"' + (i > 0 ? "" : " disabled") + ">Later ›</button></div>";
  }
  function shell() {
    const c = st.container;
    c.hidden = false;
    c.innerHTML = '<div class="bh"><h2>Every answer</h2><span class="eyebrow">What he did, answer by answer</span></div>' +
      '<p class="tdv-now" id="tdvNow" aria-live="polite"></p><div id="tdvChoose"></div>' +
      '<p class="tdv-small tdv-how2">His answer is shown exactly as the game saved it, in <code class="tdv-ans">this face</code>. A mark like <code class="tdv-ans"><span class="tdv-sp">␣</span></code> is a space; a <code class="tdv-ans"><span class="tdv-cap">C</span></code>apital is underlined. In the levels the game keeps his letters only; in the school words it keeps all he typed.</p>' +
      '<div id="tdvBody"><p class="tdv-empty">Loading…</p></div>';
    c.addEventListener("toggle", e => { const d = e.target; if (d && d.dataset && d.dataset.k) folds[d.dataset.k] = d.open; }, true);
    c.addEventListener("click", e => {
      const b = e.target.closest && e.target.closest("button"); if (!b) return;
      const i = st.days.indexOf(st.day);
      if (b.id === "tdvPrev" && i < st.days.length - 1) choose(st.days[i + 1]);
      if (b.id === "tdvNext" && i > 0) choose(st.days[i - 1]);
    });
    c.addEventListener("change", e => { if (e.target && e.target.id === "tdvDay") choose(e.target.value); });
  }
  function choose(day) { if (!st || day === st.day) return; st.day = day; st.lastBody = null; draw(true); }
  const safe = q => Promise.resolve(q).catch(e => ({ data: [], error: e }));
  async function load(day) {
    const { sb, student, W } = st.ctx, sid = student.id;
    const from = new Date(day + "T00:00:00").toISOString(), to = new Date(W.addDays(day, 1) + "T00:00:00").toISOString();
    const [a, e, s, q] = await Promise.all([
      safe(sb.from("attempts").select("*").eq("student_id", sid).gte("created_at", from).lt("created_at", to).order("created_at")),
      safe(sb.from("events").select("*").eq("student_id", sid).gte("created_at", from).lt("created_at", to).order("created_at")),
      safe(sb.from("sessions").select("*").eq("student_id", sid).order("day", { ascending: false }).limit(400)),
      safe(sb.from("quests").select("*").eq("student_id", sid).order("quest_day"))
    ]);
    return { A: a.data || [], E: e.data || [], S: s.data || [], Q: q.data || [], err: a.error || e.error || null };
  }
  async function draw(scrollKeep) {
    if (!st) return;
    const me = st, day = st.day, D = await load(day);
    if (st !== me || st.day !== day || !st.container.isConnected) return;
    const W = st.W, t = W.today();
    const days = new Set([t]); D.S.forEach(s => { if (s.day && s.day <= t) days.add(s.day); }); days.add(day);
    st.days = Array.from(days).sort().reverse();
    let m;
    try { m = model(day, D.A, D.E, D.S, D.Q); } catch (x) { m = { groups: [], all: [] }; console.warn(x); }
    const now = nowLine(day, m.all), body = D.err && !D.A.length && !D.E.length ? '<p class="tdv-empty">Could not load this day. Check the internet; the page tries again by itself.</p>' : bodyHtml(m), ch = chooserHtml();
    const y = window.scrollY;
    if ($("tdvNow").innerHTML !== now) $("tdvNow").innerHTML = now;
    if (st.lastChoose !== ch) { $("tdvChoose").innerHTML = ch; st.lastChoose = ch; }
    // the folds carry no open state in the text, so a refresh with nothing new changes nothing on the page (no flicker);
    // after a redraw each fold is as she left it (or as it starts: the first level open, its parts open)
    if (st.lastBody !== body) {
      $("tdvBody").innerHTML = body; st.lastBody = body;
      $("tdvBody").querySelectorAll("details[data-k]").forEach(el => { const k = el.dataset.k; el.open = k in folds ? folds[k] : el.dataset.open === "1"; });
      if (scrollKeep !== true && window.scrollY !== y) window.scrollTo(0, y);
    }
    st.model = m;
    if (window.WW_TEACHER_VOICE) window.WW_TEACHER_VOICE.fill(st.container, { sb: st.ctx.sb, student: st.ctx.student, day, W });   // his voice recordings (site/teacher-voice.js)
  }
  const $ = id => st.container.querySelector("#" + id);
  function askStory() {
    if (storyAsked || window.WW_STORY || typeof document === "undefined") return;
    storyAsked = true;
    try { const s = document.createElement("script"); s.src = "story.js"; s.onload = () => { if (st) { st.lastBody = null; draw(); } }; document.head.appendChild(s); } catch (e) {}
  }
  function tick() {
    if (!st) return stop();
    if (!st.container.isConnected) return stop();
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    draw();
  }
  function stop() { if (timer) clearInterval(timer); timer = null; st = null; }
  function render(container, ctx) {
    stop();
    if (!container || !ctx || !ctx.student) return;
    const W = ctx.W || window.WT;
    st = { container, ctx, W, day: ctx.day || W.today(), days: [ctx.day || W.today()], lastBody: null, lastChoose: null };
    shell();
    timer = setInterval(tick, REFRESH_MS);
    return draw(true);
  }
  window.WW_TEACHER_DAY = { render, stop, refresh: () => tick(), _typed: typedHtml, _hints: hintsText };
})();
