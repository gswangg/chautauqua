// DEC-505 (wave-55 amendment task-w55-b): "a refusal must reach the person
// who caused it" needs a DERIVED population, not a hand-picked one. This
// scan enumerates every non-test app/src/**/*.tsx file that calls one of
// the SPA's mutating API helpers (apiPost/apiPatch/apiPut/apiDelete/
// apiUpload/apiPostBlob -- the same call names DEC-505's task text names,
// generic-call-aware: `apiPost<Foo>(...)` counts), then checks a
// hand-transcribed LEDGER against that population in BOTH directions:
//
//   - no component in the population is missing a ledger row
//     ("unledgered component")
//   - no ledger row names a component that is no longer in the population
//     ("stale ledger row")
//
// A ledger row is one of:
//   - `proven`: names the test file that proves a server refusal's own
//     `message` (or a `fields`-map entry) reaches this component's DOM.
//     The test file must exist AND its source must actually import/render
//     the named component (existence-checked, not just filename-matched).
//   - `exempt`: the component is judged never to reach this obligation
//     (e.g. it never renders a mutation's failure at all). Its `reason`
//     must cite a DEC id (`DEC-\d+`) -- an exemption with no binding
//     ruling behind it is just an unimplemented test wearing a label.
//   - `owed`: known, tracked debt -- not yet proven, not exempt. Filed so
//     a future wave inherits a named population member, not a blank scan.
//
// Two synthetic negative controls (one per direction) prove the checker
// itself, not just today's ledger, actually catches a drift.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_SRC = HERE;

const MUTATING_CALL_RE =
  /\b(apiPost|apiPatch|apiPut|apiDelete|apiUpload|apiPostBlob)\s*(<[^>]*>)?\s*\(/;

/** Every non-test .tsx file under app/src (readdirSync recursive, same walk
 * app/src/server-bound-parity.scan.test.ts:18-27 uses). */
function allTsxFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.tsx')) continue;
    if (entry.name.includes('.test.')) continue;
    out.push(join(entry.parentPath, entry.name));
  }
  return out.sort();
}

/** True if `src` (the contents of a .tsx file at `path`) either calls a
 * mutating helper directly, or imports a local (relative-path) `use*` hook
 * module that itself calls one -- a custodian split (e.g.
 * TracksRoomsPanel.tsx -> tracksRooms/useTracksRoomsPanel.ts) can move the
 * mutating calls one hop away into a hook with no JSX of its own, and the
 * component that renders the hook's state is still the DOM-proof site DEC-
 * 505 asks about. One hop only -- deep enough for a hook, not a general
 * call-graph walker. */
function callsMutatingHelper(path: string, src: string): boolean {
  if (MUTATING_CALL_RE.test(src)) return true;
  const importRe = /^import\s+(?:type\s+)?\{[^}]*\buse[A-Za-z0-9]*\b[^}]*\}\s+from\s+['"](\.[^'"]+)['"]/gm;
  for (const match of src.matchAll(importRe)) {
    const specifier = match[1]!;
    for (const candidate of [`${specifier}.ts`, `${specifier}.tsx`, `${specifier}/index.ts`]) {
      const resolved = join(dirname(path), candidate);
      if (!existsSync(resolved)) continue;
      if (MUTATING_CALL_RE.test(readFileSync(resolved, 'utf-8'))) return true;
    }
  }
  return false;
}

/** The derived population: every non-test .tsx file that calls a mutating
 * API helper, as a path relative to app/src (posix-style, so the ledger's
 * keys are stable across machines). */
function derivePopulation(root: string): string[] {
  const out: string[] = [];
  for (const path of allTsxFiles(root)) {
    const src = readFileSync(path, 'utf-8');
    if (callsMutatingHelper(path, src)) {
      out.push(path.slice(root.length + 1).split('\\').join('/'));
    }
  }
  return out.sort();
}

type LedgerEntry =
  | { verdict: 'proven'; test: string }
  | { verdict: 'exempt'; reason: string }
  | { verdict: 'owed'; reason: string };

