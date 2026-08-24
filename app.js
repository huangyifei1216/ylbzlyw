import {
  FAMILY_WISHES, PET_STAGES, checkinReward, petProgress, presetsForStage, wallet,
} from "./agreements.mjs";
import {
  DEMO_CODES, childLimit, dateKeyInShanghai, formatShortDate,
  getAgeInfo, hasStageAccess, validateCode,
} from "./core.mjs";
import { createStorageAdapter, normalizeState } from "./data-contract.mjs";

const STORAGE_KEY = "ylb.v5.state";
const DEFAULT_STATE = {
  version: 5,
  entitlement: null,
  children: [],
  currentChildId: "",
  agreements: [],
  checkins: {},
  redemptions: [],
  petPeaks: {},
  settings: { handbookUrl: "" },
  bridgeSeen: false,
  demo: false,
};

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const stateStorage = createStorageAdapter({ key: STORAGE_KEY });
let state = loadState();
let modal = null;
let draft = null;
let formError = "";

activateFromMagicLink();
window.addEventListener("hashchange", render);
app.addEventListener("click", onClick);
app.addEventListener("submit", onSubmit);
app.addEventListener("change", onChange);
render();

function render() {
  const route = routeName();
  if (!state.entitlement) {
    app.innerHTML = renderActivation(route === "restore");
    return;
  }
  if (route === "bridge" && !state.bridgeSeen) {
    app.innerHTML = renderBridge();
    return;
  }
  if (!state.children.length || route === "onboarding") {
    app.innerHTML = renderOnboarding();
    return;
  }
  const child = currentChild();
  if (route === "create") {
    if (!draft || draft.childId !== child.id) startDraft(child);
    app.innerHTML = renderCreate(child);
    return;
  }
  const page = route === "agreements" ? renderAgreements(child)
    : route === "pet" ? renderPet(child)
      : route === "profile" ? renderProfile(child)
        : route === "review" ? renderReview(child)
          : renderHome(child);
  app.innerHTML = `<div class="app-shell">
    ${renderTopbar(child)}
    <main class="content">${page}</main>
    ${renderBottomNav(route)}
    ${renderModal(child)}
  </div>`;
}

function renderActivation(showRestore = false) {
  return `<div class="app-shell auth-shell"><main class="auth-page">
    <section class="auth-brand"><div class="brand-badge">${bubuArt("logo")}</div><p>战略养娃 · 配套行动工具</p><h1>一两步</h1><p class="auth-lead">手册告诉你可以怎么做，<br>一两步陪全家真正做起来。</p></section>
    <section class="auth-card"><p class="overline">${showRestore ? "换设备找回" : "购买后开通"}</p><h2>${showRestore ? "找回我的家庭空间" : "输入开通码"}</h2>
      ${showRestore ? `<form id="restore-form"><label class="field"><span>找回凭证</span><input name="code" placeholder="BB-XXXXXX" required></label><label class="field"><span>订单号后四位</span><input name="orderLast4" inputmode="numeric" pattern="\\d{4}" maxlength="4" required></label>${errorHtml()}<button class="primary-button full-button">找回一两步 <span>→</span></button></form><button class="text-button centered" data-action="go-activate">返回开通</button>`
        : `<form id="activation-form"><label class="field"><span>开通码</span><input id="activation-code" name="code" placeholder="BB-XXXXXX" required></label>${errorHtml()}<button class="primary-button full-button">开通一两步 <span>→</span></button></form><button class="demo-entry" data-action="demo-all"><span>先看看完整演示</span><small>含家庭约定、象果、步步成长和心愿</small></button><details class="demo-codes"><summary>开发测试开通码</summary><div>${Object.keys(DEMO_CODES).map((code) => `<button data-action="fill-code" data-code="${code}">${code}</button>`).join("")}</div></details><button class="text-button centered" data-action="go-restore">换设备？找回家庭空间</button>`}
    </section><p class="auth-footnote">昵称和生日仅用于匹配分龄方案。请勿填写真实姓名、学校、住址等隐私信息。</p>
  </main></div>`;
}

function renderBridge() {
  return `<div class="app-shell bridge-shell"><main class="bridge-page">
    <div class="success-seal">✓</div><p class="overline">购买权益已确认</p><h1>方法和行动，都准备好了</h1>
    <p>《战略养娃》分龄手册帮你弄懂问题；一两步把方法变成家长和孩子各自能做到的一小步。</p>
    <section class="bridge-products"><article><span>01</span><div><b>分龄手册</b><small>查原因、行动、话术和观察边界</small></div></article><article class="is-primary"><span>02</span><div><b>一两步</b><small>建约定、一起行动、陪步步成长</small></div></article></section>
    <aside class="recovery-card"><small>找回凭证</small><strong>${h(state.entitlement.recoveryCode)}</strong><button data-action="copy-code">复制</button><p>换设备时，可用它和订单号后四位找回。</p></aside>
    <button class="kid-primary-button full-button" data-action="start-onboarding">建立孩子档案 <span>→</span></button>
  </main></div>`;
}

function renderOnboarding() {
  const adding = state.children.length > 0;
  return `<div class="app-shell onboarding-shell"><header class="simple-header"><button data-action="${adding ? "go-profile" : "reset"}">←</button><span>${adding ? "添加孩子" : "建立家庭档案"}</span><i></i></header>
    <main class="onboarding-page"><section class="onboarding-hero"><div>${bubuArt("onboarding")}</div><p class="overline">先认识一下</p><h1>${adding ? "再添加一个孩子" : "今天想陪谁走一小步？"}</h1><p>填写家里的昵称和生日，步步会按年龄准备合适的约定方案。</p></section>
    <form id="child-form" class="onboarding-form"><label class="field"><span>孩子昵称</span><input name="nickname" maxlength="12" placeholder="例如：菲菲" required></label><label class="field"><span>出生日期</span><input name="birthDate" type="date" max="${dateKeyInShanghai()}" required><small>仅用于计算成长阶段。</small></label>${errorHtml()}<button class="kid-primary-button full-button">接下来，建立第一个约定 <span>→</span></button></form></main>
  </div>`;
}

