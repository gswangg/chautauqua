// DEC-037 (wave 24 amendment): src/lib/html-escape.ts is the single owner of
// HTML-entity escaping for the whole repo. Three byte-identical definitions
// used to exist (src/mail/render.ts, src/lib/markdown.ts, src/server/http.ts)
// -- a live hole, since the next escaping rule applied to one and not the
// others would silently diverge. This scanner enumerates every *.ts/*.tsx
// under src/ (never a hand-listed manifest) and asserts exactly ONE function
// performs the HTML-entity replacement chain, matching on the tell-tale
// `.replace(/&/g, "&amp;")` occurrence, and that it lives in
// src/lib/html-escape.ts.
//
// src/routes/public/feeds.ts's escapeXml is a ledgered exemption: it is a
// different output language (XML, not HTML) -- it emits `&apos;` rather than
// `&#39;` and additionally strips XML 1.0 control bytes that HTML has no
// opinion on. It is not a second answer to "how do we escape HTML"; it does
// not touch dangerouslySetInnerHTML or an HTML string.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC_ROOT = join(__dirname, "..", "src");
const OWNER_FILE = join(SRC_ROOT, "lib", "html-escape.ts");
const EXEMPT_FILE = join(SRC_ROOT, "routes", "public", "feeds.ts");

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

// The tell-tale first step of the HTML-entity replacement chain.
const HTML_ENTITY_AMP_RE = /\.replace\(\s*\/&\/g\s*,\s*["']&amp;["']\s*\)/g;

describe("exactly one HTML-entity escaper exists, owned by src/lib/html-escape.ts (DEC-037)", () => {
  const files = listSourceFiles(SRC_ROOT);

  it("finds source files to scan (scanner sanity check)", () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain(OWNER_FILE);
    expect(files).toContain(EXEMPT_FILE);
  });

  it("the &amp; replacement chain occurs only in the owner file and the ledgered XML exemption", () => {
    const hits: string[] = [];
    for (const file of files) {
      const raw = readFileSync(file, "utf8");
      const stripped = stripComments(raw);
      HTML_ENTITY_AMP_RE.lastIndex = 0;
      if (HTML_ENTITY_AMP_RE.test(stripped)) {
        hits.push(file);
      }
    }
    const unexpected = hits.filter((f) => f !== OWNER_FILE && f !== EXEMPT_FILE);
    expect(unexpected.map((f) => relative(SRC_ROOT, f))).toEqual([]);
    expect(hits).toContain(OWNER_FILE);
  });

  it("the exempt file is genuinely XML, not a second HTML escaper", () => {
    const raw = readFileSync(EXEMPT_FILE, "utf8");
    expect(raw).toContain("&apos;");
    expect(raw).not.toContain("&#39;");
  });
});
