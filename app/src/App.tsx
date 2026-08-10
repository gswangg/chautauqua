import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useMe } from './lib/useMe';
import { EventSwitcher } from './components/EventSwitcher';
import { OverviewPage } from './pages/Overview';
import { SubmissionsPage } from './pages/Submissions';
import { FormsPage } from './pages/forms/FormsPage';
import { ReviewPage } from './pages/Review';
import { SpeakersPage } from './pages/Speakers';
import { ContentPage } from './pages/Content';
import { AgendaPage } from './pages/Agenda';
import { CommsPage } from './pages/Comms';
import { ContactsPage } from './pages/Contacts';
import { SettingsPage } from './pages/Settings';

const NAV_SECTIONS = [
  { label: 'Overview', path: '/overview', element: <OverviewPage /> },
  { label: 'Submissions', path: '/submissions', element: <SubmissionsPage /> },
  { label: 'Review', path: '/review/*', element: <ReviewPage /> },
  { label: 'Speakers', path: '/speakers', element: <SpeakersPage /> },
  { label: 'Content', path: '/content', element: <ContentPage /> },
  { label: 'Agenda', path: '/agenda', element: <AgendaPage /> },
  { label: 'Comms', path: '/comms', element: <CommsPage /> },
  { label: 'Contacts', path: '/contacts', element: <ContactsPage /> },
  { label: 'Settings', path: '/settings', element: <SettingsPage /> },
] as const;

// DEC-024: reviewers see only the Review nav section and land on /review.
function isReviewerNav(section: (typeof NAV_SECTIONS)[number]): boolean {
  return section.path === '/review/*';
}

function Nav() {
  const { me } = useMe();
  const sections = me?.role === 'reviewer' ? NAV_SECTIONS.filter(isReviewerNav) : NAV_SECTIONS;

  return (
    <nav className="chq-nav">
      <div className="chq-nav-title">Chautauqua</div>
      <EventSwitcher />
      <ul className="chq-nav-list">
        {sections.map((section) => (
          <li key={section.path}>
            <NavLink to={section.path.replace(/\*$/, '')} className={({ isActive }) => (isActive ? 'active' : '')}>
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
            <Routes>
              <Route path="/" element={<OverviewPage />} />
              {NAV_SECTIONS.map((section) => (
                <Route key={section.path} path={section.path} element={section.element} />
              ))}
              {/* DEC-033: form builder lives under Submissions (route only — no new top-nav section). */}
              <Route path="/submissions/forms" element={<FormsPage />} />
            </Routes>
          </RoleGate>
        </main>
      </div>
    </BrowserRouter>
  );
}
