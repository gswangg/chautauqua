// People and roles settings panel (w2-i, DEC-588 Tier 2 item 13):
// organizer-only user directory. Uses the landed w2-e /api/v1/users
// endpoints -- list, invite (returns a one-time password shown exactly
// once, same reveal-once treatment as ApiTokensPanel) and reset-password
// (behind a confirm step). Zero new server endpoints.
//
// w15-e/DEC-691: each row also renders a Scope cell -- users are org-scoped
// (src/routes/api/users.ts:56 lists by auth.orgId with no per-event row),
// so every row's honest scope is "All events in this org", not a
// fabricated per-row value.
//
// DEC-778: "Change" is a real inline role control -- PATCH /api/v1/users/:id.
// The server refuses (409) a self-service role change and demoting the
// org's last organizer; that message surfaces inline on the row rather than
// the panel-wide error banner, since it's specific to the row being edited.
//
// SummarySection adoption (w6-e, DEC-815): the landing view is a read-only
// summary -- people/organizer/reviewer counts -- with the whole directory
// (invite, per-row role change, reset password) behind the section's
// 'Change' drill (?section=people&edit=1, DEC-728/DEC-710).
//
// w1-f, DEC-785: a count is not a row -- the read view now lists the real
// rows (name + role, one per person) instead of a count-only summary. The
// interactive directory (invite, per-row role change, reset password, scope
// cell) still lives entirely behind 'Change'.
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiList, apiPatch, apiPost, ApiError } from '../../lib/api';
import { useMe } from '../../lib/useMe';
import { SummarySection } from './SummarySection';
import { SettingsEditForm } from './SettingsEditForm';
import { capitalizeFirst } from '../../lib/plural';
import { MAX_EMAIL_LENGTH } from '../../lib/domain-caps';

const SECTION_KEY = 'people';

interface OrgUser {
  id: string;
  email: string;
  role: string;
  // w35-e/DEC-757: optional so a pre-w35-c payload (no name field) still
  // reads correctly -- rows fall back to email when absent/blank.
  name?: string;
}

// w35-e/DEC-757: a teammate account is a named person -- name leads, email
// is the quiet secondary. A pre-w35-c row (no name, or a blank one) still
// reads correctly via the email fallback.
function personLabel(user: OrgUser): string {
  return user.name && user.name.trim() ? user.name.trim() : user.email;
}

type Role = 'organizer' | 'reviewer';

