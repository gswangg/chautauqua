// DEC-069 exit predicate, made mechanical (wave 37 task w37-b).
//
// Pure functions over the TEXT of docs/verification-log.md: parse its
// `## <date> <branch> — <scope> @ <sha>` sections (EM DASH, U+2014),
// classify each section's free-text scope onto one of the five DEC-069
// required gate slots, and grade whether each slot is currently
// satisfied at a given product sha. No exported function touches the
// filesystem or spawns a process -- that I/O lives only behind the CLI
// entry point below, matching scripts/ensure-dev-vars.ts's shape, so
// this file is trivially unit-testable against fixture strings.
//
// This script has NO npm script (wave 37 is frozen for package.json --
// it is product-bearing this wave). Invoke it directly:
//
//   npx tsx scripts/exit-predicate.ts --product-sha <sha>
//
// It reads docs/verification-log.md, resolves each section's ancestry
// against <sha> via `git merge-base --is-ancestor`, prints the graded
// table, and exits 1 unless all five slots read PASS.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface LogSection {
  header: string;
  date: string;
  branch: string;
  scope: string;
  sha: string;
  result: string | null;
  openItems: number | null;
  // DEC-069 w28 amendment's human `QUALIFYING` label. NOTE (DEC-099 w46
  // re-derivation): this field IS currently a required grading input --
  // DEC-099 w45's instrument repair (see gradePredicate below, the
  // `section.qualifying && classifyScope(...) === slot` filter) made
  // `section.qualifying === true` mandatory for a section to be a
  // candidate for any slot at all. A section without a `QUALIFYING` body
  // line -- which is every pre-w28 section in the corpus -- can never
  // decide a gate slot, by design: promoting an un-labeled section to
  // "eligible by default" would silently readmit the whole early corpus.
  qualifying: boolean;
}

const HEADER_RE = /^## (\d{4}-\d{2}-\d{2}) (\S+) — (.+) @ (\S+)\s*$/;

/**
 * Splits verification-log markdown into one LogSection per
 * `## <date> <branch> — <scope> @ <sha>` header line. Any other content
 * (malformed sub-headers, stray `## QUALIFYING (...)` lines, etc.) is
 * treated as body text of the section it falls under, never as its own
 * section -- only lines matching the DEC-068 header contract start a
 * new section.
 *
 * Within each section's body, the LAST `RESULT:` line and LAST
 * `OPEN ITEMS: <n>` line win (a section may restate them; DEC-069 says
 * "ending with exactly one line", but real sections sometimes echo the
 * value earlier in prose -- the closing line is authoritative).
 * `qualifying` is true iff a body line is exactly `QUALIFYING` (the
 * wave-28 DEC-069 amendment's label for a gate section that is
 * allow-listed non-product-bearing).
 */
export function parseLogSections(markdown: string): LogSection[] {
  const lines = markdown.split("\n");

  interface Raw {
    header: string;
    date: string;
    branch: string;
    scope: string;
    sha: string;
    bodyLines: string[];
  }

  const raws: Raw[] = [];
  let current: Raw | null = null;

  for (const line of lines) {
    const m = HEADER_RE.exec(line);
    if (m) {
      current = {
        header: line,
        date: m[1] as string,
        branch: m[2] as string,
        scope: m[3] as string,
        sha: m[4] as string,
        bodyLines: [],
      };
      raws.push(current);
    } else if (current) {
      current.bodyLines.push(line);
    }
  }

  return raws.map((r) => {
    let result: string | null = null;
    let openItems: number | null = null;
    let qualifying = false;
    for (const line of r.bodyLines) {
      const trimmed = line.trim();
      const resultMatch = /^RESULT:\s*(.+)$/.exec(trimmed);
      if (resultMatch) {
        result = (resultMatch[1] as string).trim();
      }
      const openMatch = /^OPEN ITEMS:\s*(\d+)/.exec(trimmed);
      if (openMatch) {
        openItems = Number.parseInt(openMatch[1] as string, 10);
      }
      if (trimmed === "QUALIFYING") {
        qualifying = true;
      }
    }
    return {
      header: r.header,
      date: r.date,
      branch: r.branch,
      scope: r.scope,
      sha: r.sha,
      result,
      openItems,
      qualifying,
    };
  });
}

export type RequiredScope =
  | "build-test-bundle"
  | "walkthrough"
  | "perf-smoke"
  | "spec-audit"
  | "triage-closure";

export const REQUIRED_SCOPES: readonly RequiredScope[] = [
  "build-test-bundle",
  "walkthrough",
  "perf-smoke",
  "spec-audit",
  "triage-closure",
];