function renderTopbar(child) {
  return `<header class="topbar"><button class="brand-lockup" data-action="nav" data-view="home">${bubuArt("mark")}<span><strong>一两步</strong><small>战略养娃 · 家庭行动</small></span></button><label class="child-select"><span class="sr-only">切换孩子</span><select id="child-switcher">${state.children.map((item) => `<option value="${item.id}" ${item.id === child.id ? "selected" : ""}>${h(item.nickname)} · ${h(getAgeInfo(item.birthDate).display)}</option>`).join("")}</select><i>⌄</i></label></header>`;
}

function renderCreate(child) {
  const info = getAgeInfo(child.birthDate);
  if (!info.stage || !hasStageAccess(state.entitlement, info.stage.id)) return shellMessage("当前年龄阶段尚未开通", "已有记录会保留。请回到原小红书订单联系卖家办理升级。", "返回我的家庭", "go-profile");
  const presets = presetsForStage(info.stage.id);
  const step = draft?.step || 1;
  return `<div class="app-shell create-shell"><header class="simple-header"><button data-action="cancel-create">←</button><span>建立家庭约定</span><i>${step}/4</i></header><main class="create-page">
    <div class="create-progress"><span style="width:${step * 25}%"></span></div>
    ${step === 1 ? renderCreateProblem(child, presets) : step === 2 ? renderCreateActions(child) : step === 3 ? renderCreateWish(child) : renderCreatePreview(child)}
  </main></div>`;
}

function renderCreateProblem(child, presets) {
  const isInfant = getAgeInfo(child.birthDate).stage?.id === "s1";
  return `<section class="create-heading"><p class="overline">第一步 · 选一件眼前的事</p><h1>${isInfant ? `最近，你想观察和陪伴${h(child.nickname)}什么？` : `最近，你最想和${h(child.nickname)}一起改善什么？`}</h1><p>${isInfant ? "先选一个具体场景。一次只关注一个信号，更容易开始。" : "先选一个具体场景。一次只处理一件，更容易开始。"}</p></section><div class="problem-options">${presets.map((item) => `<button data-action="choose-problem" data-id="${item.id}"><small>${h(item.category)}</small><b>${h(item.problem)}</b><span>→</span></button>`).join("")}<button data-action="choose-custom-problem"><small>其他情况</small><b>自己写一个具体问题</b><span>＋</span></button></div>`;
}

function renderCreateActions(child) {
  const isInfant = getAgeInfo(child.birthDate).stage?.id === "s1";
  return `<section class="create-heading"><p class="overline">第二步 · 各走一小步</p><h1>${isInfant ? "不是给宝宝布置任务，而是记录信号与家长的回应" : "不是只要求孩子，家长也要做一件事"}</h1><p>${isInfant ? "宝宝的信号是自然出现的，家长的动作要具体到今天能做到。" : "动作要具体到今天能看见、能做到。"}</p></section>
    <form id="actions-form" class="create-form"><div class="chosen-problem"><small>这次想改善</small>${draft.problemId === "custom" ? `<label class="field custom-problem"><span class="sr-only">具体问题</span><input name="problem" maxlength="50" value="${h(draft.problem)}" placeholder="例如：一说写作业就吵起来" required></label>` : `<b>${h(draft.problem)}</b>`}</div>
      <label class="field action-field child-action-field"><span>${isInfant ? "宝宝这一步（信号或回应）" : `${h(child.nickname)}这一步`}</span><textarea name="childAction" maxlength="80" required>${h(draft.childAction || "")}</textarea><small>${isInfant ? "记录宝宝自然出现的信号或回应，不是给宝宝布置任务。" : "一次只写一个看得见的小动作。"}</small></label>
      <label class="field action-field parent-action-field"><span>家长这一步</span><textarea name="parentAction" maxlength="80" required>${h(draft.parentAction || "")}</textarea><small>家长的行动必须能独立完成，不能写成“提醒孩子做到”。</small></label>
      ${errorHtml()}<button class="kid-primary-button full-button">选周期和家庭心愿 <span>→</span></button>
    </form>`;
}

function renderCreateWish(child) {
  return `<section class="create-heading"><p class="overline">第三步 · 先试一小段</p><h1>这次先试多久？</h1><p>结束后只是一起看看什么有用，不给任何人打分。</p></section>
    <form id="wish-form" class="create-form">
      <div class="duration-options"><label><input type="radio" name="duration" value="3" ${draft.duration === 3 ? "checked" : ""}><span><b>先试3天</b><small>适合刚开始或动作较难</small></span></label><label><input type="radio" name="duration" value="7" ${draft.duration !== 3 ? "checked" : ""}><span><b>先试7天</b><small>适合生活习惯和沟通</small></span></label></div>
      <div class="wish-title"><p class="overline">一起选一个家庭心愿</p><h2>象果攒够后，全家一起做</h2><p>它不是孩子的奖品，是你们提前商量好的共同时间。</p></div>
      <div class="wish-picker">${FAMILY_WISHES.map((wish) => `<label><input type="radio" name="wishId" value="${wish.id}" ${draft.wishId === wish.id ? "checked" : ""}><span><i>${wish.icon}</i><b>${h(wish.title)}</b><small>${wish.cost}颗象果</small></span></label>`).join("")}</div>
      ${errorHtml()}<button class="kid-primary-button full-button">看看我们的约定 <span>→</span></button>
    </form>`;
}

function renderCreatePreview(child) {
  const isInfant = getAgeInfo(child.birthDate).stage?.id === "s1";
  const wish = FAMILY_WISHES.find((item) => item.id === draft.wishId) || FAMILY_WISHES[0];
  return `<section class="create-heading"><p class="overline">第四步 · 一起确认</p><h1>${isInfant ? `关于${h(child.nickname)}的家庭约定` : `${h(child.nickname)}和家长的第一个小约定`}</h1><p>${isInfant ? "记录观察与回应，全家一起开始。" : "把手机拿给孩子看一眼，再一起开始。"}</p></section>
    <section class="agreement-preview"><span class="preview-stamp">1·2</span><small>这次我们想改善</small><h2>${h(draft.problem)}</h2><div class="preview-actions"><article><span>${isInfant ? "宝宝" : "孩子"}</span><p>${h(draft.childAction)}</p></article><article><span>家长</span><p>${h(draft.parentAction)}</p></article></div><div class="preview-meta"><span>先试 ${draft.duration} 天</span><span>${wish.icon} ${h(wish.title)}</span><span>${wish.cost}颗象果</span></div></section>
    <button class="kid-primary-button full-button" data-action="confirm-agreement">就从今天开始 <span>✓</span></button><button class="secondary-button full-button create-back" data-action="draft-back">返回修改</button>`;
}

