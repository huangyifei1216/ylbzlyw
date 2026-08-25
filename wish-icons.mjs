export const WISH_ICON_ALLOWLIST = Object.freeze(["🎬", "🍲", "🌳", "🎲", "🚌", "✨"]);

const ALLOWED_WISH_ICONS = new Set(WISH_ICON_ALLOWLIST);

export function isAllowedWishIcon(value) {
  return typeof value === "string" && ALLOWED_WISH_ICONS.has(value);
}

export function legacyWishIcon(value) {
  return isAllowedWishIcon(value) ? value : "✨";
}
