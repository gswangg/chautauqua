import { lazy, Suspense, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useMe } from './lib/useMe';
import { useNavExceptions } from './lib/useNavExceptions';
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
  notFound: () => import('./pages/NotFound').then((m) => ({ default: m.NotFoundPage })),
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
const NotFoundPage = lazy(pageLoaders.notFound);

// DEC-369: nav badge source. Each entry that can carry an exception names
// which useNavExceptions() field drives its badge and the word that follows
// the count ("3 LATE", "2 CLASH"). Sections with no badgeKey never show one.
const NAV_SECTIONS = [
  { label: 'Overview', path: '/overview', element: <OverviewPage />, loader: pageLoaders.overview },
  { label: 'Submissions', path: '/submissions', element: <SubmissionsPage />, loader: pageLoaders.submissions },
  { label: 'Review', path: '/review/*', element: <ReviewPage />, loader: pageLoaders.review },
  {
    label: 'Speakers',
    path: '/speakers',
    element: <SpeakersPage />,
    loader: pageLoaders.speakers,
    badgeKey: 'late',
    badgeWord: 'LATE',
  },
  { label: 'Content', path: '/content', element: <ContentPage />, loader: pageLoaders.content },
  {
    label: 'Agenda',
    path: '/agenda',
    element: <AgendaPage />,
    loader: pageLoaders.agenda,
    badgeKey: 'clash',
    badgeWord: 'CLASH',
  },
  { label: 'Comms', path: '/comms', element: <CommsPage />, loader: pageLoaders.comms },
  { label: 'Contacts', path: '/contacts', element: <ContactsPage />, loader: pageLoaders.contacts },
  { label: 'Settings', path: '/settings', element: <SettingsPage />, loader: pageLoaders.settings },
] as const;

type NavSection = (typeof NAV_SECTIONS)[number];

// Module-level map of path -> import thunk, used to prefetch a page's chunk
// on nav-link hover/focus before the user actually navigates (SPEC §7).
const prefetchByPath = new Map<string, () => Promise<unknown>>(
  NAV_SECTIONS.map((section) => [section.path, section.loader]),
);

// DEC-024: reviewers see only the Review nav section and land on /review.
function isReviewerNav(section: NavSection): boolean {
  return section.path === '/review/*';
}

// DEC-154: sign-out. Mirrors app/src/lib/api.ts's CSRF convention
// (x-chq-csrf header on mutations, credentials 'include') even though
// /logout isn't under /api/v1 — it's not routed through api.ts's request()
// helper because that helper hardcodes the /api/v1 prefix.
async function signOut(): Promise<void> {
  await fetch('/logout', {
    method: 'POST',
    credentials: 'include',
    headers: { 'x-chq-csrf': '1' },
  });
  window.location.assign('/login');
}

function badgeFor(section: NavSection, exceptions: { late: number | null; clash: number | null }): string | null {
  if (!('badgeKey' in section)) return null;
  const count = exceptions[section.badgeKey as 'late' | 'clash'];
  if (!count) return null;
  return `${count} ${section.badgeWord}`;
}

function NavLinks({
  sections,
  exceptions,
  onNavigate,
}: {
  sections: readonly NavSection[];
  exceptions: { late: number | null; clash: number | null };
  onNavigate?: () => void;
}) {
  const prefetch = (path: string) => {
    const loader = prefetchByPath.get(path);
    if (loader) void loader();
  };

  return (
    <>
      {sections.map((section) => {
        const badge = badgeFor(section, exceptions);
        return (
          <NavLink
            key={section.path}
            to={section.path.replace(/\*$/, '')}
            className={({ isActive }) => `chq-nav-link${isActive ? ' is-active' : ''}`}
            onMouseEnter={() => prefetch(section.path)}
            onFocus={() => prefetch(section.path)}
            onClick={onNavigate}
          >
            {section.label}
            {badge && <span className="chq-nav-badge">{badge}</span>}
          </NavLink>
        );
      })}
    </>
  );
}

function Header() {
  const { me } = useMe();
  const exceptions = useNavExceptions();
  const [moreOpen, setMoreOpen] = useState(false);
  const sections = me?.role === 'reviewer' ? NAV_SECTIONS.filter(isReviewerNav) : NAV_SECTIONS;

  // Phone tab bar carries five destinations; anything past those four lives
  // behind "More" (DEC-369). Reviewers never see the tab bar's non-Review
  // items since `sections` is already filtered above.
  const tabSections = sections.filter((s) =>
    ['/overview', '/submissions', '/speakers', '/content', '/review/*'].includes(s.path),
  );
  const primaryTabs = sections.length > 1 ? tabSections.slice(0, 4) : tabSections;
  const moreSections = sections.filter((s) => !primaryTabs.includes(s));

  return (
    <header className="chq-header">
      <span className="chq-wordmark">chautauqua</span>
      <nav className="chq-nav" aria-label="Primary">
        <NavLinks sections={sections} exceptions={exceptions} />
      </nav>
      <div>
        <EventSwitcher />
        {me && <span className="chq-meta">{me.email}</span>}
        <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>

      {moreSections.length > 0 && (
        <nav className="chq-tabbar" aria-label="Primary, phone">
          {primaryTabs.map((section) => (
            <NavLink
              key={section.path}
              to={section.path.replace(/\*$/, '')}
              className={({ isActive }) => `chq-nav-link${isActive ? ' is-active' : ''}`}
            >
              {section.label}
            </NavLink>
          ))}
          <button type="button" className="chq-nav-link" onClick={() => setMoreOpen(true)}>
            More
          </button>
        </nav>
      )}

      {moreOpen && (
        <div className="chq-modal" role="dialog" aria-modal="true" aria-label="More">
          <NavLinks sections={moreSections} exceptions={exceptions} onNavigate={() => setMoreOpen(false)} />
          <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setMoreOpen(false)}>
            Close
          </button>
        </div>
      )}
    </header>
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
      <div className="chq-shell">
        <Header />
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
                {/* DEC-154: admin catch-all, must stay last so specific routes win. */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </RoleGate>
        </main>
      </div>
    </BrowserRouter>
  );
}
