import { expect, test } from "@playwright/test";

async function activateAndCreate(page, { nickname = "菲菲", birthDate = "2020-08-24" } = {}) {
  await page.goto("/");
  await page.getByLabel("开通码").fill("BB-ALL-0001");
  await page.getByRole("button", { name: /开通一两步/ }).click();
  await page.getByRole("button", { name: /建立孩子档案/ }).click();
  await page.locator("#child-form").evaluate((form, values) => { form.elements.nickname.value = values.nickname; form.elements.birthDate.value = values.birthDate; }, { nickname, birthDate });
  await expect(page.getByLabel("家庭昵称")).toHaveValue(nickname);
  await expect(page.locator('input[name="birthDate"]')).toHaveValue(birthDate);
  await page.getByRole("button", { name: /接下来/ }).click();
  await completeDraft(page);
}

async function completeDraft(page) {
  await page.locator(".problem-options button").first().click();
  await page.getByRole("button", { name: /选周期和家庭心愿/ }).click();
  await page.getByLabel("先试3天").check();
  await page.getByLabel(/一起选一部全家电影/).check();
  await page.getByRole("button", { name: /一起确认约定/ }).click();
  await page.getByRole("button", { name: /就从今天开始/ }).click();
  await expect(page).toHaveURL(/#\/home/);
}

test("开通到约定，再以 1+1+1 记录且刷新保留", async ({ page }) => {
  await activateAndCreate(page);
  await expect(page.locator(".today-heading h1")).toBeVisible();
  await expect(page.locator(".action-check.is-child small")).toHaveText("菲菲这一步");
  await expect(page.locator(".action-check.is-parent small")).toHaveText("家长这一步");
  await page.getByRole("button", { name: /记录菲菲这一步/ }).click();
  await page.getByRole("button", { name: /记录家长这一步/ }).click();
  await expect(page.getByText(/累计 3 颗/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/今天，你们都向前走了一小步/)).toBeVisible();
  await expect(page.getByText(/累计 3 颗/)).toBeVisible();
  await page.screenshot({ path: "artifacts/screenshots/today-390x844.png", fullPage: true });
});

test("两个孩子的约定、象果与步步成长互不串账", async ({ page }) => {
  await activateAndCreate(page);
  await page.getByRole("button", { name: /记录菲菲这一步/ }).click();
  await page.getByRole("button", { name: /记录家长这一步/ }).click();
  await page.getByRole("button", { name: "我的" }).click();
  await page.getByRole("button", { name: /添加孩子/ }).click();
  await page.locator("#child-form").evaluate((form) => { form.elements.nickname.value = "小言"; form.elements.birthDate.value = "2012-06-01"; });
  await page.getByRole("button", { name: /接下来/ }).click();
  await completeDraft(page);
  await page.getByRole("button", { name: /这一轮聊过啦|这周聊过啦/ }).click();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("ylb.v5.state")));
  const feifei = state.children.find((item) => item.nickname === "菲菲");
  const xiaoyan = state.children.find((item) => item.nickname === "小言");
  const sum = (childId) => state.fruitTransactions.filter((item) => item.childId === childId).reduce((total, item) => total + item.amount, 0);
  expect(sum(feifei.id)).toBe(3);
  expect(sum(xiaoyan.id)).toBe(1);
  await page.getByLabel("切换孩子").selectOption(feifei.id);
  await expect(page.getByText(/累计 3 颗/)).toBeVisible();
});

test("375×667 首屏同时出现双方行动与按钮", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await activateAndCreate(page);
  await expect(page.locator(".action-check.is-child small")).toHaveText("菲菲这一步");
  await expect(page.locator(".action-check.is-parent small")).toHaveText("家长这一步");
  await expect(page.getByRole("button", { name: /记录菲菲这一步/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /记录家长这一步/ })).toBeVisible();
  const parentButton = page.getByRole("button", { name: /记录家长这一步/ });
  const box = await parentButton.boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(667 - 66);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: "artifacts/screenshots/today-375x667.png", fullPage: true });
  await page.setViewportSize({ width: 430, height: 932 });
  await page.screenshot({ path: "artifacts/screenshots/today-430x932.png", fullPage: true });
});

test("12—18岁整轮只记录一次，刷新后不重复领取", async ({ page }) => {
  await activateAndCreate(page, { nickname: "小言", birthDate: "2012-06-01" });
  await page.getByRole("button", { name: /这一轮聊过啦|这周聊过啦/ }).click();
  await expect(page.locator(".action-check.is-child .recorded-state")).toContainText("已记下");
  await page.reload();
  await expect(page.getByRole("button", { name: /这一轮聊过啦|这周聊过啦/ })).toHaveCount(0);
  await expect(page.locator(".action-check.is-child .recorded-state")).toContainText("已记下");
  await page.screenshot({ path: "artifacts/screenshots/teen-once-per-cycle-390x844.png", fullPage: true });
});

