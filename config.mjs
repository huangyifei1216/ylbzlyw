const runtime = globalThis.__YLB_CONFIG__ && typeof globalThis.__YLB_CONFIG__ === "object"
  ? globalThis.__YLB_CONFIG__
  : {};

export const APP_CONFIG = Object.freeze({
  environment: runtime.environment === "production" ? "production" : "development",
  handbookUrl: validHttpUrl(runtime.handbookUrl || ""),
});

function validHttpUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}