function renderHome(child) {
  const info = getAgeInfo(child.birthDate);
  if (info.graduated) return shellMessage(`${h(child.nickname)}已经成年`, "新的行动建议已经结束，过去一起做过的事仍然保留。", "看看步步", "go-pet");
  if (!hasStageAccess(state.entitlement, info.stage?.id)) return shellMessage("进入了新的成长阶段", "已有约定和象果都会保留。请回到原小红书订单联系卖家办理升级。", "返回我的家庭", "go-profile");
  const agreement = activeAgreement(child.id);
  const money = walletFor(child.id);
  const pet = petProgress(petTotal(child.id,money));
  if (!agreement) return renderEmptyHome(child, pet, money);
  if (dateKeyInShanghai() > agreement.endDate) return renderReviewDue(child, agreement, pet, money);
  const todayKey = checkinKey(agreement.id);
  const today = state.checkins[todayKey] || {};
  const reward = checkinReward(today);
  const wishReady = !agreement.wishRedeemed && money.available >= agreement.wishCost;
  return `
    <section class="pet-strip"><div class="pet-strip-copy"><p class="overline">${h(child.nickname)}的步步</p><h2>${h(pet.current.name)}</h2><div class="mini-progress"><span style="width:${pet.value}%"></span></div><small>累计 ${petTotal(child.id,money)} 颗象果 · 可用 ${money.available} 颗</small></div><div class="pet-strip-art pet-level-${pet.current.level}">${bubuArt("hero")}<i>${pet.current.badge}</i></div><button data-action="nav" data-view="pet">看看步步 →</button></section>
    <section class="today-heading"><p class="overline">${formatShortDate(dateKeyInShanghai())} · ${h(info.stage.label)}</p><h1>今天，我们各走一小步</h1><p>${h(agreement.problem)} · ${periodLabel(agreement)}</p></section>
    <section class="mutual-card">
      ${renderActionCheck("child", child, agreement, today.child)}
      <div class="together-line"><span>＋</span><p>两边都记下，步步会多收获1颗同行象果</p></div>
      ${renderActionCheck("parent", child, agreement, today.parent)}
      <div class="today-reward"><span>${reward ? "🥭".repeat(reward) : "○ ○ ○"}</span><b>今天已收下 ${reward} 颗象果</b></div>
    </section>
    <section class="wish-progress-card ${wishReady ? "is-ready" : ""}"><span class="wish-icon">${agreement.wishIcon}</span><div><small>我们的家庭心愿</small><b>${h(agreement.wishTitle)}</b><p>${agreement.wishRedeemed ? "已经一起实现，收进家庭回忆。" : wishReady ? "象果已经攒够，可以一起安排啦。" : `可用 ${money.available} / ${agreement.wishCost} 颗象果`}</p></div>${wishReady ? `<button data-action="redeem-wish" data-id="${agreement.id}">一起实现</button>` : `<button data-action="nav" data-view="pet">${agreement.wishRedeemed ? "看回忆" : "看进度"}</button>`}</section>
    <section class="home-secondary"><button data-action="open-handbook" data-query="${h(agreement.problem)}"><b>方法需要调整？</b><small>带着这个问题去分龄手册继续查</small><span>↗</span></button><button data-action="nav" data-view="agreements"><b>查看完整约定</b><small>周期、过去记录和回顾</small><span>→</span></button></section>`;
}

function renderActionCheck(role, child, agreement, done) {
  const childSide = role === "child";
  const stageId = getAgeInfo(child.birthDate).stage?.id;
  const isInfant = stageId === "s1";
  const isTeen = stageId === "s5" || stageId === "s6";
  const label = childSide ? (isInfant ? "宝宝这一步" : `${h(child.nickname)}这一步`) : "家长这一步";
  const action = childSide ? agreement.childAction : agreement.parentAction;
  const pendingText = childSide
    ? (isInfant ? "我观察到宝宝的信号了" : (isTeen ? "这周聊过啦" : `看到${h(child.nickname)}做到了`))
    : "今天我做到了";
  return `<article class="action-check ${childSide ? "is-child" : "is-parent"} ${done ? "is-done" : ""}"><div><small>${label}</small><p>${h(action)}</p></div><button data-action="toggle-checkin" data-role="${role}" data-id="${agreement.id}">${done ? "✓ 已记下" : pendingText}</button>${done ? `<button class="undo-check" data-action="toggle-checkin" data-role="${role}" data-id="${agreement.id}">撤回</button>` : ""}</article>`;
}

function renderEmptyHome(child, pet, money) {
  const isInfant = getAgeInfo(child.birthDate).stage?.id === "s1";
  const hasHistory = state.agreements.some((item) => item.childId === child.id);
  return `<section class="empty-hero"><div class="empty-bubu pet-level-${pet.current.level}">${bubuArt("hero")}<i>${pet.current.badge}</i></div><p class="overline">欢迎来到一两步</p><h1>${isInfant ? `最近，你想观察和陪伴${h(child.nickname)}什么？` : `最近，你最想和${h(child.nickname)}一起改善什么？`}</h1><p>${isInfant ? "选一个具体场景，步步会帮你们变成宝宝信号观察和家长的一次回应。" : "选一个具体问题，步步会帮你们把它变成孩子和家长各自能做到的一件事。"}</p><button class="kid-primary-button full-button" data-action="create-agreement">${hasHistory ? "建立新约定" : "建立家庭约定"} <span>→</span></button></section><aside class="plain-explain"><b>接下来会发生什么？</b><p>${isInfant ? "每天记录一次观察和回应，得到象果；象果会陪步步长大，也能一起实现家庭心愿。" : "每天各做一小步，得到象果；象果会陪步步长大，也能一起实现家庭心愿。"}</p></aside>`;
}

function renderReviewDue(child, agreement, pet, money) {
  return `<section class="pet-strip"><div class="pet-strip-copy"><p class="overline">这一轮已经走完</p><h2>${h(pet.current.name)}</h2><small>你们一起收下了 ${agreementEarned(agreement.id)} 颗象果</small></div><div class="pet-strip-art pet-level-${pet.current.level}">${bubuArt("hero")}<i>${pet.current.badge}</i></div></section><section class="review-due-card"><span>↻</span><p class="overline">${h(child.nickname)}和家长的回顾</p><h1>这一小段，什么对你们有用？</h1><p>一起决定下一步是继续、变简单，还是换个方向。</p><button class="kid-primary-button full-button" data-action="nav" data-view="review">一起看看这一轮 <span>→</span></button></section>`;
}

