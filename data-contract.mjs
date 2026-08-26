import { assertStateInvariants } from "./state-invariants.mjs";
import { legacyWishIcon } from "./wish-icons.mjs";

/** Versioned, local-only persistence boundary for 一两步. */
export const DATA_CONTRACT_VERSION = 2;
export const PRODUCT_VERSION = "5.1.4";
export const STORAGE_KEY = "ylb.v5.state";

const STAGES = ["s1", "s2", "s3", "s4", "s5", "s6"];
const AGREEMENT_STATUSES = ["active", "review-due", "reviewed", "paused", "archived"];
const WISH_STATUSES = ["active", "scheduled", "completed", "cancelled"];
const TRANSACTION_TYPES = ["child-step", "parent-step", "companion", "wish-spend", "wish-refund", "record-reversal"];

export function emptyState() {
  return { schemaVersion: 2, version: PRODUCT_VERSION, entitlement: null, children: [], currentChildId: "", agreements: [], records: {}, fruitTransactions: [], wishes: [], petPeaks: {}, settings: { handbookUrl: "" }, bridgeSeen: false, demo: false };
}

export function migrateState(input) {
  const source = object(input);
  const candidate = Object.keys(object(source.data)).length ? object(source.data) : source;
  if (Number(candidate.schemaVersion) >= 2) return { ...candidate, schemaVersion: 2, version: PRODUCT_VERSION };
  return migrateV1(candidate);
}

export function normalizeState(input, { strict = false } = {}) {
  const source = migrateState(input);
  const output = emptyState();
  output.entitlement = normalizeEntitlement(source.entitlement);
  output.children = normalizeChildren(source.children);
  const childIds = new Set(output.children.map((child) => child.id));
  output.currentChildId = childIds.has(safeId(source.currentChildId)) ? safeId(source.currentChildId) : (output.children[0]?.id || "");
  output.agreements = normalizeAgreements(source.agreements, childIds);
  const agreements = new Map(output.agreements.map((item) => [item.id, item]));
  output.records = normalizeRecords(source.records, agreements);
  output.wishes = normalizeWishes(source.wishes, childIds);
  const wishIds = new Set(output.wishes.map((wish) => wish.id));
  output.fruitTransactions = normalizeTransactions(source.fruitTransactions, childIds, agreements, wishIds);
  output.petPeaks = normalizePetPeaks(source.petPeaks, childIds);
  output.settings = { handbookUrl: httpUrl(object(source.settings).handbookUrl) };
  output.bridgeSeen = Boolean(source.bridgeSeen);
  output.demo = Boolean(source.demo);
  if (strict) assertStrictV2Preserved(source, output);
  assertStateInvariants(output);
  return output;
}

