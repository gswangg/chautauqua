// Portal editor (Portals frame, flow 2, frames 03 and 04): who the portal
// covers (the rule, with live matches pinned beside it), its items, field
// permissions and actions, and its note -- one page, one save. Review and
// save previews the change first whenever the rule, items or permissions
// changed (ChangePreviewModal); a name- or note-only change saves straight
// away. Profile basics' note is the event's welcome note.
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { ErrorSummary, countHeading } from '../../components/ErrorSummary';
import { PageSkeleton } from '../../components/PageSkeleton';
import { apiDelete, apiGet, apiPost, apiPut, ApiError } from '../../lib/api';
import { MAX_PORTAL_NAME, MAX_PORTAL_NOTE } from '../../lib/domain-caps';
import { countOf } from '../../lib/plural';
import { MAX_LONG_TEXT_LENGTH } from '../../lib/text-caps';
import { useCurrentEvent } from '../../lib/useCurrentEvent';
import { setNavLeaveGuard } from '../../lib/useNavExceptions';
import { AddFromLibraryModal } from './AddFromLibraryModal';
import { ChangePreviewModal } from './ChangePreviewModal';
import { MatchesPanel } from './MatchesPanel';
import { PermissionsSection } from './PermissionsSection';
import { PortalItemsTable } from './PortalItemsTable';
import { RuleEditor } from './RuleEditor';
import { SettingsSubPage } from './SettingsSubPage';
import {
  completeRule,
  draftFromEditor,
  draftProblems,
  draftToInput,
  itemChanges,
  matchesNobodyLine,
  permissionChangeLines,
  ruleCanMatchCompanies,
  ruleHasIncomplete,
  sameDraft,
  type DraftProblem,
  type PortalDraft,
} from './portalDraft';
import type { MatchRow, PortalEditorData, PortalImpact, PortalSaveResult } from './types';
import './portal-editor.css';

type EditorPayload = PortalEditorData & { noteIsWelcome: boolean };

interface LiveMatches {
  count: number;
  rows: MatchRow[];
  gained: number;
  lost: number;
}

const MATCH_DEBOUNCE_MS = 350;

// "Panelist · SES-033 Lunch panel: Platform teams" -> the role and the
// session title, for the note preview
function previewHeading(row: MatchRow | undefined): { kicker: string; title: string } {
  if (!row) return { kicker: 'A session this portal covers', title: 'Its title appears here' };
  const [role, ...rest] = row.participation.split(' · ');
  const title = rest.join(' · ').replace(/^[A-Z]+-\d+\s+/, '');
  return { kicker: role ?? '', title: title || row.name };
}

function savedLine(result: PortalSaveResult): string {
  const parts = ['Saved'];
  if (result.joined > 0) parts.push(`${result.joined} joined`);
  if (result.left > 0) parts.push(`${result.left} left`);
  if (result.emailed > 0) parts.push(`${countOf(result.emailed, 'person', 'people')} emailed`);
  return parts.join(' · ');
}

