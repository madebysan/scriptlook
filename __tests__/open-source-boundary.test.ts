import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TEXT_PROVIDERS } from "@/lib/ai-providers";
import {
  resolveImageGenerationAccess,
  resolveTextGenerationAccess,
} from "@/lib/generation-access";

const REPO_ROOT = process.cwd();
const SOURCE_ROOTS = ["app", "components", "lib"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

function collectSourceFiles(relativeDirectory: string): string[] {
  const directory = path.join(REPO_ROOT, relativeDirectory);
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(relativePath);
    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [relativePath] : [];
  });
}

describe("open-source boundary", () => {
  it("offers only API-key text providers", () => {
    expect(TEXT_PROVIDERS).toEqual(["anthropic", "openai", "deepseek", "gemini"]);
  });

  it("normalizes client keys and requires one for image generation", () => {
    expect(resolveTextGenerationAccess({ apiProvider: "anthropic" })).toEqual({
      apiKey: "",
      provider: "anthropic",
    });
    expect(() => resolveImageGenerationAccess({})).toThrow("Missing API key");
    expect(resolveTextGenerationAccess({ apiProvider: "openai", apiKey: " key " })).toEqual({
      apiKey: "key",
      provider: "openai",
    });
  });

  it("does not ship private generation modes or local output routes", () => {
    const removedPaths = [
      "lib/codex-session.ts",
      "lib/managed-decks",
      "app/api/save-local",
      "app/api/serve-image",
    ];
    expect(removedPaths.filter((relativePath) => existsSync(path.join(REPO_ROOT, relativePath)))).toEqual([]);

    const forbiddenPatterns = [
      /managedProjectId/,
      /managed-decks/,
      /runCodexSession/,
      /codex-session/,
      /included in purchase/i,
    ];
    const violations = SOURCE_ROOTS.flatMap(collectSourceFiles).flatMap((relativePath) => {
      const source = readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
      return forbiddenPatterns
        .filter((pattern) => pattern.test(source))
        .map((pattern) => `${relativePath}: ${pattern.source}`);
    });
    expect(violations).toEqual([]);
  });
});
