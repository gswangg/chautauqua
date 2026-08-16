// DEC-652: Overview §04 — Unplaced sessions and conflicts. Owns the
// concrete "Place at 11:30" / "Move DFC-047 to 11:30" actions the mock
// shows (Chautauqua Overview.dc.html:134-165): a suggestion/resolution the
// server computed (src/server/repo/overview.ts, DEC-652) is a real
// `<button>` that PUTs the slot endpoint, optimistic with loud rollback via
// a full refetch on failure — mirrors Overview.tsx's handleContentAction
// shape. When the server found no free slot, the row keeps the existing
// `Place it` link to /agenda — the UI never invents a time.
import { Link } from 'react-router-dom';
import { apiPut, ApiError } from '../../lib/api';
import { formatDayLabel } from '../../lib/dates';
import { conflictKindLabel } from '../../lib/schedule-vocabulary';
import { joinSegments } from './rows';
import { plural } from '../../lib/plural';
import { publicRoomLabel } from '../../lib/room-label';
import type { OverviewPayload } from './types';
// DEC-908 (wave-9 amendment): the ONE session-shape display vocabulary --
// format's trailing-parenthetical reshaping ('Talk (30 min)' -> 'Talk, 30
// min').
import { sessionFormatLabel } from '../../../../src/lib/session-vocabulary';
// DEC-900 amendment (wave 60): minutes-from-midnight -> zero-padded HH:MM
// clock time via the single owner. A conflict's day/startMin are already
// event-local at the schema level (schedule_slot), so no timezone
// conversion happens here.
import { clockHHMM } from '../../lib/clock';

// DEC-877: §04's overflow — unplaced rows and conflict rows the payload
// truncated (server total exceeds the rows actually sent) — collapsed into
// ONE below-the-list summary sentence, joined through the page's one
// joinSegments so a section with only one kind of overflow never leaves a
// dangling separator.
function agendaOverflowLine(payload: OverviewPayload): string {
  const extraUnplaced = payload.agendaWork.unplacedTotal - payload.agendaWork.unplaced.length;
  const extraConflicts = payload.agendaWork.conflictTotal - payload.agendaWork.conflicts.length;
  return joinSegments([
    extraUnplaced > 0 ? `${extraUnplaced} more unplaced` : null,
    extraConflicts > 0 ? `${extraConflicts} more ${plural(extraConflicts, 'conflict')}` : null,
  ]);
}

interface AgendaWorkSectionProps {
  payload: OverviewPayload;
  setPayload: (payload: OverviewPayload) => void;
  setError: (message: string | null) => void;
  refetch: () => Promise<void>;
}

