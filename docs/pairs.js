/* "Which word did you hear?" (src/js/83-pairs.js): the word pairs. Each pair is two common one-beat words that differ
   only in the vowel letters: [word A, word B, contrast]. The contrasts come in this order, and inside a contrast the game
   goes through the pairs in this order. Every word is checked by tests/test-pairs.js (a real word, no rude word, the
   consonants the same).
   Left out on purpose: pairs a British voice says (almost) the same way, such as "bin / been" (many British
   voices say "been" like "bin"), "pull / pool", "cot / caught"; "hill / heel" and "fill / feel" (the l is
   doubled in one word only, so the spelling differs in more than the vowel); words with two ways to say them ("lead", "read", "wind", "live");
   and words that are not for a child's game. */
window.WW_PAIR_LIST = [
  // e and i (bed / bid)
  ["bed", "bid", "e-i"], ["pen", "pin", "e-i"], ["ten", "tin", "e-i"], ["set", "sit", "e-i"], ["bell", "bill", "e-i"],
  ["peg", "pig", "e-i"], ["left", "lift", "e-i"], ["desk", "disk", "e-i"], ["pet", "pit", "e-i"], ["fell", "fill", "e-i"],
  // a and e (bad / bed)
  ["lag", "leg", "a-e"], ["bad", "bed", "a-e"], ["man", "men", "a-e"], ["pan", "pen", "a-e"], ["bat", "bet", "a-e"],
  ["sat", "set", "a-e"], ["sand", "send", "a-e"], ["bag", "beg", "a-e"],
  // a and u (cat / cut)
  ["cap", "cup", "a-u"], ["cat", "cut", "a-u"], ["bag", "bug", "a-u"], ["fan", "fun", "a-u"], ["ran", "run", "a-u"],
  ["hat", "hut", "a-u"], ["mad", "mud", "a-u"],
  // o and u (hot / hut)
  ["cot", "cut", "o-u"], ["hot", "hut", "o-u"], ["dog", "dug", "o-u"], ["lock", "luck", "o-u"], ["not", "nut", "o-u"],
  ["dock", "duck", "o-u"],
  // i and ee (ship / sheep)
  ["ship", "sheep", "i-ee"], ["sit", "seat", "i-ee"], ["lip", "leap", "i-ee"], ["chip", "cheap", "i-ee"], ["bit", "beat", "i-ee"],
  ["dip", "deep", "i-ee"], ["slip", "sleep", "i-ee"],
  // o and a (hot / hat)
  ["hot", "hat", "o-a"], ["top", "tap", "o-a"], ["cot", "cat", "o-a"], ["mop", "map", "o-a"], ["sock", "sack", "o-a"],
  ["pot", "pat", "o-a"]
];
// The contrasts in order, with the plain label the tutor's page shows.
window.WW_PAIR_CONTRASTS = [
  ["e-i", "e and i (bed / bid)"], ["a-e", "a and e (bad / bed)"], ["a-u", "a and u (cat / cut)"],
  ["o-u", "o and u (hot / hut)"], ["i-ee", "i and ee (ship / sheep)"], ["o-a", "o and a (hot / hat)"]
];
// For the tutor's page: window.WW_PAIRS_STATS(events, now) -> [{ contrast, label, right, of }] for the last 14 days
// (today and the 13 days before), first tries only, contrasts in list order, only those he played. events: rows of the
// table events ({ type, detail, created_at }); only type "pair" counts. Pure: no game variables, so the tutor's page can
// load this file and call it.
window.WW_PAIRS_STATS = function (events, now) {
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var dkey = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  var end = now ? new Date(now) : new Date(), start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 13);
  var from = dkey(start), to = dkey(end), rows = {}, order = [];
  (window.WW_PAIR_CONTRASTS || []).forEach(function (c) { rows[c[0]] = { contrast: c[0], label: c[1], right: 0, of: 0 }; order.push(c[0]); });
  (events || []).forEach(function (e) {
    if (!e || e.type !== "pair" || !e.detail || +e.detail.try !== 1 || !e.created_at) return;
    var day = dkey(new Date(e.created_at)); if (day < from || day > to) return;
    var c = String(e.detail.contrast || "");
    if (!rows[c]) { rows[c] = { contrast: c, label: c.replace("-", " and "), right: 0, of: 0 }; order.push(c); }
    rows[c].of++; if (e.detail.right) rows[c].right++;
  });
  return order.map(function (c) { return rows[c]; }).filter(function (r) { return r.of > 0; });
};
