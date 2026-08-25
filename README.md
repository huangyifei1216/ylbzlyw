# 一两步

《战略养娃》IMA 分龄知识库配套的家庭行动 H5。IMA 负责解释原因、给出方法和话术；一两步把一个方法变成孩子和家长各自能做到的一小步，并用象果、步步成长和家庭心愿陪一家人完成 3/7 天尝试。

## 本地运行

```bash
npm run serve
```

打开 [http://127.0.0.1:4173/](http://127.0.0.1:4173/)。

## Dev 预览

- 在线预览：[ylbzlyw dev](https://huangyifei1216.github.io/ylbzlyw/)
- GitHub 源码：[dev 分支](https://github.com/huangyifei1216/ylbzlyw/tree/dev)
- GPT Pro 完整阅读入口：[GPT-PRO-REVIEW-INDEX.md](./GPT-PRO-REVIEW-INDEX.md)

完整演示可直接点击开通页的“先看看完整演示”。测试码包括：

- `BB-ALL-0001`：0—18 岁全龄版
- `BB-S1-0001` 至 `BB-S6-0001`：六个单阶段版本

## 测试

```bash
npm test
npm run test:e2e
npm run verify
```

## 当前边界

这是可完整体验的本地 H5，数据默认保存在浏览器 localStorage。用户可导出/导入只包含家庭数据的 JSON 备份；备份不包含或恢复开通权益。真实订单审批、云同步、跨设备自动恢复、正式支付与 IMA API 仍需要生产后端，页面没有暗示这些能力已经上线。

核心流程：孩子建档 → 选择具体问题 → 家庭约定 → 双方行动 → 象果 → 步步成长／家庭心愿 → 周期回顾。

V5.1.1 采用独立领域引擎与状态不变量：daily／once-per-cycle 记录、撤回后重记、1＋1＋1 象果、心愿安排/取消安排/放下/实现、V1→V2 数据迁移、敏感问题边界和严格本地备份均有自动测试。

当前验收包含 9 组 Node 测试与 17 条 Playwright 移动端流程，CI 使用 Node 22；关键页面截图保存在 [`artifacts/screenshots/`](./artifacts/screenshots/)。步步使用九张 1024×1024 透明 WebP，五阶段语义和图片均独立，页面不再绘制临时 SVG。

产品规则和验收条件见 [PRD.md](./PRD.md)。
