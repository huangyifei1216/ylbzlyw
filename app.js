import { FAMILY_WISHES, PET_STAGES, petProgress, presetsForStage } from "./agreements.mjs";
import { DEMO_CODES, childLimit, dateKeyInShanghai, formatShortDate, getAgeInfo, hasStageAccess, validateCode } from "./core.mjs";
import { createStorageAdapter, emptyState } from "./data-contract.mjs";
import { createAgreement, markReviewDue, periodKeyFor, reviewAgreement } from "./agreement-engine.mjs";
import { recordStep, reverseRecord, walletFor } from "./fruit-ledger.mjs";
import { abandonWish, canScheduleWish, completeWish, createWish, scheduleWish, unscheduleWish } from "./wish-engine.mjs";
import { applyPreparedBackup, prepareBackupImport, stringifyFamilyBackup } from "./backup.mjs";
import { checkProblemSafety, getSafetyBoundary } from "./safety.mjs";
import { APP_CONFIG } from "./config.mjs";

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const storage = createStorageAdapter();
let state = storage.read();
let draft = null;
let modal = null;
let formError = "";
let blockedProblem = "";
let storageWarning = !storage.status().ok;

window.addEventListener("hashchange", render);
app.addEventListener("click", onClick);
app.addEventListener("submit", onSubmit);
app.addEventListener("change", onChange);
activateFromMagicLink();
render();

function render() {
  const route = routeName();
  if (!state.entitlement) return setPage(renderActivation());
  if (route === "bridge" && !state.bridgeSeen) return setPage(renderBridge());
  if (!state.children.length || route === "onboarding") return setPage(renderOnboarding());
  const child = currentChild();
  if (route === "create") return setPage(renderCreate(child));
  if (route === "safety") return setPage(renderSafety());
  const content = route === "agreements" ? renderAgreements(child)
    : route === "pet" ? renderPet(child)
      : route === "profile" ? renderProfile(child)
        : route === "review" ? renderReview(child)
          : renderHome(child);
  setPage(`<div class="app-shell ${teenClass(child)}">${renderTopbar(child)}${storageWarning ? storageWarningHtml() : ""}<main class="content">${content}</main>${renderBottomNav(route)}${renderModal()}</div>`);
}

function setPage(html) { app.innerHTML = html; }
function storageWarningHtml() { return `<aside class="storage-warning" role="alert">当前浏览器无法稳定保存记录。请导出家庭备份，或更换普通浏览模式。</aside>`; }

function renderActivation() {
  const development = APP_CONFIG.environment === "development";
  return `<div class="app-shell auth-shell"><main class="auth-page"><section class="auth-brand"><div class="brand-badge">${bubuArt("avatar")}</div><p>战略养娃 · 配套行动工具</p><h1>一两步</h1><p class="auth-lead">手册帮你找到方法，<br>一两步陪全家把方法做起来。</p></section><section class="auth-card"><p class="overline">${development ? "开发体验" : "项目内测"}</p><h2>输入${development ? "测试" : "内测"}开通码</h2><form id="activation-form"><label class="field"><span>开通码</span><input id="activation-code" name="code" placeholder="BB-XXXXXX" required></label>${errorHtml()}<button class="brand-button full-button">${development ? "开通一两步" : "进入内测版"} <span>→</span></button></form>${development ? `<button class="demo-entry" data-action="demo"><b>先看看完整演示</b><small>体验家庭约定、象果、步步成长和心愿</small></button><details class="demo-codes"><summary>开发测试开通码</summary>${Object.keys(DEMO_CODES).map((code) => `<button data-action="fill-code" data-code="${code}">${code}</button>`).join("")}</details>` : `<p class="production-note">当前为内测版本，请使用项目方提供的内测开通方式。</p>`}</section><p class="auth-footnote">家庭昵称和生日只用于匹配年龄阶段，请勿填写真实姓名、学校、住址等隐私信息。</p></main></div>`;
}

function renderBridge() {
  return `<div class="app-shell bridge-shell"><main class="bridge-page"><div class="success-seal">✓</div><p class="overline">权益已开通</p><h1>先找到方法，再一起行动</h1><p>《战略养娃》分龄手册帮你理解原因、找到话术和观察边界；一两步帮家长和孩子把一个方法变成 3 天或 7 天的小约定。</p><section class="bridge-products"><article><span>01</span><div><b>分龄手册</b><small>查原因、行动、话术和观察边界</small></div></article><article class="is-primary"><span>02</span><div><b>一两步</b><small>定约定、一起行动、记录象果和家庭心愿</small></div></article></section><button class="brand-button full-button" data-action="start-onboarding">建立孩子档案 <span>→</span></button></main></div>`;
}

function renderOnboarding() {
  const adding = state.children.length > 0;
  return `<div class="app-shell"><header class="simple-header"><button data-action="${adding ? "profile" : "reset"}">←</button><b>${adding ? "添加孩子" : "建立家庭档案"}</b><i></i></header><main class="onboarding-page"><section class="onboarding-hero"><div>${bubuArt()}</div><p class="overline">先认识一下</p><h1>${adding ? "再添加一个孩子" : "先为孩子建立家庭档案"}</h1><p>填写家里平时使用的昵称和出生日期，我们会自动匹配年龄阶段。</p></section><form id="child-form" class="onboarding-form"><label class="field"><span>家庭昵称</span><input name="nickname" maxlength="12" placeholder="例如：菲菲" required></label><label class="field"><span>出生日期</span><input name="birthDate" type="date" max="${dateKeyInShanghai()}" required><small>只用于计算年龄阶段。</small></label>${errorHtml()}<button class="brand-button full-button">接下来，建立第一个约定 <span>→</span></button></form>${adding ? "" : `<section class="onboarding-import"><b>以前用过一两步？</b><p>如果已经导出过家庭备份，可以直接恢复孩子档案、约定、象果和家庭回忆。</p><label class="import-button">导入家庭备份<input id="backup-input" type="file" accept="application/json,.json"></label></section>`}</main>${renderModal()}</div>`;
}

