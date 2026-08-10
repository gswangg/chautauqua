import { useEffect, useState } from 'react';
import { PlaceholderPage } from './PlaceholderPage';
import { useCurrentEvent } from '../lib/useCurrentEvent';
import { apiGet, ApiError } from '../lib/api';
import { EventSettingsPanel } from './settings/EventSettingsPanel';
import { TracksRoomsPanel } from './settings/TracksRoomsPanel';
import { PortalSettingsPanel } from './settings/PortalSettingsPanel';
import { ResourcesPanel } from './settings/ResourcesPanel';

// J10/DEC-022: embed generator — copyable <iframe> snippets for the five
// public surfaces (src/routes/public.tsx), built from location.origin so
// they work in any deployment without hardcoding a host.
const EMBED_SURFACES = ['sessions', 'speakers', 'agenda', 'schedule', 'gallery'] as const;

interface EventDetail {
  id: string;
  slug: string;
  name: string;
}

function embedSnippet(origin: string, slug: string, surface: string): string {
  return `<iframe src="${origin}/embed/${slug}/${surface}" style="width:100%;min-height:600px;border:0" loading="lazy" title="${surface}"></iframe>`;
}

function EmbedsPanel() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [copiedSurface, setCopiedSurface] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    apiGet<EventDetail>(`/events/${eventId}`)
      .then(setEvent)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Failed to load event'));
  }, [eventId]);

  async function handleCopy(text: string, surface: string) {
    await navigator.clipboard.writeText(text);
    setCopiedSurface(surface);
    window.setTimeout(() => setCopiedSurface((current) => (current === surface ? null : current)), 2000);
  }

  return (
    <section className="chq-embeds-panel" aria-label="Embeds">
      <h2>Embeds</h2>
      <p>Copy a snippet below to embed a public surface (chromeless, no login) on another site.</p>
      {eventLoading ? <p>Loading…</p> : null}
      {eventError || loadError ? <p role="alert">{eventError ?? loadError}</p> : null}
      {event ? (
        <ul className="chq-embeds-list">
          {EMBED_SURFACES.map((surface) => {
            const snippet = embedSnippet(window.location.origin, event.slug, surface);
            return (
              <li key={surface}>
                <strong>{surface[0]!.toUpperCase() + surface.slice(1)}</strong>
                <code>{snippet}</code>
                <button type="button" onClick={() => handleCopy(snippet, surface)}>
                  {copiedSurface === surface ? 'Copied!' : 'Copy snippet'}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

export function SettingsPage() {
  return (
    <div>
      <PlaceholderPage section="Settings" />
      <EventSettingsPanel />
      <TracksRoomsPanel />
      <PortalSettingsPanel />
      <ResourcesPanel />
      <EmbedsPanel />
    </div>
  );
}
