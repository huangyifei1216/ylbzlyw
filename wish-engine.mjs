import { DomainRuleError } from "./agreement-engine.mjs";
import { appendFruitTransaction, walletFor } from "./fruit-ledger.mjs";
import { isAllowedWishIcon } from "./wish-icons.mjs";

export const WISH_STATUSES = Object.freeze(["active", "scheduled", "completed", "cancelled"]);

export function createWish(wishes, input, { createdAt = new Date() } = {}) {
  const current = cloneWishes(wishes);
  const childId = requiredText(input?.childId, "请选择孩子后再建立家庭心愿。");
  if (current.some((item) => item.childId === childId && ["active", "scheduled"].includes(item.status))) {
    throw new DomainRuleError("wish-in-progress", "每个孩子同时只能保留一个正在累积或已经安排的家庭心愿。");
  }
  const title = requiredText(input?.title, "请写下家庭心愿。");
  if ([...title].length < 2 || [...title].length > 30) {
    throw new DomainRuleError("invalid-wish-title", "家庭心愿标题需要2—30个字。");
  }
  const cost = Number(input?.cost);
  if (!Number.isInteger(cost) || cost <= 0) throw new DomainRuleError("invalid-wish-cost", "家庭心愿需要有效的象果数量。");
  const timestamp = isoInstant(createdAt);
  const icon = typeof input?.icon === "string" ? input.icon.trim() : "";
  if (!isAllowedWishIcon(icon)) throw new DomainRuleError("invalid-wish-icon", "请选择产品提供的家庭心愿图标。");
  const wish = {
    id: requiredText(input?.id || `wish:${childId}:${timestamp.replace(/[^0-9]/g, "")}`, "无法建立家庭心愿。"),
    childId,
    title,
    icon,
    cost,
    status: "active",
    createdAt: timestamp,
    scheduledDate: "",
    completedAt: "",
    cancelledAt: "",
  };
  if (current.some((item) => item.id === wish.id)) throw new DomainRuleError("duplicate-wish", "这个家庭心愿已经存在。");
  return { wish, wishes: [...current, wish] };
}

export function canScheduleWish(wish, transactions) {
  if (!wish || wish.status !== "active") return false;
  return walletFor(transactions, wish.childId).available >= wish.cost;
}

export function scheduleWish(wishes, transactions, wishId, { scheduledDate = "", createdAt = new Date(), transactionId } = {}) {
  const current = cloneWishes(wishes);
  const index = current.findIndex((item) => item.id === wishId);
  if (index < 0) throw new DomainRuleError("wish-not-found", "没有找到这个家庭心愿。");
  const wish = current[index];
  if (wish.status !== "active") throw new DomainRuleError("wish-not-active", "这个家庭心愿现在不能重复安排。");
  if (scheduledDate) assertLocalDate(scheduledDate);
  if (!canScheduleWish(wish, transactions)) throw new DomainRuleError("insufficient-fruit", "现在的可用象果还不够，暂时不能安排这个家庭心愿。");
  const created = isoInstant(createdAt);
  const transaction = {
    id: transactionId || nextSpendId(transactions, wish.id),
    childId: wish.childId,
    agreementId: "",
    recordId: "",
    wishId: wish.id,
    type: "wish-spend",
    amount: -wish.cost,
    createdAt: created,
    reversedTransactionId: "",
  };
  const nextTransactions = appendFruitTransaction(transactions, transaction);
  const updated = { ...wish, status: "scheduled", scheduledDate };
  current[index] = updated;
  return { wish: updated, wishes: current, transactions: nextTransactions, transaction };
}

export function completeWish(wishes, wishId, { completedAt = new Date(), memoryId } = {}) {
  const current = cloneWishes(wishes);
  const index = current.findIndex((item) => item.id === wishId);
  if (index < 0) throw new DomainRuleError("wish-not-found", "没有找到这个家庭心愿。");
  const wish = current[index];
  if (wish.status !== "scheduled") throw new DomainRuleError("wish-not-scheduled", "请先一起安排这个家庭心愿，再在真正实现后记下来。");
  const timestamp = isoInstant(completedAt);
  const updated = { ...wish, status: "completed", completedAt: timestamp };
  current[index] = updated;
  const memory = {
    id: memoryId || `memory:${wish.id}`,
    childId: wish.childId,
    wishId: wish.id,
    title: wish.title,
    icon: wish.icon,
    completedAt: timestamp,
  };
  return { wish: updated, wishes: current, memory };
}

