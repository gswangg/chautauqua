// DEC-697 source-scan guard: `c.res.headers.set(` mutates a response the
// current middleware did not construct, which throws on an immutable
// Headers object (workerd ASSETS responses, replayed caches.default
// responses). Every decorator must go through setResponseHeaders in
// src/server/response-headers.ts instead -- the ONE place allowed to
// attempt (and recover from) that mutation.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..");
const SRC_DIR = join(REPO_ROOT, "src");
const EXEMPT_FILE = join(SRC_DIR, "server", "response-headers.ts");
const FORBIDDEN = "c.res.headers.set(";

function glob(dir: string, suffixes: string[]): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...glob(full, suffixes));
    } else if (suffixes.some((suffix) => entry.endsWith(suffix))) {
      out.push(full);
    }
  }
  return out;
}

const sourceFiles = glob(SRC_DIR, [".ts", ".tsx"]).filter((f) => f !== EXEMPT_FILE);

describe("no direct c.res.headers.set outside src/server/response-headers.ts (DEC-697)", () => {
  it("scans at least a floor count of source files", () => {
    expect(sourceFiles.length).toBeGreaterThan(50);
  });

  for (const file of sourceFiles) {
    const rel = relative(REPO_ROOT, file);
    it(`${rel} does not call c.res.headers.set directly`, () => {
      const text = readFileSync(file, "utf-8");
      expect(text.includes(FORBIDDEN)).toBe(false);
    });
  }
});
