import assert from "node:assert/strict";
import { DATA_CONTRACT_VERSION, PRODUCT_VERSION, STORAGE_KEY, createStorageAdapter, emptyState, migrateState, normalizeState } from "../data-contract.mjs";

assert.equal(DATA_CONTRACT_VERSION, 2);
assert.equal(PRODUCT_VERSION, 5.1);
assert.equal(STORAGE_KEY, "ylb.v5.state");
assert.deepEqual(Object.keys(emptyState()), ["schemaVersion", "version", "entitlement", "children", "currentChildId", "agreements", "records", "fruitTransactions", "wishes", "petPeaks", "settings", "bridgeSeen", "demo"]);

const child = { id: "child-a", nickname: "菲菲", birthDate: "2020-05-18" };
const agreement = { id: "agreement-a", childId: child.id, problemId: "s3-morning", problem: "早上出门慢", childAction: "先穿鞋", parentAction: "只提醒一次", duration: 7, startDate: "2026-08-24", endDate: "2026-08-30", status: "active", wishTitle: "一起看电影", wishIcon: "🎬", wishCost: 9 };
const v1 = { schemaVersion: 1, entitlement: { scope: "all", stageId: "all", label: "全龄", status: "active", recoveryCode: "SECRET" }, children: [child], currentChildId: child.id, agreements: [agreement], checkins: { "agreement-a:2026-08-24": { agreementId: agreement.id, childId: child.id, date: "2026-08-24", child: true, parent: true } }, redemptions: [], petPeaks: { [child.id]: 3 } };
const migrated = normalizeState(v1);
assert.equal(migrated.schemaVersion, 2);
assert.equal(migrated.version, 5.1);
assert.equal("recoveryCode" in migrated.entitlement, false);
assert.equal(migrated.agreements[0].stageId, "s3");
assert.equal(migrated.agreements[0].recordMode, "daily");
assert.equal(Object.keys(migrated.records).length, 2);
assert.deepEqual(migrated.fruitTransactions.map((item) => item.amount), [1, 1, 1]);
assert.equal(migrated.wishes.length, 1);
assert.deepEqual(normalizeState(migrated), migrated, "V2 normalization must be idempotent");
assert.deepEqual(normalizeState(migrateState(v1)), migrated, "V1 migration must be idempotent");

const backing = new Map();
const storage = createStorageAdapter({ storage: { getItem: (key) => backing.get(key) ?? null, setItem: (key, value) => backing.set(key, value), removeItem: (key) => backing.delete(key) } });
const written = storage.write(migrated);
assert.equal(written.ok, true);
assert.equal(written.state.schemaVersion, 2);
assert.equal(storage.read().children.length, 1);
assert.equal(storage.clear().ok, true);

const locked = createStorageAdapter({ storage: { getItem: () => null, setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("locked"); } } });
const failed = locked.write(migrated);
assert.equal(failed.ok, false);
assert.equal(failed.state.children.length, 1);
assert.match(failed.error, /quota/);
assert.equal(locked.clear().ok, false);

console.log("Data contract checks passed: V2 shape, idempotent V1 migration, credential stripping, and storage failure status.");
