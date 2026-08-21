// DEC-747 amendment (wave-153): a tooltip is copy, and the portal-preview
// impersonation vocabulary gets a sentinel.
//
// DESIGN-RULINGS item 22 requires the portal preview's disabled Download
// control to state that it is a read-only impersonation of the portal, and
// the ruling's own name for the control is "Open as a speaker"
// (app/src/pages/settings/PortalSettingsPanel.tsx:250). Before this wave,
// src/routes/portal/preview.tsx:64 instead told the organizer to "sign in as
// this speaker to download" -- naming a capability the product has no path
// for (there is no sign-in-as anywhere in the tree) and contradicting the
// page's own "this preview deliberately cannot [be a real speaker]"
// sentence.
//
// This is a zero-tolerance sentinel, not a ratchet: it asserts toEqual([])
// and is deliberately NOT registered as a `*_CEILING` in
// scripts/exit-predicate.ts, because a population that must never be
// non-zero has no ceiling to declare.
//
// Population: every .ts/.tsx file under src/routes/portal/** and
// app/src/pages/settings/**, enumerated via readdirSync (DEC-180 -- a
// hand-listed file list is not a population). Source is comment-stripped
// first via the shared string-aware helper (DEC-613 -- do not hand-roll a
// fifth copy of the CSS/TS comment stripper) so a comment that discusses the
// retired vocabulary (like this file's own header, or preview.tsx's) is
// never mistaken for a live offender.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { stripSourceComments } from "./source-comments";

const ROOT = join(__dirname, "..");
const WALK_DIRS = ["src/routes/portal", "app/src/pages/settings"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", "build", ".git"]);

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir))) {
    if (SKIP_DIRS.has(entry)) continue;
    const rel = join(dir, entry);
    const abs = join(ROOT, rel);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      out.push(...listFiles(rel));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(rel);
    }
  }
  return out;
}

// A "sign in as" / "signed in as" / "log in as" / "logged in as" phrase
// followed by a person-or-demonstrative referent (this/that/these/those,
// them/him/her, someone/anybody/whoever, or an "a/the/any <noun>" phrase --
// e.g. "this speaker", "the speaker", "a speaker", "them"), matched only
// inside a quoted string span on the same line so a plain-prose sentence in
// a comment or elsewhere in code cannot trip it.
//
// This deliberately does NOT fire on:
//   - "...sign in as soon as you do this" (PeopleRolesPanel.tsx:508) --
//     "soon" is not a person-or-demonstrative referent.
//   - "...signed in as {revealed.email} is ended" (PeopleRolesPanel.tsx:189)
//     -- a true statement about the viewer's OWN session, naming an email
//     interpolation, not a person-or-demonstrative referent.
function quotedImpersonationMatches(line: string): boolean {
  const QUOTE_CHARS = ["'", '"', "`"] as const;
  for (const q of QUOTE_CHARS) {
    // Lazily match the shortest quoted span containing the phrase, so a line
    // with multiple string literals doesn't let one literal's closing quote
    // bleed into the next.
    const re = new RegExp(
      `${q}(?:[^${q}]*?)\\b(?:sign(?:ed)?|log(?:ged)?) in as\\s+(?:this|that|these|those|them|him|her|someone|anybody|whoever|any\\s+\\w+|the\\s+\\w+|a\\s+\\w+)\\b(?:[^${q}]*?)${q}`,
      "i",
    );
    if (re.test(line)) return true;
  }
  return false;
}

function findOffenders(rel: string): string[] {
  const raw = readFileSync(join(ROOT, rel), "utf8");
  const stripped = stripSourceComments(raw);
  const lines = stripped.split("\n");
  const offenders: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (quotedImpersonationMatches(line)) {
      offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
    }
  }
  return offenders;
}

describe("portal-preview impersonation vocabulary (DEC-747 wave-153 amendment)", () => {
  const files = WALK_DIRS.flatMap((dir) => listFiles(dir));

  it("the walked population is non-trivial and contains the known member preview.tsx (vacuous-population tripwire, DEC-180)", () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files.some((f) => f.replace(/\\/g, "/").endsWith("src/routes/portal/preview.tsx"))).toBe(true);
  });

  it("the detector fires on a fabricated impersonation title (positive control)", () => {
    const fixtureLine = '<button title="sign in as this speaker to download">Download</button>';
    expect(quotedImpersonationMatches(fixtureLine)).toBe(true);
  });

  it("the detector does not fire on 'They can sign in as soon as you do this' (negative control, PeopleRolesPanel.tsx:508)", () => {
    const fixtureLine = "subtitle={duplicateUser ? 'The address is already in use' : 'They can sign in as soon as you do this'}";
    expect(quotedImpersonationMatches(fixtureLine)).toBe(false);
  });

  it("the detector does not fire on 'Every session signed in as {revealed.email} is ended' (negative control, PeopleRolesPanel.tsx:189, a true statement about the viewer's own session)", () => {
    const fixtureLine = "Every session signed in as {revealed.email} is ended — they are signed out everywhere.";
    expect(quotedImpersonationMatches(fixtureLine)).toBe(false);
  });

  it("no file under src/routes/portal/** or app/src/pages/settings/** contains the impersonation vocabulary in a user-facing string literal", () => {
    const offenders = files.flatMap((rel) => findOffenders(rel));
    expect(offenders).toEqual([]);
  });
});
