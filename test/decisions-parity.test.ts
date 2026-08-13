// w37-d: decisions/README.md now declares the DEC-NNN three-digit id space
// CLOSED (see the "Amendment" convention appended there and the DEC-004
// precedent it points to). Nothing previously enforced that
// decisions/DEC-*.md and the compile-checked src/decisions-data/*.ts
// constants stay 1:1 — this is that guard. A stray DEC-1000.md (four
// digits) or a hand-edited constant added without its .md file (or vice
// versa) must fail this test loudly rather than silently desyncing the
// module from the docs.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const decisionsDir = join(repoRoot, "decisions");
const decisionsDataDir = join(repoRoot, "src", "decisions-data");

function listDecisionFiles(): string[] {
  return readdirSync(decisionsDir).filter((name) => name.endsWith(".md") && name !== "README.md");
}

function listDecisionsDataFiles(): string[] {
  return readdirSync(decisionsDataDir).filter((name) => name.endsWith(".ts"));
}

function exportedDecConstants(): string[] {
  const constants: string[] = [];
  for (const file of listDecisionsDataFiles()) {
    const contents = readFileSync(join(decisionsDataDir, file), "utf8");
    const matches = contents.matchAll(/^export const (DEC_\d+)\b/gm);
    for (const match of matches) {
      const name = match[1];
      if (name === undefined) throw new Error(`unexpected match with no capture group in ${file}`);
      constants.push(name);
    }
  }
  return constants;
}

describe("decisions/DEC-*.md <-> src/decisions-data/*.ts parity", () => {
  it("every DEC-*.md filename matches the closed three-digit id shape ^DEC-\\d{3}\\.md$", () => {
    const files = listDecisionFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(file).toMatch(/^DEC-\d{3}\.md$/);
    }
  });

  it("every DEC-*.md file's H1 id matches its own filename", () => {
    const files = listDecisionFiles();
    for (const file of files) {
      const id = file.replace(/\.md$/, "");
      const contents = readFileSync(join(decisionsDir, file), "utf8");
      const firstLine = contents.split("\n", 1)[0] ?? "";
      expect(firstLine.startsWith(`# ${id}:`)).toBe(true);
    }
  });

  it("the count of decisions/DEC-*.md files equals the count of exported DEC_ constants", () => {
    const fileCount = listDecisionFiles().length;
    const constants = exportedDecConstants();
    // No duplicate constant names across part files (that would also silently
    // desync the 1:1 mapping DEC-004/decisions/README.md require).
    expect(new Set(constants).size).toBe(constants.length);
    expect(constants.length).toBe(fileCount);
  });

  it("every DEC-NNN.md has a corresponding DEC_NNN constant and vice versa", () => {
    const fileIds = new Set(listDecisionFiles().map((f) => f.replace(/^DEC-(\d{3})\.md$/, "DEC_$1")));
    const constantIds = new Set(exportedDecConstants());
    for (const id of fileIds) {
      expect(constantIds.has(id)).toBe(true);
    }
    for (const id of constantIds) {
      expect(fileIds.has(id)).toBe(true);
    }
  });
});
