// Sponsorships settings section (Portals frame, flow 1): the event's sponsor
// tiers and what each entitles a sponsor to, and its sponsors with the
// sessions waiting for approval. Read-only summary; "Manage sponsorships"
// opens the Sponsorships sub-page (/settings/sponsorships), where tiers,
// sponsors and their contacts are edited.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DelayedLoading } from '../../components/DelayedLoading';
import { useCachedGet } from '../../lib/useCachedRead';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { countOf } from '../../lib/plural';
import { SummarySection } from './SummarySection';
import type { SponsorshipsOverview } from '../portals/types';

const SECTION_KEY = 'sponsorships';

export function SponsorshipsSummaryPanel() {
  const { eventId, error: eventError } = useCurrentEvent();
  const path = useMemo(() => (eventId ? `/events/${eventId}/sponsorships` : null), [eventId]);
  const { data, error } = useCachedGet<SponsorshipsOverview>(path, 'Failed to load sponsorships');

  const rows = [
    {
      label: 'Tiers',
      value:
        data === undefined ? (
          <DelayedLoading />
        ) : data.tiers.length === 0 ? (
          'No tiers yet'
        ) : (
          <div className="chq-settings-tier-lines">
            {data.tiers.map((t) => (
              <span key={t.id}>{`${t.name} — ${t.summary}`}</span>
            ))}
          </div>
        ),
    },
    {
      label: 'Sponsors',
      value: data === undefined ? <DelayedLoading /> : data.sponsors.length === 0 ? 'No sponsors yet' : String(data.sponsors.length),
      hint:
        data !== undefined && data.waiting > 0 ? (
          <Link className="chq-settings-row-link" to="/speakers/sponsor-sessions">
            {`${countOf(data.waiting, 'session')} waiting for approval`}
          </Link>
        ) : undefined,
    },
  ];

  return (
    <>
      {eventError || error ? <p role="alert">{eventError ?? error}</p> : null}
      <SummarySection
        sectionKey={SECTION_KEY}
        label="Sponsorships"
        rows={rows}
        actionLabel="Manage sponsorships"
        actionTo="/settings/sponsorships"
        editing={false}
      >
        {null}
      </SummarySection>
    </>
  );
}