function renderAgreements(child) {
  const items = state.agreements.filter((item) => item.childId === child.id).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  const active = activeAgreement(child.id);
  return `<section class="page-heading"><p class="overline">OUR AGREEMENTS</p><h1>我们的约定</h1><p>一次只做一个。这里保留每次尝试过的方法和双方的行动。</p></section>
    ${active ? renderAgreementDetail(active, child) : `<div class="simple-empty"><span>1·2</span><h2>现在没有进行中的约定</h2><p>从一个具体问题开始，建立下一轮。</p><button class="kid-primary-button full-button" data-action="create-agreement">建立新约定 <span>→</span></button></div>`}
    ${items.filter((item) => item.status !== "active").length ? `<section class="agreement-history"><div class="section-title"><div><p class="overline">PAST ROUNDS</p><h2>走过的小路</h2></div></div>${items.filter((item) => item.status !== "active").map((item) => `<article><span>${item.review?.outcomeIcon || "○"}</span><div><small>${formatShortDate(item.startDate)}—${formatShortDate(item.endDate)} · ${agreementEarned(item.id)}颗象果</small><b>${h(item.problem)}</b><p>${h(item.review?.outcomeLabel || "这一轮已经收好")}</p></div></article>`).join("")}</section>` : ""}
    ${!active ? "" : `<button class="text-button centered" data-action="end-agreement" data-id="${active.id}">想提前调整这个约定</button>`}`;
}

function renderAgreementDetail(agreement, child) {
  const isInfant = getAgeInfo(child.birthDate).stage?.id === "s1";
  const days = enumerateDates(agreement.startDate, agreement.endDate);
  return `<section class="agreement-detail-card"><div class="agreement-top"><span>进行中</span><small>${periodLabel(agreement)}</small></div><h2>${h(agreement.problem)}</h2><div class="agreement-actions"><article><small>${isInfant ? "宝宝这一步" : `${h(child.nickname)}这一步`}</small><p>${h(agreement.childAction)}</p></article><article><small>家长这一步</small><p>${h(agreement.parentAction)}</p></article></div><div class="agreement-days">${days.map((date) => { const item=state.checkins[checkinKey(agreement.id,date)]||{}; return `<div><small>${Number(date.slice(-2))}</small><span class="${item.child ? "child-done" : ""}">${isInfant ? "宝" : "孩"}</span><span class="${item.parent ? "parent-done" : ""}">家</span></div>`; }).join("")}</div><div class="agreement-wish"><span>${agreement.wishIcon}</span><div><small>家庭心愿</small><b>${h(agreement.wishTitle)}</b></div><i>${agreement.wishRedeemed ? "已经一起实现" : `${agreement.wishCost}颗象果`}</i></div></section>`;
}

function renderPet(child) {
  const money = walletFor(child.id);
  const pet = petProgress(petTotal(child.id,money));
  const agreement = activeAgreement(child.id);
  const isInfant = getAgeInfo(child.birthDate).stage?.id === "s1";
  return `<section class="pet-home pet-level-${pet.current.level}"><div class="pet-rays"></div><div class="pet-big-art">${bubuArt("diary")}<i>${pet.current.badge}</i></div><p class="overline">${h(child.nickname.toUpperCase())} & BUBU</p><h1>${h(pet.current.name)}</h1><p>${h(pet.current.note)}</p><div class="pet-wallet"><div><strong>${money.available}</strong><span>可用象果</span></div><div><strong>${petTotal(child.id,money)}</strong><span>累计象果</span></div></div></section>
    <section class="growth-card"><div class="section-title"><div><p class="overline">GROWTH MAP</p><h2>步步怎么长大</h2></div><span>第${pet.current.level}阶段</span></div><div class="growth-progress"><span style="width:${pet.value}%"></span></div><p>${pet.next ? `再收下 ${pet.remaining} 颗象果，步步会「${h(pet.next.name.replace("步步",""))}」。` : "步步已经住进成长小屋，新的象果会继续装进家庭回忆。"}</p><div class="growth-stages">${PET_STAGES.map((stage) => `<div class="${petTotal(child.id,money) >= stage.min ? "is-open" : ""}"><span>${stage.badge}</span><small>${stage.min}颗</small><b>${h(stage.name.replace("步步",""))}</b></div>`).join("")}</div></section>
    <section class="fruit-rule"><h2>象果是怎么来的？</h2><div><span>🥭</span><p><b>${isInfant ? "宝宝这一步" : "孩子这一步"}</b>记下后1颗</p></div><div><span>🥭</span><p><b>家长这一步</b>记下后1颗</p></div><div><span>🥭</span><p><b>同一天双方都记下</b>额外1颗同行象果</p></div><small>累计象果决定步步成长，永远不会减少；兑换心愿只使用可用象果。</small></section>
    ${agreement ? `<section class="pet-wish-card"><span>${agreement.wishIcon}</span><p class="overline">当前家庭心愿</p><h2>${h(agreement.wishTitle)}</h2><p>${agreement.wishRedeemed ? "这个心愿已经成为家庭回忆。" : `需要 ${agreement.wishCost} 颗 · 现在可用 ${money.available} 颗`}</p>${!agreement.wishRedeemed && money.available >= agreement.wishCost ? `<button class="kid-primary-button full-button" data-action="redeem-wish" data-id="${agreement.id}">一起实现这个心愿 <span>→</span></button>` : ""}</section>` : ""}
    ${state.redemptions.filter((item)=>item.childId===child.id).length ? `<section class="wish-memories"><div class="section-title"><div><p class="overline">FAMILY MEMORIES</p><h2>实现过的心愿</h2></div></div>${state.redemptions.filter((item)=>item.childId===child.id).map((item)=>`<article><span>${item.icon}</span><div><b>${h(item.title)}</b><small>${formatShortDate(item.date)}</small></div></article>`).join("")}</section>` : ""}`;
}

