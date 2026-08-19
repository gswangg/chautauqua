// DEC-518 (wave-39 amendment): "a rendered whole-set count comes off the
// envelope -- an enumerated, two-directional SPA ledger with named
// exclusions." Two independent surfaces were caught reporting a page as the
// whole (ReviewerQueue.tsx's "N left to score" derived from res.items after
// the server clamped to 200; MergePage.tsx's pair total reported as
// res.items.length). This is DEC-518's own discipline applied to that
// family: population re-derived from source at test time (every non-test
// module under app/src/pages/** calling apiList against a paged list
// endpoint -- apiList<T> always targets one, by its ListEnvelope<T> return
// type; app/src/lib/api.ts's own jsdoc distinguishes it from apiGet<T>,
// which returns T, not an envelope), ledger asserted exact in both
// directions, exported pure classifier, negative controls.
//
// EXCLUDED from this ledger's population (named per DEC-518's own honesty
// rule -- an exclusion is a word in the prose, not a silent omission):
//   - app/src/pages/review/ReviewerQueue.tsx -- owned by wave-38 task c
// It is asserted present in the RAW (unfiltered) scan below, so a future
// rename that makes it stop calling apiList (or a revert that un-excludes
// it) is caught rather than silently drifting.
//
// OUT OF POPULATION BY CONSTRUCTION, named for the same honesty reason:
//   - app/src/pages/contacts/MergePage.tsx -- wave-39 task c (DEC-748) fixed
//     the pair-total defect that motivated this scan by having the merge
//     screen resolve its own pair server-side: GET /contacts/duplicates?ids=
//     via apiGet<{ items; total; position }>, reading position/total straight
//     off that envelope. So it is NOT an apiList caller and not in THIS
//     population. Asserted below in both directions (absent from the raw
//     scan, and genuinely reading .total off the envelope) so a revert of
//     DEC-748 cannot silently slip past this file.
//
//     wave-41 amendment (task d): this file's own apiList-only scan cannot
//     see the apiGet family at all, so it is not "the one place this
//     codebase calls apiGet against a paginated list route" -- that was a
//     false sentence with no code behind it (FilesLibrary.tsx also does,
//     against GET /events/:eventId/files, src/routes/files.ts). The apiGet-
//     envelope family (MergePage.tsx included) is now owned, enumerated,
//     and ledgered by the sibling scan test/spa-envelope-reader-ledger.scan.
//     test.ts -- this file's job stays exactly apiList<T>.
//
// VERDICT KEY (one per population member):
//   'envelope'    -- every whole-set count this module renders reads
//                    res.total/res.count off the apiList response. Checked
//                    two ways: the cited file exists, and it contains a
//                    literal `.total` or `.count` token (the row would be
//                    unfalsifiable prose otherwise -- see the wave-35
//                    negative-control rule this file's own controls below
//                    exercise).
//   'page-scoped' -- the rendered number is deliberately about the visible
//                    rows/page, and the source SAYS SO in a comment. Checked
//                    by asserting the cited file's source literally contains
//                    the transcribed justifying snippet.
//   'unpaged'     -- the endpoint returns the whole set by contract (a
//                    small, bounded collection scoped to one parent entity,
//                    or a DEC-465 "renders every row today" endpoint whose
//                    perPage defaults to listPerPage's 200-row cap with no
//                    further-paging UI in the consuming module).
//
// One surface found by this enumeration WAS a live defect and is FIXED in
// this task, not ledgered as a lie: app/src/pages/review/Scorecard.tsx's
// queueProgress derived its `total` from queueDoneCounts(res.items) --
// items.length after the /review/plans/:id/queue endpoint's perPage cap --
// exactly DEC-905's warned-against "sum over a page" shape (see the
// Comms.tsx comment on sentLast7Days, which reads the SAME class of number
// off a dedicated request's res.total specifically to avoid this). Fixed to
// read `total` off `res.total`; `completed` (which is not a whole-set count,
// only a same-page tally the caller can only ever see anyway) is unchanged.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");
const PAGES_DIR = join(ROOT, "app", "src", "pages");

// ---------------------------------------------------------------------------
// Population -- derived at test time by walking app/src/pages/** for
// non-test .ts/.tsx modules whose source calls apiList<...>( or apiList(.
// ---------------------------------------------------------------------------
const APILIST_CALL_RE = /\bapiList\s*[<(]/;

function isTestFile(path: string): boolean {
  return /\.(test|spec)\.(ts|tsx)$/.test(path);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && (full.endsWith(".ts") || full.endsWith(".tsx")) && !isTestFile(full)) {
      out.push(full);
    }
  }
  return out;
}

