import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { AGREEMENT_PRESETS, FAMILY_WISHES, PET_STAGES, presetsForStage } from "../agreements.mjs";
import { APP_VERSION, STAGES, childLimit, getAgeInfo, hasStageAccess } from "../core.mjs";
import { validateDemoCode } from "../demo-access.mjs";

assert.equal(APP_VERSION, "5.1.4");
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

const devEntry = await readFile(new URL("../dev.html", import.meta.url), "utf8");
assert.match(devEntry, /globalThis\.__YLB_CONFIG__ && typeof globalThis\.__YLB_CONFIG__ === "object"/);
assert.match(devEntry, /\{ environment: "development", handbookUrl: "" \}/);
assert.match(devEntry, /href="http:\/\/127\.0\.0\.1:4173\/"/);
assert.match(devEntry, /location\.protocol === "file:"/);

const workflowsUrl = new URL("../.github/workflows/", import.meta.url);
const workflowNames = (await readdir(workflowsUrl)).filter((name) => /\.ya?ml$/.test(name)).sort();
const workflows = await Promise.all(workflowNames.map(async (name) => [name, await readFile(new URL(name, workflowsUrl), "utf8")]));
const pagesWorkflows = workflows.filter(([, source]) => /actions\/(?:upload-pages-artifact|deploy-pages)@|\bpages:\s*write\b/.test(source));
assert.equal(workflowNames.includes("pages.yml"), false, "The independent Pages bypass workflow must stay deleted");
assert.deepEqual(pagesWorkflows.map(([name]) => name), ["verify.yml"], "Pages must have exactly one workflow entry point");

const verifyWorkflow = workflows.find(([name]) => name === "verify.yml")?.[1];
assert.ok(verifyWorkflow, "verify.yml must exist");
const verifyStart = verifyWorkflow.indexOf("\n  verify:");
const deployStart = verifyWorkflow.indexOf("\n  deploy:");
assert.ok(verifyStart >= 0 && deployStart > verifyStart, "verify and deploy jobs must exist in that order");
const verifyJob = verifyWorkflow.slice(verifyStart, deployStart);
const deployJob = verifyWorkflow.slice(deployStart);
const orderedVerification = [
  "run: npm ci",
  "run: npm test",
  "run: npm run build:production",
  "run: npx playwright install --with-deps chromium",
  "run: npm run test:e2e",
  "uses: actions/upload-pages-artifact@v3",
];
let previousStep = -1;
for (const step of orderedVerification) {
  const position = verifyJob.indexOf(step);
  assert.ok(position > previousStep, `${step} must remain in the required verification order`);
  previousStep = position;
}
assert.equal((verifyWorkflow.match(/run: npm run build:production/g) || []).length, 1, "Production must be built exactly once");
assert.match(verifyJob, /permissions:\n\s+contents: read/);
assert.doesNotMatch(verifyJob, /pages: write|id-token: write/);
assert.match(verifyJob, /uses: actions\/upload-pages-artifact@v3[\s\S]*?name: verified-production-dist[\s\S]*?path: dist/);
assert.match(deployJob, /needs: verify/);
assert.match(deployJob, /if: \$\{\{ github\.event_name == 'push' && github\.ref == 'refs\/heads\/dev' \}\}/);
assert.match(deployJob, /permissions:\n\s+pages: write\n\s+id-token: write/);
assert.match(deployJob, /uses: actions\/deploy-pages@v4[\s\S]*?artifact_name: verified-production-dist/);
assert.doesNotMatch(deployJob, /npm (?:ci|run build:production)|actions\/checkout|actions\/setup-node|actions\/upload-pages-artifact/);
assert.doesNotMatch(verifyWorkflow, /workflow_dispatch/);
assert.doesNotMatch(verifyWorkflow, /continue-on-error/);
assert.match(verifyWorkflow, /push:\n\s+branches: \[dev\]/);
assert.match(verifyWorkflow, /pull_request:/);
assert.match(verifyWorkflow, /cancel-in-progress: \$\{\{ github\.event_name == 'push' && github\.ref == 'refs\/heads\/dev' \}\}/);
assert.match(verifyWorkflow, /github\.run_id/);

console.log("Smoke checks passed: V5.1.4 product contracts and the verified-artifact Pages release gate.");
