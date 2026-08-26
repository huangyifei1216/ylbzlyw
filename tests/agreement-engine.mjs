import assert from "node:assert/strict";
import {
  DomainRuleError, archiveAgreement, canFinishExistingAgreement, createAgreement,
  isEntitledForStage, markReviewDue, periodKeyFor, reviewAgreement,
} from "../agreement-engine.mjs";

const all = { scope: "all", stageId: "all", status: "active" };
const stage4 = { scope: "stage", stageId: "s4", status: "active" };
const now = "2026-08-25T04:00:00.000Z";
const afterCycle = "2026-09-01T04:00:00.000Z";
const draft = {
  id: "agreement-a", childId: "child-a", stageId: "s4", templateId: "s4-homework", templateVersion: 1,
  problem: "写作业总要一直催", childAction: "到约定时间先坐下来做10分钟", parentAction: "这10分钟我不催、不批评、不翻旧账",
  duration: 7, recordMode: "daily", wishId: "wish-a", startDate: "2026-08-25", createdAt: now,
};

const created = createAgreement([], draft, { currentStageId: "s4", entitlement: all, now });
assert.equal(created.agreement.status, "active");
assert.equal(created.agreement.endDate, "2026-08-31");
assert.equal(created.agreement.stageId, "s4");
assert.equal(created.agreements.length, 1);
assert.throws(() => createAgreement([], { ...draft, duration: 4 }, { currentStageId: "s4", entitlement: all, now }), error("invalid-duration"));
assert.throws(() => createAgreement([], { ...draft, duration: 5 }, { currentStageId: "s4", entitlement: all, now }), error("invalid-duration"));
assert.throws(() => createAgreement([], { ...draft, duration: 6 }, { currentStageId: "s4", entitlement: all, now }), error("invalid-duration"));
assert.throws(() => createAgreement([], { ...draft, recordMode: "once-per-cycle" }, { currentStageId: "s4", entitlement: all, now }), error("stage-record-mode-mismatch"));
assert.throws(() => createAgreement(created.agreements, { ...draft, id: "agreement-b" }, { currentStageId: "s4", entitlement: all, now }), error("agreement-in-progress"));
assert.throws(() => archiveAgreement(created.agreement), error("review-before-archive"));

assert.equal(isEntitledForStage(stage4, "s4"), true);
assert.equal(isEntitledForStage(stage4, "s5"), false);
assert.equal(isEntitledForStage({ ...stage4, status: "revoked" }, "s4"), false);
assert.equal(isEntitledForStage({ ...stage4, status: "expired" }, "s4"), false);
assert.throws(() => createAgreement([], draft, { currentStageId: "s5", entitlement: stage4, now }), error("stage-not-entitled"));
assert.throws(() => createAgreement([], draft, { currentStageId: "s4", entitlement: all, isAdult: true, now }), error("adult-new-agreement"));
assert.throws(() => createAgreement([], { ...draft, childAction: "有自伤冲动时忍住不说" }, { currentStageId: "s4", entitlement: all, now }), error("unsafe-agreement"));
assert.throws(() => createAgreement([], { ...draft, parentAction: "根据情况调整药量" }, { currentStageId: "s4", entitlement: all, now }), error("unsafe-agreement"));

// Recording and finishing an already-started old-stage agreement never re-checks the new stage or adulthood.
assert.equal(periodKeyFor(created.agreement, "2026-08-26"), "2026-08-26");
assert.equal(periodKeyFor({ ...created.agreement, recordMode: "once-per-cycle" }, "2026-08-26"), "cycle:agreement-a");
assert.equal(canFinishExistingAgreement(created.agreement), true);
const due = markReviewDue(created.agreement, "2026-09-01");
assert.equal(due.status, "review-due");
assert.equal(canFinishExistingAgreement(due), true);
assert.throws(() => reviewAgreement(created.agreement, "continue", { reviewedAt: now }), error("not-reviewable"));

for (const outcome of ["continue", "adjust", "change"]) {
  const reviewed = reviewAgreement(due, outcome, { reviewedAt: afterCycle });
  assert.equal(reviewed.status, "reviewed");
  assert.equal(reviewed.review.outcome, outcome);
  assert.equal(archiveAgreement(reviewed).status, "archived");
}
assert.throws(() => reviewAgreement(due, "continue", { reviewedAt: now }), error("review-before-cycle-end"));
const paused = reviewAgreement(due, "pause", { reviewedAt: afterCycle });
assert.equal(paused.status, "paused");
assert.equal(paused.review.outcome, "pause");

console.log("Agreement engine checks passed: duration, exclusivity, review states, entitlement, stage transition, and adulthood rules.");

function error(code) {
  return (value) => value instanceof DomainRuleError && value.code === code;
}
