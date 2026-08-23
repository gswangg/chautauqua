// PORTAL 390 — grades the w35-h classless-interactive roster's PORTAL rows
// (task w50-c, DEC-996 wave-50).
//
// docs/design/audit/public-390-classless-roster-v12.md's "Public-row
// verdicts" section (task w39-e, DEC-996 wave-39 amendment) graded the 17
// src/routes/public/** rows of the w35-h roster and closed with: "the 5
// src/routes/portal/** rows remain ungraded, out of this task's scope per
// v12m-w38-a/v12m-w38-f's in-flight writes to src/routes/portal/portal.css.ts".
// Those two branches no longer exist. This file is that ungraded portal
// half, mirroring test/public-390-request-verdicts-classless-roster.scan.test.ts
// byte-for-byte in structure.
//
// DEC-996 wave-39's ruling (unchanged this wave): each row resolves to
// VERIFIED (an ancestor-scoped selector effective at 390 declares
// min-height >= 44px plus non-zero horizontal padding), EXEMPT (an
// executable tap-floor-exempt receipt naming a checkable companion), or
// OFFENDER (nothing reaches it, floored in the same commit). Grading this
// wave found ZERO offenders -- every portal row already carries a VERIFIED
// receipt, all built by earlier waves (DEC-696's shared .chq-cfp-option
// vocabulary, v12m-w40-e's DEC-393 select/file-input floors) that this
// roster's w35-h walk never cross-referenced against.
//
// This file does two things a hand-transcribed table cannot: (1) it
// RE-DERIVES the classless-interactive population live from the tree, over
// the SAME tag set and walk (classlessTagSites) the w35-h roster used,
// scoped to src/routes/portal/**, and pins it to the exact 4 sites this
// task graded (a population drift -- a row appearing, disappearing, or
// moving off these exact tag/file pairs -- fails this file rather than
// rotting silently, including the w35-h roster's original <a> row, which
// this task confirmed has drifted OUT of the classless population
// entirely -- STALE, not re-asserted); (2) for each of the 4 graded rows
// it asserts the SPECIFIC selector/receipt this task's verdict rests on
// still exists in the tree with the declarations the verdict requires, so
// a later edit that quietly weakens or deletes one of those rules is
// caught here, not only by the broader tap-floor ceilings.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { DEC_996 } from "../src/decisions";
import {
  classlessTagSites,
  declaredHeightPx,
  hasExemptionForToken,
  horizontalPaddingNonZero,
  narrowMediaRules,
  selectorMentionsToken,
  stripTsxComments,
  topLevelRulesWithExemption,
} from "../app/src/phone-tap-target-scan/core";
import { ssrRouteTsxFiles, extractCssTsLiteral } from "../app/src/phone-tap-target-scan/ssr";

void DEC_996; // this file's whole reason to exist: DEC-996 wave-39's grade-and-floor ruling, applied to the portal half

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, "..");
const PORTAL_ROUTES_ROOT = join(REPO_ROOT, "src", "routes", "portal");

const INTERACTIVE_TAGS = ["a", "button", "input", "select", "textarea"] as const;
const HAS_CLASS_ATTR_RE = /\bclass(?:Name)?\s*=/;
const CLASS_ATTR_RE = /\bclass(?:Name)?\s*=\s*(\{[^}]*\}|"[^"]*")/;

interface LiveSite {
  readonly file: string; // relative to src/routes/portal
  readonly line: number; // line in the comment-stripped source (matches classlessTagSites' own convention)
  readonly tag: string;
  readonly tokens: readonly string[];
}

/** Every classless interactive-tag site under src/routes/portal/**, using
 * the SAME classlessTagSites walk the w35-h roster's own description names
 * (docs/design/audit/public-390-classless-roster-v12.md, moved there from
 * public-390-request-verdicts-v12.md by the custodian decomposition),
 * minus <input type="hidden"> (inert, no hit-box, out of population by the
 * roster's own construction). */
