/* Word World, the tutor's page: THE "STORIES" TAB. Owner: the story builder.
   window.WW_TEACHER_STORY = { render(container, ctx) }; ctx = { sb, student, W: window.WT }.
   After each level he reads that level's story page and answers one question (the game's pages: site/story.js). Here the
   tutor sees the page of every level, writes her own page for a level (it REPLACES the game's page for that level; the other
   levels keep the game's), changes or removes it (the game's page comes back), and sees "His reading answers": every page he
   read, newest first, from the story events the game saves (story_opened, story_heard, story_zh, story_choice: the answer he
   tapped and the question, story_answer, story_done).
   Her pages live in the table stories (deploy/stories.sql): one per student and level; title, sentences [{ en, zh }],
   question, question_zh, answers [{ en, zh }] x 3, right (0, 1 or 2). Her texts have no recording: his laptop reads them
   with its own voice. Plain words for a tutor who is not technical; never a word that labels the child. */
(function () {
  const MAX_SENTS = 8, MAX_WORDS = 7;
  const STORY_EVENTS = ["story_opened", "story_heard", "story_zh", "story_choice", "story_answer", "story_done"];
  let st = null;   // { container, ctx, W, rows, events, open: { read, ask }, ed, msg, storyAsked }

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const wordsIn = s => (String(s || "").match(/[A-Za-z0-9À-ɏ]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
  const $ = id => st && st.container.querySelector("#" + id);

  // ---------- the pages: the game's (site/story.js) and hers, in one shape ----------
  // { level, own, id, title, titleZh, sents: [{ en, zh }], q, qzh, answers: [{ en, zh }] x 3, right }
  function splitGame(en) {   // the game's text into sentences (a sentence ends at . ! ? followed by a space and a capital or a quote)
    return String(en || "").split(/(?<=[.!?]["”]?)\s+(?=["“]?[A-Z])/).map(s => s.trim()).filter(Boolean);
  }
  function gamePage(level) {
    const p = (window.WW_STORY || {})[level]; if (!p) return null;
    const en = splitGame(p.en), zhs = Array.isArray(p.zhs) && p.zhs.length === en.length ? p.zhs : [];
    // the answers in the order he sees them (src/js/55-story.js: the right one first, then turned by the level)
    let opts = p.q && p.a && Array.isArray(p.o) ? [{ en: p.a, zh: p.azh || "", ok: true }].concat(p.o.map((t, i) => ({ en: t, zh: (p.ozh || [])[i] || "", ok: false }))) : [];
    for (let r = opts.length ? level % opts.length : 0; r > 0; r--) opts.push(opts.shift());
    return { level, own: false, title: p.title || "Page " + level, titleZh: "", sents: en.map((s, i) => ({ en: s, zh: zhs[i] || "" })),
      q: p.q || "", qzh: p.qzh || "", answers: opts.map(o => ({ en: o.en, zh: o.zh })), right: opts.findIndex(o => o.ok) };
  }
  function ownPage(r) {
    const arr = x => Array.isArray(x) ? x : [];
    return { level: +r.level, own: true, id: r.id, title: r.title || "", titleZh: r.title_zh || "",
      sents: arr(r.sentences).map(x => ({ en: (x && x.en) || "", zh: (x && x.zh) || "" })), q: r.question || "", qzh: r.question_zh || "",
      answers: arr(r.answers).map(x => typeof x === "string" ? { en: x, zh: "" } : { en: (x && x.en) || "", zh: (x && x.zh) || "" }), right: +r.right };
  }
  const mine = level => st.rows.find(r => +r.level === +level) || null;
  const pageOf = level => { const r = mine(level); return r ? ownPage(r) : gamePage(level); };
  function levels() {
    const ls = Object.keys(window.WW_STORY || {}).map(Number).concat(st.rows.map(r => +r.level)).filter(n => n > 0);
    return [...new Set(ls)].sort((a, b) => a - b);
  }

  // ---------- data ----------
  async function load() {
    const { sb, student } = st.ctx;
    const safe = q => Promise.resolve(q).catch(e => ({ data: null, error: e }));
    const [r, e] = await Promise.all([
      safe(sb.from("stories").select("*").eq("student_id", student.id).order("level")),
      safe(sb.from("events").select("*").eq("student_id", student.id).in("type", STORY_EVENTS).order("created_at", { ascending: false }).limit(3000))
    ]);
    st.noTable = !!(r && r.error);
    st.rows = (r && !r.error && r.data) || [];
    st.events = (e && !e.error && e.data) || [];
  }
  function askStory() {   // the game's pages, as the Today tab loads them (site/teacher-day.js)
    if (st.storyAsked || window.WW_STORY || typeof document === "undefined") return;
    st.storyAsked = true;
    try { const s = document.createElement("script"); s.src = "story.js"; s.onload = () => { if (st && st.container.isConnected) draw(); }; document.head.appendChild(s); } catch (e) {}
  }

  // ---------- his page, as he sees it (the preview and "Read") ----------
  // The same parts as src/js/55-story.js: the title, "Hear it" and 中文, one sentence a line, "A question", three answers.
  // The answers can be tried here: "Yes! You found it." or "Not yet. Look again.", as on his page.
  function pageHtml(p, key) {
    const hasZh = !!(p.titleZh || p.qzh || p.sents.some(s => s.zh) || p.answers.some(a => a.zh));
    const zl = t => t ? '<span class="tsp-zl" lang="zh">' + esc(t) + "</span>" : "";
    const sents = p.sents.filter(s => String(s.en).trim());
    return '<div class="tsp-page" data-key="' + esc(key) + '">' +
      '<p class="tsp-eye">Level ' + esc(p.level || "?") + (p.own ? " · your story" : " · the game's story") + "</p>" +
      '<h3 class="tsp-title">' + (esc(p.title) || '<span class="tsp-empty">The title</span>') + zl(p.titleZh) + "</h3>" +
      '<div class="tsp-tools"><span class="tsp-btn tsp-fake">Hear it</span>' + (hasZh ? '<button type="button" class="tsp-chip" data-zh aria-pressed="false">中文</button>' : "") + "</div>" +
      '<div class="tsp-text" lang="en">' + (sents.length ? sents.map(s => '<p class="tsp-s">' + esc(s.en) + zl(s.zh) + "</p>").join("") : '<p class="tsp-s tsp-empty">Your sentences come here.</p>') + "</div>" +
      '<div class="tsp-q"><p class="tsp-kind">A question</p><p class="tsp-qtext">' + (esc(p.q) || '<span class="tsp-empty">Your question</span>') + zl(p.qzh) + "</p>" +
      '<div class="tsp-opts">' + p.answers.map((a, i) => '<button type="button" class="tsp-opt" data-k="' + i + '"' + (String(a.en).trim() ? "" : " disabled") + "><span>" + (esc(a.en) || "Answer " + (i + 1)) + "</span>" + zl(a.zh) + "</button>").join("") +
      '</div><p class="tsp-fb" aria-live="polite"></p></div></div>';
  }
  function wirePage(el, p) {
    if (!el) return;
    const z = el.querySelector("[data-zh]");
    if (z) z.onclick = () => { const on = !el.classList.contains("tsp-zhon"); el.classList.toggle("tsp-zhon", on); z.setAttribute("aria-pressed", String(on)); };
    el.querySelectorAll(".tsp-opt").forEach(b => b.onclick = () => {
      const ok = +b.dataset.k === p.right, fb = el.querySelector(".tsp-fb");
      if (ok) { b.classList.add("tsp-right"); el.querySelectorAll(".tsp-opt").forEach(x => { x.disabled = true; }); fb.textContent = "Yes! You found it."; }
      else { b.classList.add("tsp-miss"); b.disabled = true; fb.textContent = "Not yet. Look again."; }
    });
  }

  // ---------- (a) the list of levels ----------
  function listHtml() {
    const ls = levels();
    if (!ls.length) return '<p class="muted">The game\'s stories are loading…</p>';
    return '<ol class="ts-list">' + ls.map(n => {
      const r = mine(n), g = gamePage(n), p = r ? ownPage(r) : g, read = st.open.read === n, ask = st.open.ask === n;
      return '<li class="ts-item' + (r ? " ts-mine" : "") + '" data-level="' + n + '">' +
        '<div class="ts-row"><span class="ts-lv">Level ' + n + "</span>" +
        '<span class="ts-what">' + (r ? '<b class="ts-tag">Your story:</b> ' : '<span class="ts-tag ts-game">The game\'s story:</span> ') + "<b>" + esc(p.title) + "</b></span>" +
        '<span class="ts-acts"><button type="button" class="ghost mini" data-act="read" aria-expanded="' + read + '">' + (read ? "Close" : "Read") + "</button>" +
        (r ? '<button type="button" class="ghost mini" data-act="change">Change</button><button type="button" class="red mini" data-act="remove">Remove</button>'
           : '<button type="button" class="ghost mini" data-act="write">Write your own</button>') + "</span></div>" +
        (ask ? '<div class="ts-ask" role="group" aria-label="Remove your story"><p>Remove your story for level ' + n + "? " +
          (g ? "The game's story “" + esc(g.title) + "” comes back." : "This level then has no story page.") + "</p>" +
          '<button type="button" class="red mini" data-act="yes">Yes, remove it</button><button type="button" class="ghost mini" data-act="no">Keep it</button></div>' : "") +
        (read ? '<div class="ts-read">' + pageHtml(p, "read" + n) + "</div>" : "") + "</li>";
    }).join("") + "</ol>";
  }

  // ---------- (b) the editor ----------
  function blankEd(level) {
    return { id: null, level: level || "", title: "", titleZh: "", sents: [{ en: "", zh: "" }, { en: "", zh: "" }, { en: "", zh: "" }], q: "", qzh: "", answers: [0, 1, 2].map(() => ({ en: "", zh: "" })), right: null, errs: [] };
  }
  function edFrom(r) {
    const p = ownPage(r);
    return { id: r.id, level: p.level, title: p.title, titleZh: p.titleZh, sents: p.sents.length ? p.sents : [{ en: "", zh: "" }], q: p.q, qzh: p.qzh,
      answers: [0, 1, 2].map(i => p.answers[i] || { en: "", zh: "" }), right: [0, 1, 2].indexOf(p.right) >= 0 ? p.right : null, errs: [] };
  }
  function countLine(i) {
    const n = wordsIn(st.ed.sents[i].en);
    return '<span class="ts-count">' + (n ? n + (n === 1 ? " word" : " words") : "") + "</span>" + (n > MAX_WORDS ? '<span class="ts-long">He reads best in lines of 7 words or fewer.</span>' : "");
  }
  function editorHtml() {
    const e = st.ed, g = e.level ? gamePage(+e.level) : null;
    const zhOpen = !!(e.titleZh || e.qzh || e.sents.some(s => s.zh) || e.answers.some(a => a.zh) || st.zhOpen);
    return '<section class="box ts-editor" id="tsEditor" aria-label="Your story">' +
      '<h2>' + (e.id ? "Change your story" : "Write your own story") + "</h2>" +
      '<p class="lead">Your story replaces the game\'s story for this level. He reads it after the level and answers your question.</p>' +
      '<p class="ts-voice">His laptop reads your story aloud with its own voice. There is no recording of your words.</p>' +
      '<div class="ts-grid"><div class="ts-form">' +
      '<label class="f ts-level">Level<input type="number" id="tsLevel" min="1" step="1" inputmode="numeric" value="' + esc(e.level) + '"></label>' +
      '<p class="ts-lvnote" id="tsLvNote">' + lvNoteText() + "</p>" +
      '<label class="f">Title<input type="text" id="tsTitle" maxlength="80" value="' + esc(e.title) + '" placeholder="A title of a few words"></label>' +
      '<fieldset class="ts-sents"><legend>The story <span class="fh">one sentence on each line, up to ' + MAX_SENTS + "</span></legend>" +
      e.sents.map((s, i) => '<div class="ts-sent"><label class="ts-sl" for="tsS' + i + '">' + (i + 1) + '</label><input type="text" id="tsS' + i + '" data-s="' + i + '" maxlength="160" value="' + esc(s.en) + '">' +
        (e.sents.length > 1 ? '<button type="button" class="ghost mini ts-x" data-del="' + i + '" aria-label="Take out sentence ' + (i + 1) + '">Take out</button>' : "") +
        '<p class="ts-c" id="tsC' + i + '">' + countLine(i) + "</p></div>").join("") +
      (e.sents.length < MAX_SENTS ? '<button type="button" class="ghost mini" id="tsAdd">Add a sentence</button>' : '<p class="muted ts-max">That is the most: ' + MAX_SENTS + " sentences.</p>") + "</fieldset>" +
      '<label class="f">The question<input type="text" id="tsQ" maxlength="120" value="' + esc(e.q) + '" placeholder="One short question about the story"></label>' +
      '<fieldset class="ts-ans"><legend>Three answers <span class="fh">mark the right one</span></legend>' +
      e.answers.map((a, i) => '<div class="ts-a"><label class="ts-right"><input type="radio" name="tsRight" value="' + i + '"' + (e.right === i ? " checked" : "") + '> Right</label>' +
        '<input type="text" id="tsA' + i + '" data-a="' + i + '" maxlength="60" value="' + esc(a.en) + '" placeholder="Answer ' + (i + 1) + '" aria-label="Answer ' + (i + 1) + '"></div>').join("") + "</fieldset>" +
      '<details class="ts-zh" id="tsZh"' + (zhOpen ? " open" : "") + '><summary>Chinese (optional)</summary><p class="fh">He sees a Chinese line under each English line when his 中文 switch is on.</p>' +
      '<label class="f">Title<input type="text" id="tsTitleZh" lang="zh" value="' + esc(e.titleZh) + '"></label>' +
      e.sents.map((s, i) => '<label class="f">Sentence ' + (i + 1) + (s.en ? ' <span class="fh">' + esc(s.en) + "</span>" : "") + '<input type="text" lang="zh" data-sz="' + i + '" value="' + esc(s.zh) + '"></label>').join("") +
      '<label class="f">The question<input type="text" id="tsQZh" lang="zh" value="' + esc(e.qzh) + '"></label>' +
      e.answers.map((a, i) => '<label class="f">Answer ' + (i + 1) + (a.en ? ' <span class="fh">' + esc(a.en) + "</span>" : "") + '<input type="text" lang="zh" data-az="' + i + '" value="' + esc(a.zh) + '"></label>').join("") + "</details>" +
      '<div class="ts-errs" id="tsErrs" role="alert">' + (e.errs.length ? "<p>Not saved yet:</p><ul>" + e.errs.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>" : "") + "</div>" +
      '<div class="row"><button type="button" class="ts-save" id="tsSave">Save your story</button><button type="button" class="ghost" id="tsCancel">Cancel</button></div>' +
      "</div>" +
      '<div class="ts-prev"><p class="eyebrow">What he sees</p><div id="tsPrev">' + pageHtml(edPage(), "prev") + "</div></div></div></section>";
  }
  function lvNoteText() {
    const e = st.ed, n = +e.level;
    if (!(n >= 1) || Math.floor(n) !== n) return "A level is a whole number: 1, 2, 3…";
    const other = mine(n);
    if (other && other.id !== e.id) return "You already have a story for level " + n + ". Change that one, or choose another level.";
    const g = gamePage(n);
    return g ? "It replaces the game's story “" + esc(g.title) + "”." : "The game has no story for level " + n + ". Yours will be its story.";
  }
  const edPage = () => { const e = st.ed; return { level: e.level, own: true, title: e.title, titleZh: e.titleZh, sents: e.sents, q: e.q, qzh: e.qzh, answers: e.answers, right: e.right == null ? -1 : e.right }; };
  function refreshPreview() {
    const box = $("tsPrev"); if (!box) return;
    const on = !!box.querySelector(".tsp-zhon");
    box.innerHTML = pageHtml(edPage(), "prev"); const el = box.firstChild;
    if (on && el.querySelector("[data-zh]")) { el.classList.add("tsp-zhon"); el.querySelector("[data-zh]").setAttribute("aria-pressed", "true"); }
    wirePage(el, edPage());
  }
  function wireEditor() {
    const e = st.ed, c = st.container;
    const live = () => { refreshPreview(); };
    $("tsLevel").oninput = () => { e.level = $("tsLevel").value.trim(); $("tsLvNote").innerHTML = lvNoteText(); live(); };
    $("tsTitle").oninput = () => { e.title = $("tsTitle").value; live(); };
    $("tsTitleZh").oninput = () => { e.titleZh = $("tsTitleZh").value; live(); };
    $("tsQ").oninput = () => { e.q = $("tsQ").value; live(); };
    $("tsQZh").oninput = () => { e.qzh = $("tsQZh").value; live(); };
    c.querySelectorAll("[data-s]").forEach(inp => inp.oninput = () => { const i = +inp.dataset.s; e.sents[i].en = inp.value; $("tsC" + i).innerHTML = countLine(i); live(); });
    c.querySelectorAll("[data-sz]").forEach(inp => inp.oninput = () => { e.sents[+inp.dataset.sz].zh = inp.value; live(); });
    c.querySelectorAll("[data-a]").forEach(inp => inp.oninput = () => { e.answers[+inp.dataset.a].en = inp.value; live(); });
    c.querySelectorAll("[data-az]").forEach(inp => inp.oninput = () => { e.answers[+inp.dataset.az].zh = inp.value; live(); });
    c.querySelectorAll('input[name="tsRight"]').forEach(r => r.onchange = () => { if (r.checked) { e.right = +r.value; live(); } });
    $("tsZh").ontoggle = () => { st.zhOpen = $("tsZh").open; };
    c.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { e.sents.splice(+b.dataset.del, 1); draw(); focusLater("tsS" + Math.max(0, +b.dataset.del - 1)); });
    if ($("tsAdd")) $("tsAdd").onclick = () => { if (e.sents.length < MAX_SENTS) e.sents.push({ en: "", zh: "" }); draw(); focusLater("tsS" + (e.sents.length - 1)); };
    $("tsSave").onclick = save;
    $("tsCancel").onclick = () => { st.ed = null; st.msg = ""; draw(); };
    wirePage($("tsPrev").firstChild, edPage());
  }
  const focusLater = id => setTimeout(() => { const el = $(id); if (el) el.focus(); }, 0);

  // Save refuses only what cannot work on his page.
  function problems() {
    const e = st.ed, out = [], n = +e.level;
    if (!(n >= 1) || Math.floor(n) !== n) out.push("Choose a level: a whole number from 1.");
    else { const other = mine(n); if (other && other.id !== e.id) out.push("You already have a story for level " + n + ". Change that one, or choose another level."); }
    if (!e.title.trim()) out.push("Give the story a title.");
    if (!e.sents.some(s => s.en.trim())) out.push("Write at least one sentence.");
    if (!e.q.trim()) out.push("Write the question.");
    if (e.answers.filter(a => a.en.trim()).length < 3) out.push("Write all three answers.");
    if (e.right == null || !(e.answers[e.right] && e.answers[e.right].en.trim())) out.push("Mark the right answer.");
    return out;
  }
  async function save() {
    const e = st.ed; e.errs = problems();
    if (e.errs.length) { draw(); const el = $("tsErrs"); if (el && el.scrollIntoView) el.scrollIntoView({ block: "center" }); return; }
    const { sb, student } = st.ctx, t = s => String(s || "").trim();
    const sents = e.sents.filter(s => t(s.en)).map(s => t(s.zh) ? { en: t(s.en), zh: t(s.zh) } : { en: t(s.en) });
    const row = { level: +e.level, title: t(e.title), title_zh: t(e.titleZh), sentences: sents, question: t(e.q), question_zh: t(e.qzh),
      answers: e.answers.map(a => t(a.zh) ? { en: t(a.en), zh: t(a.zh) } : { en: t(a.en) }), right: e.right };
    $("tsSave").disabled = true;
    let r;
    try { r = e.id ? await sb.from("stories").update(row).eq("id", e.id).select() : await sb.from("stories").insert(Object.assign({ student_id: student.id }, row)).select(); }
    catch (x) { r = { error: x }; }
    if (r && r.error) {
      e.errs = [/duplicate|unique/i.test(r.error.message || "") ? "You already have a story for level " + row.level + ". Change that one, or choose another level."
        : "It could not be saved. Check the internet and press Save again." + (st.noTable ? " (The stories table may not be set up yet: deploy/stories.sql.)" : "")];
      draw(); return;
    }
    st.ed = null; st.msg = "Saved. Level " + row.level + " now has your story “" + row.title + "”.";
    await load(); draw();
  }
  async function remove(level) {
    const r = mine(level); if (!r) return;
    const { error } = await st.ctx.sb.from("stories").delete().eq("id", r.id);
    st.open.ask = null;
    st.msg = error ? "It could not be removed. Check the internet and try again." : "Removed. Level " + level + (gamePage(level) ? " has the game's story again." : " has no story page now.");
    await load(); draw();
  }

  // ---------- (c) his reading answers ----------
  // One entry per page and day, newest first: the day, the level and title, the question, each answer he chose (Right or
  // Not yet), how many tries, and whether he pressed Hear it.
  function answersHtml() {
    const W = st.W, groups = new Map();
    // the events come newest first; walk them oldest first so the tries are in order
    st.events.slice().reverse().forEach(ev => {
      const d = ev.detail || {}, lv = +d.level; if (!(lv >= 1)) return;
      const day = W.dkey(new Date(ev.created_at)), k = day + "|" + lv;
      let g = groups.get(k);
      if (!g) { g = { day, lv, at: ev.created_at, own: false, title: "", q: "", tries: [], chose: {}, heard: false, zh: false, done: null }; groups.set(k, g); }
      g.at = ev.created_at > g.at ? ev.created_at : g.at;
      if (d.own) g.own = true;
      if (ev.type === "story_opened" && d.title) g.title = d.title;
      if (ev.type === "story_heard") g.heard = true;
      if (ev.type === "story_zh") g.zh = true;
      if (ev.type === "story_choice") { g.chose[+d.tries] = d.answer || ""; if (d.q) g.q = d.q; }
      if (ev.type === "story_answer") g.tries.push({ right: !!d.right, n: +d.tries, answer: d.answer || "" });
      if (ev.type === "story_done") g.done = d;
    });
    // the choice and its answer are saved in the same moment, in either order: join them by try once all are read
    groups.forEach(g => g.tries.forEach(t => { if (!t.answer) t.answer = g.chose[t.n] || ""; }));
    const list = [...groups.values()].sort((a, b) => a.at < b.at ? 1 : a.at > b.at ? -1 : 0);
    if (!list.length) return '<p class="muted">No story read yet. After his first level he reads its story here.</p>';
    return '<ul class="ts-his">' + list.map(g => {
      const now = pageOf(g.lv), right = g.tries.findIndex(t => t.right), n = right >= 0 ? right + 1 : g.tries.length;
      const title = g.title || (now ? now.title : "Page " + g.lv), q = g.q || (now ? now.q : "");
      const rightText = now && now.right >= 0 && now.answers[now.right] ? now.answers[now.right].en : "";
      const tries = g.tries.map((t, i) => '<li><span class="ts-try">Try ' + (i + 1) + '</span> <span class="ts-chose">' + (t.answer ? "“" + esc(t.answer) + "”" : t.right && rightText ? "“" + esc(rightText) + "”" : "(this answer was not saved)") + "</span> " +
        (t.right ? '<b class="ts-ok">Right</b>' : '<b class="ts-ny">Not yet</b>') + "</li>").join("");
      return '<li class="ts-h"><div class="ts-hh"><span class="ts-day">' + esc(W.niceDate(g.day)) + '</span><span class="ts-lv">Level ' + g.lv + "</span><b>" + esc(title) + "</b>" +
        '<span class="ts-src">' + (g.own ? "your story" : "the game's story") + "</span></div>" +
        (q ? '<p class="ts-hq">The question: <b>' + esc(q) + "</b></p>" : "") +
        (g.tries.length ? '<ol class="ts-tries">' + tries + "</ol>" : '<p class="muted">He opened the page. No answer yet.</p>') +
        '<p class="ts-facts">' + (g.tries.length ? (right >= 0 ? "Right on try " + n + "." : many(g.tries.length, "try", "tries") + ", not yet right.") + " " : "") +
        (g.heard ? "He pressed Hear it." : "He did not press Hear it.") + (g.zh ? " He looked at the Chinese." : "") + "</p></li>";
    }).join("") + "</ul>";
  }
  const many = (n, one, more) => n + " " + (n === 1 ? one : more);

  // ---------- the tab ----------
  function draw() {
    if (!st) return;
    if (!window.WW_STORY) askStory();
    const y = typeof window !== "undefined" ? window.scrollY : 0;
    st.container.innerHTML =
      (st.ed ? editorHtml() : "") +
      '<section class="box ts-box"><h2>Stories</h2>' +
      '<p class="lead">After each level he reads that level\'s story and answers one question. You can write your own story for a level: it replaces the game\'s story there. The other levels keep the game\'s story.</p>' +
      (st.noTable ? '<p class="err">Your own stories are not set up on the database yet. Run deploy/stories.sql once (Supabase, SQL Editor).</p>' : "") +
      (st.msg ? '<p class="ok ts-msg" role="status">' + esc(st.msg) + "</p>" : "") +
      (st.ed ? "" : '<div class="row"><button type="button" id="tsNew">Write a story for a level</button></div>') +
      listHtml() + "</section>" +
      '<section class="box ts-box"><h2>His reading answers</h2><p class="lead">Every story he has read, newest first, with each answer he chose.</p>' + answersHtml() + "</section>";
    if (st.ed) wireEditor();
    if ($("tsNew")) $("tsNew").onclick = () => { const used = new Set(st.rows.map(r => +r.level)); let n = 1; while (used.has(n)) n++; st.ed = blankEd(n); st.msg = ""; draw(); toEditor(); };
    st.container.querySelectorAll(".ts-item").forEach(li => {
      const n = +li.dataset.level;
      li.querySelectorAll("[data-act]").forEach(b => b.onclick = () => {
        const a = b.dataset.act; st.msg = "";
        if (a === "read") { st.open.read = st.open.read === n ? null : n; draw(); return; }
        if (a === "write") { st.ed = blankEd(n); draw(); toEditor(); return; }
        if (a === "change") { st.ed = edFrom(mine(n)); draw(); toEditor(); return; }
        if (a === "remove") { st.open.ask = n; draw(); return; }
        if (a === "no") { st.open.ask = null; draw(); return; }
        if (a === "yes") remove(n);
      });
      const rd = li.querySelector(".ts-read .tsp-page"); if (rd) wirePage(rd, pageOf(n));
    });
    if (typeof window !== "undefined" && window.scrollY !== y && !st.jump) window.scrollTo(0, y);
    st.jump = false;
  }
  function toEditor() { const el = $("tsEditor"); if (el && el.scrollIntoView) el.scrollIntoView({ block: "start" }); const t = $("tsTitle"); if (t) t.focus(); }

  async function render(container, ctx) {
    if (!container || !ctx || !ctx.student) return;
    st = { container, ctx, W: ctx.W || window.WT, rows: [], events: [], open: { read: null, ask: null }, ed: null, msg: "", storyAsked: false, zhOpen: false };
    container.innerHTML = '<section class="box"><p class="lead">Loading the stories…</p></section>';
    const mineSt = st;
    await load();
    if (st !== mineSt) return;
    draw();
  }
  window.WW_TEACHER_STORY = { render, _words: wordsIn };
})();