// ---------------------------------------------------------------------------
// THE LEDGER. Every key must be (and only be) a population member -- see the
// two directional tests below. `proven` rows are the components with a
// dedicated `*-refusal-shapes.*test.*` file already proving a server
// refusal's own message/fields reach this component's DOM. Everything else
// is `owed`: DEC-505 asks for the derived population and the highest-value
// fix (TracksRoomsPanel) this wave, not full coverage in one pass.
// ---------------------------------------------------------------------------
const LEDGER: Record<string, LedgerEntry> = {
  'pages/settings/EmbedsPanel.tsx': {
    verdict: 'proven',
    test: 'pages/settings/EmbedsPanel-refusal-shapes.render.test.tsx',
  },
  'pages/settings/SavedEmbedsPanel.tsx': {
    verdict: 'proven',
    test: 'pages/settings/SavedEmbedsPanel-refusal-shapes.render.test.tsx',
  },
  'pages/settings/TracksRoomsPanel.tsx': {
    verdict: 'proven',
    test: 'pages/settings/TracksRoomsPanel-refusal-shapes.render.test.tsx',
  },
  'pages/contacts/PipelineBoard.tsx': {
    verdict: 'proven',
    test: 'pages/contacts/PipelineBoard-refusal-shapes.render.test.tsx',
  },
  'pages/contacts/ImportWizard.tsx': {
    verdict: 'proven',
    test: 'pages/contacts/ImportWizard-refusal-shapes.render.test.tsx',
  },
  // DEC-505 wave-13 amendment (task-w13-a): compose-refusal-shapes.test.ts
  // is a legitimate SOURCE-grep (it proves every fields-map shape gets a
  // named resolution branch in ComposeWizard.tsx) but it never renders the
  // component, so it cannot prove a server refusal reaches the DOM. The DOM
  // proof lives in the new render test below.
  'pages/comms/ComposeWizard.tsx': {
    verdict: 'proven',
    test: 'pages/comms/ComposeWizard-refusal-shapes.render.test.tsx',
  },
  'pages/review/PlanEditor.tsx': {
    verdict: 'proven',
    test: 'pages/review/planEditor-refusal-shapes.test.ts',
  },

  // DEC-099 (wave-76 amendment): re-derived against main. The `?cascade=1`
  // refusal UI is present (FormsPage.tsx PATCH- and DELETE-side conflict
  // confirms). FormsPage.edit-cascade.render.test.tsx proves the server's
  // own conflict message reaches the DOM for the PATCH-side edit-cascade
  // confirm, but the DELETE-side conflict confirm (deleteConfirm.conflict
  // Message / "Delete field anyway") has no such proof yet -- filed owed
  // with the same generic reason its siblings carry.
  'pages/forms/FormsPage.tsx': {
    verdict: 'owed',
    reason: 'wave-55 ledger established; refusal-shapes test not yet written',
  },

  'components/EventSwitcher.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/Agenda.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/agenda/BreaksPanel.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/comms/TemplatesTab.tsx': {
    verdict: 'proven',
    test: 'pages/comms/TemplatesTab-refusal-shapes.render.test.tsx',
  },
  'pages/contacts/AddToEventModal.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/contacts/BulkEmailModal.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/contacts/ContactDrawer.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/contacts/ContactsApp.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/contacts/DuplicateEmailNotice.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/contacts/DuplicatesView.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/contacts/MergePage.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/contacts/NewContactModal.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/contacts/SegmentsPanel.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/content/ContentApp.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/content/DeliverableDetail.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/content/FilesLibrary.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/content/VersionList.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/Overview.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/overview/AgendaWorkSection.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/review/ProgressPanel.tsx': {
    verdict: 'proven',
    test: 'pages/review/ProgressPanel-refusal-shapes.render.test.tsx',
  },
  'pages/review/ResultsTable.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/review/ReviewerQueue.tsx': {
    verdict: 'proven',
    test: 'pages/review/ReviewerQueue-refusal-shapes.render.test.tsx',
  },
  'pages/review/Scorecard.tsx': {
    verdict: 'proven',
    test: 'pages/review/Scorecard-refusal-shapes.render.test.tsx',
  },
  'pages/settings/ApiTokensPanel.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/settings/CallForPapersPanel.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/settings/EventSettingsPanel.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/settings/PeopleRolesPanel.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/settings/PortalSettingsPanel.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/settings/ResourcesPanel.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/settings/SessionboardImportPanel.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/speakers/OnboardingGrid.tsx': {
    verdict: 'proven',
    test: 'pages/speakers/OnboardingGrid-refusal-shapes.render.test.tsx',
  },
  'pages/speakers/RosterPanel.tsx': {
    verdict: 'proven',
    test: 'pages/speakers/RosterPanel-refusal-shapes.render.test.tsx',
  },
  'pages/speakers/SpeakerDetailPage.tsx': {
    verdict: 'proven',
    test: 'pages/speakers/SpeakerDetailPage-refusal-shapes.render.test.tsx',
  },
  'pages/speakers/TaskView.tsx': {
    verdict: 'proven',
    test: 'pages/speakers/TaskView-refusal-shapes.render.test.tsx',
  },
  'pages/submissions/DeleteSubmissionsPage.tsx': {
    verdict: 'proven',
    test: 'pages/submissions/DeleteSubmissionsPage-refusal-shapes.render.test.tsx',
  },
  'pages/submissions/SubmissionDetailPage.tsx': {
    verdict: 'proven',
    test: 'pages/submissions/SubmissionDetailPage-refusal-shapes.render.test.tsx',
  },
  'pages/submissions/SubmissionsTable.tsx': {
    verdict: 'proven',
    test: 'pages/submissions/SubmissionsTable-refusal-shapes.render.test.tsx',
  },
  'pages/submissions/ViewTabs.tsx': {
    verdict: 'proven',
    test: 'pages/submissions/ViewTabs-refusal-shapes.render.test.tsx',
  },
};

