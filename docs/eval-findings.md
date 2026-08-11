# Eval findings — CLOSED (production verified, 2026-08-11)

All findings from the production browser-eval round are **fixed and verified on the live
deployment** (https://chautauqua.cc). No open items. This file is retained as the record
of what was found and how it was closed; new findings should replace this content.

## Verified fixed on production (independent browser verification, post-deploy)

| Was | Now |
|---|---|
| Reviewer assignment always failed "User not found" | Assign works for both scopes; assignment persists across reload and the Progress table increments |
| Reviewer queue links all pointed to `/submissions/undefined` | Every queue link carries a real submission id; a full review was submitted end-to-end via "Submit and advance", the item left the queue, and the completed count incremented |
| CRM duplicate merge was a silent no-op | Merge completes with a "Contacts merged." confirmation; total went 32 → 31 and the duplicate pair collapsed to one record after reload |
| Content deliverables dashboard ignored real uploads (worklist 0/0/0 while Files listed files) | Files tab and worklist counts agree exactly across all 31 sessions |

Also fixed directly and deployed earlier in the same session (both were deploy-only bugs
invisible to local gates — the reason a production eval exists):

- **Login 500 in production** — PBKDF2 at 600k iterations exceeds workerd's hard 100k cap.
  `ITERATIONS = 100_000` (runtime max); DEC-004 amended; seeds regenerated.
- **Public CFP submit 500** — a confirmation-email failure threw *after* the submission was
  persisted, so the speaker saw an error page and every retry created a duplicate. The
  confirmation send is now best-effort (logged with status `error` in `email_log`); the
  submission always returns its confirmation page. Verified with both a deliverable and a
  bouncing recipient.

## Earlier rounds, also verified fixed in production
Public widgets (session card date/time/room, keyword search, speaker + gallery detail
pages, agenda day-nav, real VEVENTs in the itinerary `.ics`, cross-surface consistency);
per-round scorecards; free-text criterion type; server-side anonymization; speaker portal
profile round-trip to organizer and public; task completion persistence; content-approval
gating of public content; agenda builder with warn-not-block conflicts and auto-schedule;
CRM directory/custom fields/CSV import/segments/pipeline; admin SPA reachable in a real
browser (the `/admin` redirect loop and the submissions "n is not iterable" crash).

## Permanent guards added as a result
- **Browser render-sweep gate** (`npm run gate:render-sweep`, CI job): boots a seeded
  server, authenticates per role, loads every enumerated route — desktop and mobile —
  asserting 200 + non-empty root + zero page errors. This is the gate that would have
  caught all three SPA render crashes before they shipped.
- **Component render tests** (jsdom/RTL) that render each admin/portal page against
  fixture-shaped API mocks, runnable inside a worker's own worktree.
- Walkthrough gate extended with a **scale** module.
