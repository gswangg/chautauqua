// People and roles settings panel (w2-i, DEC-588 Tier 2 item 13):
// organizer-only user directory. Uses the landed w2-e /api/v1/users
// endpoints -- list, invite (returns a one-time password shown exactly
// once, same reveal-once treatment as ApiTokensPanel) and reset-password
// (behind a confirm step). Zero new server endpoints.
import { useEffect, useState, type FormEvent } from 'react';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiList, apiPost, ApiError } from '../../lib/api';
import { useMe } from '../../lib/useMe';

interface OrgUser {
  id: string;
  email: string;
  role: string;
}

type Role = 'organizer' | 'reviewer';

export function PeopleRolesPanel() {
  const { me } = useMe();
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

  return (
    <section className="chq-settings-panel chq-settings-numbered" aria-label="People and roles">
      <div className="chq-settings-section-head">
        <h2>People and roles</h2>
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
                <li key={user.id}>
                  <div className="chq-settings-row-value">
                    <span>{user.email}</span>
                    <span className="chq-settings-people-role">{user.role}</span>
                  </div>
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
                </li>
              );
            })}
          </ul>
          <p className="chq-settings-people-total">
            Showing {users.length} of {total}
          </p>
        </>
      )}
    </section>
  );
}
