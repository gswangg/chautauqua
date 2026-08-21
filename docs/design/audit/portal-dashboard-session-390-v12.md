# Portal dashboard + your-session, 390 — frame verdict audit (task w30-c)

Frames: `docs/design/Chautauqua Public and Portal.dc.html:414` ("Speaker
portal", the dashboard) and `:563` ("Portal · Your session"). Both were
measured 11/14 drawn literals asserted with a single markup citer;
`test/portal-dashboard-session-390-frame-verdicts.test.ts` raises every one
of the 14 drawn literals in each frame to a real `app.request()` SSR
assertion with its own DEC-967 citation. This audit records what that file
found, per the task's FIX RULE: a fix landed in the same commit only when
confined to `portal.css.ts`'s terminal phone block or to markup that
changes no desktop byte; everything wider is recorded here instead.

## Frame :414 "Speaker portal" — MATCHES (all 14 literals)

Every structural literal renders as drawn: the `chautauqua` wordmark, the
speaker's name in the header, the DEC-590 headline (`{countOf(n, "thing")}
to do`, `n` proven equal to `worklist.length` — the exact array the
"Waiting on you" section maps over, never a second count), the
`scheduledSubline` one-session form (`<event> · you speak <placement>`),
the "Waiting on you" / "Your session" / "Done" section labels, the
per-kind task control label (`taskActionLabel` returns `Upload file` for
`kind: "file_request"`, index.tsx:136), the session card's title + meta
line (format · track · accepted date) and deliverable clause (`{filename}
v{version} · with the organisers`), the `Upload again` control
(index.tsx:291), and the footer band (`<name> · <company>` + `Profile`
link). The sign-out control (DEC-590's "page furniture, not chrome" half)
renders as `chq-btn-tertiary` in the header identity cluster, never a
primary/secondary-weight button.

The `scheduledSubline` **multi-session** form (DEC-936: every placed
session named, never just the first) is also verified — a two-session
fixture renders `<event> · you speak N times — <slot A>; <slot B>`, both
slots present, neither swallowed.

No new fix landed against this frame this task — the code already matched
before this task's test file existed; the file's job was raising the
citation/receipt coverage from a single markup citer to 14 individually
receipted assertions.

## Frame :563 "Portal · Your session" — MATCHES, with three already-catalogued divergences (not re-litigated as new findings)

Back link, H1, status badge, submission title, `<ref> · <kind>, <n> min ·
<track>` meta line, placement line, Abstract section + body, Slides
section, deliverable filename row, and the dock all render in the frame's
own order. Three wording/label divergences from the frame's own sample
text were already caught and DEVIATIONS.md-sanctioned by
`test/portal-390-frame-verdicts-session.test.ts` (wave-158); this task's
test asserts what the route actually emits (the correct behavior) and
notes the existing catalog entry rather than re-opening it:

1. **Back link label.** Frame :565 draws `‹ Your portal`; the route's
   `PortalBackLink` resolves this destination (`/portal/submissions`)
   through `src/routes/portal/shared.tsx`'s `PORTAL_BACK_LINKS` table to
   `‹ Your submissions` — a route-accurate label, not a copy bug.
2. **Dock secondary label.** Frame :589 draws bare `Edit`; the dock renders
   `Edit submission`, an expansion for clarity.
3. **Deliverable visibility clause.** Frame :583's sample reads `with the
   organisers` (the card's shortened form); the detail page's own clause
   (index.tsx:581, a DEC-908 wording choice) is the longer `Shared with
   the organisers`. Version/size shape (`v{version} · {bytes}`) matches
   exactly.

No new fix landed against this frame either — all three divergences were
already correctly implemented product behavior with a pre-existing catalog
entry; this task's contribution is the individually-receipted citation
coverage for the remaining structural literals (title, meta, placement,
Abstract, Slides, deliverable row) that the wave-158 file did not assert.

## Citation-contract note

Every `docs/design/Chautauqua Public and Portal.dc.html:<line>` citation
added to the new test file carries a real `expect(` within a few source
lines beneath it, per `app/src/frame-citation.scan.test.ts`'s test-file
receipt contract (`UNRECEIPTED_CLAIM_CEILING`/`DESKTOP_UNRECEIPTED_CLAIM_CEILING`
both stay at 0). No citation was added to `portal.css.ts` or `index.tsx`/
`shared.tsx` product code this task beyond the existing `DEC_590`
compile-check reference (`src/routes/portal/index.tsx`), since no CSS or
markup fix was required — both frames already matched the running product.
