# GPT Pro 完整阅读索引｜V5.1.3

仓库：`huangyifei1216/ylbzlyw`，分支：`dev`。请按顺序读取 Raw 文件；行数与字节数用于确认没有只抓到 GitHub 外壳或截断正文。

| # | 文件 | 行 | 字节 | 用途 |
|---:|---|---:|---:|---|
| 1 | [GPT-PRO-HANDOFF.md](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/GPT-PRO-HANDOFF.md) | 45 | 3,157 | 产品边界、整改摘要与攻击面 |
| 2 | [PRD.md](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/PRD.md) | 198 | 11,937 | V5.1.3 产品规则与 21 条验收条件 |
| 3 | [app.js](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/app.js) | 320 | 52,314 | 页面、事务提交、多页同步与输出转义 |
| 4 | [agreements.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/agreements.mjs) | 87 | 5,824 | 六阶段模板、心愿与步步配置 |
| 5 | [data-contract.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/data-contract.mjs) | 246 | 18,090 | V2、迁移、CAS 写入与清空事务 |
| 6 | [state-invariants.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/state-invariants.mjs) | 330 | 24,617 | 引用、生命周期、时间线与历史账本 |
| 7 | [agreement-engine.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/agreement-engine.mjs) | 196 | 8,675 | 约定领域规则与回顾截止 |
| 8 | [fruit-ledger.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/fruit-ledger.mjs) | 223 | 11,162 | 双方记录、同行象果、撤回与逐笔余额 |
| 9 | [wish-engine.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/wish-engine.mjs) | 167 | 8,715 | 心愿生命周期与退款 |
| 10 | [wish-icons.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/wish-icons.mjs) | 11 | 366 | 固定心愿图标白名单 |
| 11 | [backup.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/backup.mjs) | 212 | 10,266 | 严格家庭备份边界 |
| 12 | [config.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/config.mjs) | 16 | 520 | production fail-closed 配置 |
| 13 | [tests/data-contract.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/tests/data-contract.mjs) | 100 | 7,643 | 存储写入、清空、冲突与迁移测试 |
| 14 | [tests/state-invariants.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/tests/state-invariants.mjs) | 172 | 12,875 | 时间线、注入、孤立撤回与历史余额对抗测试 |
| 15 | [tests/backup.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/tests/backup.mjs) | 141 | 10,031 | 严格导入及恶意图标拒绝 |
| 16 | [tests/e2e/core-flow.spec.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/tests/e2e/core-flow.spec.mjs) | 488 | 32,166 | 24 条移动端真实流程 |
| 17 | [scripts/build-production.mjs](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/scripts/build-production.mjs) | 39 | 2,184 | 26 文件生产白名单构建 |
| 18 | [README.md](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/README.md) | 38 | 1,944 | 运行、验证和能力边界 |
| 19 | [project-control.md](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/project-control.md) | 34 | 1,912 | 当前发布闸门与外部依赖 |
| 20 | [GPT-PRO-RETEST-V5.1.3.md](https://raw.githubusercontent.com/huangyifei1216/ylbzlyw/dev/GPT-PRO-RETEST-V5.1.3.md) | 50 | 2,628 | 上一轮 NO-GO 对应整改 |

## 复审要求

先核对 20 个文件的行数与字节数，再给结论。不要把 `GPT-PRO-RETEST-V5.1.3.md` 当作证据本身；以实现、测试和生产构建为准。

重点验证：持久化 HTML/CSS 注入、清空失败/成功后的 UI 与刷新状态、建立心愿和约定的原子性、两标签页更新、review/record/transaction/wish 时间线、历史先负后正余额、孤立 companion reversal、production 白名单，以及 375×667 首屏。
