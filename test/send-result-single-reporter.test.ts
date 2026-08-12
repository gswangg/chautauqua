import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// DEC-677: "one reporter for every send" (DEC-664, app/src/lib/sendResult.ts)
// only holds if no component composes its own send sentence out of a
// subset of the server's SendResult fields. This is that guard: scan every
// app/src/**/*.tsx file for a hand-built "Sent N ..." sentence (the pattern
// the two bulk-email surfaces used before DEC-677 — a template literal or
// JSX text node reading only `sent`/`sentCount`, silently dropping the
// server's `failed[]`). sendResult.ts itself is the one legitimate source
// of that sentence and is excluded.

const REPO_ROOT = join(__dirname, "..");
const APP_SRC = join(REPO_ROOT, "app/src");

// Files allowed to contain a "Sent ..." literal: sendResult.ts itself
// (the ONE reporter) and its own test file (asserts on the string it
// produces, not a second composition of it).
const EXCLUDED = new Set([
  join(APP_SRC, "lib/sendResult.ts"),
  join(APP_SRC, "lib/sendResult.test.ts"),
]);

/** Recursively collect `.tsx`/`.ts` files under `dir`. */
function glob(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...glob(full));
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

const files = glob(APP_SRC).filter((f) => !EXCLUDED.has(f));

// Matches a hand-built send sentence: "Sent {count}" / "Sent " + count /
// `Sent ${count}` — i.e. the literal word "Sent" immediately followed by
// an interpolation or concatenation of a count variable, the pattern the
// pre-DEC-677 ComposeWizard/BulkEmailModal used.
const HAND_BUILT_SEND_SENTENCE = /Sent\s*\{?\s*\w*\s*\}?\s*email/i;

describe("send result has one reporter (DEC-677)", () => {
  it("scanned at least 1 file", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("no component outside sendResult.ts composes its own 'Sent N email(s)' sentence", () => {
    const violations: { file: string; line: number }[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const lines = src.split("\n");
      lines.forEach((line, idx) => {
        if (HAND_BUILT_SEND_SENTENCE.test(line)) {
          violations.push({ file, line: idx + 1 });
        }
      });
    }
    const message = violations.map((v) => `${v.file}:${v.line}`).join("\n");
    expect(violations, `\n${message}`).toEqual([]);
  });
});
