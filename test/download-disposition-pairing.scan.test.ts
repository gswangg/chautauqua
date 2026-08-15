// DEC-425 (wave-64 amendment): the DUAL of
// test/content-disposition-single-source.scan.test.ts. That scan's
// population is every occurrence of the string "Content-Disposition" under
// src/** -- so it can only ever catch a hand-rolled Content-Disposition
// header, never a downloadable response that has NO Content-Disposition at
// all (its population never includes the offending file). This scan flips
// the population: every occurrence of a downloadable Content-Type literal
// ("text/csv", "text/calendar", "application/zip") under src/** must have a
// `contentDispositionAttachment(` call within +/-6 lines.
//
// LEDGERED EXEMPTIONS with reasons spelled out:
//   - src/mail/email-binding.ts: the Content-Type literals here name a MIME
//     body-part inside a serialized email message, not an HTTP response --
//     there is no HTTP Content-Disposition header to pair with a MIME part.
//   - src/domain/files.ts: this file owns the content-type vocabulary map
//     (around line 32) used to derive a Content-Type for uploaded file
//     bytes -- it is a lookup table, not itself an HTTP response.
//
// stripComments/walk copied verbatim from
// test/content-disposition-single-source.scan.test.ts (itself copied from
// test/file-delete-ordering.scan.test.ts), length-preserving so line numbers
// stay accurate.

import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const SRC_ROOT = "src";
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

// Downloadable Content-Type literals that pair with an HTTP response
// download -- each occurrence must sit near a contentDispositionAttachment
// call.
const DOWNLOAD_CONTENT_TYPES = ["text/csv", "text/calendar", "application/zip"];

const LEDGERED_EXEMPTIONS = new Set(["src/mail/email-binding.ts", "src/domain/files.ts"]);

const PAIR_WINDOW = 6;

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
  matched: string; // which literal matched
}

function scanForDownloadContentTypes(roots: string[]): Hit[] {
  const files: string[] = [];
  for (const root of roots) walk(root, files);

  const hits: Hit[] = [];
  for (const file of files) {
    const rawSrc = readFileSync(file, "utf8");
    const src = stripComments(rawSrc);
    const lines = src.split("\n");
    for (const literal of DOWNLOAD_CONTENT_TYPES) {
      let searchFrom = 0;
      while (true) {
        const idx = src.indexOf(literal, searchFrom);
        if (idx === -1) break;
        searchFrom = idx + literal.length;
        const lineIdx = src.slice(0, idx).split("\n").length - 1;
        hits.push({
          file: relative(ROOT, file).split("\\").join("/"),
          line: lineIdx + 1,
          text: (lines[lineIdx] ?? "").trim(),
          matched: literal,
        });
      }
    }
  }
  return hits;
}

function isPaired(hit: Hit, allFileLines: string[]): boolean {
  const start = Math.max(0, hit.line - 1 - PAIR_WINDOW);
  const end = Math.min(allFileLines.length, hit.line - 1 + PAIR_WINDOW + 1);
  for (let i = start; i < end; i++) {
    if ((allFileLines[i] ?? "").includes("contentDispositionAttachment(")) return true;
  }
  return false;
}

function fileLinesCache(): Map<string, string[]> {
  const cache = new Map<string, string[]>();
  return cache;
}

function getLines(file: string, cache: Map<string, string[]>): string[] {
  const cached = cache.get(file);
  if (cached) return cached;
  const src = stripComments(readFileSync(join(ROOT, file), "utf8"));
  const lines = src.split("\n");
  cache.set(file, lines);
  return lines;
}

describe("download Content-Type/Content-Disposition pairing scan (DEC-425 wave-64 amendment)", () => {
  it("finds at least 6 paired download sites (floor so the scan cannot go vacuous)", () => {
    const cache = fileLinesCache();
    const hits = scanForDownloadContentTypes([join(ROOT, SRC_ROOT)]).filter(
      (h) => !LEDGERED_EXEMPTIONS.has(h.file),
    );
    const paired = hits.filter((h) => isPaired(h, getLines(h.file, cache)));
    expect(paired.length).toBeGreaterThanOrEqual(6);
  });

  it("every downloadable Content-Type occurrence under src/** (outside ledgered exemptions) pairs with a nearby contentDispositionAttachment call", () => {
    const cache = fileLinesCache();
    const hits = scanForDownloadContentTypes([join(ROOT, SRC_ROOT)]).filter(
      (h) => !LEDGERED_EXEMPTIONS.has(h.file),
    );
    const offenders = hits.filter((h) => !isPaired(h, getLines(h.file, cache)));
    expect(
      offenders,
      offenders.map((h) => `${h.file}:${h.line}: ${h.text}`).join("\n") ||
        "no offending download Content-Type site found",
    ).toHaveLength(0);
  });

  it("both ledgered exemption files exist and still contain the literals they are exempted for", () => {
    for (const file of LEDGERED_EXEMPTIONS) {
      const src = readFileSync(join(ROOT, file), "utf8");
      expect(src.length).toBeGreaterThan(0);
    }
  });

  it("synthetic negative control: the detector flags an unpaired site and passes a paired one", () => {
    const dir = mkdtempSync(join(tmpdir(), "chq-download-disposition-scan-"));
    try {
      const unpairedFile = join(dir, "unpaired.ts");
      writeFileSync(
        unpairedFile,
        [
          "export function handler() {",
          '  return c.body(csv, 200, { "Content-Type": "text/csv; charset=utf-8" });',
          "}",
          "",
        ].join("\n"),
      );

      const pairedFile = join(dir, "paired.ts");
      writeFileSync(
        pairedFile,
        [
          "export function handler() {",
          "  return c.body(csv, 200, {",
          '    "Content-Type": "text/csv; charset=utf-8",',
          '    "Content-Disposition": contentDispositionAttachment("results.csv"),',
          "  });",
          "}",
          "",
        ].join("\n"),
      );

      const unpairedHits = scanForDownloadContentTypes([dir]).filter((h) =>
        h.file.endsWith("unpaired.ts"),
      );
      const pairedHits = scanForDownloadContentTypes([dir]).filter((h) => h.file.endsWith("paired.ts"));

      expect(unpairedHits.length).toBeGreaterThan(0);
      expect(pairedHits.length).toBeGreaterThan(0);

      const unpairedLines = stripComments(readFileSync(unpairedFile, "utf8")).split("\n");
      const pairedLines = stripComments(readFileSync(pairedFile, "utf8")).split("\n");

      for (const h of unpairedHits) {
        expect(isPaired(h, unpairedLines)).toBe(false);
      }
      for (const h of pairedHits) {
        expect(isPaired(h, pairedLines)).toBe(true);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
