import { useEffect, useState } from 'react';

// DEC-678: one delayed-loading policy, app-wide. A loading indicator that
// appears instantly reads as flicker on fast responses, and a bare
// "Loading…" literal scattered across every page makes it impossible to
// audit or change the policy in one place. This hook/component pair is the
// ONE place that decides "how long before we admit we're waiting" -- every
// page renders through it instead of hand-rolling its own `<p>Loading…</p>`.
//
// The delay is implemented with a real timer (not CSS alone) so tests can
// assert nothing renders on the first frame -- app/src/styles.css's
// `.chq-loading` also carries an `animation-delay` as a belt-and-braces
// path for the rendered block itself.

/**
 * Returns true once `active` has been true for at least `delayMs`
 * continuously. Flips back to false the instant `active` goes false, and
 * resets the timer whenever `active` transitions from false to true.
 */
export function useDelayedFlag(active: boolean, delayMs = 250): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!active) {
      setShow(false);
      return;
    }
    const timer = window.setTimeout(() => setShow(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs]);

  return active && show;
}

/**
 * Renders nothing for the first `delayMs` (default 250ms), then a
 * `.chq-loading` block carrying `label`. Use this wherever a page would
 * otherwise render a bare "Loading…" literal.
 */
export function DelayedLoading({ label = 'Loading…', delayMs = 250 }: { label?: string; delayMs?: number }) {
  const show = useDelayedFlag(true, delayMs);
  if (!show) return null;
  return <p className="chq-loading">{label}</p>;
}
