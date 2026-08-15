// DEC-683 amendment (wave 65): the printable programme -- a public,
// no-login, print-first one-page rendering of the WHOLE published
// programme (every day, one sequence). A PROJECTION of existing reads,
// never a new query: getPublicAgenda's visibility gate is the same one
// every other public surface reads through, plus getPublicBreaksByDay for
// break rows (src/server/repo/public). Its own minimal shell (no nav, no
// rail, no itinerary controls, no Save) -- not PublicShell/EmbedShell.

import type { PublicAgendaItem, PublicEvent } from "../../server/repo/public";
import { getPublicAgenda, getPublicBreaksByDay, getPublicEventBySlug } from "../../server/repo/public";
import type { ScheduleBreak } from "../../server/repo/breaks";
import { ThemeStyles } from "../../views/theme";
import { PROGRAMME_CSS } from "./programme.css";
import { eventDatesLine, setCacheHeaders } from "./shell";
import { formatDay, formatStartTime24, SpeakerNames } from "./cards";
import { publicNotFound } from "./not-found";
import { publicRoomLabel } from "../../domain/schedule";
import { DEC_683, DEC_768 } from "../../decisions";
import type { Context } from "hono";
import type { AppEnv } from "../../server/env";

void DEC_683;
void DEC_768;

/** Groups agenda items by their 'YYYY-MM-DD' day field -- re-derived here
 * (not imported from ./agenda, which is being rewritten in a concurrent
 * wave-65 lane) so this route never depends on that module's shape. */
function groupByDay(items: PublicAgendaItem[]): Map<string, PublicAgendaItem[]> {
  const map = new Map<string, PublicAgendaItem[]>();
  for (const item of items) {
    const list = map.get(item.day) ?? [];
    list.push(item);
    map.set(item.day, list);
  }
  return map;
}

type ProgrammeRow =
  | { kind: "session"; startMin: number; item: PublicAgendaItem }
  | { kind: "break"; startMin: number; brk: ScheduleBreak };

/** One day's sessions merged with that day's breaks into a single
 * start-time-ordered sequence -- a break sharing a start minute with a
 * session sorts first, matching agenda.tsx's own tiebreak so the two
 * surfaces never disagree about what comes first at the same minute. */
function buildProgrammeDayRows(items: PublicAgendaItem[], breaks: ScheduleBreak[]): ProgrammeRow[] {
  const rows: ProgrammeRow[] = [
    ...items.map((item): ProgrammeRow => ({ kind: "session", startMin: item.startMin, item })),
    ...breaks.map((brk): ProgrammeRow => ({ kind: "break", startMin: brk.startMin, brk })),
  ];
  return rows.sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    return a.kind === b.kind ? 0 : a.kind === "break" ? -1 : 1;
  });
}

function formatBreakLabel(b: ScheduleBreak): string {
  const parts = [b.label];
  if (b.location) parts.push(b.location);
  return `${parts.join(" · ")} · ${b.durationMin} min`;
}

function ProgrammeDay(props: { day: string; items: PublicAgendaItem[]; breaks: ScheduleBreak[] }) {
  const rows = buildProgrammeDayRows(props.items, props.breaks);
  return (
    <section class="chq-prog-day" id={`chq-prog-day-${props.day}`}>
      <h2 class="chq-prog-day-heading">{formatDay(props.day)}</h2>
      {rows.map((row) =>
        row.kind === "break" ? (
          <div class="chq-prog-row chq-prog-break">
            <div class="chq-prog-row-time">{formatStartTime24(row.brk.startMin)}</div>
            <div class="chq-prog-row-body">{formatBreakLabel(row.brk)}</div>
          </div>
        ) : (
          <div class="chq-prog-row">
            <div class="chq-prog-row-time">
              {formatStartTime24(row.item.startMin)}–{formatStartTime24(row.item.endMin)}
            </div>
            <div class="chq-prog-row-body">
              <div class="chq-prog-row-title">{row.item.title}</div>
              <div class="chq-prog-row-sub">
                <SpeakerNames speakers={row.item.speakers} />
              </div>
              <div class="chq-prog-row-sub">
                {[
                  publicRoomLabel(row.item.roomName),
                  row.item.tracks.map((t) => t.name).join(", ") || null,
                  row.item.format,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
          </div>
        ),
      )}
    </section>
  );
}

export function ProgrammeDocument(props: {
  event: PublicEvent;
  items: PublicAgendaItem[];
  total: number;
  breaksByDay: Map<string, ScheduleBreak[]>;
}) {
  const { event, items, total, breaksByDay } = props;
  const byDay = groupByDay(items);
  const days = [...new Set([...byDay.keys(), ...breaksByDay.keys()])].sort();
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`Printable programme - ${event.name}`}</title>
        <ThemeStyles />
        <style dangerouslySetInnerHTML={{ __html: PROGRAMME_CSS }} />
      </head>
      <body>
        <main class="chq-prog-main">
          <h1 class="chq-prog-title chq-pub-surface-title">{event.name}</h1>
          <p class="chq-prog-meta">{eventDatesLine(event)}</p>
          {items.length < total ? (
            <p class="chq-prog-note">
              Showing the first {items.length} of {total} scheduled sessions.
            </p>
          ) : null}
          {days.length === 0 ? (
            <p>No sessions scheduled yet.</p>
          ) : (
            days.map((day) => <ProgrammeDay day={day} items={byDay.get(day) ?? []} breaks={breaksByDay.get(day) ?? []} />)
          )}
        </main>
      </body>
    </html>
  );
}

/** GET /e/:eventSlug/programme handler, registered by src/routes/public/
 * index.tsx alongside the other literal /e/ routes (agenda.ics et al) --
 * same setCacheHeaders/getPublicEventBySlug/publicNotFound shape as every
 * other handler there. Exported as a plain handler (not a mounted sub-app)
 * so index.tsx's route table stays the single place every /e/ path is
 * registered. */
export async function handleProgramme(c: Context<AppEnv, "/e/:eventSlug/programme">): Promise<Response> {
  setCacheHeaders(c);
  const db = c.var.db;
  const event = await getPublicEventBySlug(db, c.req.param("eventSlug"));
  if (!event) return publicNotFound(c, "Event not found.");
  const [{ items, total }, breaksByDay] = await Promise.all([getPublicAgenda(db, event), getPublicBreaksByDay(db, event)]);
  return c.html(<ProgrammeDocument event={event} items={items} total={total} breaksByDay={breaksByDay} />);
}
