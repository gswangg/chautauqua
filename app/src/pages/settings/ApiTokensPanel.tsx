// DEC-032 Settings panel: list/create/delete DEC-027 bearer API tokens.
// The plaintext token is only ever returned once, at creation time.
import { useEffect, useState, type FormEvent } from 'react';
import { apiList, apiPost, apiDelete, ApiError } from '../../lib/api';

interface ApiTokenItem {
  id: string;
  name: string;
  tokenPrefix: string;
  lastUsedAt: number | null;
}

function formatDate(ms: number | null): string {
  if (ms === null) return 'Never';
  return new Date(ms).toLocaleString();
}

export function ApiTokensPanel() {
  const [tokens, setTokens] = useState<ApiTokenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    return apiList<ApiTokenItem>('/tokens')
      .then((res) => setTokens(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load API tokens'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (newName.trim().length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const res = await apiPost<{ token: string }>('/tokens', { name: newName.trim() });
      setRevealedToken(res.token);
      setNewName('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create API token');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await apiDelete(`/tokens/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete API token');
    }
  }

  return (
    <section className="chq-panel" aria-label="API tokens">
      <h2>API Tokens</h2>
      <p>Bearer tokens authenticate scripts/integrations against the same /api/v1 the app uses.</p>

      {error && <div className="chq-error" role="alert">{error}</div>}

      {revealedToken && (
        <div className="chq-token-reveal" role="alert">
          <strong>Copy this token now — it will not be shown again:</strong>
          <code>{revealedToken}</code>
          <button type="button" onClick={() => setRevealedToken(null)}>
            Done
          </button>
        </div>
      )}

      <form onSubmit={handleCreate}>
        <label htmlFor="api-token-name">Token name</label>
        <input
          id="api-token-name"
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="e.g. CI pipeline"
        />
        <button type="submit" disabled={creating || newName.trim().length === 0}>
          {creating ? 'Creating…' : 'Create token'}
        </button>
      </form>

      {loading ? (
        <p>Loading…</p>
      ) : tokens.length === 0 ? (
        <p>No API tokens yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Token</th>
              <th>Last used</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>
                  <code>{t.tokenPrefix}…</code>
                </td>
                <td>{formatDate(t.lastUsedAt)}</td>
                <td>
                  <button type="button" onClick={() => handleDelete(t.id)}>
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
