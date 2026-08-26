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
const base = () => ({ schemaVersion: 2, version: "5.1.4", entitlement: null, children: [structuredClone(child)], currentChildId: child.id, agreements: [structuredClone(agreement)], records: { [record.id]: structuredClone(record) }, fruitTransactions: [structuredClone(step)], wishes: [], petPeaks: { [child.id]: 1 }, settings: { handbookUrl: "" }, bridgeSeen: false, demo: false });

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

const futureBirth = base();
futureBirth.children[0].birthDate = "2030-01-01";
assert.throws(() => assertStateInvariants(futureBirth, { today: "2026-08-26" }), error("future-child-birth-date"));

const implausibleBirth = base();
implausibleBirth.children[0].birthDate = "1899-12-31";
assert.throws(() => assertStateInvariants(implausibleBirth), error("implausible-child-birth-date"));

const wrongAgeStage = base();
wrongAgeStage.agreements[0].stageId = "s4";
assert.throws(() => assertStateInvariants(wrongAgeStage), error("agreement-stage-age-mismatch"));

for (const field of ["problem", "childAction", "parentAction"]) {
  const unsafe = base();
  unsafe.agreements[0][field] = field === "problem" ? "孩子说不想活" : field === "childAction" ? "有自伤冲动时忍住" : "自行调整药量";
  assert.throws(() => assertStateInvariants(unsafe), error("unsafe-agreement"));
}

const duplicateRecord = base();
duplicateRecord.records["record-b"] = { ...record, id: "record-b" };
assert.throws(() => assertStateInvariants(duplicateRecord), error("duplicate-live-record"));

const negative = base();
negative.wishes = [wish("wish-a", 2)];
negative.wishes[0].status = "scheduled";
negative.fruitTransactions.push({ id: "spend-a", childId: child.id, agreementId: "", recordId: "", wishId: "wish-a", type: "wish-spend", amount: -2, createdAt: "2026-08-25T05:00:00.000Z", reversedTransactionId: "", periodKey: "", relatedRecordIds: [] });
assert.throws(() => assertStateInvariants(negative), error("negative-fruit-balance"));

const duplicateRefund = base();
duplicateRefund.wishes = [wish("wish-a", 1)];
const spend = { id: "spend-a", childId: child.id, agreementId: "", recordId: "", wishId: "wish-a", type: "wish-spend", amount: -1, createdAt: "2026-08-25T05:00:00.000Z", reversedTransactionId: "", periodKey: "", relatedRecordIds: [] };
duplicateRefund.fruitTransactions.push(spend,
  { ...spend, id: "refund-a", type: "wish-refund", amount: 1, createdAt: "2026-08-25T06:00:00.000Z", reversedTransactionId: spend.id },
  { ...spend, id: "refund-b", type: "wish-refund", amount: 1, createdAt: "2026-08-25T07:00:00.000Z", reversedTransactionId: spend.id });
assert.throws(() => assertStateInvariants(duplicateRefund), error("duplicate-reversal"));

const wrongMode = base();
wrongMode.agreements[0].recordMode = "once-per-cycle";
assert.throws(() => assertStateInvariants(wrongMode), error("stage-record-mode-mismatch"));

const earlyReview = base();
earlyReview.agreements[0].review = { outcome: "continue", outcomeLabel: "再试一轮", outcomeIcon: "↻", reviewedAt: "2026-08-25T05:00:00.000Z" };
assert.throws(() => assertStateInvariants(earlyReview), error("unexpected-review"));

const missingStep = base();
missingStep.fruitTransactions = [];
assert.throws(() => assertStateInvariants(missingStep), error("record-step-cardinality"));

const wrongStepPeriod = base();
wrongStepPeriod.fruitTransactions[0].periodKey = "2026-08-26";
assert.throws(() => assertStateInvariants(wrongStepPeriod), error("record-step-mismatch"));

const pairWithoutCompanion = base();
const parentRecord = { ...record, id: "record-parent", role: "parent" };
pairWithoutCompanion.records[parentRecord.id] = parentRecord;
pairWithoutCompanion.fruitTransactions.push({ ...step, id: "fruit-parent", recordId: parentRecord.id, type: "parent-step", relatedRecordIds: [parentRecord.id] });
pairWithoutCompanion.petPeaks[child.id] = 2;
assert.throws(() => assertStateInvariants(pairWithoutCompanion), error("companion-cardinality"));

const lowPeak = base();
lowPeak.petPeaks[child.id] = 0;
assert.throws(() => assertStateInvariants(lowPeak), error("pet-peak-mismatch"));
const inflatedPeak = base();
inflatedPeak.petPeaks[child.id] = 60;
assert.throws(() => assertStateInvariants(inflatedPeak), error("pet-peak-mismatch"));

