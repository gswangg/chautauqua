// DEC-032 Settings panel: list/create/delete DEC-027 bearer API tokens.
// The plaintext token is only ever returned once, at creation time.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiList, apiPost, apiDelete, ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/dates';
import { copyText } from '../../lib/clipboard';
import { ConfirmDialog } from '../../components/ConfirmDialog';

interface ApiTokenItem {
  id: string;
  name: string;
  tokenPrefix: string;
  lastUsedAt: number | null;
}

function formatDate(ms: number | null): string {
  if (ms === null) return 'Never';
  return formatDateTime(ms);
}

export function ApiTokensPanel() {
  const [tokens, setTokens] = useState<ApiTokenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copyResult, setCopyResult] = useState<{ ok: boolean; text: string } | null>(null);
  const failedCopyRef = useRef<HTMLInputElement | null>(null);
  // DEC-941: token revocation is unrecoverable (the plaintext is never shown
  // again), so it's gated behind the shared ConfirmDialog rather than firing
  // straight from the row's Revoke link.
  const [pendingDelete, setPendingDelete] = useState<ApiTokenItem | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function handleCopyToken() {
    if (!revealedToken) return;
    const ok = await copyText(revealedToken);
    setCopyResult({ ok, text: revealedToken });
    if (ok) {
      window.setTimeout(() => setCopyResult(null), 2000);
    }
  }

  useEffect(() => {
    if (copyResult && !copyResult.ok) {
      failedCopyRef.current?.focus();
      failedCopyRef.current?.select();
    }
  }, [copyResult]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setError(null);
    setDeleting(true);
    try {
      await apiDelete(`/tokens/${pendingDelete.id}`);
      setPendingDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete API token');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="chq-settings-panel" aria-label="API tokens">
      <h2>API Tokens</h2>
      <p>Bearer tokens authenticate scripts/integrations against the same /api/v1 the app uses.</p>

      {error && <div className="chq-error" role="alert">{error}</div>}

      {revealedToken && (
        <div className="chq-token-reveal" role="alert">
          <strong>Copy this token now — it will not be shown again:</strong>
          <code>{revealedToken}</code>
          <button type="button" className="chq-btn chq-btn-secondary" onClick={() => void handleCopyToken()}>
            {copyResult?.ok ? 'Copied!' : 'Copy'}
          </button>
          <button
            type="button"
            className="chq-btn chq-btn-secondary"
            onClick={() => {
              setRevealedToken(null);
              setCopyResult(null);
            }}
          >
            Done
          </button>
          <div role="status" aria-live="polite" className="chq-copy-status">
            {copyResult ? (copyResult.ok ? 'Copied' : 'Copy failed — select the text and copy it manually') : null}
          </div>
          {copyResult && !copyResult.ok ? (
            <input
              ref={failedCopyRef}
              className="chq-input"
              readOnly
              value={copyResult.text}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="API token to copy manually"
            />
          ) : null}
        </div>
      )}

      <form onSubmit={handleCreate}>
        <label htmlFor="api-token-name">Token name</label>
        <input
          id="api-token-name"
          className="chq-input"
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="e.g. CI pipeline"
        />
        <button type="submit" className="chq-btn chq-btn-primary" disabled={creating || newName.trim().length === 0}>
          {creating ? 'Creating…' : 'New token'}
        </button>
      </form>

      {loading ? (
        <DelayedLoading />
      ) : tokens.length === 0 ? (
        <p>No API tokens yet.</p>
      ) : (
        <table className="chq-table chq-settings-tokens-table">
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
                <td data-label="Token">
                  <code>{t.tokenPrefix}…</code>
                </td>
                <td data-label="Last used">{formatDate(t.lastUsedAt)}</td>
                <td>
                  <button type="button" className="chq-link-button" onClick={() => setPendingDelete(t)}>
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Revoke this token?"
          body={`Any script or embed still using ${pendingDelete.name} stops working immediately. This cannot be undone.`}
          confirmLabel="Revoke"
          destructive
          pending={deleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </section>
  );
}
