// DEC-040 amendment (wave 70, task w70-a) source scan: a <form> that can
// itself render a file-kind control (either a literal type="file" input
// inside its own markup, or a call to the shared <FormFieldsSection>
// renderer — src/views/form-render.tsx's FieldControl emits type="file"
// unconditionally for kind='file' fields, with no read-only variant) must
// declare enctype="multipart/form-data". Without it the browser posts
// application/x-www-form-urlencoded and any selected file is silently
// dropped before the server ever sees it — the exact bug fixed on the
// portal task form (src/routes/portal/tasks/views.tsx's TaskFormPage) this
// wave.
//
// Per-<form>-BLOCK, not whole-module: JSX forms never nest (same as HTML),
// so each <form ...> ... </form> span is matched non-greedily up to its own
// nearest closing tag, and only THAT span is checked for either trigger —
// a module with an unrelated file-capable form elsewhere (e.g. this file's
// own comment-reply/mark-complete forms) must not false-positive on a
// sibling form that renders neither trigger itself.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const SCAN_DIRS = ["src/routes", "src/views"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (stat.isFile() && entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
}

function listFiles(): string[] {
  const files: string[] = [];
  for (const dir of SCAN_DIRS) {
    walk(join(ROOT, dir), files);
  }
  return files;
}

interface FormHit {
  line: number;
  hasEnctype: boolean;
  triggers: boolean;
}

// Non-greedy: stops at the nearest </form>, correct as long as forms never
// nest (true here, matching the HTML content model).
const FORM_BLOCK_RE = /<form\b([^>]*)>([\s\S]*?)<\/form>/g;

function scanFile(src: string): FormHit[] {
  const hits: FormHit[] = [];
  FORM_BLOCK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FORM_BLOCK_RE.exec(src))) {
    const attrs = m[1] ?? "";
    const body = m[2] ?? "";
    const lineIdx = src.slice(0, m.index).split("\n").length - 1;
    hits.push({
      line: lineIdx + 1,
      hasEnctype: /enctype\s*=\s*"multipart\/form-data"/.test(attrs),
      triggers: /type="file"/.test(body) || /<FormFieldsSection/.test(body),
    });
  }
  return hits;
}

describe("form enctype scan (DEC-040 amendment, wave 70)", () => {
  it("the scan itself finds <form> tags (not vacuous)", () => {
    const files = listFiles();
    expect(files.length).toBeGreaterThan(0);
    let total = 0;
    for (const file of files) {
      total += scanFile(readFileSync(file, "utf8")).length;
    }
    expect(total).toBeGreaterThan(0);
  });

  it("the scan finds at least one file-capable <form> (not vacuous on the trigger condition)", () => {
    const files = listFiles();
    let triggeringCount = 0;
    for (const file of files) {
      triggeringCount += scanFile(readFileSync(file, "utf8")).filter((h) => h.triggers).length;
    }
    expect(triggeringCount).toBeGreaterThan(0);
  });

  it("every <form> that itself renders a file-kind control declares enctype=\"multipart/form-data\"", () => {
    const files = listFiles();
    const failures: string[] = [];
    for (const file of files) {
      const relPath = relative(ROOT, file).split("\\").join("/");
      const src = readFileSync(file, "utf8");
      for (const hit of scanFile(src)) {
        if (hit.triggers && !hit.hasEnctype) {
          failures.push(`${relPath}:${hit.line} — <form> missing enctype="multipart/form-data"`);
        }
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });
});
