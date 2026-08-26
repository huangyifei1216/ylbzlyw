import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { window.__YLB_CONFIG__ = { environment: "development", handbookUrl: "" }; });
});

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

async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }))).toEqual(await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.clientWidth,
  })));
}

async function expectBottomActionClear(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const action = await locator.boundingBox();
  const nav = await page.locator(".bottom-nav").boundingBox();
  expect(action).not.toBeNull();
  expect(nav).not.toBeNull();
  expect(action.y + action.height).toBeLessThanOrEqual(nav.y + 1);
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

test("第三步切换心愿不会丢失3天周期和自定义文字", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("开通码").fill("BB-ALL-0001");
  await page.getByRole("button", { name: /开通一两步/ }).click();
  await page.getByRole("button", { name: /建立孩子档案/ }).click();
  await page.locator("#child-form").evaluate((form) => { form.elements.nickname.value = "菲菲"; form.elements.birthDate.value = "2020-08-24"; });
  await page.getByRole("button", { name: /接下来/ }).click();
  await page.locator(".problem-options button").first().click();
  await page.getByRole("button", { name: /选周期和家庭心愿/ }).click();
  await page.getByLabel("先试3天").check();
  await page.getByLabel(/一起去公园慢慢玩/).check();
  await expect(page.getByLabel("先试3天")).toBeChecked();
  await page.getByLabel(/我们自己商量一个心愿/).check();
  await page.getByLabel("我们的家庭心愿").fill("周末一起去江边散步");
  await page.getByLabel(/一起选一部全家电影/).check();
  await page.getByLabel(/我们自己商量一个心愿/).check();
  await expect(page.getByLabel("先试3天")).toBeChecked();
  await expect(page.getByLabel("我们的家庭心愿")).toHaveValue("周末一起去江边散步");
  await page.getByRole("button", { name: /一起确认约定/ }).click();
  await expect(page.locator(".preview-meta")).toContainText("3天");
  await expect(page.locator(".agreement-preview")).toContainText("周末一起去江边散步");
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
  await page.getByRole("button", { name: /这次聊过了/ }).click();
  await expect(page.locator(".action-check.is-child .recorded-state")).toContainText("已记下");
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
  await expect(page.locator(".app-shell")).toHaveClass(/is-teen/);
  await page.getByRole("button", { name: /这次聊过了/ }).click();
  await expect(page.locator(".action-check.is-child .recorded-state")).toContainText("已记下");
  await page.reload();
  await expect(page.getByRole("button", { name: /这次聊过了/ })).toHaveCount(0);
  await expect(page.locator(".action-check.is-child .recorded-state")).toContainText("已记下");
  await page.screenshot({ path: "artifacts/screenshots/teen-once-per-cycle-390x844.png", fullPage: true });
});

test("正式模式隐藏演示入口和测试码", async ({ page }) => {
  await page.addInitScript(() => { window.__YLB_CONFIG__ = { environment: "production", handbookUrl: "" }; });
  await page.goto("/");
  await expect(page.getByText(/公开预览不会接受本地测试码/)).toBeVisible();
  await expect(page.locator(".demo-entry")).toHaveCount(0);
  await expect(page.getByText("开发测试开通码")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "进入内测版" })).toBeVisible();
  await page.getByLabel("开通码").fill("BB-ALL-0001");
  await page.getByRole("button", { name: "进入内测版" }).click();
  await expect(page.getByRole("alert")).toContainText("不接受本地测试码");
  await page.goto("/?code=BB-ALL-0001");
  await expect(page.getByText(/公开预览不会接受本地测试码/)).toBeVisible();
  await page.evaluate(() => localStorage.setItem("ylb.v5.state", JSON.stringify({ schemaVersion: 2, entitlement: { scope: "all", stageId: "all", label: "伪造权益", status: "active" } })));
  await page.reload();
  await expect(page.getByRole("button", { name: "进入内测版" })).toBeVisible();
  await page.screenshot({ path: "artifacts/screenshots/production-activation-390x844.png", fullPage: true });
});

