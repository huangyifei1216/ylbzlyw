function entitlement(scope, stageId, label) { return { scope, stageId, label, status: "active" }; }

export const DEMO_CODES = Object.freeze({
  "BB-S1-0001": entitlement("stage", "s1", "0—1.5岁当前阶段陪伴卡"),
  "BB-S2-0001": entitlement("stage", "s2", "1.5—3岁当前阶段陪伴卡"),
  "BB-S3-0001": entitlement("stage", "s3", "3—6岁当前阶段陪伴卡"),
  "BB-S4-0001": entitlement("stage", "s4", "7—12岁当前阶段陪伴卡"),
  "BB-S5-0001": entitlement("stage", "s5", "12—15岁当前阶段陪伴卡"),
  "BB-S6-0001": entitlement("stage", "s6", "15—18岁当前阶段陪伴卡"),
  "BB-ALL-0001": entitlement("all", "all", "0—18岁全龄陪伴卡"),
});

export function validateDemoCode(value) {
  const code = String(value || "").trim().toUpperCase();
  if (code === "BB-USED-0001") return { ok: false, error: "used", message: "这个开通码已经使用过，请联系原订单卖家核对开通权益。" };
  const match = DEMO_CODES[code];
  return match ? { ok: true, entitlement: { ...match } } : { ok: false, error: "invalid", message: "没有找到这个开通码，请检查字母、数字和横线。" };
}
