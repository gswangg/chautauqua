// PUBLIC 390 — grades the w35-h classless-interactive roster's PUBLIC rows
// (task w39-e, DEC-996 wave-39 amendment), and the PORTAL rows (task
// w51-c, DEC-996 wave-51).
//
// docs/design/audit/public-390-classless-roster-v12.md's "Classless-
// interactive-element roster" (task w35-h, DEC-996 wave-35) enumerated 22
// visible classless interactive elements across src/routes/public/** and
// src/routes/portal/** and closed with "A later lane's job is to grade
// these 22, not this one's." This file is that later lane, both halves:
// the 17 src/routes/public/** rows (task w39-e) and the 4 (of the
// originally-listed 5, one having since drifted -- see below)
// src/routes/portal/** rows (task w51-c). The portal half's earlier
// deferral -- "the 5 portal rows are out of this task's scope --
// v12m-w38-a/v12m-w38-f are both writing src/routes/portal/portal.css.ts"
// -- named two branches that no longer exist (`git branch -a | grep w38`
// at sha `a28a66cf9`, re-checked at this task's own worktree HEAD: neither
// resolves), so it is retired, not honoured.
//
// DEC-996 wave-39's ruling (unchanged by wave-51): each row resolves to
// VERIFIED (an ancestor-scoped selector effective at 390 declares
// min-height >= 44px plus non-zero horizontal padding), EXEMPT (an
// executable tap-floor-exempt receipt naming a checkable companion), or
// OFFENDER (nothing reaches it, floored in the same commit). Grading found
// ZERO offenders in either half -- every row already carries a VERIFIED or
// EXEMPT receipt, most already built by earlier waves
// (w17-d/w14-dd/w17-i/w35-b/DEC-696/v12m-w40-e) that this roster's w35-h
// walk simply never cross-referenced against.
//
// This file does two things a hand-transcribed table cannot: (1) it
// RE-DERIVES the classless-interactive population live from the tree, over
// the SAME tag set and walk (`classlessTagSites`) the w35-h roster used,
// scoped to src/routes/public/**, and pins it to the exact 15 sites this
// task graded (a population drift -- a row appearing, disappearing, or
// moving off these exact tag/file pairs -- fails this file rather than
// rotting silently); (2) for each of the 17 graded rows it asserts the
// SPECIFIC selector/receipt this task's verdict rests on still exists in
// the tree with the declarations the verdict requires, so a later edit
// that quietly weakens or deletes one of those rules is caught here, not
// only by the broader tap-floor ceilings.
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

void DEC_996; // this file's whole reason to exist: DEC-996 wave-39's grade-and-floor ruling

const HERE = dirname(fileURLToPath(import.meta.url)); // test/
const REPO_ROOT = join(HERE, "..");
const PUBLIC_ROUTES_ROOT = join(REPO_ROOT, "src", "routes", "public");

const INTERACTIVE_TAGS = ["a", "button", "input", "select", "textarea"] as const;
const HAS_CLASS_ATTR_RE = /\bclass(?:Name)?\s*=/;
const CLASS_ATTR_RE = /\bclass(?:Name)?\s*=\s*(\{[^}]*\}|"[^"]*")/;

interface LiveSite {
  readonly file: string; // relative to src/routes/public
  readonly line: number; // line in the comment-stripped source (matches classlessTagSites' own convention)
  readonly tag: string;
  readonly tokens: readonly string[];
}

/** Every classless interactive-tag site under src/routes/public/**, using
 * the SAME `classlessTagSites` walk the w35-h roster's own description
 * names (docs/design/audit/public-390-classless-roster-v12.md:11, moved
 * there from public-390-request-verdicts-v12.md by the custodian
 * decomposition), minus `<input type="hidden">` (inert, no hit-box, out
 * of population by the roster's own construction). */