export function createStorageAdapter({ storage = globalThis.localStorage, key = STORAGE_KEY, runExclusive = defaultRunExclusive } = {}) {
  let status = { ok: true, error: "" };
  let lastPersisted = emptyState();
  let lastRaw = null;
  const conflict = (currentRaw) => {
    try {
      lastPersisted = clone(normalizeState(currentRaw ? JSON.parse(currentRaw) : null));
      lastRaw = currentRaw;
    } catch { /* Keep the last valid snapshot when an external value is itself invalid. */ }
    status = { ok: false, error: "storage-conflict" };
    return { state: clone(lastPersisted), ...status };
  };
  return {
    read() {
      try { const raw = storage?.getItem(key) ?? null; lastRaw = raw; lastPersisted = clone(normalizeState(raw ? JSON.parse(raw) : null)); status = { ok: true, error: "" }; return clone(lastPersisted); }
      catch (error) { lastPersisted = emptyState(); status = { ok: false, error: error?.message || "read-failed" }; return clone(lastPersisted); }
    },
    async write(value) {
      const expectedRaw = lastRaw;
      let state;
      try { state = normalizeState(value); }
      catch (error) { status = { ok: false, error: error?.message || "invalid-state" }; return { state: clone(lastPersisted), ...status }; }
      try {
        return await runExclusive(`${key}:write`, () => {
          if (!storage?.setItem || !storage?.getItem) throw new Error("storage-unavailable");
          const currentRaw = storage.getItem(key) ?? null;
          if (currentRaw !== expectedRaw) return conflict(currentRaw);
          const serialized = JSON.stringify(state);
          let mutationCompleted = false;
          try {
            storage.setItem(key, serialized);
            mutationCompleted = true;
            if ((storage.getItem(key) ?? null) !== serialized) throw new Error("write-verification-failed");
          } catch (error) {
            if (mutationCompleted) throw new Error("unknown-commit-state", { cause: error });
            throw error;
          }
          lastPersisted = clone(state);
          lastRaw = serialized;
          status = { ok: true, error: "" };
          return { state: clone(lastPersisted), ...status };
        });
      } catch (error) { status = { ok: false, error: error?.message || "write-failed" }; }
      return { state: clone(lastPersisted), ...status };
    },
    async clear() {
      const expectedRaw = lastRaw;
      try {
        return await runExclusive(`${key}:write`, () => {
          if (!storage?.removeItem || !storage?.getItem) throw new Error("storage-unavailable");
          const currentRaw = storage.getItem(key) ?? null;
          if (currentRaw !== expectedRaw) return conflict(currentRaw);
          let mutationCompleted = false;
          try {
            storage.removeItem(key);
            mutationCompleted = true;
            if (storage.getItem(key) !== null) throw new Error("clear-verification-failed");
          } catch (error) {
            if (mutationCompleted) throw new Error("unknown-commit-state", { cause: error });
            throw error;
          }
          lastPersisted = emptyState();
          lastRaw = null;
          status = { ok: true, error: "" };
          return { state: clone(lastPersisted), ...status };
        });
      }
      catch (error) { status = { ok: false, error: error?.message || "clear-failed" }; }
      return { state: clone(lastPersisted), ...status };
    },
    status: () => ({ ...status }),
  };
}

const processQueues = new Map();
function defaultRunExclusive(name, task) {
  if (typeof window !== "undefined" && globalThis.navigator?.locks?.request) return navigator.locks.request(name, { mode: "exclusive" }, task);
  if (typeof window !== "undefined") return Promise.reject(new Error("atomic-write-unavailable"));
  const previous = processQueues.get(name) || Promise.resolve();
  const current = previous.catch(() => {}).then(task);
  const tail = current.then(() => {}, () => {});
  processQueues.set(name, tail);
  tail.finally(() => { if (processQueues.get(name) === tail) processQueues.delete(name); });
  return current;
}

function clone(value) { return globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }

