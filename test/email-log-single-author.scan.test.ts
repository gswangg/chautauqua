// DEC-923: the mailer is the SOLE author of every email_log row. Two writers
// logging one send-failure event invent two vocabularies ('error' vs
// 'failed') and, worse, can double-write a row for one attempt (the bug
// this closes: RecentSends.tsx's statusTally printed "3 error, 3 failed" for
// a single prod failure because both the real mailer AND the route-level
// logFailedSend fired). This is a pure source-text scan: log-failed.ts must
// be gone outright (no shim, no re-export — house rule), and `insert(schema
// .emailLog)` — the one place an email_log row is actually written — must
// occur in exactly one file, src/server/context.ts (d1EmailLogWriter). Every
// other write path (mail/dev-sink.ts, mail/email-binding.ts, and any future mailer)
// must go THROUGH that one writer, not around it.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..");
const SRC_DIR = join(REPO_ROOT, "src");

function glob(dir: string, suffixes: string[]): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...glob(full, suffixes));
    } else if (suffixes.some((suffix) => entry.endsWith(suffix))) {
      out.push(full);
    }
  }
  return out;
}

const SOLE_AUTHOR_PATH = "src/server/context.ts";

/** Pure function over one file's source text: any `insert(schema.emailLog)`
 * outside SOLE_AUTHOR_PATH, any import of the deleted mail/log-failed
 * module, or any call to the deleted logFailedSend is a violation.
 * `repoRelPath` is a forward-slash path relative to the repo root. */
function findViolations(fileText: string, repoRelPath: string): string[] {
  const violations: string[] = [];
  if (fileText.includes("insert(schema.emailLog)") && repoRelPath !== SOLE_AUTHOR_PATH) {
    violations.push(
      `${repoRelPath}: writes email_log directly via insert(schema.emailLog) -- only ${SOLE_AUTHOR_PATH} (d1EmailLogWriter) may author email_log rows (DEC-923)`,
    );
  }
  if (fileText.includes("mail/log-failed")) {
    violations.push(`${repoRelPath}: imports the deleted mail/log-failed module`);
  }
  if (fileText.includes("logFailedSend")) {
    violations.push(`${repoRelPath}: calls the deleted logFailedSend`);
  }
  return violations;
}

function repoRelPath(file: string): string {
  return file.slice(REPO_ROOT.length + 1).split("\\").join("/");
}

describe("email-log-single-author scan negative control (DEC-518 wave-35 amendment)", () => {
  it("VIOLATION: a second file inserting into schema.emailLog is reported", () => {
    const src = "async function bad() { await db.insert(schema.emailLog).values(row); }";
    expect(findViolations(src, "src/mail/rogue-writer.ts")).toEqual([
      "src/mail/rogue-writer.ts: writes email_log directly via insert(schema.emailLog) -- only src/server/context.ts (d1EmailLogWriter) may author email_log rows (DEC-923)",
    ]);
  });

  it("VIOLATION: an import of the deleted mail/log-failed module is reported", () => {
    const src = 'import { logFailedSend } from "../mail/log-failed";';
    const violations = findViolations(src, "src/routes/fixture.ts");
    expect(violations).toContain("src/routes/fixture.ts: imports the deleted mail/log-failed module");
    expect(violations).toContain("src/routes/fixture.ts: calls the deleted logFailedSend");
  });

  it("COMPLIANT: insert(schema.emailLog) in the sole-author file itself is silent", () => {
    const src = "async function d1EmailLogWriter() { await db.insert(schema.emailLog).values(row); }";
    expect(findViolations(src, SOLE_AUTHOR_PATH)).toEqual([]);
  });

  it("COMPLIANT: a file with neither pattern is silent", () => {
    const src = "async function send() { await mailer.send(msg); }";
    expect(findViolations(src, "src/mail/dev-sink.ts")).toEqual([]);
  });
});

describe("email_log has exactly one author (DEC-923)", () => {
  it("src/mail/log-failed.ts no longer exists", () => {
    expect(existsSync(join(SRC_DIR, "mail", "log-failed.ts"))).toBe(false);
  });

  it("`insert(schema.emailLog)` occurs in exactly one file, src/server/context.ts (declared-vs-discovered, both directions)", () => {
    const files = glob(SRC_DIR, [".ts", ".tsx"]);
    const discoveredAuthors = new Set<string>();
    const otherViolations: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const rel = repoRelPath(file);
      if (text.includes("insert(schema.emailLog)")) discoveredAuthors.add(rel);
      otherViolations.push(...findViolations(text, rel).filter((v) => !v.includes("insert(schema.emailLog)")));
    }

    // Direction 1: every discovered author besides the declared sole author
    // is an unauthorized write site (discovered-but-undeclared).
    const unauthorized = [...discoveredAuthors].filter((f) => f !== SOLE_AUTHOR_PATH);
    expect(unauthorized, `unauthorized email_log writers: ${unauthorized.join(", ")}`).toEqual([]);

    // Direction 2: the declared sole author must actually be a discovered
    // writer (declared-but-absent -- catches the file being renamed out
    // from under this assertion without the check ever noticing).
    expect(discoveredAuthors.has(SOLE_AUTHOR_PATH), `${SOLE_AUTHOR_PATH} no longer writes insert(schema.emailLog) -- update DEC-923's declared sole author`).toBe(true);

    expect(otherViolations).toEqual([]);
  });

  it("nothing imports the deleted log-failed module or calls logFailedSend", () => {
    const files = glob(SRC_DIR, [".ts", ".tsx"]);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text.includes("mail/log-failed")).toBe(false);
      expect(text.includes("logFailedSend")).toBe(false);
    }
  });
});
