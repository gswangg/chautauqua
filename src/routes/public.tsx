// J10: the five public surfaces + embeds + itinerary .ics (DEC-022), SSR
// with hono/jsx, mobile-first, no login/session dependence anywhere in this
// file. src/server/repo/public.ts is the ONLY query source (single-sourced
// visibility gate); this file is thin rendering + query-param parsing
// (DEC-012). Route files export a named Hono sub-app; only src/index.ts
// mounts it.

import { Hono } from "hono";
import type { AppEnv } from "../server/env";
import {
  getPublicEventBySlug,
  getPublicTracks,
  getPublicSessions,
  getPublicSpeakers,
  getPublicAgenda,
  getPublicSpeakerDetail,
  getPublicSessionDetail,
  type PublicEvent,
  type PublicTrack,
  type PublicSession,
  type PublicSpeakerWithSessions,
  type PublicSpeakerDetail,
  type PublicSessionDetail,
  type PublicAgendaItem,
} from "../server/repo/public";
import { buildIcsCalendar } from "../mail/ics";
import { zonedMinutesToUtc } from "../lib/timezone";
import { itineraryStorageKey, parseItineraryIds, MAX_ITINERARY_IDS } from "../lib/itinerary";
import { assignLanes } from "../lib/overlap-lanes";
import { ApiError } from "../server/http";
import { publicCacheMiddleware, defaultCache } from "../server/pubcache";
import { DEC_022, DEC_007, DEC_017, DEC_005, DEC_012, DEC_080, DEC_083, DEC_151 } from "../decisions";

export const publicRoutes = new Hono<AppEnv>();

// touch DEC constants so the dependency is compile-checked (field guide convention)
void DEC_022;
void DEC_007;
void DEC_017;
void DEC_005;
void DEC_012;
void DEC_080;
void DEC_083;
void DEC_151;

// DEC-083 supersedes DEC-022's "no purge machinery" sentence: public/embed
// HTML GETs are now served through a version-salted caches.default, purged
// by any successful mutation (see bumpPublicVersionMiddleware in
// src/server/app.ts). setCacheHeaders below and its 60s client-facing
// max-age are unchanged — the long-TTL edge copy is an implementation
// detail behind that same client contract.
publicRoutes.use("/e/*", publicCacheMiddleware(defaultCache));
publicRoutes.use("/embed/*", publicCacheMiddleware(defaultCache));

const SURFACES = ["sessions", "speakers", "agenda", "schedule", "gallery"] as const;
export type Surface = (typeof SURFACES)[number];

function isSurface(value: string): value is Surface {
  return (SURFACES as readonly string[]).includes(value);
}

const PER_PAGE = 12;

// DEC-022: stage-1 caching, every public/embed GET — bounded 60s staleness
// is the accepted stage-1 behavior; no purge machinery.
function setCacheHeaders(c: { header(name: string, value: string): void }): void {
  c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
}

// ---------------------------------------------------------------------------
// Shared rendering
// ---------------------------------------------------------------------------

function branding(event: PublicEvent): { logoUrl?: string; accentColor?: string } {
  if (!event.brandingJson) return {};
  const parsed = JSON.parse(event.brandingJson) as { logoUrl?: string; accentColor?: string };
  return { logoUrl: parsed.logoUrl, accentColor: parsed.accentColor };
}

function surfacePath(event: PublicEvent, surface: Surface): string {
  return `/e/${event.slug}/${surface}`;
}

/** Drill-in detail links (DEC-151) carry ?from=<surface> so the detail
 * page's Back link returns to whichever surface it was reached from. */
export function sessionDetailPath(event: PublicEvent, sessionId: string, from?: Surface): string {
  return `/e/${event.slug}/sessions/${sessionId}${from ? `?from=${from}` : ""}`;
}

export function speakerDetailPath(event: PublicEvent, contactId: string, from?: Surface): string {
  return `/e/${event.slug}/speakers/${contactId}${from ? `?from=${from}` : ""}`;
}

export function isValidFrom(raw: string | undefined, fallback: Surface): Surface {
  return raw && isSurface(raw) ? raw : fallback;
}

const SURFACE_LABELS: Record<Surface, string> = {
  sessions: "Sessions",
  speakers: "Speakers",
  agenda: "Agenda",
  schedule: "Schedule",
  gallery: "Gallery",
};

