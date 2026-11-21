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
  const noVoice = () => { try { return !("speechSynthesis" in window) || speechSynthesis.getVoices().length === 0; } catch (e) { return true; } };
  // The device voice the tutor chose (students.voice_name, students.voice_rate); the game sets W.voicePrefs after sign-in.
  // W.voice() -> { voice, rate }: the chosen voice when this device has it, else a British voice, else any English one (or
  // null); rate is a factor on the rates used today (0.85 for "slower"). W.utter(text, rate) makes an utterance with both.
  W.voicePrefs = { name: "", rate: "normal" };
  W.voice = function () {
    let vs = []; try { vs = ("speechSynthesis" in window && speechSynthesis.getVoices()) || []; } catch (e) {}
    const p = W.voicePrefs || {}, chosen = p.name ? vs.find(v => v.name === p.name) : null;
    const v = chosen || vs.find(v => /^en(-|_)GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
    return { voice: v, rate: p.rate === "slower" ? 0.85 : 1, chosen: !!chosen };
  };
  W.utter = function (text, rate) {
    const c = W.voice(), u = new SpeechSynthesisUtterance(text);
    u.lang = (c.voice && c.voice.lang) || "en-GB"; u.rate = (rate || 1) * c.rate; if (c.voice) u.voice = c.voice;
    return u;
  };
  // ---- one voice, the word first ----------------------------------------------------------------------------------
  // Everything spoken shares one voice: a word he must hear (W.speak, W.speakChunks, the school words) and Orbit's line.
  // On claude.ai that voice is the page reader: a new speak() replaces the one speaking, stop() silences whatever it is
  // saying, and it refuses ("busy") while the page's dictation listens. Three rules keep a word from being lost:
  //   1. a word starts at once and is never cut by a line: Orbit asks W.afterWord(fn) and speaks when the word is over;
  //   2. when a word starts, whoever was talking is told first (W.onWord), so a recorded line never plays over it;
  //   3. "busy" is not the end: W.read asks again for a few seconds and switches off a microphone nobody is waiting
  //      for (W.micOn is true only while the mailbox listens to him).
  let wordId = 0, wordOn = 0, wordT = 0, wordUtter = null, readSeq = 0;
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
        try { p = rate ? reader.speak(String(text), { rate }) : reader.speak(String(text)); } catch (e) { return res(false); }
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
  // o.slow: for words he has no picture or sentence for (the school list): clearly slower, not dragged out.
  W.speak = function (word, o) {
    const slow = !!(o && o.slow);
    try {
      const f = W.voice().rate, text = W.key(word);
      if (reader && noVoice()) {
        const id = W.wordBegin(9000);
        W.read(text, { rate: (slow ? 0.75 : 0.88) * f }).then(() => W.wordEnd(id));
        return true;
      }
      if (!("speechSynthesis" in window)) return false;
      const id = W.wordBegin(1200 + 300 * text.length);
      speechSynthesis.cancel();
      const u = W.utter(text, slow ? 0.62 : 0.8);
      u.onend = u.onerror = () => W.wordEnd(id); wordUtter = u;   // kept, so the browser does not drop its end event
      speechSynthesis.speak(u); return true;
    } catch (e) { return false; }
  };
  try { if ("speechSynthesis" in window) speechSynthesis.getVoices(); } catch (e) {}
  // Say the chunks one by one, slowly, so he hears the beats.
  W.speakChunks = function (chunks) {
    try {
      const f = W.voice().rate, parts = W.cleanChunks(chunks).split("-").filter(Boolean);
      if (reader && noVoice()) {
        const id = W.wordBegin(12000);
        W.read(parts.join(". ") + ".", { rate: f }).then(() => W.wordEnd(id));
        return true;
      }
      if (!("speechSynthesis" in window)) return false;
      const id = W.wordBegin(1500 + 900 * parts.length);
      speechSynthesis.cancel();
      parts.forEach((p, i) => { const u = W.utter(p, 0.6); if (i === parts.length - 1) { u.onend = u.onerror = () => W.wordEnd(id); wordUtter = u; } speechSynthesis.speak(u); });
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