function renderReview(child) {
  const isInfant = getAgeInfo(child.birthDate).stage?.id === "s1";
  const agreement = activeAgreement(child.id);
  if (!agreement) return shellMessage("现在没有需要回顾的约定", "建立新约定后，周期结束会在这里一起看看。", "建立新约定", "create-agreement");
  return `<section class="review-page"><div class="review-bubu">${bubuArt("hero")}</div><p class="overline">OUR LITTLE REVIEW</p><h1>这一轮，什么对你们有用？</h1><p>你们收下了 <b>${agreementEarned(agreement.id)}颗象果</b>。不数缺了几天，只看下一步想怎么走。</p><div class="review-summary"><article><small>${isInfant ? "观察到的宝宝信号" : `${h(child.nickname)}试过`}</small><p>${h(agreement.childAction)}</p></article><article><small>家长试过</small><p>${h(agreement.parentAction)}</p></article></div><div class="review-options"><button data-action="finish-review" data-value="continue" data-id="${agreement.id}"><span>🌱</span><b>有一点变化，再试一轮</b><small>保留这两个动作，再走${agreement.duration}天</small></button><button data-action="finish-review" data-value="adjust" data-id="${agreement.id}"><span>✂️</span><b>动作有点难，改简单一些</b><small>保留问题，重新调整双方动作</small></button><button data-action="finish-review" data-value="change" data-id="${agreement.id}"><span>🧭</span><b>这个方向不合适，换个办法</b><small>回到问题选择，重新开始</small></button><button data-action="finish-review" data-value="pause" data-id="${agreement.id}"><span>☁️</span><b>这段时间先放一放</b><small>约定会被收进过去，不影响象果</small></button></div></section>`;
}

function renderProfile(child) {
  const money = walletFor(child.id);
  return `<section class="page-heading"><p class="overline">FAMILY PROFILE</p><h1>我的家庭</h1><p>管理孩子档案、已购范围和本机记录。</p></section>
    <section class="profile-card entitlement-card"><span class="entitlement-stamp">${state.entitlement.scope === "all" ? "0—18" : "AGE"}</span><div><small>当前已开通</small><h2>${h(state.entitlement.label)}</h2><p>${state.entitlement.scope === "all" ? "最多3个孩子，随年龄自动切换方案。" : "1个孩子，使用当前购买阶段。"}</p></div></section>
    <section class="profile-card"><div class="section-title"><div><p class="overline">CHILDREN</p><h2>孩子档案</h2></div><span>${state.children.length}/${childLimit(state.entitlement)}</span></div><div class="children-list">${state.children.map((item) => { const info=getAgeInfo(item.birthDate); return `<article class="${item.id===child.id?"is-current":""}"><button data-action="select-child" data-id="${item.id}"><b>${h(item.nickname)}</b><small>${h(info.display)} · ${h(info.stage?.label||"已成年")}</small></button><button class="delete-icon" data-action="delete-child" data-id="${item.id}">×</button></article>`; }).join("")}</div>${state.children.length<childLimit(state.entitlement)?`<button class="secondary-button full-button" data-action="add-child">＋ 添加一个孩子</button>`:""}</section>
    <section class="profile-card family-numbers"><div><strong>${petTotal(child.id,money)}</strong><span>${h(child.nickname)}的象果</span></div><div><strong>${state.agreements.filter((item)=>item.childId===child.id).length}</strong><span>走过的约定</span></div><div><strong>${state.redemptions.filter((item)=>item.childId===child.id).length}</strong><span>家庭心愿</span></div></section>
    <section class="profile-card menu-list"><button data-action="open-handbook"><span>《战略养娃》分龄手册</span><i>↗</i></button><a href="./privacy.html"><span>隐私与使用边界</span><i>→</i></a><button data-action="export"><span>导出本机记录</span><i>↓</i></button><button data-action="reset"><span>重置本机演示</span><i>↺</i></button></section><p class="version-note">一两步 V5.0 · 数据保存在当前浏览器</p>`;
}

function renderBottomNav(route) {
  const items=[["home","今天","⌂"],["agreements","约定","1·2"],["pet","步步","🐘"],["profile","我的","○"]];
  return `<nav class="bottom-nav">${items.map(([view,label,icon])=>`<button data-action="nav" data-view="${view}" class="${route===view?"is-active":""}"><span>${icon}</span><b>${label}</b></button>`).join("")}</nav>`;
}

function renderModal() {
  if (!modal) return "";
  if (modal.type === "fruit") {
    const isInfant = modal.isInfant;
    return modalShell(`<article class="success-sheet"><div class="success-stamp">🥭</div><p class="overline">XIANGGUO SAVED</p><h2>${modal.count===3 ? (isInfant ? "今天观察和陪伴都记下啦" : "你们今天一起做到了") : "这一小步，记下了"}</h2><p>${modal.count===3 ? `${isInfant ? "宝宝1颗" : "孩子1颗"}、家长1颗，还有1颗同行象果。` : "步步把这颗象果收进了成长口袋。"}</p><button class="kid-primary-button full-button" data-action="close-modal">看看今天的约定</button></article>`);
  }
  if (modal.type === "growth") return modalShell(`<article class="growth-success"><div class="growth-success-art pet-level-${modal.stage.level}">${bubuArt("diary")}<i>${modal.stage.badge}</i></div><p class="overline">BUBU GREW UP</p><h2>${h(modal.stage.name)}！</h2><p>${h(modal.stage.note)}</p><button class="kid-primary-button full-button" data-action="go-pet">看看步步的新样子 <span>→</span></button></article>`);
  if (modal.type === "wish") return modalShell(`<article class="wish-success"><span>${modal.agreement.wishIcon}</span><p class="overline">FAMILY WISH</p><h2>这个心愿，可以一起实现啦</h2><p>${h(modal.agreement.wishTitle)}</p><div class="wish-next-step">现在不用在手机里继续点。一起商量一个时间，把它真正安排进生活里。</div><button class="kid-primary-button full-button" data-action="close-modal">把它收进家庭回忆</button></article>`);
  if (modal.type === "delete") { const target=state.children.find((item)=>item.id===modal.id); return modalShell(`<article class="confirm-sheet"><h2>删除${h(target?.nickname||"这个孩子")}的档案？</h2><p>相关约定、象果和家庭回忆也会从本机删除。</p><button class="danger-button full-button" data-action="confirm-delete" data-id="${modal.id}">确认删除</button><button class="secondary-button full-button" data-action="close-modal">先保留</button></article>`); }
  if (modal.type === "end") return modalShell(`<article class="confirm-sheet"><h2>想提前调整这次约定？</h2><p>已经得到的象果不会减少。你可以现在进入回顾，决定继续、改简单或换方向。</p><button class="kid-primary-button full-button" data-action="go-review">现在一起回顾 <span>→</span></button><button class="secondary-button full-button" data-action="close-modal">继续这次约定</button></article>`);
  return "";
}

