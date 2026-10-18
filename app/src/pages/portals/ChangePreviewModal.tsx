// Portal editor · Before saving (Portals frame, flow 2, e2-x6): what saving
// the edited portal would do, computed against today's data -- who gains
// and loses the portal, what they gain and lose (finished work is kept; an
// item still reached through another portal is called out), permission
// changes, everyone affected, and whether to email the people who get new
// items. Nothing is saved until "Save and apply".
import { useState } from 'react';
import { ModalFrame } from '../../components/ModalFrame';
import { countOf, plural } from '../../lib/plural';
import { serverPermissionLine } from './portalDraft';
import type { ImpactItemLine, PortalImpact } from './types';

const CHANGE_LABELS: Record<PortalImpact['people'][number]['change'], string> = {
  gain: 'Gains this portal',
  lose: 'Loses this portal',
  new_items: 'Gets new items',
};

interface ChangePreviewModalProps {
  portalName: string;
  impact: PortalImpact;
  // participations the rule as edited matches now
  covered: number;
  permissionLines: string[];
  added: string[];
  removed: string[];
  notifyDefault: boolean;
  saving: boolean;
  error: string | null;
  onSave: (notify: boolean) => void;
  onBack: () => void;
}

function loseLine(item: ImpactItemLine): string | null {
  const parts: string[] = [];
  if (item.filed) parts.push(`${item.filed} already filed · answers are kept`);
  for (const k of item.keptThrough ?? []) parts.push(`${k.people} keep it through ${k.portal}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function headline(impact: PortalImpact, covered: number, permissions: boolean): string {
  if (impact.affected > 0) return `This change affects ${countOf(impact.affected, 'participation')}`;
  if (impact.newItems.people > 0) return `This change gives ${countOf(impact.newItems.people, 'person', 'people')} new items`;
  if (permissions && covered > 0) return `This change applies to ${countOf(covered, 'participation')}`;
  return 'This change affects nobody yet';
}

export function ChangePreviewModal({
  portalName,
  impact,
  covered,
  permissionLines,
  added,
  removed,
  notifyDefault,
  saving,
  error,
  onSave,
  onBack,
}: ChangePreviewModalProps) {
  const [notify, setNotify] = useState(notifyDefault);
  const [showPeople, setShowPeople] = useState(false);
  const { gain, lose, newItems, people } = impact;
  const emailable = newItems.people;
  // the editor's own lines read the levels participants get; the API's are a fallback
  const permissions = permissionLines.length > 0 ? permissionLines : impact.permissionChanges.map(serverPermissionLine);

  return (
    <ModalFrame
      title={headline(impact, covered, permissions.length > 0)}
      subtitle={`${portalName} · nothing is saved yet`}
      onClose={onBack}
      closeDisabled={saving}
      modalClassName="chq-portal-modal chq-portal-preview"
      actions={
        <>
          <button type="button" className={saving ? 'chq-btn chq-btn-primary chq-btn-pending' : 'chq-btn chq-btn-primary'} onClick={() => onSave(notify)} disabled={saving}>
            {saving ? 'Saving…' : impact.affected > 0 ? `Save and apply to ${impact.affected}` : 'Save changes'}
          </button>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={onBack} disabled={saving}>
            Back to editing
          </button>
        </>
      }
    >
      <div className="chq-portal-preview-body">
        {impact.affected > 0 ? (
          <div className="chq-portal-stats chq-portal-preview-stats">
            <div className="chq-portal-stat">
              <span className="chq-portal-stat-label">Gain this portal</span>
              <span className="chq-portal-stat-value">{gain.count}</span>
              <span className="chq-portal-stat-sub">{gain.count > 0 ? gain.who : 'Nobody'}</span>
            </div>
            <div className="chq-portal-stat">
              <span className="chq-portal-stat-label">Lose this portal</span>
              <span className="chq-portal-stat-value">{lose.count}</span>
              <span className="chq-portal-stat-sub">{lose.count > 0 ? lose.who : 'Nobody'}</span>
            </div>
          </div>
        ) : null}

        {gain.count > 0 && gain.items.length > 0 ? (
          <section className="chq-portal-preview-section" aria-label={`What the ${gain.count} gain`}>
            <div className="chq-section-head">
              <span className="chq-section-label">What the {gain.count} gain</span>
            </div>
            <ul className="chq-portal-preview-lines">
              {gain.items.map((item) => (
                <li key={item.title} className="chq-portal-preview-line">
                  <span className="chq-portal-preview-title">{item.title}</span>
                  {item.people < gain.count ? (
                    <span className="chq-portal-preview-sub">{gain.count - item.people} already have it from another portal</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {lose.count > 0 && lose.items.length > 0 ? (
          <section className="chq-portal-preview-section" aria-label={`What the ${lose.count} lose`}>
            <div className="chq-section-head">
              <span className="chq-section-label">What the {lose.count} lose</span>
            </div>
            <ul className="chq-portal-preview-lines">
              {lose.items.map((item) => {
                const sub = loseLine(item);
                return (
                  <li key={item.title} className="chq-portal-preview-line">
                    <span className="chq-portal-preview-title">{item.title}</span>
                    {sub ? <span className="chq-portal-preview-sub">{sub}</span> : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {added.length > 0 ? (
          <section className="chq-portal-preview-section" aria-label="Items added">
            <div className="chq-section-head">
              <span className="chq-section-label">Items added</span>
            </div>
            <ul className="chq-portal-preview-lines">
              {added.map((title) => (
                <li key={title} className="chq-portal-preview-line">
                  <span className="chq-portal-preview-title">{title}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {removed.length > 0 ? (
          <section className="chq-portal-preview-section" aria-label="Items removed">
            <div className="chq-section-head">
              <span className="chq-section-label">Items removed</span>
            </div>
            <ul className="chq-portal-preview-lines">
              {removed.map((title) => (
                <li key={title} className="chq-portal-preview-line">
                  <span className="chq-portal-preview-title">{title}</span>
                  <span className="chq-portal-preview-sub">Leaves people's homes · finished work stays on their records</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {permissions.length > 0 ? (
          <section className="chq-portal-preview-section" aria-label="Permission changes">
            <div className="chq-section-head">
              <span className="chq-section-label">Permission changes</span>
            </div>
            <ul className="chq-portal-preview-lines">
              {permissions.map((line) => (
                <li key={line} className="chq-portal-preview-line">
                  <span className="chq-portal-preview-title">{line}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {people.length > 0 ? (
          <div className="chq-portal-preview-people">
            <button type="button" className="chq-link-button chq-portal-preview-toggle" aria-expanded={showPeople} onClick={() => setShowPeople((s) => !s)}>
              {showPeople ? 'Hide the list' : `See all ${countOf(people.length, 'person', 'people')}`}
            </button>
            {showPeople ? (
              <ul className="chq-portal-preview-lines">
                {people.map((p) => (
                  <li key={`${p.contactId}-${p.participation}-${p.change}`} className="chq-portal-preview-line">
                    <span className="chq-portal-preview-title">{p.name}</span>
                    <span className="chq-portal-preview-sub">
                      {p.participation} · {CHANGE_LABELS[p.change]}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {emailable > 0 ? (
          <label className="chq-checkbox-label chq-portal-preview-notify">
            <input type="checkbox" className="chq-check" checked={notify} onChange={(e) => setNotify(e.target.checked)} disabled={saving} />
            Email the {countOf(emailable, 'person', 'people')} who {plural(emailable, 'gets', 'get')} new items
          </label>
        ) : null}

        {error ? (
          <p className="chq-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </ModalFrame>
  );
}
