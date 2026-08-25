const STAGES = new Set(["s1", "s2", "s3", "s4", "s5", "s6"]);
const AGREEMENT_STATUSES = new Set(["active", "review-due", "reviewed", "paused", "archived"]);
const RECORD_MODES = new Set(["daily", "once-per-cycle"]);
const ROLES = new Set(["child", "parent"]);
const WISH_STATUSES = new Set(["active", "scheduled", "completed", "cancelled"]);
const TRANSACTION_TYPES = new Set(["child-step", "parent-step", "companion", "wish-spend", "wish-refund", "record-reversal"]);

export const RUNTIME_REVIEW_REFRESH_NOTE = "active 约定可能在非首页读取时短暂过期；首页运行时负责转成 review-due。";

export class StateInvariantError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "StateInvariantError";
    this.code = code;
  }
}

/** Validate a normalized V2 state without repairing or deleting any data. */
export function assertStateInvariants(state, { today = "", allowRuntimeReviewRefresh = true } = {}) {
  const source = record(state);
  const children = array(source.children);
  const agreements = array(source.agreements);
  const records = Object.values(record(source.records));
  const transactions = array(source.fruitTransactions);
  const wishes = array(source.wishes);

  const childMap = uniqueMap(children, "child", (child) => {
    required(child.nickname, "invalid-child-nickname", "孩子昵称不能为空。");
    localDate(child.birthDate, "invalid-child-birth-date", "孩子生日不是有效日期。");
  });
  if (source.currentChildId && !childMap.has(source.currentChildId)) {
    fail("invalid-current-child", "当前孩子引用不存在。");
  }

  const agreementMap = uniqueMap(agreements, "agreement", (agreement) => {
    reference(childMap, agreement.childId, "agreement-child-not-found", "约定引用的孩子不存在。");
    if (!STAGES.has(agreement.stageId)) fail("invalid-stage", "约定年龄阶段无效。");
    if (!RECORD_MODES.has(agreement.recordMode)) fail("invalid-record-mode", "约定记录方式无效。");
    if (!AGREEMENT_STATUSES.has(agreement.status)) fail("invalid-agreement-status", "约定状态无效。");
    if (![3, 7].includes(agreement.duration)) fail("invalid-duration", "约定周期只能是3天或7天。");
    localDate(agreement.startDate, "invalid-agreement-date", "约定开始日期无效。");
    localDate(agreement.endDate, "invalid-agreement-date", "约定结束日期无效。");
    if (addDays(agreement.startDate, agreement.duration - 1) !== agreement.endDate) {
      fail("agreement-period-mismatch", "约定结束日期与周期不一致。");
    }
    required(agreement.problem, "missing-agreement-problem", "约定问题不能为空。");
    required(agreement.childAction, "missing-child-action", "孩子这一步不能为空。");
    required(agreement.parentAction, "missing-parent-action", "家长这一步不能为空。");
    if (agreement.status === "reviewed") validReview(agreement.review);
    if (agreement.review) validReview(agreement.review);
    if (!allowRuntimeReviewRefresh && today && agreement.status === "active" && today > agreement.endDate) {
      fail("overdue-active-agreement", "已过期约定必须先进入回顾状态。");
    }
  });
  oneInProgressPerChild(agreements, ["active", "review-due"], "agreement-in-progress-conflict", "一个孩子不能同时存在两条进行中约定。");

  const wishMap = uniqueMap(wishes, "wish", (wish) => {
    reference(childMap, wish.childId, "wish-child-not-found", "家庭心愿引用的孩子不存在。");
    required(wish.title, "missing-wish-title", "家庭心愿标题不能为空。");
    if (!Number.isInteger(wish.cost) || wish.cost <= 0) fail("invalid-wish-cost", "家庭心愿象果目标必须是正整数。");
    if (!WISH_STATUSES.has(wish.status)) fail("invalid-wish-status", "家庭心愿状态无效。");
    if (wish.scheduledDate) localDate(wish.scheduledDate, "invalid-wish-date", "家庭心愿安排日期无效。");
    if (wish.status === "completed") instant(wish.completedAt, "invalid-wish-completed-at", "已实现心愿缺少有效完成时间。");
    if (wish.status === "cancelled") instant(wish.cancelledAt, "invalid-wish-cancelled-at", "已放下心愿缺少有效取消时间。");
  });
  oneInProgressPerChild(wishes, ["active", "scheduled"], "wish-in-progress-conflict", "一个孩子不能同时存在两个进行中心愿。");
  for (const agreement of agreements) {
    if (agreement.wishId) reference(wishMap, agreement.wishId, "agreement-wish-not-found", "约定引用的家庭心愿不存在。");
  }

  const recordMap = uniqueMap(records, "record", (item) => {
    const agreement = reference(agreementMap, item.agreementId, "record-agreement-not-found", "双方记录引用的约定不存在。");
    reference(childMap, item.childId, "record-child-not-found", "双方记录引用的孩子不存在。");
    if (agreement.childId !== item.childId) fail("record-child-mismatch", "双方记录与约定不属于同一个孩子。");
    if (!ROLES.has(item.role)) fail("invalid-record-role", "双方记录角色无效。");
    localDate(item.localDate, "invalid-record-date", "双方记录日期无效。");
    if (item.localDate < agreement.startDate || item.localDate > agreement.endDate) fail("record-outside-cycle", "双方记录日期不在约定周期内。");
    const expected = agreement.recordMode === "daily" ? item.localDate : `cycle:${agreement.id}`;
    if (item.periodKey !== expected) fail("record-period-mismatch", "双方记录周期键与约定不一致。");
    const recordedAt = instant(item.recordedAt, "invalid-recorded-at", "双方记录时间无效。");
    if (item.reversedAt) {
      const reversedAt = instant(item.reversedAt, "invalid-reversed-at", "双方记录撤回时间无效。");
      if (reversedAt < recordedAt) fail("reversal-before-record", "撤回时间不能早于记录时间。");
    }
  });
  const liveRecordKeys = new Set();
  for (const item of records.filter((recordItem) => !recordItem.reversedAt)) {
    const key = `${item.agreementId}:${item.role}:${item.periodKey}`;
    if (liveRecordKeys.has(key)) fail("duplicate-live-record", "同一周期存在重复的有效双方记录。");
    liveRecordKeys.add(key);
  }

  const transactionMap = uniqueMap(transactions, "transaction", (item) => {
    reference(childMap, item.childId, "transaction-child-not-found", "象果流水引用的孩子不存在。");
    if (!TRANSACTION_TYPES.has(item.type)) fail("invalid-transaction-type", "象果流水类型无效。");
    if (!Number.isFinite(item.amount) || !Number.isInteger(item.amount) || item.amount === 0) fail("invalid-transaction-amount", "象果流水金额必须是非零整数。");
    instant(item.createdAt, "invalid-transaction-date", "象果流水时间无效。");
    validateTransactionSign(item);
    if (["child-step", "parent-step"].includes(item.type) && !item.recordId) fail("step-record-required", "行动象果必须引用对应双方记录。");
    if (["wish-spend", "wish-refund"].includes(item.type) && !item.wishId) fail("wish-transaction-reference-required", "心愿流水必须引用家庭心愿。");
    if (["child-step", "parent-step", "companion", "record-reversal"].includes(item.type) && !item.agreementId) fail("agreement-transaction-reference-required", "行动流水必须引用家庭约定。");
    if (item.agreementId) {
      const agreement = reference(agreementMap, item.agreementId, "transaction-agreement-not-found", "象果流水引用的约定不存在。");
      if (agreement.childId !== item.childId) fail("transaction-child-mismatch", "象果流水与约定不属于同一个孩子。");
    }
    if (item.recordId) {
      const related = reference(recordMap, item.recordId, "transaction-record-not-found", "象果流水引用的双方记录不存在。");
      if (related.childId !== item.childId) fail("transaction-record-child-mismatch", "象果流水与双方记录不属于同一个孩子。");
      if (item.type === "child-step" && related.role !== "child") fail("step-role-mismatch", "孩子象果引用了错误角色的记录。");
      if (item.type === "parent-step" && related.role !== "parent") fail("step-role-mismatch", "家长象果引用了错误角色的记录。");
    }
    for (const recordId of array(item.relatedRecordIds)) reference(recordMap, recordId, "transaction-record-not-found", "同行象果引用的双方记录不存在。");
    if (item.wishId) {
      const wish = reference(wishMap, item.wishId, "transaction-wish-not-found", "象果流水引用的家庭心愿不存在。");
      if (wish.childId !== item.childId) fail("transaction-wish-child-mismatch", "象果流水与家庭心愿不属于同一个孩子。");
    }
    if (item.type === "companion") validateCompanionReferences(item, records, recordMap);
  });

  const reversedOriginals = new Set();
  for (const item of transactions.filter((candidate) => ["record-reversal", "wish-refund"].includes(candidate.type))) {
    const original = reference(transactionMap, item.reversedTransactionId, "reversal-target-not-found", "撤回或退款引用的原流水不存在。");
    if (reversedOriginals.has(original.id)) fail("duplicate-reversal", "同一笔原流水不能重复撤回或退款。");
    reversedOriginals.add(original.id);
    if (item.type === "record-reversal" && !["child-step", "parent-step", "companion"].includes(original.type)) fail("invalid-record-reversal-target", "记录撤回引用了错误的原流水。");
    if (item.type === "wish-refund") {
      if (original.type !== "wish-spend") fail("invalid-wish-refund-target", "心愿退款引用了错误的原流水。");
      if (item.amount !== Math.abs(original.amount)) fail("wish-refund-mismatch", "心愿退款金额与原支出不一致。");
    }
  }

  for (const wish of wishes) {
    const spends = transactions.filter((item) => item.type === "wish-spend" && item.wishId === wish.id);
    const liveSpends = spends.filter((spend) => !reversedOriginals.has(spend.id));
    if (wish.status === "scheduled" && liveSpends.length !== 1) fail("scheduled-wish-spend-mismatch", "已安排心愿必须对应一笔有效象果支出。");
    if (wish.status === "completed" && transactions.some((item) => item.type === "wish-refund" && item.wishId === wish.id && item.createdAt >= wish.completedAt)) {
      fail("completed-wish-refunded", "已经实现的家庭心愿不能退款。");
    }
  }

  const balances = new Map(children.map((child) => [child.id, 0]));
  for (const item of transactions) balances.set(item.childId, (balances.get(item.childId) || 0) + item.amount);
  for (const balance of balances.values()) if (balance < 0) fail("negative-fruit-balance", "任意孩子的可用象果都不能小于0。");
  return state;
}