function modalShell(body) {
  return `<div class="modal-backdrop" data-action="close-modal"><section class="modal-sheet" role="dialog" aria-modal="true" data-action="modal-body"><button class="modal-close" data-action="close-modal">×</button>${body}</section></div>`;
}

function onClick(event) {
  const target=event.target.closest("[data-action]");
  if(!target) return;
  const action=target.dataset.action;
  if(action==="modal-body") return;
  if(action==="nav") return navigate(target.dataset.view);
  if(action==="go-profile") return navigate("profile");
  if(action==="go-pet"){ modal=null; return navigate("pet"); }
  if(action==="go-review"){ modal=null; return navigate("review"); }
  if(action==="go-activate") return navigate("activate");
  if(action==="go-restore") return navigate("restore");
  if(action==="fill-code"){ const input=document.querySelector("#activation-code"); if(input) input.value=target.dataset.code; return; }
  if(action==="demo-all") return seedFullDemo();
  if(action==="copy-code") return copyText(state.entitlement.recoveryCode,"找回凭证已复制");
  if(action==="start-onboarding"){ state.bridgeSeen=true; saveState(); return navigate("onboarding"); }
  if(action==="add-child") return navigate("onboarding");
  if(action==="select-child"){ state.currentChildId=target.dataset.id; saveState(); return navigate("home"); }
  if(action==="create-agreement"){ startDraft(currentChild()); return navigate("create"); }
  if(action==="cancel-create"){
    if(draft && draft.step > 1){
      draft.step -= 1;
      formError = "";
      return render();
    }
    draft = null;
    formError = "";
    return navigate(activeAgreement(currentChild().id) ? "home" : "agreements");
  }
  if(action==="choose-problem") return chooseProblem(target.dataset.id);
  if(action==="choose-custom-problem"){ draft={...draft,step:2,problemId:"custom",problem:"",childAction:"",parentAction:""}; return render(); }
  if(action==="draft-back"){ draft.step=Math.max(1,draft.step-1); formError=""; return render(); }
  if(action==="confirm-agreement") return confirmAgreement();
  if(action==="toggle-checkin") return toggleCheckin(target.dataset.id,target.dataset.role);
  if(action==="redeem-wish") return redeemWish(target.dataset.id);
  if(action==="finish-review") return finishReview(target.dataset.id,target.dataset.value);
  if(action==="end-agreement"){ modal={type:"end",id:target.dataset.id}; return render(); }
  if(action==="open-handbook") return openHandbook(target.dataset.query);
  if(action==="delete-child"){ modal={type:"delete",id:target.dataset.id}; return render(); }
  if(action==="confirm-delete") return deleteChild(target.dataset.id);
  if(action==="close-modal"){ modal=null; return render(); }
  if(action==="export") return exportRecords();
  if(action==="reset") return resetApp();
}

function onSubmit(event) {
  event.preventDefault();
  const data=new FormData(event.target);
  if(event.target.id==="activation-form") return activateCode(String(data.get("code")||""));
  if(event.target.id==="restore-form") return restoreCode(String(data.get("code")||""),String(data.get("orderLast4")||""));
  if(event.target.id==="child-form") return addChild(String(data.get("nickname")||""),String(data.get("birthDate")||""));
  if(event.target.id==="actions-form") return saveDraftActions(String(data.get("childAction")||""),String(data.get("parentAction")||""),String(data.get("problem")||draft.problem));
  if(event.target.id==="wish-form") return saveDraftWish(Number(data.get("duration")),String(data.get("wishId")||""));
}

function onChange(event) {
  if(event.target.id!=="child-switcher") return;
  state.currentChildId=event.target.value; saveState(); navigate("home");
}

function activateCode(rawCode) {
  const result=validateCode(rawCode);
  if(!result.ok){ formError=result.message; return render(); }
  state={...structuredClone(DEFAULT_STATE),entitlement:result.entitlement}; formError=""; saveState(); navigate("bridge");
}

function restoreCode(rawCode,orderLast4) {
  const result=validateCode(rawCode);
  if(!result.ok||!/^\d{4}$/.test(orderLast4)){ formError=result.ok?"请输入正确的订单号后四位。":result.message; return render(); }
  state={...structuredClone(DEFAULT_STATE),entitlement:result.entitlement,bridgeSeen:true}; formError=""; saveState(); navigate("onboarding");
}

function addChild(nickname,birthDate) {
  const clean=nickname.trim();
  const info=getAgeInfo(birthDate);
  if(!clean||!info.valid){ formError=info.reason||"请填写昵称和正确的出生日期。"; return render(); }
  if(state.children.length>=childLimit(state.entitlement)){ formError="当前版本的孩子档案数量已满。"; return render(); }
  if(!info.graduated&&!hasStageAccess(state.entitlement,info.stage.id)){ formError=`孩子目前属于「${info.stage.label}」，与已购阶段不一致。`; return render(); }
  const child={id:uid(),nickname:clean,birthDate};
  state.children.push(child); state.currentChildId=child.id; state.bridgeSeen=true; formError=""; saveState(); startDraft(child); navigate("create");
}

function startDraft(child) {
  if (!child) return;
  draft={step:1,childId:child.id,problemId:"",problem:"",childAction:"",parentAction:"",duration:7,wishId:"movie"};
}

function chooseProblem(id) {
  const child=currentChild();
  const stage=getAgeInfo(child.birthDate).stage;
  if(!stage) return;
  const preset=presetsForStage(stage.id).find((item)=>item.id===id);
  if(!preset) return;
  draft={...draft,step:2,problemId:preset.id,problem:preset.problem,childAction:preset.childAction,parentAction:preset.parentAction};
  render();
}

function saveDraftActions(childAction,parentAction,problem=draft.problem) {
  if(problem.trim().length<4){ formError="请先写清楚这次想改善的具体问题。"; return render(); }
  if(childAction.trim().length<4||parentAction.trim().length<4){ formError="请把双方动作写得再具体一点。"; return render(); }
  draft={...draft,step:3,problem:problem.trim(),childAction:childAction.trim(),parentAction:parentAction.trim()}; formError=""; render();
}