/**
 * Maps a section's free-text `scope` field onto one of the five DEC-069
 * required slots. Real verification-log scopes are hand-written prose
 * ("build+test+bundle", "J1-J12 persona walkthrough", "perf-smoke",
 * "spec-audit §6/§7/§8/§9", "triage-closure confirm", ...) -- this is a
 * keyword classifier, most-specific keyword first, and returns null
 * rather than guessing when nothing matches.
 *
 * DEC-099 (w45 instrument repair): each canonical slot name must match as
 * a WHOLE TOKEN, not a bare substring -- "perf" alone (e.g. "onboarding
 * grid TIER-0 perf", "files library headshot join perf", "files library
 * perf fix") does NOT classify to perf-smoke; only an explicit
 * "perf-smoke" / "perf smoke" / "perf:smoke" / "perf_smoke" literal does
 * (DEC-099 w46 sharpening: the w45 fix already required the two-word
 * phrase, but only recognized the hyphen/space separators -- this widens
 * the separator class to also accept `:` and `_` without loosening the
 * requirement that both words appear together). Likewise
 * triage-closure/triage closure and spec-audit/spec audit require the
 * full two-word phrase, walkthrough requires the whole word, and
 * build-test-bundle requires "build" and "test" to each appear as whole
 * words. A scope naming more than one slot (e.g.
 * "build+test+bundle+walkthrough+render-sweep") is classified to
 * whichever slot's keyword is checked first below; this is a narrowing,
 * not a loss, because DEC-069 wants one qualifying section per slot and a
 * combined section can be re-used per slot by naming it distinctly in
 * future runs.
 */
export function classifyScope(scope: string): RequiredScope | null {
  const s = scope.toLowerCase();
  if (/\btriage[-\s]closure\b/.test(s)) return "triage-closure";
  if (/\bspec[-\s]audit\b/.test(s)) return "spec-audit";
  if (/\bperf[-\s:_]smoke\b/.test(s)) return "perf-smoke";
  if (/\bwalkthrough\b/.test(s)) return "walkthrough";
  if (/\bbuild\b/.test(s) && /\btest\b/.test(s)) return "build-test-bundle";
  return null;
}

export interface PredicateRow {
  slot: RequiredScope;
  status: "PASS" | "FAIL" | "VOID" | "MISSING";
  section?: LogSection;
}

/**
 * Grades each of the five DEC-069 slots against `sections` (assumed to
 * be in document order, i.e. append order -- the log is append-only).
 *
 * `isAncestor(ancestorSha, descendantSha)` answers: "is `ancestorSha` an
 * ancestor of (or equal to) `descendantSha`?", equivalent to
 * `git merge-base --is-ancestor <ancestorSha> <descendantSha>`. It is
 * used two ways here:
 *
 *   1. Ancestry validity: a section only counts toward its slot if
 *      `isAncestor(productSha, section.sha)` holds -- i.e. the tree it
 *      measured already includes the current product sha's changes.
 *      Otherwise later product code has landed since that section ran
 *      and it is stale.
 *
 *   2. Staleness among valid candidates (DEC-099 w44 instrument
 *      repair): among the ancestry-valid, verdict-bearing candidates
 *      for a slot, any candidate whose sha is a PROPER ancestor of
 *      another candidate's sha measured a strictly older tree and is
 *      discarded, even though it is individually ancestry-valid --
 *      last-appended-by-itself is not enough; a section that reran an
 *      older commit after a newer one already qualified must not win
 *      just because it appears later in the log. This is
 *      content-independent and direction-independent: it demotes a
 *      stale PASS exactly as readily as a stale FAIL.
 *
 * For every slot except triage-closure, the section's own `result`
 * line decides PASS vs FAIL (a line starting "PASS" is PASS, anything
 * else -- e.g. "FAIL — ...", "FAIL (...)" -- is FAIL). For
 * triage-closure, DEC-069 grades on `OPEN ITEMS: <n>`: n === 0 is PASS,
 * n > 0 is FAIL, no OPEN ITEMS line at all does not count as a verdict.
 *
 * Sections with no usable verdict line are skipped without deciding
 * VOID vs MISSING by themselves. Among the surviving (ancestry-valid,
 * non-stale) verdict-bearing sections for a slot, the most recent
 * (last-appended) one wins. If every verdict-bearing section for a
 * slot is ancestry-stale relative to `productSha`, the slot is VOID.
 * If no section classifies to the slot at all (or none carries a
 * verdict), the slot is MISSING.
 *
 * DEC-099 (w45 instrument repair): a section is a CANDIDATE for a slot
 * only if BOTH `section.qualifying === true` (the wave-28 amendment's
 * `QUALIFYING` label, previously parsed and discarded) AND
 * `classifyScope` maps it onto that slot as a whole-token match. A
 * section failing either test is skipped entirely -- it contributes
 * neither a PASS/FAIL verdict nor a `sawStaleVerdict` VOID -- so a
 * non-qualifying section can never decide a gate slot no matter how its
 * scope text reads.
 *
 * (DEC-099 w46 re-derivation note: `qualifying` IS a grading input here,
 * deliberately, per the w45 repair above -- not merely parsed-and-
 * discarded. This is called out explicitly because a section without the
 * `QUALIFYING` label is every pre-w28 section in the real corpus, and
 * changing this filter would silently void or readmit that entire early
 * population; see `LogSection.qualifying`'s own comment.)
 */
