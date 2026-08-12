// DEC-104 source-scan guard (exports lane): asserts every file in
// src/server/repo/exports/ that calls inArray(...) imports chunkIds from the
// canonical chunk lib, and that no inArray(...) call binds an unbounded id
// list directly (i.e., every inArray(<x>, ids) substring has been replaced
// by a chunked `batch` variable per DEC-078). Globbed over the whole
// directory (not one hand-picked file) so decomposing exports.ts into
// per-kind submodules can't silently drop the guard from a file that still
// does a chunked DB read.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = resolve(fileURLToPath(import.meta.url), "../../src/server/repo/exports");
const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => resolve(DIR, f));

describe("DEC-104 chunk sweep: src/server/repo/exports/", () => {
  it("scanned at least one file", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const path of files) {
    const source = readFileSync(path, "utf-8");
    const inArrayCalls = source.match(/inArray\([^)]*\)/g) ?? [];
    if (inArrayCalls.length === 0) continue;

    const name = path.split("/").pop();
    it(`${name}: imports chunkIds from the canonical chunk lib`, () => {
      expect(source).toMatch(/import\s*\{[^}]*\bchunkIds\b[^}]*\}\s*from\s*"\.\.\/\.\.\/\.\.\/lib\/chunk"/);
    });

    it(`${name}: has no remaining inArray(...) call bound directly to the unbounded ids list`, () => {
      for (const call of inArrayCalls) {
        expect(call).not.toMatch(/,\s*ids\s*\)/);
        expect(call).toMatch(/,\s*batch\s*\)/);
      }
    });
  }
});
