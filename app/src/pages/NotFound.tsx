import { useLocation, Link } from 'react-router-dom';
import './notfound.css';

// DEC-154: admin SPA catch-all. React Router v6 routes an unmatched path
// here via App.tsx's wildcard Route; we surface the attempted path so
// users/devs can tell what URL they landed on, plus a way back to the app.
// Re-skinned per docs/design/Chautauqua Account.dc.html "Not found ·
// /admin/*" panel (DEC-366/367/368) -- the heading text itself stays
// "Page not found" (App.render.test.tsx asserts on it) rather than the
// design doc's "That page isn't here" copy.
export function NotFoundPage() {
  const location = useLocation();

  return (
    <div className="chq-notfound chq-measure">
      <span className="chq-notfound-eyebrow">Not found</span>
      <h1 className="chq-page-title">Page not found</h1>
      <p className="chq-notfound-body">
        There's no page at <code>{location.pathname}</code>. The link may be old, or the event may
        have been switched since it was saved.
      </p>
      <div className="chq-notfound-links">
        <Link className="chq-btn-tertiary" to="/overview">
          Go to Overview
        </Link>
      </div>
    </div>
  );
}
