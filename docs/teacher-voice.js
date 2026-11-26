/* His voice recordings on the tutor's page (25 November; the tutor: "yes save it so that I can replay how he speaks in my
   teacher dashboard"). The game records him only while he says a new word in the mailbox (src/js/11-voice-rec.js); each
   recording is a file in the private storage bucket "voice" and one row in voice_clips (deploy/voice-clips.sql).

   window.WW_TEACHER_VOICE.fill(container, { sb, student, day, W }) is called by the day view (site/teacher-day.js) each
   time it draws. It fills every empty [data-voice-word] place of that day with one round play button per recording of
   that word (the time it was made, and a small "Delete" with a confirmation built into the page), and keeps one fold
   under the day view: how many are stored in all, "Delete all", and the line about who can listen.

   Listening: a signed link that lives 60 seconds is asked for only when she taps play; never a public link.
   Files AND rows are counted (review finding 3): the page lists his folder, so a file that never got a row (an upload
   whose row failed) is counted, shown in the fold as "A recording without its details" with the day from its name and
   its own Delete, and "Delete all" shows when there is a file or a row.
   Deleting: the file first, then its row. remove() says no error even when it deleted nothing, so the file counts as
   gone only when remove() names it, or his folder is listed and it is not there. Only then is the row deleted, with
   .select("id") to see that it really went (a delete that row level security filters out says no error either). When
   one of the two did not happen she is told plainly; a second "Delete" finishes (a file already gone is not an error).
   The practice copy (the stand-in database) records nothing: the fold says so and there are no buttons. */
