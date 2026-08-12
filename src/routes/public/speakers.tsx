// Speakers / gallery surfaces (DEC-151 name search). Split out of the
// former monolithic src/routes/public.tsx (contention decomposition) — no
// behavior change.

import type { PublicEvent, PublicSpeakerWithSessions } from "../../server/repo/public";
import { speakerDetailPath, surfacePath } from "./shell";

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

export function SpeakersContent(props: { event: PublicEvent; speakers: PublicSpeakerWithSessions[]; q: string | null }) {
  const { event, speakers, q } = props;
  return (
    <>
      <h2>Speakers</h2>
      <NameSearchForm action={surfacePath(event, "speakers")} q={q} />
      {speakers.length === 0 ? (
        <p>No speakers to show yet.</p>
      ) : (
        <div class="chq-pub-speaker-grid">
          {speakers.map((sp) => (
            <div class="chq-pub-speaker-card">
              <a href={speakerDetailPath(event, sp.contactId, "speakers")}>
                {sp.headshotUrl ? (
                  <img src={sp.headshotUrl} alt={`${sp.firstName} ${sp.lastName}`} />
                ) : (
                  <div class="chq-pub-headshot-fallback" />
                )}
              </a>
              <a class="chq-pub-speaker-name" href={speakerDetailPath(event, sp.contactId, "speakers")}>
                {sp.firstName} {sp.lastName}
              </a>
              <p class="chq-pub-speaker-role">{[sp.title, sp.company].filter(Boolean).join(", ")}</p>
              <ul class="chq-pub-speaker-sessions">
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

export function GalleryContent(props: { event: PublicEvent; speakers: PublicSpeakerWithSessions[]; q: string | null }) {
  const { event, speakers, q } = props;
  return (
    <>
      <h2>Speaker gallery</h2>
      <p>Headshots only, no session details.</p>
      <NameSearchForm action={surfacePath(event, "gallery")} q={q} />
      <div class="chq-pub-gallery-grid">
        {speakers.map((sp) => (
          <a href={speakerDetailPath(event, sp.contactId, "gallery")}>
            <div class="chq-pub-gallery-tile">
              {sp.headshotUrl ? <img src={sp.headshotUrl} alt={`${sp.firstName} ${sp.lastName}`} /> : null}
            </div>
            <span class="chq-pub-gallery-name">
              {sp.firstName} {sp.lastName}
            </span>
          </a>
        ))}
      </div>
    </>
  );
}