/** Repo-relative, forward-slash path (stable across platforms, and the same
 * shape the ledger below cites paths in). */
function relPath(absPath: string): string {
  return relative(ROOT, absPath).split("\\").join("/");
}

/** Raw (unfiltered) scan -- every non-test app/src/pages/** module that
 * calls apiList against a paged list endpoint, INCLUDING the excluded
 * file. Exported so the exclusion-honesty check below can assert the
 * excluded file is actually found here (never a stale exclusion). */
export function scanApiListCallers(): string[] {
  return walk(PAGES_DIR)
    .filter((f) => APILIST_CALL_RE.test(readFileSync(f, "utf8")))
    .map(relPath)
    .sort();
}

const EXCLUSIONS: { file: string; owner: string }[] = [
  { file: "app/src/pages/review/ReviewerQueue.tsx", owner: "wave-38 task c" },
];

// Not an exclusion -- it is not an apiList caller at all (see the header
// note). Checked below so its departure from the population stays a written,
// asserted fact rather than a silent absence.
const MERGE_PAGE = "app/src/pages/contacts/MergePage.tsx";
const EXCLUDED_FILES = new Set(EXCLUSIONS.map((e) => e.file));

// ---------------------------------------------------------------------------
// Ledger -- one row per population member (raw scan minus the two named
// exclusions).
// ---------------------------------------------------------------------------
interface LedgerEntry {
  file: string;
  verdict: "envelope" | "page-scoped" | "unpaged";
  reason: string;
  // Required (and checked) for 'page-scoped' rows only: a literal substring
  // that must appear in the cited file's source, proving the "deliberately
  // about the visible rows" claim is written down, not asserted here only.
  commentSnippet?: string;
}

