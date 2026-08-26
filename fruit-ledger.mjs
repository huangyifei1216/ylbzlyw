import { DomainRuleError, periodKeyFor } from "./agreement-engine.mjs";

export const FRUIT_TRANSACTION_TYPES = Object.freeze([
  "child-step", "parent-step", "companion", "wish-spend", "wish-refund", "record-reversal",
]);
export const REVERSAL_WINDOW_MS = 10 * 60 * 1000;

export function walletFor(transactions, childId) {
  const items = asArray(transactions).filter((item) => item.childId === childId);
  validateTransactions(items);
  let available = 0;
  const ordered = items.sort(compareTransactions);
  for (const item of ordered) {
    available += item.amount;
    if (available < 0) throw new DomainRuleError("negative-fruit-balance", "象果账目异常，本次操作已停止，原记录没有改变。");
  }
  const earned = items.filter((item) => ["child-step", "parent-step", "companion"].includes(item.type))
    .reduce((sum, item) => sum + item.amount, 0);
  const reversed = items.filter((item) => item.type === "record-reversal").reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const spent = items.filter((item) => item.type === "wish-spend").reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const refunded = items.filter((item) => item.type === "wish-refund").reduce((sum, item) => sum + item.amount, 0);
  return { available, totalEarned: earned - reversed, earned, reversed, spent, refunded };
}

export function recordStep(snapshot, input) {
  const records = cloneRecords(snapshot?.records);
  const transactions = cloneTransactions(snapshot?.transactions);
  const petPeaks = { ...(snapshot?.petPeaks || {}) };
  const agreement = input?.agreement;
  const role = input?.role;
  if (!agreement || !agreement.id || !agreement.childId) throw new DomainRuleError("agreement-not-found", "没有找到这条约定。");
  if (agreement.status !== "active") {
    throw new DomainRuleError("agreement-not-active", "这轮约定已经结束或暂停，不能再添加记录。");
  }
  if (role !== "child" && role !== "parent") throw new DomainRuleError("invalid-role", "记录角色只能是孩子或家长。");
  const localDate = input.localDate;
  const periodKey = periodKeyFor(agreement, localDate);
  const existing = Object.values(records).find((item) => item.agreementId === agreement.id
    && item.role === role && item.periodKey === periodKey && !item.reversedAt);
  if (existing) {
    return { records, transactions, petPeaks, record: existing, addedTransactions: [], duplicate: true };
  }

  const recordedAt = isoInstant(input.recordedAt || new Date());
  const recordId = input.recordId || nextRecordId(records, agreement.id, role, periodKey);
  if (records[recordId]) throw new DomainRuleError("duplicate-record-id", "记录编号冲突，本次操作已停止。");
  const record = { id: recordId, childId: agreement.childId, agreementId: agreement.id, role, periodKey, localDate, recordedAt, reversedAt: null };
  records[recordId] = record;
  const stepTransaction = {
    id: input.transactionId || `fruit:${recordId}`,
    childId: agreement.childId,
    agreementId: agreement.id,
    recordId,
    wishId: "",
    type: role === "child" ? "child-step" : "parent-step",
    amount: 1,
    createdAt: recordedAt,
    reversedTransactionId: "",
    periodKey,
    relatedRecordIds: [recordId],
  };
  const addedTransactions = [];
  appendUnique(transactions, stepTransaction, addedTransactions);

  const counterpart = Object.values(records).find((item) => item.agreementId === agreement.id && item.role !== role && item.periodKey === periodKey && !item.reversedAt);
  const liveCompanion = findLiveCompanion(transactions, agreement.id, periodKey);
  if (counterpart && !liveCompanion) {
    const relatedRecordIds = [counterpart.id, record.id].sort();
    appendUnique(transactions, {
      id: nextCompanionId(transactions, agreement.id, periodKey),
      childId: agreement.childId,
      agreementId: agreement.id,
      recordId: record.id,
      wishId: "",
      type: "companion",
      amount: 1,
      createdAt: recordedAt,
      reversedTransactionId: "",
      periodKey,
      relatedRecordIds,
    }, addedTransactions);
  }
  const money = walletFor(transactions, agreement.childId);
  petPeaks[agreement.childId] = Math.max(Number(petPeaks[agreement.childId] || 0), money.totalEarned);
  return { records, transactions, petPeaks, record, addedTransactions, duplicate: false };
}

export function reverseRecord(snapshot, input) {
  const records = cloneRecords(snapshot?.records);
  const transactions = cloneTransactions(snapshot?.transactions);
  const petPeaks = { ...(snapshot?.petPeaks || {}) };
  const record = records[input?.recordId];
  if (!record) throw new DomainRuleError("record-not-found", "没有找到这条记录。");
  if (record.reversedAt) throw new DomainRuleError("already-reversed", "这条记录已经撤回。");
  const reversedAt = isoInstant(input.reversedAt || new Date());
  if (new Date(reversedAt).getTime() - new Date(record.recordedAt).getTime() > REVERSAL_WINDOW_MS) {
    throw new DomainRuleError("reversal-window-expired", "记录已超过10分钟，不能再撤回。");
  }
  if (new Date(reversedAt).getTime() < new Date(record.recordedAt).getTime()) {
    throw new DomainRuleError("invalid-reversal-time", "撤回时间不能早于记录时间。");
  }
  const original = transactions.find((item) => item.recordId === record.id && ["child-step", "parent-step"].includes(item.type));
  if (!original) throw new DomainRuleError("missing-step-transaction", "象果记录不完整，无法撤回。");
  const companion = findLiveCompanion(transactions, record.agreementId, record.periodKey, record.id);

  const reversals = [reversalFor(original, record, reversedAt)];
  if (companion) reversals.push(reversalFor(companion, record, reversedAt));
  const candidateTransactions = [...transactions, ...reversals];
  try {
    walletFor(candidateTransactions, record.childId);
  } catch (error) {
    if (error?.code === "negative-fruit-balance") {
      throw new DomainRuleError("fruit-already-spent", "这颗象果已经用于家庭心愿，不能直接撤回。可以先取消尚未实现的心愿安排。");
    }
    throw error;
  }
  records[record.id] = { ...record, reversedAt };
  return { records, transactions: candidateTransactions, petPeaks, record: records[record.id], addedTransactions: reversals };
}