function BaseStyles(props: { accentColor?: string }) {
  return (
    <style>{`
      :root { --chq-accent: ${props.accentColor ?? "#2b2b2b"}; }
      body { font-family: system-ui, sans-serif; margin: 0; color: #1a1a1a; }
      main { max-width: 960px; margin: 0 auto; padding: 1rem; }
      a { color: var(--chq-accent); }
      .chq-nav a { margin-right: 1rem; }
      .chq-track-chip { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; color: #fff; font-size: 0.8rem; margin-right: 0.25rem; }
      .chq-card { border: 1px solid #ddd; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 0.75rem; }
      .chq-speaker-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem; }
      .chq-speaker-grid img, .chq-speaker-grid .chq-headshot-fallback { width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 8px; background: #eee; }
      .chq-agenda-day { display: grid; gap: 1px; background: #eee; margin-bottom: 1.5rem; }
      .chq-agenda-block { background: #fff; border-left: 3px solid var(--chq-accent); padding: 0.4rem 0.6rem; font-size: 0.85rem; }
    `}</style>
  );
}

/** Mobile-first shared layout with event branding + surface nav (DEC-022). */
function PublicShell(props: { event: PublicEvent; active: Surface; title: string; children: unknown }) {
  const { event, active } = props;
  const b = branding(event);
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title}</title>
        <BaseStyles accentColor={b.accentColor} />
      </head>
      <body>
        <header>
          <main style="padding-bottom:0">
            {b.logoUrl ? <img src={b.logoUrl} alt="" height={40} /> : null}
            <h1>{event.name}</h1>
            <nav class="chq-nav">
              {SURFACES.map((s) => (
                <a href={surfacePath(event, s)} aria-current={s === active ? "page" : undefined}>
                  {SURFACE_LABELS[s]}
                </a>
              ))}
            </nav>
          </main>
        </header>
        <main>{props.children as any}</main>
      </body>
    </html>
  );
}

/** Chromeless embed shell (DEC-022): same surface content, no nav/header, no
 * frame-blocking headers set anywhere in this file so iframes work. */
function EmbedShell(props: { event: PublicEvent; title: string; children: unknown }) {
  const b = branding(props.event);
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title}</title>
        <BaseStyles accentColor={b.accentColor} />
      </head>
      <body>
        <main>{props.children as any}</main>
      </body>
    </html>
  );
}