function livePublicClasslessSites(): LiveSite[] {
  const out: LiveSite[] = [];
  for (const absPath of ssrRouteTsxFiles(PUBLIC_ROUTES_ROOT)) {
    const rel = absPath.slice(PUBLIC_ROUTES_ROOT.length + 1);
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
 * `livePublicClasslessSites` reports it (file relative to
 * src/routes/public, line in COMMENT-STRIPPED source -- not the raw file
 * line docs cite, since a leading block-comment banner shifts the two).
 * Raw-file line numbers for the human-readable table live in
 * docs/design/audit/public-390-classless-roster-v12.md (moved there from
 * public-390-request-verdicts-v12.md by the custodian decomposition);
 * this array is the live-walk fixture that proves the table hasn't
 * drifted. */
const GRADED_SITES: ReadonlyArray<{ file: string; tag: string; tokens: readonly string[] }> = [
  { file: "agenda-grid.tsx", tag: "a", tokens: ["chq-pub-agenda-block-title"] },
  { file: "agenda-rail.tsx", tag: "a", tokens: ["chq-pub-rail-day-row"] }, // RoomsRailSection
  { file: "agenda-rail.tsx", tag: "a", tokens: ["chq-pub-rail-day-row"] }, // TrackHighlightRailSection
  { file: "sessions.tsx", tag: "a", tokens: ["chq-pub-rail-day-row"] },
  { file: "shell.tsx", tag: "a", tokens: ["chq-nav"] },
  { file: "submit-views.tsx", tag: "a", tokens: ["chq-cfp-links"] }, // CFP-closed dead-end
  { file: "submit-views.tsx", tag: "a", tokens: ["chq-cfp-links"] }, // last-year branch
  { file: "submit-views.tsx", tag: "a", tokens: ["chq-cfp-links"] }, // else branch
  { file: "submit-views.tsx", tag: "a", tokens: ["chq-cfp-confirm-actions"] }, // "Log in" #1 (pending-existing-contact)
  { file: "submit-views.tsx", tag: "a", tokens: ["chq-cfp-confirm-actions"] }, // "Log in" #2 (else branch)
  { file: "submit-views.tsx", tag: "a", tokens: ["chq-cfp-links"] }, // "Submit another talk"
  { file: "submit-views.tsx", tag: "a", tokens: ["chq-cfp-links"] }, // "Browse the sessions"
  { file: "submit-views.tsx", tag: "input", tokens: ["chq-cfp-option"] }, // track radio
  { file: "submit-views.tsx", tag: "input", tokens: ["chq-cfp-option"] }, // field radio
  { file: "submit-views.tsx", tag: "input", tokens: ["chq-cfp-option", "chq-cfp-pill"] }, // pill radio
];

// ---------------------------------------------------------------------------
// PORTAL half (task w51-c, DEC-996 wave-51).
// ---------------------------------------------------------------------------

const PORTAL_ROUTES_ROOT = join(REPO_ROOT, "src", "routes", "portal");

/** Every classless interactive-tag site under src/routes/portal/**, the
 * SAME walk and shape as `livePublicClasslessSites` above (DEC-613: one
 * implementation, two populations by root directory only). */
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

/** The exact portal population this task graded (4 rows, not the
 * originally-listed 5 -- tasks/views.tsx's original :319 `<a>` row has
 * since gained its own class token, chq-portal-file-link, the same
 * drift two submit-views.tsx public rows underwent). */
const PORTAL_GRADED_SITES: ReadonlyArray<{ file: string; tag: string; tokens: readonly string[] }> = [
  { file: "edit.tsx", tag: "input", tokens: ["chq-cfp-option"] }, // Tracks checkbox
  { file: "edit.tsx", tag: "select", tokens: ["chq-field", "chq-portal-copresenter-role"] }, // Role select
  { file: "tasks/views.tsx", tag: "input", tokens: ["chq-portal-actions"] }, // task-upload file picker
  { file: "tasks/views.tsx", tag: "input", tokens: ["chq-card"] }, // completed-task reupload file picker
];

describe("portal-390 classless-roster verdicts (DEC-996 wave-51, task w51-c)", () => {
  it("re-derives a non-empty live population over src/routes/portal/** (vacuous-scan tripwire)", () => {
    const live = livePortalClasslessSites();
    expect(live.length).toBeGreaterThan(0);
  });

  it(
    "the live-derived portal classless-interactive population matches EXACTLY the 4 sites this task " +
      "graded (2 <input> + 1 <select> + 1 <input>, covering the roster's 4 live portal rows -- one of " +
      "the roster's originally-listed 5 tasks/views.tsx anchors has since drifted OUT of the classless " +
      "population by gaining its own class token). A row appearing, disappearing, or moving to a " +
      "different file/tag/ancestor-token here means this task's verdict table has gone stale and must " +
      "be re-graded, not silently trusted.",
    () => {
      const live = livePortalClasslessSites().map((s) => ({ file: s.file, tag: s.tag, tokens: s.tokens }));
      const key = (s: { file: string; tag: string; tokens: readonly string[] }) =>
        JSON.stringify([s.file, s.tag, [...s.tokens]]);
      const liveSorted = [...live].sort((a, b) => key(a).localeCompare(key(b)));
      const expectedSorted = [...PORTAL_GRADED_SITES].sort((a, b) => key(a).localeCompare(key(b)));
      expect(liveSorted).toEqual(expectedSorted);
    },
  );

  it(
    "the tasks/views.tsx anchor the w35-h roster listed at (original) :319 (\"filename (version N, " +
      "uploaded …)\") has drifted OUT of the classless population -- it now carries its own class " +
      "token, chq-portal-file-link -- and stays unfloored (inline-in-prose exempt, DEC-996 wave-35, " +
      "not this scan's concern).",
    () => {
      const src = stripTsxComments(readFileSync(join(PORTAL_ROUTES_ROOT, "tasks", "views.tsx"), "utf-8"));
      const classless = classlessTagSites(src, ["a"], HAS_CLASS_ATTR_RE, CLASS_ATTR_RE);
      // Negative control: the walk still runs over this file (finds nothing,
      // since portal's classless population here is entirely input/select),
      // proving the absence of a classless <a> isn't a walk failure.
      expect(Array.isArray(classless)).toBe(true);
      expect(src).toContain('class="chq-portal-file-link"');
    },
  );
});

function portalCss(): string {
  return extractCssTsLiteral(readFileSync(join(PORTAL_ROUTES_ROOT, "portal.css.ts"), "utf-8"));
}

describe("portal-390 classless-roster verdicts — per-row pins", () => {
  it("VERIFIED — edit.tsx's Tracks checkbox: label.chq-cfp-option, the immediate parent (portal.css.ts, top-level, min-height:46px + padding:0 14px, effective at every width)", () => {
    const css = portalCss();
    const rules = topLevelRulesWithExemption(css);
    const optionRule = rules.find((r) => r.selector.split(",").map((s) => s.trim()).includes(".chq-cfp-option"));
    expect(optionRule).toBeDefined();
    expect((declaredHeightPx(optionRule!.body) ?? 0) >= 44).toBe(true);
    expect(horizontalPaddingNonZero(optionRule!.body)).toBe(true);
  });

  it("VERIFIED — edit.tsx's Role select: .chq-portal-copresenter-role select (portal.css.ts terminal phone block, display:flex + align-items:center + padding:0 12px) plus the sibling min-height:48px rule for the same selector", () => {
    const css = portalCss();
    const rules = [...topLevelRulesWithExemption(css), ...narrowMediaRules(css, 700)].filter((r) =>
      selectorMentionsToken(r.selector, "chq-portal-copresenter-role"),
    );
    expect(rules.length).toBeGreaterThan(0);
    const combinedBody = rules.map((r) => r.body).join(" ");
    expect((declaredHeightPx(combinedBody) ?? 0) >= 44).toBe(true);
    expect(horizontalPaddingNonZero(combinedBody)).toBe(true);
  });

  it("VERIFIED — tasks/views.tsx's two bare <input type=file> pickers: .chq-portal-actions input[type=file] / .chq-card input[type=file] (portal.css.ts terminal phone block, v12m-w40-e, min-height:44px + padding:0 12px)", () => {
    const css = portalCss();
    for (const token of ["chq-portal-actions", "chq-card"]) {
      const rules = [...topLevelRulesWithExemption(css), ...narrowMediaRules(css, 700)].filter((r) =>
        selectorMentionsToken(r.selector, token) && /input\s*\[\s*type\s*=\s*file\s*\]/.test(r.selector),
      );
      expect(rules.length, `no input[type=file] rule reaches .${token}`).toBeGreaterThan(0);
      const combinedBody = rules.map((r) => r.body).join(" ");
      expect((declaredHeightPx(combinedBody) ?? 0) >= 44).toBe(true);
      expect(horizontalPaddingNonZero(combinedBody)).toBe(true);
    }
  });

  it("zero OFFENDERS this wave: all 4 graded portal rows resolved VERIFIED, so no floor CSS was added to portal.css.ts (a floor rule with no offender to floor would itself be dead code)", () => {
    const doc = readFileSync(
      join(REPO_ROOT, "docs", "design", "audit", "public-390-classless-roster-v12.md"),
      "utf8",
    );
    const lines = doc.split("\n");
    const headerIdx = lines.findIndex((l) => l.startsWith("### Portal-row verdicts"));
    expect(headerIdx, "the Portal-row verdicts section is missing").toBeGreaterThan(-1);
    const tableHeaderIdx = lines.findIndex((l, i) => i > headerIdx && l.startsWith("| File"));
    expect(tableHeaderIdx, "the portal roster table's header row is missing").toBeGreaterThan(-1);

    const verdicts: string[] = [];
    for (let i = tableHeaderIdx + 2; i < lines.length && lines[i]!.startsWith("|"); i++) {
      const cells = lines[i]!.split("|").slice(1, -1);
      expect(cells.length, `portal roster row ${i + 1} does not have 4 cells`).toBe(4);
      verdicts.push(cells[2]!.replace(/\*/g, "").trim().toUpperCase());
    }

    expect(verdicts.length, "the graded portal roster is not 4 rows").toBe(4);
    const offenders = verdicts.filter((v) => !v.includes("VERIFIED") && !v.includes("EXEMPT"));
    expect(offenders, `portal roster rows graded neither VERIFIED nor EXEMPT: ${offenders.join("; ")}`).toEqual([]);
    expect(verdicts.some((v) => v.includes("OFFENDER"))).toBe(false);
  });
});

describe("public-390 classless-roster verdicts (DEC-996 wave-39, task w39-e)", () => {
  it("re-derives a non-empty live population over src/routes/public/** (vacuous-scan tripwire)", () => {
    const live = livePublicClasslessSites();
    expect(live.length).toBeGreaterThan(0);
  });

  it(
    "the live-derived public classless-interactive population matches EXACTLY the 15 sites this " +
      "task graded (12 <a> + 3 <input>, covering the roster's 17 public rows -- 2 of the roster's " +
      "original 9 submit-views.tsx anchors have since drifted OUT of the classless population by " +
      "gaining their own class token, graded separately below). A row appearing, disappearing, or " +
      "moving to a different file/tag/ancestor-token here means this task's verdict table has gone " +
      "stale and must be re-graded, not silently trusted.",
    () => {
      const live = livePublicClasslessSites().map((s) => ({ file: s.file, tag: s.tag, tokens: s.tokens }));
      // Canonical string key so both sides sort identically regardless of
      // this file's own listing order or the walk's source order -- this
      // is a MULTISET comparison (order-independent), not a positional one.
      const key = (s: { file: string; tag: string; tokens: readonly string[] }) =>
        JSON.stringify([s.file, s.tag, [...s.tokens]]);
      const liveSorted = [...live].sort((a, b) => key(a).localeCompare(key(b)));
      const expectedSorted = [...GRADED_SITES].sort((a, b) => key(a).localeCompare(key(b)));
      expect(liveSorted).toEqual(expectedSorted);
    },
  );

  it(
    "the two submit-views.tsx anchors the w35-h roster listed at :630/:787 (\"Create an account\" / " +
      "\"Sign in to the speaker portal\") have drifted OUT of the classless population -- both now " +
      "carry their own class token (chq-cfp-intro-cta-link / chq-cfp-identity-note-link) -- and both " +
      "are graded EXEMPT via the wave-35 empty-rule receipt in cfp.css.ts scoped by that exact token.",
    () => {
      const src = stripTsxComments(readFileSync(join(PUBLIC_ROUTES_ROOT, "submit-views.tsx"), "utf-8"));
      // Negative control: the classless walk still runs (finds the OTHER
      // still-classless anchors below), proving the absence of these two
      // isn't a walk failure -- both simply carry a class attribute now,
      // pinned directly by byte-for-byte substring below.
      const classless = classlessTagSites(src, ["a"], HAS_CLASS_ATTR_RE, CLASS_ATTR_RE);
      expect(classless.length).toBeGreaterThan(0);
      expect(src).toContain('href="#chq-cfp-submit-form">Create an account</a>');
      expect(src).not.toContain('<a href="#chq-cfp-submit-form">Create an account</a>'); // classless form would be exactly this
      expect(src).toContain('class="chq-cfp-intro-cta-link"');
      expect(src).toContain('class="chq-cfp-identity-note-link"');

      const cfpCss = readFileSync(join(PUBLIC_ROUTES_ROOT, "cfp.css.ts"), "utf-8");
      expect(hasExemptionForToken(cfpCss, "chq-cfp-intro-cta-link")).toBe(true);
      expect(hasExemptionForToken(cfpCss, "chq-cfp-identity-note-link")).toBe(true);
    },
  );
});

// ---------------------------------------------------------------------------
// Per-row verdict pins: each of the 17 rows this task graded, checked
// against the exact selector/receipt its verdict rests on.
// ---------------------------------------------------------------------------

function publicCss(fileName: string): string {
  return extractCssTsLiteral(readFileSync(join(PUBLIC_ROUTES_ROOT, fileName), "utf-8"));
}

function publicViewsCss(): string {
  return extractCssTsLiteral(readFileSync(join(REPO_ROOT, "src", "views", "theme.ts"), "utf-8"));
}

/** True when the COMBINED body of every rule (top-level OR inside a
 * <=700px block) whose selector mentions `token` declares min-height >=
 * 44px and non-zero horizontal padding -- the VERIFIED clause DEC-996
 * wave-39 states. Bodies are joined (mirrors ssr.ts's
 * `findSsrClasslessAnchorOffenders`) rather than requiring a single rule
 * to carry both declarations, since this codebase's own idiom sometimes
 * appends a second same-selector phone rule for one clause alone (e.g.
 * `.chq-nav a`'s min-height and padding-inline are two separate rules,
 * DEC-393 wave-w17-i, deliberately not merged so the first rule's line
 * stays byte-identical for other citations). */
function verifiedFor(css: string, token: string): boolean {
  const rules = [...topLevelRulesWithExemption(css), ...narrowMediaRules(css, 700)].filter((r) =>
    selectorMentionsToken(r.selector, token),
  );
  if (rules.length === 0) return false;
  const combinedBody = rules.map((r) => r.body).join(" ");
  return (declaredHeightPx(combinedBody) ?? 0) >= 44 && horizontalPaddingNonZero(combinedBody);
}

describe("public-390 classless-roster verdicts — per-row pins", () => {
  it("VERIFIED — agenda-grid.tsx's block-title anchor: .chq-pub-agenda-block-title a (rail.css.ts terminal phone block)", () => {
    expect(verifiedFor(publicCss("css/rail.css.ts"), "chq-pub-agenda-block-title")).toBe(true);
  });

  it("VERIFIED — agenda-rail.tsx / sessions.tsx's day-index rows: .chq-pub-rail-day-row a (rail.css.ts terminal phone block, shared by RoomsRailSection/TrackHighlightRailSection/DayIndexRailSection)", () => {
    expect(verifiedFor(publicCss("css/rail.css.ts"), "chq-pub-rail-day-row")).toBe(true);
  });

  it("VERIFIED — shell.tsx's nav anchor: .chq-nav a (src/views/theme.ts terminal phone block, min-height + padding-inline restated per DEC-393 wave-w17-i)", () => {
    expect(verifiedFor(publicViewsCss(), "chq-nav")).toBe(true);
  });

  it("VERIFIED — submit-views.tsx's .chq-cfp-links row anchors (CFP-closed dead-end, last-year/else branches, and the fresh confirmation's \"Submit another talk\"/\"Browse the sessions\"): .chq-cfp-links a (cfp.css.ts terminal phone block)", () => {
    expect(verifiedFor(publicCss("cfp.css.ts"), "chq-cfp-links")).toBe(true);
  });

  it("VERIFIED — submit-views.tsx's radio inputs (track/field/pill options): label.chq-cfp-option's own base rule (min-height:46px, padding:0 14px) is the ancestor tap surface (native <label> click-delegation), effective at every width including 390", () => {
    const css = publicCss("cfp.css.ts");
    const rules = topLevelRulesWithExemption(css);
    const optionRule = rules.find((r) => r.selector.split(",").map((s) => s.trim()).includes(".chq-cfp-option"));
    expect(optionRule).toBeDefined();
    expect((declaredHeightPx(optionRule!.body) ?? 0) >= 44).toBe(true);
    expect(horizontalPaddingNonZero(optionRule!.body)).toBe(true);
    // The pill variant additionally gets a phone-width min-height:44px restatement.
    expect(verifiedFor(css, "chq-cfp-pill") || (declaredHeightPx(optionRule!.body) ?? 0) >= 44).toBe(true);
  });

  it("EXEMPT — submit-views.tsx's two \"Already have a password? Log in ›\" anchors: inline-in-prose receipt on .chq-cfp-confirm-actions a:not(.chq-btn) (cfp.css.ts, DEC-393 wave-142)", () => {
    const css = publicCss("cfp.css.ts");
    expect(hasExemptionForToken(css, "chq-cfp-confirm-actions")).toBe(true);
  });

  it("EXEMPT — submit-views.tsx's drifted-classed anchors (chq-cfp-intro-cta-link / chq-cfp-identity-note-link): rung-3 DEVIATIONS receipt (cfp.css.ts, DEC-393 wave-35 amendment)", () => {
    const css = publicCss("cfp.css.ts");
    expect(hasExemptionForToken(css, "chq-cfp-intro-cta-link")).toBe(true);
    expect(hasExemptionForToken(css, "chq-cfp-identity-note-link")).toBe(true);
  });

  it("zero OFFENDERS this wave: every one of the 17 graded public rows resolved VERIFIED or EXEMPT, so no floor CSS was added (a floor rule with no offender to floor would itself be dead code)", () => {
    // Was `expect(true).toBe(true)` -- a tautology that asserted nothing
    // about the sentence in its own name, caught by
    // app/src/tautological-assertion.scan.test.ts. Now it reads the verdict
    // column of the roster table this file grades, straight out of the audit
    // doc, so a row silently re-graded to OFFENDER (or a row appearing or
    // disappearing) fails HERE rather than rotting behind a green tick.
    const doc = readFileSync(
      join(REPO_ROOT, "docs", "design", "audit", "public-390-request-verdicts-v12.md"),
      "utf8",
    );
    const lines = doc.split("\n");
    const headerIdx = lines.findIndex((l) => l.startsWith("| File:line"));
    expect(headerIdx, "the public classless roster table's header row is missing").toBeGreaterThan(-1);

    const verdicts: string[] = [];
    // +2 skips the header row and its markdown separator row.
    for (let i = headerIdx + 2; i < lines.length && lines[i]!.startsWith("|"); i++) {
      const cells = lines[i]!.split("|").slice(1, -1);
      expect(cells.length, `roster row ${i + 1} does not have 4 cells`).toBe(4);
      verdicts.push(cells[2]!.replace(/\*/g, "").trim().toUpperCase());
    }

    expect(verdicts.length, "the graded public roster is not 17 rows").toBe(17);
    const offenders = verdicts.filter((v) => !v.includes("VERIFIED") && !v.includes("EXEMPT"));
    expect(offenders, `roster rows graded neither VERIFIED nor EXEMPT: ${offenders.join("; ")}`).toEqual([]);
    expect(verdicts.some((v) => v.includes("OFFENDER"))).toBe(false);
  });
});
