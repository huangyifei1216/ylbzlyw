# 一两步 V5.1.2｜GPT Pro 对抗式复审说明

## 复审目标

这是对上一轮 `NO-GO` 报告的定向修复版。请继续只读、独立、对抗式审查，不要根据本说明直接给出 GO；请以代码与测试为准重新攻击。

## 上一轮 P0 修复

### 1. 生产开通已改为 fail closed

- `config.mjs` 默认环境改为 `production`，只有显式注入 `environment: "development"` 才进入开发体验。
- 本地测试码与验证器已从 `core.mjs` 移到 `demo-access.mjs`。
- `app.js` 仅在开发环境动态加载该模块；生产环境不接受表单测试码、不处理 `?code=` 魔法链接，也不信任本地伪造的 entitlement。
- `_config.yml` 明确把 `demo-access.mjs` 排除在 GitHub Pages 发布物之外。
- `tests/assets.mjs` 检查生产入口文件不含具体测试凭据；E2E 覆盖表单、URL 参数和 localStorage 伪造三种绕过方式。

### 2. V2 状态不变量已补成跨对象合同

重点审查 `state-invariants.mjs`：

- 年龄阶段与 `recordMode` 必须一致。
- active/review-due 不得提前带 review；reviewed/paused 必须有合法 review。
- 每条 record 必须且只能对应一笔匹配角色、孩子、约定、周期的 step transaction。
- record 的 reversedAt 必须与 step reversal 一致。
- 双方有效记录形成时必须且只能有一笔有效 companion；有效 companion 只能引用两条有效记录。
- record reversal、wish refund 的目标、金额、孩子、约定/心愿、周期和时间顺序必须一致。
- active/cancelled 心愿必须没有有效支出；scheduled/completed 必须且只能有一笔有效支出，且支出金额等于目标。
- petPeaks 必须是非负整数，且不能低于历史真正达到过的累计成长峰值。

## 上一轮 P1 修复

- `data-contract.mjs` 的 strict V2 导入现在对全部家庭业务字段做规范化前后深比较，拒绝文本截断、数字夹取、字段补写和静默修正；只保留明确支持的旧 review.date → reviewedAt 迁移。
- `createStorageAdapter()` 保存失败时返回上一次真实持久化快照；`app.js` 的所有关键写操作只有在保存成功后才显示成功、跳转或关闭弹窗。
- `reviewAgreement()` 只接受 `review-due`；直接访问 `#/review` 不能提前结束 active 约定。
- `window.open()` 返回 null 时显示可点击的当前页手册入口。
- `bubu-growth-2.webp` 已按同一母版改为双手自然下垂、用鼻子打招呼，并保持 1024×1024 透明 WebP。

## 建议优先读取

1. `config.mjs`
2. `demo-access.mjs`
3. `app.js`
4. `state-invariants.mjs`
5. `data-contract.mjs`
6. `agreement-engine.mjs`
7. `backup.mjs`
8. `tests/state-invariants.mjs`
9. `tests/data-contract.mjs`
10. `tests/e2e/core-flow.spec.mjs`

## 本地复现

```bash
npm ci
npm run verify
```

预期：9 组 Node 测试全部通过，Playwright 20/20 通过。开发体验必须在页面加载前显式注入 `window.__YLB_CONFIG__ = { environment: "development" }`；默认公开页面是生产 fail-closed 状态。

## 请重点继续攻击

1. 是否还能通过表单、URL、localStorage 或未部署模块取得生产权益。
2. 是否能构造 record/step/companion/reversal 账实不符但通过 normalize 或备份导入。
3. 是否能构造 scheduled/completed/refund 状态错配但通过校验。
4. 写入失败后，内存 UI、localStorage 与刷新结果是否仍可能分叉。
5. strict V2 是否还会对业务文本、金额、峰值或关联字段做静默截断。
6. active 约定能否从路由或领域函数提前回顾。
7. 新窗口被拦截时是否存在真实可操作的降级入口。