function saveDraftWish(duration,wishId) {
  if(![3,7].includes(duration)||!FAMILY_WISHES.some((item)=>item.id===wishId)){ formError="请选择周期和一个家庭心愿。"; return render(); }
  draft={...draft,step:4,duration,wishId}; formError=""; render();
}

function confirmAgreement() {
  const child=currentChild();
  const wish=FAMILY_WISHES.find((item)=>item.id===draft.wishId)||FAMILY_WISHES[0];
  state.agreements.filter((item)=>item.childId===child.id&&item.status==="active").forEach((item)=>{item.status="completed"; item.review={outcome:"replaced",outcomeLabel:"换了一种更适合的方法",outcomeIcon:"🧭",date:dateKeyInShanghai()};});
  const startDate=dateKeyInShanghai();
  state.agreements.push({id:uid(),childId:child.id,problemId:draft.problemId,problem:draft.problem,childAction:draft.childAction,parentAction:draft.parentAction,duration:draft.duration,startDate,endDate:shiftDate(startDate,draft.duration-1),wishId:wish.id,wishTitle:wish.title,wishIcon:wish.icon,wishCost:wish.cost,wishRedeemed:false,status:"active",createdAt:new Date().toISOString()});
  draft=null; saveState(); showToast("家庭约定已经开始"); navigate("home");
}

function toggleCheckin(agreementId,role) {
  const agreement=state.agreements.find((entry)=>entry.id===agreementId);
  if(!agreement) return;
  const childId=agreement.childId;
  const key=checkinKey(agreementId);
  const beforeWallet=walletFor(childId);
  const item=state.checkins[key]||{agreementId,date:dateKeyInShanghai(),childId,child:false,parent:false};
  item.childId = childId;
  item.agreementId = agreementId;
  item[role]=!item[role];
  if(item.child||item.parent) state.checkins[key]=item; else delete state.checkins[key];
  const afterWallet=walletFor(childId);
  const beforePet=petProgress(petTotal(childId,beforeWallet)).current;
  if(afterWallet.totalEarned>beforeWallet.totalEarned) state.petPeaks[childId]=Math.max(state.petPeaks[childId]||0,afterWallet.totalEarned);
  saveState();
  const afterPet=petProgress(petTotal(childId,afterWallet)).current;
  const isInfant = getAgeInfo(state.children.find((c) => c.id === childId)?.birthDate || "").stage?.id === "s1";
  if(afterWallet.totalEarned>beforeWallet.totalEarned&&afterPet.level>beforePet.level) modal={type:"growth",stage:afterPet};
  else if(item[role]) modal={type:"fruit",count:checkinReward(item),isInfant};
  else showToast("这一步的记录已撤回，象果也同步调整");
  render();
}

function redeemWish(agreementId) {
  const agreement=state.agreements.find((item)=>item.id===agreementId);
  const money=agreement?walletFor(agreement.childId):{available:0};
  if(!agreement||agreement.wishRedeemed||money.available<agreement.wishCost){ showToast("现在的可用象果还不够"); return; }
  agreement.wishRedeemed=true;
  state.redemptions.push({id:uid(),agreementId,childId:agreement.childId,title:agreement.wishTitle,icon:agreement.wishIcon,cost:agreement.wishCost,date:dateKeyInShanghai()});
  saveState(); modal={type:"wish",agreement}; render();
}

function finishReview(id,outcome) {
  const agreement=state.agreements.find((item)=>item.id===id);
  if(!agreement) return;
  const choices={continue:["有一点变化，再试一轮","🌱"],adjust:["动作有点难，准备改简单一些","✂️"],change:["这个方向不合适，准备换个办法","🧭"],pause:["这段时间先放一放","☁️"]};
  const [outcomeLabel,outcomeIcon]=choices[outcome]||choices.pause;
  agreement.status="completed"; agreement.review={outcome,outcomeLabel,outcomeIcon,date:dateKeyInShanghai()};
  saveState();
  if(outcome==="continue"){
    const start=dateKeyInShanghai();
    state.agreements.push({...agreement,id:uid(),status:"active",startDate:start,endDate:shiftDate(start,agreement.duration-1),wishRedeemed:false,review:null,createdAt:new Date().toISOString()});
    saveState(); showToast("新一轮已经开始"); return navigate("home");
  }
  if(outcome==="adjust"){
    draft={step:2,childId:agreement.childId,problemId:agreement.problemId,problem:agreement.problem,childAction:agreement.childAction,parentAction:agreement.parentAction,duration:agreement.duration,wishId:agreement.wishId};
    return navigate("create");
  }
  if(outcome==="change"){
    const reviewedChild = state.children.find((c) => c.id === agreement.childId) || currentChild();
    state.currentChildId = reviewedChild.id;
    startDraft(reviewedChild);
    return navigate("create");
  }
  showToast("这一轮已经收进过去"); navigate("home");
}

function deleteChild(id) {
  state.children=state.children.filter((item)=>item.id!==id);
  const ids=new Set(state.agreements.filter((item)=>item.childId===id).map((item)=>item.id));
  state.agreements=state.agreements.filter((item)=>item.childId!==id);
  Object.keys(state.checkins).filter((key)=>ids.has(state.checkins[key]?.agreementId) || state.checkins[key]?.childId === id).forEach((key)=>delete state.checkins[key]);
  state.redemptions=state.redemptions.filter((item)=>item.childId!==id);
  delete state.petPeaks[id];
  state.currentChildId=state.children[0]?.id||""; modal=null; saveState(); navigate(state.children.length?"profile":"onboarding");
}

async function openHandbook(query="") {
  const search=query||"请结合孩子年龄，先告诉我现场第一步、具体话术和需要观察的情况";
  await copyText(search,"问题已复制，请到分龄手册中粘贴搜索");
  if(state.settings.handbookUrl) window.open(state.settings.handbookUrl,"_blank","noopener");
}

function exportRecords() {
  const payload={exportedAt:new Date().toISOString(),product:"一两步",version:5,data:state};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url; link.download=`一两步家庭记录-${dateKeyInShanghai()}.json`; link.click();
  URL.revokeObjectURL(url); showToast("家庭记录已经导出");
}

