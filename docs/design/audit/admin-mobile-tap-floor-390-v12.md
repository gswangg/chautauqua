# Admin mobile tap-floor offender roster (390px, DEC-253/DEC-367/DEC-808/DEC-996)

MACHINE-WRITTEN by `npm run gate:render-sweep` (scripts/render-sweep.ts). Do not hand-edit — the next gate run overwrites this file unconditionally.

Lists every visible interactive control under the 44px tap-target floor (`MIN_TAP_TARGET_PX`, either dimension) found by the admin 390x844 mobile pass, one route section per route with at least one offender, sorted by route path.

UNPOPULATED — this file was committed by task w22-i (which added the writer, `formatAdminMobileOffenderLedger` in scripts/render-sweep-lib.ts, plus the `writeFileSync` call site in scripts/render-sweep.ts) without running the live gate: that task's own hard rules forbid running `npm run gate:render-sweep`, booting wrangler, or launching playwright. The gate has not run against this writer yet, so this file has no measured content to show.

Last measured total (via `console.log`, before this writer existed): **79** interactive offenders, against `ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING = 79` in `scripts/render-sweep-lib.ts` (the wave-155 measured ceiling — see that constant's own comment for provenance). That total was never rostered by name before this task; the next real `npm run gate:render-sweep` run overwrites this file with the actual per-route, per-control roster.

Sha this file was last (non-)measured at: `6f0b5d48a90c84a5fadb5a5f8d0d826d02684d73` (main, as of task w22-i).
