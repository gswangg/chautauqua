// Shared session/speaker card rendering used across the sessions, agenda,
// and drill-in detail surfaces. Split out of the former monolithic
// src/routes/public.tsx (contention decomposition) — no behavior change.

import type { PublicSession, PublicTrack } from "../../server/repo/public";
import { sessionDetailPath, type Surface } from "./shell";

export function TrackChips(props: { tracks: PublicTrack[] }) {
  return (
    <>
      {props.tracks.map((t) => (
        <span class="chq-track-chip" style={`background:${t.color ?? "#666"}`}>
          {t.name}
        </span>
      ))}
    </>
  );
}

export function SpeakerNames(props: { speakers: PublicSession["speakers"] }) {
  return (
    <>
      {props.speakers.map((s, i) => (
        <>
          {i > 0 ? ", " : ""}
          <strong>
            {s.firstName} {s.lastName}
          </strong>
          {s.title || s.company ? ` (${[s.title, s.company].filter(Boolean).join(", ")})` : ""}
        </>
      ))}
    </>
  );
}

// EMB-01: shared day/time formatting for session cards and agenda blocks.
// `day` is already the wall-clock 'YYYY-MM-DD' in the event's own timezone
// (DEC-010) — no zonedMinutesToUtc conversion needed to *display* it, only
// to export it as a UTC .ics instant (schedule.ics).
export function formatDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  const d = new Date(Date.UTC(year, month - 1, date));
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

const DESCRIPTION_SNIPPET_LEN = 160;

export function SessionDescription(props: { description: string | null }) {
  const { description } = props;
  if (!description) return null;
  if (description.length <= DESCRIPTION_SNIPPET_LEN) return <p>{description}</p>;
  return (
    <p>
      {description.slice(0, DESCRIPTION_SNIPPET_LEN)}…{" "}
      <details style="display:inline">
        <summary>Show more</summary>
        {description}
      </details>
    </p>
  );
}

/** EMB-01: date/time + room, only when a schedule_slot exists. Cards for an
 * unscheduled session render nothing here (no dash pile) — the caller
 * threads day/startMin/endMin/roomName as null-together in that case. */
export function SessionSchedule(props: { session: PublicSession }) {
  const { session } = props;
  if (session.day === null || session.startMin === null || session.endMin === null) return null;
  return (
    <p class="chq-session-when">
      {formatDay(session.day)}, {formatMinutes(session.startMin)}–{formatMinutes(session.endMin)}
      {session.roomName ? ` · ${session.roomName}` : ""}
    </p>
  );
}

export function SessionCard(props: { session: PublicSession; event: import("../../server/repo/public").PublicEvent; from?: Surface; itinerary?: boolean }) {
  const { session, event } = props;
  return (
    <div class="chq-card" id={`chq-session-${session.id}`}>
      <TrackChips tracks={session.tracks} />
      <h3>
        <a href={sessionDetailPath(event, session.id, props.from)}>{session.title}</a>
      </h3>
      <SessionSchedule session={session} />
      <p>
        <SpeakerNames speakers={session.speakers} />
      </p>
      <SessionDescription description={session.description} />
      {props.itinerary ? (
        <label>
          <input type="checkbox" class="chq-itinerary-toggle" value={session.id} />
          Add to my itinerary
        </label>
      ) : null}
    </div>
  );
}
