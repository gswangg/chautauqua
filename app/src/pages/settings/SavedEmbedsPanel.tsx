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
// w1-f, DEC-785 amendment: this panel is mounted BOTH at rest and inside
// PublicPagesPanel's edit drill, so at rest it must not ALSO dump straight
// into the full Edit/Turn-on-off/Delete/Build surface. At rest each row
// still states its name, recipe and On/Off pill and still offers "Get code"
// (a read, not a write), but Edit/Turn on-off/Delete/Build an embed only
// render while the caller's own drill is open.
//
// DEC-785 amendment (wave 63): the row's anatomy is reconciled against
// docs/design/Chautauqua Settings.dc.html:150-161 -- name+recipe cell,
// state pill, action cluster (Edit, Get code, Turn on/off), in that order.
// One frame field is NOT built: the row's second grid cell, `{{ e.used }}`
// (:155, sample values "devflowconf.com" / "Notion" / "Not in use"), names
// where the embed is pasted on the open web -- a fact no endpoint stores
// (grep src/server/repo/embeds.ts and the schema turns up no referrer/host
// tracking) and Copy rule 3 forbids asserting what no endpoint stores.
// Adding that tracking is new backend work outside this task's owned
// files, so the column is left out rather than invented; this is the
// pack-disagreement the task instructions call for recording, not an
// oversight.
//
// DEC-785 amendment (wave 15): the read/edit split is no longer a LOCAL
// toggle -- the caller (PublicPagesPanel) passes `editing`, driven by the
// SAME section-drill URL state as the rest of the page, so there is one
// Back that closes everything instead of a second Change/Back button
// nested inside the drill (a second read/edit toggle inside a drill means
// the drill renders nothing).
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
  editing?: boolean;
}

export function SavedEmbedsPanel({ onBuild, editing = false }: Props) {
  const { eventId } = useCurrentEvent();
  const [searchParams] = useSearchParams();
  const [embeds, setEmbeds] = useState<SavedEmbed[] | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [codeOpenId, setCodeOpenId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SavedEmbed | null>(null);
  const [deleting, setDeleting] = useState(false);
  // DEC-941: turning a saved embed OFF stops a PUBLIC URL from serving on
  // whatever page it's pasted into -- an effect the organiser cannot see
  // from here, so it is routed through ConfirmDialog at the default
  // reversible weight (one sentence, no typed phrase; nothing is deleted).
  // Turning it back ON stays a direct click.
  const [pendingToggleOff, setPendingToggleOff] = useState<SavedEmbed | null>(null);
  const [togglingOff, setTogglingOff] = useState(false);
  // DEC-856 (wave 67 amendment): PATCH /embeds/:id's only named key on this
  // panel's writers is `enabled` (the toggle) -- any other key the server
  // ever throws here has no control on this row and renders labelled,
  // never dropped and never collapsed into `error`.
  const [rowFieldErrors, setRowFieldErrors] = useState<Record<string, Record<string, string>>>({});

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
    setError(undefined);
    setRowFieldErrors((prev) => ({ ...prev, [embed.id]: {} }));
    try {
      await apiPatch(`/embeds/${embed.id}`, { enabled: !embed.enabled });
      load();
    } catch (err) {
      // DEC-856: a fields map is never collapsed to err.message -- `enabled`
      // routes to the toggle control itself, anything else renders labelled.
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) {
        setRowFieldErrors((prev) => ({ ...prev, [embed.id]: err.fields as Record<string, string> }));
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to update saved embed');
      }
    }
  }

  async function handleConfirmToggleOff(embed: SavedEmbed) {
    setTogglingOff(true);
    try {
      await handleToggle(embed);
    } finally {
      setTogglingOff(false);
      setPendingToggleOff(null);
    }
  }

  async function handleDelete(embed: SavedEmbed) {
    setDeleting(true);
    setError(undefined);
    setRowFieldErrors((prev) => ({ ...prev, [embed.id]: {} }));
    try {
      await apiDelete(`/embeds/${embed.id}`);
      load();
    } catch (err) {
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) {
        setRowFieldErrors((prev) => ({ ...prev, [embed.id]: err.fields as Record<string, string> }));
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to delete saved embed');
      }
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
            // DEC-856 (wave 67 amendment): `enabled` is the only key this
            // row's own control (the toggle) owns -- any other key the
            // server ever throws renders labelled, never dropped.
            const embedErrors = rowFieldErrors[embed.id] ?? {};
            const embedUnownedErrors = Object.entries(embedErrors).filter(([key]) => key !== 'enabled');
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
                {/* w63-d/DEC-785 amendment (wave 63): action cluster order
                    matches the frame's own grid --
                    docs/design/Chautauqua Settings.dc.html:157-161 draws
                    Edit, Get code, then the On/Off toggle (no "used"
                    column here -- see the disagreement note above the
                    return). Delete has no control anywhere in the frame's
                    saved-embed row OR its editor footer (same file,
                    :1096-1101 draws only "Turn this embed off" / Cancel /
                    Save changes), yet DELETE /api/v1/embeds/:id is a real,
                    reachable endpoint (src/routes/api/embeds.ts:316) --
                    this is a genuine disagreement the pack does not
                    settle, so Delete is kept, appended after the frame's
                    own three actions rather than invented into their
                    order. */}
                <span className="chq-settings-saved-embed-actions">
                  {editing ? (
                    <Link className="chq-link-button" to={editHref(embed.id)}>
                      Edit
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="chq-link-button"
                    onClick={() => setCodeOpenId((current) => (current === embed.id ? null : embed.id))}
                  >
                    Get code
                  </button>
                  {editing ? (
                    <>
                      <button
                        type="button"
                        className="chq-link-button"
                        onClick={() =>
                          embed.enabled ? setPendingToggleOff(embed) : void handleToggle(embed)
                        }
                      >
                        {embed.enabled ? 'Turn off' : 'Turn on'}
                      </button>
                      <button type="button" className="chq-link-button" onClick={() => setPendingDelete(embed)}>
                        Delete
                      </button>
                    </>
                  ) : null}
                  {embedErrors.enabled ? (
                    <span role="alert" className="chq-field-error">
                      {embedErrors.enabled}
                    </span>
                  ) : null}
                  {embedUnownedErrors.map(([key, message]) => (
                    <span key={key} role="alert" className="chq-field-error">
                      {`${key}: ${message}`}
                    </span>
                  ))}
                </span>
                {codeOpenId === embed.id ? (
                  <code className="chq-settings-saved-embed-snippet">{snippet}</code>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {onBuild && editing ? (
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
          confirmLabel="Delete embed"
          pending={deleting}
          onConfirm={() => void handleDelete(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}

      {pendingToggleOff ? (
        <ConfirmDialog
          title={`Turn off ${pendingToggleOff.name}?`}
          body={`The /embed/e/${pendingToggleOff.id} permalink stops serving this surface. The saved recipe, its name and its code survive -- Turn on puts it back.`}
          confirmLabel="Turn it off"
          pending={togglingOff}
          onConfirm={() => void handleConfirmToggleOff(pendingToggleOff)}
          onCancel={() => setPendingToggleOff(null)}
        />
      ) : null}
    </section>
  );
}
