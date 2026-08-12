// Drill-in detail pages (DEC-151, EMB-05/EMB-08/EMB-13). Split out of the
// former monolithic src/routes/public.tsx (contention decomposition) — no
// behavior change.

import type { PublicEvent, PublicSpeakerDetail, PublicSessionDetail } from "../../server/repo/public";
import { surfacePath, speakerDetailPath, sessionDetailPath, SURFACE_LABELS, type Surface } from "./shell";
import { TrackChips, FormatChip, SessionDescription, formatMinutes } from "./cards";

export function BackLink(props: { event: PublicEvent; from: Surface }) {
  return (
    <p>
      <a href={surfacePath(props.event, props.from)}>&larr; Back to {SURFACE_LABELS[props.from]}</a>
    </p>
  );
}

export function sessionTimeLabel(day: string | null, startMin: number | null, endMin: number | null): string | null {
  if (day === null || startMin === null || endMin === null) return null;
  return `${day}, ${formatMinutes(startMin)}–${formatMinutes(endMin)}`;
}

export function SpeakerDetailContent(props: { event: PublicEvent; speaker: PublicSpeakerDetail; from: Surface }) {
  const { event, speaker, from } = props;
  return (
    <>
      <BackLink event={event} from={from} />
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
              <a href={sessionDetailPath(event, s.id, from)}>{s.title}</a>
              {timeLabel ? ` — ${timeLabel}` : ""}
              {s.room ? ` (${s.room})` : ""}
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function SessionDetailContent(props: { event: PublicEvent; session: PublicSessionDetail; from: Surface }) {
  const { event, session, from } = props;
  const timeLabel = sessionTimeLabel(session.day, session.startMin, session.endMin);
  return (
    <>
      <BackLink event={event} from={from} />
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
              <a href={speakerDetailPath(event, s.contactId, from)}>
                {s.firstName} {s.lastName}
              </a>
              {s.title || s.company ? ` (${[s.title, s.company].filter(Boolean).join(", ")})` : ""}
            </>
          ))}
        </p>
        {session.description ? <p>{session.description}</p> : null}
      </div>
    </>
  );
}
