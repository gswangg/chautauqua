// DEC-069 wave-116 (task w5-ag): campaign exit predicate, made machine-
// derived instead of hand-derived.
//
// Extracted from scripts/exit-predicate.ts (custodian decomposition,
// contention-hotspot split -- NO behavior change; see that file's header
// for the module's overall shape). This half holds the campaign grading
// machinery: constant-declaration discovery over the real corpus,
// population-completeness assertions against
// scripts/exit-predicate/campaign-scope.ts's registries, and the
// report-building/formatting functions.
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

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CAMPAIGN_CONSTANT_NAMES,
  OUT_OF_CAMPAIGN_SCOPE,
  PARKED_FIDELITY_PROMISES,
  type ParkedFidelityPromise,
  TIER2_CEILING_NAMES,
} from "./campaign-scope";

export interface CampaignFile {
  readonly path: string;
  readonly content: string;
}

export interface ConstantMatch {
  readonly name: string;
  readonly path: string;
  readonly value: number;
}

/**
 * Reads the real campaign corpus off disk: every git-tracked `.ts` file
 * under `test/`, `app/src/` or `scripts/`, rooted at `repoRoot`. This is
 * the ONE enumerator `main()` uses to build the corpus it feeds
 * `buildCampaignReport` -- DEC-613 forbids a second copy of this walk, so
 * anything (including tests) that needs the real corpus must call this
 * function rather than re-deriving the git-ls-files/path-filter/read shape
 * itself. Unlike every other exported function in this module's campaign
 * section, this one DOES do I/O (git + fs) by design -- it is the seam
 * between the pure grading functions below and the real tree.
 */
export function loadCampaignFiles(repoRoot: string): CampaignFile[] {
  const trackedPaths = execFileSync(
    "git",
    ["ls-files", "--", "test", "app/src", "scripts"],
    { cwd: repoRoot, encoding: "utf8" },
  )
    .split("\n")
    .filter((p) => p.endsWith(".ts"));
  return trackedPaths.map((path) => ({
    path,
    content: readFileSync(join(repoRoot, path), "utf8"),
  }));
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
  // wave-132 (task w7-e, instrument integrity repair): the ceiling table
  // is parsed out of DECLARED constants, never a live measurement -- see
  // formatCampaignReport's DECLARED column and legend line. This field
  // records the sha (if any) at which the fast-tier suite was last run
  // green, as supplied by the caller (never discovered by this pure
  // function -- see buildCampaignReport's SuiteEvidence parameter).
  // campaignDone must never be true without it.
  readonly suiteVerifiedAtSha: string | null;
  // wave-137 (task w12-hh, DEC-069 amendment): the SAME ancestry check
  // `campaignDone` already requires (suiteVerifiedAtSha !== null AND it is
  // an ancestor of productSha), exposed as its own field so
  // `formatCampaignReport` can degrade the desktop/phone/tier-2 row prose
  // off it without recomputing a second copy of the check (DEC-613) --
  // and without weakening it to a bare null-check, which would let a
  // stale suite-verified sha (one that does NOT contain the graded
  // product sha's changes) still print DONE on the row text even though
  // `campaignDone` itself correctly reads false.
  readonly suiteVerified: boolean;
  readonly campaignDone: boolean;
}

/**
 * Evidence that the fast-tier suite (`npm run test:fast`) has been run
 * green at a given sha, supplied by the caller -- this module performs no
 * process spawning and discovers nothing about test results on its own
 * (wave-132, task w7-e). `isAncestor` is the SAME predicate shape
 * `gradePredicate` takes for its five DEC-069 slots (see that function's
 * doc comment): "is `ancestorSha` an ancestor of (or equal to)
 * `descendantSha`?". `campaignDone` requires `suiteVerifiedAtSha !== null`
 * AND `isAncestor(productSha, suiteVerifiedAtSha)` -- i.e. the verified
 * tree already contains every change in the product sha being graded.
 */
export interface SuiteEvidence {
  readonly productSha: string;
  readonly suiteVerifiedAtSha: string | null;
  readonly isAncestor: (ancestorSha: string, descendantSha: string) => boolean;
}