function migrateV1(source) {
  const output = { ...emptyState(), ...source, schemaVersion: 2, version: PRODUCT_VERSION };
  output.entitlement = stripCredentials(source.entitlement);
  output.children = (Array.isArray(source.children) ? source.children : []).map((item) => ({
    ...item,
    createdAt: isoInstant(item.createdAt) || (safeDate(item.birthDate) ? `${safeDate(item.birthDate)}T12:00:00.000Z` : ""),
  }));
  output.agreements = (Array.isArray(source.agreements) ? source.agreements : []).map((item) => {
    const stageId = stageFrom(item);
    const status = item.status === "completed" ? "reviewed" : (item.status || "active");
    const legacyReviewedAt = isoInstant(item.reviewedAt || item.completedAt || (item.endDate ? `${nextDate(item.endDate)}T12:00:00.000Z` : ""));
    const review = status === "reviewed" && !item.review
      ? { outcome: "change", outcomeLabel: "旧版已完成约定", outcomeIcon: "↗", reviewedAt: legacyReviewedAt }
      : item.review;
    return { ...item, stageId, templateId: cleanText(item.templateId || item.problemId, 80), templateVersion: Number(item.templateVersion) || 1, recordMode: item.recordMode === "once-per-cycle" || ["s5", "s6"].includes(stageId) ? "once-per-cycle" : "daily", status, review, createdAt: isoInstant(item.createdAt) || (safeDate(item.startDate) ? `${safeDate(item.startDate)}T00:00:00.000Z` : "") };
  });
  const agreements = new Map(output.agreements.map((item) => [String(item.id), item]));
  output.records = {};
  output.fruitTransactions = [];
  for (const [legacyKey, raw] of Object.entries(object(source.checkins))) {
    const checkin = object(raw);
    const agreement = agreements.get(String(checkin.agreementId || legacyKey.split(":")[0]));
    const localDate = safeDate(checkin.date || legacyKey.split(":").pop());
    if (!agreement || !localDate) continue;
    const periodKey = agreement.recordMode === "once-per-cycle" ? `cycle:${agreement.id}` : localDate;
    const relatedRecordIds = [];
    for (const role of ["child", "parent"]) {
      if (!checkin[role]) continue;
      const recordId = `m1:${agreement.id}:${role}:${periodKey}`;
      relatedRecordIds.push(recordId);
      output.records[recordId] = { id: recordId, childId: agreement.childId, agreementId: agreement.id, role, periodKey, localDate, recordedAt: `${localDate}T12:00:00.000Z`, reversedAt: "" };
      output.fruitTransactions.push({ id: `m1:fruit:${recordId}`, childId: agreement.childId, agreementId: agreement.id, recordId, wishId: "", type: `${role}-step`, amount: 1, createdAt: `${localDate}T12:00:00.000Z`, reversedTransactionId: "", periodKey, relatedRecordIds: [recordId] });
    }
    if (checkin.child && checkin.parent) output.fruitTransactions.push({ id: `m1:companion:${agreement.id}:${periodKey}`, childId: agreement.childId, agreementId: agreement.id, recordId: relatedRecordIds.at(-1) || "", wishId: "", type: "companion", amount: 1, createdAt: `${localDate}T12:00:00.000Z`, reversedTransactionId: "", periodKey, relatedRecordIds });
  }
  output.wishes = [];
  const activeWishChildren = new Set();
  for (const agreement of output.agreements) {
    if (!agreement.wishTitle || agreement.wishRedeemed || activeWishChildren.has(agreement.childId)) continue;
    activeWishChildren.add(agreement.childId);
    const wishId = `m1:wish:${agreement.id}`;
    agreement.wishId = wishId;
    output.wishes.push({ id: wishId, childId: agreement.childId, title: agreement.wishTitle, icon: legacyWishIcon(agreement.wishIcon), cost: Number(agreement.wishCost) || 0, status: "active", createdAt: agreement.createdAt || "", scheduledDate: "", completedAt: "", cancelledAt: "" });
  }
  for (const redemption of Array.isArray(source.redemptions) ? source.redemptions : []) {
    const agreement = agreements.get(String(redemption.agreementId));
    if (!agreement) continue;
    const wishId = `m1:wish:redeemed:${redemption.id || agreement.id}`;
    const completedAt = safeDate(redemption.date) || agreement.endDate || agreement.startDate;
    const cost = safeNumber(redemption.cost, 0, 999, Number(agreement.wishCost) || 0);
    output.wishes.push({ id: wishId, childId: agreement.childId, title: cleanText(redemption.title || agreement.wishTitle, 30), icon: legacyWishIcon(redemption.icon || agreement.wishIcon), cost, status: "completed", createdAt: agreement.createdAt || "", scheduledDate: completedAt, completedAt: `${completedAt}T12:00:00.000Z`, cancelledAt: "" });
    output.fruitTransactions.push({ id: `m1:spend:${wishId}`, childId: agreement.childId, agreementId: agreement.id, recordId: "", wishId, type: "wish-spend", amount: -cost, createdAt: `${completedAt || "1970-01-01"}T12:00:00.000Z`, reversedTransactionId: "" });
  }
  output.fruitTransactions = dedupe(output.fruitTransactions);
  output.wishes = dedupe(output.wishes);
  delete output.checkins;
  delete output.redemptions;
  return output;
}