export function PortalEditorPage() {
  const { eventId, loading: eventLoading, error: eventError } = useCurrentEvent();
  const { portalId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const navNotice = (location.state as { notice?: string; created?: boolean } | null) ?? null;

  const [data, setData] = useState<EditorPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null);
  const [saved, setSaved] = useState<PortalDraft | null>(null);
  const [draft, setDraft] = useState<PortalDraft | null>(null);
  const loadGen = useRef(0);

  const [live, setLive] = useState<LiveMatches | null>(null);
  const [matchPending, setMatchPending] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const matchGen = useRef(0);

  const [renaming, setRenaming] = useState(false);
  const [problems, setProblems] = useState<DraftProblem[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [impact, setImpact] = useState<PortalImpact | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [confirm, setConfirm] = useState<'duplicate' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const pendingLeave = useRef<(() => void) | null>(null);
  const bypassGuard = useRef(false);

  const load = useCallback((eid: string, pid: string) => {
    const gen = ++loadGen.current;
    setLoadError(null);
    setLoading(true);
    apiGet<EditorPayload>(`/events/${eid}/portals/${pid}`)
      .then((payload) => {
        if (gen !== loadGen.current) return;
        const next = draftFromEditor(payload);
        setData(payload);
        setSaved(next);
        setDraft(next);
        setLive(null);
        setProblems([]);
      })
      .catch((err) => {
        if (gen !== loadGen.current) return;
        setLoadError({ status: err instanceof ApiError ? err.status : 0, message: err instanceof ApiError ? err.message : 'The portal could not be loaded.' });
      })
      .finally(() => {
        if (gen === loadGen.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!eventId) return;
    // a different portal (a duplicate just made) starts from a clean page
    setData(null);
    setSaved(null);
    setDraft(null);
    setImpact(null);
    load(eventId, portalId);
  }, [eventId, portalId, load]);

  // arriving from "New portal" or Duplicate: name it first, and say what happened
  useEffect(() => {
    if (navNotice?.notice) setToast(navNotice.notice);
    setRenaming(navNotice?.created === true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  const dirty = saved !== null && draft !== null && !sameDraft(saved, draft);

  // live matches for the rule as edited; the saved rule's own come with the page
  const ruleKey = draft ? JSON.stringify(completeRule(draft.rule)) : '';
  const savedRuleKey = saved ? JSON.stringify(completeRule(saved.rule)) : '';
  useEffect(() => {
    if (!eventId || ruleKey === '' || ruleKey === savedRuleKey) {
      matchGen.current += 1;
      setLive(null);
      setMatchError(null);
      setMatchPending(false);
      return;
    }
    setMatchPending(true);
    const timer = window.setTimeout(() => {
      const gen = ++matchGen.current;
      setMatchError(null);
      apiPost<LiveMatches>(`/events/${eventId}/portals/${portalId}/matches`, { rule: JSON.parse(ruleKey) })
        .then((result) => {
          if (gen === matchGen.current) setLive(result);
        })
        .catch((err) => {
          if (gen === matchGen.current) setMatchError(err instanceof ApiError ? err.message : 'The matches could not be counted.');
        })
        .finally(() => {
          if (gen === matchGen.current) setMatchPending(false);
        });
    }, MATCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [eventId, portalId, ruleKey, savedRuleKey]);

  // ---- leaving with unsaved edits (the PlanEditor idiom) -----------------
  function requestLeave(action: () => void) {
    if (!dirty) {
      action();
      return;
    }
    pendingLeave.current = action;
    setLeaveOpen(true);
  }

  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    setNavLeaveGuard((proceed) => {
      pendingLeave.current = proceed;
      setLeaveOpen(true);
    });
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      setNavLeaveGuard(null);
    };
  }, [dirty]);

  // the back link, the Settings rail and the match rows are plain links:
  // with edits pending, a click on one asks first, then follows it
  function guardLinks(e: MouseEvent<HTMLDivElement>) {
    if (!dirty || bypassGuard.current || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const anchor = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null;
    if (!anchor || anchor.target === '_blank' || (anchor.getAttribute('href') ?? '').startsWith('#')) return;
    e.preventDefault();
    e.stopPropagation();
    requestLeave(() => {
      bypassGuard.current = true;
      anchor.click();
      bypassGuard.current = false;
    });
  }

  function update(patch: Partial<PortalDraft>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }

  // ---- saving -----------------------------------------------------------
  async function put(notify: 'auto' | 'all' | 'none') {
    if (!eventId || !draft) return;
    setSaving(true);
    setSaveError(null);
    setPreviewError(null);
    try {
      const input = draftToInput(draft);
      const body = {
        name: input.name,
        note: input.note,
        rule: input.rule,
        fieldPermissions: input.fieldPermissions,
        capabilities: input.capabilities,
        notifyOnJoin: input.notifyOnJoin,
        items: input.items,
        notify,
      };
      const result = await apiPut<PortalSaveResult>(`/events/${eventId}/portals/${portalId}`, body);
      setImpact(null);
      setToast(savedLine(result));
      setRenaming(false);
      load(eventId, portalId);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'The portal could not be saved.';
      if (impact) setPreviewError(message);
      else setSaveError(message);
    } finally {
      setSaving(false);
    }
  }

  async function reviewAndSave() {
    if (!eventId || !draft) return;
    const found = draftProblems(draft, data?.ruleOptions ?? []);
    setProblems(found);
    setSaveError(null);
    if (found.some((p) => p.anchorId === 'portal-name')) setRenaming(true);
    if (found.length > 0) return;
    setReviewing(true);
    try {
      const input = draftToInput(draft);
      const body = {
        name: input.name,
        note: input.note,
        rule: input.rule,
        fieldPermissions: input.fieldPermissions,
        capabilities: input.capabilities,
        notifyOnJoin: input.notifyOnJoin,
        items: input.items,
      };
      const preview = await apiPost<PortalImpact>(`/events/${eventId}/portals/${portalId}/preview`, body);
      if (!preview.needsPreview) {
        setReviewing(false);
        await put('auto');
        return;
      }
      setPreviewError(null);
      setImpact(preview);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'The change could not be previewed.');
    } finally {
      setReviewing(false);
    }
  }

  async function duplicate() {
    if (!eventId || !data) return;
    setBusy(true);
    setConfirmError(null);
    try {
      const { id } = await apiPost<{ id: string }>(`/events/${eventId}/portals/${portalId}/duplicate`);
      setConfirm(null);
      bypassGuard.current = false;
      navigate(`/settings/portals/${id}`, { state: { notice: `Copied from ${data.portal.name}. Give it a rule to start matching.`, created: true } });
    } catch (err) {
      setConfirmError(err instanceof ApiError ? err.message : 'The portal could not be duplicated.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!eventId || !data) return;
    setBusy(true);
    setConfirmError(null);
    try {
      const { detached } = await apiDelete<{ ok: true; detached: number }>(`/events/${eventId}/portals/${portalId}`);
      setConfirm(null);
      navigate('/settings/portals', {
        state: {
          notice:
            detached > 0
              ? `${data.portal.name} deleted · ${countOf(detached, 'item')} left people's homes; finished work is kept`
              : `${data.portal.name} deleted`,
        },
      });
    } catch (err) {
      setConfirmError(err instanceof ApiError ? err.message : 'The portal could not be deleted.');
    } finally {
      setBusy(false);
    }
  }

  // ---- render -------------------------------------------------------------
  const back = { label: 'Portals', to: '/settings/portals' };

  if (eventLoading || (loading && !data && !loadError)) {
    return (
      <SettingsSubPage sectionKey="portal" back={back} title="Portal">
        <PageSkeleton variant="detail" label="Loading the portal…" />
      </SettingsSubPage>
    );
  }

  if (eventError || !eventId) {
    return (
      <SettingsSubPage sectionKey="portal" back={back} title="Portal">
        <p className="chq-error">{eventError ?? 'No event selected.'}</p>
      </SettingsSubPage>
    );
  }

  if (loadError && !data) {
    return loadError.status === 404 ? (
      <SettingsSubPage sectionKey="portal" back={back} title="Portal not found">
        <EmptyState variant="fresh" what="This portal doesn't exist." reason="It may have been deleted, or it belongs to another event." action={{ label: 'Back to portals', to: '/settings/portals' }} />
      </SettingsSubPage>
    ) : (
      <SettingsSubPage sectionKey="portal" back={back} title="Portal">
        <p className="chq-error" role="alert">
          {loadError.message}
        </p>
        <button type="button" className="chq-btn chq-btn-secondary" onClick={() => load(eventId, portalId)}>
          Try again
        </button>
      </SettingsSubPage>
    );
  }

  if (!data || !draft || !saved) return null;

  const welcome = data.noteIsWelcome;
  const ruleChanged = ruleKey !== savedRuleKey;
  const count = ruleChanged && live ? live.count : data.matches.count;
  const rows = ruleChanged && live ? live.rows : data.matches.rows;
  const personOnly = draft.items.length > 0 && draft.items.every((i) => i.scope === 'person');
  const invalid = new Set(problems.map((p) => p.anchorId));
  const changes = itemChanges(saved, draft);
  const heading = previewHeading(rows[0]);
  const firstName = rows[0]?.name.split(' ')[0];
  const noteLabel = welcome
    ? 'Welcome note · shown at the top of every participant’s home'
    : personOnly
      ? 'Shown in the profile area of everyone this portal covers'
      : 'Shown under each session or company this portal covers';
  const isProfileBasics = data.portal.template === 'profile_basics';

  return (
    <div className="chq-portal-guard" onClickCapture={guardLinks}>
      <SettingsSubPage
        sectionKey="portal"
        back={back}
        title={draft.name.trim() === '' ? 'Untitled portal' : draft.name}
        subtitle={`As saved · ${data.ruleText}`}
        actions={
          <button type="button" className="chq-btn chq-btn-tertiary" aria-expanded={renaming} onClick={() => setRenaming((r) => !r)}>
            {renaming ? 'Done renaming' : 'Rename'}
          </button>
        }
      >
        <div className="chq-portal-editor">
          {renaming ? (
            <div className="chq-portal-name" data-invalid={invalid.has('portal-name') ? 'true' : undefined}>
              <label className="chq-portal-field-label" htmlFor="portal-name">
                Portal name
              </label>
              <input
                id="portal-name"
                className="chq-input"
                value={draft.name}
                maxLength={MAX_PORTAL_NAME}
                autoFocus
                onChange={(e) => update({ name: e.target.value })}
              />
              <span className="chq-portal-field-help">Only organizers see this name; participants see its items and note.</span>
            </div>
          ) : null}

          <div className="chq-portal-editor-top">
            <section className="chq-portal-section" aria-labelledby="portal-rule-label">
              <div className="chq-section-head">
                <span className="chq-section-label" id="portal-rule-label">
                  Match participations where
                </span>
              </div>
              <RuleEditor rule={draft.rule} options={data.ruleOptions} invalid={invalid} onChange={(rule) => update({ rule })} />
            </section>
            <MatchesPanel
              eventId={eventId}
              count={count}
              rows={rows}
              savedCount={data.matches.count}
              gained={live?.gained ?? 0}
              lost={live?.lost ?? 0}
              ruleChanged={ruleChanged && live !== null}
              pending={matchPending}
              error={matchError}
              incomplete={ruleHasIncomplete(draft.rule)}
              nobodyLine={matchesNobodyLine(draft.rule, data.ruleOptions)}
            />
          </div>

          <PortalItemsTable items={draft.items} invalid={invalid} onChange={(items) => update({ items })} onAdd={() => setLibraryOpen(true)} />

          <PermissionsSection
            fieldPermissions={draft.fieldPermissions}
            savedFieldPermissions={saved.fieldPermissions}
            capabilities={draft.capabilities}
            savedCapabilities={saved.capabilities}
            levels={data.fieldLevels}
            companies={ruleCanMatchCompanies(draft.rule)}
            onFields={(fieldPermissions) => update({ fieldPermissions })}
            onCapabilities={(capabilities) => update({ capabilities })}
          />

          <section className="chq-portal-section" aria-labelledby="portal-note-label">
            <div className="chq-section-head">
              <span className="chq-section-label" id="portal-note-label">
                Note to participants
              </span>
            </div>
            <div className="chq-portal-note">
              <div className="chq-portal-note-edit">
                <label className="chq-portal-field-label" htmlFor="portal-note">
                  {noteLabel}
                </label>
                <textarea
                  id="portal-note"
                  className="chq-textarea"
                  value={draft.note}
                  maxLength={welcome ? MAX_LONG_TEXT_LENGTH : MAX_PORTAL_NOTE}
                  placeholder={welcome ? 'A few words everyone sees first.' : 'A line for the people this portal covers, shown beside its items.'}
                  onChange={(e) => update({ note: e.target.value })}
                />
                {welcome ? <span className="chq-portal-field-help">This is the event’s welcome note; it was the Speaker portal’s welcome message.</span> : null}
              </div>
              <div className="chq-portal-note-preview">
                <span className="chq-portal-field-label">How it appears</span>
                <div className="chq-portal-note-card">
                  {welcome ? (
                    <div className="chq-portal-note-card-head">
                      <span className="chq-portal-note-kicker">Top of every home</span>
                      <span className="chq-portal-note-title">Hi {firstName ?? 'there'}</span>
                      <span className="chq-portal-note-body">{draft.note.trim() === '' ? 'No welcome note yet.' : draft.note}</span>
                    </div>
                  ) : (
                    <div className="chq-portal-note-card-head">
                      <span className="chq-portal-note-kicker">{personOnly ? 'Your profile' : heading.kicker}</span>
                      {personOnly ? null : <span className="chq-portal-note-title">{heading.title}</span>}
                      <span className="chq-portal-note-body">{draft.note.trim() === '' ? 'No note: only the items show.' : draft.note}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <label className="chq-checkbox-label chq-portal-notify">
              <input type="checkbox" className="chq-check" checked={draft.notifyOnJoin} onChange={(e) => update({ notifyOnJoin: e.target.checked })} />
              Email people when they start matching this portal later
            </label>
            <span className="chq-portal-field-help">
              For example when their session is accepted or their sponsor joins. Saving a change asks separately who to email.
            </span>
          </section>

          {problems.length > 0 ? (
            <ErrorSummary heading={countHeading(problems.length, 'before this can be saved')} kept="Nothing is saved yet; your edits are kept." problems={problems} />
          ) : null}
          {saveError ? (
            <p className="chq-error" role="alert">
              {saveError}
            </p>
          ) : null}

          <div className="chq-portal-footer">
            <div className="chq-portal-footer-side">
              <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => setConfirm('duplicate')}>
                Duplicate
              </button>
              <button type="button" className="chq-btn chq-btn-destructive-tertiary" onClick={() => setConfirm('delete')}>
                Delete portal
              </button>
            </div>
            <div className="chq-portal-footer-main">
              <button type="button" className="chq-btn chq-btn-secondary" onClick={() => requestLeave(() => navigate('/settings/portals'))} disabled={saving}>
                Cancel
              </button>
              <button
                type="button"
                className={reviewing || saving ? 'chq-btn chq-btn-primary chq-btn-pending' : 'chq-btn chq-btn-primary'}
                onClick={() => void reviewAndSave()}
                disabled={reviewing || saving || !dirty}
              >
                {saving && !impact ? 'Saving…' : reviewing ? 'Checking…' : 'Review and save'}
              </button>
            </div>
          </div>
        </div>
      </SettingsSubPage>

      {impact ? (
        <ChangePreviewModal
          portalName={draft.name}
          impact={impact}
          covered={count}
          permissionLines={permissionChangeLines(saved, draft)}
          added={changes.added.map((i) => i.title)}
          removed={changes.removed.map((i) => i.title)}
          notifyDefault={draft.notifyOnJoin}
          saving={saving}
          error={previewError}
          onSave={(notify) => void put(notify && impact.newItems.people > 0 ? 'all' : 'none')}
          onBack={() => setImpact(null)}
        />
      ) : null}

      {libraryOpen ? (
        <AddFromLibraryModal
          eventId={eventId}
          portalName={draft.name}
          inPortal={new Set(draft.items.map((i) => i.key))}
          onAdd={(items) => {
            const have = new Set(draft.items.map((i) => i.key));
            update({ items: [...draft.items, ...items.filter((i) => !have.has(i.key))] });
          }}
          onClose={() => setLibraryOpen(false)}
        />
      ) : null}

      {confirm === 'duplicate' ? (
        <ConfirmDialog
          title={`Duplicate “${data.portal.name}”?`}
          body={
            <>
              <p>The copy keeps the items, permissions and note. It starts with an empty rule, so it matches nobody until you give it one.</p>
              {dirty ? <p>Your unsaved edits here aren’t copied.</p> : null}
              {confirmError ? (
                <p className="chq-error" role="alert">
                  {confirmError}
                </p>
              ) : null}
            </>
          }
          confirmLabel="Duplicate portal"
          pending={busy}
          onConfirm={() => void duplicate()}
          onCancel={() => {
            setConfirm(null);
            setConfirmError(null);
          }}
        />
      ) : null}

      {confirm === 'delete' ? (
        <ConfirmDialog
          title={`Delete “${data.portal.name}”?`}
          body={
            <>
              <p>
                Its items leave the homes of the {countOf(data.matches.count, 'participation')} it covers. Work people already finished stays on their records. This can’t be
                undone.
              </p>
              {isProfileBasics ? (
                <p>
                  Profile basics carries the event’s welcome note and the profile items every speaker and sponsor contact gets. Without it, some of them may match no portal at
                  all.
                </p>
              ) : null}
              {confirmError ? (
                <p className="chq-error" role="alert">
                  {confirmError}
                </p>
              ) : null}
            </>
          }
          confirmLabel="Delete portal"
          weight="irreversible"
          confirmPhrase={data.portal.name}
          confirmNoun="portal name"
          pending={busy}
          onConfirm={() => void remove()}
          onCancel={() => {
            setConfirm(null);
            setConfirmError(null);
          }}
        />
      ) : null}

      {leaveOpen ? (
        <ConfirmDialog
          title={`Leave “${data.portal.name}” without saving?`}
          body="Your edits to this portal are not saved yet."
          confirmLabel="Leave"
          cancelLabel="Keep editing"
          onConfirm={() => {
            const action = pendingLeave.current;
            pendingLeave.current = null;
            setLeaveOpen(false);
            action?.();
          }}
          onCancel={() => {
            pendingLeave.current = null;
            setLeaveOpen(false);
          }}
        />
      ) : null}

      {toast ? (
        <div className="chq-toast" role="status">
          {toast}
          <button type="button" className="chq-btn chq-btn-tertiary" onClick={() => setToast(null)} aria-label="Dismiss">
            &times;
          </button>
        </div>
      ) : null}
    </div>
  );
}
