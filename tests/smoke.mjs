import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { AGREEMENT_PRESETS, FAMILY_WISHES, PET_STAGES, presetsForStage } from "../agreements.mjs";
import { APP_VERSION, STAGES, childLimit, getAgeInfo, hasStageAccess } from "../core.mjs";
import { validateDemoCode } from "../demo-access.mjs";

assert.equal(APP_VERSION, "5.1.3");
assert.equal(STAGES.length, 6);
assert.equal(Object.values(AGREEMENT_PRESETS).flat().length, 22);
assert.ok(STAGES.every((stage) => presetsForStage(stage.id).length >= 3));
assert.ok(Object.values(AGREEMENT_PRESETS).flat().every((item) => item.stageId && item.imaQuery && item.templateVersion === 1 && item.reviewStatus === "reviewed"));
assert.ok(FAMILY_WISHES.length >= 5);
assert.equal(PET_STAGES.length, 5);

const all = validateDemoCode("bb-all-0001");
assert.equal(all.ok, true);
assert.equal(childLimit(all.entitlement), 3);
assert.equal(hasStageAccess(all.entitlement, "s6"), true);
assert.equal(hasStageAccess({ ...all.entitlement, status: "revoked" }, "s6"), false);
assert.equal(hasStageAccess({ ...all.entitlement, status: "expired" }, "s6"), false);
assert.equal("recoveryCode" in all.entitlement, false);
assert.equal(getAgeInfo("2020-08-24", new Date("2026-08-23T04:00:00Z")).stage.id, "s3");
assert.equal(getAgeInfo("2008-08-24", new Date("2026-08-24T04:00:00Z")).graduated, true);

for (const file of ["index.html", "styles.css", "styles-brand.css", "app.js", "agreements.mjs", "core.mjs", "data-contract.mjs", "state-invariants.mjs", "agreement-engine.mjs", "fruit-ledger.mjs", "wish-engine.mjs", "wish-icons.mjs", "backup.mjs", "safety.mjs", "privacy.html", "PRD.md"]) {
  assert.ok((await readFile(new URL(`../${file}`, import.meta.url), "utf8")).length > 100, `${file} should not be empty`);
}
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
for (const phrase of ["建立家庭约定", "孩子这一步", "家长这一步", "象果", "步步怎么长大", "家庭心愿", "一起回顾这一轮", "分龄手册", "导入家庭备份", "这个心愿实现啦"]) assert.match(app, new RegExp(phrase));
for (const banned of ["从IMA答案创建约定", "找回我的家庭空间", "订单号后四位", "recoveryCode", "积分商城", "排行榜", "连续打卡", "失败了", "香果", "布布"]) assert.doesNotMatch(app, new RegExp(banned));
assert.match(app, /assets\/bubu-/);

console.log("Smoke checks passed: V5.1.3 access, reviewed templates, real Bubu assets, mutual actions, wishes, backup, and safety routes.");
