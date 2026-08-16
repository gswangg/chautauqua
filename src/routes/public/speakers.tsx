// Speakers / gallery surfaces (DEC-151 name search). Split out of the
// former monolithic src/routes/public.tsx (contention decomposition) — no
// behavior change.

import type { PublicEvent, PublicSpeakerWithSessions, PublicTrack } from "../../server/repo/public";
import { speakerDetailPath, surfacePath } from "./shell";
import { PUBLIC_PER_PAGE, hasMorePages } from "../../server/repo/public/bounds";
import { speakerInitials } from "./cards";
import { PublicFilterSelectForm, PublicSearchBox } from "./filters";
import { PublicEmptyState } from "./empty-state";
import { countOf } from "../../domain/count-copy";
import { embedKnobQuery } from "../../lib/embed-knobs";
import { DEC_489 } from "../../decisions";

void DEC_489;

/** DEC-990 Amendment (wave 40): "a toggle with two identical halves is not a
 * toggle" -- this is now a single joined segmented control (one wrapper, two
 * halves sharing a border) rather than two separate pills, so the active
 * half reads as chosen (filled --chq-ink / --chq-paper text) instead of
 * both links looking alike. `?q=` and `?limit=` (when the embed passed one)
 * still carry forward onto both destinations so switching views never drops
 * an active search or a configured page size. */
function SpeakerViewToggle(props: {
  event: PublicEvent;
  active: "speakers" | "gallery";
  q: string | null;
  trackId?: string | null;
  limit?: number | null;
  base: "/e" | "/embed";
}) {
  const { event, active, q, trackId, limit, base } = props;
  // DEC-990 amendment (wave 64): the track facet carries forward across the
  // List/Grid toggle exactly like `q`/`limit` already do — /gallery is the
  // same reader (DEC-593), so it must not silently drop the active facet.
  const qs = [
    q ? `q=${encodeURIComponent(q)}` : null,
    trackId ? `trackId=${encodeURIComponent(trackId)}` : null,
    limit ? `limit=${limit}` : null,
  ]
    .filter(Boolean)
    .join("&");
  const hrefFor = (surface: "speakers" | "gallery") => `${surfacePath(event, surface, base)}${qs ? `?${qs}` : ""}`;
  return (
    <nav aria-label="Speaker view" class="chq-pub-view-toggle">
      <a
        class="chq-pub-view-toggle-option"
        href={hrefFor("speakers")}
        aria-current={active === "speakers" ? "page" : undefined}
      >
        List
      </a>
      <a
        class="chq-pub-view-toggle-option"
        href={hrefFor("gallery")}
        aria-current={active === "gallery" ? "page" : undefined}
      >
        Grid
      </a>
    </nav>
  );
}

/** DEC-919 (wave-74 amendment): the ONE facet for the speakers surface — a
 * quiet `All tracks ▾` select rather than a pill bar (the roster has no
 * "day"/"format" axes to justify one, and a directory-length track list
 * would make a pill row wrap badly). Renders the shared `PublicFilterSelectForm`
 * (`./filters`) rather than a hand-inlined copy: the wave-40/wave-64 inline
 * version predated that shared component and its visually-hidden submit had
 * no `onchange` auto-submit, making the control unreachable by a pointer
 * (DEC-919's hidden-submit exemption is licensed by the select's change
 * event, which this copy never wired). `q`/`limit` still carry forward as
 * hidden inputs so switching tracks never drops an active search or a
 * configured page size. */
function trackFacetHidden(q: string | null, limit: number | null | undefined) {
  return (
    <>
      {q ? <input type="hidden" name="q" value={q} /> : null}
      {limit ? <input type="hidden" name="limit" value={String(limit)} /> : null}
    </>
  );
}

function TrackFacet(props: {
  action: string;
  tracks: PublicTrack[];
  activeTrackId: string | null;
  q: string | null;
  limit?: number | null;
}) {
  const { action, tracks, activeTrackId, q, limit } = props;
  if (tracks.length === 0) return null;
  return (
    <PublicFilterSelectForm
      action={action}
      name="trackId"
      allLabel="All tracks"
      options={tracks.map((t) => ({ value: t.id, label: t.name }))}
      activeValue={activeTrackId}
      hidden={trackFacetHidden(q, limit)}
    />
  );
}

/** The headshot (or drawn fallback) link, shared by the list row and the
 * grid tile -- same markup/classes in both places (DEC-885's hatch +
 * initials placeholder never collapses either anatomy, EMB-12 graceful
 * degradation). Sizing is entirely CSS-driven by the wrapping element's own
 * class (.chq-pub-speaker-list-photo vs .chq-pub-speaker-grid img), so this
 * function contributes no size-specific markup at all. */
