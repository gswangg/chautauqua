// DEC-078 (wave-11 amendment, tightened wave-14, rooted at `src` wave-18):
// src/lib/chunk.ts's header states every inArray(...) over an unbounded id
// list MUST iterate chunkIds batches. The original version of this scan
// bound a FILE -- a single chunk-bound inArray( anywhere in a file made
// every OTHER inArray( call in that same file pass, silently. This version
// binds a CALL SITE: it reads every *.ts/*.tsx file under `src` -- the
// WHOLE tree, not two hand-named subdirectories someone remembered -- as
// text at run time (not a hand-maintained file list), strips `//` and
// `/* */` comments first (so a DEC citation inside a JSDoc block is never
// mistaken for a query), extracts every remaining `inArray(...)` call's
// SECOND argument's leading identifier, and requires each one to be:
//   (a) bound by a `for (const <id> of chunkIds(...))` loop in the same file,
//   (b) a SCREAMING_CASE identifier (a literal enum/constant set),
//   (c) an inline array literal, or
//   (d) named in BOUNDED_INARRAY_CALLSITES below with a reviewable reason.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(__dirname, "..");
const SCAN_ROOTS = ["src"];

// Each entry: [file path relative to repo root, the inArray(...) call's
// second-argument leading identifier, reason that call site's id list is
// bounded and therefore exempt from chunkIds]. Keyed by (file, identifier)
// -- every inArray( call site in `file` whose second argument's leading
// identifier is `identifier` is covered by one entry, since a reviewed
// reason for a name covers every call site using that same bounded value.
const BOUNDED_INARRAY_CALLSITES: Array<[file: string, identifier: string, reason: string]> = [
  [
    "src/server/repo/public/home.ts",
    "eventIds",
    "eventIds is derived from listHubEvents' own LIMIT HUB_CANDIDATE_LIMIT " +
      "candidate rows (DEC-581) — bounded by a fixed page-size constant, " +
      "never the full org event count.",
  ],
  [
    "src/server/repo/public/home.ts",
    "visibleEventIds",
    "visibleEventIds is eventIds (see above) filtered further by " +
      "isHubVisible -- a subset, so it inherits the same HUB_CANDIDATE_LIMIT " +
      "bound.",
  ],
  [
    "src/server/repo/portal/submissions.ts",
    "ids",
    "ids is the submission id list for a SINGLE contact's own portal " +
      "submissions (scoped by contactId+orgId) — bounded by one person's " +
      "submission history, not by org-wide data volume.",
  ],
  [
    "src/server/repo/review/evaluations.ts",
    "planIds",
    "listPlanCriteriaByIds' planIds is the DISTINCT set of evaluation " +
      "plan ids referenced by one submission's evaluation rows — bounded " +
      "by event configuration (rounds/tracks), not by review-row volume.",
  ],
  [
    "src/server/repo/review/evaluations.ts",
    "batch",
    "countEvaluationsBySubmission's id-scoped branch IS chunkIds-bound — " +
      "`batch` is `chunkIds(submissionIds)[0]`, the single element it's " +
      "provably left holding once (DEC-829 wave-39) any id list spanning " +
      "MORE than one chunkIds batch falls through to the unscoped GROUP BY " +
      "below instead of chunk-fanning-out. Same ID_CHUNK_SIZE-bound slice " +
      "as before; only the shape (indexed element vs a Promise.all map) " +
      "differs, which is why isChunkLoopBound's `for (const x of " +
      "chunkIds(...))` pattern doesn't match here.",
  ],
  [
    "src/server/repo/tasks/speaker-detail.ts",
    "submissionIds",
    "submissionIds is one contact's own submissions within one event — " +
      "bounded by a single speaker's talk count at one event.",
  ],
  [
    "src/server/repo/submissions/detail.ts",
    "contactIds",
    "contactIds is the DISTINCT participant contact set for ONE " +
      "submission (co-speakers on a single talk) — naturally small, " +
      "never data-sized.",
  ],
  [
    "src/server/repo/comms.ts",
    "contactIds",
    "findAccountUserIds derives contactIds from `batch`, which the " +
      "enclosing loop already slices to ACCOUNT_LOOKUP_BATCH_SIZE " +
      "(ID_CHUNK_SIZE / columns-per-row) before this inArray runs.",
  ],
  [
    "src/server/repo/comms.ts",
    "emails",
    "findAccountUserIds derives emails from `batch`, which the enclosing " +
      "loop already slices to ACCOUNT_LOOKUP_BATCH_SIZE before this " +
      "inArray runs (same batch as contactIds above).",
  ],
  [
    "src/server/repo/comms.ts",
    "roomIds",
    "roomIds is bounded by the event's physical room count (~15), per the " +
      "adjacent code comment — a DEC-078 bounded-list exemption.",
  ],
  [
    "src/server/repo/events.ts",
    "trackFilterSurfaces",
    "deleteTrack's trackFilterSurfaces is EMBED_SURFACES (a 5-element " +
      "`as const` literal in src/lib/embed-knobs.ts) filtered by " +
      "knobsForSurface(...).includes('trackId') per DEC-851 -- a subset of a " +
      "compile-time enum of embed surfaces, bounded by the knob table's own " +
      "size, never by request or data scale.",
  ],
  [
    "src/server/repo/files-comments.ts",
    "chainIds",
    "listFileComments throws (`version chain of N files exceeds " +
      "ID_CHUNK_SIZE`) before this inArray runs whenever chainIds would " +
      "exceed ID_CHUNK_SIZE -- the call site is guarded, not silently " +
      "unbounded.",
  ],
  [
    "src/server/repo/files-library.ts",
    "deliverableKinds",
    "deliverableKinds is params.kinds validated against the fixed " +
      "LIBRARY_KIND_TOKENS enum by routes/files.ts's parseKinds (throws on " +
      "an unknown token) and de-duplicated via a Set -- bounded by the " +
      "enum's own size, never request-scale.",
  ],
  [
    "src/server/repo/files-versions-chain.ts",
    "ids",
    "listFileChainVersions' ids come from listFileChainIds, which walks " +
      "ONE file's previous_file_id chain -- bounded by that single file's " +
      "version count, never data-sized.",
  ],
  [
    "src/server/repo/ics-sequence.ts",
    "db",
    "Both call sites pass a Drizzle subquery (`db.select(...).from(...)`) " +
      "as inArray's second argument, not a JS array of bound values -- the " +
      "id set is resolved server-side inside one atomic UPDATE ... WHERE " +
      "id IN (SELECT ...) statement (DEC-078/DEC-492), so there is no " +
      "client-bound parameter list to chunk.",
  ],
  [
    "src/server/repo/overview.ts",
    "contentSubmissionIds",
    "contentSubmissionIds is contentDetailRows' ids, and contentDetailRows " +
      "is itself capped at ROW_CAP + 1 with a throw on overflow -- bounded " +
      "by that fixed row cap.",
  ],
  [
    "src/server/repo/overview.ts",
    "placedRoomIds",
    "placedRoomIds is bounded by the event's physical room count (~15), " +
      "same DEC-078 exemption as comms.ts/agenda.ts/detail.ts's roomIds.",
  ],
  [
    "src/server/repo/public/agenda.ts",
    "roomIds",
    "roomIds is bounded by the event's physical room count (~15), per the " +
      "adjacent code comment — a DEC-078 bounded-list exemption.",
  ],
  [
    "src/server/repo/public/detail.ts",
    "roomIds",
    "roomIds is bounded by the event's physical room count (~15), per the " +
      "adjacent code comment — a DEC-078 bounded-list exemption.",
  ],
  [
    "src/server/repo/review/submissions.ts",
    "filterTracks",
    "filterTracks is organizer-authored plan config (plan.filters.trackIds " +
      "-- a handful of track ids), not a request-scale id list, per the " +
      "adjacent code comment (bounded to ~25 params in practice).",
  ],
  [
    "src/server/repo/review/submissions.ts",
    "submissionScopes",
    "submissionScopes is derived from reviewerRows, which is capped at " +
      "MAX_REVIEWER_SCOPE_ROWS + 1 with a throw on overflow -- bounded by " +
      "that fixed cap.",
  ],
  [
    "src/server/repo/review/submissions.ts",
    "trackScopes",
    "trackScopes is derived from reviewerRows, which is capped at " +
      "MAX_REVIEWER_SCOPE_ROWS + 1 with a throw on overflow -- bounded by " +
      "that fixed cap (same reviewerRows as submissionScopes above).",
  ],
  [
    "src/server/repo/review/submissions.ts",
    "effectiveTracks",
    "effectiveTracks is trackScopes (bounded by MAX_REVIEWER_SCOPE_ROWS, " +
      "see above) optionally narrowed further by filterTracks -- an " +
      "intersection can only be smaller than its bounded input.",
  ],
  [
    "src/server/repo/review/submissions.ts",
    "batchSeqs",
    "batchSeqs is `batch.map(Number)` inside `for (const batch of " +
      "chunkIds(seqs.map(String)))` -- chunk-bound one indirection away " +
      "from the loop variable itself.",
  ],
  [
    "src/server/repo/review/users.ts",
    "orgIds",
    "batchUserDisplayNames derives orgIds from `matchBatch`, which the " +
      "enclosing loop slices to EMAIL_MATCH_BATCH_SIZE (ID_CHUNK_SIZE / 2, " +
      "since orgIds and emails are BOTH bound in the same query) before " +
      "this inArray runs.",
  ],
  [
    "src/server/repo/review/users.ts",
    "emails",
    "batchUserDisplayNames derives emails from `matchBatch`, same " +
      "EMAIL_MATCH_BATCH_SIZE chunk as orgIds above.",
  ],
  [
    "src/server/repo/submissions/list.ts",
    "params",
    "params.status/params.contentStatus are typed SubmissionStatus[]/" +
      "ContentStatus[] (query.ts) -- values are restricted to those fixed " +
      "enums, never a request-scale id list.",
  ],
  [
    "src/server/repo/submissions/list.ts",
    "batch",
    "`batch` iterates idBatches, which is `chunkIds(ids)` computed once " +
      "above the loop -- chunk-bound one indirection away from a direct " +
      "`for (const batch of chunkIds(...))` loop.",
  ],
  [
    "src/server/repo/submissions/status.ts",
    "taskChunk",
    "taskChunk iterates chunkBySize(eventTaskIds, PAIR_ID_CHUNK_SIZE) -- a " +
      "local DEC-078/DEC-528 helper that halves ID_CHUNK_SIZE because both " +
      "taskChunk and contactChunk are bound in the SAME query (see the " +
      "adjacent code comment).",
  ],
  [
    "src/server/repo/tasks/grid.ts",
    "taskIds",
    "taskIds is `tasks.map((t) => t.id)` -- the event's own onboarding " +
      "task definitions (organizer-authored, a handful per event), not a " +
      "request-scale id list. Only the page's contactIds are chunked here " +
      "per the adjacent DEC-104 comment.",
  ],
  [
    "src/server/repo/tasks/grid.ts",
    "batch",
    "getOnboardingGrid's participation and cell queries bind `batch` from " +
      "`contactBatches.map((batch) => ...)`, and contactBatches is " +
      "`chunkIds(contactIdsInOrder)` computed once above -- chunk-bound one " +
      "indirection away, same shape as the submissions/list.ts `batch` entry " +
      "above. DEC-370's wave-62 amendment turned the two former `for (const " +
      "batch of chunkIds(...))` loops into one concurrent Promise.all wave, " +
      "which changes WHEN the batches issue, never how they are bounded.",
  ],
  [
    "src/server/repo/tasks/reminders.ts",
    "taskIdChunk",
    "taskIdChunk iterates idChunksOrUndefined(taskIds), which delegates to " +
      "chunkIds when taskIds is present -- chunk-bound one indirection " +
      "away from a direct `for (const x of chunkIds(...))` loop (needed " +
      "here so the taskId and contactId chunk dimensions can be paired).",
  ],
  [
    "src/server/repo/tasks/reminders.ts",
    "contactIdChunk",
    "contactIdChunk iterates idChunksOrUndefined(contactIds), same " +
      "chunkIds delegation as taskIdChunk above.",
  ],
  [
    "src/server/repo/submissions/touch.ts",
    "db",
    "touchSubmissionsForContacts/touchSubmissionsForTracks's inArray(...) " +
      "second argument is a correlated subquery (db.select(...).from(...)" +
      ".where(inArray(<column>, chunk))), not an in-memory id list -- the " +
      "subquery's OWN inArray is bound to `chunk`, produced by the " +
      "enclosing `for (const chunk of chunkIds(...))` loop over the " +
      "renamed contact/track ids, so the whole statement resolves to one " +
      "set-based UPDATE per D1-bound-parameter-sized chunk, never an " +
      "unbounded scan.",
  ],
];