export function gradePredicate(
  sections: readonly LogSection[],
  productSha: string,
  isAncestor: (ancestorSha: string, descendantSha: string) => boolean,
): PredicateRow[] {
  return REQUIRED_SCOPES.map((slot) => {
    const candidates = sections
      .map((section, index) => ({ section, index }))
      .filter(({ section }) => section.qualifying && classifyScope(section.scope) === slot);

    let sawStaleVerdict = false;
    const valid: { section: LogSection; index: number; outcome: "PASS" | "FAIL" }[] = [];

    for (const { section, index } of candidates) {
      const outcome = slotOutcome(section, slot);
      if (outcome === null) continue; // no usable verdict on this section
      if (isAncestor(productSha, section.sha)) {
        valid.push({ section, index, outcome });
      } else {
        sawStaleVerdict = true;
      }
    }

    if (valid.length === 0) {
      return { slot, status: sawStaleVerdict ? "VOID" : "MISSING" } as PredicateRow;
    }

    // Discard any candidate whose sha is a proper ancestor of another
    // surviving candidate's sha -- it measured a strictly older tree.
    const survivors = valid.filter(
      (candidate) =>
        !valid.some(
          (other) =>
            other.section.sha !== candidate.section.sha &&
            isAncestor(candidate.section.sha, other.section.sha),
        ),
    );

    // Among survivors, the last-appended (highest document-order index) wins.
    const winner = survivors.reduce((best, cur) => (cur.index > best.index ? cur : best));

    return { slot, status: winner.outcome, section: winner.section };
  });
}

function slotOutcome(section: LogSection, slot: RequiredScope): "PASS" | "FAIL" | null {
  if (slot === "triage-closure") {
    if (section.openItems === null) return null;
    return section.openItems === 0 ? "PASS" : "FAIL";
  }
  if (section.result === null) return null;
  return section.result.startsWith("PASS") ? "PASS" : "FAIL";
}

export function formatPredicateTable(rows: readonly PredicateRow[]): string {
  const header = ["SLOT", "STATUS", "SHA", "HEADER"];
  const lines: string[][] = [header];
  for (const row of rows) {
    lines.push([
      row.slot,
      row.status,
      row.section?.sha ?? "-",
      row.section?.header ?? "-",
    ]);
  }
  const widths = header.map((_, col) =>
    Math.max(...lines.map((line) => (line[col] as string).length)),
  );
  return lines
    .map((line) => line.map((cell, col) => cell.padEnd(widths[col] as number)).join("  "))
    .join("\n");
}

/**
 * Maps the outcome of a single `git merge-base --is-ancestor` invocation
 * (performed by `runGitCheck`, which throws on any non-zero git exit) onto
 * a boolean ancestry verdict. Factored out of the CLI's `isAncestor` so it
 * is unit-testable without a real git subprocess (DEC-099 w46 instrument
 * repair -- see module-level history in the CLI block below for the
 * defect this replaces).
 *
 * git exit 0: ancestorSha IS an ancestor of (or equal to) descendantSha --
 * true.
 *
 * git exit 1: both shas resolved; ancestry does not hold -- false.
 *
 * git exit 128 ("Not a valid object name" or similar): one or both shas
 * are unresolvable in this checkout (e.g. an ancient verification-log
 * header sha that has aged out of packed-refs). An unresolvable sha can
 * never be PROVEN an ancestor, so this degrades to false -- loud (exactly
 * one `console.warn` naming both shas) but survivable, so the caller
 * (gradePredicate, via the CLI's cached isAncestor) still grades every
 * other slot instead of the whole run aborting before any slot is graded.
 *
 * Any other exit status (git missing, permissions failure, etc.) is a
 * genuinely unexpected failure and rethrows.
 */
