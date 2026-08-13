// Shared session/speaker card rendering used across the sessions, agenda,
// and drill-in detail surfaces. Split out of the former monolithic
// src/routes/public.tsx (contention decomposition) — no behavior change.

import type { PublicSession, PublicTrack } from "../../server/repo/public";
import { sessionDetailPath, type Surface } from "./shell";
import type { CardFields } from "./query";
import { formatEventDay } from "../../lib/event-time";

const ALL_FIELDS_ON: CardFields = {
  track: true,
  time: true,
  room: true,
  speaker: true,
  description: true,
  format: true,
};

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

// EMB-01/EMB-08: format is a session's answer to the SESSION_FORMAT_FIELD_ID
// dropdown (see PublicSession.format). null (no field on this event's form,
// or no answer given) renders NOTHING — never a labelled blank chip.
export function FormatChip(props: { format: string | null }) {
  if (!props.format) return null;
  return <span class="chq-pub-format-chip">{props.format}</span>;
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
// w1-i: delegates to the ONE shared formatter (src/lib/event-time.ts) so
// every public surface's day heading/date label (session cards, day
// headings, session-detail schedule line) renders identically instead of
// each surface re-implementing (or skipping) the same Y-M-D -> label math.
export function formatDay(day: string): string {
  return formatEventDay(day);
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

/** EMB-01/DEC-698: date/time + room cell. When the `time` field is enabled
 * the row ALWAYS has this gutter cell (grid-template-columns: 126px 1fr auto
 * in public.css.ts depends on it) — an unscheduled session renders an EMPTY
 * .chq-pub-session-when (no dash pile, no placeholder prose per DEC-666)
 * rather than omitting the cell and collapsing the body into the gutter
 * column. Only when the `time` field is off entirely does the caller drop
 * the cell and switch the row to the notime grid template. */
export function SessionSchedule(props: { session: PublicSession; fields?: CardFields }) {
  const { session } = props;
  const fields = props.fields ?? ALL_FIELDS_ON;
  if (!fields.time) return null;
  if (session.day === null || session.startMin === null || session.endMin === null) {
    return <div class="chq-pub-session-when" />;
  }
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

// w1-i: ONE shared label pair for every `.chq-itinerary-toggle` control
// across the sessions list, schedule/agenda list rows and the session
// detail page — a per-surface literal ("Save"/"Saved" here, static "Add to
// itinerary" there) is exactly how the detail/schedule surfaces ended up
// with a checked state that never re-labels itself. Any surface rendering
// an itinerary toggle imports this instead of writing its own strings.
export const ITINERARY_TOGGLE_LABEL = { off: "Save", on: "Saved" } as const;

/** Shared `.chq-itinerary-toggle` checkbox + flipping label, reused by the
 * sessions list card, the schedule/agenda list row and the session detail
 * page (DEC-683's markup/CSS pattern, generalized off this one component so
 * the id, storage key and inline script in agenda.tsx's ItineraryScript
 * keep working unchanged everywhere the control now appears). `wrapperClass`
 * lets a surface keep its own outer layout class (e.g. the schedule row's
 * `.chq-pub-itinerary-row`) while still getting the same flip behavior. */
export function ItineraryToggle(props: { sessionId: string; wrapperClass?: string }) {
  const wrapperClass = props.wrapperClass ?? "chq-pub-save";
  return (
    <label class={wrapperClass}>
      <input type="checkbox" class="chq-itinerary-toggle" value={props.sessionId} />
      <span class="chq-pub-save-off">{ITINERARY_TOGGLE_LABEL.off}</span>
      <span class="chq-pub-save-on">{ITINERARY_TOGGLE_LABEL.on}</span>
    </label>
  );
}

export function SessionCard(props: {
  session: PublicSession;
  event: import("../../server/repo/public").PublicEvent;
  from?: Surface;
  itinerary?: boolean;
  fields?: CardFields;
  // DEC-594: chromeless /embed rendering — the title link must stay inside
  // /embed/... rather than break out to the full-chrome /e/... page.
  embed?: boolean;
}) {
  const { session, event } = props;
  const fields = props.fields ?? ALL_FIELDS_ON;
  const rowClass = fields.time ? "chq-pub-session-row" : "chq-pub-session-row chq-pub-session-row-notime";
  return (
    <div class={rowClass} id={`chq-session-${session.id}`}>
      <SessionSchedule session={session} fields={fields} />
      <div class="chq-pub-session-body">
        <a
          class="chq-pub-session-title"
          href={sessionDetailPath(event, session.id, props.from, props.embed ? "/embed" : "/e")}
        >
          {session.title}
        </a>
        {fields.speaker ? (
          <p class="chq-pub-session-speaker">
            <SpeakerNames speakers={session.speakers} />
          </p>
        ) : null}
        {fields.track || fields.format ? (
          <div class="chq-pub-session-tags">
            {fields.track ? <TrackChips tracks={session.tracks} /> : null}
            {fields.format ? <FormatChip format={session.format} /> : null}
          </div>
        ) : null}
        {fields.description ? <SessionDescription description={session.description} /> : null}
      </div>
      {props.itinerary ? (
        // DEC-683: the sessions list's per-row action is "Save"/"Saved" —
        // the SAME .chq-itinerary-toggle checkbox + storage key as
        // /schedule's .chq-pub-itinerary-row (agenda.tsx), just styled as a
        // pill with the two labels swapped by :checked (public.css.ts). No
        // second store, no new JS — ItineraryScript already drives this.
        <ItineraryToggle sessionId={session.id} />
      ) : null}
    </div>
  );
}
