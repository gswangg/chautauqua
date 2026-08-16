// DEC-851/DEC-358 (w1-d): "a declared response field with no reader is a
// lie." Every previous run of the declared-with-no-reader grep (DEC-851/
// DEC-988) walked settings and query KNOBS only. DEC-851's unnumbered
// amendment ("the declared-with-no-reader rule extends to RESPONSE fields")
// generalises it to the WIRE: a field placed on a response-shaped interface
// and never read anywhere under app/src is the mirror case wave 82 found
// with `perDropdown` -- either the server is computing something nobody can
// see, or a screen is missing a fact it was promised.
//
// SCOPE (DEC-851 wave-5 amendment: derive the population, don't hand-list
// it -- a hand-limited schedule is not a principle): every `app/src/pages/
// **/types.ts` module, discovered by a directory walk (sorted, so a failure
// is stable across runs), not the three files this scan used to name by
// hand. For every field declared on a RESPONSE-shaped `interface` in any of
// those files, this scan asserts at least one reader exists somewhere under
// app/src -- a property access (`x.field`), a destructure (`{ field }`/
// `{ other, field }`), or a quoted string key (`'field'`/`"field"`).
// Request-only / SPA-internal-draft types (documented as such in their own
// file, e.g. PlanDraft) are excluded from the population with a written
// reason, never silently skipped.
//
// VERDICT KEY:
//   'read'      -- a reader exists; this row exists so the ledger stays a
//                  total function of the population (every member gets
//                  exactly one row), not because a scan needs one to pass.
//   'exempt'    -- no reader exists, and the field is out of THIS task's
//                  scope for a named principled reason (never a schedule,
//                  never a branch name -- exemption-reason-is-a-principle.
//                  scan.test.ts machine-checks that against this file too).
//   'fixed'     -- this task wired a reader (or deleted the field from both
//                  the wire type and its server projection) as one of its
//                  up-to-three real closures.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE); // test/ -> repo root
const APP_SRC_DIR = join(ROOT, 'app', 'src');

/** Every `app/src/pages/<page>/types.ts` module, discovered by a walk (not
 * hand-listed) and sorted so a broken walk fails the same way every run. */
function findPagesTypesFiles(): string[] {
  const pagesDir = join(APP_SRC_DIR, 'pages');
  const out: string[] = [];
  for (const pageName of readdirSync(pagesDir).sort()) {
    const pageDir = join(pagesDir, pageName);
    if (!statSync(pageDir).isDirectory()) continue;
    const typesFile = join(pageDir, 'types.ts');
    try {
      if (statSync(typesFile).isFile()) out.push(relPath(typesFile));
    } catch {
      // no types.ts in this page directory -- not every page has one.
    }
  }
  return out;
}

const TARGET_FILES = findPagesTypesFiles();

// ---------------------------------------------------------------------------
// A tiny string/comment-aware scanner: strips comments, then splits an
// interface body into top-level (depth-0) `;`-terminated members, tracking
// nesting via {[(< so a nested inline object type (e.g. `roundMeta: { name:
// string; ... }`) or a generic (`Record<string, number>`) doesn't fracture
// a single member into several.
// ---------------------------------------------------------------------------
type Mode = 'CODE' | 'SINGLE' | 'DOUBLE' | 'TEMPLATE';

function stripComments(src: string): string {
  let out = '';
  const modeStack: Mode[] = ['CODE'];
  for (let i = 0; i < src.length; i++) {
    const top = modeStack[modeStack.length - 1];
    const ch = src[i];
    if (top === 'CODE') {
      if (ch === '/' && src[i + 1] === '/') {
        const nl = src.indexOf('\n', i);
        i = nl === -1 ? src.length : nl - 1;
        continue;
      }
      if (ch === '/' && src[i + 1] === '*') {
        const end = src.indexOf('*/', i + 2);
        i = end === -1 ? src.length : end + 1;
        continue;
      }
      if (ch === "'") modeStack.push('SINGLE');
      else if (ch === '"') modeStack.push('DOUBLE');
      else if (ch === '`') modeStack.push('TEMPLATE');
      out += ch;
      continue;
    }
    out += ch;
    if (ch === '\\') {
      i++;
      out += src[i] ?? '';
      continue;
    }
    if ((top === 'SINGLE' && ch === "'") || (top === 'DOUBLE' && ch === '"') || (top === 'TEMPLATE' && ch === '`')) {
      modeStack.pop();
    }
  }
  return out;
}