function renderTopbar(child) {
  return `<header class="topbar"><button class="brand-lockup" data-action="nav" data-view="home">${bubuArt("avatar")}<span><strong>一两步</strong><small>战略养娃 · 家庭行动</small></span></button><label class="child-select"><select id="child-switcher" aria-label="切换孩子">${state.children.map((item) => `<option value="${item.id}" ${item.id === child.id ? "selected" : ""}>${h(item.nickname)} · ${h(getAgeInfo(item.birthDate).display)}</option>`).join("")}</select></label></header>`;
}

function renderCreate(child) {
  const info = getAgeInfo(child.birthDate);
  if (!info.stage) return simplePage("已经成年", "过去的约定、象果、步步和家庭回忆会一直保留，但不再默认推荐新的分龄约定。", "返回今天", "home");
  if (!hasStageAccess(state.entitlement, info.stage.id)) return simplePage("当前年龄阶段尚未开通", "已有约定和历史仍可查看。建立下一轮新约定需要开通当前阶段。", "返回我的家庭", "profile");
  if (activeAgreement(child.id) && !draft) return simplePage("先回顾当前约定", "每个孩子同一时间只保留一个进行中的约定。请先完成回顾，再开始新一轮。", "查看当前约定", "agreements");
  if (!draft || draft.childId !== child.id) startDraft(child);
  const step = draft.step;
  return `<div class="app-shell create-shell ${teenClass(child)}"><header class="simple-header"><button data-action="create-back">←</button><b>建立家庭约定</b><i>${step}/4</i></header><main class="create-page"><div class="create-progress"><span style="width:${step * 25}%"></span></div>${step === 1 ? renderProblem(child, info.stage.id) : step === 2 ? renderActions(child) : step === 3 ? renderCycleWish(child) : renderPreview(child)}</main></div>`;
}

function renderProblem(child, stageId) {
  return `<section class="create-heading"><p class="overline">第一步 · 只选一件眼前的事</p><h1>最近，你最想和${h(child.nickname)}一起调整什么？</h1><p>一次只处理一个具体场景，更容易真正开始。</p></section><div class="problem-options">${presetsForStage(stageId).map((item) => `<button data-action="choose-problem" data-id="${item.id}"><small>${h(item.category)}</small><b>${h(item.problem)}</b><span>→</span></button>`).join("")}<button data-action="custom-problem"><small>其他日常情况</small><b>自己写一个具体问题</b><span>＋</span></button></div><button class="boundary-link" data-action="show-boundary">哪些问题不适合用“一两步”处理？</button>`;
}

function renderActions(child) {
  const infant = getAgeInfo(child.birthDate).stage?.id === "s1";
  return `<section class="create-heading"><p class="overline">第二步 · 双方各走一步</p><h1>${infant ? "记录宝宝的信号，也记录家长的回应" : "不是只要求孩子，家长也要做一件事"}</h1><p>双方动作都要具体、可观察，家长这一步不能写成监督孩子。</p></section><form id="actions-form" class="create-form"><label class="field"><span>这次想调整</span>${draft.templateId === "custom" ? `<input name="problem" maxlength="60" value="${h(draft.problem)}" placeholder="例如：一说写作业就吵起来" required>` : `<b class="chosen-text">${h(draft.problem)}</b>`}</label><label class="field"><span>${infant ? "宝宝这一步（自然信号）" : `${h(child.nickname)}这一步`}</span><textarea name="childAction" maxlength="100" required>${h(draft.childAction)}</textarea></label><label class="field"><span>家长这一步</span><textarea name="parentAction" maxlength="100" required>${h(draft.parentAction)}</textarea><small>我能独立做到，不以孩子是否配合为前提。</small></label>${errorHtml()}<button class="brand-button full-button">选周期和家庭心愿 <span>→</span></button></form>`;
}

function renderCycleWish(child) {
  const wish = currentWish(child.id);
  return `<section class="create-heading"><p class="overline">第三步 · 先试一小段</p><h1>这次先试多久？</h1><p>结束后只看什么有用，不打分，不统计完成率。</p></section><form id="cycle-form"><div class="duration-options">${[3, 7].map((value) => `<label><input type="radio" name="duration" value="${value}" ${draft.duration === value ? "checked" : ""}><span><b>先试${value}天</b><small>${value === 3 ? "适合刚开始或动作较难" : "适合生活习惯与沟通"}</small></span></label>`).join("")}</div>${wish ? `<section class="carry-wish"><small>继续为这个家庭心愿积累</small><b>${wish.icon} ${h(wish.title)}</b><p>心愿不会因为一轮约定结束而消失。</p></section><input type="hidden" name="wishId" value="${wish.id}">` : `<div class="wish-title"><p class="overline">选一个全家都期待的体验</p><h2>象果攒够后，一起安排</h2><p>不把父母陪伴变成孩子服从后的奖品。</p></div><div class="wish-picker">${FAMILY_WISHES.map((item) => `<label><input type="radio" name="wishId" value="${item.id}" ${draft.wishId === item.id ? "checked" : ""}><span><i>${item.icon}</i><b>${h(item.title)}</b><small>${item.cost}颗象果</small></span></label>`).join("")}</div><label class="field custom-wish-field ${draft.wishId === "custom" ? "" : "is-hidden"}"><span>我们的家庭心愿</span><input name="customWishTitle" minlength="2" maxlength="30" value="${h(draft.customWishTitle || "")}" placeholder="例如：周末一起去江边散步"><small>2—30个字，选一个全家愿意一起安排的体验。</small></label>`}${errorHtml()}<button class="brand-button full-button">一起确认约定 <span>→</span></button></form>`;
}