function validateCompanionReferences(item, records, recordMap) {
  let ids = array(item.relatedRecordIds);
  if (!ids.length) {
    const periodKey = item.periodKey || legacyCompanionPeriod(item);
    ids = records.filter((candidate) => candidate.agreementId === item.agreementId && candidate.periodKey === periodKey && !candidate.reversedAt).map((candidate) => candidate.id);
  }
  const related = ids.map((id) => reference(recordMap, id, "transaction-record-not-found", "同行象果引用的双方记录不存在。"));
  if (related.length !== 2 || new Set(related.map((recordItem) => recordItem.role)).size !== 2
    || related.some((recordItem) => recordItem.agreementId !== item.agreementId || recordItem.childId !== item.childId || recordItem.periodKey !== related[0].periodKey)) {
    fail("invalid-companion-records", "同行象果必须引用同一周期内孩子和家长的两条有效记录。");
  }
}

function legacyCompanionPeriod(item) {
  const prefix = `fruit:companion:${item.agreementId}:`;
  const suffix = item.id?.startsWith(prefix) ? item.id.slice(prefix.length) : "";
  if (/^\d{4}-\d{2}-\d{2}/.test(suffix)) return suffix.slice(0, 10);
  return suffix;
}

function validateTransactionSign(item) {
  if (["child-step", "parent-step", "companion"].includes(item.type) && item.amount !== 1) fail("invalid-earned-amount", "行动和同行象果必须为+1。");
  if (item.type === "record-reversal" && item.amount !== -1) fail("invalid-reversal-amount", "行动撤回流水必须为-1。");
  if (item.type === "wish-spend" && item.amount >= 0) fail("invalid-spend-sign", "心愿支出必须为负数。");
  if (item.type === "wish-refund" && item.amount <= 0) fail("invalid-refund-sign", "心愿退款必须为正数。");
}

