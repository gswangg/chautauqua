// DEC-900 amendment (wave 60): the ONE owner of minutes-from-midnight clock
// formatting, in exactly TWO named grammars — zero-padded 24-hour ('09:00',
// clockHHMM) and unpadded 24-hour ('9:00', clockHMM). Both fail loudly
// (DEC-012) on a non-integer minute or a minute outside the day's 0..1440
// range, rather than silently rendering 'NaN:NaN' or wrapping into a bogus
// negative/next-day hour. Every renderer of a clock time — admin agenda
// grid, overview conflict list, submissions schedule, speaker detail,
// content list, deliverable detail, portal placement, exports, public
// cards, auto-schedule labels — routes through this module (directly here
// in src/, or through app/src/lib/clock.ts's crossing for the SPA bundle)
// so the two grammars can never drift into an eleventh copy.

// Exported (not just module-private) because ItineraryScript
// (src/routes/public/agenda-itinerary-script.tsx) embeds `clockHMM` into its
// inline IIFE via `.toString()` -- which carries only clockHMM's own SOURCE
// TEXT, and that source text calls `assertValidMinute` as a free identifier.
// `.toString()` never carries a closed-over dependency (the exact EMB-10/11
// hazard this module's own callers already work around for
// MAX_ITINERARY_IDS/mergeItinerarySelection), so this function must also be
// embedded, under this EXACT name, into the same IIFE scope -- see
// agenda-itinerary-script.tsx's own `assertValidMinute` embed. Without it,
// every /schedule page with two saved, time-overlapping sessions throws a
// ReferenceError on the FIRST render, before the change listener that
// persists Remove clicks ever gets registered (DEC-555 wave-29 amendment).
export function assertValidMinute(minutesFromMidnight: number): void {
  if (
    !Number.isInteger(minutesFromMidnight) ||
    minutesFromMidnight < 0 ||
    minutesFromMidnight > 1440
  ) {
    throw new Error(
      `clock: minutesFromMidnight must be an integer in 0..1440, got ${minutesFromMidnight}`,
    );
  }
}

/** Zero-padded 24-hour clock, e.g. 540 -> '09:00'. */
export function clockHHMM(minutesFromMidnight: number): string {
  assertValidMinute(minutesFromMidnight);
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Unpadded 24-hour clock, e.g. 540 -> '9:00'. */
export function clockHMM(minutesFromMidnight: number): string {
  assertValidMinute(minutesFromMidnight);
  const h = Math.floor(minutesFromMidnight / 60);
  const m = minutesFromMidnight % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
