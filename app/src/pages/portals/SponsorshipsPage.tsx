// Settings · Sponsorships (Portals frame, flow 5, /admin/settings/
// sponsorships): the event's tiers and what each entitles a sponsor to,
// and its sponsors with how far through their package each one is. One
// read, GET /events/:id/sponsorships ({tiers, sponsors, waiting, formats});
// every write bumps the mutation signal, which re-reads it. Tiers open
// EditTierModal; a sponsor's company name opens its SponsorModal (a wide
// modal, the same frame as Edit tier); sessions waiting for approval link
// to the queue under Speakers.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { useCachedGet } from '../../lib/useCachedRead';
import { PageSkeleton } from '../../components/PageSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { countOf } from '../../lib/plural';
import { SettingsSubPage } from './SettingsSubPage';
import { EditTierModal } from './EditTierModal';
import { AddSponsorModal, SponsorModal } from './SponsorModals';
import type { SponsorshipRow, SponsorshipsOverview, TierRow } from './types';
import './sponsorships.css';

const FULLY_USED = ' · package fully used';

/** The package line, with "package fully used" carried in weight the way
 * the frame draws it. */
function StatusLine({ line }: { line: string }) {
  if (!line.endsWith(FULLY_USED)) return <>{line}</>;
  return (
    <>
      {line.slice(0, -FULLY_USED.length)} · <strong>package fully used</strong>
    </>
  );
}

type Dialog =
  | { kind: 'tier'; tier: TierRow | null }
  | { kind: 'add-sponsor' }
  | { kind: 'sponsor'; sponsor: SponsorshipRow }
  | null;

