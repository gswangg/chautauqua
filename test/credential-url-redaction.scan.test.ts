// DEC-949 (wave 34 amendment): binds CREDENTIAL_URL_SEGMENTS to the tree.
// Every file under src/ that mints a fresh claim/reset token
// (createClaimToken( / createResetToken() and immediately templates it into
// a URL path (the `/<segment>/${token}` shape) must use a segment that's a
// member of CREDENTIAL_URL_SEGMENTS — otherwise a future new credential type
// (or a renamed segment) would ship disclosed through Comms' "Show what was
// sent" the same way /reset/ did before this wave. This is a source-level
// scan (readFileSync + regex over the tree), not a runtime check, because
// the bug is "a segment was never added to the set", which only a static
// scan across every call site — not a single unit test — can catch.
//
// No exemptions: every call site found in the tree today (portal-link.ts,
// auth-reset.tsx, submit.tsx) templates its token behind "claim" or "reset",
// both already in the set. If that ever changes, this test fails by naming
// the offending file/segment rather than silently passing.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { CREDENTIAL_URL_SEGMENTS } from "../src/auth/credential-urls";

const SRC_ROOT = join(__dirname, "../src");

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if ([".ts", ".tsx"].includes(extname(full))) {
      out.push(full);
    }
  }
  return out;
}

const MINT_CALL_RE = /(?:const|let)\s+(\w+)\s*=\s*await\s+(?:createClaimToken|createResetToken)\(/g;

interface Finding {
  file: string;
  segment: string;
  varName: string;
}

function findMintedUrlSegments(file: string, source: string): Finding[] {
  const findings: Finding[] = [];
  let match: RegExpExecArray | null;
  MINT_CALL_RE.lastIndex = 0;
  while ((match = MINT_CALL_RE.exec(source)) !== null) {
    const varName = match[1]!;
    // The `/<segment>/${varName}` template shape, anywhere later in the file
    // (the token is usually re-templated into an absolute URL a few lines
    // after the mint, e.g. `${origin}/claim/${token}`).
    const templateRe = new RegExp(`/([A-Za-z0-9_-]+)/\\$\\{${varName}\\}`, "g");
    let templateMatch: RegExpExecArray | null;
    while ((templateMatch = templateRe.exec(source)) !== null) {
      findings.push({ file, segment: templateMatch[1]!, varName });
    }
  }
  return findings;
}

describe("credential URL segments are bound to CREDENTIAL_URL_SEGMENTS (DEC-949)", () => {
  it("finds at least one real mint+template call site (sanity: the scan isn't vacuous)", () => {
    const files = listSourceFiles(SRC_ROOT);
    const allFindings = files.flatMap((f) => findMintedUrlSegments(f, readFileSync(f, "utf8")));
    expect(allFindings.length).toBeGreaterThan(0);
  });

  it("every segment fronting a freshly minted token is in CREDENTIAL_URL_SEGMENTS", () => {
    const files = listSourceFiles(SRC_ROOT);
    const offenders: Finding[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (!source.includes("createClaimToken(") && !source.includes("createResetToken(")) continue;
      for (const finding of findMintedUrlSegments(file, source)) {
        if (!(CREDENTIAL_URL_SEGMENTS as readonly string[]).includes(finding.segment)) {
          offenders.push(finding);
        }
      }
    }
    if (offenders.length > 0) {
      const names = offenders
        .map((o) => `${o.file}: /${o.segment}/\${${o.varName}} — "${o.segment}" not in CREDENTIAL_URL_SEGMENTS`)
        .join("\n");
      throw new Error(`Unredacted credential URL segment(s) found:\n${names}`);
    }
    expect(offenders).toEqual([]);
  });
});
