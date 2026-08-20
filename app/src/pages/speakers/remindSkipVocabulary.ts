// DEC-613 wave-114 amendment: one phrase, one owner. The server's manual
// reminder planner (src/domain/reminders.ts's MANUAL_DEDUPE_WINDOW_MS) skips
// anyone reminded within the last hour -- every caption describing that rule
// reads this module rather than re-typing the phrase, so a fifth copy (or a
// synonym wobble like TaskView.tsx's former "emailed") cannot drift in
// silently. DEVIATIONS.md §4's standing voice rule bans exactly that kind of
// wobble on domain terms.
export const REMIND_SKIP_RULE = 'skips anyone reminded in the last hour';

// Sentence-initial form for standalone captions (Overview.tsx,
// OnboardingGrid.tsx render this as a whole sentence, not embedded mid-line
// like TaskView.tsx's bulk-bar note).
export const REMIND_SKIP_RULE_SENTENCE = 'Skips anyone reminded in the last hour';