function validReview(review) {
  const item = record(review);
  required(item.outcome, "invalid-review", "已回顾约定缺少回顾结果。");
  required(item.outcomeLabel, "invalid-review", "已回顾约定缺少回顾说明。");
  required(item.outcomeIcon, "invalid-review", "已回顾约定缺少回顾标记。");
  instant(item.reviewedAt, "invalid-reviewed-at", "回顾时间无效。");
}

function uniqueMap(items, kind, validate) {
  const output = new Map();
  for (const item of items) {
    required(item?.id, `missing-${kind}-id`, `${kind} ID 不能为空。`);
    if (output.has(item.id)) fail(`duplicate-${kind}-id`, `${kind} ID 不能重复。`);
    output.set(item.id, item);
    validate(item);
  }
  return output;
}

function oneInProgressPerChild(items, statuses, code, message) {
  const counts = new Map();
  for (const item of items.filter((candidate) => statuses.includes(candidate.status))) {
    counts.set(item.childId, (counts.get(item.childId) || 0) + 1);
    if (counts.get(item.childId) > 1) fail(code, message);
  }
}

function reference(map, id, code, message) { const value = map.get(id); if (!value) fail(code, message); return value; }
function required(value, code, message) { if (typeof value !== "string" || !value.trim()) fail(code, message); }
function localDate(value, code, message) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) fail(code, message);
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) fail(code, message);
  return value;
}
function instant(value, code, message) { const parsed = new Date(value); if (!value || Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) fail(code, message); return parsed.getTime(); }
function addDays(value, days) { const [y, m, d] = value.split("-").map(Number); const date = new Date(Date.UTC(y, m - 1, d + days)); return date.toISOString().slice(0, 10); }
function array(value) { return Array.isArray(value) ? value : []; }
function record(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function fail(code, message) { throw new StateInvariantError(code, message); }
