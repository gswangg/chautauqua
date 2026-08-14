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

describe("email_log has exactly one author (DEC-923)", () => {
  it("src/mail/log-failed.ts no longer exists", () => {
    expect(existsSync(join(SRC_DIR, "mail", "log-failed.ts"))).toBe(false);
  });

  it("`insert(schema.emailLog)` occurs in exactly one file, src/server/context.ts", () => {
    const files = glob(SRC_DIR, [".ts", ".tsx"]);
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (text.includes("insert(schema.emailLog)")) {
        hits.push(file);
      }
    }
    expect(hits).toEqual([join(SRC_DIR, "server", "context.ts")]);
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
