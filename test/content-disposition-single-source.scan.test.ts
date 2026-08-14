// DEC-425 (wave-24 amendment): ONE owner for every HTTP Content-Disposition
// header — src/domain/files.ts's contentDispositionAttachment, RFC 6266/5987,
// ASCII-only output by construction. This scan enforces that no hand-copied
// sanitizer reappears: every `"Content-Disposition"` occurrence under src/**
// (both `c.header("Content-Disposition", …)` and object-literal
// `"Content-Disposition":` forms) is either inside the owner itself or a
// call site whose value expression is `contentDispositionAttachment(`. The
// ONE ledgered exemption is src/mail/email-binding.ts — a MIME body-part
// header inside the message the mailer serializes (RFC 2231 grammar, already
// served by sanitizeMimeFilename), not an HTTP response header at all.
//
// stripComments is copied verbatim (length-preserving, so line numbers stay
// accurate) from test/file-delete-ordering.scan.test.ts.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const SRC_ROOT = "src";
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

// The one file allowed to hand-roll a Content-Disposition value: a
// MIME body-part header (RFC 2231), not an HTTP response header.
const LEDGERED_EXEMPTIONS = new Set(["src/mail/email-binding.ts"]);

// The owner itself — occurrences here are the definition, not a call site.
const OWNER_FILE = "src/domain/files.ts";

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

interface Hit {
  file: string; // repo-relative path
  line: number;
  text: string; // the full line of (comment-stripped) source, for diagnostics
}

// Matches BOTH forms the task calls out:
//   c.header("Content-Disposition", ...)
//   "Content-Disposition": ...
const CD_OCCURRENCE = /"Content-Disposition"/g;

function scanForContentDisposition(): Hit[] {
  const files: string[] = [];
  walk(join(ROOT, SRC_ROOT), files);

  const hits: Hit[] = [];
  for (const file of files) {
    const rawSrc = readFileSync(file, "utf8");
    const src = stripComments(rawSrc);
    let match: RegExpExecArray | null;
    CD_OCCURRENCE.lastIndex = 0;
    while ((match = CD_OCCURRENCE.exec(src))) {
      const lineIdx = src.slice(0, match.index).split("\n").length - 1;
      const lines = src.split("\n");
      hits.push({
        file: relative(ROOT, file).split("\\").join("/"),
        line: lineIdx + 1,
        text: (lines[lineIdx] ?? "").trim(),
      });
    }
  }
  return hits;
}

describe("Content-Disposition single-source scan (DEC-425 wave-24 amendment)", () => {
  it("src/domain/files.ts exports contentDispositionAttachment (a rename would otherwise make this scan vacuous)", () => {
    const src = readFileSync(join(ROOT, OWNER_FILE), "utf8");
    expect(/export function contentDispositionAttachment\(/.test(src)).toBe(true);
  });

  it("finds at least 8 converted call sites (floor so the scan cannot go vacuous)", () => {
    const hits = scanForContentDisposition();
    const callSites = hits.filter((h) => h.file !== OWNER_FILE && !LEDGERED_EXEMPTIONS.has(h.file));
    const convertedCount = callSites.filter((h) => h.text.includes("contentDispositionAttachment(")).length;
    expect(convertedCount).toBeGreaterThanOrEqual(8);
  });

  it("every Content-Disposition occurrence under src/** is the owner, a converted call site, or the ledgered exemption", () => {
    const hits = scanForContentDisposition();
    const offenders = hits.filter((h) => {
      if (h.file === OWNER_FILE) return false;
      if (LEDGERED_EXEMPTIONS.has(h.file)) return false;
      return !h.text.includes("contentDispositionAttachment(");
    });
    expect(
      offenders,
      offenders.map((h) => `${h.file}:${h.line}: ${h.text}`).join("\n") ||
        "no offending Content-Disposition site found",
    ).toHaveLength(0);
  });

  it("the ledgered exemption file exists and names its reason", () => {
    const src = readFileSync(join(ROOT, "src/mail/email-binding.ts"), "utf8");
    expect(src).toMatch(/Content-Disposition/);
    // The reason must be spelled out near the hand-rolled header: a
    // MIME body-part header, not an HTTP response header.
    expect(/RFC 2231|MIME body-part|sanitizeMimeFilename/.test(src)).toBe(true);
  });
});