/** Population members with no ledger row at all. */
function findUnledgered(population: string[], ledgerKeys: string[]): string[] {
  const known = new Set(ledgerKeys);
  return population.filter((p) => !known.has(p));
}

/** Ledger rows naming a component no longer in the population. */
function findStaleLedgerRows(population: string[], ledgerKeys: string[]): string[] {
  const live = new Set(population);
  return ledgerKeys.filter((k) => !live.has(k));
}

const DEC_ID_RE = /DEC-\d+/;

/** Finds every `errorEnvelope(...)` call in `src` and returns each call's
 * full character span `[start, end)` (start at `errorEnvelope`, end at the
 * matching close-paren) alongside the raw argument-list text between the
 * parens. Paren-balancing is quote-aware (a `(` or `)` inside a string
 * literal never counts), matching the balanced-paren extraction style
 * `compose-refusal-shapes.test.ts` already uses for its own source slices. */
function findErrorEnvelopeCalls(src: string): { start: number; end: number; args: string }[] {
  const calls: { start: number; end: number; args: string }[] = [];
  const CALL_RE = /errorEnvelope\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = CALL_RE.exec(src))) {
    const openParenIdx = m.index + m[0].length - 1;
    let depth = 1;
    let i = openParenIdx + 1;
    let quote: string | null = null;
    for (; i < src.length && depth > 0; i++) {
      const ch = src[i];
      if (quote) {
        if (ch === '\\') {
          i++; // skip escaped char
        } else if (ch === quote) {
          quote = null;
        }
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
      } else if (ch === '(') {
        depth++;
      } else if (ch === ')') {
        depth--;
      }
    }
    const end = i; // one past the matching close-paren
    calls.push({ start: m.index, end, args: src.slice(openParenIdx + 1, end - 1) });
  }
  return calls;
}

/** Every quoted string literal (single or double quoted, non-empty) found
 * in `text`, unquoted. */
function stringLiterals(text: string): string[] {
  const LITERAL_RE = /'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = LITERAL_RE.exec(text))) {
    const lit = m[1] ?? m[2] ?? '';
    if (lit.trim().length > 0) out.push(lit);
  }
  return out;
}

/** Returns a human-readable reason a `proven` citation FAILS the DOM-proof
 * bar, or `null` if it passes. The bar: at least one `errorEnvelope(...)`
 * call exists, and at least one quoted string literal inside that call's
 * argument list (the server's own `message` or one of its `fields` values)
 * reoccurs verbatim OUTSIDE every errorEnvelope call span in the same file
 * (i.e. in an assertion, not just in the mock setup echoing itself). */
function provenReasonNotSatisfied(testSrc: string): string | null {
  const calls = findErrorEnvelopeCalls(testSrc);
  if (calls.length === 0) return 'contains no errorEnvelope( call';

  const outsideCallsText = calls
    .slice()
    .sort((a, b) => a.start - b.start)
    .reduceRight((remaining, call) => remaining.slice(0, call.start) + remaining.slice(call.end), testSrc);

  const carriedLiterals = new Set(calls.flatMap((c) => stringLiterals(c.args)));
  for (const literal of carriedLiterals) {
    if (outsideCallsText.includes(literal)) return null;
  }
  return 'has no errorEnvelope(...) string literal asserted verbatim outside the call itself';
}

