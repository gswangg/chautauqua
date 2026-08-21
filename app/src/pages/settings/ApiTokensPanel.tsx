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
//
// DEC-919 wave-156 amendment (task qb-settings-yourdata-read-drill): the 390
// READ drill (docs/design/Chautauqua Settings.dc.html:423, :426) draws a
// per-row boxed "Revoke" beside each token AND a filled 46px full-width
// "New token" primary below the list -- both were unreachable from the
// `readOnly` branch (it rendered a bare name/last-used list, no controls at
// all). Revoke fires the SAME `pendingDelete`/`confirmDelete` state and the
// SAME <ConfirmDialog/> the edit branch already owns (DEC-941: revocation is
// unrecoverable) -- never a second confirm. "New token" is an edit surface,
// not a direct act, so it writes `?section=your-data&edit=1` the same way
// SummarySection's own "Change" action does, landing on the edit branch's
// already-open create form. This component is only ever mounted inside
// YourDataPanel's "your-data" section (grep confirms the only call sites are
// there), so the section key is a plain literal here rather than a circular
// import of YourDataPanel's own local `SECTION_KEY` constant.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DelayedLoading } from '../../components/DelayedLoading';
import { apiList, apiPost, apiDelete, ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/dates';
import { copyText } from '../../lib/clipboard';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MAX_NAME_LENGTH } from '../../../../src/forms/validate';
import { DEC_896, DEC_919 } from '../../../../src/decisions';
import './settings-lists.css';

void DEC_896; // the section's own closing footer (Settings.dc.html:1164) is a SECTION register, distinct from YourDataPanel's head consequence
void DEC_919; // wave-155 amendment: the read drill gets its own "New token" render site (below), which opens the edit drill with intent=new already set
void DEC_919; // wave-156: the readOnly branch's per-row Revoke box and New-token primary render twice in the DOM, once on screen (phone-only CSS)

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

// DEC-919 wave-155 amendment: the read drill's own section key, matching
// YourDataPanel's SECTION_KEY -- this component has no access to that
// module-private constant, and the two must agree since the read-site
// button below writes the URL the edit-site mount reads.
const YOUR_DATA_SECTION_KEY = 'your-data';

export function ApiTokensPanel({ readOnly = false }: { readOnly?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
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
  // DEC-919 wave-155 amendment: the read-drill "New token" button (below)
  // opens the edit drill with `intent=new`; the edit-view mount below
  // reads that param once and focuses this field instead of leaving the
  // organiser to find it themselves.
  const nameInputRef = useRef<HTMLInputElement | null>(null);
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

  // DEC-919 wave-155 amendment: the read drill's "New token" button sets
  // `intent=new` before entering the edit drill (this component only
  // mounts un-readOnly once editing is true); consume it once by focusing
  // the name field, then drop the param so returning to this URL later
  // (e.g. via Back) doesn't re-steal focus.
  useEffect(() => {
    if (readOnly) return;
    if (searchParams.get('intent') !== 'new') return;
    nameInputRef.current?.focus();
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete('intent');
        return params;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

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
    // DEC-919 wave-155/156 amendment: a read view has no create form to
    // submit, so the read-drill primary ENTERS the edit drill with the act
    // already armed -- `intent=new` is consumed by the mount-time effect
    // above, which focuses the name field rather than leaving the organiser
    // to find it.
    function openCreateDrill() {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.set('section', YOUR_DATA_SECTION_KEY);
        params.set('edit', '1');
        params.set('intent', 'new');
        return params;
      });
    }

    return (
      <>
        {error && <div className="chq-error" role="alert">{error}</div>}
        {loading ? (
          <DelayedLoading />
        ) : (
          <ul className="chq-settings-summary-list">
            {tokens.map((t) => (
              <li key={t.id} className="chq-settings-summary-row">
                {/* docs/design/Chautauqua Settings.dc.html:423 `border:1px
                    solid #BAB6A6; border-radius:6px; background:#EFEBDF;
                    min-height:44px; display:flex; align-items:center;
                    padding:0 14px; font-size:13px; font-weight:600` -- the
                    boxed per-row action beside a name-over-detail stack,
                    phone-only (chq-settings-summary-row-info/-action,
                    settings-lists.css). */}
                <span className="chq-settings-summary-row-info">
                  <span className="chq-settings-summary-row-primary">{t.name}</span>
                  <span className="chq-settings-summary-row-detail">Last used: {formatDate(t.lastUsedAt)}</span>
                </span>
                <button
                  type="button"
                  className="chq-settings-summary-row-action"
                  onClick={() => setPendingDelete(t)}
                >
                  Revoke
                </button>
              </li>
            ))}
            {tokens.length === 0 ? <li className="chq-settings-summary-empty">No API tokens yet.</li> : null}
          </ul>
        )}

        {/* docs/design/Chautauqua Settings.dc.html:426 -- the filled 46px
            full-width "New token" primary below the token list, phone-only
            (.chq-settings-phone-action, settings-lists.css). An edit
            surface, not a direct act: it enters the section's edit drill
            (see openCreateDrill above), which renders the create form open
            at its top with the name field focused. */}
        <button type="button" className="chq-settings-phone-action" onClick={openCreateDrill}>
          New token
        </button>

        {/* The read drill's per-row Revoke fires the SAME pendingDelete
            state as the edit view, so it needs the dialog rendered on this
            branch too -- without it read-mode Revoke sets state nothing
            draws. */}
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
      </>
    );
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

      {/* G13 fix (B10, frames 09--04/09--16): never a full-width olive bar
          -- the name field keeps the ~320 name width and the primary sits
          at its natural width, not stretched across the 820 measure. */}
      <form onSubmit={handleCreate} className="chq-settings-token-create">
        <label htmlFor="api-token-name">Token name</label>
        <input
          id="api-token-name"
          ref={nameInputRef}
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

      {/* DEC-896 (wave-134 amendment): the API-tokens section's own closing
          footer (docs/design/Chautauqua Settings.dc.html:1164) -- a
          SECTION-scoped register, distinct from YourDataPanel's head
          consequence line (DEC-781/DEC-896 wave-133). Verbatim, real em
          dash. */}
      <p className="chq-settings-edit-section-note">
        A token's secret is shown once, when it is created — after that only the prefix. Revoking takes effect
        immediately and cannot be undone.
      </p>

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