export function gitAncestorResult(
  runGitCheck: () => void,
  ancestorSha: string,
  descendantSha: string,
): boolean {
  try {
    runGitCheck();
    return true;
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 1) {
      return false;
    }
    if (status === 128) {
      console.warn(
        `exit-predicate: unresolvable git object while checking ancestry of ` +
          `${ancestorSha} in ${descendantSha} -- treating as NOT an ancestor.`,
      );
      return false;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// DEC-069 wave-116 (task w5-ag): campaign exit predicate, made machine-
// derived instead of hand-derived.
//
// The v12 mobile campaign is fully instrumented by its own ratchet scan
// files (desktop/phone frame ledgers, control-font, phone-tap-target,
// phone-horizontal-overflow, phone-capability-removal, frame-citation), each
// of which already promotes its live measurement to a module-scope named
// constant for exactly this purpose (see app/src/control-font.scan.test.ts's
// own comment on CEILING). Nothing in this file used to read any of them --
// every wave the planner re-derived "what remains" by hand from prose that
// decays between waves (see docs/field-guide.md waves 114-115: three
// consecutive waves shipped plans against a red set that had already moved).
//
// This section closes that gap by DERIVING membership from source text
// rather than hand-listing file paths: it scans every git-tracked .ts file
// under test/, app/src/ and scripts/ for a line of the exact shape
//   [export ]const <NAME> = <integer>;
// and pulls out only the lines whose <NAME> is one of the campaign's known
// constant names. This is deliberately NOT a dynamic `import()` of the scan
// files: those are vitest suites that call `describe`/`it` at module scope,
// and importing them outside the vitest runner is not something to depend
// on for a gate. Reading the literal declaration text also means a
// module-local (non-exported) constant -- frame-citation.scan.test.ts's
// DESKTOP_UNRECEIPTED_CLAIM_CEILING, called out explicitly in the wave-116
// task because that scan is owned by another lane and must not be made to
// export something for our convenience -- is read exactly as reliably as an
// exported one, with no edit to that file at all.
//
// The regex requires the ENTIRE line (after optional leading whitespace) to
// be nothing but the declaration: this is what excludes the many places
// these same scan files quote their own "replacing the line: export const
// X = ${measured};" repair instructions inside template-literal error
// messages -- those lines always have more text (an interpolation, a
// trailing backtick/comma) after the semicolon, so the `\s*$` anchor never
// matches them. Anything short of finding exactly the expected shape is a
// throw, per DEC-180/DEC-808 ("a gate whose population can silently shrink
// is a hand-listed population wearing a disguise") -- there is no default
// and no skip.

export interface CampaignFile {
  readonly path: string;
  readonly content: string;
}

export interface ConstantMatch {
  readonly name: string;
  readonly path: string;
  readonly value: number;
}

const CONST_DECL_RE =
  /^[ \t]*(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*([^;\n]+);[ \t]*$/gm;

/**
 * Scans `files` for top-level `[export ]const <NAME> = <value>;` lines whose
 * NAME is in `names`, returning one ConstantMatch per such line found
 * (a name may legitimately be declared in more than one file -- see
 * CLAIMED_FLOOR below -- so this returns every hit rather than picking one).
 *
 * Throws if a matched declaration's value text is not a bare integer
 * literal (e.g. `28.5`, `${x}`, `N_ROWS.length`) -- per DEC-069 w5-ag, a
 * constant that cannot be read as a plain number must fail loudly, never be
 * silently skipped or defaulted.
 */
export function findConstantDeclarations(
  files: readonly CampaignFile[],
  names: ReadonlySet<string>,
): ConstantMatch[] {
  const matches: ConstantMatch[] = [];
  for (const file of files) {
    CONST_DECL_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CONST_DECL_RE.exec(file.content)) !== null) {
      const name = m[1] as string;
      if (!names.has(name)) continue;
      const rawValue = (m[2] as string).trim();
      if (!/^-?\d+$/.test(rawValue)) {
        throw new Error(
          `exit-predicate campaign: constant ${name} declared in ${file.path} does not parse ` +
            `as a plain integer literal (found "${rawValue}"). Fail loudly rather than guess.`,
        );
      }
      matches.push({ name, path: file.path, value: Number.parseInt(rawValue, 10) });
    }
  }
  return matches;
}

/** Throws unless `matches` (already name-filtered) has exactly one entry. */
function resolveSingle(matches: readonly ConstantMatch[], name: string): ConstantMatch {
  if (matches.length === 0) {
    throw new Error(
      `exit-predicate campaign: no declaration of ${name} was found under test/, app/src/ or ` +
        `scripts/. The campaign ratchet population may have moved or been renamed -- re-derive, ` +
        `do not restore a stale value.`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `exit-predicate campaign: ${name} was declared ${matches.length} times ` +
        `(${matches.map((m) => m.path).join(", ")}). This name is expected to be unique; an ` +
        `ambiguous constant can never safely decide a gate row.`,
    );
  }
  return matches[0] as ConstantMatch;
}

export type RatchetKind = "floor" | "ceiling";

export interface RatchetRow {
  readonly label: string;
  readonly file: string;
  readonly kind: RatchetKind;
  readonly current: number;
  readonly target: number;
  readonly remaining: number;
}

export interface CampaignVerdict {
  readonly desktopClaimed: number;
  readonly desktopDeferred: number;
  readonly desktopPopulation: number;
  readonly desktopDone: boolean;
  readonly phoneClaimed: number;
  readonly phonePopulation: number;
  readonly phoneDone: boolean;
  readonly tier2Done: boolean;
  readonly campaignDone: boolean;
}

export interface CampaignReport {
  readonly rows: readonly RatchetRow[];
  readonly verdict: CampaignVerdict;
}

/** Every constant name the campaign's exit predicate depends on. */
export const CAMPAIGN_CONSTANT_NAMES: readonly string[] = [
  "CLAIMED_FLOOR",
  "EXPECTED_TOTAL_PRE_DEVIATION",
  "EXPECTED_DEVIATION_DEFERRED",
  "EXPECTED_TOTAL",
  "CEILING",
  "ANCHOR_FLOOR_OFFENDERS_CEILING",
  "SSR_TAP_FLOOR_OFFENDERS_CEILING",
  "SSR_UNFLOORED_TOKENS_CEILING",
  "OVERFLOW_OFFENDERS_CEILING",
  "CROSS_BUNDLE_CITATION_CEILING",
  "PHONE_HIDDEN_UNRECEIPTED_CEILING",
  "DESKTOP_UNRECEIPTED_CLAIM_CEILING",
  // wave-118 (task w7-b): population made total instead of hand-listed --
  // these nine were declared in the real corpus and ungraded before this
  // change (see the DEC-069 amendment on this file's history).
  "MARKUP_PHONE_UNHIDDEN_CEILING",
  "DIVERGENCE_CEILING",
  "ORPHAN_CEILING",
  "SHADOWED_CEILING",
  "UNRECEIPTED_CLAIM_CEILING",
  "FRAME_RECEIPT_OFFENDER_CEILING",
  "UNRESOLVED_CITATION_CEILING",
  "WIDENED_UNRESOLVED_CITATION_CEILING",
  // wave-120 (task w9-l, DEC-367 PREDICATE REPAIR): the base tap-target
  // scan's `findOffenders()` drops any control rule with NO declared
  // height/min-height before ever testing it against the floor -- this
  // constant grades the population that blind spot has always hidden.
  "UNDECLARED_HEIGHT_OFFENDERS_CEILING",
  "PAINTED_CANCELLED_PADDING_CEILING",
  // wave-121 (task w10-l): cancelled-padding companion-gap lens
  // (DEC-393 amendment, DEVIATIONS.md:346-351 rider instrument).
  "CANCELLED_PADDING_GAP_CEILING",
  // wave-128 (task w3-j, DEC-976/DEC-967): frame control-label ledger --
  // grades whether the app's own source contains, verbatim, the words each
  // v12 phone frame's footer/anchor controls draw (test/frame-control-label
  // .scan.test.ts).
  "FOOTER_LABEL_CEILING",
];

/** Tier-2 ceiling constant names: campaign is done only once every one reads 0. */
const TIER2_CEILING_NAMES: readonly string[] = [
  "CEILING",
  "ANCHOR_FLOOR_OFFENDERS_CEILING",
  "SSR_TAP_FLOOR_OFFENDERS_CEILING",
  "SSR_UNFLOORED_TOKENS_CEILING",
  "OVERFLOW_OFFENDERS_CEILING",
  "CROSS_BUNDLE_CITATION_CEILING",
  "PHONE_HIDDEN_UNRECEIPTED_CEILING",
  "DESKTOP_UNRECEIPTED_CLAIM_CEILING",
  "MARKUP_PHONE_UNHIDDEN_CEILING",
  "DIVERGENCE_CEILING",
  "ORPHAN_CEILING",
  "SHADOWED_CEILING",
  "UNRECEIPTED_CLAIM_CEILING",
  "FRAME_RECEIPT_OFFENDER_CEILING",
  "UNRESOLVED_CITATION_CEILING",
  "WIDENED_UNRESOLVED_CITATION_CEILING",
  "PAINTED_CANCELLED_PADDING_CEILING",
  // wave-121 (task w10-l): cancelled-padding companion-gap lens.
  "CANCELLED_PADDING_GAP_CEILING",
  // wave-122 (task w11-s, DEC-851 amendment): docs/mobile-campaign.md's
  // Tier 2 requires the 44px sweep to cover BOTH evasion modes
  // DESIGN-RULINGS names -- a floored-but-too-short control, and a
  // control with no declared height/min-height at all, which the base
  // tap-target scan's `findOffenders()` drops before it is ever tested
  // against the floor. UNDECLARED_HEIGHT_OFFENDERS_CEILING grades the
  // second mode; it was already in CAMPAIGN_CONSTANT_NAMES (wave-120,
  // task w9-l) but never wired into TIER2_CEILING_NAMES, so it was
  // graded but never printed and never gated DONE -- a declared knob
  // with no reader (DEC-851).
  "UNDECLARED_HEIGHT_OFFENDERS_CEILING",
  // wave-128 (task w3-j): frame control-label ledger, wired into TIER2 in
  // the same commit that declared it in CAMPAIGN_CONSTANT_NAMES above --
  // never a declared-but-unread knob (DEC-851/DEC-988).
  "FOOTER_LABEL_CEILING",
];

/**
 * Names that match the `<NAME>_CEILING` / `<NAME>_FLOOR` (or bare `CEILING`)
 * shape in the real corpus but are deliberately NOT part of the v12 mobile
 * campaign's own exit predicate. Each value is a PRINCIPLE -- a fact about
 * what the constant measures that stays true with every branch name and
 * wave number deleted (DEC-099's shape) -- never a schedule note ("later
 * wave", "in flight", a branch token). `assertCampaignPopulationTotal`
 * treats any candidate name here, or in `CAMPAIGN_CONSTANT_NAMES`, as
 * accounted for; anything else is an ungraded ratchet and throws.
 */
export const OUT_OF_CAMPAIGN_SCOPE: Record<string, string> = {
  UNCLAIMED_CEILING:
    "measures tsconfig project-include coverage (every .ts/.tsx file typechecked by " +
    "some tsconfig project or a named exclusion) -- a build/typecheck-tooling health " +
    "check, not a v12 frame or DEC-069 conformance ratchet.",
  LINE_KEYED_CITATION_CEILING:
    "measures citation FORM (line-keyed vs drift-proof), an integrity property of the " +
    "decision-registry ledger's own durability -- whether a citation is written in a shape " +
    "that survives an edit to the file it points at. Citation RESOLUTION (whether a " +
    "citation is currently true) is already an exit gate under UNRESOLVED_CITATION_CEILING " +
    "and WIDENED_UNRESOLVED_CITATION_CEILING; this constant is a distinct, non-overlapping " +
    "concern from the same population, not a v12 frame or 390-geometry conformance fact.",
};

/**
 * Every `<NAME>_CEILING` / `<NAME>_FLOOR` (or bare `CEILING`) constant
 * declared as `[export ]const <NAME> = <integer>;` at top level of a
 * `*.test.ts` / `*.test.tsx` file among `files`. Derived from file CONTENT
 * only -- no fs, no assumption about which files exist beyond what is
 * passed in. Deduped and sorted; a name declared in more than one file
 * (e.g. CLAIMED_FLOOR) appears once.
 */
export function findCampaignCeilingCandidates(
  files: readonly CampaignFile[],
): readonly string[] {
  const names = new Set<string>();
  for (const file of files) {
    if (!/\.test\.tsx?$/.test(file.path)) continue;
    CONST_DECL_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CONST_DECL_RE.exec(file.content)) !== null) {
      const name = m[1] as string;
      if (name === "CEILING" || /_(CEILING|FLOOR)$/.test(name)) {
        names.add(name);
      }
    }
  }
  return Array.from(names).sort();
}

