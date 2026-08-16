// Public pages and embeds settings panel (w15-e, DEC-691; row set + pill
// state w3-c, DEC-747; per-surface counts w1-d, DEC-767; summary-first
// w6-e, DEC-815/DEC-816): lists this event's public surfaces
// (docs/design/Chautauqua Settings.dc.html lines 128-139) -- Sessions,
// Speakers, Agenda, Schedule, Speaker gallery and the CFP submit page --
// each row's live/not-published state DERIVED from real data. DEC-767:
// the accepted-submission total is NOT the right count for every surface
// -- a session can be accepted but still content-pending, or its only
// participant may not be publicly visible, so Sessions/Agenda/Schedule and
// Speakers/Gallery can legitimately show DIFFERENT numbers. GET
// /api/v1/events/:eventId/public-surfaces (src/routes/api/
// public-surfaces.ts) composes the SAME predicates the SSR public surfaces
// use (src/server/repo/public/counts.ts) so this panel's numbers can never
// drift from what a visitor actually sees. DEC-816: Agenda and Schedule
// render only PLACED sessions -- they read counts.scheduled, not
// counts.sessions, so a row can never claim more "published" than the
// page it links to actually shows; Sessions alone reads counts.sessions,
// Speakers/Gallery read counts.speakers.
//
// DEC-896 amendment (wave 26, B10 DROP): this panel has NO edit view. The
// read row already carries every value AND every action -- name, path,
// state pill, View, Embed code -- so a 'Change' gate that only exposed the
// SAME row markup underneath was a gate over nothing (docs/design/
// DESIGN-RULINGS.md B10: "Public pages has no edit view"). There is no
// SummarySection here, no `?section=public-pages&edit=1` drill, no Back
// button -- the rows below and SavedEmbedsPanel render their full
// capability set unconditionally, including Edit/Turn on-off/Delete/Build
// on saved embeds, which used to be gated behind this panel's own
// `editing` and now always render.
//
// DEC-896 amendment (wave 20): the section head also carries the frame's
// consequence micro-label, right-flushed on the same rule as the h2
// (docs/design/Chautauqua Settings.dc.html:131) -- "Unpublishing returns
// 404 to anyone holding the link". .chq-settings-section-head-consequence
// (settings.css) is a new rule appended at the end of that file; no
// existing eyebrow/caption class in settings.css or settings-lists.css
// matched the frame's 11px/600/.04em/uppercase/muted register.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiGet, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { EmbedsPanel } from './EmbedsPanel';
import { SavedEmbedsPanel } from './SavedEmbedsPanel';
import { PUBLIC_PAGES_STATE_TONE_CLASS } from './publicPagesState';
import './settings-lists.css';

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
  const [searchParams] = useSearchParams();
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [counts, setCounts] = useState<PublicSurfaceCounts | null>(null);
  const [form, setForm] = useState<CfpFormSummary | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [embedOpenState, setEmbedOpenState] = useState(false);
  // DEC-822: SavedEmbedsPanel's Edit link opens the builder at ?embed=<id>
  // -- the builder must actually be mounted for that link to land anywhere.
  const embedOpen = embedOpenState || searchParams.get('embed') !== null;

  useEffect(() => {
    if (!eventId) return;
    // DEC-856 (wave 71 amendment): clear the page-level banner before any
    // read is issued -- so a stale refusal never sits beside a later
    // successful reload (TracksRoomsPanel's shape).
    setError(undefined);
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
  // DEC-816: Agenda and Schedule render only PLACED sessions -- they read
  // the scheduled count, never the (larger, or simply different) accepted
  // session count Sessions reads, so a row can never claim more
  // "published" than the page it links to actually shows.
  const scheduledCount = counts ? counts.scheduled : null;

  const rows: PublicPageRow[] = event
    ? [
        { key: 'sessions', name: 'Sessions', path: `/e/${event.slug}/sessions`, state: surfaceState(sessionCount) },
        { key: 'speakers', name: 'Speakers', path: `/e/${event.slug}/speakers`, state: surfaceState(speakerCount) },
        { key: 'agenda', name: 'Agenda', path: `/e/${event.slug}/agenda`, state: surfaceState(scheduledCount) },
        { key: 'schedule', name: 'Schedule', path: `/e/${event.slug}/schedule`, state: surfaceState(scheduledCount) },
        { key: 'gallery', name: 'Speaker gallery', path: `/e/${event.slug}/gallery`, state: surfaceState(speakerCount) },
        { key: 'submit', name: 'CFP submit page', path: `/submit/${event.slug}`, state: cfpState(form, Date.now()) },
      ]
    : [];

  return (
    <>
      {eventLoading ? <DelayedLoading /> : null}
      {eventError || error ? <p role="alert">{eventError ?? error}</p> : null}
      <section className="chq-settings-panel chq-settings-numbered" aria-label="Public pages">
        <div className="chq-settings-section-head">
          <h2>Public pages</h2>
          <span className="chq-settings-section-head-consequence">
            Unpublishing returns 404 to anyone holding the link
          </span>
        </div>
        {event ? (
          <ul className="chq-settings-public-pages-list">
            {rows.map((row) => (
              <li key={row.key} className="chq-settings-public-pages-row">
                <span className="chq-settings-public-pages-name">{row.name}</span>
                <span className="chq-settings-public-pages-path">{row.path}</span>
                {row.state === null ? (
                  <DelayedLoading />
                ) : (
                  <span
                    className={`chq-settings-public-pages-state ${PUBLIC_PAGES_STATE_TONE_CLASS[stateTone(row.state)]}`}
                  >
                    {row.state}
                  </span>
                )}
                <a className="chq-settings-inline-action" href={row.path}>
                  View
                </a>
                {/* User-filed (gate-12 era): View and Embed code sit in ONE
                    row — one action typography (the 12px/700 inline-action),
                    never two link styles side by side. */}
                <button
                  type="button"
                  className="chq-link-button chq-settings-inline-action"
                  onClick={() => setEmbedOpenState(true)}
                >
                  Embed code
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* DEC-896 amendment (wave 26): SavedEmbedsPanel always renders its
          full capability set now -- there is no drill to gate it behind. */}
      {event ? (
        <>
          <SavedEmbedsPanel onBuild={() => setEmbedOpenState(true)} editing />

          {embedOpen ? (
            <div className="chq-settings-public-pages-embed">
              <EmbedsPanel />
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
