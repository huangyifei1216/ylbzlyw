import assert from "node:assert/strict";
import {
  DATA_CONTRACT_VERSION,
  STORAGE_KEY,
  createStorageAdapter,
  emptyState,
  migrateState,
  normalizeState,
} from "../data-contract.mjs";

assert.equal(DATA_CONTRACT_VERSION, 1);
assert.equal(STORAGE_KEY, "ylb.v5.state");

const blank = normalizeState(null);
assert.equal(blank.schemaVersion, 1);
assert.equal(blank.version, 5);
assert.deepEqual(blank.children, []);
assert.deepEqual(blank.checkins, {});
assert.deepEqual(blank.settings, { handbookUrl: "" });

const childA = { id: "child-a", nickname: "菲菲", birthDate: "2020-05-18" };
const childB = { id: "child-b", nickname: "小宇", birthDate: "2017-08-01" };
const agreementA = {
  id: "agreement-a", childId: "child-a", problem: "写作业磨蹭", childAction: "先做十分钟",
  parentAction: "不连续催", duration: 7, startDate: "2026-08-24", endDate: "2026-08-30",
  status: "active", wishCost: 9,
};
const agreementB = { ...agreementA, id: "agreement-b", childId: "child-b" };

const normalized = normalizeState({
  version: 4,
  entitlement: { scope: "all", stageId: "all", label: "0—18岁", status: "active" },
  children: [childA, childB, childA, { id: "bad id", nickname: "", birthDate: "nope" }],
  currentChildId: "missing-child",
  agreements: [agreementA, agreementB, { id: "orphan", childId: "missing-child" }],
  checkins: {
    "agreement-a:2026-08-24": { agreementId: "agreement-a", childId: "child-a", child: true, parent: true },
    "agreement-b:2026-08-24": { agreementId: "agreement-b", childId: "child-a", child: true, parent: true },
    "agreement-a:2026-08-25": { agreementId: "agreement-a", child: "yes", parent: false, date: "2026-08-25" },
  },
  petPeaks: { "child-a": 4, "child-b": "bad", stranger: 99 },
  redemptions: [{ id: "r1", agreementId: "agreement-a", childId: "child-b", cost: 9 }],
  settings: { handbookUrl: " https://example.test/handbook " },
});

assert.deepEqual(normalized.children.map((item) => item.id), ["child-a", "child-b"]);
assert.equal(normalized.currentChildId, "child-a");
assert.deepEqual(normalized.agreements.map((item) => item.id), ["agreement-a", "agreement-b"]);
assert.deepEqual(Object.keys(normalized.checkins), ["agreement-a:2026-08-24", "agreement-a:2026-08-25"]);
assert.equal(normalized.checkins["agreement-a:2026-08-25"].child, true);
assert.deepEqual(normalized.petPeaks, { "child-a": 4, "child-b": 0 });
assert.deepEqual(normalized.redemptions, []);
assert.equal(normalized.settings.handbookUrl, "https://example.test/handbook");
assert.equal(normalizeState({ settings: { handbookUrl: "javascript:alert(1)" } }).settings.handbookUrl, "");

const exported = { product: "一两步", version: 5, data: { ...emptyState(), children: [childA] } };
assert.equal(migrateState(exported).schemaVersion, 1);
assert.equal(normalizeState(exported).children[0].id, "child-a");

const backing = new Map();
const fakeStorage = {
  getItem: (key) => backing.get(key) ?? null,
  setItem: (key, value) => backing.set(key, value),
  removeItem: (key) => backing.delete(key),
};
const storage = createStorageAdapter({ storage: fakeStorage });
const written = storage.write(normalized);
assert.equal(written.schemaVersion, 1);
assert.ok(backing.has(STORAGE_KEY));
assert.equal(storage.read().children.length, 2);
storage.clear();
assert.equal(storage.read().children.length, 0);
backing.set(STORAGE_KEY, "{bad json");
assert.equal(storage.read().schemaVersion, 1);
assert.equal(storage.read().children.length, 0);
const lockedStorage = createStorageAdapter({
  storage: { getItem: () => null, setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("locked"); } },
});
assert.equal(lockedStorage.write(normalized).schemaVersion, 1);
assert.doesNotThrow(() => lockedStorage.clear());

console.log("Data contract checks passed: migration, normalization, child isolation, and storage adapter.");
