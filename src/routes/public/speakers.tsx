// Speakers / gallery surfaces (DEC-151 name search). Split out of the
// former monolithic src/routes/public.tsx (contention decomposition) — no
// behavior change.

import type { PublicEvent, PublicSpeakerWithSessions } from "../../server/repo/public";
import { speakerDetailPath, surfacePath } from "./shell";
import { PUBLIC_PER_PAGE, hasMorePages } from "../../server/repo/public/bounds";

/** Plain GET name-search form (DEC-151): JS-free, preserves the page's other
 * query semantics by resubmitting only `q` — page param is intentionally
 * dropped on a new search since the result set changes size. DEC-289/DEC-489:
 * a configured embed's `limit` is carried forward as a hidden field, exactly
 * like SessionsContent's search form, so a search does not lose the embed's
 * page size. */
function NameSearchForm(props: { action: string; q: string | null; limit: number | null }) {
  return (
    <form method="get" action={props.action} role="search">
      <label>
        Search by name{" "}
        <input type="search" name="q" value={props.q ?? ""} placeholder="Speaker name" />
      </label>{" "}
      {props.limit ? <input type="hidden" name="limit" value={String(props.limit)} /> : null}
      <button type="submit">Search</button>
      {props.q ? <a href={props.action}>Clear</a> : null}
    </form>
  );
}

/** One card, shared by the directory (SpeakersContent) and the gallery
 * (GalleryContent), per DEC-593: both surfaces carry headshot, name, job
 * title and company (participant.title_at_time/org_at_time, DEC-258) — the
 * only difference is whether the directory additionally lists sessions.
 * A missing headshot renders the same `.chq-pub-headshot-fallback` block in
 * both places so the grid never collapses (EMB-12 graceful degradation). */
function SpeakerCard(props: { event: PublicEvent; sp: PublicSpeakerWithSessions; surface: "speakers" | "gallery"; showSessions: boolean }) {
  const { event, sp, surface, showSessions } = props;
  const href = speakerDetailPath(event, sp.contactId, surface);
  return (
    <div class="chq-pub-speaker-card">
      <a href={href}>
        {sp.headshotUrl ? (
          <img
            src={sp.headshotUrl}
            alt={`${sp.firstName} ${sp.lastName}`}
            loading="lazy"
            width="96"
            height="96"
          />
        ) : (
          <div class="chq-pub-headshot-fallback" />
        )}
      </a>
      <a class="chq-pub-speaker-name" href={href}>
        {sp.firstName} {sp.lastName}
      </a>
      <p class="chq-pub-speaker-role">{[sp.title, sp.company].filter(Boolean).join(", ")}</p>
      {showSessions ? (
        <ul class="chq-pub-speaker-sessions">
          {sp.sessions.map((s) => (
            <li>{s.title}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SpeakersContent(props: {
  event: PublicEvent;
  speakers: PublicSpeakerWithSessions[];
  total: number;
  page: number;
  q: string | null;
  perPage?: number;
  limit?: number | null;
}) {
  const { event, speakers, total, page, q, perPage, limit } = props;
  // DEC-433/477: parsePage clamps to MAX_PUBLIC_PAGE; stop offering
  // 'Show more' once there is no further page to link to, or once the
  // cumulative row ceiling (MAX_PUBLIC_ROWS) has already been reached.
  const hasMore = hasMorePages(speakers.length, total, page, perPage ?? PUBLIC_PER_PAGE);
  const basePath = surfacePath(event, "speakers");
  // DEC-289/DEC-489: carry `limit` forward exactly like SessionsContent's
  // carryQs, so a configured embed does not lose its page size on page 2.
  const carryQs = limit ? `limit=${limit}&` : "";
  return (
    <>
      <h2>Speakers</h2>
      <NameSearchForm action={basePath} q={q} limit={limit ?? null} />
      {speakers.length === 0 ? (
        <p>No speakers to show yet.</p>
      ) : (
        <>
          <p>
            {speakers.length} of {total} speaker(s)
          </p>
          <div class="chq-pub-speaker-grid">
            {speakers.map((sp) => (
              <SpeakerCard event={event} sp={sp} surface="speakers" showSessions={true} />
            ))}
          </div>
        </>
      )}
      {hasMore ? (
        <p>
          <a href={`${basePath}?${q ? `q=${encodeURIComponent(q)}&` : ""}${carryQs}page=${page + 1}`}>Show more</a>
        </p>
      ) : null}
    </>
  );
}

export function GalleryContent(props: {
  event: PublicEvent;
  speakers: PublicSpeakerWithSessions[];
  total: number;
  page: number;
  q: string | null;
  perPage?: number;
  limit?: number | null;
}) {
  const { event, speakers, total, page, q, perPage, limit } = props;
  // DEC-433/477: see SpeakersContent above.
  const hasMore = hasMorePages(speakers.length, total, page, perPage ?? PUBLIC_PER_PAGE);
  const basePath = surfacePath(event, "gallery");
  // DEC-289/DEC-489: see SpeakersContent above.
  const carryQs = limit ? `limit=${limit}&` : "";
  return (
    <>
      <h2>Speaker gallery</h2>
      <NameSearchForm action={basePath} q={q} limit={limit ?? null} />
      <p>
        {speakers.length} of {total} speaker(s)
      </p>
      <div class="chq-pub-speaker-grid chq-pub-gallery-grid">
        {speakers.map((sp) => (
          <SpeakerCard event={event} sp={sp} surface="gallery" showSessions={false} />
        ))}
      </div>
      {hasMore ? (
        <p>
          <a href={`${basePath}?${q ? `q=${encodeURIComponent(q)}&` : ""}${carryQs}page=${page + 1}`}>Show more</a>
        </p>
      ) : null}
    </>
  );
}
