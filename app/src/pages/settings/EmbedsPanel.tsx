// EMB-15 / DEC-289: organizer-side embed builder. Lets an organizer pick a
// public surface, an output format, filter knobs (track, day, limit,
// field selection) and a branding accent, then copies the resulting URL or
// snippet. Every knob maps 1:1 onto the query-param contract fixed in
// decisions/DEC-289.md via embedSnippet.ts's pure builders.
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DateField } from '../../components/DateField';
import { DelayedLoading } from '../../components/DelayedLoading';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { apiGet, apiList, apiPatch, apiPost, ApiError } from '../../lib/api';
import { copyText } from '../../lib/clipboard';
import { capitalizeFirst } from '../../lib/plural';
import {
  buildEmbedUrl,
  buildSnippet,
  DEFAULT_ACCENT_PLACEHOLDER,
  EMBED_FIELDS,
  EMBED_FORMATS,
  EMBED_KNOBS_BY_SURFACE,
  EMBED_SURFACES,
  trackKnobMode,
  type EmbedField,
  type EmbedFormat,
  type EmbedSurface,
} from './embedSnippet';
import { MAX_NAME_LENGTH } from '../../../../src/forms/validate';

// DEC-822/DEC-839: the shape a saved embed row comes back as from GET
// /events/:eventId/embeds (src/server/repo/embeds.ts's EmbedRecord,
// serialized) — loaded here (via the list endpoint; there is no
// GET-by-id) to populate the builder when opened at ?embed=<id>. Per
// DEC-839's wire contract, `options` is the PARSED object, never the
// stored JSON string.
interface SavedEmbedRow {
  id: string;
  name: string;
  surface: string;
  format: string;
  options: StoredEmbedOptions;
}

interface StoredEmbedOptions {
  trackId?: string;
  sessionFormat?: string;
  roomId?: string;
  day?: string;
  q?: string;
  limit?: number;
  fields?: EmbedField[];
  accent?: string;
}

interface EventDetail {
  id: string;
  slug: string;
  name: string;
  startDate?: string;
}

// w4-b/DEC-785 amendment: the Day placeholder is a worked example in the
// SAME "11 May 2028" grammar DateField speaks, but the hardcoded 2028 read
// as a real (and eventually stale) year -- derive the year from this
// event's own start date so the example ages with the event instead of a
// literal. Falls back to the original literal year when the event hasn't
// loaded yet or has no start date.
function dayPlaceholder(event: EventDetail | null): string {
  const year = event?.startDate ? Number(event.startDate.slice(0, 4)) : NaN;
  return `11 May ${Number.isFinite(year) ? year : 2028}`;
}

interface Track {
  id: string;
  name: string;
  color: string | null;
}

