// DEC-734 amendment (wave 2): one row reader for a duplicate group, shared
// by DuplicatesView (the full tab) and DirectoryRail (the "Possible
// duplicates" preview). Both mounts show the SAME facts — names, the reason
// the pair was surfaced, a Merge link to the merge page at its own URL, and
// a Keep both control — the rail's `dense` prop only tightens spacing/type,
// it never drops a fact the tab shows.
import { Link } from 'react-router-dom';
import type { DuplicateGroup, DuplicateReason } from './types';

// DEC-800: the reason a group was surfaced, as a plain-text caption -- never
// a colour-only signal. Moved verbatim from DuplicatesView.tsx so both
// mounts read the same captions.
export const REASON_CAPTIONS: Record<DuplicateReason, string> = {
  email: 'Same email',
  name_and_company: 'Same name and company',
  name: 'Same name, different company',
};

interface Props {
  group: DuplicateGroup;
  onKeepBoth: (group: DuplicateGroup) => void;
  dense?: boolean;
}

function fullNamesLine(group: DuplicateGroup): string {
  return group.contacts
    .map((c) => `${c.firstName} ${c.lastName} <${c.email}>${c.company ? ` — ${c.company}` : ''}`)
    .join(' / ');
}

function denseNamesLine(group: DuplicateGroup): string {
  return group.contacts.map((c) => `${c.firstName} ${c.lastName}`).join(' · ');
}

export function DuplicateRow({ group, onKeepBoth, dense = false }: Props) {
  const mergeHref = `/contacts/merge?ids=${group.contactIds.join(',')}`;

  if (dense) {
    return (
      <li className="chq-contacts-rail-duplicate-row">
        <span className="chq-contacts-rail-duplicate-names">{denseNamesLine(group)}</span>
        <span className="chq-contacts-rail-duplicate-reason chq-contacts-pipeline-caption">
          {REASON_CAPTIONS[group.reason]}
        </span>
        <div className="chq-contacts-rail-duplicate-actions">
          <Link className="chq-link-button" to={mergeHref}>
            Merge
          </Link>
          <button type="button" className="chq-link-button" onClick={() => onKeepBoth(group)}>
            Keep both
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="chq-contacts-duplicate-group">
      <span className="chq-contacts-duplicate-names">{fullNamesLine(group)}</span>
      <span className="chq-contacts-duplicate-reason chq-contacts-pipeline-caption">
        {REASON_CAPTIONS[group.reason]}
      </span>
      <div className="chq-contacts-import-actions">
        <Link className="chq-btn chq-btn-primary" to={mergeHref}>
          Merge
        </Link>
        <button type="button" className="chq-btn chq-btn-secondary" onClick={() => onKeepBoth(group)}>
          Keep both
        </button>
      </div>
    </li>
  );
}
