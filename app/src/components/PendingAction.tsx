import { useDelayedFlag } from './DelayedLoading';
import { countOf } from '../lib/plural';

// DEC-733 wave-63 amendment: V11's "Pending — the gap the hover spec does
// not cover" (docs/design/DESIGN-RULINGS.md:155-161). Four operations are
// genuinely slow and are not optimistic; each needs a designed wait rather
// than a spinner. This module is the ONE place that decides the rule for
// all four, so a future fifth slow operation has one thing to import
// instead of hand-rolling its own busy-label logic.
//
// The declared population -- every module below must import
// `usePendingLabel` (enforced by pending-action.scan.test.ts):
//   - bulk-send      -> ComposeWizard.tsx
//   - csv-import     -> ImportWizard.tsx
//   - file-upload    -> UploadZone.tsx
//   - auto-schedule  -> Agenda.tsx, PhoneAgenda.tsx
export const SLOW_OPERATIONS = ['bulk-send', 'csv-import', 'file-upload', 'auto-schedule'] as const;

export interface UsePendingLabelArgs {
  /** True for the whole duration of the slow operation. */
  pending: boolean;
  /** The button's label when not pending (and, per the ruling, for the
   *  first 300ms of `pending` too -- a flash of "Saving…" on a fast
   *  connection is noise). */
  restLabel: string;
  /** Present participle used once the pending label becomes visible, e.g.
   *  "Sending", "Importing", "Uploading". */
  participle: string;
  /** How many units of work are done so far. Present together with
   *  `total` for a live "Sending 12 of 23…" count; omitted when the
   *  operation cannot report incremental progress. */
  done?: number;
  /** The total unit count, when known. Present alone (without `done`)
   *  for a single known-size operation, e.g. "Importing 214 rows…". */
  total?: number;
}

export interface UsePendingLabelResult {
  label: string;
  buttonProps: {
    /** The button is the ONLY thing disabled while pending -- never the
     *  page, never a modal trap, and Cancel/Close stay live. */
    disabled: boolean;
    /** Adds `cursor: progress` once the pending label is visible. The
     *  button keeps its rest colour -- this class carries no colour or
     *  transition rule. */
    className: string;
  };
}

/** Computes the V11 pending-button label + props for one of the
 *  SLOW_OPERATIONS. Under 300ms of `pending` the label and props stay at
 *  rest (`useDelayedFlag(pending, 300)` -- 300ms is this component's own
 *  threshold, not DelayedLoading's 250ms skeleton default). Once visible:
 *  countable progress reads "Sending 12 of 23…" (done+total) or
 *  "Importing 214 rows…" (total alone); uncountable progress is one
 *  unmoving line, "Uploading…". On completion the caller flips `pending`
 *  back to false and this hook returns to rest -- it never renders
 *  "Sent!"; the result panel is the caller's job. */
export function usePendingLabel({
  pending,
  restLabel,
  participle,
  done,
  total,
}: UsePendingLabelArgs): UsePendingLabelResult {
  const visible = useDelayedFlag(pending, 300);

  let label = restLabel;
  if (visible) {
    if (typeof done === 'number' && typeof total === 'number') {
      label = `${participle} ${done} of ${total}…`;
    } else if (typeof total === 'number') {
      label = `${participle} ${countOf(total, 'row')}…`;
    } else {
      label = `${participle}…`;
    }
  }

  return {
    label,
    buttonProps: {
      // The button must never be double-clickable while its own write is
      // in flight, whether or not the 300ms grace period has elapsed --
      // only the LABEL stays at rest during the grace period.
      disabled: pending,
      className: visible ? 'chq-btn-pending' : '',
    },
  };
}
