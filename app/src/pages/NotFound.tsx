import { useLocation, Link } from 'react-router-dom';
import { useCurrentEvent } from '../lib/useCurrentEvent';
import { useEffect, useState } from 'react';
import { apiList, ApiError } from '../lib/api';

// DEC-154: admin SPA catch-all. React Router v6 routes an unmatched path
// here via App.tsx's wildcard Route; we surface the attempted path so
// users/devs can tell what URL they landed on, plus a way back to the app.
// Re-skinned per docs/design/Chautauqua Account.dc.html "Not found ·
// /admin/*" panel (DEC-366/367/368/w15-g): heading matches the mock's
// "That page isn't here" copy, with an event-name eyebrow above it
// (falling back to "Not found" when no event is resolved).
//
// DEC-376/w2-j: no co-located stylesheet -- every class here is a shared
// one already defined in app/src/styles.css (chq-measure, chq-section-
// label, chq-page-title, chq-empty, chq-btn-tertiary), so this page owns
// no CSS of its own.

interface EventListItem {
  id: string;
  name: string;
}

export function NotFoundPage() {
  const location = useLocation();
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
    <div className="chq-measure">
      <span className="chq-section-label">{eventName ?? 'Not found'}</span>
      <h1 className="chq-page-title">That page isn't here</h1>
      <p className="chq-empty">
        There's no page at <code>{location.pathname}</code>. The link may be old, or the event may
        have been switched since it was saved.
      </p>
      <Link className="chq-btn-tertiary" to="/overview">
        Go to Overview
      </Link>{' '}
      <Link className="chq-btn-tertiary" to="/submissions">
        Submissions &rsaquo;
      </Link>
    </div>
  );
}