function SpeakerHeadshotLink(props: { href: string; sp: PublicSpeakerWithSessions }) {
  const { href, sp } = props;
  return (
    // w1-i: a photo-less card's fallback <div> carries no text, so the
    // wrapping link had no accessible name at all when there's no headshot
    // <img> to supply one via `alt`. The headshot <img>'s alt already names
    // the link in the other branch, so the aria-label is only needed on the
    // fallback path.
    // G13 (frames 10--10/11, MINOR): the class kills the UA link underline
    // that propagated onto the initials monogram of a photo-less fallback
    // (cards.css.ts) -- the frame draws no underline on the placeholder.
    <a class="chq-pub-headshot-link" href={href} aria-label={sp.headshotUrl ? undefined : `${sp.firstName} ${sp.lastName}`}>
      {sp.headshotUrl ? (
        <img src={sp.headshotUrl} alt={`${sp.firstName} ${sp.lastName}`} loading="lazy" width="96" height="96" />
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
  );
}

/** DEC-990 Amendment (wave 40): List row -- a ~80px rounded headshot, name
 * + role/company stacked at the left, that speaker's session titles in a
 * right-hand column, and a 1px hairline rule per row (`.chq-pub-speaker-
 * list` in public.css.ts owns the row grid + rule). Distinct anatomy from
 * the grid tile below: the list always shows sessions, the grid never
 * does. */
function SpeakerListRow(props: { event: PublicEvent; sp: PublicSpeakerWithSessions; embed?: boolean; carry?: string }) {
  const { event, sp, embed, carry } = props;
  const base = embed ? "/embed" : "/e";
  const href = speakerDetailPath(event, sp.contactId, "speakers", base, carry);
  return (
    <li class="chq-pub-speaker-list-row">
      <div class="chq-pub-speaker-list-photo">
        <SpeakerHeadshotLink href={href} sp={sp} />
      </div>
      <div class="chq-pub-speaker-list-info">
        <a class="chq-pub-speaker-name" href={href}>
          {sp.firstName} {sp.lastName}
        </a>
        <p class="chq-pub-speaker-role">{[sp.title, sp.company].filter(Boolean).join(", ")}</p>
      </div>
      <ul class="chq-pub-speaker-sessions">
        {sp.sessions.map((s) => (
          <li>{s.title}</li>
        ))}
      </ul>
    </li>
  );
}

/** DEC-990 Amendment (wave 40): Grid tile -- the photo-led captioned tile
 * (headshot + name + title/company, EMB-12), no session list. Lives in
 * `.chq-pub-speaker-grid.chq-pub-gallery-grid`, six ~184px square columns
 * (public.css.ts). */
function SpeakerGridTile(props: { event: PublicEvent; sp: PublicSpeakerWithSessions; embed?: boolean; carry?: string }) {
  const { event, sp, embed, carry } = props;
  const base = embed ? "/embed" : "/e";
  const href = speakerDetailPath(event, sp.contactId, "gallery", base, carry);
  return (
    <div class="chq-pub-speaker-card">
      <SpeakerHeadshotLink href={href} sp={sp} />
      <a class="chq-pub-speaker-name" href={href}>
        {sp.firstName} {sp.lastName}
      </a>
      {/* G13 (frame 10--11, MAJOR): the grid tile's subtitle is the company
          ALONE -- one line on every card. Role + company wrapped to two
          lines on half the tiles and made the grid baseline ragged; the
          list row above keeps the fuller role, company line. */}
      <p class="chq-pub-speaker-role">{sp.company ?? ""}</p>
    </div>
  );
}

export function SpeakersContent(props: {
  event: PublicEvent;
  speakers: PublicSpeakerWithSessions[];
  total: number;
  page: number;
  q: string | null;
  tracks?: PublicTrack[];
  activeTrackId?: string | null;
  perPage?: number;
  limit?: number | null;
  embed?: boolean;
  // DEC-489 (wave-54 amendment): the /embed-only accent knob, carried
  // forward onto Show-more and drill-in hrefs — see SessionsContent.
  accent?: string | null;
}) {
  const { event, speakers, total, page, q, tracks, activeTrackId, perPage, limit, embed, accent } = props;
  // DEC-433/477: parsePage clamps to MAX_PUBLIC_PAGE; stop offering
  // 'Show more' once there is no further page to link to, or once the
  // cumulative row ceiling (MAX_PUBLIC_ROWS) has already been reached.
  const hasMore = hasMorePages(speakers.length, total, page, perPage ?? PUBLIC_PER_PAGE);
  const base = embed ? "/embed" : "/e";
  const basePath = surfacePath(event, "speakers", base);
  const trackId = activeTrackId ?? null;
  // DEC-489 (wave-54 amendment): the surface's active `accent` knob (the
  // table lists no `fields` on speakers/gallery). Never emitted outside
  // /embed -- accent is a configured-embed knob, not a user filter.
  const embedCarryQs = embed ? embedKnobQuery("speakers", { accent }) : "";
  // DEC-289/DEC-489/DEC-990 amendment (wave 64): carry `limit`/`trackId`
  // forward exactly like SessionsContent's carryQs, so a configured embed
  // (or an active track facet) does not lose either on page 2.
  const carryQs = `${limit ? `limit=${limit}&` : ""}${trackId ? `trackId=${encodeURIComponent(trackId)}&` : ""}${embedCarryQs ? `${embedCarryQs}&` : ""}`;
  // DEC-919 (wave 47 amendment): 'fresh' -- no q/trackId facet in flight AND
  // total is 0 -- drops the search box + track facet select (nothing to
  // narrow yet) and never offers an escape link. Any facet in flight with
  // zero matches is 'filtered': the search/facet controls stay mounted and
  // the escape clears back to the bare surface path.
  const anyFilterActive = Boolean(q || trackId);
  const isFresh = !anyFilterActive && total === 0;
  return (
    <>
      <div class="chq-pub-title-row">
        <h1 class="chq-pub-surface-title">Speakers</h1>
        {!isFresh ? (
          <>
            <PublicSearchBox
              action={basePath}
              q={q}
              hidden={
                <>
                  {trackId ? <input type="hidden" name="trackId" value={trackId} /> : null}
                  {limit ? <input type="hidden" name="limit" value={String(limit)} /> : null}
                </>
              }
            />
            <TrackFacet action={basePath} tracks={tracks ?? []} activeTrackId={trackId} q={q} limit={limit} />
          </>
        ) : null}
        <SpeakerViewToggle event={event} active="speakers" q={q} trackId={trackId} limit={limit} base={base} />
      </div>
      {speakers.length === 0 ? (
        isFresh ? (
          <PublicEmptyState variant="fresh" what="No speakers listed yet." />
        ) : (
          <PublicEmptyState
            variant="filtered"
            what="No speakers match your search."
            escapeHref={basePath}
            escapeLabel="Clear filters"
          />
        )
      ) : (
        <>
          <p>
            {speakers.length} of {countOf(total, "speaker")}
          </p>
          <ul class="chq-pub-speaker-list">
            {speakers.map((sp) => (
              <SpeakerListRow event={event} sp={sp} embed={embed} carry={embedCarryQs || undefined} />
            ))}
          </ul>
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
  tracks?: PublicTrack[];
  activeTrackId?: string | null;
  perPage?: number;
  limit?: number | null;
  embed?: boolean;
  // DEC-489 (wave-54 amendment): see SpeakersContent above.
  accent?: string | null;
}) {
  const { event, speakers, total, page, q, tracks, activeTrackId, perPage, limit, embed, accent } = props;
  // DEC-433/477: see SpeakersContent above.
  const hasMore = hasMorePages(speakers.length, total, page, perPage ?? PUBLIC_PER_PAGE);
  const base = embed ? "/embed" : "/e";
  const basePath = surfacePath(event, "gallery", base);
  const trackId = activeTrackId ?? null;
  // DEC-489 (wave-54 amendment): see SpeakersContent above.
  const embedCarryQs = embed ? embedKnobQuery("gallery", { accent }) : "";
  // DEC-289/DEC-489/DEC-990 amendment (wave 64): see SpeakersContent above.
  const carryQs = `${limit ? `limit=${limit}&` : ""}${trackId ? `trackId=${encodeURIComponent(trackId)}&` : ""}${embedCarryQs ? `${embedCarryQs}&` : ""}`;
  // DEC-919 (wave 47 amendment): see SpeakersContent above -- the DEC-593
  // gallery twin gets the identical fresh/filtered split.
  const anyFilterActive = Boolean(q || trackId);
  const isFresh = !anyFilterActive && total === 0;
  return (
    <>
      <div class="chq-pub-title-row">
        <h1 class="chq-pub-surface-title">Speakers</h1>
        {!isFresh ? (
          <>
            <PublicSearchBox
              action={basePath}
              q={q}
              hidden={
                <>
                  {trackId ? <input type="hidden" name="trackId" value={trackId} /> : null}
                  {limit ? <input type="hidden" name="limit" value={String(limit)} /> : null}
                </>
              }
            />
            <TrackFacet action={basePath} tracks={tracks ?? []} activeTrackId={trackId} q={q} limit={limit} />
          </>
        ) : null}
        <SpeakerViewToggle event={event} active="gallery" q={q} trackId={trackId} limit={limit} base={base} />
      </div>
      {speakers.length === 0 ? (
        isFresh ? (
          <PublicEmptyState variant="fresh" what="No speakers listed yet." />
        ) : (
          <PublicEmptyState
            variant="filtered"
            what="No speakers match your search."
            escapeHref={basePath}
            escapeLabel="Clear filters"
          />
        )
      ) : (
        <>
          <p>
            {speakers.length} of {countOf(total, "speaker")}
          </p>
          <div class="chq-pub-speaker-grid chq-pub-gallery-grid">
            {speakers.map((sp) => (
              <SpeakerGridTile event={event} sp={sp} embed={embed} carry={embedCarryQs || undefined} />
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
