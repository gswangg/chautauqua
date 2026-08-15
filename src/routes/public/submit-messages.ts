// Error-copy rewriters for the public CFP submit flow
// (src/routes/public/submit.tsx). Split out purely to reduce merge
// contention on that file — no behavior change.
//
// DEC-124: the no-red error vocabulary's copy rules, applied at the
// error-assembly boundary rather than inside validateAnswers itself (that
// file stays out of this task's owned scope, per its own display-only-cap
// comment above) -- this helper only ever REWRITES an error string
// validateTrackChoice already produced, never changes which answers are
// accepted.
//
// DEC-422 (amendment): the over-length rewrite (overLengthErrorMessage)
// that used to live here was DELETED -- it recovered "how much over" by
// regex-matching validateAnswers' generic "Too long (max N characters)"
// prose, which broke the instant that prose changed. validateAnswers now
// emits the rich sentence directly via overCapSentence
// (src/domain/cap-copy.ts), so there is nothing left to rewrite.

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
