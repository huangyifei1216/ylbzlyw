# 战略养娃｜GPT Pro 交接说明（V5.1.1）

## 当前产品

这是“战略养娃｜家庭约定 + 双方行动 + 象果 + 小象步步成长”的本地 H5，不是 IMA 知识库问答的复制品。

核心闭环：

1. 家长激活全年龄/年龄档位权益
2. 建立孩子档案（昵称、生日）
3. 选择当前亲子问题
4. 家长和孩子一起确认一个 3 天或 7 天的小约定
5. 家长分别记录“孩子做到了”和“家长做到了”
6. 双方记录后按 1＋1＋1 获得象果
7. 累计象果陪小象步步成长，可用象果用于安排家庭心愿
8. 周期结束后完成回顾，继续、简化、换方向或暂停

IMA 的定位：提供分龄理解、现场话术和观察提醒；H5 的定位：把一次回答变成家长和孩子能共同执行的小行动。

## 目录重点

- `PRD.md`：当前产品主 PRD
- `PRD-V4-FINAL.md`：上一版完整 PRD，作为背景参考
- `app.js`：页面路由、状态和交互
- `styles.css`：页面结构与基础组件；`styles-brand.css`：正式品牌皮肤、移动端和青少年模式
- `config.mjs`：development/production 与分龄手册外链配置
- `core.mjs`：年龄档位、权益与上海时区日期规则
- `agreements.mjs`：六阶段约定模板和步步成长配置
- `data-contract.mjs`：V2 本地状态数据契约、V1 迁移、子女隔离和存储适配器
- `state-invariants.mjs`：规范化后状态的引用、唯一性、日期、互斥与账本不变量
- `agreement-engine.mjs`：约定周期、状态、阶段和权益规则
- `fruit-ledger.mjs`：双方记录、象果流水、撤回和步步历史峰值
- `wish-engine.mjs`：心愿创建、安排、取消一次安排、放下、实现和退款
- `backup.mjs`：只包含家庭数据的严格备份导出、预览和确认导入
- `safety.mjs`：自定义问题最低限度的风险边界
- `tests/smoke.mjs`：核心产品烟测
- `tests/data-contract.mjs`：数据契约和存储测试
- `tests/state-invariants.mjs`：非法业务状态拒绝测试
- `tests/assets.mjs`：素材存在、哈希和体积预算测试
- `tests/e2e/core-flow.spec.mjs`：17 条移动端真实用户流程与截图验收
- `assets/bubu-*.webp`：九张 1024 方形透明生产素材；高分辨率源文件只在 `design-source/`
- `.github/workflows/verify.yml`：Node 22 单测和 Playwright 自动验证

## 本地运行

在本目录运行：

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

然后打开：`http://127.0.0.1:4173/`

验证命令：

```bash
node --check app.js
node --check core.mjs
node --check agreements.mjs
node --check data-contract.mjs
npm test
npm run test:e2e
npm run verify
```

## 给 GPT Pro 的任务边界

先阅读本文件、`PRD.md`、`app.js`、领域引擎和 `data-contract.mjs`，再修改代码。不要把产品改回 IMA 问答页，也不要删除“孩子一步 + 家长一步 + 象果 + 步步成长 + 家庭心愿”的闭环。

当前实现使用 V2 数据合同和严格状态不变量，状态默认只保存在当前浏览器，可手动导入/导出家庭备份；备份不会覆盖当前权益。尚未接入生产订单后端、支付、登录、云同步、跨设备自动恢复或正式 IMA API。

当前自动化还覆盖撤回后重新记录、非 active 拒绝记录、回顾时间迁移、非法备份拒绝、3 天草稿保持、跨阶段不复制、取消安排保留心愿、production 隔离、手册外链行为、五阶段素材与三尺寸移动端布局。截图在 `artifacts/screenshots/`。