function renderPreview(child) {
  const wish = wishFromDraft(child.id);
  return `<section class="create-heading"><p class="overline">第四步 · 一起确认</p><h1>${h(child.nickname)}和家长的小约定</h1><p>可以把手机拿给孩子看一眼，再一起开始。</p></section><section class="agreement-preview"><small>这次我们想调整</small><h2>${h(draft.problem)}</h2><div class="preview-actions"><article><span>孩子这一步</span><p>${h(draft.childAction)}</p></article><article><span>家长这一步</span><p>${h(draft.parentAction)}</p></article></div><div class="preview-meta"><span>${draft.duration}天</span><span>${draft.recordMode === "once-per-cycle" ? "本轮各记一次" : "每天各记一次"}</span><span>${wish?.icon || "✨"} ${h(wish?.title || "家庭心愿")}</span></div></section><button class="brand-button full-button" data-action="confirm-agreement">就从今天开始 <span>✓</span></button><button class="secondary-button full-button" data-action="draft-back">返回修改</button>`;
}

function renderHome(child) {
  let agreement = activeAgreement(child.id);
  if (agreement?.status === "active") {
    const updated = markReviewDue(agreement, dateKeyInShanghai());
    if (updated.status !== agreement.status) { replaceAgreement(updated); save(); agreement = updated; }
  }
  if (!agreement) return renderEmptyHome(child);
  if (agreement.status === "review-due") return `<section class="review-due-card"><p class="overline">这一轮走完了</p><h1>一起看看，什么对你们有用？</h1><p>不数缺了几天，也不给任何人打分。只是决定下一步继续、简化、换方向或暂停。</p><button class="brand-button full-button" data-action="nav" data-view="review">一起回顾这一轮 <span>→</span></button></section>${renderPetSummary(child)}`;
  const periodKey = periodKeyFor(agreement, dateKeyInShanghai());
  const childRecord = liveRecord(agreement.id, "child", periodKey);
  const parentRecord = liveRecord(agreement.id, "parent", periodKey);
  const earned = [childRecord, parentRecord].filter(Boolean).length + Number(Boolean(childRecord && parentRecord));
  const teen = ["s5", "s6"].includes(agreement.stageId);
  const handbookCopy = APP_CONFIG.handbookUrl ? "带着当前问题去分龄手册继续查" : "复制当前问题；手册入口将在正式版本配置";
  return `<section class="today-heading"><p class="overline">${h(agreement.duration === 7 ? "这一周" : "这一轮")} · ${formatShortDate(agreement.startDate)}—${formatShortDate(agreement.endDate)}</p><h1>${h(agreement.problem)}</h1></section><section class="mutual-card">${renderAction("child", child, agreement, childRecord)}${renderAction("parent", child, agreement, parentRecord)}<div class="today-reward"><span class="fruit-count" aria-label="${earned}颗象果">${earned ? Array.from({ length: earned }, () => "<i></i>").join("") : "○ ○ ○"}</span><b>${childRecord && parentRecord ? (teen ? "这一轮有推进，你们都记下了自己的这一步。" : "今天，你们都向前走了一小步。") : "双方都记下，会多一颗同行象果。"}</b></div></section>${renderPetSummary(child)}${renderWishCard(child)}<section class="home-secondary"><button data-action="open-handbook" data-query="${h(agreement.problem)}"><b>${APP_CONFIG.handbookUrl ? "方法需要调整？" : "复制当前问题"}</b><small>${handbookCopy}</small><span>${APP_CONFIG.handbookUrl ? "↗" : "□"}</span></button><button data-action="nav" data-view="agreements"><b>查看完整约定</b><small>周期、双方记录和过去轮次</small><span>→</span></button></section>`;
}

function renderAction(role, child, agreement, record) {
  const isChild = role === "child"; const teen = ["s5", "s6"].includes(agreement.stageId); const infant = agreement.stageId === "s1";
  const label = isChild ? (infant ? "宝宝这一步" : `${h(child.nickname)}这一步`) : "家长这一步";
  const action = isChild ? agreement.childAction : agreement.parentAction;
  const button = isChild ? (infant ? "我观察到宝宝的信号了" : teen ? "这次聊过了" : `记录${h(child.nickname)}这一步`) : (teen ? "我也试过了" : "记录家长这一步");
  const canUndo = record && Date.now() - new Date(record.recordedAt).getTime() <= 600000;
  return `<article class="action-check ${isChild ? "is-child" : "is-parent"} ${record ? "is-done" : ""}"><div><small>${label}</small><p>${h(action)}</p></div>${record ? `<div class="recorded-state"><b>✓ 已记下</b><small>${formatShortDate(record.localDate)}</small>${canUndo ? `<button data-action="undo-record" data-id="${record.id}">撤回误操作</button>` : ""}</div>` : `<button data-action="record-step" data-role="${role}" data-id="${agreement.id}">${button}</button>`}</article>`;
}

function renderPetSummary(child) {
  const money = safeWallet(child.id); const total = Math.max(money.totalEarned, state.petPeaks[child.id] || 0); const pet = petProgress(total);
  return `<button class="pet-summary" data-action="nav" data-view="pet"><span>${bubuArt("avatar")}</span><b>步步${h(pet.current.name.replace("步步", ""))} · 累计 ${total} 颗 · 可用 ${money.available} 颗</b><i>→</i></button>`;
}

function renderWishCard(child) {
  const wish = currentWish(child.id); if (!wish) return ""; const money = safeWallet(child.id);
  const copy = wish.status === "scheduled" ? (wish.scheduledDate ? `已安排在 ${formatShortDate(wish.scheduledDate)}，做完以后再回来记下。` : "已经安排好，做完以后再回来记下。") : money.available >= wish.cost ? "象果已经够了，可以一起安排。" : `可用 ${money.available} / ${wish.cost} 颗象果`;
  return `<section class="wish-progress-card ${money.available >= wish.cost ? "is-ready" : ""}"><span>${wish.icon}</span><div><small>我们的家庭心愿</small><b>${h(wish.title)}</b><p>${copy}</p></div>${wish.status === "active" ? `<div class="wish-actions"><button data-action="${money.available >= wish.cost ? "open-schedule" : "pet"}" data-id="${wish.id}">${money.available >= wish.cost ? "一起安排" : "看进度"}</button><button data-action="abandon-wish" data-id="${wish.id}">换一个家庭心愿</button></div>` : `<div class="wish-actions"><button data-action="complete-wish" data-id="${wish.id}">这个心愿实现啦</button><button data-action="unschedule-wish" data-id="${wish.id}">取消这次安排</button><button data-action="abandon-wish" data-id="${wish.id}">放下这个心愿</button></div>`}</section>`;
}

