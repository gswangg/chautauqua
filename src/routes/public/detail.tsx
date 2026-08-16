// Drill-in detail pages (DEC-151, EMB-05/EMB-08/EMB-13). Split out of the
// former monolithic src/routes/public.tsx (contention decomposition) — no
// behavior change.

import type { PublicEvent, PublicSpeakerDetail, PublicSessionDetail } from "../../server/repo/public";
import { surfacePath, speakerDetailPath, sessionDetailPath, SURFACE_LABELS, type Surface, type SurfaceBase } from "./shell";
import { TrackChips, FormatChip, SessionDescription, ItineraryToggle, formatDay, speakerInitials } from "./cards";
import { clockHMM } from "../../domain/clock";
import { ItineraryScript } from "./agenda";
import { embedKnobQuery } from "../../lib/embed-knobs";

/** DEC-151 (wave-59 amendment): re-encodes the narrowing params the request
 * that reached this detail page was called with (day/q/trackId/format/
 * roomId) through the EXISTING embedKnobQuery encoder for `from` -- the
 * surface's own EMBED_KNOB_TABLE entry decides which of these it actually
 * declares, so a param `from` does not honor is dropped rather than
 * emitted. Used by both the /e and /embed detail route handlers
 * (src/routes/public/index.tsx) so BackLink can restore whichever surface
 * state (day, search, track highlight/filter, format, room) the visitor
 * was on -- never a second encoder. */
export function detailCarry(from: Surface, query: { day?: string; q?: string; trackId?: string; format?: string; roomId?: string }): string | undefined {
  const value = embedKnobQuery(from, {
    day: query.day,
    q: query.q,
    trackId: query.trackId,
    format: query.format,
    roomId: query.roomId,
  });
  return value || undefined;
}

export function BackLink(props: { event: PublicEvent; from: Surface; base?: SurfaceBase; carry?: string }) {
  const { event, from, base = "/e", carry } = props;
  return (
    <p>
      <a class="chq-pub-accent-link" href={surfacePath(event, from, base, carry)}>
        &larr; Back to {SURFACE_LABELS[from]}
      </a>
    </p>
  );
}

export function sessionTimeLabel(day: string | null, startMin: number | null, endMin: number | null): string | null {
  if (day === null || startMin === null || endMin === null) return null;
  // DEC-782: `day` is a raw 'YYYY-MM-DD' (DEC-010); route it through the same
  // shared formatter every other public surface's day heading uses
  // (formatDay -> src/lib/event-time.ts) instead of interpolating the ISO
  // string directly.
  // ONE CLOCK GRAMMAR (DEC-768; owner moved to src/domain/clock.ts, DEC-900
  // amendment wave 60): use the same 24h formatter (clockHMM) the sessions
  // list gutter uses instead of a 12h AM/PM form — two clock grammars on
  // the same event was the bug.
  return `${formatDay(day)}, ${clockHMM(startMin)}-${clockHMM(endMin)}`;
}

export function SpeakerDetailContent(props: {
  event: PublicEvent;
  speaker: PublicSpeakerDetail;
  from: Surface;
  base?: SurfaceBase;
  carry?: string;
}) {
  const { event, speaker, from, base = "/e", carry } = props;
  return (
    <>
      <BackLink event={event} from={from} base={base} carry={carry} />
      <div class="chq-card">
        {speaker.headshotUrl ? (
          <img
            src={speaker.headshotUrl}
            alt={`${speaker.firstName} ${speaker.lastName}`}
            class="chq-pub-detail-headshot"
          />
        ) : (
          // DEC-885: same drawn hatch + initials placeholder the list/grid
          // fallback uses (SpeakerHeadshotLink, speakers.tsx) -- never an
          // empty sunk box. aria-hidden since the <h1> beside it already
          // carries the speaker's full name.
          <div class="chq-pub-headshot-fallback chq-pub-detail-headshot" aria-hidden="true">
            {speakerInitials(speaker.firstName, speaker.lastName)}
          </div>
        )}
        <h1 class="chq-pub-surface-title">
          {speaker.firstName} {speaker.lastName}
        </h1>
        {(() => {
          const affiliation = [speaker.title, speaker.company].filter(Boolean).join(", ");
          return affiliation ? <p>{affiliation}</p> : null;
        })()}
        {speaker.bio ? <SessionDescription description={speaker.bio} /> : null}
        {speaker.socialLinks.length > 0 ? (
          <ul>
            {speaker.socialLinks.map((link) => (
              <li>
                <a href={link.url} rel="noopener noreferrer nofollow" target="_blank">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <h2 class="chq-pub-section-title">Sessions ({speaker.sessions.length})</h2>
      <ul>
        {speaker.sessions.map((s) => {
          const timeLabel = sessionTimeLabel(s.day, s.startMin, s.endMin);
          return (
            <li>
              <a href={sessionDetailPath(event, s.id, from, base, carry)}>{s.title}</a>
              {timeLabel ? ` — ${timeLabel}` : ""}
              {s.room ? ` (${s.room})` : ""}
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function SessionDetailContent(props: {
  event: PublicEvent;
  session: PublicSessionDetail;
  from: Surface;
  base?: SurfaceBase;
  carry?: string;
}) {
  const { event, session, from, base = "/e", carry } = props;
  const timeLabel = sessionTimeLabel(session.day, session.startMin, session.endMin);
  // DEC-672/DEC-683: the itinerary picker is chromeless-closed — /embed's
  // twin of this page never renders the .chq-itinerary-toggle control or
  // ItineraryScript, same rule the sessions/schedule surfaces already
  // follow (sessions.tsx, agenda.tsx).
  const embed = base === "/embed";
  return (
    <>
      <BackLink event={event} from={from} base={base} carry={carry} />
      <div class="chq-card">
        <TrackChips tracks={session.tracks} />
        <FormatChip format={session.format} />
        {/* DEC-782 (Amendment, wave 26 / DESIGN-RULINGS A26): the itinerary
            control moves into the header, beside the session title — the
            SAME ItineraryToggle component, the SAME chq_itinerary_<slug> key
            and the SAME ItineraryScript already used below, placement only. */}
        <header class="chq-pub-detail-header">
          <h1 class="chq-pub-surface-title">{session.title}</h1>
          {!embed ? (
            <ItineraryToggle sessionId={session.id} wrapperClass="chq-pub-save chq-pub-detail-itinerary" />
          ) : null}
        </header>
        <p>
          {timeLabel ?? "Not yet scheduled"}
          {session.roomName ? ` · ${session.roomName}` : ""}
        </p>
        <p>
          {session.speakers.map((s, i) => (
            <>
              {i > 0 ? ", " : ""}
              <a href={speakerDetailPath(event, s.contactId, from, base, carry)}>
                {s.firstName} {s.lastName}
              </a>
            </>
          ))}
        </p>
        {session.description ? <p>{session.description}</p> : null}
        {!embed ? (
          <p>
            <span id="chq-ics-count">0</span> saved in this browser ·{" "}
            <a id="chq-ics-link" class="chq-pub-itinerary-cta" href={`/e/${event.slug}/schedule.ics`} aria-disabled="true">
              Download .ics
            </a>
          </p>
        ) : null}
      </div>
      {!embed ? <ItineraryScript eventSlug={event.slug} /> : null}
    </>
  );
}