test("手册未配置时不打开空窗口，配置后同步打开入口", async ({ page }) => {
  await page.addInitScript(() => { window.__openCalls = []; window.open = (...args) => { window.__openCalls.push(args); return {}; }; });
  await activateAndCreate(page);
  await page.getByRole("button", { name: "复制当前问题" }).click();
  expect(await page.evaluate(() => window.__openCalls.length)).toBe(0);
  await expect(page.getByText(/手册入口将在正式版本配置/).first()).toBeVisible();

  await page.evaluate(() => localStorage.clear());
  await page.addInitScript(() => { window.__YLB_CONFIG__ = { environment: "development", handbookUrl: "https://handbook.example/path" }; });
  await page.reload();
  await page.getByLabel("开通码").fill("BB-ALL-0001");
  await page.getByRole("button", { name: /开通一两步/ }).click();
  await page.getByRole("button", { name: /建立孩子档案/ }).click();
  await page.locator("#child-form").evaluate((form) => { form.elements.nickname.value = "菲菲"; form.elements.birthDate.value = "2020-08-24"; });
  await page.getByRole("button", { name: /接下来/ }).click();
  await completeDraft(page);
  await page.getByRole("button", { name: "方法需要调整？" }).click();
  expect(await page.evaluate(() => window.__openCalls.at(-1)?.[0])).toBe("https://handbook.example/path");
});

test("孩子跨阶段后完成回顾不会复制旧阶段模板", async ({ page }) => {
  await activateAndCreate(page, { nickname: "菲菲", birthDate: "2021-08-24" });
  const oldProblem = await page.locator(".today-heading h1").textContent();
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("ylb.v5.state"));
    state.children[0].birthDate = "2019-08-24";
    state.agreements[0] = { ...state.agreements[0], duration: 3, startDate: "2026-08-21", endDate: "2026-08-23", createdAt: "2026-08-21T04:00:00.000Z", status: "review-due" };
    localStorage.setItem("ylb.v5.state", JSON.stringify(state));
  });
  await page.goto("/#/review");
  await page.reload();
  await page.getByRole("button", { name: /有一点变化，再试一轮/ }).click();
  await expect(page).toHaveURL(/#\/create/);
  await expect(page.locator(".problem-options")).toBeVisible();
  await expect(page.getByText("孩子已经进入新的成长阶段，我们从这个阶段重新选一个当前问题。")).toBeVisible();
  await expect(page.getByText(oldProblem, { exact: true })).toHaveCount(0);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("ylb.v5.state")));
  expect(state.agreements[0].status).toBe("reviewed");
  expect(state.agreements[0].review.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
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

for (const [role, unsafeText] of [["childAction", "有自伤冲动时自己忍住"], ["parentAction", "我根据情况自行调整药量"]]) {
  test(`敏感${role === "childAction" ? "孩子" : "家长"}行动不能进入周期或产生象果`, async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("开通码").fill("BB-ALL-0001");
    await page.getByRole("button", { name: /开通一两步/ }).click();
    await page.getByRole("button", { name: /建立孩子档案/ }).click();
    await page.locator("#child-form").evaluate((form) => { form.elements.nickname.value = "小宇"; form.elements.birthDate.value = "2017-08-01"; });
    await page.getByRole("button", { name: /接下来/ }).click();
    await page.locator(".problem-options button").first().click();
    await page.locator(`textarea[name="${role}"]`).fill(unsafeText);
    await page.getByRole("button", { name: /选周期和家庭心愿/ }).click();
    await expect(page.getByRole("heading", { name: "这个情况不适合做成家庭约定" })).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("ylb.v5.state")));
    expect(saved.agreements).toHaveLength(0);
    expect(saved.fruitTransactions).toHaveLength(0);
  });
}

test("放下旧心愿后立即选择并建立新心愿", async ({ page }) => {
  await activateAndCreate(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "换一个家庭心愿" }).click();
  await expect(page.getByRole("heading", { name: "换一个全家都期待的心愿" })).toBeVisible();
  await page.getByLabel(/一起去公园慢慢玩/).check();
  await page.getByRole("button", { name: "确认新的家庭心愿" }).click();
  await expect(page.getByRole("heading", { name: "换一个全家都期待的心愿" })).toBeHidden();
  await expect(page.getByText("一起去公园慢慢玩", { exact: true })).toBeVisible();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("ylb.v5.state")));
  expect(state.wishes.filter((item) => item.status === "cancelled")).toHaveLength(1);
  expect(state.wishes.filter((item) => item.status === "active" && item.title === "一起去公园慢慢玩")).toHaveLength(1);
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

