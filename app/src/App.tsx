import { lazy, Suspense, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useMe } from './lib/useMe';
import { signOut } from './lib/api';
import { guardedNavigate, useNavExceptions } from './lib/useNavExceptions';
import { useEscapeKey } from './lib/useEscapeKey';
import { identityLabel } from './lib/identity';
import { EventSwitcher } from './components/EventSwitcher';
import { PageSkeleton } from './components/PageSkeleton';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { ADMIN_ROUTE_PATTERNS } from './lib/admin-routes';

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
  contactsMerge: () => import('./pages/contacts/MergePage').then((m) => ({ default: m.MergePage })),
  settings: () => import('./pages/Settings').then((m) => ({ default: m.SettingsPage })),
  submissionDetail: () =>
    import('./pages/submissions/SubmissionDetailPage').then((m) => ({ default: m.SubmissionDetailPage })),
  speakerDetail: () =>
    import('./pages/speakers/SpeakerDetailPage').then((m) => ({ default: m.SpeakerDetailPage })),
  taskView: () => import('./pages/speakers/TaskView').then((m) => ({ default: m.TaskView })),
  submissionsDelete: () =>
    import('./pages/submissions/DeleteSubmissionsPage').then((m) => ({ default: m.DeleteSubmissionsPage })),
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
const ContactsMergePage = lazy(pageLoaders.contactsMerge);
const SettingsPage = lazy(pageLoaders.settings);
const SubmissionDetailPage = lazy(pageLoaders.submissionDetail);
const SpeakerDetailPage = lazy(pageLoaders.speakerDetail);
const TaskViewPage = lazy(pageLoaders.taskView);
const DeleteSubmissionsPage = lazy(pageLoaders.submissionsDelete);
const NotFoundPage = lazy(pageLoaders.notFound);

