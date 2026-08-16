// Shared session/speaker card rendering used across the sessions, agenda,
// and drill-in detail surfaces. Split out of the former monolithic
// src/routes/public.tsx (contention decomposition) — no behavior change.

import type { PublicSession, PublicTrack } from "../../server/repo/public";
import { sessionDetailPath, type Surface } from "./shell";
import type { CardFields } from "./query";
import { formatDayLong } from "../../lib/event-time";
import { normalizeHexColor } from "../../domain/color";
import { publicRoomLabel } from "../../domain/schedule";
import { clockHMM } from "../../domain/clock";
// DEC-908 (wave-9 amendment): the ONE session-shape display vocabulary --
// format's trailing-parenthetical reshaping ('Talk (30 min)' -> 'Talk, 30
// min'), swept onto the public cards' own format readers so
// .chq-pub-session-tag's uppercase transform reads 'TALK, 30 MIN' rather
// than 'TALK (30 MIN)'.
import { sessionFormatLabel } from "../../lib/session-vocabulary";

const ALL_FIELDS_ON: CardFields = {
  track: true,
  time: true,
  room: true,
  speaker: true,
  description: true,
  format: true,
};

// DEC-430/DEC-374 pattern: the track colour is organizer-supplied data and
// never reaches the rendered attribute unless it passes the ONE hex-colour
// grammar (src/domain/color.ts, DEC-371 amendment wave 43) -- anything else
// (CSS injection, `var(...)`, keywords) emits no custom property.

export function TrackChips(props: { tracks: PublicTrack[]; highlightTrackId?: string | null }) {
  return (
    <>
      {props.tracks.map((t) => {
        const color = t.color ? normalizeHexColor(t.color) : null;
        // DEC-851 (wave 64 amendment): on the itinerary surfaces a track is a
        // HIGHLIGHT, and the chip naming the highlighted track inverts
        // (filled olive) so the match is legible on a block that still sits
        // among every other session. Every other surface passes nothing here
        // and gets the unchanged chip.
        const inverted = props.highlightTrackId != null && t.id === props.highlightTrackId;
        return (
          <span
            class={inverted ? "chq-pub-track-chip chq-pub-track-chip-inverted" : "chq-pub-track-chip"}
            style={color ? `--chq-track-color:${color}` : undefined}
          >
            {t.name}
          </span>
        );
      })}
    </>
  );
}

// EMB-01/EMB-08: format is a session's answer to the role-tagged
// session_format dropdown (see PublicSession.format, resolved via
// src/server/repo/form-roles.ts). null (no field on this event's form, or
// no answer given) renders NOTHING — never a labelled blank chip.
export function FormatChip(props: { format: string | null }) {
  if (!props.format) return null;
  return <span class="chq-pub-format-chip">{sessionFormatLabel(props.format)}</span>;
}

// DEC-968: the sessions-list row's meta line is a single caps line -- one or
// more track names joined by ', ', a dot separator, then the format -- rendered
// through .chq-pub-session-tag (the SAME class the frame draws both clauses
// with). Each clause renders only when its CardFields flag is on, and the
// dot is dropped whenever either clause is absent (never a dangling dot).
// TrackChips/FormatChip (below) stay exported unchanged for the agenda
// blocks and the session detail page, which keep the colour-swatch chips.
export function SessionTagLine(props: { tracks: PublicTrack[]; format: string | null; fields: CardFields }) {
  const { fields } = props;
  const trackNames = fields.track ? props.tracks.map((t) => t.name).join(", ") : "";
  const showTrack = fields.track && trackNames.length > 0;
  const showFormat = Boolean(fields.format && props.format);
  if (!showTrack && !showFormat) return null;
  return (
    <div class="chq-pub-session-tags">
      {showTrack ? <span class="chq-pub-session-tag">{trackNames}</span> : null}
      {showTrack && showFormat ? <span class="chq-pub-session-tag-dot" /> : null}
      {showFormat ? <span class="chq-pub-session-tag">{sessionFormatLabel(props.format as string)}</span> : null}
    </div>
  );
}

// DEC-968 amendment (wave 8, EMB-01/EMB-09): the session-scoped speaker line
// carries the speaker's identity — job title and/or company — alongside the
// name. EMB-01 (sessions-list card, weight 3) and EMB-09 (schedule/itinerary
// card, weight 2) both require it; SpeakerDetailContent (detail.tsx) keeps
// its own separate identity block untouched.

/** 'Title, Company' when both are present, the single fact when only one is,
 * null when neither — never a dangling comma or bare separator. */
export function speakerIdentityClause(title: string | null, company: string | null): string | null {
  const t = title?.trim() || null;
  const c = company?.trim() || null;
  if (t && c) return `${t}, ${c}`;
  return t ?? c;
}

export function SpeakerNames(props: { speakers: PublicSession["speakers"] }) {
  return (
    <>
      {props.speakers.map((s) => {
        const clause = speakerIdentityClause(s.title, s.company);
        return (
          <span class="chq-pub-speaker-line">
            <strong>
              {s.firstName} {s.lastName}
            </strong>
            {clause !== null ? <span class="chq-pub-speaker-identity"> · {clause}</span> : null}
          </span>
        );
      })}
    </>
  );
}

