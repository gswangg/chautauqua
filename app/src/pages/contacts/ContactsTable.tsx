import { useState } from 'react';
import type { ContactListItem, Segment, SegmentRule } from './types';
import { isPageFullySelected, isPagePartiallySelected, selectionReducer, type SelectionState } from './selection';
import { FilterRulesPanel } from './FilterRulesPanel';
import { AddToEventModal } from './AddToEventModal';

interface Props {
  items: ContactListItem[];
  total: number;
  page: number;
  perPage: number;
  q: string;
  rules: SegmentRule[];
  segmentId: string;
  segments: Segment[];
  selection: SelectionState;
  loading: boolean;
  onChangeQ: (q: string) => void;
  onChangeRules: (rules: SegmentRule[]) => void;
  onChangeSegment: (segmentId: string) => void;
  onChangePage: (page: number) => void;
  onSelectionChange: (selection: SelectionState) => void;
  onOpenContact: (id: string) => void;
}

export function ContactsTable({
  items,
  total,
  page,
  perPage,
  q,
  rules,
  segmentId,
  segments,
  selection,
  loading,
  onChangeQ,
  onChangeRules,
  onChangeSegment,
  onChangePage,
  onSelectionChange,
  onOpenContact,
}: Props) {
  const pageIds = items.map((item) => item.id);
  const [addToEventContact, setAddToEventContact] = useState<ContactListItem | null>(null);

  return (
    <div className="chq-contacts-table-wrap">
      <div className="chq-contacts-toolbar">
        <input
          type="search"
          placeholder="Search name, email, company..."
          aria-label="Search contacts"
          value={q}
          onChange={(e) => onChangeQ(e.target.value)}
        />
        <label>
          Segment
          <select aria-label="Segment filter" value={segmentId} onChange={(e) => onChangeSegment(e.target.value)}>
            <option value="">All contacts</option>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <FilterRulesPanel rules={rules} onChange={onChangeRules} />

      <table className="chq-contacts-table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                aria-label="Select all on page"
                checked={isPageFullySelected(selection, pageIds)}
                ref={(el) => {
                  if (el) el.indeterminate = isPagePartiallySelected(selection, pageIds);
                }}
                onChange={() => onSelectionChange(selectionReducer(selection, { type: 'TOGGLE_PAGE', pageIds }))}
              />
            </th>
            <th>Name</th>
            <th>Email</th>
            <th>Company</th>
            <th>Title</th>
            <th># Submissions</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={7}>Loading...</td>
            </tr>
          )}
          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={7}>No contacts match the current search/filter.</td>
            </tr>
          )}
          {!loading &&
            items.map((c) => (
              <tr key={c.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${c.firstName} ${c.lastName}`}
                    checked={selection.selectedIds.has(c.id)}
                    onChange={() => onSelectionChange(selectionReducer(selection, { type: 'TOGGLE_ROW', id: c.id }))}
                  />
                </td>
                <td>
                  <button type="button" className="chq-link-button" onClick={() => onOpenContact(c.id)}>
                    {c.firstName} {c.lastName}
                  </button>
                </td>
                <td>{c.email}</td>
                <td>{c.company ?? '—'}</td>
                <td>{c.title ?? '—'}</td>
                <td>{c.submissionCount ?? '—'}</td>
                <td>
                  <button type="button" onClick={() => setAddToEventContact(c)}>
                    Add to event…
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      {addToEventContact && (
        <AddToEventModal contact={addToEventContact} onClose={() => setAddToEventContact(null)} />
      )}

      <div className="chq-pagination">
        <button type="button" disabled={page <= 1} onClick={() => onChangePage(page - 1)}>
          Previous
        </button>
        <span>
          Page {page} &middot; {total} total
        </span>
        <button type="button" disabled={page * perPage >= total} onClick={() => onChangePage(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