const LEDGER: LedgerEntry[] = [
  { file: "app/src/pages/Comms.tsx", verdict: "envelope", reason: "sentLast7Days/failedLast7Days read res.total off two dedicated since= requests (DEC-905: never a sum over a page of batches)." },
  { file: "app/src/pages/comms/ComposeWizard.tsx", verdict: "envelope", reason: "paginationSummary reads `total` off setTotal(res.total) from the submissions apiList call." },
  { file: "app/src/pages/comms/HistoryTab.tsx", verdict: "envelope", reason: "setTotal(res.total) from the email-log apiList call backs the pagination summary." },
  {
    file: "app/src/pages/comms/RecentSends.tsx",
    verdict: "unpaged",
    reason: "DEC-905 (wave-59 amendment): RecentSends renders no aggregate of its own -- the subtitle is Comms.tsx's own envelope-derived `rhythm` figure, formatted (never re-derived) via the shared formatSendRhythm; the `batches` prop backs only the rendered row list.",
  },
  { file: "app/src/pages/contacts/AddToEventModal.tsx", verdict: "unpaged", reason: "the only rendered whole-set count (submissionsOnSelectedEvent.length) comes from apiGet<ContactDetail>'s embedded history.submissions array -- one contact's full submission history, returned whole, not apiList-paginated. The apiList('/events') call here renders no count." },
  { file: "app/src/pages/contacts/BulkEmailModal.tsx", verdict: "unpaged", reason: "apiList<EmailTemplate> (DEC-465 listPerPage, 200-row render-everything cap) is only used for `.length > 0`/`.filter(...)` existence checks, never a whole-set count claim; the recipient counts rendered are the caller-supplied contactIds selection, not apiList output." },
  { file: "app/src/pages/contacts/ContactsApp.tsx", verdict: "envelope", reason: "setTotal(res.total) from the /contacts apiList call backs the directory's pagination summary; the duplicates rail and segments chip are DEC-465/deliberately-capped previews, never claimed as totals." },
  { file: "app/src/pages/contacts/DuplicatesView.tsx", verdict: "unpaged", reason: "/contacts/duplicates uses listPerPage (DEC-465, 200-row render-everything default per src/routes/api/contacts/crud.ts's DEC_466/DEC-461(e) blessed-JS-slice comment); the header count is visibleGroups.length over that full, unpaginated-in-practice set." },
  { file: "app/src/pages/contacts/PipelineBoard.tsx", verdict: "envelope", reason: "setTotal(res.total) backs the caption (DEC-468 comment: 'true count, never entries.length'); activityItems vs activityTotal is likewise total-driven for the Load More affordance." },
  { file: "app/src/pages/content/ContentApp.tsx", verdict: "envelope", reason: "setTotal(res.total) from the submissions apiList call backs the worklist's pagination summary." },
  {
    file: "app/src/pages/content/DeliverableDetail.tsx",
    verdict: "page-scoped",
    reason: "'Showing first N of total' explicitly discloses files.length vs the envelope's filesTotal rather than hiding the truncation (per-file comment threads separately use the DEC-468-documented unpaginated-today /files/:fileId/comments contract).",
    commentSnippet: "is now server-paginated",
  },
  { file: "app/src/pages/comms/TemplatesTab.tsx", verdict: "unpaged", reason: "/events/:eventId/templates uses listPerPage (DEC-465); 'Saved · {templates.length}' is rendered over that bounded, unpaginated-in-practice set with no further-paging UI." },
  { file: "app/src/pages/forms/FormsPage.tsx", verdict: "envelope", reason: "received.total is set from a dedicated perPage=1 apiList call's res.total, read purely for its total field." },
  { file: "app/src/pages/NotFound.tsx", verdict: "unpaged", reason: "apiList('/events') is used only to find the current event's display name (res.items.find); no whole-set count is ever rendered from it." },
  { file: "app/src/pages/Overview.tsx", verdict: "envelope", reason: "triage/contentApproval/overdueTasks all render `.total` from the dashboard's apiGet payload, each explicitly compared against `.rows.length` to disclose truncation; apiList('/events') here renders no count." },
  {
    file: "app/src/pages/review/PlanEditor.tsx",
    verdict: "page-scoped",
    reason: "the reviewer picker's 'Showing first N of total reviewers' line discloses that reviewerOptions only ever shows the first page of /users?role=reviewer.",
    commentSnippet: "only ever shows the first page",
  },
  { file: "app/src/pages/review/PlanList.tsx", verdict: "unpaged", reason: "/events/:eventId/plans uses listPerPage (DEC-465, 200-row render-everything default); `{plans.length} plans` is rendered over that bounded, unpaginated-in-practice set with no further-paging UI." },
  { file: "app/src/pages/review/ProgressPanel.tsx", verdict: "unpaged", reason: "/plans/:id/progress uses listPerPage (DEC-465); laggards/notStarted counts are tallies over that one plan's bounded reviewer-progress rows, not a paginated collection." },
  { file: "app/src/pages/review/ResultsTable.tsx", verdict: "envelope", reason: "setTotal(resultsRes.total) backs the results pagination summary; the per-submission evaluations sub-fetch is the unpaginated-by-contract endpoint (src/routes/review/evaluations.ts: 'this read is unpaginated on purpose') and renders no separate whole-set count." },
  { file: "app/src/pages/review/Scorecard.tsx", verdict: "envelope", reason: "FIXED this task: queueProgress.total now reads res.total off the /review/plans/:id/queue envelope instead of queueDoneCounts(res.items).total (items.length after the endpoint's perPage cap)." },
  { file: "app/src/pages/settings/ApiTokensPanel.tsx", verdict: "unpaged", reason: "/tokens uses listPerPage (DEC-465); only `.length === 0` empty-state checks are rendered, no whole-set count claim." },
  { file: "app/src/pages/settings/CallForPapersPanel.tsx", verdict: "envelope", reason: "setReceivedTotal(submissionsResult.total) from a dedicated perPage=1 apiList call backs the 'N submissions received' figure." },
  { file: "app/src/pages/settings/EmbedsPanel.tsx", verdict: "unpaged", reason: "tracks and saved-embed rows both come off listPerPage endpoints (DEC-465); no whole-set count is rendered from either." },
  { file: "app/src/pages/settings/PeopleRolesPanel.tsx", verdict: "envelope", reason: "setTotal(res.total) from /users backs 'Showing {users.length} of {total}'." },
  { file: "app/src/pages/settings/PortalSettingsPanel.tsx", verdict: "envelope", reason: "wave-4 task b gave the edit form a 'Resources · N' section head; N is setResourceCount(res.total) read off the /events/:eventId/resources apiList envelope, never the ResourcesPanel's own row count (that panel is separately ledgered 'unpaged' and renders only an empty-state check, so a length-derived heading here would be a second, page-bounded opinion of the same set)." },
  { file: "app/src/pages/settings/ResourcesPanel.tsx", verdict: "unpaged", reason: "/events/:id/resources (src/routes/api/portal-config.ts) uses listPerPage (DEC-465); only `.length === 0` empty-state checks are rendered." },
  { file: "app/src/pages/settings/SavedEmbedsPanel.tsx", verdict: "unpaged", reason: "/events/:id/embeds uses listPerPage (DEC-465); onCount/offCount are filters over that full, unpaginated-in-practice set, not a truncated page." },
  { file: "app/src/pages/settings/tracksRooms/useTracksRoomsPanel.ts", verdict: "unpaged", reason: "tracks/rooms both use listPerPage (DEC-465); only `.length === 0` empty-state checks are rendered." },
  { file: "app/src/pages/submissions/SubmissionDetailPage.tsx", verdict: "envelope", reason: "listPosition.total reads res.total off the neighbor-lookup apiList call for the 'N of total' eyebrow; the evaluations sub-fetch is the same unpaginated-by-contract endpoint ResultsTable.tsx uses." },
  { file: "app/src/pages/submissions/SubmissionsTable.tsx", verdict: "envelope", reason: "setTotal(res.total) backs the pagination summary; setPendingTotal(res.total) from a dedicated perPage=1 call backs the pending-count badge." },
  { file: "app/src/pages/submissions/ViewTabs.tsx", verdict: "unpaged", reason: "/events/:id/views uses listPerPage (DEC-465); no whole-set count is rendered from it." },
];

