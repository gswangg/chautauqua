// B9 (DEC-037 amendment, wave 27; extended wave 34): a pure source-text scan.
// Before this wave every outbound HTML body was `html: textToHtml(...)` -- a
// bare paragraph run with no wordmark, no measure, no reason line. This scan
// (1) proves no send site still produces its `html:` property from a bare
// textToHtml call, and (2) enumerates the nine known mailer.send call sites
// so a future send path added elsewhere cannot silently skip the shell --
// the closed-set assertion below computes the ACTUAL set of files that call
// mailer.send with an `html` property and asserts it equals SWEPT_SITES by
// name, rather than checking the same predicate on both sides.

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

// The eight send sites this wave swept (DEC-037 amendment), and how many
// `renderEmailHtml(` call expressions each is expected to carry.
const SWEPT_SITES: { file: string; expectedRenderEmailHtmlCalls: number }[] = [
  { file: join(SRC_DIR, "routes", "comms", "send.ts"), expectedRenderEmailHtmlCalls: 1 },
  { file: join(SRC_DIR, "routes", "comms", "portal-invites.ts"), expectedRenderEmailHtmlCalls: 1 },
  { file: join(SRC_DIR, "routes", "api", "users.ts"), expectedRenderEmailHtmlCalls: 1 },
  { file: join(SRC_DIR, "routes", "api", "contacts", "bulk-email.ts"), expectedRenderEmailHtmlCalls: 1 },
  { file: join(SRC_DIR, "routes", "review", "plans-progress.ts"), expectedRenderEmailHtmlCalls: 1 },
  { file: join(SRC_DIR, "routes", "content-notes.ts"), expectedRenderEmailHtmlCalls: 1 },
  { file: join(SRC_DIR, "server", "repo", "tasks", "reminders.ts"), expectedRenderEmailHtmlCalls: 1 },
  { file: join(SRC_DIR, "routes", "auth-reset.tsx"), expectedRenderEmailHtmlCalls: 1 },
  { file: join(SRC_DIR, "routes", "public", "submit.tsx"), expectedRenderEmailHtmlCalls: 1 },
];

describe("every outbound HTML body renders through the B9 shell (DEC-037 amendment)", () => {
  it("no `html:` property anywhere in src is produced by a bare textToHtml call", () => {
    const files = glob(SRC_DIR, [".ts", ".tsx"]);
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (/html:\s*textToHtml\(/.test(text)) hits.push(file);
    }
    expect(hits).toEqual([]);
  });

  it("textToHtml is called from exactly its two owning files (render.ts's definition, shell.ts's one call)", () => {
    const files = glob(SRC_DIR, [".ts", ".tsx"]);
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (text.includes("textToHtml(")) hits.push(file);
    }
    expect(hits.sort()).toEqual([join(SRC_DIR, "mail", "render.ts"), join(SRC_DIR, "mail", "shell.ts")].sort());
  });

  for (const site of SWEPT_SITES) {
    it(`${site.file.replace(SRC_DIR + "/", "src/")} sends its html via renderEmailHtml`, () => {
      expect(existsSync(site.file)).toBe(true);
      const text = readFileSync(site.file, "utf8");
      expect(text).toContain('import { renderEmailHtml } from');
      // Sites either inline the call as an object property
      // (`html: renderEmailHtml(...)`) or assign it to a local that's later
      // passed by shorthand (`const html = renderEmailHtml(...)`); either
      // way the call expression itself is what's being counted here.
      const calls = text.match(/renderEmailHtml\(/g) ?? [];
      expect(calls).toHaveLength(site.expectedRenderEmailHtmlCalls);
    });
  }

  it("the closed set of files under src/ calling mailer.send with an html property equals SWEPT_SITES", () => {
    const files = glob(SRC_DIR, [".ts", ".tsx"]);
    const actual: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (!text.includes("mailer.send(")) continue;
      if (!/\bhtml\s*[:,]/.test(text)) continue;
      actual.push(file);
    }
    const expected = SWEPT_SITES.map((s) => s.file);
    // Compare by name (relative to SRC_DIR) so a mismatch fails with a
    // readable diff naming the unlisted or missing file, rather than a
    // pass/fail predicate asserted identically on both branches.
    expect(actual.map((f) => f.replace(SRC_DIR + "/", "src/")).sort()).toEqual(
      expected.map((f) => f.replace(SRC_DIR + "/", "src/")).sort(),
    );
  });
});
