/**
 * Versioned persistence boundary for 一两步.
 *
 * This module deliberately has no network or UI concerns. It keeps the local
 * demo compatible while giving a future backend one stable, validated shape.
 */

export const DATA_CONTRACT_VERSION = 1;
export const STORAGE_KEY = "ylb.v5.state";

const PRODUCT_VERSION = 5;
const MAX_NICKNAME_LENGTH = 12;
const MAX_TEXT_LENGTH = 500;

export function emptyState() {
  return {
    schemaVersion: DATA_CONTRACT_VERSION,
    version: PRODUCT_VERSION,
    entitlement: null,
    children: [],
    currentChildId: "",
    agreements: [],
    checkins: {},
    redemptions: [],
    petPeaks: {},
    settings: { handbookUrl: "" },
    bridgeSeen: false,
    demo: false,
  };
}

/**
 * Accept an exported payload as well as the raw localStorage state. This is a
 * migration boundary, not an import/export feature: only the known data keys
 * are carried forward.
 */
export function migrateState(input) {
  const source = asRecord(input);
  const envelope = asRecord(source.data);
  const candidate = Object.keys(envelope).length ? envelope : source;
  return {
    ...candidate,
    schemaVersion: DATA_CONTRACT_VERSION,
    version: PRODUCT_VERSION,
  };
}

export function normalizeState(input) {
  const migrated = migrateState(input);
  const output = emptyState();

  output.entitlement = normalizeEntitlement(migrated.entitlement);
  output.children = normalizeChildren(migrated.children);
  const childIds = new Set(output.children.map((child) => child.id));
  output.currentChildId = childIds.has(String(migrated.currentChildId || ""))
    ? String(migrated.currentChildId)
    : (output.children[0]?.id || "");

  output.agreements = normalizeAgreements(migrated.agreements, childIds);
  const agreementMap = new Map(output.agreements.map((agreement) => [agreement.id, agreement]));
  output.checkins = normalizeCheckins(migrated.checkins, agreementMap);
  output.redemptions = normalizeRedemptions(migrated.redemptions, agreementMap);
  output.petPeaks = normalizePetPeaks(migrated.petPeaks, childIds);
  output.settings = normalizeSettings(migrated.settings);
  output.bridgeSeen = Boolean(migrated.bridgeSeen);
  output.demo = Boolean(migrated.demo);

  return output;
}

/**
 * A small storage adapter that can be injected with a fake storage in tests or
 * replaced by a backend-backed implementation later. It never performs I/O
 * outside the supplied storage object.
 */
export function createStorageAdapter({ storage = globalThis.localStorage, key = STORAGE_KEY } = {}) {
  return {
    read() {
      try {
        const raw = storage?.getItem(key);
        return normalizeState(raw ? JSON.parse(raw) : null);
      } catch {
        return emptyState();
      }
    },
    write(value) {
      const normalized = normalizeState(value);
      try {
        storage?.setItem(key, JSON.stringify(normalized));
      } catch {
        // Quota/private-mode failures must not break the family flow.
      }
      return normalized;
    },
    clear() {
      try {
        storage?.removeItem(key);
      } catch {
        // Clearing is best effort; the UI remains usable if storage is locked.
      }
    },
  };
}

function normalizeEntitlement(value) {
  const source = asRecord(value);
  if (source.scope !== "all" && source.scope !== "stage") return null;
  const stageId = source.scope === "all" ? "all" : safeEnum(source.stageId, ["s1", "s2", "s3", "s4", "s5", "s6"], "");
  if (source.scope === "stage" && !stageId) return null;
  return {
    scope: source.scope,
    stageId,
    label: safeText(source.label, 80),
    status: safeEnum(source.status, ["active", "revoked", "expired"], "active"),
    recoveryCode: safeText(source.recoveryCode, 80),
  };
}

function normalizeChildren(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.map((entry) => {
    const source = asRecord(entry);
    const id = safeId(source.id);
    const nickname = safeText(source.nickname, MAX_NICKNAME_LENGTH);
    const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(String(source.birthDate || "")) ? source.birthDate : "";
    if (!id || !nickname || !birthDate || seen.has(id)) return null;
    seen.add(id);
    return {
      id,
      nickname,
      birthDate,
      createdAt: safeText(source.createdAt, 80),
    };
  }).filter(Boolean);
}