test("敏感自定义问题进入边界页，不能创建约定", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("开通码").fill("BB-ALL-0001");
  await page.getByRole("button", { name: /开通一两步/ }).click();
  await page.getByRole("button", { name: /建立孩子档案/ }).click();
  await page.locator("#child-form").evaluate((form) => { form.elements.nickname.value = "小宇"; form.elements.birthDate.value = "2017-08-01"; });
  await page.getByRole("button", { name: /接下来/ }).click();
  await page.getByRole("button", { name: /自己写一个具体问题/ }).click();
  await page.getByLabel("这次想调整").fill("孩子说不想活");
  await page.locator('textarea[name="childAction"]').fill("先停下来告诉家长");
  await page.locator('textarea[name="parentAction"]').fill("我先认真听孩子说");
  await page.getByRole("button", { name: /选周期和家庭心愿/ }).click();
  await expect(page.getByRole("heading", { name: "这个情况不适合做成家庭约定" })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("ylb.v5.state")).agreements.length)).toBe(0);
  await page.screenshot({ path: "artifacts/screenshots/safety-boundary-390x844.png", fullPage: true });
});

test("备份导入先预览，确认后不改变当前权益", async ({ page }) => {
  await activateAndCreate(page);
  await page.getByRole("button", { name: "我的" }).click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("ylb.v5.state")));
  const envelope = { product: "一两步", format: "ylbzlyw-family-backup", backupVersion: 1, schemaVersion: 2, appVersion: 5.1, exportedAt: new Date().toISOString(), data: { children: before.children, currentChildId: before.currentChildId, agreements: before.agreements, records: before.records, fruitTransactions: before.fruitTransactions, wishes: before.wishes, petPeaks: before.petPeaks } };
  await page.locator("#backup-input").setInputFiles({ name: "family.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(envelope)) });
  await expect(page.getByRole("heading", { name: "确认导入家庭备份" })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("孩子档案", { exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/screenshots/backup-import-preview-390x844.png", fullPage: true });
  await page.getByRole("button", { name: /确认替换当前本机数据/ }).click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("ylb.v5.state")));
  expect(after.entitlement).toEqual(before.entitlement);
});

test("清空后重新开通，可以在建档前导入并恢复家庭数据", async ({ page }) => {
  await activateAndCreate(page);
  await page.getByRole("button", { name: /记录菲菲这一步/ }).click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("ylb.v5.state")));
  const envelope = { product: "一两步", format: "ylbzlyw-family-backup", backupVersion: 1, schemaVersion: 2, appVersion: 5.1, exportedAt: new Date().toISOString(), data: { children: before.children, currentChildId: before.currentChildId, agreements: before.agreements, records: before.records, fruitTransactions: before.fruitTransactions, wishes: before.wishes, petPeaks: before.petPeaks } };
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel("开通码").fill("BB-ALL-0001");
  await page.getByRole("button", { name: /开通一两步/ }).click();
  await page.getByRole("button", { name: /建立孩子档案/ }).click();
  await page.locator("#backup-input").setInputFiles({ name: "family.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(envelope)) });
  await expect(page.getByRole("heading", { name: "确认导入家庭备份" })).toBeVisible();
  await page.getByRole("button", { name: /确认替换当前本机数据/ }).click();
  await expect(page.locator(".today-heading h1")).toBeVisible();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("ylb.v5.state")));
  expect(after.children).toHaveLength(1);
  expect(Object.keys(after.records)).toHaveLength(1);
  expect(after.entitlement.status).toBe("active");
});

test("心愿安排不等于实现，只有真实实现后才进入家庭回忆", async ({ page }) => {
  await activateAndCreate(page);
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("ylb.v5.state"));
    const agreement = state.agreements[0];
    for (let index = 0; index < 9; index++) state.fruitTransactions.push({ id: `e2e-fruit-${index}`, childId: agreement.childId, agreementId: agreement.id, recordId: "", wishId: "", type: index % 3 === 0 ? "child-step" : index % 3 === 1 ? "parent-step" : "companion", amount: 1, createdAt: new Date().toISOString(), reversedTransactionId: "" });
    localStorage.setItem("ylb.v5.state", JSON.stringify(state));
  });
  await page.reload();
  await page.getByRole("button", { name: "一起安排" }).click();
  await page.getByRole("button", { name: "确认安排" }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("ylb.v5.state")).wishes[0].status)).toBe("scheduled");
  await page.screenshot({ path: "artifacts/screenshots/wish-scheduled-not-completed-390x844.png", fullPage: true });
  await page.getByRole("button", { name: "这个心愿实现啦" }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("ylb.v5.state")).wishes[0].status)).toBe("completed");
  await page.locator('.bottom-nav button[data-view="pet"]').click();
  await expect(page.getByText("一起选一部全家电影", { exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/screenshots/wish-completed-memory-390x844.png", fullPage: true });
});
