/* Word World: the tutor's page. Owner: dash team.
   Goes through the same client calls as the game (W.client(): Supabase, or the stand-in database in this browser).
   Never a word about the child: the page says what happened ("not yet right", "double letters written once"). */
(function () {
  const W = window.WT, $ = id => document.getElementById(id), view = $("view");
  const sb = W.client();
  const DEMO = !!window.WW_DEMO;
  let me = null, student = null, words = [], sessions = [], quests = [], messages = [], school = [], tests = [], tab = "today";

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
    return levelWords(d).length ? "open" : "empty";
  }
  function openDay() { for (let d = 1; d <= maxDay(); d++) if (dayState(d) === "open") return d; return null; }
  const buildObj = () => { const b = student.build; if (Array.isArray(b)) return { cells: b, bought: { brick: b.length } }; return { cells: b && Array.isArray(b.cells) ? b.cells : [], cells3: b && Array.isArray(b.cells3) ? b.cells3 : [], bought: b && b.bought ? b.bought : {} }; };
  const PRICES = { brick: 1, door: 3, window: 2, flower: 2, tree: 4, torch: 3, flag: 5, fence: 2, roof: 3, steps: 3, lantern: 3, chest: 4, bed: 4, table: 3, well: 5, bridge: 4, signpost: 2 };
  const diamondsEarned = () => quests.reduce((a, x) => a + (x.diamonds_earned || 0), 0);
  // The same rule as the game (20-build-data.js spentOn): bought.brick counts bricks, and every started pack of 10 cost 1 diamond.
  const BRICKS_PER_DIAMOND = 10;
  const spentOn = (k, n) => k === "brick" ? Math.ceil((n || 0) / BRICKS_PER_DIAMOND) * PRICES.brick : (n || 0) * (PRICES[k] || 0);
  const diamondsSpent = () => { const b = buildObj().bought; return Object.keys(b).reduce((a, k) => a + spentOn(k, b[k]), 0); };
  // The picture of his island the game saves when he leaves Build (students.build_picture, a JPEG data URL).
  const islandPic = () => { const p = student && student.build_picture; return typeof p === "string" && p.indexOf("data:image/jpeg") === 0 ? { src: p, at: student.build_picture_at || null } : null; };
  // The memory ladder (common.js): back after 1, 4 and 14 days, then star word. Levels 4 and 5 are only in a save from the
  // old five-step ladder that the game has not opened since; loadAll shows them as the game will move them (W.fromOldLadder).
  const ladder = { 0: "not started", 1: "back after 1 day", 2: "back after 4 days", 3: "back after 14 days", 6: "star word" };
  const canSpell = () => words.filter(w => w.level >= 2);

  // ---------- auth ----------
  function renderLogin(msg) {
    $("topbar").hidden = true;
    view.innerHTML = '<section class="box narrow"><h2>Teacher login</h2><form id="lf" class="stack">' +
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
    if (!sb) { view.innerHTML = '<section class="box"><h2>Not set up yet</h2><p class="hint">config.js is missing or still has the example values. See deploy/README.md.</p></section>'; return; }
    if (DEMO) {
      // The stand-in database keeps everything in this browser; there is no login to check.
      me = { id: "teacher-demo", email: "" }; $("who").textContent = "Saved in this browser only"; $("logout").hidden = true;
    } else {
      const { data: { session } } = await sb.auth.getSession();
      if (!session || session.user.is_anonymous) { if (session) await sb.auth.signOut(); return renderLogin(); }
      me = session.user;
      $("who").textContent = me.email;
      const { data: prof } = await sb.from("profiles").select("*").eq("id", me.id).maybeSingle();
      if (!prof) {
        view.innerHTML = '<section class="box narrow"><h2>One more step</h2><p class="hint">This login is not a teacher yet. Press the button once. Only the first login can do this.</p><div class="row"><button type="button" id="mk">Make me the teacher</button><button type="button" class="ghost" id="lo">Log out</button></div><p class="err" id="merr"></p></section>';
        $("mk").onclick = async () => { const { error } = await sb.rpc("become_teacher"); if (error) $("merr").textContent = error.message; else boot(); };
        $("lo").onclick = async () => { await sb.auth.signOut(); renderLogin(); };
        return;
      }
    }
    $("topbar").hidden = false;
    await loadAll();
    render();
  }
  $("logout").onclick = async () => { await sb.auth.signOut(); renderLogin(); };
  $("toGame").onclick = () => { location.href = "index.html"; };   // the child's door
  function go(name) { tab = name; document.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("on", x.dataset.tab === name)); render(); if (document.scrollingElement) document.scrollingElement.scrollTop = 0; }
  document.querySelectorAll(".tabs button").forEach(b => b.onclick = () => go(b.dataset.tab));

  // ---------- data ----------
  const safe = q => Promise.resolve(q).catch(e => ({ data: [], error: e }));
  async function loadAll() {
    const st = await sb.from("students").select("*").order("created_at").limit(1).maybeSingle();
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
    ({ today: renderToday, progress: renderProgress, school: renderSchool, chat: renderChat, mother: renderMother, words: renderWords, log: renderLog, student: renderStudent })[tab]();
  }

  // ---------- no student yet ----------
  function renderNewStudent() {
    view.innerHTML = '<section class="box narrow"><h2>Add your student</h2><form id="sf" class="stack">' +
      '<label class="f">Name<input type="text" id="sn" value="" placeholder="Sam"></label>' +
      '<label class="f">PIN (4 digits, he types this to open the game)<input type="text" id="sp" value="1234" maxlength="4" inputmode="numeric"></label>' +
      '<div class="row"><button type="submit">Create</button></div><p class="err" id="serr"></p></form></section>';
    $("sf").onsubmit = async e => {
      e.preventDefault();
      const { error } = await sb.from("students").insert({ teacher_id: me.id, name: $("sn").value.trim() || "Student", pin: $("sp").value.trim() || "1234" });
      if (error) { $("serr").textContent = error.message; return; }
      await loadAll(); go("student");
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
      sentences: ev(/^sentence_saved$/), skipped: ev(/^sentence_skipped$/).length,
      drawn: e.filter(x => x.type === "drawn" && x.detail && x.detail.png),
      games: ev(/^game_(meaning|sentence)$/), claps: ev(/^clap$/), pauses: ev(/^quest_pause$/).length,
      play: s && s.play_used != null ? Math.round((+s.play_used || 0) / 60) : null, asleep: s && s.asleep_at ? s.asleep_at : null,
      attempts: a, events: e
    };
  }
  const notYet = list => list.filter(x => !x.correct);
  const typedList = list => list.map(x => '<span class="slip"><b>' + esc(x.word) + '</b> <i>' + esc(x.answer) + "</i></span>").join("");
  const rightOf = list => list.filter(x => x.correct).length;

  // ---------- today ----------
  async function renderToday() {
    await loadAll();
    const t = W.today(), { A, E } = await loadRecent(14);
    const T = dayFacts(t, A, E);
    const lastPlayed = sessions.map(x => x.day).filter(k => k < t).sort().pop();
    let head;
    if (!T.played) head = '<p class="big">Not played yet today.</p><p class="sub">' + (lastPlayed ? "Last played " + day3(lastPlayed) + (W.daysBetween(lastPlayed, t) === 1 ? " (yesterday)" : "") + "." : "Not played yet.") + "</p>";
    else head = '<p class="big">Played today' + (T.mins ? " · " + T.mins + " min in levels" : "") + "</p><p class=\"sub\">" +
      (T.done.length ? T.done.map(x => "Level " + x.quest_day + " done" + (isTest(x.quest_day) ? " (island test " + (x.test_right || 0) + " of " + (x.test_total || 0) + ")" : "")).join(", ") : T.open.length ? "Level " + T.open[0].quest_day + " started, not finished" : T.s && T.s.mail_opened_at ? "Mailbox opened, no level started" : "Came in, mailbox not opened") +
      (T.s && (T.s.started_at || T.s.created_at) ? " · came in " + W.fmtTime(T.s.started_at || T.s.created_at) : "") + "</p>";

    // the parts of today, ticked
    const PARTS = [
      ["Mailbox", !!(T.s && T.s.mail_opened_at)],
      ["Old words", T.parts.indexOf("review") >= 0 || (T.old.length > 0 && T.done.length > 0)],
      ["New words", T.parts.indexOf("new") >= 0 || (T.news.length > 0 && T.done.length > 0)],
      ["Mixed round", T.done.length > 0 && T.mixed.length > 0],
      ["Orbit's training", T.training.length > 0],
      ["School words", T.schoolQ.length > 0 || T.schoolA.length > 0],
      ["Story", T.story.length > 0]
    ];
    const partsHtml = '<div class="parts">' + PARTS.map(p => '<span class="pt' + (p[1] ? " on" : "") + '">' + (p[1] ? ICON("check") : '<i class="o"></i>') + p[0] + "</span>").join("") + "</div>";
    const row = (k, v) => "<dt>" + k + "</dt><dd>" + v + "</dd>";
    const scoreLine = (list, what) => list.length ? '<b class="good">' + rightOf(list) + " right</b>" + (notYet(list).length ? ", <b class=\"ny\">" + notYet(list).length + " not yet</b>: " + typedList(notYet(list)) : "") + (what ? " " + what : "") : '<span class="muted">none</span>';
    const due = words.filter(w => w.level > 0 && w.level < W.DIAMOND && w.due && w.due <= t).length;
    const todayKv = '<dl class="kv">' +
      row("Old words", T.old.length ? scoreLine(T.old) : '<span class="muted">' + (T.played ? "none asked" : due + " waiting") + "</span>") +
      row("New words", T.news.length ? T.news.map(x => '<span class="w">' + esc(x.word) + "</span>").join(", ") + " · " + rightOf(T.news) + " of " + T.news.length + " right first try" + (notYet(T.news).length ? ": " + typedList(notYet(T.news)) : "") : '<span class="muted">none</span>') +
      row("Mixed round", T.mixed.length ? rightOf(T.mixed) + " of " + T.mixed.length + " first try" + (notYet(T.mixed).length ? ": " + typedList(notYet(T.mixed)) : "") : '<span class="muted">none</span>') +
      (T.test.length ? row("Island test", scoreLine(T.test)) : "") +
      (T.training.length ? row("Training", scoreLine(T.training)) : "") +
      (T.schoolA.length || T.schoolQ.length ? row("School words", T.schoolA.length ? rightOf(T.schoolA) + " of " + T.schoolA.length + " first try" + (notYet(T.schoolA).length ? ": " + typedList(notYet(T.schoolA)) : "") : "drill done") : "") +
      row("中文 · Hear it", (T.zh ? many(T.zh, "time") + " 中文" : "中文 not used") + " · " + (T.hear ? "Hear it " + many(T.hear, "time") : "Hear it not used")) +
      row("Story", T.story.length ? "page " + T.story.join(", ") + " opened" + (T.storyHeard ? ", heard read aloud" : "") : '<span class="muted">not opened</span>') +
      row("Free play", T.play != null ? T.play + " of " + (student.play_minutes || 10) + " min" + (T.asleep ? " · outpost asleep " + W.fmtTime(T.asleep) : "") : '<span class="muted">' + (T.played ? "none" : "-") + "</span>") +
      "</dl>";

    // the week, Monday to today
    const wk = W.weekStart(t), wdays = [...Array(7)].map((_, i) => W.addDays(wk, i));
    const playedSet = new Set(sessions.map(x => x.day).concat(A.map(a => ld(a.created_at))));
    const daysPlayed = wdays.filter(k => k <= t && playedSet.has(k)).length;
    const learned = words.filter(w => w.introduced_on && w.introduced_on >= wk && w.introduced_on <= t);
    const lvWeek = levelQuests().filter(x => x.completed && ld(x.finished_at) >= wk).map(x => x.quest_day).sort((a, b) => a - b);
    const cur = currentList(), drills = quests.filter(x => x.kind === "school" && ld(x.started_at || x.created_at) >= wk).length;
    const lastTest = latestTest();
    const weekHtml = '<div class="weekdots">' + wdays.map(k => '<span class="' + (playedSet.has(k) ? "on" : "") + (k === t ? " now" : "") + (k > t ? " later" : "") + '" title="' + day3(k) + '">' + "MTWTFSS"[W.daysBetween(wk, k)] + "</span>").join("") + '<b>' + (daysPlayed > 5 ? daysPlayed + " days (goal: 5)" : daysPlayed + " of 5 days") + "</b></div>" +
      '<dl class="kv">' +
      row("Levels", lvWeek.length ? (lvWeek.length > 1 ? lvWeek[0] + " to " + lvWeek[lvWeek.length - 1] : lvWeek[0]) + " done this week" : '<span class="muted">none this week</span>') +
      row("Words learned", learned.length ? learned.length + ": " + learned.map(w => '<span class="w">' + esc(w.word) + "</span>").join(", ") : '<span class="muted">none yet</span>') +
      row("Can spell now", "<b>" + canSpell().length + "</b> words <span class=\"muted\">(memory level 2 or more)</span>") +
      row("School drill", cur ? many(drills, "drill") + " this week · " + listDrillLine(cur.rows) : '<span class="muted">no list set</span> <button type="button" class="link" data-go="school">Paste the list</button>') +
      row("Practice dictation", lastTest ? "<b>" + lastTest.score + " of " + lastTest.total + "</b> on " + day3(lastTest.taken_on) + ' <span class="muted">(marked by himself)</span>' : '<span class="muted">' + (cur ? "on " + day3(W.addDays(cur.date, -1)) + ", the day before the dictation" : "none yet") + "</span>") +
      "</dl>";

    // what slipped in the last 7 days, and the patterns in 14 days
    const week7 = W.addDays(t, -6), F = firstTries(A).filter(x => ld(x.created_at) >= week7);
    const slipMap = {};
    F.filter(x => !x.correct).forEach(x => { const k = W.key(x.word); (slipMap[k] = slipMap[k] || { word: x.word, typed: [], last: "" }).typed.push(x.answer); slipMap[k].last = ld(x.created_at); });
    const slips = Object.values(slipMap).sort((a, b) => b.typed.length - a.typed.length || (a.last < b.last ? 1 : -1));
    const tomorrow = W.addDays(t, 1);
    const slipHtml = slips.length ? '<ul class="slips">' + slips.slice(0, 6).map(sv => {
      const w = words.find(x => W.key(x.word) === W.key(sv.word)), now = F.filter(x => W.key(x.word) === W.key(sv.word)).pop();
      return "<li><b>" + esc(sv.word) + "</b><span>" + [...new Set(sv.typed)].map(v => "<i>" + esc(v) + "</i>").join(" ") + "<em>" + (sv.typed.length > 1 ? sv.typed.length + " times, last " + rel(sv.last) : rel(sv.last)) + (now && now.correct ? ", right later" : "") + "</em></span>" +
        (w && w.level > 0 ? (w.due === tomorrow ? '<span class="tagok">due tomorrow</span>' : '<button type="button" class="mini" data-retest="' + w.id + '">Test tomorrow</button>') : "") + "</li>";
    }).join("") + "</ul>" + (slips.length > 6 ? '<p class="muted">and ' + (slips.length - 6) + " more in the Log.</p>" : "") : '<p class="muted">Every first try in the last 7 days was right.</p>';
    const P = window.WW_PATTERNS;
    let pats = null, patHtml;
    if (P && typeof P.summary === "function") {
      try { pats = P.summary(A.filter(a => a.kind !== "retry")) || []; } catch (e) { pats = null; }
    }
    if (!P || typeof (P || {}).summary !== "function") patHtml = '<p class="muted">The pattern finder is not installed yet. The slips above show what he typed.</p>';
    else if (!pats) patHtml = '<p class="muted">The patterns could not be read this time.</p>';
    else if (!pats.length) patHtml = '<p class="muted">No pattern in the last 14 days.</p>';
    else patHtml = '<ul class="pats">' + pats.slice(0, 4).map(p => {
      const tip = (() => { try { return P.tip ? P.tip(p.code) : null; } catch (e) { return null; } })();
      return "<li><div><b>" + esc(p.name_en || p.code) + "</b> <span class=\"n\">" + many(p.count || 0, "time") + "</span></div>" +
        '<div class="ex">' + (p.examples || []).slice(0, 3).map(x => '<span><i>' + esc(x.typed) + "</i> for <b>" + esc(x.word) + "</b></span>").join("") + "</div>" +
        (tip && tip.en ? '<div class="tip">Orbit says: ' + esc(tip.en) + "</div>" : "") + "</li>";
    }).join("") + "</ul>";

    // before the lesson: what to do about it
    const sents = await hisSentences();
    const open = sents.filter(x => !x.answered);
    const todo = [];
    if (slips.length) todo.push("Go over " + slips.slice(0, 4).map(x => "<b>" + esc(x.word) + "</b>").join(", ") + " with him.");
    if (pats && pats.length && pats[0].count >= 2) todo.push("Practise one pattern: " + esc((pats[0].name_en || pats[0].code).toLowerCase()) + ((pats[0].examples || [])[0] ? " (" + esc(pats[0].examples[0].word) + ")" : "") + ".");
    if (open.length) todo.push('<button type="button" class="link" data-go="chat">Answer ' + many(open.length, "sentence") + "</button> he wrote.");
    if (!cur) todo.push('<button type="button" class="link" data-go="school">Paste the school list</button> and set the dictation date.');
    else if (W.daysBetween(t, cur.date) <= 2) todo.push("School dictation on <b>" + day3(cur.date) + "</b>.");
    todo.push('<button type="button" class="link" data-go="mother">Send the week to his mother</button>.');

    view.innerHTML = '<div class="dash">' +
      '<section class="box d-today"><div class="bh"><h2>Today</h2><span class="eyebrow">' + day3(t) + "</span></div>" + head + partsHtml + todayKv + "</section>" +
      '<section class="box d-slips"><div class="bh"><h2>What slipped</h2><span class="eyebrow">first tries, 7 days</span></div>' + slipHtml +
        '<div class="bh sub2"><h3>Patterns</h3><span class="eyebrow">14 days</span></div>' + patHtml + "</section>" +
      '<section class="box d-week"><div class="bh"><h2>This week</h2><span class="eyebrow">from ' + day3(wk) + "</span></div>" + weekHtml +
        '<div class="todo"><div class="bh sub2"><h3>Before the lesson</h3></div><ul>' + todo.map(x => "<li>" + x + "</li>").join("") + "</ul></div></section>" +
      islandCard() +
      "</div>" + todayMore(T, A, E);
    wireCommon();
  }
  // His island: the newest picture the game saved, and one line to use in the lesson.
  function islandCard() {
    const pic = islandPic(), at = pic && pic.at, k = at ? ld(at) : "";
    if (!pic) return '<section class="box d-island"><div class="bh"><h2>His island</h2></div>' +
      '<p class="muted">A picture of his island appears here after he has built something in the game.</p></section>';
    return '<section class="box d-island"><div class="bh"><h2>His island</h2>' + (k ? '<span class="eyebrow">saved ' + esc(rel(k)) + "</span>" : "") + "</div>" +
      '<img class="isl-pic" src="' + esc(pic.src) + '" alt="The island he built' + (k ? ", saved " + esc(day3(k)) : "") + '">' +
      (k ? '<p class="isl-at">Saved ' + esc(day3(k)) + " at " + esc(W.fmtTime(at)) + ".</p>" : "") +
      '<p class="isl-ask">Ask him to tell you in English what he built.</p></section>';
  }
  // Below the first screen: everything the page showed before, in calm words.
  function todayMore(T, A, E) {
    const t = W.today(), od = openDay(), lastDone = levelQuests().filter(x => x.completed).reduce((m, x) => Math.max(m, x.quest_day), 0);
    const nextL = lastDone + 1, nextSt = nextL <= maxDay() ? dayState(nextL) : "end";
    const path = "level " + lastDone + " of " + maxDay() + " done · " + zoneName(Math.max(1, lastDone)) + (od ? " · level " + od + " open now" + (isTest(od) ? " (island test)" : "") : nextSt === "empty" ? " · level " + nextL + " has no approved words yet" : nextSt === "locked" ? " · level " + nextL + " opens tomorrow" : " · all done");
    const total = new Set(sessions.map(x => x.day)).size;
    const b = buildObj();
    const row = (k, v) => "<dt>" + k + "</dt><dd>" + v + "</dd>";
    const levelsToday = T.done.concat(T.open);
    const kv = '<dl class="kv">' +
      row("Levels", path) +
      (levelsToday.length ? row("Level times", levelsToday.map(x => "level " + x.quest_day + " " + W.fmtTime(x.started_at) + (x.finished_at && ld(x.finished_at) === t ? " to " + W.fmtTime(x.finished_at) : ", not finished") + ", " + many(x.diamonds_earned || 0, "diamond")).join("; ")) : "") +
      row("Days in his world", total + " in all") +
      row("Diamonds", diamondsEarned() + " earned, " + diamondsSpent() + " spent in the shop, " + (diamondsEarned() - diamondsSpent()) + " in his pocket · " + (b.cells.length + (b.cells3 || []).length) + " pieces placed in his build" + (T.pauses ? " · stopped " + many(T.pauses, "time") + " between parts" : "")) +
      row("Games", T.games.length ? T.games.filter(g => g.detail && g.detail.correct).length + " of " + T.games.length + " right" : "none played") +
      row("Sentences", T.sentences.length + " written, " + T.skipped + " skipped") +
      row("Beats clapped", T.claps.length ? many(T.claps.length, "word") : "none") +
      row("Focus score", T.s && T.s.focus_score ? T.s.focus_score + " / 5" : "not given") + "</dl>";
    const att = T.attempts;
    return '<div class="more"><section class="box"><div class="bh"><h2>More about today</h2></div>' + kv +
      (T.drawn.length ? '<h3>His writing in the box today</h3><div class="drawings">' + T.drawn.map(e => '<figure><img src="' + e.detail.png + '" alt="' + esc(e.detail.word) + '"><figcaption>' + esc(e.detail.word) + " · " + W.fmtTime(e.created_at) + "</figcaption></figure>").join("") + "</div>" : "") +
      (T.sentences.length ? "<h3>His sentences today</h3>" + T.sentences.map(e => '<div class="mine"><span>' + esc(e.detail.word) + "</span>" + esc(e.detail.sentence) + "</div>").join("") : "") +
      '</section><section class="box"><div class="bh"><h2>Last 5 weeks</h2></div>' + calendar() + '<p class="muted">Filled: a level finished. Ring: came in, no level finished.</p>' +
      "<h3>Words that slipped more than once</h3>" + watchList() + "</section></div>" +
      '<section class="box"><div class="bh"><h2>Every answer today</h2></div>' + (att.length ? '<div class="scroll"><table><tr><th>Time</th><th>Word</th><th>Question</th><th>Kind</th><th>He typed</th><th>Result</th><th>Level</th></tr>' +
        att.map(a => "<tr><td>" + W.fmtTime(a.created_at) + "</td><td>" + esc(a.word) + "</td><td>" + esc(a.step || "") + "</td><td>" + esc(a.kind) + '</td><td class="typed' + (a.correct ? " ok" : "") + '">' + esc(a.answer) + '</td><td class="' + (a.correct ? "good" : "ny") + '">' + (a.correct ? "right" : "not yet") + "</td><td>" + (a.level_before == null ? "" : a.level_before + " to " + a.level_after) + "</td></tr>").join("") + "</table></div>" : '<p class="muted">Nothing yet today.</p>') + "</section>";
  }
  function calendar() {
    const t = W.today(), start = W.addDays(W.weekStart(t), -28);
    const map = {}; sessions.forEach(s => map[s.day] = "part"); levelQuests().forEach(x => { if (x.completed && x.finished_at) map[ld(x.finished_at)] = "done"; });
    let h = '<div class="cal">' + ["M", "T", "W", "T", "F", "S", "S"].map(d => '<div class="hd">' + d + "</div>").join("");
    for (let k = start, i = 0; i < 35; k = W.addDays(k, 1), i++) h += '<div class="' + (map[k] || "") + (k === t ? " today" : "") + (k > t ? " future" : "") + '">' + +k.slice(8) + "</div>";
    return h + "</div>";
  }
  function watchList() {
    const bad = words.filter(w => w.level > 0 && w.wrong_streak >= 2).sort((a, b) => b.wrong_streak - a.wrong_streak).slice(0, 8);
    const noSent = words.filter(w => w.level > 0 && !w.student_sentence).length;
    const extra = words.filter(w => (w.weak_types || []).length).map(w => "<li><b>" + esc(w.word) + "</b>: extra game not yet right on the first try: " + esc(w.weak_types.join(", ")) + "</li>").join("");
    return (bad.length ? '<ul class="plain">' + bad.map(w => "<li><b>" + esc(w.word) + "</b>: not yet right " + w.wrong_streak + " times in a row</li>").join("") + "</ul>" : '<p class="muted">No word has slipped twice in a row.</p>') +
      (extra ? '<ul class="plain">' + extra + "</ul>" : "") +
      (noSent ? '<p class="muted">' + noSent + " learned word" + (noSent > 1 ? "s have" : " has") + " no sentence of his own yet.</p>" : "");
  }
  // Buttons that appear on several tabs.
  function wireCommon() {
    view.querySelectorAll("[data-go]").forEach(b => b.onclick = () => go(b.dataset.go));
    // "Test tomorrow": bring a learned word back into tomorrow's old words, whatever its level says.
    view.querySelectorAll("[data-retest]").forEach(b => b.onclick = async () => { const { error } = await sb.from("words").update({ due: W.addDays(W.today(), 1) }).eq("id", b.dataset.retest); if (error) banner(error.message); else { const w = words.find(x => x.id === b.dataset.retest); if (w) w.due = W.addDays(W.today(), 1); b.textContent = "Due tomorrow"; b.disabled = true; } });
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
    return seen.length ? seen.length + " of " + rows.length + " words drilled, " + lastRight + " right last time" : rows.length + " words, not drilled yet";
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
    const t = W.today(), L = lists(), cur = currentList();
    const nextWed = (() => { let k = W.addDays(t, 1); while (new Date(k + "T00:00:00").getDay() !== 3) k = W.addDays(k, 1); return k; })();
    const listHtml = l => {
      const test = tests.filter(x => x.dictation_date === l.date).pop();
      const past = l.date < t;
      return '<section class="box sc-list' + (past ? " past" : "") + '" data-date="' + l.date + '"><div class="bh"><h2>Dictation ' + day3(l.date) + "</h2><span class=\"eyebrow\">" + (l === cur ? "current list · " : past ? "past · " : "") + many(l.rows.length, "word") + "</span>" +
        '<span class="grow"></span><label class="inl">Date <input type="date" class="sc-date" value="' + l.date + '"></label><button type="button" class="ghost mini sc-move">Change date</button><button type="button" class="ghost mini red sc-dellist">Delete list</button></div>' +
        '<p class="muted">' + listDrillLine(l.rows) + (test ? " · practice dictation <b>" + test.score + " of " + test.total + "</b> on " + day3(test.taken_on) + " (marked by himself)" + (test.missed && test.missed.length ? ", missed: " + test.missed.map(esc).join(", ") : "") : "") + "</p>" +
        '<div class="row sc-zhbar"><span class="sc-fillslot"></span><button type="button" class="mini sc-zhsave" disabled>Save the Chinese</button><span class="muted sc-zhmsg"></span></div>' +
        '<table class="sc-words"><tr><th>Word</th><th>Chinese</th><th>Drills</th><th>Right first try</th><th>Last time</th><th></th></tr>' + l.rows.map(r => '<tr data-id="' + r.id + '"><td class="w">' + esc(r.word) + (schoolPic(r.word) ? "" : ' <span class="sc-nopic">no picture yet</span>') + '</td><td class="zhc"><input type="text" class="sc-zh" lang="zh" value="' + esc(r.meaning_zh || "") + '" aria-label="Chinese for ' + esc(r.word) + '"></td><td>' + (r.tries || 0) + "</td><td>" + (r.right || 0) + "</td><td>" + (r.last_seen ? (r.last_right === false ? '<span class="ny">not yet</span>' : r.last_right ? '<span class="good">right</span>' : "") + " " + day3(ld(r.last_seen)) : '<span class="muted">not seen</span>') + '</td><td class="acts"><button type="button" class="mini ghost sc-edit">Edit</button><button type="button" class="mini ghost sc-del" aria-label="Delete ' + esc(r.word) + '">' + ICON("x") + "</button></td></tr>").join("") + "</table></section>";
    };
    view.innerHTML = '<div class="sc-grid"><section class="box"><div class="bh"><h2>Add the week\'s school words</h2></div>' +
      '<p class="muted">Paste the list: one word a line, or with commas. Words are kept exactly as typed (February, don\'t). A line may carry the Chinese after the word (because 因为); he sees it when he learns the word. He drills five words a day in the game and does a practice dictation on paper the day before.</p>' +
      '<textarea id="scText" rows="9" placeholder="February 二月&#10;don\'t&#10;Wednesday&#10;because"></textarea>' +
      '<div class="row"><label class="f inl">Dictation date <input type="date" id="scDate" value="' + (cur ? cur.date : nextWed) + '"></label><button type="button" id="scAdd">Add to the list</button></div><p class="err" id="scErr"></p><p class="ok" id="scOk"></p></section>' +
      '<div class="sc-lists">' + (L.length ? L.slice().reverse().filter(l => l.date >= W.addDays(t, -21)).map(listHtml).join("") : '<section class="box"><p class="muted">No school list yet.</p></section>') + "</div></div>";
    $("scAdd").onclick = async () => {
      const date = $("scDate").value, list = splitList($("scText").value);
      $("scErr").textContent = ""; $("scOk").textContent = "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { $("scErr").textContent = "Set the dictation date."; return; }
      if (!list.length) { $("scErr").textContent = "Paste the words first."; return; }
      const bad = list.filter(x => !wordOk(x.word)).map(x => x.word); if (bad.length) { $("scErr").textContent = "Only letters, apostrophes and hyphens, please. Check: " + bad.join(", "); return; }
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
    view.innerHTML = '<div class="letters"><section class="box"><div class="bh"><h2>His sentences</h2><span class="eyebrow">' + (S.filter(x => !x.answered).length ? S.filter(x => !x.answered).length + " waiting" : "all answered") + "</span></div>" +
      '<p class="muted">One tap sends a short letter to his mailbox with his sentence in it. Or write your own.</p>' +
      (S.length ? '<ul class="sents">' + S.map((s, i) => '<li data-i="' + i + '" class="' + (s.answered ? "done" : "") + '"><div class="sline"><span class="w">' + esc(s.word) + '</span><q>' + esc(s.sentence) + "</q>" + (s.at ? '<span class="muted">' + day3(ld(s.at)) + "</span>" : "") + "</div>" +
        (s.answered ? '<div class="sent-ok">' + ICON("check") + "Answered: " + esc(s.answered) + "</div>" :
          '<div class="stamps">' + STAMPS.map((x, k) => '<button type="button" class="stampbtn" data-stamp="' + k + '">' + esc(x) + "</button>").join("") + '<button type="button" class="ghost mini" data-write>' + ICON("pencil") + "Write a reply</button></div>" +
          '<form class="replyf" hidden><input type="text" maxlength="200" placeholder="Your reply, short and in English"><button type="submit">Send</button></form>') + "</li>").join("") + "</ul>" : '<p class="muted">No sentences of his own yet. He writes one in the "My sentence" step of a level.</p>') +
      '</section><section class="box"><div class="bh"><h2>Letters</h2><span class="eyebrow">to ' + esc(student.name) + "</span></div>" +
      '<p class="muted">Your newest letter is in his mailbox when he comes in. In his game you are <b>' + esc(student.teacher_name || "WordWizard") + "</b>. Keep it short; he cannot write back.</p>" +
      '<div class="chat" id="chat">' + (messages.length ? messages.map(m => '<div class="msg ' + (m.from_role === "teacher" ? "me" : "him") + '"><span>' + (m.from_role === "teacher" ? "You · " : esc(student.name) + " · ") + day3(ld(m.created_at)) + " " + W.fmtTime(m.created_at) + (m.from_role === "teacher" ? (m.read_at ? " · opened" : " · not opened yet") : "") + "</span>" + esc(m.text) + "</div>").join("") : '<p class="muted">No letters yet.</p>') + "</div>" +
      '<form id="cf" class="row" autocomplete="off"><input type="text" id="ctext" maxlength="300" placeholder="Write to him…"><button type="submit">Send</button></form></section></div>';
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
    if (f.test) L.push("· 为学校听写做的练习：" + f.test.total + " 个词写对了 " + f.test.score + " 个（他自己对照批改的）。");
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
    view.innerHTML = '<div class="mother"><section class="box"><div class="bh"><h2>The week for his mother</h2><span class="eyebrow">in Chinese</span></div>' +
      '<p class="muted">A short note in Chinese about the last 7 days, and the same as a picture, to forward by WhatsApp or WeChat. You can change the text before you copy it.</p>' +
      '<div class="row"><button type="button" id="mkSum">Make the summary</button><button type="button" class="ghost" id="copySum" disabled>' + ICON("copy") + "Copy text</button><span class=\"ok\" id=\"copyOk\"></span></div>" +
      '<textarea id="sumText" rows="12" class="zhtext" lang="zh-CN" placeholder="Press Make the summary."></textarea></section>' +
      '<section class="box"><div class="bh"><h2>As a picture</h2></div><p class="muted" id="picHow">Press Make the summary.</p><div id="sumPic" class="sumpic"></div></section></div>';
    let F = null, timer = null;
    const draw = async () => {
      const src = await motherPicture($("sumText").value, F);
      $("sumPic").innerHTML = src ? '<img id="sumImg" src="' + src + '" alt="The summary as a picture">' + (framed() ? "" : '<p><a href="' + src + '" download="word-world-week.png">Download the picture</a></p>') : '<p class="muted">This browser cannot draw the picture. Copy the text instead.</p>';
      $("picHow").textContent = src ? "Right-click the picture and choose Copy image or Save image (on a phone: press and hold)." : "";
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

  // ---------- words ----------
  function renderWords() {
    const t = W.today();
    const rows = words.map(w => '<tr data-id="' + w.id + '"><td>' + (w.quest_day ? "<b>" + w.quest_day + "</b>" + (isTest(w.quest_day) ? '<br><span class="muted">test</span>' : "") : '<span class="tagw">no level</span>') + "</td><td>" + picHtml(w) + "</td><td><b>" + esc(w.word) + '</b><br><span class="muted">' + esc(w.chunks) + (w.focus ? ' · colour <b class="hot">' + esc(w.focus) + "</b>" : "") + "</span>" + "</td>" +
      "<td>" + esc(w.meaning_en) + '<br><span class="muted zh">' + esc(w.meaning_zh) + "</span></td>" +
      "<td>" + (w.approved ? '<span class="tagok">approved</span>' : '<span class="tagw">draft</span>') + "</td>" +
      "<td>" + ladder[w.level] + (w.level > 0 && w.level < W.DIAMOND ? '<br><span class="muted">due ' + (w.due <= t ? "today" : esc(w.due)) + "</span>" : "") + (w.wrong_streak ? '<br><span class="ny">not yet right ' + w.wrong_streak + " in a row</span>" : "") + (w.level > 0 ? '<br><button type="button" class="ghost mini" data-retest="' + w.id + '">Test tomorrow</button>' : "") + "</td>" +
      "<td>" + (w.dialogue_q ? '<span class="good">chat</span>' : '<span class="muted">no chat</span>') + "</td><td>" + esc(w.student_sentence) + '</td><td><button type="button" class="ghost mini" data-edit="' + w.id + '">Edit</button></td></tr>').join("");
    const unplanned = words.filter(w => w.approved && !w.quest_day).length;
    let plan = ""; for (let zi = 0; zi < Math.ceil(maxDay() / PER_ZONE); zi++) {
      const first = zi * PER_ZONE + 1, last = Math.min(maxDay(), first + PER_ZONE - 1);
      plan += '<h3 class="zh3">' + ZONE_NAMES[zi % ZONE_NAMES.length] + " <small>levels " + first + " to " + last + " · " + esc((words.find(w => w.quest_day >= first && w.quest_day <= last && w.rule_en) || { rule_en: "no rule written" }).rule_en) + '</small></h3><div class="plan">';
      for (let d = first; d <= last; d++) plan += '<div class="pd ' + dayState(d) + (isTest(d) ? " test" : "") + '"><b>' + d + (isTest(d) ? " test" : "") + "</b>" + (words.filter(w => w.quest_day === d).map(w => esc(w.word) + (w.approved ? "" : " (draft)")).join(", ") || '<i class="ny">no words</i>') + "</div>";
      plan += "</div>";
    }
    view.innerHTML = '<section class="box"><div class="bh"><h2>50 levels</h2><span class="eyebrow">level 1 opens on ' + esc(student.start_date || W.today()) + ", change it on the Student tab</span></div>" + plan +
      '<p class="muted">Each level teaches the two words you give it, then checks older words that are due. He plays them in order: the next opens the day after he finishes, and at most two a day. Every 10th level is the island test: listen and type up to 10 of that island\'s words. A level with no approved words stays shut until you fill it.</p></section>' +
      '<section class="box"><div class="bh"><h2>Words</h2><span class="eyebrow">' + words.filter(w => w.approved && w.level === 0).length + " approved and waiting, " + words.filter(w => w.level > 0).length + " learned" + (unplanned ? ", " + unplanned + " with no level" : "") + "</span></div>" +
      '<div class="row"><button type="button" id="addBtn">Add a word</button><button type="button" class="ghost" id="bulkBtn">Paste words (bulk)</button><button type="button" class="ghost" id="autoDays">Give levels to words without one (' + (student.new_per_day || 2) + ' per level)</button><button type="button" class="ghost" id="approveAll">Approve all drafts</button></div>' +
      '<div id="editor"></div>' +
      (words.length ? '<div class="scroll"><table class="wt"><tr><th>Level</th><th></th><th>Word</th><th>Meaning</th><th>Status</th><th>Memory</th><th>Chat</th><th>His sentence</th><th></th></tr>' + rows + "</table></div>" : '<p class="muted">No words yet. Add a word, or paste a week.</p>') + "</section>";
    $("addBtn").onclick = () => editor(null);
    $("bulkBtn").onclick = bulk;
    $("autoDays").onclick = async () => {
      const per = student.new_per_day || 2, taken = {}; words.forEach(w => { if (w.quest_day) taken[w.quest_day] = (taken[w.quest_day] || 0) + 1; });
      let d = 1; const todo = words.filter(w => !w.quest_day).sort((a, b) => a.sort_order - b.sort_order);
      for (const w of todo) { while ((taken[d] || 0) >= per || dayDone(d)) d++; taken[d] = (taken[d] || 0) + 1; const { error } = await sb.from("words").update({ quest_day: d }).eq("id", w.id); if (error) { banner(error.message); break; } }
      await loadAll(); renderWords();
    };
    $("approveAll").onclick = async () => {
      const ids = words.filter(w => !w.approved).map(w => w.id); if (!ids.length) return;
      const { error } = await sb.from("words").update({ approved: true }).in("id", ids);
      if (error) banner(error.message); await loadAll(); renderWords();
    };
    view.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => editor(words.find(w => w.id === b.dataset.edit)));
    wireCommon();
  }
  // A word's checks. Returns an error line or "". The word is kept as typed; duplicates are found with W.key.
  function checkWord(word, chunks, sen, dq, da, focus, selfId) {
    if (!word) return "Word is missing.";
    if (!wordOk(word)) return "Only letters, apostrophes and hyphens in a word.";
    const dup = words.find(x => x.id !== selfId && W.key(x.word) === W.key(word));
    if (dup) return '"' + dup.word + '" is already in the list' + (dup.quest_day ? " (level " + dup.quest_day + ")" : "") + ".";
    if (W.key(chunks.replace(/-/g, "")) !== W.key(word)) return "The beats must spell the word exactly.";
    if (sen && !W.hasWord(sen, word)) return "The sentence must contain the word.";
    if ((dq || da) && !(dq && da)) return "Chat needs both lines, or leave both empty.";
    if (da && !W.hasWord(da, word)) return "The chat reply must contain the word.";
    if (focus && W.key(word).indexOf(focus) === -1) return "The letters to colour must appear in the word.";
    return "";
  }
  function editor(w) {
    const v = k => esc(w ? w[k] : "");
    $("editor").innerHTML = '<form id="wf" class="form edit">' +
      '<label class="f">Word (kept as typed: February, don\'t)<input type="text" id="f_word" value="' + v("word") + '" ' + (w && w.level > 0 ? "readonly" : "") + "></label>" +
      '<label class="f">Beats (um-brel-la)<input type="text" id="f_chunks" value="' + v("chunks") + '"></label>' +
      '<label class="f">Picture (photo or saved image; shrunk to fit)<input type="file" id="f_pic" accept="image/*">' + (w && w.picture ? '<img src="' + w.picture + '" alt="" class="prev">' : "") + "</label>" +
      '<label class="f">Letters to colour (the island\'s rule, e.g. ll)<input type="text" id="f_focus" value="' + v("focus") + '" maxlength="6"></label>' +
      '<label class="f">Rule, one line (shown on the card)<input type="text" id="f_rule" value="' + v("rule_en") + '" placeholder="After a short vowel, double the letter"></label>' +
      '<label class="f">Rule in Chinese<input type="text" id="f_rulezh" value="' + v("rule_zh") + '"></label>' +
      '<label class="f">Order<input type="number" id="f_order" value="' + (w ? w.sort_order : (words.length ? Math.max(...words.map(x => x.sort_order)) + 1 : 1)) + '"></label>' +
      '<label class="f">Level (1 to 50, empty = not planned)<input type="number" id="f_day" min="1" max="99" value="' + (w && w.quest_day ? w.quest_day : "") + '"></label>' +
      '<label class="f">Meaning (simple English)<input type="text" id="f_en" value="' + v("meaning_en") + '"></label>' +
      '<label class="f">Meaning (中文)<input type="text" id="f_zh" value="' + v("meaning_zh") + '"></label>' +
      '<label class="f wide">Sentence (must contain the word)<input type="text" id="f_sen" value="' + v("sentence_en") + '"></label>' +
      '<label class="f wide">Sentence (中文)<input type="text" id="f_szh" value="' + v("sentence_zh") + '"></label>' +
      '<label class="f wide">Chat: what you say to him (e.g. What did you build today?)<input type="text" id="f_dq" value="' + v("dialogue_q") + '"></label>' +
      '<label class="f wide">Chat: the reply he should pick (must contain the word)<input type="text" id="f_da" value="' + v("dialogue_a") + '"></label>' +
      '<label class="f"><span>Approved (he can see it)</span><select id="f_ok"><option value="false"' + (w && w.approved ? "" : " selected") + '>draft</option><option value="true"' + (w && w.approved ? " selected" : "") + ">approved</option></select></label>" +
      '<div class="row wide"><button type="submit">Save</button><button type="button" class="ghost" id="cancel">Cancel</button>' + (w ? '<button type="button" class="red" id="del">Delete</button>' : "") + '<span class="err" id="ferr"></span></div></form>';
    $("cancel").onclick = () => $("editor").innerHTML = "";
    if ($("del")) $("del").onclick = async () => {
      if (w.level > 0 && !$("del").dataset.sure) { $("del").dataset.sure = "1"; $("del").textContent = "Delete and lose his progress?"; return; }
      const { error } = await sb.from("words").delete().eq("id", w.id); if (error) banner(error.message); await loadAll(); renderWords();
    };
    $("wf").onsubmit = async e => {
      e.preventDefault();
      const word = asTyped($("f_word").value), chunks = cleanBeats($("f_chunks").value) || word.replace(/[\s]/g, "");
      const sen = $("f_sen").value.trim(), dq = $("f_dq").value.trim(), da = $("f_da").value.trim(), focus = W.key($("f_focus").value);
      const err = checkWord(word, chunks, sen, dq, da, focus, w && w.id);
      if (err) { $("ferr").textContent = err; return; }
      const row = { student_id: student.id, word, chunks, sort_order: +$("f_order").value || 0, quest_day: +$("f_day").value || null, meaning_en: $("f_en").value.trim(), meaning_zh: $("f_zh").value.trim(), sentence_en: sen, sentence_zh: $("f_szh").value.trim(), dialogue_q: dq, dialogue_a: da, approved: $("f_ok").value === "true",
        focus, rule_en: $("f_rule").value.trim(), rule_zh: $("f_rulezh").value.trim() };
      const f = $("f_pic").files && $("f_pic").files[0]; if (f) { const data = await W.shrinkImage(f, 480); if (data) row.picture = data; else { $("ferr").textContent = "That picture could not be read."; return; } }
      const r = w ? await sb.from("words").update(row).eq("id", w.id) : await sb.from("words").insert(row);
      if (r.error) { $("ferr").textContent = r.error.message; return; }
      await loadAll(); renderWords();
    };
  }
  function bulk() {
    $("editor").innerHTML = '<div class="edit"><p class="muted">One word per line, parts separated by TAB (paste from a spreadsheet, or from Claude): word, beats, meaning in English, meaning in Chinese, sentence, sentence in Chinese, (not used: leave empty), chat line you say, chat reply he picks (must contain the word), level, letters to colour, (not used), rule, rule in Chinese. Everything after the sentence in Chinese can be empty; leave the level empty and press "Give levels" afterwards. Words are kept as typed (February, don\'t). Added as drafts in this order; approve after you check them.</p>' +
      '<textarea id="bulkTxt" rows="8" placeholder="remember\tre-mem-ber\tto keep something in your mind\t记住\tI always remember where I hid my diamonds.\t我总是记得我把钻石藏在哪里。\t\tWhat did you build today?\tI remember, I built a big tower!"></textarea>' +
      '<div class="row"><button type="button" id="bulkGo">Add as drafts</button><button type="button" class="ghost" id="cancel">Cancel</button><span class="err" id="berr"></span></div></div>';
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
      if (bad.length) { $("berr").textContent = "Check these lines (beats, sentence or chat reply do not match the word, only one chat line, or the word is already in the list): " + bad.join(", "); return; }
      if (!rows.length) return;
      const { error } = await sb.from("words").insert(rows);
      if (error) { $("berr").textContent = error.message; return; }
      await loadAll(); renderWords();
    };
  }

  // ---------- log ----------
  async function renderLog(day) {
    day = day || W.today();
    const from = new Date(day + "T00:00:00").toISOString(), to = new Date(W.addDays(day, 1) + "T00:00:00").toISOString();
    const [att, ev] = await Promise.all([
      sb.from("attempts").select("*").eq("student_id", student.id).gte("created_at", from).lt("created_at", to).order("created_at"),
      sb.from("events").select("*").eq("student_id", student.id).gte("created_at", from).lt("created_at", to).order("created_at")
    ]);
    const shown = d => { const o = Object.assign({}, d); ["png", "audio"].forEach(k => delete o[k]); return Object.keys(o).length ? ' <span class="muted">' + esc(JSON.stringify(o)) + "</span>" : ""; };
    const items = (att.data || []).map(a => ({ t: a.created_at, h: "<b>" + esc(a.word) + "</b> " + (a.step ? esc(a.step) + " " : "") + esc(a.kind) + ': typed "' + esc(a.answer) + '" <span class="' + (a.correct ? "good" : "ny") + '">' + (a.correct ? "right" : "not yet") + "</span>" + (a.level_before == null ? "" : " (level " + a.level_before + " to " + a.level_after + ")") }))
      .concat((ev.data || []).filter(e => e.type !== "voice" && e.type !== "say").map(e => ({ t: e.created_at, h: esc(({ pin_wrong: "PIN typed, not yet right" })[e.type] || e.type.replace(/_/g, " ")) + shown(e.detail || {}) })))
      .sort((a, b) => a.t < b.t ? -1 : 1);
    view.innerHTML = '<section class="box"><div class="bh"><h2>Log</h2></div><div class="row"><label class="f inl">Day <input type="date" id="day" value="' + day + '"></label><button type="button" class="ghost" id="csv">Download all answers (CSV)</button></div>' +
      (items.length ? '<div class="log">' + items.map(i => "<div><time>" + W.fmtTime(i.t) + "</time><span>" + i.h + "</span></div>").join("") + "</div>" : '<p class="muted">Nothing on this day.</p>') + "</section>";
    $("day").onchange = () => renderLog($("day").value);
    $("csv").onclick = async () => {
      const { data } = await sb.from("attempts").select("*").eq("student_id", student.id).order("created_at");
      const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
      const csv = ["created_at,word,question,kind,answer,correct,level_before,level_after"].concat((data || []).map(a => [a.created_at, a.word, a.step, a.kind, a.answer, a.correct, a.level_before, a.level_after].map(q).join(","))).join("\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "word-world-answers.csv"; a.click();
    };
  }

  // ---------- his device's voice: the game saves the list (students.voices), reads voice_name and voice_rate ----------
  const VOICE_SAMPLE = "Umbrella. Take your umbrella. Tap each beat.";
  const VOICE_RATES = { normal: 0.8, slower: 0.62 };   // the same rates the game uses for a word, and for a word said slowly
  const hisVoices = () => (Array.isArray(student.voices) ? student.voices : []).filter(v => v && v.name);
  function voiceCard() {
    const vs = hisVoices(), cur = student.voice_name || "", rate = student.voice_rate === "slower" ? "slower" : "normal";
    const opt = (val, label, extra, listen) => '<li class="' + (val === cur ? "on" : "") + '"><label><input type="radio" name="vname" value="' + esc(val) + '"' + (val === cur ? " checked" : "") + '><span><b>' + esc(label) + "</b>" + (extra ? ' <span class="muted">' + extra + "</span>" : "") + "</span></label>" +
      (listen ? '<button type="button" class="ghost mini" data-listen="' + esc(val) + '">Listen</button>' : "") + "</li>";
    const rows = opt("", "Let the game choose (a British voice if there is one)", "", false) +
      vs.map(v => opt(v.name, v.name, esc(v.lang || "") + (v.local === false ? " · needs the internet" : ""), true)).join("") +
      (cur && !vs.some(v => v.name === cur) ? opt(cur, cur, "not in the list his laptop sent last", true) : "");
    return '<section class="box narrow voice"><div class="bh"><h2>Voice</h2><span class="eyebrow">the voices on his laptop</span></div>' +
      '<p class="muted">The guide and the words are read by a voice on his laptop. Choose the clearest one.</p>' +
      (vs.length ? "" : '<p class="needs">The list appears after he has opened the game once on his laptop.</p>') +
      '<ul class="vlist">' + rows + "</ul>" + '<p class="muted" id="vmsg"></p>' +
      '<div class="bh sub2"><h3>Speed</h3></div><div class="row vrate">' +
      ["normal", "slower"].map(r => '<label class="inl"><input type="radio" name="vrate" value="' + r + '"' + (r === rate ? " checked" : "") + "> " + (r === "normal" ? "Normal" : "Slower") + "</label>").join("") +
      '<span class="ok" id="vok"></span></div></section>';
  }
  function wireVoice() {
    const save = async (row, sel) => {
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
      if (!v) { msg.textContent = "This voice is on his laptop, not on this computer. He can press Voice test in the game's menu."; return; }
      try {
        window.speechSynthesis.cancel();
        const u = new window.SpeechSynthesisUtterance(VOICE_SAMPLE); u.voice = v; u.lang = v.lang || "en-GB";
        u.rate = VOICE_RATES[student.voice_rate === "slower" ? "slower" : "normal"];
        window.speechSynthesis.speak(u);
      } catch (e) { msg.textContent = "This computer could not play the voice just now."; }
    });
  }

  // ---------- student ----------
  function renderStudent() {
    view.innerHTML = '<section class="box narrow"><div class="bh"><h2>' + esc(student.name) + "</h2></div>" +
      '<dl class="kv"><dt>Device</dt><dd>' + (student.paired_uid ? '<span class="tagok">connected</span>' + (student.paired_at ? " since " + new Date(student.paired_at).toLocaleDateString() : "") : '<span class="tagw">not connected</span>') + "</dd>" +
      '<dt>Pairing code</dt><dd class="code">' + esc(student.pairing_code) + "</dd></dl>" +
      '<p class="muted">On his device, open the game and type this code once. If he gets a new device or clears the browser, press New code and connect again.</p>' +
      '<div class="row"><button type="button" class="ghost" id="newcode">New code</button></div>' +
      '<form id="stf" class="form"><label class="f">Name<input type="text" id="s_name" value="' + esc(student.name) + '"></label>' +
      '<label class="f">PIN<input type="text" id="s_pin" value="' + esc(student.pin) + '" maxlength="4" inputmode="numeric"></label>' +
      '<label class="f">Your gamer name in his game<input type="text" id="s_tn" value="' + esc(student.teacher_name || "WordWizard") + '" maxlength="24"></label>' +
      '<label class="f">Level 1 opens on (date)<input type="date" id="s_start" value="' + esc(student.start_date || W.today()) + '"></label>' +
      '<label class="f">Old words a day, at most<input type="number" id="s_cap" value="' + (student.review_cap || W.REVIEW_CAP) + '" min="1" max="30"></label>' +
      '<p class="muted wide">Each word comes back after 1, 4 and 14 days, then it is a star word. With 2 new words a day that is 6 old words a day.</p>' +
      '<label class="f">Free play after a level (minutes)<input type="number" id="s_play" value="' + (student.play_minutes || 10) + '" min="0" max="60"></label>' +
      '<label class="f">Words per level (used by "Give levels")<input type="number" id="s_new" value="' + (student.new_per_day || 2) + '" min="1" max="5"></label>' +
      '<div class="row wide"><button type="submit">Save</button><span class="ok" id="sok"></span></div></form></section>' + voiceCard();
    wireVoice();
    $("newcode").onclick = async () => { const { error } = await sb.rpc("reset_pairing", { student: student.id }); if (error) banner(error.message); await loadAll(); renderStudent(); };
    $("stf").onsubmit = async e => {
      e.preventDefault();
      const n = (id, d, lo, hi) => { const x = Math.round(+$(id).value); return isFinite(x) && $(id).value !== "" ? Math.max(lo, Math.min(hi, x)) : d; };
      const { error } = await sb.from("students").update({ name: $("s_name").value.trim(), pin: $("s_pin").value.trim(), teacher_name: $("s_tn").value.trim() || "WordWizard", new_per_day: n("s_new", 2, 1, 5), start_date: $("s_start").value || W.today(),
        review_cap: n("s_cap", W.REVIEW_CAP, 1, 30), play_minutes: n("s_play", 10, 0, 60) }).eq("id", student.id);
      if (error) banner(error.message); else { $("sok").textContent = "Saved."; await loadAll(); }
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
      pooled: { long: longW, probe: probeW, help: helpW, days: daysW, growN, rising, hintsRising }, totals: { old: memAll.n, probe: probeAll.n, firstTries: help.reduce((s, h) => s + h.n, 0) },
      results: (D.results || []).filter(r => r && r.date && +r.total > 0).slice().sort((a, b) => (a.date < b.date ? -1 : 1))
    };
  }

  // The numbers Claude gets, worked out here only (the Edge Function on the real site does not count again).
  // No name, no id, none of his sentences. The names the page knows are cleaned out before they leave (WW_AI.scrub, site/ai-prompt.js).
  function aiNumbers(P) {
    const L = P.last, sh = arr => arr.map(c => pct(shareOf(c))), n = arr => arr.map(c => c.n);
    const data = {
      weeks_starting_monday: P.weeks, this_week_starts: P.weeks[L], verdict_uses_weeks: P.win.map(i => P.weeks[i]),
      verdict: { result: P.verdict.title, reason: P.verdict.reason, what_to_try: P.verdict.next },
      measures: {
        memory: { about: "old words that came back, share right on the first try (percent)", weekly_percent_right: sh(P.mem), weekly_answers: n(P.mem),
          this_week_by_days_away: AWAY.map((x, j) => ({ back: x.label, right: P.away[L][j].right, of: P.away[L][j].n })),
          last_3_weeks_back_after_14_days_or_more: { right: P.pooled.long.right, of: P.pooled.long.n } },
        new_rule_words: { about: "words never taught that follow the island's rule, one try each (percent right)", weekly_percent_right: sh(P.probe), weekly_answers: n(P.probe),
          last_3_weeks: { right: P.pooled.probe.right, of: P.pooled.probe.n }, rising_3_weeks: P.pooled.rising,
          by_island: Object.keys(P.islands).sort().map(k => ({ island: +k, right: P.islands[k].right, of: P.islands[k].n })) },
        words_spelled_now: { about: "words at memory level 2 or more at the end of each week", weekly: P.spell, change_from_last_week: P.spell[L] - P.spell[L - 1], slipped_down_a_step_this_week: P.slippedWords.length },
        help: { about: "hints per first try", weekly_hints_per_first_try: P.hintsPer.map(x => x == null ? null : round1(x)), weekly_first_tries: P.help.map(h => h.n), weekly_hints: P.help.map(h => h.hints) }
      },
      days_played_weekly: P.days,
      minutes_per_level_median_this_week: P.perLevel.length ? round1(median(P.perLevel)) : null,
      words_typed_per_minute_this_week: P.weekMins > 0 ? round1(P.typed / P.weekMins) : null,
      slips_this_week: P.slips.slice(0, 40),
      hints_by_word_this_week: P.hintWords.slice(0, 20),
      patterns: P.patterns ? P.patterns.map(p => ({ pattern: p.name, this_week: p.now, four_weeks_before: p.before, examples: p.examples.map(x => ({ word: x.word, typed: x.typed })) })) : "not available",
      school_dictation: P.results.slice(-8).map(r => ({ date: r.date, right: +r.right, of: +r.total })),
      thresholds: RULES
    };
    const AI = window.WW_AI;
    if (!AI) throw { code: "no_prompt" };
    return AI.scrub(data, [student && student.name, student && student.teacher_name, me && me.email ? String(me.email).split("@")[0] : ""]).data;
  }
  // The one string Claude gets on claude.ai: the shared instructions (site/ai-prompt.js) around the numbers.
  function buildAiInput(P) { return window.WW_AI.text(aiNumbers(P)); }

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
  const chartNote = (P, counts, line) => '<p class="cap">One bar a week, Monday to Sunday, this week on the right' + (counts && counts.some(c => c > 0 && c < RULES.smallCount) ? "; pale bars rest on fewer than " + RULES.smallCount + " answers" : "") + (line ? "; the dotted line is " + line : "") + ".</p>";
  const needs = (what, more) => '<p class="needs"><b>Will show</b> ' + what + (more ? ' <span class="muted">' + more + "</span>" : "") + "</p>";

  function progressCards(P) {
    const L = P.last, labels = P.weeks.map(wkLabel), R = RULES;
    const big = (v, sub) => '<p class="pv"><b>' + v + "</b> " + (sub ? '<span class="muted">' + sub + "</span>" : "") + "</p>";
    const card = (cls, title, eyebrow, body) => '<section class="box pg-card ' + cls + '"><div class="bh"><h2>' + title + '</h2><span class="eyebrow">' + eyebrow + "</span></div>" + body + "</section>";
    // memory
    const memAll = add(P.mem), mw = P.mem[L];
    const awayRows = AWAY.map((x, j) => { const c = P.away[L][j], c3 = add(P.win.map(i => P.away[i][j])); return "<tr><td>" + x.label + "</td><td>" + (c.n ? c.right + " of " + c.n : '<span class="muted">none</span>') + "</td><td>" + (c3.n ? c3.right + " of " + c3.n : '<span class="muted">none</span>') + "</td></tr>"; }).join("");
    const memBody = !memAll.n ? needs("the share of old words he spells right on the first try when they come back, week by week, and split by how long each word was away.", "Needs " + many(R.oldTriesNeeded, "old-word answer") + "; none yet.") :
      big(mw.n ? pct(shareOf(mw)) + "%" : "none yet", mw.n ? "right first try this week, " + mw.right + " of " + mw.n + (mw.n < R.smallCount ? " (too few to trust)" : "") : "no old words came back this week") +
      bars(P.mem.map(c => c.n ? pct(shareOf(c)) : null), { max: 100, fmt: v => v + "%", labels, counts: P.mem.map(c => c.n), what: "Old words right on the first try, each week" }) + chartNote(P, P.mem.map(c => c.n)) +
      '<p class="one">' + (mw.n ? "This week he spelled " + mw.right + " of " + many(mw.n, "old word") + " right on the first try." : "No old word came back this week yet.") + " In all " + many(memAll.n, "answer") + " in " + R.weeksShown + " weeks.</p>" +
      '<table class="away"><tr><th>Back</th><th>This week</th><th>Last 3 weeks</th></tr>' + awayRows + "</table>";
    // new-rule words
    const prAll = add(P.probe), pw = P.probe[L], isl = Object.keys(P.islands).sort();
    const prBody = '<p class="one">Words he was never taught that follow the island\'s rule, one try each. This is the number that says whether the method works.</p>' +
      (!prAll.n ? needs("the share of these words right, week by week.", "Needs " + many(R.probesNeeded, "new-rule word") + "; none yet (one comes at the end of each level).") :
        big(pw.n ? pct(shareOf(pw)) + "%" : "none yet", pw.n ? "right this week, " + pw.right + " of " + pw.n + (pw.n < R.smallCount ? " (too few to trust)" : "") : "no new-rule word this week") +
        bars(P.probe.map(c => c.n ? pct(shareOf(c)) : null), { max: 100, fmt: v => v + "%", labels, counts: P.probe.map(c => c.n), line: R.newRule * 100, what: "New-rule words right, each week" }) + chartNote(P, P.probe.map(c => c.n), pct(R.newRule) + "%") +
        '<p class="one">' + many(prAll.n, "new-rule word") + " in " + R.weeksShown + " weeks" + (prAll.n < R.probesNeeded ? ", " + (R.probesNeeded - prAll.n) + " more needed before the verdict" : "") + "." +
        (isl.length ? " By island: " + isl.map(k => "island " + esc(k) + " " + P.islands[k].right + " of " + P.islands[k].n).join(", ") + "." : "") + "</p>");
    // words he can spell now
    const ch = P.spell[L] - P.spell[L - 1];
    const spBody = !P.anyLevel ? needs("how many words he can spell now (memory level 2 or more) at the end of each week, and the change from the week before.", "Needs one finished level; a word reaches level 2 when it comes back right.") :
      big(P.spell[L], "words at level 2 or more, " + (ch > 0 ? ch + " more than" : ch < 0 ? -ch + " fewer than" : "the same as") + " last week") +
      bars(P.spell, { labels, what: "Words at level 2 or more at the end of each week" }) + chartNote(P) +
      '<p class="one">' + (P.slippedWords.length ? many(P.slippedWords.length, "word") + " slipped back down a step this week: " + P.slippedWords.slice(0, 6).map(w => "<b>" + esc(w) + "</b>").join(", ") + "." : "No word slipped back down a step this week.") + "</p>";
    // help
    const hw = P.help[L];
    const patRows = P.patterns && P.patterns.length ? '<table class="away"><tr><th>Slips by pattern</th><th>This week</th><th>4 weeks before</th></tr>' + P.patterns.slice(0, 5).map(p => "<tr><td>" + esc(p.name) + (p.examples[0] ? ' <span class="muted"><i>' + esc(p.examples[0].typed) + "</i> for " + esc(p.examples[0].word) + "</span>" : "") + "</td><td>" + p.now + "</td><td>" + p.before + "</td></tr>").join("") + "</table>" :
      '<p class="muted">' + (P.patterns ? "No pattern in the slips of the last 5 weeks." : "The pattern finder is not installed yet.") + "</p>";
    const hBody = !P.totals.firstTries ? needs("hints per first try, week by week, the three words with the most hints, and the slips by pattern.", "Needs first tries from a level; none yet.") :
      big(hw.n ? round1(P.hintsPer[L]) : "none yet", hw.n ? "hints per first try this week, " + hw.hints + " on " + hw.n : "no first tries this week") +
      bars(P.hintsPer.map(x => x == null ? null : round1(x)), { labels, counts: P.help.map(h => h.n), line: R.hintsHigh, max: Math.max(1, ...P.hintsPer.filter(x => x != null)), what: "Hints per first try, each week" }) + chartNote(P, P.help.map(h => h.n), R.hintsHigh + " hints per first try") +
      '<p class="one">' + (P.hintWords.length ? "Most hints this week: " + P.hintWords.slice(0, 3).map(h => "<b>" + esc(h.word) + "</b> (" + h.hints + ")").join(", ") + "." : "No hints used this week.") + "</p>" + patRows;
    return '<div class="pg-cards">' + card("pg-mem", "Memory", "old words back", memBody) + card("pg-rule", "New-rule words", "the method", prBody) +
      card("pg-spell", "Words he can spell now", "end of each week", spBody) + card("pg-help", "Help he needed", "hints and slips", hBody) + "</div>";
  }

  function verdictHtml(P) {
    const v = P.verdict;
    const smalls = [["Days played this week", P.days[P.last] + " of 7"],
      ["Minutes per level", P.perLevel.length ? round1(median(P.perLevel)) + " (median of " + P.perLevel.length + ")" : '<span class="muted">no level finished this week</span>'],
      ["Words typed a minute", P.weekMins > 0 ? round1(P.typed / P.weekMins) + ' <span class="muted">(' + P.typed + " in " + Math.round(P.weekMins) + " min of levels)</span>" : '<span class="muted">no level time this week</span>']];
    return '<section class="box pg-verdict v-' + v.kind + '"><div class="bh"><h2>' + esc(v.title) + '</h2><span class="eyebrow">by fixed rules · week of ' + wkLabel(P.weeks[P.last]) + "</span></div>" +
      '<p class="why">' + esc(v.reason) + '</p><p class="try"><b>What to try:</b> ' + esc(v.next) + "</p>" +
      '<dl class="kv pg-small">' + smalls.map(r => "<dt>" + r[0] + "</dt><dd>" + r[1] + "</dd>").join("") + "</dl></section>";
  }

  function howHtml(P) {
    const R = RULES, p = x => Math.round(x * 100) + "%";
    return '<section class="box pg-how"><div class="bh"><h2>How this is worked out</h2><span class="eyebrow">the rule, in full</span></div>' +
      '<p class="muted">Everything on this tab is counted from the game\'s answers by fixed rules. These lines are a first guess, not research findings; they can be changed.</p><ul class="plain">' +
      "<li><b>Weeks</b> run Monday to Sunday on this device's clock. <b>The last 3 weeks</b> are this week and the two before it once this week has " + R.daysPerWeek + " days played; until then, the three weeks before this one" + (P.thisCounts ? " (now: including this week)" : " (now: the three weeks before this one)") + ".</li>" +
      "<li><b>Memory:</b> old words that came back (review and island test), the first try of each word on a day. Back after 1, 4 or 14 days is the memory step the word was on (answers saved on the old ladder's 14- and 30-day steps count as 14 days or more).</li>" +
      "<li><b>New-rule words:</b> words never taught that follow the island's rule, one try each.</li>" +
      "<li><b>Words he can spell now:</b> words at memory level 2 or more at the end of each week, rebuilt from the level after each answer.</li>" +
      "<li><b>Help:</b> hint presses before each first try, divided by the number of first tries.</li>" +
      "<li><b>Too early to say</b> while any of these is missing: " + R.weeksNeeded + " weeks with " + R.daysPerWeek + " days played or more; " + R.oldTriesNeeded + " old-word answers and " + R.probesNeeded + " new-rule words in the " + R.weeksShown + " weeks shown; " + R.longAwayNeeded + " answers on words back after 14 days or more in the last 3 weeks.</li>" +
      "<li><b>It is working</b> when, over the last 3 weeks, words back after 14 days or more are " + p(R.memoryLong) + " right or more, AND new-rule words are " + p(R.newRule) + " or more (or rose 3 weeks running), AND words he can spell now grew in at least " + R.growWeeks + " of the 3 weeks.</li>" +
      "<li><b>It is not working yet</b> otherwise. The suggestion follows the first of: fewer than " + R.daysPerWeek * R.windowWeeks + " days played in the 3 weeks; memory under " + p(R.memoryLong) + "; new-rule words under " + p(R.newRule) + " and not rising; " + R.hintsHigh + " hints per first try or more and rising; otherwise the growth of words he can spell now.</li>" +
      "<li>A count under " + R.smallCount + " is marked too few to trust.</li></ul></section>";
  }

  // The school's own dictation mark: typed by the tutor.
  function schoolHtml(P) {
    const rs = P.results.slice(-8);
    return '<section class="box pg-school"><div class="bh"><h2>School dictation</h2><span class="eyebrow">your input: the school\'s mark</span></div>' +
      '<form id="srf" class="row srf" autocomplete="off"><label class="inl">Date <input type="date" id="sr_date" value="' + W.today() + '"></label>' +
      '<label class="inl">Right <input type="number" id="sr_right" min="0" max="200"></label><label class="inl">out of <input type="number" id="sr_total" min="1" max="200"></label>' +
      '<label class="inl grow">Note <input type="text" id="sr_note" maxlength="120" placeholder="optional, for you"></label><button type="submit">Save</button><span class="err" id="srErr"></span></form>' +
      (rs.length ? bars(rs.map(r => Math.round(100 * +r.right / +r.total)), { max: 100, fmt: v => v + "%", labels: rs.map(r => wkLabel(r.date)), noNow: true, what: "School dictation, share right" }) +
        '<p class="cap">One bar a dictation, newest on the right.</p><ul class="plain srl">' + rs.slice().reverse().map(r => "<li>" + day3(r.date) + ": <b>" + (+r.right) + " of " + (+r.total) + "</b>" + (r.note ? ' <span class="muted">' + esc(r.note) + "</span>" : "") + ' <button type="button" class="mini ghost" data-srdel="' + esc(r.id) + '" aria-label="Delete">' + ICON("x") + "</button></li>").join("") + "</ul>"
        : needs("the school's dictation mark each week as a small chart, next to the game's numbers.", "Type the first one above.")) + "</section>";
  }

  // ---- Claude's notes ----
  // claude.use("sample") only hands over the capability; no model is called until the tutor presses the button.
  let sampleFor = null, samplePromise = null;
  const getSample = () => {
    if (sampleFor !== window.claude || !samplePromise) { sampleFor = window.claude; samplePromise = (async () => { try { return window.claude && typeof window.claude.use === "function" ? (await window.claude.use("sample")) || null : null; } catch (e) { return null; } })(); }
    return samplePromise;
  };
  const OFF_SITE = "The analysis cannot be written from this copy of the page. It works on claude.ai and on your own website.";
  // ---- the real website: no page ability there, so the button asks the Edge Function (deploy/functions/weekly-analysis) ----
  const AI_FUNCTION = "weekly-analysis";
  // Claude Opus 5.5 list prices, US dollars per million tokens, from the claude-api skill's model table (cached 2026-11-03),
  // copied on 2026-11-21. Only for the rough cost line under a run; check the price page before quoting it.
  const AI_PRICE = { input: 4, output: 20 };
  const AI_SORRY = "The analysis could not be written. Try again in a minute.";
  const onSite = () => !DEMO && !!(sb && sb.functions && typeof sb.functions.invoke === "function") && !!window.WW_AI;
  function costLine(u) {
    const i = Math.max(0, Math.round(+(u && u.input_tokens) || 0)), o = Math.max(0, Math.round(+(u && u.output_tokens) || 0));
    if (!i && !o) return "";
    const c = (i * AI_PRICE.input + o * AI_PRICE.output) / 1e4, f = n => n.toLocaleString("en-US");   // US cents
    return "This run: " + f(i) + " tokens in, " + f(o) + " out, about " + (c < 1 ? "1 US cent or less" : Math.round(c) + " US cents") + ".";
  }
  // The function's own short message when it sent one (401, 403, 413, 429, 500, 502), else the general one.
  async function fnMessage(err) {
    try { const r = err && err.context; if (r && typeof r.json === "function") { const j = await r.json(); if (j && typeof j.message === "string" && j.message.length < 200) return j.message; } } catch (e) { }
    return AI_SORRY;
  }
  function wireSite(P) {
    const ctl = $("aiCtl");
    ctl.innerHTML = '<div class="row"><button type="button" id="aiGo">Write this week\'s analysis</button><span class="muted" id="aiMsg">Sends the numbers on this page to Claude, without his name. Only when you press.</span></div><p class="muted ai-cost" id="aiCost" hidden></p>';
    $("aiGo").onclick = async () => {
      const b = $("aiGo"), msg = $("aiMsg"), cost = $("aiCost"); b.disabled = true; cost.hidden = true; msg.textContent = "Writing… this takes about a minute";
      let res;
      try { res = await sb.functions.invoke(AI_FUNCTION, { body: { numbers: aiNumbers(P) } }); } catch (e) { res = { data: null, error: e }; }
      if (tab !== "progress" || $("aiGo") !== b) return;   // she left the tab; a kept result shows on her next visit
      const data = res && !res.error ? res.data : null;
      if (!data || !data.record || typeof data.record.json !== "string") { msg.textContent = res && res.error ? await fnMessage(res.error) : AI_SORRY; b.disabled = false; return; }
      $("aiOut").innerHTML = analysisHtml(data.record, P);
      msg.textContent = data.saved ? "Kept on this page for next time." : "Shown, but it could not be kept for next time.";
      const line = costLine(data.usage); cost.textContent = line; cost.hidden = !line;
      b.disabled = false;
    };
  }
  function analysisHtml(rec, P) {
    let o = null; try { o = typeof rec.json === "string" ? JSON.parse(rec.json) : rec.json; } catch (e) { o = null; }
    if (!o || typeof o.headline !== "string") return '<p class="muted">The last analysis could not be read.</p>';
    const items = x => (Array.isArray(x) ? x : []).slice(0, 3).map(s => typeof s === "string" ? s : s && (s.text || s.item) ? String(s.text || s.item) : "").filter(Boolean);
    const list = (h, x) => items(x).length ? "<h3>" + h + "</h3><ul>" + items(x).map(s => "<li>" + esc(s) + "</li>").join("") + "</ul>" : "";
    const c = o.confidence, level = typeof c === "string" ? c : c && c.level, why = o.confidence_reason || (c && c.reason) || "";
    const at = rec.at ? day3(ld(rec.at)) + " " + W.fmtTime(rec.at) : "";
    return '<div class="ai-note"><p class="ai-head">' + esc(o.headline) + "</p>" + list("What changed", o.changed) + list("In the slips", o.patterns) + list("For the next lesson", o.next_lesson) +
      (level ? '<p class="ai-conf"><b>Confidence: ' + esc(String(level)) + "</b>" + (why ? " · " + esc(String(why)) : "") + "</p>" : "") +
      '<p class="ai-by">Written by Claude from the numbers on this page. Check it against them. · ' + esc(at) + (rec.week && P && rec.week !== P.weeks[P.last] ? " · about the week of " + wkLabel(rec.week) : "") + "</p></div>";
  }
  async function wireAi(P, saved) {
    const box = $("aiBox"); if (!box) return;
    const sample = await getSample();
    if (tab !== "progress" || !$("aiBox")) return;
    const ctl = $("aiCtl");
    if (!sample) { if (onSite()) return wireSite(P); ctl.innerHTML = '<p class="muted">' + OFF_SITE + "</p>"; return; }
    ctl.innerHTML = '<div class="row"><button type="button" id="aiGo">Analyse this week</button><span class="muted" id="aiMsg">Sends the numbers on this page to Claude, without his name. Only when you press.</span></div>';
    $("aiGo").onclick = async () => {
      const b = $("aiGo"), msg = $("aiMsg"); b.disabled = true; msg.textContent = "Claude is reading the numbers…";
      try {
        const out = await sample.json(buildAiInput(P), { modelTier: "default" });
        if (!out || typeof out !== "object" || typeof out.headline !== "string") throw { code: "shape" };
        const rec = { student_id: student.id, week: P.weeks[P.last], at: new Date().toISOString(), json: JSON.stringify(out) };
        const r = await safe(sb.from("analyses").insert(rec));
        $("aiOut").innerHTML = analysisHtml(rec, P);
        msg.textContent = r && r.error ? "Shown, but it could not be kept for next time." : "Kept on this page for next time.";
      } catch (e) {
        const code = e && e.code;
        msg.textContent = code === "rate_limited" ? "Claude has had many questions just now. Try again later; the numbers above are complete without it." :
          code === "not_granted" ? "The analysis is switched off for this page." :
          "The analysis could not be written this time. The numbers above are complete without it.";
        if (code === "not_granted") { b.hidden = true; return; }
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
  async function renderProgress() {
    view.innerHTML = '<section class="box"><p class="hint">Counting…</p></section>';
    await loadAll();
    const t = W.today(), from = new Date(W.addDays(W.weekStart(t), -7 * (RULES.weeksShown - 1)) + "T00:00:00").toISOString();
    const [a, e, sr, an] = await Promise.all([fetchSince("attempts", from), fetchSince("events", from),
      safe(sb.from("school_results").select("*").eq("student_id", student.id).order("date")),
      safe(sb.from("analyses").select("*").eq("student_id", student.id).order("at"))]);
    if (tab !== "progress") return;
    if (a.error) banner(a.error.message);
    const P = computeProgress({ attempts: a.data, events: e.data, words, sessions, results: (sr && !sr.error && sr.data) || [], today: t });
    const saved = ((an && !an.error && an.data) || []).slice(-1)[0] || null;
    view.innerHTML = '<div class="pg">' + verdictHtml(P) +
      '<section class="box pg-ai" id="aiBox"><div class="bh"><h2>Claude\'s notes on this week</h2><span class="eyebrow">a further look at the same numbers</span></div>' +
      '<div id="aiOut">' + (saved ? analysisHtml(saved, P) : '<p class="muted">No analysis yet. It is written only when you press the button.</p>') + "</div>" +
      '<div id="aiCtl"><p class="muted">Checking whether Claude can be asked from here…</p></div></section>' +
      progressCards(P) + '<div class="pg-two">' + schoolHtml(P) + howHtml(P) + "</div></div>";
    $("srf").onsubmit = async ev => {
      ev.preventDefault();
      const date = $("sr_date").value, right = Math.round(+$("sr_right").value), total = Math.round(+$("sr_total").value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { $("srErr").textContent = "Set the date."; return; }
      if (!($("sr_total").value && total >= 1) || $("sr_right").value === "" || !(right >= 0) || right > total) { $("srErr").textContent = "Type how many were right and out of how many."; return; }
      const { error } = await safe(sb.from("school_results").insert({ student_id: student.id, date, right, total, note: $("sr_note").value.trim() }));
      if (error) { $("srErr").textContent = error.message || "Could not be saved."; return; }
      renderProgress();
    };
    view.querySelectorAll("[data-srdel]").forEach(b => b.onclick = async () => { const { error } = await safe(sb.from("school_results").delete().eq("id", b.dataset.srdel)); if (error) banner(error.message); renderProgress(); });
    wireAi(P, saved);
  }

  // For checks: the Chinese summary of the data as it is now.
  window.WT_TEACHER = { motherText: async () => motherText(await motherFacts()), progress: computeProgress, aiInput: buildAiInput, RULES };
  boot();
})();
