import assert from "node:assert/strict";
import { SAFETY_BOUNDARY, checkProblemSafety, getSafetyBoundary, isProblemBlocked } from "../safety.mjs";

const blockedCases = [
  ["他说自己不想活了", "psychological-crisis"],
  ["孩子提到自杀", "psychological-crisis"],
  ["最近有自伤和割手", "psychological-crisis"],
  ["孩子高烧不退", "medical"],
  ["突然抽搐", "medical"],
  ["现在呼吸困难", "medical"],
  ["我应该给多少药量", "medical"],
  ["家里有家暴", "family-safety"],
  ["怀疑孩子被虐待", "family-safety"],
  ["现在有立即危险", "family-safety"],
  ["孩子明显发育倒退", "development"],
  ["突然失去已有语言能力", "development"],
];

for (const [text, category] of blockedCases) {
  const result = checkProblemSafety(text);
  assert.equal(result.blocked, true, text);
  assert.equal(result.category, category, text);
  assert.equal(result.boundary.title, "这个情况不适合做成家庭约定");
  assert.ok(result.matches.length > 0);
}

for (const text of ["写作业磨蹭", "早上出门慢", "手机问题容易吵架", "睡前拖延", "不爱吃药怎么办"]) {
  assert.equal(isProblemBlocked(text), false, text);
}

assert.deepEqual(checkProblemSafety(""), { blocked: false, category: "", categoryLabel: "", matches: [] });
const boundary = getSafetyBoundary();
assert.deepEqual(boundary, SAFETY_BOUNDARY);
boundary.actions.push("被外部修改");
assert.equal(SAFETY_BOUNDARY.actions.includes("被外部修改"), false);
assert.match(SAFETY_BOUNDARY.body, /不能处理/);
assert.doesNotMatch(SAFETY_BOUNDARY.body, /已诊断|确诊/);

console.log("Safety checks passed: required risks are blocked and ordinary family problems are not misclassified.");