// Roots an artifact path must be rooted at to be checked for existence.
const CHECKABLE_ROOT = "app/src/pages/";

/** Pure, exported classifier: population (repo-relative file paths) and the
 * ledger -> a list of named, actionable problems. Both directions are
 * asserted (every population member has exactly one ledger row; every
 * ledger row names a live population member), plus file existence and the
 * verdict-specific content checks. Exported so the negative-control unit
 * tests below can feed it synthetic violations directly. */
export function findLedgerProblems(population: string[], ledger: LedgerEntry[], readFile: (repoRelPath: string) => string | null = defaultReadFile): string[] {
  const problems: string[] = [];
  const populationSet = new Set<string>();
  for (const p of population) {
    if (populationSet.has(p)) {
      problems.push(`duplicate population member (broken population, not a ledger issue): ${p}`);
      continue;
    }
    populationSet.add(p);
  }

  const ledgerCounts = new Map<string, number>();
  for (const entry of ledger) {
    ledgerCounts.set(entry.file, (ledgerCounts.get(entry.file) ?? 0) + 1);
  }

  // (1) every population member has exactly one ledger row
  for (const p of population) {
    const count = ledgerCounts.get(p) ?? 0;
    if (count === 0) problems.push(`population member with no ledger row: ${p}`);
    else if (count > 1) problems.push(`population member with ${count} ledger rows (must be exactly 1): ${p}`);
  }

  // (2) every ledger row names a live population member (no stale rows)
  for (const entry of ledger) {
    if (!populationSet.has(entry.file)) problems.push(`stale ledger row citing a file not in the population: ${entry.file}`);
  }

  // (3) every ledger row's cited file exists on disk (checkable root only)
  for (const entry of ledger) {
    if (!entry.file.startsWith(CHECKABLE_ROOT)) continue;
    if (readFile(entry.file) === null) {
      problems.push(`ledger row cites a nonexistent file: ${entry.file}`);
    }
  }

  // (4) 'envelope' rows: the cited file must contain a literal .total or
  // .count token -- otherwise the "reads res.total" claim is unfalsifiable
  // prose (this is the check the "items.length while envelope carries a
  // total" negative control exercises).
  const ENVELOPE_TOKEN_RE = /\.(total|count)\b/;
  for (const entry of ledger) {
    if (entry.verdict !== "envelope") continue;
    const src = readFile(entry.file);
    if (src === null) continue; // already reported above
    if (!ENVELOPE_TOKEN_RE.test(src)) {
      problems.push(`ledger row ${entry.file} marked 'envelope' but its source contains no .total/.count token`);
    }
  }

  // (5) 'page-scoped' rows: must carry a commentSnippet, and the cited
  // file's source must literally contain it.
  for (const entry of ledger) {
    if (entry.verdict !== "page-scoped") continue;
    if (!entry.commentSnippet) {
      problems.push(`ledger row ${entry.file} marked 'page-scoped' but carries no commentSnippet to verify`);
      continue;
    }
    const src = readFile(entry.file);
    if (src === null) continue; // already reported above
    if (!src.includes(entry.commentSnippet)) {
      problems.push(`ledger row ${entry.file} marked 'page-scoped' but its source does not contain the cited justifying comment: "${entry.commentSnippet}"`);
    }
  }

  // (6) every row has a non-empty reason
  for (const entry of ledger) {
    if (!entry.reason || entry.reason.trim() === "") {
      problems.push(`ledger row ${entry.file} has no reason`);
    }
  }

  return problems;
}

