export const APP_VERSION = "5.1.4";

export const STAGES = [
  stage("s1", "0—1.5岁", "安全依恋建立期", "看护月龄卡", "daily", "今天怎么陪", "一起度过啦"),
  stage("s2", "1.5—3岁", "自主意识萌芽期", "一起玩卡", "daily", "今天怎么陪", "一起玩过啦"),
  stage("s3", "3—6岁", "性格社交奠基期", "一起玩卡", "daily", "今天怎么陪", "一起玩过啦"),
  stage("s4", "7—12岁", "学习习惯与内驱力期", "我们卡", "daily", "今天怎么陪", "聊过啦"),
  stage("s5", "12—15岁", "青春期破冰期", "聊天卡", "once-per-cycle", "这一轮聊什么", "这一轮聊过啦"),
  stage("s6", "15—18岁", "独立责任确立期", "话题卡", "once-per-cycle", "这一轮聊什么", "这一轮聊过啦"),
];

export function hasStageAccess(value, stageId) {
  return value?.status === "active" && (value?.scope === "all" || value?.stageId === stageId);
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

export function formatShortDate(dateString) {
  const [, month, day] = dateString.split("-");
  return `${Number(month)}月${Number(day)}日`;
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

function stage(id, label, title, cardName, frequency, homeTitle, recordLabel) {
  return { id, label, title, cardName, frequency, homeTitle, recordLabel };
}

function pad(value) {
  return String(value).padStart(2, "0");
}