/**
 * Throws, naming every offender, if any `candidates` name is neither a
 * graded campaign constant (`CAMPAIGN_CONSTANT_NAMES`) nor an excused one
 * (`OUT_OF_CAMPAIGN_SCOPE`). Called from `buildCampaignReport` so a newly
 * declared ratchet that nobody wired into the report fails the predicate
 * loudly instead of silently never being counted (DEC-180/DEC-808).
 */
export function assertCampaignPopulationTotal(candidates: readonly string[]): void {
  const graded = new Set(CAMPAIGN_CONSTANT_NAMES);
  const excused = new Set(Object.keys(OUT_OF_CAMPAIGN_SCOPE));
  const offenders = candidates.filter((name) => !graded.has(name) && !excused.has(name));
  if (offenders.length > 0) {
    throw new Error(
      `exit-predicate campaign: ${offenders.length} ratchet constant(s) declared in the ` +
        `corpus are neither graded (CAMPAIGN_CONSTANT_NAMES) nor excused ` +
        `(OUT_OF_CAMPAIGN_SCOPE): ${offenders.join(", ")}. A gate whose population can ` +
        `silently shrink is a hand-listed population wearing a disguise -- add each name to ` +
        `one list or the other, never skip it.`,
    );
  }
}

/**
 * Closes the exit predicate's third state (DEC-851 amendment): a ceiling
 * can be a member of `CAMPAIGN_CONSTANT_NAMES` (so `assertCampaignPopulationTotal`
 * accounts for it and does not throw it as an unlisted ratchet) yet never
 * appear in `TIER2_CEILING_NAMES` (what `buildCampaignReport` turns into a
 * row, and what `verdict.tier2Done` requires to read 0) -- graded, but
 * never printed and never gating DONE.
 *
 * Every `CAMPAIGN_CONSTANT_NAMES` entry whose name is the bare `CEILING`
 * or ends `_CEILING` (a ceiling by shape) must appear in either
 * `TIER2_CEILING_NAMES` or `OUT_OF_CAMPAIGN_SCOPE` -- there is no third
 * bucket. The four ledger names (`CLAIMED_FLOOR`,
 * `EXPECTED_TOTAL_PRE_DEVIATION`, `EXPECTED_DEVIATION_DEFERRED`,
 * `EXPECTED_TOTAL`) are excluded by this same shape test, not by a
 * hand-list -- none of them is the bare word `CEILING` or ends `_CEILING`.
 *
 * Throws, naming every offender, if any graded ceiling is unrepresented in
 * both lists -- same voice as `assertCampaignPopulationTotal`.
 */
