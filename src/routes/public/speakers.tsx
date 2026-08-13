// Speakers / gallery surfaces (DEC-151 name search). Split out of the
// former monolithic src/routes/public.tsx (contention decomposition) — no
// behavior change.

import type { PublicEvent, PublicSpeakerWithSessions } from "../../server/repo/public";
import { speakerDetailPath, surfacePath } from "./shell";
import { PUBLIC_PER_PAGE, hasMorePages } from "../../server/repo/public/bounds";
import { speakerInitials } from "./cards";
import { PublicSearchBox } from "./filters";
import { countOf } from "../../domain/count-copy";

/** DEC-990: "Speakers: one page, two views" -- List (SpeakersContent) and
 * Grid (GalleryContent) are the same public surface now, so both render this
 * toggle beside the search box. Reuses the PublicFilterBar pill idiom's
 * markup shape (nav + .chq-pub-pill links, aria-current="page" on the active
 * one) rather than adding new CSS classes -- another task owns public.css.ts
 * this wave. `?q=` and `?limit=` (when the embed passed one) carry forward
 * onto both destinations so switching views never drops an active search or
 * a configured page size. */
function SpeakerViewToggle(props: {
  event: PublicEvent;
  active: "speakers" | "gallery";
  q: string | null;
  limit?: number | null;
  base: "/e" | "/embed";
}) {
  const { event, active, q, limit, base } = props;
  const qs = [q ? `q=${encodeURIComponent(q)}` : null, limit ? `limit=${limit}` : null].filter(Boolean).join("&");
  const hrefFor = (surface: "speakers" | "gallery") => `${surfacePath(event, surface, base)}${qs ? `?${qs}` : ""}`;
  return (
    <nav aria-label="Speaker view" class="chq-pub-filter-bar">
      <a class="chq-pub-pill" href={hrefFor("speakers")} aria-current={active === "speakers" ? "page" : undefined}>
        List
      </a>
      <a class="chq-pub-pill" href={hrefFor("gallery")} aria-current={active === "gallery" ? "page" : undefined}>
        Grid
      </a>
    </nav>
  );
}

/** One card, shared by the directory (SpeakersContent) and the gallery
 * (GalleryContent), per DEC-593: both surfaces carry headshot, name, job
 * title and company (participant.title_at_time/org_at_time, DEC-258) — the
 * only difference is whether the directory additionally lists sessions.
 * A missing headshot renders the same `.chq-pub-headshot-fallback` block in
 * both places so the grid never collapses (EMB-12 graceful degradation). */
function SpeakerCard(props: {
  event: PublicEvent;
  sp: PublicSpeakerWithSessions;
  surface: "speakers" | "gallery";
  showSessions: boolean;
  embed?: boolean;
}) {
  const { event, sp, surface, showSessions, embed } = props;
  const base = embed ? "/embed" : "/e";
  const href = speakerDetailPath(event, sp.contactId, surface, base);
  return (
    <div class="chq-pub-speaker-card">
      {/* w1-i: a photo-less card's fallback <div> carries no text, so the
          wrapping link had no accessible name at all when there's no
          headshot <img> to supply one via `alt`. The headshot <img>'s alt
          already names the link in the other branch, so the aria-label is
          only needed on the fallback path. */}
      <a href={href} aria-label={sp.headshotUrl ? undefined : `${sp.firstName} ${sp.lastName}`}>
        {sp.headshotUrl ? (
          <img
            src={sp.headshotUrl}
            alt={`${sp.firstName} ${sp.lastName}`}
            loading="lazy"
            width="96"
            height="96"
          />
        ) : (
          // DEC-885: a deliberate drawn placeholder (hatch background +
          // initials, public.css.ts) rather than an empty sunk box that
          // reads as a broken image. aria-hidden since the wrapping <a>
          // already carries the speaker's full name via aria-label above --
          // the initials text is decorative, not a second accessible name.
          <div class="chq-pub-headshot-fallback" aria-hidden="true">
            {speakerInitials(sp.firstName, sp.lastName)}
          </div>
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
  embed?: boolean;
}) {
  const { event, speakers, total, page, q, perPage, limit, embed } = props;
  // DEC-433/477: parsePage clamps to MAX_PUBLIC_PAGE; stop offering
  // 'Show more' once there is no further page to link to, or once the
  // cumulative row ceiling (MAX_PUBLIC_ROWS) has already been reached.
  const hasMore = hasMorePages(speakers.length, total, page, perPage ?? PUBLIC_PER_PAGE);
  const base = embed ? "/embed" : "/e";
  const basePath = surfacePath(event, "speakers", base);
  // DEC-289/DEC-489: carry `limit` forward exactly like SessionsContent's
  // carryQs, so a configured embed does not lose its page size on page 2.
  const carryQs = limit ? `limit=${limit}&` : "";
  return (
    <>
      <h1 class="chq-pub-surface-title">Speakers</h1>
      <SpeakerViewToggle event={event} active="speakers" q={q} limit={limit} base={base} />
      <PublicSearchBox
        action={basePath}
        q={q}
        hidden={limit ? <input type="hidden" name="limit" value={String(limit)} /> : null}
      />
      {speakers.length === 0 ? (
        <p>No speakers to show yet.</p>
      ) : (
        <>
          <p>
            {speakers.length} of {countOf(total, "speaker")}
          </p>
          <div class="chq-pub-speaker-grid">
            {speakers.map((sp) => (
              <SpeakerCard event={event} sp={sp} surface="speakers" showSessions={true} embed={embed} />
            ))}
          </div>
        </>
      )}
      {hasMore ? (
        <p>
          <a class="chq-pub-accent-link" href={`${basePath}?${q ? `q=${encodeURIComponent(q)}&` : ""}${carryQs}page=${page + 1}`}>
            Show more
          </a>
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
  embed?: boolean;
}) {
  const { event, speakers, total, page, q, perPage, limit, embed } = props;
  // DEC-433/477: see SpeakersContent above.
  const hasMore = hasMorePages(speakers.length, total, page, perPage ?? PUBLIC_PER_PAGE);
  const base = embed ? "/embed" : "/e";
  const basePath = surfacePath(event, "gallery", base);
  // DEC-289/DEC-489: see SpeakersContent above.
  const carryQs = limit ? `limit=${limit}&` : "";
  return (
    <>
      <h1 class="chq-pub-surface-title">Speakers</h1>
      <SpeakerViewToggle event={event} active="gallery" q={q} limit={limit} base={base} />
      <PublicSearchBox
        action={basePath}
        q={q}
        hidden={limit ? <input type="hidden" name="limit" value={String(limit)} /> : null}
      />
      {speakers.length === 0 ? (
        <p>No speakers to show yet.</p>
      ) : (
        <>
          <p>
            {speakers.length} of {countOf(total, "speaker")}
          </p>
          <div class="chq-pub-speaker-grid chq-pub-gallery-grid">
            {speakers.map((sp) => (
              <SpeakerCard event={event} sp={sp} surface="gallery" showSessions={false} embed={embed} />
            ))}
          </div>
        </>
      )}
      {hasMore ? (
        <p>
          <a class="chq-pub-accent-link" href={`${basePath}?${q ? `q=${encodeURIComponent(q)}&` : ""}${carryQs}page=${page + 1}`}>
            Show more
          </a>
        </p>
      ) : null}
    </>
  );
}
