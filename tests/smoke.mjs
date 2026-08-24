import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  AGREEMENT_PRESETS, FAMILY_WISHES, PET_STAGES, checkinReward, petProgress,
  presetsForStage, wallet,
} from "../agreements.mjs";
import {
  APP_VERSION, STAGES, addCalendarMonths, childLimit, getAgeInfo,
  hasStageAccess, validateCode,
} from "../core.mjs";

const at = (iso) => new Date(`${iso}T04:00:00.000Z`);

assert.equal(APP_VERSION, 5);
assert.equal(STAGES.length, 6);
assert.equal(Object.keys(AGREEMENT_PRESETS).length, 6);
assert.ok(STAGES.every((stage) => presetsForStage(stage.id).length >= 3));
assert.ok(Object.values(AGREEMENT_PRESETS).flat().every((item) => item.problem.length >= 6 && item.childAction.length >= 8 && item.parentAction.length >= 8));
assert.ok(FAMILY_WISHES.length >= 5);
assert.equal(PET_STAGES[0].min, 0);
assert.ok(PET_STAGES.every((stage,index) => index === 0 || stage.min > PET_STAGES[index - 1].min));

const all = validateCode("bb-all-0001");
assert.equal(all.ok, true);
assert.equal(all.entitlement.scope, "all");
assert.equal(childLimit(all.entitlement), 3);
assert.equal(hasStageAccess(all.entitlement, "s6"), true);
const one = validateCode("BB-S3-0001");
assert.equal(one.entitlement.stageId, "s3");
assert.equal(childLimit(one.entitlement), 1);
assert.equal(hasStageAccess(one.entitlement, "s4"), false);
assert.equal(validateCode("BB-USED-0001").error, "used");
assert.equal(validateCode("wrong").ok, false);

assert.equal(addCalendarMonths("2024-02-29", 18), "2025-08-29");
assert.equal(getAgeInfo("2024-02-29", at("2025-08-28")).stage.id, "s1");
assert.equal(getAgeInfo("2024-02-29", at("2025-08-29")).stage.id, "s2");
assert.equal(getAgeInfo("2020-08-24", at("2026-08-23")).stage.id, "s3");
assert.equal(getAgeInfo("2020-08-24", at("2027-08-24")).stage.id, "s4");
assert.equal(getAgeInfo("2008-08-24", at("2026-08-23")).stage.id, "s6");
assert.equal(getAgeInfo("2008-08-24", at("2026-08-24")).graduated, true);
assert.equal(getAgeInfo("2099-01-01", at("2026-08-24")).valid, false);
assert.equal(getAgeInfo("2024-02-30", at("2026-08-24")).valid, false);

const checkins = {
  "a:2026-08-22": { child: true, parent: true },
  "a:2026-08-23": { child: true, parent: false },
  "a:2026-08-24": { child: false, parent: true },
};
assert.equal(checkinReward(checkins["a:2026-08-22"]), 3);
assert.deepEqual(wallet(checkins), { totalEarned: 5, spent: 0, available: 5 });
assert.deepEqual(wallet(checkins, [{ cost: 3 }]), { totalEarned: 5, spent: 3, available: 2 });
assert.equal(petProgress(0).current.level, 1);
assert.equal(petProgress(6).current.level, 2);
assert.equal(petProgress(60).current.level, 5);
assert.equal(petProgress(60).value, 100);

// Multi-child independence checks
const child1Checkins = { "a1:2026-08-22": { child: true, parent: true } };
const child2Checkins = { "a2:2026-08-22": { child: true, parent: false } };
assert.equal(wallet(child1Checkins).totalEarned, 3);
assert.equal(wallet(child2Checkins).totalEarned, 1);
assert.equal(wallet(child1Checkins, [{ cost: 3 }]).available, 0);
assert.equal(wallet(child2Checkins).available, 1);
assert.equal(petProgress(wallet(child1Checkins).totalEarned).current.level, 1);

for (const file of ["index.html", "styles.css", "app.js", "agreements.mjs", "core.mjs", "data-contract.mjs", "privacy.html", "PRD.md"]) {
  assert.ok((await readFile(new URL(`../${file}`, import.meta.url), "utf8")).length > 100);
}
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
for (const phrase of ["建立家庭约定", "孩子这一步", "家长这一步", "象果", "步步怎么长大", "家庭心愿", "一起看看这一轮", "分龄手册", "我观察到宝宝的信号了"]) assert.match(app, new RegExp(phrase));
assert.match(app, /childAgreementIds\.has\(item\.agreementId\) &&/);
assert.match(app, /createStorageAdapter/);
assert.match(app, /stateStorage\.write/);
for (const banned of ["从IMA答案创建约定", "积分商城", "排行榜", "连续打卡", "失败了"]) assert.doesNotMatch(app, new RegExp(banned));

console.log("Smoke checks passed: six age bands, access rules, mutual agreement presets, Xiangguo wallet, Bubu growth, shared wishes, and review flow.");
