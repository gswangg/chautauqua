// EMB-15 / DEC-289: organizer-side embed builder. Lets an organizer pick a
// public surface, an output format, filter knobs (track, day, limit,
// field selection) and a branding accent, then copies the resulting URL or
// snippet. Every knob maps 1:1 onto the query-param contract fixed in
// decisions/DEC-289.md via embedSnippet.ts's pure builders.
import { useEffect, useRef, useState } from 'react';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { apiGet, ApiError } from '../../lib/api';
import { copyText } from '../../lib/clipboard';
import {
  buildEmbedUrl,
  buildSnippet,
  EMBED_FIELDS,
  EMBED_FORMATS,
  EMBED_KNOBS_BY_SURFACE,
  EMBED_SURFACES,
  type EmbedField,
  type EmbedFormat,
  type EmbedSurface,
} from './embedSnippet';

interface EventDetail {
  id: string;
  slug: string;
  name: string;
}

// DEC-289: ics is the fixed full-agenda feed — only meaningful from the
// agenda/schedule surfaces. json is available from every surface.
function formatsFor(surface: EmbedSurface): EmbedFormat[] {
  return EMBED_FORMATS.filter((format) => {
    if (format === 'ics') return surface === 'agenda' || surface === 'schedule';
    return true;
  });
}

export function EmbedsPanel() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [copyResult, setCopyResult] = useState<{ target: 'url' | 'snippet'; ok: boolean; text: string } | null>(
    null,
  );
  const failedCopyRef = useRef<HTMLInputElement | null>(null);

  const [surface, setSurface] = useState<EmbedSurface>('sessions');
  const [format, setFormat] = useState<EmbedFormat>('iframe');
  const [trackId, setTrackId] = useState('');
  const [day, setDay] = useState('');
  const [limit, setLimit] = useState('');
  const [fields, setFields] = useState<EmbedField[]>([...EMBED_FIELDS]);
  const [accent, setAccent] = useState('');

  useEffect(() => {
    if (!eventId) return;
    apiGet<EventDetail>(`/events/${eventId}`)
      .then(setEvent)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Failed to load event'));
  }, [eventId]);

  // Keep the format valid whenever the surface changes away from
  // agenda/schedule while ics was selected.
  useEffect(() => {
    if (!formatsFor(surface).includes(format)) {
      setFormat('iframe');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface]);

  function toggleField(field: EmbedField) {
    setFields((current) =>
      current.includes(field) ? current.filter((f) => f !== field) : [...current, field],
    );
  }

  async function handleCopy(target: 'url' | 'snippet', text: string) {
    const ok = await copyText(text);
    setCopyResult({ target, ok, text });
    if (ok) {
      window.setTimeout(() => setCopyResult((current) => (current?.target === target ? null : current)), 2000);
    }
  }

  useEffect(() => {
    if (copyResult && !copyResult.ok) {
      failedCopyRef.current?.focus();
      failedCopyRef.current?.select();
    }
  }, [copyResult]);

  const knobs = EMBED_KNOBS_BY_SURFACE[surface];

  const url = event
    ? buildEmbedUrl(window.location.origin, event.slug, surface, {
        format,
        trackId: trackId || undefined,
        day: day || undefined,
        limit: limit ? Number(limit) : undefined,
        fields,
        accent: accent || undefined,
      })
    : '';
  const snippet = event ? buildSnippet(url, surface, format) : '';

  return (
    <section className="chq-settings-panel chq-embeds-panel" aria-label="Embeds">
      <h2>Embeds</h2>
      <p>
        Build a share link for a public surface (chromeless, no login required) — pick a surface, an
        output format, and any filters or branding, then copy the URL or snippet below.
      </p>
      {eventLoading ? <p>Loading…</p> : null}
      {eventError || loadError ? (
        <div className="chq-error" role="alert">
          {eventError ?? loadError}
        </div>
      ) : null}

      {event ? (
        <div className="chq-embeds-form">
          <label>
            Surface
            <select
              className="chq-select"
              value={surface}
              onChange={(e) => setSurface(e.target.value as EmbedSurface)}
            >
              {EMBED_SURFACES.map((s) => (
                <option key={s} value={s}>
                  {s[0]!.toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Format
            <select className="chq-select" value={format} onChange={(e) => setFormat(e.target.value as EmbedFormat)}>
              {formatsFor(surface).map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          {knobs.includes('trackId') ? (
            <label>
              Track ID
              <input
                className="chq-input"
                type="text"
                value={trackId}
                onChange={(e) => setTrackId(e.target.value)}
                placeholder="(all tracks)"
              />
            </label>
          ) : null}

          {knobs.includes('day') ? (
            <label>
              Day
              <input
                className="chq-input"
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </label>
          ) : null}

          {knobs.includes('limit') ? (
            <label>
              Limit
              <input
                className="chq-input"
                type="number"
                min={1}
                max={100}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="(no limit)"
              />
            </label>
          ) : null}

          {knobs.includes('fields') ? (
            <fieldset>
              <legend>Fields</legend>
              {EMBED_FIELDS.map((field) => (
                <label key={field}>
                  <input
                    className="chq-check"
                    type="checkbox"
                    checked={fields.includes(field)}
                    onChange={() => toggleField(field)}
                  />
                  {field}
                </label>
              ))}
            </fieldset>
          ) : null}

          <label>
            Accent color
            <input
              className="chq-input"
              type="text"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              placeholder="#4f46e5"
            />
          </label>

          <div className="chq-embeds-output">
            <p>
              <strong>URL</strong>
            </p>
            <code>{url}</code>
            <button type="button" className="chq-btn chq-btn-secondary" onClick={() => void handleCopy('url', url)}>
              {copyResult?.target === 'url' && copyResult.ok ? 'Copied!' : 'Copy URL'}
            </button>
            <p>
              <strong>Snippet</strong>
            </p>
            <code>{snippet}</code>
            <button
              type="button"
              className="chq-btn chq-btn-primary"
              onClick={() => void handleCopy('snippet', snippet)}
            >
              {copyResult?.target === 'snippet' && copyResult.ok ? 'Copied!' : 'Copy snippet'}
            </button>
            <div role="status" aria-live="polite" className="chq-copy-status">
              {copyResult
                ? copyResult.ok
                  ? 'Copied'
                  : 'Copy failed — select the text and copy it manually'
                : null}
            </div>
            {copyResult && !copyResult.ok ? (
              <input
                ref={failedCopyRef}
                className="chq-input"
                readOnly
                value={copyResult.text}
                onFocus={(e) => e.currentTarget.select()}
                aria-label={`${copyResult.target === 'url' ? 'URL' : 'Snippet'} to copy manually`}
              />
            ) : null}
            <p className="chq-embeds-note">
              This embed is chromeless and needs no login — anyone with the URL can view it.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