/** From `src[openIdx]` (must be `{`), finds the matching `}` (comment/string
 * already stripped by the caller, so this is a plain depth counter that
 * still respects quotes for safety). */
function findMatchingBrace(src: string, openIdx: number): string {
  let depth = 0;
  const modeStack: Mode[] = ['CODE'];
  for (let i = openIdx; i < src.length; i++) {
    const top = modeStack[modeStack.length - 1];
    const ch = src[i];
    if (top === 'CODE') {
      if (ch === "'") modeStack.push('SINGLE');
      else if (ch === '"') modeStack.push('DOUBLE');
      else if (ch === '`') modeStack.push('TEMPLATE');
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return src.slice(openIdx, i + 1);
      }
      continue;
    }
    if (ch === '\\') {
      i++;
      continue;
    }
    if ((top === 'SINGLE' && ch === "'") || (top === 'DOUBLE' && ch === '"') || (top === 'TEMPLATE' && ch === '`')) {
      modeStack.pop();
    }
  }
  return src.slice(openIdx);
}

/** Splits an interface body (without the outer `{`/`}`) into top-level
 * (depth-0) `;`-terminated member segments, tracking {[(< nesting so a
 * generic or an inline nested object type stays inside one member. */
function topLevelMembers(body: string): string[] {
  const segments: string[] = [];
  let depth = 0;
  let start = 0;
  const modeStack: Mode[] = ['CODE'];
  for (let i = 0; i < body.length; i++) {
    const top = modeStack[modeStack.length - 1];
    const ch = body[i];
    if (top === 'CODE') {
      if (ch === "'") modeStack.push('SINGLE');
      else if (ch === '"') modeStack.push('DOUBLE');
      else if (ch === '`') modeStack.push('TEMPLATE');
      else if (ch === '{' || ch === '[' || ch === '(' || ch === '<') depth++;
      else if (ch === '}' || ch === ']' || ch === ')' || ch === '>') depth--;
      else if (ch === ';' && depth === 0) {
        segments.push(body.slice(start, i));
        start = i + 1;
      }
      continue;
    }
    if (ch === '\\') {
      i++;
      continue;
    }
    if ((top === 'SINGLE' && ch === "'") || (top === 'DOUBLE' && ch === '"') || (top === 'TEMPLATE' && ch === '`')) {
      modeStack.pop();
    }
  }
  const last = body.slice(start);
  if (last.trim() !== '') segments.push(last);
  return segments;
}

