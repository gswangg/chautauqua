// DEC-032 Settings panel: list/create/delete DEC-027 bearer API tokens.
// The plaintext token is only ever returned once, at creation time.
//
// DEC-815 amendment (wave 4): YourDataPanel's own SummarySection row needs
// the real token rows, not a describing sentence. `readOnly` makes this
// same component serve both: the row-level `readOnly` render is the plain
// list with no controls at all (no create/revoke); the default (unset)
// render is the full create/revoke surface reachable directly, with no
// local drill-inside-the-drill.
//
// DEC-785 amendment (wave 66): the local summary/edit split ('Change' /
// 'Back', `showEditor` state) is REMOVED. This panel is only ever mounted
// inside its caller's own edit drill (YourDataPanel's `edit=1` branch), so
// a second nested drill just to reach Revoke was drill-inside-a-drill --
// the caller already gated entry. The default (unset) render is now always
// the full editing surface.
//
// DEC-027 amendment (wave 47): GET /tokens now carries createdAt too. Only
// the full edit-view table grows a Created column -- the readOnly summary
// stays name + last-used per the ruling above.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiList, apiPost, apiDelete, ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/dates';
import { copyText } from '../../lib/clipboard';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MAX_NAME_LENGTH } from '../../../../src/forms/validate';
import './settings-lists.css';

interface ApiTokenItem {
  id: string;
  name: string;
  tokenPrefix: string;
  lastUsedAt: number | null;
  createdAt: number;
}

function formatDate(ms: number | null): string {
  if (ms === null) return 'Never';
  return formatDateTime(ms);
}

export function ApiTokensPanel({ readOnly = false }: { readOnly?: boolean }) {
  const [tokens, setTokens] = useState<ApiTokenItem[]>([]);
  // DEC-027 wave-51 amendment: the org-scoped bound on the bearer-token
  // population, rendered beside the create control. null until the list
  // loads (the envelope always carries it, but nothing renders before then).
  const [max, setMax] = useState<number | null>(null);
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
      .then((res) => {
        setTokens(res.items);
        if (res.max !== undefined) setMax(res.max);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load API tokens'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e?: FormEvent) {
    e?.preventDefault();
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

  if (readOnly) {
    return (
      <>
        {error && <div className="chq-error" role="alert">{error}</div>}
        {loading ? (
          <DelayedLoading />
        ) : (
          <ul className="chq-settings-summary-list">
            {tokens.map((t) => (
              <li key={t.id} className="chq-settings-summary-row">
                <span className="chq-settings-summary-row-primary">{t.name}</span>
                <span className="chq-settings-summary-row-detail">Last used: {formatDate(t.lastUsedAt)}</span>
              </li>
            ))}
            {tokens.length === 0 ? <li className="chq-settings-summary-empty">No API tokens yet.</li> : null}
          </ul>
        )}
      </>
    );
  }

  return (
    <section className="chq-settings-panel" aria-label="API tokens">
      <h2>API Tokens</h2>
      <p>Bearer tokens authenticate scripts/integrations against the same /api/v1 the app uses.</p>
      <p>The token is shown once, when you create it.</p>
      <p>Revoking takes effect immediately and cannot be undone.</p>

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

      {/* G13 fix (B10, frames 09--04/09--16): never a full-width olive bar
          -- the name field keeps the ~320 name width and the primary sits
          at its natural width, not stretched across the 820 measure. */}
      <form onSubmit={handleCreate} className="chq-settings-token-create">
        <label htmlFor="api-token-name">Token name</label>
        <input
          id="api-token-name"
          className="chq-input"
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="e.g. CI pipeline"
          maxLength={MAX_NAME_LENGTH}
        />
        <button type="submit" className="chq-btn chq-btn-primary" disabled={creating || newName.trim().length === 0}>
          {creating ? 'Creating…' : 'New token'}
        </button>
        {max !== null && (
          <span className="chq-settings-row-note">
            {tokens.length} of {max} used
          </span>
        )}
      </form>

      {loading ? (
        <DelayedLoading />
      ) : tokens.length === 0 ? (
        <p>No API tokens yet.</p>
      ) : (
        <table className="chq-table chq-settings-tokens-table">
          <thead>
            <tr>
              {/* No class hook: under table-layout:fixed this is the SOLE
                  unwidthed remainder column (DEC-902 wave-22), so it needs no
                  width rule -- and a className with no CSS rule behind it is
                  exactly what DEC-976/DEC-379 forbid. */}
              <th>Name and prefix</th>
              <th className="chq-settings-tokens-col-created">Created</th>
              <th className="chq-settings-tokens-col-last-used">Last used</th>
              <th className="chq-settings-tokens-col-actions">Revoke</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.id}>
                <td data-label="Name and prefix">
                  <div className="chq-settings-tokens-name-cell">
                    <span>{t.name}</span>
                    <code>{t.tokenPrefix}…</code>
                  </div>
                </td>
                <td data-label="Created">{formatDateTime(t.createdAt)}</td>
                <td data-label="Last used">
                  {t.lastUsedAt === null ? (
                    <span className="chq-settings-row-note">NEVER USED</span>
                  ) : (
                    formatDate(t.lastUsedAt)
                  )}
                </td>
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

      {/* DEC-919 wave-99 amendment (task v12m-w2-a): the drill frame draws
          "New token" a second time as a filled 46px full-width primary
          below the API tokens list at phone (docs/design/Chautauqua
          Settings.dc.html:426) -- the form's own submit button above stays
          the correct desktop rendering (hidden at phone via
          settings-lists.css); this sibling submits the SAME form. */}
      <button
        type="button"
        className="chq-settings-phone-action"
        disabled={creating || newName.trim().length === 0}
        onClick={() => void handleCreate()}
      >
        New token
      </button>

      {pendingDelete && (
        <ConfirmDialog
          title="Revoke this token?"
          body={`Any script or embed still using ${pendingDelete.name} stops working immediately. This cannot be undone.`}
          confirmLabel="Revoke"
          pending={deleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </section>
  );
}
