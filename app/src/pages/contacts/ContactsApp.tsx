import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet, apiList, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { BulkEmailModal } from './BulkEmailModal';
import { ContactDrawer } from './ContactDrawer';
import { ContactsTable } from './ContactsTable';
import { DirectoryRail } from './DirectoryRail';
import { DuplicatesView } from './DuplicatesView';
import { FilterRulesPanel } from './FilterRulesPanel';
import { ImportWizard } from './ImportWizard';
import { NewContactModal } from './NewContactModal';
import { PipelineBoard } from './PipelineBoard';
import { EMPTY_SELECTION, selectionReducer } from './selection';
import { SegmentsPanel } from './SegmentsPanel';
import type { ContactListItem, ContactStats, DuplicateGroup, Segment, SegmentRule } from './types';
import { DEC_710, DEC_711 } from '../../../../src/decisions';

// Compile-checked dependency markers: tab selection as ?tab= URL state
// (DEC-710) and the two-column directory (table + rail, every figure
// endpoint-backed — DEC-711).
void DEC_710;
void DEC_711;

// DEC-711: the rail's "Possible duplicates" section names its top pairs —
// bounded to a small preview, never the full Duplicates-tab list.
const RAIL_DUPLICATE_PREVIEW = 3;

const PER_PAGE = 25;

/** DEC-671: the CSV export sits beside a filtered directory, so it must
 * carry the same q/segmentId/rules filter the directory table is showing —
 * mirrors SubmissionsTable.tsx's exportHref for the submissions list. */
function contactsExportHref(
  eventId: string,
  filters: { q: string; segmentId: string; rules: SegmentRule[] },
): string {
  const params = new URLSearchParams();
  if (filters.q.trim() !== '') params.set('q', filters.q.trim());
  if (filters.segmentId !== '') params.set('segmentId', filters.segmentId);
  if (filters.rules.length > 0) params.set('rules', JSON.stringify(filters.rules));
  params.set('format', 'csv');
  return `/api/v1/events/${eventId}/export/contacts?${params.toString()}`;
}

type Panel = 'directory' | 'duplicates' | 'segments' | 'pipeline';

const PANEL_LABELS: Record<Panel, string> = {
  directory: 'Directory',
  duplicates: 'Duplicates',
  segments: 'Segments',
  pipeline: 'Pipeline',
};

function isPanel(value: string | null): value is Panel {
  return value === 'duplicates' || value === 'segments' || value === 'pipeline';
}

// DEC-684: after a merge, MergePage navigates back to /contacts with
// { state: { panel: 'duplicates', notice: 'Contacts merged.' } } so the
// directory lands on the Duplicates tab with the merge confirmation — a
// one-shot read, captured on the render that mounts this component and
// cleared immediately after so a later tab switch never replays it.
interface NavState {
  panel?: Panel;
  notice?: string;
  // DEC-734: MergePage's footer 'Not a duplicate' navigates back the same
  // one-shot way a merge does, naming the pair to drop from this session's
  // Duplicates list.
  dismissPairIds?: string[];
}

