// Drill-in detail pages (DEC-151, EMB-05/EMB-08/EMB-13). Split out of the
// former monolithic src/routes/public.tsx (contention decomposition) — no
// behavior change.

import type { PublicEvent, PublicSpeakerDetail, PublicSessionDetail } from "../../server/repo/public";
import { surfacePath, speakerDetailPath, sessionDetailPath, SURFACE_LABELS, type Surface, type SurfaceBase } from "./shell";
import { TrackChips, FormatChip, SessionDescription, formatMinutes, formatDay } from "./cards";
import { ItineraryScript } from "./agenda";

export function BackLink(props: { event: PublicEvent; from: Surface; base?: SurfaceBase }) {
  const { event, from, base = "/e" } = props;
  return (
    <p>
      <a href={surfacePath(event, from, base)}>&larr; Back to {SURFACE_LABELS[from]}</a>
    </p>
  );
}

export function sessionTimeLabel(day: string | null, startMin: number | null, endMin: number | null): string | null {
  if (day === null || startMin === null || endMin === null) return null;
  return `${formatDay(day)}, ${formatMinutes(startMin)}–${formatMinutes(endMin)}`;
}

export function SpeakerDetailContent(props: {
  event: PublicEvent;
  speaker: PublicSpeakerDetail;
  from: Surface;
  base?: SurfaceBase;
}) {
  const { event, speaker, from, base = "/e" } = props;
  return (
    <>
      <BackLink event={event} from={from} base={base} />
      <div class="chq-card">
        {speaker.headshotUrl ? (
          <img src={speaker.headshotUrl} alt={`${speaker.firstName} ${speaker.lastName}`} width={160} />
        ) : (
          <div class="chq-pub-headshot-fallback" style="width:160px" />
        )}
        <h2>
          {speaker.firstName} {speaker.lastName}
        </h2>
        <p>{[speaker.title, speaker.company].filter(Boolean).join(", ")}</p>
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
      <h3>Sessions ({speaker.sessions.length})</h3>
      <ul>
        {speaker.sessions.map((s) => {
          const timeLabel = sessionTimeLabel(s.day, s.startMin, s.endMin);
          return (
            <li>
              <a href={sessionDetailPath(event, s.id, from, base)}>{s.title}</a>
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
}) {
  const { event, session, from, base = "/e" } = props;
  const timeLabel = sessionTimeLabel(session.day, session.startMin, session.endMin);
  return (
    <>
      <BackLink event={event} from={from} base={base} />
      <div class="chq-card">
        <TrackChips tracks={session.tracks} />
        <FormatChip format={session.format} />
        <h2>{session.title}</h2>
        <p>
          {timeLabel ?? "Not yet scheduled"}
          {session.roomName ? ` · ${session.roomName}` : ""}
        </p>
        <p>
          {session.speakers.map((s, i) => (
            <>
              {i > 0 ? ", " : ""}
              <a href={speakerDetailPath(event, s.contactId, from, base)}>
                {s.firstName} {s.lastName}
              </a>
              {s.title || s.company ? ` (${[s.title, s.company].filter(Boolean).join(", ")})` : ""}
            </>
          ))}
        </p>
        {session.description ? <p>{session.description}</p> : null}
        {base === "/e" ? (
          <>
            <label class="chq-pub-save">
              <input type="checkbox" class="chq-itinerary-toggle" value={session.id} />
              <span class="chq-pub-save-off">Save</span>
              <span class="chq-pub-save-on">Saved</span>
            </label>
            <p>
              <span id="chq-ics-count">0 picked</span> ·{" "}
              <a id="chq-ics-link" class="chq-pub-itinerary-cta" href={`/e/${event.slug}/schedule.ics`} aria-disabled="true">
                Download .ics
              </a>
            </p>
          </>
        ) : null}
      </div>
      {base === "/e" ? <ItineraryScript eventSlug={event.slug} /> : null}
    </>
  );
}
