import { useState } from 'react';
import { useCurrentEvent } from '../lib/useCurrentEvent';
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

  if (loading) {
    return (
      <div className="chq-page">
        <h1 className="chq-page-title">Comms</h1>
        <p>Loading...</p>
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
              onClick={() => setTab(t.id)}
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
  );
}
