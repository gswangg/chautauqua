// DEC-274 (amendment wave 23) scan-lock: every source file under
// src/server/repo/public/** that reads schema.submission must name
// visibleSessionConditions or visibleSubmissionConditions somewhere in the
// file, or be named in the hard-coded exemption map below with a stated,
// file-specific reason describing what that file actually does. Modelled on
// test/participant-invite-audience.scan.test.ts, which locks the
// PARTICIPANT gate — the SESSION gate has never had one, and
// hydrateSessions (src/server/repo/public/sessions.ts) was protected only
// by a docstring across seven call sites until this wave (w23-c).
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const REPO_ROOT = join(__dirname, "..");
const PUBLIC_REPO_DIR = join(REPO_ROOT, "src/server/repo/public");

// Every file under src/server/repo/public/** that genuinely reads
// schema.submission but is not (and, per its stated reason, should not be)
// gated by visibleSessionConditions/visibleSubmissionConditions. Empty at
// the time this scan was written — every current reader already names one
// of the two gate functions somewhere in the file. Keep this list honest:
// each reason describes what the file at that path ACTUALLY does (read at
// scan time), not a guess.
const EVERY_SESSION_GATE_EXEMPTION: Record<string, string> = {};

const GATE_MARKERS = ["visibleSessionConditions", "visibleSubmissionConditions"];

const READ_PATTERNS = [
  /\.from\(schema\.submission\)/,
  /innerJoin\(\s*schema\.submission\b/,
  /leftJoin\(\s*schema\.submission\b/,
  /from\s*\$\{schema\.submission\}/,
];

function hasSubmissionRead(src: string): boolean {
  return READ_PATTERNS.some((re) => re.test(src));
}

function declaresGate(src: string): boolean {
  return GATE_MARKERS.some((marker) => src.includes(marker));
}

function everyPublicRepoFile(): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(PUBLIC_REPO_DIR, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!(entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) continue;
    out.push(relative(REPO_ROOT, join(PUBLIC_REPO_DIR, entry.name)).split(sep).join("/"));
  }
  return out;
}

describe("public-session-gate scan (DEC-274, wave 23)", () => {
  it("every read-but-undeclared schema.submission-read file under repo/public is exactly the hard-coded exemption map", () => {
    const relFiles = everyPublicRepoFile();
    const readUndeclared: string[] = [];
    for (const rel of relFiles) {
      const abs = join(REPO_ROOT, rel);
      const src = readFileSync(abs, "utf-8");
      if (hasSubmissionRead(src) && !declaresGate(src)) {
        readUndeclared.push(rel);
      }
    }
    readUndeclared.sort();
    const expected = Object.keys(EVERY_SESSION_GATE_EXEMPTION).sort();
    expect(readUndeclared).toEqual(expected);
  });

  it("every reason in the exemption map is a non-empty string", () => {
    for (const [, reason] of Object.entries(EVERY_SESSION_GATE_EXEMPTION)) {
      expect(typeof reason).toBe("string");
      expect(reason.trim().length).toBeGreaterThan(0);
    }
  });

  it("no exemption entry names a file that no longer exists", () => {
    for (const path of Object.keys(EVERY_SESSION_GATE_EXEMPTION)) {
      expect(existsSync(join(REPO_ROOT, path))).toBe(true);
    }
  });

  it("no exemption entry names a file that now declares a gate (a stale exemption fails loudly)", () => {
    for (const path of Object.keys(EVERY_SESSION_GATE_EXEMPTION)) {
      const src = readFileSync(join(REPO_ROOT, path), "utf-8");
      expect(declaresGate(src)).toBe(false);
    }
  });
});
