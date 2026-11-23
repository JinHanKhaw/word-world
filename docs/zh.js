/* 中文 toggle for the student app. Every English instruction gets its Chinese line underneath.
   Word content (meanings, sentences) already carries its own Chinese from the teacher; this covers the app's own words. */
(function () {
  const PRAISE = {
    "Nice! You got it!": "太棒了！答对了！", "Perfect spelling!": "拼写完美！", "Long word, no problem!": "长单词也没问题！",
    "Level up! Keep going!": "升级了！继续！", "Wow, from memory!": "哇，凭记忆拼出来的！", "Your brain remembered!": "你的大脑记住了！"
  };
  const ZONEN = { "Sunny Island": "阳光岛", "Jungle": "丛林", "Under the Sea": "海底", "Ice Cave": "冰洞", "Sky Castle": "天空城堡" };
  const X = {
    // gate
    "Loading…": "加载中…", "Connect this device": "连接这台设备", "Type the 6-letter code your teacher gave you.": "输入老师给你的6个字母代码。",
    "Connect": "连接", "That code didn't work. Check it with your teacher.": "代码不对，请和老师确认。",
    "Type your PIN to enter your world.": "输入你的PIN进入你的世界。", "Enter": "进入", "Not quite. Try again.": "不太对，再试一次。",
    // header and world
    "day streak": "天连续", "of 5 this week": "/ 5 天（本周）", "Loading the world…": "正在加载世界…", "Open the mailbox": "打开信箱", "Open the map": "打开地图", "Go into the hut": "进小屋", "Build and shop": "建造和商店",
    "Open your magic words first.": "先打开你的魔法单词。", "The quest marker is jumping. Go to the map table!": "任务标记在跳。去地图桌！", "Go on": "继续", "Stop here": "先停在这里", "You can stop now and come back later. Your diamonds are safe.": "你可以现在停下，以后再回来。你的钻石不会丢。", "Memory checks done!": "记忆检查完成！", "New words done!": "新单词完成！", "Zone test done!": "区域测试完成！",
    "End now? You keep your diamonds.": "现在结束？钻石会保留。", "Level ended. Your diamonds are safe. Tap the level to go on.": "这一关先停下。钻石不会丢。点关卡继续。", "Opens tomorrow. Two levels a day!": "明天开放。一天最多两关！", "bricks": "块砖", "📦 Quest": "📦 任务", "🏠 Build": "🏠 建造", "🛖 Hut": "🛖 小屋",
    "Tap a place to walk there": "点一个地方走过去", "You have mail at the hut!": "小屋里有你的信！", "Quest done. Build again tomorrow!": "任务完成，明天再建！",
    "Tap the quest chest to start": "点任务宝箱开始", "Paused. Come back to the chest to continue.": "已暂停，回到宝箱继续。",
    "Open your mailbox first": "先打开你的信箱", "Open your mailbox first. Tap the hut.": "先打开你的信箱。点小屋。",
    // check-in ritual
    "Streak started!": "连续打卡开始！", "Day 1. Come back tomorrow to make it 2.": "第1天。明天再来，变成2天！",
    "Open my mailbox": "打开我的信箱", "Mailbox": "信箱", "No new mail today.": "今天没有新信。", "I'm ready to start my quest": "我准备好开始任务了",
    "Reply": "回复", "Send": "发送", "📮 Mail": "📮 信箱", "You have mail!": "你有信！", "Open all your mail first": "先打开所有的信",
    "Tap to open": "点一下打开", "Tap to see it again": "点一下再看一次", "Magic word": "魔法单词", "Tap the card to flip it.": "点一下卡片翻面。", "dictionary": "词典",
    "I'm ready!": "我准备好了！", "The quest chest is jumping. Tap it!": "任务宝箱在跳。点它！", "No quest today. Come back tomorrow!": "今天没有任务。明天再来！",
    "Quest path": "任务之路", "week 1": "第1周", "‹ My world": "‹ 我的世界", "Play": "开始", "Done": "完成", "Locked": "锁住", "Paused. Tap the stone to continue.": "已暂停。点石头继续。",
    "Quest ended. No bricks today. Tap the stone to try again.": "任务结束了。今天没有砖。点石头再试一次。", "All quests done. Great work!": "所有任务都完成了。太棒了！",
    "My build": "我的建筑", "Clear all": "全部清除", "Really clear?": "真的要清除？", "Saved": "已保存", "No bricks left. Do a quest!": "没有砖了。去做任务！",
    "Tap a square to place a brick. Tap it again to take it back.": "点一个格子放一块砖。再点一下拿回来。", "Go and build": "去建造", "Back to the path": "回到路上",
    "No words yet. Do your first quest.": "还没有单词。先做第一个任务。",
    "Your magic words": "你的魔法单词", "No new words today.": "今天没有新单词。", "Write back": "回信", "Sent!": "发出去了！", "Back to my world": "回到我的世界",
    "Open the card first": "先打开卡片", "Open both cards first": "先打开两张卡片", "Meaning": "意思", "Now you say it": "现在你来说",
    "Say it now…": "现在说…", "Got it!": "录好了！", "Done ✓": "完成 ✓", "Pick a game.": "选一个游戏。", "🧩 Which meaning?": "🧩 哪个意思？", "💬 Which sentence?": "💬 哪个句子？",
    "Tap each piece to hear it. Say it after.": "点每一块听一听。跟着说。", "Say each piece and tap the hands once.": "说一块，点一下小手。", "No microphone? Tap instead": "没有麦克风？点一下代替",
    "I did not hear anything. Try again, a bit louder.": "我没听到。再试一次，大声一点。",
    "Type your PIN.": "输入你的密码。", "Teacher? Type your teacher PIN here.": "老师？在这里输入老师密码。",
    "look": "看", "say and clap": "说和拍手", "say it": "说出来", "tap the sounds": "点声音", "write it": "写出来", "type it": "打出来", "listen and type": "听写", "pop the bubbles": "戳泡泡",
    "Listen. Then say each piece.": "听。然后把每一块说出来。", "Say each piece and clap it. Tap the hands once for each piece.": "说一块，拍一下。每一块点一次小手。",
    "Done clapping": "拍好了", "More pieces. Listen again.": "还有更多块。再听一次。", "Too many. Listen again.": "太多了。再听一次。",
    "Now say the whole word. Tap the microphone and speak.": "现在说整个词。点麦克风，说出来。", "Listening…": "在听…",
    "Say the word slowly. Tap once for each sound you hear.": "慢慢说这个词。每听到一个声音点一次。", "Undo": "撤销", "Done": "好了",
    "Write it here with your finger. Say each letter as you write it.": "用手指写在这里。写一个字母说一个字母。", "Clear": "清除", "Done. Now write it in my notebook": "好了。现在写在本子上",
    "Write it with your finger first.": "先用手指写出来。", "Listen. Type the word.": "听。把词打出来。", "Type the word. No peeking.": "把词打出来。不许偷看。", "Look. Then type it again.": "看。再打一次。",
    "Type the missing word.": "打出缺少的词。", "Not that one. Which piece comes next?": "不是这个。下一块是哪个？", "Saved!": "保存了！", "Not yet. It comes back tomorrow.": "还没对。明天再来。",
    "Look again and retype": "再看一次，重新打", "Close! The red letters are different:": "很接近！红色的字母不一样：",
    // chest
    "Quest chest": "任务宝箱", "Quest done!": "任务完成！", "See you tomorrow.": "明天见。", "Quest open!": "宝箱打开了！",
    "Start the quest": "开始任务", "Continue the quest": "继续任务", "Word of the day": "每日单词", "Tap the card": "点一下卡片",
    "Listen": "听", "Understand more": "了解更多", "Next word": "下一个单词", "Done, open the quest": "看完了，打开任务",
    "Not that one. Try again.": "不是这个，再试试。", "Next game": "下一个游戏", "Right!": "对了！", "Back to the card": "回到卡片",
    "game 1": "游戏1", "game 2": "游戏2",
    // hut
    "My hut": "我的小屋", "📖 Dictionary": "📖 词典", "✉️ Mailbox": "✉️ 信箱", "No words yet. Open the quest chest.": "还没有单词。打开任务宝箱。",
    "due today": "今天复习", "Note": "笔记", "Example": "例句",
    // build
    "My house": "我的房子", "Go to the quest chest": "去任务宝箱",
    // quest
    "Pause": "暂停", "End": "结束", "End now? You lose today's bricks": "现在结束？今天的砖就没有了", "new word": "新单词", "memory check": "记忆检查",
    "look at the chunks": "看一看音节块", "write it by hand": "用手写出来", "listen and spell": "听写", "type it from memory": "凭记忆打出来",
    "fill the gap": "填空", "pop the bubbles in order": "按顺序戳泡泡", "chat": "聊天", "your note": "你的笔记",
    "Say each chunk out loud.": "把每一块大声读出来。", "Got it, cover it": "记住了，盖起来", "Write it in your notebook. No peeking!": "写在你的本子上。不许偷看！",
    "I wrote it": "我写好了", "Look, then type it again.": "看一看，再打一次。", "Listen, then spell it from memory.": "听一听，然后凭记忆拼出来。",
    "Type it from memory.": "凭记忆打出来。", "Check": "检查", "Which word goes in the gap? Spell it.": "空格里是哪个单词？拼出来。",
    "Not that one. Which chunk comes next?": "不是这个。下一块是哪个？", "Pick the best reply.": "选出最合适的回复。",
    "Hmm, that reply doesn't fit. Try another.": "嗯，这个回复不合适。换一个。", "Now type the missing word.": "现在打出缺少的单词。",
    "Save": "保存", "Skip for now": "先跳过", "Saved! Your note will test you later.": "保存了！以后会用你的笔记来考你。", "Next": "下一个",
    "Back to the start. It comes back tomorrow.": "回到起点。明天再来一次。",
    "Yes! Remember that feeling.": "对了！记住这种感觉。", "So close! See what is different:": "很接近了！看看哪里不一样：",
    "Look at the chunks and try again": "看看音节块，再试一次", "Not yet.": "还不对。", "Not yet. Look at the chunks.": "还不对。看看音节块。",
    "Try again": "再试一次", "Great!": "太好了！", "Got there!": "终于对了！",
    "No new words today. Yesterday's words first.": "今天没有新单词。先把昨天的记牢。", "No new words today. Too many checks due.": "今天没有新单词。要复习的太多了。",
    "How focused were you today?": "你今天有多专注？", "1 = hard to focus, 5 = super focused.": "1 = 很难专注，5 = 超级专注。", "Back to my world": "回到我的世界",
    // banners
    "Could not load your words. Check the internet and reload.": "加载单词失败。检查网络后重新加载。", "Could not check in. Check the internet and reload.": "签到失败。检查网络后重新加载。",
    "This device can't play sound. Read the word out loud.": "这台设备不能播放声音。把单词大声读出来。",
    "diamonds": "钻石", "50 levels": "50 关", "Word World": "单词世界", "🏠 Build &amp; shop": "🏠 建造和商店", "🏠 Build & shop": "🏠 建造和商店", "My place": "我的地方",
    "🧱 Build": "🧱 建造", "things": "物品", "🏪 Shop": "🏪 商店", "🏪 Go to the shop": "🏪 去商店", "Back to the map": "回到地图", "Brick": "砖", "any colour": "任何颜色",
    "Door": "门", "Window": "窗", "Flower": "花", "Tree": "树", "Torch": "火把", "Flag": "旗", "Finish a level to earn diamonds. Level tests give extra.": "完成一关就得到钻石。关卡测试给更多。",
    "Pick a brick or a thing, then tap a square. Tap it again to take it back.": "选一块砖或一个物品，再点一个格子。再点一下拿回来。",
    "Soon": "快了", "Test!": "测试！", "zone test": "区域测试", "Practice again": "再练一次", "(no diamonds)": "（没有钻石）", "Practice done!": "练习完成！",
    "Practice earns no diamonds, but it makes tomorrow easier.": "练习没有钻石，但明天会更容易。", "Stop practising?": "停止练习？", "End now? No diamonds then": "现在结束？那就没有钻石了",
    "Level ended. No diamonds. Tap the level to try again.": "这一关结束了。没有钻石。点关卡再试一次。", "All 50 levels done. You are a legend!": "50 关全部完成。你是传奇！",
    "Opens tomorrow. One level a day!": "明天开放。一天一关！", "No words on this level yet.": "这一关还没有单词。", "All levels done!": "所有关卡都完成了！",
    "Listen. Type the word you hear.": "听。把你听到的单词打出来。", "Type the word from memory.": "凭记忆把单词打出来。", "Look at it. Then type it again.": "看一看。然后再打一次。",
    "Write it here with your finger. Say each letter as you write it.": "用手指在这里写。写一个字母说一个字母。", "type here": "在这里打字",
    "Listen to yourself:": "听听你自己：", "✓ Keep it": "✓ 保留", "Again": "再来", "Saved ✓": "已保存 ✓", "Tap again to try.": "再点一下试试。",
    "I did not hear you. Try again, a bit louder.": "我没听到你。再试一次，大声一点。", "I did not hear anything. Try again, a bit louder.": "我什么都没听到。再试一次，大声一点。",
    "Sunny Island": "阳光岛", "Jungle": "丛林", "Under the Sea": "海底", "Ice Cave": "冰洞", "Sky Castle": "天空城堡",
  };
  Object.assign(X, PRAISE);
  const R = [
    [/^Hi (.+)!$/, "你好，$1！"],
    [/^Walking to (.+)…$/, (m) => "正在走向" + ({ "the map table": "地图桌", "my place": "我的地方", "my hut": "我的小屋", "the mailbox": "信箱", "the watchtower": "瞭望塔" }[m[1]] || m[1]) + "…"],
    [/^📅 Day (\d+) in your world\. This week: (\d+) of 5\.$/, "📅 你在这个世界的第 $1 天。本周：$2 / 5。"], [/^Level (\d+) opens tomorrow\. Two levels a day!$/, "第 $1 关明天开放。一天最多两关！"], [/^Level (\d+) is open if you want one more today\.$/, "如果今天还想再玩一关，第 $1 关已经开放。"],
    [/^Next: (Memory checks|New words|Zone test) \((\d+)\)$/, (m) => "下一部分：" + ({ "Memory checks": "旧单词", "New words": "新单词", "Zone test": "小岛测验" })[m[1]] + "（" + m[2] + "）"],
    [/^(\d+)-day streak!$/, "连续 $1 天！"],
    [/^You came back (\d+) days in a row\. Come back tomorrow to keep it\.$/, "你已经连续来了 $1 天。明天再来，保持下去！"],
    [/^New mail from (.+)!$/, "$1 的新信！"], [/^Mail from (.+)!$/, "$1 的信！"], [/^Magic word (\d+)$/, "魔法单词 $1"], [/^(\d+) letters$/, "$1 个字母"],
    [/^Empty today\. Ask (.+) for new words\.$/, "今天没有单词。向 $1 要新单词吧。"],
    [/^(\d+) words? inside\. Each one you get right is a brick for your house\.$/, "里面有 $1 个单词。每答对一个就得到一块砖。"],
    [/^(\d+) of (\d+)$/, "$1 / $2"],
    [/^Which one means (.+)\?$/, "哪一个是 $1 的意思？"],
    [/^Which sentence uses (.+) the right way\?$/, "哪个句子正确地用了 $1？"],
    [/^No messages yet\. Say hi to (.+)!$/, "还没有信。跟 $1 打个招呼吧！"],
    [/^(.+) reads this and writes back\.$/, "$1 会读到并回信。"],
    [/^back in (\d+) days?$/, "$1 天后"],
    [/^level (\d+)$/, "等级 $1"],
    [/^cottage (\d+)$/, "小屋 $1"], [/^tower (\d+)$/, "高塔 $1"],
    [/^(\d+) of (\d+) bricks\. Every word you get right in the quest is a brick\. Finish the quest to collect them, plus 2 more\.$/, "已建 $1 / $2 块砖。任务里每答对一个单词就得一块砖，完成任务就能拿到，再加2块。"],
    [/^Word (\d+) of (\d+)$/, "第 $1 个单词，共 $2 个"],
    [/^Tap the chunks in the right order to build (.+)\.$/, "按正确顺序点音节块，拼出 $1。"],
    [/^Your note with (.+)\. Picture it first\.$/, "用 $1 写一句你的笔记。先在脑中想象画面。"],
    [/^Use the word "(.+)" in your note\.$/, "笔记里要用上 “$1”。"],
    [/^Day (\d+) quest$/, "第 $1 天任务"], [/^Day (\d+)$/, "第 $1 天"], [/^weeks 1 to (\d+)$/, "第1到$1周"],
    [/^Day (\d+) is open\. (\d+) new words?\.$/, "第 $1 天开放了。$2 个新单词。"], [/^Day (\d+) is open\. (\d+) new words? and (\d+) memory checks\.$/, "第 $1 天开放了。$2 个新单词和 $3 个记忆检查。"],
    [/^Locked\. Finish day (\d+) first\.$/, "锁住了。先完成第 $1 天。"], [/^Locked\. Opens on (.+)\.$/, "锁住了。$1 开放。"],
    [/^All caught up! Day (\d+) opens on (.+)\.$/, "都完成了！第 $1 天 $2 开放。"], [/^Day (\d+) is done: (.+)\. (\d+) bricks\.$/, "第 $1 天完成了：$2。$3 块砖。"],
    [/^Day (\d+) done! \+(\d+) bricks?$/, "第 $1 天完成！+$2 块砖"], [/^Day (\d+) is open now\. Keep going or come back later\.$/, "第 $1 天现在开放了。继续，或者等一下再来。"],
    [/^Day (\d+) opens on (.+)\.$/, "第 $1 天 $2 开放。"], [/^(\d+) bricks? left$/, "还剩 $1 块砖"],
    [/^(All correct!|Tricky words come back tomorrow\.) You have (\d+) bricks to build with\.$/, (m) => (m[1] === "All correct!" ? "全对！" : "难词明天再来。") + "你有 " + m[2] + " 块砖可以建造。"],
    [/^(\d+) days in a row!$/, "连续 $1 天！"], [/^Day 1!$/, "第1天！"], [/^Tap the microphone\. Say (.+)\.$/, "点麦克风。说 $1。"],
    [/^Say each piece and clap once\. I am listening for (\d+) claps\.$/, "说一块，拍一下手。我在听 $1 下拍手。"],
    [/^Pop the pieces in order to make (.+)\.$/, "按顺序戳泡泡，拼出 $1。"], [/^Write one sentence with (.+)\.$/, "用 $1 写一句话。"],
    [/^(\d+) sounds\. Yes!$/, "$1 个声音。对！"], [/^I said it \((\d)\/3\)$/, "我说了（$1/3）"], [/^I heard (.+)!\s*$/, "我听到 $1 了！"],
    [/^(.+?) \+1 brick$/, (m) => (PRAISE[m[1]] || m[1]) + " +1 块砖"],
    [/^Level (\d+)\. Next check in (\d+) days?\.$/, "等级 $1。$2 天后再检查。"],
    [/^Quest done! \+(\d+) bricks?$/, "任务完成！+$1 块砖"],
    [/^From memory on the first try: (\d+) \/ (\d+)$/, "第一次就凭记忆答对：$1 / $2"],
    [/^All correct! Your house: (\d+) of (\d+) bricks\.$/, "全对！你的房子：$1 / $2 块砖。"],
    [/^Tricky words come back tomorrow\. Your house: (\d+) of (\d+) bricks\.$/, "难词明天再来。你的房子：$1 / $2 块砖。"],
    [/^Level (\d+)$/, "第 $1 关"], [/^Practice$/, "练习"], [/^level (\d+)$/, "第 $1 关"], [/^(\d+) levels$/, "$1 关"],
    [/^Zone (\d+) · (.+)$/, (m) => "第 " + m[1] + " 区 · " + (ZONEN[m[2]] || m[2])], [/^Levels (\d+) to (\d+)(?: · (.+))?$/, (m) => "第 " + m[1] + " 到 " + m[2] + " 关" + (m[3] ? " · " + m[3] : "")],
    [/^Level (\d+) is open\. (?:Zone test: )?(\d+) new words?\.$/, "第 $1 关开放了。$2 个新单词。"], [/^Level (\d+) is open\. (?:Zone test: )?(\d+) new words? and (\d+) memory checks\.$/, "第 $1 关开放了。$2 个新单词和 $3 个记忆检查。"],
    [/^Locked\. Finish level (\d+) first\.$/, "锁住了。先完成第 $1 关。"], [/^Level (\d+) opens tomorrow\. One level a day!$/, "第 $1 关明天开放。一天一关！"], [/^Level (\d+) opens tomorrow\.$/, "第 $1 关明天开放。"],
    [/^Level (\d+) has no words yet\. (.+) is adding them\.$/, "第 $1 关还没有单词。$2 正在添加。"],
    [/^Level (\d+) done: (.+)\. \+(\d+) 💎$/, "第 $1 关完成了：$2。+$3 💎"], [/^Level (\d+) done! \+(\d+) 💎$/, "第 $1 关完成！+$2 💎"],
    [/^(All correct!|Tricky words come back tomorrow\.) You have 💎 (\d+) to spend in the shop\.$/, (m) => (m[1] === "All correct!" ? "全对！" : "难词明天再来。") + "你有 💎 " + m[2] + " 可以在商店用。"],
    [/^(.+?) \+1 💎$/, (m) => (PRAISE[m[1]] || m[1]) + " +1 💎"], [/^Memory level (\d+)\. Next check in (\d+) days?\.$/, "记忆等级 $1。$2 天后再检查。"],
    [/^(.+) is complete! Next: (.+)$/, (m) => { const z = s => { s = s.replace(/\.$/, "").trim(); return ZONEN[s] || s; }; return z(m[1]) + "完成了！下一站：" + z(m[2]) + "。"; }],
    [/^You have 💎 (\d+)$/, "你有 💎 $1"], [/^(?:any colour · )?you have (\d+)$/, "你有 $1 个"], [/^No (.+) left\. Buy some in the shop!$/, "没有$1了。去商店买！"],
    [/^I heard "(.*)"\. Listen, then try again\.$/, "我听到 “$1”。听一听，再试一次。"], [/^I heard "(.*)"\. Listen once more, then we move on\.$/, "我听到 “$1”。再听一次，然后继续。"],
    [/^No internet\? (.*)$/, "没有网络？刚才的内容没有保存。"]
  ];
  function lookup(en) {
    if (!en) return "";
    if (X[en]) return X[en];
    for (const [re, out] of R) { const m = en.match(re); if (m) return typeof out === "function" ? out(m) : out.replace(/\$(\d)/g, (_, i) => m[+i]); }
    return "";
  }
  // The English key of an element: its text without nested blocks, tags and our own Chinese line.
  let SEL = ".do, .pg-title, .eyebrow, .hint, .fb, .fb > span, .kind, .part, .klabel, .saytext, .cap, .cm-tag-eyebrow, .cm-tag-line, .cm-label b, .cm-label span, .zhk, " + "h2, h2 small, p, button:not(.stone), .stone span, label, .stat .lbl, .tag, .mine > span, .when, .worldhint, .banner, .feedback, .done-msg, #bricksLeft, .ztext b, .ztext small, .plabel, .gtext b, .gtext small, .shophead, .earbox p";
  let SKIP = ".nozh, .beat, .word, .line, " + ".bubble, .opts button, .zhbtn, .zhx, .mailcard.letter .body, .letter, .arrow, .swatch, .cell, .clap, .piece, .ear, .menu summary, .menulist a, .menulist button, .rule, .msg, .chat, .zhline, .zh, .compare, .word-big, .word-mid, .gapbox";
  function keyOf(el) {
    const c = el.cloneNode(true);
    c.querySelectorAll(".zhx, div, form, button, .tag, small, br, .badge, .compare, span.lbl, .zh").forEach(n => n.remove());
    return c.textContent.replace(/\s+/g, " ").trim();
  }
  let on = false, scheduled = false;
  function apply(root) {
    if (!root || !on) return;   // switched off: nothing is added (a refresh queued just before the switch must not bring the lines back)
    root.querySelectorAll(SEL).forEach(el => {
      if (el.matches(SKIP) || el.closest(".zhx, .chat, .opts, .compare")) return;
      const old = el.querySelector(":scope > .zhx"), en = keyOf(el);
      if (old && old.dataset.for === en) return;
      if (old) old.remove();
      const zh = lookup(en); if (!zh) return;
      const s = document.createElement("span"); s.className = "zhx"; s.dataset.for = en; s.textContent = zh; el.appendChild(s);
    });
  }
  function clear() { document.querySelectorAll(".zhx").forEach(n => n.remove()); }
  function set(v, root) {
    on = !!v; try { localStorage.setItem("wt.zh", on ? "1" : "0"); } catch (e) {}
    document.documentElement.classList.toggle("zh-on", on);
    on ? apply(root || document.body) : clear();
    if (!on) setTimeout(() => { if (!on) clear(); }, 60);   // and once more, for a line that was being drawn at that moment
    try { document.dispatchEvent(new CustomEvent("ww-zh", { detail: { on } })); } catch (e) {}   // Orbit's bubble follows the switch at once
  }
  function init(root) {
    let saved = false; try { saved = localStorage.getItem("wt.zh") === "1"; } catch (e) {}
    new MutationObserver(() => { if (!on || scheduled) return; scheduled = true; setTimeout(() => { scheduled = false; if (on) apply(root || document.body); }, 0); })
      .observe(root || document.body, { childList: true, subtree: true, characterData: true });
    set(saved, root);
  }
  // A part of the game adds its own lines: add({ "English text": "中文" }, [[/^Level (\d+)$/, "第 $1 关"]]). sel(".myclass") makes
  // elements of that class get a Chinese line; skip(".myclass") keeps them without one.
  function add(dict, rules) { Object.assign(X, dict || {}); (rules || []).forEach(r => R.push(r)); if (on) apply(document.body); }
  window.WT_ZH = { init, set, apply, lookup, add, sel: x => { SEL += ", " + x; }, skip: x => { SKIP += ", " + x; }, isOn: () => on };
})();