export function appendFruitTransaction(transactions, transaction) {
  const current = cloneTransactions(transactions);
  const candidate = normalizeTransaction(transaction);
  const existing = current.find((item) => item.id === candidate.id);
  if (existing) {
    if (sameTransaction(existing, candidate)) return current;
    throw new DomainRuleError("duplicate-transaction-id", "象果流水编号冲突，本次操作已停止。");
  }
  const next = [...current, candidate];
  walletFor(next, candidate.childId);
  return next;
}

function reversalFor(original, record, createdAt) {
  return {
    id: `fruit:reversal:${original.id}`,
    childId: original.childId,
    agreementId: original.agreementId,
    recordId: record.id,
    wishId: original.wishId || "",
    type: "record-reversal",
    amount: -Math.abs(original.amount),
    createdAt,
    reversedTransactionId: original.id,
    periodKey: original.periodKey || record.periodKey,
    relatedRecordIds: [...(original.relatedRecordIds || [record.id])],
  };
}

function nextRecordId(records, agreementId, role, periodKey) {
  const prefix = `record:${agreementId}:${role}:${periodKey}:attempt-`;
  let attempt = Object.values(records).filter((item) => item.agreementId === agreementId
    && item.role === role && item.periodKey === periodKey).length + 1;
  while (records[`${prefix}${attempt}`]) attempt += 1;
  return `${prefix}${attempt}`;
}

function nextCompanionId(transactions, agreementId, periodKey) {
  const prefix = `fruit:companion:${agreementId}:${periodKey}:attempt-`;
  let attempt = transactions.filter((item) => item.type === "companion" && item.agreementId === agreementId
    && transactionPeriodKey(item) === periodKey).length + 1;
  while (transactions.some((item) => item.id === `${prefix}${attempt}`)) attempt += 1;
  return `${prefix}${attempt}`;
}

function findLiveCompanion(transactions, agreementId, periodKey, recordId = "") {
  return transactions.find((item) => item.type === "companion" && item.agreementId === agreementId
    && transactionPeriodKey(item) === periodKey
    && (!recordId || (item.relatedRecordIds || []).includes(recordId) || item.recordId === recordId)
    && !transactions.some((candidate) => candidate.type === "record-reversal" && candidate.reversedTransactionId === item.id));
}

function transactionPeriodKey(transaction) {
  if (transaction.periodKey) return transaction.periodKey;
  const legacyPrefix = `fruit:companion:${transaction.agreementId}:`;
  return transaction.id?.startsWith(legacyPrefix) ? transaction.id.slice(legacyPrefix.length) : "";
}

function appendUnique(transactions, transaction, added) {
  const normalized = normalizeTransaction(transaction);
  if (transactions.some((item) => item.id === normalized.id)) return;
  transactions.push(normalized);
  added.push(normalized);
}

function validateTransactions(transactions) {
  const ids = new Set();
  for (const item of transactions) {
    const normalized = normalizeTransaction(item);
    if (ids.has(normalized.id)) throw new DomainRuleError("duplicate-transaction-id", "象果流水存在重复编号。");
    ids.add(normalized.id);
  }
}

function sameTransaction(left, right) {
  return ["id", "childId", "agreementId", "recordId", "wishId", "type", "amount", "reversedTransactionId"]
    .every((key) => (left[key] || "") === (right[key] || ""));
}

function normalizeTransaction(value) {
  if (!value || typeof value !== "object") throw new DomainRuleError("invalid-transaction", "象果流水格式无效。");
  if (!value.id || !value.childId || !FRUIT_TRANSACTION_TYPES.includes(value.type) || !Number.isInteger(value.amount) || value.amount === 0) {
    throw new DomainRuleError("invalid-transaction", "象果流水格式无效。");
  }
  const positive = ["child-step", "parent-step", "companion", "wish-refund"].includes(value.type);
  if ((positive && value.amount < 0) || (!positive && value.amount > 0)) {
    throw new DomainRuleError("invalid-transaction-sign", "象果流水金额方向无效。");
  }
  return { ...value, createdAt: isoInstant(value.createdAt) };
}

function compareTransactions(left, right) {
  const time = left.createdAt.localeCompare(right.createdAt);
  if (time) return time;
  const order = { "child-step": 1, "parent-step": 1, companion: 2, "wish-spend": 3, "record-reversal": 4, "wish-refund": 5 };
  return (order[left.type] || 9) - (order[right.type] || 9) || String(left.id).localeCompare(String(right.id));
}

function cloneRecords(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, { ...item }]));
}
function cloneTransactions(value) { return asArray(value).map((item) => ({ ...item })); }
function asArray(value) { return Array.isArray(value) ? value : []; }
function isoInstant(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new DomainRuleError("invalid-instant", "时间信息无效。");
  return date.toISOString();
}