function TrackChips(props: { tracks: PublicTrack[] }) {
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

function SpeakerNames(props: { speakers: PublicSession["speakers"] }) {
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

const DESCRIPTION_SNIPPET_LEN = 160;

function SessionDescription(props: { description: string | null }) {
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

function SessionCard(props: { session: PublicSession; event: PublicEvent; from?: Surface; itinerary?: boolean }) {
  const { session, event } = props;
  return (
    <div class="chq-card" id={`chq-session-${session.id}`}>
      <TrackChips tracks={session.tracks} />
      <h3>
        <a href={sessionDetailPath(event, session.id, props.from)}>{session.title}</a>
      </h3>
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

// ---------------------------------------------------------------------------
// Sessions surface
// ---------------------------------------------------------------------------

function SessionsContent(props: {
  event: PublicEvent;
  tracks: PublicTrack[];
  activeTrackId: string | null;
  items: PublicSession[];
  total: number;
  page: number;
}) {
  const { event, tracks, activeTrackId, items, total, page } = props;
  const hasMore = items.length < total;
  const basePath = `/e/${event.slug}/sessions`;
  return (
    <>
      <h2>Sessions</h2>
      <nav aria-label="Track filters">
        <a href={basePath} aria-current={activeTrackId === null ? "true" : undefined}>
          All
        </a>
        {tracks.map((t) => (
          <>
            {" · "}
            <a href={`${basePath}?trackId=${t.id}`} aria-current={activeTrackId === t.id ? "true" : undefined}>
              {t.name}
            </a>
          </>
        ))}
      </nav>
      <p>
        {items.length} of {total} session(s)
      </p>
      {items.map((s) => (
        <SessionCard session={s} event={event} from="sessions" />
      ))}
      {hasMore ? (
        <p>
          <a href={`${basePath}?${activeTrackId ? `trackId=${activeTrackId}&` : ""}page=${page + 1}`}>Show more</a>
        </p>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Speakers / gallery surfaces
// ---------------------------------------------------------------------------

/** Plain GET name-search form (DEC-151): JS-free, preserves the page's other
 * query semantics by resubmitting only `q` — page param is intentionally
 * dropped on a new search since the result set changes size. */
function NameSearchForm(props: { action: string; q: string | null }) {
  return (
    <form method="get" action={props.action} role="search">
      <label>
        Search by name{" "}
        <input type="search" name="q" value={props.q ?? ""} placeholder="Speaker name" />
      </label>{" "}
      <button type="submit">Search</button>
      {props.q ? <a href={props.action}>Clear</a> : null}
    </form>
  );
}

function SpeakersContent(props: { event: PublicEvent; speakers: PublicSpeakerWithSessions[]; q: string | null }) {
  const { event, speakers, q } = props;
  return (
    <>
      <h2>Speakers</h2>
      <NameSearchForm action={surfacePath(event, "speakers")} q={q} />
      {speakers.length === 0 ? (
        <p>No speakers to show yet.</p>
      ) : (
        <div class="chq-speaker-grid">
          {speakers.map((sp) => (
            <div>
              <a href={speakerDetailPath(event, sp.contactId, "speakers")}>
                {sp.headshotUrl ? (
                  <img src={sp.headshotUrl} alt={`${sp.firstName} ${sp.lastName}`} />
                ) : (
                  <div class="chq-headshot-fallback" />
                )}
              </a>
              <p>
                <strong>
                  <a href={speakerDetailPath(event, sp.contactId, "speakers")}>
                    {sp.firstName} {sp.lastName}
                  </a>
                </strong>
                <br />
                {[sp.title, sp.company].filter(Boolean).join(", ")}
              </p>
              <ul>
                {sp.sessions.map((s) => (
                  <li>{s.title}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function GalleryContent(props: { event: PublicEvent; speakers: PublicSpeakerWithSessions[]; q: string | null }) {
  const { event, speakers, q } = props;
  return (
    <>
      <h2>Speaker gallery</h2>
      <NameSearchForm action={surfacePath(event, "gallery")} q={q} />
      <div class="chq-speaker-grid">
        {speakers.map((sp) => (
          <div>
            <a href={speakerDetailPath(event, sp.contactId, "gallery")}>
              {sp.headshotUrl ? (
                <img src={sp.headshotUrl} alt={`${sp.firstName} ${sp.lastName}`} />
              ) : (
                <div class="chq-headshot-fallback" />
              )}
              <p>
                {sp.firstName} {sp.lastName}
              </p>
            </a>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Agenda / schedule surfaces
// ---------------------------------------------------------------------------

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Per-day time grid (DEC-022): CSS grid, rooms as columns, session blocks
 * positioned by grid-row from start/end minutes. */
function AgendaDayGrid(props: { day: string; items: PublicAgendaItem[]; event: PublicEvent; from: Surface; itinerary?: boolean }) {
  const { day, items, event, from, itinerary } = props;
  const gridMin = 15;
  const dayStart = Math.min(...items.map((i) => i.startMin));
  const dayEnd = Math.max(...items.map((i) => i.endMin));
  const rooms = [...new Set(items.map((i) => i.roomId ?? "tbd"))];
  const roomNames = new Map(items.map((i) => [i.roomId ?? "tbd", i.roomName ?? "TBD"]));

  // DEC-140: overlapping sessions in the same room column must render
  // side-by-side (lanes) rather than stacked, or the top block eats the
  // pointer events meant for the block(s) underneath it (docs/eval-
  // findings.md P1). Lanes are computed per-room since only sessions in the
  // same room column can visually collide.
  const laneByItem = new Map<string, { lane: number; laneCount: number }>();
  for (const roomId of rooms) {
    const roomItems = items
      .filter((i) => (i.roomId ?? "tbd") === roomId)
      .map((i) => ({ id: i.submissionId, startMin: i.startMin, endMin: i.endMin }));
    for (const laned of assignLanes(roomItems)) {
      laneByItem.set(laned.item.id, { lane: laned.lane, laneCount: laned.laneCount });
    }
  }

  return (
    <section aria-label={`Agenda for ${day}`}>
      <h3>{day}</h3>
      <div
        class="chq-agenda-day"
        style={`grid-template-columns: 70px repeat(${rooms.length}, 1fr); grid-template-rows: auto repeat(${Math.ceil(
          (dayEnd - dayStart) / gridMin,
        )}, 22px);`}
      >
        <div style="grid-column:1;grid-row:1"></div>
        {rooms.map((roomId, idx) => (
          <div style={`grid-column:${idx + 2};grid-row:1;font-weight:600;background:#fff;padding:0.2rem`}>
            {roomNames.get(roomId)}
          </div>
        ))}
        {items.map((item) => {
          const roomId = item.roomId ?? "tbd";
          const col = rooms.indexOf(roomId) + 2;
          const rowStart = Math.floor((item.startMin - dayStart) / gridMin) + 2;
          const rowSpan = Math.max(1, Math.ceil((item.endMin - item.startMin) / gridMin));
          const { lane, laneCount } = laneByItem.get(item.submissionId) ?? { lane: 0, laneCount: 1 };
          const laneStyle =
            laneCount > 1
              ? `width:calc(${100 / laneCount}% - 4px);margin-left:calc(${(100 / laneCount) * lane}% + 2px);position:relative;z-index:1`
              : "";
          return (
            <div
              class="chq-agenda-block"
              style={`grid-column:${col};grid-row:${rowStart} / span ${rowSpan};${laneStyle}`}
              id={`chq-agenda-${item.submissionId}`}
            >
              <div>
                {formatMinutes(item.startMin)}–{formatMinutes(item.endMin)}
              </div>
              <TrackChips tracks={item.tracks} />
              <div>
                <strong>
                  <a href={sessionDetailPath(event, item.submissionId, from)}>{item.title}</a>
                </strong>
              </div>
              <div>
                <SpeakerNames speakers={item.speakers} />
              </div>
              {itinerary ? (
                <label>
                  <input type="checkbox" class="chq-itinerary-toggle" value={item.submissionId} />
                  Add to itinerary
                </label>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function groupByDay(items: PublicAgendaItem[]): Map<string, PublicAgendaItem[]> {
  const map = new Map<string, PublicAgendaItem[]>();
  for (const item of items) {
    const list = map.get(item.day) ?? [];
    list.push(item);
    map.set(item.day, list);
  }
  return map;
}

function AgendaContent(props: { event: PublicEvent; items: PublicAgendaItem[] }) {
  const byDay = groupByDay(props.items);
  return (
    <>
      <h2>Agenda</h2>
      {byDay.size === 0 ? (
        <p>No sessions scheduled yet.</p>
      ) : (
        [...byDay.entries()].map(([day, items]) => (
          <AgendaDayGrid day={day} items={items} event={props.event} from="agenda" />
        ))
      )}
    </>
  );
}

/** Itinerary picker inline vanilla JS (DEC-022): reads/writes
 * localStorage chq_itinerary_<slug>, keeps the .ics download link's ?ids=
 * query in sync with the checked set. */
function ItineraryScript(props: { eventSlug: string }) {
  const storageKey = itineraryStorageKey(props.eventSlug);
  const js = `(function(){
  var key = ${JSON.stringify(storageKey)};
  var slug = ${JSON.stringify(props.eventSlug)};
  var stored = [];
  try { stored = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { stored = []; }
  var boxes = document.querySelectorAll('.chq-itinerary-toggle');
  function currentIds(){
    return Array.prototype.filter.call(boxes, function(b){ return b.checked; }).map(function(b){ return b.value; });
  }
  function updateLink(ids){
    var link = document.getElementById('chq-ics-link');
    var count = document.getElementById('chq-ics-count');
    if (count) { count.textContent = ids.length + ' picked'; }
    if (!link) return;
    if (ids.length === 0) { link.setAttribute('aria-disabled', 'true'); link.removeAttribute('href'); return; }
    link.removeAttribute('aria-disabled');
    link.href = '/e/' + slug + '/schedule.ics?ids=' + encodeURIComponent(ids.join(','));
  }
  Array.prototype.forEach.call(boxes, function(b){ b.checked = stored.indexOf(b.value) !== -1; });
  updateLink(stored);
  document.addEventListener('change', function(e){
    if (!e.target || !e.target.classList || !e.target.classList.contains('chq-itinerary-toggle')) return;
    var ids = currentIds();
    localStorage.setItem(key, JSON.stringify(ids));
    updateLink(ids);
  });
})();`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}

function ScheduleContent(props: { event: PublicEvent; items: PublicAgendaItem[] }) {
  const byDay = groupByDay(props.items);
  return (
    <>
      <h2>My schedule</h2>
      <p>
        Check sessions to build a personal itinerary. Your picks are saved in this browser and survive a reload.{" "}
        <a id="chq-ics-link" href={`/e/${props.event.slug}/schedule.ics`} aria-disabled="true">
          Download .ics
        </a>{" "}
        (<span id="chq-ics-count">0 picked</span>)
      </p>
      {byDay.size === 0 ? (
        <p>No sessions scheduled yet.</p>
      ) : (
        [...byDay.entries()].map(([day, items]) => (
          <AgendaDayGrid day={day} items={items} event={props.event} from="schedule" itinerary />
        ))
      )}
      <ItineraryScript eventSlug={props.event.slug} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Query-param parsing (pure-ish, inline — small enough not to warrant
// extraction; itinerary id parsing is the one pulled out per the task note).
// ---------------------------------------------------------------------------

function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

function parseTrackId(raw: string | undefined): string | null {
  return raw && raw.trim().length > 0 ? raw.trim() : null;
}

export function parseNameQuery(raw: string | undefined): string | null {
  return raw && raw.trim().length > 0 ? raw.trim() : null;
}

// ---------------------------------------------------------------------------
// Surface rendering dispatch (shared by /e and /embed)
// ---------------------------------------------------------------------------

async function renderSurfaceContent(
  db: Parameters<typeof getPublicSessions>[0],
  event: PublicEvent,
  surface: Surface,
  query: { trackId?: string; page?: string; q?: string },
): Promise<{ title: string; content: unknown }> {
  switch (surface) {
    case "sessions": {
      const trackId = parseTrackId(query.trackId);
      const page = parsePage(query.page);
      const tracks = await getPublicTracks(db, event.id);
      const { items, total } = await getPublicSessions(db, event, { trackId, page, perPage: PER_PAGE });
      return {
        title: `Sessions - ${event.name}`,
        content: <SessionsContent event={event} tracks={tracks} activeTrackId={trackId} items={items} total={total} page={page} />,
      };
    }
    case "speakers": {
      const q = parseNameQuery(query.q);
      const speakers = await getPublicSpeakers(db, event.id, { q });
      return { title: `Speakers - ${event.name}`, content: <SpeakersContent event={event} speakers={speakers} q={q} /> };
    }
    case "gallery": {
      const q = parseNameQuery(query.q);
      const speakers = await getPublicSpeakers(db, event.id, { q });
      return { title: `Speaker gallery - ${event.name}`, content: <GalleryContent event={event} speakers={speakers} q={q} /> };
    }
    case "agenda": {
      const items = await getPublicAgenda(db, event);
      return { title: `Agenda - ${event.name}`, content: <AgendaContent event={event} items={items} /> };
    }
    case "schedule": {
      const items = await getPublicAgenda(db, event);
      return { title: `Schedule - ${event.name}`, content: <ScheduleContent event={event} items={items} /> };
    }
    default: {
      const exhaustive: never = surface;
      throw new Error(`Unknown public surface '${exhaustive}'`);
    }
  }
}

// ---------------------------------------------------------------------------
// Drill-in detail pages (DEC-151, EMB-05/EMB-08/EMB-13)
// ---------------------------------------------------------------------------

function BackLink(props: { event: PublicEvent; from: Surface }) {
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

function SpeakerDetailContent(props: { event: PublicEvent; speaker: PublicSpeakerDetail; from: Surface }) {
  const { event, speaker, from } = props;
  return (
    <>
      <BackLink event={event} from={from} />
      <div class="chq-card">
        {speaker.headshotUrl ? (
          <img src={speaker.headshotUrl} alt={`${speaker.firstName} ${speaker.lastName}`} width={160} />
        ) : (
          <div class="chq-headshot-fallback" style="width:160px" />
        )}
        <h2>
          {speaker.firstName} {speaker.lastName}
        </h2>
        <p>{[speaker.title, speaker.company].filter(Boolean).join(", ")}</p>
        {speaker.bio ? <SessionDescription description={speaker.bio} /> : null}
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

function SessionDetailContent(props: { event: PublicEvent; session: PublicSessionDetail; from: Surface }) {
  const { event, session, from } = props;
  const timeLabel = sessionTimeLabel(session.day, session.startMin, session.endMin);
  return (
    <>
      <BackLink event={event} from={from} />
      <div class="chq-card">
        <TrackChips tracks={session.tracks} />
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

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

for (const surface of SURFACES) {
  publicRoutes.get(`/e/:eventSlug/${surface}`, async (c) => {
    setCacheHeaders(c);
    const event = await getPublicEventBySlug(c.var.db, c.req.param("eventSlug"));
    if (!event) return c.text("Event not found.", 404);
    const { title, content } = await renderSurfaceContent(c.var.db, event, surface, {
      trackId: c.req.query("trackId"),
      page: c.req.query("page"),
      q: c.req.query("q"),
    });
    return c.html(
      <PublicShell event={event} active={surface} title={title}>
        {content as any}
      </PublicShell>,
    );
  });
}

publicRoutes.get("/e/:eventSlug/speakers/:contactId", async (c) => {
  setCacheHeaders(c);
  const event = await getPublicEventBySlug(c.var.db, c.req.param("eventSlug"));
  if (!event) return c.text("Event not found.", 404);
  const speaker = await getPublicSpeakerDetail(c.var.db, event.id, c.req.param("contactId"));
  if (!speaker) return c.text("Speaker not found.", 404);
  const from = isValidFrom(c.req.query("from"), "speakers");
  return c.html(
    <PublicShell event={event} active={from === "gallery" ? "gallery" : "speakers"} title={`${speaker.firstName} ${speaker.lastName} - ${event.name}`}>
      <SpeakerDetailContent event={event} speaker={speaker} from={from} />
    </PublicShell>,
  );
});

publicRoutes.get("/e/:eventSlug/sessions/:sessionId", async (c) => {
  setCacheHeaders(c);
  const event = await getPublicEventBySlug(c.var.db, c.req.param("eventSlug"));
  if (!event) return c.text("Event not found.", 404);
  const session = await getPublicSessionDetail(c.var.db, event, c.req.param("sessionId"));
  if (!session) return c.text("Session not found.", 404);
  const from = isValidFrom(c.req.query("from"), "sessions");
  return c.html(
    <PublicShell event={event} active={from} title={`${session.title} - ${event.name}`}>
      <SessionDetailContent event={event} session={session} from={from} />
    </PublicShell>,
  );
});

publicRoutes.get("/embed/:eventSlug/:surface", async (c) => {
  setCacheHeaders(c);
  const surfaceParam = c.req.param("surface");
  if (!isSurface(surfaceParam)) return c.text("Unknown embed surface.", 404);
  const event = await getPublicEventBySlug(c.var.db, c.req.param("eventSlug"));
  if (!event) return c.text("Event not found.", 404);
  const { title, content } = await renderSurfaceContent(c.var.db, event, surfaceParam, {
    trackId: c.req.query("trackId"),
    page: c.req.query("page"),
    q: c.req.query("q"),
  });
  // No frame-blocking headers are ever set in this file — embeds stay
  // frameable by construction (DEC-022).
  return c.html(
    <EmbedShell event={event} title={title}>
      {content as any}
    </EmbedShell>,
  );
});

publicRoutes.get("/e/:eventSlug/schedule.ics", async (c) => {
  setCacheHeaders(c);
  const event = await getPublicEventBySlug(c.var.db, c.req.param("eventSlug"));
  if (!event) return c.text("Event not found.", 404);

  const ids = parseItineraryIds(c.req.query("ids"));
  if (ids.length > MAX_ITINERARY_IDS) {
    throw new ApiError("invalid", `Too many ids: schedule.ics accepts at most ${MAX_ITINERARY_IDS} ids.`);
  }
  // getPublicAgenda already applies the shared visibility gate — a
  // submission id that isn't in `agendaById` is either unscheduled or no
  // longer publicly visible, and is silently dropped from the export (a
  // stale itinerary link never leaks a hidden session).
  const agenda = await getPublicAgenda(c.var.db, event);
  const agendaById = new Map(agenda.map((a) => [a.submissionId, a]));

  const events = ids
    .filter((id) => agendaById.has(id))
    .map((id) => {
      const item = agendaById.get(id)!;
      return {
        uidSubmissionId: item.submissionId,
        sequence: item.icsSequence,
        title: item.title,
        description: item.description ?? undefined,
        startUtc: zonedMinutesToUtc(item.day, item.startMin, event.timezone),
        endUtc: zonedMinutesToUtc(item.day, item.endMin, event.timezone),
        location: item.roomName ?? undefined,
        dtstamp: new Date(),
      };
    });

  const ics = buildIcsCalendar(events);
  return c.body(ics, 200, {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": `attachment; filename="${event.slug}-itinerary.ics"`,
  });
});
