/* Sound and music (owner: audio team).
   - W.sfx(kind) plays a short recorded sound from audio/sfx/; if the file is missing or cannot play, the old tone from
     common.js plays instead. Kinds the game calls today: "pop" (open, tap, right) and "squash" (close, not yet).
     New kinds other parts may call: "tap", "close", "page", "right", "stamp", "notyet", "diamond", "flip", "drum".
   - Calm music after the first tap: full in the walking view, quiet under a page (a level, the mailbox, school words:
     the tutor asked for it to keep playing there), quieter still while a word is being said, and silent at the door and
     while the microphone listens to him.
   - "Sound: on" / "Sound: off" in the menu (#menuList), kept on this device. Off: no effects, no tones, no music.
     Words and Orbit's lines still speak: they are part of the lesson, not decoration.
   - Orbit's recorded lines: window.WW_VOICE[key] (read by speakLine in 07-guide.js), fixed lines only. The menu item
     "Orbit's voice: recorded / device" (kept on this device) empties WW_VOICE so the device voice says every line. */
(function () {
  const W = window.WT; if (!W) return;
  const toneSfx = W.sfx;                      // the old tones from common.js
  const BASE = "audio/";
  // kind -> file. "pop" and "squash" keep the names the game already uses.
  const FILES = {
    pop: "sfx/pop.mp3", tap: "sfx/pop.mp3",
    squash: "sfx/close.mp3", close: "sfx/close.mp3",
    page: "sfx/page.mp3", right: "sfx/right.mp3", stamp: "sfx/stamp.mp3", notyet: "sfx/notyet.mp3",
    diamond: "sfx/diamond.mp3", flip: "sfx/flip.mp3", drum: "sfx/drum.mp3"
  };
  // the old tone to fall back to for each kind
  const TONE = { pop: "pop", tap: "pop", page: "pop", right: "pop", diamond: "pop", flip: "pop", drum: "pop",
                 squash: "squash", close: "squash", stamp: "squash", notyet: "squash" };
  const MUSIC = "music/outpost.mp3", MUSIC_PAD = 0.25;     // the loop sits between 0.25 s and (length - 0.25 s)
  const SFX_GAIN = 0.6, MUSIC_GAIN = 0.28, FADE = 1.0;
  const KEY = "ww.sound";

  // Orbit's recorded lines: fixed lines only. Lines with a word, a number or a name stay with the device voice.
  // Only lines whose recorded wording is still what the page shows. (sentence, test and wrong were reworded after the
  // recording, so their clips are not used.) VOICE_READY stays false until every fixed line is recorded in one voice:
  // until then the device voice says everything, and the menu has no voice item (one voice, not a mix of two).
  const VOICE = {}, VOICE_READY = false;
  ["meet", "listen", "stop"].forEach(k => { VOICE[k] = BASE + "voice/" + k + ".mp3"; });
  const VKEY = "ww.voice";
  let recorded = false;
  try { recorded = VOICE_READY && localStorage.getItem(VKEY) === "recorded"; } catch (e) {}
  // speakLine reads window.WW_VOICE at the moment it speaks, so emptying it hands every line to the device voice.
  const applyVoice = () => { window.WW_VOICE = recorded ? Object.assign({}, VOICE) : {}; };
  applyVoice();

  let on = true;
  try { on = localStorage.getItem(KEY) !== "off"; } catch (e) {}
  const log = [];                               // what was asked for, for checks: { kind, file, how }
  const note = (kind, file, how) => { log.push({ kind, file, how, t: Date.now() }); if (log.length > 200) log.shift(); };

  // ---- loading: fetch the bytes now (no audio context needed), decode after his first tap ----
  const bytes = {}, buffers = {}, missing = {};
  let ctx = null, master = null, unlocked = false;
  function fetchFile(file) {
    if (bytes[file] || missing[file]) return;
    bytes[file] = fetch(BASE + file).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .catch(() => { missing[file] = true; return null; });
  }
  function decode(file) {
    if (!ctx || buffers[file] || missing[file]) return Promise.resolve(buffers[file] || null);
    fetchFile(file);
    return bytes[file].then(ab => {
      if (!ab) return null;
      return new Promise(res => { try { ctx.decodeAudioData(ab.slice(0), b => { buffers[file] = b; res(b); }, () => { missing[file] = true; res(null); }); } catch (e) { missing[file] = true; res(null); } });
    });
  }
  try { if (window.fetch) Array.from(new Set(Object.values(FILES))).concat([MUSIC]).forEach(fetchFile); } catch (e) {}

  function unlock() {
    if (unlocked) return; unlocked = true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
      if (ctx.state === "suspended") ctx.resume();
      Array.from(new Set(Object.values(FILES))).forEach(decode);
    } catch (e) { ctx = null; }
    checkMusic();
  }
  ["pointerdown", "keydown", "touchstart"].forEach(ev => window.addEventListener(ev, unlock, { capture: true, passive: true }));

  // ---- effects ----
  function playEl(kind, file) {          // before the file is decoded: a plain audio element; on error, the old tone
    try {
      const a = new Audio(BASE + file); a.volume = SFX_GAIN;
      let fell = false; const fall = () => { if (fell) return; fell = true; missing[file] = true; note(kind, file, "tone"); toneSfx(TONE[kind] || "pop"); };
      a.onerror = fall; const p = a.play(); if (p && p.catch) p.catch(fall);
      return true;
    } catch (e) { return false; }
  }
  W.sfx = function (kind) {
    kind = String(kind || "pop");
    const file = FILES[kind];
    if (!on) { note(kind, file || "", "off"); return false; }
    if (!file || missing[file] || typeof Audio === "undefined" && !ctx) { note(kind, file || "", "tone"); return toneSfx(TONE[kind] || kind); }
    try {
      const b = buffers[file];
      if (ctx && b) {
        if (ctx.state === "suspended") ctx.resume();
        const s = ctx.createBufferSource(), g = ctx.createGain(); g.gain.value = SFX_GAIN;
        s.buffer = b; s.connect(g); g.connect(master); s.start();
        note(kind, file, "file"); return true;
      }
      if (ctx) decode(file);
      note(kind, file, "file"); return playEl(kind, file) || toneSfx(TONE[kind] || "pop");
    } catch (e) { note(kind, file, "tone"); return toneSfx(TONE[kind] || "pop"); }
  };

  // ---- music: full in the walking view, quiet under a page, quieter while a word is said ----
  const MUSIC_PAGE = 0.11, MUSIC_WORD = 0.04;
  let mSrc = null, mGain = null, mWant = false, mStarting = false, mTarget = 0;
  const STAGES = ["gate", "questpage", "panel", "buildpage", "modal", "full"];
  function shown(n) { if (!n || n.hidden) return false; const cs = getComputedStyle(n); return cs.display !== "none" && cs.visibility !== "hidden"; }
  function walking() {
    const ww = document.getElementById("worldwrap"); if (!ww || !shown(ww)) return false;
    if (document.hidden) return false;
    return !STAGES.some(id => shown(document.getElementById(id)));
  }
  // How loud the music should be now; 0 = none.
  function musicLevel() {
    if (!on || !unlocked || !ctx || document.hidden) return 0;
    if (shown(document.getElementById("gate"))) return 0;          // the door: quiet
    if (W.micOn) return 0;                                          // the microphone is listening to him
    const ww = document.getElementById("worldwrap"), page = STAGES.some(id => shown(document.getElementById(id)));
    if (!page && !(ww && shown(ww))) return 0;
    const base = page ? MUSIC_PAGE : MUSIC_GAIN;
    return W.wordBusy && W.wordBusy() ? Math.min(base, MUSIC_WORD) : base;
  }
  function musicTo(v, secs) {
    if (!mGain || Math.abs(v - mTarget) < 0.001) return;
    mTarget = v;
    try { const t = ctx.currentTime; mGain.gain.cancelScheduledValues(t); mGain.gain.setValueAtTime(Math.max(0.0001, mGain.gain.value), t); mGain.gain.linearRampToValueAtTime(Math.max(0.0001, v), t + secs); } catch (e) {}
  }
  function musicStart() {
    if (mSrc || mStarting || !ctx) return; mStarting = true;
    decode(MUSIC).then(b => {
      mStarting = false;
      if (!b || mSrc || !mWant) return;
      if (ctx.state === "suspended") ctx.resume();
      const s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = b; s.loop = true; s.loopStart = MUSIC_PAD; s.loopEnd = Math.max(MUSIC_PAD + 1, b.duration - MUSIC_PAD);
      mTarget = musicLevel() || MUSIC_PAGE;
      const t = ctx.currentTime; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(mTarget, t + FADE);
      s.connect(g); g.connect(master); s.start(t, MUSIC_PAD);
      mSrc = s; mGain = g; note("music", MUSIC, "start");
    });
  }
  function musicStop() {
    if (!mSrc) return;
    const s = mSrc, g = mGain; mSrc = mGain = null;
    try { const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + FADE); s.stop(t + FADE + 0.05); } catch (e) { try { s.stop(); } catch (x) {} }
    note("music", MUSIC, "stop");
  }
  function checkMusic() {
    const v = musicLevel();
    mWant = v > 0;
    if (!mWant) return musicStop();
    musicStart(); musicTo(v, v < mTarget ? 0.25 : 0.7);            // down quickly, back up gently
  }
  // a word begins: the music steps back at once, so the word is clear (it comes back by itself, see checkMusic)
  try { if (W.onWord) W.onWord(() => { if (mSrc) musicTo(Math.min(mTarget, MUSIC_WORD), 0.08); }); } catch (e) {}
  setInterval(checkMusic, 250);
  document.addEventListener("visibilitychange", checkMusic);

  // ---- the menu item ----
  const label = () => "Sound: " + (on ? "on" : "off");
  function setOn(v) {
    on = !!v;
    try { localStorage.setItem(KEY, on ? "on" : "off"); } catch (e) {}
    paint();
    checkMusic();
    try { if (typeof window.logEvent === "function") window.logEvent("sound", { on }); } catch (e) {}
  }
  const vLabel = () => "Orbit's voice: " + (recorded ? "recorded" : "device");
  function setVoice(v) {
    recorded = !!v && VOICE_READY;
    try { localStorage.setItem(VKEY, recorded ? "recorded" : "device"); } catch (e) {}
    applyVoice();
    paint();
    try { if (typeof window.logEvent === "function") window.logEvent("voice", { recorded }); } catch (e) {}
  }
  function addMenuItem() {
    const list = document.getElementById("menuList"); if (!list) return;
    if (!document.getElementById("auSound")) {
      const b = document.createElement("button"); b.type = "button"; b.id = "auSound"; b.className = "au-sound";
      b.addEventListener("click", () => setOn(!on));
      list.appendChild(b);
    }
    if (VOICE_READY && !document.getElementById("auVoice")) {
      const v = document.createElement("button"); v.type = "button"; v.id = "auVoice"; v.className = "au-voice";
      v.addEventListener("click", () => setVoice(!recorded));
      document.getElementById("auSound").insertAdjacentElement("afterend", v);
    }
    paint();
  }
  // The core zh.js leaves menu buttons alone (.menulist button is in its skip list), so these two carry their own
  // Chinese line, shown while the 中文 button is on (html.zh-on).
  const ZHL = { "Sound: on": "声音：开", "Sound: off": "声音：关", "Orbit's voice: recorded": "Orbit 的声音：录音", "Orbit's voice: device": "Orbit 的声音：本机朗读" };
  function paintOne(id, en, pressed) {
    const b = document.getElementById(id); if (!b) return;
    b.textContent = en; b.setAttribute("aria-pressed", String(pressed));
    if (document.documentElement.classList.contains("zh-on") && ZHL[en]) { const s = document.createElement("span"); s.className = "zhx"; s.lang = "zh-Hans"; s.textContent = ZHL[en]; b.appendChild(s); }
  }
  function paint() { paintOne("auSound", label(), on); paintOne("auVoice", vLabel(), recorded); }
  try { new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] }); } catch (e) {}
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addMenuItem); else addMenuItem();
  document.addEventListener("toggle", e => { if (e.target && e.target.id === "menu") addMenuItem(); }, true);
  try { if (window.WT_ZH) window.WT_ZH.add(ZHL); } catch (e) {}

  window.WW_AUDIO = { log, files: FILES, isOn: () => on, setOn, playing: () => !!mSrc, musicLevel: () => (mSrc ? mTarget : 0), unlocked: () => unlocked,
    voice: VOICE, isRecorded: () => recorded, setVoice };
})();
