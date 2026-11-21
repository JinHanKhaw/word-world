/* One new-rule word at the end of a level ("Can you work it out?"): words he was never taught that follow the island's rule.
   Not one of the 100 words in bank.js. 12 per island: { word, zh (its meaning in simplified Chinese, shown under the sound button), beats }. Read by src/js/80-level.js (window.WW_PROBES). */
window.WW_PROBES = {
  // 1: every beat has one vowel sound
  1: [
    { word: "rocket", zh: "火箭", beats: ["rock", "et"] }, { word: "magnet", zh: "磁铁", beats: ["mag", "net"] }, { word: "garden", zh: "花园", beats: ["gar", "den"] },
    { word: "window", zh: "窗户", beats: ["win", "dow"] }, { word: "dentist", zh: "牙医", beats: ["den", "tist"] }, { word: "pencil", zh: "铅笔", beats: ["pen", "cil"] },
    { word: "seven", zh: "七", beats: ["sev", "en"] }, { word: "lemon", zh: "柠檬", beats: ["lem", "on"] }, { word: "robot", zh: "机器人", beats: ["ro", "bot"] },
    { word: "planet", zh: "行星", beats: ["plan", "et"] }, { word: "volcano", zh: "火山", beats: ["vol", "ca", "no"] }, { word: "potato", zh: "土豆", beats: ["po", "ta", "to"] }
  ],
  // 2: after a short vowel, the next letter is written twice
  2: [
    { word: "puppy", zh: "小狗", beats: ["pup", "py"] }, { word: "funny", zh: "好笑的", beats: ["fun", "ny"] }, { word: "jelly", zh: "果冻", beats: ["jel", "ly"] },
    { word: "kettle", zh: "烧水壶", beats: ["ket", "tle"] }, { word: "paddle", zh: "船桨", beats: ["pad", "dle"] }, { word: "muddy", zh: "满是泥的", beats: ["mud", "dy"] },
    { word: "sunny", zh: "晴朗的", beats: ["sun", "ny"] }, { word: "bigger", zh: "更大的", beats: ["big", "ger"] }, { word: "middle", zh: "中间", beats: ["mid", "dle"] },
    { word: "rattle", zh: "拨浪鼓", beats: ["rat", "tle"] }, { word: "dizzy", zh: "头晕的", beats: ["diz", "zy"] }, { word: "lesson", zh: "一节课", beats: ["les", "son"] }
  ],
  // 3: the e at the end is silent; it makes the vowel say its name
  3: [
    { word: "snake", zh: "蛇", beats: ["snake"] }, { word: "smile", zh: "微笑", beats: ["smile"] }, { word: "stone", zh: "石头", beats: ["stone"] },
    { word: "plate", zh: "盘子", beats: ["plate"] }, { word: "flute", zh: "笛子", beats: ["flute"] }, { word: "slide", zh: "滑梯", beats: ["slide"] },
    { word: "erase", zh: "擦掉", beats: ["e", "rase"] }, { word: "reptile", zh: "爬行动物", beats: ["rep", "tile"] }, { word: "trombone", zh: "长号", beats: ["trom", "bone"] },
    { word: "costume", zh: "演出服", beats: ["cos", "tume"] }, { word: "pinecone", zh: "松果", beats: ["pine", "cone"] }, { word: "lifetime", zh: "一辈子", beats: ["life", "time"] }
  ],
  // 4: before p and b we write m, not n
  4: [
    { word: "lamp", zh: "灯", beats: ["lamp"] }, { word: "jump", zh: "跳", beats: ["jump"] }, { word: "stamp", zh: "邮票", beats: ["stamp"] },
    { word: "thumb", zh: "大拇指", beats: ["thumb"] }, { word: "empty", zh: "空的", beats: ["emp", "ty"] }, { word: "timber", zh: "木头", beats: ["tim", "ber"] },
    { word: "lumpy", zh: "疙疙瘩瘩的", beats: ["lump", "y"] }, { word: "bumper", zh: "保险杠", beats: ["bump", "er"] }, { word: "tumble", zh: "摔倒", beats: ["tum", "ble"] },
    { word: "symbol", zh: "符号", beats: ["sym", "bol"] }, { word: "lumber", zh: "木材", beats: ["lum", "ber"] }, { word: "grumpy", zh: "爱发脾气的", beats: ["grump", "y"] }
  ],
  // 5: a big word is small pieces joined up
  5: [
    { word: "grandmother", zh: "奶奶，外婆", beats: ["grand", "moth", "er"] }, { word: "understand", zh: "明白", beats: ["un", "der", "stand"] },
    { word: "everybody", zh: "每个人", beats: ["ev", "ery", "bod", "y"] }, { word: "butterfly", zh: "蝴蝶", beats: ["but", "ter", "fly"] },
    { word: "hamburger", zh: "汉堡包", beats: ["ham", "bur", "ger"] }, { word: "watermelon", zh: "西瓜", beats: ["wa", "ter", "mel", "on"] },
    { word: "invitation", zh: "邀请", beats: ["in", "vi", "ta", "tion"] }, { word: "competition", zh: "比赛", beats: ["com", "pe", "ti", "tion"] },
    { word: "helicopter", zh: "直升机", beats: ["hel", "i", "cop", "ter"] }, { word: "television", zh: "电视", beats: ["tel", "e", "vi", "sion"] },
    { word: "kangaroo", zh: "袋鼠", beats: ["kan", "ga", "roo"] }, { word: "supermarket", zh: "超市", beats: ["su", "per", "mar", "ket"] }
  ]
};
