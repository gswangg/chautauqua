// Contention decomposition (structure-custodian, wave 28): docs/verification-log.md
// used to be a single hand-edited append-only file that every verification
// lane touched at the same tail, causing repeated merge conflicts. It is now
// generated from per-entry files under docs/verification-log/index/ by
// scripts/assemble-verification-log.ts. This test enforces that the checked-in
// docs/verification-log.md is never allowed to drift from its generated source
// of truth, and that the DEC-069 "this file alone is sufficient for grep"
// contract (RESULT:/OPEN ITEMS: lines, `## <date> <branch> — <scope>` headers)
// still holds against the assembled output.

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");
const INDEX_DIR = join(ROOT, "docs", "verification-log", "index");
const OUTPUT_FILE = join(ROOT, "docs", "verification-log.md");
const ASSEMBLER = join(ROOT, "scripts", "assemble-verification-log.ts");

function entryFiles(): string[] {
  return readdirSync(INDEX_DIR)
    .filter((f) => /^\d{4}-.*\.md$/.test(f))
    .sort();
}

describe("docs/verification-log.md assembly (contention decomposition)", () => {
  it("is up to date with docs/verification-log/index/*.md (--check passes)", () => {
    expect(() =>
      execFileSync("npx", ["tsx", ASSEMBLER, "--check"], { cwd: ROOT, stdio: "pipe" }),
    ).not.toThrow();
  });

  it("every index entry file has a matching ## header and no stray content", () => {
    const files = entryFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const content = readFileSync(join(INDEX_DIR, f), "utf8");
      expect(content.startsWith("## ")).toBe(true);
    }
  });

  it("assembled file still contains every entry's header verbatim, in filename order", () => {
    const files = entryFiles();
    const assembled = readFileSync(OUTPUT_FILE, "utf8");
    let cursor = 0;
    for (const f of files) {
      const firstLine = readFileSync(join(INDEX_DIR, f), "utf8").split("\n")[0];
      expect(firstLine).toBeDefined();
      const header: string = firstLine ?? "";
      const idx = assembled.indexOf(header, cursor);
      expect(idx).toBeGreaterThanOrEqual(cursor);
      cursor = idx + header.length;
    }
  });

  it("--next-seq returns one past the highest existing sequence number", () => {
    const files = entryFiles();
    const lastFile = files[files.length - 1];
    expect(lastFile).toBeDefined();
    const highest = Number.parseInt((lastFile ?? "").slice(0, 4), 10);
    const out = execFileSync("npx", ["tsx", ASSEMBLER, "--next-seq"], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
    expect(out).toBe(String(highest + 1).padStart(4, "0"));
  });

  it("DEC-069 grep contract: assembled file alone carries every RESULT:/OPEN ITEMS: line from the index entries", () => {
    const files = entryFiles();
    const assembled = readFileSync(OUTPUT_FILE, "utf8");
    for (const f of files) {
      const content = readFileSync(join(INDEX_DIR, f), "utf8");
      for (const line of content.split("\n")) {
        if (line.startsWith("RESULT:") || line.startsWith("OPEN ITEMS:")) {
          expect(assembled).toContain(line);
        }
      }
    }
  });
});