test("非法备份被明确拒绝且当前数据不变", async ({ page }) => {
  await activateAndCreate(page);
  await page.getByRole("button", { name: "我的" }).click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("ylb.v5.state")));
  const duplicate = { ...before.agreements[0], id: "agreement-duplicate" };
  const envelope = { product: "一两步", format: "ylbzlyw-family-backup", backupVersion: 1, schemaVersion: 2, appVersion: "5.1.1", exportedAt: new Date().toISOString(), data: { children: before.children, currentChildId: before.currentChildId, agreements: [...before.agreements, duplicate], records: before.records, fruitTransactions: before.fruitTransactions, wishes: before.wishes, petPeaks: before.petPeaks } };
  await page.locator("#backup-input").setInputFiles({ name: "invalid-family.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(envelope)) });
  await expect(page.getByRole("heading", { name: "无法导入这份备份" })).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("当前浏览器里的家庭数据没有改变");
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("ylb.v5.state")));
  expect(after.agreements).toEqual(before.agreements);
  await page.screenshot({ path: "artifacts/screenshots/backup-invalid-rejected-390x844.png", fullPage: true });
});

test("生产步步素材为1024方图且四角透明", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const names = ["avatar", "today", "fruit", "rest", "growth-1", "growth-2", "growth-3", "growth-4", "growth-5"];
    const rows = [];
    for (const name of names) {
      const image = new Image(); image.src = `./assets/bubu-${name}.webp`; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d"); context.drawImage(image, 0, 0);
      const corners = [[0, 0], [image.naturalWidth - 1, 0], [0, image.naturalHeight - 1], [image.naturalWidth - 1, image.naturalHeight - 1]];
      rows.push({ name, width: image.naturalWidth, height: image.naturalHeight, alphas: corners.map(([x, y]) => context.getImageData(x, y, 1, 1).data[3]) });
    }
    return rows;
  });
  expect(result.every((item) => item.width === 1024 && item.height === 1024 && item.alphas.every((alpha) => alpha === 0))).toBe(true);
});

test("五个成长阶段使用独立步步姿势并生成审阅截图", async ({ page }) => {
  await activateAndCreate(page);
  const milestones = [0, 6, 18, 36, 60];
  for (let index = 0; index < milestones.length; index += 1) {
    await page.evaluate((peak) => {
      const state = JSON.parse(localStorage.getItem("ylb.v5.state"));
      state.agreements = state.agreements.filter((item) => item.status === "active");
      state.records = {};
      state.fruitTransactions = [];
      for (let offset = 0; offset < peak / 3; offset += 1) {
        const id = `growth-history-${offset}`;
        const agreement = { ...state.agreements[0], id, wishId: "", status: "reviewed", startDate: "2026-07-01", endDate: "2026-07-03", duration: 3, createdAt: "2026-07-01T00:00:00.000Z", review: { outcome: "continue", outcomeLabel: "有一点变化，再试一轮", outcomeIcon: "↻", reviewedAt: "2026-07-04T04:00:00.000Z" } };
        state.agreements.push(agreement);
        const childRecordId = `${id}-child`; const parentRecordId = `${id}-parent`; const createdAt = "2026-07-01T04:00:00.000Z";
        state.records[childRecordId] = { id: childRecordId, childId: agreement.childId, agreementId: id, role: "child", periodKey: "2026-07-01", localDate: "2026-07-01", recordedAt: createdAt, reversedAt: "" };
        state.records[parentRecordId] = { id: parentRecordId, childId: agreement.childId, agreementId: id, role: "parent", periodKey: "2026-07-01", localDate: "2026-07-01", recordedAt: createdAt, reversedAt: "" };
        state.fruitTransactions.push(
          { id: `${id}-child-fruit`, childId: agreement.childId, agreementId: id, recordId: childRecordId, wishId: "", type: "child-step", amount: 1, createdAt, reversedTransactionId: "", periodKey: "2026-07-01", relatedRecordIds: [childRecordId] },
          { id: `${id}-parent-fruit`, childId: agreement.childId, agreementId: id, recordId: parentRecordId, wishId: "", type: "parent-step", amount: 1, createdAt, reversedTransactionId: "", periodKey: "2026-07-01", relatedRecordIds: [parentRecordId] },
          { id: `${id}-companion`, childId: agreement.childId, agreementId: id, recordId: parentRecordId, wishId: "", type: "companion", amount: 1, createdAt, reversedTransactionId: "", periodKey: "2026-07-01", relatedRecordIds: [childRecordId, parentRecordId] },
        );
      }
      state.petPeaks[state.currentChildId] = peak;
      localStorage.setItem("ylb.v5.state", JSON.stringify(state));
    }, milestones[index]);
    await page.goto("/#/pet");
    await page.reload();
    const image = page.locator(".pet-big-art img");
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((node) => node.complete && node.naturalWidth === 1024)).toBe(true);
    await expect(page.locator(".pet-home h1")).toContainText(["来到家里", "鼻子打招呼", "小水花", "探险包", "成长小屋"][index]);
    await page.screenshot({ path: `artifacts/screenshots/bubu-growth-${index + 1}-390x844.png`, fullPage: true });
  }
});

