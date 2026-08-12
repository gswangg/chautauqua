import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiGet, apiList, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { BulkEmailModal } from './BulkEmailModal';
import { ContactDrawer } from './ContactDrawer';
import { ContactsTable } from './ContactsTable';
import { DuplicatesView } from './DuplicatesView';
import { ImportWizard } from './ImportWizard';
import { NewContactModal } from './NewContactModal';
import { PipelineBoard } from './PipelineBoard';
import { EMPTY_SELECTION, selectionReducer } from './selection';
import { SegmentsPanel } from './SegmentsPanel';
import { StatsStrip } from './StatsStrip';
import type { ContactListItem, ContactStats, Segment, SegmentRule } from './types';

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

// DEC-684: after a merge, MergePage navigates back to /contacts with
// { state: { panel: 'duplicates', notice: 'Contacts merged.' } } so the
// directory lands on the Duplicates tab with the merge confirmation — a
// one-shot read, captured on the render that mounts this component and
// cleared immediately after so a later tab switch never replays it.
interface NavState {
  panel?: Panel;
  notice?: string;
}

export function ContactsApp() {
  const { eventId } = useCurrentEvent();
  const location = useLocation();
  const navigate = useNavigate();
  const navState = location.state as NavState | null;

  const [panel, setPanel] = useState<Panel>(navState?.panel ?? 'directory');
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
    // stale merge confirmation.
    if (navState) navigate(location.pathname, { replace: true, state: null });
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

  // Factual, endpoint-backed summary (DEC-377): only counts GET
  // /contacts/stats actually returns — no fabricated "N speakers" or
  // "N possible duplicates" figures the way the design mock illustrates.
  const summary = stats
    ? `${stats.total} ${stats.total === 1 ? 'contact' : 'contacts'} · ${stats.eventCount} ${
        stats.eventCount === 1 ? 'event' : 'events'
      } · ${stats.returningSpeakers} returning ${stats.returningSpeakers === 1 ? 'speaker' : 'speakers'}`
    : null;

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

      {/* DEC-684: list search sits in the toolbar, directly under the
          title — not buried inside the table component. First control in
          this row, ahead of any other filter control that lands here. */}
      <div className="chq-toolbar chq-contacts-search-toolbar">
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
      </div>

      <div className="chq-toolbar chq-contacts-tabstrip-row">
        <div className="chq-chipstrip" role="tablist" aria-label="Contacts view">
          {(Object.keys(PANEL_LABELS) as Panel[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={panel === key}
              className={panel === key ? 'chq-pill is-active' : 'chq-pill'}
              onClick={() => setPanel(key)}
            >
              {PANEL_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {panel === 'directory' && (
        <>
          <StatsStrip
            stats={stats}
            onCompanyClick={(company) => {
              // CRM-12 drill-through: the top-companies click applies a
              // {field:'company',op:'eq'} filter rule (DEC-149), replacing the
              // active rule set so the directory shows exactly that company.
              setRules([{ field: 'company', op: 'eq', value: company }]);
              setPage(1);
            }}
          />

          <ContactsTable
            items={items}
            total={total}
            page={page}
            perPage={PER_PAGE}
            rules={rules}
            segmentId={segmentId}
            segments={segments}
            selection={selection}
            loading={loading}
            onChangeRules={(next) => {
              setRules(next);
              setPage(1);
            }}
            onChangeSegment={(next) => {
              setSegmentId(next);
              setPage(1);
            }}
            onChangePage={setPage}
            onSelectionChange={setSelection}
            onOpenContact={setOpenContactId}
            onBulkEmail={() => setShowBulkEmail(true)}
          />
        </>
      )}

      {panel === 'duplicates' && <DuplicatesView onMerged={reload} initialNotice={navState?.notice} />}

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
