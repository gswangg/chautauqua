import { useEffect, useState } from 'react';
import { apiGet, apiList, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { BulkEmailModal } from './BulkEmailModal';
import { ContactDrawer } from './ContactDrawer';
import { ContactsTable } from './ContactsTable';
import { DuplicatesView } from './DuplicatesView';
import { ImportWizard } from './ImportWizard';
import { EMPTY_SELECTION, selectionReducer } from './selection';
import { SegmentsPanel } from './SegmentsPanel';
import { StatsStrip } from './StatsStrip';
import type { ContactListItem, ContactStats, Segment } from './types';

const PER_PAGE = 25;

type Panel = 'directory' | 'duplicates' | 'segments';

export function ContactsApp() {
  const { eventId } = useCurrentEvent();

  const [panel, setPanel] = useState<Panel>('directory');
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [items, setItems] = useState<ContactListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [segmentId, setSegmentId] = useState('');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selection, setSelection] = useState(EMPTY_SELECTION);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openContactId, setOpenContactId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showBulkEmail, setShowBulkEmail] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  function reload() {
    setRefreshKey((k) => k + 1);
  }

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
    apiList<ContactListItem>(`/contacts?${params.toString()}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load contacts'))
      .finally(() => setLoading(false));
  }, [page, q, segmentId, refreshKey]);

  const selectedIds = [...selection.selectedIds];

  return (
    <div className="chq-page chq-contacts-page">
      <h1>Contacts</h1>
      {error && <div className="chq-error-banner">{error}</div>}

      <nav className="chq-contacts-subnav">
        <button type="button" className={panel === 'directory' ? 'chq-tab-active' : ''} onClick={() => setPanel('directory')}>
          Directory
        </button>
        <button type="button" className={panel === 'duplicates' ? 'chq-tab-active' : ''} onClick={() => setPanel('duplicates')}>
          Duplicates
        </button>
        <button type="button" className={panel === 'segments' ? 'chq-tab-active' : ''} onClick={() => setPanel('segments')}>
          Segments
        </button>
        <button type="button" onClick={() => setShowImport(true)}>
          Import CSV
        </button>
        <button type="button" disabled={selectedIds.length === 0} onClick={() => setShowBulkEmail(true)}>
          Bulk email ({selectedIds.length})
        </button>
      </nav>

      {panel === 'directory' && (
        <>
          <StatsStrip stats={stats} />

          <ContactsTable
            items={items}
            total={total}
            page={page}
            perPage={PER_PAGE}
            q={q}
            segmentId={segmentId}
            segments={segments}
            selection={selection}
            loading={loading}
            onChangeQ={(next) => {
              setQ(next);
              setPage(1);
            }}
            onChangeSegment={(next) => {
              setSegmentId(next);
              setPage(1);
            }}
            onChangePage={setPage}
            onSelectionChange={setSelection}
            onOpenContact={setOpenContactId}
          />
        </>
      )}

      {panel === 'duplicates' && <DuplicatesView onMerged={reload} />}

      {panel === 'segments' && (
        <SegmentsPanel
          segments={segments}
          activeFilters={{ q, company: '' }}
          onChanged={() => {
            reload();
          }}
        />
      )}

      {openContactId && (
        <ContactDrawer
          contactId={openContactId}
          onClose={() => setOpenContactId(null)}
          onSaved={() => {
            setOpenContactId(null);
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
