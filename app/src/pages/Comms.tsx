import { useState } from 'react';
import { useCurrentEvent } from '../lib/useCurrentEvent';
import { DelayedLoading } from '../components/DelayedLoading';
import { TemplatesTab } from './comms/TemplatesTab';
import { ComposeWizard } from './comms/ComposeWizard';
import { HistoryTab } from './comms/HistoryTab';
import './comms/comms.css';

type Tab = 'compose' | 'templates' | 'history';

const TABS: { id: Tab; label: string }[] = [
  { id: 'compose', label: 'Compose' },
  { id: 'templates', label: 'Templates' },
  { id: 'history', label: 'History' },
];

export function CommsPage() {
  const { eventId, loading, error } = useCurrentEvent();
  const [tab, setTab] = useState<Tab>('compose');
  // DEC-621: at phone width the page opens on a landing screen naming the
  // three things Comms does, rather than dropping straight into compose
  // step 1. SSR can't know the viewport, so both the landing block and the
  // regular head+tab content always render; a JS app-state flag (not a
  // width check) toggles which one the phone stylesheet shows -- desktop
  // never reads this flag (the CSS rules that key off it only exist inside
  // the 700px media query in comms.css).
  const [phoneEntered, setPhoneEntered] = useState(false);

  function choosePhoneTab(t: Tab) {
    setTab(t);
    setPhoneEntered(true);
  }

  if (loading) {
    return (
      <div className="chq-page">
        <h1 className="chq-page-title">Comms</h1>
        <DelayedLoading />
      </div>
    );
  }

  if (error || !eventId) {
    return (
      <div className="chq-page">
        <h1 className="chq-page-title">Comms</h1>
        <div className="chq-error">{error ?? 'No event selected.'}</div>
      </div>
    );
  }

  return (
    <div className="chq-page chq-comms-page">
      <div className={phoneEntered ? 'chq-comms-main' : 'chq-comms-main chq-comms-main-landing'}>
        <div className="chq-comms-head">
          <div className="chq-comms-head-titles">
            <h1 className="chq-page-title">Comms</h1>
          </div>
          <div className="chq-comms-head-actions" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? 'chq-pill is-active' : 'chq-pill'}
                onClick={() => choosePhoneTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'compose' && <ComposeWizard eventId={eventId} />}
        {tab === 'templates' && <TemplatesTab eventId={eventId} />}
        {tab === 'history' && <HistoryTab eventId={eventId} />}
      </div>

      {/* DEC-621: phone-only landing. Hidden by default (top-level
          display:none in comms.css); shown inside the 700px media query
          only while chq-comms-phone-landing-show is present, i.e. before
          the visitor has picked one of the three destinations. */}
      <div
        className={
          phoneEntered ? 'chq-comms-phone-landing' : 'chq-comms-phone-landing chq-comms-phone-landing-show'
        }
      >
        {/* The header nav (chq-header/chq-tabbar) already names this page
            "Comms"; this block only needs to introduce the choice, not
            repeat the page h1 (a repeated h1 would double up the
            accessible-heading name whenever the markup for this JS-state
            branch coexists with the main block in the DOM). */}
        <p className="chq-comms-phone-landing-intro">Choose what you&rsquo;d like to do.</p>
        <div className="chq-comms-phone-landing-choices">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="chq-comms-phone-landing-choice"
              onClick={() => choosePhoneTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
