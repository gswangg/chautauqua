import { Link } from 'react-router-dom';
import { useCurrentEvent } from '../lib/useCurrentEvent';
import { useEffect, useState } from 'react';
import { apiList, ApiError } from '../lib/api';
import './not-found.css';

// DEC-154: admin SPA catch-all. React Router v6 routes an unmatched path
// here via App.tsx's wildcard Route.
// Re-skinned per docs/design/Chautauqua Account.dc.html "Not found ·
// /admin/*" panel (DEC-366/367/368/w15-g): heading matches the mock's
// "That page isn't here" copy, with an event-name eyebrow above it
// (falling back to "Not found" when no event is resolved).
//
// DEC-945: one 404 card, three renderers -- this now draws the same
// content-hugging card shape the two server-rendered 404s share (src/
// server/not-found.tsx, src/routes/public/not-found.tsx), via the
// co-located ./not-found.css rather than the old full-width chq-measure
// column. The attempted pathname is deliberately NOT shown (the frame's
// body copy names the possible causes instead) -- useLocation is unused.

interface EventListItem {
  id: string;
  name: string;
}

export function NotFoundPage() {
  const { eventId } = useCurrentEvent();
  const [eventName, setEventName] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setEventName(null);
      return;
    }
    apiList<EventListItem>('/events')
      .then((res) => {
        const match = res.items.find((item) => item.id === eventId);
        setEventName(match?.name ?? null);
      })
      .catch((err) => {
        if (err instanceof ApiError) setEventName(null);
        else throw err;
      });
  }, [eventId]);

  return (
    <div className="chq-notfound-card">
      <span className="chq-section-label">{eventName ?? 'Not found'}</span>
      <h1 className="chq-notfound-title">That page isn't here</h1>
      <p className="chq-notfound-body">
        The link may be old, or the event may have been switched since it was saved.
      </p>
      <div className="chq-notfound-links">
        <Link to="/overview">Overview &rsaquo;</Link>
        <Link to="/submissions">Submissions &rsaquo;</Link>
      </div>
    </div>
  );
}
