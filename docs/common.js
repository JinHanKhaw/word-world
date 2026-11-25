/* Shared helpers for the student app and the teacher dashboard. */
(function () {
  const cfg = window.WORD_TOWER_CONFIG || {};
  const W = (window.WT = {});

  W.client = function () {
    if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || /YOUR-/.test(cfg.SUPABASE_URL)) return null;
    return window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
  };

  // The memory ladder (the tutor's decision C, 21 November): a learned word is met again after 1 day, then 4 days, then 14 days.
  // A word's level is the step it is on (1, 2, 3); INTERVALS[level] = days until that step's meeting. Right on the first try at
  // the step-3 meeting (14 days) makes it a star word: level W.DIAMOND (6; kept at 6 so saved star words and the database's
  // 0..6 range stay valid), no due date. The island test is the fourth meeting. Levels 4 and 5 exist only in old saves
  // (the old ladder 1, 3, 7, 14, 30): W.fromOldLadder moves them once, when the game loads.
  W.INTERVALS = { 1: 1, 2: 4, 3: 14 };
  W.TOP = 3;           // the last step; right there -> star word
  W.DIAMOND = 6;
  W.REVIEW_CAP = 6;    // old words a day, at most, unless the tutor sets students.review_cap
  // Right on the first try: one step up; from the last step (or a star word in the island test) to star word.
  W.up = level => (level >= W.TOP ? W.DIAMOND : Math.max(1, (+level || 0) + 1));
  // Not right on the first try: one step down, never below step 1 (the old ladder dropped two of five steps; on three steps
  // one step keeps "not to the bottom"). A star word missed in the island test counts as a miss at the 14-day meeting: step 2.
  // The word always comes back tomorrow (the caller sets due).
  W.down = level => Math.max(1, Math.min(+level || 1, W.TOP) - 1);
  // The due date after a right first try on the step reached: null for a star word.
  W.dueFor = (level, from) => (level >= W.DIAMOND ? null : W.addDays(from || W.today(), W.INTERVALS[level] || 1));
  // An old save: step 4 of the old ladder (passed the 7-day meeting, waiting for the 14-day one) is step 3 now, the same
  // meeting, its saved due date kept. Step 5 (passed the 14-day meeting, waiting for the 30-day one) has already done what
  // makes a star word now: star word, no due date. Returns the patch, or null when nothing moves.
  W.fromOldLadder = w => {
    const lv = w ? +w.level : 0;
    if (lv === 4) return { level: W.TOP };
    if (lv === 5) return { level: W.DIAMOND, due: null };
    return null;
  };

  const pad = n => String(n).padStart(2, "0");
  W.dkey = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  W.today = () => W.dkey(new Date());
  W.addDays = (k, n) => { const d = new Date(k + "T00:00:00"); d.setDate(d.getDate() + n); return W.dkey(d); };
  W.daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 864e5);
  W.weekStart = k => { const d = new Date(k + "T00:00:00"); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return W.dkey(d); };
  W.niceDate = k => { try { return new Date(k + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); } catch (e) { return k; } };
  W.fmtTime = iso => { if (!iso) return ""; const d = new Date(iso); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };

  W.esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  W.plain = w => String(w || "").toLowerCase().replace(/[^a-z]/g, "");
  // Comparing what he typed with a word: capital letters never count, apostrophes always do ("dont" is not "don't").
  W.key = w => String(w || "").toLowerCase().replace(/[\u2018\u2019`\u00b4]/g, "'").replace(/[^a-z']/g, "");
  W.same = (typed, word) => !!W.key(word) && W.key(typed) === W.key(word);
  W.cleanChunks = c => String(c || "").toLowerCase().replace(/[^a-z-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
  // Chunks with the week's focus letters coloured (focus = letters to colour, e.g. "ll" for lollipop; matched inside the whole word).
  W.chunksHtml = (c, focus) => {
    const parts = W.cleanChunks(c).split("-"), word = parts.join(""), hot = new Set();
    const f = W.plain(focus || "");
    if (f) { let from = 0, at; while ((at = word.indexOf(f, from)) !== -1) { for (let i = at; i < at + f.length; i++) hot.add(i); from = at + 1; } }
    let i = 0;
    return parts.map(p => { let h = ""; for (const ch of p) { h += hot.has(i) ? '<b class="hot">' + W.esc(ch) + "</b>" : W.esc(ch); i++; } return '<span class="ch">' + h + "</span>"; }).join('<span class="dot">·</span>');
  };
  W.beats = c => W.cleanChunks(c).split("-").filter(Boolean).length;
  W.gapHtml = (sentence, word) =>
    W.esc(sentence).replace(/[A-Za-z]+/g, t => t.toLowerCase().indexOf(word) !== -1 ? '<b class="gap">' + "_".repeat(Math.max(6, t.length)) + "</b>" : t);
  W.hasWord = (sentence, word) => String(sentence || "").toLowerCase().replace(/[\u2018\u2019]/g, "'").split(/[^a-z']+/).some(t => t.indexOf(W.key(word)) !== -1);
  W.diffHtml = (a, k) => {
    let out = "";
    for (let i = 0; i < Math.max(a.length, k.length); i++) { const c = a[i] || "_"; out += c === k[i] ? W.esc(c) : '<span class="x">' + W.esc(c) + "</span>"; }
    return out;
  };

  // On claude.ai the browser's own voice can be missing inside the page frame; then the platform's reader speaks instead.
  let reader = null;
  try { if (window.claude && window.claude.use) window.claude.use("tts").then(t => { reader = t || null; }).catch(() => {}); } catch (e) {}
  // devDead: the device has voices but they did not start, twice in a row, while the page reader is there (claude.ai): from
  // then on the reader speaks, as if the device had no voice. (The real website has no reader: there the device voice is
  // tried again every time.)
  let devDead = false;
  try { devDead = sessionStorage.getItem("ww.dev.dead") === "1"; } catch (e) {}   // found silent earlier in this visit: the reader speaks at once after a reload
  const noVoice = () => { try { return devDead || !("speechSynthesis" in window) || speechSynthesis.getVoices().length === 0; } catch (e) { return true; } };
  W.devDead = () => devDead;
  // The device voice the tutor chose (students.voice_name, students.voice_rate); the game sets W.voicePrefs after sign-in.
  // W.voice() -> { voice, rate }: the chosen voice when this device has it, else a British voice, else any English one (or
  // null); rate is a factor on the rates used today (0.85 for "slower"). W.utter(text, rate) makes an utterance with both.
  W.voicePrefs = { name: "", rate: "normal" };
  // Which voice. Only voices that live on the device are wanted: a network voice ("Google UK English ...") sends the text
  // it speaks to its maker's server and is known to jam the browser's speech queue. Order: British first, then the other
  // English ones; the joke voices and the robot-like ones of macOS last among the local voices; network voices only when
  // the device has no English voice of its own (then W.voice().local is false and Orbit's lines, which can hold his name,
  // are not spoken with it: 07-guide.js).
  const ODD_VOICE = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Junior|Kathy|Ralph|Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley)\b/i;
  W.voiceLocal = v => !!v && v.localService !== false && v.local !== false;
  W.voiceRank = v => (W.voiceLocal(v) ? 0 : 100) + (ODD_VOICE.test((v && v.name) || "") ? 20 : 0) +
    (/^en[-_]GB/i.test((v && v.lang) || "") ? 0 : /^en[-_](AU|IE|NZ|ZA)/i.test((v && v.lang) || "") ? 3 : /^en[-_]US/i.test((v && v.lang) || "") ? 5 : 7);
  W.voiceList = function () {
    let vs = []; try { vs = ("speechSynthesis" in window && speechSynthesis.getVoices()) || []; } catch (e) {}
    const en = Array.prototype.filter.call(vs, v => /^en([-_]|$)/i.test(v.lang || "")).map((v, i) => ({ v, i, r: W.voiceRank(v) }));
    en.sort((a, b) => a.r - b.r || a.i - b.i);
    const list = en.map(x => x.v), p = W.voicePrefs || {}, chosen = p.name ? list.find(v => v.name === p.name && W.voiceLocal(v)) : null;
    return chosen ? [chosen].concat(list.filter(v => v !== chosen)) : list;
  };
  // W.voice(n) -> { voice, rate, chosen, local }: the n-th best voice (0: the tutor's choice when this device has it, else
  // the best one); rate is a factor on the rates used today (0.85 for "slower").
  W.voice = function (n) {
    const p = W.voicePrefs || {}, list = W.voiceList(), v = list[n || 0] || null;
    return { voice: v, rate: p.rate === "slower" ? 0.85 : 1, chosen: !!(v && p.name && v.name === p.name), local: W.voiceLocal(v) };
  };
  W.utter = function (text, rate, n) {
    const c = W.voice(n), u = new SpeechSynthesisUtterance(text);
    u.lang = (c.voice && c.voice.lang) || "en-GB"; u.rate = (rate || 1) * c.rate; if (c.voice) u.voice = c.voice;
    return u;
  };
  // ---- the device's own voice: one careful way to speak -----------------------------------------------------------
  // Everything said with the browser's voice goes through W.devSay(parts, o). parts: texts or { text, rate }, said one
  // after another. o.rate: the rate for parts without one; o.onstart(); o.onend(ok). Returns a function that stops it.
  // Browsers have several ways to stay silent without saying so; this guards against the known ones:
  //  - a queue that is stuck or paused from before: cancel() and resume() first;
  //  - a new utterance swallowed by the cancel() just before it: a short wait when something was still being said;
  //  - a voice that never starts: no start event after DEV_START ms, or an error -> once more with the next voice;
  //  - end events that never come: the utterances are kept until they end, and a timer ends the turn by itself.
  // What happened is told to W.onSpeech (the game logs it as a "speech" event): the first start with each voice in a
  // session, and every failure, so "the browser spoke" and "the browser never started" can be told apart afterwards.
  // W.devSay(parts, { voice: n }): the n-th of the device's own English voices (W.voiceList; 0 is the usual one), for a game
  // that wants several speakers. On claude.ai the reader has four voices of its own; n picks among them.
  const READER_VOICES = ["buttery", "airy", "glassy", "rounded"];
  const DEV_START = 2500, DEV_QUIET = 1000;
  let devSeq = 0, devCur = null, devKeep = [], devFailNotes = 0, devSilent = 0;
  const devOkSeen = {};
  W.devOk = () => { try { return "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined"; } catch (e) { return false; } };
  // Some browsers let the device's voice speak only after it was first asked from inside a tap or a key press (25 November:
  // a word without a recording stayed silent when its page opened, and spoke on the first click). So his first tap asks for
  // a silent nothing; what the game says later by itself is then allowed.
  (function devUnlock() {
    let done = false;
    const go = () => {
      if (done) return; done = true;
      try { if (W.devOk() && !speechSynthesis.speaking && !speechSynthesis.pending) { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } } catch (e) {}
      // the recordings' sound engine too: some browsers wake it only inside a tap or a key press (25 November)
      try { if (W.clipsOn && W.clipsOn()) { const c = clipContext(); if (c && c.state !== "running" && c.resume) { const p = c.resume(); if (p && p.catch) p.catch(() => {}); } } } catch (e) {}
    };
    try { ["pointerdown", "keydown", "touchend"].forEach(ev => window.addEventListener(ev, go, { capture: true, passive: true })); } catch (e) {}
  })();
  W.onSpeech = null;
  W.lastSpeech = null;   // { ok, voice, at }: the last start or failure (the voice test reads it)
  function devNote(d) {
    W.lastSpeech = { ok: !!d.ok, voice: d.voice || "", at: Date.now(), why: d.why || "" };
    if (d.ok) { if (devOkSeen[d.voice || "-"]) return; devOkSeen[d.voice || "-"] = 1; }
    else if (++devFailNotes > 8) return;
    try { if (typeof W.onSpeech === "function") W.onSpeech(d); } catch (e) {}
  }
  // One more try that stayed silent. Two in a row, with the page reader at hand (claude.ai): the device voice counts as
  // silent from now on and the reader speaks (noVoice() above). Any start event sets the count back to none.
  // Without a page reader (the real website): after three silent tries in a row the device voice is left alone for the rest of
  // the visit (24 November: on the tutor's Mac every line cost five seconds of waiting for a voice that never starts). What
  // has a recording never comes here; what has none is then only shown.
  // (Only where the page has recordings: without them the device voice is all there is, and it goes on being asked.)
  function devSilentUp() {
    const limit = reader && reader.speak ? 2 : (W.clipsOn && W.clipsOn() ? 3 : Infinity);
    if (++devSilent >= limit) { devDead = true; try { sessionStorage.setItem("ww.dev.dead", "1"); } catch (e) {} }
  }
  W.devStop = function () {
    devSeq++; const c = devCur; devCur = null;
    try { if ("speechSynthesis" in window) speechSynthesis.cancel(); } catch (e) {}
    if (c) { if (c.byReader) { try { W.readStop(); } catch (e) {} } c.end(false); }
  };
  W.devSay = function (parts, o) {
    o = o || {};
    const list = (Array.isArray(parts) ? parts : [parts]).map(p => (typeof p === "string" ? { text: p } : p)).filter(p => p && String(p.text || "").trim());
    // a text that has a recording (a word of the game) is played from the recording, in every caller's place; when it
    // cannot play, the same call goes on with the device's voice (o.noClip)
    if (list.length === 1 && !o.noClip) {
      const r1 = list[0].rate || o.rate || 1, clip = W.clipFor(list[0].text, o.voice || 0, r1 < 0.7 || W.voice().rate < 1);
      if (clip) return W.clipSay(clip, { ticket: o.ticket, onstart: o.onstart, onend: o.onend, onfail: () => W.devSay(parts, Object.assign({}, o, { noClip: true })) });
    }
    W.clipStop();   // one voice at a time: a recording still playing is over when the device's voice begins
    let done = false, tStart = 0, tEnd = 0, cur = -1;   // cur: the try whose events count (-1 between two tries)
    const end = ok => { if (done) return; done = true; clearTimeout(tStart); clearTimeout(tEnd); if (devCur === me) { devCur = null; devKeep = []; } try { if (o.onend) o.onend(!!ok); } catch (e) {} };
    const me = { end, quiet: null, byReader: false };
    // whoever was speaking is told that it is over; a try that was cut after a second without any start counts as silent
    if (devCur) { const c = devCur; devCur = null; if (c.quiet && c.quiet()) devSilentUp(); c.end(false); }
    const mine = ++devSeq;
    if (!list.length) { end(false); return () => {}; }
    const stop = () => { if (mine === devSeq && !done) W.devStop(); };
    const f = W.voice().rate;
    // the page reader says it (claude.ai, once the device voice has stayed silent)
    const readIt = () => {
      devCur = me; me.byReader = true; me.quiet = null;
      try { if (o.onstart) o.onstart(); } catch (e) {}
      W.read(list.map(p => W.readerText(String(p.text))).join(list.length > 1 ? ". " : ""), { rate: (list[0].rate || o.rate || 1) * f, voice: READER_VOICES[(o.voice || 0) % READER_VOICES.length] }).then(ok => { if (mine === devSeq) end(!!ok); });
    };
    if (devDead && reader && reader.speak) { try { if ("speechSynthesis" in window) speechSynthesis.cancel(); } catch (e) {} readIt(); return stop; }
    if (!W.devOk() || devDead) { end(false); return () => {}; }   // devDead here: no reader, and the device voice stayed silent three times
    const s = speechSynthesis; devCur = me;
    let busy = false; try { busy = !!(s.speaking || s.pending); s.cancel(); } catch (e) {}
    const state = () => { const st = {}; try { st.speaking = !!s.speaking; st.pending = !!s.pending; st.paused = !!s.paused; st.voices = s.getVoices().length; } catch (e) {} return st; };
    const run = n => {
      if (mine !== devSeq || done) return;
      try { if (s.paused) s.resume(); } catch (e) {}
      const c = W.voice((o.voice || 0) + n), name = (c.voice && c.voice.name) || "", t0 = Date.now();
      let started = false, total = 0;
      cur = n;
      me.quiet = () => !started && cur === n && Date.now() - t0 >= DEV_QUIET;
      const fail = why => {
        if (mine !== devSeq || done || cur !== n) return;
        cur = -1; me.quiet = null; clearTimeout(tStart); clearTimeout(tEnd);
        try { s.cancel(); } catch (e) {}
        if (why !== "not-allowed") devSilentUp();
        const toReader = devDead && why !== "not-allowed" && !!(reader && reader.speak);
        const next = !toReader && n === 0 && why !== "not-allowed" ? W.voice((o.voice || 0) + 1).voice : null;
        devNote(Object.assign({ ok: false, why, voice: name, local: c.local, tried: n + 1, again: !!next, ms: Date.now() - t0 }, toReader ? { reader: true } : {}, state()));
        if (toReader) return readIt();
        if (next) setTimeout(() => run(1), 150); else end(false);
      };
      const us = list.map((p, i) => {
        const u = new SpeechSynthesisUtterance(String(p.text)), rate = (p.rate || o.rate || 1) * c.rate;
        u.lang = (c.voice && c.voice.lang) || "en-GB"; u.rate = rate; if (c.voice) u.voice = c.voice;
        total += (500 + 95 * String(p.text).length) / Math.max(0.3, rate);
        if (i === 0) u.onstart = () => {
          if (mine !== devSeq || done || started || cur !== n) return;
          started = true; devSilent = 0; clearTimeout(tStart);
          devNote({ ok: true, voice: name, local: c.local, tried: n + 1, ms: Date.now() - t0 });
          tEnd = setTimeout(() => end(true), total * 1.5 + 2500);   // no end event ever: the turn still ends
          try { if (o.onstart) o.onstart(); } catch (e) {}
        };
        u.onerror = e => {
          if (mine !== devSeq || done || cur !== n) return;
          const er = (e && e.error) || "error";
          if (er === "interrupted" || er === "canceled") end(false); else fail(er);
        };
        if (i === list.length - 1) u.onend = () => { if (mine === devSeq && cur === n) end(true); };
        return u;
      });
      devKeep = us;   // kept until the end: a browser may drop the events of an utterance nobody holds
      try { us.forEach(u => s.speak(u)); } catch (e) { return fail("throw"); }
      tStart = setTimeout(() => { if (!started) fail("nostart"); }, DEV_START);
    };
    if (busy) setTimeout(() => run(0), 90); else run(0);
    return stop;
  };
  // ---- the recorded voice (24 November) ---------------------------------------------------------------------------
  // Every word of the game has a recording in one British voice, so a word never depends on the laptop's own voice
  // (the tutor's Mac never started speaking: 23 and 24 November, "speech" events with why "nostart").
  // site/voice.js lists the recordings (window.WW_REC); they come as data in a few script files, site/voice/a-0.js ...
  // (window.WW_CLIPS), made by tools/make_voice.py. Set a: the usual voice, each word at its normal speed and slowly
  // (same pitch). Set s: the example sentences in that voice. Set b: a second voice, the words of the pair game. Set o:
  // Orbit's fixed lines in the second voice. beats: for a word, where each of its beats lies in the recording
  // (tools/make_beats.py), so a tapped beat is that piece of the word itself. Played through an audio context, like the
  // game's other sounds.
  //   W.clipFor(text, n, slow)  the recording for this text, or null. n: the speaker (odd: the second voice first, where it has the text)
  //   W.clipSay(clip, o)        plays it. o.onstart(), o.onend(ok); o.onfail(why) is called INSTEAD of onend when it could
  //                             not play, so the caller can go on with another voice. Returns a function that stops it.
  //   W.clipsOn()               are there recordings at all?
  // The files load one after another in the background from the first seconds on; a word asked for earlier loads its file first.
  const clipKey = t => String(t == null ? "" : t).toLowerCase().replace(/[.!?,;:]+$/, "").trim().replace(/[^a-z0-9]+/g, "_");
  const clipIdx = () => window.WW_REC || null;
  W.clipsOn = () => { const V = clipIdx(); return !!(V && V.a && (window.AudioContext || window.webkitAudioContext)); };
  W.clipFor = function (text, n, slow) {
    if (!W.clipsOn()) return null;
    const V = clipIdx(), k = clipKey(text); if (!k) return null;
    const set = ((n | 0) % 2 === 1 ? ["b", "o", "a", "s"] : ["a", "s", "o", "b"]).find(x => V[x] && V[x][k]), e = set && V[set][k];
    if (!e) return null;
    const useSlow = !!slow && e.length > 2;
    return { set, key: k, pack: set + "-" + e[0], at: useSlow ? 1 : 0, dur: useSlow ? e[2] : e[1], slow: useSlow };
  };
  // One beat of a word, cut from the word's slow recording: the recording with from / len (seconds), or null when the
  // word has no beat times (then the caller plays the whole word).
  W.clipBeat = function (word, chunk, at) {
    try {
      const V = clipIdx(); if (!W.clipsOn() || !V.beats || window.WW_BEATS === false) return null;
      const k = clipKey(word), B = V.beats[k], e = V.a[k]; if (!B || !e || e.length < 3) return null;
      const ck = clipKey(chunk), i = at != null && B.c[at] === ck ? at : B.c.indexOf(ck); if (i < 0 || !B.t[i]) return null;
      const sc = e[2] / e[1], from = Math.max(0, B.t[i][0] * sc - 0.02), to = Math.min(e[2], B.t[i][1] * sc + 0.03);
      if (!(to - from >= 0.08)) return null;
      const c = W.clipFor(word, 0, true); if (!c) return null;
      c.from = from; c.len = to - from; c.dur = c.len; c.beat = i;
      return c;
    } catch (e) { return null; }
  };
  const clipPacks = {}, clipBufs = {};
  function clipPack(name) {
    if (clipPacks[name]) return clipPacks[name];
    return (clipPacks[name] = new Promise(res => {
      const have = () => !!(window.WW_CLIPS && window.WW_CLIPS[name]);
      if (have()) return res(true);
      try {
        const V = clipIdx(), el = document.createElement("script");
        // the version mark keeps a browser from using an old copy after new recordings (the real website; the page on claude.ai
        // loads its files by their plain names, as its 3D models do)
        el.src = "voice/" + name + ".js" + (window.WORD_TOWER_CONFIG && V && V.v ? "?v=" + V.v : ""); el.async = true;
        el.onload = () => res(have()); el.onerror = () => { delete clipPacks[name]; res(false); };
        document.head.appendChild(el);
      } catch (e) { delete clipPacks[name]; res(false); }
    }));
  }
  // in the background: every file of set a, then set b, one at a time
  (function clipWarm() {
    try {
      const start = () => {
        const V = clipIdx(); if (!V || !V.a) return;
        const names = [];
        ["a", "b", "o", "s"].forEach(set => { let top = -1; Object.keys(V[set] || {}).forEach(k => { top = Math.max(top, V[set][k][0]); }); for (let i = 0; i <= top; i++) names.push(set + "-" + i); });
        let i = 0; const next = () => { if (i < names.length) clipPack(names[i++]).then(() => setTimeout(next, 150)); };
        next();
      };
      if (document.readyState === "complete") setTimeout(start, 1500); else window.addEventListener("load", () => setTimeout(start, 1500));
    } catch (e) {}
  })();
  // W.clipNeed(texts): these texts will be said soon (a level's words and sentences): their files are asked for now, so the
  // first saying does not wait for a download.
  W.clipNeed = function (texts) {
    try { (texts || []).forEach(t => { [0, 1].forEach(n => { const c = W.clipFor(t, n, false); if (c) clipPack(c.pack); }); }); } catch (e) {}
  };
  let clipCtx = null, clipSeq = 0, clipCur = null;
  function clipContext() {
    if (clipCtx) return clipCtx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    try { clipCtx = new AC(); } catch (e) { clipCtx = null; }
    return clipCtx;
  }
  function clipBuffer(clip) {
    const id = clip.pack + "/" + clip.key + "/" + clip.at;
    if (clipBufs[id]) return clipBufs[id];
    return (clipBufs[id] = clipPack(clip.pack).then(ok => {
      const e = ok && window.WW_CLIPS[clip.pack][clip.key], b64 = e && e[clip.at], ctx = clipContext();
      if (!b64 || !ctx) return null;
      const bin = atob(b64), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Promise(res => { try { const p = ctx.decodeAudioData(bytes.buffer, b => res(b), () => res(null)); if (p && p.catch) p.catch(() => res(null)); } catch (x) { res(null); } });
    }).then(b => { if (!b) delete clipBufs[id]; return b; }, () => { delete clipBufs[id]; return null; }));
  }
  W.clipStop = function () {
    clipSeq++; const c = clipCur; clipCur = null;
    if (c) { try { if (c.src) { c.src.onended = null; c.src.stop(); } } catch (e) {} c.end(false); }
  };
  W.clipSay = function (clip, o) {
    o = o || {};
    // one voice at a time: whoever speaks now is stopped (the device's voice, the page reader, another recording)
    try { W.devStop(); } catch (e) {}
    W.clipStop();
    const mine = ++clipSeq, t0 = Date.now(); let done = false, tEnd = 0, tStart = 0;
    const me = { src: null, end: null };
    const end = ok => { if (done) return; done = true; clearTimeout(tEnd); clearTimeout(tStart); if (clipCur === me) clipCur = null; try { if (o.onend) o.onend(!!ok); } catch (e) {} };
    me.end = end; clipCur = me;
    const fail = why => {
      if (done || mine !== clipSeq) return;
      devNote({ ok: false, clip: true, why, voice: "recorded " + clip.set, word: clip.key, ms: Date.now() - t0 });
      if (typeof o.onfail === "function") { done = true; clearTimeout(tEnd); clearTimeout(tStart); if (clipCur === me) clipCur = null; try { o.onfail(why); } catch (e) {} }
      else end(false);
    };
    tStart = setTimeout(() => fail("nostart"), 9000);   // the file did not come (a slow line gets its time), or the sound engine never woke up
    // o.ticket: the caller's ticket from W.wordBegin. A word keeps the floor while its file is still coming, and from its
    // start for as long as it lasts (25 November: a word whose file had not loaded yet was overtaken by Orbit's line and never said).
    if (o.ticket && W.wordHold) W.wordHold(o.ticket, 9500);
    clipBuffer(clip).then(buf => {
      if (mine !== clipSeq || done) return;
      const ctx = clipContext(); if (!buf || !ctx) return fail(buf ? "noengine" : "nofile");
      const go = () => {
        if (mine !== clipSeq || done) return;
        if (ctx.state !== "running") return fail("asleep");
        try {
          const src = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = 1;
          src.buffer = buf; src.connect(g); g.connect(ctx.destination);
          src.onended = () => { if (mine === clipSeq) end(true); };
          me.src = src;
          let secs = buf.duration;
          if (clip.len) {   // a piece of the recording (one beat): soft at both ends, so the cut is not heard as a click
            const from = Math.min(Math.max(0, clip.from || 0), Math.max(0, buf.duration - 0.05)); secs = Math.min(clip.len, buf.duration - from);
            const now = ctx.currentTime;
            try { g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(1, now + 0.012); g.gain.setValueAtTime(1, now + Math.max(0.02, secs - 0.03)); g.gain.linearRampToValueAtTime(0, now + secs); } catch (x) {}
            src.start(0, from, secs);
          } else src.start();
          clearTimeout(tStart);
          if (o.ticket && W.wordHold) W.wordHold(o.ticket, secs * 1000 + 900);
          devNote({ ok: true, clip: true, voice: "recorded " + clip.set, ms: Date.now() - t0 });
          tEnd = setTimeout(() => end(true), secs * 1000 + 600);   // no end event: the turn still ends
          try { if (o.onstart) o.onstart(); } catch (e) {}
        } catch (e) { fail("throw"); }
      };
      if (ctx.state === "running") return go();
      let p; try { p = ctx.resume(); } catch (e) {}
      if (p && p.then) p.then(go, () => fail("asleep")); else setTimeout(go, 60);
    });
    return () => { if (mine === clipSeq && !done) W.clipStop(); };
  };
  // ---- one voice, the word first ----------------------------------------------------------------------------------
  // Everything spoken shares one voice: a word he must hear (W.speak, W.speakChunks, the school words) and Orbit's line.
  // On claude.ai that voice is the page reader: a new speak() replaces the one speaking, stop() silences whatever it is
  // saying, and it refuses ("busy") while the page's dictation listens. Three rules keep a word from being lost:
  //   1. a word starts at once and is never cut by a line: Orbit asks W.afterWord(fn) and speaks when the word is over;
  //   2. when a word starts, whoever was talking is told first (W.onWord), so a recorded line never plays over it;
  //   3. "busy" is not the end: W.read asks again for a few seconds and switches off a microphone nobody is waiting
  //      for (W.micOn is true only while the mailbox listens to him).
  let wordId = 0, wordOn = 0, wordT = 0, readSeq = 0;
  const wordWait = [], wordHooks = [];
  W.micOn = false;
  W.wordBusy = () => !!wordOn;
  W.onWord = fn => { if (typeof fn === "function") wordHooks.push(fn); };
  // A word begins. est (ms): when its end is assumed if no end event ever comes. Returns the ticket for W.wordEnd.
  W.wordBegin = function (est) {
    const id = ++wordId; wordOn = id; clearTimeout(wordT);
    wordHooks.forEach(h => { try { h(); } catch (e) {} });
    wordT = setTimeout(() => W.wordEnd(id), Math.max(1200, est || 0));
    return id;
  };
  // The word with this ticket still has the floor for ms more (its recording is loading, or has just started).
  W.wordHold = function (id, ms) { if (wordOn !== id) return; clearTimeout(wordT); wordT = setTimeout(() => W.wordEnd(id), Math.max(300, ms || 0)); };
  W.wordEnd = function (id) {
    if (wordOn !== id) return;
    wordOn = 0; clearTimeout(wordT);
    const run = wordWait.splice(0);
    if (run.length) setTimeout(() => run.forEach(g => g()), 200);   // a breath between the word and the line
  };
  // Run fn as soon as no word is being said (now, if none is). Returns a function that takes the request back.
  W.afterWord = function (fn) {
    let dead = false;
    const go = () => { if (dead) return; if (wordOn) { wordWait.push(go); return; } dead = true; try { fn(); } catch (e) {} };
    go();
    return () => { dead = true; };
  };
  function micOff() {
    try {
      if (W.micOn || !(window.claude && window.claude.use)) return;
      window.claude.use("dictation").then(d => { try { const p = d && d.stop && d.stop(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }).catch(() => {});
    } catch (e) {}
  }
  W.hasReader = () => !!(reader && reader.speak && noVoice());
  // Read a text through the page reader. Resolves true when it was said to the end, false when it was not (cut by a newer
  // read, refused, no reader). Rate is kept inside the reader's range (0.7 to 1.5).
  W.read = function (text, o) {
    const mine = ++readSeq, r = o && +o.rate, rate = r && Math.abs(r - 1) > 0.004 ? Math.min(1.5, Math.max(0.7, r)) : 0;
    return new Promise(res => {
      if (!reader || !reader.speak) return res(false);
      let n = 0;
      const go = () => {
        if (mine !== readSeq) return res(false);
        let p;
        // language "en": without it the reader guesses the language of each short text, and a word part such as "ing" was
        // spelled out letter by letter (the tutor, 23 November)
        const opt = { language: "en" }; if (rate) opt.rate = rate; if (o && o.voice && o.voice !== READER_VOICES[0]) opt.voice = o.voice;
        try { p = reader.speak(String(text), opt); } catch (e) { return res(false); }
        if (!p || !p.then) return res(true);
        p.then(() => res(true), e => {
          if (e && e.code === "busy" && n < 8 && mine === readSeq) { n++; if (n === 1 || n === 5) micOff(); setTimeout(go, 400); }
          else res(false);
        });
      };
      go();
    });
  };
  W.readStop = function () { readSeq++; try { if (reader && reader.stop) reader.stop(); } catch (e) {} };
  // A word ending said by itself (a beat he taps): the page reader spelled "ing" out as letters (the tutor, 23 November). Written
  // the way a book writes an ending, "-ing", a reader says it as a sound. Only on the reader path; a device voice says "ing".
  const READER_PART = {}; "ing ed er est ly tion sion ture ment ness ful less ous".split(" ").forEach(x => { READER_PART[x] = "-" + x; });
  W.readerText = t => READER_PART[t] || t;
  // o.slow: for words he has no picture or sentence for (the school list): clearly slower, not dragged out.
  W.lastWord = "";   // the last word said (a beat tapped afterwards belongs to it: W.speakChunks)
  W.speak = function (word, o) {
    const slow = !!(o && o.slow);
    try {
      const f = W.voice().rate, text = W.key(word);
      // the recording first; the page reader or the device's voice only for a word without one, or when it cannot play
      const clip = !(o && o.noClip) && W.clipFor(text, 0, slow || f < 1);
      if (clip) {
        W.lastWord = text;
        const id = W.wordBegin(900 + clip.dur * 1000);
        W.clipSay(clip, { ticket: id, onend: () => W.wordEnd(id), onfail: () => { W.wordEnd(id); W.speak(word, { slow, noClip: true }); } });
        return true;
      }
      W.lastWord = text;
      if (reader && noVoice()) {
        const id = W.wordBegin(9000);
        W.read(W.readerText(text), { rate: (slow ? 0.75 : 0.88) * f }).then(() => W.wordEnd(id));
        return true;
      }
      if (!("speechSynthesis" in window)) return false;
      const id = W.wordBegin(1200 + 300 * text.length);
      W.devSay([{ text, rate: slow ? 0.62 : 0.8 }], { noClip: true, onend: () => W.wordEnd(id) });   // noClip: no recording, or it could not play (never the same recording a second time)
      return true;
    } catch (e) { return false; }
  };
  try { if ("speechSynthesis" in window) speechSynthesis.getVoices(); } catch (e) {}
  // Say the chunks one by one, slowly, so he hears the beats.
  // With recordings: a beat is never recorded by itself (a voice says "ny" or "tion" alone in odd ways). All the beats of a
  // word: the whole word, slowly. One beat: that piece of the word said last (the page's word), cut from its slow
  // recording (W.clipBeat); where the word has no beat times, the whole word slowly. The page lights the beat he tapped.
  W.speakChunks = function (chunks, o) {
    try {
      const f = W.voice().rate, parts = W.cleanChunks(chunks).split("-").filter(Boolean);
      if (!(o && o.noClip)) {
        // o.word: the word the beat belongs to (the callers that know it say so); o.i: which of its beats
        const whole = parts.join(""), last = W.key((o && o.word) || W.lastWord || "");
        let clip = null;
        if (parts.length === 1 && last && last !== W.key(whole) && last.indexOf(W.key(whole)) >= 0) clip = W.clipBeat(last, whole, o && o.i) || W.clipFor(last, 0, true);
        if (!clip) clip = W.clipFor(whole, 0, true);
        if (clip) {
          if (parts.length > 1) W.lastWord = W.key(whole);
          const id = W.wordBegin(900 + clip.dur * 1000);
          W.clipSay(clip, { ticket: id, onend: () => W.wordEnd(id), onfail: () => { W.wordEnd(id); W.speakChunks(chunks, { noClip: true }); } });
          return true;
        }
      }
      if (reader && noVoice()) {
        const id = W.wordBegin(12000);
        W.read(parts.map((x, i) => (i > 0 && i === parts.length - 1 ? W.readerText(x) : x)).join(". ") + ".", { rate: f }).then(() => W.wordEnd(id));
        return true;
      }
      if (!("speechSynthesis" in window)) return false;
      const id = W.wordBegin(1500 + 900 * parts.length);
      W.devSay(parts.map(p => ({ text: p, rate: 0.6 })), { noClip: true, onend: () => W.wordEnd(id) });
      return true;
    } catch (e) { return false; }
  };
  // Listen to him say the word. Works in Chrome and Safari on a normal website; inside a preview frame the microphone is refused, so callers must cope with "unavailable".
  W.listenFor = function (word, cb) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return cb({ ok: null, heard: "", reason: "unavailable" });
    try {
      const r = new SR(); r.lang = "en-GB"; r.interimResults = false; r.maxAlternatives = 5; let done = false;
      const finish = res => { if (done) return; done = true; try { r.stop(); } catch (e) {} cb(res); };
      r.onresult = e => {
        const alts = [...e.results[0]].map(a => W.plain(a.transcript)), target = W.plain(word);
        const ok = alts.some(a => a === target || a.indexOf(target) !== -1 || (target.length > 5 && a.length && (a.indexOf(target.slice(0, 4)) !== -1 || target.indexOf(a) !== -1)));
        finish({ ok, heard: alts[0] || "", reason: "" });
      };
      r.onerror = e => finish({ ok: null, heard: "", reason: e.error || "error" });
      r.onend = () => finish({ ok: null, heard: "", reason: "nothing" });
      r.start(); return true;
    } catch (e) { cb({ ok: null, heard: "", reason: "unavailable" }); return false; }
  };
  // Record his voice for a few seconds. Resolves { ok, audio (data URL), reason }. No microphone (a preview frame, or refused) → ok: null.
  W.recordVoice = function (seconds, onLevel) {
    return new Promise(res => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) return res({ ok: null, audio: "", reason: "unavailable" });
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        const chunks = [], rec = new MediaRecorder(stream);
        let actx = null, timer = null;
        try { const AC = window.AudioContext || window.webkitAudioContext; actx = new AC(); const src = actx.createMediaStreamSource(stream), an = actx.createAnalyser(); an.fftSize = 512; src.connect(an); const buf = new Uint8Array(an.fftSize);
          timer = setInterval(() => { an.getByteTimeDomainData(buf); let peak = 0; for (let i = 0; i < buf.length; i++) peak = Math.max(peak, Math.abs(buf[i] - 128) / 128); if (onLevel) onLevel(peak); }, 60); } catch (e) {}
        rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = () => {
          clearInterval(timer); stream.getTracks().forEach(t => t.stop()); if (actx) try { actx.close(); } catch (e) {}
          const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
          if (!blob.size) return res({ ok: false, audio: "", reason: "empty" });
          const fr = new FileReader(); fr.onload = () => res({ ok: true, audio: String(fr.result), reason: "" }); fr.onerror = () => res({ ok: false, audio: "", reason: "read" }); fr.readAsDataURL(blob);
        };
        rec.start(); setTimeout(() => { try { rec.stop(); } catch (e) {} }, (seconds || 3) * 1000);
      }).catch(() => res({ ok: null, audio: "", reason: "refused" }));
    });
  };
  // Hear claps through the microphone: a sharp loud peak well above the room noise, at most one every 280 ms.
  // Returns { stop } or null when there is no microphone to use.
  W.clapListener = function (onClap, onLevel) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return null;
    const h = { stop() {} }, AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    let live = true;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      if (!live) { stream.getTracks().forEach(t => t.stop()); return; }
      const actx = new AC(), src = actx.createMediaStreamSource(stream), an = actx.createAnalyser(); an.fftSize = 1024; src.connect(an);
      const buf = new Uint8Array(an.fftSize); let noise = 0.05, last = 0;
      const timer = setInterval(() => {
        an.getByteTimeDomainData(buf); let peak = 0, sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i] - 128) / 128; sum += v; if (v > peak) peak = v; }
        const avg = sum / buf.length; if (onLevel) onLevel(peak);
        const now = Date.now();
        if (peak > Math.max(0.35, noise * 6) && now - last > 280) { last = now; (h.cb || onClap)(); } else noise = noise * 0.95 + avg * 0.05;
      }, 30);
      h.stop = () => { live = false; clearInterval(timer); stream.getTracks().forEach(t => t.stop()); try { actx.close(); } catch (e) {} };
    }).catch(() => { if (h.onFail) h.onFail(); });
    h.stop = () => { live = false; };
    return h;
  };

  // A finger-writing pad on a canvas. Returns { clear, isEmpty, png } (png: small data URL for the teacher).
  W.pad = function (canvas, color) {
    const c2 = canvas.getContext && canvas.getContext("2d"); if (!c2) return { clear() {}, isEmpty: () => true, png: () => "" };
    const dpr = Math.min(2, window.devicePixelRatio || 1); let strokes = 0, drawing = false, last = null;
    function size() { const r = canvas.getBoundingClientRect(); canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); c2.scale(dpr, dpr); c2.lineCap = "round"; c2.lineJoin = "round"; c2.lineWidth = 6; c2.strokeStyle = color || "#142433"; }
    size();
    const pos = e => { const r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e; return { x: t.clientX - r.left, y: t.clientY - r.top }; };
    const down = e => { drawing = true; last = pos(e); strokes++; e.preventDefault(); };
    const move = e => { if (!drawing) return; const p = pos(e); c2.beginPath(); c2.moveTo(last.x, last.y); c2.lineTo(p.x, p.y); c2.stroke(); last = p; e.preventDefault(); };
    const up = () => { drawing = false; };
    canvas.addEventListener("mousedown", down); canvas.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
    canvas.addEventListener("touchstart", down, { passive: false }); canvas.addEventListener("touchmove", move, { passive: false }); canvas.addEventListener("touchend", up);
    return {
      clear() { c2.save(); c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, canvas.width, canvas.height); c2.restore(); strokes = 0; },
      isEmpty: () => strokes === 0,
      png() { try { const o = document.createElement("canvas"); o.width = 320; o.height = Math.round(320 * canvas.height / canvas.width) || 120; const g = o.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, o.width, o.height); g.drawImage(canvas, 0, 0, o.width, o.height); return o.toDataURL("image/png"); } catch (e) { return ""; } }
    };
  };
  // Shrink a picture file to a small JPEG data URL (for word pictures the teacher uploads).
  W.shrinkImage = (file, max) => new Promise(res => {
    try {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => { const k = Math.min(1, (max || 480) / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.8)); };
      img.onerror = () => res(""); img.src = url;
    } catch (e) { res(""); }
  });

  // Pixel pictures for the tower: 56 x 32 pixels = 7 x 4 tiles of 8 x 8. Each finished day reveals one tile.
  W.PICTURE_TILES = 28;
  const pics = {};
  W.pixelArt = function (n) {
    const i = ((n % 2) + 2) % 2;
    if (pics[i]) return pics[i];
    const g = []; for (let y = 0; y < 32; y++) g.push(new Array(56).fill(null));
    const R = (x, y, w, h, c) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (yy >= 0 && yy < 32 && xx >= 0 && xx < 56) g[yy][xx] = c; };
    const P = (x, y, c) => R(x, y, 1, 1, c);
    if (i === 0) { // day: diamond house, tree, sun
      R(0, 0, 56, 12, "#5aa9f2"); R(0, 12, 56, 8, "#7cc0ff");
      R(47, 3, 5, 5, "#f1c94b"); R(48, 2, 3, 1, "#f1c94b"); R(48, 8, 3, 1, "#f1c94b"); R(46, 4, 1, 3, "#f1c94b"); R(52, 4, 1, 3, "#f1c94b");
      R(8, 5, 8, 2, "#f4f7fb"); R(10, 4, 4, 1, "#f4f7fb"); R(30, 8, 6, 2, "#f4f7fb"); R(31, 7, 3, 1, "#f4f7fb");
      R(0, 17, 56, 3, "#4f8f33"); R(0, 16, 6, 1, "#4f8f33"); R(44, 16, 12, 1, "#4f8f33"); R(48, 15, 6, 1, "#4f8f33");
      R(0, 20, 56, 3, "#7cc04d"); R(0, 23, 56, 9, "#8a6142");
      [[3, 25], [9, 28], [17, 26], [24, 30], [31, 27], [39, 29], [46, 25], [52, 28], [13, 30], [36, 24]].forEach(p => P(p[0], p[1], "#6e4a30"));
      R(12, 11, 16, 9, "#c89a62"); for (let y = 12; y < 20; y += 2) R(12, y, 16, 1, "#b8895a");
      R(10, 10, 20, 1, "#9b3b2a"); R(12, 9, 16, 1, "#9b3b2a"); R(14, 8, 12, 1, "#b5442f"); R(16, 7, 8, 1, "#b5442f"); R(18, 6, 4, 1, "#b5442f");
      R(18, 14, 4, 6, "#5c3a1e"); P(21, 17, "#f1c94b");
      R(13, 12, 3, 3, "#a9ddff"); P(14, 13, "#e3f3ff"); R(24, 12, 3, 3, "#a9ddff"); P(25, 13, "#e3f3ff");
      R(38, 14, 3, 6, "#5c3a1e"); R(35, 11, 9, 4, "#3f8f2f"); R(33, 9, 13, 3, "#3f8f2f"); R(36, 7, 7, 2, "#3f8f2f"); R(38, 6, 3, 1, "#3f8f2f");
      [[36, 9], [41, 8], [34, 11], [43, 12], [39, 10]].forEach(p => P(p[0], p[1], "#5fb545")); P(37, 12, "#e04a3a"); P(42, 10, "#e04a3a");
      R(5, 10, 3, 1, "#52d6cb"); R(4, 11, 5, 1, "#52d6cb"); R(5, 12, 3, 1, "#52d6cb"); P(6, 13, "#52d6cb"); P(5, 11, "#b8f3ee"); P(6, 10, "#b8f3ee");
    } else { // night: castle by the water
      R(0, 0, 56, 22, "#1b2350");
      [[3, 2], [12, 6], [22, 3], [31, 1], [44, 5], [52, 2], [8, 11], [48, 10], [26, 8], [38, 2]].forEach(p => P(p[0], p[1], "#f4f0c4"));
      R(6, 3, 5, 5, "#f4f0c4"); R(7, 2, 3, 1, "#f4f0c4"); R(7, 8, 3, 1, "#f4f0c4"); R(8, 3, 4, 4, "#1b2350"); R(9, 2, 2, 1, "#1b2350"); R(9, 8, 2, 1, "#1b2350");
      R(16, 12, 25, 10, "#868d99"); for (let y = 13; y < 22; y += 3) for (let x = 17; x < 41; x += 4) P(x + (y % 2), y, "#6f7682");
      R(15, 6, 6, 16, "#9aa1ad"); R(36, 6, 6, 16, "#9aa1ad"); R(15, 5, 1, 1, "#9aa1ad"); R(17, 5, 2, 1, "#9aa1ad"); R(20, 5, 1, 1, "#9aa1ad"); R(36, 5, 1, 1, "#9aa1ad"); R(38, 5, 2, 1, "#9aa1ad"); R(41, 5, 1, 1, "#9aa1ad");
      R(21, 11, 15, 1, "#9aa1ad"); for (let x = 22; x < 36; x += 2) P(x, 10, "#9aa1ad");
      R(26, 15, 5, 7, "#3a2a1a"); R(27, 14, 3, 1, "#3a2a1a"); R(28, 18, 1, 1, "#f1c94b");
      [[17, 9], [19, 13], [38, 9], [40, 13], [23, 16], [33, 16]].forEach(p => P(p[0], p[1], "#f1c94b"));
      R(18, 1, 1, 5, "#5c3a1e"); R(19, 1, 4, 2, "#e07a5f"); R(39, 1, 1, 5, "#5c3a1e"); R(40, 1, 4, 2, "#e07a5f");
      R(0, 22, 56, 3, "#4a7a35"); R(0, 25, 56, 7, "#2e6fb0");
      [[2, 26], [10, 28], [19, 26], [27, 30], [34, 27], [42, 29], [50, 26], [6, 30], [46, 31]].forEach(p => R(p[0], p[1], 3, 1, "#4b8fd1"));
    }
    let svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 32" shape-rendering="crispEdges">';
    for (let y = 0; y < 32; y++) { let x = 0; while (x < 56) { const c = g[y][x]; let w = 1; while (x + w < 56 && g[y][x + w] === c) w++; if (c) svg += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="1" fill="' + c + '"/>'; x += w; } }
    svg += "</svg>";
    return (pics[i] = "url('data:image/svg+xml," + encodeURIComponent(svg).replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29") + "')");
  };

  // Little sounds, made on the spot (no files): "pop" when something opens, "squash" when it closes.
  let actx = null;
  W.sfx = function (kind) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
      actx = actx || new AC(); if (actx.state === "suspended") actx.resume();
      const t = actx.currentTime, g = actx.createGain(); g.connect(actx.destination);
      if (kind === "pop") {
        const o = actx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(880, t + 0.08);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g); o.start(t); o.stop(t + 0.2);
      } else {
        const o = actx.createOscillator(); o.type = "triangle"; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(110, t + 0.22);
        const n = actx.createBufferSource(), buf = actx.createBuffer(1, actx.sampleRate * 0.25, actx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) * 0.35;
        n.buffer = buf; const f = actx.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(1200, t); f.frequency.exponentialRampToValueAtTime(200, t + 0.25);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.45, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        o.connect(g); n.connect(f); f.connect(g); o.start(t); o.stop(t + 0.3); n.start(t);
      }
      return true;
    } catch (e) { return false; }
  };

  W.shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  W.pips = (level, max) => [1, 2, 3].map(i => '<i class="pip' + (i <= Math.min(level, W.TOP) ? " on" : "") + '"></i>').join("") + (level >= (max || W.DIAMOND) ? '<span class="dia">star</span>' : "");
})();
