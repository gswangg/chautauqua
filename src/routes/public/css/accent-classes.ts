// DEC-838: the ONE list of classes whose colour is bound to
// --chq-brandable-accent -- interpolated into the public-CSS fragments that
// declare these selectors (never hand-listed a second time) so
// test/embed-accent-surfaces.test.ts's enumeration reads the exact same set
// the CSS text actually uses. Every entry here was, before DEC-838, ALREADY
// rendering at var(--chq-brand) (either directly or via the plain-<a> global
// `a { color: var(--chq-brand) }` rule in theme.ts) -- and --chq-brand's
// default (#4E5C31) equals --chq-brandable-accent's default (#4E5C31), so
// repointing these specific rules to the per-event custom property changes
// NOTHING about the default render; only a non-default accent becomes
// visible. No other rule in these fragments qualifies (body text, filled
// buttons, and fg/bg pairs like the track chip are excluded on purpose --
// contrast is not the organizer's to break).
//
// Extracted out of public.css.ts (contention decomposition) so every
// fragment that declares one of these three selectors (css/agenda.ts,
// css/rail.ts) imports the SAME array rather than each re-declaring it.
export const ACCENT_BOUND_CLASSES = ["chq-pub-agenda-block", "chq-pub-day-pill", "chq-pub-accent-link"] as const;
