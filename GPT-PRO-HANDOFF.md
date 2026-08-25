# 战略养娃｜GPT Pro 交接说明

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
8. 查看复盘，继续下一轮约定

IMA 的定位：提供分龄理解、现场话术和观察提醒；H5 的定位：把一次回答变成家长和孩子能共同执行的小行动。

## 目录重点

- `PRD.md`：当前产品主 PRD
- `PRD-V4-FINAL.md`：上一版完整 PRD，作为背景参考
- `app.js`：页面路由、状态和交互
- `styles.css`：历史基础样式；`styles-v51.css`：家长操作层的暖米白、森林绿与步步局部陪伴层
- `core.mjs`：年龄档位、权益和基础状态
- `agreements.mjs`：约定模板和双向完成逻辑
- `data-contract.mjs`：V2 本地状态数据契约、V1 迁移、子女隔离和存储适配器
- `agreement-engine.mjs`：约定周期、状态、阶段和权益规则
- `fruit-ledger.mjs`：双方记录、象果流水、撤回和步步历史峰值
- `wish-engine.mjs`：家庭心愿的创建、安排、实现、取消和退款
- `backup.mjs`：只包含家庭数据的本地备份导出/导入
- `safety.mjs`：自定义问题最低限度的风险边界
- `tests/smoke.mjs`：核心产品烟测
- `tests/data-contract.mjs`：数据契约和存储测试
- `tests/e2e/core-flow.spec.mjs`：8 条移动端真实用户流程与截图验收
- `assets/bubu-*.png`：由同一角色母版衍生的透明步步图片，不使用临时 SVG

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
```

## 给 GPT Pro 的任务边界

先阅读本文件、`PRD.md`、`app.js`、领域引擎和 `data-contract.mjs`，再修改代码。不要把产品改回 IMA 问答页，也不要删除“孩子一步 + 家长一步 + 象果 + 步步成长 + 家庭心愿”的闭环。

当前实现使用 V2 数据合同，状态默认只保存在当前浏览器，可手动导入/导出家庭备份；尚未接入生产订单后端、支付、云同步、跨设备自动恢复或正式 IMA API。

当前自动化已覆盖开通建档、家庭约定、1＋1＋1 象果、多孩子隔离、青少年整轮记录、安全边界、备份清空后恢复，以及心愿安排与真正实现分离。截图在 `artifacts/screenshots/`。