function normalizeEntitlement(value) {
  const source = object(value);
  if (!['all', 'stage'].includes(source.scope)) return null;
  const stageId = source.scope === "all" ? "all" : enumValue(source.stageId, STAGES, "");
  return stageId ? { scope: source.scope, stageId, label: cleanText(source.label, 80), status: enumValue(source.status, ["active", "revoked", "expired"], "active") } : null;
}
function stripCredentials(value) { const { recoveryCode, activationCode, code, payment, ...safe } = object(value); return safe; }
function normalizeChildren(value) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).map((raw) => { const item = object(raw); const id = safeId(item.id); const nickname = cleanText(item.nickname, 12); const birthDate = safeDate(item.birthDate); if (!id || !nickname || !birthDate || seen.has(id)) return null; seen.add(id); return { id, nickname, birthDate, createdAt: cleanText(item.createdAt, 80) }; }).filter(Boolean);
}
function normalizeAgreements(value, childIds) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).map((raw) => {
    const item = object(raw); const id = safeId(item.id); const childId = safeId(item.childId); if (!id || !childIds.has(childId) || seen.has(id)) return null; seen.add(id);
    const stageId = enumValue(item.stageId || stageFrom(item), STAGES, "s4");
    return { id, childId, stageId, templateId: cleanText(item.templateId || item.problemId, 80), templateVersion: safeNumber(item.templateVersion, 1, 999, 1), problem: cleanText(item.problem, 500), childAction: cleanText(item.childAction, 500), parentAction: cleanText(item.parentAction, 500), recordMode: enumValue(item.recordMode, ["daily", "once-per-cycle"], ["s5", "s6"].includes(stageId) ? "once-per-cycle" : "daily"), duration: [3, 7].includes(Number(item.duration)) ? Number(item.duration) : 7, startDate: safeDate(item.startDate), endDate: safeDate(item.endDate), wishId: safeId(item.wishId), status: enumValue(item.status, AGREEMENT_STATUSES, "active"), review: normalizeReview(item.review), createdAt: cleanText(item.createdAt, 80) };
  }).filter(Boolean);
}
function normalizeRecords(value, agreements) {
  const output = {};
  for (const raw of Object.values(object(value))) {
    const item = object(raw); const agreement = agreements.get(safeId(item.agreementId)); const role = enumValue(item.role, ["child", "parent"], ""); const periodKey = cleanText(item.periodKey, 120); const id = safeId(item.id);
    if (!agreement || !role || !periodKey || !id || (item.childId && item.childId !== agreement.childId)) continue;
    if (output[id]) continue;
    output[id] = { id, childId: agreement.childId, agreementId: agreement.id, role, periodKey, localDate: safeDate(item.localDate), recordedAt: cleanText(item.recordedAt, 80), reversedAt: cleanText(item.reversedAt, 80) };
  }
  return output;
}
function normalizeWishes(value, childIds) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).map((raw) => { const item = object(raw); const id = safeId(item.id); const childId = safeId(item.childId); if (!id || !childIds.has(childId) || seen.has(id)) return null; seen.add(id); return { id, childId, title: cleanText(item.title, 30), icon: cleanText(item.icon, 12), cost: safeNumber(item.cost, 0, 999, 0), status: enumValue(item.status, WISH_STATUSES, "active"), createdAt: cleanText(item.createdAt, 80), scheduledDate: safeDate(item.scheduledDate), completedAt: cleanText(item.completedAt, 80), cancelledAt: cleanText(item.cancelledAt, 80) }; }).filter(Boolean);
}
function normalizeTransactions(value, childIds, agreements, wishIds) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).map((raw) => {
    const item = object(raw); const id = safeId(item.id); const childId = safeId(item.childId); const type = enumValue(item.type, TRANSACTION_TYPES, ""); const agreementId = safeId(item.agreementId); const wishId = safeId(item.wishId);
    if (!id || !childIds.has(childId) || !type || seen.has(id)) return null;
    if (agreementId && (!agreements.has(agreementId) || agreements.get(agreementId).childId !== childId)) return null;
    if (wishId && !wishIds.has(wishId)) return null;
    seen.add(id); return { id, childId, agreementId, recordId: safeId(item.recordId), wishId, type, amount: safeNumber(item.amount, -999, 999, 0), createdAt: isoInstant(item.createdAt), reversedTransactionId: safeId(item.reversedTransactionId), periodKey: cleanText(item.periodKey, 120), relatedRecordIds: (Array.isArray(item.relatedRecordIds) ? item.relatedRecordIds : []).map(safeId).filter(Boolean) };
  }).filter(Boolean);
}
function normalizePetPeaks(value, childIds) { return Object.fromEntries(Object.entries(object(value)).filter(([id]) => childIds.has(id)).map(([id, total]) => [id, safeNumber(total, 0, 100000, 0)])); }
function normalizeReview(value) {
  const item = object(value);
  if (!Object.keys(item).length) return null;
  const legacyDate = safeDate(item.date);
  const reviewedAt = isoInstant(item.reviewedAt || (legacyDate ? `${legacyDate}T12:00:00.000Z` : ""));
  return {
    outcome: cleanText(item.outcome, 40),
    outcomeLabel: cleanText(item.outcomeLabel, 500),
    outcomeIcon: cleanText(item.outcomeIcon, 12),
    reviewedAt,
  };
}
function stageFrom(item) { return String(item?.stageId || item?.templateId || item?.problemId || "").match(/^s[1-6]/)?.[0] || "s4"; }
function dedupe(items) { return [...new Map(items.map((item) => [item.id, item])).values()]; }
function object(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function cleanText(value, max) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function safeId(value) { const result = cleanText(value, 160); return /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(result) ? result : ""; }
function safeDate(value) { const result = cleanText(value, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) return ""; const [year, month, day] = result.split("-").map(Number); const date = new Date(Date.UTC(year, month - 1, day)); return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? result : ""; }
function safeNumber(value, min, max, fallback) { const result = Number(value); return Number.isFinite(result) ? Math.min(max, Math.max(min, result)) : fallback; }
function enumValue(value, values, fallback) { return values.includes(value) ? value : fallback; }
function httpUrl(value) { const result = cleanText(value, 2000); if (!result) return ""; try { const url = new URL(result); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } }
function isoInstant(value) { const text = cleanText(value, 80); if (!text) return ""; const date = new Date(text); return Number.isNaN(date.getTime()) ? "" : date.toISOString(); }
function nextDate(value) { const date = safeDate(value); if (!date) return ""; const [year, month, day] = date.split("-").map(Number); return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10); }

function assertStrictV2Preserved(source, normalized) {
  if (Number(source.schemaVersion) < 2) return;
  const keys = ["children", "currentChildId", "agreements", "records", "fruitTransactions", "wishes", "petPeaks"];
  const raw = Object.fromEntries(keys.map((key) => [key, clone(source[key])]));
  const clean = Object.fromEntries(keys.map((key) => [key, clone(normalized[key])]));
  for (const agreement of Array.isArray(raw.agreements) ? raw.agreements : []) {
    if (agreement?.review?.date && !agreement.review.reviewedAt) {
      agreement.review.reviewedAt = `${agreement.review.date}T12:00:00.000Z`;
      delete agreement.review.date;
    }
  }
  if (canonical(raw) !== canonical(clean)) throw new Error("V2家庭数据包含会被截断、补写或静默修正的字段。");
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
