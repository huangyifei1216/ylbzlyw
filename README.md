# 一两步

《战略养娃》IMA 分龄知识库配套的家庭行动 H5。IMA 负责解释原因、给出方法和话术；一两步把一个方法变成孩子和家长各自能做到的一小步，并用象果、步步成长和家庭心愿陪一家人完成 3/7 天尝试。

## 本地运行

```bash
npm run serve
```

打开 [http://127.0.0.1:4173/](http://127.0.0.1:4173/)。本地服务器使用不进入生产包的 `dev.html`，并自动进入开发体验；正式 `index.html` 默认为 production fail-closed。不要直接双击 `dev.html`：浏览器会拦截本地模块，页面会明确提示你打开这个本地地址。

## Dev 预览与源码

- 在线预览：[ylbzlyw dev](https://huangyifei1216.github.io/ylbzlyw/)
- GitHub 源码：[dev 分支](https://github.com/huangyifei1216/ylbzlyw/tree/dev)
- GPT Pro 阅读入口：[GPT-PRO-REVIEW-INDEX.md](./GPT-PRO-REVIEW-INDEX.md)

## 验证与生产白名单构建

```bash
npm test
npm run build:production
npm run test:e2e
npm run verify
```

`build:production` 生成 `dist/`，只含 26 个允许上线的运行文件；不会复制测试码模块、PRD、测试、审查资料、截图或设计源图。

## 当前能力与边界

核心流程：孩子建档 → 选择具体问题 → 家庭约定 → 双方行动 → 象果 → 步步成长／家庭心愿 → 周期回顾。

V5.1.4 包含 V2 数据合同、严格跨对象与时间线不变量、历史逐笔非负象果账本、Web Locks 原子写入/清空、真正并发冲突保护、三字段安全边界、年龄阶段与成长峰值防篡改、连续换心愿流程、固定图标白名单、严格家庭备份、青少年模式和九张 1024×1024 透明步步 WebP。

当前验收包含 9 组 Node 测试与 27 条 Playwright 移动端流程，覆盖 375×667、390×844、430×932、恶意备份注入、三字段安全边界、清空失败/成功刷新、真正并发双页提交、换心愿和生产隔离。关键截图保存在 `artifacts/screenshots/`。

真实订单审批、支付、登录、云同步、跨设备自动恢复和正式 IMA API 仍需生产后端，当前页面不会暗示这些能力已经上线。产品规则见 [PRD.md](./PRD.md)。
