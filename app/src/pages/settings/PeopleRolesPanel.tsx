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
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiList, apiPatch, apiPost, ApiError } from '../../lib/api';
import { useMe } from '../../lib/useMe';
import { SummarySection } from './SummarySection';

const SECTION_KEY = 'people';

interface OrgUser {
  id: string;
  email: string;
  role: string;
}

type Role = 'organizer' | 'reviewer';

export function PeopleRolesPanel() {
  const { me } = useMe();
  const [searchParams] = useSearchParams();
  const editing = searchParams.get('section') === SECTION_KEY && searchParams.get('edit') === '1';
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [inviting, setInviting] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>('reviewer');
  const [creating, setCreating] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<{ email: string; password: string } | null>(null);

  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const [roleEditId, setRoleEditId] = useState<string | null>(null);
  const [roleEditValue, setRoleEditValue] = useState<Role>('reviewer');
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleErrors, setRoleErrors] = useState<Record<string, string>>({});

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

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (newEmail.trim().length === 0) return;
    setCreating(true);
    setError(null);
    setFieldErrors({});
    try {
      const res = await apiPost<{ email: string; password: string }>('/users', {
        email: newEmail.trim(),
        role: newRole,
      });
      setRevealedPassword({ email: res.email, password: res.password });
      setNewEmail('');
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

  async function handleRoleSave(user: OrgUser) {
    setRoleSaving(true);
    setRoleErrors((prev) => ({ ...prev, [user.id]: '' }));
    try {
      await apiPatch<{ id: string; email: string; role: string }>(`/users/${user.id}`, { role: roleEditValue });
      setRoleEditId(null);
      await load();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to change role';
      setRoleErrors((prev) => ({ ...prev, [user.id]: message }));
    } finally {
      setRoleSaving(false);
    }
  }

  const organizerCount = users.filter((u) => u.role === 'organizer').length;
  const reviewerCount = users.filter((u) => u.role !== 'organizer').length;

  const rows = [
    { label: 'People', value: loading ? <DelayedLoading /> : `${total} ${total === 1 ? 'person' : 'people'}` },
    { label: 'Organizers', value: loading ? <DelayedLoading /> : `${organizerCount}` },
    // DEC-896: a real hint, not a decorative one -- plan_reviewer rows can
    // scope a reviewer to specific tracks (DEC-824, src/routes/review/
    // plans-distribute.ts), so "N reviewers" alone hides that some of them
    // may only ever see a subset of tracks.
    {
      label: 'Reviewers',
      value: loading ? <DelayedLoading /> : `${reviewerCount}`,
      hint: 'Can be scoped to specific tracks in review assignment',
    },
  ];

  return (
    <SummarySection sectionKey={SECTION_KEY} label="People and roles" rows={rows} actionLabel="Change" editing={editing}>
      <div className="chq-settings-section-head">
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
        <form onSubmit={handleInvite} className="chq-settings-row">
          <label htmlFor="people-invite-email">
            Email
            <input
              id="people-invite-email"
              className="chq-input"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
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
          <button type="submit" className="chq-btn chq-btn-primary" disabled={creating || newEmail.trim().length === 0}>
            {creating ? 'Inviting…' : 'Send invite'}
          </button>
        </form>
      )}

      {loading ? (
        <DelayedLoading />
      ) : users.length === 0 ? (
        <p>No people yet.</p>
      ) : (
        <>
          <ul className="chq-settings-people-list">
            {users.map((user) => {
              const isSelf = me?.userId === user.id;
              return (
                <li key={user.id} className="chq-settings-people-row">
                  <div className="chq-settings-people-identity">
                    <span>{user.email}</span>
                  </div>
                  <span className="chq-settings-people-role">{user.role}</span>
                  <span className="chq-settings-people-scope" data-testid="people-scope">
                    All events in this org
                  </span>
                  <div className="chq-settings-people-actions">
                    {roleEditId === user.id ? (
                      <span className="chq-settings-people-confirm">
                        <select
                          className="chq-select"
                          aria-label={`New role for ${user.email}`}
                          value={roleEditValue}
                          onChange={(e) => setRoleEditValue(e.target.value as Role)}
                        >
                          <option value="reviewer">Reviewer</option>
                          <option value="organizer">Organizer</option>
                        </select>
                        <button
                          type="button"
                          className="chq-btn chq-btn-primary"
                          disabled={roleSaving}
                          onClick={() => void handleRoleSave(user)}
                        >
                          {roleSaving ? 'Saving…' : 'Save role'}
                        </button>
                        <button
                          type="button"
                          className="chq-btn chq-btn-secondary"
                          onClick={() => {
                            setRoleEditId(null);
                            setRoleErrors((prev) => ({ ...prev, [user.id]: '' }));
                          }}
                        >
                          Cancel
                        </button>
                        {roleErrors[user.id] ? (
                          <span role="alert" className="chq-error">
                            {roleErrors[user.id]}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="chq-link-button"
                        onClick={() => {
                          setRoleEditId(user.id);
                          setRoleEditValue(user.role === 'organizer' ? 'organizer' : 'reviewer');
                        }}
                      >
                        Change
                      </button>
                    )}
                    {isSelf ? (
                      <span>(you)</span>
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
          <p className="chq-settings-people-total">
            Showing {users.length} of {total}
          </p>
        </>
      )}
    </SummarySection>
  );
}