test("三种移动端尺寸覆盖核心页面且底部导航不遮操作", async ({ page }) => {
  for (const viewport of [{ width: 375, height: 667 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expectNoHorizontalOverflow(page); // 开通

    await page.getByLabel("开通码").fill("BB-ALL-0001");
    await page.getByRole("button", { name: /开通一两步/ }).click();
    await page.getByRole("button", { name: /建立孩子档案/ }).click();
    await expectNoHorizontalOverflow(page); // 首次建档
    await page.locator("#child-form").evaluate((form) => { form.elements.nickname.value = "菲菲"; form.elements.birthDate.value = "2020-08-24"; });
    await page.getByRole("button", { name: /接下来/ }).click();
    await expectNoHorizontalOverflow(page); // 建立约定 1
    await page.locator(".problem-options button").first().click();
    await expectNoHorizontalOverflow(page); // 建立约定 2
    await page.getByRole("button", { name: /选周期和家庭心愿/ }).click();
    await expectNoHorizontalOverflow(page); // 建立约定 3 / 心愿
    await page.getByLabel("先试3天").check();
    await page.getByLabel(/一起选一部全家电影/).check();
    await page.getByRole("button", { name: /一起确认约定/ }).click();
    await expectNoHorizontalOverflow(page); // 建立约定 4
    await page.getByRole("button", { name: /就从今天开始/ }).click();
    await expectNoHorizontalOverflow(page); // 今天
    await expectBottomActionClear(page, page.getByRole("button", { name: /查看完整约定/ }));

    await page.getByRole("button", { name: "约定", exact: true }).click();
    await expectNoHorizontalOverflow(page); // 约定历史
    await page.getByRole("button", { name: "步步", exact: true }).click();
    await expectNoHorizontalOverflow(page); // 步步成长
    await page.getByRole("button", { name: "我的", exact: true }).click();
    await expectNoHorizontalOverflow(page); // 备份
    await expectBottomActionClear(page, page.locator(".backup-card .import-button"));

    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("ylb.v5.state"));
      state.agreements[0].status = "review-due";
      localStorage.setItem("ylb.v5.state", JSON.stringify(state));
    });
    await page.goto("/#/review");
    await page.reload();
    await expectNoHorizontalOverflow(page); // 回顾
    await page.goto("/#/safety");
    await expectNoHorizontalOverflow(page); // 敏感边界
  }
});

test("步步图片加载失败时文字与双方行动仍可直接使用", async ({ page }) => {
  await page.route(/\/assets\/bubu-.*\.webp$/, (route) => route.abort("failed"));
  await activateAndCreate(page);
  await expect(page.locator(".today-heading h1")).toBeVisible();
  await expect(page.getByRole("button", { name: /记录菲菲这一步/ })).toBeEnabled();
  await expect(page.getByRole("button", { name: /记录家长这一步/ })).toBeEnabled();
  await expectNoHorizontalOverflow(page);
});