export function AgendaWorkSection({ payload, setPayload, setError, refetch }: AgendaWorkSectionProps) {
  function describeApiError(err: unknown, fallback: string): string {
    return err instanceof ApiError ? `${fallback}: ${err.message}` : fallback;
  }

  async function placeSlot(
    submissionId: string,
    slot: { day: string; startMin: number; roomId: string },
    durationMin: number,
    onOptimisticRemove: (p: OverviewPayload) => OverviewPayload,
  ) {
    setPayload(onOptimisticRemove(payload));
    setError(null);
    try {
      await apiPut(`/submissions/${submissionId}/slot`, {
        day: slot.day,
        startMin: slot.startMin,
        endMin: slot.startMin + durationMin,
        roomId: slot.roomId,
      });
    } catch (err) {
      setError(describeApiError(err, 'Could not place the session'));
      // DEC-652: loud rollback — a failed write may have left the server
      // state ahead of or behind the optimistic guess, so a full refetch
      // (not a snapshot restore) is the only truthful recovery.
      await refetch();
    }
  }

  return (
    <section className="chq-overview-section">
      <div className="chq-overview-section-header">
        <span className="chq-overview-section-label">04 — Unplaced sessions and conflicts</span>
        <Link to="/agenda" className="chq-overview-section-action">
          Open the grid
        </Link>
      </div>
      {payload.agendaWork.conflicts.length === 0 && payload.agendaWork.unplaced.length === 0 && (
        <div className="chq-overview-empty">Every accepted session is placed with no clashes.</div>
      )}
      {payload.agendaWork.conflicts.map((conflict, idx) => (
        <div key={`conflict-${idx}`} className="chq-overview-row chq-overview-row-agenda">
          <div>
            {/* DEC-877: a raw ISO day with no time never renders — weekday +
                day-of-month, then the start time, then the room (below). */}
            <div className="chq-overview-row-title chq-overview-row-title-sm">
              {formatDayLabel(conflict.day)}, {clockHHMM(conflict.startMin)}
            </div>
            <div className="chq-overview-row-meta">{publicRoomLabel(conflict.roomName)}</div>
          </div>
          <div>
            <div className="chq-overview-row-late">{conflictKindLabel(conflict.kind, conflict.entries.length)}</div>
            {conflict.entries.map((entry) => (
              <div key={entry.submissionId}>
                {entry.title}{' '}
                <span className="chq-overview-row-meta">— {joinSegments([entry.speakerName, entry.ref])}</span>
              </div>
            ))}
          </div>
          {conflict.resolution ? (
            <div className="chq-overview-row-actions-column">
              <button
                type="button"
                className="chq-overview-link-btn"
                onClick={() => {
                  const resolution = conflict.resolution!;
                  void placeSlot(
                    resolution.submissionId,
                    { day: resolution.day, startMin: resolution.startMin, roomId: resolution.roomId },
                    conflict.endMin - conflict.startMin,
                    (prev) => ({
                      ...prev,
                      agendaWork: {
                        ...prev.agendaWork,
                        conflictTotal: Math.max(0, prev.agendaWork.conflictTotal - 1),
                        conflicts: prev.agendaWork.conflicts.filter((_, i) => i !== idx),
                      },
                    }),
                  );
                }}
              >
                {conflict.resolution.label}
              </button>
              <span className="chq-overview-caption">Next free slot in {conflict.resolution.roomName}</span>
            </div>
          ) : (
            <div />
          )}
        </div>
      ))}
      {payload.agendaWork.unplaced.map((row) => (
        <div key={row.submissionId} className="chq-overview-row chq-overview-row-agenda">
          <span className="chq-overview-caption chq-overview-caption-flush">No slot yet</span>
          <div>
            <div>{row.title}</div>
            {/* DEC-652 amendment (wave 2): duration is stated ONCE per row —
                `format` already embeds it parenthetically ("Talk (30 min)")
                whenever durationMin is derivable (DEC-895's parse reads the
                duration out of format itself), so a second bare "30 min"
                segment here would repeat the same fact twice. A row whose
                format carries no parseable duration (or has no format
                answer at all) still drops cleanly, never a dangling
                "· ·" fragment. */}
            <div className="chq-overview-row-meta">
              {joinSegments([row.speakerName, row.format != null ? sessionFormatLabel(row.format) : null, row.ref])}
            </div>
          </div>
          {row.suggestion && row.durationMin !== null ? (
            <button
              type="button"
              className="chq-overview-link-btn"
              onClick={() => {
                const suggestion = row.suggestion!;
                void placeSlot(row.submissionId, suggestion, row.durationMin!, (prev) => ({
                  ...prev,
                  agendaWork: {
                    ...prev.agendaWork,
                    unplacedTotal: Math.max(0, prev.agendaWork.unplacedTotal - 1),
                    unplaced: prev.agendaWork.unplaced.filter((r) => r.submissionId !== row.submissionId),
                  },
                }));
              }}
            >
              {/* DEC-652 amendment (wave 2): the suggestion label is the
                  server's own "Place at HH:MM" text verbatim, no client-
                  appended room suffix — a room-distinct pair of same-time
                  suggestions is still two distinct rows (different title,
                  format, ref), not a single button whose accessible name
                  must carry the room. */}
              {row.suggestion.label}
            </button>
          ) : (
            <Link to="/agenda" className="chq-overview-link-btn">
              Place it
            </Link>
          )}
        </div>
      ))}
      {/* DEC-877: overflow is a summary line BELOW the list — the same
          shape §01 uses for its own overflow. Only the counts the server
          actually sent are named, never an invented duration clause. */}
      {agendaOverflowLine(payload) && <div className="chq-overview-overflow">{agendaOverflowLine(payload)}</div>}
    </section>
  );
}
