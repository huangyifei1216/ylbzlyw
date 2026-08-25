import assert from "node:assert/strict";
import { StateInvariantError, assertStateInvariants } from "../state-invariants.mjs";

const child = { id: "child-a", nickname: "菲菲", birthDate: "2020-05-18", createdAt: "2026-08-25T00:00:00.000Z" };
const agreement = {
  id: "agreement-a", childId: child.id, stageId: "s3", templateId: "s3-a", templateVersion: 1,
  problem: "早上出门慢", childAction: "先穿鞋", parentAction: "只提醒一次", recordMode: "daily",
  duration: 3, startDate: "2026-08-25", endDate: "2026-08-27", wishId: "", status: "active", review: null,
  createdAt: "2026-08-25T00:00:00.000Z",
};
const record = { id: "record-a", childId: child.id, agreementId: agreement.id, role: "child", periodKey: "2026-08-25", localDate: "2026-08-25", recordedAt: "2026-08-25T04:00:00.000Z", reversedAt: "" };
const step = { id: "fruit-a", childId: child.id, agreementId: agreement.id, recordId: record.id, wishId: "", type: "child-step", amount: 1, createdAt: record.recordedAt, reversedTransactionId: "", periodKey: record.periodKey, relatedRecordIds: [record.id] };
const base = () => ({ schemaVersion: 2, version: "5.1.1", entitlement: null, children: [structuredClone(child)], currentChildId: child.id, agreements: [structuredClone(agreement)], records: { [record.id]: structuredClone(record) }, fruitTransactions: [structuredClone(step)], wishes: [], petPeaks: { [child.id]: 1 }, settings: { handbookUrl: "" }, bridgeSeen: false, demo: false });

assert.doesNotThrow(() => assertStateInvariants(base()));
assert.doesNotThrow(() => assertStateInvariants(base(), { today: "2026-08-28" }), "runtime home refresh may temporarily own an overdue active agreement");
assert.throws(() => assertStateInvariants(base(), { today: "2026-08-28", allowRuntimeReviewRefresh: false }), error("overdue-active-agreement"));

const twoActive = base();
twoActive.agreements.push({ ...agreement, id: "agreement-b", wishId: "" });
assert.throws(() => assertStateInvariants(twoActive), error("agreement-in-progress-conflict"));

const activeAndDue = base();
activeAndDue.agreements.push({ ...agreement, id: "agreement-b", status: "review-due" });
assert.throws(() => assertStateInvariants(activeAndDue), error("agreement-in-progress-conflict"));

const wishes = base();
wishes.wishes = [wish("wish-a"), wish("wish-b")];
assert.throws(() => assertStateInvariants(wishes), error("wish-in-progress-conflict"));

const missingReference = base();
missingReference.records[record.id].agreementId = "agreement-missing";
assert.throws(() => assertStateInvariants(missingReference), error("record-agreement-not-found"));

const zero = base();
zero.fruitTransactions[0].amount = 0;
assert.throws(() => assertStateInvariants(zero), error("invalid-transaction-amount"));

const wrongSign = base();
wrongSign.fruitTransactions[0].amount = -1;
assert.throws(() => assertStateInvariants(wrongSign), error("invalid-earned-amount"));

const invalidDate = base();
invalidDate.children[0].birthDate = "2026-02-30";
assert.throws(() => assertStateInvariants(invalidDate), error("invalid-child-birth-date"));

const duplicateRecord = base();
duplicateRecord.records["record-b"] = { ...record, id: "record-b" };
assert.throws(() => assertStateInvariants(duplicateRecord), error("duplicate-live-record"));

const negative = base();
negative.wishes = [wish("wish-a", 2)];
negative.fruitTransactions.push({ id: "spend-a", childId: child.id, agreementId: "", recordId: "", wishId: "wish-a", type: "wish-spend", amount: -2, createdAt: "2026-08-25T05:00:00.000Z", reversedTransactionId: "", periodKey: "", relatedRecordIds: [] });
assert.throws(() => assertStateInvariants(negative), error("negative-fruit-balance"));

const duplicateRefund = base();
duplicateRefund.wishes = [wish("wish-a", 1)];
const spend = { id: "spend-a", childId: child.id, agreementId: "", recordId: "", wishId: "wish-a", type: "wish-spend", amount: -1, createdAt: "2026-08-25T05:00:00.000Z", reversedTransactionId: "", periodKey: "", relatedRecordIds: [] };
duplicateRefund.fruitTransactions.push(spend,
  { ...spend, id: "refund-a", type: "wish-refund", amount: 1, createdAt: "2026-08-25T06:00:00.000Z", reversedTransactionId: spend.id },
  { ...spend, id: "refund-b", type: "wish-refund", amount: 1, createdAt: "2026-08-25T07:00:00.000Z", reversedTransactionId: spend.id });
assert.throws(() => assertStateInvariants(duplicateRefund), error("duplicate-reversal"));

console.log("State invariant checks passed: exclusivity, references, dates, live records, ledger signs, balances, and refunds.");

function wish(id, cost = 3) { return { id, childId: child.id, title: "一起散步", icon: "", cost, status: "active", createdAt: "2026-08-25T00:00:00.000Z", scheduledDate: "", completedAt: "", cancelledAt: "" }; }
function error(code) { return (caught) => caught instanceof StateInvariantError && caught.code === code; }