const allowlistByFileAndId = new Map(
  BOUNDED_INARRAY_CALLSITES.map(([file, identifier, reason]) => [`${file}::${identifier}`, reason]),
);

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

/** Strips `//` line comments and `/* ... *\/` block comments from source
 * text before call-site extraction, so a DEC citation inside a JSDoc block
 * (e.g. a prose mention of `inArray(...)`) is never mistaken for a real
 * query. Deliberately naive (no string/template-literal awareness) -- this
 * codebase never puts `//` or `/*` inside a string on the same line as a
 * real inArray( call, and a false stripped comment can only make the scan
 * MISS a site, never wrongly clear one, since a genuinely commented-out
 * call site would never bind at runtime anyway. */
function stripComments(src: string): string {
  // Block comments are replaced by their own newline count (not deleted
  // outright) so line numbers reported for a real call site AFTER a block
  // comment stay accurate.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
    .replace(/\/\/[^\n]*/g, "");
}

const scannedFiles = SCAN_ROOTS.flatMap((root) => listTsFiles(join(REPO_ROOT, root))).map((f) =>
  relative(REPO_ROOT, f),
);

interface InArraySite {
  file: string;
  line: number;
  leadingIdentifier: string;
  secondArgPreview: string;
}

/** Extracts every inArray(...) call's second argument, at run time, from
 * file text -- a balanced-paren/bracket/brace scan (not a naive regex) so
 * nested calls like `inArray(col, db.select(...).from(...))` or
 * `inArray(col, batch.map(Number))` resolve their SECOND argument
 * correctly rather than splitting on an inner comma. */