export function PeopleRolesPanel() {
  const { me } = useMe();
  const [searchParams, setSearchParams] = useSearchParams();
  const editing = searchParams.get('section') === SECTION_KEY && searchParams.get('edit') === '1';
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [inviting, setInviting] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newRole, setNewRole] = useState<Role>('reviewer');
  const [creating, setCreating] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<{ email: string; password: string } | null>(null);

  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const [roleSavingId, setRoleSavingId] = useState<string | null>(null);
  const [roleErrors, setRoleErrors] = useState<Record<string, string>>({});

  function closeEdit() {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.delete('section');
      params.delete('edit');
      return params;
    });
  }

  function load() {
    setLoading(true);
    setError(null);
    return apiList<OrgUser>('/users')
      .then((res) => {
        setUsers(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load people'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleInvite(e?: FormEvent) {
    e?.preventDefault();
    if (newEmail.trim().length === 0 || newFirstName.trim().length === 0 || newLastName.trim().length === 0) return;
    setCreating(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await apiPost<{ email: string; password: string }>('/users', {
        email: newEmail.trim(),
        role: newRole,
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
      });
      setRevealedPassword({ email: res.email, password: res.password });
      setNewEmail('');
      setNewFirstName('');
      setNewLastName('');
      setNewRole('reviewer');
      setInviting(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setFieldErrors(err.fields);
      }
      setError(err instanceof ApiError ? err.message : 'Failed to invite');
    } finally {
      setCreating(false);
    }
  }

  async function handleResetConfirm(user: OrgUser) {
    setResetting(true);
    setError(null);
    try {
      const res = await apiPost<{ email: string; password: string }>(`/users/${user.id}/reset-password`);
      setRevealedPassword({ email: res.email, password: res.password });
      setResetTargetId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  }

  // DEC-691 amendment (findings wave 5): the ROLE cell IS the select at
  // rest, so a change commits immediately -- write the row optimistically,
  // then PATCH; a failure (409 self-demotion / last-organizer refusal, or
  // any other server rejection) rolls the row back to its prior role and
  // surfaces the reason inline on the row rather than silently keeping the
  // optimistic (wrong) value on screen.
  async function handleRoleChange(user: OrgUser, nextRole: Role) {
    const previousRole = user.role;
    setRoleSavingId(user.id);
    setRoleErrors((prev) => ({ ...prev, [user.id]: '' }));
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: nextRole } : u)));
    try {
      await apiPatch<{ id: string; email: string; role: string }>(`/users/${user.id}`, { role: nextRole });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to change role';
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: previousRole } : u)));
      setRoleErrors((prev) => ({ ...prev, [user.id]: message }));
    } finally {
      setRoleSavingId(null);
    }
  }

  // DEC-910: a role is reported as itself -- never a hand-written
  // complementary predicate that could silently absorb a third role (e.g. a
  // speaker with a portal account) into "reviewer".
  const ROLE_LABELS: Record<string, string> = { organizer: 'Organizer', reviewer: 'Reviewer' };
  function roleLabel(role: string): string {
    const known = ROLE_LABELS[role];
    if (known) return known;
    return capitalizeFirst(role);
  }

  // w1-f, DEC-785: the read view is the real per-person rows (name + role),
  // not a count.
  const rows = loading
    ? [{ label: 'People', value: <DelayedLoading /> }]
    : users.length === 0
      ? [{ label: 'People', value: 'No people yet.' }]
      : users.map((user) => ({
          label: personLabel(user),
          value: roleLabel(user.role),
          // DEC-896: a real hint, not a decorative one -- a reviewer row can
          // be scoped to specific tracks (DEC-824, src/routes/review/
          // plans-distribute.ts), so the bare role alone hides that.
          ...(user.role === 'reviewer' ? { hint: 'Can be scoped to specific tracks in review assignment' } : {}),
        }));

  return (
    <SummarySection sectionKey={SECTION_KEY} label="People and roles" rows={rows} actionLabel="Change" editing={editing}>
      <SettingsEditForm
        onSubmit={(e) => e.preventDefault()}
        consequence="You cannot remove or demote yourself. A reviewer's scope limits which tracks they are assigned."
        footer={{
          primary: (
            <button type="button" className="chq-btn chq-btn-primary" onClick={closeEdit}>
              Close
            </button>
          ),
        }}
      >
      <div className="chq-settings-section-head">
        <h2>People &middot; {users.length}</h2>
        <button
          type="button"
          className="chq-settings-section-action chq-link-button"
          onClick={() => setInviting((v) => !v)}
        >
          Invite someone
        </button>
      </div>

      {error && <div className="chq-error" role="alert">{error}</div>}

      {revealedPassword && (
        <div className="chq-token-reveal" role="alert">
          <strong>
            One-time password for {revealedPassword.email} — copy it now, it will not be shown again:
          </strong>
          <code>{revealedPassword.password}</code>
          <button
            type="button"
            className="chq-btn chq-btn-secondary"
            onClick={() => setRevealedPassword(null)}
          >
            Done
          </button>
        </div>
      )}

      {inviting && (
        // A plain div, not a nested <form> -- the whole edit view is already
        // inside SettingsEditForm's own <form> (DEC-896/B10), and nested
        // <form> elements are invalid HTML.
        <div className="chq-settings-row">
          <label htmlFor="people-invite-first-name">
            First name
            <input
              id="people-invite-first-name"
              className="chq-input"
              type="text"
              required
              value={newFirstName}
              onChange={(e) => setNewFirstName(e.target.value)}
            />
          </label>
          {fieldErrors.firstName ? <span role="alert">{fieldErrors.firstName}</span> : null}
          <label htmlFor="people-invite-last-name">
            Last name
            <input
              id="people-invite-last-name"
              className="chq-input"
              type="text"
              required
              value={newLastName}
              onChange={(e) => setNewLastName(e.target.value)}
            />
          </label>
          {fieldErrors.lastName ? <span role="alert">{fieldErrors.lastName}</span> : null}
          <label htmlFor="people-invite-email">
            Email
            <input
              id="people-invite-email"
              className="chq-input"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              maxLength={MAX_EMAIL_LENGTH}
            />
          </label>
          {fieldErrors.email ? <span role="alert">{fieldErrors.email}</span> : null}
          <label htmlFor="people-invite-role">
            Role
            <select
              id="people-invite-role"
              className="chq-select"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as Role)}
            >
              <option value="reviewer">Reviewer</option>
              <option value="organizer">Organizer</option>
            </select>
          </label>
          {fieldErrors.role ? <span role="alert">{fieldErrors.role}</span> : null}
          <button
            type="button"
            className="chq-btn chq-btn-primary"
            onClick={() => void handleInvite()}
            disabled={
              creating ||
              newEmail.trim().length === 0 ||
              newFirstName.trim().length === 0 ||
              newLastName.trim().length === 0
            }
          >
            {creating ? 'Inviting…' : 'Send invite'}
          </button>
        </div>
      )}

      {loading ? (
        <DelayedLoading />
      ) : users.length === 0 ? (
        <p>No people yet.</p>
      ) : (
        <>
          <div role="table" aria-label="People and roles">
            <div className="chq-settings-people-header-row" role="row">
              <span role="columnheader">Person</span>
              <span role="columnheader">Role</span>
              <span role="columnheader">Scope</span>
              <span role="columnheader" aria-hidden="true" />
            </div>
            <ul className="chq-settings-people-list" role="rowgroup">
              {users.map((user) => {
                const isSelf = me?.userId === user.id;
                const label = personLabel(user);
                const hasName = Boolean(user.name && user.name.trim());
                return (
                  <li key={user.id} className="chq-settings-people-row" role="row">
                    <div className="chq-settings-people-identity" role="cell">
                      <span className="chq-settings-people-name">{label}</span>
                      {hasName && <span className="chq-settings-people-email">{user.email}</span>}
                    </div>
                    <span className="chq-settings-people-role-cell" role="cell">
                      <select
                        className="chq-select chq-settings-people-role"
                        aria-label={`Role for ${user.email}`}
                        value={user.role === 'organizer' ? 'organizer' : 'reviewer'}
                        disabled={isSelf || roleSavingId === user.id}
                        title={isSelf ? 'You cannot remove or demote yourself' : undefined}
                        onChange={(e) => void handleRoleChange(user, e.target.value as Role)}
                      >
                        <option value="reviewer">Reviewer</option>
                        <option value="organizer">Organizer</option>
                      </select>
                      {roleErrors[user.id] ? (
                        <span role="alert" className="chq-error">
                          {roleErrors[user.id]}
                        </span>
                      ) : null}
                    </span>
                    <span className="chq-settings-people-scope" role="cell" data-testid="people-scope">
                      All events in this org
                    </span>
                    <div className="chq-settings-people-actions" role="cell">
                      {isSelf ? (
                        // User-filed (gate-9): the in-row guard sentence made
                        // this cell double-wide and broke the row grid; the
                        // screen's consequence line and the disabled select's
                        // title carry the rule — the row keeps one action.
                        <a className="chq-link-button" href="/account/password">
                          Change password
                        </a>
                      ) : resetTargetId === user.id ? (
                        <span className="chq-settings-people-confirm">
                          Reset {user.email}&apos;s password?
                          <button
                            type="button"
                            className="chq-btn chq-btn-primary"
                            disabled={resetting}
                            onClick={() => void handleResetConfirm(user)}
                          >
                            {resetting ? 'Resetting…' : 'Confirm reset'}
                          </button>
                          <button type="button" className="chq-btn chq-btn-secondary" onClick={() => setResetTargetId(null)}>
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button type="button" className="chq-link-button" onClick={() => setResetTargetId(user.id)}>
                          Reset password
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="chq-settings-people-total">
            Showing {users.length} of {total}
          </p>
        </>
      )}
      </SettingsEditForm>
    </SummarySection>
  );
}
