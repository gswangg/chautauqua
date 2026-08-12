// Call for papers settings panel (w2-i, DEC-588 Tier 2 item 13): the
// event's default CFP form -- intro text, open/close window and offered
// tracks -- via the landed w2-c forms API. Field editing stays in the
// dedicated form builder (/admin/submissions/forms); this panel only
// links there rather than re-implementing it. Zero new server endpoints.
import { useEffect, useRef, useState } from 'react';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiGet, apiList, apiPatch, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { dateInputToMs, msToDateInput } from '../../lib/dates';
import { copyText } from '../../lib/clipboard';

interface EventSummary {
  id: string;
  slug: string;
}

interface EventTrack {
  id: string;
  name: string;
}

interface CfpForm {
  id: string;
  eventId: string;
  intro?: string | null;
  openDate?: number | null;
  closeDate?: number | null;
  tracks?: string[] | null;
}

export function CallForPapersPanel() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [form, setForm] = useState<CfpForm | null>(null);
  const [tracks, setTracks] = useState<EventTrack[]>([]);
  const [intro, setIntro] = useState('');
  const [openDate, setOpenDate] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copyResult, setCopyResult] = useState<{ ok: boolean; text: string } | null>(null);
  const failedCopyRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiGet<EventSummary>(`/events/${eventId}`),
      apiGet<CfpForm>(`/events/${eventId}/forms`),
      apiList<EventTrack>(`/events/${eventId}/tracks`),
    ])
      .then(([ev, formResult, tracksResult]) => {
        setEvent(ev);
        setForm(formResult);
        setTracks(tracksResult.items);
        setIntro(formResult.intro ?? '');
        setOpenDate(msToDateInput(formResult.openDate ?? null));
        setCloseDate(msToDateInput(formResult.closeDate ?? null));
        setSelectedTracks(formResult.tracks ?? []);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load the CFP form'))
      .finally(() => setLoading(false));
  }, [eventId]);

  function toggleTrack(trackId: string) {
    setSelectedTracks((prev) => (prev.includes(trackId) ? prev.filter((t) => t !== trackId) : [...prev, trackId]));
    setSaved(false);
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiPatch<CfpForm>(`/forms/${form.id}`, {
        intro: intro.trim().length > 0 ? intro : null,
        openDate: dateInputToMs(openDate),
        closeDate: dateInputToMs(closeDate),
        tracks: selectedTracks,
      });
      setForm(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save the CFP form');
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyLink(publicLink: string) {
    const ok = await copyText(publicLink);
    setCopyResult({ ok, text: publicLink });
    if (ok) {
      window.setTimeout(() => setCopyResult(null), 2000);
    }
  }

  useEffect(() => {
    if (copyResult && !copyResult.ok) {
      failedCopyRef.current?.focus();
      failedCopyRef.current?.select();
    }
  }, [copyResult]);

  const publicLink = event ? `${window.location.origin}/submit/${event.slug}` : '';

  return (
    <section className="chq-settings-panel chq-settings-numbered" aria-label="Call for papers">
      <div className="chq-settings-section-head">
        <h2>Call for papers</h2>
        <a href="/admin/submissions/forms" className="chq-settings-section-action">
          Edit the form
        </a>
      </div>
      {eventLoading || loading ? <DelayedLoading /> : null}
      {eventError || error ? <p role="alert">{eventError ?? error}</p> : null}

      {event ? (
        <div className="chq-settings-row">
          <span className="chq-settings-row-label">Public link</span>
          <div className="chq-settings-row-value">
            <span>{publicLink}</span>
            <a href={publicLink} className="chq-settings-inline-action">
              Open
            </a>
            <button type="button" className="chq-link-button" onClick={() => void handleCopyLink(publicLink)}>
              {copyResult?.ok ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div role="status" aria-live="polite" className="chq-copy-status">
            {copyResult ? (copyResult.ok ? 'Copied' : 'Copy failed — select the text and copy it manually') : null}
          </div>
          {copyResult && !copyResult.ok ? (
            <input
              ref={failedCopyRef}
              className="chq-input"
              readOnly
              value={copyResult.text}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Public link to copy manually"
            />
          ) : null}
        </div>
      ) : null}

      {form ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          <div className="chq-settings-row">
            <label>
              Intro text
              <textarea
                className="chq-textarea"
                value={intro}
                onChange={(e) => {
                  setIntro(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
          </div>
          <div className="chq-settings-row">
            <label>
              Opens
              <input
                className="chq-input"
                type="date"
                value={openDate}
                onChange={(e) => {
                  setOpenDate(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
          </div>
          <div className="chq-settings-row">
            <label>
              Closes
              <input
                className="chq-input"
                type="date"
                value={closeDate}
                onChange={(e) => {
                  setCloseDate(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
          </div>
          <fieldset className="chq-settings-row">
            <legend>Tracks offered</legend>
            {tracks.length === 0 && <p>No tracks configured for this event yet.</p>}
            <div className="chq-chipstrip">
              {tracks.map((track) => (
                <button
                  key={track.id}
                  type="button"
                  className={selectedTracks.includes(track.id) ? 'chq-pill is-active' : 'chq-pill'}
                  aria-pressed={selectedTracks.includes(track.id)}
                  onClick={() => toggleTrack(track.id)}
                >
                  {track.name}
                </button>
              ))}
            </div>
          </fieldset>
          <button type="submit" className="chq-btn chq-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved ? <span role="status"> Saved.</span> : null}
        </form>
      ) : null}
    </section>
  );
}
