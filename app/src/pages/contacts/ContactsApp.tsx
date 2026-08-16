import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet, apiList, apiPost, ApiError } from '../../lib/api';
import { loadEventsOnce, useCurrentEvent } from '../../lib/useCurrentEvent';
import { countOf } from '../../lib/plural';
import { BulkEmailModal } from './BulkEmailModal';
import { ContactDrawer } from './ContactDrawer';
import { ContactsTable, type ContactsTableEmpty } from './ContactsTable';
import { DirectoryRail } from './DirectoryRail';
import { DuplicatesView } from './DuplicatesView';
import { FilterRulesPanel } from './FilterRulesPanel';
import { ImportWizard } from './ImportWizard';
import { NewContactModal } from './NewContactModal';
import { PipelineBoard } from './PipelineBoard';
import { EMPTY_SELECTION, selectionReducer } from './selection';
import { activeRules } from './segments';
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
  const rules = activeRules(filters.rules);
  if (rules.length > 0) params.set('rules', JSON.stringify(rules));
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
  // Amendment (wave 41): the ONE /contacts/duplicates request this page
  // makes carries its own `total` — the rail count, the Duplicates tab
  // label and the title summary all read THIS state, never a second
  // duplicateCount computed by GET /contacts/stats (that endpoint no
  // longer scans the whole directory to produce one).
  const [duplicateTotal, setDuplicateTotal] = useState(0);
  // DEC-678: settled flags for the two rail lists whose emptiness is
  // otherwise indistinguishable from "not back yet" (stats covers the third:
  // it is null until GET /contacts/stats settles).
  const [segmentsLoaded, setSegmentsLoaded] = useState(false);
  const [duplicatesLoaded, setDuplicatesLoaded] = useState(false);

  const [openContactId, setOpenContactId] = useState<string | null>(null);
  // DEC-827: Speakers links into the importer with ?import=1 (the toolbar's
  // "Import CSV" button shares this same opener/URL-state path, so there is
  // one way in, not two). The param is deleted the moment the wizard closes
  // so a later navigation (e.g. browser back) can never replay it.
  const showImport = searchParams.get('import') === '1';
  function openImport() {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('import', '1');
      return params;
    });
  }
  function closeImport() {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete('import');
      return params;
    });
  }

  // DEC-662 amendment (wave 55): the Speakers roster's importer link carries
  // its event as ?eventId=<id> (distinct from the page's own "current
  // event" state, which the toolbar's Import CSV keeps using unchanged) so
  // the wizard preselects the SAME event the organizer was standing on,
  // never a silent switch to whatever event the page happens to be showing.
  // An id that doesn't resolve against this org's own /events list (unknown,
  // deleted, another org) falls back to the wizard's normal unselected
  // (CRM-only) state -- it never guesses a different event.
  const urlImportEventId = searchParams.get('eventId');
  const [importEventId, setImportEventId] = useState<string | undefined>(undefined);
  // DEC-290 (wave-59 amendment): the opt-in checkbox names the event, so
  // the same loadEventsOnce list this effect already resolves
  // importEventId against also supplies the display name -- no second
  // fetch.
  const [importEventName, setImportEventName] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!urlImportEventId) {
      if (!eventId) {
        setImportEventId(undefined);
        setImportEventName(undefined);
        return;
      }
      let cancelled = false;
      loadEventsOnce()
        .then((items) => {
          if (cancelled) return;
          setImportEventId(eventId);
          setImportEventName(items.find((item) => item.id === eventId)?.name);
        })
        .catch(() => {
          if (!cancelled) {
            setImportEventId(eventId);
            setImportEventName(undefined);
          }
        });
      return () => {
        cancelled = true;
      };
    }
    let cancelled = false;
    loadEventsOnce()
      .then((items) => {
        if (cancelled) return;
        const known = items.find((item) => item.id === urlImportEventId);
        setImportEventId(known ? urlImportEventId : undefined);
        setImportEventName(known?.name);
      })
      .catch(() => {
        if (!cancelled) {
          setImportEventId(undefined);
          setImportEventName(undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [urlImportEventId, eventId]);
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
    setError(null);
    apiGet<ContactStats>('/contacts/stats')
      .then(setStats)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load stats'));
  }, [refreshKey]);

  useEffect(() => {
    setError(null);
    apiList<Segment>('/segments')
      .then((res) => setSegments(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load segments'))
      .finally(() => setSegmentsLoaded(true));
  }, [refreshKey]);

  // DEC-711: the rail's duplicate preview reuses the SAME endpoint the
  // Duplicates tab lists from (findDuplicateGroupsForOrg's own order),
  // bounded to a small page rather than a second definition of "top pairs".
  useEffect(() => {
    setError(null);
    apiList<DuplicateGroup>(`/contacts/duplicates?perPage=${RAIL_DUPLICATE_PREVIEW}`)
      .then((res) => {
        setDuplicatePreview(res.items);
        setDuplicateTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load duplicates'))
      .finally(() => setDuplicatesLoaded(true));
  }, [refreshKey]);

  // DEC-734 amendment (wave 2): the rail's Keep both persists the SAME
  // POST /contacts/duplicates/dismiss the tab's DuplicatesView uses, so the
  // pair stays dismissed across reload no matter which mount dismissed it.
  // Optimistic: drop the row from duplicatePreview and decrement
  // duplicateTotal immediately, then roll both back loudly if the persist
  // fails.
  function railKeepBoth(group: DuplicateGroup) {
    setDuplicatePreview((prev) => prev.filter((g) => g.contactIds.join(',') !== group.contactIds.join(',')));
    setDuplicateTotal((prev) => Math.max(0, prev - 1));
    apiPost('/contacts/duplicates/dismiss', { contactIds: group.contactIds }).catch((err) => {
      setDuplicatePreview((prev) => [...prev, group]);
      setDuplicateTotal((prev) => prev + 1);
      setError(err instanceof ApiError ? err.message : 'Failed to dismiss pair');
    });
  }

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('perPage', String(PER_PAGE));
    if (q.trim() !== '') params.set('q', q.trim());
    if (segmentId !== '') params.set('segmentId', segmentId);
    const activeRuleSet = activeRules(rules);
    if (activeRuleSet.length > 0) params.set('rules', JSON.stringify(activeRuleSet));
    apiList<ContactListItem>(`/contacts?${params.toString()}`)
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load contacts'))
      .finally(() => setLoading(false));
  }, [page, q, rules, segmentId, refreshKey]);

  const selectedIds = [...selection.selectedIds];

  // B7 rule 6 (DEC-678): the directory table is presentational, so THIS page
  // decides fresh vs. filtered from the facets it already holds. Checked in
  // a fixed order (search, then segment, then the rail's company rule, then
  // any other FilterRulesPanel rule) so exactly one reason ever shows, and
  // its escape clears only that one facet.
  function computeContactsEmpty(): ContactsTableEmpty {
    const trimmedQ = q.trim();
    if (trimmedQ !== '') {
      return {
        variant: 'filtered',
        reason: `Search "${trimmedQ}"`,
        onClear: () => {
          setQ('');
          setPage(1);
        },
      };
    }
    if (segmentId !== '') {
      const segmentName = segments.find((s) => s.id === segmentId)?.name;
      return {
        variant: 'filtered',
        reason: segmentName ? `Segment "${segmentName}"` : 'Segment filter',
        onClear: () => {
          setSegmentId('');
          setPage(1);
        },
      };
    }
    const companyRule = rules.find((r) => r.field === 'company' && r.value.trim() !== '');
    if (companyRule) {
      return {
        variant: 'filtered',
        reason: `Company "${companyRule.value}"`,
        onClear: () => {
          setRules((prev) => prev.filter((r) => r.field !== 'company'));
          setPage(1);
        },
      };
    }
    if (activeRules(rules).length > 0) {
      return {
        variant: 'filtered',
        reason: 'Filter rules',
        onClear: () => {
          setRules([]);
          setPage(1);
        },
      };
    }
    return { variant: 'fresh' };
  }

  // DEC-432/DEC-809: the title summary is `N people · M speakers ·
  // [R returning] · [across E events] · K possible duplicates` — the
  // returning clause renders ONLY when returningSpeakers > 0 and the reach
  // clause ONLY when eventCount > 1, so a single-event org renders exactly
  // the three-clause frame while a real multi-event org is told what its
  // bench is worth. Built with the shared countOf helper, never bespoke
  // pluralisation.
  const summary = stats
    ? [
        countOf(stats.total, 'person', 'people'),
        countOf(stats.speakerCount, 'speaker'),
        stats.returningSpeakers > 0 ? `${countOf(stats.returningSpeakers, 'returning speaker')}` : null,
        stats.eventCount > 1 ? `across ${countOf(stats.eventCount, 'event')}` : null,
        countOf(duplicateTotal, 'possible duplicate'),
      ]
        .filter((clause): clause is string => clause !== null)
        .join(' · ')
    : null;

  return (
    <div className="chq-page chq-contacts-page chq-measure-table">
      <div className="chq-contacts-title-row">
        <h1 className="chq-page-title">Contacts</h1>
        {summary && <span className="chq-summary">{summary}</span>}
        {/* DEC-711 amendment (wave 4): the action cluster orders Import /
            Export / New. */}
        <div className="chq-contacts-title-actions">
          <button type="button" className="chq-btn chq-btn-secondary" onClick={openImport}>
            Import CSV
          </button>
          {eventId && (
            <a
              className="chq-btn chq-btn-secondary"
              href={contactsExportHref(eventId, { q, segmentId, rules })}
            >
              Export CSV
            </a>
          )}
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
            if (key === 'duplicates') label = `${label} · ${duplicateTotal}`;
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
              matchCount={total}
              totalCount={stats?.total ?? null}
              onSaveAsSegment={() => setPanel('segments')}
            />

            <ContactsTable
              items={items}
              total={total}
              page={page}
              perPage={PER_PAGE}
              selection={selection}
              loading={loading}
              empty={computeContactsEmpty()}
              onChangePage={setPage}
              onSelectionChange={setSelection}
              onOpenContact={setOpenContactId}
              onBulkEmail={() => setShowBulkEmail(true)}
            />
          </div>

          <DirectoryRail
            topCompanies={stats?.topCompanies ?? []}
            topCompaniesLoaded={stats !== null}
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
            segmentsLoaded={segmentsLoaded}
            onApplySegment={(next) => {
              setSegmentId(next);
              setPage(1);
            }}
            onSaveCurrentFilters={() => setPanel('segments')}
            duplicateCount={duplicateTotal}
            duplicatePreview={duplicatePreview}
            duplicatesLoaded={duplicatesLoaded}
            onKeepBoth={railKeepBoth}
          />
        </div>
      )}

      {panel === 'duplicates' && (
        <DuplicatesView onMerged={reload} initialNotice={navState?.notice} initialDismissPairIds={navState?.dismissPairIds} />
      )}

      {panel === 'segments' && (
        <SegmentsPanel
          segments={segments}
          activeFilters={{ q, rules: activeRules(rules) }}
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
          eventId={importEventId}
          eventName={importEventName}
          onClose={closeImport}
          onImported={() => {
            reload();
          }}
        />
      )}

      {showBulkEmail && (
        <BulkEmailModal
          contactIds={selectedIds}
          eventId={eventId}
          recipientNames={items
            .filter((c) => selection.selectedIds.has(c.id))
            .map((c) => `${c.firstName} ${c.lastName}`.trim())}
          onClose={() => {
            setShowBulkEmail(false);
            setSelection((s) => selectionReducer(s, { type: 'CLEAR' }));
          }}
        />
      )}
    </div>
  );
}
