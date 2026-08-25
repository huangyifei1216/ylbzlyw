import assert from "node:assert/strict";
import {
  BACKUP_PRODUCT,
  BackupValidationError,
  applyPreparedBackup,
  createFamilyBackup,
  importFamilyBackup,
  parseFamilyBackup,
  prepareBackupImport,
  stringifyFamilyBackup,
} from "../backup.mjs";
import { normalizeState } from "../data-contract.mjs";

const NOW = new Date("2026-08-25T04:00:00.000Z");
const entitlementAll = { scope: "all", stageId: "all", label: "0—18岁", status: "active", recoveryCode: "SECRET-CODE" };
const childA = { id: "child-a", nickname: "菲菲", birthDate: "2020-05-18", createdAt: NOW.toISOString() };
const childB = { id: "child-b", nickname: "小宇", birthDate: "2017-08-01", createdAt: NOW.toISOString() };
const agreementA = {
  id: "agreement-a", childId: "child-a", stageId: "s3", templateId: "s3-bedtime", templateVersion: 1,
  problem: "睡前拖延", childAction: "选一本书", parentAction: "提前放下手机", recordMode: "daily",
  duration: 7, startDate: "2026-08-25", endDate: "2026-08-31", wishId: "wish-a", status: "active", review: null, createdAt: NOW.toISOString(),
};
const agreementB = { ...agreementA, id: "agreement-b", childId: "child-b", stageId: "s4", templateId: "s4-homework", wishId: "" };
const recordA = { id: "record-a", childId: "child-a", agreementId: "agreement-a", role: "child", periodKey: "2026-08-25", localDate: "2026-08-25", recordedAt: NOW.toISOString(), reversedAt: "" };
const recordB = { id: "record-b", childId: "child-b", agreementId: "agreement-b", role: "parent", periodKey: "2026-08-25", localDate: "2026-08-25", recordedAt: NOW.toISOString(), reversedAt: "" };

const source = normalizeState({
  schemaVersion: 2,
  entitlement: entitlementAll,
  children: [childA, childB], currentChildId: childB.id,
  agreements: [agreementA, agreementB], records: { [recordA.id]: recordA, [recordB.id]: recordB },
  fruitTransactions: [
    { id: "fruit-a", childId: childA.id, agreementId: agreementA.id, recordId: recordA.id, wishId: "", type: "child-step", amount: 1, createdAt: NOW.toISOString(), reversedTransactionId: "" },
    { id: "fruit-b", childId: childB.id, agreementId: agreementB.id, recordId: recordB.id, wishId: "", type: "parent-step", amount: 1, createdAt: NOW.toISOString(), reversedTransactionId: "" },
  ],
  wishes: [{ id: "wish-a", childId: childA.id, title: "一起散步", icon: "🐘", cost: 1, status: "completed", createdAt: NOW.toISOString(), scheduledDate: "2026-08-25", completedAt: NOW.toISOString(), cancelledAt: "" }],
  petPeaks: { [childA.id]: 1, [childB.id]: 1 },
  settings: { handbookUrl: "https://current.example/handbook" }, bridgeSeen: true,
});

// 1. Export contains family data but no credentials, entitlement, payment or handbook URL.
const json = stringifyFamilyBackup({ ...source, entitlement: entitlementAll, activationCode: "ACTIVATE", payment: { amount: 99 } }, { now: NOW });
assert.doesNotMatch(json, /SECRET-CODE|ACTIVATE|recoveryCode|activationCode|entitlement|payment|handbookUrl/);
const envelope = JSON.parse(json);
assert.equal(envelope.product, BACKUP_PRODUCT);
assert.equal(envelope.exportedAt, NOW.toISOString());

// 2. Preparing/import preview is read-only and includes the four required counts.
const current = normalizeState({ schemaVersion: 2, entitlement: entitlementAll, children: [{ ...childA, nickname: "当前档案" }], settings: { handbookUrl: "https://current.example/handbook" }, bridgeSeen: false });
const before = structuredClone(current);
const prepared = prepareBackupImport(current, json, { now: NOW });
assert.deepEqual(current, before);
assert.deepEqual(prepared.preview, { exportedAt: NOW.toISOString(), childCount: 2, agreementCount: 2, memoryCount: 1 });
assert.throws(() => applyPreparedBackup(current, prepared), error("confirmation-required"));

// Successful replacement preserves this device's entitlement/settings/bridge state.
const imported = applyPreparedBackup(current, prepared, { confirmed: true });
assert.deepEqual(imported.entitlement, current.entitlement);
assert.deepEqual(imported.settings, current.settings);
assert.equal(imported.bridgeSeen, current.bridgeSeen);
assert.equal(imported.children.length, 2);
assert.equal(imported.currentChildId, childB.id);

// 3–5. Invalid product, damaged JSON and unknown future schemas are rejected.
assert.throws(() => parseFamilyBackup(JSON.stringify({ ...envelope, product: "别的产品" })), error("wrong-product"));
assert.throws(() => parseFamilyBackup("{broken"), error("invalid-json"));
assert.throws(() => parseFamilyBackup(JSON.stringify({ ...envelope, schemaVersion: 999 })), error("schema-too-new"));
assert.throws(() => parseFamilyBackup(JSON.stringify({ ...envelope, backupVersion: 999 })), error("backup-too-new"));

