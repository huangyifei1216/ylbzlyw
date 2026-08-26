import assert from "node:assert/strict";
import { DATA_CONTRACT_VERSION, PRODUCT_VERSION, STORAGE_KEY, createStorageAdapter, emptyState, migrateState, normalizeState } from "../data-contract.mjs";
import { StateInvariantError } from "../state-invariants.mjs";

assert.equal(DATA_CONTRACT_VERSION, 2);
assert.equal(PRODUCT_VERSION, "5.1.4");
assert.equal(STORAGE_KEY, "ylb.v5.state");
assert.deepEqual(Object.keys(emptyState()), ["schemaVersion", "version", "entitlement", "children", "currentChildId", "agreements", "records", "fruitTransactions", "wishes", "petPeaks", "settings", "bridgeSeen", "demo"]);

const child = { id: "child-a", nickname: "菲菲", birthDate: "2020-05-18" };
const agreement = { id: "agreement-a", childId: child.id, problemId: "s3-morning", problem: "早上出门慢", childAction: "先穿鞋", parentAction: "只提醒一次", duration: 7, startDate: "2026-08-24", endDate: "2026-08-30", status: "active", wishTitle: "一起看电影", wishIcon: "🎬", wishCost: 9 };
const v1 = { schemaVersion: 1, entitlement: { scope: "all", stageId: "all", label: "全龄", status: "active", recoveryCode: "SECRET" }, children: [child], currentChildId: child.id, agreements: [agreement], checkins: { "agreement-a:2026-08-24": { agreementId: agreement.id, childId: child.id, date: "2026-08-24", child: true, parent: true } }, redemptions: [], petPeaks: { [child.id]: 3 } };
const migrated = normalizeState(v1);
assert.equal(migrated.schemaVersion, 2);
assert.equal(migrated.version, "5.1.4");
assert.match(migrated.children[0].createdAt, /^\d{4}-\d{2}-\d{2}T/);
assert.match(migrated.agreements[0].createdAt, /^\d{4}-\d{2}-\d{2}T/);
assert.equal("recoveryCode" in migrated.entitlement, false);
assert.equal(migrated.agreements[0].stageId, "s3");
assert.equal(migrated.agreements[0].recordMode, "daily");
assert.equal(Object.keys(migrated.records).length, 2);
assert.deepEqual(migrated.fruitTransactions.map((item) => item.amount), [1, 1, 1]);
assert.equal(migrated.wishes.length, 1);
assert.deepEqual(normalizeState(migrated), migrated, "V2 normalization must be idempotent");
assert.deepEqual(normalizeState(migrateState(v1)), migrated, "V1 migration must be idempotent");

const reviewedAt = "2026-08-31T08:30:00.000Z";
const reviewedState = normalizeState({ ...migrated, agreements: [{ ...migrated.agreements[0], status: "reviewed", review: { outcome: "continue", outcomeLabel: "再试一轮", outcomeIcon: "↻", reviewedAt } }] });
assert.equal(reviewedState.agreements[0].review.reviewedAt, reviewedAt);
assert.equal("date" in reviewedState.agreements[0].review, false);
const legacyReview = normalizeState({ ...migrated, agreements: [{ ...migrated.agreements[0], status: "reviewed", review: { outcome: "continue", outcomeLabel: "再试一轮", outcomeIcon: "↻", date: "2026-08-31" } }] });
assert.equal(legacyReview.agreements[0].review.reviewedAt, "2026-08-31T12:00:00.000Z");
const invalidReviewState = { ...migrated, agreements: [{ ...migrated.agreements[0], status: "reviewed", review: { outcome: "continue", outcomeLabel: "再试一轮", outcomeIcon: "↻", reviewedAt: "not-a-time" } }] };
assert.throws(() => normalizeState(invalidReviewState), (caught) => caught instanceof StateInvariantError && caught.code === "invalid-reviewed-at");
const invalidReviewStorage = createStorageAdapter({ storage: { getItem: () => JSON.stringify(invalidReviewState), setItem() {}, removeItem() {} } });
assert.equal(invalidReviewStorage.read().children.length, 0, "illegal local state must be isolated instead of partially restored");
assert.equal(invalidReviewStorage.status().ok, false);

const backing = new Map();
const storage = createStorageAdapter({ storage: { getItem: (key) => backing.get(key) ?? null, setItem: (key, value) => backing.set(key, value), removeItem: (key) => backing.delete(key) } });
const written = await storage.write(migrated);
assert.equal(written.ok, true);
assert.equal(written.state.schemaVersion, 2);
assert.equal(storage.read().children.length, 1);
const cleared = await storage.clear();
assert.equal(cleared.ok, true);
assert.equal(cleared.state.children.length, 0);
assert.equal(storage.read().children.length, 0);

const locked = createStorageAdapter({ storage: { getItem: () => null, setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("locked"); } } });
const failed = await locked.write(migrated);
assert.equal(failed.ok, false);
assert.equal(failed.state.children.length, 0, "failed writes must roll back to the last persisted snapshot");
assert.match(failed.error, /quota/);
assert.equal((await locked.clear()).ok, false);