// EMB-01: shared day/time formatting for session cards and agenda blocks.
// `day` is already the wall-clock 'YYYY-MM-DD' in the event's own timezone
// (DEC-010) — no zonedMinutesToUtc conversion needed to *display* it, only
// to export it as a UTC .ics instant (schedule.ics).
// DEC-768 (wave 7 amendment): ONE public calendar-day grammar. This used to
// wrap formatEventDay (en-US "Wed, May 12, 2027"), which duplicated
// formatDayLong's en-GB "Tuesday 12 May" that the agenda h1 already used —
// two grammars on the same page is the defect, not the locale. Repointing
// this shared wrapper to formatDayLong fixes every public day label (session
// cards, day headings, session-detail schedule line) in one edit; the ten
// call sites keep calling formatDay and inherit the fix unchanged.
// formatDayShort stays the agenda day-switcher's short form ("Tue 12") and
// is untouched by this change.
export function formatDay(day: string): string {
  return formatDayLong(day);
}

// DEC-885: initials for the drawn headshot-fallback placeholder
// (speakers.tsx's SpeakerCard fallback branch) -- shared here rather than
// duplicated per-caller since the placeholder markup itself lives in
// public.css.ts's .chq-pub-headshot-fallback rule, which every headshot-less
// card (directory, gallery) renders through the same fallback branch.
export function speakerInitials(firstName: string, lastName: string): string {
  const f = firstName.trim().charAt(0);
  const l = lastName.trim().charAt(0);
  return `${f}${l}`.toUpperCase();
}

// DEC-768 (wave 48 amendment): ONE public clock grammar. A 12-hour AM/PM
// formatter used to live here alongside a 24h formatter, letting the same
// session print two clocks depending on which surface rendered it
// (agenda/programme vs. sessions-list/detail). DEC-900 amendment (wave 60)
// moved the 24h formatter itself to the single clock owner,
// src/domain/clock.ts (clockHMM, unpadded 24h 'H:MM'); every public caller
// imports it from there directly, so this file no longer declares a clock
// formatter at all.

const DESCRIPTION_SNIPPET_LEN = 160;

// w4-k: the snippet lives inside the <summary> alongside the "Show more"
// affordance, and the disclosed <details> content is ONLY the full
// description — never snippet-then-full, which prints the opening sentence
// twice once expanded. `.chq-pub-desc-snippet` is hidden via CSS when the
// <details> is open (public.css.ts) so the reader sees the preview OR the
// full text, never both at once.
export function SessionDescription(props: { description: string | null }) {
  const { description } = props;
  if (!description) return null;
  if (description.length <= DESCRIPTION_SNIPPET_LEN) return <p>{description}</p>;
  return (
    <p>
      <details style="display:inline">
        <summary>
          <span class="chq-pub-desc-snippet">{description.slice(0, DESCRIPTION_SNIPPET_LEN)}…</span>{" "}
          Show more
        </summary>
        {description}
      </details>
    </p>
  );
}

/** EMB-01/DEC-698/DEC-534 (w4-g amendment): start-time + room cell. When the
 * `time` field is enabled the row ALWAYS has this gutter cell (grid-
 * template-columns: var(--chq-pub-when-gutter) 1fr auto in cards.css.ts
 * depends on it) — an unscheduled
 * session renders an EMPTY .chq-pub-session-when (no dash pile, no
 * placeholder prose per DEC-666) rather than omitting the cell and
 * collapsing the body into the gutter column. Only when the `time` field is
 * off entirely does the caller drop the cell and switch the row to the
 * notime grid template. The day moves out of this cell into a day heading
 * (rendered by the caller when the list spans days) — this cell now shows
 * only the start time (line 1) and room (line 2, via publicRoomLabel, so an
 * unroomed slot still reads "TBA" rather than blank). */
export function SessionSchedule(props: { session: PublicSession; fields?: CardFields }) {
  const { session } = props;
  const fields = props.fields ?? ALL_FIELDS_ON;
  if (!fields.time) return null;
  if (session.day === null || session.startMin === null || session.endMin === null) {
    return <div class="chq-pub-session-when" />;
  }
  return (
    <div class="chq-pub-session-when">
      <span class="chq-pub-session-time">{clockHMM(session.startMin)}</span>
      {fields.room ? <span class="chq-pub-session-room">{publicRoomLabel(session.roomName)}</span> : null}
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
  // DEC-489 (wave-54 amendment): the surface's active fields/accent knobs
  // (an embedKnobQuery result), carried onto the drill-in link so opening a
  // session from inside an embed keeps its configured knobs.
  carry?: string;
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
          href={sessionDetailPath(event, session.id, props.from, props.embed ? "/embed" : "/e", props.carry)}
        >
          {session.title}
        </a>
        {fields.speaker ? (
          <p class="chq-pub-session-speaker">
            <SpeakerNames speakers={session.speakers} />
          </p>
        ) : null}
        <SessionTagLine tracks={session.tracks} format={session.format} fields={fields} />
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