// Human-readable labels for the raw field-vocabulary keys (EMBED_FIELDS),
// per DEC-673: an internal shorthand is not public prose.
const FIELD_LABELS: Record<EmbedField, string> = {
  track: 'Track',
  time: 'Time',
  room: 'Room',
  speaker: 'Speaker',
  description: 'Description',
  format: 'Format',
};

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
  const [searchParams] = useSearchParams();
  // DEC-822: ?embed=<id> puts the builder into edit mode for that saved
  // embed — it loads the row (name + full recipe), heads itself
  // 'Editing · <name>', and Save PATCHes it instead of creating a new one.
  const embedIdParam = searchParams.get('embed');
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [copyResult, setCopyResult] = useState<{ target: 'url' | 'snippet'; ok: boolean; text: string } | null>(
    null,
  );
  const failedCopyRef = useRef<HTMLInputElement | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  // DEC-856 (wave 67 amendment): POST/PATCH /events/:eventId/embeds |
  // /embeds/:id throws a fields map keyed by name/surface/format/trackId/
  // sessionFormat/roomId/day/q/limit/fields/accent/options -- every one of
  // those has a dedicated control on this form. A key this form has no
  // control for still renders, labelled, never dropped.
  const [saveFieldErrors, setSaveFieldErrors] = useState<Record<string, string>>({});
  const KNOWN_SAVE_FIELDS: readonly string[] = [
    'name',
    'surface',
    'format',
    'trackId',
    'sessionFormat',
    'roomId',
    'day',
    'q',
    'limit',
    'fields',
    'accent',
  ];

  const [surface, setSurface] = useState<EmbedSurface>('sessions');
  const [format, setFormat] = useState<EmbedFormat>('iframe');
  const [trackId, setTrackId] = useState('');
  // DEC-774: session-format/room filter knobs (sessions surface only).
  // Named sessionFormat/roomId to avoid colliding with the `format` state
  // above (the embed's own output format).
  const [sessionFormat, setSessionFormat] = useState('');
  const [roomId, setRoomId] = useState('');
  const [day, setDay] = useState('');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState('');
  const [fields, setFields] = useState<EmbedField[]>([...EMBED_FIELDS]);
  const [accent, setAccent] = useState('');

  useEffect(() => {
    if (!eventId) return;
    // DEC-856 (wave 71 amendment): clear the page-level banner before any
    // read is issued -- so a stale refusal never sits beside a later
    // successful reload (TracksRoomsPanel's shape).
    setLoadError(undefined);
    apiGet<EventDetail>(`/events/${eventId}`)
      .then(setEvent)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Failed to load event'));
    apiList<Track>(`/events/${eventId}/tracks`)
      .then((res) => setTracks(res.items))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Failed to load tracks'));
  }, [eventId]);

  // DEC-822: loads the saved embed's row via the list endpoint (there is
  // no GET-by-id) and populates every knob from its stored options, so
  // editing an existing embed starts from its real saved recipe.
  useEffect(() => {
    if (!eventId || !embedIdParam) return;
    // DEC-856 (wave 71 amendment): clear the page-level banner before the
    // read is issued -- so a stale refusal never sits beside a later
    // successful reload (TracksRoomsPanel's shape).
    setLoadError(undefined);
    apiList<SavedEmbedRow>(`/events/${eventId}/embeds`)
      .then((res) => {
        const found = res.items.find((row) => row.id === embedIdParam);
        if (!found) return;
        setEditingId(found.id);
        setName(found.name);
        setSurface(found.surface as EmbedSurface);
        setFormat(found.format as EmbedFormat);
        const opts: StoredEmbedOptions = found.options ?? {};
        setTrackId(opts.trackId ?? '');
        setSessionFormat(opts.sessionFormat ?? '');
        setRoomId(opts.roomId ?? '');
        setDay(opts.day ?? '');
        setQ(opts.q ?? '');
        setLimit(opts.limit !== undefined ? String(opts.limit) : '');
        setFields(Array.isArray(opts.fields) && opts.fields.length > 0 ? opts.fields : [...EMBED_FIELDS]);
        setAccent(opts.accent ?? '');
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Failed to load the saved embed'));
  }, [eventId, embedIdParam]);

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

  // DEC-822: the builder's PRIMARY action — writes the FULL current knob
  // set as the embed's options (not just name/enabled), so a saved
  // embed's filters can be edited later and every page it's pasted on
  // picks up the change. PATCHes when editing an existing row (?embed=),
  // otherwise POSTs a new one and switches into editing it.
  async function handleSave() {
    if (!eventId || !name.trim()) return;
    setSaving(true);
    setSaveError(undefined);
    setSaveFieldErrors({});
    const options: StoredEmbedOptions = {
      trackId: trackId || undefined,
      sessionFormat: sessionFormat || undefined,
      roomId: roomId || undefined,
      day: day || undefined,
      q: q || undefined,
      limit: limit ? Number(limit) : undefined,
      fields,
      accent: accent || undefined,
    };
    try {
      if (editingId) {
        await apiPatch(`/embeds/${editingId}`, { name: name.trim(), surface, format, options });
      } else {
        const created = await apiPost<{ id: string }>(`/events/${eventId}/embeds`, {
          name: name.trim(),
          surface,
          format,
          options,
        });
        setEditingId(created.id);
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      // DEC-856: a fields map is never collapsed to err.message -- each
      // named key routes to its own control below; an unmatched key still
      // renders labelled ("<key>: <message>"), never dropped.
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) {
        setSaveFieldErrors(err.fields as Record<string, string>);
      } else {
        setSaveError(err instanceof ApiError ? err.message : 'Failed to save embed');
      }
    } finally {
      setSaving(false);
    }
  }

  const saveUnownedErrors = Object.entries(saveFieldErrors).filter(([key]) => !KNOWN_SAVE_FIELDS.includes(key));

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
        sessionFormat: sessionFormat || undefined,
        roomId: roomId || undefined,
        day: day || undefined,
        q: q || undefined,
        limit: limit ? Number(limit) : undefined,
        fields,
        accent: accent || undefined,
      })
    : '';
  const snippet = event ? buildSnippet(url, surface, format) : '';

  return (
    <section className="chq-settings-panel chq-embeds-panel" aria-label="Embeds">
      <h2>{editingId ? `Editing · ${name || '…'}` : 'Embeds'}</h2>
      <p>
        Build a share link for a public surface (chromeless, no login required) — pick a surface, an
        output format, and any filters or branding, then Save it as a named embed (or copy the URL/snippet
        for a one-off, unsaved link).
      </p>
      {eventLoading ? <DelayedLoading /> : null}
      {eventError || loadError ? (
        <div className="chq-error" role="alert">
          {eventError ?? loadError}
        </div>
      ) : null}

      {event ? (
        <div className="chq-embeds-form">
          {/* w4-b/DEC-785 amendment: NAME|SURFACE and FORMAT|TRACK pair
              two-up -- the editor speaks the settings grid vocabulary
              rather than one label per row. */}
          <div className="chq-settings-embed-field-pair">
            <label>
              Name
              <input
                className="chq-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Homepage sessions widget"
                maxLength={MAX_NAME_LENGTH}
              />
            </label>
            {saveFieldErrors.name ? (
              <span role="alert" className="chq-field-error">
                {saveFieldErrors.name}
              </span>
            ) : null}

            <label>
              Surface
              <select
                className="chq-select"
                value={surface}
                onChange={(e) => setSurface(e.target.value as EmbedSurface)}
              >
                {EMBED_SURFACES.map((opt) => (
                  <option key={opt} value={opt}>
                    {capitalizeFirst(opt)}
                  </option>
                ))}
              </select>
            </label>
            {saveFieldErrors.surface ? (
              <span role="alert" className="chq-field-error">
                {saveFieldErrors.surface}
              </span>
            ) : null}
          </div>

          <div className="chq-settings-embed-field-pair">
            <label>
              Format
              <select
                className="chq-select"
                value={format}
                onChange={(e) => setFormat(e.target.value as EmbedFormat)}
              >
                {formatsFor(surface).map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            {saveFieldErrors.format ? (
              <span role="alert" className="chq-field-error">
                {saveFieldErrors.format}
              </span>
            ) : null}

            {knobs.includes('trackId') ? (
              <>
                <label>
                  {trackKnobMode(surface) === 'highlight' ? 'Highlight track' : 'Track'}
                  <select
                    className="chq-select"
                    value={trackId}
                    onChange={(e) => setTrackId(e.target.value)}
                  >
                    <option value="">(all tracks)</option>
                    {tracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                {trackKnobMode(surface) === 'highlight' ? (
                  <p className="chq-embeds-note">
                    This calls out the track's sessions — every session still shows, none are filtered out.
                  </p>
                ) : null}
                {saveFieldErrors.trackId ? (
                  <span role="alert" className="chq-field-error">
                    {saveFieldErrors.trackId}
                  </span>
                ) : null}
              </>
            ) : null}
          </div>

          {knobs.includes('format') ? (
            <>
              <label>
                Session format
                <input
                  className="chq-input"
                  type="text"
                  value={sessionFormat}
                  onChange={(e) => setSessionFormat(e.target.value)}
                  placeholder="(all formats)"
                  maxLength={MAX_NAME_LENGTH}
                />
              </label>
              {saveFieldErrors.sessionFormat ? (
                <span role="alert" className="chq-field-error">
                  {saveFieldErrors.sessionFormat}
                </span>
              ) : null}
            </>
          ) : null}

          {knobs.includes('roomId') ? (
            <>
              <label>
                Room ID
                <input
                  className="chq-input"
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="(all rooms)"
                  maxLength={MAX_NAME_LENGTH}
                />
              </label>
              {saveFieldErrors.roomId ? (
                <span role="alert" className="chq-field-error">
                  {saveFieldErrors.roomId}
                </span>
              ) : null}
            </>
          ) : null}

          {knobs.includes('day') ? (
            <>
              <label htmlFor="embed-day">
                Day
                <DateField id="embed-day" value={day} onChange={setDay} placeholder={dayPlaceholder(event)} />
              </label>
              {saveFieldErrors.day ? (
                <span role="alert" className="chq-field-error">
                  {saveFieldErrors.day}
                </span>
              ) : null}
            </>
          ) : null}

          {knobs.includes('q') ? (
            <>
              <label>
                Search
                <input
                  className="chq-input"
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="(no search)"
                  maxLength={MAX_NAME_LENGTH}
                />
              </label>
              {saveFieldErrors.q ? (
                <span role="alert" className="chq-field-error">
                  {saveFieldErrors.q}
                </span>
              ) : null}
            </>
          ) : null}

          {knobs.includes('limit') ? (
            <>
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
              {saveFieldErrors.limit ? (
                <span role="alert" className="chq-field-error">
                  {saveFieldErrors.limit}
                </span>
              ) : null}
            </>
          ) : null}

          {knobs.includes('fields') ? (
            // w4-b/DEC-785 amendment: the settings eyebrow markup replaces
            // the native fieldset/legend -- a fieldset draws a notched
            // browser border that no other settings control speaks, and
            // this group's semantics (a labelled group of toggles) are
            // already carried by role="group"/aria-label, same as every
            // other chipstrip in Settings.
            <div className="chq-settings-embed-fields" role="group" aria-label="Fields shown">
              <p className="chq-settings-eyebrow">Fields shown</p>
              {/* w41-h/DEC-785: one row of aria-pressed toggle pills, not six
                  stacked checkbox rows -- the selected-fields state and what
                  Save writes are unchanged (toggleField), only the control
                  shape. Reuses the shared chq-chipstrip/chq-pill vocabulary
                  (CallForPapersPanel's "Tracks offered" row) rather than
                  inventing a second pill grammar. */}
              <div className="chq-chipstrip">
                {EMBED_FIELDS.map((field) => (
                  <button
                    key={field}
                    type="button"
                    className={fields.includes(field) ? 'chq-pill is-active' : 'chq-pill'}
                    aria-pressed={fields.includes(field)}
                    onClick={() => toggleField(field)}
                  >
                    {FIELD_LABELS[field]}
                  </button>
                ))}
              </div>
              {saveFieldErrors.fields ? (
                <span role="alert" className="chq-field-error">
                  {saveFieldErrors.fields}
                </span>
              ) : null}
            </div>
          ) : null}

          <label htmlFor="embed-accent-color">
            Accent color
            <input
              id="embed-accent-color"
              className="chq-input"
              type="text"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              placeholder={`#${DEFAULT_ACCENT_PLACEHOLDER}`}
            />
          </label>
          {saveFieldErrors.accent ? (
            <span role="alert" className="chq-field-error">
              {saveFieldErrors.accent}
            </span>
          ) : null}

          <div className="chq-embeds-output">
            <button
              type="button"
              className="chq-btn chq-btn-primary"
              disabled={saving || !name.trim()}
              onClick={() => void handleSave()}
            >
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save embed'}
            </button>
            {saveError ? (
              <div className="chq-error" role="alert">
                {saveError}
              </div>
            ) : null}
            {saveUnownedErrors.length > 0 ? (
              <div className="chq-error" role="alert">
                {saveUnownedErrors.map(([key, message]) => (
                  <p key={key} className="chq-field-error">
                    {`${key}: ${message}`}
                  </p>
                ))}
              </div>
            ) : null}
            <div role="status" aria-live="polite" className="chq-save-status">
              {saved ? 'Saved' : null}
            </div>

            {/* w19-c/DEC-785 amendment: the frame draws ONE boxed snippet
                readout (docs/design/Chautauqua Settings.dc.html :1082-1090),
                not a separate URL block stacked above a Snippet block. Copy
                URL survives as a tertiary link inside the shared action row
                rather than a block of its own. */}
            <div className="chq-embeds-output-block">
              <span className="chq-settings-eyebrow">Snippet</span>
              <code>{snippet}</code>
              <div className="chq-embeds-output-actions">
                <button
                  type="button"
                  className="chq-btn chq-btn-secondary"
                  onClick={() => void handleCopy('snippet', snippet)}
                >
                  {copyResult?.target === 'snippet' && copyResult.ok ? 'Copied!' : 'Copy snippet'}
                </button>
                <button
                  type="button"
                  className="chq-btn chq-btn-tertiary"
                  onClick={() => void handleCopy('url', url)}
                >
                  {copyResult?.target === 'url' && copyResult.ok ? 'Copied!' : 'Copy URL'}
                </button>
                {/* w41-h/DEC-785: Preview opens the SAME url the snippet embeds
                    (built above via buildEmbedUrl) -- never a second URL
                    builder, so the preview can never drift from what the
                    snippet/Copy URL actually point at. */}
                <a className="chq-btn chq-btn-tertiary" href={url} target="_blank" rel="noreferrer">
                  Preview
                </a>
              </div>
              <span className="chq-embeds-note">
                The URL carries the embed&apos;s name, so changing these settings updates every page it is
                pasted on
              </span>
            </div>
            <div role="status" aria-live="polite" className="chq-copy-status">
              {copyResult
                ? copyResult.ok
                  ? 'Copied'
                  : 'Copy failed — select the text and copy it manually'
                : null}
            </div>
            {copyResult && !copyResult.ok ? (
              <input
                id="embed-copy-fallback"
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
