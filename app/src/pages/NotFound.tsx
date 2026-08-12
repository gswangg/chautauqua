import { useLocation, Link } from 'react-router-dom';

// DEC-154: admin SPA catch-all. React Router v6 routes an unmatched path
// here via App.tsx's wildcard Route; we surface the attempted path so
// users/devs can tell what URL they landed on, plus a way back to the app.
// Re-skinned per docs/design/Chautauqua Account.dc.html "Not found ·
// /admin/*" panel (DEC-366/367/368) -- the heading text itself stays
// "Page not found" (App.render.test.tsx asserts on it) rather than the
// design doc's "That page isn't here" copy.
//
// DEC-376/w2-j: no co-located stylesheet -- every class here is a shared
// one already defined in app/src/styles.css (chq-measure, chq-section-
// label, chq-page-title, chq-empty, chq-btn-tertiary), so this page owns
// no CSS of its own.
export function NotFoundPage() {
  const location = useLocation();

  return (
    <div className="chq-measure">
      <span className="chq-section-label">Not found</span>
      <h1 className="chq-page-title">Page not found</h1>
      <p className="chq-empty">
        There's no page at <code>{location.pathname}</code>. The link may be old, or the event may
        have been switched since it was saved.
      </p>
      <Link className="chq-btn-tertiary" to="/overview">
        Go to Overview
      </Link>
    </div>
  );
}
