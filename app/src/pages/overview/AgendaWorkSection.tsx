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
import { conflictKindLabel } from '../agenda/ConflictChip';
import type { OverviewPayload } from './types';

// DEC-652: mirrors src/server/repo/agenda.ts's DEFAULT_AUTO_SCHEDULE_PARAMS
// .defaultDurationMin — the same default the server's nextFreeSlot used to
// compute an unplaced row's `suggestion` (no persisted per-submission
// length exists, so UnplacedRow.durationMin is always null; this is the
// one place the client independently knows the duration a suggested slot
// was sized for, for the PUT's endMin).
const DEFAULT_UNPLACED_DURATION_MIN = 30;

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
            <div className="chq-overview-row-title chq-overview-row-title-sm">{conflict.day}</div>
            <div className="chq-overview-row-meta">{conflict.roomName}</div>
          </div>
          <div>
            <div className="chq-overview-row-late">{conflictKindLabel(conflict.kind, conflict.entries.length)}</div>
            {conflict.entries.map((entry) => (
              <div key={entry.submissionId}>
                {entry.title} <span className="chq-overview-row-meta">— {entry.speakerName} · {entry.ref}</span>
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
            {/* DEC-735: no persisted per-submission duration reaches this
                row (server always sends durationMin: null — see the
                DEFAULT_UNPLACED_DURATION_MIN comment above), so the "· N
                min ·" clause is dropped rather than rendered dangling. */}
            <div className="chq-overview-row-meta">
              {row.speakerName} · {row.ref}
            </div>
          </div>
          {row.suggestion ? (
            <button
              type="button"
              className="chq-overview-link-btn"
              onClick={() => {
                const suggestion = row.suggestion!;
                void placeSlot(row.submissionId, suggestion, DEFAULT_UNPLACED_DURATION_MIN, (prev) => ({
                  ...prev,
                  agendaWork: {
                    ...prev.agendaWork,
                    unplacedTotal: Math.max(0, prev.agendaWork.unplacedTotal - 1),
                    unplaced: prev.agendaWork.unplaced.filter((r) => r.submissionId !== row.submissionId),
                  },
                }));
              }}
            >
              {/* DEC-735: a suggestion names the room it would fill —
                  otherwise several "Place at 9:00" rows on the same wall
                  clock are indistinguishable. */}
              {row.suggestion.label} in {row.suggestion.roomName}
            </button>
          ) : (
            <Link to="/agenda" className="chq-overview-link-btn">
              Place it
            </Link>
          )}
        </div>
      ))}
    </section>
  );
}
