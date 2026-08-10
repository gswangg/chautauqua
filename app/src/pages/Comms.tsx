import { useState } from 'react';
import { useCurrentEvent } from '../lib/useCurrentEvent';
import { TemplatesTab } from './comms/TemplatesTab';
import { ComposeWizard } from './comms/ComposeWizard';
import { HistoryTab } from './comms/HistoryTab';

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
        <h1>Comms</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (error || !eventId) {
    return (
      <div className="chq-page">
        <h1>Comms</h1>
        <div className="chq-attention-frame">{error ?? 'No event selected.'}</div>
      </div>
    );
  }

  return (
    <div className="chq-page chq-comms-page">
      <h1>Comms</h1>

      <nav className="chq-tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'compose' && <ComposeWizard eventId={eventId} />}
      {tab === 'templates' && <TemplatesTab eventId={eventId} />}
      {tab === 'history' && <HistoryTab eventId={eventId} />}
    </div>
  );
}
