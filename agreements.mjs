export const PET_STAGES = [
  { level: 1, min: 0, name: "步步来到家里", note: "它正在认识你们的新家庭", badge: "👋" },
  { level: 2, min: 6, name: "会用鼻子打招呼", note: "步步开始回应你们啦", badge: "🎵" },
  { level: 3, min: 18, name: "会喷出小水花", note: "每次共同尝试，都变成一滴水花", badge: "💦" },
  { level: 4, min: 36, name: "背上了探险包", note: "步步准备陪你们探索更多办法", badge: "🎒" },
  { level: 5, min: 60, name: "住进成长小屋", note: "这里装着你们一起走过的故事", badge: "🏠" },
];

export const FAMILY_WISHES = [
  { id: "movie", title: "一起选一部全家电影", cost: 9, icon: "🎬" },
  { id: "meal", title: "让孩子决定一次家庭菜单", cost: 9, icon: "🍲" },
  { id: "park", title: "一起去公园慢慢玩", cost: 12, icon: "🌳" },
  { id: "game", title: "安排一次家庭游戏时间", cost: 12, icon: "🎲" },
  { id: "outing", title: "一起安排一次小出游", cost: 18, icon: "🚌" },
  { id: "custom", title: "我们自己商量一个心愿", cost: 12, icon: "✨" },
];

export const AGREEMENT_PRESETS = {
  s1: [
    preset("s1-sleep", "睡前总是很难安稳", "宝宝出现困倦信号时，让大人看见", "我固定一句睡前话，减少来回换方法", "睡眠与安抚"),
    preset("s1-cry", "一哭我就容易慌", "宝宝用哭声告诉我现在需要帮助", "我先停三秒观察，再用同一个顺序回应", "哭闹回应"),
    preset("s1-play", "不知道清醒时怎么陪", "宝宝看向或回应眼前的人和物", "我每天留五分钟，跟着宝宝的反应说话", "回应性陪伴"),
  ],
  s2: [
    preset("s2-transition", "结束玩耍时总闹", "听到提醒后，和大人一起收第一样东西", "我提前说一次，不连续催", "活动切换"),
    preset("s2-tantrum", "一不顺心就发脾气", "不舒服时试着用动作或词告诉我", "我先说出感受，平静后再讲规则", "情绪表达"),
    preset("s2-clean", "玩具总是不肯收", "把自己选的三样玩具送回盒子", "我陪着收前三样，不站着发指令", "生活规则"),
  ],
  s3: [
    preset("s3-morning", "早上出门总磨蹭", "起床后自己完成第一件准备动作", "我只提醒一次，并给两个可接受的选择", "早晨准备"),
    preset("s3-emotion", "一不高兴就大哭", "难受时先告诉我像哪种天气", "我先听感受，不马上讲道理", "情绪表达"),
    preset("s3-social", "不敢加入小朋友游戏", "想加入时试着说一句准备好的话", "我先在家陪演一遍，不现场催促", "同伴交往"),
    preset("s3-bed", "睡前一直拖延", "睡前自己选择故事并上床", "我固定顺序，时间到不临时增加要求", "睡前习惯"),
  ],
  s4: [
    preset("s4-homework", "写作业总要一直催", "到约定时间先坐下来做10分钟", "这10分钟我不催、不批评、不翻旧账", "作业启动"),
    preset("s4-phone", "手机总是放不下来", "到约定时间把手机放到共同位置10分钟", "我也放下手机，并先听孩子讲在看什么", "手机边界"),
    preset("s4-morning", "早上准备总是拖", "自己看清单完成第一项", "我只确认第一步，不连续提醒整套流程", "生活习惯"),
    preset("s4-talk", "孩子什么都不愿意说", "每天挑一件愿意说的小事", "我听完先不评价，也不追问成绩", "亲子沟通"),
  ],
  s5: [
    preset("s5-phone", "手机问题一说就吵", "愿意介绍一个最近喜欢的内容", "我先听三分钟，不趁机谈限制", "手机沟通"),
    preset("s5-study", "成绩变化后不愿聊", "愿意说出最近最费劲的一件事", "我先问需要倾听还是一起想办法", "学习压力"),
    preset("s5-door", "回家就关门不沟通", "方便时告诉我一个可以聊的时间", "我进房前先敲门，被拒绝后不追着问", "隐私边界"),
    preset("s5-mood", "情绪很大又不让问", "需要空间时用一句话或手势告诉我", "我尊重暂停，并按说好的时间再来", "情绪边界"),
  ],
  s6: [
    preset("s6-pressure", "备考期家里只剩成绩", "每周选一个不聊考试的话题", "我留一顿饭不问结果和计划", "备考关系"),
    preset("s6-future", "谈未来总变成说教", "说一个最近好奇的方向", "我只问一个问题，不要求当场做决定", "生涯探索"),
    preset("s6-duty", "生活责任总要家长收尾", "选择一件愿意自己负责到底的事", "我说清边界后，不提前替孩子收尾", "独立责任"),
    preset("s6-talk", "重要事情不愿告诉家长", "愿意说出需要哪种支持", "我先提供选择，不替孩子决定", "成年前沟通"),
  ],
};

export function presetsForStage(stageId) {
  return AGREEMENT_PRESETS[stageId] || AGREEMENT_PRESETS.s4;
}

export function petStage(totalEarned) {
  return [...PET_STAGES].reverse().find((stage) => totalEarned >= stage.min) || PET_STAGES[0];
}

export function petProgress(totalEarned) {
  const current = petStage(totalEarned);
  const next = PET_STAGES.find((stage) => stage.min > totalEarned) || null;
  if (!next) return { current, next: null, value: 100, remaining: 0 };
  const value = Math.round(((totalEarned - current.min) / (next.min - current.min)) * 100);
  return { current, next, value, remaining: next.min - totalEarned };
}

export function wallet(checkins, redemptions = []) {
  const entries = Object.values(checkins || {});
  const totalEarned = entries.reduce((sum, item) => sum + Number(Boolean(item.child)) + Number(Boolean(item.parent)) + Number(Boolean(item.child && item.parent)), 0);
  const spent = redemptions.reduce((sum, item) => sum + Number(item.cost || 0), 0);
  return { totalEarned, spent, available: Math.max(0, totalEarned - spent) };
}

export function checkinReward(value) {
  return Number(Boolean(value?.child)) + Number(Boolean(value?.parent)) + Number(Boolean(value?.child && value?.parent));
}

function preset(id, problem, childAction, parentAction, category) {
  const stageId = id.slice(0, 2);
  return {
    id,
    stageId,
    category,
    problem,
    childAction,
    parentAction,
    recommendedDuration: 7,
    recordMode: ["s5", "s6"].includes(stageId) ? "once-per-cycle" : "daily",
    imaQuery: problem,
    riskTags: [],
    templateVersion: 1,
    reviewStatus: "reviewed",
  };
}
