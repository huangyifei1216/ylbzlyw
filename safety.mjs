/** Minimum product boundary for custom family problems. This is not diagnosis. */
export const SAFETY_BOUNDARY = Object.freeze({
  title: "这个情况不适合做成家庭约定",
  body: "一两步适合帮助家庭尝试日常行动，不能处理医疗诊断、心理危机或紧急安全问题。",
  actions: [
    "去分龄手册查看观察边界",
    "联系医生或合格专业人员",
    "如有立即危险，联系当地急救、警方或紧急服务",
    "返回重新选择问题",
  ],
});

const RULES = Object.freeze([
  rule("psychological-crisis", "心理危机", [
    /不想活/, /自杀/, /自伤/, /割手/, /跳楼/, /杀人/, /伤害别人/, /严重绝望/,
  ]),
  rule("medical", "医疗与用药", [
    /高烧/, /抽搐/, /呼吸困难/, /昏迷/, /用药/, /药量/, /急救/, /严重外伤/,
  ]),
  rule("development", "发育评估", [
    /明显发育倒退/, /突然失去(?:了)?(?:已有|原有|以前会的)?[^\s，。；！？]{0,12}能力/, /需要专业(?:诊断|评估)/,
  ]),
  rule("family-safety", "家庭安全", [
    /家暴/, /虐待/, /性侵/, /严重威胁/, /立即危险/,
  ]),
]);

/**
 * Returns a conservative keyword match. A match is a routing guard only and
 * must never be presented as a clinical or safety diagnosis.
 */
export function checkProblemSafety(value) {
  const text = normalize(value);
  if (!text) return { blocked: false, category: "", categoryLabel: "", matches: [] };
  for (const entry of RULES) {
    const matches = entry.patterns
      .map((pattern) => text.match(pattern)?.[0] || "")
      .filter(Boolean);
    if (matches.length) {
      return {
        blocked: true,
        category: entry.id,
        categoryLabel: entry.label,
        matches: [...new Set(matches)],
        boundary: { ...SAFETY_BOUNDARY, actions: [...SAFETY_BOUNDARY.actions] },
      };
    }
  }
  return { blocked: false, category: "", categoryLabel: "", matches: [] };
}

export function isProblemBlocked(value) {
  return checkProblemSafety(value).blocked;
}

export function getSafetyBoundary() {
  return { ...SAFETY_BOUNDARY, actions: [...SAFETY_BOUNDARY.actions] };
}

function rule(id, label, patterns) { return { id, label, patterns }; }
function normalize(value) { return typeof value === "string" ? value.trim().replace(/\s+/g, "") : ""; }