describe('refusal-rendering ledger: every mutating SPA component maps to a proof or a filed gap (DEC-505)', () => {
  const population = derivePopulation(APP_SRC);
  const ledgerKeys = Object.keys(LEDGER);

  it('derived a non-trivial population', () => {
    expect(population.length).toBeGreaterThan(20);
  });

  it('no population member is missing a ledger row (unledgered component)', () => {
    const missing = findUnledgered(population, ledgerKeys);
    expect(missing, `components calling a mutating API helper with no ledger row:\n${missing.join('\n')}`).toEqual(
      [],
    );
  });

  it('no ledger row names a component outside the derived population (stale ledger row)', () => {
    const stale = findStaleLedgerRows(population, ledgerKeys);
    expect(stale, `ledger rows naming a component no longer in the population:\n${stale.join('\n')}`).toEqual([]);
  });

  it('every `proven` row cites a test file that exists, references the named component, calls errorEnvelope(, and asserts one of its own string literals verbatim elsewhere in the file', () => {
    const offenders: string[] = [];
    for (const [component, entry] of Object.entries(LEDGER)) {
      if (entry.verdict !== 'proven') continue;
      const testPath = join(APP_SRC, entry.test);
      if (!existsSync(testPath)) {
        offenders.push(`${component}: cited test ${entry.test} does not exist`);
        continue;
      }
      const testSrc = readFileSync(testPath, 'utf-8');
      const componentName = component.split('/').pop()!.replace(/\.tsx$/, '');
      if (!testSrc.includes(componentName)) {
        offenders.push(`${component}: cited test ${entry.test} never references ${componentName}`);
        continue;
      }
      const reason = provenReasonNotSatisfied(testSrc);
      if (reason) offenders.push(`${component}: cited test ${entry.test} ${reason}`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('every `exempt` row names a DEC id in its reason', () => {
    const offenders: string[] = [];
    for (const [component, entry] of Object.entries(LEDGER)) {
      if (entry.verdict !== 'exempt') continue;
      if (!DEC_ID_RE.test(entry.reason)) {
        offenders.push(`${component}: exempt reason cites no DEC id: "${entry.reason}"`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('every `owed` row carries a non-empty reason', () => {
    const offenders: string[] = [];
    for (const [component, entry] of Object.entries(LEDGER)) {
      if (entry.verdict !== 'owed') continue;
      if (entry.reason.trim().length === 0) offenders.push(component);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Synthetic negative controls -- prove the two directional checkers
  // actually catch drift, not just that today's ledger happens to balance.
  // -------------------------------------------------------------------------
  it('[negative control] the unledgered-component checker flags a population member with no row', () => {
    const syntheticPopulation = ['pages/real/Known.tsx', 'pages/real/NewlyAdded.tsx'];
    const syntheticLedgerKeys = ['pages/real/Known.tsx'];
    expect(findUnledgered(syntheticPopulation, syntheticLedgerKeys)).toEqual(['pages/real/NewlyAdded.tsx']);
    // ...and does NOT false-positive when every member has a row.
    expect(findUnledgered(syntheticPopulation, [...syntheticLedgerKeys, 'pages/real/NewlyAdded.tsx'])).toEqual([]);
  });

  it('[negative control] the stale-row checker flags a ledger row for a component no longer in the population', () => {
    const syntheticPopulation = ['pages/real/StillThere.tsx'];
    const syntheticLedgerKeys = ['pages/real/StillThere.tsx', 'pages/real/Deleted.tsx'];
    expect(findStaleLedgerRows(syntheticPopulation, syntheticLedgerKeys)).toEqual(['pages/real/Deleted.tsx']);
    // ...and does NOT false-positive when every row still lives.
    expect(findStaleLedgerRows(syntheticPopulation, ['pages/real/StillThere.tsx'])).toEqual([]);
  });

  it('[negative control] the mutating-call detector matches a generic call and ignores an import-only line', () => {
    const withGenericCall = `await apiPost<Foo>('/x', body);`;
    expect(MUTATING_CALL_RE.test(withGenericCall)).toBe(true);
    const importOnly = `import { apiPost } from '../../lib/api';`;
    expect(MUTATING_CALL_RE.test(importOnly)).toBe(false);
  });

  it('[negative control] the proven-row predicate flags a fixture whose mock string never re-appears, and does not flag a conforming one', () => {
    // A source-grep style fixture: mocks an errorEnvelope but only ever
    // asserts a DIFFERENT string against the DOM -- exactly the shape
    // compose-refusal-shapes.test.ts was cited under before this wave (zero
    // `render(` calls, so nothing downstream of the mock is ever checked).
    //
    // NB (merge-time, DEC-817): the mockApi key inside these fixture strings
    // must name a REAL registered route. test/spa-mock-route-contract.scan
    // text-greps every app/src test file for `'METHOD /path':` keys and does
    // not know a string literal is a fixture, so a synthetic path here
    // (`POST /api/v1/x`) reads as a stale mock and fails that scan. The
    // predicate under test ignores the path entirely, so any live route does.
    const nonConforming = `
      const body = errorEnvelope('invalid', 'A server message never re-asserted', { foo: 'also never re-asserted' });
      mockApi({ 'POST /api/v1/contacts': { status: 400, body } });
      render(createElement(Widget));
      expect(screen.getByText('Widget')).toBeInTheDocument();
    `;
    expect(provenReasonNotSatisfied(nonConforming)).not.toBeNull();

    // A conforming fixture: one of the errorEnvelope literals (a fields
    // value here) is asserted verbatim against the rendered DOM elsewhere
    // in the file, exactly like TracksRoomsPanel-refusal-shapes and the new
    // ComposeWizard-refusal-shapes.render.test.tsx.
    const conforming = `
      const body = errorEnvelope('invalid', 'Validation failed', { name: 'S1 - Intro to Rust' });
      mockApi({ 'POST /api/v1/contacts': { status: 400, body } });
      render(createElement(Widget));
      expect(await screen.findByText('S1 - Intro to Rust')).toBeInTheDocument();
    `;
    expect(provenReasonNotSatisfied(conforming)).toBeNull();

    // A pure source-grep fixture (zero errorEnvelope calls at all) is
    // flagged too -- the exact shape the old ComposeWizard citation was.
    const sourceGrepOnly = `
      const source = readFileSync('ComposeWizard.tsx', 'utf8');
      expect(source).toContain("'no eligible recipients'");
    `;
    expect(provenReasonNotSatisfied(sourceGrepOnly)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// KNOWN_OWED: every ledger key whose verdict is `owed`, hand-transcribed and
// checked in both directions against the ledger itself -- modelled on
// test/clarifications-ledger.scan.test.ts:490-498. Sibling lanes that clear
// a row from `owed` to `proven`/`exempt` must delete that row's key here too
// (a merge-time touch-up, same as the ledger row itself).
// ---------------------------------------------------------------------------
const KNOWN_OWED: string[] = [
  'components/EventSwitcher.tsx',
  'pages/Agenda.tsx',
  'pages/Overview.tsx',
  'pages/agenda/BreaksPanel.tsx',
  'pages/contacts/AddToEventModal.tsx',
  'pages/contacts/BulkEmailModal.tsx',
  'pages/contacts/ContactDrawer.tsx',
  'pages/contacts/ContactsApp.tsx',
  'pages/contacts/DuplicateEmailNotice.tsx',
  'pages/contacts/DuplicatesView.tsx',
  'pages/contacts/MergePage.tsx',
  'pages/contacts/NewContactModal.tsx',
  'pages/contacts/SegmentsPanel.tsx',
  'pages/content/ContentApp.tsx',
  'pages/content/DeliverableDetail.tsx',
  'pages/content/FilesLibrary.tsx',
  'pages/content/VersionList.tsx',
  'pages/forms/FormsPage.tsx',
  'pages/overview/AgendaWorkSection.tsx',
  'pages/review/ResultsTable.tsx',
  'pages/settings/ApiTokensPanel.tsx',
  'pages/settings/CallForPapersPanel.tsx',
  'pages/settings/EventSettingsPanel.tsx',
  'pages/settings/PeopleRolesPanel.tsx',
  'pages/settings/PortalSettingsPanel.tsx',
  'pages/settings/ResourcesPanel.tsx',
  'pages/settings/SessionboardImportPanel.tsx',
].sort();

describe('KNOWN_OWED tracks exactly the ledger rows verdict `owed` (DEC-180 wave-13 amendment)', () => {
  const owedRowKeys = Object.entries(LEDGER)
    .filter(([, entry]) => entry.verdict === 'owed')
    .map(([component]) => component)
    .sort();

  it('is itself sorted (a diff-stable population, not a hand-ordered list)', () => {
    expect(KNOWN_OWED).toEqual([...KNOWN_OWED].sort());
  });

  it('every `owed` ledger row is present in KNOWN_OWED', () => {
    const known = new Set(KNOWN_OWED);
    const missing = owedRowKeys.filter((k) => !known.has(k));
    expect(missing, `owed rows missing from KNOWN_OWED:\n${missing.join('\n')}`).toEqual([]);
  });

  it('every KNOWN_OWED entry names a ledger row whose verdict is actually `owed`', () => {
    const owed = new Set(owedRowKeys);
    const stale = KNOWN_OWED.filter((k) => !owed.has(k));
    expect(stale, `KNOWN_OWED entries with no matching \`owed\` ledger row:\n${stale.join('\n')}`).toEqual([]);
  });
});
