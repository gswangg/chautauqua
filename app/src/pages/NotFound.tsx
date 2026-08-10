import { useLocation, Link } from 'react-router-dom';

// DEC-154: admin SPA catch-all. React Router v6 routes an unmatched path
// here via App.tsx's wildcard Route; we surface the attempted path so
// users/devs can tell what URL they landed on, plus a way back to the app.
export function NotFoundPage() {
  const location = useLocation();

  return (
    <div className="chq-not-found">
      <h1>Page not found</h1>
      <p>
        There's no page at <code>{location.pathname}</code>.
      </p>
      <p>
        <Link to="/overview">Go to Overview</Link>
      </p>
    </div>
  );
}
