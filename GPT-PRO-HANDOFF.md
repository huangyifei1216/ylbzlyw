# 战略养娃｜GPT Pro 交接说明（V5.1.4）

## 产品与边界

“一两步”是《战略养娃》IMA 分龄知识库配套的本地家庭行动 H5，不是知识问答页。IMA 帮家长理解原因、找到话术和观察边界；一两步把一个方法变成 3/7 天家庭约定：孩子一步、家长一步、双方记录、1＋1＋1 象果、步步成长、家庭心愿与周期回顾。

当前没有生产订单后端、支付、登录、云同步、跨设备自动恢复或正式 IMA API。默认数据只在当前浏览器，可手动导出/导入家庭备份；备份不会恢复或覆盖权益。

## V5.1.4 针对上轮 NO-GO 的整改

- 写入和清空改为 Web Locks 排他锁内的 CAS。写请求在等待锁之前捕获预期快照，锁内重新读取；陈旧并发写入只能一边成功，另一边返回 `storage-conflict`；若第二页先收到同步再行动，则完整合并两边数据。无 Web Locks 的浏览器 fail-closed。
- 写入/清空已执行但验证读取失败时返回 `unknown-commit-state`，UI 要求立即刷新核对，不再声称已回滚。
- 安全扫描覆盖 `problem`、`childAction`、`parentAction`，并在 `createAgreement()`、V1→V2、V2 严格导入和状态不变量重复校验。
- 时间线新增：10 分钟撤回上限、同行象果必须等于第二条记录时间、退款严格晚于支出、固定因果排序逐笔非负余额。
- 未来生日、历史约定年龄/阶段错配、伪造 `petPeaks`、active 心愿残留安排日期全部被拒绝。
- “换一个家庭心愿”取消旧心愿后立即打开新心愿选择弹窗，可创建新的 active 心愿。
- development 改走不发布的 `dev.html`；生产 `app.js` 不再保留 demo 动态导入和 seedDemo 分支。生产仍只有 26 个白名单文件。

## 必须按顺序读取

1. `PRD.md`：产品定位、规则、页面与 21 条验收条件。
2. `app.js`：页面路由、交互、事务提交、多页面同步和输出转义。
3. `agreements.mjs`：六阶段模板、心愿预设与步步成长配置。
4. `data-contract.mjs`：V2 规范化、V1 迁移、CAS 存储与清空事务。
5. `state-invariants.mjs`：跨对象引用、生命周期、时间线与账本不变量。
6. `agreement-engine.mjs`、`fruit-ledger.mjs`、`wish-engine.mjs`：三个领域引擎。
7. `backup.mjs`、`wish-icons.mjs`、`config.mjs`：备份边界、图标白名单与运行配置。
8. `tests/*.mjs` 与 `tests/e2e/core-flow.spec.mjs`：9 组 Node 测试和 27 条移动端流程。
9. `scripts/build-production.mjs`：生产发布白名单。
10. `.github/workflows/pages.yml`、`.github/workflows/verify.yml` 与 `package.json`：同提交生产部署和 CI 命令合同。

## 本地验证

```bash
npm ci
npm test
npm run build:production
npm run test:e2e
```

默认配置是 production fail-closed；`npm run serve` 提供开发专用入口，测试仍需在页面加载前显式注入 `window.__YLB_CONFIG__ = { environment: "development" }`。公开生产目录中不应存在 `dev.html` 或 `demo-access.mjs`，生产 `app.js` 也不应引用它们。

## 对抗式复审任务

请只读、独立复审，不根据文档直接给 GO。优先复现上轮两项 P0：用 `Promise.all` 让两个标签真正同时提交；分别把危机/医疗内容放入孩子动作和家长动作。继续攻击未知提交状态、未来生日、历史阶段错配、晚撤回、延迟同行、同毫秒退款、先负后正余额、伪造 `petPeaks`、active 心愿陈旧日期、换心愿断路、生产包残留开发分支，以及 375×667 首屏和底栏遮挡。

不要把产品改回 IMA 问答页，也不要删除“孩子一步＋家长一步＋象果＋步步成长＋家庭心愿”的闭环。
