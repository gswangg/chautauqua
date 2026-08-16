// DEC-518 wave-43 amendment: the SPA twin of test/mail-swallow-honesty.scan.test.ts
// (DEC-006 wave-51). That scan makes every catch around mailer.send( prove it
// surfaces its outcome or carries a ledgered reason; the SPA had no such rule
// and had drifted -- app/src/pages/Comms.tsx's recent-batches read and its
// DEC-905 seven-day totals read both ended in `.catch(() => undefined)`,
// leaving the page's own loading flags permanently false and its counts
// permanently zero, with nothing on screen saying so.
//
// This scan walks all of app/src/**/*.ts(x) (excluding *.test.* and the
// usual skip dirs -- widened from app/src/{pages,components} in the
// wave-76 amendment above), finds every `.catch(` handler on a promise
// chain, and
// classifies it SURFACING when its body names a setError/setLoadError/
// setPreviewError-style setter (any identifier matching /\bset\w*Error\w*\(/)
// or rethrows (`throw`). Every non-surfacing handler must appear in the
// KNOWN_SWALLOWS ledger below, keyed by file + a distinctive substring of the
// fetch call it guards (the URL template -- never a line number, so the
// ledger survives edits), with a one-line reason.
//
// Two-directional, same shape as test/mail-swallow-honesty.scan.test.ts: an
// unledgered, non-surfacing hit fails naming file + the fetch it guards; a
// ledger entry matching no hit fails as stale. Deliberately a lightweight
// brace/paren-matching text scan -- no parser dependency added.
//
// DEC-518 wave-76 amendment: the eight ledger rows carrying the placeholder
// reason "unreviewed — filed for a later wave" have been adjudicated --
// each either now names (a) what the user sees on failure and (b) why that
// rendering can never be misread as a real value, or the underlying swallow
// was fixed to surface (feed the page's existing error state, or render the
// area's absent state) and its row removed. This wave also widens the scan
// from app/src/{pages,components} to all of app/src (excluding *.test.*
// and the usual skip dirs), bringing app/src/lib under the rule;
// useNavExceptions.ts and useCurrentEvent.ts each already carried a
// written justification in a code comment at the catch site -- code
// unchanged, reason mirrored verbatim into the ledger below. (useMe.ts's
// only catch already rethrows non-401 errors, so the widened scan does not
// flag it.) The widening also surfaced one pre-existing unledgered hit
// inside pages/ that predates this wave (ContactDrawer.tsx's courtesy
// event-name lookup) -- ledgered below rather than left failing.

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..'); // app/src/.. /.. -> repo root
const APP_ROOT = join(__dirname); // app/src
// DEC-518 wave-76 amendment: widened from ['pages', 'components'] to all of
// app/src -- '.' walks the whole tree rooted at APP_ROOT.
const SCAN_DIRS = ['.'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.wrangler', 'build', '.git']);

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (stat.isFile() && /\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
}

// Same comment-stripping convention as test/serial-write-scan.test.ts:
// strips // and /* */ comments (replacing with spaces/blank, keeping
// newlines so line numbers stay meaningful) while leaving string/template
// literal contents untouched, so a comment that happens to contain
// `.catch(` or a URL-shaped string never fools the scan.
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === '/' && c2 === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && c2 === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\' && i + 1 < n) {
          out += (src[i] ?? '') + (src[i + 1] ?? '');
          i += 2;
          continue;
        }
        out += src[i] ?? '';
        i++;
      }
      if (i < n) {
        out += src[i];
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function matchParenBlock(src: string, openParenIdx: number): number {
  let depth = 1;
  let i = openParenIdx + 1;
  while (i < src.length && depth > 0) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') depth--;
    i++;
  }
  return i; // index just past the matching close paren
}

interface CatchHandler {
  start: number; // index of the `.catch(` match
  handlerText: string; // the raw argument text passed to .catch(
}

