// Error-copy rewriters for the public CFP submit flow
// (src/routes/public/submit.tsx). Split out purely to reduce merge
// contention on that file — no behavior change.
//
// DEC-124: the no-red error vocabulary's copy rules, applied at the
// error-assembly boundary rather than inside validateAnswers itself (that
// file stays out of this task's owned scope, per its own display-only-cap
// comment above) -- both helpers only ever REWRITE an error string
// validateAnswers/validateTrackChoice already produced, never change which
// answers are accepted.
const TOO_LONG_PATTERN = /^Too long \(max (\d+) characters\)$/;

/** Rewrites validateAnswers' generic "Too long (max N characters)" into
 * copy naming both numbers -- how much was typed, and how far over the
 * limit that is -- so the submitter never has to do the subtraction
 * themselves. Returns null for any other error string (left untouched). */
export function overLengthErrorMessage(rawError: string | undefined, typedValue: unknown): string | null {
  if (!rawError) return null;
  const match = TOO_LONG_PATTERN.exec(rawError);
  if (!match) return null;
  const cap = Number(match[1]);
  const length = typeof typedValue === "string" ? typedValue.length : cap;
  const over = Math.max(length - cap, 0);
  return `${length.toLocaleString("en-US")} characters typed — ${over.toLocaleString("en-US")} over the ${cap.toLocaleString("en-US")}-character limit.`;
}

// DEC-124: "Select a track" (validateTrackChoice's copy for "nothing
// picked") reads as an instruction with no reason attached -- the public
// CFP's ONE radio group gets this task's exemplar copy instead. The
// membership-violation branch ("Selected track is not offered by this
// form.") is a tamper/stale-form case, not a normal validation state, and
// is left exactly as validateTrackChoice (shared with the portal edit
// multi-select) produced it.
const TRACK_PICK_MESSAGE = "Pick one — a talk needs a track so the right people review it";

export function trackChoiceMessage(rawError: string): string {
  return rawError === "Select a track" ? TRACK_PICK_MESSAGE : rawError;
}
