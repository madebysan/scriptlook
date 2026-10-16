// File-based response cache keyed by slug + provider + input hash.
// Same screenplay data returns cached content; different data triggers fresh generation.
// Delete .cache/ directory to force fresh generation.

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

const CACHE_DIR = join(process.cwd(), ".cache");

function cacheKey(slug: string, jsonData: string, provider = "anthropic"): string {
  const hash = createHash("sha256").update(jsonData).digest("hex").slice(0, 12);
  return `${slug}-${provider}-${hash}`;
}

export function getCached(slug: string, jsonData: string, provider?: string): string | null {
  try {
    return readFileSync(join(CACHE_DIR, `${cacheKey(slug, jsonData, provider)}.md`), "utf-8");
  } catch {
    return null;
  }
}

export function setCache(slug: string, jsonData: string, content: string, provider?: string): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(join(CACHE_DIR, `${cacheKey(slug, jsonData, provider)}.md`), content, "utf-8");
  } catch {
    // Read-only filesystem (Vercel) — skip caching silently
  }
}
