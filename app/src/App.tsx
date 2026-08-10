import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { OverviewPage } from './pages/Overview';
import { SubmissionsPage } from './pages/Submissions';
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
  { label: 'Review', path: '/review', element: <ReviewPage /> },
  { label: 'Speakers', path: '/speakers', element: <SpeakersPage /> },
  { label: 'Content', path: '/content', element: <ContentPage /> },
  { label: 'Agenda', path: '/agenda', element: <AgendaPage /> },
  { label: 'Comms', path: '/comms', element: <CommsPage /> },
  { label: 'Contacts', path: '/contacts', element: <ContactsPage /> },
  { label: 'Settings', path: '/settings', element: <SettingsPage /> },
] as const;

function Nav() {
  return (
    <nav className="chq-nav">
      <div className="chq-nav-title">Chautauqua</div>
      <ul className="chq-nav-list">
        {NAV_SECTIONS.map((section) => (
          <li key={section.path}>
            <NavLink to={section.path} className={({ isActive }) => (isActive ? 'active' : '')}>
              {section.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function App() {
  return (
    <BrowserRouter basename="/admin">
      <div className="chq-app">
        <Nav />
        <main className="chq-main">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            {NAV_SECTIONS.map((section) => (
              <Route key={section.path} path={section.path} element={section.element} />
            ))}
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
