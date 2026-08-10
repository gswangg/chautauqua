// DEC-104 source-scan guard (exports lane): asserts src/server/repo/exports.ts
// imports chunkIds and that no inArray(...) call in the file binds an
// unbounded id list directly (i.e., every inArray(<x>, ids) substring has
// been replaced by a chunked `batch` variable per DEC-078).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_PATH = resolve(fileURLToPath(import.meta.url), "../../src/server/repo/exports.ts");

describe("DEC-104 chunk sweep: exports.ts", () => {
  const source = readFileSync(SOURCE_PATH, "utf-8");

  it("imports chunkIds from the canonical chunk lib", () => {
    expect(source).toMatch(/import\s*\{\s*chunkIds\s*\}\s*from\s*"\.\.\/\.\.\/lib\/chunk"/);
  });

  it("has no remaining inArray(...) call bound directly to the unbounded ids list", () => {
    const inArrayCalls = source.match(/inArray\([^)]*\)/g) ?? [];
    expect(inArrayCalls.length).toBeGreaterThan(0);
    for (const call of inArrayCalls) {
      expect(call).not.toMatch(/,\s*ids\s*\)/);
      expect(call).toMatch(/,\s*batch\s*\)/);
    }
  });
});
