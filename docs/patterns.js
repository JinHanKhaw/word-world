/* Patterns in his slips: window.WW_PATTERNS = { classify, summary, tip, wordsFor, has, CODES, NAMES, TIPS }.
   Pure: no game variables, so the teacher page can use it too. Owner: patterns team.
   classify(target, typed[, beats]) lines the two words up letter by letter (insert, leave out, change, swap two neighbours),
   then names each difference. beats ("um-brel-la") tell where the beats are; without them the last three letters count as the end.
   Self-test: node site/patterns.js */
(function (root) {
  "use strict";
  const CODES = ["double", "vowel", "silent_e", "ending", "beat_missing", "m_before_pb", "cluster", "order", "apostrophe", "other"];
  const NAMES = {
    double:       { en: "Double letters", zh: "双写字母", about_en: "A double letter written once, or a single letter written twice.", about_zh: "双写字母只写了一个，或者单个字母写成了两个。" },
    vowel:        { en: "Vowel letters", zh: "元音字母", about_en: "A vowel sound spelled with other letters, or left out.", about_zh: "元音用了别的字母，或者漏掉了。" },
    silent_e:     { en: "The e at the end", zh: "结尾的 e", about_en: "A quiet e left off the end, or added where there is none.", about_zh: "结尾不发音的 e 漏掉了，或者多加了。" },
    ending:       { en: "The last beat", zh: "最后一拍", about_en: "The last beat spelled differently, cut short or left out.", about_zh: "最后一拍拼得不一样、没写完或者漏掉了。" },
    beat_missing: { en: "A beat left out", zh: "漏掉一拍", about_en: "A whole beat in the middle of the word left out.", about_zh: "单词中间漏掉了一整拍。" },
    m_before_pb:  { en: "m before p or b", zh: "p 和 b 前面的 m", about_en: "n written where m comes before p or b.", about_zh: "在 p 或 b 前面应该写 m，写成了 n。" },
    cluster:      { en: "Consonants together", zh: "连在一起的辅音", about_en: "One letter left out where two or three consonants stand together.", about_zh: "几个辅音连在一起时，漏掉了其中一个。" },
    order:        { en: "Letters swapped", zh: "字母顺序", about_en: "Two letters next to each other written the other way round.", about_zh: "两个相邻的字母顺序颠倒了。" },
    apostrophe:   { en: "The apostrophe", zh: "撇号", about_en: "The apostrophe left out, or put in another place.", about_zh: "撇号漏掉了，或者放错了位置。" },
    other:        { en: "Other letters", zh: "其他字母", about_en: "Another letter in place of the right one.", about_zh: "用了别的字母。" }
  };
  // Orbit's tip: one or two short sentences (seven words or fewer each) that say what to DO. No questions: the tutor found
  // "Which vowel letter makes that sound?" confusing (23 November).
  const TIPS = {
    double:       { en: "See the two same letters. Type both.", zh: "看两个一样的字母。两个都要打。" },
    vowel:        { en: "Look at the orange letters. Type them carefully.", zh: "看橙色的字母。认真把它们打出来。" },
    silent_e:     { en: "The last e is quiet. Type it too.", zh: "最后的 e 不发音。也要把它打出来。" },
    ending:       { en: "Look at the last beat. Type every letter.", zh: "看最后一拍。每个字母都要打。" },
    beat_missing: { en: "Clap each beat. Type every beat.", zh: "拍出每一拍。每一拍都要打。" },
    m_before_pb:  { en: "Before p or b, write m.", zh: "在 p 或 b 前面写 m。" },
    cluster:      { en: "Say each sound slowly. Type every sound.", zh: "慢慢读每个音。每个音都要打。" },
    order:        { en: "Look at the letter order. Type slowly.", zh: "看字母的顺序。慢慢打。" },
    apostrophe:   { en: "Look for the small mark. Type it too.", zh: "找到那个小撇号。也要把它打出来。" },
    other:        { en: "Look at each beat. Then type it.", zh: "看每一拍。然后把它打出来。" }
  };


  const key = s => String(s == null ? "" : s).toLowerCase().replace(/[‘’`´]/g, "'").replace(/[^a-z']/g, "");
  const letters = s => key(s).replace(/'/g, "");
  const isV = (s, i) => { const c = s[i]; return "aeiou".indexOf(c) >= 0 || (c === "y" && i > 0); };   // y after the first letter spells a vowel sound
  const isC = (s, i) => i >= 0 && i < s.length && !isV(s, i);

  // Beats as letter ranges of the target: [[start, end], ...] (end inclusive). Null when they do not spell the target.
  function beatRanges(t, beats) {
    if (!beats) return null;
    const bs = String(beats).split(/[-·\s]+/).map(letters).filter(Boolean);
    if (bs.join("") !== t) return null;
    const out = []; let at = 0;
    bs.forEach(b => { out.push([at, at + b.length - 1]); at += b.length; });
    return out;
  }

  // Letter alignment (Damerau, restricted): the fewest edits from target to typed, and which ones.
  function align(t, y) {
    const n = t.length, m = y.length, D = [];
    for (let i = 0; i <= n; i++) { D.push(new Array(m + 1).fill(0)); D[i][0] = i; }
    for (let j = 0; j <= m; j++) D[0][j] = j;
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
      let v = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (t[i - 1] === y[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && t[i - 1] === y[j - 2] && t[i - 2] === y[j - 1] && t[i - 1] !== t[i - 2]) v = Math.min(v, D[i - 2][j - 2] + 1);
      D[i][j] = v;
    }
    const ops = []; let i = n, j = m;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && t[i - 1] === y[j - 1] && D[i][j] === D[i - 1][j - 1]) { i--; j--; continue; }
      if (i > 1 && j > 1 && t[i - 1] === y[j - 2] && t[i - 2] === y[j - 1] && t[i - 1] !== t[i - 2] && D[i][j] === D[i - 2][j - 2] + 1) { ops.push({ op: "swap", i: i - 2, j: j - 2 }); i -= 2; j -= 2; continue; }
      // on a tie, a double letter written once (or a letter doubled) explains the slip better than a changed letter
      if (i > 0 && D[i][j] === D[i - 1][j] + 1 && (t[i - 2] === t[i - 1] || t[i] === t[i - 1])) { ops.push({ op: "del", i: i - 1, j, a: t[i - 1] }); i--; continue; }
      if (j > 0 && D[i][j] === D[i][j - 1] + 1 && (y[j - 2] === y[j - 1] || y[j] === y[j - 1])) { ops.push({ op: "ins", i, j: j - 1, b: y[j - 1] }); j--; continue; }
      if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + 1) { ops.push({ op: "sub", i: i - 1, j: j - 1, a: t[i - 1], b: y[j - 1] }); i--; j--; continue; }
      if (i > 0 && D[i][j] === D[i - 1][j] + 1) { ops.push({ op: "del", i: i - 1, j, a: t[i - 1] }); i--; continue; }
      ops.push({ op: "ins", i, j: j - 1, b: y[j - 1] }); j--;
    }
    return { dist: D[n][m], ops: ops.reverse() };
  }

  // Name each edit. Runs of letters left out (or added) side by side are named together.
  function nameOps(t, y, ops, ranges) {
    const n = t.length, out = [];
    const lastStart = ranges && ranges.length > 1 ? ranges[ranges.length - 1][0] : Math.max(1, n - 3);
    const beatOf = i => ranges ? ranges.findIndex(r => i >= r[0] && i <= r[1]) : -1;
    const magicE = i => {   // an e that ends a beat spelled vowel, consonant, e (in-vite, care-ful)
      if (t[i] !== "e" || !ranges) return false; const r = ranges[beatOf(i)];
      return !!r && r[1] === i && i - r[0] >= 2 && isC(t, i - 1) && isV(t, i - 2);
    };
    for (let k = 0; k < ops.length; k++) {
      const o = ops[k];
      if (o.op === "swap") { out.push({ code: "order", at: o.i }); continue; }
      if (o.op === "sub") {
        let code;
        if (o.a === "m" && o.b === "n" && (t[o.i + 1] === "p" || t[o.i + 1] === "b")) code = "m_before_pb";
        else if (isV(t, o.i) && ("aeiouy".indexOf(o.b) >= 0)) code = "vowel";
        else if (o.i === n - 1) code = "ending";
        else code = "other";
        out.push({ code, at: o.i }); continue;
      }
      if (o.op === "del") {
        let e = k; while (e + 1 < ops.length && ops[e + 1].op === "del" && ops[e + 1].i === ops[e].i + 1) e++;
        const s = o.i, last = ops[e].i, len = last - s + 1; k = e;
        if (len === 1) {
          let code;
          if (t[s - 1] === t[s] || t[s + 1] === t[s]) code = "double";
          else if (t[s] === "e" && s === n - 1 && s > 0 && isC(t, s - 1)) code = "silent_e";
          else if (magicE(s)) code = "silent_e";
          else if (s === n - 1) code = "ending";
          else if (isV(t, s)) code = "vowel";
          else if (isC(t, s - 1) || isC(t, s + 1)) code = "cluster";
          else code = "other";
          out.push({ code, at: s }); continue;
        }
        const seg = t.slice(s, last + 1), hasV = /[aeiouy]/.test(seg), hasC = /[^aeiouy]/.test(seg);
        const wholeBeat = ranges && ranges.some(r => r[0] >= s && r[1] <= last);
        let code;
        if (last === n - 1) code = "ending";
        else if (wholeBeat || (hasV && hasC)) code = "beat_missing";
        else if (!hasC) code = "vowel";
        else code = "cluster";
        out.push({ code, at: s }); continue;
      }
      // letters added
      let e = k; while (e + 1 < ops.length && ops[e + 1].op === "ins" && ops[e + 1].j === ops[e].j + 1) e++;
      const j0 = o.j, j1 = ops[e].j, seg = y.slice(j0, j1 + 1), atEnd = o.i === n; k = e;
      let code;
      if (seg.length === 1 && (y[j0 - 1] === seg || y[j0 + 1] === seg)) code = "double";
      else if (seg === "e" && atEnd) code = "silent_e";
      else if (atEnd) code = "ending";
      else if (/^[aeiouy]+$/.test(seg)) code = "vowel";
      else code = "other";
      out.push({ code, at: Math.min(o.i, n - 1) });
    }
    // the last beat: two or more changes there, not all of them vowel, double or e changes, are one slip in the ending
    const inLast = out.filter(x => x.at >= lastStart);
    if (inLast.length >= 2 && inLast.some(x => ["vowel", "double", "silent_e"].indexOf(x.code) < 0)) inLast.forEach(x => { x.code = "ending"; });
    return out;
  }

  function classify(target, typed, beats) {
    const tk = key(target), yk = key(typed);
    if (!tk || tk === yk) return [];
    const codes = [];
    let t = tk, y = yk;
    if (tk.indexOf("'") >= 0 || yk.indexOf("'") >= 0) {
      t = tk.replace(/'/g, ""); y = yk.replace(/'/g, "");
      codes.push("apostrophe");
      if (t === y) return codes;
    }
    if (!y) return ["other"];
    const a = align(t, y);
    if (a.dist > Math.max(3, Math.ceil(t.length * 0.6))) return codes.concat(["other"]);   // another word, not a slip in this one
    nameOps(t, y, a.ops, beatRanges(t, beats)).forEach(x => codes.push(x.code));
    return CODES.filter(c => codes.indexOf(c) >= 0);
  }

  // Beats for a word: from the caller, else from the word bank when it is loaded.
  function beatsLookup(opts) {
    const b = opts && opts.beats;
    if (typeof b === "function") return b;
    if (b && typeof b === "object") return w => b[key(w)] || b[w] || null;
    const bank = root && root.WW_BANK;
    if (!bank) return () => null;
    const map = {}; bank.forEach(r => { map[key(r[0])] = r[1]; });
    return w => map[key(w)] || null;
  }
  // Rows of the table attempts. First tries only: new, review and test steps, training words, and the first clue per word in a
  // mixed round. Retries and the small extra games are left out. opts: { kinds: [...], beats: fn or { word: "um-brel-la" } }.
  const FIRST_KINDS = ["new", "review", "test", "mixed", "training"];
  function summary(attempts, opts) {
    opts = opts || {};
    const kinds = opts.kinds || FIRST_KINDS, beatsOf = beatsLookup(opts), seen = {}, buckets = {};
    (attempts || []).slice().sort((p, r) => String(p.created_at || "") < String(r.created_at || "") ? -1 : String(p.created_at || "") > String(r.created_at || "") ? 1 : 0).forEach(r => {
      if (!r || kinds.indexOf(r.kind) < 0) return;
      if (r.kind === "mixed") { const k = (r.quest_id || "") + "|" + (r.word_id || r.word); if (seen[k]) return; seen[k] = true; }
      if (r.correct || !r.answer || !r.word) return;
      classify(r.word, r.answer, beatsOf(r.word)).forEach(code => {
        const b = buckets[code] || (buckets[code] = { code, name_en: NAMES[code].en, name_zh: NAMES[code].zh, about_en: NAMES[code].about_en, about_zh: NAMES[code].about_zh, count: 0, examples: [] });
        b.count++;
        if (b.examples.length < 4 && !b.examples.some(x => x.word === r.word && x.typed === r.answer)) b.examples.push({ word: r.word, typed: r.answer });
      });
    });
    return Object.keys(buckets).map(k => buckets[k]).sort((p, r) => r.count - p.count || CODES.indexOf(p.code) - CODES.indexOf(r.code));
  }
  function tip(code) { const t = TIPS[code] || TIPS.other; return { en: t.en, zh: t.zh }; }

  // Does this word give practice in that pattern?
  const DIGRAPH = /^(ch|sh|th|ph|wh|ck|ng|gh|qu)$/;
  function has(code, word, beats) {
    const t = letters(word), k = key(word), r = beatRanges(t, beats), nb = r ? r.length : (t.match(/[aeiouy]+/g) || []).length;
    switch (code) {
      case "double": return /([a-z])\1/.test(t);
      case "vowel": return /(ai|ay|ea|ee|ie|oa|oo|ou|ow|au|aw|ue|ui|ey)/.test(t) || nb >= 3;
      case "silent_e": return /[^aeiou]e$/.test(t) && /[aeiouy][^aeiouy]e$/.test(t) || !!(r && r.some(x => /[aeiouy][^aeiouy]e$/.test(t.slice(x[0], x[1] + 1))));
      case "ending": return nb >= 2;
      case "beat_missing": return nb >= 3;
      case "m_before_pb": return /m[pb]/.test(t);
      case "cluster": for (let i = 1; i < t.length; i++) if (isC(t, i) && isC(t, i - 1) && t[i] !== t[i - 1] && !DIGRAPH.test(t.slice(i - 1, i + 1))) return true; return false;
      case "order": return t.length >= 6;
      case "apostrophe": return k.indexOf("'") >= 0;
      default: return t.length > 0;
    }
  }
  // words: strings, word rows ({ word, chunks }) or bank rows ([word, beats, ...]). Returns the ones that train the pattern.
  function wordsFor(code, words) {
    return (words || []).filter(w => {
      if (typeof w === "string") return has(code, w, null);
      if (Array.isArray(w)) return has(code, w[0], w[1]);
      return w && has(code, w.word, w.chunks);
    });
  }

  const api = { classify, summary, tip, wordsFor, has, align, CODES, NAMES, TIPS };
  root.WW_PATTERNS = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  // ---- self-test: node site/patterns.js ----
  if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
    const B = {
      umbrella: "um-brel-la", lollipop: "lol-li-pop", pumpkin: "pump-kin", camera: "cam-er-a", parrot: "par-rot", banana: "ba-na-na",
      remember: "re-mem-ber", february: "feb-ru-ar-y", aeroplane: "aer-o-plane", sandwich: "sand-wich", invite: "in-vite", carefully: "care-ful-ly",
      september: "sep-tem-ber", number: "num-ber", rabbit: "rab-bit", tomorrow: "to-mor-row", station: "sta-tion", basket: "bas-ket",
      computer: "com-pu-ter", camping: "camp-ing", happy: "hap-py", different: "dif-fer-ent", beautiful: "beau-ti-ful", surprise: "sur-prise",
      chimney: "chim-ney", interesting: "in-ter-est-ing", police: "po-lice", hospital: "hos-pi-tal", tulips: "tu-lips", dinosaur: "di-no-saur",
      champion: "cham-pi-on", trumpet: "trum-pet", pancake: "pan-cake", mountain: "moun-tain", celebration: "cel-e-bra-tion", climbing: "climb-ing",
      adventure: "ad-ven-ture", sunshine: "sun-shine", question: "ques-tion", animal: "an-i-mal", picnic: "pic-nic", together: "to-geth-er"
    };
    const CASES = [
      ["rabbit", "rabit", ["double"]], ["parrot", "parot", ["double"]], ["umbrella", "umbrela", ["double"]], ["lollipop", "lolipop", ["double"]],
      ["happy", "hapy", ["double"]], ["tomorrow", "tommorow", ["double"]], ["animal", "annimal", ["double"]], ["different", "diferent", ["double"]],
      ["camera", "camer", ["ending"]], ["camping", "campin", ["ending"]], ["computer", "compute", ["ending"]], ["station", "stashun", ["ending"]],
      ["tulips", "tulip", ["ending"]], ["camera", "cam", ["ending"]],
      ["banana", "banena", ["vowel"]], ["basket", "baskit", ["vowel"]], ["hospital", "hospitel", ["vowel"]], ["chimney", "chimny", ["vowel"]],
      ["different", "diffrent", ["vowel"]], ["mountain", "mountin", ["vowel"]], ["dinosaur", "dinosor", ["vowel"]], ["question", "qestion", ["vowel"]],
      ["beautiful", "butiful", ["vowel"]],
      ["plane", "plan", ["silent_e"]], ["aeroplane", "aeroplan", ["silent_e"]], ["invite", "invit", ["silent_e"]], ["pancake", "pancak", ["silent_e"]],
      ["carefully", "carfully", ["silent_e"]], ["tomato", "tomatoe", ["silent_e"]], ["sunshine", "sunshin", ["silent_e"]],
      ["remember", "rember", ["beat_missing"]], ["interesting", "intesting", ["beat_missing"]], ["celebration", "celation", ["beat_missing"]],
      ["number", "nunber", ["m_before_pb"]], ["september", "septenber", ["m_before_pb"]], ["umbrella", "unbrella", ["m_before_pb"]],
      ["trumpet", "trunpet", ["m_before_pb"]], ["champion", "chanpion", ["m_before_pb"]],
      ["pumpkin", "pumkin", ["cluster"]], ["sandwich", "sanwich", ["cluster"]], ["february", "febuary", ["cluster"]], ["surprise", "suprise", ["cluster"]],
      ["climbing", "climing", ["cluster"]], ["celebration", "celebation", ["cluster"]],
      ["friend", "freind", ["order"]], ["aeroplane", "aerolpane", ["order"]], ["together", "togehter", ["order"]],
      ["don't", "dont", ["apostrophe"]], ["it's", "its", ["apostrophe"]], ["don't", "dnot", ["apostrophe", "order"]],
      ["police", "polise", ["other"]], ["picnic", "piknic", ["other"]], ["camera", "kamera", ["other"]], ["adventure", "giraffe", ["other"]],
      ["umbrella", "unbrela", ["double", "m_before_pb"]], ["remember", "remenber", ["m_before_pb"]], ["banana", "banan", ["ending"]],
      ["parrot", "parrot", []], ["Umbrella", "umbrella", []], ["February", "february", []]
    ];
    let pass = 0, fail = 0;
    CASES.forEach(([t, y, want]) => {
      const got = classify(t, y, B[t]), ok = JSON.stringify(got) === JSON.stringify(CODES.filter(c => want.indexOf(c) >= 0));
      if (ok) pass++; else { fail++; console.log("FAIL", t, y, "want", want.join(","), "got", got.join(",")); }
    });
    // without beats the obvious ones still hold
    [["rabbit", "rabit", ["double"]], ["plane", "plan", ["silent_e"]], ["number", "nunber", ["m_before_pb"]], ["camera", "camer", ["ending"]]].forEach(([t, y, want]) => {
      const got = classify(t, y); if (JSON.stringify(got) === JSON.stringify(want)) pass++; else { fail++; console.log("FAIL (no beats)", t, y, got.join(",")); }
    });
    // summary: first tries only, most frequent first
    const now = new Date().toISOString(), rows = [
      { word: "umbrella", answer: "umbrela", correct: false, kind: "review", created_at: now }, { word: "parrot", answer: "parot", correct: false, kind: "review", created_at: now },
      { word: "lollipop", answer: "lolipop", correct: false, kind: "new", created_at: now }, { word: "lollipop", answer: "lolipopp", correct: false, kind: "retry", created_at: now },
      { word: "camera", answer: "camer", correct: false, kind: "test", created_at: now }, { word: "police", answer: "police", correct: true, kind: "review", created_at: now },
      { word: "banana", answer: "banena", correct: false, kind: "mixed", quest_id: "q", word_id: "w8", created_at: "1" }, { word: "banana", answer: "banona", correct: false, kind: "mixed", quest_id: "q", word_id: "w8", created_at: "2" }
    ];
    const s = summary(rows, { beats: B }), chk = (name, ok) => { if (ok) pass++; else { fail++; console.log("FAIL", name); } };
    chk("summary: double first with 3", s[0].code === "double" && s[0].count === 3 && s[0].examples.length === 3 && s[0].name_en === "Double letters");
    chk("summary: retry not counted, mixed first clue only", s.find(x => x.code === "vowel").count === 1 && s.find(x => x.code === "ending").count === 1);
    chk("summary: empty", summary([]).length === 0 && summary(null).length === 0);
    // tips: one or two sentences, seven words or fewer each, no question, Chinese present
    CODES.forEach(c => { const t = tip(c), ss = t.en.split(/(?<=[.?!])\s+/); chk("tip " + c, ss.length >= 1 && ss.length <= 2 && ss.every(x => x.split(/\s+/).length <= 7) && t.en.indexOf("?") < 0 && /[一-鿿]/.test(t.zh)); });
    // wordsFor
    const bankWords = Object.keys(B).map(w => ({ word: w, chunks: B[w] }));
    const dbl = wordsFor("double", bankWords).map(w => w.word);
    chk("wordsFor double", ["umbrella", "lollipop", "parrot", "rabbit", "happy"].every(w => dbl.indexOf(w) >= 0) && dbl.indexOf("camera") < 0 && dbl.indexOf("pumpkin") < 0);
    chk("wordsFor m_before_pb", JSON.stringify(wordsFor("m_before_pb", ["number", "pumpkin", "camera", "umbrella", "champion"])) === JSON.stringify(["number", "pumpkin", "umbrella", "champion"]));
    chk("wordsFor silent_e", JSON.stringify(wordsFor("silent_e", [["invite", "in-vite"], ["camera", "cam-er-a"], ["carefully", "care-ful-ly"], ["pancake", "pan-cake"]]).map(r => r[0])) === JSON.stringify(["invite", "carefully", "pancake"]));
    chk("wordsFor apostrophe", JSON.stringify(wordsFor("apostrophe", ["don't", "dont", "it's"])) === JSON.stringify(["don't", "it's"]));
    console.log((fail ? "FAILED " : "PASSED ") + pass + " of " + (pass + fail) + " checks (" + CASES.length + " word pairs)");
    process.exitCode = fail ? 1 : 0;
  }
})(typeof window !== "undefined" ? window : globalThis);
