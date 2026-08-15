import './send-failures.css';

export interface SendFailure {
  email: string;
  message: string;
}

/** DEC-664 (wave 59 amendment): the ONE send-failure reporter. Every send
 * route (comms/send, contacts/bulk-email, content-notes, portal-invites)
 * computes a per-recipient reason, not just an address -- this renders
 * that reason on every failure surface rather than a bare `<li>{email}</li>`
 * that discards it. When a recipient has no address at all (the
 * portal-invite synthetic `{email: '', message: '<Name> has no email
 * address on file'}`), the message renders alone -- never an empty
 * bullet in front of it. */
export function SendFailures({ failed }: { failed: SendFailure[] }) {
  if (failed.length === 0) return null;
  return (
    <div className="chq-send-failures">
      {failed.map((f, i) => (
        <div
          key={f.email || `${i}-${f.message}`}
          className={`chq-send-failure-row${f.email === '' ? ' chq-send-failure-row--no-address' : ''}`}
        >
          {f.email !== '' && <span className="chq-send-failure-name">{f.email}</span>}
          <span className="chq-send-failure-meta">{f.message}</span>
        </div>
      ))}
    </div>
  );
}