function renderEmptyHome(child) {
  const info = getAgeInfo(child.birthDate);
  if (info.graduated) return simplePage(`${h(child.nickname)}已经成年`, "过去的约定、象果、步步和家庭回忆都还在。现在不再默认推荐新的分龄约定。", "看看家庭回忆", "pet");
  if (!hasStageAccess(state.entitlement, info.stage.id)) return simplePage("进入了新的成长阶段", "已有历史和正在进行的旧阶段约定不受影响；建立下一轮需要开通当前阶段。", "查看我的家庭", "profile");
  return `<section class="empty-hero"><div>${bubuArt("rest")}</div><p class="overline">从一个具体问题开始</p><h1>最近，你最想和${h(child.nickname)}一起调整什么？</h1><p>家长和孩子各走一步，试 3 天或 7 天，再一起看看什么有用。</p><button class="brand-button full-button" data-action="create">建立家庭约定 <span>→</span></button></section>${renderPetSummary(child)}${renderWishCard(child)}`;
}

function renderAgreements(child) {
  const items = state.agreements.filter((item) => item.childId === child.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return `<section class="page-heading"><p class="overline">OUR AGREEMENTS</p><h1>我们的约定</h1><p>一次只做一个问题，双方各走一步。</p></section>${items.map((item) => `<article class="agreement-list-card ${["active", "review-due"].includes(item.status) ? "is-current" : ""}"><small>${statusLabel(item.status)} · ${formatShortDate(item.startDate)}—${formatShortDate(item.endDate)}</small><h2>${h(item.problem)}</h2><div><p><b>孩子：</b>${h(item.childAction)}</p><p><b>家长：</b>${h(item.parentAction)}</p></div>${item.status === "review-due" ? `<button class="brand-button full-button" data-action="nav" data-view="review">一起回顾</button>` : ""}</article>`).join("") || `<div class="simple-empty"><h2>还没有约定</h2><button class="brand-button full-button" data-action="create">建立第一个约定</button></div>`}`;
}

function renderPet(child) {
  const money = safeWallet(child.id); const total = Math.max(money.totalEarned, state.petPeaks[child.id] || 0); const pet = petProgress(total); const current = currentWish(child.id); const memories = state.wishes.filter((item) => item.childId === child.id && item.status === "completed");
  const growthIndex = Math.max(0, PET_STAGES.findIndex((item) => item.name === pet.current.name));
  return `<section class="pet-home"><div class="pet-big-art">${bubuArt(`growth-${growthIndex + 1}`)}</div><p class="overline">${h(child.nickname)}和步步</p><h1>${h(pet.current.name)}</h1><p>${h(pet.current.note)}</p><div class="pet-wallet"><div><strong>${money.available}</strong><span>可用象果</span></div><div><strong>${total}</strong><span>累计象果</span></div></div></section><section class="growth-card"><h2>步步怎么长大</h2><p>${pet.next ? `再获得 ${pet.remaining} 颗象果，步步会${h(pet.next.name.replace("步步", ""))}。` : "步步已经住进成长小屋，新的象果会继续留下家庭故事。"}</p><div class="growth-stages">${PET_STAGES.map((item) => `<div class="${total >= item.min ? "is-open" : ""}"><span>${item.badge}</span><small>${item.min}颗</small><b>${h(item.name.replace("步步", ""))}</b></div>`).join("")}</div></section><section class="fruit-rule"><h2>象果怎么获得？</h2><p>孩子这一步 1 颗 ＋ 家长这一步 1 颗 ＋ 双方同行 1 颗。</p><small>${["s5", "s6"].includes(getAgeInfo(child.birthDate).stage?.id) ? "青春期约定按整轮记录，整个周期最多3颗。" : "日常约定按本地日期记录，每天最多3颗。"} 累计成长达到过的阶段不会倒退。</small></section>${current ? renderWishCard(child) : ""}<section class="wish-memories"><h2>家庭回忆</h2>${memories.map((wish) => `<article><span>${wish.icon}</span><div><b>${h(wish.title)}</b><small>${formatCompleted(wish.completedAt)}</small></div></article>`).join("") || `<p>真正实现的家庭心愿会留在这里。</p>`}</section>`;
}

function renderReview(child) {
  const agreement = activeAgreement(child.id); if (!agreement) return simplePage("现在没有需要回顾的约定", "新的约定结束后，会在这里一起看看。", "返回今天", "home");
  return `<section class="review-page"><p class="overline">这一轮的回顾</p><h1>什么对你们有用？</h1><p>不统计缺了几天，也不评价谁做得好不好。</p><div class="review-summary"><article><small>孩子试过</small><p>${h(agreement.childAction)}</p></article><article><small>家长试过</small><p>${h(agreement.parentAction)}</p></article></div><div class="review-options">${[["continue", "有一点变化，再试一轮"], ["adjust", "动作有点难，改简单一些"], ["change", "这个方向不合适，换个办法"], ["pause", "这段时间先放一放"]].map(([value, label]) => `<button data-action="finish-review" data-value="${value}" data-id="${agreement.id}"><b>${label}</b><span>→</span></button>`).join("")}</div></section>`;
}

function renderProfile(child) {
  return `<section class="page-heading"><p class="overline">FAMILY PROFILE</p><h1>我的家庭</h1><p>管理孩子档案、已购范围和当前浏览器里的家庭数据。</p></section><section class="profile-card entitlement-card"><div><small>当前权益 · ${h(state.entitlement.status)}</small><h2>${h(state.entitlement.label)}</h2><p>${state.entitlement.scope === "all" ? "最多3个孩子" : "1个孩子 · 当前阶段"}</p></div></section><section class="profile-card"><div class="section-title"><h2>孩子档案</h2><span>${state.children.length}/${childLimit(state.entitlement)}</span></div><div class="children-list">${state.children.map((item) => `<article><button data-action="select-child" data-id="${item.id}"><b>${h(item.nickname)}</b><small>${h(getAgeInfo(item.birthDate).display)}</small></button><button data-action="delete-child" data-id="${item.id}">×</button></article>`).join("")}</div>${state.children.length < childLimit(state.entitlement) ? `<button class="secondary-button full-button" data-action="add-child">＋ 添加孩子</button>` : ""}</section><section class="profile-card backup-card"><h2>家庭备份</h2><p>数据默认只保存在当前浏览器。可以导出 JSON 文件，之后在已开通权益的设备上手动导入。</p><button class="secondary-button full-button" data-action="export-backup">导出家庭备份</button><label class="import-button">导入家庭备份<input id="backup-input" type="file" accept="application/json,.json"></label><small>恢复之前从“一两步”导出的家庭备份。导入前会先预览，并由你确认是否替换当前本机数据。</small></section><section class="profile-card menu-list"><button data-action="open-handbook"><span>${APP_CONFIG.handbookUrl ? "《战略养娃》分龄手册" : "复制当前问题"}</span><i>${APP_CONFIG.handbookUrl ? "↗" : "□"}</i></button>${APP_CONFIG.handbookUrl ? "" : `<small class="handbook-config-note">手册入口将在正式版本配置</small>`}<a href="./privacy.html"><span>隐私与使用边界</span><i>→</i></a><button data-action="reset"><span>清空当前浏览器数据</span><i>↺</i></button></section><p class="version-note">一两步 V5.1.1 · 默认只保存在当前浏览器</p>`;
}

function renderSafety() {
  const boundary = getSafetyBoundary();
  return `<div class="app-shell ${currentChild() ? teenClass(currentChild()) : ""}"><header class="simple-header"><button data-action="back-problem">←</button><b>使用边界</b><i></i></header><main class="safety-page"><span class="safety-sign">!</span><p class="overline">SAFETY BOUNDARY</p><h1>${boundary.title}</h1><p>${boundary.body}</p>${blockedProblem ? `<aside>你刚才写的情况触发了最低限度的产品保护。这里只是停止游戏化约定，不代表诊断结果。</aside>` : ""}<ul><li>${APP_CONFIG.handbookUrl ? "去分龄手册查看观察边界" : "复制当前问题，之后带到分龄手册"}</li><li>联系医生或合格专业人员</li><li>如有立即危险，联系当地急救、警方或紧急服务</li></ul><button class="brand-button full-button" data-action="open-handbook" data-query="${h(blockedProblem)}">${APP_CONFIG.handbookUrl ? "去分龄手册查看边界" : "复制当前问题"} <span>${APP_CONFIG.handbookUrl ? "↗" : "□"}</span></button>${APP_CONFIG.handbookUrl ? "" : `<p class="handbook-config-note">手册入口将在正式版本配置</p>`}<button class="secondary-button full-button" data-action="back-problem">返回重新选择问题</button></main></div>`;
}

function renderModal() {
  if (!modal) return "";
  if (modal.type === "schedule") return modalShell(`<h2>一起安排家庭心愿</h2><p>安排不等于已经实现。真正做完以后，再回来记下家庭回忆。</p><form id="schedule-form"><input type="hidden" name="wishId" value="${modal.id}"><label class="field"><span>安排日期（可不填）</span><input type="date" name="scheduledDate" min="${dateKeyInShanghai()}"><small>也可以暂时不定日期。</small></label>${errorHtml()}<button class="brand-button full-button">确认安排</button></form>`);
  if (modal.type === "import") { const p = modal.prepared.preview; return modalShell(`<h2>确认导入家庭备份</h2><p>请先核对备份内容。确认后会替换当前浏览器里的家庭数据，但不会改变当前开通权益。</p><dl class="backup-preview"><div><dt>导出时间</dt><dd>${h(formatInstant(p.exportedAt))}</dd></div><div><dt>孩子档案</dt><dd>${p.childCount}</dd></div><div><dt>家庭约定</dt><dd>${p.agreementCount}</dd></div><div><dt>家庭回忆</dt><dd>${p.memoryCount}</dd></div></dl><button class="danger-button full-button" data-action="confirm-import">确认替换当前本机数据</button><button class="secondary-button full-button" data-action="close-modal">先不导入</button>`); }
  if (modal.type === "import-error") return modalShell(`<h2>无法导入这份备份</h2><p>${h(modal.message)}</p><p>当前浏览器里的家庭数据没有改变。请重新选择从“一两步”导出的完整 JSON 备份。</p><button class="secondary-button full-button" data-action="close-modal">我知道了</button>`);
  if (modal.type === "delete") return modalShell(`<h2>删除这个孩子的档案？</h2><p>相关约定、双方记录、象果、步步和家庭心愿都会从当前浏览器删除。</p><button class="danger-button full-button" data-action="confirm-delete" data-id="${modal.id}">确认删除</button><button class="secondary-button full-button" data-action="close-modal">先保留</button>`);
  return "";
}

function modalShell(body) { return `<div class="modal-backdrop" data-action="close-modal"><section class="modal-sheet" role="dialog" aria-modal="true" aria-label="操作确认" data-action="modal-body"><button class="modal-close" aria-label="关闭弹窗" data-action="close-modal">×</button>${body}</section></div>`; }
function renderBottomNav(route) { return `<nav class="bottom-nav" aria-label="主要导航">${[["home", "今天"], ["agreements", "约定"], ["pet", "步步"], ["profile", "我的"]].map(([view, label]) => `<button class="${route === view ? "is-active" : ""}" ${route === view ? 'aria-current="page"' : ""} data-action="nav" data-view="${view}"><span>${navIcon(view)}</span><b>${label}</b></button>`).join("")}</nav>`; }
function navIcon(view) { const paths = { home: '<path d="M4 10.5 12 4l8 6.5V20h-6v-6h-4v6H4Z"/>', agreements: '<path d="M5 7h9a4 4 0 0 1 0 8H9m0 0 3-3m-3 3 3 3M19 7h-2"/>', pet: '<path d="M7 12c-3-1-3-5-1-6 2-1 3 1 3 3m8 3c3-1 3-5 1-6-2-1-3 1-3 3M8 10c0-5 8-5 8 0v5c0 5-8 5-8 0Zm4 3v5"/>', profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.5-5 3-7 8-7s7.5 2 8 7"/>' }; return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[view]}</svg>`; }

async function onClick(event) {
  const target = event.target.closest("[data-action]"); if (!target) return; const action = target.dataset.action; if (action === "modal-body") return;
  if (action === "nav") return navigate(target.dataset.view);
  if (["home", "profile", "pet", "agreements"].includes(action)) return navigate(action);
  if (action === "fill-code") { document.querySelector("#activation-code").value = target.dataset.code; return; }
  if (action === "demo" && APP_CONFIG.environment === "development") return seedDemo();
  if (action === "start-onboarding") { state.bridgeSeen = true; save(); return navigate("onboarding"); }
  if (action === "add-child") return navigate("onboarding");
  if (action === "select-child") { state.currentChildId = target.dataset.id; save(); return navigate("home"); }
  if (action === "create") { draft = null; return navigate("create"); }
  if (action === "create-back") { if (draft?.step > 1) { draft.step--; formError = ""; return render(); } draft = null; return navigate("home"); }
  if (action === "draft-back") { draft.step--; return render(); }
  if (action === "choose-problem") return chooseProblem(target.dataset.id);
  if (action === "custom-problem") { draft = { ...draft, step: 2, templateId: "custom", templateVersion: 1, problem: "", childAction: "", parentAction: "" }; return render(); }
  if (action === "show-boundary") { blockedProblem = ""; return navigate("safety"); }
  if (action === "back-problem") { blockedProblem = ""; if (!draft) startDraft(currentChild()); draft.step = 1; return navigate("create"); }
  if (action === "confirm-agreement") return confirmAgreementDraft();
  if (action === "record-step") return recordAction(target.dataset.id, target.dataset.role);
  if (action === "undo-record") return undoAction(target.dataset.id);
  if (action === "open-schedule") { modal = { type: "schedule", id: target.dataset.id }; formError = ""; return render(); }
  if (action === "complete-wish") return completeWishAction(target.dataset.id);
  if (action === "unschedule-wish") return unscheduleWishAction(target.dataset.id);
  if (action === "abandon-wish") return abandonWishAction(target.dataset.id);
  if (action === "finish-review") return finishReview(target.dataset.id, target.dataset.value);
  if (action === "open-handbook") return openHandbook(target.dataset.query);
  if (action === "export-backup") return exportBackup();
  if (action === "confirm-import") return confirmImport();
  if (action === "delete-child") { modal = { type: "delete", id: target.dataset.id }; return render(); }
  if (action === "confirm-delete") return deleteChild(target.dataset.id);
  if (action === "close-modal") { modal = null; formError = ""; return render(); }
  if (action === "reset") return resetApp();
}

function onSubmit(event) {
  event.preventDefault(); const data = new FormData(event.target);
  if (event.target.id === "activation-form") return activate(String(data.get("code") || ""));
  if (event.target.id === "child-form") return addChild(String(data.get("nickname") || ""), String(data.get("birthDate") || ""));
  if (event.target.id === "actions-form") return saveActions(String(data.get("problem") || draft.problem), String(data.get("childAction") || ""), String(data.get("parentAction") || ""));
  if (event.target.id === "cycle-form") return saveCycle(Number(data.get("duration")), String(data.get("wishId") || ""), String(data.get("customWishTitle") || ""));
  if (event.target.id === "schedule-form") return scheduleWishAction(String(data.get("wishId")), String(data.get("scheduledDate") || ""));
}

async function onChange(event) {
  if (event.target.id === "child-switcher") { state.currentChildId = event.target.value; save(); return navigate("home"); }
  if (["duration", "wishId", "customWishTitle"].includes(event.target.name)) {
    syncCycleDraftFromForm();
    if (event.target.name === "wishId") return render();
  }
  if (event.target.id === "backup-input") { const file = event.target.files?.[0]; if (!file) return; try { const prepared = prepareBackupImport(state, await file.text()); modal = { type: "import", prepared }; formError = ""; render(); } catch (error) { modal = { type: "import-error", message: error.message }; event.target.value = ""; render(); } }
}

function activate(code) { const result = validateCode(code); if (!result.ok) { formError = result.message; return render(); } state = { ...emptyState(), entitlement: result.entitlement }; formError = ""; save(); navigate("bridge"); }
function addChild(nickname, birthDate) { const clean = nickname.trim(); const info = getAgeInfo(birthDate); if (!clean || !info.valid) { formError = info.reason || "请填写完整信息。"; return render(); } if (state.children.length >= childLimit(state.entitlement)) { formError = "当前版本的孩子档案数量已满。"; return render(); } if (!info.graduated && !hasStageAccess(state.entitlement, info.stage.id)) { formError = `孩子目前属于「${info.stage.label}」，与已购阶段不一致。`; return render(); } const child = { id: uid("child"), nickname: clean, birthDate, createdAt: new Date().toISOString() }; state.children.push(child); state.currentChildId = child.id; state.bridgeSeen = true; save(); startDraft(child); navigate("create"); }
function startDraft(child) { const stage = getAgeInfo(child.birthDate).stage; draft = { step: 1, childId: child.id, stageId: stage?.id, templateId: "", templateVersion: 1, problem: "", childAction: "", parentAction: "", recordMode: ["s5", "s6"].includes(stage?.id) ? "once-per-cycle" : "daily", duration: 7, wishId: "movie", customWishTitle: "" }; }
function chooseProblem(id) { const preset = presetsForStage(draft.stageId).find((item) => item.id === id); if (!preset) return; draft = { ...draft, step: 2, templateId: preset.id, templateVersion: preset.templateVersion, problem: preset.problem, childAction: preset.childAction, parentAction: preset.parentAction, duration: preset.recommendedDuration, recordMode: preset.recordMode }; render(); }
function saveActions(problem, childAction, parentAction) { if ([problem, childAction, parentAction].some((value) => value.trim().length < 4)) { formError = "请把问题和双方行动写得更具体一些。"; return render(); } const safety = checkProblemSafety(problem); if (safety.blocked) { blockedProblem = problem; return navigate("safety"); } draft = { ...draft, step: 3, problem: problem.trim(), childAction: childAction.trim(), parentAction: parentAction.trim() }; formError = ""; render(); }
function saveCycle(duration, wishId, customTitle) { if (![3, 7].includes(duration)) { formError = "请选择3天或7天。"; return render(); } if (!currentWish(draft.childId) && !FAMILY_WISHES.some((item) => item.id === wishId)) { formError = "请选择家庭心愿。"; return render(); } if (!currentWish(draft.childId) && wishId === "custom" && (customTitle.trim().length < 2 || customTitle.trim().length > 30)) { formError = "自定义家庭心愿需要2—30个字。"; return render(); } draft = { ...draft, step: 4, duration, wishId: currentWish(draft.childId)?.id || wishId, customWishTitle: customTitle.trim() }; formError = ""; render(); }

function syncCycleDraftFromForm() {
  const form = document.querySelector("#cycle-form");
  if (!form || !draft) return;
  const data = new FormData(form);
  const duration = Number(data.get("duration"));
  draft = {
    ...draft,
    duration: [3, 7].includes(duration) ? duration : draft.duration,
    wishId: String(data.get("wishId") || draft.wishId || ""),
    customWishTitle: String(data.get("customWishTitle") || "").trim(),
  };
}

function confirmAgreementDraft() {
  try {
    let wish = currentWish(draft.childId);
    if (!wish) { const option = FAMILY_WISHES.find((item) => item.id === draft.wishId); const made = createWish(state.wishes, { childId: draft.childId, title: draft.wishId === "custom" ? draft.customWishTitle : option.title, icon: option.icon, cost: option.cost }); state.wishes = made.wishes; wish = made.wish; }
    const child = currentChild(); const info = getAgeInfo(child.birthDate);
    const made = createAgreement(state.agreements, { ...draft, id: uid("agreement"), wishId: wish.id }, { entitlement: state.entitlement, currentStageId: info.stage?.id, isAdult: info.graduated });
    state.agreements = made.agreements; draft = null; save(); showToast("家庭约定已经开始"); navigate("home");
  } catch (error) { showToast(error.message); }
}

function recordAction(agreementId, role) { try { const agreement = state.agreements.find((item) => item.id === agreementId); const result = recordStep({ records: state.records, transactions: state.fruitTransactions, petPeaks: state.petPeaks }, { agreement, role, localDate: dateKeyInShanghai(), recordedAt: new Date() }); state.records = result.records; state.fruitTransactions = result.transactions; state.petPeaks = result.petPeaks; save(); showToast(result.duplicate ? "这一轮已经记过了" : result.addedTransactions.length === 2 ? "这一小步和同行象果都记下了" : "这一小步已经记下"); render(); } catch (error) { showToast(error.message); } }
function undoAction(recordId) { try { const result = reverseRecord({ records: state.records, transactions: state.fruitTransactions, petPeaks: state.petPeaks }, { recordId, reversedAt: new Date() }); state.records = result.records; state.fruitTransactions = result.transactions; save(); showToast("误操作已撤回，象果同步调整"); render(); } catch (error) { showToast(error.message); } }
function scheduleWishAction(wishId, scheduledDate) { try { const result = scheduleWish(state.wishes, state.fruitTransactions, wishId, { scheduledDate }); state.wishes = result.wishes; state.fruitTransactions = result.transactions; modal = null; save(); showToast("家庭心愿已经安排好"); render(); } catch (error) { formError = error.message; render(); } }
function completeWishAction(wishId) { try { const result = completeWish(state.wishes, wishId); state.wishes = result.wishes; save(); showToast("这个心愿已收进家庭回忆"); render(); } catch (error) { showToast(error.message); } }
function unscheduleWishAction(wishId) { if (!confirm("取消这次安排并全额返还象果吗？心愿会继续保留。")) return; try { const result = unscheduleWish(state.wishes, state.fruitTransactions, wishId); state.wishes = result.wishes; state.fruitTransactions = result.transactions; save(); showToast("这次安排已取消，心愿和象果都保留"); render(); } catch (error) { showToast(error.message); } }
function abandonWishAction(wishId) { if (!confirm("确定放下这个家庭心愿吗？之后可以重新选择一个新心愿。")) return; try { const result = abandonWish(state.wishes, state.fruitTransactions, wishId); state.wishes = result.wishes; state.fruitTransactions = result.transactions; save(); showToast("这个心愿已放下，可以重新选择"); render(); } catch (error) { showToast(error.message); } }
function finishReview(id, outcome) { try { const agreement = state.agreements.find((item) => item.id === id); const reviewed = reviewAgreement(agreement, outcome); replaceAgreement(reviewed); save(); if (outcome === "pause") { showToast("这一轮先放一放"); return navigate("home"); } const child = currentChild(); const info = getAgeInfo(child.birthDate); startDraft(child); if ((outcome === "continue" || outcome === "adjust") && agreement.stageId !== info.stage?.id) { showToast("孩子已经进入新的成长阶段，我们从这个阶段重新选一个当前问题。"); return navigate("create"); } if (outcome === "continue" || outcome === "adjust") { draft = { ...draft, step: outcome === "continue" ? 3 : 2, problem: agreement.problem, childAction: agreement.childAction, parentAction: agreement.parentAction, templateId: agreement.templateId, templateVersion: agreement.templateVersion, duration: agreement.duration, wishId: currentWish(child.id)?.id || "movie" }; } showToast("这一轮已收进过去"); navigate("create"); } catch (error) { showToast(error.message); } }

function exportBackup() { const blob = new Blob([stringifyFamilyBackup(state)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `一两步家庭备份-${dateKeyInShanghai()}.json`; link.click(); URL.revokeObjectURL(url); showToast("家庭备份已经导出"); }
function confirmImport() { try { state = applyPreparedBackup(state, modal.prepared, { confirmed: true }); modal = null; save(); showToast("家庭备份已经导入"); navigate("home"); } catch (error) { showToast(error.message); } }
function deleteChild(id) { state.children = state.children.filter((item) => item.id !== id); const agreementIds = new Set(state.agreements.filter((item) => item.childId === id).map((item) => item.id)); state.agreements = state.agreements.filter((item) => item.childId !== id); state.records = Object.fromEntries(Object.entries(state.records).filter(([, item]) => item.childId !== id && !agreementIds.has(item.agreementId))); state.fruitTransactions = state.fruitTransactions.filter((item) => item.childId !== id); state.wishes = state.wishes.filter((item) => item.childId !== id); delete state.petPeaks[id]; state.currentChildId = state.children[0]?.id || ""; modal = null; save(); navigate(state.children.length ? "profile" : "onboarding"); }
function resetApp() { if (state.entitlement && !confirm("确定清空当前浏览器里的一两步数据吗？建议先导出家庭备份。")) return; storage.clear(); state = emptyState(); storageWarning = !storage.status().ok; draft = null; modal = null; location.hash = "#/activate"; render(); }

function seedDemo() { const entitlement = validateCode("BB-ALL-0001").entitlement; const child = { id: "demo-feifei", nickname: "菲菲", birthDate: "2020-05-18", createdAt: new Date().toISOString() }; state = { ...emptyState(), entitlement, children: [child], currentChildId: child.id, bridgeSeen: true, demo: true }; startDraft(child); draft = { ...draft, step: 4, templateId: "s3-morning", problem: "早上出门总磨蹭", childAction: "起床后先完成自己选的第一项准备", parentAction: "我只提醒一次，并给两个可接受的选择", duration: 7, wishId: "movie" }; save(); confirmAgreementDraft(); }
function activateFromMagicLink() { const code = new URLSearchParams(location.search).get("code"); if (!code || state.entitlement) return; const result = validateCode(code); if (result.ok) { state.entitlement = result.entitlement; save(); history.replaceState({}, "", `${location.pathname}#/bridge`); } }
async function openHandbook(query = "") {
  const text = query || blockedProblem || "请结合孩子年龄，告诉我现场第一步、具体话术和需要观察的情况。";
  if (APP_CONFIG.handbookUrl) window.open(APP_CONFIG.handbookUrl, "_blank", "noopener");
  try {
    await navigator.clipboard.writeText(text);
    showToast(APP_CONFIG.handbookUrl ? "手册已打开，当前问题已复制" : "当前问题已复制；手册入口将在正式版本配置");
  } catch { showToast(APP_CONFIG.handbookUrl ? "手册已打开，但问题未能自动复制" : "未能自动复制，请长按当前问题复制"); }
}

function activeAgreement(childId) { return [...state.agreements].reverse().find((item) => item.childId === childId && ["active", "review-due"].includes(item.status)) || null; }
function currentWish(childId) { return [...state.wishes].reverse().find((item) => item.childId === childId && ["active", "scheduled"].includes(item.status)) || null; }
function wishFromDraft(childId) { const current = currentWish(childId); if (current) return current; const option = FAMILY_WISHES.find((item) => item.id === draft.wishId); return option ? { ...option, title: option.id === "custom" ? draft.customWishTitle : option.title } : null; }
function liveRecord(agreementId, role, periodKey) { return Object.values(state.records).find((item) => item.agreementId === agreementId && item.role === role && item.periodKey === periodKey && !item.reversedAt) || null; }
function safeWallet(childId) { try { return walletFor(state.fruitTransactions, childId); } catch { return { available: 0, totalEarned: state.petPeaks[childId] || 0 }; } }
function replaceAgreement(value) { state.agreements = state.agreements.map((item) => item.id === value.id ? value : item); }
function save() { const result = storage.write(state); state = result.state; storageWarning = !result.ok; }
function currentChild() { return state.children.find((item) => item.id === state.currentChildId) || state.children[0]; }
function routeName() { return location.hash.replace(/^#\/?/, "").split("?")[0] || "home"; }
function navigate(view) { if (routeName() === view) render(); else location.hash = `#/${view}`; }
function simplePage(title, body, button, view) { return `<section class="shell-message"><div>${bubuArt("rest")}</div><h1>${title}</h1><p>${body}</p><button class="brand-button full-button" data-action="nav" data-view="${view}">${button} <span>→</span></button></section>`; }
function statusLabel(status) { return ({ active: "进行中", "review-due": "待回顾", reviewed: "已回顾", paused: "先放一放", archived: "历史" })[status] || status; }
function formatCompleted(value) { const date = String(value || "").slice(0, 10); return /^\d{4}-/.test(date) ? formatShortDate(date) : "已经实现"; }
function formatInstant(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "未知" : date.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }); }
function errorHtml() { return formError ? `<p class="form-error" role="alert">${h(formError)}</p>` : ""; }
function bubuArt(variant = "today") { const safe = ["avatar", "today", "rest", "fruit", "growth-1", "growth-2", "growth-3", "growth-4", "growth-5"].includes(variant) ? variant : "today"; const eager = ["avatar", "today"].includes(safe); return `<img class="bubu-image" src="./assets/bubu-${safe}.webp" width="1024" height="1024" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" alt="小象步步">`; }
function teenClass(child) { return ["s5", "s6"].includes(getAgeInfo(child?.birthDate).stage?.id) ? "is-teen" : ""; }
let toastTimer; function showToast(message) { toast.textContent = message; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2600); }
function uid(prefix) { return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`; }
function h(value = "") { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]); }