function resetApp() {
  if(state.entitlement&&!window.confirm("确定清空这台设备上的一两步数据吗？导出后再清空更安心。")) return;
  stateStorage.clear();
  state=structuredClone(DEFAULT_STATE); modal=null; draft=null; formError="";
  location.hash="#/activate"; render();
}

function seedFullDemo() {
  const result=validateCode("BB-ALL-0001");
  const today=dateKeyInShanghai();
  const child={id:"demo-feifei",nickname:"菲菲",birthDate:"2022-05-18",createdAt:new Date().toISOString()};
  const second={id:"demo-xiaoyu",nickname:"小宇",birthDate:"2017-08-01",createdAt:new Date().toISOString()};
  const agreement={id:"demo-agreement",childId:child.id,problemId:"s3-morning",problem:"早上出门总要催很多遍",childAction:"听到出门提醒后，自己选好先穿鞋还是先背书包",parentAction:"只提醒一次，再给菲菲两分钟自己行动",duration:7,startDate:shiftDate(today,-2),endDate:shiftDate(today,4),wishId:"movie",wishTitle:"一起看一部全家电影",wishIcon:"🎬",wishCost:9,wishRedeemed:false,status:"active",createdAt:new Date().toISOString()};
  const day1=shiftDate(today,-2); const day2=shiftDate(today,-1);
  state={...structuredClone(DEFAULT_STATE),entitlement:result.entitlement,children:[child,second],currentChildId:child.id,agreements:[agreement],checkins:{[checkinKey(agreement.id,day1)]:{agreementId:agreement.id,childId:child.id,date:day1,child:true,parent:true},[checkinKey(agreement.id,day2)]:{agreementId:agreement.id,childId:child.id,date:day2,child:true,parent:true},[checkinKey(agreement.id,today)]:{agreementId:agreement.id,childId:child.id,date:today,child:false,parent:true}},redemptions:[],petPeaks:{[child.id]:7},bridgeSeen:true,demo:true};
  saveState(); location.hash="#/home"; render(); showToast("完整演示已准备好：再记录菲菲这一步，就能实现家庭心愿");
}

function activateFromMagicLink() {
  const params=new URLSearchParams(location.search);
  const code=params.get("code");
  if(!code||state.entitlement) return;
  const result=validateCode(code);
  if(result.ok){ state.entitlement=result.entitlement; saveState(); history.replaceState({},"",`${location.pathname}#/bridge`); }
}

function activeAgreement(childId) {
  return [...state.agreements].reverse().find((item)=>item.childId===childId&&item.status==="active")||null;
}

function agreementEarned(agreementId) {
  return Object.values(state.checkins).filter((item)=>item.agreementId===agreementId).reduce((sum,item)=>sum+checkinReward(item),0);
}

function walletFor(childId) {
  const childAgreementIds = new Set(state.agreements.filter((item) => item.childId === childId).map((item) => item.id));
  const checkins = Object.fromEntries(
    Object.entries(state.checkins).filter(([, item]) => childAgreementIds.has(item.agreementId) && (!item.childId || item.childId === childId))
  );
  return wallet(checkins, state.redemptions.filter((item) => item.childId === childId));
}

function petTotal(childId,money=walletFor(childId)) { return Math.max(money.totalEarned,state.petPeaks[childId]||0); }

function checkinKey(agreementId,date=dateKeyInShanghai()) { return `${agreementId}:${date}`; }

function periodLabel(agreement) { return `${formatShortDate(agreement.startDate)}—${formatShortDate(agreement.endDate)} · ${agreement.duration}天`; }

function enumerateDates(start,end) {
  const dates=[]; let cursor=start;
  while(cursor<=end&&dates.length<31){ dates.push(cursor); cursor=shiftDate(cursor,1); }
  return dates;
}

function shiftDate(date,days) {
  const [year,month,day]=date.split("-").map(Number);
  const value=new Date(Date.UTC(year,month-1,day+days));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth()+1).padStart(2,"0")}-${String(value.getUTCDate()).padStart(2,"0")}`;
}

function routeName() { return location.hash.replace(/^#\/?/,"").split("?")[0]||"home"; }
function navigate(view) { location.hash=`#/${view}`; if(routeName()===view) render(); }
function currentChild() { return state.children.find((item)=>item.id===state.currentChildId)||state.children[0]; }

function shellMessage(title,body,button,action) {
  return `<section class="shell-message"><div class="shell-message-art">${bubuArt("hero")}</div><h1>${title}</h1><p>${body}</p><button class="kid-primary-button full-button" data-action="${action}">${button} <span>→</span></button></section>`;
}

function errorHtml() { return formError?`<p class="form-error" role="alert">${h(formError)}</p>`:""; }

function bubuArt(variant="hero") {
  return `<svg class="bubu-art bubu-${variant}" viewBox="0 0 180 180" role="img" aria-label="小象步步"><path class="bubu-ear left" d="M39 61C8 50 8 111 43 112Z"/><path class="bubu-ear right" d="M141 61c31-11 31 50-4 51Z"/><path class="bubu-head" d="M43 47c17-25 77-25 94 1 11 17 7 62-6 79-10 13-25 18-41 18s-32-5-42-19c-12-18-15-61-5-79Z"/><path class="bubu-trunk" d="M81 103c0 21-8 31-2 42 6 12 26 7 29-6 2-8-7-11-11-4"/><ellipse class="bubu-eye" cx="68" cy="79" rx="7" ry="9"/><ellipse class="bubu-eye" cx="112" cy="79" rx="7" ry="9"/><circle class="bubu-eye-dot" cx="70" cy="76" r="2"/><circle class="bubu-eye-dot" cx="114" cy="76" r="2"/><path class="bubu-smile" d="M78 98c8 6 17 6 25 0"/><path class="bubu-cheek" d="M51 96h10M119 96h10"/><path class="bubu-foot" d="M55 136c-1 17 17 21 27 8M125 136c1 17-17 21-27 8"/></svg>`;
}

function loadState() {
  return normalizeState(stateStorage.read());
}

function saveState() { state = stateStorage.write(state); }

async function copyText(value,message="已复制") {
  try { await navigator.clipboard.writeText(value); showToast(message); }
  catch { window.prompt("请复制下面的内容",value); }
}

let toastTimer;
function showToast(message) {
  toast.textContent=message; toast.classList.add("show"); clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove("show"),2400);
}

function uid() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }
function h(value="") { return String(value).replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char])); }
