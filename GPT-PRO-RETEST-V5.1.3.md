# 一两步 V5.1.3｜GPT Pro 对抗式复审说明

## 结论边界

这是上一轮 NO-GO 的定向整改候选，不自报 GO。请以源码、生产构建结果和测试为准独立攻击。

## 上轮问题对应整改

### P0：心愿图标持久化注入

- `wish-icons.mjs` 定义六个产品允许图标；`createWish()` 拒绝其他输入，V2 备份中的非法图标由状态不变量直接拒绝。
- V1 旧数据仅在迁移阶段把未知图标收敛为 `✨`，非空非法 V2 数据不会被静默修复。
- `app.js` 所有心愿图标输出均调用 `h()`；Node 备份测试和浏览器测试覆盖 `<style>/*`＋`*/body{display:none}` 攻击。

### P0：清空并非事务

- `createStorageAdapter.clear()` 先做快照冲突比较，删除后验证 `getItem() === null`，只在成功后把 `lastPersisted` 更新为空状态。
- 清空异常返回旧快照；`resetApp()` 保留当前家庭与当前路由并显示失败信息。
- 测试覆盖 removeItem 抛错、成功清空、清空后写入失败不能复活旧家庭、刷新保持为空。

### P1：时间线与账本不变量

- 创建时间、上海本地记录日期、record/step 同时、companion 晚于双方记录、回顾晚于周期结束、review outcome/status、心愿支出/退款/完成/取消均有显式约束。
- 余额按 `createdAt + 原数组顺序` 逐笔验证；不再接受“历史先透支、最终补平”。
- 已撤回 companion 必须关联真实已撤回 record，并存在同时间的 step reversal。

### P1：建立心愿和约定非原子

- `confirmAgreementDraft()` 在局部变量里完成心愿和约定两个领域操作，生成完整 `nextState` 后只持久化一次；任一领域规则失败时全局 state 不变。

### P1：多标签页丢更新

- 存储适配器保存前比较最后已读 raw 与当前 raw；不一致返回 `storage-conflict`。
- 页面监听同源 `storage` 事件，重新读取完整状态并清理陈旧草稿；E2E 覆盖两页面互相记录并最终得到 2 条记录、3 颗象果。

### P2：手册提示与可移植发布

- Toast 依据 `window.open()` 的真实返回值区分“已打开”和“被拦截”。
- `npm run build:production` 生成 26 文件白名单目录，并扫描测试码泄露；未来部署不得直接上传仓库根目录。

## 复现

```bash
npm ci
npm test
npm run build:production
npm run test:e2e
```

预期：9 组 Node 测试、24/24 Playwright、26 文件白名单构建全部通过。请继续攻击 strict V2、时间线边界、同毫秒顺序、多页面并发、生产包清单与任何尚未转义的状态字段。
