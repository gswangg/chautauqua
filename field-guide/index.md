# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks, §2 principles). docs/ precedence: clarifications.md overrides all; decisions/DEC-*.md binding, src/decisions.ts compile-checked (never hand-edit). Invariants: fail loudly; status changes never auto-email (one sanctioned exception, DEC-720); authz every route, server-side visibility.
- STAGE (compacted): pure-core no node:/cf; Hono sub-apps; errors {error:{code,message,fields?}}; bulk ops set-based; D1 PRIMITIVES; pagination ONE shape+count*+id asc; atomic SQL>read-then-write; uniqueIndex CONTRACT; MINTING IS IO; UNBOUNDED SURFACE NEVER PAGED; A UNIVERSAL NEEDS A POPULATION. DEC-002..999 space FULL, no DEC-1000+; rulings land as `## Amendment (wave N)` on nearest EXISTING DEC. TOOL TRAP: Grep -C drops some `/`.
- FINDINGS w31-64 (heavily compacted): loose ref beats stale packed-refs; A GATE INSIDE A CODE WAVE CAN NEVER QUALIFY (DEC-069); ONE MACHINE ONE HEAVY GATE lock (DEC-644); CSRF-EXEMPT WITHOUT SESSION IS BEARER-REACHABLE (DEC-027); AN AMENDMENT THAT REVERSES SAYS SO (DEC-099); A HAND-LISTED POPULATION IS NOT A POPULATION (DEC-180); A COVERAGE CAP IS NOT AN IDENTITY (DEC-100); A DECLARED TARGET IS PART OF THE CONTRACT (DEC-817); A KNOB IS DECLARED BY THE TABLE AND SPENT BY EVERY LINK (DEC-489); AN EXPORT IS A READ SIDE (DEC-873); A DAY LABEL FROM A SUB-DAY CLOCK OFFSET IS A TIMEZONE BOMB (DEC-522); A DECLARED KNOB/SETTING WITH NO READER IS A LIE (DEC-851/DEC-988); A LITERAL MATCH IS NOT A POPULATION (DEC-941/DEC-989); A DIRECTORY IS NOT A POPULATION (DEC-367/DEC-808); A CITATION IS NOT AN ASSERTION (DEC-967); THE DESIGN AUTHORITY MOVED, SPA HAS NO STATE LAYER (DEC-383); A BUDGET IS CLASSIFIED BY ITS KEY NOT ITS ROUTE (DEC-072); A DEFAULT IS AN INVITATION TO GUESS (DEC-678/DEC-808); A ROSTER IS NOT A PROJECTION OF ITS TASKS (DEC-829); A HIDDEN CONTROL WITH NO OFFSET IS STILL ON THE SCREEN (DEC-919); A LADDER IS NOT A GATE (DEC-370); ONE ROW ELECTED TO SPEAK FOR THE REST IS A LIE WITH A QUORUM (DEC-936); A SECOND COPY OF A VOCABULARY IS A TRAP WITH A DELAY FUSE (DEC-613); A CONFIRM WITH NO ARMING IS THE MIRROR OF A DELETE WITH NO CONFIRM (DEC-941); A WRITE'S ECHO COMES FROM THE WRITE, use `.returning()` (DEC-948); A MINT IS THE LAST THING A SEND DOES (DEC-397); A DURABLE WRITE IS A POINT OF NO RETURN (DEC-547); A GATE FINDING IS A CLAIM ABOUT A SNAPSHOT NOT ABOUT MAIN (DEC-903); A SILENT FALLBACK HAS SIBLINGS IN OTHER FILES (DEC-843); A MOCK THAT MATCHES NOTHING IS A CONTRACT WITH ITSELF (DEC-663).
- WAVES 65-127 HEAVILY COMPACTED (v12m mobile campaign start through desktop/phone ledgers converging): key recurring lessons — a `DEC_NNN` constant/registry entry is a mutable STRING not a receipt of build (DEC-967, sightings #7-#18+ across w90-w146); scan predicates lie in their PREDICATE not their count, always force ceiling to `-1` and read the offender list (DEC-808); branch-namespace collisions recurred nearly every wave, re-verify via `show-ref`+`for-each-ref`+`worktree list`+packed-refs before AND after planning; a hand-listed or tag-filtered population undercounts (DEC-180/393/613); frame-in-repo outranks a pixel measurement, and a frame's prose can assert behaviour the code forbids — goes to DEVIATIONS, never a worker (DEC-380/582); ratchet ceilings must be MEASURED not read from a snapshot; a green exit-predicate over a red suite is the campaign's costliest illusion, fixed by requiring a suite-verified ancestor sha (DEC-069); comment-stripping and entity-decoding must be string-aware or ledgers invent offenders (DEC-967); `git rev-list --count main..<branch>` is the only honest "did this land" test, not `--is-ancestor`.
- WAVES 128-151 HEAVILY COMPACTED: registry laundering recurs, always grep the TREE for the ruled sentence; caption ledgers need boundary-anchored+normalized matching (DEC-976); measure in a DETACHED worktree pinned to a sha, never the shared checkout; StrictMode double-invoke breaks render-time registry writes (DEC-728); `--is-ancestor` answers reachable not landed, use `git rev-list --count` (DEC-903); CSS comments are page content and must be stripped or read verbatim per DEC-374's subject test; the pack draws control floors in TWO registers (44 phone / 46 desktop), split before draining (DEC-393); DEC-NNN namespace SATURATED, new rulings are amendments only.
- WAVES 152-154 HEAVILY COMPACTED: fast tier oscillated red/green across waves as lanes landed mid-plan, ended fully green (1286 files/16405 tests/96s) — re-measure, never inherit a red set; every campaign exit-predicate ratchet reads 0 but a DRAINED LEDGER MEASURES CITATION NOT CONFORMANCE — four live review-lens defects (bare `<a>` tap targets, stale audit rows, half-applied DEC-124/DEC-517 amendments) hid behind green rows; `routeManifest.ts` has zero query sub-states so tabbed admin surfaces are only ever visited at their default tab (DEC-144/180); the mandate doc itself is a cited artefact whose citations rot (DEC-967); `render-sweep.ts`'s control selectors are class-token keyed and miss classless `<a>` floor violations (DEC-253); Settings' 390 phone-primary render gap traced to `editing`/`children` gating (DEC-919, closed wave 155 below).

## Wave 155 — verify the registry you are citing, not just the line

**Two directories hold `DEC-NNN.md` and their ids COLLIDE.** `decisions/`
(1000 files, canonical for `test/decisions-parity.test.ts`) and
`src/decisions-data/` (77 files, what the scribe has written since wave 5).
Measured on `ce3d92ac`: all 77 ids exist in both, zero pairs are identical,
and **35 carry an entirely different subject under the same id**. `DEC-991`
is a direct contradiction — `src/decisions-data/DEC-991.md` rules a
display-face `line-height: 1` **legal where the frame draws it**;
`decisions/DEC-991.md` rules it **banned outright**. Before citing a DEC,
open BOTH files. `test/decision-doc-citation.scan.test.ts`'s header calls the
numbering "disjoint" — false, corrected by DEC-976's wave-155 amendment.

**Only 77 of 1077 decision docs have their citations checked.** The
two-directional grammar (line resolves, following backtick literal matches
verbatim) covers `src/decisions-data/*.md` plus widened docs classes.
`decisions/*.md` gets bare-path existence only
(`test/decision-path-references.scan.test.ts`) — a citation you write into
`decisions/` is unverified today (DEC-518).

**The 390 gate reports ONE control per route.** `render-sweep.ts`'s
`visitMobileRoute` keeps `minControlHeight`/`minControlWidth` only, a scalar
not a list. `deriveInteractiveOffenders` exists, is unit-tested, and is
called from nowhere; `ADMIN_MOBILE_INTERACTIVE_OFFENDERS_CEILING` is still
the `-1` sentinel. A green admin mobile row means "the shortest control
clears 44", not "every control does" (DEC-253).

**A read drill renders `rows`, never `children`.** `Settings.tsx` sets
`editing` from `?edit=1`; `SummarySection.tsx` swaps in `children` only
then. Anything a 390 frame draws in a READ drill must render outside the
edit children — `ApiTokensPanel`'s `readOnly` branch returns early and
reaches none of them (DEC-919, closed this wave).

**Non-zero ceilings on `ce3d92ac`** (else 0): `DESKTOP_FLOOR_UNRESOLVED_CEILING=129`,
`LOCAL_CSS_COMMENT_STRIPPER_CEILING=102`, `COMMENT_BLIND_CSS_ASSERTION_CEILING=38`,
`DESKTOP_FLOOR_DIVERGENCE_CEILING=23`, `FRAME_FLOOR_DIVERGENCE_CEILING=7`,
`LINE_KEYED_CITATION_CEILING=1`. Any NEW ratchet constant must be registered
in `exit-predicate.ts`'s `CAMPAIGN_CONSTANT_NAMES` or `OUT_OF_CAMPAIGN_SCOPE`
or `assertCampaignPopulationTotal` throws.

**Branch namespace:** `v12m-w11-a..j` and `v12m-w12-a..j` are BURNED. This
wave used `v12m-w11-pa..ph`. Fifteen branches sit committed-unmerged at one
commit each — read and scheduled around, not built on.

**Killed by verification this wave** (do not re-open): StrictMode
`acquireNavigationContext` throw; DEC-660 citation drift and both citation
ceilings; three frame-receipt assertion timeouts; `NotYetOpenPage` dead-end;
`parseScale` poison pill; portal-preview "sign in as" tooltip; rate-limit
`chq-field-invalid` (now keyed on `error?.kind === "credential"`).
