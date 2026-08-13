// EMB-15 (DEC-289): machine-readable public surface feeds. Pure builders —
// no Hono import, no query source of its own. Callers (index.tsx) fetch
// data through the same src/server/repo/public.ts calls the HTML dispatch
// uses (single-sourced visibility gate) and pass the resulting items
// through unchanged into the envelope this module shapes.

import type { PublicEvent, PublicAgendaItem } from "../../server/repo/public";
import type { Surface } from "./shell";
import type { IcsEventInput } from "../../mail/ics";
import { zonedMinutesToUtc } from "../../lib/timezone";
import { ALL_CARD_FIELDS, type CardField, type CardFields } from "./query";

// DEC-594 (EMB-6): `fields=` was already honored by the HTML card renderer
// (SessionCard/SessionSchedule in ./cards) but silently ignored by the
// .json twin — the same param must never be honored by one rendering and
// dropped by the other. The key groups below map each ALL_CARD_FIELDS name
// (imported, never re-listed) to the PublicSession keys it controls; `id`
// and `title` are outside the allowlist and always survive the projection.
const CARD_FIELD_KEYS: Record<CardField, readonly string[]> = {
  track: ["tracks"],
  time: ["day", "startMin", "endMin"],
  room: ["roomName"],
  speaker: ["speakers"],
  description: ["description"],
  // EMB-01/EMB-08 (DEC-592): `format` joined ALL_CARD_FIELDS with the
  // format-on-every-public-surface work; the .json twin projects the
  // PublicSession.format key so `fields=` stays honored identically by
  // both renderings (DEC-594).
  format: ["format"],
};

/** Projects one feed item down to `id`/`title` plus whichever
 * ALL_CARD_FIELDS keys are on in `fields` — driven entirely by
 * ALL_CARD_FIELDS/CARD_FIELD_KEYS above, not a second hand-copied field
 * list. Used by getSurfaceFeedPage's sessions branch (index.tsx). */
export function projectCardFields(item: Record<string, unknown>, fields: CardFields): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ("id" in item) out.id = item.id;
  if ("title" in item) out.title = item.title;
  for (const field of ALL_CARD_FIELDS) {
    if (!fields[field]) continue;
    for (const key of CARD_FIELD_KEYS[field]) {
      if (key in item) out[key] = item[key];
    }
  }
  return out;
}

/** DEC-289/DEC-484 envelope: { event, surface, generatedAt, page, perPage,
 * total, items }. `items` is whatever the surface's existing repo shape
 * already is (PublicSession[], PublicSpeakerWithSessions[],
 * PublicAgendaItem[]), windowed to exactly the requested page — DEC-502:
 * `items` is ONE page window (`items.length <= perPage`), never the
 * cumulative prefix the repo's LIMIT-only query returns internally.
 * page/perPage/total let a consumer detect truncation instead of silently
 * treating one page as the whole list (DEC-484); `total` is always the full
 * unwindowed count, even for a past-the-end page (which returns `items: []`).
 * Unpaged surfaces (agenda, schedule) report page=1, perPage=total=items.length. */
export interface PublicSurfaceFeed<T> {
  event: {
    slug: string;
    name: string;
    timezone: string;
    startDate: string;
    endDate: string;
  };
  surface: Surface;
  generatedAt: string;
  page: number;
  perPage: number;
  total: number;
  items: T;
}

export function buildSurfaceFeed<T>(
  event: PublicEvent,
  surface: Surface,
  paged: { items: T; total: number; page: number; perPage: number },
  now: Date,
): PublicSurfaceFeed<T> {
  return {
    event: {
      slug: event.slug,
      name: event.name,
      timezone: event.timezone,
      startDate: event.startDate,
      endDate: event.endDate,
    },
    surface,
    generatedAt: now.toISOString(),
    page: paged.page,
    perPage: paged.perPage,
    total: paged.total,
    items: paged.items,
  };
}

// DEC-775: escapes the five XML-significant characters for both attribute
// values and text nodes (a superset is always safe in either position).
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Recursively renders one item field. Arrays repeat the same child element
// once per entry (DEC-775 — e.g. a session's `tracks: PublicTrack[]` becomes
// N sibling <tracks> elements, each holding its own object's fields). A
// nested object becomes a wrapping element around its own key/value fields.
// null/undefined are omitted entirely — never rendered as the text "null".
function fieldToXml(key: string, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((entry) => fieldToXml(key, entry)).join("");
  if (typeof value === "object") {
    const inner = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => fieldToXml(k, v))
      .join("");
    return `<${key}>${inner}</${key}>`;
  }
  return `<${key}>${escapeXml(String(value))}</${key}>`;
}

function itemToXml(item: Record<string, unknown>): string {
  const body = Object.entries(item)
    .map(([key, value]) => fieldToXml(key, value))
    .join("");
  return `<item>${body}</item>`;
}

/** XML twin of buildSurfaceFeed — a pure serializer over the exact same
 * PublicSurfaceFeed envelope (same event/surface/generatedAt/page/perPage/
 * total/items shaping), never a second query or a second projection. Scalar
 * envelope fields (surface/generatedAt/page/perPage/total) become <feed>
 * attributes alongside <event>'s own attributes; `items` becomes repeated
 * <item> children of <items>, each item's own fields rendered recursively
 * via fieldToXml (DEC-775). */
export function buildSurfaceFeedXml<T>(
  event: PublicEvent,
  surface: Surface,
  paged: { items: T; total: number; page: number; perPage: number },
  generatedAt: Date,
): string {
  const feed = buildSurfaceFeed(event, surface, paged, generatedAt);
  const eventAttrs = (["slug", "name", "timezone", "startDate", "endDate"] as const)
    .map((key) => `${key}="${escapeXml(String(feed.event[key]))}"`)
    .join(" ");
  const items = Array.isArray(feed.items) ? (feed.items as unknown as Record<string, unknown>[]) : [];
  const itemsXml = items.map(itemToXml).join("");
  return (
    `<feed surface="${escapeXml(feed.surface)}" generatedAt="${escapeXml(feed.generatedAt)}" ` +
    `page="${feed.page}" perPage="${feed.perPage}" total="${feed.total}">` +
    `<event ${eventAttrs}/>` +
    `<items>${itemsXml}</items>` +
    `</feed>`
  );
}

/** Maps a full public agenda to the IcsEventInput[] shape buildIcsCalendar
 * expects (mirrors src/routes/public/index.tsx's schedule.ics handler) —
 * same uidSubmissionId/sequence per session so a calendar app that already
 * has a schedule.ics-imported event updates it rather than duplicating it. */
export function agendaIcsEvents(event: PublicEvent, agendaItems: PublicAgendaItem[], now: Date): IcsEventInput[] {
  return agendaItems.map((item) => ({
    uidSubmissionId: item.submissionId,
    sequence: item.icsSequence,
    title: item.title,
    description: item.description ?? undefined,
    startUtc: zonedMinutesToUtc(item.day, item.startMin, event.timezone),
    endUtc: zonedMinutesToUtc(item.day, item.endMin, event.timezone),
    location: item.roomName ?? undefined,
    dtstamp: now,
  }));
}