function extractInArraySites(relFile: string, src: string): InArraySite[] {
  const sites: InArraySite[] = [];
  const callRe = /inArray\(/g;
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(src))) {
    const argsStart = m.index + "inArray(".length;
    let depth = 0;
    let commaIdx = -1;
    for (let j = argsStart; j < src.length; j++) {
      const c = src[j];
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") {
        if (depth === 0) break;
        depth--;
      } else if (c === "," && depth === 0) {
        commaIdx = j;
        break;
      }
    }
    if (commaIdx === -1) continue; // malformed/unary call -- not a bind site
    let callDepth = 1;
    let end = -1;
    for (let j = argsStart; j < src.length; j++) {
      const c = src[j];
      if (c === "(") callDepth++;
      else if (c === ")") {
        callDepth--;
        if (callDepth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end === -1) continue;
    const secondArg = src.slice(commaIdx + 1, end).trim();
    const idMatch = secondArg.match(/^[A-Za-z_$][A-Za-z0-9_$]*/);
    const leadingIdentifier = idMatch ? idMatch[0] : secondArg.startsWith("[") ? "[]" : secondArg.slice(0, 1);
    const line = src.slice(0, m.index).split("\n").length;
    sites.push({ file: relFile, line, leadingIdentifier, secondArgPreview: secondArg.slice(0, 60) });
  }
  return sites;
}

