// Portals overview (Portals frame, flow 1, frame 01): every portal with a
// plain-language summary of who it covers, its live participation and item
// counts, and the coverage strip -- how many participations some portal
// matches, how many match none (opening Speakers filtered to them), and how
// many sit in two or more. New portals start blank, from a starter
// template, or copied from another event; the item library has its own page.
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import { PageSkeleton } from '../../components/PageSkeleton';
import { apiPost, ApiError } from '../../lib/api';
import { daysAgo } from '../../lib/dates';
import { useCachedGet } from '../../lib/useCachedRead';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { CopyFromEventModal } from './CopyFromEventModal';
import { SettingsSubPage } from './SettingsSubPage';
import type { PortalOverview, PortalSummary } from './types';
import './portal-editor.css';

const BACK = { label: 'Settings', to: '/settings?section=portal' };

function subLine(p: PortalSummary, now: number): string | null {
  const lead = p.template ? 'From a starter template' : p.matchesNobody && daysAgo(p.createdAt, now) === 0 ? 'Added today' : null;
  if (!p.matchesNobody) return lead;
  return lead ? `${lead} · matches nobody yet` : 'Matches nobody yet';
}

export function PortalsOverviewPage() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const navigate = useNavigate();
  const location = useLocation();
  const overviewPath = useMemo(() => (eventId ? `/events/${eventId}/portals` : null), [eventId]);
  const { data, loading, error } = useCachedGet<PortalOverview>(overviewPath, 'The portals could not be loaded.');
  const [creating, setCreating] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // a portal deleted from its editor lands here with a notice
  useEffect(() => {
    const notice = (location.state as { notice?: string } | null)?.notice;
    if (notice) setToast(notice);
  }, [location.key, location.state]);

  async function create(template: string | null) {
    if (!eventId) return;
    setCreating(template ?? 'blank');
    setCreateError(null);
    try {
      const { id } = await apiPost<{ id: string }>(`/events/${eventId}/portals`, template ? { template } : {});
      const name = data?.templates.find((t) => t.key === template)?.name;
      navigate(`/settings/portals/${id}`, {
        state: template
          ? { notice: `${name ?? 'The template'} added. It is live already; nobody was emailed.` }
          : { notice: 'New portal added. It matches nobody until you give it a rule.', created: true },
      });
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'The portal could not be created.');
      setCreating(null);
    }
  }

  const newButton = (
    <button
      type="button"
      className={creating === 'blank' ? 'chq-btn chq-btn-primary chq-btn-pending' : 'chq-btn chq-btn-primary'}
      onClick={() => void create(null)}
      disabled={creating !== null || !data}
    >
      {creating === 'blank' ? 'Creating…' : 'New portal'}
    </button>
  );

  if (eventLoading || (loading && !data && !error)) {
    return (
      <SettingsSubPage sectionKey="portal" back={BACK} title="Portals">
        <PageSkeleton variant="table" label="Loading portals…" />
      </SettingsSubPage>
    );
  }

  if (eventError || !eventId || (error && !data)) {
    return (
      <SettingsSubPage sectionKey="portal" back={BACK} title="Portals">
        <p className="chq-error" role="alert">
          {eventError ?? error ?? 'No event selected.'}
        </p>
      </SettingsSubPage>
    );
  }

  if (!data) return null;
  const now = Date.now();

  return (
    <SettingsSubPage sectionKey="portal" back={BACK} title="Portals" actions={newButton}>
      <div className="chq-portal-overview">
        {error ? (
          <p className="chq-error" role="alert">
            {error}
          </p>
        ) : null}
        {createError ? (
          <p className="chq-error" role="alert">
            {createError}
          </p>
        ) : null}

        {data.total === 0 ? (
          <p className="chq-portal-overview-note">
            No participations yet. Portals start matching once sessions are accepted, speakers are invited or sponsors are added.
          </p>
        ) : (
          <div className="chq-portal-stats" role="group" aria-label="Coverage">
            <div className="chq-portal-stat">
              <span className="chq-portal-stat-label">Covered</span>
              <span className="chq-portal-stat-value">
                {data.covered} of {data.total}
              </span>
              <span className="chq-portal-stat-sub">participations match at least one portal</span>
            </div>
            <div className="chq-portal-stat">
              <span className="chq-portal-stat-label">Not in any portal</span>
              <span className="chq-portal-stat-value">{data.notInAny}</span>
              {data.notInAny > 0 ? (
                <Link className="chq-portal-stat-link" to="/speakers?portal=none">
                  Open in Speakers ›
                </Link>
              ) : (
                <span className="chq-portal-stat-sub">Everyone gets at least one portal</span>
              )}
            </div>
            <div className="chq-portal-stat">
              <span className="chq-portal-stat-label">Overlap</span>
              <span className="chq-portal-stat-value">{data.overlap}</span>
              <span className="chq-portal-stat-sub">in two or more portals</span>
            </div>
          </div>
        )}

        <section className="chq-portal-section" aria-labelledby="portals-list-label">
          <div className="chq-section-head chq-portal-head-wrap">
            <span className="chq-section-label" id="portals-list-label">
              Portals · {data.portals.length}
            </span>
            <span className="chq-portal-head-links">
              <Link className="chq-portal-head-link" to="/settings/portals/library">
                Libraries
              </Link>
              <button type="button" className="chq-link-button chq-portal-head-link" onClick={() => setCopyOpen(true)}>
                Copy from another event
              </button>
            </span>
          </div>
          {data.portals.length === 0 ? (
            <EmptyState
              variant="fresh"
              what="No portals yet."
              reason="Participations get nothing until a portal matches them. Start from a template below, or make one from scratch."
              action={{ label: 'New portal', onClick: () => void create(null) }}
            />
          ) : (
            <table className="chq-table chq-portal-table">
              <thead>
                <tr>
                  <th className="chq-portal-col-name">Portal</th>
                  <th>Who it covers</th>
                  <th className="chq-portal-col-count">Participations</th>
                  <th className="chq-portal-col-items">Items</th>
                  <th className="chq-portal-col-edit">
                    <span className="chq-portal-sr">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.portals.map((p) => {
                  const sub = subLine(p, now);
                  return (
                    <tr key={p.id} data-nobody={p.matchesNobody ? 'true' : undefined}>
                      <td>
                        <span className="chq-portal-table-name">
                          <span className="chq-portal-table-title">{p.name}</span>
                          {sub ? <span className="chq-portal-table-sub">{sub}</span> : null}
                        </span>
                      </td>
                      <td className="chq-portal-table-who">{p.who}</td>
                      <td className="chq-portal-table-count">
                        <span className="chq-portal-table-label" aria-hidden="true">
                          Participations{' '}
                        </span>
                        {p.participations}
                      </td>
                      <td className="chq-portal-table-items">
                        <span className="chq-portal-table-label" aria-hidden="true">
                          Items{' '}
                        </span>
                        {p.items}
                      </td>
                      <td>
                        <Link className="chq-portal-edit-link" to={`/settings/portals/${p.id}`} aria-label={`Edit ${p.name}`}>
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="chq-portal-section" aria-labelledby="portal-templates-label">
          <div className="chq-section-head">
            <span className="chq-section-label" id="portal-templates-label">
              Start from a template
            </span>
          </div>
          <ul className="chq-portal-templates">
            {data.templates.map((t) => (
              <li key={t.key} className="chq-portal-template">
                <span className="chq-portal-template-name">{t.name}</span>
                <span className="chq-portal-template-blurb">{t.blurb}</span>
                <button
                  type="button"
                  className="chq-link-button chq-portal-template-use"
                  onClick={() => void create(t.key)}
                  disabled={creating !== null}
                  aria-label={`Use the ${t.name} template`}
                >
                  {creating === t.key ? 'Adding…' : 'Use this template'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {copyOpen ? <CopyFromEventModal eventId={eventId} onClose={() => setCopyOpen(false)} /> : null}

      {toast ? (
        <div className="chq-toast" role="status">
          {toast}
          <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => setToast(null)} aria-label="Dismiss">
            &times;
          </button>
        </div>
      ) : null}
    </SettingsSubPage>
  );
}
