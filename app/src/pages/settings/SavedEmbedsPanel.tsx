// DEC-785: saved embeds -- named, listed, enable/disable-able server rows.
// Rendered by PublicPagesPanel below the existing surface rows, reusing
// that panel's row grammar (name · path · state pill via the existing
// chq-settings-public-pages-state classes · row action) rather than
// inventing new visual vocabulary. Its "Get code" control reuses
// embedSnippet.ts's buildSnippet the same way EmbedsPanel does, pointed at
// the saved embed's own addressable URL (/embed/e/:embedId) instead of the
// live-filtered URL EmbedsPanel builds. Disabling a row here has a REAL
// public effect (the field guide: "a control whose effect dies on reload is
// decoration") — that public 404 is proven by test/saved-embed-route.test.ts,
// not by this render test.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiList, apiPatch, apiPost, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { buildSnippet, describeEmbedRecipe, EMBED_SURFACES, type EmbedFormat, type EmbedSurface } from './embedSnippet';

interface SavedEmbed {
  id: string;
  name: string;
  surface: string;
  format: string;
  optionsJson: string;
  enabled: boolean;
}

interface Track {
  id: string;
  name: string;
}

export function SavedEmbedsPanel() {
  const { eventId } = useCurrentEvent();
  const [searchParams] = useSearchParams();
  const [embeds, setEmbeds] = useState<SavedEmbed[] | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [surface, setSurface] = useState<EmbedSurface>('sessions');
  const [creating, setCreating] = useState(false);
  const [codeOpenId, setCodeOpenId] = useState<string | null>(null);

  function load() {
    if (!eventId) return;
    apiList<SavedEmbed>(`/events/${eventId}/embeds`)
      .then((res) => setEmbeds(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load saved embeds'));
    apiList<Track>(`/events/${eventId}/tracks`)
      .then((res) => setTracks(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load tracks'));
  }

  useEffect(load, [eventId]);

  const trackNameById: Record<string, string> = Object.fromEntries(tracks.map((t) => [t.id, t.name]));

  // DEC-822: the Edit link opens the builder at ?embed=<id>, preserving
  // every other search param (e.g. ?section=public-pages&edit=1) so it
  // stays inside the drilled edit view instead of navigating away.
  function editHref(id: string): string {
    const params = new URLSearchParams(searchParams);
    params.set('embed', id);
    return `?${params.toString()}`;
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!eventId || !name.trim()) return;
    setCreating(true);
    try {
      await apiPost(`/events/${eventId}/embeds`, { name: name.trim(), surface, format: 'iframe', options: {} });
      setName('');
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save embed');
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(embed: SavedEmbed) {
    try {
      await apiPatch(`/embeds/${embed.id}`, { enabled: !embed.enabled });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update saved embed');
    }
  }

  if (!eventId) return null;

  return (
    <section className="chq-settings-panel" aria-label="Saved embeds">
      <h2>Saved embeds</h2>
      <p className="chq-settings-note">Turning one off breaks it wherever it is pasted</p>
      {error ? <p role="alert">{error}</p> : null}

      {embeds === null ? (
        <DelayedLoading />
      ) : embeds.length === 0 ? (
        <p>No saved embeds yet.</p>
      ) : (
        <ul className="chq-settings-public-pages-list">
          {embeds.map((embed) => {
            const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/embed/e/${embed.id}`;
            const snippet = buildSnippet(url, embed.surface as EmbedSurface, embed.format as EmbedFormat);
            // DEC-822: the row states the recipe it stores, not just its
            // name — derived from the SAME stored surface/format/options a
            // Save would have written, so it can never drift from what the
            // embed actually renders.
            const recipe = describeEmbedRecipe(embed.surface, embed.format, embed.optionsJson, trackNameById);
            return (
              <li key={embed.id} className="chq-settings-public-pages-row">
                <span className="chq-settings-public-pages-name">{embed.name}</span>
                <span className="chq-settings-public-pages-path">{`/embed/e/${embed.id}`}</span>
                <span className="chq-embeds-recipe">{recipe}</span>
                <span
                  className={`chq-settings-public-pages-state chq-settings-public-pages-state-${
                    embed.enabled ? 'live' : 'muted'
                  }`}
                >
                  {embed.enabled ? 'Live' : 'Disabled'}
                </span>
                <Link className="chq-link-button" to={editHref(embed.id)}>
                  Edit
                </Link>
                <button
                  type="button"
                  className="chq-link-button"
                  onClick={() => setCodeOpenId((current) => (current === embed.id ? null : embed.id))}
                >
                  Get code
                </button>
                <button type="button" className="chq-link-button" onClick={() => void handleToggle(embed)}>
                  {embed.enabled ? 'Disable' : 'Enable'}
                </button>
                {codeOpenId === embed.id ? <code>{snippet}</code> : null}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={(e) => void handleCreate(e)}>
        <label>
          Name
          <input
            className="chq-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Homepage sessions widget"
            required
          />
        </label>
        <label>
          Surface
          <select className="chq-select" value={surface} onChange={(e) => setSurface(e.target.value as EmbedSurface)}>
            {EMBED_SURFACES.map((s) => (
              <option key={s} value={s}>
                {s[0]!.toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="chq-btn chq-btn-primary" disabled={creating || !name.trim()}>
          Save embed
        </button>
      </form>
    </section>
  );
}