const MEMBER_NAME_RE = /^\s*(?:readonly\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\??\s*:/;

interface InterfaceDecl {
  name: string;
  fields: string[];
}

/** Every `export interface Name { ... }` (or `export interface Name extends
 * X { ... }`) declaration in `src`, with its top-level field names. Index
 * signatures / call signatures (no leading identifier) are skipped -- they
 * aren't a NAMED field with a reader to find. */
function scanInterfaces(src: string): InterfaceDecl[] {
  const stripped = stripComments(src);
  const out: InterfaceDecl[] = [];
  const RE = /export interface (\w+)(?:\s+extends\s+[\w<>,\s]+)?\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(stripped))) {
    const openIdx = m.index + m[0].length - 1;
    const block = findMatchingBrace(stripped, openIdx);
    const body = block.slice(1, -1);
    const fields: string[] = [];
    for (const seg of topLevelMembers(body)) {
      const nm = MEMBER_NAME_RE.exec(seg);
      if (nm) fields.push(nm[1] as string);
    }
    out.push({ name: m[1] as string, fields });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Population -- every (file, interface, field) triple from a RESPONSE-shaped
// interface in the three target files. Request-only / SPA-internal-draft
// interfaces are excluded, with a written reason, never silently dropped.
// ---------------------------------------------------------------------------
const EXCLUDED_INTERFACES: Record<string, string> = {
  PlanDraft:
    "the file's own comment (app/src/pages/review/types.ts:80-82) states this type keeps SPA-internal field names for the editor's draft state, distinct from the wire response shape (EvaluationPlan) it maps to/from on load/save -- it is never itself a server response.",
};

interface PopulationMember {
  key: string; // "file#Interface.field"
  file: string;
  iface: string;
  field: string;
}

function scanPopulation(): PopulationMember[] {
  const members: PopulationMember[] = [];
  for (const relFile of TARGET_FILES) {
    const src = readFileSync(join(ROOT, relFile), 'utf8');
    for (const decl of scanInterfaces(src)) {
      if (decl.name in EXCLUDED_INTERFACES) continue;
      for (const field of decl.fields) {
        members.push({ key: `${relFile}#${decl.name}.${field}`, file: relFile, iface: decl.name, field });
      }
    }
  }
  return members;
}

// ---------------------------------------------------------------------------
// Reader search -- every non-test .ts/.tsx file under app/src (excluding the
// three target files themselves, which only DECLARE the fields) is searched
// for a property access, a destructure, or a quoted string key naming the
// field.
// ---------------------------------------------------------------------------
function isTestFile(path: string): boolean {
  return /\.(test|spec)\.(ts|tsx)$/.test(path);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name) && !isTestFile(name)) out.push(full);
  }
  return out;
}

function relPath(absPath: string): string {
  return relative(ROOT, absPath).split('\\').join('/');
}

let candidateFilesCache: { path: string; src: string }[] | null = null;
function candidateFiles(): { path: string; src: string }[] {
  if (candidateFilesCache) return candidateFilesCache;
  candidateFilesCache = walk(APP_SRC_DIR)
    .map((abs) => ({ path: relPath(abs), src: readFileSync(abs, 'utf8') }))
    .filter((f) => !TARGET_FILES.includes(f.path));
  return candidateFilesCache;
}

function readerPatterns(field: string): RegExp[] {
  const esc = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [
    new RegExp(`\\.${esc}\\b`), // property access: x.field
    new RegExp(`[{,]\\s*${esc}\\b`), // destructure / shorthand: { field } / { a, field }
    new RegExp(`['"]${esc}['"]`), // quoted string key: 'field' / "field"
  ];
}

/** True if any non-test app/src file (other than the three target type
 * files) contains a reader for `field`. Exported so the population/ledger
 * honesty tests below can reuse it. */
function hasReader(field: string, files: { path: string; src: string }[] = candidateFiles()): boolean {
  const patterns = readerPatterns(field);
  return files.some((f) => patterns.some((re) => re.test(f.src)));
}

// ---------------------------------------------------------------------------
// Ledger -- every field STILL unread as of this task's own closing run of the
// scan, each with an 'exempt' verdict and a principled reason (never a
// branch, never "unreviewed"/"later wave" -- see the DEFERRAL_RE check
// below). Fields this task WIRED a reader for, or DELETED from the wire
// entirely, are proven by their own dedicated tests further down and never
// appear here, because after the fix they are no longer unread.
// ---------------------------------------------------------------------------
interface LedgerEntry {
  key: string;
  verdict: 'exempt';
  reason: string;
}