function normalizeAgreements(value, childIds) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.map((entry) => {
    const source = asRecord(entry);
    const id = safeId(source.id);
    const childId = safeId(source.childId);
    if (!id || !childIds.has(childId) || seen.has(id)) return null;
    seen.add(id);
    return {
      id,
      childId,
      problemId: safeText(source.problemId, 80),
      problem: safeText(source.problem, MAX_TEXT_LENGTH),
      childAction: safeText(source.childAction, MAX_TEXT_LENGTH),
      parentAction: safeText(source.parentAction, MAX_TEXT_LENGTH),
      duration: safeNumber(source.duration, 3, 7, 7),
      startDate: safeDate(source.startDate),
      endDate: safeDate(source.endDate),
      wishId: safeText(source.wishId, 80),
      wishTitle: safeText(source.wishTitle, MAX_TEXT_LENGTH),
      wishIcon: safeText(source.wishIcon, 12),
      wishCost: safeNumber(source.wishCost, 0, 999, 0),
      wishRedeemed: Boolean(source.wishRedeemed),
      status: safeEnum(source.status, ["active", "completed"], "active"),
      review: normalizeReview(source.review),
      createdAt: safeText(source.createdAt, 80),
    };
  }).filter(Boolean);
}

function normalizeCheckins(value, agreementMap) {
  if (!isPlainObject(value)) return {};
  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    const source = asRecord(entry);
    const agreement = agreementMap.get(safeId(source.agreementId));
    if (!agreement) continue;
    // The agreement is authoritative. A mismatched childId is discarded rather
    // than repaired, preventing one child's wallet from seeing another's data.
    if (source.childId && String(source.childId) !== agreement.childId) continue;
    const date = safeDate(source.date) || String(key).split(":").pop();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const normalizedKey = `${agreement.id}:${date}`;
    output[normalizedKey] = {
      agreementId: agreement.id,
      childId: agreement.childId,
      date,
      child: Boolean(source.child),
      parent: Boolean(source.parent),
    };
  }
  return output;
}

function normalizeRedemptions(value, agreementMap) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const source = asRecord(entry);
    const agreement = agreementMap.get(safeId(source.agreementId));
    if (!agreement || (source.childId && String(source.childId) !== agreement.childId)) return null;
    return {
      id: safeId(source.id) || `redemption-${agreement.id}-${safeDate(source.date) || "unknown"}`,
      agreementId: agreement.id,
      childId: agreement.childId,
      title: safeText(source.title, MAX_TEXT_LENGTH),
      icon: safeText(source.icon, 12),
      cost: safeNumber(source.cost, 0, 999, agreement.wishCost),
      date: safeDate(source.date),
    };
  }).filter(Boolean);
}

function normalizePetPeaks(value, childIds) {
  if (!isPlainObject(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([childId]) => childIds.has(childId))
    .map(([childId, total]) => [childId, safeNumber(total, 0, 100000, 0)]));
}

function normalizeSettings(value) {
  const source = asRecord(value);
  return { handbookUrl: safeHttpUrl(source.handbookUrl) };
}

function normalizeReview(value) {
  const source = asRecord(value);
  if (!Object.keys(source).length) return null;
  return {
    outcome: safeText(source.outcome, 40),
    outcomeLabel: safeText(source.outcomeLabel, MAX_TEXT_LENGTH),
    outcomeIcon: safeText(source.outcomeIcon, 12),
    date: safeDate(source.date),
  };
}

function asRecord(value) {
  return isPlainObject(value) ? value : {};
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeId(value) {
  const text = safeText(value, 120);
  return /^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(text) ? text : "";
}

function safeText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeDate(value) {
  const date = safeText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function safeHttpUrl(value) {
  const text = safeText(value, 2000);
  if (!text) return "";
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

function safeNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function safeEnum(value, values, fallback) {
  return values.includes(value) ? value : fallback;
}
