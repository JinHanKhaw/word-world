/* Word World: the tutor's page. Owner: dash team.
   Goes through the same client calls as the game (W.client(): Supabase, or the stand-in database in this browser).
   Never a word about the child: the page says what happened ("not yet right", "double letters written once").
   Plain words for a tutor who is not technical: Today (did he play, his new words, the words to practise), This week, Words,
   School spelling list, Letters, For his mother, and Settings (the technical parts, each with one plain sentence). */
(function () {
  const W = window.WT, $ = id => document.getElementById(id), view = $("view");
  const sb = W.client("teacher");   // her sign-in is kept in this tab only (common.js W.client)
  const DEMO = !!window.WW_DEMO;
  let me = null, student = null, words = [], sessions = [], quests = [], messages = [], school = [], tests = [], tab = "today";
  const openFolds = {};   // the folded parts she opened stay open when the tab is drawn again

  // ---------- small helpers ----------
  const esc = W.esc;
  const IC = {
    check: '<path d="M5 12.8l4.4 4.4L19 7.4"/>', x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    mail: '<path d="M3.5 6.5h17v11h-17z"/><path d="M3.8 7l8.2 6.4L20.2 7"/>', pencil: '<path d="M4 20l1.2-4.8L16.4 4l3.6 3.6L8.8 18.8z"/><path d="M14 6.4l3.6 3.6"/>',
    trash: '<path d="M5 7h14M9.5 7V5h5v2M7 7l1 12.5h8L17 7"/>', calendar: '<path d="M4.5 6.5h15v13h-15z"/><path d="M4.5 10.5h15M8.5 4.5v4M15.5 4.5v4"/>',
    arrow: '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>', book: '<path d="M4 5.5c2.5-1 5.5-1 8 .5v13c-2.5-1.5-5.5-1.5-8-.5z"/><path d="M20 5.5c-2.5-1-5.5-1-8 .5v13c2.5-1.5 5.5-1.5 8-.5z"/>',
    copy: '<path d="M8.5 8.5h11v11h-11z"/><path d="M15.5 8.5v-4h-11v11h4"/>', turn: '<path d="M4.5 11a7.5 7.5 0 0 1 13.2-4"/><path d="M18 3.2V7h-3.8"/><path d="M19.5 13a7.5 7.5 0 0 1-13.2 4"/><path d="M6 20.8V17h3.8"/>',
    gem: '<path d="M7 4.5h10l4 5-9 10.5L3 9.5z"/><path d="M3 9.5h18"/>', star: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>'
  };
  const ICON = n => '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + (IC[n] || "") + "</svg>";
  const ld = iso => !iso ? "" : String(iso).length <= 10 ? String(iso) : W.dkey(new Date(iso));   // a plain day stays as it is
  const many = (n, one, more) => n + " " + (n === 1 ? one : (more || one + "s"));
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const day3 = k => W.niceDate(k);
  const rel = k => k === W.today() ? "today" : k === W.addDays(W.today(), -1) ? "yesterday" : W.niceDate(k);
  const banner = m => { $("banner").hidden = !m; $("banner").textContent = m || ""; };
  const PICS = window.WW_PICS || {};
  const picSrc = w => w.picture || (PICS[W.plain(w.word)] ? "img/words/" + W.plain(w.word) + ".jpg" : "");
  const picHtml = w => { const s = picSrc(w); return '<span class="pic' + (s ? "" : " none") + '">' + (s ? '<img src="' + esc(s) + '" alt="" loading="lazy">' : "") + "</span>"; };
  // A word as the tutor typed it: capitals and apostrophes kept, curly apostrophes made straight, spaces trimmed.
  const asTyped = s => String(s || "").replace(/[‘’`´]/g, "'").replace(/\s+/g, " ").trim();
  const wordOk = s => /^[A-Za-z][A-Za-z' -]*$/.test(s) && /[A-Za-z]$/.test(s);
  const cleanBeats = c => String(c || "").replace(/[‘’`´]/g, "'").replace(/[^A-Za-z'-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");

  // ---------- the level rules, the same as the game ----------
  const LEVELS = 50, PER_ZONE = 10, ZONE_NAMES = ["Sunny Island", "Jungle", "Under the Sea", "Ice Cave", "Sky Castle"];
  const zoneName = d => ZONE_NAMES[Math.min(ZONE_NAMES.length - 1, Math.floor((d - 1) / PER_ZONE))];
  const isTest = d => d % PER_ZONE === 0;
  const levelQuests = () => quests.filter(x => x.quest_day != null);   // school drills are quests rows too, with no level
  const questRow = d => quests.find(x => x.quest_day === d) || null;
  const dayDone = d => { const r = questRow(d); return !!(r && r.completed); };
  const doneOn = d => { const r = questRow(d); return r && r.finished_at ? ld(r.finished_at) : null; };
  const maxDay = () => Math.max(LEVELS, words.reduce((m, w) => Math.max(m, w.quest_day || 0), 0));
  const levelWords = d => words.filter(w => w.quest_day === d && w.approved);
  function dayState(d) {
    if (dayDone(d)) return "done";
    if (d === 1 ? (student.start_date || W.today()) > W.today() : !(dayDone(d - 1) && doneOn(d - 1) < W.today())) return "locked";
    if (student.pause_new && !questRow(d)) return "paused";   // "No new words for now": the game does not open it
    return levelWords(d).length || isTest(d) ? "open" : "empty";   // the island test opens without new words
  }
  function openDay() { for (let d = 1; d <= maxDay(); d++) if (dayState(d) === "open") return d; return null; }
  const buildObj = () => { const b = student.build; if (Array.isArray(b)) return { cells: b, bought: { brick: b.length } }; return { cells: b && Array.isArray(b.cells) ? b.cells : [], cells3: b && Array.isArray(b.cells3) ? b.cells3 : [], bought: b && b.bought ? b.bought : {} }; };
  const PRICES = { brick: 1, door: 3, window: 2, flower: 2, tree: 4, torch: 3, flag: 5, fence: 2, roof: 3, steps: 3, lantern: 3, chest: 4, bed: 4, table: 3, well: 5, bridge: 4, signpost: 2, trophy: 4, banner: 5, fountain: 6, windmill: 7, orbitstatue: 8 }   // the last five: the prizes after each island test (20-build-data.js PRIZES);
  const diamondsEarned = () => quests.reduce((a, x) => a + (x.diamonds_earned || 0), 0);
  // The same rule as the game (20-build-data.js spentOn): bought.brick counts bricks, and every started pack of 10 cost 1 diamond.
  const BRICKS_PER_DIAMOND = 10;
  const spentOn = (k, n) => k === "brick" ? Math.ceil((n || 0) / BRICKS_PER_DIAMOND) * PRICES.brick : (n || 0) * (PRICES[k] || 0);
  const diamondsSpent = () => { const b = buildObj().bought; return Object.keys(b).reduce((a, k) => a + spentOn(k, b[k]), 0); };
  // The picture of his island the game saves when he leaves Build (students.build_picture, a JPEG data URL).
  const islandPic = () => { const p = student && student.build_picture; return typeof p === "string" && p.indexOf("data:image/jpeg") === 0 ? { src: p, at: student.build_picture_at || null } : null; };
  // The memory ladder (common.js): back after 1, 4 and 14 days, then star word. Levels 4 and 5 are only in a save from the
  // old five-step ladder that the game has not opened since; loadAll shows them as the game will move them (W.fromOldLadder).
  const ladder = { 0: "not met yet", 1: "comes back after 1 day", 2: "comes back after 4 days", 3: "comes back after 14 days", 6: "knows it well" };
  const canSpell = () => words.filter(w => w.level >= 2);   // right again on a later day: "words he can spell from memory"
  const knowsWell = () => words.filter(w => w.level >= W.DIAMOND);   // right after 1, 4 and 14 days: "words he knows well"

  // ---------- auth ----------
  function renderLogin(msg) {
    $("topbar").hidden = true; $("topacts").hidden = true;
    view.innerHTML = '<section class="box narrow"><h2>Log in</h2><form id="lf" class="stack">' +
      '<label class="f">Email<input type="email" id="em" autocomplete="username"></label>' +
      '<label class="f">Password<input type="password" id="pw" autocomplete="current-password"></label>' +
      '<div class="row"><button type="submit">Log in</button></div><p class="err" id="lerr">' + esc(msg || "") + "</p></form></section>";
    $("lf").onsubmit = async e => {
      e.preventDefault();
      const { error } = await sb.auth.signInWithPassword({ email: $("em").value.trim(), password: $("pw").value });
      if (error) { $("lerr").textContent = error.message; return; }
      boot();
    };
  }
  async function boot() {
    if (!sb) { view.innerHTML = '<section class="box"><h2>Not ready yet</h2><p class="lead">This page is not set up yet. Ask the person who made the website to finish it (they will find the steps in deploy/README.md).</p></section>'; return; }
    if (DEMO) {
      // The stand-in database keeps everything in this browser; there is no login to check.
      me = { id: "teacher-demo", email: "" }; $("who").textContent = "Saved in this browser only"; $("logout").hidden = true;
    } else {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return renderLogin();   // the game's sign-in never reaches this client (26 November): only hers
      me = session.user;
      $("who").textContent = me.email;
      const { data: prof } = await sb.from("profiles").select("*").eq("id", me.id).maybeSingle();
      if (!prof) {
        view.innerHTML = '<section class="box narrow"><h2>One more thing</h2><p class="lead">This account is not set up as the teacher yet. Press the button once. Only the first person to log in can do this.</p><div class="row"><button type="button" id="mk">Make me the teacher</button><button type="button" class="ghost" id="lo">Log out</button></div><p class="err" id="merr"></p></section>';
        $("mk").onclick = async () => { const { error } = await sb.rpc("become_teacher"); if (error) $("merr").textContent = error.message; else boot(); };
        $("lo").onclick = logOut;
        return;
      }
    }
    $("topbar").hidden = false; $("topacts").hidden = false;
    await loadAll();
    render();
  }
  // Log out: her sign-in ends, and the page goes to the door of the game (index.html), where every login starts.
  async function logOut() { try { await sb.auth.signOut(); } catch (e) {} location.href = "index.html"; }
  $("logout").onclick = logOut;
  $("toGame").onclick = () => { location.href = "index.html"; };   // the child's door
  function go(name) { if (name !== "today" && window.WW_TEACHER_DAY) window.WW_TEACHER_DAY.stop(); tab = name; document.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("on", x.dataset.tab === name)); render(); if (document.scrollingElement) document.scrollingElement.scrollTop = 0; }
  document.querySelectorAll(".tabs button").forEach(b => b.onclick = () => go(b.dataset.tab));

  // ---------- data ----------
  const safe = q => Promise.resolve(q).catch(e => ({ data: [], error: e }));
  async function loadAll() {
    const st = await sb.from("students").select("*").eq("is_test", false).order("created_at").limit(1).maybeSingle();
    if (st.error) { banner(st.error.message); return; }
    student = st.data;
    if (!student) { words = []; sessions = []; return; }
    const [w, s, qs, m, sw, stt] = await Promise.all([
      sb.from("words").select("*").eq("student_id", student.id).order("sort_order").order("created_at"),
      sb.from("sessions").select("*").eq("student_id", student.id).order("day", { ascending: false }).limit(400),
      sb.from("quests").select("*").eq("student_id", student.id).order("quest_day"),
      sb.from("messages").select("*").eq("student_id", student.id).order("created_at"),
      safe(sb.from("school_words").select("*").eq("student_id", student.id).order("dictation_date").order("added_at")),
      safe(sb.from("school_tests").select("*").eq("student_id", student.id).order("taken_on"))
    ]);
    if (w.error || s.error || qs.error) banner((w.error || s.error || qs.error).message);
    words = w.data || []; sessions = s.data || []; quests = qs.data || []; messages = m.data || [];
    words = words.map(x => { const p = W.fromOldLadder(x); return p ? Object.assign({}, x, p) : x; });   // shown only; the game saves the move when it next loads
    school = (sw && !sw.error && sw.data) || []; tests = (stt && !stt.error && stt.data) || [];   // tables of phase 2: may not exist yet on the real site
    const unread = messages.filter(x => x.from_role === "student" && !x.read_at).length;
    const cb = document.querySelector('[data-tab="chat"]'); if (cb) cb.textContent = "Letters" + (unread ? " (" + unread + ")" : "");
  }
  async function loadRecent(days) {
    const from = new Date(W.addDays(W.today(), -(days - 1)) + "T00:00:00").toISOString();
    const [a, e] = await Promise.all([
      sb.from("attempts").select("*").eq("student_id", student.id).gte("created_at", from).order("created_at"),
      sb.from("events").select("*").eq("student_id", student.id).gte("created_at", from).order("created_at")
    ]);
    return { A: a.data || [], E: e.data || [] };
  }
  function render() {
    if (!student) return renderNewStudent();
    ({ today: renderToday, week: renderWeek, school: renderSchool, chat: renderChat, mother: renderMother, words: renderWords, settings: renderSettings,
      stories: () => window.WW_TEACHER_STORY && window.WW_TEACHER_STORY.render(view, { sb, student, W }) })[tab]();   // the Stories tab: site/teacher-story.js
  }

  // ---------- no student yet ----------
  function renderNewStudent() {
    view.innerHTML = '<section class="box narrow"><h2>Add your student</h2><form id="sf" class="stack">' +
      '<label class="f">Name<input type="text" id="sn" value="" placeholder="Sam"></label>' +
      '<div class="row"><button type="submit">Create</button></div><p class="err" id="serr"></p></form></section>';
    $("sf").onsubmit = async e => {
      e.preventDefault();
      // a new student starts WITHOUT a usable password (26 November): she sets it in Settings, where the red line asks for it
      const { error } = await sb.from("students").insert({ teacher_id: me.id, name: $("sn").value.trim() || "Student", pin: "" });
      if (error) { $("serr").textContent = error.message; return; }
      await loadAll(); go("settings");
    };
  }

  // ---------- what happened on one day ----------
  const FIRST_KINDS = ["review", "new", "test", "mixed", "training", "school"];
  // First tries only: the level saves a scoring step once ("review", "new", "test"); the mixed round and the training save every try.
  function firstTries(A) {
    const seen = {};
    return A.filter(a => {
      if (FIRST_KINDS.indexOf(a.kind) < 0) return false;
      const k = a.kind + "|" + W.key(a.word) + "|" + ld(a.created_at) + (a.kind === "mixed" || a.kind === "training" || a.kind === "school" ? "" : "|" + (a.step || ""));
      if (seen[k]) return false; seen[k] = 1; return true;
    });
  }
  function dayFacts(day, A, E) {
    const a = A.filter(x => ld(x.created_at) === day), e = E.filter(x => ld(x.created_at) === day), f = firstTries(a);
    const s = sessions.find(x => x.day === day) || null;
    const lv = levelQuests().filter(x => ld(x.finished_at) === day || ld(x.started_at) === day);
    const done = lv.filter(x => x.completed && ld(x.finished_at) === day), open = lv.filter(x => !x.completed);
    // Minutes in levels: the level logs minutes since it was opened at each part and at the end; a stop and a new start begin again.
    let mins = 0, seg = 0;
    e.forEach(x => { if (x.type === "quest_start" || x.type === "practice_start") { mins += seg; seg = 0; } else if ((x.type === "part_done" || x.type === "quest_complete") && x.detail && x.detail.minutes != null) seg = Math.max(seg, +x.detail.minutes || 0); });
    mins += seg;
    const kind = k => f.filter(x => x.kind === k);
    const ev = re => e.filter(x => re.test(x.type));
    const schoolQ = quests.filter(x => x.kind === "school" && ld(x.started_at || x.created_at) === day);
    return {
      day, s, played: !!s || a.length > 0, done, open, mins: Math.round(mins),
      old: kind("review"), news: kind("new"), test: kind("test"), mixed: kind("mixed"), training: kind("training"), schoolA: kind("school"), schoolQ,
      parts: [...new Set(ev(/^part_done$/).map(x => x.detail && x.detail.part).filter(Boolean))],
      zh: ev(/^(zh_toggle|zh_shown|guide_zh|story_zh)$/).length,
      hear: ev(/^(card_heard|guide_again|story_heard|hear|heard)$|_heard$|^hear_/).length,
      story: ev(/^story_opened$/).map(x => x.detail && x.detail.level).filter(x => x != null),
      storyHeard: ev(/^story_heard$/).length,
      sentences: ev(/^sentence_saved$/), copied: ev(/^sentence_copied$/).length, skipped: ev(/^sentence_skipped$/).length,
      drawn: e.filter(x => x.type === "drawn" && x.detail && x.detail.png),
      games: ev(/^game_(meaning|sentence)$/), claps: ev(/^clap$/), pauses: ev(/^quest_pause$/).length,
      play: s && s.play_used != null ? Math.round((+s.play_used || 0) / 60) : null, asleep: s && s.asleep_at ? s.asleep_at : null,
      attempts: a, events: e
    };
  }
  const notYet = list => list.filter(x => !x.correct);
  const typedList = list => list.map(x => '<span class="slip"><b>' + esc(x.word) + '</b> <i>' + esc(x.answer) + "</i></span>").join("");
  const rightOf = list => list.filter(x => x.correct).length;

  // ---------- today: did he play, for how long, his new words, and the words to practise in the lesson. Nothing else. ----------
  // The laptop's voice: the game records a "speech" event when the voice did not start (ok: false; again: true when the
  // game tried the next voice at once, so he still heard the word) and the first time a voice did start (ok: true).
  function speechFacts(E, t) {
    const sp = E.filter(x => x.type === "speech" && x.detail && ld(x.created_at) === t);
    // since 24 November most of what he hears is a recording (detail.clip); the laptop's own voice only says what has none
    const dev = sp.filter(x => !x.detail.clip), clip = sp.filter(x => x.detail.clip);
    const fails = dev.filter(x => x.detail.ok === false && !x.detail.again), clipFails = clip.filter(x => x.detail.ok === false);
    const last = dev[dev.length - 1] || null, lastClip = clip[clip.length - 1] || null;
    return { fails: fails.length, laterOk: !!(last && last.detail.ok === true), clipFails: clipFails.length, clipLaterOk: !!(lastClip && lastClip.detail.ok === true) };
  }
  const timesWord = n => n === 1 ? "once" : n === 2 ? "twice" : n + " times";
  function speechNotice(E, t) {
    const S = speechFacts(E, t);
    if (!S.fails && !S.clipFails) return "";
    return '<section class="box notice" id="speechNote"><h2>Sound on his laptop</h2>' +
      (S.clipFails ? "<p>A recorded word or line did not play " + timesWord(S.clipFails) + " today. Check that the sound is on and the internet works." + (S.clipLaterOk ? " The recordings played again later today." : "") + "</p>" : "") +
      (S.fails ? "<p>His laptop’s own voice did not start " + timesWord(S.fails) + " today. It says only what has no recording, such as words you added yourself. The recorded words do not need it." + (S.laterOk ? " It worked again later today." : "") + "</p>" +
        '<p class="lead">If it keeps happening, <button type="button" class="link" data-go="settings">choose another voice in Settings</button>.</p>' : "") + "</section>";
  }
  // The words of the last 7 days that were not right the first time he wrote them, newest problems first.
  function toPractise(A) {
    const t = W.today(), week7 = W.addDays(t, -6), F = firstTries(A).filter(x => ld(x.created_at) >= week7);
    const map = {};
    F.filter(x => !x.correct).forEach(x => { const k = W.key(x.word); (map[k] = map[k] || { word: x.word, typed: [], last: "" }).typed.push(x.answer); map[k].last = ld(x.created_at); });
    // a word that was not right several times in a row comes too, even when that was more than 7 days ago
    words.filter(w => w.level > 0 && w.wrong_streak >= 2 && !map[W.key(w.word)]).forEach(w => { map[W.key(w.word)] = { word: w.word, typed: [], last: "" }; });
    return Object.values(map).map(sv => {
      const w = words.find(x => W.key(x.word) === W.key(sv.word)) || null, now = F.filter(x => W.key(x.word) === W.key(sv.word)).pop();
      return Object.assign(sv, { w, laterRight: !!(now && now.correct && sv.typed.length) });
    }).sort((a, b) => b.typed.length - a.typed.length || (a.last < b.last ? 1 : -1));
  }
  async function renderToday() {
    await loadAll();
    const t = W.today(), { A, E } = await loadRecent(14);
    if (tab !== "today") return;
    const T = dayFacts(t, A, E);
    const lastPlayed = sessions.map(x => x.day).concat(A.map(a => ld(a.created_at))).filter(k => k && k < t).sort().pop();

    // 1. did he play, and for how long
    let play;
    if (!T.played) play = '<p class="big">Not yet today.</p><p>' + (lastPlayed ? "He last played " + (W.daysBetween(lastPlayed, t) === 1 ? "yesterday, " : "on ") + day3(lastPlayed) + "." : "He has not played the game yet.") + "</p>";
    else {
      const L = [];
      if (T.mins) L.push("He spent <b>" + many(T.mins, "minute") + "</b> on his words.");
      T.done.forEach(x => L.push("He finished level " + x.quest_day + "." + (isTest(x.quest_day) ? " It was a spelling test of the island's words: <b>" + (x.test_right || 0) + " of " + (x.test_total || 0) + "</b> right." : "")));
      if (!T.done.length && T.open.length) L.push("He started level " + T.open[0].quest_day + " and has not finished it yet.");
      const oldRun = quests.some(x => x.kind === "old" && ld(x.started_at || x.created_at) === t);   // "No new words for now": his old words alone
      if (!T.done.length && !T.open.length) L.push(oldRun ? "No new words for now: he went over his old words only." : "He opened the game but has not started his words yet.");
      if (T.old.length) L.push("He went over " + many(T.old.length, "word") + " he learned before" + (rightOf(T.old) ? ": " + rightOf(T.old) + " right the first time." : "."));
      const sw = new Set(T.schoolA.map(x => W.key(x.word))).size;
      if (sw) L.push("He practised " + many(sw, "word") + " from the school spelling list.");
      if (T.play) L.push("He also had " + many(T.play, "minute") + " of free play.");
      play = '<p class="big">Yes, he played today.</p><ul class="facts">' + L.map(x => "<li>" + x + "</li>").join("") + "</ul>";
    }

    // 2. the new words of today
    const seen = new Set(), fresh = [];
    words.filter(w => w.introduced_on === t).concat(T.news.map(a => words.find(w => W.key(w.word) === W.key(a.word)) || { word: a.word }))
      .forEach(w => { const k = W.key(w.word); if (!seen.has(k)) { seen.add(k); fresh.push(w); } });
    const newHtml = fresh.length ? '<ul class="newwords">' + fresh.map(w => "<li>" + picHtml(w) + '<div><b class="ww">' + esc(w.word) + "</b>" +
      (w.meaning_en ? '<span class="mean">' + esc(w.meaning_en) + "</span>" : "") + (w.meaning_zh ? '<span class="mean zh" lang="zh-CN">' + esc(w.meaning_zh) + "</span>" : "") + "</div></li>").join("") + "</ul>"
      : '<p class="lead">' + (T.played ? "No new words today." : "His new words show here after he plays.") + "</p>";

    // 3. the words to practise in the lesson
    const tp = toPractise(A), tomorrow = W.addDays(t, 1);
    const tpHtml = tp.length ? '<ul class="slips">' + tp.slice(0, 8).map(sv => {
      const w = sv.w, typed = [...new Set(sv.typed)].filter(Boolean);
      return '<li><b class="ww">' + esc(sv.word) + '</b><span class="sl-d">' +
        (typed.length ? "He wrote " + typed.map(v => "<i>" + esc(v) + "</i>").join(" and ") + " · " + rel(sv.last) + (sv.laterRight ? ". Right later." : "") : "Not yet right the last " + (w ? w.wrong_streak : 2) + " times") + "</span>" +
        (w && w.level > 0 ? (w.due === tomorrow ? '<span class="tagok">In tomorrow\'s game</span>' : '<button type="button" class="mini" data-retest="' + w.id + '">Add to tomorrow\'s game</button>') : "") + "</li>";
    }).join("") + "</ul>" + (tp.length > 8 ? '<p class="lead">And ' + (tp.length - 8) + " more.</p>" : "")
      : '<p class="lead">Nothing to practise from the last 7 days: every word was right the first time.</p>';
    const P = window.WW_PATTERNS;
    let pats = null;
    if (P && typeof P.summary === "function") { try { pats = P.summary(A.filter(a => a.kind !== "retry")) || []; } catch (e) { pats = null; } }
    const twice = (pats || []).filter(p => (p.count || 0) >= 2 && p.code !== "other").slice(0, 2);   // "other" names no pattern to practise
    const patHtml = twice.length ? '<h3>A spelling pattern to practise</h3><ul class="pats">' + twice.map(p => {
      const tip = (() => { try { return P.tip ? P.tip(p.code) : null; } catch (e) { return null; } })(), ex = (p.examples || [])[0];
      return "<li><b>" + esc(p.name_en || p.code) + "</b> came up " + many(p.count || 0, "time") + " in 14 days" + (ex ? ", for example <i>" + esc(ex.typed) + "</i> for " + esc(ex.word) : "") + "." +
        (tip && tip.en ? '<div class="tip">Tip from the game: ' + esc(tip.en) + "</div>" : "") + "</li>";
    }).join("") + "</ul>" : "";

    // 4. this week's spelling pattern (pattern weeks, site/first.js) and a short paper dictation for her lesson
    const wk = thisWeek();
    const patCard = wk && wk.week ? '<section class="box d-week"><div class="bh"><h2>This week\'s pattern</h2><span class="eyebrow">Week ' + wk.number + " · levels " + wk.first + " to " + wk.last + "</span></div>" +
      '<p class="d-pat">' + esc(wk.week.name) + "</p>" + (wk.week.tip ? '<p class="d-tip">' + esc(wk.week.tip) + "</p>" : "") +
      '<p class="lead">His new words in the game this week have this pattern. Teach it in your lesson.</p></section>' : "";
    const week7 = W.addDays(t, -6), seenD = new Set();
    const dict = firstTries(A).filter(x => x.correct && x.kind !== "training" && ld(x.created_at) >= week7)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
      .filter(x => { const k = W.key(x.word); if (seenD.has(k)) return false; seenD.add(k); return true; }).slice(0, 5);
    const dictCard = dict.length ? '<section class="box d-dict"><div class="bh"><h2>Paper dictation for your lesson</h2></div><p class="d-say">Say each word. He writes it on paper.</p>' +
      '<ol class="dict">' + dict.map(x => "<li>" + esc(x.word) + "</li>").join("") + "</ol>" +
      '<p class="lead">' + (dict.length === 1 ? "The word he got" : "The " + dict.length + " words he got") + " right the first time in the game in the last 7 days, newest first.</p></section>" : "";
    view.innerHTML = '<div class="today">' + speechNotice(E, t) +
      '<div class="two"><div class="col">' +
      '<section class="box d-play"><div class="bh"><h2>Did he play today?</h2><span class="eyebrow">' + esc(day3(t)) + "</span></div>" + play + "</section>" +
      '<section class="box d-new"><div class="bh"><h2>New words today</h2></div>' + newHtml + "</section></div>" +
      '<section class="box d-slips"><div class="bh"><h2>Words to practise in your lesson</h2></div>' +
      '<p class="lead">Words he did not get right the first time in the last 7 days. Go over them with him.</p>' + tpHtml + patHtml + "</section>" +
      "</div>" + '<div class="box tdv" id="dayView" hidden></div>' + (patCard || dictCard ? '<div class="two d-lesson">' + patCard + dictCard + "</div>" : "") + "</div>";
    wireCommon();
    if (window.WW_TEACHER_DAY) window.WW_TEACHER_DAY.render($("dayView"), { sb, student, W, day: t, words });   // the day view: site/teacher-day.js
  }
  // His island: the newest picture the game saved, and one line to use in the lesson (This week tab).
  function islandCard() {
    const pic = islandPic(), at = pic && pic.at, k = at ? ld(at) : "", b = buildObj();
    const pocket = '<p class="lead">In his game: ' + many(diamondsEarned(), "diamond") + " earned for his spelling, " + diamondsSpent() + " spent in the shop, " + (diamondsEarned() - diamondsSpent()) + " left. " +
      many(b.cells.length + (b.cells3 || []).length, "piece") + " placed on his island.</p>";
    if (!pic) return '<section class="box d-island"><div class="bh"><h2>His island</h2></div>' +
      '<p class="lead">A picture of his island shows here after he has built something in the game.</p>' + pocket + "</section>";
    return '<section class="box d-island"><div class="bh"><h2>His island</h2>' + (k ? '<span class="eyebrow">saved ' + esc(rel(k)) + "</span>" : "") + "</div>" +
      '<img class="isl-pic" src="' + esc(pic.src) + '" alt="The island he built' + (k ? ", saved " + esc(day3(k)) : "") + '">' +
      (k ? '<p class="isl-at">Saved ' + esc(day3(k)) + " at " + esc(W.fmtTime(at)) + ".</p>" : "") +
      '<p class="isl-ask">Ask him to tell you in English what he built.</p>' + pocket + "</section>";
  }
  // Buttons that appear on several tabs.
  function wireCommon() {
    view.querySelectorAll("[data-go]").forEach(b => b.onclick = () => go(b.dataset.go));
    // "Add to tomorrow's game": bring a learned word back into tomorrow's words, whatever its memory step says.
    view.querySelectorAll("[data-retest]").forEach(b => b.onclick = async () => { const { error } = await sb.from("words").update({ due: W.addDays(W.today(), 1) }).eq("id", b.dataset.retest); if (error) banner(error.message); else { const w = words.find(x => x.id === b.dataset.retest); if (w) w.due = W.addDays(W.today(), 1); b.textContent = "In tomorrow's game"; b.disabled = true; } });
  }

  // ---------- school list ----------
  // The current list is the one with the nearest dictation date that is today or later.
  function lists() {
    const by = {}; school.forEach(r => { (by[r.dictation_date] = by[r.dictation_date] || []).push(r); });
    return Object.keys(by).sort().map(date => ({ date, rows: by[date] }));
  }
  function currentList() { const t = W.today(); return lists().find(l => l.date >= t) || null; }
  function latestTest() { return tests.slice().sort((a, b) => (a.taken_on < b.taken_on ? -1 : 1)).pop() || null; }
  function listDrillLine(rows) {
    const seen = rows.filter(r => r.tries > 0), lastRight = seen.filter(r => r.last_right === true).length;
    return seen.length ? "he has practised " + seen.length + " of the " + rows.length + " words, and " + lastRight + " were right the last time" : rows.length + " words, not practised yet";
  }
  // The pasted list: one word a line or with commas; a line may carry the word's Chinese after it ("because 因为").
  const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;
  const cleanWord = x => asTyped(String(x).replace(/^\s*\d+\s*[.)]\s*/, "").replace(/[.]+$/, ""));
  function splitList(txt) {
    const out = [];
    String(txt || "").split(/\n+/).forEach(line => {
      const at = line.search(CJK);
      if (at >= 0) { const w = cleanWord(line.slice(0, at).replace(/[\s,;:=\t\u2013\u2014-]+$/, "")); if (w) out.push({ word: w, zh: line.slice(at).trim() }); return; }
      line.split(/[,;\t]+/).map(cleanWord).filter(Boolean).forEach(w => out.push({ word: w, zh: "" }));
    });
    return out;
  }
  // Short Chinese meanings for the words of a list, from Claude through the page (the same path as "Analyse this week").
  // Only the words are sent. The answer fills the fields; nothing is saved until the tutor presses Save the Chinese.
  function zhPrompt(list) {
    return [
      "Give a short meaning in Simplified Chinese for each English spelling word below, for a child of 11 in China who is learning English.",
      "Use the most common everyday meaning, in words the child knows: 1 to 4 characters where possible, at most 8. No pinyin, no English, no explanation.",
      "For a word with an apostrophe give the meaning of the whole word (don't: 不要).",
      "",
      "WORDS (JSON): " + JSON.stringify(list),
      "",
      'FORMAT: return only one JSON object, nothing before or after it: {"words": [{"word": "the word exactly as given", "zh": "中文"}]}'
    ].join("\n");
  }
  // Has this school word a picture? Its own painting (window.WW_SCHOOL_PICS) or, for one of the game's words, the game's.
  const schoolPic = word => { const SP = window.WW_SCHOOL_PICS || {}, low = asTyped(word).toLowerCase(); return SP[low] || SP[W.key(word)] || (PICS[W.plain(word)] ? "img/words/" + W.plain(word) + ".jpg" : ""); };
  const zhClean = z => { const t = String(z == null ? "" : z).replace(/\s+/g, " ").trim(); return CJK.test(t) && t.length <= 16 ? t : ""; };
  function renderSchool() {
    if (!recWords) recLoad().then(ok => { if (ok && tab === "school" && !view.querySelector("#scText:focus") && !($("scText") && $("scText").value)) renderSchool(); });
    const t = W.today(), L = lists(), cur = currentList();
    const nextWed = (() => { let k = W.addDays(t, 1); while (new Date(k + "T00:00:00").getDay() !== 3) k = W.addDays(k, 1); return k; })();
    const listHtml = l => {
      const test = tests.filter(x => x.dictation_date === l.date).pop();
      const past = l.date < t;
      return '<section class="box sc-list' + (past ? " past" : "") + '" data-date="' + l.date + '"><div class="bh"><h2>Dictation on ' + day3(l.date) + "</h2><span class=\"eyebrow\">" + (l === cur ? "this week's list · " : past ? "past · " : "") + many(l.rows.length, "word") + "</span></div>" +
        '<p class="lead">' + cap(listDrillLine(l.rows)) + "." + (test ? " Practice dictation at home: <b>" + test.score + " of " + test.total + "</b> right on " + day3(test.taken_on) + " (he marked it himself)" + (test.missed && test.missed.length ? ". To practise again: " + test.missed.map(esc).join(", ") : "") + "." : "") + "</p>" +
        '<div class="row sc-tools"><label class="inl">Dictation date <input type="date" class="sc-date" value="' + l.date + '"></label><button type="button" class="ghost mini sc-move">Change the date</button><button type="button" class="ghost mini red sc-dellist">Delete this list</button></div>' +
        '<div class="row sc-zhbar"><span class="sc-fillslot"></span><button type="button" class="mini sc-zhsave" disabled>Save the Chinese</button><span class="muted sc-zhmsg"></span></div>' +
        '<div class="scroll"><table class="sc-words"><tr><th>Word</th><th>Chinese</th><th>Times practised</th><th>Right the first time</th><th>Last time</th><th></th></tr>' + l.rows.map(r => '<tr data-id="' + r.id + '"><td class="w">' + esc(r.word) + (schoolPic(r.word) ? "" : ' <span class="sc-nopic">no picture yet</span>') + (noRec(r.word) ? ' <span class="sc-nopic">no recording</span>' : "") + '</td><td class="zhc"><input type="text" class="sc-zh" lang="zh" value="' + esc(r.meaning_zh || "") + '" aria-label="Chinese for ' + esc(r.word) + '"></td><td class="nb" data-l="Times practised">' + (r.tries || 0) + '</td><td class="nb" data-l="Right the first time">' + (r.right || 0) + "</td><td class=\"lt\">" + (r.last_seen ? (r.last_right === false ? '<span class="ny">not yet</span>' : r.last_right ? '<span class="good">right</span>' : "") + " " + day3(ld(r.last_seen)) : '<span class="muted">not practised yet</span>') + '</td><td class="acts"><button type="button" class="mini ghost sc-edit">Change</button><button type="button" class="mini ghost sc-del" aria-label="Delete ' + esc(r.word) + '">' + ICON("x") + "</button></td></tr>").join("") + "</table></div></section>";
    };
    view.innerHTML = '<div class="sc-grid"><section class="box"><div class="bh"><h2>Add the week\'s school words</h2></div>' +
      '<p class="lead">Paste the school\'s list: one word a line, or with commas. Words stay exactly as you type them (February, don\'t). You can put the Chinese after a word (because 因为); he sees it when he learns the word.</p><p class="lead">In the game he practises 5 of these words a day, and the day before the dictation he does a practice dictation on paper.</p><p class="lead">A word marked “no recording” is not in the game\'s recorded words. His laptop\'s own voice says it, and on some laptops that voice is silent: then he sees the word but does not hear it.</p>' +
      '<textarea id="scText" rows="9" placeholder="February 二月&#10;don\'t&#10;Wednesday&#10;because"></textarea>' +
      '<div class="row"><label class="f inl">Dictation date <input type="date" id="scDate" value="' + (cur ? cur.date : nextWed) + '"></label><button type="button" id="scAdd">Add to the list</button></div><p class="err" id="scErr"></p><p class="ok" id="scOk"></p></section>' +
      '<div class="sc-lists">' + (L.length ? L.slice().reverse().filter(l => l.date >= W.addDays(t, -21)).map(listHtml).join("") : '<section class="box"><p class="lead">No school list yet. Paste the first one on the left.</p></section>') + '<div id="srSlot"></div></div></div>';
    fillResults();
    $("scAdd").onclick = async () => {
      const date = $("scDate").value, list = splitList($("scText").value);
      $("scErr").textContent = ""; $("scOk").textContent = "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { $("scErr").textContent = "Set the dictation date."; return; }
      if (!list.length) { $("scErr").textContent = "Paste the words first."; return; }
      const bad = list.filter(x => !wordOk(x.word)).map(x => x.word); if (bad.length) { $("scErr").textContent = "Only letters, apostrophes (') and hyphens (-), please. Check: " + bad.join(", "); return; }
      const have = new Set(school.filter(r => r.dictation_date === date).map(r => W.key(r.word))), add = [], dup = [];
      list.forEach(x => { const k = W.key(x.word); if (have.has(k)) dup.push(x.word); else { have.add(k); add.push(x); } });
      if (add.length) {
        const now = new Date().toISOString();
        // meaning_zh only when given, so a list without Chinese still saves where the column is not there yet
        const { error } = await sb.from("school_words").insert(add.map(x => Object.assign({ student_id: student.id, word: x.word, dictation_date: date, added_at: now, tries: 0, right: 0, last_seen: null, last_right: null }, x.zh ? { meaning_zh: x.zh } : {})));
        if (error) { $("scErr").textContent = error.message; return; }
      }
      await loadAll(); renderSchool();
      $("scOk").textContent = "Added " + many(add.length, "word") + " for " + day3(date) + "." + (dup.length ? " Already on that list: " + dup.join(", ") + "." : "");
    };
    view.querySelectorAll(".sc-list").forEach(sec => {
      const date = sec.dataset.date, rows = school.filter(r => r.dictation_date === date);
      // The Chinese of each word: typed (or filled by Claude), saved together when she presses Save the Chinese.
      const save = sec.querySelector(".sc-zhsave"), zmsg = sec.querySelector(".sc-zhmsg");
      const zin = () => [...sec.querySelectorAll("tr[data-id]")].map(tr => ({ tr, r: school.find(x => x.id === tr.dataset.id), inp: tr.querySelector(".sc-zh") })).filter(x => x.r && x.inp);
      const dirty = () => zin().filter(x => x.inp.value.trim() !== String(x.r.meaning_zh || ""));
      const mark = () => { const n = dirty().length; save.disabled = !n; zin().forEach(x => x.inp.classList.toggle("changed", x.inp.value.trim() !== String(x.r.meaning_zh || ""))); if (n) zmsg.textContent = many(n, "change") + " not saved yet."; };
      sec.querySelectorAll(".sc-zh").forEach(i => { i.oninput = mark; i.onkeydown = e => { if (e.key === "Enter") save.click(); }; });
      save.onclick = async () => {
        const ch = dirty(); if (!ch.length) return;
        save.disabled = true; zmsg.textContent = "Saving…";
        for (const x of ch) {
          const v = x.inp.value.trim();
          const { error } = await sb.from("school_words").update({ meaning_zh: v }).eq("id", x.r.id);
          if (error) { zmsg.textContent = error.message; save.disabled = false; return; }
        }
        await loadAll(); renderSchool();
        const again = view.querySelector('.sc-list[data-date="' + date + '"] .sc-zhmsg'); if (again) again.textContent = "Saved: " + many(ch.length, "word") + ".";
      };
      getSample().then(sample => {
        if (!sample || tab !== "school" || !sec.isConnected) return;
        const slot = sec.querySelector(".sc-fillslot");
        slot.innerHTML = '<button type="button" class="mini ghost sc-fill">Fill in the Chinese</button>';
        const fb = slot.querySelector(".sc-fill");
        fb.onclick = async () => {
          const empty = zin().filter(x => !x.inp.value.trim());
          if (!empty.length) { zmsg.textContent = "Every word has its Chinese. Clear a field to have it filled again."; return; }
          fb.disabled = true; zmsg.textContent = "Claude is writing the Chinese…";
          try {
            const out = await sample.json(zhPrompt(empty.map(x => x.r.word)), { modelTier: "default" });
            const got = out && Array.isArray(out.words) ? out.words : null; if (!got) throw { code: "shape" };
            const by = {}; got.forEach(g => { if (g && typeof g.word === "string") by[W.key(g.word)] = zhClean(g.zh); });
            let n = 0;
            empty.forEach(x => { const z = by[W.key(x.r.word)]; if (z && !x.inp.value.trim()) { x.inp.value = z; x.inp.classList.add("filled"); n++; } });
            mark();
            zmsg.textContent = n ? "Filled " + many(n, "word") + ". Check them, then press Save the Chinese." : "Claude gave no Chinese this time. Type it in the fields.";
          } catch (e) {
            const code = e && e.code;
            zmsg.textContent = code === "rate_limited" ? "Claude has had many questions just now. Try again later, or type the Chinese." :
              code === "not_granted" ? "Filling in is switched off for this page. Type the Chinese in the fields." :
              "The Chinese could not be filled this time. Type it in the fields.";
            if (code === "not_granted") { fb.hidden = true; return; }
          }
          fb.disabled = false;
        };
      });
      sec.querySelector(".sc-move").onclick = async () => {
        const nd = sec.querySelector(".sc-date").value; if (!nd || nd === date) return;
        const { error } = await sb.from("school_words").update({ dictation_date: nd }).in("id", rows.map(r => r.id)); if (error) banner(error.message);
        await loadAll(); renderSchool();
      };
      const dl = sec.querySelector(".sc-dellist");
      dl.onclick = async () => {
        if (!dl.dataset.sure) { dl.dataset.sure = "1"; dl.textContent = "Delete all " + rows.length + "?"; return; }
        const { error } = await sb.from("school_words").delete().in("id", rows.map(r => r.id)); if (error) banner(error.message);
        await loadAll(); renderSchool();
      };
      sec.querySelectorAll("tr[data-id]").forEach(tr => {
        const id = tr.dataset.id, r = school.find(x => x.id === id);
        tr.querySelector(".sc-del").onclick = async () => { const { error } = await sb.from("school_words").delete().eq("id", id); if (error) banner(error.message); await loadAll(); renderSchool(); };
        tr.querySelector(".sc-edit").onclick = () => {
          const td = tr.querySelector("td.w"); td.innerHTML = '<input type="text" class="sc-in" value="' + esc(r.word) + '">';
          const inp = td.querySelector("input"); inp.focus(); inp.select();
          const b = tr.querySelector(".sc-edit"); b.textContent = "Save";
          b.onclick = async () => {
            const v = asTyped(inp.value);
            if (!wordOk(v)) { banner("Only letters, apostrophes and hyphens, please."); return; }
            if (school.some(x => x.id !== id && x.dictation_date === date && W.key(x.word) === W.key(v))) { banner(v + " is already on this list."); return; }
            const { error } = await sb.from("school_words").update({ word: v }).eq("id", id); if (error) banner(error.message); else banner("");
            await loadAll(); renderSchool();
          };
          inp.onkeydown = e => { if (e.key === "Enter") b.click(); };
        };
      });
    });
  }

  // ---------- his sentences and the letters ----------
  const STAMPS = ["I read this!", "Great sentence!", "Tell me more on Saturday!"];
  const replyText = (sentence, said) => 'Your sentence: "' + sentence + '" ' + said;
  async function hisSentences() {
    const { data } = await sb.from("events").select("*").eq("student_id", student.id).eq("type", "sentence_saved").order("created_at", { ascending: false });
    const seen = new Set(), out = [];
    (data || []).forEach(e => { const d = e.detail || {}; if (!d.sentence) return; const k = W.key(d.word) + "|" + d.sentence; if (seen.has(k)) return; seen.add(k); out.push({ word: d.word, sentence: d.sentence, at: e.created_at }); });
    words.filter(w => w.student_sentence && !seen.has(W.key(w.word) + "|" + w.student_sentence)).forEach(w => out.push({ word: w.word, sentence: w.student_sentence, at: null }));
    const mine = messages.filter(m => m.from_role === "teacher");
    out.forEach(s => { const m = mine.find(x => String(x.text).indexOf('"' + s.sentence + '"') !== -1); s.answered = m ? m.text.slice(m.text.lastIndexOf('" ') + 2) : null; });
    return out;
  }
  async function renderChat() {
    const S = await hisSentences();
    view.innerHTML = '<div class="letters"><section class="box"><div class="bh"><h2>Sentences he wrote</h2><span class="eyebrow">' + (S.filter(x => !x.answered).length ? S.filter(x => !x.answered).length + " to answer" : "all answered") + "</span></div>" +
      '<p class="lead">Sentences he wrote in the game. One tap on an answer sends him a short letter with his sentence in it. Or write your own answer.</p>' +
      (S.length ? '<ul class="sents">' + S.map((s, i) => '<li data-i="' + i + '" class="' + (s.answered ? "done" : "") + '"><div class="sline"><span class="w">' + esc(s.word) + '</span><q>' + esc(s.sentence) + "</q>" + (s.at ? '<span class="muted">' + day3(ld(s.at)) + "</span>" : "") + "</div>" +
        (s.answered ? '<div class="sent-ok">' + ICON("check") + "Answered: " + esc(s.answered) + "</div>" :
          '<div class="stamps">' + STAMPS.map((x, k) => '<button type="button" class="stampbtn" data-stamp="' + k + '">' + esc(x) + "</button>").join("") + '<button type="button" class="ghost mini" data-write>' + ICON("pencil") + "Write a reply</button></div>" +
          '<form class="replyf" hidden><input type="text" maxlength="200" placeholder="Your reply, short and in English"><button type="submit">Send</button></form>') + "</li>").join("") + "</ul>" : '<p class="lead">No sentences from him yet. They show here when he writes one in the game.</p>') +
      '</section><section class="box"><div class="bh"><h2>Letters to him</h2></div>' +
      '<p class="lead">Your newest letter is waiting in his mailbox when he opens the game. In his game your name is <b>' + esc(student.teacher_name || "WordWizard") + "</b>. Keep letters short; he cannot write back.</p>" +
      '<div class="chat" id="chat">' + (messages.length ? messages.map(m => '<div class="msg ' + (m.from_role === "teacher" ? "me" : "him") + '"><span>' + (m.from_role === "teacher" ? "You · " : esc(student.name) + " · ") + day3(ld(m.created_at)) + " " + W.fmtTime(m.created_at) + (m.from_role === "teacher" ? (m.read_at ? " · he opened it" : " · not opened yet") : "") + "</span>" + esc(m.text) + "</div>").join("") : '<p class="muted">No letters yet.</p>') + "</div>" +
      '<form id="cf" class="row" autocomplete="off"><input type="text" id="ctext" maxlength="300" placeholder="Write a short letter to him…"><button type="submit">Send</button></form></section></div>';
    const chat = $("chat"); chat.scrollTop = chat.scrollHeight;
    const send = async text => { const { error } = await sb.from("messages").insert({ student_id: student.id, from_role: "teacher", text }); if (error) { banner(error.message); return false; } await loadAll(); renderChat(); return true; };
    view.querySelectorAll(".sents li").forEach(li => {
      const s = S[+li.dataset.i]; if (s.answered) return;
      li.querySelectorAll("[data-stamp]").forEach(b => b.onclick = () => send(replyText(s.sentence, STAMPS[+b.dataset.stamp])));
      const f = li.querySelector(".replyf");
      li.querySelector("[data-write]").onclick = () => { f.hidden = false; f.querySelector("input").focus(); };
      f.onsubmit = e => { e.preventDefault(); const v = f.querySelector("input").value.trim(); if (v) send(replyText(s.sentence, v)); };
    });
    const unread = messages.filter(m => m.from_role === "student" && !m.read_at);
    if (unread.length) { const now = new Date().toISOString(); await sb.from("messages").update({ read_at: now }).in("id", unread.map(m => m.id)); unread.forEach(m => m.read_at = now); document.querySelector('[data-tab="chat"]').textContent = "Letters"; }
    $("cf").onsubmit = async e => { e.preventDefault(); const t = $("ctext").value.trim(); if (!t) return; await send(t); };
  }

  // ---------- the summary for his mother, in Chinese ----------
  const zhDate = k => { const d = new Date(k + "T00:00:00"); return (d.getMonth() + 1) + "月" + d.getDate() + "日"; };
  async function motherFacts() {
    await loadAll();   // the newest picture of his island too
    const t = W.today(), from = W.addDays(t, -6), { A, E } = await loadRecent(7);
    const played = new Set(sessions.map(x => x.day).filter(k => k >= from && k <= t).concat(A.map(a => ld(a.created_at)))).size;
    const fresh = words.filter(w => w.introduced_on && w.introduced_on >= from && w.introduced_on <= t).sort((a, b) => (a.quest_day || 0) - (b.quest_day || 0));
    const lv = levelQuests().filter(x => x.completed && ld(x.finished_at) >= from).map(x => x.quest_day).sort((a, b) => a - b);
    const test = tests.filter(x => x.taken_on >= W.addDays(t, -13)).sort((a, b) => (a.taken_on < b.taken_on ? -1 : 1)).pop() || null;
    const sent = E.filter(e => e.type === "sentence_saved" && e.detail && e.detail.sentence).pop() || null;
    const firstRight = firstTries(A).filter(x => x.correct).length;
    const pic = islandPic(), island = pic && pic.at && ld(pic.at) >= from && ld(pic.at) <= t ? pic : null;   // only a picture from these 7 days
    return { t, from, played, fresh, lv, can: canSpell().length, test, sent, firstRight, island };
  }
  function motherText(f) {
    const name = student.name || "孩子";
    const L = [name + " 本周英语单词小结（" + zhDate(f.from) + "—" + zhDate(f.t) + "）", ""];
    L.push(f.played ? "· 这一周练习了 " + f.played + " 天（每周目标是 5 天）。" : "· 这一周还没有打开游戏练习。");
    if (f.lv.length) L.push("· 完成了" + (f.lv.length > 1 ? "第 " + f.lv[0] + " 到第 " + f.lv[f.lv.length - 1] + " 关" : "第 " + f.lv[0] + " 关") + "。");
    if (f.fresh.length) L.push("· 学了 " + f.fresh.length + " 个新单词：" + f.fresh.map(w => w.word + (w.meaning_zh ? "（" + w.meaning_zh.split(/[；;]/)[0] + "）" : "")).join("、") + "。");
    if (f.can) L.push("· 现在能凭记忆拼写的单词一共有 " + f.can + " 个。"); else if (f.fresh.length) L.push("· 新学的单词第二天再拼对一次，就会算进“能凭记忆拼写”的单词里。");
    // never a count of 0 in what his mother reads (25 November)
    if (f.test && f.test.score > 0) L.push("· 为学校听写做的练习：" + f.test.total + " 个词写对了 " + f.test.score + " 个（他自己对照批改的）。");
    else if (f.test && f.test.total > 0) L.push("· 他为学校听写在家做了一次练习（" + f.test.total + " 个词）。");
    if (f.sent) L.push("· 他用新单词 " + f.sent.detail.word + " 自己写了一句话：“" + f.sent.detail.sentence + "”");
    else if (f.firstRight) L.push("· 这一周，单词第一次拼就拼对的有 " + f.firstRight + " 次。");
    if (f.island) L.push("· 他用拼写挣来的钻石买了砖块，在游戏的小岛上搭了自己的建筑（见图）。");
    L.push("", "谢谢您在家里的支持！");
    return L.join("\n");
  }
  // The same text as a picture in the journal look: paper, ink, a stamp.
  async function motherPicture(text, f) {
    const c = document.createElement("canvas"), g = c.getContext && (() => { try { return c.getContext("2d"); } catch (e) { return null; } })();
    if (!g) return "";
    try { if (document.fonts && document.fonts.load) await Promise.all([document.fonts.load('30px "LXGW WenKai"', "本周练习"), document.fonts.load('30px "Marcellus"', "Word World")]); } catch (e) {}
    const Wd = 900, pad = 70, zh = '"Atkinson Hyperlegible Next","LXGW WenKai","Kaiti SC","STKaiti","KaiTi","Noto Serif SC",serif';
    const lines = text.split("\n"), wrapped = [];
    g.font = "30px " + zh;
    // English words stay whole; Chinese breaks between characters, but never before closing punctuation.
    const unitsOf = s => (s.match(/[A-Za-z0-9'"“”.,!?-]+|\s+|./g) || []).reduce((a, u) => { if (a.length && /^[、，。：；！？）”]/.test(u)) a[a.length - 1] += u; else a.push(u); return a; }, []);
    lines.forEach((ln, i) => {
      if (!ln) { wrapped.push({ t: "", gap: true }); return; }
      if (i === 0 && ln.indexOf("（") > 0) { const at = ln.indexOf("（"); wrapped.push({ t: ln.slice(0, at), title: true }, { t: ln.slice(at + 1).replace(/）$/, ""), dates: true }); return; }
      const title = i === 0, indent = /^· /.test(ln);
      g.font = (title ? "36px " : "29px ") + zh;
      let cur = "";
      unitsOf(ln).forEach(u => { if (g.measureText(cur + u).width > Wd - pad * 2 && cur.trim()) { wrapped.push({ t: cur, title }); cur = (indent ? "   " : "") + u.replace(/^\s+/, ""); } else cur += u; });
      if (cur) wrapped.push({ t: cur, title });
    });
    // his island under the text, when the game saved one these 7 days, with a short caption
    const isl = f && f.island ? await loadImg(f.island.src) : null;
    const iw = Wd - pad * 2, ih = isl ? Math.round(iw * (isl.naturalHeight || isl.height || 9) / (isl.naturalWidth || isl.width || 16)) : 0;
    const textH = 200 + wrapped.reduce((a, l) => a + (l.title ? 56 : l.dates ? 40 : l.gap ? 18 : 46), 0);
    const H = isl ? textH + 50 + ih + 150 : textH + 90;
    c.width = Wd; c.height = H;
    const grd = g.createLinearGradient(0, 0, Wd, H); grd.addColorStop(0, "#fbf4e4"); grd.addColorStop(1, "#f0e2c2");
    g.fillStyle = grd; g.fillRect(0, 0, Wd, H);
    g.fillStyle = "rgba(120,80,40,.10)"; g.fillRect(0, 0, 18, H);
    g.strokeStyle = "#d5c19c"; g.lineWidth = 2; g.strokeRect(30, 30, Wd - 60, H - 60);
    g.fillStyle = "#5d4838"; g.font = '22px "Marcellus",Georgia,serif'; g.fillText("WORD WORLD  ·  " + (student.name || "").toUpperCase(), pad, 98);
    g.strokeStyle = "#d5c19c"; g.beginPath(); g.moveTo(pad, 120); g.lineTo(Wd - pad, 120); g.stroke();
    let y = 180;
    wrapped.forEach(l => {
      if (l.title) { g.fillStyle = "#2c1f17"; g.font = "36px " + zh; g.fillText(l.t, pad, y); y += 56; return; }
      if (l.dates) { g.fillStyle = "#8b7460"; g.font = "24px " + zh; g.fillText(l.t, pad, y - 8); y += 40; return; }
      if (l.gap) { y += 18; return; }
      g.fillStyle = "#2c1f17"; g.font = "29px " + zh; g.fillText(l.t, pad, y); y += 46;
    });
    if (isl) {
      y += 6; g.fillStyle = "#8b7460"; g.font = "24px " + zh; g.fillText("他建的小岛" + (f.island.at ? "（" + zhDate(ld(f.island.at)) + "）" : ""), pad, y); y += 22;
      g.save(); g.shadowColor = "rgba(90,60,30,.25)"; g.shadowBlur = 10; g.shadowOffsetY = 3; g.fillStyle = "#fffaf0"; g.fillRect(pad - 8, y - 8, iw + 16, ih + 16); g.restore();
      try { g.drawImage(isl, pad, y, iw, ih); } catch (e) {}
      g.strokeStyle = "#d5c19c"; g.lineWidth = 1.5; g.strokeRect(pad - 8, y - 8, iw + 16, ih + 16);
    }
    // the stamp: days this week
    if (!f.played) { try { return c.toDataURL("image/png"); } catch (e) { return ""; } }   // no stamp that reads 0 days
    g.save(); g.translate(Wd - 150, H - 140); g.rotate(-0.17);
    if (isl) { g.fillStyle = "rgba(251,244,228,.88)"; g.beginPath(); g.arc(0, 0, 66, 0, Math.PI * 2); g.fill(); }   // the stamp sits on the corner of the picture
    g.strokeStyle = "#b84a10"; g.fillStyle = "#b84a10"; g.globalAlpha = .85;
    g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 62, 0, Math.PI * 2); g.stroke(); g.lineWidth = 1.5; g.setLineDash([5, 4]); g.beginPath(); g.arc(0, 0, 53, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    g.textAlign = "center"; g.font = "18px " + zh; g.fillText("本周", 0, -22); g.font = '44px "Marcellus",Georgia,serif'; g.fillText(String(f.played), 0, 22); g.font = "18px " + zh; g.fillText("天", 0, 46); g.restore();
    try { return c.toDataURL("image/png"); } catch (e) { return ""; }
  }
  const loadImg = src => new Promise(res => {
    try { const im = new Image(), done = v => { clearTimeout(tm); res(v); }, tm = setTimeout(() => done(null), 3000); im.onload = () => done(im); im.onerror = () => done(null); im.src = src; } catch (e) { res(null); }
  });
  const framed = () => { try { return window.self !== window.top; } catch (e) { return true; } };
  async function renderMother() {
    view.innerHTML = '<div class="mother"><section class="box"><div class="bh"><h2>A note for his mother</h2><span class="eyebrow">in Chinese</span></div>' +
      '<p class="lead">A short note in Chinese about his last 7 days, and the same note as a picture, to send by WhatsApp or WeChat. You can change the text before you copy it.</p>' +
      '<div class="row"><button type="button" id="mkSum">Make the summary</button><button type="button" class="ghost" id="copySum" disabled>' + ICON("copy") + "Copy text</button><span class=\"ok\" id=\"copyOk\"></span></div>" +
      '<textarea id="sumText" rows="12" class="zhtext" lang="zh-CN" placeholder="Press Make the summary."></textarea></section>' +
      '<section class="box"><div class="bh"><h2>The same note as a picture</h2></div><p class="lead" id="picHow">Press Make the summary.</p><div id="sumPic" class="sumpic"></div></section></div>';
    let F = null, timer = null;
    const draw = async () => {
      const src = await motherPicture($("sumText").value, F);
      $("sumPic").innerHTML = src ? '<img id="sumImg" src="' + src + '" alt="The summary as a picture">' + (framed() ? "" : '<p><a href="' + src + '" download="word-world-week.png">Download the picture</a></p>') : '<p class="muted">This browser cannot draw the picture. Copy the text instead.</p>';
      $("picHow").textContent = src ? "To send it: right-click the picture and choose Copy image or Save image. On a phone: press and hold the picture." : "";
    };
    $("mkSum").onclick = async () => {
      F = await motherFacts(); $("sumText").value = motherText(F); $("copySum").disabled = false; $("copyOk").textContent = ""; await draw();
    };
    $("sumText").oninput = () => { if (!F) return; clearTimeout(timer); timer = setTimeout(draw, 400); };
    $("copySum").onclick = async () => {
      const v = $("sumText").value; let ok = false;
      try { await navigator.clipboard.writeText(v); ok = true; } catch (e) {}
      if (!ok) { try { $("sumText").select(); ok = document.execCommand("copy"); } catch (e) {} }
      $("copyOk").textContent = ok ? "Copied." : "Select the text and copy it with Ctrl+C.";
    };
  }

  // ---------- words: which words are in the game, and when they appear ----------
  // A word's state in plain words, from its memory step and the day it comes back.
  function wordState(w) {
    const t = W.today();
    if (!w || !w.level) return "";
    if (w.level >= W.DIAMOND) return '<span class="good">Knows it well</span>';
    return "Comes back " + (!w.due || w.due <= t ? "today" : w.due === W.addDays(t, 1) ? "tomorrow" : "on " + esc(day3(w.due)));
  }
  // ---------- the line: every coming level to 50, with its 2 words (the tutor, 23 November) ----------
  // Words already on a level (in the game, with that level) are shown as set. For the rest the page works out what the game
  // will take, with the game's own code (site/picker.js plan, the same order: his waiting words, the week's own words, long
  // words of the week's pattern, any long words), level by level, as if he finished each level and his difficulty stayed as
  // it is now. Every 10th level is the island test with the monster: no new words. Her actions change only what she points
  // at: a word she replaces or pauses goes to "Words set aside" (in the game: approved false, no level), and nothing comes
  // back by itself.
  const FIRSTW = () => window.WW_FIRST || {};
  const fe = (f, name) => f.querySelector('[name="' + name + '"]');   // a field of a small form
  let poolIx = null;
  const poolRow = w => { if (!poolIx) { poolIx = {}; (window.WW_POOL || []).forEach(r => { poolIx[W.key(r[0])] = r; }); } return poolIx[W.key(w)] || null; };
  const inList = (list, w) => (list || []).some(x => W.key(x) === W.key(w));
  const isWaiting = w => w.approved && !w.level && w.quest_day == null;
  const waitingWords = () => words.filter(isWaiting).sort((a, b) => (a.created_at || "") < (b.created_at || "") ? -1 : (a.created_at || "") > (b.created_at || "") ? 1 : (a.sort_order || 0) - (b.sort_order || 0));
  const setAside = () => words.filter(w => !w.approved);
  const nextLevel = () => { let n = 1; while (n <= maxDay() && dayDone(n)) n++; return n; };
  const weeksOf = () => FIRSTW().weeks || [];
  const weekOf = d => { const P = window.WW_PICKER; return P && P.weekOf ? P.weekOf(d, weeksOf()) : null; };
  // the week of his next level that has new words (an island test level belongs to no week)
  const thisWeek = () => { let d = nextLevel(); while (d <= LEVELS && isTest(d)) d++; return d <= LEVELS ? weekOf(d) : null; };
  // What she paused, to bring it back where it was. Kept in this browser (a word paused on another computer is put back with
  // "Put in a level…").
  const memoKey = () => "ww.teacher.aside." + (student ? student.id : "");
  const memoAll = () => { try { return JSON.parse(localStorage.getItem(memoKey()) || "{}") || {}; } catch (e) { return {}; } };
  const memoSet = (id, v) => { try { const m = memoAll(); if (v) m[id] = v; else delete m[id]; localStorage.setItem(memoKey(), JSON.stringify(m)); } catch (e) {} };
  let lineAE = { A: [], E: [] }, lineItems = [], lineModelNow = null;

  // ---- the recorded voice (24 November): the game says its own words from recordings (site/voice.js). A word without one
  // (her own words, school words outside the game's list) is said by his laptop's own voice, which is silent on some laptops.
  // The index is read as text: loading voice.js as a script would make common.js fetch every recording in the background.
  let recWords = null, recP = null;
  const recKey = t => String(t || "").toLowerCase().replace(/[.!?,;:]+$/, "").trim().replace(/[^a-z0-9]+/g, "_");
  function recLoad() {
    if (recP) return recP;
    const keys = R => [].concat(...["a", "b", "s", "o"].map(k => Object.keys(R[k] || {})));   // the sets W.clipFor looks in
    if (window.WW_REC && window.WW_REC.a) { recWords = new Set(keys(window.WW_REC)); return (recP = Promise.resolve(true)); }
    return (recP = (typeof fetch === "function" ? fetch("voice.js").then(r => r.ok ? r.text() : "").then(t => {
      const i = t.indexOf("=", t.indexOf("WW_REC")), j = t.lastIndexOf("}");
      if (i < 0 || j < i) return false;
      const R = JSON.parse(t.slice(i + 1, j + 1)); if (!R.a) return false; recWords = new Set(keys(R)); return true;
    }) : Promise.resolve(false)).catch(() => false));
  }
  const noRec = w => !!recWords && !recWords.has(recKey(w));   // false while it is not known
  const NOREC_TAG = '<span class="ln-norec" title="The game has no recording of this word. His laptop\'s own voice says it; on some laptops that voice is silent.">No recording</span>';

  // where a word comes from, in plain words
  function sourceOf(word, row, from) {
    const F = FIRSTW(), k = W.key(word), ev = lineAE.E.filter(e => e.type === "picked" && e.detail && Array.isArray(e.detail.words));
    const quick = ev.some(e => e.detail.words.some((x, i) => W.key(x) === k && Array.isArray(e.detail.from) && e.detail.from[i] === "waiting"));
    if (from === "waiting" || (row && isWaiting(row)) || quick) return "From the quick check";
    if (inList(F.school, word)) return "School spelling test";
    if (inList(F.report, word)) return "Your assessment report";
    const pr = poolRow(word), byGame = ev.some(e => e.detail.words.some(x => W.key(x) === k));
    // a row this page made from one of the game's choices (paused, edited, moved) carries the pool's question; her own
    // word typed in "Add your own word" never has one (25 November: a paused Cambridge word was shown as "Your own word")
    const fromGame = !!(row && pr && row.dialogue_q && row.dialogue_q === pr[7]);
    if (!pr || (row && !byGame && !fromGame)) return "Your own word";
    if (pr[15]) return "Cambridge list";
    if (pr[19]) return "From your notes";
    return "Word list";
  }
  // The coming levels: [{ d, test, week, set: [rows], plan: [words the game will take] }]
  function lineModel() {
    const P = window.WW_PICKER, on = student.picker !== false, first = nextLevel();
    const avoid = []; lineAE.E.forEach(x => { if (x.type === "picked" && x.detail && Array.isArray(x.detail.words)) avoid.push(...x.detail.words); });
    const shown = words.filter(w => w.approved), mine = words.map(w => w.word);
    let waiting = waitingWords();
    const out = [];
    for (let d = first; d <= LEVELS; d++) {
      const set = levelWords(d), test = isTest(d);
      let plan = [];
      if (P && !test && d >= 4 && set.length < 2) {
        try {
          const pl = P.plan({ student: student.id, level: d, quests, attempts: lineAE.A, events: lineAE.E, words: shown, pool: window.WW_POOL || [], bank: window.WW_BANK || [],
            mine, avoid, have: set.map(w => w.word), need: 2 - set.length, pics: window.WW_PICS || null, patterns: window.WW_PATTERNS || null, on, waiting, weeks: weeksOf() });
          plan = pl.words;
        } catch (e) { plan = []; }
        plan.forEach(w => { mine.push(w.word); if (w.from === "waiting") waiting = waiting.filter(x => x.id !== w.id); });
      }
      out.push({ d, test, week: weekOf(d), set, plan });
    }
    return out;
  }
  // The rows a level's words go into: its set words, then the game's choices (for the replace question).
  const levelEntries = (m, d) => { const L = (m || []).find(x => x.d === d); return L ? L.set.map(r => ({ row: r })).concat(L.plan.map(p => ({ plan: p }))) : []; };
  const entryWord = e => e.row ? e.row.word : e.plan.word;
  const nextOrder = () => (words.length ? Math.max(...words.map(x => x.sort_order || 0)) : 0) + 1;
  // Put an entry of the line aside: a row leaves the game (no level); a planned word becomes a row that is not in the game,
  // so the game never takes it by itself.
  async function entryAside(e, memo) {
    if (e.row) {
      const was = isWaiting(e.row) ? { waiting: true } : { level: e.row.quest_day };   // read before the change
      const { error } = await sb.from("words").update({ approved: false, quest_day: null }).eq("id", e.row.id);
      if (error) { banner(error.message); return false; }
      memoSet(e.row.id, memo === false ? null : was);
      return true;
    }
    if (e.plan.from === "waiting" && e.plan.id) return entryAside({ row: words.find(x => x.id === e.plan.id) || e.plan }, memo);
    const p = e.plan, nr = { student_id: student.id, word: p.word, chunks: p.chunks || p.word, meaning_en: p.meaning_en || "", meaning_zh: p.meaning_zh || "", sentence_en: p.sentence_en || "", sentence_zh: p.sentence_zh || "", dialogue_q: p.dialogue_q || "", dialogue_a: p.dialogue_a || "", focus: p.focus || "", sounds: +p.sounds || 0, rule_en: p.rule_en || "", rule_zh: p.rule_zh || "", level: 0, sort_order: nextOrder(), approved: false, quest_day: null };
    const r = await sb.from("words").insert(nr).select().single();
    if (r.error) { banner(r.error.message); return false; }
    if (r.data && memo !== false) memoSet(r.data.id, { planned: true });
    return true;
  }

  // ---- checks on what she types (the game's rules for a text he reads) ----
  const CJK_ANY = /[㐀-鿿豈-﫿]/;
  // the rude-word list (site/rude.js), matched as the game matches it (80-level.js rudeHits): whole words, with an ending,
  // letters repeated or written with digits; Chinese entries anywhere
  function rudeIn(s) {
    const R = window.WW_RUDE; if (!Array.isArray(R)) return false;
    const SUB = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "9": "g", "@": "a", "$": "s", "!": "i", "|": "i", "+": "t" };
    const fold = t => String(t).toLowerCase().replace(/[01345789@$!|+]/g, c => SUB[c] || c).replace(/[^a-z]/g, "");
    const ENDS = "(?:s|es|z|ed|er|ers|ing|in|y|ie|ies|ish|ass|head|heads|face|hole|holes)?";
    const res = [].concat(...R.map(x => String(x).toLowerCase()).filter(x => /^[a-z]+$/.test(x))
      .map(x => [new RegExp("^(?:mother|bull)?" + x + ENDS + "$"), new RegExp("^(?:mother|bull)?" + x.replace(/(.)\1*/g, (m, c) => c + "{" + m.length + ",}") + "s?$")]));
    const low = String(s || "").toLowerCase(), bad = t => { const f = fold(t); return !!f && res.some(re => re.test(f)); };
    const toks = low.match(/[a-z0-9@$!|+]+/g) || [];
    if (toks.some(bad)) return true;
    for (let i = 0; i < toks.length - 1; i++) if (bad(toks[i] + toks[i + 1])) return true;
    return R.some(x => /[^\x00-\x7f]/.test(x) && low.indexOf(String(x).toLowerCase()) >= 0);
  }
  const SENT_WORDS = 10;
  function textIssue(word, zh, sen) {
    if (!word) return "Type the word.";
    if (!wordOk(word)) return "Only letters, apostrophes (') and hyphens (-) in a word.";
    if (!zh || !CJK_ANY.test(zh)) return "Type the Chinese meaning (in Chinese characters).";
    if (zh.length > 16) return "Keep the Chinese meaning short: 16 characters at most.";
    if (!sen) return "Type an English sentence with the word.";
    if (!W.hasWord(sen, word)) return "The sentence must hold the word “" + word + "”.";
    if (!/[.!?]$/.test(sen) || (sen.match(/[.!?]+/g) || []).length > 1) return "One sentence, with a full stop (or ! or ?) at the end.";
    if (sen.split(/\s+/).filter(Boolean).length > SENT_WORDS) return "Keep the sentence short: " + SENT_WORDS + " words at most.";
    if (rudeIn(sen) || rudeIn(word) || rudeIn(zh)) return "Please use other words: the game does not show one of these words to him.";
    return "";
  }
  // a level she may choose: a coming level, not the island test
  function levelIssue(d) {
    if (!Number.isInteger(d) || d < 1 || d > LEVELS) return "Choose a level from " + nextLevel() + " to " + LEVELS + ".";
    if (d < nextLevel()) return "He has finished level " + d + ". Choose level " + nextLevel() + " or later.";
    if (isTest(d)) return "Level " + d + " is the spelling test with the monster. It has no new words. Choose another level.";
    return "";
  }
  // The replace question: the level's two words as choices. Returns HTML.
  function replaceAsk(name, d) {
    const es = levelEntries(lineModelNow, d);
    return '<fieldset class="ln-rep"><legend>This level is full. Which word should your word replace?</legend>' +
      es.map((e, i) => '<label class="ln-repo"><input type="radio" name="' + name + '" value="' + i + '"><span><b>' + esc(entryWord(e)) + "</b> " +
        '<span class="muted">' + (e.row ? "set on level " + d : "the game's choice for now") + "</span></span></label>").join("") +
      '<p class="lead">The word you replace goes to “Words set aside” below. You can put it in another level or add it to the words he goes over again.</p></fieldset>';
  }
  // Make room on level d: nothing to do while it has room; when it is full, the chosen entry goes aside. false: she must choose.
  async function makeRoom(d, pickName, root, err) {
    const es = levelEntries(lineModelNow, d);
    if (es.length < 2) return true;
    const sel = root.querySelector('input[name="' + pickName + '"]:checked');
    if (!sel) {
      if (!root.querySelector(".ln-rep")) { root.querySelector(".ln-repslot").innerHTML = replaceAsk(pickName, d); err.textContent = ""; }
      else err.textContent = "Choose one of the two words above.";
      return false;
    }
    return entryAside(es[+sel.value], false);
  }

  function renderWords() { renderWordsAsync(); }
  async function renderWordsAsync() {
    const [, a, e, ma] = await Promise.all([recLoad(),
      safe(sb.from("attempts").select("*").eq("student_id", student.id).in("kind", ["new", "review", "test", "probe"])),
      safe(sb.from("events").select("*").eq("student_id", student.id).in("type", ["rescue", "picked"])),
      safe(sb.from("attempts").select("*").eq("student_id", student.id).in("kind", ["new", "review", "test", "mixed"]))   // the monster game's misses
    ]);
    await loadAll();
    if (tab !== "words") return;
    lineAE = { A: (a && a.data) || [], E: (e && e.data) || [] };
    owA = (ma && ma.data) || [];
    drawWords();
  }
  function drawWords() {
    const on = student.picker !== false, first = nextLevel();
    const finished = levelQuests().filter(x => x.completed && x.quest_day).sort((a, b) => a.quest_day - b.quest_day);
    const repBtn = w => w.level > 0 ? '<button type="button" class="ghost mini" data-rep="' + w.id + '">Repeat…</button>' : "";
    const wordLine = w => '<li data-wid="' + w.id + '"><span class="wl-w">' + picHtml(w) + "<b>" + esc(w.word) + "</b>" + (w.meaning_zh ? ' <span class="zh muted" lang="zh-CN">' + esc(w.meaning_zh) + "</span>" : "") + '</span><span class="wl-s">' + wordState(w) + repBtn(w) + '</span><div class="rp-slot"></div></li>';
    const extra = words.filter(w => w.approved && w.level > 0 && w.quest_day == null);
    const doneHtml = finished.length || extra.length ? '<ol class="lvlist">' + finished.slice().reverse().map(q => {
      const ws = words.filter(w => w.quest_day === q.quest_day);
      return '<li><div class="lv-h"><b>Level ' + q.quest_day + "</b>" + (isTest(q.quest_day) ? " · spelling test of the island's words" : "") + '<span class="muted">' + esc(day3(ld(q.finished_at))) + "</span></div>" +
        (ws.length ? '<ul class="wl">' + ws.map(wordLine).join("") + "</ul>" : isTest(q.quest_day) ? '<p class="lead">' + (q.test_right || 0) + " of " + (q.test_total || 0) + " right.</p>" : "") + "</li>";
    }).join("") + (extra.length ? '<li><div class="lv-h"><b>Words he goes over again, without a level</b></div><ul class="wl">' + extra.map(wordLine).join("") + "</ul></li>" : "") + "</ol>"
      : '<p class="lead">No level finished yet. The words of each level he finishes show here, with the day.</p>';
    const how = on
      ? "One spelling pattern a week. Each level gets 2 new words. First come the words he did not know in the quick check and your own words for the week's pattern: one of each while both are waiting. Your words that did not fit in their week come the week after. Then long words with that pattern, chosen by how he did: when he gets most words right the first time, the next words are a little harder; when many are not yet right, they are a little easier. Long words get a lesson; short words get a quick check first."
      : "The game takes the next 2 words of a fixed list, in order, for each level, after the words he did not know in the quick check and your own words for the week. In Settings you can let the game choose his words by how he did.";
    view.innerHTML = '<div class="words">' +
      '<section class="box"><div class="bh"><h2>How the game chooses his words</h2></div><p>' + how + '</p><p class="lead" id="wBand"></p>' +
      "<p>Each new word comes back after 1, 4 and 14 days, so he practises it again. When he spells it right each time, he knows it well. Every 10th level is a short spelling test of the island's words. His school spelling list comes on top: he practises 5 of those words a day.</p></section>" +
      '<section class="box ln" id="line">' + lineHtml(first) + "</section>" +
      '<section class="box ln-tray" id="tray">' + trayHtml() + "</section>" +
      '<section class="box ow" id="oldW">' + oldWordsHtml() + "</section>" +
      '<section class="box mg" id="monster">' + monsterHtml() + "</section>" +
      '<section class="box rmode" id="rmWords">' + modeHtml("rmw") + "</section>" +
      '<section class="box"><div class="bh"><h2>Words he has learned</h2></div><p class="lead">The 2 words of each level he finished, newest first, with the day he finished it. <b>Repeat…</b> sets when a word is asked again and how many more times.</p>' + doneHtml + "</section>" +
      '<details class="box fold" id="wEdit"' + (openFolds.wEdit ? " open" : "") + '><summary><span class="sum-t">Add or change words yourself</span><span class="sum-s">All his words in one table, with every detail of a word. You rarely need this: the line above does the everyday changes.</span></summary>' + wordTools() + "</details></div>";
    view.querySelector("#wEdit").ontoggle = ev => { openFolds.wEdit = ev.target.open; };
    view.querySelectorAll("details.ln-week").forEach(x => { x.ontoggle = () => { openFolds["wk" + x.dataset.wk] = x.open; }; });
    wireLine(); wireTray(); wireRepeat(); wireWordTools(); wireCommon();
    wireOld(); wireMonster(); wireMode($("rmWords"), "rmw", () => drawOld());
    bandLine();
  }
  function lineHtml(first) {
    const P = window.WW_PICKER, model = lineModelNow = lineModel(), paused = !!student.pause_new;
    lineItems = [];
    const wt = waitingWords();
    const head = '<div class="bh"><h2>His coming words</h2><span class="grow"></span><span class="eyebrow">every level to level 50</span></div>' +
      '<div class="ln-switch' + (paused ? " on" : "") + '"><div><b>No new words for now</b><p>For an exam week or a holiday. The game gives him no new words and no lessons; he still goes over his old words. His next level waits where it is.</p></div>' +
      '<button type="button" class="' + (paused ? "" : "ghost ") + 'sw" id="lnPause" aria-pressed="' + paused + '">' + (paused ? "On" : "Off") + "</button></div>" +
      (paused ? '<p class="ln-pausednote">' + ICON("calendar") + "<span>No new words for now is on. He sees: “No new words today. Old words only.” Switch it off to go on with level " + first + ".</span></p>" : "") +
      (wt.length ? '<div class="ln-wait"><b>He did not know these yet. They get a lesson next:</b> ' + wt.map(w => '<span class="ln-chip">' + esc(w.word) + (w.meaning_zh ? ' <span class="zh" lang="zh-CN">' + esc(w.meaning_zh) + "</span>" : "") + "</span>").join(" ") + "</div>" : "") +
      '<div class="ln-bar"><button type="button" id="lnAddBtn">' + ICON("pencil") + 'Add your own word</button>' +
      '<p class="ln-key"><span class="ln-st set">Set</span> the word is set for that level. <span class="ln-st plan">The game’s choice for now</span> it can change with how he does. <b>Pause</b> takes a word out; it waits in “Words set aside”.' + (recWords ? ' <span class="ln-norec">No recording</span> the game has no recording of it: his laptop’s own voice says it, and on some laptops that voice is silent.' : "") + '</p></div>' +
      '<div id="lnAdd" hidden></div>';
    if (first > LEVELS) return head + '<p class="lead">He has finished every level.</p>';
    // weeks (pattern weeks; an island test sits in the week around it); without the week data, groups of ten levels
    const groups = []; let g = null;
    model.forEach(L => {
      // the island test sits in the week around it (the week of the level after it)
      const wk = L.week || (L.test ? weekOf(L.d < LEVELS ? L.d + 1 : L.d - 1) : null);
      const key = wk ? "w" + wk.number : "t" + Math.floor((L.d - 1) / PER_ZONE);
      if (!g || g.key !== key) { g = { key, week: wk, levels: [] }; groups.push(g); }
      if (!g.week && L.week) g.week = L.week;
      g.levels.push(L);
    });
    let shownOpen = 0;
    const html = groups.map((G, gi) => {
      const ds = G.levels.map(L => L.d), lo = Math.min(...ds), hi = Math.max(...ds);
      const nSet = G.levels.reduce((n, L) => n + (L.test ? 0 : L.set.length), 0), nPlan = G.levels.reduce((n, L) => n + L.plan.length, 0), tests = G.levels.filter(L => L.test).map(L => L.d);
      const open = gi === 0 || shownOpen < 5 || openFolds["wk" + G.key];
      shownOpen += G.levels.length;
      const name = G.week ? "Week " + G.week.number + ": " + G.week.week.name : "Levels " + lo + " to " + hi;
      const sum = (G.week ? "Levels " + lo + " to " + hi + " · " : "") + many(nSet + nPlan, "word") + (nSet ? " (" + nSet + " set)" : "") + (tests.length ? " · spelling test at level " + tests.join(", ") : "");
      return '<details class="ln-week" data-wk="' + G.key + '"' + (open ? " open" : "") + '><summary><span class="ln-wn">' + esc(name) + '</span><span class="ln-ws">' + esc(sum) + "</span></summary>" +
        (G.week && G.week.week.tip ? '<p class="ln-tip">' + esc(G.week.week.tip) + "</p>" : "") +
        '<ol class="ln-levels">' + G.levels.map(L => levelHtml(L, first)).join("") + "</ol></details>";
    }).join("");
    return head + (P ? "" : '<p class="needs">The game’s own choices cannot be worked out on this page just now. Words that are set still show.</p>') + html;
  }
  function levelHtml(L, first) {
    const st = dayState(L.d);
    const when = L.d === first ? (st === "paused" ? "Next for him · waits: no new words for now" : st === "open" ? "Next for him · ready now" : st === "locked" && L.d > 1 ? "Next for him · opens tomorrow" : "Next for him") : "After level " + (L.d - 1);
    const title = '<div class="ln-lh"><b>Level ' + L.d + "</b>" + (L.test ? '<span class="ln-test">Spelling test with the monster</span>' : "") + '<span class="muted">' + when + "</span></div>";
    if (L.test && !L.set.length) return '<li class="ln-lv test">' + title + '<p class="lead">He hears up to 10 words from levels ' + (L.d - PER_ZONE + 1) + " to " + (L.d - 1) + " and types them. No new words.</p></li>";
    const items = L.set.map(r => ({ d: L.d, row: r })).concat(L.plan.map(p => ({ d: L.d, plan: p })));
    const empty = 2 - items.length;
    return '<li class="ln-lv' + (L.d === first ? " now" : "") + '">' + title + '<ul class="ln-ws">' + items.map(wordItemHtml).join("") +
      (empty > 0 ? '<li class="ln-w ln-none"><span class="muted">' + (L.d < 4 ? "No word yet. Add your own word for this level." : "No word yet. The game has no word left to choose here; add your own word.") + "</span></li>" : "") + "</ul></li>";
  }
  function wordItemHtml(it) {
    const i = lineItems.push(it) - 1, w = it.row || it.plan, src = sourceOf(w.word, it.row, it.plan && it.plan.from);
    return '<li class="ln-w ' + (it.row ? "set" : "plan") + '" data-i="' + i + '">' + picHtml(w) +
      '<div class="ln-wt"><div class="ln-top"><b class="ln-word">' + esc(w.word) + "</b>" + (w.meaning_zh ? '<span class="zh" lang="zh-CN">' + esc(w.meaning_zh) + "</span>" : "") + "</div>" +
      (w.sentence_en ? '<div class="ln-sen">' + esc(w.sentence_en) + "</div>" : "") +
      '<div class="ln-tags"><span class="ln-src">' + esc(src) + '</span><span class="ln-st ' + (it.row ? "set\">Set" : "plan\">The game’s choice for now") + "</span>" + (noRec(w.word) ? NOREC_TAG : "") + "</div></div>" +
      '<div class="ln-acts"><button type="button" class="ghost mini" data-ln-edit="' + i + '">Edit</button><button type="button" class="ghost mini" data-ln-pause="' + i + '">Pause</button></div>' +
      '<div class="ln-ed" hidden></div></li>';
  }
  function trayHtml() {
    const list = setAside(), memo = memoAll();
    return '<div class="bh"><h2>Words set aside</h2></div>' +
      '<p class="lead">Words you paused or replaced. They are not in his game, and nothing here comes back by itself. Put a word in a level, add it to the words he goes over again (he practises it as an old word, without a lesson), or leave it here.</p>' +
      (list.length ? '<ul class="tr-list">' + list.map(w => '<li data-id="' + w.id + '">' + picHtml(w) + '<div class="ln-wt"><div class="ln-top"><b class="ln-word">' + esc(w.word) + "</b>" + (w.meaning_zh ? '<span class="zh" lang="zh-CN">' + esc(w.meaning_zh) + "</span>" : "") + "</div>" +
        '<div class="ln-tags"><span class="ln-src">' + esc(sourceOf(w.word, w)) + "</span>" + (memo[w.id] ? '<span class="ln-st">Paused</span>' : w.quest_day ? '<span class="ln-st">was for level ' + w.quest_day + "</span>" : "") + "</div></div>" +
        '<div class="ln-acts">' + (memo[w.id] ? '<button type="button" class="mini" data-tr-back="' + w.id + '">Bring back</button>' : "") +
        '<button type="button" class="ghost mini" data-tr-put="' + w.id + '">Put in a level…</button><button type="button" class="ghost mini" data-tr-old="' + w.id + '">Add to spaced repetition</button></div>' +
        '<div class="ln-ed" hidden></div></li>').join("") + "</ul>" : '<p class="ln-empty">Nothing set aside.</p>');
  }
  // the small form for her own word (and the same fields to edit a coming word)
  function wordForm(o) {
    return '<form class="form ln-form" id="' + o.id + '" autocomplete="off">' +
      '<label class="f">The word' + '<span class="fh">As he should write it: February, don\'t. A word that is not in the game\'s word list has no recording: his laptop\'s own voice says it.</span><input type="text" name="word" value="' + esc(o.word || "") + '"' + (o.lockWord ? " readonly" : "") + "></label>" +
      '<label class="f">Its Chinese meaning<span class="fh">Short, for him to read.</span><input type="text" name="zh" lang="zh-CN" value="' + esc(o.zh || "") + '"></label>' +
      '<label class="f wide">An English sentence with the word<span class="fh">One short sentence (' + SENT_WORDS + ' words at most) that holds the word. He copies it in the game.</span><input type="text" name="sen" value="' + esc(o.sen || "") + '"></label>' +
      (o.level ? '<label class="f">Level<span class="fh">His next level is ' + nextLevel() + '.</span><input type="number" name="level" min="1" max="' + LEVELS + '" value="' + o.level + '"></label>' : "") +
      '<div class="ln-repslot wide"></div>' +
      '<div class="row wide"><button type="submit">' + esc(o.go) + '</button><button type="button" class="ghost" data-cancel>Cancel</button><span class="err" data-err></span></div></form>';
  }
  const firstFree = () => { let d = nextLevel(); while (d <= LEVELS && isTest(d)) d++; return Math.min(d, LEVELS); };
  function wireLine() {
    const reload = async () => { await loadAll(); drawWords(); };
    $("lnPause").onclick = async () => {
      const v = !student.pause_new;
      const { error } = await sb.from("students").update({ pause_new: v }).eq("id", student.id);
      if (error) { banner(error.message); return; }
      student.pause_new = v; drawWords();
    };
    $("lnAddBtn").onclick = () => {
      const box = $("lnAdd"); box.hidden = false;
      box.innerHTML = '<div class="edit"><h3>Add your own word</h3>' + wordForm({ id: "lnAddF", level: firstFree(), go: "Add the word" }) + "</div>";
      const f = $("lnAddF"), err = f.querySelector("[data-err]");
      f.querySelector("[data-cancel]").onclick = () => { box.hidden = true; box.innerHTML = ""; };
      fe(f, "level").oninput = () => { const s = f.querySelector(".ln-repslot"); if (s) s.innerHTML = ""; };
      f.onsubmit = async ev => {
        ev.preventDefault(); err.textContent = "";
        const word = asTyped(fe(f, "word").value), zh = fe(f, "zh").value.trim(), sen = fe(f, "sen").value.replace(/\s+/g, " ").trim(), d = Math.round(+fe(f, "level").value);
        const bad = textIssue(word, zh, sen) || levelIssue(d); if (bad) { err.textContent = bad; return; }
        const dup = words.find(x => W.key(x.word) === W.key(word));
        if (dup) { err.textContent = "“" + dup.word + "” is already one of his words" + (dup.quest_day ? " (level " + dup.quest_day + ")" : !dup.approved ? " (in Words set aside)" : "") + "."; return; }
        if (!(await makeRoom(d, "lnRep", f, err))) return;
        const pr = poolRow(word), row = { student_id: student.id, word, chunks: pr && W.key(String(pr[1]).replace(/-/g, "")) === W.key(word) ? pr[1] : word, meaning_en: pr ? pr[2] : "", meaning_zh: zh, sentence_en: sen,
          sentence_zh: pr && pr[4] === sen ? pr[5] : "", approved: true, quest_day: d, level: 0, sort_order: nextOrder() };
        const { error } = await sb.from("words").insert(row);
        if (error) { err.textContent = error.message; return; }
        openFolds["wk" + (weekOf(d) ? "w" + weekOf(d).number : "")] = true;
        await reload();
      };
      fe(f, "word").focus();
    };
    view.querySelectorAll("[data-ln-pause]").forEach(b => b.onclick = async () => {
      b.disabled = true;
      if (await entryAside(lineItems[+b.dataset.lnPause])) await reload(); else b.disabled = false;
    });
    view.querySelectorAll("[data-ln-edit]").forEach(b => b.onclick = () => {
      const it = lineItems[+b.dataset.lnEdit], w = it.row || it.plan, li = b.closest(".ln-w"), box = li.querySelector(".ln-ed");
      const own = !!it.row && sourceOf(w.word, it.row) === "Your own word" && !(w.level > 0);
      box.hidden = false;
      box.innerHTML = wordForm({ id: "lnEdF", word: w.word, zh: w.meaning_zh, sen: w.sentence_en, lockWord: !own, go: "Save" });
      const f = box.querySelector("form"), err = f.querySelector("[data-err]");
      f.querySelector("[data-cancel]").onclick = () => { box.hidden = true; box.innerHTML = ""; };
      f.onsubmit = async ev => {
        ev.preventDefault(); err.textContent = "";
        const word = own ? asTyped(fe(f, "word").value) : w.word, zh = fe(f, "zh").value.trim(), sen = fe(f, "sen").value.replace(/\s+/g, " ").trim();
        const bad = textIssue(word, zh, sen); if (bad) { err.textContent = bad; return; }
        if (own && W.key(word) !== W.key(w.word) && words.some(x => x.id !== it.row.id && W.key(x.word) === W.key(word))) { err.textContent = "“" + word + "” is already one of his words."; return; }
        const patch = { meaning_zh: zh, sentence_en: sen };
        if (sen !== w.sentence_en) patch.sentence_zh = "";
        if (own && word !== w.word) { patch.word = word; const pr = poolRow(word); patch.chunks = pr && W.key(String(pr[1]).replace(/-/g, "")) === W.key(word) ? pr[1] : word; }
        let r;
        if (it.row) r = await sb.from("words").update(patch).eq("id", it.row.id);
        else if (it.plan.from === "waiting" && it.plan.id) r = await sb.from("words").update(Object.assign(patch, { quest_day: it.d })).eq("id", it.plan.id);
        else {   // an edited choice of the game is set on its level
          const p = it.plan, nr = Object.assign({ student_id: student.id, word: p.word, chunks: p.chunks || p.word, meaning_en: p.meaning_en || "", meaning_zh: p.meaning_zh || "", sentence_en: p.sentence_en || "", sentence_zh: p.sentence_zh || "", dialogue_q: p.dialogue_q || "", dialogue_a: p.dialogue_a || "", focus: p.focus || "", sounds: +p.sounds || 0, rule_en: p.rule_en || "", rule_zh: p.rule_zh || "", level: 0, sort_order: nextOrder(), approved: true, quest_day: it.d }, patch);
          r = await sb.from("words").insert(nr);
        }
        if (r.error) { err.textContent = r.error.message; return; }
        await reload();
      };
    });
  }
  function wireTray() {
    const reload = async () => { await loadAll(); drawWords(); };
    const row = id => words.find(x => x.id === id);
    view.querySelectorAll("[data-tr-old]").forEach(b => b.onclick = async () => {
      const t = W.today();
      const { error } = await sb.from("words").update({ approved: true, level: 1, due: W.addDays(t, 1), introduced_on: t, quest_day: null }).eq("id", b.dataset.trOld);
      if (error) { banner(error.message); return; }
      memoSet(b.dataset.trOld, null); await reload();
    });
    view.querySelectorAll("[data-tr-back]").forEach(b => b.onclick = async () => {
      const w = row(b.dataset.trBack), m = memoAll()[b.dataset.trBack] || {};
      if (!w) return;
      let r = null;
      if (m.planned && !w.level) r = await sb.from("words").delete().eq("id", w.id);   // the game's choice: it is the game's to choose again
      else if (m.waiting) r = await sb.from("words").update({ approved: true, quest_day: null }).eq("id", w.id);
      else if (m.level && !levelIssue(m.level) && levelWords(m.level).length < 2) r = await sb.from("words").update({ approved: true, quest_day: m.level }).eq("id", w.id);
      if (!r) { const p = b.closest("li").querySelector("[data-tr-put]"); if (p) p.click(); return; }   // its level has no room now: she chooses
      if (r.error) { banner(r.error.message); return; }
      memoSet(w.id, null); await reload();
    });
    view.querySelectorAll("[data-tr-put]").forEach(b => b.onclick = () => {
      const w = row(b.dataset.trPut), li = b.closest("li"), box = li.querySelector(".ln-ed"), m = memoAll()[w.id] || {};
      const lv = m.level && !levelIssue(m.level) ? m.level : firstFree();
      box.hidden = false;
      box.innerHTML = '<form class="form ln-form" autocomplete="off"><label class="f">Level<span class="fh">His next level is ' + nextLevel() + '.</span><input type="number" name="level" min="1" max="' + LEVELS + '" value="' + lv + '"></label>' +
        '<div class="ln-repslot wide"></div><div class="row wide"><button type="submit">Put it in this level</button><button type="button" class="ghost" data-cancel>Cancel</button><span class="err" data-err></span></div></form>';
      const f = box.querySelector("form"), err = f.querySelector("[data-err]");
      f.querySelector("[data-cancel]").onclick = () => { box.hidden = true; box.innerHTML = ""; };
      fe(f, "level").oninput = () => { f.querySelector(".ln-repslot").innerHTML = ""; };
      f.onsubmit = async ev => {
        ev.preventDefault(); err.textContent = "";
        const d = Math.round(+fe(f, "level").value), bad = levelIssue(d); if (bad) { err.textContent = bad; return; }
        if (!w.sentence_en || !W.hasWord(w.sentence_en, w.word) || !w.meaning_zh) { err.textContent = "This word needs its Chinese meaning and a sentence first: change it in “Add or change words yourself” below."; return; }
        if (!(await makeRoom(d, "trRep" + w.id, f, err))) return;
        const { error } = await sb.from("words").update({ approved: true, quest_day: d, level: 0 }).eq("id", w.id);
        if (error) { err.textContent = error.message; return; }
        memoSet(w.id, null); await reload();
      };
    });
  }
  // "Repeat…" beside a word he has learned: when it is asked again, and how many more times before he knows it well.
  // 3 more times = step 1, 2 more = step 2, 1 more = step 3 (W.TOP); the date is the day it is asked. After that the game's
  // own rules go on (right the first time: one up, gaps 1, 4, 14 days; not yet: one down, back tomorrow).
  const timesOf = w => w.level >= W.DIAMOND ? 0 : W.TOP + 1 - Math.min(Math.max(w.level, 1), W.TOP);
  function repeatPlan(date, n) {
    const out = ["He is asked on " + W.niceDate(date)];
    for (let lv = W.TOP + 2 - n; lv <= W.TOP; lv++) out.push("then " + W.INTERVALS[lv] + " days later");
    return out.join(", ") + ". Right each time, he knows it well after that.";
  }
  function wireRepeat() {
    view.querySelectorAll("[data-rep]").forEach(b => b.onclick = () => {
      const w = words.find(x => x.id === b.dataset.rep); if (!w) return;
      const slot = b.closest("li").querySelector(".rp-slot"), t = W.today();
      if (slot.innerHTML) { slot.innerHTML = ""; return; }
      const cur = timesOf(w), date0 = w.level >= W.DIAMOND || !w.due || w.due < t ? W.addDays(t, 1) : w.due;
      slot.innerHTML = '<form class="rp" autocomplete="off"><div class="rp-q"><b>Ask it again on</b><input type="date" name="date" value="' + date0 + '" min="' + t + '">' +
        [[1, "Tomorrow"], [4, "In 4 days"], [14, "In 14 days"]].map(([n, l]) => '<button type="button" class="ghost mini" data-rpd="' + n + '">' + l + "</button>").join("") + "</div>" +
        '<div class="rp-q"><b>How many more times before he knows it well</b>' + [1, 2, 3].map(n => '<label class="rp-n"><input type="radio" name="times" value="' + n + '"' + (n === (cur || 1) ? " checked" : "") + "> " + n + (n === cur ? ' <span class="muted">(now)</span>' : "") + "</label>").join("") +
        (cur ? "" : '<span class="muted">Now: he knows it well.</span>') + "</div>" +
        '<p class="rp-plan" aria-live="polite"></p><div class="row"><button type="submit">Save</button><button type="button" class="ghost" data-cancel>Cancel</button><span class="err" data-err></span></div></form>';
      const f = slot.querySelector("form"), plan = f.querySelector(".rp-plan");
      const show = () => { const n = +((f.querySelector('input[name="times"]:checked') || {}).value || 1); plan.textContent = fe(f, "date").value ? repeatPlan(fe(f, "date").value, n) : "Choose a day."; };
      f.querySelectorAll("[data-rpd]").forEach(x => x.onclick = () => { fe(f, "date").value = W.addDays(t, +x.dataset.rpd); show(); });
      fe(f, "date").oninput = show; fe(f, "date").onchange = show; f.querySelectorAll('input[name="times"]').forEach(x => x.onchange = show);
      f.querySelector("[data-cancel]").onclick = () => { slot.innerHTML = ""; };
      f.onsubmit = async ev => {
        ev.preventDefault();
        const n = +((f.querySelector('input[name="times"]:checked') || {}).value || 0), date = fe(f, "date").value;
        if (!date || date < t || !(n >= 1 && n <= 3)) { f.querySelector("[data-err]").textContent = "Choose a day from today on, and 1, 2 or 3."; return; }
        const patch = { level: W.TOP + 1 - n, due: date };
        const { error } = await sb.from("words").update(patch).eq("id", w.id);
        if (error) { f.querySelector("[data-err]").textContent = error.message; return; }
        Object.assign(w, patch); drawWords();
      };
      show();
    });
  }
  // ---------- old words, the monster game, which words come back (the tutor, 25 November) ----------
  // The page cannot call the game's code, so the game's rules are written here once more, line for line, and nowhere else on
  // this page: src/js/00-core.js dayState / openDay (two levels a day), CHECK_CAP, checksToday, dueReviews; 80-level.js
  // startQuest (a word in the monster game is asked there, not as an old word), islandTutor, islandMisses, islandChoice.
  // tests/test-teacher-words.js loads the game and this page on the same stand-in data and compares the lists they give.
  let owA = [];      // his tries of the kinds the monster game counts (new, review, test, mixed), loaded with the Words tab
  let owMsg = "";    // the one line under the old words after a change: what the game does with it
  let mgEdit = null; // her list for the monster game while she changes it (an array of words), or null
  const gWords = () => words.filter(w => w.approved);   // the game loads only the words he can see
  const gDayWords = d => gWords().filter(w => w.quest_day === d);
  const gMaxDay = () => Math.max(LEVELS, gWords().reduce((m, w) => Math.max(m, w.quest_day || 0), 0));
  const gDoneOn = d => { const r = questRow(d); return r && r.finished_at ? W.dkey(new Date(r.finished_at)) : null; };
  const gDoneToday = t => quests.filter(x => x.completed && x.finished_at && W.dkey(new Date(x.finished_at)) === t).length;
  function gDayState(d, t) {
    if (dayDone(d)) return "done";
    if (d === 1 ? (student.start_date || t) > t : !(dayDone(d - 1) && (gDoneOn(d - 1) < t || gDoneToday(t) < 2))) return "locked";
    if (student.pause_new && !questRow(d)) return "paused";
    return gDayWords(d).length || isTest(d) ? "open" : "empty";
  }
  const gOpenDay = t => { for (let d = 1; d <= gMaxDay(); d++) if (gDayState(d, t) === "open") return d; return null; };
  const gCap = () => student.review_cap || W.REVIEW_CAP;
  const gChecksToday = t => { const d = gOpenDay(t), r = d ? questRow(d) : null; return r && !r.completed && r.started_at && W.dkey(new Date(r.started_at)) === t ? (r.reviews_right || 0) + (r.reviews_wrong || 0) : 0; };
  const gDueAll = t => gWords().filter(w => w.level > 0 && w.level < W.DIAMOND && w.due && w.due <= t && w.last_seen !== t)
    .sort((a, b) => a.level !== b.level ? a.level - b.level : (a.due < b.due ? -1 : 1));
  const gDue = t => gDueAll(t).slice(0, Math.max(0, gCap() - gChecksToday(t)));
  const ISLAND_N = 10;
  function gIslandMap() { let m = student.island_words; if (typeof m === "string") { try { m = JSON.parse(m); } catch (e) { m = null; } } return m && typeof m === "object" && !Array.isArray(m) ? m : {}; }
  function gIslandTutor(level) {
    const list = gIslandMap()[String(level)];
    if (!Array.isArray(list) || !list.length) return [];
    const out = [];
    list.forEach(x => { const w = gWords().find(v => W.key(v.word) === W.key(x)); if (w && w.level > 0 && out.indexOf(w) < 0 && out.length < ISLAND_N) out.push(w); });
    return out;
  }
  function gMisses() {   // word id -> { n, last }: his first tries that were not right
    const by = {}, seen = new Set();
    owA.slice().sort((a, b) => String(a.created_at || "") < String(b.created_at || "") ? -1 : 1).forEach(a => {
      if (!a.word_id) return;
      if (a.kind === "mixed") { const k = a.quest_id + "|" + a.word_id + "|" + a.step; if (seen.has(k)) return; seen.add(k); }
      if (a.correct !== false) return;
      const e = by[a.word_id] || (by[a.word_id] = { n: 0, last: "" }); e.n++; if (String(a.created_at || "") > e.last) e.last = String(a.created_at || "");
    });
    return by;
  }
  function gIslandSystem(t) {
    const by = gMisses(), open = w => w.level > 0 && w.level < W.DIAMOND && w.last_seen !== t;
    return gWords().filter(w => open(w) && by[w.id] && by[w.id].n > 0)
      .sort((a, b) => by[b.id].n - by[a.id].n || (by[a.id].last < by[b.id].last ? 1 : by[a.id].last > by[b.id].last ? -1 : 0) || a.level - b.level)
      .slice(0, ISLAND_N);
  }
  const gIsland = (level, t) => { const mine = gIslandTutor(level); return mine.length ? { words: mine, by: "tutor" } : { words: gIslandSystem(t), by: "system" }; };
  // His next level and the day the old words are worked out for: a level open now, today; when today's levels are done, the
  // next one tomorrow (a level waiting for words, or paused, as if he started it now).
  function owNext() {
    const t = W.today(), d = gOpenDay(t);
    if (d) return { level: d, day: t, when: "now" };
    const tm = W.addDays(t, 1), n = nextLevel();
    if (n <= LEVELS && gDayState(n, t) === "locked" && gOpenDay(tm) === n) return { level: n, day: tm, when: "tomorrow" };
    return { level: n, day: t, when: n > LEVELS ? "none" : "notopen" };
  }
  // exactly the old words of his next level, in the game's order (a word of the monster game is asked there instead)
  function owNextWords(N) {
    const island = isTest(N.level) && !dayDone(N.level) ? gIsland(N.level, N.day).words : [];
    return gDue(N.day).filter(w => island.indexOf(w) < 0);
  }
  const MEET = { 1: "First meeting, after 1 day", 2: "Second meeting, after 4 days", 3: "Third meeting, after 14 days" };
  const reviewModeNow = () => student.review_mode === "once" || student.review_mode === "all" ? student.review_mode : "missed";
  const zhOf = w => w.meaning_zh ? ' <span class="zh muted" lang="zh-CN">' + esc(w.meaning_zh) + "</span>" : "";
  function owItem(w, inNext) {
    const t = W.today(), lv = Math.min(Math.max(w.level, 1), W.TOP);
    return '<li data-wid="' + w.id + '"><div class="ow-w"><b>' + esc(w.word) + "</b>" + zhOf(w) + '<span class="ow-s">' + MEET[lv] + "</span></div>" +
      '<div class="ow-a">' +
      (inNext ? '<span class="ow-in">In his next level</span>' : '<button type="button" class="ghost mini" data-ownow="' + w.id + '">Ask it in his next level</button>') +
      '<label class="ow-f">Move it to <input type="date" data-owdate="' + w.id + '" value="' + esc(w.due && w.due >= t ? w.due : t) + '" min="' + t + '"></label>' +
      '<label class="ow-f">Meeting <select data-owstep="' + w.id + '">' + [1, 2, 3].map(n => '<option value="' + n + '"' + (n === lv ? " selected" : "") + ">" + ["", "First", "Second", "Third"][n] + "</option>").join("") + "</select></label>" +
      '<button type="button" class="ghost mini" data-owfin="' + w.id + '">Finished: do not ask again</button></div></li>';
  }
  function owGroupName(k, t) {
    const n = Math.round((new Date(k + "T00:00:00") - new Date(t + "T00:00:00")) / 864e5);
    return (n === 1 ? "Tomorrow" : "In " + n + " days") + " · " + esc(day3(k));
  }
  function oldWordsHtml() {
    const t = W.today(), N = owNext(), next = N.when === "none" ? [] : owNextWords(N), mode = reviewModeNow();
    const ladderW = gWords().filter(w => w.level > 0 && w.level < W.DIAMOND);
    const finished = gWords().filter(w => w.level >= W.DIAMOND).sort((a, b) => W.key(a.word) < W.key(b.word) ? -1 : 1);
    const head = '<div class="bh"><h2>Old words</h2></div><p class="lead">Words he learned before come back on set days. Each level asks at most ' + gCap() +
      " of them: the earliest meetings and the longest waiting first.</p>";
    let nextHtml;
    const nTitle = N.when === "none" ? "" : "In his next level (level " + N.level + (N.when === "tomorrow" ? ", tomorrow" : "") + ")";
    if (N.when === "none") nextHtml = "";
    else if (next.length) nextHtml = '<h3 class="ow-h">' + nTitle + '</h3><p class="ow-note">In this order. ' + (N.when === "notopen" ? "Level " + N.level + " is not open yet; this is the list if he started it now." : N.when === "tomorrow" ? "He has played his levels for today." : "If he started a level now.") + "</p>" +
      '<ol class="ow-list" id="owNext">' + next.map(w => owItem(w, true)).join("") + "</ol>";
    else nextHtml = '<h3 class="ow-h">' + nTitle + '</h3><p class="ow-none" id="owNext">' + (ladderW.length ? "No old words in his next level." : mode === "missed" ? "No old words now. Words he spells right the first time are finished at once." : "No old words now.") + "</p>";
    const later = ladderW.filter(w => next.indexOf(w) < 0);
    const isl = N.when !== "none" && isTest(N.level) && !dayDone(N.level) ? gIsland(N.level, N.day).words : [];
    const groups = {}, ORD = { isl: "0", wait: "1", seen: "2" };
    later.forEach(w => {
      const k = !w.due || w.due <= N.day ? (w.last_seen === N.day ? "seen" : isl.indexOf(w) >= 0 ? "isl" : "wait") : w.due;
      (groups[k] = groups[k] || []).push(w);
    });
    const keys = Object.keys(groups).sort((a, b) => (ORD[a] || a) < (ORD[b] || b) ? -1 : 1);
    const laterHtml = '<h3 class="ow-h">Coming back later</h3>' + (keys.length ? keys.map(k =>
      '<div class="ow-day"><h4>' + (k === "isl" ? "Ready now, asked in the monster game of level " + N.level + " instead" : k === "wait" ? "Waiting now: more than " + gCap() + " are ready, so these come in a later level" : k === "seen" ? "He met these today: they come in his next level tomorrow" : owGroupName(k, t)) + "</h4>" +
      '<ul class="ow-list">' + groups[k].map(w => owItem(w, false)).join("") + "</ul></div>").join("") : '<p class="ow-none">No other word is coming back.</p>');
    const finHtml = finished.length ? '<details class="ow-fin" id="owFin"' + (openFolds.owFin ? " open" : "") + '><summary>Finished words, not asked again (' + finished.length + ')</summary><ul class="ow-list">' +
      finished.map(w => '<li data-wid="' + w.id + '"><div class="ow-w"><b>' + esc(w.word) + "</b>" + zhOf(w) + '</div><div class="ow-a"><button type="button" class="ghost mini" data-rep="' + w.id + '">Bring it back</button></div><div class="rp-slot"></div></li>').join("") + "</ul></details>" : "";
    return head + nextHtml + laterHtml + finHtml + '<p class="ow-msg" id="owMsg" aria-live="polite">' + esc(owMsg) + "</p>";
  }
  function drawOld() { const el = $("oldW"); if (!el) return; el.innerHTML = oldWordsHtml(); wireOld(); }
  async function owSave(w, patch, say) {
    const { error } = await sb.from("words").update(patch).eq("id", w.id);
    if (error) { owMsg = "Not saved: " + error.message; drawOld(); return; }
    Object.assign(w, patch); owMsg = say(); drawOld(); drawMonster();
  }
  function wireOld() {
    const root = $("oldW"); if (!root) return;
    const byId = id => words.find(x => x.id === id), t = W.today();
    const fin = root.querySelector("#owFin"); if (fin) fin.ontoggle = () => { openFolds.owFin = fin.open; };
    root.querySelectorAll("[data-ownow]").forEach(b => b.onclick = () => { const w = byId(b.dataset.ownow); if (w) owSave(w, { due: t }, () => {
      const N = owNext(); if (owNextWords(N).indexOf(w) >= 0) return "Saved. The game asks “" + w.word + "” in his next level.";
      return w.last_seen === t ? "Saved. He met “" + w.word + "” today already, so the game asks it in his first level tomorrow." : "Saved. “" + w.word + "” is ready now; " + gCap() + " other old words come first, so it comes in the level after.";
    }); });
    root.querySelectorAll("[data-owdate]").forEach(x => x.onchange = () => {
      const w = byId(x.dataset.owdate), v = x.value; if (!w || !v) return;
      if (v < t) { owMsg = "Choose a day from today on."; drawOld(); return; }
      owSave(w, { due: v }, () => v === t ? "Saved. “" + w.word + "” is ready today." : "Saved. The game asks “" + w.word + "” in his first level on or after " + day3(v) + ".");
    });
    root.querySelectorAll("[data-owstep]").forEach(x => x.onchange = () => {
      const w = byId(x.dataset.owstep), n = +x.value; if (!w || !(n >= 1 && n <= 3)) return;
      owSave(w, w.due ? { level: n } : { level: n, due: W.addDays(t, 1) }, () => "Saved. “" + w.word + "” is on its " + ["", "first", "second", "third"][n] + " meeting. Right the first time, it moves on to the next one; if not yet, it goes back one and comes again the next day.");
    });
    root.querySelectorAll("[data-owfin]").forEach(b => b.onclick = () => { const w = byId(b.dataset.owfin); if (w) owSave(w, { level: W.DIAMOND, due: null }, () => "Saved. “" + w.word + "” is finished: the game does not ask it again. “Bring it back” under Finished words undoes it."); });
    wireRepeat();
  }
  // ---- the monster game: the next island test (every 10th level) ----
  const nextIsland = () => { let d = nextLevel(); while (d <= LEVELS && (!isTest(d) || dayDone(d))) d++; return d <= LEVELS ? d : null; };
  function monsterHtml() {
    const t = W.today(), L = nextIsland(), now = nextLevel();
    const head = '<div class="bh"><h2>The monster game</h2></div>';
    if (!L) return head + '<p class="lead">No island test is left.</p>';
    const away = L - now, by = gMisses();
    const missN = w => (by[w.id] && by[w.id].n) || 0;
    const when = away <= 0 ? "Level " + L + " is his next level: an island test." : "Level " + L + " is the next island test, " + many(away, "level") + " from now (his next level is " + now + ").";
    const sys = gIslandSystem(t), mine = gIslandTutor(L), saved = gIslandMap()[String(L)];
    const savedList = Array.isArray(saved) ? saved : [];
    const dropped = savedList.filter(x => !mine.some(w => W.key(w.word) === W.key(x)));
    const metToday = gWords().filter(w => w.level > 0 && w.level < W.DIAMOND && w.last_seen === t && missN(w) > 0);
    const timesN = n => n === 1 ? "missed once" : n === 2 ? "missed twice" : "missed " + n + " times";
    const sysHtml = '<div class="mg-col"><h3>The game’s choice now</h3>' + (sys.length
      ? '<ol class="mg-list" id="mgGame">' + sys.map(w => '<li><b>' + esc(w.word) + "</b>" + zhOf(w) + ' <span class="mg-n">' + timesN(missN(w)) + "</span></li>").join("") + "</ol>"
      : '<p class="ow-none" id="mgGame">' + (metToday.length ? "None yet." : "He has missed no word that is still coming back.") + "</p>") +
      (metToday.length ? '<p class="ow-note">Missed today: ' + metToday.map(w => esc(w.word)).join(", ") + ". Words he meets on a day are left out of that day’s choice, so " + (metToday.length === 1 ? "it counts" : "they count") + " from tomorrow.</p>" : "") +
      '<p class="ow-note">The words he missed most, then the ones he missed last. Up to ' + ISLAND_N + ", never filled up with other words. Finished words and words he meets that day are left out. This changes as he plays.</p></div>";
    let herHtml;
    if (mgEdit) {
      const taught = gWords().filter(w => w.level > 0).sort((a, b) => missN(b) - missN(a) || (W.key(a.word) < W.key(b.word) ? -1 : 1));
      const on = x => mgEdit.some(y => W.key(y) === W.key(x));
      herHtml = '<div class="mg-col mg-ed"><h3>Your own list</h3><p class="ow-note">Tick up to ' + ISLAND_N + " words he has learned, or type one. They come in the order you add them.</p>" +
        '<ol class="mg-list" id="mgMine">' + (mgEdit.length ? mgEdit.map((x, i) => '<li><b>' + esc(x) + '</b> <button type="button" class="ghost mini" data-mgdel="' + i + '" aria-label="Take out ' + esc(x) + '">Take out</button></li>').join("") : "") + "</ol>" + (mgEdit.length ? "" : '<p class="ow-none">No word yet.</p>') +
        '<form class="mg-type" id="mgType" autocomplete="off"><input type="text" name="w" placeholder="Type a word of his" spellcheck="false" aria-label="Type a word of his"><button type="submit" class="ghost mini">Add</button></form>' +
        '<p class="err" id="mgErr" aria-live="polite"></p>' +
        '<div class="mg-ticks">' + (taught.length ? taught.map(w => '<label class="mg-tick"><input type="checkbox" data-mgtick="' + esc(w.word) + '"' + (on(w.word) ? " checked" : "") + "> <b>" + esc(w.word) + "</b>" + (missN(w) ? ' <span class="mg-n">' + timesN(missN(w)) + "</span>" : "") + "</label>").join("") : '<p class="ow-none">He has not learned any word yet.</p>') + "</div>" +
        '<div class="row"><button type="button" id="mgSave">Save my list</button><button type="button" class="ghost" id="mgCancel">Cancel</button></div></div>';
    } else {
      herHtml = '<div class="mg-col"><h3>Your own list</h3>' + (mine.length
        ? '<ol class="mg-list" id="mgMine">' + mine.map(w => '<li><b>' + esc(w.word) + "</b>" + zhOf(w) + "</li>").join("") + "</ol>" +
          (dropped.length ? '<p class="ow-note">Left out, he has not learned ' + (dropped.length === 1 ? "it" : "them") + " yet: " + dropped.map(esc).join(", ") + ".</p>" : "")
        : '<p class="ow-none" id="mgMine">' + (savedList.length ? "None of your words has been learned yet, so the game uses its own choice." : "No list of yours for level " + L + ".") + "</p>") +
        '<div class="row"><button type="button" class="ghost" id="mgEditBtn">' + (savedList.length ? "Change my list" : "Make my own list") + "</button>" +
        (savedList.length ? '<button type="button" class="ghost" id="mgGameBtn">Use the game’s choice</button>' : "") + "</div></div>";
    }
    const use = mine.length ? mine : sys;
    const verdict = use.length ? '<p class="mg-use" id="mgUse"><b>On level ' + L + ":</b> the monster game asks " + many(use.length, "word") + ", from " + (mine.length ? "your list" : "the game’s choice") + ".</p>"
      : '<p class="mg-use" id="mgUse">No monster game on level ' + L + " yet: " + (metToday.length ? "the words he missed were met today; they count from tomorrow." : "he has missed no word.") + " The level still has his old words.</p>";
    return head + '<p class="lead">' + when + " In it, a monster game asks the words he missed. You can choose them yourself.</p>" + verdict + '<div class="mg-cols">' + sysHtml + herHtml + "</div>" +
      '<p class="ow-msg" id="mgMsg" aria-live="polite"></p>';
  }
  function drawMonster(msg) { const el = $("monster"); if (!el) return; el.innerHTML = monsterHtml(); wireMonster(); if (msg) $("mgMsg").textContent = msg; }
  async function mgStore(L, list) {
    const m = Object.assign({}, gIslandMap()); if (list && list.length) m[String(L)] = list; else delete m[String(L)];
    const { error } = await sb.from("students").update({ island_words: m }).eq("id", student.id);
    if (error) return error.message;
    student.island_words = m; return "";
  }
  function wireMonster() {
    const L = nextIsland(); if (!L) return;
    const eb = $("mgEditBtn"); if (eb) eb.onclick = () => { const s = gIslandMap()[String(L)]; mgEdit = Array.isArray(s) ? s.slice(0, ISLAND_N) : []; drawMonster(); };
    const gb = $("mgGameBtn"); if (gb) gb.onclick = async () => { const e = await mgStore(L, null); drawMonster(e ? "Not saved: " + e : "Saved. Level " + L + " uses the game’s choice."); };
    if (!mgEdit) return;
    const err = m => { $("mgErr").textContent = m; };
    const add = x => {
      const w = gWords().find(v => W.key(v.word) === W.key(x));
      if (!w || !(w.level > 0)) { err("He has not learned “" + x + "” yet. Only words he has learned can go in."); return false; }
      if (mgEdit.some(y => W.key(y) === W.key(w.word))) { err("“" + w.word + "” is in your list already."); return false; }
      if (mgEdit.length >= ISLAND_N) { err("Your list has " + ISLAND_N + " words. Take one out first."); return false; }
      mgEdit.push(w.word); return true;
    };
    $("mgType").onsubmit = ev => { ev.preventDefault(); const v = asTyped($("mgType").querySelector("input").value); if (!v) return; if (add(v)) drawMonster(); };
    $("monster").querySelectorAll("[data-mgtick]").forEach(c => c.onchange = () => {
      const x = c.dataset.mgtick;
      if (c.checked) { if (!add(x)) { c.checked = false; return; } } else mgEdit = mgEdit.filter(y => W.key(y) !== W.key(x));
      drawMonster();
    });
    $("monster").querySelectorAll("[data-mgdel]").forEach(b => b.onclick = () => { mgEdit.splice(+b.dataset.mgdel, 1); drawMonster(); });
    $("mgCancel").onclick = () => { mgEdit = null; drawMonster(); };
    $("mgSave").onclick = async () => {
      const list = mgEdit.slice(); const e = await mgStore(L, list);
      if (e) { err("Not saved: " + e); return; }
      mgEdit = null; drawMonster(list.length ? "Saved. Level " + L + " asks your " + many(list.length, "word") + ", in your order." : "Saved. Your list is empty, so level " + L + " uses the game’s choice.");
    };
  }
  // ---- which words come back: students.review_mode (also in Settings) ----
  const MODES = [["missed", "Only words he missed", "A word he spells right the first time is finished. A word he missed comes back after 1, 4 and 14 days."],
    ["once", "Right words come back once, the next day", "A word he spells right comes back one more time, the next day. A word he missed comes back after 1, 4 and 14 days."],
    ["all", "Every word comes back after 1, 4 and 14 days", "Every new word comes back three times, then it is finished."]];
  function modeHtml(id) {
    const cur = reviewModeNow();
    return '<div class="bh"><h2>Which words come back</h2></div><div class="rm-opts" role="radiogroup" aria-label="Which words come back">' +
      MODES.map(([v, l, s]) => '<label class="rm' + (v === cur ? " on" : "") + '"><input type="radio" name="' + id + '" value="' + v + '"' + (v === cur ? " checked" : "") + "><span><b>" + l + '</b><span class="fh">' + s + "</span></span></label>").join("") +
      '</div><p class="ow-note">Saved at once. Words already coming back keep their day when you change this.</p><p class="ok" data-rmok aria-live="polite"></p>';
  }
  function wireMode(box, id, after) {
    if (!box) return;
    box.querySelectorAll('input[name="' + id + '"]').forEach(r => r.onchange = async () => {
      const v = r.value, ok = box.querySelector("[data-rmok]");
      const { error } = await sb.from("students").update({ review_mode: v }).eq("id", student.id);
      if (error) { ok.className = "err"; ok.textContent = "Not saved: " + error.message; return; }
      student.review_mode = v; box.querySelectorAll(".rm").forEach(l => l.classList.toggle("on", l.querySelector("input").checked));
      if (after) after();
      const ok2 = box.querySelector("[data-rmok]"); if (ok2) { ok2.className = "ok"; ok2.textContent = "Saved. From now on: " + MODES.find(m => m[0] === v)[1].toLowerCase() + "."; }
    });
  }
  // The difficulty the word choice uses now, as one plain line under "How the game chooses his words".
  async function bandLine() {
    const P = window.WW_PICKER, el = $("wBand"); if (!P || !el || student.picker === false) return;
    const next = nextLevel();
    if (next > LEVELS || next < 4) return;
    try { const B = P.bandFor({ quests, attempts: lineAE.A, events: lineAE.E, words, level: next }); el.textContent = "Now: difficulty " + B.band + " on a scale from 1 (easiest) to 9 (hardest)."; } catch (x) { }
  }
  // The tools to add and change words by hand (kept in a fold on the Words tab): every word with all its details.
  function wordTools() {
    const t = W.today();
    const rows = words.map(w => '<tr data-id="' + w.id + '"><td>' + (w.quest_day ? "<b>" + w.quest_day + "</b>" + (isTest(w.quest_day) ? '<br><span class="muted">test</span>' : "") : '<span class="tagw">none yet</span>') + "</td><td>" + picHtml(w) + "</td><td><b>" + esc(w.word) + '</b><br><span class="muted">' + esc(w.chunks) + (w.focus ? ' · letters in colour <b class="hot">' + esc(w.focus) + "</b>" : "") + "</span>" + "</td>" +
      "<td>" + esc(w.meaning_en) + '<br><span class="muted zh">' + esc(w.meaning_zh) + "</span></td>" +
      "<td>" + (w.approved ? '<span class="tagok">in the game</span>' : '<span class="tagw">hidden</span>') + "</td>" +
      "<td>" + (ladder[w.level] || "") + (w.level > 0 && w.level < W.DIAMOND ? '<br><span class="muted">next on ' + (w.due <= t ? "today" : esc(w.due)) + "</span>" : "") + (w.wrong_streak ? '<br><span class="ny">not yet right ' + w.wrong_streak + " times in a row</span>" : "") + (w.level > 0 ? '<br><button type="button" class="ghost mini" data-retest="' + w.id + '">Add to tomorrow\'s game</button>' : "") + "</td>" +
      "<td>" + esc(w.student_sentence) + '</td><td><button type="button" class="ghost mini" data-edit="' + w.id + '">Change</button></td></tr>').join("");
    return '<p class="lead">Every word with all its details: the beats, a picture, the letters in colour, the spelling rule, the short talk. A word you add or paste here is hidden from him: it waits in “Words set aside” until you put it in a level.</p>' +
      '<div class="row"><button type="button" id="addBtn">Add a word with every detail</button><button type="button" class="ghost" id="bulkBtn">Paste many words</button></div>' +
      '<div id="editor"></div>' +
      '<h3>All his words <small class="muted">' + words.filter(w => w.approved && w.level === 0).length + " still to learn, " + words.filter(w => w.level > 0).length + " learned, " + setAside().length + " set aside</small></h3>" +
      (words.length ? '<div class="scroll"><table class="wt"><tr><th>Level</th><th></th><th>Word</th><th>Meaning</th><th>Can he see it?</th><th>How well he knows it</th><th>His sentence</th><th></th></tr>' + rows + "</table></div>" : '<p class="lead">No words yet. Add a word, or paste many at once.</p>');
  }
  function wireWordTools() {
    $("addBtn").onclick = () => editor(null);
    $("bulkBtn").onclick = bulk;
    view.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => editor(words.find(w => w.id === b.dataset.edit)));
  }
  // A word's checks. Returns an error line or "". The word is kept as typed; duplicates are found with W.key.
  function checkWord(word, chunks, sen, dq, da, focus, selfId) {
    if (!word) return "Type the word first.";
    if (!wordOk(word)) return "Only letters, apostrophes (') and hyphens (-) in a word.";
    const dup = words.find(x => x.id !== selfId && W.key(x.word) === W.key(word));
    if (dup) return '"' + dup.word + '" is already in the list' + (dup.quest_day ? " (level " + dup.quest_day + ")" : "") + ".";
    if (W.key(chunks.replace(/-/g, "")) !== W.key(word)) return "The parts must spell the word exactly.";
    if (sen && !W.hasWord(sen, word)) return "The sentence must contain the word.";
    if ((dq || da) && !(dq && da)) return "The short talk needs both lines, or leave both empty.";
    if (da && !W.hasWord(da, word)) return "His answer in the short talk must contain the word.";
    if (focus && W.key(word).indexOf(focus) === -1) return "The letters in colour must be in the word.";
    return "";
  }
  function editor(w) {
    const v = k => esc(w ? w[k] : "");
    $("editor").innerHTML = '<form id="wf" class="form edit">' +
      '<label class="f">Word (kept as typed: February, don\'t)<input type="text" id="f_word" value="' + v("word") + '" ' + (w && w.level > 0 ? "readonly" : "") + "></label>" +
      '<label class="f">Parts of the word, as he claps them (um-brel-la)<input type="text" id="f_chunks" value="' + v("chunks") + '"></label>' +
      '<label class="f">Picture (a photo or a saved picture)<input type="file" id="f_pic" accept="image/*">' + (w && w.picture ? '<img src="' + w.picture + '" alt="" class="prev">' : "") + "</label>" +
      '<label class="f">Letters in colour (the spelling rule, for example ll)<input type="text" id="f_focus" value="' + v("focus") + '" maxlength="6"></label>' +
      '<label class="f">Spelling rule, one line (shown with the word)<input type="text" id="f_rule" value="' + v("rule_en") + '" placeholder="After a short vowel, double the letter"></label>' +
      '<label class="f">Spelling rule in Chinese<input type="text" id="f_rulezh" value="' + v("rule_zh") + '"></label>' +
      '<label class="f">Place in the list<input type="number" id="f_order" value="' + (w ? w.sort_order : (words.length ? Math.max(...words.map(x => x.sort_order)) + 1 : 1)) + '"></label>' +
      '<label class="f">Level (1 to 50, or empty for none yet)<input type="number" id="f_day" min="1" max="99" value="' + (w && w.quest_day ? w.quest_day : "") + '"></label>' +
      '<label class="f">Meaning (simple English)<input type="text" id="f_en" value="' + v("meaning_en") + '"></label>' +
      '<label class="f">Meaning (中文)<input type="text" id="f_zh" value="' + v("meaning_zh") + '"></label>' +
      '<label class="f wide">Sentence (must contain the word)<input type="text" id="f_sen" value="' + v("sentence_en") + '"></label>' +
      '<label class="f wide">Sentence (中文)<input type="text" id="f_szh" value="' + v("sentence_zh") + '"></label>' +
      '<label class="f wide">Short talk: what the game asks him (for example What did you build today?)<input type="text" id="f_dq" value="' + v("dialogue_q") + '"></label>' +
      '<label class="f wide">Short talk: the answer he picks (must contain the word)<input type="text" id="f_da" value="' + v("dialogue_a") + '"></label>' +
      '<label class="f"><span>Can he see it?</span><select id="f_ok"><option value="false"' + (w && w.approved ? "" : " selected") + '>not yet (hidden)</option><option value="true"' + (w && w.approved ? " selected" : "") + ">yes, it is in the game</option></select></label>" +
      '<div class="row wide"><button type="submit">Save</button><button type="button" class="ghost" id="cancel">Cancel</button>' + (w ? '<button type="button" class="red" id="del">Delete</button>' : "") + '<span class="err" id="ferr"></span></div></form>';
    $("cancel").onclick = () => $("editor").innerHTML = "";
    if ($("del")) $("del").onclick = async () => {
      if (w.level > 0 && !$("del").dataset.sure) { $("del").dataset.sure = "1"; $("del").textContent = "Delete it? He has started to learn it."; return; }
      const { error } = await sb.from("words").delete().eq("id", w.id); if (error) banner(error.message); await loadAll(); renderWords();
    };
    $("wf").onsubmit = async e => {
      e.preventDefault();
      const word = asTyped($("f_word").value), chunks = cleanBeats($("f_chunks").value) || word.replace(/[\s]/g, "");
      const sen = $("f_sen").value.trim(), dq = $("f_dq").value.trim(), da = $("f_da").value.trim(), focus = W.key($("f_focus").value);
      const err = checkWord(word, chunks, sen, dq, da, focus, w && w.id);
      if (err) { $("ferr").textContent = err; return; }
      const lv = +$("f_day").value || null;
      if ($("f_ok").value === "true" && lv && words.filter(x => x.approved && x.quest_day === lv && (!w || x.id !== w.id)).length >= 2) {
        $("ferr").textContent = "Level " + lv + " already has 2 words. On the line above, add it as your own word to choose which word it replaces."; return; }
      const row = { student_id: student.id, word, chunks, sort_order: +$("f_order").value || 0, quest_day: +$("f_day").value || null, meaning_en: $("f_en").value.trim(), meaning_zh: $("f_zh").value.trim(), sentence_en: sen, sentence_zh: $("f_szh").value.trim(), dialogue_q: dq, dialogue_a: da, approved: $("f_ok").value === "true",
        focus, rule_en: $("f_rule").value.trim(), rule_zh: $("f_rulezh").value.trim() };
      const f = $("f_pic").files && $("f_pic").files[0]; if (f) { const data = await W.shrinkImage(f, 480); if (data) row.picture = data; else { $("ferr").textContent = "That picture could not be read."; return; } }
      const r = w ? await sb.from("words").update(row).eq("id", w.id) : await sb.from("words").insert(row);
      if (r.error) { $("ferr").textContent = r.error.message; return; }
      await loadAll(); renderWords();
    };
  }
  function bulk() {
    $("editor").innerHTML = '<div class="edit"><p class="muted">Copy the words from a spreadsheet and paste them here: one word a line, one column for each part, in this order: word, parts of the word, meaning in English, meaning in Chinese, sentence, sentence in Chinese, (leave empty), short talk question, his answer, level, letters in colour, (leave empty), spelling rule, spelling rule in Chinese. Everything after the sentence in Chinese can stay empty. The words stay hidden from him until you check them and put them in the game.</p>' +
      '<textarea id="bulkTxt" rows="8" placeholder="remember\tre-mem-ber\tto keep something in your mind\t记住\tI always remember where I hid my diamonds.\t我总是记得我把钻石藏在哪里。\t\tWhat did you build today?\tI remember, I built a big tower!"></textarea>' +
      '<div class="row"><button type="button" id="bulkGo">Add these words</button><button type="button" class="ghost" id="cancel">Cancel</button><span class="err" id="berr"></span></div></div>';
    $("cancel").onclick = () => $("editor").innerHTML = "";
    $("bulkGo").onclick = async () => {
      let order = words.length ? Math.max(...words.map(x => x.sort_order)) : 0;
      const rows = [], bad = [], keys = new Set();
      $("bulkTxt").value.split(/\r?\n/).forEach(line => {
        if (!line.trim()) return;
        const p = line.split("\t").map(x => x.trim());
        const word = asTyped(p[0] || ""), chunks = cleanBeats(p[1] || "") || word, dq = p[7] || "", da = p[8] || "", focus = W.key(p[10] || "");
        if (checkWord(word, chunks, p[4], dq, da, focus, null) || keys.has(W.key(word))) { bad.push(p[0]); return; }
        keys.add(W.key(word));
        rows.push({ student_id: student.id, word, chunks, meaning_en: p[2] || "", meaning_zh: p[3] || "", sentence_en: p[4] || "", sentence_zh: p[5] || "", emoji: "", dialogue_q: dq, dialogue_a: da, quest_day: +p[9] || null, focus, sounds: Math.max(0, +p[11] || 0), rule_en: p[12] || "", rule_zh: p[13] || "", sort_order: ++order, approved: false });
      });
      if (bad.length) { $("berr").textContent = "Check these lines (the parts, the sentence or his answer do not match the word, only one short talk line, or the word is already in the list): " + bad.join(", "); return; }
      if (!rows.length) return;
      const { error } = await sb.from("words").insert(rows);
      if (error) { $("berr").textContent = error.message; return; }
      await loadAll(); renderWords();
    };
  }

  // ---------- everything the game saved on one day (Settings, folded) ----------
  // The game's own names for what happened, in plain words. A name not listed here is shown with its underscores as spaces.
  const EVENT_WORDS = {
    quest_start: "Started a level", quest_complete: "Finished a level", quest_pause: "Stopped between two parts", part_done: "Finished a part of the level",
    practice_start: "Started to practise", sentence_saved: "Wrote a sentence", sentence_copied: "Copied a sentence", sentence_skipped: "Left out a sentence",
    drawn: "Wrote a word by hand", clap: "Clapped the parts of a word", zh_toggle: "Turned the Chinese on or off", zh_shown: "Looked at the Chinese",
    card_heard: "Listened to a word", guide_again: "Listened to the guide again", story_opened: "Opened the story", story_heard: "Listened to the story",
    hint: "Pressed for help", rescue: "Looked at the word and copied it", picked: "The game chose new words", pin_wrong: "PIN typed, not yet right",
    game_meaning: "Played the meaning game", game_sentence: "Played the sentence game", mail_opened: "Opened his mailbox",
    old_start: "Started his old words (no new words for now)", old_done: "Finished his old words (no new words for now)"
  };
  const KIND_WORDS = { new: "new word", review: "word from before", retry: "second go", test: "island test", mixed: "mixed round", training: "extra practice",
    school: "school list word", school_retry: "school list word, second go", school_test: "practice dictation", probe: "word never taught", sentence: "sentence" };
  const eventName = e => e.type === "speech" ? (e.detail && e.detail.clip ? (e.detail.ok === false ? "A recording did not play" : "The recordings played") : e.detail && e.detail.ok === false ? "His laptop's own voice did not start" : "His laptop's own voice worked") : EVENT_WORDS[e.type] || e.type.replace(/_/g, " ");
  async function renderLog(day) {
    day = day || W.today();
    const body = $("logBody"); if (!body) return;
    const from = new Date(day + "T00:00:00").toISOString(), to = new Date(W.addDays(day, 1) + "T00:00:00").toISOString();
    const [att, ev] = await Promise.all([
      sb.from("attempts").select("*").eq("student_id", student.id).gte("created_at", from).lt("created_at", to).order("created_at"),
      sb.from("events").select("*").eq("student_id", student.id).gte("created_at", from).lt("created_at", to).order("created_at")
    ]);
    if (!$("logBody")) return;
    // the details, short: "word: umbrella · minutes: 5"; never a picture or a sound
    const shown = d => { const o = Object.assign({}, d); ["png", "audio"].forEach(k => delete o[k]); const ks = Object.keys(o); return ks.length ? ' <span class="muted">' + esc(ks.map(k => k.replace(/_/g, " ") + ": " + (o[k] !== null && typeof o[k] === "object" ? JSON.stringify(o[k]) : o[k])).join(" · ")) + "</span>" : ""; };
    const items = (att.data || []).map(a => ({ t: a.created_at, h: "<b>" + esc(a.word) + "</b> " + esc(KIND_WORDS[a.kind] || a.kind || "") + ': he wrote "' + esc(a.answer) + '" <span class="' + (a.correct ? "good" : "ny") + '">' + (a.correct ? "right" : "not yet") + "</span>" }))
      .concat((ev.data || []).filter(e => e.type !== "voice" && e.type !== "say").map(e => ({ t: e.created_at, h: esc(eventName(e)) + shown(e.detail || {}) })))
      .sort((a, b) => a.t < b.t ? -1 : 1);
    body.innerHTML = '<div class="row"><label class="f inl">Day <input type="date" id="day" value="' + day + '"></label><button type="button" class="ghost" id="csv">Save all his answers as a spreadsheet file</button></div>' +
      (items.length ? '<div class="log">' + items.map(i => "<div><time>" + W.fmtTime(i.t) + "</time><span>" + i.h + "</span></div>").join("") + "</div>" : '<p class="lead">Nothing on this day.</p>');
    $("day").onchange = () => renderLog($("day").value);
    $("csv").onclick = async () => {
      const { data } = await sb.from("attempts").select("*").eq("student_id", student.id).order("created_at");
      const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
      const csv = ["created_at,word,question,kind,answer,correct,level_before,level_after"].concat((data || []).map(a => [a.created_at, a.word, a.step, a.kind, a.answer, a.correct, a.level_before, a.level_after].map(q).join(","))).join("\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "word-world-answers.csv"; a.click();
    };
  }

  // ---------- Settings: the technical parts, each with one plain sentence ----------
  function renderSettings() {
    view.innerHTML = '<div class="settings">' +
      '<p class="intro">The things you set once. Each part says what it does.</p>' +
      loginCard() + detailsCard() + '<section class="box rmode" id="rmSet">' + modeHtml("rms") + "</section>" + voiceCard() +
      '<section class="box" id="pkBox"><div class="bh"><h2>Choosing his new words</h2></div><p class="lead">Loading…</p></section>' +
      '<details class="box fold" id="logBox"' + (openFolds.logBox ? " open" : "") + '><summary><span class="sum-t">Everything the game saved</span><span class="sum-s">A list of everything he did in the game, day by day. You will rarely need it.</span></summary><div id="logBody"><p class="lead">Loading…</p></div></details>' +
      "</div>";
    view.querySelector("#logBox").ontoggle = e => { openFolds.logBox = e.target.open; };
    wireVoice(); wireMode($("rmSet"), "rms");
    $("lgf").onsubmit = async e => {
      e.preventDefault();
      const pw = $("s_pw").value.replace(PW_WS, "");
      $("lgok").textContent = ""; $("lgok").className = "ok";
      if (!pwOk(pw, student.name)) { $("lgok").className = "err"; $("lgok").textContent = "At least 6 letters or numbers. Not his name. Not 123456."; $("s_pw").focus(); return; }
      const { error } = await sb.from("students").update({ pin: pw }).eq("id", student.id);
      if (error) banner(error.message); else { await loadAll(); renderSettings(); $("lgok").textContent = "Saved."; }
    };
    $("stf").onsubmit = async e => {
      e.preventDefault();
      const n = (id, d, lo, hi) => { const x = Math.round(+$(id).value); return isFinite(x) && $(id).value !== "" ? Math.max(lo, Math.min(hi, x)) : d; };
      $("sok").textContent = ""; $("sok").className = "ok";
      const { error } = await sb.from("students").update({ name: $("s_name").value.trim(), teacher_name: $("s_tn").value.trim() || "WordWizard", new_per_day: n("s_new", 2, 1, 5), start_date: $("s_start").value || W.today(),
        review_cap: n("s_cap", W.REVIEW_CAP, 1, 30), play_minutes: n("s_play", 10, 0, 60) }).eq("id", student.id);
      if (error) banner(error.message); else { await loadAll(); const r = !pwOk(student.pin, student.name); $("lgRed").hidden = !r; $("sok").textContent = "Saved."; }
    };
    pickerBox();
    renderLog();
  }
  // His login: name and password (26 November, the owners: "like any other website"). Every time he opens the game he types
  // his name and this password (students.pin, the column kept its name); deploy/schema.sql student_login checks them with
  // the same rule as pwOk here: 6 to 40 characters, not a password everybody tries first, not his name; capitals do not
  // count. A stored password that breaks the rule opens nothing: the red line says so. The later login wins.
  const PW_WS = /^[ \t\r\n\u00a0]+|[ \t\r\n\u00a0]+$/g;
  const PW_BAD = ["123456", "1234567", "12345678", "000000", "111111", "password", "qwerty", "abc123", "abcdef"];
  function pwOk(pw, name) {
    const p = String(pw == null ? "" : pw).replace(PW_WS, "").toLowerCase();
    const n = String(name == null ? "" : name).replace(PW_WS, "").replace(/[\s\u00a0]+/g, " ").toLowerCase();
    return p.length >= 6 && p.length <= 40 && PW_BAD.indexOf(p) < 0 && p !== n;
  }
  function loginCard() {
    const red = !pwOk(student.pin, student.name);
    return '<section class="box s-login"><div class="bh"><h2>His login: name and password</h2></div>' +
      '<p class="lead">His name, as he types it: <b>' + esc(String(student.name || "").trim()) + "</b></p>" +
      '<p class="err" id="lgRed"' + (red ? "" : " hidden") + ">He cannot log in yet. Set his password here.</p>" +
      '<form id="lgf" class="form"><label class="f">His password<span class="fh">He types his name and this password every time he opens the game. Capital letters do not matter.</span>' +
      '<input type="text" id="s_pw" value="' + esc(student.pin || "") + '" maxlength="40" autocomplete="off" spellcheck="false"></label>' +
      '<div class="row wide"><button type="submit">Save</button><span class="ok" id="lgok"></span></div></form>' +
      '<p class="lead">If two people log in as him at the same time, the later one wins. Test with the Tester account, not with his.</p></section>';
  }
  // His name, the name he sees for you, and how much the game gives him each day (his password: loginCard).
  function detailsCard() {
    const hint = s => '<span class="fh">' + s + "</span>";
    return '<section class="box s-details"><div class="bh"><h2>His name and daily amount</h2></div>' +
      '<form id="stf" class="form">' +
      '<label class="f">His name' + hint("Used on this page and in the note for his mother.") + '<input type="text" id="s_name" value="' + esc(student.name) + '"></label>' +
      '<label class="f">Your name in his game' + hint("Your letters to him come from this name.") + '<input type="text" id="s_tn" value="' + esc(student.teacher_name || "WordWizard") + '" maxlength="24"></label>' +
      '<label class="f">First day of the game' + hint("Level 1 opens on this day.") + '<input type="date" id="s_start" value="' + esc(student.start_date || W.today()) + '"></label>' +
      '<label class="f">Old words in each level, at most' + hint("Words he learned before that come back in a level.") + '<input type="number" id="s_cap" value="' + (student.review_cap || W.REVIEW_CAP) + '" min="1" max="30"></label>' +
      '<label class="f">New words in each level' + hint("Used when you give levels to your own words.") + '<input type="number" id="s_new" value="' + (student.new_per_day || 2) + '" min="1" max="5"></label>' +
      '<label class="f">Free play after his words (minutes)' + hint("Time to build on his island when his words are done.") + '<input type="number" id="s_play" value="' + (student.play_minutes || 10) + '" min="0" max="60"></label>' +
      '<p class="lead wide">Each word comes back after 1, 4 and 14 days. After that he knows it well. With 2 new words a day, that makes about 6 words to go over each day.</p>' +
      '<div class="row wide"><button type="submit">Save</button><span class="ok" id="sok"></span></div></form></section>';
  }

  // ---------- the voice on his laptop: the game saves the list (students.voices), reads voice_name and voice_rate ----------
  const VOICE_SAMPLE = "Umbrella. Take your umbrella. Tap each beat.";
  const VOICE_RATES = { normal: 0.8, slower: 0.62 };   // the same rates the game uses for a word, and for a word said slowly
  const LANGS = { "en-GB": "British English", "en-US": "American English", "en-AU": "Australian English", "en-IE": "Irish English", "en-IN": "Indian English", "en-ZA": "South African English", "en-NZ": "New Zealand English", "en-CA": "Canadian English" };
  const allVoices = () => { let v = student.voices; if (typeof v === "string") { try { v = JSON.parse(v); } catch (e) { v = []; } } return (Array.isArray(v) ? v : []).filter(x => x && x.name); };
  // Only the voices that live on his laptop: a voice over the internet (local: false) sends the spoken words to its maker.
  const hisVoices = () => allVoices().filter(v => v.local !== false);
  function voiceCard() {
    const all = allVoices(), vs = hisVoices(), cur = student.voice_name || "", rate = student.voice_rate === "slower" ? "slower" : "normal";
    const curNet = cur && all.some(v => v.name === cur && v.local === false);
    const opt = (val, label, extra, listen) => '<li class="' + (val === cur ? "on" : "") + '"><label><input type="radio" name="vname" value="' + esc(val) + '"' + (val === cur ? " checked" : "") + '><span><b>' + esc(label) + "</b>" + (extra ? ' <span class="muted">' + extra + "</span>" : "") + "</span></label>" +
      (listen ? '<button type="button" class="ghost mini" data-listen="' + esc(val) + '">Listen</button>' : "") + "</li>";
    const rows = opt("", "Let the game choose (a British voice if there is one)", "", false) +
      vs.map(v => opt(v.name, v.name, esc(LANGS[v.lang] || v.lang || ""), true)).join("") +
      (cur && !curNet && !vs.some(v => v.name === cur) ? opt(cur, cur, "not in the list his laptop sent last", true) : "");
    return '<section class="box voice"><div class="bh"><h2>His laptop’s own voice</h2></div>' +
      '<p>The game’s words, its sentences and Orbit’s lines are recordings in a British voice. They sound the same on every laptop. The choices below do not change them.</p>' +
      '<p class="lead">His laptop’s own voice says only what has no recording: words you add yourself and school words that are not in the game’s word list, and some example sentences. Choose the clearest voice for those. Only voices that work on his laptop itself are shown: other voices would send the words over the internet. On some laptops this voice does not work; then he sees those words but does not hear them.</p>' +
      (all.length ? "" : '<p class="needs">The list appears after he has opened the game once on his laptop.</p>') +
      (curNet ? '<p class="needs">The voice chosen now (' + esc(cur) + ") works over the internet. Please choose one of the voices below.</p>" : "") +
      '<ul class="vlist">' + rows + "</ul>" + '<p class="lead" id="vmsg"></p>' +
      '<h3>Speed of his laptop’s voice</h3><div class="row vrate">' +
      ["normal", "slower"].map(r => '<label class="inl"><input type="radio" name="vrate" value="' + r + '"' + (r === rate ? " checked" : "") + "> " + (r === "normal" ? "Normal" : "Slower") + "</label>").join("") +
      '<span class="ok" id="vok"></span></div></section>';
  }
  function wireVoice() {
    const save = async row => {
      const { error } = await sb.from("students").update(row).eq("id", student.id);
      if (error) { banner(error.message); return; }
      Object.assign(student, row); $("vok").textContent = "Saved.";
      view.querySelectorAll(".vlist li").forEach(li => li.classList.toggle("on", !!li.querySelector("input:checked")));
    };
    view.querySelectorAll('input[name="vname"]').forEach(i => i.onchange = () => save({ voice_name: i.value }));
    view.querySelectorAll('input[name="vrate"]').forEach(i => i.onchange = () => save({ voice_rate: i.value === "slower" ? "slower" : "normal" }));
    view.querySelectorAll("[data-listen]").forEach(b => b.onclick = () => {
      const name = b.dataset.listen, msg = $("vmsg"); msg.textContent = "";
      let v = null;
      try { v = "speechSynthesis" in window ? (window.speechSynthesis.getVoices() || []).find(x => x.name === name) || null : null; } catch (e) { v = null; }
      if (!v) { msg.textContent = "This voice is on his laptop, not on this computer, so it cannot be played here."; return; }
      try {
        window.speechSynthesis.cancel();
        const u = new window.SpeechSynthesisUtterance(VOICE_SAMPLE); u.voice = v; u.lang = v.lang || "en-GB";
        u.rate = VOICE_RATES[student.voice_rate === "slower" ? "slower" : "normal"];
        window.speechSynthesis.speak(u);
      } catch (e) { msg.textContent = "This computer could not play the voice just now."; }
    });
  }

  // ---------- choosing his new words (site/picker.js): on or off, and the words chosen so far ----------
  // The same rules and the same data as the game (src/js/87-picker.js), so what this box says is what the game will do.
  async function pickerBox() {
    const box = $("pkBox"); if (!box) return;
    const P = window.WW_PICKER, on = student.picker !== false;
    const [a, e] = await Promise.all([
      safe(sb.from("attempts").select("*").eq("student_id", student.id).in("kind", ["new", "review", "test", "probe"])),
      safe(sb.from("events").select("*").eq("student_id", student.id).in("type", ["rescue", "picked"]))
    ]);
    if (!$("pkBox")) return;
    const picked = ((e && e.data) || []).filter(x => x.type === "picked" && x.detail).sort((x, y) => (x.created_at < y.created_at ? -1 : 1));
    let next = 1; while (next <= maxDay() && dayDone(next)) next++;
    const has = k => words.some(w => W.key(w.word) === W.key(k));
    let now = "";
    if (P && on && next <= LEVELS && next >= 4) {
      try { const B = P.bandFor({ quests, attempts: (a && a.data) || [], events: (e && e.data) || [], words, level: next }); now = "<p>Now: difficulty <b>" + B.band + "</b> on a scale from 1 (easiest) to 9 (hardest).</p>"; } catch (x) { now = ""; }
    }
    const rows = picked.map(x => { const d = x.detail, ws = Array.isArray(d.words) ? d.words : [];
      return "<tr><td><b>" + esc(d.level) + "</b></td><td>" + ws.map(w => esc(w) + (has(w) ? "" : ' <span class="tagw">deleted</span>')).join(", ") + "</td><td>" + esc(rel(ld(x.created_at))) + "</td></tr>"; }).join("");
    const n = picked.reduce((s, x) => s + ((x.detail.words || []).length), 0);
    box.innerHTML = '<div class="bh"><h2>Choosing his new words</h2><span class="grow"></span>' +
      '<span class="sw-l">' + (on ? "Chosen by how he did" : "Fixed list") + '</span><button type="button" class="' + (on ? "" : "ghost ") + 'mini sw" id="pkSwitch" aria-pressed="' + on + '">' + (on ? "On" : "Off") + "</button></div>" +
      (on ? "<p>Each level gets 2 new words. First the words he did not know in the quick check and your own words for the week's spelling pattern, one of each while both are waiting. Then long words with that pattern, chosen by how he did. One pattern a week; long words get a lesson, and short words get a quick check first.</p>" : "") +
      '<p class="lead">' + (on ? "On: from level 4, the game chooses his next words itself, mostly from the Cambridge English word lists for children, by how he did. Press to switch it off." : "Off: after the quick check words and your own words, each level gets the next words of a fixed list, in order. Press to let the game choose by how he did.") + "</p>" +
      (P ? now : '<p class="lead">This part of the game is not on this page.</p>') +
      '<details class="inner"><summary>Words the game chose so far (' + n + ")</summary>" +
      (rows ? '<div class="scroll"><table class="pk-t"><tr><th>Level</th><th>Words</th><th>When</th></tr>' + rows + "</table></div>" : '<p class="lead">None yet.</p>') +
      '<ul class="pk-how"><li>To give a level your own word: on the Words tab, press \u201cAdd your own word\u201d and choose the level. The game only fills what is missing.</li>' +
      "<li>To change a coming word: press Edit beside it on the Words tab. To take it out: press Pause; it waits in \u201cWords set aside\u201d.</li><li>For an exam week or a holiday: switch on \u201cNo new words for now\u201d on the Words tab.</li></ul></details>";
    $("pkSwitch").onclick = async () => {
      const { error } = await sb.from("students").update({ picker: !on }).eq("id", student.id);
      if (error) { banner(error.message); return; }
      student.picker = !on; pickerBox();
    };
  }

  // ---------- progress: four measures, a verdict by fixed rules, and Claude's notes only when the tutor asks ----------
  // These thresholds are the lead's first guess, not research findings. Change them here only; the page shows them
  // under "How this is worked out", so the tutor always sees the rule that gave the verdict.
  const RULES = {
    weeksShown: 8,         // weeks in each small chart, this week last
    windowWeeks: 3,        // "the last 3 weeks" of the verdict
    daysPerWeek: 4,        // a week counts when he played on this many days or more
    weeksNeeded: 3,        // weeks like that before any verdict
    oldTriesNeeded: 20,    // old-word first tries in the weeks shown, before any verdict
    probesNeeded: 8,       // new-rule words in the weeks shown, before any verdict
    longAwayNeeded: 5,     // first tries on words back after 14 days or more, in the last 3 weeks
    memoryLong: 0.70,      // share right on the first try, words back after 14 days or more
    // (Before the three-step ladder of 21 November both lines read "after 7 days or more": the meetings at 7, 14 and 30 days.
    // The ladder now meets a word after 1, 4 and 14 days; "14 days or more" keeps the measure on long gaps, as before.)
    newRule: 0.60,         // share right, new-rule words
    growWeeks: 2,          // weeks (of the last 3) in which "words he can spell now" grew
    hintsHigh: 0.5,        // hints per first try: "help is high" from here
    smallCount: 8          // fewer answers than this: too few to trust
  };
  const OLD_KINDS = ["review", "test"], NO_LEVEL = ["probe", "school", "school_retry", "school_test", "sentence"];
  const LEVEL_KINDS = ["new", "review", "retry", "test", "mixed", "probe"];
  // Back after this many days, by the step the word was on (level_before): 1 -> 1 day, 2 -> 4 days, 3 -> 14 days.
  // Steps 4 and 5 are answers saved on the old five-step ladder (14 and 30 days): they count as 14 days or more.
  const AWAY = [{ d: 1, lv: [1], label: "after 1 day" }, { d: 4, lv: [2], label: "after 4 days" }, { d: 14, lv: [3, 4, 5], label: "after 14 days or more" }];
  const LONG = 2;   // AWAY[LONG]: "words back after 14 days or more", the memory line of the verdict
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const wkLabel = k => +k.slice(8) + " " + MON[+k.slice(5, 7) - 1];
  const pct = x => x == null ? null : Math.round(x * 100);
  const shareOf = c => c && c.n ? c.right / c.n : null;
  const add = cs => cs.reduce((a, c) => ({ right: a.right + c.right, n: a.n + c.n }), { right: 0, n: 0 });
  const ms = iso => { const m = Date.parse(iso); return isFinite(m) ? m : 0; };
  const median = xs => { if (!xs.length) return null; const s = xs.slice().sort((a, b) => a - b), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
  const round1 = x => Math.round(x * 10) / 10;
  // Minutes in levels on one day, the same reading as the Today tab: a stop and a new start begin again.
  function levelMinutes(evs) {
    let m = 0, seg = 0;
    evs.forEach(x => { if (x.type === "quest_start" || x.type === "practice_start") { m += seg; seg = 0; } else if ((x.type === "part_done" || x.type === "quest_complete") && x.detail && x.detail.minutes != null) seg = Math.max(seg, +x.detail.minutes || 0); });
    return m + seg;
  }

  // Everything on the tab, from the rows alone. D: { attempts, events, words, sessions, results, today }.
  function computeProgress(D) {
    const R = RULES, t = D.today || W.today(), wk0 = W.weekStart(t), N = R.weeksShown;
    const weeks = []; for (let i = N - 1; i >= 0; i--) weeks.push(W.addDays(wk0, -7 * i));
    const wi = k => k && k <= t ? weeks.indexOf(W.weekStart(k)) : -1;
    const byTime = (a, b) => ms(a.created_at) - ms(b.created_at);
    const A = (D.attempts || []).filter(a => a && a.created_at && a.word).slice().sort(byTime);
    const E = (D.events || []).filter(e => e && e.created_at).slice().sort(byTime);
    const blank = () => weeks.map(() => ({ right: 0, n: 0 }));
    const last = N - 1;

    // days played: a session that day, or any answer that day
    const daySets = weeks.map(() => new Set());
    (D.sessions || []).forEach(s => { const i = wi(s.day); if (i >= 0) daySets[i].add(s.day); });
    A.forEach(a => { const k = ld(a.created_at), i = wi(k); if (i >= 0) daySets[i].add(k); });
    const days = daySets.map(s => s.size);

    // 1. memory: old words back (review, test), the first try of a word on a day
    const mem = blank(), away = weeks.map(() => AWAY.map(() => ({ right: 0, n: 0 }))), seenOld = {};
    A.forEach(a => {
      if (OLD_KINDS.indexOf(a.kind) < 0) return;
      const k = ld(a.created_at), key = W.key(a.word) + "|" + k; if (seenOld[key]) return; seenOld[key] = 1;
      const i = wi(k); if (i < 0) return;
      mem[i].n++; if (a.correct) mem[i].right++;
      const lb = +a.level_before, j = AWAY.findIndex(x => x.lv.indexOf(lb) >= 0); if (j >= 0) { const c = away[i][j]; c.n++; if (a.correct) c.right++; }
    });
    const long = weeks.map((_, i) => add(away[i].slice(LONG)));   // back after 14 days or more

    // 2. new-rule words: kind "probe", one try each
    const probe = blank(), seenP = {}, probeFirst = [], islands = {};
    A.forEach(a => {
      if (a.kind !== "probe") return;
      const key = W.key(a.word); if (seenP[key]) return; seenP[key] = 1;
      const i = wi(ld(a.created_at)); if (i < 0) return;
      probeFirst.push(a); probe[i].n++; if (a.correct) probe[i].right++;
      if (a.island != null) { const c = islands[a.island] = islands[a.island] || { right: 0, n: 0 }; c.n++; if (a.correct) c.right++; }
    });

    // 3. words he can spell now (level 2 or more) at the end of each week, rebuilt from level_after
    const LV = {}, cur = {};
    A.forEach(a => { if (NO_LEVEL.indexOf(a.kind) >= 0 || a.level_after == null || !isFinite(+a.level_after)) return; (LV[W.key(a.word)] = LV[W.key(a.word)] || []).push(a); });
    (D.words || []).forEach(w => { if (w && w.word) cur[W.key(w.word)] = w; });
    const keys = Object.keys(Object.assign({}, cur, LV));
    const levelAt = (key, endKey) => {
      const L = LV[key] || [], end = endKey ? ms(endKey + "T00:00:00") : Infinity;   // local midnight: the device's time zone
      let before = null, after = null;
      for (const a of L) { if (ms(a.created_at) < end) before = a; else { after = a; break; } }
      if (before) return +before.level_after;
      if (after) return after.level_before == null ? 0 : +after.level_before || 0;
      const w = cur[key]; if (!w || (endKey && w.introduced_on && w.introduced_on >= endKey)) return 0;
      return +w.level || 0;
    };
    const spell = weeks.map((s, i) => keys.filter(k => levelAt(k, i === last ? null : W.addDays(s, 7)) >= 2).length);
    const before0 = keys.filter(k => levelAt(k, weeks[0]) >= 2).length;
    const grew = spell.map((v, i) => v > (i ? spell[i - 1] : before0));
    const slippedWords = [...new Set(A.filter(a => wi(ld(a.created_at)) === last && NO_LEVEL.indexOf(a.kind) < 0 && a.level_before != null && a.level_after != null && +a.level_after < +a.level_before).map(a => a.word))];
    const anyLevel = keys.some(k => (LV[k] || []).length || (+(cur[k] || {}).level || 0) > 0);

    // 4. help: hints per first try (attempts carry hints; older rows have none: 0), hint events by word, patterns
    const FT = firstTries(A).concat(probeFirst);
    const help = weeks.map(() => ({ hints: 0, n: 0, field: false })), hintEv = weeks.map(() => 0);
    FT.forEach(a => { const i = wi(ld(a.created_at)); if (i < 0) return; help[i].n++; if (a.hints != null) { help[i].field = true; help[i].hints += Math.max(0, +a.hints || 0); } });
    const evHints = E.filter(e => e.type === "hint");
    evHints.forEach(e => { const i = wi(ld(e.created_at)); if (i >= 0) hintEv[i]++; });
    help.forEach((h, i) => { if (!h.field) h.hints = hintEv[i]; });   // no hints field yet: count the hint presses instead
    const hintsPer = help.map(h => h.n ? h.hints / h.n : null);
    const byWord = {};
    const weekEv = evHints.filter(e => wi(ld(e.created_at)) === last && e.detail && e.detail.word);
    if (weekEv.length) weekEv.forEach(e => { const k = W.key(e.detail.word); (byWord[k] = byWord[k] || { word: e.detail.word, hints: 0 }).hints++; });
    else FT.filter(a => wi(ld(a.created_at)) === last && +a.hints > 0).forEach(a => { const k = W.key(a.word); (byWord[k] = byWord[k] || { word: a.word, hints: 0 }).hints += +a.hints; });
    const hintWords = Object.values(byWord).sort((a, b) => b.hints - a.hints || (a.word < b.word ? -1 : 1));
    let patterns = null;
    const PT = window.WW_PATTERNS;
    if (PT && typeof PT.summary === "function") {
      try {
        const kinds = { kinds: ["new", "review", "test", "mixed", "training", "probe"] };
        const now = PT.summary(A.filter(a => wi(ld(a.created_at)) === last), kinds) || [];
        const prev = PT.summary(A.filter(a => { const i = wi(ld(a.created_at)); return i >= last - 4 && i < last; }), kinds) || [];
        const codes = [...new Set(now.map(p => p.code).concat(prev.map(p => p.code)))];
        patterns = codes.map(c => { const a = now.find(p => p.code === c), b = prev.find(p => p.code === c), x = a || b;
          return { code: c, name: x.name_en || c, now: a ? a.count : 0, before: b ? b.count : 0, examples: (a ? a.examples : []).slice(0, 3) }; })
          .sort((p, q) => q.now - p.now || q.before - p.before);
      } catch (e) { patterns = null; }
    }

    // small: minutes per level, words typed per minute of level time (this week)
    const evDays = {}; E.forEach(e => { const k = ld(e.created_at); if (wi(k) === last) (evDays[k] = evDays[k] || []).push(e); });
    const weekMins = Object.keys(evDays).reduce((m, k) => m + levelMinutes(evDays[k]), 0);
    const perLevel = E.filter(e => e.type === "quest_complete" && wi(ld(e.created_at)) === last && e.detail && e.detail.minutes != null).map(e => +e.detail.minutes || 0);
    const typed = A.filter(a => wi(ld(a.created_at)) === last && LEVEL_KINDS.indexOf(a.kind) >= 0).length;

    // slips this week: first tries not yet right, as typed
    const slips = FT.filter(a => wi(ld(a.created_at)) === last && !a.correct && typeof a.answer === "string")
      .map(a => ({ word: String(a.word), typed: a.answer.trim(), kind: a.kind }))
      .filter(s => s.typed && s.typed.length <= 30 && /^[A-Za-z'’ -]+$/.test(s.typed) && s.typed.split(" ").length <= 3);

    // the verdict: which weeks are "the last 3"
    const thisCounts = days[last] >= R.daysPerWeek;
    const win = []; for (let i = 0; i < R.windowWeeks; i++) win.unshift(last - i - (thisCounts ? 0 : 1));
    const pool = arr => add(win.map(i => arr[i]));
    const longW = pool(long), probeW = pool(probe), memAll = add(mem), probeAll = add(probe);
    const helpW = add(win.map(i => ({ right: help[i].hints, n: help[i].n })));
    const daysW = win.reduce((s, i) => s + days[i], 0), fullWeeks = days.filter(x => x >= R.daysPerWeek).length;
    const ps = win.map(i => shareOf(probe[i]));
    const rising = ps.every(x => x != null) && ps.every((x, j) => !j || x > ps[j - 1]);
    const hs = win.map(i => hintsPer[i]);
    const hintsRising = hs.every(x => x != null) && hs.every((x, j) => !j || x > hs[j - 1]);
    const growN = win.filter(i => grew[i]).length;
    const of = c => c.right + " of " + c.n;
    const missing = [];
    if (fullWeeks < R.weeksNeeded) missing.push(many(R.weeksNeeded - fullWeeks, "more week") + " with " + R.daysPerWeek + " days played or more");
    if (memAll.n < R.oldTriesNeeded) missing.push(many(R.oldTriesNeeded - memAll.n, "more old-word answer"));
    if (probeAll.n < R.probesNeeded) missing.push(many(R.probesNeeded - probeAll.n, "more new-rule word"));
    if (longW.n < R.longAwayNeeded) missing.push(many(R.longAwayNeeded - longW.n, "more answer") + " on words back after 14 days or more, in the last 3 weeks");
    let verdict;
    if (missing.length) verdict = { kind: "early", title: "Too early to say", reason: "Still missing: " + missing.join("; ") + ".", next: "Keep going as now. The verdict appears here by itself when these are in.", missing };
    else {
      const memOk = shareOf(longW) >= R.memoryLong, probeOk = shareOf(probeW) >= R.newRule, growOk = growN >= R.growWeeks;
      const facts = "words back after 14 days or more " + pct(shareOf(longW)) + "% right (" + of(longW) + "), new-rule words " + pct(shareOf(probeW)) + "% (" + of(probeW) + ")" + (rising ? " and rising for 3 weeks" : "") + ", words he can spell now grew in " + growN + " of the last 3 weeks";
      if (memOk && (probeOk || rising) && growOk) verdict = { kind: "working", title: "It is working", reason: "In the last 3 weeks: " + facts + ".", next: "Keep the plan as it is." };
      else {
        let low, next;
        if (daysW < R.daysPerWeek * R.windowWeeks) { low = "He played on " + daysW + " days in the last 3 weeks; the rule looks for " + R.daysPerWeek + " a week."; next = "The problem is not the method yet: he played on " + daysW + " days. Find what stops him."; }
        else if (!memOk) { low = "Words back after 14 days or more: " + pct(shareOf(longW)) + "% right on the first try in the last 3 weeks (" + of(longW) + "); the line is " + pct(R.memoryLong) + "%."; next = "One new word a day for two weeks, more old words."; }
        else if (!(probeOk || rising)) { low = "New-rule words: " + pct(shareOf(probeW)) + "% right in the last 3 weeks (" + of(probeW) + "), not rising; the line is " + pct(R.newRule) + "%. Memory is at " + pct(shareOf(longW)) + "%."; next = "He remembers the words but not the rule. Teach the rule again in the lesson with new examples."; }
        else if (shareOf(helpW) >= R.hintsHigh && hintsRising) { low = "Hints: " + round1(shareOf(helpW)) + " per first try in the last 3 weeks (" + helpW.right + " on " + helpW.n + "), more each week."; next = "The words may be too hard for now. Go back one island."; }
        else { const a = spell[win[0] - 1 >= 0 ? win[0] - 1 : 0], b = spell[win[win.length - 1]]; low = "Words he can spell now grew in " + growN + " of the last 3 weeks (" + a + " to " + b + "); memory and new-rule words are above their lines."; next = "Check that he plays on enough days for old words to come back for their checks: words reach level 2 only when they come back."; }
        verdict = { kind: "notyet", title: "It is not working yet", reason: low, next };
      }
    }
    return {
      today: t, weeks, last, days, win, thisCounts, mem, away, long, probe, islands, spell, before0, grew, slippedWords, anyLevel,
      help, hintsPer, hintWords, patterns, weekMins, perLevel, typed, slips, verdict,
      // the word picker's choices this week ("picked" events, src/js/87-picker.js): level, band, words, the reason
      picks: E.filter(e => e.type === "picked" && e.detail && wi(ld(e.created_at)) === N - 1).map(e => ({ level: e.detail.level, band: e.detail.band, words: e.detail.words || [], reason: e.detail.reason || "" })),
      pooled: { long: longW, probe: probeW, help: helpW, days: daysW, growN, rising, hintsRising }, totals: { old: memAll.n, probe: probeAll.n, firstTries: help.reduce((s, h) => s + h.n, 0) },
      results: (D.results || []).filter(r => r && r.date && +r.total > 0).slice().sort((a, b) => (a.date < b.date ? -1 : 1))
    };
  }

  // A small bar chart, drawn here: one bar a week, the value above it, the Monday below it. Pale bars rest on few answers.
  function bars(values, o) {
    o = o || {};
    if (!values.some(v => v != null)) return "";
    const Wd = 300, H = 104, top = 16, base = 84, n = values.length, gap = 6, bw = (Wd - gap * (n - 1)) / n;
    const max = o.max || Math.max(1, ...values.filter(v => v != null));
    let s = "", desc = [];
    values.forEach((v, i) => {
      const x = i * (bw + gap), lab = (o.labels || [])[i] || "", small = o.counts && o.counts[i] < RULES.smallCount, cls = "b" + (small ? " pale" : "") + (i === n - 1 && !o.noNow ? " now" : "");
      if (v == null) { s += '<text x="' + (x + bw / 2) + '" y="' + (base - 3) + '" class="nv">–</text>'; desc.push(lab + ": none"); }
      else {
        const h = Math.max(2, (base - top) * Math.min(1, v / max));
        s += '<rect class="' + cls + '" x="' + x.toFixed(1) + '" y="' + (base - h).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2"></rect>' +
          '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (base - h - 4).toFixed(1) + '" class="v">' + esc(o.fmt ? o.fmt(v) : v) + "</text>";
        desc.push(lab + ": " + (o.fmt ? o.fmt(v) : v));
      }
      s += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 6) + '" class="l">' + esc(lab) + "</text>";
    });
    if (o.line != null) { const y = base - (base - top) * Math.min(1, o.line / max); s = '<line x1="0" x2="' + Wd + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" class="th"></line>' + s; }
    return '<svg class="bars" viewBox="0 0 ' + Wd + " " + H + '" role="img" aria-label="' + esc((o.what || "Each week") + ". " + desc.join(", ")) + '">' + s + "</svg>";
  }

  // ---------- This week: the numbers a tutor needs, in plain words ----------
  function glanceHtml(P, aDays) {
    const t = W.today(), wk = W.weekStart(t), wdays = [...Array(7)].map((_, i) => W.addDays(wk, i));
    const playedSet = new Set(sessions.map(x => x.day));
    const daysNow = P.days[P.last];
    // the days of this week from the rows the tab counted, so the dots and the number always agree
    const fresh = words.filter(w => w.introduced_on && w.introduced_on >= wk && w.introduced_on <= t);
    const lv = levelQuests().filter(x => x.completed && ld(x.finished_at) >= wk).map(x => x.quest_day).sort((a, b) => a - b);
    const dots = '<div class="weekdots" aria-label="Days played this week">' + wdays.map((k, i) => '<span class="' + (playedSet.has(k) || aDays.has(k) ? "on" : "") + (k === t ? " now" : "") + (k > t ? " later" : "") + '" title="' + esc(day3(k)) + '">' + "MTWTFSS"[i] + "</span>").join("") + "</div>";
    const stat = (cls, label, value, note) => '<div class="stat ' + cls + '"><span class="st-l">' + label + '</span><b class="st-v">' + value + "</b>" + (note ? '<span class="st-n">' + note + "</span>" : "") + "</div>";
    const cur = currentList(), test = latestTest();
    const school = cur ? listDrillLine(cur.rows) + "." + (test && test.taken_on >= wk ? " Practice dictation: " + test.score + " of " + test.total + " right on " + day3(test.taken_on) + " (he marked it himself)." : "")
      : 'No school spelling list yet. <button type="button" class="link" data-go="school">Add the list</button>';
    return '<section class="box wk-glance"><div class="bh"><h2>This week at a glance</h2><span class="eyebrow">from ' + esc(day3(wk)) + "</span></div>" +
      '<div class="stats">' +
      stat("st-days", "Days played this week", daysNow + " of 5", dots + (daysNow >= 5 ? "The goal of 5 days is reached." : "The goal is 5 days a week.")) +
      stat("st-well", "Words he knows well now", String(knowsWell().length), "He spelled them right after 1, 4 and 14 days.") +
      stat("st-mem", "Words he can spell from memory", String(P.anyLevel ? P.spell[P.last] : canSpell().length), "Right again on a later day. This counts the words he knows well too.") +
      stat("st-new", "New words this week", String(fresh.length), fresh.length ? fresh.map(w => esc(w.word)).join(", ") : "") +
      "</div>" +
      '<ul class="facts">' +
      "<li>" + (lv.length ? "Levels finished this week: " + (lv.length > 1 ? lv[0] + " to " + lv[lv.length - 1] : lv[0]) + "." : "No level finished this week yet.") + "</li>" +
      (P.weekMins > 0 ? "<li>Time on his words this week: " + many(Math.round(P.weekMins), "minute") + ".</li>" : "") +
      "<li>School spelling list: " + school + "</li></ul></section>";
  }
  // One chart only, with its numbers on the bars: words he can spell from memory at the end of each week.
  function memoryChart(P) {
    if (!P.anyLevel) return "";
    const labels = P.weeks.map(wkLabel);
    return '<section class="box wk-chart"><div class="bh"><h2>Words he can spell from memory, week by week</h2></div>' +
      '<p class="lead">Each bar is one week, and the number on it is how many words he could spell from memory at the end of that week. This week is on the right. Taller bars mean more words.</p>' +
      bars(P.spell, { labels, what: "Words he could spell from memory at the end of each week" }) + "</section>";
  }
  // "Is the game helping?" in plain words, from the same fixed rules as the numbers sent to Claude.
  function helpingHtml(P) {
    const v = P.verdict, R = RULES, pc = x => Math.round(x * 100) + "%";
    let title, say;
    if (v.kind === "early") { title = "Too early to say"; say = "The game can tell whether it is helping after about 3 weeks in which he plays on " + R.daysPerWeek + " days or more. Until then, keep going as now."; }
    else if (v.kind === "working") { title = "Yes, it is helping"; say = "He remembers most words two weeks later, and the number of words he can spell from memory is growing. Keep going as now."; }
    else {
      title = "Not helping enough yet";
      const n = v.next || "";
      if (/^The problem is not the method/.test(n)) say = "He played on " + P.pooled.days + " days in the last 3 weeks. The game works best on " + R.daysPerWeek + " days a week or more. Talk with him and his mother about a fixed time to play.";
      else if (/^One new word a day/.test(n)) say = "Many words were not yet right when they came back after two weeks. Go over his older words with him in your lesson.";
      else if (/remembers the words but not the rule/.test(n)) say = "He remembers the words he learned, but words he never learned that follow the same spelling rule are often not yet right. Teach the rule again in your lesson with new examples.";
      else if (/too hard/.test(n)) say = "He has pressed for help more and more often in the last weeks. The words may be too hard for now. Spend your lesson on words he has met before.";
      else say = "The number of words he can spell from memory is not growing yet. Words only count when they come back on a later day, so check that he plays on enough days.";
    }
    return '<section class="box wk-help v-' + v.kind + '"><div class="bh"><h2>Is the game helping?</h2></div>' +
      '<p class="verdict">' + esc(title) + '</p><p>' + esc(say) + "</p>" +
      '<details class="inner"><summary>How the game decides this</summary><ul class="plain">' +
      "<li>It looks at the last 3 weeks in which he played on " + R.daysPerWeek + " days or more.</li>" +
      "<li>It says yes when three things are true: he spells at least " + pc(R.memoryLong) + " of his words right when they come back after two weeks; he spells at least " + pc(R.newRule) + " of the words he never learned right when they follow a spelling rule he learned (or that number goes up three weeks running); and the number of words he can spell from memory grew in at least " + R.growWeeks + " of the 3 weeks.</li>" +
      "<li>Before that, it needs enough answers to be fair: " + R.oldTriesNeeded + " answers on words from before and " + R.probesNeeded + " on words he never learned, in the last " + R.weeksShown + " weeks.</li>" +
      "<li>These lines are a first guess and can be changed.</li></ul></details></section>";
  }
  // The school's own dictation mark: typed by the tutor (School spelling list tab).
  function resultsHtml(rs) {
    rs = rs.slice(-8);
    return '<section class="box pg-school"><div class="bh"><h2>His mark in the school dictation</h2></div>' +
      '<p class="lead">When the school gives the dictation back, type his mark here. You can then see it next to the game.</p>' +
      '<form id="srf" class="row srf" autocomplete="off"><label class="inl">Date <input type="date" id="sr_date" value="' + W.today() + '"></label>' +
      '<label class="inl">Right <input type="number" id="sr_right" min="0" max="200"></label><label class="inl">out of <input type="number" id="sr_total" min="1" max="200"></label>' +
      '<label class="inl grow">Note <input type="text" id="sr_note" maxlength="120" placeholder="only for you"></label><button type="submit">Save</button><span class="err" id="srErr"></span></form>' +
      (rs.length ? '<div style="max-width:' + Math.max(220, rs.length * 70) + 'px">' + bars(rs.map(r => Math.round(100 * +r.right / +r.total)), { max: 100, fmt: v => v + "%", labels: rs.map(r => wkLabel(r.date)), noNow: true, what: "School dictation, share right" }) + "</div>" +
        '<p class="cap">One bar for each dictation, newest on the right. The number is the share he got right.</p><ul class="plain srl">' + rs.slice().reverse().map(r => "<li>" + day3(r.date) + ": <b>" + (+r.right) + " of " + (+r.total) + "</b>" + (r.note ? ' <span class="muted">' + esc(r.note) + "</span>" : "") + ' <button type="button" class="mini ghost" data-srdel="' + esc(r.id) + '" aria-label="Delete">' + ICON("x") + "</button></li>").join("") + "</ul>"
        : '<p class="needs">No mark typed yet.</p>') + "</section>";
  }
  async function fillResults() {
    const slot = $("srSlot"); if (!slot) return;
    const sr = await safe(sb.from("school_results").select("*").eq("student_id", student.id).order("date"));
    if (!$("srSlot")) return;
    const rs = ((sr && !sr.error && sr.data) || []).filter(r => r && r.date && +r.total > 0).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    $("srSlot").innerHTML = resultsHtml(rs);
    $("srf").onsubmit = async ev => {
      ev.preventDefault();
      const date = $("sr_date").value, right = Math.round(+$("sr_right").value), total = Math.round(+$("sr_total").value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { $("srErr").textContent = "Set the date."; return; }
      if (!($("sr_total").value && total >= 1) || $("sr_right").value === "" || !(right >= 0) || right > total) { $("srErr").textContent = "Type how many were right and out of how many."; return; }
      const { error } = await safe(sb.from("school_results").insert({ student_id: student.id, date, right, total, note: $("sr_note").value.trim() }));
      if (error) { $("srErr").textContent = error.message || "Could not be saved."; return; }
      fillResults();
    };
    $("srSlot").querySelectorAll("[data-srdel]").forEach(b => b.onclick = async () => { const { error } = await safe(sb.from("school_results").delete().eq("id", b.dataset.srdel)); if (error) banner(error.message); fillResults(); });
  }

  // ---------- The adviser (the card on the Progress tab) ----------
  // An education specialist for spelling (an AI) reports to the tutor when she presses the button: what it notices in his
  // learning, spelling and play, what to try (with sources only from the checked list), practice ideas with his own
  // words, one small goal. Advice only: nothing in the game changes by itself.
  // The facts of the span she chose are worked out by WW_AI.facts (site/ai-prompt.js) from the rows loaded here; the
  // names the page knows are cleaned out before they leave (WW_AI.scrub). The answer is checked by WW_AI.check.
  const ADV_SPANS = [["week", "This week"], ["two", "The last 2 weeks"], ["all", "Everything"]];
  let advSpan = "week", advSaved = [];
  function advRange(span) {
    const t = W.today();
    if (span === "two") return { from: W.addDays(W.weekStart(t), -7), to: t, label: "the last 2 weeks" };
    if (span === "all") {
      const ds = [student && student.start_date].concat(words.map(w => w.introduced_on), sessions.map(s => s.day)).filter(Boolean).sort();
      return { from: ds[0] && ds[0] < t ? ds[0] : t, to: t, label: "everything so far" };
    }
    return { from: W.weekStart(t), to: t, label: "this week" };
  }
  const advNames = () => [student && student.name, student && student.teacher_name, me && me.email ? String(me.email).split("@")[0] : ""];
  const advNeeds = () => { const v = student && typeof student.teaching_needs === "string" ? student.teaching_needs.trim() : ""; return v || window.WW_AI.NEEDS_DEFAULT; };
  async function adviserFacts(span) {
    const AI = window.WW_AI; if (!AI) throw { code: "no_prompt" };
    const r = advRange(span);
    const [a, e] = await Promise.all([fetchSince("attempts", new Date("2000-01-01T00:00:00Z").toISOString()), fetchSince("events", new Date(r.from + "T00:00:00").toISOString())]);
    if (a.error || e.error) throw { code: "load" };
    const f = AI.facts({ attempts: a.data, events: e.data, sessions, words, from: r.from, to: r.to, label: r.label, reviewMode: student && student.review_mode, top: W.DIAMOND });
    return AI.scrub(f, advNames()).data;
  }
  // claude.use("sample") only hands over the capability; no model is called until the tutor presses the button.
  let sampleFor = null, samplePromise = null;
  const getSample = () => {
    if (sampleFor !== window.claude || !samplePromise) { sampleFor = window.claude; samplePromise = (async () => { try { return window.claude && typeof window.claude.use === "function" ? (await window.claude.use("sample")) || null : null; } catch (e) { return null; } })(); }
    return samplePromise;
  };
  const OFF_SITE = "The adviser cannot be asked from this copy of the page. It works on claude.ai and on your own website.";
  // ---- the real website: no page ability there, so the button asks the Edge Function (deploy/functions/weekly-analysis) ----
  const AI_FUNCTION = "weekly-analysis";
  // Claude Opus 5.5 list prices, US dollars per million tokens, from the claude-api skill's model table (cached 2026-11-03),
  // copied on 2026-11-21. Only for the rough cost line under a run; check the price page before quoting it.
  const AI_PRICE = { input: 4, output: 20 };
  const AI_SORRY = "The adviser could not write its report. Try again in a minute.";
  const onSite = () => !DEMO && !!(sb && sb.functions && typeof sb.functions.invoke === "function") && !!window.WW_AI;
  function costLine(u) {
    const i = Math.max(0, Math.round(+(u && u.input_tokens) || 0)), o = Math.max(0, Math.round(+(u && u.output_tokens) || 0));
    if (!i && !o) return "";
    const c = (i * AI_PRICE.input + o * AI_PRICE.output) / 1e4;   // US cents
    return "This one cost about " + (c < 1 ? "1 US cent or less" : Math.round(c) + " US cents") + ".";
  }
  // The function's own short message when it sent one (401, 403, 413, 429, 500, 502), else the general one.
  async function fnMessage(err) {
    try { const r = err && err.context; if (r && typeof r.json === "function") { const j = await r.json(); if (j && typeof j.message === "string" && j.message.length < 200) return j.message; } } catch (e) { }
    return AI_SORRY;
  }
  const spanLine = s => !s ? "" : (s.label ? s.label.charAt(0).toUpperCase() + s.label.slice(1) : "Report") + (s.from && s.to ? ": " + day3(s.from) + (s.to !== s.from ? " to " + day3(s.to) : "") : "");
  // One kept report. Version 2 is the adviser's; older rows (the weekly notes before 25 November) are shown plainly.
  function reportHtml(rec) {
    let o = null; try { o = typeof rec.json === "string" ? JSON.parse(rec.json) : rec.json; } catch (e) { o = null; }
    const at = rec.at ? day3(ld(rec.at)) + " " + W.fmtTime(rec.at) : "", AI = window.WW_AI;
    if (o && o.v === 2 && o.report && AI) {
      const R = o.report;
      if (AI.hasDiagnosis(JSON.stringify(R))) return '<p class="muted">This report is not shown: it used words the adviser must never use.</p>';
      const k = (label, s) => s ? '<p><span class="adv-k">' + label + "</span> " + esc(s) + "</p>" : "";
      const groups = [["learning", "His learning"], ["spelling", "His spelling"], ["behaviour", "How he plays"]].map(g => {
        const it = (R.notice && R.notice[g[0]]) || [];
        return it.length ? '<div class="adv-grp"><h4>' + g[1] + "</h4><ul>" + it.map(x => "<li><b>" + esc(x.pattern) + "</b>" + (x.evidence ? ' <span class="adv-ev">' + esc(x.evidence) + "</span>" : "") + "</li>").join("") + "</ul></div>" : "";
      }).join("");
      const tries = (R.try || []).map(t => { const s = t.source && AI.sourceByKey(t.source);
        return '<li class="adv-try"><b class="adv-tt">' + esc(t.title || t.principle) + "</b>" + (t.title ? k("The idea:", t.principle) : "") + k("Why for him:", t.why) + k("What you do:", t.what_to_do) + (s ? '<p class="adv-src">Source: ' + esc(s.authors + " (" + s.year + ")") + "</p>" : "") + "</li>"; }).join("");
      const prac = (R.practice || []).map(x => '<li class="adv-pr"><b>' + esc(x.pattern) + '</b><div class="adv-words">' + (x.words || []).map(w => '<span class="adv-w">' + esc(w) + "</span>").join("") + "</div>" + k("Five minutes:", x.five_minutes) + "</li>").join("");
      const used = (o.sources || []).map(s => AI.sourceByKey(s)).filter(Boolean);
      return '<article class="adv-report"><p class="adv-meta">' + esc(spanLine(o.span)) + (at ? " · written " + esc(at) : "") + "</p>" +
        (R.summary ? '<p class="adv-sum">' + esc(R.summary) + "</p>" : "") + (R.data_note ? '<p class="adv-note">' + esc(R.data_note) + "</p>" : "") +
        (groups ? '<h3>What I notice</h3><div class="adv-grps">' + groups + "</div>" : "") +
        (tries ? '<h3>What to try</h3><ol class="adv-tries">' + tries + "</ol>" : "") +
        (prac ? '<h3>Practice ideas</h3><ul class="adv-prs">' + prac + "</ul>" : "") +
        (R.goal ? '<h3>One small goal for next week</h3><p class="adv-goal">' + esc(R.goal) + "</p>" : "") +
        (o.dropped ? '<p class="muted">Some lines were left out because they used words the adviser must not use.</p>' : "") +
        (o.unknown_sources ? '<p class="muted">It named a source that is not on the checked list, so no source is shown for that idea.</p>' : "") +
        (used.length ? '<div class="adv-sources"><h4>Sources</h4><ul>' + used.map(s => '<li><a href="https://doi.org/' + esc(s.doi) + '" target="_blank" rel="noopener">' + esc(s.authors + " (" + s.year + "). " + s.title + ". " + s.journal + ".") + "</a></li>").join("") + "</ul></div>" : "") +
        '<p class="adv-ai">The adviser is an AI. Check its advice against what you see in him.</p></article>';
    }
    if (o && typeof o.headline === "string") {
      const items = x => (Array.isArray(x) ? x : []).filter(s => typeof s === "string" && s);
      const list = (h, x) => items(x).length ? "<h4>" + h + "</h4><ul>" + items(x).map(s => "<li>" + esc(s) + "</li>").join("") + "</ul>" : "";
      return '<article class="adv-report adv-legacy"><p class="adv-meta">Weekly notes' + (rec.week ? " for the week of " + esc(wkLabel(rec.week)) : "") + (at ? " · written " + esc(at) : "") + "</p><p>" + esc(o.headline) + "</p>" +
        list("What changed", o.changed) + list("In his spelling", o.patterns) + list("For your next lesson", o.next_lesson) + '<p class="adv-ai">Written by an AI. Check it against what you see in him.</p></article>';
    }
    return '<p class="muted">This report could not be read.</p>';
  }
  // The newest report open, the earlier ones in a fold, newest first.
  function reportsHtml() {
    const list = advSaved.slice().sort((p, q) => String(q.at || "").localeCompare(String(p.at || "")));
    if (!list.length) return '<p class="lead adv-none">No report yet.</p>';
    const older = list.slice(1);
    return reportHtml(list[0]) + (older.length ? '<details class="inner adv-old"><summary>Earlier reports (' + older.length + ")</summary>" + older.map(reportHtml).join("") + "</details>" : "");
  }
  function needsHtml() {
    return '<details class="inner adv-needs"><summary>What the adviser should keep in mind</summary>' +
      '<p class="lead">What helps him learn. The adviser plans every idea around it.</p>' +
      '<form id="advNf" autocomplete="off"><label class="adv-sr" for="advNt">What the adviser should keep in mind</label><textarea id="advNt" rows="3" maxlength="' + (window.WW_AI ? window.WW_AI.NEEDS_MAX : 400) + '">' + esc(window.WW_AI ? advNeeds() : "") + "</textarea>" +
      '<div class="row"><button type="submit">Save</button><span class="err" id="advNe" role="status"></span></div></form></details>';
  }
  function wireNeeds() {
    const f = $("advNf"); if (!f || !window.WW_AI) return;
    f.onsubmit = async ev => {
      ev.preventDefault();
      const AI = window.WW_AI, v = $("advNt").value.replace(/\s+/g, " ").trim(), line = $("advNe");
      line.className = "err";
      if (AI.hasDiagnosis(v)) { line.textContent = AI.NEEDS_REFUSED; return; }
      const val = (v || AI.NEEDS_DEFAULT).slice(0, AI.NEEDS_MAX);
      const r = await safe(sb.from("students").update({ teaching_needs: val }).eq("id", student.id));
      if (!$("advNt")) return;
      if (r && r.error) { $("advNt").value = AI.NEEDS_DEFAULT; line.textContent = "This setting is not ready yet."; return; }
      student.teaching_needs = val; $("advNt").value = val; line.className = "ok"; line.textContent = "Saved.";
    };
  }
  function adviserCard(rows) {
    advSaved = rows.slice();
    return '<section class="box pg-ai adv" id="aiBox"><div class="bh"><h2>The adviser</h2></div>' +
      '<p class="lead">An education specialist for spelling, played by an AI. It looks at his learning, his spelling and how he plays, tells you what it notices and what to try, and names the research for each idea. It writes only when you press the button, and nothing in the game changes by itself.</p>' +
      '<div id="aiCtl"><p class="lead">Checking whether the adviser can be asked from here…</p></div>' +
      '<p class="muted adv-sent">His answers, times and hints are sent to the AI service without his name.</p>' +
      '<div id="aiOut">' + reportsHtml() + "</div>" + needsHtml() + "</section>";
  }
  async function wireAi() {
    if (!$("aiBox")) return;
    wireNeeds();
    const sample = await getSample();
    if (tab !== "week" || !$("aiBox")) return;
    const ctl = $("aiCtl"), site = !sample && onSite();
    if (!sample && !site) { ctl.innerHTML = '<p class="muted">' + OFF_SITE + "</p>"; return; }
    ctl.innerHTML = '<div class="row adv-ask"><label class="inl" for="aiSpan">Look at</label><select id="aiSpan">' + ADV_SPANS.map(s => '<option value="' + s[0] + '"' + (s[0] === advSpan ? " selected" : "") + ">" + s[1] + "</option>").join("") + "</select>" +
      '<button type="button" id="aiGo">Ask the adviser</button></div><p class="muted" id="aiMsg">It writes only when you press. It takes about a minute.</p><p class="muted ai-cost" id="aiCost" hidden></p>';
    $("aiSpan").onchange = () => { advSpan = $("aiSpan").value; };
    $("aiGo").onclick = async () => {
      const b = $("aiGo"), msg = $("aiMsg"), cost = $("aiCost"), AI = window.WW_AI;
      b.disabled = true; cost.hidden = true; msg.textContent = "The adviser is reading… this takes about a minute";
      const show = rec => { advSaved = advSaved.concat([rec]); $("aiOut").innerHTML = reportsHtml(); };
      let facts;
      try { facts = await adviserFacts($("aiSpan").value); } catch (e) { msg.textContent = "His data could not be loaded. Try again in a minute."; b.disabled = false; return; }
      const needs = AI.cleanNeeds(advNeeds(), advNames()).text;
      if (site) {
        let res; try { res = await sb.functions.invoke(AI_FUNCTION, { body: { facts, teaching_needs: needs } }); } catch (e) { res = { data: null, error: e }; }
        if (tab !== "week" || $("aiGo") !== b) return;   // she left the tab; a kept report shows on her next visit
        const data = res && !res.error ? res.data : null;
        if (!data || !data.record || typeof data.record.json !== "string") { msg.textContent = res && res.error ? await fnMessage(res.error) : AI_SORRY; b.disabled = false; return; }
        show(data.record);
        msg.textContent = data.saved ? "Kept on this page for next time." : "Shown, but it could not be kept for next time.";
        const line = costLine(data.usage); cost.textContent = line; cost.hidden = !line;
      } else {
        try {
          const out = await sample.json(AI.text(facts, needs), { modelTier: "default" });
          const c = AI.check(out, facts);
          if (tab !== "week" || $("aiGo") !== b) return;
          if (!c.ok) { msg.textContent = c.message; b.disabled = false; return; }
          const rec = { student_id: student.id, week: facts.span.week, at: new Date().toISOString(), json: JSON.stringify(AI.record(c, facts)) };
          const r = await safe(sb.from("analyses").insert(rec));
          show(rec);
          msg.textContent = r && r.error ? "Shown, but it could not be kept for next time." : "Kept on this page for next time.";
        } catch (e) {
          const code = e && e.code;
          msg.textContent = code === "rate_limited" ? "The AI service has had many questions just now. Try again later." :
            code === "not_granted" ? "The adviser is switched off for this page." : "The adviser could not write its report this time. Try again later.";
          if (code === "not_granted") { b.hidden = true; return; }
        }
      }
      b.disabled = false;
    };
  }

  // Answers in pages, so a long history is never cut at the database's page size.
  const PAGE = 1000;
  async function fetchSince(table, fromIso) {
    const out = [], ids = new Set(); let upto = null;
    for (let p = 0; p < 40; p++) {
      let q = sb.from(table).select("*").eq("student_id", student.id).gte("created_at", fromIso);
      if (upto) q = q.lte("created_at", upto);
      const r = await safe(q.order("created_at", { ascending: false }).limit(PAGE));
      if (r.error) return { data: out.reverse(), error: r.error };
      const d = r.data || [], fresh = d.filter(x => !ids.has(x.id));
      fresh.forEach(x => { ids.add(x.id); out.push(x); });
      if (d.length < PAGE || !fresh.length) break;
      upto = d[d.length - 1].created_at;
    }
    return { data: out.reverse() };
  }
  async function renderWeek() {
    view.innerHTML = '<section class="box"><p class="lead">Counting…</p></section>';
    await loadAll();
    const t = W.today(), from = new Date(W.addDays(W.weekStart(t), -7 * (RULES.weeksShown - 1)) + "T00:00:00").toISOString();
    const [a, e, sr, an] = await Promise.all([fetchSince("attempts", from), fetchSince("events", from),
      safe(sb.from("school_results").select("*").eq("student_id", student.id).order("date")),
      safe(sb.from("analyses").select("*").eq("student_id", student.id).order("at"))]);
    if (tab !== "week") return;
    if (a.error) banner(a.error.message);
    const P = computeProgress({ attempts: a.data, events: e.data, words, sessions, results: (sr && !sr.error && sr.data) || [], today: t });
    const kept = (an && !an.error && an.data) || [];
    const aDays = new Set((a.data || []).map(x => ld(x.created_at)));
    view.innerHTML = '<div class="wk">' + glanceHtml(P, aDays) +
      adviserCard(kept) +
      '<div class="two">' + helpingHtml(P) + islandCard() + "</div>" + memoryChart(P) + "</div>";
    wireAi();
    wireCommon();
  }

  // For checks: the Chinese summary of the data as it is now.
  window.WT_TEACHER = { motherText: async () => motherText(await motherFacts()), progress: computeProgress, adviserFacts, RULES };
  boot();
})();
