// DEC-276 amendment (wave 23): ONE READER FOR HONO'S THROWING executionCtx
// GETTER. `c.executionCtx` throws (rather than returning undefined) when
// the runtime handed no ExecutionContext -- src/server/execution-ctx.ts's
// `executionCtxOf` is the single deliberate try/catch around that getter.
// This scan enforces that no second hand-copy of the probe reappears: every
// `.executionCtx` property access under src/** must live inside
// src/server/execution-ctx.ts itself, and both known former hand-copy
// sites (pubcache.ts, middleware.ts) must import the shared helper instead
// of re-implementing it.
//
// stripComments is copied verbatim (length-preserving, so line numbers
// stay accurate) from test/file-delete-ordering.scan.test.ts.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const SRC_ROOT = "src";
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

function stripComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = i + 1 < n ? src[i + 1] : "";
    if (c === "/" && c2 === "/") {
      while (i < n && src[i] !== "\n") {
        out += " ";
        i++;
      }
      continue;
    }
    if (c === "/" && c2 === "*") {
      out += "  ";
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        out += src[i] === "\n" ? "\n" : " ";
        i++;
      }
      if (i < n) {
        out += "  ";
        i += 2;
      }
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\" && i + 1 < n) {
          out += (src[i] ?? "") + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += src[i];
        i++;
      }
      if (i < n) {
        out += src[i];
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (stat.isFile() && /\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
}

interface ExecCtxHit {
  file: string; // repo-relative path
  line: number;
}

const EXECUTION_CTX_ACCESS = /\.executionCtx\b/g;

function scanForExecutionCtxAccess(): ExecCtxHit[] {
  const files: string[] = [];
  walk(join(ROOT, SRC_ROOT), files);

  const hits: ExecCtxHit[] = [];
  for (const file of files) {
    const rawSrc = readFileSync(file, "utf8");
    const src = stripComments(rawSrc);
    let match: RegExpExecArray | null;
    EXECUTION_CTX_ACCESS.lastIndex = 0;
    while ((match = EXECUTION_CTX_ACCESS.exec(src))) {
      const lineIdx = src.slice(0, match.index).split("\n").length - 1;
      hits.push({
        file: relative(ROOT, file).split("\\").join("/"),
        line: lineIdx + 1,
      });
    }
  }
  return hits;
}

describe("executionCtx single-reader scan (DEC-276 amendment, wave 23)", () => {
  it("src/server/execution-ctx.ts exists (a rename would otherwise make this scan vacuous)", () => {
    const stat = statSync(join(ROOT, "src/server/execution-ctx.ts"));
    expect(stat.isFile()).toBe(true);
  });

  it("exactly one `.executionCtx` property access exists under src/**, and it lives in src/server/execution-ctx.ts", () => {
    const hits = scanForExecutionCtxAccess();
    expect(
      hits,
      hits.map((h) => `${h.file}:${h.line}`).join("\n") ||
        "no `.executionCtx` access found at all -- expected exactly one, in src/server/execution-ctx.ts",
    ).toHaveLength(1);
    expect(hits[0]?.file).toBe("src/server/execution-ctx.ts");
  });

  it("src/server/pubcache.ts imports executionCtxOf rather than re-implementing the probe", () => {
    const src = readFileSync(join(ROOT, "src/server/pubcache.ts"), "utf8");
    expect(/import\s*\{[^}]*\bexecutionCtxOf\b[^}]*\}\s*from\s*["']\.\/execution-ctx["']/.test(src)).toBe(true);
  });

  it("src/server/middleware.ts imports executionCtxOf rather than re-implementing the probe", () => {
    const src = readFileSync(join(ROOT, "src/server/middleware.ts"), "utf8");
    expect(/import\s*\{[^}]*\bexecutionCtxOf\b[^}]*\}\s*from\s*["']\.\/execution-ctx["']/.test(src)).toBe(true);
  });
});
