// Public pages and embeds settings panel (w15-e, DEC-691; row set + pill
// state w3-c, DEC-747; per-surface counts w1-d, DEC-767): lists this
// event's public surfaces (docs/design/Chautauqua Settings.dc.html lines
// 128-139) -- Sessions, Speakers, Agenda, Schedule, Speaker gallery and the
// CFP submit page -- each row's live/not-published state DERIVED from real
// data. DEC-767: the accepted-submission total is NOT the right count for
// every surface -- a session can be accepted but still content-pending, or
// its only participant may not be publicly visible, so Sessions/Agenda/
// Schedule and Speakers/Gallery can legitimately show DIFFERENT numbers.
// GET /api/v1/events/:eventId/public-surfaces (src/routes/api/
// public-surfaces.ts) composes the SAME predicates the SSR public surfaces
// use (src/server/repo/public/counts.ts) so this panel's numbers can never
// drift from what a visitor actually sees. The embed builder (EmbedsPanel,
// EMB-15 / DEC-289, unmodified) is reachable from this section via each
// row's "Embed code" control -- it is a second sub-section, not a
// replacement for the list.
import { useEffect, useState } from 'react';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiGet, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { EmbedsPanel } from './EmbedsPanel';
import { SavedEmbedsPanel } from './SavedEmbedsPanel';

interface EventSummary {
  id: string;
  slug: string;
}

interface CfpFormSummary {
  openDate?: number | null;
  closeDate?: number | null;
}

interface PublicSurfaceCounts {
  sessions: number;
  speakers: number;
  scheduled: number;
}

interface PublicPageRow {
  key: string;
  name: string;
  path: string;
  /** null while the data this state is derived from is still in flight (DEC-678). */
  state: string | null;
}

// DEC-678: a row's state is DERIVED, so until the data it derives from has
// settled there is no state to assert -- these return null (the row renders
// the shared <DelayedLoading /> primitive) rather than a bare literal or,
// worse, a premature "Not published yet".
function surfaceState(count: number | null): string | null {
  if (count === null) return null;
  return count > 0 ? `Live · ${count} published` : 'Not published yet';
}

function cfpState(form: CfpFormSummary | null, now: number): string | null {
  if (!form) return null;
  if (form.closeDate != null && now > form.closeDate) return 'Closed';
  if (form.openDate != null && now < form.openDate) return 'Not open yet';
  return 'Open';
}

// DEC-747: the row's state renders as a tone-modified pill rather than
// plain text -- the tone is NAMED from the semantic state (live vs not),
// never a copied color literal (FINDINGS w1-17: colour isn't identity).
function stateTone(state: string): 'live' | 'muted' {
  return state.startsWith('Live') || state === 'Open' ? 'live' : 'muted';
}

export function PublicPagesPanel() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [counts, setCounts] = useState<PublicSurfaceCounts | null>(null);
  const [form, setForm] = useState<CfpFormSummary | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [embedOpen, setEmbedOpen] = useState(false);

  useEffect(() => {
    if (!eventId) return;
    apiGet<EventSummary>(`/events/${eventId}`)
      .then(setEvent)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load event'));
    // DEC-767: one endpoint sourcing the SAME predicates the SSR public
    // surfaces use, so Sessions/Agenda/Schedule and Speakers/Gallery can
    // read different, both-true numbers instead of one shared (and often
    // wrong) accepted-submission total.
    apiGet<PublicSurfaceCounts>(`/events/${eventId}/public-surfaces`)
      .then(setCounts)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load public surface counts'));
    apiGet<CfpFormSummary>(`/events/${eventId}/forms`)
      .then(setForm)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load the CFP form'));
  }, [eventId]);

  const sessionCount = counts ? counts.sessions : null;
  const speakerCount = counts ? counts.speakers : null;

  const rows: PublicPageRow[] = event
    ? [
        { key: 'sessions', name: 'Sessions', path: `/e/${event.slug}/sessions`, state: surfaceState(sessionCount) },
        { key: 'speakers', name: 'Speakers', path: `/e/${event.slug}/speakers`, state: surfaceState(speakerCount) },
        { key: 'agenda', name: 'Agenda', path: `/e/${event.slug}/agenda`, state: surfaceState(sessionCount) },
        { key: 'schedule', name: 'Schedule', path: `/e/${event.slug}/schedule`, state: surfaceState(sessionCount) },
        { key: 'gallery', name: 'Speaker gallery', path: `/e/${event.slug}/gallery`, state: surfaceState(speakerCount) },
        { key: 'submit', name: 'CFP submit page', path: `/submit/${event.slug}`, state: cfpState(form, Date.now()) },
      ]
    : [];

  return (
    <section className="chq-settings-panel" aria-label="Public pages and embeds">
      <h2>Public pages and embeds</h2>
      {eventLoading ? <DelayedLoading /> : null}
      {eventError || error ? <p role="alert">{eventError ?? error}</p> : null}

      {event ? (
        <ul className="chq-settings-public-pages-list">
          {rows.map((row) => (
            <li key={row.key} className="chq-settings-public-pages-row">
              <span className="chq-settings-public-pages-name">{row.name}</span>
              <span className="chq-settings-public-pages-path">{row.path}</span>
              {row.state === null ? (
                <DelayedLoading />
              ) : (
                <span className={`chq-settings-public-pages-state chq-settings-public-pages-state-${stateTone(row.state)}`}>
                  {row.state}
                </span>
              )}
              <a className="chq-settings-inline-action" href={row.path}>
                View
              </a>
              <button
                type="button"
                className="chq-link-button"
                onClick={() => setEmbedOpen(true)}
              >
                Embed code
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {embedOpen ? (
        <div className="chq-settings-public-pages-embed">
          <EmbedsPanel />
        </div>
      ) : null}

      <SavedEmbedsPanel />
    </section>
  );
}
