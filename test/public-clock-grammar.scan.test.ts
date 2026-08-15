// DEC-768 (wave 48 amendment): ONE public clock grammar. cards.tsx used to
// export TWO clock formatters — formatMinutes (12-hour, "9:30 AM") and
// formatStartTime24 (24-hour, "9:30") — and different public surfaces
// (agenda/programme vs. sessions-list/detail) called different ones, so the
// same session printed two clocks depending on where it was drawn.
// formatMinutes is now deleted (no deprecated re-export — house rule) and
// every public.ts/.tsx caller uses formatStartTime24. This scan is the
// regression guard: it fails on an AM/PM time literal or an h%12/hour12
// construction anywhere under src/routes/public/, and asserts cards.tsx
// exports exactly one clock formatter.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const PUBLIC_ROOT = join(ROOT, "src", "routes", "public");

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (stat.isFile() && /\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
}

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
    out += c;
    i++;
  }
  return out;
}

interface Hit {
  file: string;
  line: number;
  text: string;
}

// An AM/PM time literal inside a string/template: "9:30 AM", "9:30PM", etc.
const AMPM_LITERAL = /\d{1,2}:\d{2}\s*(AM|PM)\b/;
// A 12-hour-clock construction: `h % 12` (either order/spacing) or `hour12`.
const HOUR12_CONSTRUCT = /\bhour12\b|%\s*12\b|\b12\s*%/;

function scan(): Hit[] {
  const files: string[] = [];
  walk(PUBLIC_ROOT, files);
  const hits: Hit[] = [];
  for (const file of files) {
    const rawSrc = readFileSync(file, "utf8");
    const lines = stripComments(rawSrc).split("\n");
    lines.forEach((line, idx) => {
      if (AMPM_LITERAL.test(line) || HOUR12_CONSTRUCT.test(line)) {
        hits.push({ file: relative(ROOT, file).split("\\").join("/"), line: idx + 1, text: line.trim() });
      }
    });
  }
  return hits;
}

describe("public clock grammar scan (DEC-768 wave 48 amendment)", () => {
  it("no AM/PM time literal or hour12/h%12 construction under src/routes/public/", () => {
    const hits = scan();
    expect(hits, hits.map((h) => `${h.file}:${h.line}: ${h.text}`).join("\n") || "no offender found").toHaveLength(0);
  });

  it("cards.tsx exports exactly one clock formatter (formatStartTime24, not formatMinutes)", () => {
    const src = readFileSync(join(PUBLIC_ROOT, "cards.tsx"), "utf8");
    const exportedFormatters = [...src.matchAll(/export function (format\w*(?:Time|Minutes)\w*)\(/g)].map((m) => m[1]);
    expect(exportedFormatters).toEqual(["formatStartTime24"]);
    expect(src.includes("formatMinutes")).toBe(false);
  });
});