const CATCH_RE = /\.catch\(/g;

function findCatchHandlers(src: string): CatchHandler[] {
  const out: CatchHandler[] = [];
  const re = new RegExp(CATCH_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const openParenIdx = m.index + m[0].length - 1;
    const closeIdx = matchParenBlock(src, openParenIdx);
    out.push({ start: m.index, handlerText: src.slice(openParenIdx + 1, closeIdx - 1) });
  }
  return out;
}

// The population of "a fetch call" a .catch( might be guarding -- every
// call site the SPA is allowed to use to talk to the API (see
// app/src/lib/api.ts's own header comment: it is the ONLY module page code
// may call fetch() through, but a couple of call sites below still stub
// fetch() directly in tests, not product code, so this list stays scoped to
// the real client helpers).
const API_CALL_RE = /\b(?:apiList|apiGet|apiPost|apiPut|apiPatch|apiDelete|apiPostBlob|apiUpload)\s*(?:<[^>]*>)?\(/g;

interface ApiCall {
  start: number;
  argsText: string;
}

function findApiCalls(src: string): ApiCall[] {
  const out: ApiCall[] = [];
  const re = new RegExp(API_CALL_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const openParenIdx = m.index + m[0].length - 1;
    const closeIdx = matchParenBlock(src, openParenIdx);
    out.push({ start: m.index, argsText: src.slice(openParenIdx + 1, closeIdx - 1) });
  }
  return out;
}

// SURFACING: the handler body names a setError/setLoadError/setPreviewError
// -style setter (a "set...Error..." identifier called as a function) or
// rethrows. Everything else -- including a default-value setter like
// `setTracks([])` or a bare `undefined` -- is a swallow that must be
// ledgered (a default is not a guard: it looks identical to success).
const SURFACE_RE = /\bset\w*Error\w*\s*\(/;
const THROW_RE = /\bthrow\b/;

function handlerSurfacesOutcome(handlerText: string): boolean {
  return SURFACE_RE.test(handlerText) || THROW_RE.test(handlerText);
}

export interface SwallowHit {
  file: string; // repo-relative path
  fetchContext: string; // the raw args text of the nearest preceding API call this catch guards
}

/** Pure function over a single file's source text: every `.catch(` handler
 * in `fileText` that does not surface its outcome (per handlerSurfacesOutcome)
 * is a hit, paired with the nearest preceding API-call's argument text (the
 * fetch it guards) as `fetchContext`. `repoRelPath` only labels the result --
 * no filesystem access happens here, so this is what the negative-control
 * tests below feed synthetic snippets through directly. */
export function findSpaFetchSwallowHits(fileText: string, repoRelPath: string): SwallowHit[] {
  const stripped = stripComments(fileText);
  const catches = findCatchHandlers(stripped);
  const apiCalls = findApiCalls(stripped);

  const hits: SwallowHit[] = [];
  for (const c of catches) {
    if (handlerSurfacesOutcome(c.handlerText)) continue;
    // Nearest preceding API call in source order -- promise chains always
    // read call(...).then(...).catch(...), left to right.
    let nearest: ApiCall | undefined;
    for (const call of apiCalls) {
      if (call.start < c.start && (!nearest || call.start > nearest.start)) nearest = call;
    }
    hits.push({ file: repoRelPath, fetchContext: nearest?.argsText ?? '(no preceding api call found)' });
  }
  return hits;
}

function scanForSpaFetchSwallows(): SwallowHit[] {
  const files: string[] = [];
  for (const dir of SCAN_DIRS) {
    walk(join(APP_ROOT, dir), files);
  }

  const hits: SwallowHit[] = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    hits.push(...findSpaFetchSwallowHits(src, relative(ROOT, file).split('\\').join('/')));
  }
  return hits;
}

// The ledger. Every non-surfacing `.catch(` handler found by the scan must
// have exactly one entry here, matched on `file` + `marker` being a
// substring of the hit's `fetchContext` (stable across line-number drift --
// NEVER a line number). A hit with no matching entry fails the scan; an
// entry matching no hit fails as a stale ledger line.
const KNOWN_SWALLOWS: { file: string; marker: string; reason: string }[] = [
  {
    file: 'app/src/pages/Comms.tsx',
    marker: '/templates`',
    reason:
      'templatesById courtesy annotation (DEC-518 wave-43 amendment, left alone this wave): the template label is a courtesy annotation on an already-shown send record, not the record itself -- a failure to load the template list must not block or blank either Recent Sends mount.',
  },
  {
    file: 'app/src/pages/review/Scorecard.tsx',
    marker: '/tracks`',
    reason:
      'DEC-831: only worth a fetch when the plan actually restricts to a track subset -- a failed read leaves tracks empty, which renders the same as an unfiltered plan ("All tracks"), never a claim about which tracks exist.',
  },
  {
    file: 'app/src/pages/review/Scorecard.tsx',
    marker: 'queue?perPage=',
    reason:
      'DEC-939: independent of the submission-detail load above -- a failure here (or a route that cannot reach the queue endpoint) leaves queueProgress null, which renders no counter rather than a stale or fabricated one.',
  },
  {
    file: 'app/src/pages/speakers/RosterPanel.tsx',
    marker: '/contacts/duplicates/check',
    reason:
      'DEC-788: same advisory hint as NewContactModal below -- a failed check just clears duplicateMatch (no hint shown above the submit row), which never blocks Add and reads identically to "no duplicate found", the same truthful null the endpoint itself returns on a genuine miss.',
  },
  {
    file: 'app/src/pages/speakers/OnboardingGrid.tsx',
    marker: '/forms`',
    reason:
      'a failed fetch fails loudly IN the New-task modal: taskForms stays empty, which TaskModal renders as a disabled select plus an inline explanatory line and a blocked submit, rather than silently posting no formId.',
  },
  {
    file: 'app/src/pages/speakers/OnboardingGrid.tsx',
    marker: '/onboarding?page=1&perPage=200',
    reason:
      'DEC-746 (wave-59 amendment) subset-picker roster: same fail-loud-in-the-modal shape as the /forms fetch above. On failure the roster stays empty AND assigneesTruncated is set, so TaskModal offers only "Everyone accepted" and never renders an empty checkbox list that would read as "this event has no accepted speakers".',
  },
  {
    file: 'app/src/pages/forms/FormsPage.tsx',
    marker: '/submissions?perPage=1',
    reason:
      "Received count: a real read of the submissions list total, never a fabricated/derived number -- renders '—' (error state) while loading or on failure rather than a false zero.",
  },
  {
    file: 'app/src/pages/content/DeliverableDetail.tsx',
    marker: '/submissions/${submissionId}`',
    reason:
      'DEC-901: headerDetail stays null on a failed loadHeader() -- the header renders the title alone (subtitle and status band both absent), never a stale or fabricated subtitle/status carried over from a previous submission.',
  },
  {
    file: 'app/src/pages/contacts/NewContactModal.tsx',
    marker: '/contacts/duplicates/check',
    reason:
      'a failed check is not itself an error worth surfacing -- the duplicate hint is advisory, never a save blocker.',
  },
  {
    file: 'app/src/pages/contacts/BulkEmailModal.tsx',
    marker: '/templates`',
    reason:
      'the template picker is a convenience; failing to load it should not block composing a bulk email by hand.',
  },
  {
    file: 'app/src/pages/contacts/DuplicateEmailNotice.tsx',
    marker: '/contacts?q=',
    reason:
      "advisory only -- the 409 message already named the existing contact; a failed lookup just drops the link/actions.",
  },
  {
    file: 'app/src/pages/contacts/ContactsApp.tsx',
    marker: '(no preceding api call found)',
    reason:
      "DEC-662 amendment (wave 55): loadEventsOnce() import-target resolution -- a failed read leaves the opt-in checkbox's importEventId/importEventName unresolved, which the wizard renders as its normal unselected (CRM-only) state, the same fallback a genuinely unknown/deleted/foreign eventId already takes. It never guesses a different event and never shows a fabricated name.",
  },
  {
    file: 'app/src/pages/comms/RecentSends.tsx',
    marker: '/email-log?batchId=',
    reason:
      "surfaces via the per-batch `error` field in the recipients map (rendered by the disclosure row's own failure state), not a `setXError`-named setter -- this classifier's naming heuristic does not see it, but the failure is not silently swallowed.",
  },
  {
    file: 'app/src/pages/review/PlanEditor.tsx',
    marker: '/reviewers?perPage=',
    reason:
      'Reviewer roster is a nice-to-have on the editor; the plan itself still loaded, so this does not block the page on failing.',
  },
  {
    file: 'app/src/pages/review/PlanEditor.tsx',
    marker: '/progress`',
    reason: 'Same non-blocking treatment as the reviewer roster above -- rows still render with a bare email/no load count if this fails.',
  },
  {
    file: 'app/src/pages/review/PlanEditor.tsx',
    marker: "'/users?role=reviewer'",
    reason: 'Same non-blocking treatment as the reviewer roster above.',
  },
  {
    file: 'app/src/pages/review/ReviewerQueue.tsx',
    marker: '/queue?perPage=1',
    reason:
      'Scope/count are decoration on this row -- the row itself still links into the scoped queue, which does its own error handling.',
  },
  {
    file: 'app/src/pages/submissions/SubmissionDetailPage.tsx',
    marker: '`/events/${detail.eventId}`',
    reason:
      "DEC-743: the triage label degrades to its bare form (no dangling '· ') rather than surfacing a page-level error when the event's timezone can't be resolved, so failures here are swallowed deliberately (never fed into the page's error banner).",
  },
  {
    file: 'app/src/pages/submissions/SubmissionDetailPage.tsx',
    marker: '/submissions${buildSubmissionsQuery',
    reason:
      'DEC-761: a failed re-run of the list query sets listPosition to null, which renders no position/prev/next controls -- the identical rendering the success path already takes for a stale link whose id is not on the returned page (idx === -1), never a fabricated position or neighbour.',
  },
  {
    file: 'app/src/pages/submissions/SubmissionsTable.tsx',
    marker: '?status=pending&perPage=1',
    reason:
      "the independent \"N awaiting triage\" figure: a failed read sets pendingTotal to null, which the head summary renders by omitting the \" · N awaiting triage\" segment entirely -- never a fabricated zero or stale count, same absent-not-zero contract as FormsPage's Received count above.",
  },
  {
    file: 'app/src/lib/useNavExceptions.ts',
    marker: '/overview`',
    reason:
      "Fail loudly happens at the source (Overview page's own fetch); here in the shell, an unavailable count is absence of an exception, per DEC-369. (verbatim from the code comment at the catch site, moved into the ledger by the wave-76 scope widening.)",
  },
  {
    file: 'app/src/lib/useCurrentEvent.ts',
    marker: "'/events'",
    reason:
      'Fail soft: keep the id already in play. A network blip must not evict a valid selection. (verbatim from the code comment at the catch site -- background loadEventsOnce() reconciliation of an already-in-play eventId, moved into the ledger by the wave-76 scope widening. The nearest preceding fetch in source order is the module-level apiList(\'/events\') inside loadEventsOnce itself, not a call local to this catch.)',
  },
  {
    file: 'app/src/pages/contacts/ContactDrawer.tsx',
    marker: '/contacts/${contactId}',
    reason:
      "same loadEventsOnce() courtesy-name lookup as ContactsApp above: a failed read leaves currentEventName undefined, which the two FieldGroup labels render as their generic fallback ('On this event' / 'this event') rather than a wrong or stale event name -- never fed into the drawer's own load error, which is reserved for the contact fetch itself.",
  },
];

describe('spa-fetch-swallow-honesty scan negative control (DEC-518 wave-43 amendment)', () => {
  it('VIOLATION: a catch handler that swallows a fetch failure without surfacing it is reported', () => {
    const src = [
      "import { apiList } from '../lib/api';",
      'function useSomething(eventId) {',
      '  useEffect(() => {',
      "    apiList(`/events/${eventId}/mystery-endpoint`)",
      '      .then((res) => setThing(res.items))',
      '      .catch(() => undefined);',
      '  }, [eventId]);',
      '}',
    ].join('\n');
    const hits = findSpaFetchSwallowHits(src, 'app/src/pages/fixture.tsx');
    expect(hits.length).toBe(1);
    expect(hits[0]?.fetchContext).toContain('/mystery-endpoint');
  });

  it('COMPLIANT: a catch handler that calls a setError-style setter is silent', () => {
    const src = [
      "import { apiList, ApiError } from '../lib/api';",
      'function useSomething(eventId) {',
      '  useEffect(() => {',
      "    apiList(`/events/${eventId}/mystery-endpoint`)",
      '      .then((res) => setThing(res.items))',
      "      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Failed to load'));",
      '  }, [eventId]);',
      '}',
    ].join('\n');
    expect(findSpaFetchSwallowHits(src, 'app/src/pages/fixture.tsx')).toEqual([]);
  });

  it('COMPLIANT: a catch handler that rethrows is silent', () => {
    const src = [
      "import { apiList } from '../lib/api';",
      'function useSomething(eventId) {',
      '  useEffect(() => {',
      "    apiList(`/events/${eventId}/mystery-endpoint`)",
      '      .then((res) => setThing(res.items))',
      '      .catch((err) => { throw err; });',
      '  }, [eventId]);',
      '}',
    ].join('\n');
    expect(findSpaFetchSwallowHits(src, 'app/src/pages/fixture.tsx')).toEqual([]);
  });

  it('a comment containing `.catch(` text is not mistaken for a live handler', () => {
    const src = [
      "import { apiList } from '../lib/api';",
      'function useSomething(eventId) {',
      "  // this used to .catch(() => undefined) but no longer does",
      '  useEffect(() => {',
      "    apiList(`/events/${eventId}/mystery-endpoint`)",
      "      .then((res) => setThing(res.items))",
      "      .catch((err) => setLoadError(err.message));",
      '  }, [eventId]);',
      '}',
    ].join('\n');
    expect(findSpaFetchSwallowHits(src, 'app/src/pages/fixture.tsx')).toEqual([]);
  });
});

describe('SPA .catch( handlers surface their outcome or are ledgered (DEC-518 wave-43 amendment)', () => {
  it('the scan itself finds .catch( handlers under app/src (not vacuous)', () => {
    const files: string[] = [];
    for (const dir of SCAN_DIRS) walk(join(APP_ROOT, dir), files);
    expect(files.length).toBeGreaterThan(0);

    let totalCatches = 0;
    for (const file of files) {
      totalCatches += findCatchHandlers(stripComments(readFileSync(file, 'utf8'))).length;
    }
    // Tripwire: a broken regex that stopped matching would pass vacuously.
    expect(totalCatches).toBeGreaterThanOrEqual(40);
  });

  it('every non-surfacing .catch( handler is ledgered, and the ledger has at most 25 entries', () => {
    const hits = scanForSpaFetchSwallows();

    const offenders = hits.filter(
      (hit) => !KNOWN_SWALLOWS.some((entry) => entry.file === hit.file && hit.fetchContext.includes(entry.marker)),
    );

    expect(
      offenders,
      offenders
        .map(
          (o) =>
            `${o.file}: a .catch( handler guarding a fetch to ${JSON.stringify(o.fetchContext)} swallows the ` +
            `failure without surfacing it (no setError-family setter, no rethrow). Either route it into the ` +
            `page's existing error channel, or add a { file, marker, reason } line to KNOWN_SWALLOWS in ` +
            `app/src/spa-fetch-swallow-honesty.scan.test.ts (marker must be a substring of the fetch's URL ` +
            `template, never a line number).`,
        )
        .join('\n'),
    ).toEqual([]);

    expect(KNOWN_SWALLOWS.length, 'the ledger has grown past its 25-entry tripwire -- fix swallows instead of ledgering more of them').toBeLessThanOrEqual(
      25,
    );
  });

  it('every KNOWN_SWALLOWS ledger entry still matches a real, non-surfacing hit (no stale lines)', () => {
    const hits = scanForSpaFetchSwallows();
    const stale = KNOWN_SWALLOWS.filter(
      (entry) => !hits.some((hit) => hit.file === entry.file && hit.fetchContext.includes(entry.marker)),
    );

    expect(
      stale,
      stale
        .map(
          (entry) =>
            `${entry.file} / marker ${JSON.stringify(entry.marker)}: stale ledger entry -- delete this line ` +
            `(app/src/spa-fetch-swallow-honesty.scan.test.ts) -- no matching non-surfacing .catch( handler was found.`,
        )
        .join('\n'),
    ).toEqual([]);
  });
});
