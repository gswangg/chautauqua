// DEC-987: the server-package mirror of app/src/lib/plural.test.ts's ternary
// guard. One pluralization vocabulary per package -- src/domain/count-copy.ts
// is the ONE home for the count-phrase helpers on this side of the app/ ->
// src/ boundary (app/src/lib/plural.ts re-exports it, DEC-957), so no other
// file under src/ may hand-roll a `? '' : 's'` ternary or a raw '(s)' count
// phrase. This scan does NOT skip src/routes/dev/ (unlike count-grammar.test
// .ts's glob) and carries no per-file exceptions beyond count-copy.ts and
// this test itself -- both known offenders (tasks.ts, dev/mailbox.tsx) are
// fixed in this same task rather than allowlisted.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = join(__dirname, "..", "src");
const ALLOWLIST = new Set(["domain/count-copy.ts"]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (relative(SRC_ROOT, full) === "decisions-data") continue;
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.includes(".test.")) {
      out.push(full);
    }
  }
  return out;
}

const TERNARY_PATTERN = /\?\s*['"]{2}\s*:\s*['"]s['"]/;
const PAREN_S_PATTERN = /[A-Za-z]\(s\)/;

describe("no hand-copied pluralization vocabulary outside count-copy.ts (DEC-987)", () => {
  it("scanned at least 1 file", () => {
    expect(walk(SRC_ROOT).length).toBeGreaterThan(0);
  });

  it("bans `? '' : 's'` ternaries and raw '(s)' phrases outside the allowlist", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_ROOT)) {
      const rel = relative(SRC_ROOT, file);
      if (ALLOWLIST.has(rel)) continue;
      const contents = readFileSync(file, "utf8");
      if (TERNARY_PATTERN.test(contents) || PAREN_S_PATTERN.test(contents)) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});
