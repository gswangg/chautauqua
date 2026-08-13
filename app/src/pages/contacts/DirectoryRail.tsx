// Directory right rail (eval-findings items 22 + 55, DEC-710/DEC-711): the
// mock's two-column architecture (docs/design/Chautauqua Contacts.dc.html
// lines 52-150) puts three stacked sections beside the directory table —
// "Where they work" (top companies, drill-through into the same
// {field:'company',op:'eq'} rule the CRM-12 dashboard used), "Saved
// segments" (name + one-line rule caption + count, "Save current filters"
// as a tertiary link on the section rule), and "Possible duplicates" (top
// pairs by name with an inline Merge link to the existing merge page).
// Per-segment counts are never recomputed here — they arrive already
// computed by GET /segments with the SAME segment-rule where clause the
// directory list applies (server/routes/api/contacts/segments.ts).
import { Link } from 'react-router-dom';
import { describeRules } from './segments';
import type { DuplicateGroup, Segment } from './types';

interface Props {
  topCompanies: { company: string; count: number }[];
  onCompanyClick: (company: string) => void;
  segments: Segment[];
  onApplySegment: (segmentId: string) => void;
  onSaveCurrentFilters: () => void;
  duplicateCount: number;
  duplicatePreview: DuplicateGroup[];
}

function duplicateGroupLabel(g: DuplicateGroup): string {
  return g.contacts.map((c) => `${c.firstName} ${c.lastName}`).join(' · ');
}

export function DirectoryRail({
  topCompanies,
  onCompanyClick,
  segments,
  onApplySegment,
  onSaveCurrentFilters,
  duplicateCount,
  duplicatePreview,
}: Props) {
  return (
    <aside className="chq-contacts-rail">
      <section className="chq-section chq-contacts-rail-section">
        <div className="chq-section-head">
          <span className="chq-section-label">Where they work</span>
        </div>
        <ul className="chq-contacts-company-list">
          {topCompanies.map((c) => (
            <li key={c.company} className="chq-contacts-rail-row">
              <button type="button" className="chq-link-button" onClick={() => onCompanyClick(c.company)}>
                {c.company}
              </button>
              <span className="chq-contacts-rail-count">{c.count}</span>
            </li>
          ))}
          {topCompanies.length === 0 && <li className="chq-contacts-rail-row chq-empty">&mdash;</li>}
        </ul>
      </section>

      <section className="chq-section chq-contacts-rail-section">
        <div className="chq-section-head">
          <span className="chq-section-label">Saved segments</span>
          <button type="button" className="chq-section-action chq-link-button" onClick={onSaveCurrentFilters}>
            Save current filters
          </button>
        </div>
        <ul className="chq-contacts-rail-segments">
          {segments.map((s) => (
            <li key={s.id} className="chq-contacts-rail-row chq-contacts-rail-segment-row">
              <div className="chq-contacts-rail-segment-main">
                <button type="button" className="chq-link-button" onClick={() => onApplySegment(s.id)}>
                  {s.name}
                </button>
                <span className="chq-meta">{describeRules(s.rules)}</span>
              </div>
              <span className="chq-contacts-rail-count">{s.count}</span>
            </li>
          ))}
          {segments.length === 0 && <li className="chq-contacts-rail-row chq-empty">No saved segments yet.</li>}
        </ul>
      </section>

      <section className="chq-section chq-contacts-rail-section">
        <div className="chq-section-head">
          <span className="chq-section-label">Possible duplicates &middot; {duplicateCount}</span>
        </div>
        <ul className="chq-contacts-rail-duplicates">
          {duplicatePreview.map((g) => (
            <li key={g.contactIds.join(',')} className="chq-contacts-rail-duplicate-row">
              <span className="chq-contacts-rail-duplicate-names">{duplicateGroupLabel(g)}</span>
              <Link className="chq-link-button" to={`/contacts/merge?ids=${g.contactIds.join(',')}`}>
                Merge
              </Link>
            </li>
          ))}
          {duplicatePreview.length === 0 && <li className="chq-contacts-rail-row chq-empty">No duplicate groups found.</li>}
        </ul>
      </section>
    </aside>
  );
}