export function ContactsApp() {
  const { eventId } = useCurrentEvent();
  const location = useLocation();
  const navigate = useNavigate();
  const navState = location.state as NavState | null;
  const [searchParams, setSearchParams] = useSearchParams();

  // DEC-710: tab selection is URL state (?tab=), never component state —
  // 'directory' (the default) carries no tab param.
  const panel: Panel = isPanel(searchParams.get('tab')) ? (searchParams.get('tab') as Panel) : 'directory';
  function setPanel(next: Panel) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next === 'directory') params.delete('tab');
      else params.set('tab', next);
      return params;
    });
  }

  const [stats, setStats] = useState<ContactStats | null>(null);
  const [items, setItems] = useState<ContactListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [rules, setRules] = useState<SegmentRule[]>([]);
  const [segmentId, setSegmentId] = useState('');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selection, setSelection] = useState(EMPTY_SELECTION);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicatePreview, setDuplicatePreview] = useState<DuplicateGroup[]>([]);

  const [openContactId, setOpenContactId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showNewContact, setShowNewContact] = useState(false);
  const [showBulkEmail, setShowBulkEmail] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function reload() {
    setRefreshKey((k) => k + 1);
  }

  useEffect(() => {
    // Clear the one-shot nav state (panel + notice) immediately after
    // mount so switching away from Duplicates and back never replays a
    // stale merge confirmation. MergePage still hands the target panel via
    // location.state (DEC-684) — this folds it into the URL's ?tab= once,
    // on the render that mounts this component.
    if (navState) {
      const params = new URLSearchParams(location.search);
      if (navState.panel && navState.panel !== 'directory') params.set('tab', navState.panel);
      const qs = params.toString();
      navigate(`${location.pathname}${qs ? `?${qs}` : ''}`, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // DEC-788: a "Possible duplicate: <Name>" hint on the New contact modal
  // links to `?openContact=<id>` so the link survives a full reload rather
  // than depending on in-memory drawer state — read once on mount, same
  // one-shot pattern as navState above, then stripped from the URL.
  useEffect(() => {
    const openContact = searchParams.get('openContact');
    if (openContact) {
      setOpenContactId(openContact);
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.delete('openContact');
          return params;
        },
        { replace: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    apiGet<ContactStats>('/contacts/stats')
      .then(setStats)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load stats'));
  }, [refreshKey]);

  useEffect(() => {
    apiList<Segment>('/segments')
      .then((res) => setSegments(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load segments'));
  }, [refreshKey]);

  // DEC-711: the rail's duplicate preview reuses the SAME endpoint the
  // Duplicates tab lists from (findDuplicateGroupsForOrg's own order),
  // bounded to a small page rather than a second definition of "top pairs".
  useEffect(() => {
    apiList<DuplicateGroup>(`/contacts/duplicates?perPage=${RAIL_DUPLICATE_PREVIEW}`)
      .then((res) => setDuplicatePreview(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load duplicates'));
  }, [refreshKey]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('perPage', String(PER_PAGE));
    if (q.trim() !== '') params.set('q', q.trim());
    if (segmentId !== '') params.set('segmentId', segmentId);
    if (rules.length > 0) params.set('rules', JSON.stringify(rules));
    apiList<ContactListItem>(`/contacts?${params.toString()}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load contacts'))
      .finally(() => setLoading(false));
  }, [page, q, rules, segmentId, refreshKey]);

  const selectedIds = [...selection.selectedIds];

  // DEC-710/DEC-711: the mock's title summary ("N people · N speakers · N
  // possible duplicates") — every figure is now endpoint-backed
  // (speakerCount/duplicateCount added to GET /contacts/stats), no longer
  // the DEC-377 substitute summary.
  const summary = stats ? `${stats.total} people · ${stats.speakerCount} speakers · ${stats.duplicateCount} possible duplicates` : null;

  return (
    <div className="chq-page chq-contacts-page">
      <div className="chq-contacts-title-row">
        <h1 className="chq-page-title">Contacts</h1>
        {summary && <span className="chq-summary">{summary}</span>}
        <div className="chq-contacts-title-actions">
          {eventId && (
            <a
              className="chq-btn chq-btn-secondary"
              href={contactsExportHref(eventId, { q, segmentId, rules })}
            >
              Export CSV
            </a>
          )}
          <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setShowImport(true)}>
            Import CSV
          </button>
          <button type="button" className="chq-btn chq-btn-primary" onClick={() => setShowNewContact(true)}>
            New contact
          </button>
        </div>
      </div>

      {error && <div className="chq-error" role="alert">{error}</div>}

      {/* DEC-710: tab chips carry counts; search + the segment control sit
          at the RIGHT end of this same row (margin-left:auto), replacing
          the search-only toolbar row that used to sit above it. */}
      <div className="chq-toolbar chq-contacts-tabstrip-row">
        <div className="chq-chipstrip" role="tablist" aria-label="Contacts view">
          {(Object.keys(PANEL_LABELS) as Panel[]).map((key) => {
            let label = PANEL_LABELS[key];
            if (key === 'duplicates' && stats) label = `${label} · ${stats.duplicateCount}`;
            if (key === 'segments') label = `${label} · ${segments.length}`;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={panel === key}
                className={panel === key ? 'chq-pill is-active' : 'chq-pill'}
                onClick={() => setPanel(key)}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* eval-findings 55 / DEC-710/DEC-711: search + segment filter only affect the
            directory list, so they sit at the right end of THIS row but
            only while the Directory tab is active — otherwise they'd shadow
            the identically-named options SegmentsPanel renders on its own
            tab. */}
        {panel === 'directory' && (
          <div className="chq-contacts-tab-filters">
            <input
              className="chq-input chq-contacts-search"
              type="search"
              placeholder="Search name, email or company…"
              aria-label="Search contacts"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
            <label className="chq-contacts-segment-summary">
              Segment:
              {/* aria-label stays "Segment filter" — the name the applied-segment
                  control has carried since it lived in ContactsTable (task-w17-d
                  moved it onto this row). */}
              <select
                className="chq-select"
                aria-label="Segment filter"
                value={segmentId}
                onChange={(e) => {
                  setSegmentId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">none</option>
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      {panel === 'directory' && (
        <div className="chq-contacts-directory-grid">
          <div className="chq-contacts-directory-main">
            {/* DEC-787: the multi-facet filter builder feeds the SAME
                `rules` state already sent to GET /contacts and to
                contactsExportHref, so the table, the count and the CSV all
                follow for free. */}
            <FilterRulesPanel
              rules={rules}
              onChange={(next) => {
                setRules(next);
                setPage(1);
              }}
            />

            <ContactsTable
              items={items}
              total={total}
              page={page}
              perPage={PER_PAGE}
              selection={selection}
              loading={loading}
              onChangePage={setPage}
              onSelectionChange={setSelection}
              onOpenContact={setOpenContactId}
              onBulkEmail={() => setShowBulkEmail(true)}
            />
          </div>

          <DirectoryRail
            topCompanies={stats?.topCompanies ?? []}
            onCompanyClick={(company) => {
              // CRM-12 drill-through + DEC-787: the top-companies click
              // ADDS or REPLACES ONLY the company rule, leaving every other
              // active rule (from FilterRulesPanel) standing — a rail click
              // composes with the filter, it never replaces it wholesale.
              setRules((prev) => [
                ...prev.filter((r) => r.field !== 'company'),
                { field: 'company', op: 'eq', value: company },
              ]);
              setPage(1);
            }}
            segments={segments}
            onApplySegment={(next) => {
              setSegmentId(next);
              setPage(1);
            }}
            onSaveCurrentFilters={() => setPanel('segments')}
            duplicateCount={stats?.duplicateCount ?? 0}
            duplicatePreview={duplicatePreview}
          />
        </div>
      )}

      {panel === 'duplicates' && (
        <DuplicatesView onMerged={reload} initialNotice={navState?.notice} initialDismissPairIds={navState?.dismissPairIds} />
      )}

      {panel === 'segments' && (
        <SegmentsPanel
          segments={segments}
          activeFilters={{ q, rules }}
          activeSegmentId={segmentId}
          onDeletedActiveSegment={() => {
            // Clear the applied segment (and its query-param filter state)
            // BEFORE reload() bumps refreshKey, so the directory's
            // contacts-list effect never refetches with the now-deleted
            // segmentId (P3 fix, w1-c).
            setSegmentId('');
            setPage(1);
          }}
          onChanged={() => {
            reload();
          }}
        />
      )}

      {panel === 'pipeline' && <PipelineBoard />}

      {openContactId && (
        <ContactDrawer
          contactId={openContactId}
          onClose={() => setOpenContactId(null)}
          onSaved={() => {
            setOpenContactId(null);
            reload();
          }}
          onContactChanged={() => {
            // DEC-574: reload the list (fresh headshot thumbnail) WITHOUT
            // closing the drawer — an upload must not discard unsaved
            // bio/notes/custom-field edits sitting in the still-open drawer.
            reload();
          }}
        />
      )}

      {showNewContact && (
        <NewContactModal
          onClose={() => setShowNewContact(false)}
          onCreated={() => {
            setShowNewContact(false);
            reload();
          }}
        />
      )}

      {showImport && (
        <ImportWizard
          onClose={() => setShowImport(false)}
          onImported={() => {
            reload();
          }}
        />
      )}

      {showBulkEmail && (
        <BulkEmailModal
          contactIds={selectedIds}
          eventId={eventId}
          onClose={() => {
            setShowBulkEmail(false);
            setSelection((s) => selectionReducer(s, { type: 'CLEAR' }));
          }}
        />
      )}
    </div>
  );
}
