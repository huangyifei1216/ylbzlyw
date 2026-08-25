# GPT Pro 完整阅读索引｜V5.1.1

请优先上传仓库 ZIP；若从 GitHub 阅读，请使用下表 Raw 链接并逐个读到文件末尾。行数和字节数对应当前 `dev` 快照，用于发现页面截断，不能替代正文阅读。

| 顺序 | 文件 | 行数 | 字节数 | 作用 |
| --- | --- | ---: | ---: | --- |
| 1 | [GPT-PRO-HANDOFF.md](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/GPT-PRO-HANDOFF.md) | 72 | 3,543 | 产品定位、闭环、运行方式与真实边界 |
| 2 | [PRD.md](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/PRD.md) | 191 | 10,658 | V5.1.1 产品规则、状态与验收条件 |
| 3 | [app.js](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/app.js) | 300 | 48,963 | 页面、路由、用户交互与领域编排 |
| 4 | [agreements.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/agreements.mjs) | 87 | 5,824 | 六阶段约定模板、步步成长与心愿选项 |
| 5 | [data-contract.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/data-contract.mjs) | 218 | 17,125 | V2 状态合同、V1 迁移与本机存储 |
| 6 | [state-invariants.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/state-invariants.mjs) | 214 | 14,897 | 引用、日期、互斥、记录与账本不变量 |
| 7 | [agreement-engine.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/agreement-engine.mjs) | 190 | 8,375 | 3/7 天、阶段权限、回顾与单活动约定规则 |
| 8 | [fruit-ledger.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/fruit-ledger.mjs) | 218 | 10,963 | daily/整轮记录、1＋1＋1、撤回后重记 |
| 9 | [wish-engine.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/wish-engine.mjs) | 164 | 8,517 | 心愿安排、取消安排、放下、实现与退款 |
| 10 | [backup.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/backup.mjs) | 212 | 10,266 | 家庭备份、严格校验、预览和确认导入 |
| 11 | [safety.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/safety.mjs) | 61 | 2,328 | 自定义问题最低限度风险边界 |
| 12 | [config.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/config.mjs) | 16 | 519 | development/production 与手册入口配置 |
| 13 | [tests/e2e/core-flow.spec.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/tests/e2e/core-flow.spec.mjs) | 377 | 25,480 | 17 条移动端用户流程与截图验收 |
| 14 | [tests/state-invariants.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/tests/state-invariants.mjs) | 67 | 4,864 | 非法业务状态拒绝测试 |
| 15 | [tests/assets.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/tests/assets.mjs) | 29 | 1,653 | 九张素材独立性、体积与引用检查 |
| 16 | [styles-brand.css](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/styles-brand.css) | 17 | 10,356 | 品牌皮肤、移动端和青少年模式 |
| 17 | [V5.1.1-RELEASE-EVIDENCE.md](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/V5.1.1-RELEASE-EVIDENCE.md) | 112 | 6,336 | Bug、测试、素材、截图、CI 与 Git 证据 |

## 完整源码下载

[下载 dev 分支 ZIP](https://github.com/huangyifei1216/ylbzlyw/archive/refs/heads/dev.zip)

## 给评审模型的核对指令

完成阅读后，请先报告：

1. 实际读到的十七个文件名，以及每个文件最后一段或最后一个导出项；
2. “约定—双方行动—象果—步步成长—家庭心愿—回顾”的完整闭环；
3. IMA 分龄知识库与本 H5 各自负责什么；
4. daily 与 once-per-cycle、取消一次安排与放下整个心愿的区别；
5. 备份为何不能恢复权益，以及哪些非法状态会被拒绝；
6. 哪些是真实可运行能力，哪些仍属于生产后端边界；
7. V5.1.1 十五项验收是否各有直接证据，仍有哪些发布风险。

若内容或行数无法核对，请明确指出被截断的文件，不要根据文件名猜测实现。