export function assertEveryGradedCeilingIsGated(
  gradedNames: readonly string[],
  tier2Names: readonly string[],
  outOfScope: Readonly<Record<string, string>>,
): void {
  const isCeilingByShape = (name: string): boolean =>
    name === "CEILING" || name.endsWith("_CEILING");
  const gated = new Set(tier2Names);
  const excused = new Set(Object.keys(outOfScope));
  const offenders = gradedNames.filter(
    (name) => isCeilingByShape(name) && !gated.has(name) && !excused.has(name),
  );
  if (offenders.length > 0) {
    throw new Error(
      `exit-predicate campaign: ${offenders.length} ceiling constant(s) are graded ` +
        `(CAMPAIGN_CONSTANT_NAMES) but neither reported (TIER2_CEILING_NAMES) nor excused ` +
        `(OUT_OF_CAMPAIGN_SCOPE): ${offenders.join(", ")}. A ceiling that is graded but never ` +
        `printed and never gates DONE is a declared knob with no reader -- add each name to ` +
        `TIER2_CEILING_NAMES or OUT_OF_CAMPAIGN_SCOPE, never leave it in the third state.`,
    );
  }
}

function ceilingRow(matches: readonly ConstantMatch[], name: string): RatchetRow {
  const m = resolveSingle(
    matches.filter((c) => c.name === name),
    name,
  );
  return {
    label: name,
    file: m.path,
    kind: "ceiling",
    current: m.value,
    target: 0,
    remaining: Math.max(m.value, 0),
  };
}

