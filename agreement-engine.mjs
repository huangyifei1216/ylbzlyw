export const RECORD_MODES = Object.freeze(["daily", "once-per-cycle"]);
export const IN_PROGRESS_STATUSES = Object.freeze(["active", "review-due"]);
export const AGREEMENT_STATUSES = Object.freeze([...IN_PROGRESS_STATUSES, "reviewed", "paused", "archived"]);
export const REVIEW_OUTCOMES = Object.freeze(["continue", "adjust", "change", "pause"]);

export class DomainRuleError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DomainRuleError";
    this.code = code;
  }
}

export function isEntitledForStage(entitlement, stageId) {
  if (entitlement?.status !== "active") return false;
  return entitlement.scope === "all"
    || (entitlement.scope === "stage" && entitlement.stageId === stageId);
}

export function periodKeyFor(agreement, localDate) {
  assertAgreementPeriod(agreement);
  assertLocalDate(localDate, "localDate");
  if (localDate < agreement.startDate || localDate > agreement.endDate) {
    throw new DomainRuleError("outside-cycle", "这个日期不在当前约定周期内。");
  }
  return agreement.recordMode === "daily"
    ? localDate
    : `cycle:${agreement.id}`;
}

export function createAgreement(agreements, draft, context = {}) {
  const current = asArray(agreements);
  const input = draft && typeof draft === "object" ? draft : {};
  const childId = requiredText(input.childId, "childId", "缺少孩子信息。");
  if (current.some((item) => item.childId === childId && IN_PROGRESS_STATUSES.includes(item.status))) {
    throw new DomainRuleError("agreement-in-progress", "请先回顾或归档当前约定，再开始新一轮。");
  }
  if (context.isAdult) {
    throw new DomainRuleError("adult-new-agreement", "孩子已满18岁，过去的约定仍可查看，但不再默认建立新的分龄约定。");
  }

  const stageId = requiredText(context.currentStageId || input.stageId, "stageId", "无法确认当前年龄阶段。");
  if (!isEntitledForStage(context.entitlement, stageId)) {
    throw new DomainRuleError("stage-not-entitled", "当前权益不能在这个年龄阶段建立新约定。");
  }
  const duration = Number(input.duration);
  if (duration !== 3 && duration !== 7) {
    throw new DomainRuleError("invalid-duration", "约定周期只能选择3天或7天。");
  }
  if (!RECORD_MODES.includes(input.recordMode)) {
    throw new DomainRuleError("invalid-record-mode", "记录方式只能是每天一次或每轮一次。");
  }
  const startDate = input.startDate || localDateFromInstant(context.now || new Date());
  assertLocalDate(startDate, "startDate");
  const endDate = addDays(startDate, duration - 1);
  const createdAt = instantText(input.createdAt || context.now || new Date());
  const id = requiredText(input.id || makeAgreementId(childId, createdAt), "id", "无法建立约定。");
  if (current.some((item) => item.id === id)) {
    throw new DomainRuleError("duplicate-agreement", "这条约定已经存在。");
  }

  const agreement = {
    id,
    childId,
    stageId,
    templateId: requiredText(input.templateId || "custom", "templateId", "缺少约定模板信息。"),
    templateVersion: positiveInteger(input.templateVersion, 1),
    problem: requiredText(input.problem, "problem", "请先写清楚这次要处理的具体问题。"),
    childAction: requiredText(input.childAction, "childAction", "请写清楚孩子这一步。"),
    parentAction: requiredText(input.parentAction, "parentAction", "请写清楚家长这一步。"),
    recordMode: input.recordMode,
    duration,
    startDate,
    endDate,
    wishId: text(input.wishId),
    status: "active",
    review: null,
    createdAt,
  };
  return { agreement, agreements: [...current, agreement] };
}

export function markReviewDue(agreement, localDate) {
  const current = cloneAgreement(agreement);
  assertLocalDate(localDate, "localDate");
  if (current.status !== "active" || localDate <= current.endDate) return current;
  return { ...current, status: "review-due" };
}

export function reviewAgreement(agreement, outcome, { reviewedAt = new Date() } = {}) {
  const current = cloneAgreement(agreement);
  if (!IN_PROGRESS_STATUSES.includes(current.status)) {
    throw new DomainRuleError("not-reviewable", "这条约定现在不能重复回顾。");
  }
  if (!REVIEW_OUTCOMES.includes(outcome)) {
    throw new DomainRuleError("invalid-review", "请选择一个回顾方向。");
  }
  const labels = {
    continue: "有一点变化，再试一轮",
    adjust: "动作有点难，改简单一些",
    change: "这个方向不合适，换个办法",
    pause: "这段时间先放一放",
  };
  return {
    ...current,
    status: outcome === "pause" ? "paused" : "reviewed",
    review: { outcome, outcomeLabel: labels[outcome], reviewedAt: instantText(reviewedAt) },
  };
}

export function pauseAgreement(agreement, { pausedAt = new Date() } = {}) {
  const current = cloneAgreement(agreement);
  if (!IN_PROGRESS_STATUSES.includes(current.status)) {
    throw new DomainRuleError("not-pausable", "这条约定现在不能暂停。");
  }
  return { ...current, status: "paused", review: current.review || { outcome: "pause", reviewedAt: instantText(pausedAt) } };
}

export function archiveAgreement(agreement) {
  const current = cloneAgreement(agreement);
  if (IN_PROGRESS_STATUSES.includes(current.status)) {
    throw new DomainRuleError("review-before-archive", "请先回顾当前约定，再收进历史。");
  }
  return { ...current, status: "archived" };
}

export function canFinishExistingAgreement(agreement) {
  return Boolean(agreement && IN_PROGRESS_STATUSES.includes(agreement.status));
}

function assertAgreementPeriod(agreement) {
  if (!agreement || !RECORD_MODES.includes(agreement.recordMode)) {
    throw new DomainRuleError("invalid-record-mode", "约定缺少有效的记录方式。");
  }
  assertLocalDate(agreement.startDate, "startDate");
  assertLocalDate(agreement.endDate, "endDate");
}

function cloneAgreement(value) {
  if (!value || typeof value !== "object") throw new DomainRuleError("agreement-not-found", "没有找到这条约定。");
  return { ...value, review: value.review ? { ...value.review } : null };
}

function assertLocalDate(value, field) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
    throw new DomainRuleError("invalid-date", `${field} 不是有效日期。`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new DomainRuleError("invalid-date", `${field} 不是有效日期。`);
  }
}

function addDays(localDate, amount) {
  const [year, month, day] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}

function localDateFromInstant(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new DomainRuleError("invalid-date", "无法确定约定开始日期。");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function instantText(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new DomainRuleError("invalid-instant", "时间信息无效。");
  return date.toISOString();
}

function makeAgreementId(childId, createdAt) {
  return `agreement:${childId}:${createdAt.replace(/[^0-9]/g, "")}`;
}

function requiredText(value, field, message) {
  const output = text(value);
  if (!output) throw new DomainRuleError(`missing-${field}`, message);
  return output;
}

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function positiveInteger(value, fallback) { return Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback; }
function asArray(value) { return Array.isArray(value) ? value : []; }
