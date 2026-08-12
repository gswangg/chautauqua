// Shared session/speaker card rendering used across the sessions, agenda,
// and drill-in detail surfaces. Split out of the former monolithic
// src/routes/public.tsx (contention decomposition) — no behavior change.

import type { PublicSession, PublicTrack } from "../../server/repo/public";
import { sessionDetailPath, type Surface } from "./shell";
import type { CardFields } from "./query";

const ALL_FIELDS_ON: CardFields = { track: true, time: true, room: true, speaker: true, description: true };

// DEC-430/DEC-374 pattern: the track colour is organizer-supplied data and never
// reaches the rendered attribute unless it is a strict 3- or 6-digit hex value --
// anything else (CSS injection, `var(...)`, keywords) emits no custom property.
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function TrackChips(props: { tracks: PublicTrack[] }) {
  return (
    <>
      {props.tracks.map((t) => (
        <span
          class="chq-pub-track-chip"
          style={t.color && HEX_COLOR_RE.test(t.color) ? `--chq-track-color:${t.color}` : undefined}
        >
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
export function SessionSchedule(props: { session: PublicSession; fields?: CardFields }) {
  const { session } = props;
  const fields = props.fields ?? ALL_FIELDS_ON;
  if (!fields.time) return null;
  if (session.day === null || session.startMin === null || session.endMin === null) return null;
  return (
    <div class="chq-pub-session-when">
      <span class="chq-pub-session-time">
        {formatMinutes(session.startMin)}–{formatMinutes(session.endMin)}
      </span>
      <span class="chq-pub-session-room">
        {formatDay(session.day)}
        {fields.room && session.roomName ? ` · ${session.roomName}` : ""}
      </span>
    </div>
  );
}

export function SessionCard(props: {
  session: PublicSession;
  event: import("../../server/repo/public").PublicEvent;
  from?: Surface;
  itinerary?: boolean;
  fields?: CardFields;
}) {
  const { session, event } = props;
  const fields = props.fields ?? ALL_FIELDS_ON;
  return (
    <div class="chq-pub-session-row" id={`chq-session-${session.id}`}>
      <SessionSchedule session={session} fields={fields} />
      <div class="chq-pub-session-body">
        <a class="chq-pub-session-title" href={sessionDetailPath(event, session.id, props.from)}>
          {session.title}
        </a>
        {fields.speaker ? (
          <p class="chq-pub-session-speaker">
            <SpeakerNames speakers={session.speakers} />
          </p>
        ) : null}
        {fields.track ? (
          <div class="chq-pub-session-tags">
            <TrackChips tracks={session.tracks} />
          </div>
        ) : null}
        {fields.description ? <SessionDescription description={session.description} /> : null}
      </div>
      {props.itinerary ? (
        <label class="chq-pub-itinerary-row">
          <input type="checkbox" class="chq-itinerary-toggle" value={session.id} />
          Add to my itinerary
        </label>
      ) : null}
    </div>
  );
}
