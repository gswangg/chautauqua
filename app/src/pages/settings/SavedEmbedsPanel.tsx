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
//
// w1-f, DEC-785 amendment: this panel is only ever mounted inside its
// caller's own edit drill (PublicPagesPanel), so at rest it must not ALSO
// dump straight into the full Edit/Turn-on-off/Delete/Build surface -- it
// owns its own local summary/edit split. At rest each row still states its
// name, recipe and On/Off pill and still offers "Get code" (a read, not a
// write), but Edit/Turn on-off/Delete/Build an embed move behind the
// panel's own 'Change'.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiDelete, apiList, apiPatch, ApiError } from '../../lib/api';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { buildSnippet, type EmbedFormat, type EmbedOptions, type EmbedSurface } from './embedSnippet';
import { formatEmbedRecipe } from './embedRecipe';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { PUBLIC_PAGES_STATE_TONE_CLASS } from './publicPagesState';

// DEC-839: the wire contract — `options` is the PARSED object a saved-embed
// row carries over the wire, never the stored JSON string.
interface SavedEmbed {
  id: string;
  name: string;
  surface: string;
  format: string;
  options: EmbedOptions;
  enabled: boolean;
}

interface Track {
  id: string;
  name: string;
}

interface Props {
  onBuild?: () => void;
}

export function SavedEmbedsPanel({ onBuild }: Props) {
  const { eventId } = useCurrentEvent();
  const [searchParams] = useSearchParams();
  const [embeds, setEmbeds] = useState<SavedEmbed[] | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [codeOpenId, setCodeOpenId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SavedEmbed | null>(null);
  const [deleting, setDeleting] = useState(false);
  // w1-f, DEC-785: local read/edit split -- defaults to the read-only rows
  // (name + recipe + On/Off pill + Get code); 'Change' reveals Edit/Turn
  // on-off/Delete and the "Build an embed" disclosure.
  const [showEditor, setShowEditor] = useState(false);

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

  async function handleToggle(embed: SavedEmbed) {
    try {
      await apiPatch(`/embeds/${embed.id}`, { enabled: !embed.enabled });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update saved embed');
    }
  }

  async function handleDelete(embed: SavedEmbed) {
    setDeleting(true);
    try {
      await apiDelete(`/embeds/${embed.id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete saved embed');
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  if (!eventId) return null;

  const onCount = embeds?.filter((e) => e.enabled).length ?? 0;
  const offCount = embeds?.filter((e) => !e.enabled).length ?? 0;

  return (
    <section className="chq-settings-panel" aria-label="Saved embeds">
      {/* w41-h/DEC-785: the eyebrow row -- title + "N on · M off" (computed
          from the rows already loaded, DEC-785 amendment (5)) on the left,
          the "Turning one off..." caption right-flushed on the SAME row
          rather than tucked under Build an embed. */}
      <div className="chq-settings-saved-embed-eyebrow">
        <div className="chq-settings-saved-embed-eyebrow-title">
          <h2>Saved embeds</h2>
          {embeds && embeds.length > 0 ? (
            <p className="chq-settings-count">{`${onCount} on · ${offCount} off`}</p>
          ) : null}
        </div>
        <p className="chq-settings-note chq-settings-saved-embed-caption">
          Turning one off breaks it wherever it is pasted
        </p>
        <button type="button" className="chq-link-button" onClick={() => setShowEditor((v) => !v)}>
          {showEditor ? 'Back' : 'Change'}
        </button>
      </div>
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
            // DEC-822/DEC-839: the row states the recipe it stores, not just
            // its name — derived from the SAME stored surface/format/options
            // a Save would have written, through the ONE shared formatter
            // (formatEmbedRecipe) so it can never drift from what the
            // editor heading states for the same embed.
            const recipe = formatEmbedRecipe({
              surface: embed.surface,
              format: embed.format,
              options: embed.options,
              trackName: embed.options.trackId ? (trackNameById[embed.options.trackId] ?? null) : null,
            });
            return (
              <li key={embed.id} className="chq-settings-saved-embed-row">
                {/* w41-h/DEC-785: name + path stack in ONE fixed-width cell
                    (the row's leading column) so the descriptor cell next
                    to it can be the one that clamps -- the row must not
                    reflow when the recipe is long. */}
                <span className="chq-settings-saved-embed-name-cell">
                  <span className="chq-settings-public-pages-name">{embed.name}</span>
                  <span className="chq-settings-public-pages-path">{`/embed/e/${embed.id}`}</span>
                </span>
                <span className="chq-embeds-recipe chq-settings-saved-embed-descriptor" title={recipe}>
                  {recipe}
                </span>
                <span
                  className={`chq-settings-public-pages-state ${
                    PUBLIC_PAGES_STATE_TONE_CLASS[embed.enabled ? 'live' : 'muted']
                  }`}
                >
                  {embed.enabled ? 'On' : 'Off'}
                </span>
                <span className="chq-settings-saved-embed-actions">
                  <button
                    type="button"
                    className="chq-link-button"
                    onClick={() => setCodeOpenId((current) => (current === embed.id ? null : embed.id))}
                  >
                    Get code
                  </button>
                  {showEditor ? (
                    <>
                      <Link className="chq-link-button" to={editHref(embed.id)}>
                        Edit
                      </Link>
                      <button type="button" className="chq-link-button" onClick={() => void handleToggle(embed)}>
                        {embed.enabled ? 'Turn off' : 'Turn on'}
                      </button>
                      <button type="button" className="chq-link-button" onClick={() => setPendingDelete(embed)}>
                        Delete
                      </button>
                    </>
                  ) : null}
                </span>
                {codeOpenId === embed.id ? (
                  <code className="chq-settings-saved-embed-snippet">{snippet}</code>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {onBuild && showEditor ? (
        // w41-h/DEC-785: the "New embed" affordance (this panel's build
        // disclosure) carries its own caption beside it -- what a saved
        // embed's URL/edit actually mean -- rather than the "Turning one
        // off..." warning, which lives on the eyebrow row above instead.
        <div className="chq-settings-saved-embed-build-row">
          <button type="button" className="chq-link-button" onClick={onBuild}>
            Build an embed
          </button>
          <p className="chq-settings-note">
            A saved embed keeps its own URL · editing it updates every page that uses it
          </p>
        </div>
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title={`Delete "${pendingDelete.name}"`}
          body="Anywhere this embed is pasted will break, and this cannot be undone."
          confirmLabel="Delete"
          destructive
          pending={deleting}
          onConfirm={() => void handleDelete(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </section>
  );
}
