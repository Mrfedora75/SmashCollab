import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * @typescript-eslint/typescript-estree matches allowDefaultProject globs with
 * `minimatch(filePath, pattern, { dot: true })`. That nested copy is the only
 * minimatch in the reported >=7 <11.0.1 range. ESLint still depends on the
 * separate minimatch 3.1.5 at the top of node_modules.
 */
const requireFromEstree = createRequire(
  path.join(process.cwd(), "node_modules/@typescript-eslint/typescript-estree/package.json"),
);
const requireFromRoot = createRequire(path.join(process.cwd(), "package.json"));

type MinimatchFn = (filePath: string, pattern: string, options?: { dot?: boolean }) => boolean;

function matches(filePath: string, pattern: string): boolean {
  const { minimatch } = requireFromEstree("minimatch") as { minimatch: MinimatchFn };
  return minimatch(filePath, pattern, { dot: true });
}

describe("typescript-estree minimatch pin", () => {
  it("resolves the patched nested minimatch and leaves the ESLint 3.x copy in place", () => {
    const nested = requireFromEstree("minimatch/package.json") as { version: string };
    const root = requireFromRoot("minimatch/package.json") as { version: string };
    expect(nested.version).toBe("11.0.5");
    expect(root.version).toBe("3.1.5");
  });

  it("matches relative source paths the way allowDefaultProject does", () => {
    expect(matches("src/lib/avatar.ts", "**/*.ts")).toBe(true);
    expect(matches("src/lib/.hidden.ts", "**/*.ts")).toBe(true);
    expect(matches("eslint.config.js", "eslint.config.js")).toBe(true);
    expect(matches("src/lib/avatar.test.ts", "**/*.tsx")).toBe(false);
    expect(matches("src/lib/avatar.ts", "scripts/**")).toBe(false);
  });
});