let rejectWrites = false;
const rollbackBacking = new Map();
const rollbackStorage = createStorageAdapter({ storage: { getItem: (key) => rollbackBacking.get(key) ?? null, setItem: (key, value) => { if (rejectWrites) throw new Error("quota"); rollbackBacking.set(key, value); }, removeItem: (key) => rollbackBacking.delete(key) } });
assert.equal((await rollbackStorage.write(migrated)).ok, true);
rejectWrites = true;
const rolledBack = await rollbackStorage.write({ ...migrated, children: [{ ...migrated.children[0], nickname: "不应保留" }] });
assert.equal(rolledBack.ok, false);
assert.equal(rolledBack.state.children[0].nickname, migrated.children[0].nickname);
assert.equal(JSON.parse(rollbackBacking.get(STORAGE_KEY)).children[0].nickname, migrated.children[0].nickname);

rejectWrites = false;
assert.equal((await rollbackStorage.clear()).ok, true);
rejectWrites = true;
const afterClearFailure = await rollbackStorage.write(migrated);
assert.equal(afterClearFailure.ok, false);
assert.equal(afterClearFailure.state.children.length, 0, "a failed write after a verified clear cannot resurrect the old family");
assert.equal(rollbackBacking.has(STORAGE_KEY), false);

const clearFailureBacking = new Map([[STORAGE_KEY, JSON.stringify(migrated)]]);
const clearFailureStorage = createStorageAdapter({ storage: { getItem: (key) => clearFailureBacking.get(key) ?? null, setItem: (key, value) => clearFailureBacking.set(key, value), removeItem: () => { throw new Error("locked"); } } });
clearFailureStorage.read();
const clearFailed = await clearFailureStorage.clear();
assert.equal(clearFailed.ok, false);
assert.equal(clearFailed.state.children[0].nickname, migrated.children[0].nickname);
assert.equal(clearFailureBacking.has(STORAGE_KEY), true);

const conflictBacking = new Map();
const conflictStorage = createStorageAdapter({ storage: { getItem: (key) => conflictBacking.get(key) ?? null, setItem: (key, value) => conflictBacking.set(key, value), removeItem: (key) => conflictBacking.delete(key) } });
conflictStorage.read();
conflictBacking.set(STORAGE_KEY, JSON.stringify({ ...migrated, children: [{ ...migrated.children[0], nickname: "另一页面" }] }));
const conflicted = await conflictStorage.write(migrated);
assert.equal(conflicted.ok, false);
assert.equal(conflicted.error, "storage-conflict");
assert.equal(conflicted.state.children[0].nickname, "另一页面", "a conflict returns the newer persisted family instead of the stale caller snapshot");
assert.equal(JSON.parse(conflictBacking.get(STORAGE_KEY)).children[0].nickname, "另一页面");

const concurrentBacking = new Map();
const concurrentBackend = { getItem: (key) => concurrentBacking.get(key) ?? null, setItem: (key, value) => concurrentBacking.set(key, value), removeItem: (key) => concurrentBacking.delete(key) };
const tabA = createStorageAdapter({ storage: concurrentBackend });
const tabB = createStorageAdapter({ storage: concurrentBackend });
tabA.read(); tabB.read();
const stateA = { ...migrated, children: [{ ...migrated.children[0], nickname: "标签A" }] };
const stateB = { ...migrated, children: [{ ...migrated.children[0], nickname: "标签B" }] };
const [resultA, resultB] = await Promise.all([tabA.write(stateA), tabB.write(stateB)]);
assert.equal([resultA.ok, resultB.ok].filter(Boolean).length, 1, "truly concurrent writers cannot both report success");
assert.equal([resultA.error, resultB.error].includes("storage-conflict"), true);
assert.equal(["标签A", "标签B"].includes(JSON.parse(concurrentBacking.get(STORAGE_KEY)).children[0].nickname), true);

let writeGetCount = 0;
const unknownWriteBacking = new Map();
const unknownWrite = createStorageAdapter({ storage: {
  getItem: (key) => { writeGetCount += 1; if (writeGetCount > 1) throw new Error("read-after-write-failed"); return unknownWriteBacking.get(key) ?? null; },
  setItem: (key, value) => unknownWriteBacking.set(key, value), removeItem: (key) => unknownWriteBacking.delete(key),
} });
const unknownWriteResult = await unknownWrite.write(migrated);
assert.equal(unknownWriteResult.ok, false);
assert.equal(unknownWriteResult.error, "unknown-commit-state");
assert.equal(unknownWriteBacking.has(STORAGE_KEY), true, "unknown means the mutation may have committed");

let clearGetCount = 0;
const unknownClearBacking = new Map([[STORAGE_KEY, JSON.stringify(migrated)]]);
const unknownClear = createStorageAdapter({ storage: {
  getItem: (key) => { clearGetCount += 1; if (clearGetCount > 2) throw new Error("read-after-clear-failed"); return unknownClearBacking.get(key) ?? null; },
  setItem: (key, value) => unknownClearBacking.set(key, value), removeItem: (key) => unknownClearBacking.delete(key),
} });
unknownClear.read();
const unknownClearResult = await unknownClear.clear();
assert.equal(unknownClearResult.ok, false);
assert.equal(unknownClearResult.error, "unknown-commit-state");
assert.equal(unknownClearBacking.has(STORAGE_KEY), false, "unknown means the clear may have committed");

const truncatedV2 = structuredClone(migrated);
truncatedV2.agreements[0].problem = "很".repeat(501);
assert.throws(() => normalizeState(truncatedV2, { strict: true }), /静默修正/);
const fractionalPeak = structuredClone(migrated);
fractionalPeak.petPeaks[child.id] = 1.5;
assert.throws(() => normalizeState(fractionalPeak, { strict: true }));

console.log("Data contract checks passed: V2 shape, reviewedAt migration, invalid-local isolation, idempotent V1 migration, credential stripping, and storage failure status.");