export function unscheduleWish(wishes, transactions, wishId, { unscheduledAt = new Date(), transactionId } = {}) {
  const current = cloneWishes(wishes);
  const index = current.findIndex((item) => item.id === wishId);
  if (index < 0) throw new DomainRuleError("wish-not-found", "没有找到这个家庭心愿。");
  const wish = current[index];
  if (wish.status === "completed") throw new DomainRuleError("completed-wish", "已经实现的家庭心愿不能取消或退款。");
  if (wish.status !== "scheduled") throw new DomainRuleError("wish-not-scheduled", "只有已经安排但尚未实现的家庭心愿可以取消这次安排。");
  const refunded = refundLatestSpend(wish, transactions, unscheduledAt, transactionId);
  const updated = { ...wish, status: "active", scheduledDate: "", cancelledAt: "" };
  current[index] = updated;
  return { wish: updated, wishes: current, transactions: refunded.transactions, transaction: refunded.transaction };
}

export function abandonWish(wishes, transactions, wishId, { cancelledAt = new Date(), transactionId } = {}) {
  const current = cloneWishes(wishes);
  const index = current.findIndex((item) => item.id === wishId);
  if (index < 0) throw new DomainRuleError("wish-not-found", "没有找到这个家庭心愿。");
  const wish = current[index];
  if (wish.status === "completed") throw new DomainRuleError("completed-wish", "已经实现的家庭心愿不能取消或退款。");
  if (!['active', 'scheduled'].includes(wish.status)) throw new DomainRuleError("wish-not-cancellable", "这个家庭心愿已经放下了。");
  const timestamp = isoInstant(cancelledAt);
  const refunded = wish.status === "scheduled"
    ? refundLatestSpend(wish, transactions, timestamp, transactionId)
    : { transactions: asArray(transactions).map((item) => ({ ...item })), transaction: null };
  const updated = { ...wish, status: "cancelled", scheduledDate: "", cancelledAt: timestamp };
  current[index] = updated;
  return { wish: updated, wishes: current, transactions: refunded.transactions, transaction: refunded.transaction };
}

/** @deprecated Use abandonWish for the whole wish, or unscheduleWish for one arrangement. */
export const cancelWish = abandonWish;

function refundLatestSpend(wish, transactions, at, transactionId) {
  const items = asArray(transactions);
  const spend = [...items].reverse().find((item) => item.wishId === wish.id && item.type === "wish-spend"
    && !items.some((candidate) => candidate.type === "wish-refund" && candidate.reversedTransactionId === item.id));
  if (!spend) throw new DomainRuleError("wish-spend-not-found", "没有找到这个心愿的有效象果支出，无法退款。");
  const timestamp = isoInstant(at);
  if (new Date(timestamp).getTime() <= new Date(spend.createdAt).getTime()) {
    throw new DomainRuleError("refund-before-spend", "取消安排的时间必须晚于象果支出时间。");
  }
  const transaction = {
    id: transactionId || `fruit:wish-refund:${spend.id}`,
    childId: wish.childId,
    agreementId: "",
    recordId: "",
    wishId: wish.id,
    type: "wish-refund",
    amount: Math.abs(spend.amount),
    createdAt: timestamp,
    reversedTransactionId: spend.id,
  };
  return { transactions: appendFruitTransaction(items, transaction), transaction };
}

function nextSpendId(transactions, wishId) {
  const prefix = `fruit:wish-spend:${wishId}:attempt-`;
  let attempt = asArray(transactions).filter((item) => item.type === "wish-spend" && item.wishId === wishId).length + 1;
  while (asArray(transactions).some((item) => item.id === `${prefix}${attempt}`)) attempt += 1;
  return `${prefix}${attempt}`;
}

function cloneWishes(value) { return asArray(value).map((item) => ({ ...item })); }
function asArray(value) { return Array.isArray(value) ? value : []; }
function requiredText(value, message) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new DomainRuleError("missing-wish-field", message);
  return text;
}
function isoInstant(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new DomainRuleError("invalid-instant", "时间信息无效。");
  return date.toISOString();
}
function assertLocalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new DomainRuleError("invalid-date", "安排日期无效。");
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new DomainRuleError("invalid-date", "安排日期无效。");
  }
}
