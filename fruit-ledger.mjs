import { DomainRuleError, periodKeyFor } from "./agreement-engine.mjs";

export const FRUIT_TRANSACTION_TYPES = Object.freeze([
  "child-step", "parent-step", "companion", "wish-spend", "wish-refund", "record-reversal",
]);
export const REVERSAL_WINDOW_MS = 10 * 60 * 1000;

export function walletFor(transactions, childId) {
  const items = asArray(transactions).filter((item) => item.childId === childId);
  validateTransactions(items);
  const available = items.reduce((sum, item) => sum + item.amount, 0);
  if (available < 0) throw new DomainRuleError("negative-fruit-balance", "象果账目异常，本次操作已停止，原记录没有改变。");
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
  if (role !== "child" && role !== "parent") throw new DomainRuleError("invalid-role", "记录角色只能是孩子或家长。");
  const localDate = input.localDate;
  const periodKey = periodKeyFor(agreement, localDate);
  const existing = Object.values(records).find((item) => item.agreementId === agreement.id && item.role === role && item.periodKey === periodKey);
  if (existing) {
    return { records, transactions, petPeaks, record: existing, addedTransactions: [], duplicate: true };
  }

  const recordedAt = isoInstant(input.recordedAt || new Date());
  const recordId = input.recordId || `record:${agreement.id}:${role}:${periodKey}`;
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
  };
  const addedTransactions = [];
  appendUnique(transactions, stepTransaction, addedTransactions);

  const counterpart = Object.values(records).find((item) => item.agreementId === agreement.id && item.role !== role && item.periodKey === periodKey && !item.reversedAt);
  if (counterpart) {
    appendUnique(transactions, {
      id: `fruit:companion:${agreement.id}:${periodKey}`,
      childId: agreement.childId,
      agreementId: agreement.id,
      recordId: "",
      wishId: "",
      type: "companion",
      amount: 1,
      createdAt: recordedAt,
      reversedTransactionId: "",
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
  const companion = transactions.find((item) => item.childId === record.childId && item.agreementId === record.agreementId
    && item.type === "companion" && item.id === `fruit:companion:${record.agreementId}:${record.periodKey}`
    && !transactions.some((candidate) => candidate.type === "record-reversal" && candidate.reversedTransactionId === item.id));

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
  };
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