(function () {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const key = s => String(s || "").trim().toLowerCase();
  const clock = iso => { const d = new Date(iso); if (isNaN(d)) return ""; const h = d.getHours(); return ((h % 12) || 12) + ":" + String(d.getMinutes()).padStart(2, "0") + " " + (h < 12 ? "am" : "pm"); };   // as the day view writes times
  const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>';
  const STOP = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg>';
  const LINK_SECONDS = 60, BUCKET = "voice";   // the private storage bucket (a name, not a table)
  let audio = null, playingId = null, ctxNow = null, busy = false;

  // the bucket ("from.call" so that deploy/check_schema.py does not read the bucket name as a table)
  const bucket = sb => sb.storage.from.call(sb.storage, BUCKET);
  const isPractice = () => !!window.WW_DEMO;
  function dayBounds(day, W) {
    const add = W && W.addDays ? W.addDays(day, 1) : new Date(new Date(day + "T00:00:00").getTime() + 864e5).toISOString().slice(0, 10);
    return [new Date(day + "T00:00:00").toISOString(), new Date(add + "T00:00:00").toISOString()];
  }
  function stopAudio() {
    if (audio) { try { audio.pause(); } catch (e) {} }
    audio = null;
    if (playingId && ctxNow && ctxNow.container) ctxNow.container.querySelectorAll('.tvr-play[data-id="' + playingId + '"]').forEach(b => { b.classList.remove("on"); b.innerHTML = PLAY; b.setAttribute("aria-label", b.dataset.label); });
    playingId = null;
  }

  function foldEl(container) {
    let f = container.querySelector(":scope > .tvr-fold");
    if (!f) {
      f = document.createElement("details"); f.className = "tvr-fold";
      f.innerHTML = '<summary><span class="tvr-ft">His voice recordings</span><span class="tvr-fs"></span></summary><div class="tvr-fb"></div>';
      container.appendChild(f);
    }
    return f;
  }
  function slotHtml(rows) {
    return rows.map(r => {
      const t = clock(r.created_at), label = "Play his voice, " + t;
      return '<span class="tvr-clip" data-id="' + esc(r.id) + '"><button type="button" class="tvr-play" data-id="' + esc(r.id) + '" data-label="' + esc(label) + '" aria-label="' + esc(label) + '">' + PLAY + "</button>" +
        '<span class="tvr-time">' + esc(t) + (r.seconds ? ' <small>' + esc(Number(r.seconds).toFixed(1)) + " s</small>" : "") + "</span>" +
        '<button type="button" class="tvr-del" data-id="' + esc(r.id) + '">Delete</button></span>';
    }).join("");
  }
  // a question built into the page (window.confirm does not work everywhere this page runs)
  function ask(where, text, yes, onYes) {
    const old = where.querySelector(":scope > .tvr-ask"); if (old) old.remove();
    const p = document.createElement("div"); p.className = "tvr-ask"; p.setAttribute("role", "alertdialog");
    p.innerHTML = '<span class="tvr-q">' + esc(text) + '</span><button type="button" class="tvr-yes">' + esc(yes) + '</button><button type="button" class="tvr-no">Keep</button>';
    p.querySelector(".tvr-yes").onclick = () => { p.remove(); onYes(); };
    p.querySelector(".tvr-no").onclick = () => p.remove();
    where.appendChild(p);
    p.querySelector(".tvr-no").focus && p.querySelector(".tvr-no").focus();
  }
  function say(where, text) {
    let n = where.querySelector(":scope > .tvr-msg");
    if (!n) { n = document.createElement("p"); n.className = "tvr-msg"; n.setAttribute("role", "status"); where.appendChild(n); }
    n.textContent = text || ""; n.hidden = !text;
  }

  async function play(btn, row) {
    const id = row.id, was = playingId;
    stopAudio();
    if (was === id) return;                                   // a second tap stops it
    const sb = ctxNow.sb;
    let url = "";
    try {
      const r = await bucket(sb).createSignedUrl(row.path, LINK_SECONDS);
      url = r && !r.error && r.data && (r.data.signedUrl || r.data.signedURL) || "";
    } catch (e) { url = ""; }
    const slot = btn.closest(".tvr-voice, [data-voice-word]") || btn.parentNode;
    if (!url) return say(slot, "Could not get this recording. It may be deleted. Try again.");
    say(slot, "");
    try {
      const a = new Audio(url); audio = a; playingId = id;
      btn.classList.add("on"); btn.innerHTML = STOP; btn.setAttribute("aria-label", "Stop");
      a.onended = () => { if (audio === a) stopAudio(); };
      a.onerror = () => { if (audio === a) { stopAudio(); say(slot, "Could not play this recording."); } };
      const p = a.play(); if (p && p.catch) p.catch(() => { if (audio === a) { stopAudio(); say(slot, "Could not play this recording."); } });
    } catch (e) { stopAudio(); say(slot, "Could not play this recording."); }
  }

  // ---- his folder: every file, also those that never got a row. <id>/<day>/<file>. Cached for 2 minutes (the day view
  // redraws every 30 s); a delete clears the cache. Returns { ok, paths } (ok false: the folder could not be listed).
  const LIST_MS = 120000;
  let listCache = null;   // { sid, at, paths }
  async function listFiles(sb, sid, fresh) {
    if (!fresh && listCache && listCache.sid === sid && Date.now() - listCache.at < LIST_MS) return { ok: true, paths: listCache.paths.slice() };
    const st = bucket(sb), paths = [];
    const real = d => d && d.name && d.name.charAt(0) !== ".";            // not Supabase's ".emptyFolderPlaceholder"
    try {
      const top = await st.list(sid, { limit: 1000 });
      if (!top || top.error) return { ok: false, paths: [] };
      for (const d of top.data || []) {
        if (!real(d)) continue;
        if (d.id) { paths.push(sid + "/" + d.name); continue; }
        const inner = await st.list(sid + "/" + d.name, { limit: 1000 });
        if (!inner || inner.error) return { ok: false, paths: [] };
        (inner.data || []).forEach(f => { if (real(f) && f.id !== null) paths.push(sid + "/" + d.name + "/" + f.name); });
      }
    } catch (e) { return { ok: false, paths: [] }; }
    listCache = { sid, at: Date.now(), paths: paths.slice() };
    return { ok: true, paths };
  }
  // Is the file really gone? remove() answers with no error even when it deleted nothing (another login, an expired one),
  // so: gone = remove() named it, or the folder can be listed and it is not there (it was already gone).
  async function filesGone(sb, paths) {
    const st = bucket(sb), named = new Set();
    for (let i = 0; i < paths.length; i += 100) {
      try { const f = await st.remove(paths.slice(i, i + 100)); if (f && !f.error) (f.data || []).forEach(o => { if (o && o.name) named.add(o.name); }); } catch (e) {}
    }
    const left = paths.filter(p => !named.has(p) && !named.has(p.split("/").pop()));
    if (!left.length) return new Set(paths);
    const gone = new Set(paths.filter(p => !left.includes(p)));
    const byDir = {};
    left.forEach(p => { const i = p.lastIndexOf("/"); (byDir[p.slice(0, i)] = byDir[p.slice(0, i)] || []).push(p); });
    for (const dir of Object.keys(byDir)) {
      try {
        const r = await st.list(dir, { limit: 1000 });
        if (!r || r.error) continue;                                       // cannot tell: counted as not gone
        const there = new Set((r.data || []).map(f => dir + "/" + f.name));
        byDir[dir].forEach(p => { if (!there.has(p)) gone.add(p); });
      } catch (e) {}
    }
    return gone;
  }
  // Delete rows by id and count what really went (a delete that row level security filters out says no error).
  async function rowsGone(sb, ids) {
    let n = 0;
    for (let i = 0; i < ids.length; i += 100) {
      try { const r = await sb.from("voice_clips").delete().in("id", ids.slice(i, i + 100)).select("id"); if (r && !r.error) n += (r.data || []).length; } catch (e) {}
    }
    return n;
  }
  const MSG_FILE = "Could not delete the sound. Nothing was deleted. Try again.";
  const MSG_ROW = "The sound is deleted, but its details are not. Tap Delete again.";
  // one recording: the file first, then (only when the file is really gone) the row; returns "" or what went wrong
  async function removeOne(row) {
    const sb = ctxNow.sb; listCache = null;
    const gone = await filesGone(sb, [row.path]);
    if (!gone.has(row.path)) return MSG_FILE;
    if (!row.id) return "";                                                // a file without its details: nothing more
    return (await rowsGone(sb, [row.id])) === 1 ? "" : MSG_ROW;
  }
  // everything of his: every file in his folder (also those without a row) and every row
  async function removeAll(sid, rows) {
    const sb = ctxNow.sb; listCache = null;
    const l = await listFiles(sb, sid, true);
    if (!l.ok) return "Could not look in his folder. Nothing was deleted. Try again.";
    const paths = Array.from(new Set(l.paths.concat(rows.map(r => r.path))));
    const gone = await filesGone(sb, paths);
    const notGone = paths.filter(p => !gone.has(p)).length;
    const ids = rows.filter(r => gone.has(r.path)).map(r => r.id);       // a row goes only when its file is really gone
    const rowsLeft = rows.length - (ids.length ? await rowsGone(sb, ids) : 0);
    listCache = null;
    if (notGone) return "Could not delete " + (notGone === 1 ? "1 sound" : notGone + " sounds") + ". Tap Delete all again.";
    if (rowsLeft) return "The sounds are deleted, but " + (rowsLeft === 1 ? "1 detail line is" : rowsLeft + " detail lines are") + " not. Tap Delete all again.";
    return "";
  }
  // "2026-11-25" -> "Wed 25 Nov 2026"
  const dayText = d => { const t = new Date(d + "T12:00:00"); if (!/^\d{4}-\d\d-\d\d$/.test(d) || isNaN(t)) return ""; return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][t.getDay()] + " " + t.getDate() + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][t.getMonth()] + " " + t.getFullYear(); };

  async function fill(container, ctx) {
    if (!container || !ctx || !ctx.student || typeof document === "undefined") return;
    ctxNow = Object.assign({}, ctx, { container });
    const fold = foldEl(container), fb = fold.querySelector(".tvr-fb"), fs = fold.querySelector(".tvr-fs");
    if (isPractice() || !ctx.sb || !ctx.sb.storage) {
      fs.textContent = "";
      if (fb.dataset.sig !== "practice") { fb.innerHTML = '<p class="tvr-line">Voice recordings exist on the real website only.</p>'; fb.dataset.sig = "practice"; }
      return;
    }
    if (busy) return;
    const sb = ctx.sb, sid = ctx.student.id, day = ctx.day || (ctx.W && ctx.W.today && ctx.W.today());
    const [from, to] = dayBounds(day, ctx.W);
    let dayRows = [], allRows = [], err = null, files = { ok: false, paths: [] };
    try {
      const [a, b, l] = await Promise.all([
        sb.from("voice_clips").select("id,word,path,mime,seconds,level,created_at").eq("student_id", sid).gte("created_at", from).lt("created_at", to).order("created_at"),
        sb.from("voice_clips").select("id,path").eq("student_id", sid),
        listFiles(sb, sid)
      ]);
      err = a.error || b.error; dayRows = a.data || []; allRows = b.data || []; files = l;
    } catch (e) { err = e; }
    if (!container.isConnected) return;
    // the places the day view left, one per new word
    container.querySelectorAll("[data-voice-word]").forEach(slot => {
      const mine = dayRows.filter(r => key(r.word) === key(slot.dataset.voiceWord));
      const sig = err ? "err" : mine.map(r => r.id).join(",");
      if ("vsig" in slot.dataset && slot.dataset.vsig === sig) return;
      if (playingId && mine.some(r => r.id === playingId)) return;   // do not cut a recording she is listening to
      slot.dataset.vsig = sig;
      slot.innerHTML = mine.length ? '<span class="tvr-h">His voice</span>' + slotHtml(mine) : "";
      slot.querySelectorAll(".tvr-play").forEach(b => { const r = mine.find(x => x.id === b.dataset.id); b.onclick = () => play(b, r); });
      slot.querySelectorAll(".tvr-del").forEach(b => {
        const r = mine.find(x => x.id === b.dataset.id);
        b.onclick = () => ask(slot, "Delete this recording?", "Yes, delete", async () => {
          if (playingId === r.id) stopAudio();
          busy = true; const m = await removeOne(r); busy = false;
          delete slot.dataset.vsig; fb.dataset.sig = ""; await fill(container, ctx); say(slot, m);
        });
      });
    });
    // the fold under the day view: rows AND files are counted; a file with no row is shown on its own
    const rowPaths = new Set(allRows.map(r => r.path));
    const orphans = files.paths.filter(p => !rowPaths.has(p)).sort();
    const n = allRows.length + orphans.length, nf = files.paths.length;
    const on = ctx.student.voice_rec !== false;   // her switch (students.voice_rec; a missing value is on)
    fs.textContent = (err ? "" : n === 1 ? "1 stored" : n + " stored") + (on ? "" : (err ? "" : " · ") + "saving is off");
    const sig = (err ? "err" : "n" + n + "f" + nf + (files.ok ? "" : "x") + ":" + orphans.join(",")) + (on ? "|on" : "|off");
    if (fb.dataset.sig === sig) return;
    fb.dataset.sig = sig;
    const orphanHtml = orphans.map((p, i) => {
      const d = dayText(p.split("/")[1] || ""), label = "Play a recording without its details" + (d ? ", " + d : "");
      return '<span class="tvr-clip tvr-orph"><button type="button" class="tvr-play" data-id="orph-' + i + '" data-label="' + esc(label) + '" aria-label="' + esc(label) + '">' + PLAY + "</button>" +
        '<span class="tvr-time">A recording without its details' + (d ? " <small>" + esc(d) + "</small>" : "") + "</span>" +
        '<button type="button" class="tvr-del" data-i="' + i + '">Delete</button></span>';
    }).join("");
    fb.innerHTML = '<p class="tvr-line tvr-swl"><b>Saving his voice is ' + (on ? "on" : "off") + '.</b> <button type="button" class="tvr-sw" aria-pressed="' + (on ? "true" : "false") + '">' + (on ? "Turn off" : "Turn on") + "</button></p>" +
      '<p class="tvr-line tvr-small">' + (on ? "The game records him only while he says a new word in the mailbox." : "The game does not record him. What is stored stays until you delete it.") + " A change counts from his next login.</p>" +
      (err ? '<p class="tvr-line">Could not load the recordings. The page tries again by itself.</p>'
      : '<p class="tvr-line">' + (n ? (n === 1 ? "1 recording is" : n + " recordings are") + " stored in all." : "No recordings are stored.") + "</p>") +
      (!files.ok ? '<p class="tvr-line tvr-small">Could not look in his folder just now, so recordings without their details may be missing here.</p>' : "") +
      '<p class="tvr-line tvr-small">Only this login can listen. A recording stays until you delete it.</p>' +
      (orphanHtml ? '<div class="tvr-orphs">' + orphanHtml + "</div>" : "") +
      ((allRows.length || nf) ? '<button type="button" class="tvr-delall">Delete all</button>' : "");
    fb.querySelectorAll(".tvr-orph").forEach((el, i) => {
      const r = { id: null, oid: "orph-" + i, path: orphans[i] };
      el.querySelector(".tvr-play").onclick = function () { play(this, Object.assign({}, r, { id: r.oid })); };
      el.querySelector(".tvr-del").onclick = () => ask(fb, "Delete this recording without its details?", "Yes, delete", async () => {
        stopAudio();
        busy = true; const m = await removeOne(r); busy = false;
        fb.dataset.sig = ""; await fill(container, ctx); say(fb, m);
      });
    });
    const sw = fb.querySelector(".tvr-sw");
    if (sw) sw.onclick = async () => {
      sw.disabled = true;
      let bad = null;
      try { const r = await sb.from("students").update({ voice_rec: !on }).eq("id", sid); bad = r && r.error; } catch (e) { bad = e; }
      if (!bad) ctx.student.voice_rec = !on;
      fb.dataset.sig = ""; await fill(container, ctx);
      say(fb, bad ? "Could not save that. Check the internet and tap again." : (!on ? "Saving his voice is on again, from his next login." : "Saving his voice is off, from his next login."));
    };
    const da = fb.querySelector(".tvr-delall");
    if (da) da.onclick = () => ask(fb, "Delete all " + (n === 1 ? "1 recording" : n + " recordings") + "? This cannot be undone.", "Yes, delete all", async () => {
      stopAudio();
      busy = true; const m = await removeAll(sid, allRows); busy = false;
      container.querySelectorAll("[data-voice-word]").forEach(s => { delete s.dataset.vsig; });
      fb.dataset.sig = ""; await fill(container, ctx); say(fb, m);
    });
  }
  window.WW_TEACHER_VOICE = { fill, stop: stopAudio, _linkSeconds: LINK_SECONDS };
})();