export interface CampaignReport {
  readonly rows: readonly RatchetRow[];
  readonly verdict: CampaignVerdict;
}


/**
 * Every `<NAME>_CEILING` / `<NAME>_FLOOR` (or bare `CEILING`) constant
 * declared as `[export ]const <NAME> = <integer>;` on its own line of a
 * `*.test.ts` / `*.test.tsx` file among `files` -- AT ANY INDENTATION, not
 * only true top level. `CONST_DECL_RE` matches leading whitespace (`^[ \t]*`)
 * on purpose: a declaration nested inside a `describe(...)` block is found
 * exactly like one at the file's own top level (DEC-808 wave-32 amendment).
 * Narrowing this to genuine top-level-only would mint a hiding place for a
 * future ratchet -- nest it one `describe` deeper and it stops being
 * registered. Derived from file CONTENT only -- no fs, no assumption about
 * which files exist beyond what is passed in. Deduped and sorted; a name
 * declared in more than one file (e.g. CLAIMED_FLOOR) appears once.
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
 *
 * DEC-069 wave-42 amendment: `OUT_OF_CAMPAIGN_SCOPE` membership is no
 * longer a legitimate discharge for a name that is a REAL member of
 * `CAMPAIGN_CONSTANT_NAMES` (the module's own registry, not whatever
 * synthetic `gradedNames` a caller passes) -- a graded ceiling belonging to
 * both lists was previously excused into silence
 * (TAP_FLOOR_EXEMPT_UNVERIFIABLE_PREMISE_CEILING, printed by no row while
 * simultaneously claimed as campaign-gating). This check is scoped to the
 * real registry, not the `gradedNames`/`outOfScope` parameters, so the
 * function's existing synthetic-fixture unit tests (which use ceiling
 * names no real registry contains) keep their present behaviour.
 */
