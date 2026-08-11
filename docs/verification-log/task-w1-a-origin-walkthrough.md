# task-w1-a — origin walkthrough @ c663cf2

DEC-252: local-first absolute-link origins. Problem (verified in
`docs/verification-log/task-w4-b-walkthrough.md`): wrangler.jsonc's
`routes`/`custom_domain: chautauqua.cc` entry (human stage-2 wiring, left
untouched) makes `new URL(c.req.url).origin` resolve to the live production
host under local `wrangler dev`, so the public-submit confirmation page's
claim link pointed at the deployed site and the walkthrough's producer (J2)
and scale (step 6) modules failed with a 410 from production.

## Build

New `src/server/origin.ts` exports `resolveBaseUrl(c)` implementing the
DEC-252 precedence: (1) `env.PUBLIC_BASE_URL` when set — must be an absolute
http(s) URL, trailing slash stripped, THROWS on malformed; (2) when
`env.DEV_MODE === "1"`, the first loopback origin among [request URL origin,
`Origin` header, `Referer` header] — header sniffing is dev-only and
loopback-only, so an attacker-supplied header can never poison a link in
production; (3) the request URL origin.

`PUBLIC_BASE_URL?: string` added to `Bindings` in `src/server/env.ts`.

Absolute-link construction switched to `resolveBaseUrl` in:
- `src/routes/public/submit.tsx` (email body only; the on-page claim link
  is now RELATIVE, `/claim/<token>` or `/login` — same-origin links never
  depend on origin inference. `ConfirmationPage`'s prop was renamed
  `claimUrl` -> `claimPath` to make this explicit.)
- `src/routes/comms.ts` (`resolvePortalLink` / `buildRenderTargets`, feeding
  bulk compose merge fields — functional owner is lane c, this task touches
  only the origin line + signature typing to accept `req.header`).
- `src/routes/api/contacts.ts` (both `/contacts/bulk-email` and
  `/contacts/bulk-email/preview` — functional owner is lane f, same
  scope-limited touch).

`src/routes/root.tsx:26` intentionally left alone — that origin feeds an
internal `ASSETS.fetch`, not a user-facing link (per task instructions).

`scripts/walkthrough/producer.ts` and `scripts/walkthrough/scale.ts` each
gained a local `resolveScrapedHref(href, baseUrl)` helper: resolves a
same-origin relative href against `--url`, and FAILS LOUDLY (throws) if a
scraped absolute href is off-origin from `--url` — gates must never
silently fetch a live deployment. Both scripts' claim-link scraping now
routes through this helper.

README gained a one-line dev note: a non-default `wrangler dev --port N`
should be given `--var PUBLIC_BASE_URL:http://localhost:N` so emailed links
match.

## Tests

- `test/origin.test.ts` (new): all `resolveBaseUrl` precedence branches —
  PUBLIC_BASE_URL wins + trailing-slash strip, throws on malformed/non-http
  PUBLIC_BASE_URL, dev-mode loopback request-origin/Origin-header/
  Referer-header fallthrough (in that order), dev-mode rejection of a
  non-loopback Origin/Referer header (falls through to request origin, does
  NOT trust the header), header sniffing disabled outside dev mode,
  production fallback to request URL origin. 10 tests, all pass.
- `test/claim-onscreen-scope.test.ts`: added a case asserting the
  confirmation page's on-page claim href is relative
  (`/claim/...`, not `https?://...`) while the emailed HTML body's href is
  absolute. Existing three cases (fresh/pending-existing/has-account)
  unmodified and still pass (their `/claim/` substring/regex assertions are
  href-scheme-agnostic, so they hold for a relative href too).

`npm test` — 185 test files, 1584 tests, all pass.
`npm run build` — clean (`tsc --noEmit` x2 + `vite build`).

## Acceptance walkthrough

Fresh worktree state (`c663cf2` + this task's uncommitted-then-committed
diff): `rm -rf .wrangler`; `npm run db:migrate` (15 migrations applied);
`npm run seed`; `npx tsx scripts/ensure-dev-vars.ts` (created `.dev.vars`
from `.dev.vars.example`, contents never read/printed per DEC-187);
`npx wrangler dev --port 8801` backgrounded, `GET /` returned 200.

`npm run walkthrough -- --url http://localhost:8801`:

```
Running J2 (public submit + claim) against devflow-conf-2027...
  ok
...
Summary:
  PASS producer
  PASS review
  PASS speaker
  PASS public
  PASS data
  PASS scale

walkthrough OK
```

All six modules PASS, including producer's J2 claim-link GET and scale's
step 6 purge-refresh probe — both previously FAILED with a 410 from
`chautauqua.cc` before this fix. No further findings surfaced by the
producer/scale modules once the origin issue was fixed; no other module
regressed.

## OPEN ITEMS: 0

## RESULT: PASS
