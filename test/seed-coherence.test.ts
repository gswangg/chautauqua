// DEC-771: "the seed is the grader package: nothing collides on the identity
// a human matches by, and every screen shows its own shape". Three graders
// independently reported: (a) two accepted sessions sharing the title
// "Taming 40-Minute CI" (the seeded one vs. a grader-created one from the
// same fixture title, per docs/eval-rubric/01-call-for-papers.yaml's
// CFP-S2), (b) a duplicate "Confirm participation" task, (c) Priya carrying
// two identically-named contact records, and (d) the Content worklist
// reading mostly "No files yet" with too few comms templates/no real batch.
//
// Every assertion here walks the FULL seeded row set (enumeration), never a
// hand-picked sample — the field guide's "universal rows graded from
// ENUMERATION never sample" rule, restated by DEC-771 itself. Reuses the
// quote-aware SQL row parser already established in test/seed.test.ts
// (task w2-d / DEC-739) rather than inventing a second one.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..");
const OUTPUT_PATH = join(REPO_ROOT, ".seed.sql");

let sql: string;

beforeAll(() => {
  execFileSync("npx", ["tsx", "scripts/seed.ts"], { cwd: REPO_ROOT, stdio: "inherit" });
  expect(existsSync(OUTPUT_PATH)).toBe(true);
  sql = readFileSync(OUTPUT_PATH, "utf-8");
}, 60_000);

/** Splits a VALUES(...) tuple's raw text into per-column literal strings
 * (still quoted, e.g. "'foo'" or "NULL" or "123"), respecting SQL's
 * doubled-single-quote escaping so an embedded comma inside a quoted string
 * never desyncs the column boundary. Mirrors test/seed.test.ts's helper. */
function tokenizeSqlValues(raw: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < raw.length) {
    while (raw[i] === " ") i++;
    if (raw[i] === "'") {
      let j = i + 1;
      let val = "'";
      while (j < raw.length) {
        if (raw[j] === "'" && raw[j + 1] === "'") {
          val += "''";
          j += 2;
          continue;
        }
        if (raw[j] === "'") {
          val += "'";
          j++;
          break;
        }
        val += raw[j];
        j++;
      }
      out.push(val);
      i = j;
    } else {
      let j = i;
      while (j < raw.length && raw[j] !== ",") j++;
      out.push(raw.slice(i, j).trim());
      i = j;
    }
    while (raw[i] === " ") i++;
    if (raw[i] === ",") i++;
  }
  return out;
}

/** Unquotes a tokenizeSqlValues() literal: "'foo'" -> "foo", "NULL" -> null. */
function unquote(literal: string): string | null {
  if (literal === "NULL") return null;
  if (literal.startsWith("'") && literal.endsWith("'")) {
    return literal.slice(1, -1).replace(/''/g, "'");
  }
  return literal;
}

/** Parses every `INSERT INTO <table> (...) VALUES (...);` statement (one per
 * output line -- seed.ts never embeds a raw newline in a value) into a
 * column-name -> unquoted-value record. */
function parseInserts(sqlText: string, table: string): Array<Record<string, string | null>> {
  const rowRe = new RegExp(`^INSERT INTO ${table} \\(([^)]*)\\) VALUES \\((.*)\\);$`, "gm");
  const rows: Array<Record<string, string | null>> = [];
  for (const m of sqlText.matchAll(rowRe)) {
    const columns = m[1]!.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const values = tokenizeSqlValues(m[2]!);
    if (values.length !== columns.length) {
      throw new Error(
        `parseInserts: column/value count mismatch for ${table} (${columns.length} cols, ${values.length} vals): ${m[0]}`,
      );
    }
    const row: Record<string, string | null> = {};
    columns.forEach((c, idx) => {
      row[c] = unquote(values[idx]!);
    });
    rows.push(row);
  }
  return rows;
}

/** Groups rows by a key function and returns only groups with >1 member,
 * as [key, count] pairs -- the "assert max count 1" shape the field guide
 * calls for, expressed so a failing test names the actual offending group. */
function duplicateGroups<T>(rows: T[], keyFn: (row: T) => string): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyFn(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1);
}

