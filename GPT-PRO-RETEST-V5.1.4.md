# V5.1.4｜GPT Pro 对抗复验说明

## 上轮结论

V5.1.3 为 NO-GO。发布阻断项是：真正同时写入时可能双双返回成功并静默覆盖；安全边界只检查问题、不检查双方动作。另有时间线、年龄阶段、成长峰值和换心愿入口等 P1/P2。

## 请独立复现，不接受整改说明代替证据

### 1. 真正并发写入

打开同源两个标签，让两页都停在同一个未记录状态，使用 `Promise.all` 同时点击孩子与家长记录。合格结果是：两边数据完整合并；或一边成功、另一边明确 `storage-conflict`，重试后形成两条记录与 3 颗象果。禁止两边都提示成功但最终只剩一边。

实现入口：`data-contract.mjs` 的 `createStorageAdapter()`、`app.js` 的异步 `save()`；测试：`tests/data-contract.mjs` 与 E2E 最后一条。

### 2. 全约定安全边界

分别测试：问题不安全、问题安全但孩子动作不安全、问题安全但家长动作不安全、三字段均安全。命中时不能进入周期、不能创建约定或象果。把相同危险内容写入 V2 备份，也必须拒绝。

实现入口：`safety.mjs` 的 `checkAgreementSafety()`、`agreement-engine.mjs`、`state-invariants.mjs`；测试：`tests/safety.mjs`、`tests/agreement-engine.mjs`、`tests/backup.mjs` 与两条动作 E2E。

### 3. 时间线和账本

请构造并确认拒绝：记录 24 小时后撤回、同行象果晚于第二条记录、退款与支出同毫秒、历史先支出后收入、active 心愿携带 `scheduledDate`。同时间流水不能通过调整数组顺序改变余额结论。

### 4. 年龄、阶段与步步峰值

请构造并确认拒绝：未来生日；一岁孩子在约定开始日写成 s4；只有 1 颗有效成长流水但 `petPeaks=60`。历史约定应按 `birthDate + startDate` 计算阶段，而不是按当前年龄。

### 5. 换家庭心愿

在 active 或 scheduled 心愿点击“换一个家庭心愿”，确认后必须立即出现新心愿选择；创建成功后旧心愿为 cancelled，新心愿为 active。

### 6. 生产隔离

运行 `npm run build:production`。`dist/` 必须恰好 26 个白名单文件，不包含 `dev.html`、`demo-access.mjs`、测试、文档和设计源；搜索 `dist/app.js` 不得出现 `demo-access.mjs`、`__YLB_DEMO_ACCESS__`、`seedDemo` 或测试开通码。

## 验证命令

```bash
npm ci
npm test
npm run build:production
npm run test:e2e
npm run verify
```

预期：9 组 Node 测试、27 条移动端 E2E、26 文件生产构建全部通过。仍请以独立运行输出和源码对抗样本为准。