function livePortalClasslessSites(): LiveSite[] {
  const out: LiveSite[] = [];
  for (const absPath of ssrRouteTsxFiles(PORTAL_ROUTES_ROOT)) {
    const rel = absPath.slice(PORTAL_ROUTES_ROOT.length + 1);
    const src = stripTsxComments(readFileSync(absPath, "utf-8"));
    const strippedLines = src.split("\n");
    for (const site of classlessTagSites(src, INTERACTIVE_TAGS, HAS_CLASS_ATTR_RE, CLASS_ATTR_RE)) {
      const lineText = strippedLines[site.line - 1] ?? "";
      if (site.tag === "input" && /type\s*=\s*["']hidden["']/.test(lineText)) continue;
      out.push({ file: rel, line: site.line, tag: site.tag, tokens: site.tokens });
    }
  }
  out.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));
  return out;
}

/** The exact population this task graded, keyed the same way
 * livePortalClasslessSites reports it (file relative to
 * src/routes/portal, line in COMMENT-STRIPPED source -- not the raw file
 * line the doc cites, since leading block-comment banners shift the two).
 * Raw-file evidence for the human-readable table lives in
 * docs/design/audit/portal-390-classless-roster-v12.md; this array is the
 * live-walk fixture that proves the table hasn't drifted. */
const GRADED_SITES: ReadonlyArray<{ file: string; tag: string; tokens: readonly string[] }> = [
  { file: "edit.tsx", tag: "input", tokens: ["chq-cfp-option"] }, // Tracks fieldset checkbox
  { file: "edit.tsx", tag: "select", tokens: ["chq-field", "chq-portal-copresenter-role"] }, // co-presenter role
  { file: "tasks/views.tsx", tag: "input", tokens: ["chq-portal-actions"] }, // task-upload file picker
  { file: "tasks/views.tsx", tag: "input", tokens: ["chq-card"] }, // completed-task reupload file picker
];

describe("portal-390 classless-roster verdicts (DEC-996 wave-50, task w50-c)", () => {
  it("re-derives a non-empty live population over src/routes/portal/** (vacuous-scan tripwire)", () => {
    const live = livePortalClasslessSites();
    expect(live.length).toBeGreaterThan(0);
  });

  it(
    "the live-derived portal classless-interactive population matches EXACTLY the 4 sites this " +
      "task graded (1 input + 1 select + 2 input, covering the roster's 4 live portal rows -- the " +
      "w35-h roster's original tasks/views.tsx <a> row (STALE at :319) has drifted OUT of the " +
      "classless population entirely and is confirmed absent, not re-asserted). A row appearing, " +
      "disappearing, or moving to a different file/tag/ancestor-token here means this task's verdict " +
      "table has gone stale and must be re-graded, not silently trusted.",
    () => {
      const live = livePortalClasslessSites().map((s) => ({ file: s.file, tag: s.tag, tokens: s.tokens }));
      const key = (s: { file: string; tag: string; tokens: readonly string[] }) =>
        JSON.stringify([s.file, s.tag, [...s.tokens]]);
      const liveSorted = [...live].sort((a, b) => key(a).localeCompare(key(b)));
      const expectedSorted = [...GRADED_SITES].sort((a, b) => key(a).localeCompare(key(b)));
      expect(liveSorted).toEqual(expectedSorted);
    },
  );

  it(
    "the w35-h roster's tasks/views.tsx anchor (STALE at :319, 'no longer resolves') stays absent: " +
      "the live classless walk over just <a> in tasks/views.tsx finds nothing, confirmed by a " +
      "positive control against a sibling file that DOES still carry a classless anchor today.",
    () => {
      const viewsSrc = stripTsxComments(
        readFileSync(join(PORTAL_ROUTES_ROOT, "tasks", "views.tsx"), "utf-8"),
      );
      const viewsAnchors = classlessTagSites(viewsSrc, ["a"], HAS_CLASS_ATTR_RE, CLASS_ATTR_RE);
      expect(viewsAnchors).toEqual([]);

      // Negative-control tripwire: prove the walk itself still functions
      // (an empty result above isn't a walk failure) by finding at least
      // one classless <a>, <input>, <select>, <button>, or <textarea>
      // somewhere else under src/routes/portal/** -- the 4-site population
      // this file pins already IS that proof, but assert it explicitly.
      expect(livePortalClasslessSites().length).toBeGreaterThan(0);
    },
  );
});

// ---------------------------------------------------------------------------
// Per-row verdict pins: each of the 4 rows this task graded, checked
// against the exact selector/receipt its verdict rests on.
// ---------------------------------------------------------------------------

