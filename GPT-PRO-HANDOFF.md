# 战略养娃｜GPT Pro 交接说明

## 当前产品

这是“战略养娃｜亲子陪伴 + 约定 + 积分 + 小象成长”的 H5 原型，不是 IMA 知识库问答的复制品。

核心闭环：

1. 家长激活全年龄/年龄档位权益
2. 建立孩子档案（昵称、生日）
3. 选择当前亲子问题
4. 家长和孩子一起确认一个 3 天或 7 天的小约定
5. 家长分别记录“孩子做到了”和“家长做到了”
6. 双方完成后获得香果积分
7. 香果用于小象布布成长和家庭愿望兑换
8. 查看复盘，继续下一轮约定

IMA 的定位：提供分龄理解、现场话术和观察提醒；H5 的定位：把一次回答变成家长和孩子能共同执行的小行动。

## 目录重点

- `PRD.md`：当前产品主 PRD
- `PRD-V4-FINAL.md`：上一版完整 PRD，作为背景参考
- `app.js`：页面路由、状态和交互
- `styles.css`：蓝色/黄色/珊瑚红的亲子陪伴 UI
- `core.mjs`：年龄档位、权益和基础状态
- `agreements.mjs`：约定模板和双向完成逻辑
- `data-contract.mjs`：本地状态数据契约、迁移、子女隔离和存储适配器
- `tests/smoke.mjs`：核心产品烟测
- `tests/data-contract.mjs`：数据契约和存储测试

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
node tests/data-contract.mjs
```

## 给 GPT Pro 的任务边界

先阅读本文件、`PRD.md`、`app.js`、`agreements.mjs` 和 `data-contract.mjs`，再修改代码。不要把产品改回 IMA 问答页，也不要删除“孩子完成 + 家长完成 + 香果 + 布布成长 + 家庭愿望”的闭环。

当前实现是前端原型，状态保存在浏览器本地；尚未接入生产账号、支付、后端数据库或真正的 IMA API。