function isChunkLoopBound(src: string, identifier: string): boolean {
  const re = new RegExp(`for\\s*\\(\\s*const\\s+${identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+of\\s+chunkIds\\(`);
  return re.test(src);
}

function isScreamingCase(identifier: string): boolean {
  return /^[A-Z][A-Z0-9_]*$/.test(identifier);
}

function isArrayLiteral(secondArgPreview: string): boolean {
  return secondArgPreview.startsWith("[");
}

describe("DEC-078 repo-wide inArray/chunkIds scan (per call site)", () => {
  it("scanned at least the wave-11 planning-time file count (tripwire against a vacuous scan)", () => {
    expect(scannedFiles.length).toBeGreaterThan(100);
  });

  it("scanned at least 60 files under the whole `src` tree (tripwire against the root narrowing back to two subdirectories)", () => {
    expect(scannedFiles.length).toBeGreaterThanOrEqual(60);
  });

  it("every allowlisted BOUNDED_INARRAY_CALLSITES entry is a real file that was actually scanned", () => {
    for (const [file] of BOUNDED_INARRAY_CALLSITES) {
      expect(scannedFiles).toContain(file);
    }
  });

  it("chunkIds has exactly one definition site (src/lib/chunk.ts) -- justifies treating any same-file `for (const x of chunkIds(` as the canonical chunker", () => {
    const allSrcFiles = listTsFiles(join(REPO_ROOT, "src"));
    const definitionSites = allSrcFiles.filter((f) => /export function chunkIds\(/.test(readFileSync(f, "utf8")));
    expect(definitionSites.map((f) => relative(REPO_ROOT, f))).toEqual(["src/lib/chunk.ts"]);
  });

  const allSites = scannedFiles.flatMap((relFile) => {
    const absFile = join(REPO_ROOT, relFile);
    const rawSrc = readFileSync(absFile, "utf8");
    const src = stripComments(rawSrc);
    if (!src.includes("inArray(")) return [];
    return extractInArraySites(relFile, src).map((site) => ({ site, src }));
  });

  it("found at least 20 inArray( call sites -- tripwire against a regex that silently matches nothing", () => {
    expect(allSites.length).toBeGreaterThanOrEqual(20);
  });

  it("found at least 24 inArray( call sites once the scan is rooted at `src` -- tripwire against the root narrowing back to two subdirectories", () => {
    expect(allSites.length).toBeGreaterThanOrEqual(24);
  });

  it("every BOUNDED_INARRAY_CALLSITES entry still matches a real hit (no stale lines)", () => {
    // DEC-078 wave-21 amendment: the previous check above only proved the
    // named FILE exists and was scanned -- it never checked that the
    // (file, identifier) pair still names a live inArray( call site. An
    // entry whose call site was chunked, renamed, or deleted would keep
    // passing forever and silently pre-clear any FUTURE call site that
    // reuses that same (file, identifier) pair. This asserts, in the other
    // direction, that every allowlist entry matches at least one hit found
    // by allSites (the same extraction the per-call-site test below uses).
    const staleEntries = BOUNDED_INARRAY_CALLSITES.filter(
      ([file, identifier]) => !allSites.some(({ site }) => site.file === file && site.leadingIdentifier === identifier),
    );
    expect(
      staleEntries,
      staleEntries
        .map(([file, identifier]) => `${file} :: ${identifier}: stale entry -- delete this line (test/inarray-chunk-scan.test.ts BOUNDED_INARRAY_CALLSITES) -- no matching inArray(..., ${identifier}) call site was found in ${file}.`)
        .join("\n"),
    ).toEqual([]);
  });

  for (const { site, src } of allSites) {
    it(`${site.file}:${site.line}: inArray(..., ${site.leadingIdentifier}) is chunk-bound, a literal enum/array, or allowlisted (DEC-078)`, () => {
      const chunkBound = isChunkLoopBound(src, site.leadingIdentifier);
      const screaming = isScreamingCase(site.leadingIdentifier);
      const arrayLiteral = isArrayLiteral(site.secondArgPreview);
      const allowlisted = allowlistByFileAndId.has(`${site.file}::${site.leadingIdentifier}`);
      if (!chunkBound && !screaming && !arrayLiteral && !allowlisted) {
        throw new Error(
          `${site.file}:${site.line} calls inArray(..., ${site.leadingIdentifier}) which is neither bound by a ` +
            `same-file \`for (const ${site.leadingIdentifier} of chunkIds(...))\` loop, a SCREAMING_CASE enum ` +
            `constant, an inline array literal, nor listed in BOUNDED_INARRAY_CALLSITES — DEC-078 requires every ` +
            `inArray(...) over an unbounded id list to iterate chunkIds batches. Either chunk the id list or add ` +
            `a reviewed allowlist entry naming what bounds it.`,
        );
      }
      expect(chunkBound || screaming || arrayLiteral || allowlisted).toBe(true);
    });
  }
});
