import assert from "node:assert/strict";
import { DomainRuleError } from "../agreement-engine.mjs";
import { appendFruitTransaction, recordStep, reverseRecord, walletFor } from "../fruit-ledger.mjs";

const daily = {
  id: "agreement-a", childId: "child-a", recordMode: "daily", startDate: "2026-08-25", endDate: "2026-08-31",
};
const cycle = { ...daily, id: "agreement-cycle", recordMode: "once-per-cycle" };
const empty = () => ({ records: {}, transactions: [], petPeaks: {} });
const at = (minute) => `2026-08-25T04:${String(minute).padStart(2, "0")}:00.000Z`;

let state = recordStep(empty(), { agreement: daily, role: "child", localDate: "2026-08-25", recordedAt: at(0) });
assert.equal(walletFor(state.transactions, "child-a").available, 1);
assert.equal(state.addedTransactions[0].type, "child-step");
state = recordStep(state, { agreement: daily, role: "parent", localDate: "2026-08-25", recordedAt: at(1) });
assert.deepEqual(walletFor(state.transactions, "child-a"), { available: 3, totalEarned: 3, earned: 3, reversed: 0, spent: 0, refunded: 0 });
assert.equal(state.addedTransactions.some((item) => item.type === "companion"), true);
assert.equal(state.petPeaks["child-a"], 3);
assert.throws(() => walletFor([...state.transactions, state.transactions[0]], "child-a"), error("duplicate-transaction-id"));

const duplicate = recordStep(state, { agreement: daily, role: "parent", localDate: "2026-08-25", recordedAt: at(2) });
assert.equal(duplicate.duplicate, true);
assert.equal(duplicate.transactions.length, state.transactions.length);
const nextDay = recordStep(state, { agreement: daily, role: "child", localDate: "2026-08-26", recordedAt: "2026-08-26T04:00:00.000Z" });
assert.equal(walletFor(nextDay.transactions, "child-a").available, 4);

let weekly = recordStep(empty(), { agreement: cycle, role: "child", localDate: "2026-08-25", recordedAt: at(0) });
const weeklyAgain = recordStep(weekly, { agreement: cycle, role: "child", localDate: "2026-08-26", recordedAt: "2026-08-26T04:00:00.000Z" });
assert.equal(weeklyAgain.duplicate, true);
weekly = recordStep(weekly, { agreement: cycle, role: "parent", localDate: "2026-08-28", recordedAt: "2026-08-28T04:00:00.000Z" });
assert.equal(walletFor(weekly.transactions, "child-a").available, 3);

const parentRecord = Object.values(state.records).find((item) => item.role === "parent");
const reversed = reverseRecord(state, { recordId: parentRecord.id, reversedAt: at(5) });
assert.equal(walletFor(reversed.transactions, "child-a").available, 1);
assert.equal(reversed.addedTransactions.length, 2);
assert.equal(reversed.petPeaks["child-a"], 3);
assert.throws(() => reverseRecord(state, { recordId: parentRecord.id, reversedAt: at(12) }), error("reversal-window-expired"));

const spentTransactions = appendFruitTransaction(state.transactions, {
  id: "spend-a", childId: "child-a", agreementId: "", recordId: "", wishId: "wish-a",
  type: "wish-spend", amount: -2, createdAt: at(3), reversedTransactionId: "",
});
assert.throws(() => reverseRecord({ ...state, transactions: spentTransactions }, { recordId: parentRecord.id, reversedAt: at(5) }), error("fruit-already-spent"));
assert.equal(state.records[parentRecord.id].reversedAt, null);
assert.equal(spentTransactions.length, 4);

const childB = { ...daily, id: "agreement-b", childId: "child-b" };
const withB = recordStep(state, { agreement: childB, role: "child", localDate: "2026-08-25", recordedAt: at(3) });
assert.equal(walletFor(withB.transactions, "child-a").available, 3);
assert.equal(walletFor(withB.transactions, "child-b").available, 1);
assert.equal(withB.petPeaks["child-a"], 3);
assert.equal(withB.petPeaks["child-b"], 1);

const afterSpend = appendFruitTransaction(state.transactions, {
  id: "spend-b", childId: "child-a", agreementId: "", recordId: "", wishId: "wish-b",
  type: "wish-spend", amount: -2, createdAt: at(4), reversedTransactionId: "",
});
assert.equal(walletFor(afterSpend, "child-a").totalEarned, 3);
assert.equal(walletFor(afterSpend, "child-a").available, 1);
assert.equal(state.petPeaks["child-a"], 3);

console.log("Fruit ledger checks passed: 1+1+1, idempotency, record modes, reversals, nonnegative balance, child isolation, and pet peaks.");

function error(code) { return (value) => value instanceof DomainRuleError && value.code === code; }