const scheduledWithoutSpend = base();
scheduledWithoutSpend.wishes = [{ ...wish("wish-a", 1), status: "scheduled" }];
assert.throws(() => assertStateInvariants(scheduledWithoutSpend), error("wish-spend-status-mismatch"));

const invalidIcon = base();
invalidIcon.wishes = [{ ...wish("wish-a"), icon: "<style>/*" }];
assert.throws(() => assertStateInvariants(invalidIcon), error("invalid-wish-icon"));

const invalidOutcome = reviewedBase("continue");
invalidOutcome.agreements[0].review.outcome = "anything";
assert.throws(() => assertStateInvariants(invalidOutcome), error("invalid-review-outcome"));

const pausedContinue = reviewedBase("continue", "paused");
assert.throws(() => assertStateInvariants(pausedContinue), error("review-status-mismatch"));
const reviewedPause = reviewedBase("pause", "reviewed");
assert.throws(() => assertStateInvariants(reviewedPause), error("review-status-mismatch"));
const beforeCycleEnd = reviewedBase("continue");
beforeCycleEnd.agreements[0].review.reviewedAt = "2026-08-27T04:00:00.000Z";
assert.throws(() => assertStateInvariants(beforeCycleEnd), error("review-before-cycle-end"));

for (const [field, code] of [["child", "invalid-child-created-at"], ["agreement", "invalid-agreement-created-at"], ["wish", "invalid-wish-created-at"]]) {
  const candidate = base();
  if (field === "child") candidate.children[0].createdAt = "bad";
  if (field === "agreement") candidate.agreements[0].createdAt = "bad";
  if (field === "wish") { candidate.wishes = [wish("wish-a")]; candidate.wishes[0].createdAt = "bad"; }
  assert.throws(() => assertStateInvariants(candidate), error(code));
}

const wrongLocalDate = base();
wrongLocalDate.records[record.id].recordedAt = "2026-08-24T15:00:00.000Z";
wrongLocalDate.fruitTransactions[0].createdAt = wrongLocalDate.records[record.id].recordedAt;
assert.throws(() => assertStateInvariants(wrongLocalDate), error("record-local-date-mismatch"));

const wrongStepTime = base();
wrongStepTime.fruitTransactions[0].createdAt = "2026-08-25T05:00:00.000Z";
assert.throws(() => assertStateInvariants(wrongStepTime), error("step-time-mismatch"));

const historicalNegative = base();
historicalNegative.wishes = [{ ...wish("wish-a", 1), status: "scheduled" }];
historicalNegative.fruitTransactions.unshift({ id: "spend-early", childId: child.id, agreementId: "", recordId: "", wishId: "wish-a", type: "wish-spend", amount: -1, createdAt: "2026-08-25T03:00:00.000Z", reversedTransactionId: "", periodKey: "", relatedRecordIds: [] });
assert.throws(() => assertStateInvariants(historicalNegative), error("negative-fruit-balance"));

const companionBeforeRecords = pairState();
companionBeforeRecords.fruitTransactions.push({ id: "companion-a", childId: child.id, agreementId: agreement.id, recordId: "record-parent", wishId: "", type: "companion", amount: 1, createdAt: "2026-08-25T03:59:59.000Z", reversedTransactionId: "", periodKey: record.periodKey, relatedRecordIds: [record.id, "record-parent"] });
companionBeforeRecords.petPeaks[child.id] = 3;
assert.throws(() => assertStateInvariants(companionBeforeRecords), error("companion-time-mismatch"));

const companionLongAfterRecords = pairState();
companionLongAfterRecords.fruitTransactions.push({ id: "companion-late", childId: child.id, agreementId: agreement.id, recordId: "record-parent", wishId: "", type: "companion", amount: 1, createdAt: "2027-08-25T04:00:00.000Z", reversedTransactionId: "", periodKey: record.periodKey, relatedRecordIds: [record.id, "record-parent"] });
companionLongAfterRecords.petPeaks[child.id] = 3;
assert.throws(() => assertStateInvariants(companionLongAfterRecords), error("companion-time-mismatch"));

const lateReversal = reversedPairState();
lateReversal.records[record.id].reversedAt = "2026-08-26T04:00:00.000Z";
lateReversal.fruitTransactions.filter((item) => item.type === "record-reversal").forEach((item) => { item.createdAt = lateReversal.records[record.id].reversedAt; });
assert.throws(() => assertStateInvariants(lateReversal), error("reversal-window-expired"));

const spendBeforeWish = base();
spendBeforeWish.wishes = [{ ...wish("wish-a", 1), status: "scheduled", createdAt: "2026-08-25T06:00:00.000Z" }];
spendBeforeWish.fruitTransactions.push({ id: "spend-before-wish", childId: child.id, agreementId: "", recordId: "", wishId: "wish-a", type: "wish-spend", amount: -1, createdAt: "2026-08-25T05:00:00.000Z", reversedTransactionId: "", periodKey: "", relatedRecordIds: [] });
assert.throws(() => assertStateInvariants(spendBeforeWish), error("wish-spend-before-created"));