// 6. A legacy V1 export migrates check-ins and redemptions into the V2 model.
const legacy = {
  product: BACKUP_PRODUCT, version: 5, exportedAt: "2026-08-24T00:00:00.000Z",
  data: {
    schemaVersion: 1, children: [childA], currentChildId: childA.id,
    agreements: [{ ...agreementA, problemId: "s3-bedtime", wishTitle: "一起散步", wishIcon: "🐘", wishCost: 2, wishRedeemed: false }],
    checkins: { "agreement-a:2026-08-25": { agreementId: agreementA.id, childId: childA.id, date: "2026-08-25", child: true, parent: true } },
    redemptions: [], petPeaks: { [childA.id]: 3 },
  },
};
const migrated = parseFamilyBackup(JSON.stringify(legacy));
assert.equal(Object.keys(migrated.state.records).length, 2);
assert.equal(migrated.state.fruitTransactions.length, 3);
assert.equal(migrated.state.wishes.length, 1);

// 7. Any failed import leaves the caller-owned current object untouched.
const immutableBefore = structuredClone(current);
assert.throws(() => prepareBackupImport(current, "not-json", { now: NOW }), BackupValidationError);
assert.deepEqual(current, immutableBefore);

// 8. Backup entitlement can never replace current device entitlement.
const malicious = structuredClone(envelope);
malicious.data.entitlement = { scope: "all", stageId: "all", status: "active", recoveryCode: "STOLEN" };
const stageCurrent = normalizeState({ schemaVersion: 2, entitlement: { scope: "stage", stageId: "s3", label: "3—6岁", status: "active" } });
const onlyA = createFamilyBackup(normalizeState({ ...source, children: [childA], currentChildId: childA.id, agreements: [agreementA], records: { [recordA.id]: recordA }, fruitTransactions: source.fruitTransactions.slice(0, 1), wishes: source.wishes, petPeaks: { [childA.id]: 1 } }), { now: NOW });
onlyA.data.entitlement = malicious.data.entitlement;
const importedStage = importFamilyBackup(stageCurrent, onlyA, { confirmed: true, now: NOW }).state;
assert.equal(importedStage.entitlement.scope, "stage");
assert.equal(importedStage.entitlement.stageId, "s3");

// 9. Child count and unauthorized stages fail explicitly, with no truncation.
const fourChildren = structuredClone(envelope);
fourChildren.data.children.push({ id: "child-c", nickname: "小明", birthDate: "2021-01-01", createdAt: "" }, { id: "child-d", nickname: "小红", birthDate: "2022-01-01", createdAt: "" });
assert.throws(() => prepareBackupImport(current, fourChildren, { now: NOW }), error("child-limit"));
assert.throws(() => prepareBackupImport(stageCurrent, json, { now: NOW }), error("child-limit"));
const wrongStage = createFamilyBackup(normalizeState({ ...source, children: [childB], currentChildId: childB.id, agreements: [agreementB], records: { [recordB.id]: recordB }, fruitTransactions: source.fruitTransactions.slice(1), wishes: [], petPeaks: { [childB.id]: 1 } }), { now: NOW });
assert.throws(() => prepareBackupImport(stageCurrent, wrongStage, { now: NOW }), error("stage-not-entitled"));

// 10. Multi-child records, transactions and wallet ownership remain isolated.
assert.equal(imported.records[recordA.id].childId, childA.id);
assert.equal(imported.records[recordB.id].childId, childB.id);
assert.equal(imported.fruitTransactions.filter((item) => item.childId === childA.id).length, 1);
assert.equal(imported.fruitTransactions.filter((item) => item.childId === childB.id).length, 1);

// Structural failures are rejected rather than silently repaired/truncated.
const malformed = structuredClone(envelope);
malformed.data.children[0].nickname = "";
assert.throws(() => parseFamilyBackup(malformed), error("invalid-child-data"));

const invalidReview = structuredClone(envelope);
invalidReview.data.agreements[0].status = "reviewed";
invalidReview.data.agreements[0].review = { outcome: "continue", outcomeLabel: "再试一轮", outcomeIcon: "↻", reviewedAt: "not-a-time" };
assert.throws(() => parseFamilyBackup(invalidReview), error("invalid-family-state"));
const beforeRejectedImport = structuredClone(current);
assert.throws(() => prepareBackupImport(current, invalidReview, { now: NOW }), error("invalid-family-state"));
assert.deepEqual(current, beforeRejectedImport, "rejected imports must leave local family data unchanged");

const invalidAmount = structuredClone(envelope);
invalidAmount.data.fruitTransactions[0].amount = 999;
assert.throws(() => parseFamilyBackup(invalidAmount), error("invalid-family-state"));

function error(code) {
  return (caught) => caught instanceof BackupValidationError && caught.code === code;
}

console.log("Backup checks passed: safe export, preview/confirmation, V1 migration, entitlement preservation, rejection and child isolation.");