const LEDGER: LedgerEntry[] = [
  {
    key: 'app/src/pages/comms/types.ts#EmailLogDetail.bodyHtml',
    verdict: 'exempt',
    reason:
      "DEC-833's own text is explicit that GET .../email-log/:emailId 'returns the full stored row' as the audit record ('it is shown as sent, including for a failed attempt') -- the route (src/routes/comms/email-log.ts) deliberately spreads the whole row rather than a narrowed projection, so deleting bodyHtml here would contradict the ruling's own full-row API contract. What DEC-833/DEC-846 mandate for DISPLAY is narrower: 'renders the stored subject and body verbatim' names bodyText only, and RecentSends.tsx's disclosure does exactly that -- rendering a second, HTML-vs-plaintext toggle inside the SPA's audit disclosure (the dev mailbox at src/routes/dev/mailbox.tsx already owns that view, unredacted, dev-only) is a distinct product surface no decision or design mock asks for.",
  },
  {
    key: 'app/src/pages/comms/types.ts#EmailLogDetail.icsText',
    verdict: 'exempt',
    reason:
      "same DEC-833 'full stored row is the audit record' rationale as bodyHtml above -- the API contract intentionally returns it, but no decision or design mock asks the SPA's 'Show what was sent' disclosure to render a raw ICS body or offer a download; that surface already exists, dev-only, at src/routes/dev/mailbox.tsx's calendar-invite download link.",
  },
  {
    key: 'app/src/pages/comms/types.ts#EmailLogDetail.icsFilename',
    verdict: 'exempt',
    reason:
      "same DEC-833 'full stored row' rationale as icsText immediately above -- it names the file icsText would download as, so it stands or falls with that field's own exemption; no SPA surface downloads the ICS body this filename would label.",
  },
  {
    key: 'app/src/pages/overview/types.ts#SpeakersAggregate.contactsOwing',
    verdict: 'exempt',
    reason:
      "DEC-370's own text names the v1 aggregate keys (including speakers, which carries this field) as 'RETAINED verbatim so the nav badge (DEC-369) and any other reader keep working' -- a payload-stability contract, not an oversight. overdueAssignments (this interface's sibling field) IS read by useNavExceptions.ts; contactsOwing has no design mock asking for a second, distinct roster-population number on Overview's nav badge or headline, so wiring one would be inventing a UI fact DEC-370 never asked for.",
  },
  {
    key: 'app/src/pages/overview/types.ts#ContentAggregate.awaitingApproval',
    verdict: 'exempt',
    reason:
      "same DEC-370 'v1 aggregate keys RETAINED verbatim' rationale as SpeakersAggregate.contactsOwing above -- content.awaitingApproval is one of the same named-and-retained v1 keys, kept for payload-contract stability rather than because a v2 screen currently displays it (contentApproval.total, a distinct v2 field, is what Overview's own worklist section reads instead).",
  },
  {
    key: 'app/src/pages/speakers/types.ts#OnboardingGridCounts.outstandingContacts',
    verdict: 'exempt',
    reason:
      "DEC-340 names counts:{speakers, outstandingRequired, overdue, outstandingContacts} as the binding GET .../onboarding wire contract, and DEC-776 rules outstandingContacts governs the SAME chase-predicate population as outstandingRequired/the portal task list -- it is a contractually-named aggregate, not a display number the header row was ever asked to print alongside 'N accepted / M tasks open / K overdue' (OnboardingGrid.tsx renders exactly those three, by DEC-776's own text).",
  },
  {
    key: 'app/src/pages/review/types.ts#ResultsRow.perCriterion',
    verdict: 'exempt',
    reason:
      "superseded by an existing design ruling, not an oversight: DEC-737 explicitly moved per-criterion detail off the results row (removing the 'column per rating criterion' spreadsheet) and INTO the per-review Reviews disclosure, which renders each evaluation's own criterion/score pairs from SubmissionEvaluationItem.criteria+scores instead -- this field's plan-wide MEAN per criterion has no design-sanctioned surface left to land on; inventing one is a product decision, not a missing wire-up.",
  },
  {
    key: 'app/src/pages/content/types.ts#DeliverableFile.contentType',
    verdict: 'exempt',
    reason:
      "no decision or design mock documents a UI obligation for a file's MIME type (unlike authorRole, which DEC-020's own header explicitly promised and this task wired) -- a content type is ordinarily spent server-side as the HTTP response header when a file is streamed/downloaded, not a fact a person reads on screen; inventing a text display for it is a product decision outside this task's narrow scope, flagged in this task's report rather than decided here.",
  },
  {
    key: 'app/src/pages/content/types.ts#DeliverableFile.uploadedByContactId',
    verdict: 'exempt',
    reason:
      "uploaderName already satisfies this row's author-attribution fact (DEC-020); the raw contact id carries no documented UI obligation, and this repo's authz invariant enforces every ownership-gated write server-side (never inferred client-side from an id sitting on a list row) -- inventing a client-side identity comparison here would be a product/security decision outside this task's narrow scope, flagged in this task's report rather than decided here.",
  },
  {
    key: 'app/src/pages/content/types.ts#EventFileChainItem.versionCount',
    verdict: 'exempt',
    reason:
      "DEC-902 explicitly rules this field OUT as the library's VERSION column value ('never versionCount, a chain-length marker') and names versionNo as the one that IS the identity shown -- no design mock or decision asks for a separate 'N versions in this chain' count display, so there is no documented UI obligation this task can wire a reader against without inventing new copy, which is a product decision outside this task's narrow scope.",
  },
];