function defaultReadFile(repoRelPath: string): string | null {
  const full = join(ROOT, repoRelPath);
  if (!existsSync(full)) return null;
  return readFileSync(full, "utf8");
}

describe("spa-count-source-ledger.scan (DEC-518 wave-39 amendment)", () => {
  const rawScan = scanApiListCallers();
  const population = rawScan.filter((f) => !EXCLUDED_FILES.has(f));

  it("tripwire: raw scan finds at least 31 apiList-calling modules under app/src/pages/**, never hardcoded", () => {
    expect(rawScan.length).toBeGreaterThanOrEqual(31);
  });

  it("every named exclusion is genuinely found by the raw scan (an exclusion for a file that doesn't call apiList would be dishonest)", () => {
    for (const { file } of EXCLUSIONS) {
      expect(rawScan, `${file} not found by the raw scan -- exclusion may be stale`).toContain(file);
    }
  });

  it("MergePage.tsx is out of THIS (apiList-only) population because DEC-748 made it an apiGet-envelope reader -- ledgered instead by the sibling apiGet scan, not quietly dropped", () => {
    expect(rawScan, `${MERGE_PAGE} is calling apiList again -- it must be ledgered, not treated as out of population`).not.toContain(MERGE_PAGE);
    const src = readFileSync(join(ROOT, MERGE_PAGE), "utf8");
    expect(src, `${MERGE_PAGE} must still resolve its pair via apiGet against /contacts/duplicates (DEC-748)`).toMatch(/apiGet\s*<[^>]*>\s*\(\s*[`'"]\/contacts\/duplicates/);
    expect(src, `${MERGE_PAGE} must still read its pair total off the envelope, never items.length (DEC-748)`).toMatch(/res\.total/);
  });

  it("tripwire: population (raw scan minus the named exclusions) is at least 30", () => {
    expect(population.length).toBeGreaterThanOrEqual(30);
  });

  it("every population member has exactly one ledger row, and every ledger row names a live population member", () => {
    const problems = findLedgerProblems(population, LEDGER).filter(
      (p) => p.includes("no ledger row") || p.includes("ledger rows (must be exactly 1)") || p.includes("stale ledger row") || p.includes("duplicate population member"),
    );
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("every ledger row's cited file exists on disk", () => {
    const problems = findLedgerProblems(population, LEDGER).filter((p) => p.includes("nonexistent file"));
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("every 'envelope' row's file contains a .total/.count token", () => {
    const problems = findLedgerProblems(population, LEDGER).filter((p) => p.includes("no .total/.count token"));
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("every 'page-scoped' row's file contains its cited justifying comment", () => {
    const problems = findLedgerProblems(population, LEDGER).filter((p) => p.includes("does not contain the cited justifying comment") || p.includes("carries no commentSnippet"));
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("no problems at all -- the ledger is exact in both directions against the current tree", () => {
    const problems = findLedgerProblems(population, LEDGER);
    expect(problems, problems.join("\n")).toEqual([]);
  });

  // DEC-905 (wave-59 amendment): RecentSends.tsx must never grow back its own
  // seven-day window or a re-derived aggregate over `batches` -- pinned
  // directly (not just by the ledger row's prose) so a regression trips
  // this scan even if the ledger row itself is edited to match.
  it("RecentSends.tsx carries no seven-day window constant and no reduce/filter().length aggregation over its batches prop", () => {
    const src = readFileSync(join(ROOT, "app/src/pages/comms/RecentSends.tsx"), "utf8");
    expect(src, "RecentSends.tsx must not declare its own 7-day window constant").not.toMatch(
      /7\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/,
    );
    expect(src, "RecentSends.tsx must not .reduce( over anything").not.toMatch(/\.reduce\(/);
    expect(src, "RecentSends.tsx must not derive a count via .filter(...).length").not.toMatch(
      /\.filter\([^)]*\)\.length/,
    );
  });
});

describe("findLedgerProblems negative controls (DEC-518 wave-35 amendment: every scan ships one)", () => {
  const basePopulation = ["app/src/pages/synthetic/Compliant.tsx"];
  const files: Record<string, string> = {
    "app/src/pages/synthetic/Compliant.tsx": "setTotal(res.total); // reads the envelope",
    "app/src/pages/synthetic/ItemsLengthLie.tsx": "const count = res.items.length; // whole-set claim, envelope not read",
    "app/src/pages/synthetic/PageScopedNoComment.tsx": "const n = items.length; // no justification written down",
    "app/src/pages/synthetic/PageScopedWithComment.tsx": "// deliberately about the visible rows only\nconst n = items.length;",
  };
  function fakeReadFile(p: string): string | null {
    return p in files ? files[p]! : null;
  }
  const baseLedger: LedgerEntry[] = [{ file: "app/src/pages/synthetic/Compliant.tsx", verdict: "envelope", reason: "reads res.total" }];

  it("compliant ledger against its matching population reports nothing (proves the scan can pass)", () => {
    expect(findLedgerProblems(basePopulation, baseLedger, fakeReadFile)).toEqual([]);
  });

  it("a synthetic module rendering a count from items.length, ledgered as 'envelope', IS reported (envelope claim vs .total presence)", () => {
    const pop = ["app/src/pages/synthetic/ItemsLengthLie.tsx"];
    const ledger: LedgerEntry[] = [{ file: "app/src/pages/synthetic/ItemsLengthLie.tsx", verdict: "envelope", reason: "claims envelope" }];
    const problems = findLedgerProblems(pop, ledger, fakeReadFile);
    expect(problems.some((p) => p.includes("no .total/.count token"))).toBe(true);
  });

  it("a compliant envelope-verdict row (file genuinely contains .total) is not reported", () => {
    const problems = findLedgerProblems(basePopulation, baseLedger, fakeReadFile);
    expect(problems).toEqual([]);
  });

  it("a stale ledger row naming a dead file IS reported (ledger -> population direction)", () => {
    const ledger: LedgerEntry[] = [...baseLedger, { file: "app/src/pages/synthetic/DoesNotExist.tsx", verdict: "unpaged", reason: "stale" }];
    const problems = findLedgerProblems(basePopulation, ledger, fakeReadFile);
    expect(problems.some((p) => p.includes("app/src/pages/synthetic/DoesNotExist.tsx"))).toBe(true);
  });

  it("a population member with no ledger row IS reported (population -> ledger direction)", () => {
    const pop = [...basePopulation, "app/src/pages/synthetic/Unledgered.tsx"];
    const problems = findLedgerProblems(pop, baseLedger, fakeReadFile);
    expect(problems.some((p) => p.includes("Unledgered.tsx"))).toBe(true);
  });

  it("a 'page-scoped' row whose file lacks the cited comment IS reported", () => {
    const pop = ["app/src/pages/synthetic/PageScopedNoComment.tsx"];
    const ledger: LedgerEntry[] = [
      { file: "app/src/pages/synthetic/PageScopedNoComment.tsx", verdict: "page-scoped", reason: "claims justification", commentSnippet: "deliberately about the visible rows only" },
    ];
    const problems = findLedgerProblems(pop, ledger, fakeReadFile);
    expect(problems.some((p) => p.includes("does not contain the cited justifying comment"))).toBe(true);
  });

  it("a 'page-scoped' row whose file DOES contain the cited comment is accepted", () => {
    const pop = ["app/src/pages/synthetic/PageScopedWithComment.tsx"];
    const ledger: LedgerEntry[] = [
      { file: "app/src/pages/synthetic/PageScopedWithComment.tsx", verdict: "page-scoped", reason: "justified", commentSnippet: "deliberately about the visible rows only" },
    ];
    expect(findLedgerProblems(pop, ledger, fakeReadFile)).toEqual([]);
  });

  it("a nonexistent file cited by any verdict IS reported", () => {
    const pop = ["app/src/pages/synthetic/Ghost.tsx"];
    const ledger: LedgerEntry[] = [{ file: "app/src/pages/synthetic/Ghost.tsx", verdict: "unpaged", reason: "ghost" }];
    const problems = findLedgerProblems(pop, ledger, fakeReadFile);
    expect(problems.some((p) => p.includes("nonexistent file"))).toBe(true);
  });
});