const cancelledBeforeRefund = base();
cancelledBeforeRefund.wishes = [{ ...wish("wish-a", 1), status: "cancelled", cancelledAt: "2026-08-25T05:30:00.000Z" }];
const cancelledSpend = { id: "cancelled-spend", childId: child.id, agreementId: "", recordId: "", wishId: "wish-a", type: "wish-spend", amount: -1, createdAt: "2026-08-25T05:00:00.000Z", reversedTransactionId: "", periodKey: "", relatedRecordIds: [] };
cancelledBeforeRefund.fruitTransactions.push(cancelledSpend, { ...cancelledSpend, id: "late-refund", type: "wish-refund", amount: 1, createdAt: "2026-08-25T06:00:00.000Z", reversedTransactionId: cancelledSpend.id });
assert.throws(() => assertStateInvariants(cancelledBeforeRefund), error("wish-transaction-after-cancel"));

const sameTimeRefund = base();
sameTimeRefund.wishes = [{ ...wish("wish-a", 1), status: "active" }];
const sameSpend = { id: "same-spend", childId: child.id, agreementId: "", recordId: "", wishId: "wish-a", type: "wish-spend", amount: -1, createdAt: "2026-08-25T05:00:00.000Z", reversedTransactionId: "", periodKey: "", relatedRecordIds: [] };
sameTimeRefund.fruitTransactions.push(sameSpend, { ...sameSpend, id: "same-refund", type: "wish-refund", amount: 1, reversedTransactionId: sameSpend.id });
assert.throws(() => assertStateInvariants(sameTimeRefund), error("refund-before-spend"));

const activeWithDate = base();
activeWithDate.wishes = [{ ...wish("wish-a"), scheduledDate: "2026-08-30" }];
assert.throws(() => assertStateInvariants(activeWithDate), error("wish-status-time-mismatch"));

const validReversedPair = reversedPairState();
assert.doesNotThrow(() => assertStateInvariants(validReversedPair));
const orphanedCompanionReversal = structuredClone(validReversedPair);
orphanedCompanionReversal.fruitTransactions.find((item) => item.id === "reverse-companion").recordId = "record-parent";
assert.throws(() => assertStateInvariants(orphanedCompanionReversal), error("companion-reversal-mismatch"));

console.log("State invariant checks passed: exclusivity, references, dates, live records, ledger signs, balances, and refunds.");

function wish(id, cost = 3) { return { id, childId: child.id, title: "一起散步", icon: "✨", cost, status: "active", createdAt: "2026-08-25T00:00:00.000Z", scheduledDate: "", completedAt: "", cancelledAt: "" }; }
function reviewedBase(outcome, status = "reviewed") { const candidate = base(); candidate.agreements[0].status = status; candidate.agreements[0].review = { outcome, outcomeLabel: "回顾结果", outcomeIcon: "↻", reviewedAt: "2026-08-28T04:00:00.000Z" }; return candidate; }
function pairState() { const candidate = base(); const parent = { ...record, id: "record-parent", role: "parent" }; candidate.records[parent.id] = parent; candidate.fruitTransactions.push({ ...step, id: "fruit-parent", recordId: parent.id, type: "parent-step", relatedRecordIds: [parent.id] }); candidate.petPeaks[child.id] = 2; return candidate; }
function reversedPairState() {
  const candidate = pairState();
  candidate.fruitTransactions.push({ id: "companion-valid", childId: child.id, agreementId: agreement.id, recordId: "record-parent", wishId: "", type: "companion", amount: 1, createdAt: record.recordedAt, reversedTransactionId: "", periodKey: record.periodKey, relatedRecordIds: [record.id, "record-parent"] });
  candidate.records[record.id].reversedAt = "2026-08-25T04:05:00.000Z";
  candidate.fruitTransactions.push(
    { id: "reverse-step", childId: child.id, agreementId: agreement.id, recordId: record.id, wishId: "", type: "record-reversal", amount: -1, createdAt: candidate.records[record.id].reversedAt, reversedTransactionId: step.id, periodKey: record.periodKey, relatedRecordIds: [record.id] },
    { id: "reverse-companion", childId: child.id, agreementId: agreement.id, recordId: record.id, wishId: "", type: "record-reversal", amount: -1, createdAt: candidate.records[record.id].reversedAt, reversedTransactionId: "companion-valid", periodKey: record.periodKey, relatedRecordIds: [record.id, "record-parent"] },
  );
  candidate.petPeaks[child.id] = 3;
  return candidate;
}
function error(code) { return (caught) => caught instanceof StateInvariantError && caught.code === code; }