test("清空后重新开通，可以在建档前导入并恢复家庭数据", async ({ page }) => {
  await activateAndCreate(page);
  await page.getByRole("button", { name: /记录菲菲这一步/ }).click();
  await expect(page.locator(".action-check.is-child .recorded-state")).toContainText("已记下");
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
    Object.assign(agreement, { duration: 3, startDate: "2026-08-21", endDate: "2026-08-23", createdAt: "2026-08-21T04:00:00.000Z" });
    const addDays = (value, days) => { const date = new Date(`${value}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
    for (let index = 0; index < 3; index++) {
      const localDate = addDays(agreement.startDate, index); const createdAt = `${localDate}T04:00:00.000Z`;
      const childRecordId = `e2e-record-${index}-child`; const parentRecordId = `e2e-record-${index}-parent`;
      state.records[childRecordId] = { id: childRecordId, childId: agreement.childId, agreementId: agreement.id, role: "child", periodKey: localDate, localDate, recordedAt: createdAt, reversedAt: "" };
      state.records[parentRecordId] = { id: parentRecordId, childId: agreement.childId, agreementId: agreement.id, role: "parent", periodKey: localDate, localDate, recordedAt: createdAt, reversedAt: "" };
      state.fruitTransactions.push(
        { id: `e2e-fruit-${index}-child`, childId: agreement.childId, agreementId: agreement.id, recordId: childRecordId, wishId: "", type: "child-step", amount: 1, createdAt, reversedTransactionId: "", periodKey: localDate, relatedRecordIds: [childRecordId] },
        { id: `e2e-fruit-${index}-parent`, childId: agreement.childId, agreementId: agreement.id, recordId: parentRecordId, wishId: "", type: "parent-step", amount: 1, createdAt, reversedTransactionId: "", periodKey: localDate, relatedRecordIds: [parentRecordId] },
        { id: `e2e-fruit-${index}-companion`, childId: agreement.childId, agreementId: agreement.id, recordId: parentRecordId, wishId: "", type: "companion", amount: 1, createdAt, reversedTransactionId: "", periodKey: localDate, relatedRecordIds: [childRecordId, parentRecordId] },
      );
    }
    state.petPeaks[agreement.childId] = 9;
    localStorage.setItem("ylb.v5.state", JSON.stringify(state));
  });
  await page.reload();
  await page.goto("/#/pet");
  await page.getByRole("button", { name: "一起安排" }).click();
  await page.getByRole("button", { name: "确认安排" }).click();
  await expect(page.getByRole("button", { name: "这个心愿实现啦" })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("ylb.v5.state")).wishes[0].status)).toBe("scheduled");
  await page.screenshot({ path: "artifacts/screenshots/wish-scheduled-not-completed-390x844.png", fullPage: true });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "取消这次安排" }).click();
  await expect(page.getByRole("button", { name: "一起安排" })).toBeVisible();
  const unscheduled = await page.evaluate(() => JSON.parse(localStorage.getItem("ylb.v5.state")));
  expect(unscheduled.wishes[0].status).toBe("active");
  expect(unscheduled.wishes[0].title).toBe("一起选一部全家电影");
  expect(unscheduled.fruitTransactions.reduce((sum, item) => sum + item.amount, 0)).toBe(9);
  await expect(page.getByRole("button", { name: "一起安排" })).toBeVisible();
  await page.screenshot({ path: "artifacts/screenshots/wish-unscheduled-retained-390x844.png", fullPage: true });
  await page.getByRole("button", { name: "一起安排" }).click();
  await page.getByRole("button", { name: "确认安排" }).click();
  await expect(page.getByRole("button", { name: "这个心愿实现啦" })).toBeVisible();
  await page.getByRole("button", { name: "这个心愿实现啦" }).click();
  await expect(page.getByText("这个心愿已收进家庭回忆")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("ylb.v5.state")).wishes[0].status)).toBe("completed");
  await page.locator('.bottom-nav button[data-view="pet"]').click();
  await expect(page.getByText("一起选一部全家电影", { exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/screenshots/wish-completed-memory-390x844.png", fullPage: true });
});

test("本地保存失败时撤回界面操作且刷新后不制造假成功", async ({ page }) => {
  await activateAndCreate(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.__failFamilyWrites = true;
    Storage.prototype.setItem = function patched(key, value) {
      if (window.__failFamilyWrites && key === "ylb.v5.state") throw new Error("quota-test");
      return original.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: /记录菲菲这一步/ }).click();
  await expect(page.getByRole("alert")).toContainText("无法稳定保存");
  await expect(page.getByRole("button", { name: /记录菲菲这一步/ })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("ylb.v5.state")).records).length)).toBe(0);
  await page.reload();
  await expect(page.getByRole("button", { name: /记录菲菲这一步/ })).toBeVisible();
});

test("进行中的约定不能通过直达链接提前回顾", async ({ page }) => {
  await activateAndCreate(page);
  await page.goto("/#/review");
  await expect(page.getByRole("heading", { name: "现在没有需要回顾的约定" })).toBeVisible();
  await expect(page.locator("[data-action='finish-review']")).toHaveCount(0);
});

test("手册弹窗被浏览器拦截时提供当前页可点击降级入口", async ({ page }) => {
  await page.addInitScript(() => {
    window.__YLB_CONFIG__ = { environment: "development", handbookUrl: "https://handbook.example/path" };
    window.open = () => null;
  });
  await activateAndCreate(page);
  await page.getByRole("button", { name: "方法需要调整？" }).click();
  await expect(page.getByRole("heading", { name: "新窗口没有打开" })).toBeVisible();
  await expect(page.getByRole("link", { name: "在当前页面打开分龄手册" })).toHaveAttribute("href", "https://handbook.example/path");
});

test("恶意心愿图标备份被拒绝且不会生成样式或脚本节点", async ({ page }) => {
  await activateAndCreate(page);
  await page.getByRole("button", { name: "我的" }).click();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("ylb.v5.state")));
  state.wishes[0].icon = "<style>/*";
  state.wishes[0].title = "*/body{display:none}";
  const envelope = { product: "一两步", format: "ylbzlyw-family-backup", backupVersion: 1, schemaVersion: 2, appVersion: "5.1.4", exportedAt: new Date().toISOString(), data: { children: state.children, currentChildId: state.currentChildId, agreements: state.agreements, records: state.records, fruitTransactions: state.fruitTransactions, wishes: state.wishes, petPeaks: state.petPeaks } };
  await page.locator("#backup-input").setInputFiles({ name: "injected-family.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(envelope)) });
  await expect(page.getByRole("heading", { name: "无法导入这份备份" })).toBeVisible();
  await expect(page.locator("#app style, #app script, #app textarea")).toHaveCount(0);
  await expect(page.locator("body")).toBeVisible();
});

test("清空存储失败时保留当前家庭且不跳回开通页", async ({ page }) => {
  await activateAndCreate(page);
  await page.getByRole("button", { name: "我的" }).click();
  await page.evaluate(() => {
    const original = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function patched(key) {
      if (key === "ylb.v5.state") throw new Error("locked-test");
      return original.call(this, key);
    };
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /清空当前浏览器数据/ }).click();
  await expect(page).toHaveURL(/#\/profile/);
  await expect(page.getByText("菲菲", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("无法稳定保存");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("ylb.v5.state")).children[0].nickname)).toBe("菲菲");
});

test("成功清空后刷新仍保持为空家庭", async ({ page }) => {
  await activateAndCreate(page);
  await page.getByRole("button", { name: "我的" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /清空当前浏览器数据/ }).click();
  await expect(page).toHaveURL(/#\/activate/);
  expect(await page.evaluate(() => localStorage.getItem("ylb.v5.state"))).toBeNull();
  await page.reload();
  await expect(page.getByLabel("开通码")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("ylb.v5.state"))).toBeNull();
});

test("同一浏览器两个页面真正同时提交时完整合并或明确冲突", async ({ page }) => {
  await activateAndCreate(page);
  const second = await page.context().newPage();
  await second.addInitScript(() => { window.__YLB_CONFIG__ = { environment: "development", handbookUrl: "" }; });
  await second.goto("/#/home");
  await expect(second.locator(".today-heading h1")).toBeVisible();

  await Promise.all([
    page.getByRole("button", { name: /记录菲菲这一步/ }).click(),
    second.getByRole("button", { name: /记录家长这一步/ }).click(),
  ]);
  await expect.poll(async () => {
    const count = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("ylb.v5.state")).records).length);
    const messages = `${await page.locator("#toast").textContent()} ${await second.locator("#toast").textContent()}`;
    return count === 2 ? "merged" : messages.includes("已保留另一页面的最新更新") ? "conflict" : "pending";
  }).toMatch(/merged|conflict/);
  const afterRace = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("ylb.v5.state")).records).length);
  if (afterRace === 1) {
    const childMissing = await page.getByRole("button", { name: /记录菲菲这一步/ }).count();
    if (childMissing) await page.getByRole("button", { name: /记录菲菲这一步/ }).click();
    else await page.getByRole("button", { name: /记录家长这一步/ }).click();
  }
  await expect(page.getByText(/累计 3 颗/)).toBeVisible();
  const finalState = await page.evaluate(() => JSON.parse(localStorage.getItem("ylb.v5.state")));
  expect(Object.keys(finalState.records)).toHaveLength(2);
  expect(finalState.fruitTransactions.reduce((sum, item) => sum + item.amount, 0)).toBe(3);
  await second.close();
});