/**
 * Builds the full campaign report from already-read file contents (no fs
 * here, matching this module's "no I/O in an exported function" contract --
 * see the header comment). `files` need not be filtered to campaign files;
 * this scans all of them for the known constant names.
 *
 * CLAIMED_FLOOR is deliberately declared twice in the real corpus -- once
 * in the desktop frame ledger, once in the phone frame ledger -- so unlike
 * every other name here it is resolved as a PAIR, not a singleton: exactly
 * two declarations are required, and each is matched to its own file by
 * checking which file also declares that ledger's own population constant
 * (EXPECTED_TOTAL_PRE_DEVIATION for desktop, EXPECTED_TOTAL for phone).
 * Any other count, or a CLAIMED_FLOOR not co-located with either population
 * constant, throws rather than guessing which ledger it belongs to.
 */
export function buildCampaignReport(files: readonly CampaignFile[]): CampaignReport {
  assertCampaignPopulationTotal(findCampaignCeilingCandidates(files));
  assertEveryGradedCeilingIsGated(CAMPAIGN_CONSTANT_NAMES, TIER2_CEILING_NAMES, OUT_OF_CAMPAIGN_SCOPE);

  const names = new Set(CAMPAIGN_CONSTANT_NAMES);
  const matches = findConstantDeclarations(files, names);

  const claimedFloorMatches = matches.filter((m) => m.name === "CLAIMED_FLOOR");
  if (claimedFloorMatches.length !== 2) {
    throw new Error(
      `exit-predicate campaign: expected exactly 2 declarations of CLAIMED_FLOOR (desktop ` +
        `ledger + phone ledger), found ${claimedFloorMatches.length} ` +
        `(${claimedFloorMatches.map((m) => m.path).join(", ") || "none"}). The campaign's ` +
        `ledger topology may have changed -- re-derive, do not guess.`,
    );
  }

  const totalPreDeviation = resolveSingle(
    matches.filter((m) => m.name === "EXPECTED_TOTAL_PRE_DEVIATION"),
    "EXPECTED_TOTAL_PRE_DEVIATION",
  );
  const deviationDeferred = resolveSingle(
    matches.filter((m) => m.name === "EXPECTED_DEVIATION_DEFERRED"),
    "EXPECTED_DEVIATION_DEFERRED",
  );
  const expectedTotal = resolveSingle(
    matches.filter((m) => m.name === "EXPECTED_TOTAL"),
    "EXPECTED_TOTAL",
  );

  const desktopClaimed = claimedFloorMatches.find((m) => m.path === totalPreDeviation.path);
  if (!desktopClaimed) {
    throw new Error(
      `exit-predicate campaign: no CLAIMED_FLOOR declaration is co-located with ` +
        `EXPECTED_TOTAL_PRE_DEVIATION in ${totalPreDeviation.path} -- cannot identify the ` +
        `desktop ledger's own claim.`,
    );
  }
  const phoneClaimed = claimedFloorMatches.find((m) => m.path === expectedTotal.path);
  if (!phoneClaimed) {
    throw new Error(
      `exit-predicate campaign: no CLAIMED_FLOOR declaration is co-located with ` +
        `EXPECTED_TOTAL in ${expectedTotal.path} -- cannot identify the phone ledger's own claim.`,
    );
  }

  const desktopTarget = totalPreDeviation.value - deviationDeferred.value;
  const desktopRow: RatchetRow = {
    label: "desktop CLAIMED_FLOOR",
    file: desktopClaimed.path,
    kind: "floor",
    current: desktopClaimed.value,
    target: desktopTarget,
    remaining: Math.max(desktopTarget - desktopClaimed.value, 0),
  };
  const phoneRow: RatchetRow = {
    label: "phone CLAIMED_FLOOR",
    file: phoneClaimed.path,
    kind: "floor",
    current: phoneClaimed.value,
    target: expectedTotal.value,
    remaining: Math.max(expectedTotal.value - phoneClaimed.value, 0),
  };

  const tier2Rows = TIER2_CEILING_NAMES.map((name) => ceilingRow(matches, name));

  const rows: RatchetRow[] = [desktopRow, phoneRow, ...tier2Rows];

  const desktopDone =
    desktopClaimed.value + deviationDeferred.value >= totalPreDeviation.value;
  const phoneDone = phoneClaimed.value >= expectedTotal.value;
  const tier2Done = tier2Rows.every((row) => row.current === 0);

  const verdict: CampaignVerdict = {
    desktopClaimed: desktopClaimed.value,
    desktopDeferred: deviationDeferred.value,
    desktopPopulation: totalPreDeviation.value,
    desktopDone,
    phoneClaimed: phoneClaimed.value,
    phonePopulation: expectedTotal.value,
    phoneDone,
    tier2Done,
    campaignDone: desktopDone && phoneDone && tier2Done,
  };

  return { rows, verdict };
}