describe("seed coherence (DEC-771)", () => {
  it("(a) no two submissions in the event share a title", () => {
    const submissionRows = parseInserts(sql, "submission");
    // 3 fixture + 27 synthetic.
    expect(submissionRows.length).toBe(30);
    const dupes = duplicateGroups(submissionRows, (r) => r.title!);
    expect(dupes, `duplicate submission titles: ${JSON.stringify(dupes)}`).toEqual([]);
  });

  it("(a) the seeded fixture-derived submission does not carry the exact fixture title a grader is instructed to submit fresh (CFP-S2)", () => {
    const submissionRows = parseInserts(sql, "submission");
    const titles = submissionRows.map((r) => r.title);
    // docs/eval-rubric/01-call-for-papers.yaml CFP-S2 has the grader submit
    // this exact title fresh; the seed must not pre-occupy it.
    expect(titles).not.toContain("Taming 40-Minute CI: Incremental Builds at Monorepo Scale");
  });

  it("(b) no two contacts in the org share a normalized email", () => {
    const contactRows = parseInserts(sql, "contact");
    expect(contactRows.length).toBeGreaterThan(0);
    const dupes = duplicateGroups(contactRows, (r) => (r.email ?? "").toLowerCase().trim());
    expect(dupes, `duplicate contact emails: ${JSON.stringify(dupes)}`).toEqual([]);
  });

  it("(b) no two contacts in the org share a normalized full name", () => {
    const contactRows = parseInserts(sql, "contact");
    const dupes = duplicateGroups(
      contactRows,
      (r) => `${r.first_name ?? ""} ${r.last_name ?? ""}`.toLowerCase().trim().replace(/\s+/g, " "),
    );
    expect(dupes, `duplicate contact full names: ${JSON.stringify(dupes)}`).toEqual([]);
  });

  it("(c) no two tasks in the event share a title", () => {
    const taskRows = parseInserts(sql, "task");
    expect(taskRows.length).toBeGreaterThan(0);
    const dupes = duplicateGroups(taskRows, (r) => r.title!);
    expect(dupes, `duplicate task titles: ${JSON.stringify(dupes)}`).toEqual([]);
  });

  it("(d) roughly a third of accepted submissions carry at least one deliverable file, including at least one multi-version chain and one comment thread", () => {
    const submissionRows = parseInserts(sql, "submission");
    const acceptedIds = new Set(submissionRows.filter((r) => r.status === "accepted").map((r) => r.id!));
    expect(acceptedIds.size).toBeGreaterThan(0);

    const fileRows = parseInserts(sql, "file");
    const submissionIdsWithFiles = new Set(
      fileRows.filter((f) => f.submission_id && acceptedIds.has(f.submission_id)).map((f) => f.submission_id!),
    );

    // "Roughly a third" — never zero, never merely one-off; a wide band
    // (>=25%) so this doesn't flake on the exact accepted-submission count,
    // while still failing loudly if density regresses back toward the
    // reported 28/30-empty state.
    const fraction = submissionIdsWithFiles.size / acceptedIds.size;
    expect(
      fraction,
      `${submissionIdsWithFiles.size}/${acceptedIds.size} accepted submissions carry a file`,
    ).toBeGreaterThanOrEqual(0.25);

    // At least one multi-version chain (a file whose previous_file_id
    // points at another seeded file row).
    const fileIds = new Set(fileRows.map((f) => f.id!));
    const chainLinks = fileRows.filter((f) => f.previous_file_id && fileIds.has(f.previous_file_id));
    expect(chainLinks.length).toBeGreaterThanOrEqual(1);

    // At least one comment thread on a file belonging to an accepted
    // submission.
    const fileCommentRows = parseInserts(sql, "file_comment");
    const filesOnAcceptedSubmissions = new Set(
      fileRows.filter((f) => f.submission_id && acceptedIds.has(f.submission_id)).map((f) => f.id!),
    );
    const commentsOnAcceptedFiles = fileCommentRows.filter((c) => filesOnAcceptedSubmissions.has(c.file_id!));
    expect(commentsOnAcceptedFiles.length).toBeGreaterThanOrEqual(1);
  });

  it("(d) at least one comms batch of ~20 recipients sharing one batch_id, plus at least five email templates", () => {
    const emailLogRows = parseInserts(sql, "email_log");
    const batchCounts = new Map<string, number>();
    for (const row of emailLogRows) {
      if (!row.batch_id) continue;
      batchCounts.set(row.batch_id, (batchCounts.get(row.batch_id) ?? 0) + 1);
    }
    const bigBatches = [...batchCounts.entries()].filter(([, count]) => count >= 20);
    expect(bigBatches.length).toBeGreaterThanOrEqual(1);

    // DEC-771 asks for "roughly ... five templates" -- a density floor, not a
    // cap: DEC-796 adds a sixth ("Speaker Portal Invitation") so the
    // portal-invite send is one template pick away. The floor is what the
    // Templates tab needs to show its own shape.
    const templateRows = parseInserts(sql, "email_template");
    expect(templateRows.length).toBeGreaterThanOrEqual(5);
  });

  it("(DEC-796) no seeded email_log row's subject or body_text contains a raw '{merge_field}' placeholder", () => {
    // Scans the raw SQL text (not just parsed rows) so a literal '{' inside
    // an email_log INSERT's subject/body_text column is caught even if a
    // future edit changes the row shape — every seeded history row must
    // show the text that was actually sent, never the unrendered template.
    const emailLogInsertRe = /^INSERT INTO email_log \(([^)]*)\) VALUES \((.*)\);$/gm;
    const offenders: string[] = [];
    for (const m of sql.matchAll(emailLogInsertRe)) {
      const columns = m[1]!.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const values = tokenizeSqlValues(m[2]!);
      const row: Record<string, string | null> = {};
      columns.forEach((c, idx) => {
        row[c] = unquote(values[idx]!);
      });
      for (const field of ["subject", "body_text"] as const) {
        const value = row[field];
        if (value && value.includes("{")) {
          offenders.push(`${field}="${value}"`);
        }
      }
    }
    const emailLogRows = parseInserts(sql, "email_log");
    expect(emailLogRows.length).toBeGreaterThan(0);
    expect(offenders, `seeded email_log rows still carry raw template placeholders: ${JSON.stringify(offenders)}`).toEqual(
      [],
    );
  });
});
