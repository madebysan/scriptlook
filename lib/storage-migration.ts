const STORAGE_KEY_MIGRATIONS = [
  ["call-sheet-project", "scriptlook-project"],
  ["greenlight-project", "scriptlook-project"],
  ["call-sheet-image-prompts", "scriptlook-image-prompts"],
  ["greenlight-image-prompts", "scriptlook-image-prompts"],
  ["call-sheet-title-fonts", "scriptlook-title-fonts"],
  ["greenlight-title-fonts", "scriptlook-title-fonts"],
  ["greenlight-ui-audio", "scriptlook-ui-audio"],
] as const;

export function migrateLegacyStorageKeys(): void {
  if (typeof window === "undefined") return;

  for (const [legacyKey, currentKey] of STORAGE_KEY_MIGRATIONS) {
    const current = localStorage.getItem(currentKey);
    const legacy = localStorage.getItem(legacyKey);
    if (!current && legacy) {
      localStorage.setItem(currentKey, legacy);
    }
    if (legacy) {
      localStorage.removeItem(legacyKey);
    }
  }
}
