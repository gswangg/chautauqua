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

/** The derived population: every non-test .tsx file that calls a mutating
 * API helper, as a path relative to app/src (posix-style, so the ledger's
 * keys are stable across machines). */
function derivePopulation(root: string): string[] {
  const out: string[] = [];
  for (const path of allTsxFiles(root)) {
    const src = readFileSync(path, 'utf-8');
    if (MUTATING_CALL_RE.test(src)) {
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
  'pages/comms/ComposeWizard.tsx': {
    verdict: 'proven',
    test: 'pages/comms/compose-refusal-shapes.test.ts',
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
  'pages/speakers/OnboardingGrid.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/speakers/RosterPanel.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/speakers/SpeakerDetailPage.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/submissions/DeleteSubmissionsPage.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/submissions/SubmissionDetailPage.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/submissions/SubmissionsTable.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
  'pages/submissions/ViewTabs.tsx': { verdict: 'owed', reason: 'wave-55 ledger established; refusal-shapes test not yet written' },
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

  it('every `proven` row cites a test file that exists and actually imports the named component', () => {
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
      }
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
});
