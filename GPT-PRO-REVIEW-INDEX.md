# GPT Pro 完整阅读索引｜V5.1

请不要只阅读 GitHub 代码预览。按以下顺序打开 Raw 原始文本，逐个读到文件末尾，并核对本次 `dev` 快照的行数与字节数。

| 顺序 | 文件 | 行数 | 字节数 | 作用 |
| --- | --- | ---: | ---: | --- |
| 1 | [GPT-PRO-HANDOFF.md](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/GPT-PRO-HANDOFF.md) | 66 | 2,907 | 定位、闭环、运行方式和评审边界 |
| 2 | [PRD.md](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/PRD.md) | 168 | 7,908 | V5.1 产品规则、状态与验收条件 |
| 3 | [app.js](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/app.js) | 269 | 45,326 | 页面、路由、用户交互和领域引擎编排 |
| 4 | [agreements.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/agreements.mjs) | 98 | 6,422 | 六阶段 22 个已审核约定模板 |
| 5 | [data-contract.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/data-contract.mjs) | 164 | 13,399 | V2 状态合同、V1 迁移与本地存储 |
| 6 | [agreement-engine.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/agreement-engine.mjs) | 189 | 8,203 | 3/7 天、阶段权限、回顾与单活动约定规则 |
| 7 | [fruit-ledger.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/fruit-ledger.mjs) | 178 | 8,955 | daily/整轮记录、1＋1＋1、撤回和防重复账本 |
| 8 | [wish-engine.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/wish-engine.mjs) | 135 | 6,742 | 心愿创建、安排、实现、取消与退款 |
| 9 | [backup.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/backup.mjs) | 197 | 9,533 | 家庭数据备份、预览、校验与确认导入 |
| 10 | [safety.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/safety.mjs) | 61 | 2,328 | 自定义问题的最低限度风险边界 |
| 11 | [tests/e2e/core-flow.spec.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/tests/e2e/core-flow.spec.mjs) | 154 | 11,121 | 8 条移动端真实用户流程 |
| 12 | [styles-v51.css](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/styles-v51.css) | 15 | 9,584 | 家长操作层、步步陪伴层与移动端覆盖样式 |

## 完整源码下载

[下载 dev 分支 ZIP](https://github.com/huangyifei1216/ylbzlyw/archive/refs/heads/dev.zip)

## 给评审模型的核对指令

完成阅读后，请先报告：

1. 实际读到的十二个文件名，以及每个文件最后一段或最后一个导出项；
2. 你理解的“约定—双方行动—象果—步步成长—家庭心愿—回顾”闭环；
3. IMA 分龄知识库与本 H5 各自负责什么；
4. daily 与 once-per-cycle 的区别；
5. 备份为何不能恢复或覆盖当前权益；
6. 哪些是真实可运行能力，哪些仍属于生产后端边界。

如果文件内容或行数无法核对，请明确指出被截断的文件，不要根据文件名猜测实现。
