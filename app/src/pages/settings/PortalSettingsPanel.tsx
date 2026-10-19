// Settings · Portals (multi-portal, docs/design/multi-portal/, flow 1): a
// read-only summary -- the event's portals, their coverage, the item
// library and how participants get in -- whose head action, "Manage
// portals", opens the Portals sub-page where all of it is edited.
//
// Multi-portal decision 74: the section has no edit form any more. What
// it used to hold each has one home now: the welcome note is Profile
// basics' note (its portal editor), resources -- pages and uploaded files
// -- are made in the library, and the event-wide "Show resources" switch
// is gone (each portal lists the resources its people see). Decision 72
// had already removed the portal's branding, and the general "Preview the
// portal" page went with this form (preview as a person, from their record
// or a portal's Matches list, shows what someone actually gets).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiGet, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { SummarySection } from './SummarySection';
import { countOf } from '../../lib/plural';
import type { LibraryEntry, LibraryListing, PortalOverview } from '../portals/types';

const SECTION_KEY = 'portal';

// "14 tasks · 6 forms · 4 file requests · 7 resources": the item library
// by kind (built-in items aren't the organizer's to count).
const LIBRARY_KINDS: { type: LibraryEntry['type']; noun: string }[] = [
  { type: 'task', noun: 'task' },
  { type: 'form', noun: 'form' },
  { type: 'file_request', noun: 'file request' },
  { type: 'share_kit', noun: 'share kit' },
  { type: 'resource', noun: 'resource' },
];

function libraryLine(entries: LibraryEntry[]): string {
  const parts = LIBRARY_KINDS.map(({ type, noun }) => ({ n: entries.filter((e) => e.type === type).length, noun }))
    .filter(({ n }) => n > 0)
    .map(({ n, noun }) => countOf(n, noun));
  return parts.length > 0 ? parts.join(' · ') : 'No library items yet';
}

export function PortalSettingsPanel() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [overview, setOverview] = useState<PortalOverview | null>(null);
  const [library, setLibrary] = useState<LibraryEntry[] | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    // DEC-856 (wave 71 amendment): clear the page-level banner before the
    // reads below are issued, so a stale refusal never sits beside a later
    // successful load.
    setError(undefined);
    if (!eventId) return;
    apiGet<PortalOverview>(`/events/${eventId}/portals`)
      .then(setOverview)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load portals'));
    apiGet<LibraryListing>(`/events/${eventId}/library`)
      .then((res) => setLibrary(res.entries))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load the item library'));
  }, [eventId]);

  const rows = [
    {
      label: 'Portals',
      value:
        overview === null ? (
          <DelayedLoading />
        ) : overview.portals.length === 0 ? (
          'No portals yet'
        ) : (
          `${overview.portals.length} · ${overview.portals.map((p) => p.name).join(', ')}`
        ),
    },
    {
      label: 'Coverage',
      value:
        overview === null ? (
          <DelayedLoading />
        ) : overview.total === 0 ? (
          'No participations yet'
        ) : (
          `${overview.covered} of ${countOf(overview.total, 'participation')} covered`
        ),
      hint:
        overview !== null && overview.notInAny > 0 ? (
          <Link className="chq-settings-row-link" to="/speakers?portal=none">
            {`${overview.notInAny} not in any portal`}
          </Link>
        ) : undefined,
    },
    {
      label: 'Libraries',
      value: library === null ? <DelayedLoading /> : libraryLine(library),
    },
    { label: 'Access', value: 'Participants claim their portal from a link in their acceptance or invitation email' },
  ];

  return (
    <>
      {eventLoading ? <DelayedLoading /> : null}
      {eventError || error ? <p role="alert">{eventError ?? error}</p> : null}
      <SummarySection
        sectionKey={SECTION_KEY}
        label="Portals"
        rows={rows}
        actionLabel="Manage portals"
        actionTo="/settings/portals"
        editing={false}
      >
        {null}
      </SummarySection>
    </>
  );
}