export function formatCampaignReport(report: CampaignReport): string {
  const header = ["ROW", "FILE", "CURRENT", "TARGET", "REMAINING"];
  const lines: string[][] = [header];
  for (const row of report.rows) {
    lines.push([
      row.label,
      row.file,
      String(row.current),
      String(row.target),
      String(row.remaining),
    ]);
  }
  const widths = header.map((_, col) =>
    Math.max(...lines.map((line) => (line[col] as string).length)),
  );
  const table = lines
    .map((line) => line.map((cell, col) => cell.padEnd(widths[col] as number)).join("  "))
    .join("\n");

  const v = report.verdict;
  const verdictLines = [
    `desktop: ${v.desktopClaimed} claimed + ${v.desktopDeferred} deviation-deferred ` +
      `= ${v.desktopClaimed + v.desktopDeferred} / ${v.desktopPopulation} -- ` +
      `${v.desktopDone ? "DONE" : "NOT DONE"}`,
    `phone:   ${v.phoneClaimed} / ${v.phonePopulation} -- ${v.phoneDone ? "DONE" : "NOT DONE"}`,
    `tier-2:  ${v.tier2Done ? "all ceilings at 0 -- DONE" : "one or more ceilings above 0 -- NOT DONE"}`,
    `CAMPAIGN: ${v.campaignDone ? "DONE" : "NOT DONE"}`,
  ];

  return `${table}\n\n${verdictLines.join("\n")}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const flagIdx = process.argv.indexOf("--product-sha");
  if (flagIdx === -1 || !process.argv[flagIdx + 1]) {
    throw new Error(
      "exit-predicate: usage: npx tsx scripts/exit-predicate.ts --product-sha <sha>",
    );
  }
  const productSha = process.argv[flagIdx + 1] as string;

  const REPO_ROOT = join(import.meta.dirname, "..");
  const LOG_FILE = join(REPO_ROOT, "docs", "verification-log.md");
  const markdown = readFileSync(LOG_FILE, "utf8");
  const sections = parseLogSections(markdown);

  const ancestorCache = new Map<string, boolean>();
  function isAncestor(ancestorSha: string, descendantSha: string): boolean {
    const key = `${ancestorSha}:${descendantSha}`;
    const cached = ancestorCache.get(key);
    if (cached !== undefined) return cached;
    const result = gitAncestorResult(
      () =>
        execFileSync("git", ["merge-base", "--is-ancestor", ancestorSha, descendantSha], {
          cwd: REPO_ROOT,
          stdio: "pipe",
        }),
      ancestorSha,
      descendantSha,
    );
    ancestorCache.set(key, result);
    return result;
  }

  const rows = gradePredicate(sections, productSha, isAncestor);
  console.log(formatPredicateTable(rows));
  const allPass = rows.every((r) => r.status === "PASS");

  console.log("");
  console.log("-- v12 mobile campaign (DEC-069 wave-116, machine-derived) --");
  const trackedPaths = execFileSync(
    "git",
    ["ls-files", "--", "test", "app/src", "scripts"],
    { cwd: REPO_ROOT, encoding: "utf8" },
  )
    .split("\n")
    .filter((p) => p.endsWith(".ts"));
  const campaignFiles: CampaignFile[] = trackedPaths.map((path) => ({
    path,
    content: readFileSync(join(REPO_ROOT, path), "utf8"),
  }));
  const campaignReport = buildCampaignReport(campaignFiles);
  console.log(formatCampaignReport(campaignReport));

  if (!allPass || !campaignReport.verdict.campaignDone) {
    if (!allPass) {
      console.error(
        `exit-predicate: not all five DEC-069 slots are PASS at product sha ${productSha}.`,
      );
    }
    if (!campaignReport.verdict.campaignDone) {
      console.error("exit-predicate: v12 mobile campaign is not yet DONE (see rows above).");
    }
    process.exit(1);
  }
}