export function SponsorshipsPage() {
  const { eventId, error: eventError } = useCurrentEvent();
  const overviewPath = useMemo(() => (eventId ? `/events/${eventId}/sponsorships` : null), [eventId]);
  const overview = useCachedGet<SponsorshipsOverview>(overviewPath, 'Could not load sponsorships.');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState<string | null>(null);

  const data = overview.data;

  function saved(message: string) {
    setDialog(null);
    setToast(message);
  }

  const waitingLink =
    data && data.waiting > 0 ? (
      <Link to="/speakers/sponsor-sessions" className="chq-link-button chq-sponsorships-waiting">
        {`${countOf(data.waiting, 'session')} waiting for approval`}
      </Link>
    ) : undefined;

  return (
    <SettingsSubPage
      sectionKey="sponsorships"
      back={{ label: 'Settings', to: '/settings?section=sponsorships' }}
      title="Sponsorships"
      subtitle={waitingLink}
      actions={
        data ? (
          <button type="button" className="chq-btn chq-btn-primary" onClick={() => setDialog({ kind: 'tier', tier: null })}>
            New tier
          </button>
        ) : undefined
      }
    >
      {toast ? (
        <div className="chq-toast" role="status">
          {toast}
          <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => setToast(null)} aria-label="Dismiss">
            &times;
          </button>
        </div>
      ) : null}
      {eventError || (overview.error && !data) ? (
        <div className="chq-error" role="alert">
          {eventError ?? overview.error}
        </div>
      ) : null}
      {!data && !overview.error && !eventError ? <PageSkeleton variant="table" label="Loading sponsorships…" /> : null}
      {data ? (
        <div className="chq-sponsorships">
          {overview.error ? (
            <div className="chq-error" role="alert">
              {overview.error}
            </div>
          ) : null}
          <section className="chq-sponsorships-section" aria-labelledby="sponsorships-tiers">
            <div className="chq-section-head">
              <span className="chq-section-label" id="sponsorships-tiers">
                Tiers
              </span>
            </div>
            {data.tiers.length === 0 ? (
              <EmptyState
                variant="fresh"
                what="No tiers yet"
                reason="A tier says what each of its sponsors can create, such as one 30-minute talk. New tier adds the first."
              />
            ) : (
              <div className="chq-sponsorships-grid chq-sponsorships-tiers" role="table" aria-labelledby="sponsorships-tiers">
                <div className="chq-sponsorships-head" role="row">
                  <span role="columnheader">Tier</span>
                  <span role="columnheader">Entitles each sponsor to</span>
                  <span role="columnheader">Sponsors</span>
                  <span role="columnheader" aria-label="Actions" />
                </div>
                {data.tiers.map((t) => (
                  <div className="chq-sponsorships-row" role="row" key={t.id}>
                    <span role="cell" className="chq-sponsorships-tier-name">
                      {t.name}
                    </span>
                    <span role="cell" className="chq-sponsorships-text">
                      {t.summary}
                    </span>
                    <span role="cell" className="chq-sponsorships-count">
                      <span className="chq-sponsorships-phone-label">Sponsors </span>
                      {t.sponsors}
                    </span>
                    <span role="cell" className="chq-sponsorships-edit-cell">
                      <button
                        type="button"
                        className="chq-link-button chq-sponsorships-edit"
                        aria-label={`Edit ${t.name}`}
                        onClick={() => setDialog({ kind: 'tier', tier: t })}
                      >
                        Edit
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="chq-sponsorships-section" aria-labelledby="sponsorships-sponsors">
            <div className="chq-section-head">
              <span className="chq-section-label" id="sponsorships-sponsors">
                Sponsors
              </span>
              {data.sponsors.length > 0 ? (
                <button type="button" className="chq-link-button chq-sponsorships-add" onClick={() => setDialog({ kind: 'add-sponsor' })}>
                  Add sponsor
                </button>
              ) : null}
            </div>
            {data.sponsors.length === 0 ? (
              <EmptyState
                variant="fresh"
                what="No sponsors yet"
                reason="Add a sponsor company, put it on a tier, and its contacts get a section in their portal to design the sessions it includes."
                action={{ label: 'Add sponsor', onClick: () => setDialog({ kind: 'add-sponsor' }) }}
              />
            ) : (
              <div className="chq-sponsorships-grid chq-sponsorships-sponsors" role="table" aria-labelledby="sponsorships-sponsors">
                <div className="chq-sponsorships-head" role="row">
                  <span role="columnheader">Company</span>
                  <span role="columnheader">Tier</span>
                  <span role="columnheader">Entitlements</span>
                  <span role="columnheader">Contacts</span>
                </div>
                {data.sponsors.map((sponsor) => (
                  <div className="chq-sponsorships-row" role="row" key={sponsor.id}>
                    <span role="cell" className="chq-sponsorships-company">
                      <button
                        type="button"
                        className="chq-link-button chq-sponsorships-company-open"
                        onClick={() => setDialog({ kind: 'sponsor', sponsor })}
                      >
                        {sponsor.companyName}
                      </button>
                      {sponsor.status === 'pending' ? <span className="chq-flag">Pending</span> : null}
                    </span>
                    <span role="cell" className="chq-sponsorships-meta">
                      {sponsor.tierName ?? 'No tier'}
                    </span>
                    <span role="cell" className="chq-sponsorships-text">
                      <span>
                        <StatusLine line={sponsor.statusLine} />
                      </span>
                      {sponsor.waiting > 0 ? (
                        <Link to="/speakers/sponsor-sessions" className="chq-link-button chq-sponsorships-row-waiting">
                          {`${sponsor.waiting} waiting for approval`}
                        </Link>
                      ) : null}
                    </span>
                    <span role="cell" className="chq-sponsorships-count">
                      <span className="chq-sponsorships-phone-label">Contacts </span>
                      {sponsor.contacts}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {data && eventId && dialog?.kind === 'tier' ? (
        <EditTierModal
          eventId={eventId}
          tier={dialog.tier}
          formats={data.formats}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      ) : null}
      {data && eventId && dialog?.kind === 'add-sponsor' ? (
        <AddSponsorModal eventId={eventId} tiers={data.tiers} onClose={() => setDialog(null)} onSaved={saved} />
      ) : null}
      {data && eventId && dialog?.kind === 'sponsor' ? (
        <SponsorModal
          eventId={eventId}
          sponsorshipId={dialog.sponsor.id}
          companyName={dialog.sponsor.companyName}
          tiers={data.tiers}
          formats={data.formats}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      ) : null}
    </SettingsSubPage>
  );
}
