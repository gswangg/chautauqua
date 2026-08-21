# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks, §2 principles). docs/ precedence: clarifications.md overrides all; decisions/DEC-*.md binding, src/decisions.ts compile-checked (never hand-edit). Invariants: fail loudly; status changes never auto-email (one sanctioned exception, DEC-720); authz every route, server-side visibility.
- STAGE (compacted): pure-core no node:/cf; Hono sub-apps; errors {error:{code,message,fields?}}; bulk ops set-based; D1 PRIMITIVES; pagination ONE shape+count*+id asc; atomic SQL>read-then-write; uniqueIndex CONTRACT; MINTING IS IO; UNBOUNDED SURFACE NEVER PAGED; A UNIVERSAL NEEDS A POPULATION. DEC-002..999 space FULL, no DEC-1000+; rulings land as `## Amendment (wave N)` on nearest EXISTING DEC. TOOL TRAP: Grep -C drops some `/`.
- FINDINGS w31-64 (heavily compacted): loose ref beats stale packed-refs; A GATE INSIDE A CODE WAVE CAN NEVER QUALIFY (DEC-069); ONE MACHINE ONE HEAVY GATE lock (DEC-644); CSRF-EXEMPT WITHOUT SESSION IS BEARER-REACHABLE (DEC-027); AN AMENDMENT THAT REVERSES SAYS SO (DEC-099); A HAND-LISTED POPULATION IS NOT A POPULATION (DEC-180); A COVERAGE CAP IS NOT AN IDENTITY (DEC-100); A DECLARED TARGET IS PART OF THE CONTRACT (DEC-817); A KNOB IS DECLARED BY THE TABLE AND SPENT BY EVERY LINK (DEC-489); AN EXPORT IS A READ SIDE (DEC-873); A DAY LABEL FROM A SUB-DAY CLOCK OFFSET IS A TIMEZONE BOMB (DEC-522); A DECLARED KNOB/SETTING WITH NO READER IS A LIE (DEC-851/DEC-988); A LITERAL MATCH IS NOT A POPULATION (DEC-941/DEC-989); A DIRECTORY IS NOT A POPULATION (DEC-367/DEC-808); A CITATION IS NOT AN ASSERTION (DEC-967); THE DESIGN AUTHORITY MOVED, SPA HAS NO STATE LAYER (DEC-383); A BUDGET IS CLASSIFIED BY ITS KEY NOT ITS ROUTE (DEC-072); A DEFAULT IS AN INVITATION TO GUESS (DEC-678/DEC-808); A ROSTER IS NOT A PROJECTION OF ITS TASKS (DEC-829); A HIDDEN CONTROL WITH NO OFFSET IS STILL ON THE SCREEN (DEC-919); A LADDER IS NOT A GATE (DEC-370); ONE ROW ELECTED TO SPEAK FOR THE REST IS A LIE WITH A QUORUM (DEC-936); A SECOND COPY OF A VOCABULARY IS A TRAP WITH A DELAY FUSE (DEC-613); A CONFIRM WITH NO ARMING IS THE MIRROR OF A DELETE WITH NO CONFIRM (DEC-941); A WRITE'S ECHO COMES FROM THE WRITE, use `.returning()` (DEC-948); A MINT IS THE LAST THING A SEND DOES (DEC-397); A DURABLE WRITE IS A POINT OF NO RETURN (DEC-547); A GATE FINDING IS A CLAIM ABOUT A SNAPSHOT NOT ABOUT MAIN (DEC-903); A SILENT FALLBACK HAS SIBLINGS IN OTHER FILES (DEC-843); A MOCK THAT MATCHES NOTHING IS A CONTRACT WITH ITSELF (DEC-663).
- WAVES 65-127 HEAVILY COMPACTED (v12m mobile campaign start through desktop/phone ledgers converging): key recurring lessons — a `DEC_NNN` constant/registry entry is a mutable STRING not a receipt of build (DEC-967, sightings #7-#18+ across w90-w146); scan predicates lie in their PREDICATE not their count, always force ceiling to `-1` and read the offender list (DEC-808); branch-namespace collisions recurred nearly every wave, re-verify via `show-ref`+`for-each-ref`+`worktree list`+packed-refs before AND after planning; a hand-listed or tag-filtered population undercounts (DEC-180/393/613); frame-in-repo outranks a pixel measurement, and a frame's prose can assert behaviour the code forbids — goes to DEVIATIONS, never a worker (DEC-380/582); ratchet ceilings must be MEASURED not read from a snapshot; a green exit-predicate over a red suite is the campaign's costliest illusion, fixed by requiring a suite-verified ancestor sha (DEC-069); comment-stripping and entity-decoding must be string-aware or ledgers invent offenders (DEC-967); `git rev-list --count main..<branch>` is the only honest "did this land" test, not `--is-ancestor`.
- WAVES 128-151 HEAVILY COMPACTED: registry laundering recurs, always grep the TREE for the ruled sentence; caption ledgers need boundary-anchored+normalized matching (DEC-976); measure in a DETACHED worktree pinned to a sha, never the shared checkout; StrictMode double-invoke breaks render-time registry writes (DEC-728); `--is-ancestor` answers reachable not landed, use `git rev-list --count` (DEC-903); CSS comments are page content and must be stripped or read verbatim per DEC-374's subject test; the pack draws control floors in TWO registers (44 phone / 46 desktop), split before draining (DEC-393); DEC-NNN namespace SATURATED, new rulings are amendments only.
- WAVES 152-154 HEAVILY COMPACTED: fast tier oscillated red/green across waves as lanes landed mid-plan, ended fully green (1286 files/16405 tests/96s) — re-measure, never inherit a red set; every campaign exit-predicate ratchet reads 0 but a DRAINED LEDGER MEASURES CITATION NOT CONFORMANCE — four live review-lens defects (bare `<a>` tap targets, stale audit rows, half-applied DEC-124/DEC-517 amendments) hid behind green rows; `routeManifest.ts` has zero query sub-states so tabbed admin surfaces are only ever visited at their default tab (DEC-144/180); the mandate doc itself is a cited artefact whose citations rot (DEC-967); `render-sweep.ts`'s control selectors are class-token keyed and miss classless `<a>` floor violations (DEC-253).
- WAVES 155-159 HEAVILY COMPACTED: two directories collided on `DEC-NNN.md` ids, cite the directory not the bare id (DEC-976); rulings are not receipts of build, always check `git rev-list --count` (four lanes committed 0 across w155-156); measure in a detached worktree, never shared `main`, but skip D1-backed tests there (no `.wrangler`); vitest rewrites `path:line` in error messages, replicate a scan's regex before trusting one; CLAIMED_FLOOR/claimed-ledger counts prove citation not conformance (44/53 phone frames ungraded despite 53/53 claimed); SSR "phone-frames" tests were source scans not requests, copy `test/portal-page-headings.test.ts`'s `vi.mock`+`buildApp` harness; branch prefixes burn almost every wave, re-check `show-ref`+`packed-refs`+`worktree list` before AND after planning (w11-w14 letters all pre-burned, moved to q/r/s-prefixes); `signOut()` discards `?signed-out=1` (DEC-154), `useCurrentEvent`'s search-keyed cache never evicts (DEC-728); the pack draws vocabulary in per-surface registers a flattened map can't express, un-adjudicable divergences stay unfixed.
- WAVE 16 HEAVILY COMPACTED: branch letters pre-burned again, moved to `ua..ui`; a full-suite run against shared `main` can report a phantom red while the scribe writes mid-suite, re-run the single failing file; verdict ledgers rot faster than the code they grade, check the owning file's comment block before spending a lane on a row; the 390 verdict sweep is COMPLETE (53/53 phone + 4 desktop), remaining work is DIVERGES rows, DEVIATIONS, and the five DEC-069 verification slots; some lanes land committed-but-UNMERGED, read ledgers via `git show <branch>:<path>` until the train lands them.
- WAVE 17 HEAVILY COMPACTED: namespace held clean for once; ledgers are the campaign's biggest liability not the code — a dozen DIVERGES rows advertised work already landed, verdict tests still asserting stale truth (DEC-976: row+test move in one commit, `git log -S` before planning); a "two registers" verdict can be a two-sample undercount, enumerate the WHOLE drawn population (DEC-613/DEC-180); a control-floor row can resolve to the WRONG element by text-match, fix the frame's actual control then correct the join (DEC-393); exit-predicate reality check: all 31 ceilings DECLARED ONLY, not measured, all five DEC-069 slots VOID.
## Wave 18 (planner notes)

**THE FAST TIER IS RED ON MAIN AND HAS BEEN FOR AT LEAST TWO WAVES.**
Measured, not inherited: `test:fast` fails 8 files / 8 tests at `6aa65834`,
every one a fidelity or citation ratchet sitting at ceiling 0. The
exit-predicate prints all 31 rows DECLARED 0 / TARGET 0 while at least four
of those constants are provably wrong against the tree
(`UNRECEIPTED_CLAIM_CEILING` declares 0, measures 6;
`PHONE_HIDDEN_UNRECEIPTED_CEILING` declares 0, measures 2). A DECLARED
ceiling is a STRING; run the owning test. Wave 18 spends 6 of 7 lanes
draining that set so a verification wave can finally record a
`--suite-verified-sha` — no worker task can flip the five DEC-069 slots.

**THE TREE MOVED FOUR TIMES DURING PLANNING.** `main` went
`4a74f3b6` -> `f4540923` -> `649155df` -> `6aa65834` while wave 17's lanes
spawned, committed and merged around me, and for part of that window the
SHARED checkout carried ten uncommitted modified files from another agent.
Every offender list here was re-derived at `6aa65834` with a clean tree.
Corollary: a red ratchet you measured 20 minutes ago may be someone else's
lane by now — re-run the single test before writing the brief.

**AN EXACT POPULATION PIN IS A MERGE-CONFLICT MAGNET.**
`negative-margin-adjacency.scan.test.ts`'s `display:none` count read 169,
then 174, then 186 within one hour — three legitimate merges, three red
suites, on a file no lane owns. A tripwire that fires on legitimate growth
is a tripwire nobody reads (DEC-808 wave-18: floors and superset checks,
never equalities; the real subject keeps its exact-zero ratchet).

**A PRODUCT SCAN THAT READS A VERDICT TEST READS THE WRONG DOCUMENT.**
Two ceiling-0 ratchets are red on `Speakers.desktop-frame-verdicts.render.test.tsx`
for quoting the frame VERBATIM — the one artefact that proves the
divergence. Frame evidence is the subject of its sentence, not the
product's vocabulary (DEC-374 wave-18); byte-identity against
`docs/design/*.dc.html` is the unfakeable test.

**A SCAN'S PREMISE, NOT ITS COUNT, IS WHERE THE ESCALATION HIDES.** Both
credential scans read green while four organizer routes mint 30-day
`/claim/<token>` logins with no `requireCookieSession`, because
`createClaimToken`/`applyMintedPortalLinks` are in neither marker list
(DEC-027 wave-18). Two of the four mint INDIRECTLY — a marker list that
only reads a route's own registration text can never see them.

**LENS FINDINGS I DISPROVED at `6aa65834`:** `signOut()` reads `res.url`;
`captureNavigationContext` evicts on `lastCapturedSearch`; the
`home.css.ts:49/:125` + `cfp.css.ts:116` frame citations are receipted;
`DEC-576.md:388` and `DEC-029.md`'s `My Profile` quote resolve. The
`send.ts`/`bulk-email.ts` half of the claim-token finding IS real, but via
`applyMintedPortalLinks`, not the `resolvePortalLinks(..., false)` line the
lens cited.
