# task-w36-b — J1-J12 persona walkthrough @ f5783479

DEC-069 required section 2 (SPEC §9: "the real bar", ranked above the eval
harness). FROZEN-PRODUCT lane, own tip `task-w36-b`, wrote only under
`docs/`.

## DEC-644 three-sha boundary block

- HEAD (measured sha): `f5783479` ("scribe wave 36").
- Newest first-parent commit touching `src/**`, `app/**`, `migrations/**`,
  `package.json`: `3a041507` ("merge task-w35-c") — `f5783479` itself is a
  scribe/docs-only commit on top of it (`git log --first-parent --oneline
  -- src app migrations package.json` puts `3a041507` first).
- Ancestry verdict for every live `task-w3*` ref (`git branch -a
  --format='%(refname:short)' | grep '^task-w3'`, excluding this lane's
  own `task-w36-b`): `task-w35-a`, `task-w35-e`, `task-w35-f`,
  `task-w36-a`, `task-w36-c` — all five are ancestors of HEAD
  (`git merge-base --is-ancestor <ref> HEAD` exits 0 for each).

## Recipe run

`npx tsx scripts/ensure-dev-vars.ts` (created `.dev.vars` from the
example) -> `vite build --config app/vite.config.ts` (green) ->
`npm run db:migrate` (43 migrations, all clean) -> `npm run seed` (35 R2
objects put) -> `npx wrangler dev --port 8971` in the background, polled
`/health` until `{"ok":true}` -> `npx tsx scripts/walkthrough.ts --url
http://localhost:8971`.

## First run: producer FAILED — off-origin reset link (env config, not product)

The first walkthrough run FAILed at producer/J2:

```
Error: resolveScrapedHref: scraped href "http://localhost:8787/reset/LoGo4xVc4oO4QDKOXKt6gc7WqiDXml3qDumzmzasalo" resolved to origin http://localhost:8787, which is off-origin from --url's http://localhost:8971. Refusing to fetch an off-origin URL.
    at resolveScrapedHref (scripts/walkthrough/producer.ts:101:11)
    at runJ2 (scripts/walkthrough/producer.ts:601:20)
```

Because producer runs J1/J2/J3/J5/J9(break lifecycle) sequentially in one
process (`scripts/walkthrough/producer.ts:1090-1115`), the J2 throw
aborted the whole script before J3, J5, or the J9 break-lifecycle section
ever ran — confirmed by the absence of any `Running J3` / `Running J5` /
`Running J9` line in that run's output, per this task's own instruction
to "confirm those sections actually ran rather than assuming."

Root cause: `ensure-dev-vars.ts` seeds a fresh `.dev.vars` with the
shipped example's `PUBLIC_BASE_URL=http://localhost:8787` (DEC-296's
documented default for the default port), unrelated to any change in
`src/**`. Because `wrangler.jsonc`'s `routes`/`custom_domain` entry makes
`new URL(c.req.url).origin` resolve to the production host under
`wrangler dev` (`src/server/origin.ts:1-10`), and the walkthrough's
`jarFetch` (`scripts/walkthrough/producer.ts:82-89`) never sends an
`Origin`/`Referer` header on the `/forgot` POST, `resolveBaseUrl`'s
DEC-296 loopback-sniffing exception (`src/server/origin.ts:104-133`) has
no loopback candidate to fall back to and returns the configured
`PUBLIC_BASE_URL` (8787) verbatim — producing a reset link that points at
the wrong port whenever `wrangler dev` runs on a non-default port with an
unedited `.dev.vars`. This exact failure mode (and fix) is precedented at
`docs/verification-log/index/0163-2026-08-15-task-w26-f-walkthrough-73f380f2.md`:
"this lane's own `.dev.vars` still had the default
`PUBLIC_BASE_URL=http://localhost:8787` per DEC-296, unrelated to any
product code... corrected the gitignored `.dev.vars`... and ran one clean
walkthrough." `.dev.vars` is gitignored (`git check-ignore -v .dev.vars`
-> `.gitignore:9:.dev.vars`), so editing it is local test-harness config,
not a `src/**` product change, and this lane's product-frozen scope
(`INVALIDATED BY: src/** app/src/** migrations/** package.json`) is
unaffected.

Following that precedent: edited the gitignored `.dev.vars`'s
`PUBLIC_BASE_URL` to `http://localhost:8971` (matching the server's
actual port), `rm -rf .wrangler/state`, re-ran `db:migrate` + `seed`,
restarted `wrangler dev --port 8971`, and re-ran the full walkthrough
clean.

## Second run (measured): all six areas PASS

Order: producer -> review -> speaker -> public -> data -> scale.

Per-area PASS/FAIL lines, quoted verbatim from the Summary block:

```
Summary:
  PASS producer
  PASS review
  PASS speaker
  PASS public
  PASS data
  PASS scale

walkthrough OK
```

Producer explicitly ran, in order, and printed:

```
Running J1 (launch a CFP)...
  ok
Running J2 (public submit + claim) against devflow-conf-2027...
  ok
Running J3 (triage at volume) against devflow-conf-2027...
  ok
Seeding the >100-recipient overflow fixture...
  ok
Running J5 (compose: merge fields, cap, ICS, HTML escaping) against devflow-conf-2027...
  ok
Running J9 (break lifecycle: create -> list -> public agenda -> delete) against devflow-conf-2027...
  ok
Running DEC-175 authz probes (unauthenticated requests)...
  ok

producer walkthrough OK (J1, J2, J3, J5, J9)
PASS producer
```

Confirming the DEC-063 wave-66/68 amendment's break-lifecycle section
actually ran (not just assumed), and the closing self-report line names
its own coverage as "J1, J2, J3, J5, J9".

Public confirmed the DEC-063 wave-68 amendment's two other named
sections actually ran, quoted verbatim:

```
ok   J10 /e/devflow-conf-2027/programme renders the whole programme
ok   J10 GET / is the anonymous event hub and redirects a signed-in user
```

review, speaker, public, data, scale sections all report zero `FAIL`
lines. Full per-check output (131 `ok`/step lines total: 20 `ok:`-prefixed
review checks + ~90 speaker/public `ok   ` checks + 6 scale `PASS stepN`
lines + assorted `--` data-section headers) captured verbatim in this
lane's run log; every section's own closing self-report ("all checks
passed" / "OK" / "walkthrough OK") is present with no `FAIL` anywhere in
the second run's transcript.

## Cleanup

Killed the `wrangler dev --port 8971` background process
(`pkill -f "wrangler dev --port 8971"`) and removed its stdout/stderr log
file after both runs completed.

## RESULT

RESULT: PASS — all six walkthrough areas (producer, review, speaker,
public, data, scale) PASS at product sha `3a041507` (HEAD `f5783479` is
docs-only on top of it), including the DEC-063-amended break-lifecycle
(producer/J9), printable programme, and anonymous hub sections, once a
gitignored local `.dev.vars` port mismatch — precedented, not a product
defect — was corrected per task-w26-f's own fix.
OPEN ITEMS: 0
