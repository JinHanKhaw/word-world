/* Word World: the words Claude is given for the weekly analysis, and the cleaning of the numbers before they leave.
   ONE copy for both paths:
     - the tutor's page on claude.ai (teacher.js, the page's own Claude ability), loaded by teacher.html;
     - the Edge Function on the real website (deploy/functions/weekly-analysis/index.ts), which imports prompt.js,
       a byte-for-byte copy of this file kept next to it. tests/test-analysis.js fails when the two differ.
   The numbers themselves are worked out only by the page (teacher.js, computeProgress and aiNumbers).
   This file is a plain script and an ES module at once: no import or export, no top-level `this`. */
(function (g) {
  "use strict";

  // The only top-level fields of the numbers that may go to Claude. Anything else is dropped.
  const FIELDS = ["weeks_starting_monday", "this_week_starts", "verdict_uses_weeks", "verdict", "measures", "days_played_weekly",
    "minutes_per_level_median_this_week", "words_typed_per_minute_this_week", "slips_this_week", "hints_by_word_this_week",
    "patterns", "school_dictation", "thresholds"];

  // A field is dropped, at any depth, when any part of its name (split at "_" and at capitals) is one of these.
  const DENY = ["id", "ids", "uid", "uuid", "name", "names", "nickname", "email", "mail", "pin", "phone", "address",
    "student", "students", "teacher", "tutor", "parent", "mother", "note", "notes", "sentence", "sentences", "message",
    "messages", "letter", "letters", "reply", "picture", "drawing", "drawn", "handwriting", "voice", "build"];
  const keyParts = k => String(k).replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const deniedKey = k => keyParts(k).some(p => DENY.indexOf(p) >= 0);

  // The words of the names to hide (the student's name, the game name, the tutor's email): two letters or more.
  function nameTokens(names) {
    const out = [];
    (names || []).forEach(n => String(n == null ? "" : n).toLowerCase().split(/[^a-zÀ-ɏ一-鿿]+/).forEach(t => {
      if (t.length >= 2 && out.indexOf(t) < 0) out.push(t);
    }));
    return out;
  }
  // True when a string holds one of the name words as a whole word (any letter case).
  function hasName(s, tokens) {
    if (typeof s !== "string" || !tokens.length) return false;
    const words = s.toLowerCase().split(/[^a-zÀ-ɏ一-鿿]+/);
    return tokens.some(t => words.indexOf(t) >= 0 || (/[一-鿿]/.test(t) && s.indexOf(t) >= 0));
  }
  const holdsName = (v, tokens) => typeof v === "string" ? hasName(v, tokens) :
    Array.isArray(v) ? v.some(x => holdsName(x, tokens)) :
    v && typeof v === "object" ? Object.keys(v).some(k => holdsName(v[k], tokens)) : false;

  // A clean copy of the numbers: only FIELDS at the top, no field with a name-like name at any depth, no list item
  // that holds a name word, and "(removed)" for any other text that does. Returns { data, removed }.
  function scrub(numbers, names) {
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
      removed++; return null;   // functions and anything else
    };
    const data = {};
    const src = numbers && typeof numbers === "object" && !Array.isArray(numbers) ? numbers : {};
    Object.keys(src).forEach(k => { if (FIELDS.indexOf(k) < 0) { removed++; return; } data[k] = walk(src[k]); });
    return { data, removed };
  }

  // The one text Claude gets: instructions, the numbers as JSON, the format. The same words on both paths.
  function text(data) {
    const small = data && data.thresholds && isFinite(+data.thresholds.smallCount) ? +data.thresholds.smallCount : 8;
    return [
      "You are helping a tutor who teaches one learner English spelling once a week. Between lessons the learner plays a short spelling game on most days. Below are the numbers from the game, worked out by fixed rules, with this week last in every list.",
      "Write for the tutor: plain English, short sentences.",
      "Use ONLY the numbers given. Quote the number that supports every statement (for example \"11 of 14 right\").",
      "If a count is under " + small + ", say it is too small to trust.",
      "Do not diagnose. Do not describe the learner as a person, only what the numbers show. Do not promise results. Call the learner \"the learner\".",
      "",
      "NUMBERS (JSON):",
      JSON.stringify(data),
      "",
      "FORMAT: return only one JSON object, nothing before or after it:",
      '{"headline": "one sentence", "changed": ["at most 3 items: what changed since last week, with numbers"], "patterns": ["at most 3 items: something in the slips a person might miss, with the words as evidence"], "next_lesson": ["at most 3 items: what to teach or check in the next lesson"], "confidence": "low" | "medium" | "high", "confidence_reason": "one sentence"}'
    ].join("\n");
  }

  g.WW_AI = { FIELDS, DENY, deniedKey, nameTokens, hasName, scrub, text };
})(typeof globalThis !== "undefined" ? globalThis : window);
