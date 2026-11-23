/* The tutor's own words, in the order she wants them (23 November 2026). Hand-written; every word must be in site/pool.js.
   main:  the words that get a full lesson first, from level 4 on (levels 1 to 3 are umbrella, lollipop / pumpkin, company /
          camera, parrot: the first school words). One word of his school spelling test (the ones he did not get right, long
          ones first) next to one word of her assessment report, level by level; then the game chooses by how he does.
   quick: the short words for the quick check (4 a day, before the two main words), in this order; after them the short
          words of the pool, easiest first. A word he types right there never gets a lesson; one he does not becomes a lesson. */
window.WW_FIRST = {
  // PATTERN WEEKS (the tutor, 23 November: "Yes, pattern weeks"). A week is 5 levels = 10 main words; a level with the monster's
  // spelling test does not count. Each week has one spelling pattern: first her own words with that pattern (words), then long
  // words of the pool that have one of the week's features (feat: the names in pool col 16; "plain" = a long word with no
  // other feature), nearest his step. After the last week the patterns go round again with the pool's words. name/zh: what
  // the teacher page and the game call the pattern; tip: one plain sentence for the tutor's own lesson.
  weeks: [
    { key: "beats", name: "Long words, beat by beat", zh: "长单词，一拍一拍拼", feat: ["plain"],
      tip: "Clap the beats with him. Every beat has a vowel sound. He says one beat, then spells it.",
      words: ["police", "tulips", "aeroplane", "February"] },   // levels 4 and 5; levels 1 to 3 are six words of the same kind
    { key: "double", name: "Double letters", zh: "双写字母", feat: ["double"],
      tip: "After a short vowel sound the next letter is often written twice: dif-fer-ent, sud-den-ly.",
      words: ["different", "suddenly", "disappear", "usually"] },
    { key: "m_pb", name: "m before p and b", zh: "p 和 b 前面写 m", feat: ["m_pb"],
      tip: "Before p and b we write m, never n: im-por-tant, re-mem-ber.",
      words: ["important", "remember"] },
    { key: "vowel_team", name: "Two vowel letters, one sound", zh: "两个元音字母，一个音", feat: ["vowel_team"],
      tip: "Two vowel letters can make one sound: ea in weather, ou in enormous. He learns the pair, not single letters.",
      words: ["beautiful", "favourite", "weather", "enormous", "frightened", "although", "through"] },
    { key: "endings", name: "Endings: -ly and -y", zh: "词尾：-ly 和 -y", feat: ["y_end", "le_end"],
      tip: "The ending -ly is always l, y. He spells the word first, then adds the ending: quiet + ly.",
      words: ["probably", "quietly", "lilies"] },
    { key: "silent", name: "Letters you cannot hear", zh: "听不到的字母", feat: ["silent", "magic_e"],
      tip: "Some letters are written but not heard: the k in knowledge, the e at the end of roses.",
      words: ["knowledge", "exhausted", "whether", "roses"] }
  ],
  // where each of her words comes from (for the labels on the teacher page)
  school: ["lilies", "tulips", "roses", "umbrella", "lollipop", "pumpkin", "bid", "lag", "glove", "company", "bowl", "oven", "parrot",
           "camera", "police", "fence", "slide", "aeroplane", "February", "fin", "dig", "net", "map", "cot", "swan", "snow", "stand",
           "nest", "bread", "bench"],
  report: ["different", "important", "usually", "probably", "beautiful", "favourite", "remember", "suddenly", "disappear", "although",
           "through", "enough", "answer", "splash", "thrown", "bridge", "quietly", "enormous", "frightened", "knowledge", "exhausted",
           "weather", "whether"],
  main: ["police", "different", "aeroplane", "remember", "February", "beautiful", "tulips", "important", "lilies", "disappear",
         "roses", "suddenly", "favourite", "probably", "usually", "although", "quietly", "enormous", "frightened", "knowledge",
         "exhausted", "weather", "whether", "through"],
  quick: ["fin", "dig", "bid", "net", "map", "lag", "cot", "swan", "snow", "glove", "stand", "nest", "bread", "bowl", "bench",
          "oven", "fence", "slide", "answer", "enough", "splash", "thrown", "bridge"]
};
