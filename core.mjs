export const APP_VERSION = 5;

export const STAGES = [
  stage("s1", "0—1.5岁", "安全依恋建立期", "看护月龄卡", "daily", "今天怎么陪", "一起度过啦"),
  stage("s2", "1.5—3岁", "自主意识萌芽期", "一起玩卡", "daily", "今天怎么陪", "一起玩过啦"),
  stage("s3", "3—6岁", "性格社交奠基期", "一起玩卡", "daily", "今天怎么陪", "一起玩过啦"),
  stage("s4", "7—12岁", "学习习惯与内驱力期", "我们卡", "daily", "今天怎么陪", "聊过啦"),
  stage("s5", "12—15岁", "青春期破冰期", "聊天卡", "weekly", "这周聊什么", "这周聊过啦"),
  stage("s6", "15—18岁", "独立责任确立期", "话题卡", "weekly", "这周聊什么", "这周一起过啦"),
];

export const DEMO_CODES = {
  "BB-S1-0001": entitlement("stage", "s1", "0—1.5岁当前阶段陪伴卡"),
  "BB-S2-0001": entitlement("stage", "s2", "1.5—3岁当前阶段陪伴卡"),
  "BB-S3-0001": entitlement("stage", "s3", "3—6岁当前阶段陪伴卡"),
  "BB-S4-0001": entitlement("stage", "s4", "7—12岁当前阶段陪伴卡"),
  "BB-S5-0001": entitlement("stage", "s5", "12—15岁当前阶段陪伴卡"),
  "BB-S6-0001": entitlement("stage", "s6", "15—18岁当前阶段陪伴卡"),
  "BB-ALL-0001": entitlement("all", "all", "0—18岁全龄陪伴卡"),
};

export const WISHES = {
  s1: ["拍一张今天的合照", "一起晒十分钟太阳", "给孩子读一本小书"],
  s2: ["一起搭一座小房子", "去楼下慢慢散步", "选一本睡前故事"],
  s3: ["一起做顿简单早餐", "去公园找三种叶子", "选一部全家看的动画"],
  s4: ["一起玩三十分钟桌游", "去户外走一圈", "让孩子决定一次家庭菜单", "一起做一件小手工", "看一部全家电影"],
  s5: ["一起吃顿不聊成绩的饭", "让孩子选一次周末活动", "一起听一首孩子喜欢的歌", "散步时只听不评价"],
  s6: ["一起吃顿轻松的饭", "按孩子的安排做一次家庭活动", "聊聊成年后想保留的家庭习惯"],
};

export function validateCode(value) {
  const code = String(value || "").trim().toUpperCase();
  if (code === "BB-USED-0001") return { ok: false, error: "used", message: "这个开通码已经使用过，请用找回凭证恢复或联系原订单卖家。" };
  const match = DEMO_CODES[code];
  return match
    ? { ok: true, entitlement: { ...match, recoveryCode: code } }
    : { ok: false, error: "invalid", message: "没有找到这个开通码，请检查字母、数字和横线。" };
}

export function hasStageAccess(value, stageId) {
  return value?.scope === "all" || value?.stageId === stageId;
}

export function childLimit(value) {
  return value?.scope === "all" ? 3 : 1;
}

export function getAgeInfo(birthDate, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(birthDate || ""))) return { valid: false, reason: "请填写正确的出生日期" };
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  if (birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > daysInMonth(birthYear, birthMonth)) {
    return { valid: false, reason: "请填写真实存在的出生日期" };
  }
  const today = dateKeyInShanghai(now);
  if (birthDate > today) return { valid: false, reason: "出生日期不能晚于今天" };
  const boundaries = [
    [addCalendarMonths(birthDate, 18), STAGES[0]],
    [addCalendarYears(birthDate, 3), STAGES[1]],
    [addCalendarYears(birthDate, 7), STAGES[2]],
    [addCalendarYears(birthDate, 12), STAGES[3]],
    [addCalendarYears(birthDate, 15), STAGES[4]],
    [addCalendarYears(birthDate, 18), STAGES[5]],
  ];
  const currentStage = boundaries.find(([boundary]) => today < boundary)?.[1] || null;
  return {
    valid: true,
    stage: currentStage,
    graduated: !currentStage,
    display: formatAge(birthDate, today),
    today,
    nextBoundary: boundaries.find(([, candidate]) => candidate === currentStage)?.[0] || null,
  };
}

export function addCalendarMonths(dateString, months) {
  const [year, month, day] = dateString.split("-").map(Number);
  const zeroBased = month - 1 + months;
  const targetYear = year + Math.floor(zeroBased / 12);
  const targetMonth = ((zeroBased % 12) + 12) % 12;
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth + 1));
  return `${targetYear}-${pad(targetMonth + 1)}-${pad(clampedDay)}`;
}

export function addCalendarYears(dateString, years) {
  return addCalendarMonths(dateString, years * 12);
}

export function dateKeyInShanghai(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function weekKey(date = new Date()) {
  const key = typeof date === "string" ? date : dateKeyInShanghai(date);
  const [year, month, day] = key.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  const weekday = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - weekday + 1);
  return value.toISOString().slice(0, 10);
}

export function formatShortDate(dateString) {
  const [, month, day] = dateString.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

export function selectCards(cards, child, records, now = new Date()) {
  const info = getAgeInfo(child.birthDate, now);
  if (!info.stage) return { main: null, alternatives: [], stage: null };
  const pool = cards.filter((card) => card.stageId === info.stage.id);
  const cycleKey = info.stage.frequency === "weekly" ? weekKey(now) : info.today;
  const previousIds = new Set(records.filter((record) => record.childId === child.id).slice(-4).map((record) => record.cardId));
  const offset = stableHash(`${child.id}:${cycleKey}:${info.stage.id}`) % Math.max(pool.length, 1);
  const ordered = [...pool.slice(offset), ...pool.slice(0, offset)];
  const fresh = ordered.filter((card) => !previousIds.has(card.id));
  const choices = [...fresh, ...ordered.filter((card) => previousIds.has(card.id))].slice(0, 3);
  return { main: choices[0] || null, alternatives: choices.slice(1), stage: info.stage };
}

export function recordKey(childId, date = new Date()) {
  return `${childId}:${dateKeyInShanghai(date)}`;
}

export function wishKey(childId, date = new Date()) {
  return `${childId}:${weekKey(date)}`;
}

export function seasonalStamp(childId, date = dateKeyInShanghai()) {
  const key = typeof date === "string" ? date : dateKeyInShanghai(date);
  const month = Number(key.slice(5, 7));
  const season = month <= 2 || month === 12 ? ["❄️", "🧣", "☕"] : month <= 5 ? ["🌱", "🌼", "🌤️"] : month <= 8 ? ["🌊", "🍉", "☀️"] : ["🍂", "🌰", "🌙"];
  return season[stableHash(`${childId}:${key}`) % season.length];
}

function formatAge(birthDate, today) {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let months = (ty - by) * 12 + tm - bm;
  if (td < Math.min(bd, daysInMonth(ty, tm))) months -= 1;
  months = Math.max(0, months);
  if (months < 24) return `${months}个月`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years}岁${rest}个月` : `${years}岁`;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function stableHash(value) {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return Math.abs(hash >>> 0);
}

function stage(id, label, title, cardName, frequency, homeTitle, recordLabel) {
  return { id, label, title, cardName, frequency, homeTitle, recordLabel };
}

function entitlement(scope, stageId, label) {
  return { scope, stageId, label, status: "active" };
}

function pad(value) {
  return String(value).padStart(2, "0");
}
