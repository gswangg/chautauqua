import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guard for the class of bug fixed in src/server/repo/overview.ts (DEC-388):
 * D1 rejects object bind values (D1_TYPE_ERROR: Type 'object' not supported).
 * `sql`...`` template literals must never interpolate a `Date` object or an
 * ISO string built from one -- callers must pass numeric epoch-ms instead
 * (see src/server/repo/tasks/grid.ts for the sanctioned `< ${now}` idiom).
 *
 * test/overview.test.ts uses a fake chainable db that never actually binds
 * params, so it cannot catch this class of bug -- this scanner operates on
 * source text instead, independent of any db fake.
 */

const SRC_ROOT = join(__dirname, "..", "src");

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

// Matches `sql`...`` template-literal regions. The codebase's sql`` usages
// never nest a literal backtick inside a ${} interpolation, so a
// non-backtick-containing match is sufficient to isolate each template body.
const SQL_TEMPLATE_RE = /sql`(?:\\.|[^`\\])*`/g;

function extractSqlTemplates(source: string): string[] {
  return source.match(SQL_TEMPLATE_RE) ?? [];
}

describe("D1 bind safety: no object binds inside sql`` templates", () => {
  const files = listTsFiles(SRC_ROOT);
  const allTemplates: { file: string; template: string }[] = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const template of extractSqlTemplates(source)) {
      allTemplates.push({ file, template });
    }
  }

  it("finds at least 30 sql`` templates across src/ (scanner sanity check)", () => {
    // If this drops near zero, the regex/walk broke and the assertions below
    // would pass vacuously -- fail loudly instead.
    expect(allTemplates.length).toBeGreaterThanOrEqual(30);
  });

  it("never interpolates `new Date(` inside a sql`` template", () => {
    const offenders = allTemplates.filter(({ template }) => template.includes("new Date("));
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it("never interpolates `.toISOString()` inside a sql`` template", () => {
    const offenders = allTemplates.filter(({ template }) => template.includes(".toISOString()"));
    expect(offenders.map((o) => o.file)).toEqual([]);
  });

  it("overview.ts overdue-task-rows query uses the numeric `< ${now}` idiom", () => {
    const overviewPath = join(SRC_ROOT, "server", "repo", "overview.ts");
    const source = readFileSync(overviewPath, "utf8");
    expect(source).toContain("< ${now}");
  });
});