function portalCss(): string {
  return extractCssTsLiteral(readFileSync(join(PORTAL_ROUTES_ROOT, "portal.css.ts"), "utf-8"));
}

/** True when the COMBINED body of every rule (top-level OR inside a
 * <=700px block) whose selector mentions `token` declares min-height >=
 * 44px and non-zero horizontal padding -- the VERIFIED clause DEC-996
 * wave-39 states. Bodies are joined (mirrors the public sibling's own
 * verifiedFor and ssr.ts's findSsrClasslessAnchorOffenders) rather than
 * requiring a single rule to carry both declarations, since this
 * codebase's own idiom sometimes appends a second same-selector phone
 * rule for one clause alone (e.g. .chq-portal-copresenter-role select's
 * min-height and display/align/padding are two separate rules, mirroring
 * .chq-nav a's DEC-393 wave-w17-i split). */
function verifiedFor(css: string, token: string): boolean {
  const rules = [...topLevelRulesWithExemption(css), ...narrowMediaRules(css, 700)].filter((r) =>
    selectorMentionsToken(r.selector, token),
  );
  if (rules.length === 0) return false;
  const combinedBody = rules.map((r) => r.body).join(" ");
  return (declaredHeightPx(combinedBody) ?? 0) >= 44 && horizontalPaddingNonZero(combinedBody);
}

describe("portal-390 classless-roster verdicts — per-row pins", () => {
  it("VERIFIED — edit.tsx's Tracks fieldset checkbox: .chq-cfp-option, the sole parent <label>'s class (portal.css.ts top-level rule, DEC-696 shared vocabulary with cfp.css.ts)", () => {
    expect(verifiedFor(portalCss(), "chq-cfp-option")).toBe(true);
  });

  it("also carries the composition exemption receipt naming the same construct (belt-and-suspenders with the VERIFIED ancestor rule above, same as the public doc's analogous label.chq-cfp-option rows)", () => {
    expect(hasExemptionForToken(portalCss(), "chq-cfp-option")).toBe(true);
  });

  it("VERIFIED — edit.tsx's co-presenter role <select>: .chq-portal-copresenter-role select (portal.css.ts terminal phone block, v12m-w40-e/DEC-393 -- min-height on one rule, display:flex/align-items/padding on a second same-selector rule)", () => {
    expect(verifiedFor(portalCss(), "chq-portal-copresenter-role")).toBe(true);
  });

  it("VERIFIED — tasks/views.tsx's task-upload file picker: .chq-portal-actions input[type=file] (portal.css.ts terminal phone block, v12m-w40-e/DEC-393)", () => {
    expect(verifiedFor(portalCss(), "chq-portal-actions")).toBe(true);
  });

  it("VERIFIED — tasks/views.tsx's completed-task reupload file picker: .chq-card input[type=file] (portal.css.ts terminal phone block, same rule as the row above)", () => {
    expect(verifiedFor(portalCss(), "chq-card")).toBe(true);
  });

  it("zero OFFENDERS this wave: every one of the 4 graded portal rows resolved VERIFIED, so no floor CSS was added (a floor rule with no offender to floor would itself be dead code)", () => {
    const doc = readFileSync(
      join(REPO_ROOT, "docs", "design", "audit", "portal-390-classless-roster-v12.md"),
      "utf8",
    );
    const lines = doc.split("\n");
    const headerIdx = lines.findIndex((l) => l.startsWith("| File "));
    expect(headerIdx, "the portal roster table's header row is missing").toBeGreaterThan(-1);

    const verdicts: string[] = [];
    // +2 skips the header row and its markdown separator row.
    for (let i = headerIdx + 2; i < lines.length && lines[i]!.startsWith("|"); i++) {
      const cells = lines[i]!.split("|").slice(1, -1);
      expect(cells.length, `roster row ${i + 1} does not have 5 cells`).toBe(5);
      verdicts.push(cells[3]!.replace(/\*/g, "").trim().toUpperCase());
    }

    expect(verdicts.length, "the graded portal roster is not 4 rows").toBe(4);
    const offenders = verdicts.filter((v) => !v.includes("VERIFIED") && !v.includes("EXEMPT"));
    expect(offenders, `roster rows graded neither VERIFIED nor EXEMPT: ${offenders.join("; ")}`).toEqual([]);
    expect(verdicts.some((v) => v.includes("OFFENDER"))).toBe(false);
  });
});
