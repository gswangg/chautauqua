import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useMe } from './lib/useMe';
import { EventSwitcher } from './components/EventSwitcher';

// DEC-052: every route page is code-split via React.lazy. Page modules keep
// their named exports; the thunk map below is reused both to build the lazy
// components and to prefetch a chunk on nav-link hover/focus.
const pageLoaders = {
  overview: () => import('./pages/Overview').then((m) => ({ default: m.OverviewPage })),
  submissions: () => import('./pages/Submissions').then((m) => ({ default: m.SubmissionsPage })),
  forms: () => import('./pages/forms/FormsPage').then((m) => ({ default: m.FormsPage })),
  review: () => import('./pages/Review').then((m) => ({ default: m.ReviewPage })),
  speakers: () => import('./pages/Speakers').then((m) => ({ default: m.SpeakersPage })),
  content: () => import('./pages/Content').then((m) => ({ default: m.ContentPage })),
  agenda: () => import('./pages/Agenda').then((m) => ({ default: m.AgendaPage })),
  comms: () => import('./pages/Comms').then((m) => ({ default: m.CommsPage })),
  contacts: () => import('./pages/Contacts').then((m) => ({ default: m.ContactsPage })),
  settings: () => import('./pages/Settings').then((m) => ({ default: m.SettingsPage })),
  submissionDetail: () =>
    import('./pages/submissions/SubmissionDetailPage').then((m) => ({ default: m.SubmissionDetailPage })),
} as const;

const OverviewPage = lazy(pageLoaders.overview);
const SubmissionsPage = lazy(pageLoaders.submissions);
const FormsPage = lazy(pageLoaders.forms);
const ReviewPage = lazy(pageLoaders.review);
const SpeakersPage = lazy(pageLoaders.speakers);
const ContentPage = lazy(pageLoaders.content);
const AgendaPage = lazy(pageLoaders.agenda);
const CommsPage = lazy(pageLoaders.comms);
const ContactsPage = lazy(pageLoaders.contacts);
const SettingsPage = lazy(pageLoaders.settings);
const SubmissionDetailPage = lazy(pageLoaders.submissionDetail);

const NAV_SECTIONS = [
  { label: 'Overview', path: '/overview', element: <OverviewPage />, loader: pageLoaders.overview },
  { label: 'Submissions', path: '/submissions', element: <SubmissionsPage />, loader: pageLoaders.submissions },
  { label: 'Review', path: '/review/*', element: <ReviewPage />, loader: pageLoaders.review },
  { label: 'Speakers', path: '/speakers', element: <SpeakersPage />, loader: pageLoaders.speakers },
  { label: 'Content', path: '/content', element: <ContentPage />, loader: pageLoaders.content },
  { label: 'Agenda', path: '/agenda', element: <AgendaPage />, loader: pageLoaders.agenda },
  { label: 'Comms', path: '/comms', element: <CommsPage />, loader: pageLoaders.comms },
  { label: 'Contacts', path: '/contacts', element: <ContactsPage />, loader: pageLoaders.contacts },
  { label: 'Settings', path: '/settings', element: <SettingsPage />, loader: pageLoaders.settings },
] as const;

// Module-level map of path -> import thunk, used to prefetch a page's chunk
// on nav-link hover/focus before the user actually navigates (SPEC §7).
const prefetchByPath = new Map<string, () => Promise<unknown>>(
  NAV_SECTIONS.map((section) => [section.path, section.loader]),
);

// DEC-024: reviewers see only the Review nav section and land on /review.
function isReviewerNav(section: (typeof NAV_SECTIONS)[number]): boolean {
  return section.path === '/review/*';
}

function Nav() {
  const { me } = useMe();
  const sections = me?.role === 'reviewer' ? NAV_SECTIONS.filter(isReviewerNav) : NAV_SECTIONS;

  const prefetch = (path: string) => {
    const loader = prefetchByPath.get(path);
    if (loader) void loader();
  };

  return (
    <nav className="chq-nav">
      <div className="chq-nav-title">Chautauqua</div>
      <EventSwitcher />
      <ul className="chq-nav-list">
        {sections.map((section) => (
          <li key={section.path}>
            <NavLink
              to={section.path.replace(/\*$/, '')}
              className={({ isActive }) => (isActive ? 'active' : '')}
              onMouseEnter={() => prefetch(section.path)}
              onFocus={() => prefetch(section.path)}
            >
              {section.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Reviewers are confined to /review; any other path bounces them there
// rather than exposing organizer-only screens they have no API access to.
function RoleGate({ children }: { children: ReactNode }) {
  const { me, loading } = useMe();
  const location = useLocation();

  if (!loading && me?.role === 'reviewer' && !location.pathname.startsWith('/review')) {
    return <Navigate to="/review" replace />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter basename="/admin">
      <div className="chq-app">
        <Nav />
        <main className="chq-main">
          <RoleGate>
            <Suspense fallback={<div className="chq-loading">Loading…</div>}>
              <Routes>
                <Route path="/" element={<OverviewPage />} />
                {NAV_SECTIONS.map((section) => (
                  <Route key={section.path} path={section.path} element={section.element} />
                ))}
                {/* DEC-033: form builder lives under Submissions (route only — no new top-nav section). */}
                <Route path="/submissions/forms" element={<FormsPage />} />
                {/* DEC-045: submission detail. React Router v6 ranks the static
                    /submissions/forms route above this dynamic :id segment, so
                    declaration order here doesn't matter, but forms stays
                    first for readability. */}
                <Route path="/submissions/:id" element={<SubmissionDetailPage />} />
              </Routes>
            </Suspense>
          </RoleGate>
        </main>
      </div>
    </BrowserRouter>
  );
}
