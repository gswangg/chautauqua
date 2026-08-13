import type { ContactListItem } from './types';
import { isPageFullySelected, isPagePartiallySelected, selectionReducer, type SelectionState } from './selection';
import { DelayedLoading } from '../../components/DelayedLoading';

interface Props {
  items: ContactListItem[];
  total: number;
  page: number;
  perPage: number;
  selection: SelectionState;
  loading: boolean;
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
  onChangePage,
  onSelectionChange,
  onOpenContact,
  onBulkEmail,
}: Props) {
  const pageIds = items.map((item) => item.id);
  const selectedCount = selection.selectedIds.size;

  return (
    <div className="chq-contacts-table-wrap">
      {selectedCount > 0 && (
        <div className="chq-bulkbar" role="toolbar" aria-label="Bulk actions">
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
      )}

      <table className="chq-table chq-contacts-table">
        <thead>
          <tr>
            <th>
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
            <th>Company</th>
            <th>Labels</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={5}>
                <DelayedLoading />
              </td>
            </tr>
          )}
          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={5}>No contacts match the current search/filter.</td>
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
                <td>
                  <div className="chq-contacts-company-cell">
                    <span>{c.company ?? '—'}</span>
                    <span className="chq-meta">{c.title ?? '—'}</span>
                  </div>
                </td>
                <td>
                  {c.labels.length > 0 ? (
                    <ul className="chq-contacts-label-chips">
                      {c.labels.map((label) => (
                        <li key={label} className="chq-contacts-label-chip">
                          {label}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="chq-meta">—</span>
                  )}
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

      <div className="chq-pager">
        <button type="button" className="chq-btn chq-btn-secondary" disabled={page <= 1} onClick={() => onChangePage(page - 1)}>
          Previous
        </button>
        <span>
          Showing {items.length === 0 ? 0 : (page - 1) * perPage + 1}&ndash;{(page - 1) * perPage + items.length} of {total}
        </span>
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
  );
}