export function assertEveryGradedCeilingIsGated(
  gradedNames: readonly string[],
  tier2Names: readonly string[],
  outOfScope: Readonly<Record<string, string>>,
): void {
  const isCeilingByShape = (name: string): boolean =>
    name === "CEILING" || name.endsWith("_CEILING");
  const gated = new Set(tier2Names);
  const realCampaignMembers = new Set(CAMPAIGN_CONSTANT_NAMES);
  const excused = new Set(
    Object.keys(outOfScope).filter((name) => !realCampaignMembers.has(name)),
  );
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

/**
 * DEC-069 wave-36 promotion rule for `OUT_OF_CAMPAIGN_SCOPE` fidelity
 * ceilings, discharged as CODE wave-37 (task w37-c): a parked ceiling is
 * promotable once (a) its own measured count is 0 AND (b) its
 * instrument-completeness sibling either measures 0 or is recorded (via
 * `campaign-scope.ts`'s `PARKED_FIDELITY_PROMISES`) as fully, individually
 * row-adjudicated in its own audit doc -- never a bucketed reason-category
 * count standing in for one. `sibling === null` means the promise names no
 * completeness-sibling ceiling at all; clause (b) is then vacuously true and
 * clause (a) alone decides it.
 */
export function isParkedFidelityPromisePromotable(
  ownValue: number,
  sibling: { readonly value: number } | null,
  siblingFullyAdjudicated: boolean,
): boolean {
  if (ownValue !== 0) return false;
  if (sibling === null) return true;
  return sibling.value === 0 || siblingFullyAdjudicated;
}

const PROMOTION_PROMISE_RE = /is promoted (?:once|by)/;

/**
 * Throws if `outOfScope` carries a promotion-promise sentence ("it measures
 * fidelity now and is promoted once/by ...") with no `promises` entry behind
 * it -- DEC-069 wave-36's exact loophole, a promise with no rule -- OR if a
 * registered `promises` entry's real, live evidence (read from `files` via
 * `findConstantDeclarations`, never a hardcoded value in this module per
 * DEC-180) now clears both promotion clauses while its ceiling is still
 * sitting in `outOfScope` rather than `CAMPAIGN_CONSTANT_NAMES`/
 * `TIER2_CEILING_NAMES` -- a passing promise left unpaid.
 */
export function assertParkedPromisesAreHonestlyParked(
  files: readonly CampaignFile[],
  outOfScope: Readonly<Record<string, string>>,
  promises: Readonly<Record<string, ParkedFidelityPromise>>,
): void {
  const promising = Object.keys(outOfScope).filter((name) =>
    PROMOTION_PROMISE_RE.test(outOfScope[name] as string),
  );
  const missingRule = promising.filter((name) => !(name in promises));
  if (missingRule.length > 0) {
    throw new Error(
      `exit-predicate campaign: ${missingRule.length} OUT_OF_CAMPAIGN_SCOPE entry(ies) carry a ` +
        `promotion promise ("is promoted once/by ...") with no PARKED_FIDELITY_PROMISES entry ` +
        `behind it -- a promise with no rule (DEC-069 wave-36): ${missingRule.join(", ")}.`,
    );
  }

  const namesToRead = new Set<string>();
  for (const [name, promise] of Object.entries(promises)) {
    namesToRead.add(name);
    if (promise.siblingName !== null) namesToRead.add(promise.siblingName);
  }
  const matches = findConstantDeclarations(files, namesToRead);

  const promotable: string[] = [];
  for (const [name, promise] of Object.entries(promises)) {
    const own = resolveSingle(
      matches.filter((m) => m.name === name),
      name,
    );
    const sibling =
      promise.siblingName === null
        ? null
        : {
            value: resolveSingle(
              matches.filter((m) => m.name === promise.siblingName),
              promise.siblingName,
            ).value,
          };
    if (isParkedFidelityPromisePromotable(own.value, sibling, promise.siblingFullyAdjudicated)) {
      promotable.push(name);
    }
  }
  if (promotable.length > 0) {
    throw new Error(
      `exit-predicate campaign: ${promotable.length} parked fidelity ceiling(s) now clear both ` +
        `DEC-069 wave-36 promotion clauses (own count 0, sibling clean or fully row-adjudicated) ` +
        `but are still sitting in OUT_OF_CAMPAIGN_SCOPE -- promote each into ` +
        `CAMPAIGN_CONSTANT_NAMES and TIER2_CEILING_NAMES, don't leave a passing promise unpaid: ` +
        `${promotable.join(", ")}.`,
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
export function buildCampaignReport(
  files: readonly CampaignFile[],
  suiteEvidence: SuiteEvidence,
): CampaignReport {
  assertCampaignPopulationTotal(findCampaignCeilingCandidates(files));
  assertEveryGradedCeilingIsGated(CAMPAIGN_CONSTANT_NAMES, TIER2_CEILING_NAMES, OUT_OF_CAMPAIGN_SCOPE);
  assertParkedPromisesAreHonestlyParked(files, OUT_OF_CAMPAIGN_SCOPE, PARKED_FIDELITY_PROMISES);

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

  const { productSha, suiteVerifiedAtSha, isAncestor } = suiteEvidence;
  const suiteVerified =
    suiteVerifiedAtSha !== null && isAncestor(productSha, suiteVerifiedAtSha);

  const verdict: CampaignVerdict = {
    desktopClaimed: desktopClaimed.value,
    desktopDeferred: deviationDeferred.value,
    desktopPopulation: totalPreDeviation.value,
    desktopDone,
    phoneClaimed: phoneClaimed.value,
    phonePopulation: expectedTotal.value,
    phoneDone,
    tier2Done,
    suiteVerifiedAtSha,
    suiteVerified,
    campaignDone: desktopDone && phoneDone && tier2Done && suiteVerified,
  };

  return { rows, verdict };
}

/**
 * wave-132 (task w7-e, instrument integrity repair): the ceiling table's
 * third column used to be labeled CURRENT, inviting the misreading that it
 * is a live measurement. It is not -- `ceilingRow`/`buildCampaignReport`
 * only ever parse the `[export ]const <NAME> = <integer>;` declaration text
 * out of the owning scan file; nothing here re-runs that scan. Renamed to
 * DECLARED, with a legend line spelling out the distinction, so a reader
 * cannot mistake a stale-but-green-looking declaration for a fresh run.
 *
 * wave-137 (task w12-hh, DEC-069 amendment): the DECLARED-vs-measured
 * caveat above described the ROW TABLE, but the desktop/phone verdict
 * lines below it kept printing the word DONE unconditionally -- computed
 * straight off the same DECLARED constants, with no dependence on whether
 * the fast-tier suite had ever been run against this tree. Only the
 * tier-2 line degraded to "DECLARED ONLY -- NOT MEASURED" when
 * `suiteVerifiedAtSha` was null; a reader who trusted the desktop/phone
 * rows and never reached the `CAMPAIGN:` verdict line below could walk
 * away believing the campaign was done from two rows that were, in fact,
 * exactly as unverified as the tier-2 row already knew to admit. This
 * degrades ALL THREE rows uniformly off the SAME `suiteVerified` boolean
 * `buildCampaignReport` already computes (DEC-613: no second copy of that
 * ancestry check lives here) -- the word DONE now appears on no row at
 * all unless the fast-tier suite has been verified green at an ancestor
 * of the sha being graded. `campaignDone` and its inputs are unchanged;
 * this repairs only the prose that describes them.
 */
export function formatCampaignReport(report: CampaignReport): string {
  const header = ["ROW", "FILE", "DECLARED", "TARGET", "REMAINING"];
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
  // w16-ff (wave-141, DEC-069 instrument repair): this legend used to spell
  // out the literal word DONE in its own prose ("none of them can print
  // DONE without..."), so it printed that token unconditionally on every
  // report regardless of suiteVerified -- defeating the very degrade this
  // function performs on the verdict lines below. Reworded to describe the
  // same invariant without ever emitting the bare token.
  const legend =
    "DECLARED is what the constant SAYS, never what the tree measures -- " +
    "re-measure by running the owning test. Every row verdict below (desktop, " +
    "phone, tier-2) is only as trustworthy as the last fast-tier suite run: " +
    "each one stays undecided, printing DECLARED ONLY -- NOT MEASURED, unless " +
    "a --suite-verified-sha that is an ancestor of the graded product sha was " +
    "supplied.";

  const v = report.verdict;
  const suiteVerified = v.suiteVerified;
  const desktopLine = suiteVerified
    ? `desktop: ${v.desktopClaimed} claimed + ${v.desktopDeferred} deviation-deferred ` +
      `= ${v.desktopClaimed + v.desktopDeferred} / ${v.desktopPopulation} -- ` +
      `${v.desktopDone ? "DONE" : "NOT DONE"}`
    : "desktop: DECLARED ONLY -- NOT MEASURED";
  const phoneLine = suiteVerified
    ? `phone:   ${v.phoneClaimed} / ${v.phonePopulation} -- ${v.phoneDone ? "DONE" : "NOT DONE"}`
    : "phone:   DECLARED ONLY -- NOT MEASURED";
  const tier2Line = suiteVerified
    ? `tier-2:  ${v.tier2Done ? "all ceilings at 0 -- DONE" : "one or more ceilings above 0 -- NOT DONE"}`
    : "tier-2:  DECLARED ONLY -- NOT MEASURED";
  // w14-aa (wave-139): the CAMPAIGN row carried the bare word DONE as a
  // substring of "NOT DONE" even with no evidence at all, so it degrades too.
  // Its guard is deliberately the WEAKER `suiteVerifiedAtSha === null` rather
  // than `suiteVerified`: with a STALE verified sha (non-null but not an
  // ancestor) `campaignDone` is already false, so "CAMPAIGN: NOT DONE" is a
  // true statement, not an unmeasured claim -- whereas the three ledger rows
  // above would be asserting counts they cannot back, which is why they use
  // the ancestry-aware `suiteVerified`.
  const campaignLine =
    v.suiteVerifiedAtSha === null
      ? "CAMPAIGN: DECLARED ONLY -- NOT MEASURED"
      : `CAMPAIGN: ${v.campaignDone ? "DONE" : "NOT DONE"}`;
  const verdictLines = [desktopLine, phoneLine, tier2Line, campaignLine];

  return `${table}\n${legend}\n\n${verdictLines.join("\n")}`;
}
