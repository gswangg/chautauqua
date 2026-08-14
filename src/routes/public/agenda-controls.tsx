// Day-switcher and search/highlight form controls shared by the public
// agenda and schedule surfaces. Split out of the former monolithic
// src/routes/public/agenda.tsx (contention decomposition, wave 66) — no
// behavior change.

import type { PublicEvent, PublicTrack } from "../../server/repo/public";
import { surfacePath, type SurfaceBase } from "./shell";
import { formatDayShort } from "../../lib/event-time";
import { PublicSearchBox } from "./filters";
// DEC-919/DEC-768: the day switcher composes the shared filter-idiom
// query-param contract (DEC-919) and is the ONE place a scheduled day is
// named on the itinerary surfaces (DEC-768) -- referenced here so both
// dependencies are compile-checked (src/decisions.ts).
import { DEC_919, DEC_768 } from "../../decisions";
void DEC_919;
void DEC_768;

// DEC-851 (wave 64 amendment): the ONE param-composition rule for every
// itinerary-surface out-link (day pills, the track highlight select's Clear
// link, and the search form's hidden fields) — day, trackId and q carry
// forward together unless an override says otherwise, reused by DaySwitcher
// below AND by ItinerarySearchForm's track-highlight control. `format` is no
// longer a knob these two surfaces compose at all (superseded amendment: it
// was never an agenda facet worth honouring here, and track is a highlight
// now, not a filter — see the amendment text on DEC-851 for the ruling).
export function agendaQs(
  current: { day?: string | null; trackId?: string | null; q?: string | null },
  override: { day?: string | null; trackId?: string | null; q?: string | null } = {},
): string {
  const day = override.day !== undefined ? override.day : (current.day ?? null);
  const trackId = override.trackId !== undefined ? override.trackId : (current.trackId ?? null);
  const q = override.q !== undefined ? override.q : (current.q ?? null);
  const parts: string[] = [];
  if (day) parts.push(`day=${day}`);
  if (trackId) parts.push(`trackId=${encodeURIComponent(trackId)}`);
  if (q) parts.push(`q=${encodeURIComponent(q)}`);
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

/** EMB-07: day switcher — one pill per event day. DEC-768: `renderedDays`
 * is the set of days that actually have a `#chq-day-<day>` section on THIS
 * page (so their pill can jump in-page); any day outside that set (e.g.
 * every other day on a `?day=`-filtered view) links out to `?day=<day>`
 * instead, or the switcher would dead-end on a filtered view arrived at
 * from the Sessions rail's day index. `activeDay` (the filter currently
 * applied, if any) is marked current. `base` keeps the out-link inside
 * /embed when this renders inside a chromeless embed (EMB-7: an embed's own
 * links must never break out of its iframe to a full-chrome /e/... href). */
export function DaySwitcher(props: {
  days: string[];
  renderedDays: Set<string>;
  event: PublicEvent;
  surface: "agenda" | "schedule";
  base: SurfaceBase;
  activeDay?: string | null;
  trackId?: string | null;
  q?: string | null;
}) {
  const { days, renderedDays, event, surface, base, activeDay, trackId, q } = props;
  if (days.length <= 1) return null;
  // DEC-783/DEC-851: a day jump must not silently drop the active
  // q/trackId (highlight) selection — every out-link carries them forward
  // alongside ?day=, via the shared agendaQs composer above. `format` is not
  // part of this composition at all (wave 64 amendment: not an agenda facet).
  // DEC-835: the day a visitor is reading is in the URL — every pill (on
  // the default unfiltered view AND a filtered one) emits a real
  // `?day=<day>` href, never a bare `#chq-day-<day>` anchor, so the URL
  // always reflects the day in view and a reload/share lands back on it.
  // The `#chq-day-<day>` section id is still appended as a fragment so an
  // already-rendered day's pill scrolls in place instead of a full reload.
  const current = { trackId: trackId ?? null, q: q ?? null };
  // DEC-885: a navigation control that never says where you are is a list
  // of links. On the ?day=-filtered view `activeDay` names it directly; on
  // the default unfiltered view no query param picks a day, but the page
  // still opens on ONE day -- the first day rendered top-to-bottom -- so
  // that first day is the one in view and gets aria-current, exactly one
  // pill either way.
  const effectiveActiveDay = activeDay ?? days[0] ?? null;
  return (
    <nav aria-label="Jump to day" class="chq-pub-day-switcher">
      {days.map((day) => {
        const isActive = day === effectiveActiveDay;
        const qs = agendaQs(current, { day });
        const href = renderedDays.has(day)
          ? `${surfacePath(event, surface, base)}${qs}#chq-day-${day}`
          : `${surfacePath(event, surface, base)}${qs}`;
        return (
          <a
            class={isActive ? "chq-pub-day-pill chq-pub-day-pill-active" : "chq-pub-day-pill"}
            href={href}
            aria-current={isActive ? "page" : undefined}
          >
            {formatDayShort(day)}
          </a>
        );
      })}
    </nav>
  );
}

// DEC-851 (wave 64 amendment): the itinerary surfaces' control row is
// `[Search this day…][Highlight a track ▾]` — track is a render-level
// highlight here (never a SQL predicate; the block-level highlight/muted
// styling itself is applied where the session blocks render), and `format`
// is not an agenda facet at all (no chip, no <select>, no param). The track
// pill bar this form rendered pre-amendment is gone; a single <select>
// (`.chq-pub-select`, shared naming with w64-b's rail control) shows the
// active track by value with a "Clear" link beside it, both GET-submitting
// to the same `basePath` so the URL — and every downstream out-link built
// from it via the shared agendaQs composer — stays the single source of
// truth for what's highlighted.
export function ItinerarySearchForm(props: {
  event: PublicEvent;
  tracks: PublicTrack[];
  activeTrackId: string | null;
  activeDay: string | null;
  q: string | null;
  basePath: string;
}) {
  const { tracks, activeTrackId, activeDay, q, basePath } = props;
  const current = { day: activeDay, trackId: activeTrackId, q };
  // DEC-919 (wave 40 amendment) / DEC-851 (wave 64 amendment): one
  // .chq-pub-filter-row -- the search box first, then the track-highlight
  // control, shared by both AgendaContent and ScheduleContent.
  return (
    <div class="chq-pub-filter-row">
      <PublicSearchBox
        action={basePath}
        q={q}
        hidden={
          <>
            {activeTrackId ? <input type="hidden" name="trackId" value={activeTrackId} /> : null}
            {activeDay ? <input type="hidden" name="day" value={activeDay} /> : null}
          </>
        }
      />
      <form class="chq-pub-track-highlight" method="get" action={basePath}>
        <label class="chq-visually-hidden" for="chq-pub-highlight-track">
          Highlight a track
        </label>
        {/* onchange auto-submits (no JS fallback needed: the visually-hidden
            submit button below still works without JS, same idiom as
            PublicSearchBox's hidden submit). */}
        <select class="chq-pub-select" id="chq-pub-highlight-track" name="trackId" onchange="this.form.submit()">
          <option value="">Highlight a track</option>
          {tracks.map((t) => (
            <option value={t.id} selected={t.id === activeTrackId ? true : undefined}>
              {t.name}
            </option>
          ))}
        </select>
        {activeDay ? <input type="hidden" name="day" value={activeDay} /> : null}
        {q ? <input type="hidden" name="q" value={q} /> : null}
        <button class="chq-visually-hidden" type="submit">
          Highlight
        </button>
      </form>
      {activeTrackId ? (
        <a class="chq-pub-select-clear" href={`${basePath}${agendaQs(current, { trackId: null })}`}>
          Clear
        </a>
      ) : null}
    </div>
  );
}
