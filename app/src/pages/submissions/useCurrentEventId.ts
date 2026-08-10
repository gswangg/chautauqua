// The event switcher (which event the admin SPA is scoped to) is not yet
// implemented elsewhere in the SPA (no EventContext/router param exists at
// the time this page was built). Narrowest reasonable stand-in: read
// ?eventId= from the URL, else the last event id remembered in
// localStorage. A real event switcher (DEC-005 nav / Settings) should
// eventually own and set this key; this hook just consumes it.
const STORAGE_KEY = 'chq.currentEventId';

export function useCurrentEventId(): string | null {
  const fromUrl = new URLSearchParams(window.location.search).get('eventId');
  if (fromUrl) {
    window.localStorage.setItem(STORAGE_KEY, fromUrl);
    return fromUrl;
  }
  return window.localStorage.getItem(STORAGE_KEY);
}
