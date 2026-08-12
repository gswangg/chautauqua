import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * DEC-435: formatRef (src/domain/ids.ts) must be the ONLY place in src/ that
 * builds a zero-padded human ref. Before this fix, src/sync/airtable.ts
 * fabricated its own `SES-${String(s.seq).padStart(3, "0")}` literal instead
 * of calling formatRef(event.recordPrefix, seq) — which silently produced a
 * wrong ref for every event whose record_prefix wasn't the literal 'SES'.
 * This scanner operates on source text, independent of any db fake, so a
 * future regression that reintroduces a second padded-ref builder fails
 * loudly here instead of only showing up as a wrong value at runtime.
 */

const SRC_ROOT = join(__dirname, "..", "src");
const IDS_FILE = join(SRC_ROOT, "domain", "ids.ts");

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

// Matches `padStart(3` (the zero-pad-to-3 idiom used by ref construction) and
// a template literal of the shape `${prefix}-${String(seq)...}` — i.e. a
// hand-rolled prefix-dash-padded-seq ref, the exact shape formatRef exists to
// centralize.
const PAD_START_RE = /padStart\(3/;
const DASH_TEMPLATE_RE = /`[^`]*-\$\{String\(/;

describe("formatRef is the single source of padded human refs (DEC-435)", () => {
  const files = listTsFiles(SRC_ROOT);

  it("finds src/domain/ids.ts in the scan (scanner sanity check)", () => {
    expect(files).toContain(IDS_FILE);
  });

  it("no file other than src/domain/ids.ts contains a padStart(3 ref-padding idiom", () => {
    const offenders = files
      .filter((f) => f !== IDS_FILE)
      .filter((f) => PAD_START_RE.test(readFileSync(f, "utf8")))
      .map((f) => relative(SRC_ROOT, f));
    expect(offenders).toEqual([]);
  });

  it("no file other than src/domain/ids.ts contains a `prefix-${String(seq)` template ref builder", () => {
    const offenders = files
      .filter((f) => f !== IDS_FILE)
      .filter((f) => DASH_TEMPLATE_RE.test(readFileSync(f, "utf8")))
      .map((f) => relative(SRC_ROOT, f));
    expect(offenders).toEqual([]);
  });

  it("src/domain/ids.ts itself still contains the formatRef padding idiom (regex sanity check)", () => {
    const source = readFileSync(IDS_FILE, "utf8");
    // ids.ts pads to a dynamic width (>=3, widening past 999), so it uses
    // `padStart(width` rather than the literal `padStart(3` a hardcoded
    // fabricator would use — assert the general idiom is present here.
    expect(source).toContain("padStart(width");
  });
});