// DEC-831: exported so App.render.test.tsx can enumerate every section
// (rather than hand-listing paths, which desyncs the moment a section is
// added/removed/reordered here) when asserting each nav link highlights at
// its own route.
export const NAV_SECTIONS = [
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

type NavSection = (typeof NAV_SECTIONS)[number];

// DEC-154 (amendment, wave 53): RoutedContent renders its <Route> elements
// FROM ADMIN_ROUTE_PATTERNS via this Record, not a hand-written list that
// merely agrees with it -- a missing or extra element is then a TypeScript
// error, so the SPA's route table and the Worker's admin-routes.ts manifest
// (which gates the /admin/* 404) cannot desync.
const ELEMENT_BY_PATTERN: Record<(typeof ADMIN_ROUTE_PATTERNS)[number], ReactNode> = {
  '/': <Navigate to="/overview" replace />,
  '/overview': <OverviewPage />,
  '/submissions': <SubmissionsPage />,
  '/review/*': <ReviewPage />,
  '/speakers': <SpeakersPage />,
  '/content': <ContentPage />,
  '/agenda': <AgendaPage />,
  '/comms': <CommsPage />,
  '/contacts': <ContactsPage />,
  '/settings': <SettingsPage />,
  // DEC-684: contact merge lives under Contacts (route only — no new
  // top-nav section, mirrors /submissions/forms below).
  '/contacts/merge': <ContactsMergePage />,
  // DEC-033: form builder lives under Submissions (route only — no new
  // top-nav section).
  '/submissions/forms': <FormsPage />,
  // DEC-886: session delete confirmation page (route only — no new top-nav
  // section, mirrors /submissions/forms above). React Router v6 ranks a
  // static path above the dynamic :id segment below regardless of
  // declaration order.
  '/submissions/delete': <DeleteSubmissionsPage />,
  // DEC-045: submission detail.
  '/submissions/:id': <SubmissionDetailPage />,
  // DEC-930: per-speaker detail page, mirrors the submission detail route
  // above -- a static path (/speakers) is already claimed by NAV_SECTIONS,
  // so declaration order here doesn't matter.
  '/speakers/:contactId': <SpeakerDetailPage />,
  // Design pack v12: the task view ("One task, every speaker"), opened from
  // a grid column head. Three segments against the two of
  // '/speakers/:contactId' above, so React Router's ranking never has to
  // choose between them and a contact id can never be swallowed by the
  // literal 'tasks' segment.
  '/speakers/tasks/:taskId': <TaskViewPage />,
  // DEC-935: a session's content (deliverables, versions, notes) lives at
  // its own URL, not behind ?submissionId= on the worklist route.
  // ContentApp itself reads the id via useParams and renders the
  // deliverable detail in place of the worklist -- same component as the
  // /content route above, reused rather than split into a separate page.
  '/content/:submissionId': <ContentPage />,
};

// Module-level map of path -> import thunk, used to prefetch a page's chunk
// on nav-link hover/focus before the user actually navigates (SPEC §7).
const prefetchByPath = new Map<string, () => Promise<unknown>>(
  NAV_SECTIONS.map((section) => [section.path, section.loader]),
);

// DEC-024: reviewers see only the Review nav section and land on /review.
function isReviewerNav(section: NavSection): boolean {
  return section.path === '/review/*';
}

// DEC-381: the phone tab bar's four primary destinations, fixed by an
// explicit ordered path list so the set can never drift with NAV_SECTIONS
// order (NAV_SECTIONS orders Review third, which previously pushed Content
// out of the tab bar's `.slice(0, 4)`).
const PHONE_TAB_PATHS = ['/overview', '/submissions', '/speakers', '/content'] as const;

// DEC-154/DEC-874 (wave-91 amendment): sign-out is now the ONE contract
// exported from lib/api.ts (POST /logout, CSRF header, redirect to /login
// only on a 2xx, never swallow a rejection) -- App.tsx calls it rather than
// hand-copying the fetch.
//
// v12m-w14-c: a rejected signOut() used to be re-thrown into the click
// handler, which only produces an unhandled promise rejection -- no
// message reaches the operator and the (still-live) session looks
// unchanged. Callers now pass their own setter so the failure lands in a
// visible chq-error alert instead.
function handleSignOutClick(setError: (message: string) => void): void {
  signOut().catch((err) => {
    setError(err instanceof Error ? err.message : 'Failed to sign out');
  });
}

function NavLinks({
  sections,
  onNavigate,
}: {
  sections: readonly NavSection[];
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const prefetch = (path: string) => {
    const loader = prefetchByPath.get(path);
    if (loader) void loader();
  };

  return (
    <>
      {sections.map((section) => {
        const to = section.path.replace(/\/\*$/, '');
        return (
          <NavLink
            key={section.path}
            // DEC-831: strip the trailing "/*" wholesale (not just the "*"),
            // so '/review/*' yields '/review', not '/review/' -- a trailing
            // slash NavLink's isActive/aria-current match never resolves
            // against the router's actual '/review' pathname.
            to={to}
            className={({ isActive }) => `chq-nav-link${isActive ? ' is-active' : ''}`}
            onMouseEnter={() => prefetch(section.path)}
            onFocus={() => prefetch(section.path)}
            // w5-e/DEC-745 amendment: chrome nav is GLOBAL-NAV, so a dirty
            // page's unsaved-draft guard (PlanEditor's requestLeave, wired
            // through the shared useNavExceptions leave-guard registry)
            // must confirm here too, not just on the page's own back-link.
            onClick={(e) => {
              e.preventDefault();
              guardedNavigate(() => navigate(to));
              onNavigate?.();
            }}
          >
            {section.label}
          </NavLink>
        );
      })}
    </>
  );
}

function Header() {
  const { me } = useMe();
  const isReviewer = me?.role === 'reviewer';
  const sections = isReviewer ? NAV_SECTIONS.filter(isReviewerNav) : NAV_SECTIONS;
  const [signOutError, setSignOutError] = useState<string | null>(null);

  return (
    <header className="chq-header">
      <span className="chq-wordmark">chautauqua</span>
      <nav className="chq-nav" aria-label="Primary">
        <NavLinks sections={sections} />
      </nav>
      <div className="chq-header-identity">
        {/* frame 03--01 (DEC-939 amendment): a page-owned portal target --
            the scorecard's 'N of N done' counter injects itself here via
            createPortal so it leaves the reading column, without App.tsx
            knowing anything about the scorecard. Renders empty (no
            caption) whenever no page portals into it. */}
        <div id="chq-header-slot" className="chq-header-slot" />
        <EventSwitcher />
        {signOutError && (
          <div className="chq-error" role="alert">
            {signOutError}
          </div>
        )}
        {/* DEC-369 amendment (wave 72): no bottom chrome bar -- Sign out
            rejoins the header identity, "JORDAN A. · SIGN OUT", a real
            button one click from any page, never a menu. It's nested
            inside .chq-user-identity (not a sibling in
            .chq-header-identity) so the existing ≤700px rule that drops
            the identity block on phone keeps dropping Sign out with it —
            the phone header has no identity block, so the More sheet
            remains the phone path for signing out. */}
        {me && (
          <span className="chq-user-identity">
            {identityLabel(me.name, me.email, me.role as 'organizer' | 'reviewer' | 'speaker')}
            <button
              type="button"
              className="chq-btn chq-btn-tertiary chq-header-signout"
              onClick={() => handleSignOutClick(setSignOutError)}
            >
              Sign out
            </button>
          </span>
        )}
      </div>
    </header>
  );
}

// DEC-576 amendment (wave 13): the phone tab bar is the shell's bottom
// region -- it renders as the LAST child of .chq-shell (after <main>), not
// as a sibling squeezed between <header> and <main>, so DOM order matches
// the "Five-item bottom tab bar" phone pattern without any `order:` CSS.
function PhoneTabBar() {
  const { me } = useMe();
  const exceptions = useNavExceptions();
  const tabsNavigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const isReviewer = me?.role === 'reviewer';
  const sections = isReviewer ? NAV_SECTIONS.filter(isReviewerNav) : NAV_SECTIONS;

  // DEC-381: primary tabs are built from an explicit ordered path list
  // intersected with the role-filtered sections, so the set cannot drift
  // when NAV_SECTIONS' own order changes. A reviewer has exactly one
  // section (Review) and shows it alone, with no More control.
  const primaryTabs = isReviewer
    ? sections
    : PHONE_TAB_PATHS.map((path) => sections.find((s) => s.path === path)).filter(
        (s): s is NavSection => s !== undefined,
      );
  const moreSections = sections.filter((section) => !primaryTabs.includes(section));
  const closeMore = () => setMoreOpen(false);
  useEscapeKey(moreOpen, closeMore);
  const anyBadgeLive = Boolean(exceptions.late) || Boolean(exceptions.clash);

  // DEC-576 (wave-86 amendment): a bottom tab bar with a single item is
  // not a navigation choice, and a reviewer's one section (Review,
  // App.tsx:269 above) draws no band in either phone frame
  // (docs/design/Chautauqua Content.dc.html:229 draws the five-tab band
  // only on the multi-section landing). Below 2 primary tabs there is
  // also no More sheet, so styles.css un-hides `.chq-user-identity`
  // (`.chq-shell:not(:has(.chq-tabbar)) ...`) to keep Sign out reachable.
  if (primaryTabs.length < 2) {
    return null;
  }

  return (
    <>
      {/* DEC-381: .chq-tabbar and the More sheet are siblings of <header>
          inside .chq-shell, not header children — styles.css right-aligns
          the identity block via `.chq-header > *:last-child`, and the tab
          bar being a header child silently stole that selector at phone
          width. */}
      <nav className="chq-tabbar" aria-label="Primary, phone">
        {primaryTabs.map((section) => {
          const to = section.path.replace(/\/\*$/, '');
          return (
            <NavLink
              key={section.path}
              // DEC-831: strip the trailing "/*" wholesale (not just the "*"),
              // so '/review/*' yields '/review', not '/review/' -- a trailing
              // slash NavLink's isActive/aria-current match never resolves
              // against the router's actual '/review' pathname.
              to={to}
              className={({ isActive }) => `chq-nav-link${isActive ? ' is-active' : ''}`}
              // w5-e/DEC-745 amendment: same GLOBAL-NAV leave-guard as the
              // desktop nav (NavLinks above).
              onClick={(e) => {
                e.preventDefault();
                guardedNavigate(() => tabsNavigate(to));
              }}
            >
              {({ isActive }) => (
                <>
                  {section.label}
                  {isActive && <span className="chq-dot is-on" aria-hidden="true" />}
                </>
              )}
            </NavLink>
          );
        })}
        <button type="button" className="chq-nav-link" onClick={() => setMoreOpen(true)}>
          More
          {anyBadgeLive && <span className="chq-dot" aria-hidden="true" />}
        </button>
      </nav>

      {moreOpen && (
        <div
          className="chq-scrim"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeMore();
          }}
        >
          <div className="chq-modal" role="dialog" aria-modal="true" aria-label="More">
            <div className="chq-modal-head">
              <h2 className="chq-modal-title">More</h2>
              <button type="button" className="chq-btn chq-btn-tertiary" onClick={closeMore}>
                Close
              </button>
            </div>
            <NavLinks sections={moreSections} onNavigate={closeMore} />
            {signOutError && (
              <div className="chq-error" role="alert">
                {signOutError}
              </div>
            )}
            <button
              type="button"
              className="chq-btn chq-btn-secondary"
              onClick={() => handleSignOutClick(setSignOutError)}
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Reviewers are confined to /review; any other path bounces them there
// rather than exposing organizer-only screens they have no API access to.
function RoleGate({ children }: { children: ReactNode }) {
  const { me, loading } = useMe();
  const location = useLocation();

  // DEC-857: while identity is still loading, no route (organizer-scoped or
  // otherwise) mounts -- an organizer-scoped page firing organizer-only
  // fetches during a reviewer's login redirect is the same defect as a gate
  // that renders its children before it knows who is signed in.
  if (loading) {
    return <PageSkeleton variant="list" />;
  }
  if (me?.role === 'reviewer' && !location.pathname.startsWith('/review')) {
    return <Navigate to="/review" replace />;
  }
  return <>{children}</>;
}

// DEC-695 (mandate item 33): the routed region is wrapped in ONE
// RouteErrorBoundary keyed on the router location, so a throw during a
// route's render surfaces a designed error state instead of unmounting the
// whole shell, and navigating away from the failed route (a location-key
// change) remounts the boundary and clears the error.
function RoutedContent() {
  const location = useLocation();
  return (
    <RouteErrorBoundary key={location.pathname}>
      <Suspense fallback={<PageSkeleton variant="list" />}>
        <Routes>
          {/* DEC-154 (amendment, wave 53): rendered FROM ADMIN_ROUTE_PATTERNS
              via ELEMENT_BY_PATTERN, so this list cannot desync from the
              Worker's admin-routes.ts manifest -- a missing/extra element
              is a TypeScript error, not a silent gap. */}
          {ADMIN_ROUTE_PATTERNS.map((pattern) => (
            <Route key={pattern} path={pattern} element={ELEMENT_BY_PATTERN[pattern]} />
          ))}
          {/* DEC-154: admin catch-all, must stay last so specific routes win. */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}

export function App() {
  return (
    <BrowserRouter basename="/admin">
      <div className="chq-shell">
        <Header />
        <main className="chq-main">
          <RoleGate>
            <RoutedContent />
          </RoleGate>
        </main>
        <PhoneTabBar />
      </div>
    </BrowserRouter>
  );
}
