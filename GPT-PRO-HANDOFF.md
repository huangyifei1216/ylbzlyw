# 战略养娃｜GPT Pro 交接说明（V5.1.3）

## 产品与边界

“一两步”是《战略养娃》IMA 分龄知识库配套的本地家庭行动 H5，不是知识问答页。IMA 帮家长理解原因、找到话术和观察边界；一两步把一个方法变成 3/7 天家庭约定：孩子一步、家长一步、双方记录、1＋1＋1 象果、步步成长、家庭心愿与周期回顾。

当前没有生产订单后端、支付、登录、云同步、跨设备自动恢复或正式 IMA API。默认数据只在当前浏览器，可手动导出/导入家庭备份；备份不会恢复或覆盖权益。

## V5.1.3 重点

- 心愿图标只允许 `wish-icons.mjs` 固定白名单，自定义心愿固定 `✨`；备份入口拒绝 HTML/CSS 注入，所有图标输出仍做 HTML 转义。
- 存储写入与清空都执行快照比较、结果验证和失败回滚。清空失败不跳转、不清 UI；成功清空后最后快照同步变为空。
- 多标签页通过 `storage` 事件实时刷新，陈旧页面写入返回 `storage-conflict`，不能静默覆盖另一页的新数据。
- 建立“心愿＋约定”先在局部快照完成，领域规则全部成功后才一次持久化，不再产生半成品心愿。
- 状态不变量覆盖创建时间、上海本地记录日期、回顾截止、step/record 同时、companion 晚于双方记录、心愿生命周期与按时间逐笔非负余额。
- `npm run build:production` 只复制 26 个白名单运行文件，明确排除测试码模块、文档、测试、截图和设计源图。

## 必须按顺序读取

1. `PRD.md`：产品定位、规则、页面与 21 条验收条件。
2. `app.js`：页面路由、交互、事务提交、多页面同步和输出转义。
3. `agreements.mjs`：六阶段模板、心愿预设与步步成长配置。
4. `data-contract.mjs`：V2 规范化、V1 迁移、CAS 存储与清空事务。
5. `state-invariants.mjs`：跨对象引用、生命周期、时间线与账本不变量。
6. `agreement-engine.mjs`、`fruit-ledger.mjs`、`wish-engine.mjs`：三个领域引擎。
7. `backup.mjs`、`wish-icons.mjs`、`config.mjs`：备份边界、图标白名单与运行配置。
8. `tests/*.mjs` 与 `tests/e2e/core-flow.spec.mjs`：9 组 Node 测试和 24 条移动端流程。
9. `scripts/build-production.mjs`：生产发布白名单。

## 本地验证

```bash
npm ci
npm test
npm run build:production
npm run test:e2e
```

默认配置是 production fail-closed；开发测试必须在页面加载前显式注入 `window.__YLB_CONFIG__ = { environment: "development" }`。公开生产目录中不应存在 `demo-access.mjs`。

## 对抗式复审任务

请只读、独立复审，不根据文档直接给 GO。重点攻击：心愿图标持久化注入、V2 严格导入静默修正、清空/写入失败分叉、两标签页丢更新、约定/记录/象果/心愿时间线、历史余额先负后正、孤立 companion reversal、生产包泄露测试码，以及 375×667 首屏和底栏遮挡。

不要把产品改回 IMA 问答页，也不要删除“孩子一步＋家长一步＋象果＋步步成长＋家庭心愿”的闭环。
