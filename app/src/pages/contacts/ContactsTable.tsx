import type { ContactListItem } from './types';
import { isPageFullySelected, isPagePartiallySelected, selectionReducer, type SelectionState } from './selection';
import { PageSkeleton } from '../../components/PageSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { paginationSummary } from '../../lib/pagination-summary';

/** B7 rule 6 (DEC-678): ContactsTable is presentational, so ContactsApp
 * computes which of the two voices applies from the facets it holds (search
 * text, selected segment, filter rules, company-rail selection) and hands
 * down exactly one reason + one onClear -- the table itself never inspects
 * filter state. */
export interface ContactsTableEmpty {
  variant: 'fresh' | 'filtered';
  reason?: string;
  onClear?: () => void;
}

interface Props {
  items: ContactListItem[];
  total: number;
  page: number;
  perPage: number;
  selection: SelectionState;
  loading: boolean;
  empty: ContactsTableEmpty;
  onChangePage: (page: number) => void;
  onSelectionChange: (selection: SelectionState) => void;
  onOpenContact: (id: string) => void;
  onBulkEmail: () => void;
}

export function ContactsTable({
  items,
  total,
  page,
  perPage,
  selection,
  loading,
  empty,
  onChangePage,
  onSelectionChange,
  onOpenContact,
  onBulkEmail,
}: Props) {
  const pageIds = items.map((item) => item.id);
  const selectedCount = selection.selectedIds.size;
  const settledEmpty = !loading && items.length === 0;

  return (
    <div className="chq-contacts-table-wrap">
      {/* User-filed: always mounted — idle keeps the space so selecting
          never shifts the table (see .chq-bulkbar-idle). */}
      <div
        className={selectedCount > 0 ? 'chq-bulkbar' : 'chq-bulkbar chq-bulkbar-idle'}
        role="toolbar"
        aria-label="Bulk actions"
        aria-hidden={selectedCount === 0 ? 'true' : undefined}
      >
          <span className="chq-bulkbar-count">{selectedCount} selected</span>
          <span className="chq-bulkbar-note">Kept across pages · sent in batches of 100</span>
          <div className="chq-bulkbar-actions">
            <button type="button" className="chq-btn chq-btn-primary" onClick={onBulkEmail}>
              Bulk email ({selectedCount})
            </button>
            <button
              type="button"
              className="chq-btn chq-btn-tertiary"
              onClick={() => onSelectionChange(selectionReducer(selection, { type: 'CLEAR' }))}
            >
              Clear selection
            </button>
          </div>
        </div>

      {settledEmpty ? (
        <EmptyState
          variant={empty.variant}
          what={empty.variant === 'fresh' ? 'No contacts yet.' : 'No contacts match the current search/filter.'}
          reason={empty.variant === 'filtered' ? empty.reason : undefined}
          action={empty.variant === 'fresh' ? null : undefined}
          escape={
            empty.variant === 'filtered' && empty.onClear ? { label: 'Clear filter', onClick: empty.onClear } : null
          }
        />
      ) : (
        <table className="chq-table chq-contacts-table">
          <thead>
            <tr>
              <th className="chq-contacts-col-select">
                <input
                  className="chq-check"
                  type="checkbox"
                  aria-label="Select all on page"
                  checked={isPageFullySelected(selection, pageIds)}
                  ref={(el) => {
                    if (el) el.indeterminate = isPagePartiallySelected(selection, pageIds);
                  }}
                  onChange={() => onSelectionChange(selectionReducer(selection, { type: 'TOGGLE_PAGE', pageIds }))}
                />
              </th>
              <th>Name and email</th>
              <th className="chq-contacts-col-company">Company</th>
              <th className="chq-contacts-col-labels">Labels</th>
              <th className="chq-contacts-col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {/* DEC-678 (wave-3/wave-8, proven by app/src/admin-first-paint.
                render.test.tsx): the directory table is Contacts' main region,
                so its wait paints shaped placeholder rows on the FIRST frame --
                a 250ms-withheld DelayedLoading here left column headers over an
                empty body on every first load. */}
            {loading && (
              <tr>
                <td colSpan={5}>
                  <PageSkeleton variant="table" label="Loading contacts…" />
                </td>
              </tr>
            )}
            {!loading &&
              items.map((c) => (
                <tr key={c.id} className="chq-contacts-row">
                  <td>
                    <input
                      className="chq-check"
                      type="checkbox"
                      aria-label={`Select ${c.firstName} ${c.lastName}`}
                      checked={selection.selectedIds.has(c.id)}
                      onChange={() => onSelectionChange(selectionReducer(selection, { type: 'TOGGLE_ROW', id: c.id }))}
                    />
                  </td>
                  <td>
                    <div className="chq-contacts-name-cell">
                      <button type="button" className="chq-link-button chq-contacts-name" onClick={() => onOpenContact(c.id)}>
                        {c.firstName} {c.lastName}
                      </button>
                      <span className="chq-meta">{c.email}</span>
                    </div>
                  </td>
                  <td data-label="Company">
                    <div className="chq-contacts-company-cell">
                      <span>{c.company ?? '—'}</span>
                      <span className="chq-meta">{c.title ?? '—'}</span>
                    </div>
                  </td>
                  <td data-label="Labels">
                    {/* DEC-738 amendment (wave 4): the server-formatted `key
                        value` strings render as plain small-caps meta, joined
                        by ' - ' — the bordered-chip chrome is gone, no
                        formatting logic moves to the client. */}
                    <span className="chq-meta chq-contacts-labels-meta">
                      {c.labels.length > 0 ? c.labels.join(' - ') : '—'}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => onOpenContact(c.id)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}

      {/* DEC-711 amendment (wave 4): "Showing 1-25 of 39" sits as one
          left-hand group; [Previous][Next] sit together on the right — the
          shared .chq-pager's justify-content:space-between (styles.css)
          spreads these two DOM children (span, then the nav group) to the
          row's ends without any pager-specific CSS change. */}
      {/* DEC-678 amendment (B7 rule 5, wave 53): a FRESH zero-state hides
          the pager -- 'Showing 0 of 0' with Prev/Next under a block that
          says the directory has never held a row is chrome over nothing. A
          FILTERED zero-state keeps it: chrome is how a filter gets undone. */}
      {!(settledEmpty && empty.variant === 'fresh') && (
        <div className="chq-pager">
          <span>{paginationSummary(page, perPage, total, items.length)}</span>
          <div className="chq-contacts-pager-nav">
            <button type="button" className="chq-btn chq-btn-secondary" disabled={page <= 1} onClick={() => onChangePage(page - 1)}>
              Previous
            </button>
            <button
              type="button"
              className="chq-btn chq-btn-secondary"
              disabled={page * perPage >= total}
              onClick={() => onChangePage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