describe('wire-field-reader.scan (DEC-851/DEC-358 w1-d): a declared response field with no reader is a lie', () => {
  const population = scanPopulation();

  // DEC-851 wave-5 amendment: the population is now a directory walk of all
  // nine app/src/pages/**/types.ts modules (was three, hand-listed) -- the
  // tripwire is raised proportionally (measured population is 645) so a
  // broken walk (e.g. one that silently falls back to zero, or only finds
  // a handful of pages) fails loudly instead of passing vacuously.
  it('tripwire: the nine app/src/pages/**/types.ts modules declare at least 500 response-shaped fields, never hardcoded', () => {
    expect(population.length).toBeGreaterThanOrEqual(500);
  });

  it('the excluded-interfaces list only names interfaces that actually exist in the target files (an exclusion for a dead name hides nothing)', () => {
    const allInterfaceNames = new Set<string>();
    for (const relFile of TARGET_FILES) {
      const src = readFileSync(join(ROOT, relFile), 'utf8');
      for (const decl of scanInterfaces(src)) allInterfaceNames.add(decl.name);
    }
    for (const name of Object.keys(EXCLUDED_INTERFACES)) {
      expect(allInterfaceNames.has(name), `excluded interface ${name} not found in any target file`).toBe(true);
    }
  });

  it('every excluded interface has a non-empty reason', () => {
    for (const [name, reason] of Object.entries(EXCLUDED_INTERFACES)) {
      expect(reason.trim().length, `excluded interface ${name} has an empty reason`).toBeGreaterThan(0);
    }
  });

  it("every population member the scan finds unread has exactly one ledger row, and no ledger row cites a field that reads clean (a ledger row exists ONLY for a real finding)", () => {
    const unread = population.filter((m) => !hasReader(m.field));
    const unreadKeys = new Set(unread.map((m) => m.key));

    const problems: string[] = [];
    for (const m of unread) {
      const count = LEDGER.filter((e) => e.key === m.key).length;
      if (count === 0) problems.push(`unread field with no ledger row: ${m.key}`);
      else if (count > 1) problems.push(`unread field with ${count} ledger rows (must be exactly 1): ${m.key}`);
    }
    for (const entry of LEDGER) {
      if (!unreadKeys.has(entry.key)) {
        problems.push(`ledger row cites a field that is NOT unread (stale row, or the fix already landed and the row wasn't deleted): ${entry.key}`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('every ledger row has a non-empty reason', () => {
    for (const entry of LEDGER) {
      expect(entry.reason.trim().length, `ledger row ${entry.key} has an empty reason`).toBeGreaterThan(0);
    }
  });

  it('the FileComment.authorRole finding is fixed: CommentThread.tsx now reads authorRole', () => {
    const files = candidateFiles();
    expect(hasReader('authorRole', files)).toBe(true);
    const commentThread = files.find((f) => f.path === 'app/src/pages/content/CommentThread.tsx');
    expect(commentThread, 'CommentThread.tsx not found under app/src').toBeTruthy();
    expect(commentThread!.src.includes('c.authorRole')).toBe(true);
  });

  it('the ReviewerQueueItem.ratingsCount finding is fixed: ReviewerQueue.tsx now reads ratingsCount (DEC-239/DEC-251 re-closure)', () => {
    const files = candidateFiles();
    expect(hasReader('ratingsCount', files)).toBe(true);
    const reviewerQueue = files.find((f) => f.path === 'app/src/pages/review/ReviewerQueue.tsx');
    expect(reviewerQueue, 'ReviewerQueue.tsx not found under app/src').toBeTruthy();
    expect(reviewerQueue!.src.includes('item.ratingsCount')).toBe(true);
  });

  it('latestFileVersionNo was deleted from ContentSubmissionListItem (the other real closure this task made -- server projection matched to the wire deletion)', () => {
    const src = readFileSync(join(ROOT, 'app/src/pages/content/types.ts'), 'utf8');
    const decl = scanInterfaces(src).find((d) => d.name === 'ContentSubmissionListItem');
    expect(decl).toBeTruthy();
    expect(decl!.fields).not.toContain('latestFileVersionNo');
    const serverSrc = readFileSync(join(ROOT, 'src/server/repo/submissions/list.ts'), 'utf8');
    // The server still computes the number as a LOCAL (it derives `reuploaded`
    // from it) but must not put it back on the wire object literal returned
    // to the client.
    expect(/^\s*latestFileVersionNo,\s*$/m.test(serverSrc)).toBe(false);
  });
});

describe('wire-field-reader.scan internals (negative controls, DEC-518 wave-35 amendment: every scan ships one)', () => {
  it('scanInterfaces finds a simple interface\'s top-level fields, ignoring a nested inline object type\'s own sub-fields', () => {
    const src = `
      export interface Simple {
        id: string;
        nested: { inner: number; other: string };
        optional?: boolean;
      }
    `;
    const decls = scanInterfaces(src);
    expect(decls).toHaveLength(1);
    expect(decls[0]!.name).toBe('Simple');
    expect(decls[0]!.fields).toEqual(['id', 'nested', 'optional']);
  });

  it('scanInterfaces does not fracture a generic type argument list on its internal commas/semicolons-free structure', () => {
    const src = `
      export interface WithGeneric {
        scores: Record<string, number | string>;
        perDropdown: Record<string, { counts: Record<string, number>; modal: string | null }>;
      }
    `;
    const decls = scanInterfaces(src);
    expect(decls[0]!.fields).toEqual(['scores', 'perDropdown']);
  });

  it('scanInterfaces handles `extends`', () => {
    const src = `
      export interface Base { id: string; }
      export interface Child extends Base {
        extra: number;
      }
    `;
    const decls = scanInterfaces(src);
    expect(decls.map((d) => d.name)).toEqual(['Base', 'Child']);
    expect(decls[1]!.fields).toEqual(['extra']);
  });

  it('hasReader finds a property-access reader', () => {
    const files = [{ path: 'a.tsx', src: 'function f(x: T) { return x.myField; }' }];
    expect(hasReader('myField', files)).toBe(true);
  });

  it('hasReader finds a destructure reader', () => {
    const files = [{ path: 'a.tsx', src: 'const { other, myField } = res;' }];
    expect(hasReader('myField', files)).toBe(true);
  });

  it('hasReader finds a quoted-string-key reader', () => {
    const files = [{ path: 'a.tsx', src: "const v = row['myField'];" }];
    expect(hasReader('myField', files)).toBe(true);
  });

  it('hasReader returns false when the field name never appears', () => {
    const files = [{ path: 'a.tsx', src: 'function f(x: T) { return x.otherField; }' }];
    expect(hasReader('myField', files)).toBe(false);
  });

  it('hasReader is not fooled by a field name that is only a substring of a longer identifier', () => {
    const files = [{ path: 'a.tsx', src: 'const myFieldExtra = 1; function f(x: T) { return x.myFieldWithSuffix; }' }];
    expect(hasReader('myField', files)).toBe(false);
  });
});
