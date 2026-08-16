// Regression for task-w2-d (DEC-613 amendment wave 2): the docs role-group
// display vocabulary (six labels + the API leaving-link label) has exactly
// one owner, src/routes/docs-content/groups.ts's DOCS_GROUP_META and
// DOCS_API_LEAVING_LINK. Before the /docs shell lands, nothing else may
// hand-spell this vocabulary — this test asserts DOCS_GROUP_META covers
// DOCS_GROUPS exactly (both directions, in order) and then walks the rest
// of the source tree for a second copy of three-or-more of the six labels
// appearing as string literals in one file, which is the DEC-613 fork
// shape the amendment names.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { DOCS_GROUPS } from "../src/routes/docs-content/types";
import { DOCS_GROUP_META, DOCS_API_LEAVING_LINK } from "../src/routes/docs-content/groups";

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const THIS_FILE = fileURLToPath(import.meta.url);
const EXEMPT_DIRS = [resolve(REPO_ROOT, "src/routes/docs-content")];

const SCAN_ROOTS = [resolve(REPO_ROOT, "src"), resolve(REPO_ROOT, "app/src")];

const SCAN_EXTENSIONS = new Set([".ts", ".tsx"]);

function isExempt(filePath: string): boolean {
  if (filePath === THIS_FILE) return true;
  return EXEMPT_DIRS.some((dir) => filePath === dir || filePath.startsWith(dir + "/"));
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".git") continue;
      walk(full, out);
    } else if (SCAN_EXTENSIONS.has(entry.slice(entry.lastIndexOf(".")))) {
      out.push(full);
    }
  }
}

describe("docs group vocabulary (DEC-613 amendment: one owner)", () => {
  it("DOCS_GROUP_META's key set equals DOCS_GROUPS exactly, both directions", () => {
    const metaKeys = new Set(Object.keys(DOCS_GROUP_META));
    const groupIds = new Set(DOCS_GROUPS as readonly string[]);
    for (const id of groupIds) {
      expect(metaKeys.has(id), `DOCS_GROUPS has "${id}" but DOCS_GROUP_META does not`).toBe(true);
    }
    for (const key of metaKeys) {
      expect(groupIds.has(key), `DOCS_GROUP_META has "${key}" but DOCS_GROUPS does not`).toBe(true);
    }
    expect(metaKeys.size).toBe(DOCS_GROUPS.length);
  });

  it("DOCS_GROUP_META's key order matches DOCS_GROUPS' order", () => {
    expect(Object.keys(DOCS_GROUP_META)).toEqual([...DOCS_GROUPS]);
  });

  it("every label and blurb is non-empty", () => {
    for (const id of DOCS_GROUPS) {
      const meta = DOCS_GROUP_META[id];
      expect(meta.label.trim().length, `${id}: label`).toBeGreaterThan(0);
      expect(meta.blurb.trim().length, `${id}: blurb`).toBeGreaterThan(0);
    }
  });

  it("the six labels are distinct", () => {
    const labels = DOCS_GROUPS.map((id) => DOCS_GROUP_META[id].label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("the labels match the ruling's exact wording, in order", () => {
    expect(DOCS_GROUPS.map((id) => DOCS_GROUP_META[id].label)).toEqual([
      "Getting started",
      "Running an event",
      "Your contacts",
      "For reviewers",
      "For speakers",
      "Running the software",
    ]);
  });

  it("DOCS_API_LEAVING_LINK carries the ruling's verbatim label and href", () => {
    expect(DOCS_API_LEAVING_LINK).toEqual({
      href: "/docs/api",
      label: "Leaves the docs — an operator surface",
    });
  });

  it("no file outside src/routes/docs-content hand-lists three or more of the six labels", () => {
    const labels = DOCS_GROUPS.map((id) => DOCS_GROUP_META[id].label);
    const files: string[] = [];
    for (const root of SCAN_ROOTS) {
      walk(root, files);
    }
    const offenders: { file: string; matched: string[] }[] = [];
    for (const file of files) {
      if (isExempt(file)) continue;
      const contents = readFileSync(file, "utf8");
      const matched = labels.filter((label) => contents.includes(JSON.stringify(label).slice(1, -1)) || contents.includes(label));
      if (matched.length >= 3) {
        offenders.push({ file: relative(REPO_ROOT, file), matched });
      }
    }
    expect(
      offenders,
      offenders
        .map((o) => `${o.file}: matched labels [${o.matched.join(", ")}]`)
        .join("\n"),
    ).toEqual([]);
  });
});
