import assert from "node:assert/strict";
import { DomainRuleError } from "../agreement-engine.mjs";
import { recordStep, walletFor } from "../fruit-ledger.mjs";
import { abandonWish, canScheduleWish, completeWish, createWish, scheduleWish, unscheduleWish } from "../wish-engine.mjs";

const agreement = { id: "agreement-a", childId: "child-a", recordMode: "daily", startDate: "2026-08-25", endDate: "2026-08-31", status: "active" };
const at = (day, minute = 0) => `2026-08-${String(day).padStart(2, "0")}T04:${String(minute).padStart(2, "0")}:00.000Z`;
let ledger = { records: {}, transactions: [], petPeaks: {} };
ledger = recordStep(ledger, { agreement, role: "child", localDate: "2026-08-25", recordedAt: at(25) });

let result = createWish([], { id: "wish-a", childId: "child-a", title: "一起散步", icon: "🌳", cost: 3 }, { createdAt: at(25) });
assert.equal(result.wish.status, "active");
assert.equal(canScheduleWish(result.wish, ledger.transactions), false);
assert.throws(() => scheduleWish(result.wishes, ledger.transactions, "wish-a"), error("insufficient-fruit"));
assert.throws(() => createWish(result.wishes, { id: "wish-b", childId: "child-a", title: "家庭电影", cost: 3 }), error("wish-in-progress"));
assert.throws(() => createWish([], { childId: "child-a", title: "一", cost: 3 }), error("invalid-wish-title"));

ledger = recordStep(ledger, { agreement, role: "parent", localDate: "2026-08-25", recordedAt: at(25, 1) });
assert.equal(canScheduleWish(result.wish, ledger.transactions), true);
const scheduled = scheduleWish(result.wishes, ledger.transactions, "wish-a", { scheduledDate: "2026-09-01", createdAt: at(25, 2) });
assert.equal(scheduled.wish.status, "scheduled");
assert.equal(scheduled.wish.completedAt, "");
assert.equal(walletFor(scheduled.transactions, "child-a").available, 0);
assert.equal(walletFor(scheduled.transactions, "child-a").totalEarned, 3);

const completed = completeWish(scheduled.wishes, "wish-a", { completedAt: "2026-09-01T10:00:00.000Z" });
assert.equal(completed.wish.status, "completed");
assert.equal(completed.memory.wishId, "wish-a");
assert.throws(() => completeWish(completed.wishes, "wish-a"), error("wish-not-scheduled"));
assert.throws(() => unscheduleWish(completed.wishes, scheduled.transactions, "wish-a"), error("completed-wish"));
assert.throws(() => abandonWish(completed.wishes, scheduled.transactions, "wish-a"), error("completed-wish"));

const wish2 = createWish([], { id: "wish-c", childId: "child-a", title: "一起做饭", icon: "🍲", cost: 3 }, { createdAt: at(26) });
const scheduled2 = scheduleWish(wish2.wishes, ledger.transactions, "wish-c", { createdAt: at(26, 1) });
const unscheduled = unscheduleWish(scheduled2.wishes, scheduled2.transactions, "wish-c", { unscheduledAt: at(26, 2) });
assert.equal(unscheduled.wish.status, "active");
assert.equal(unscheduled.wish.title, "一起做饭");
assert.equal(walletFor(unscheduled.transactions, "child-a").available, 3);
assert.equal(walletFor(unscheduled.transactions, "child-a").totalEarned, 3);
assert.throws(() => unscheduleWish(unscheduled.wishes, unscheduled.transactions, "wish-c"), error("wish-not-scheduled"));

const rescheduled = scheduleWish(unscheduled.wishes, unscheduled.transactions, "wish-c", { scheduledDate: "2026-09-02", createdAt: at(26, 3) });
assert.notEqual(rescheduled.transaction.id, scheduled2.transaction.id);
assert.equal(walletFor(rescheduled.transactions, "child-a").available, 0);
const cancelled = abandonWish(rescheduled.wishes, rescheduled.transactions, "wish-c", { cancelledAt: at(26, 4) });
assert.equal(cancelled.wish.status, "cancelled");
assert.equal(walletFor(cancelled.transactions, "child-a").available, 3);
const replacement = createWish(cancelled.wishes, { id: "wish-replacement", childId: "child-a", title: "一起野餐", cost: 3 }, { createdAt: at(26, 5) });
assert.equal(replacement.wish.status, "active");

// Agreement lifecycle is not an input: an active wish survives a round ending.
const retained = createWish([], { id: "wish-retained", childId: "child-a", title: "周末公园", cost: 9 }, { createdAt: at(27) });
assert.equal(retained.wishes[0].status, "active");

const childBWish = createWish(retained.wishes, { id: "wish-child-b", childId: "child-b", title: "家庭游戏", cost: 1 }, { createdAt: at(27, 1) });
assert.equal(childBWish.wishes.length, 2);
assert.equal(canScheduleWish(childBWish.wishes[1], ledger.transactions), false);
assert.equal(walletFor(ledger.transactions, "child-b").available, 0);

console.log("Wish engine checks passed: independent lifecycle, scheduling, completion-only memories, refunds, retention, and child isolation.");

function error(code) { return (value) => value instanceof DomainRuleError && value.code === code; }
