# 一两步

《战略养娃》IMA 分龄知识库配套的家庭行动 H5。IMA 负责解答育儿问题；一两步把方法变成孩子和家长各自能做到的一小步，并用象果、步步成长和家庭心愿陪一家人完成 3/7 天尝试。

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
```

## 当前边界

这是可完整体验的本地 H5 成品，数据保存在浏览器 localStorage。真实订单审批、一次性 magic link、跨设备云同步和正式开通码需要生产后端与平台账号，项目没有伪装这些能力已经上线。

核心流程：孩子建档 → 选择具体问题 → 家庭约定 → 双方行动 → 象果 → 步步成长／家庭心愿 → 周期回顾。

产品规则和验收条件见 [PRD.md](./PRD.md)。
