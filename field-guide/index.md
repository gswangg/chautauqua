# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks, §2 principles). docs/ precedence: clarifications.md overrides all; decisions/DEC-*.md binding, src/decisions.ts compile-checked (never hand-edit). Invariants: fail loudly; status changes never auto-email (one sanctioned exception, DEC-720); authz every route, server-side visibility.
- STAGE (compacted): pure-core no node:/cf; Hono sub-apps; errors {error:{code,message,fields?}}; bulk ops set-based; D1 PRIMITIVES; pagination ONE shape+count*+id asc; atomic SQL>read-then-write; uniqueIndex CONTRACT; MINTING IS IO; UNBOUNDED SURFACE NEVER PAGED; A UNIVERSAL NEEDS A POPULATION. DEC-002..999 space FULL, no DEC-1000+; rulings land as `## Amendment (wave N)` on nearest EXISTING DEC. TOOL TRAP: Grep -C drops some `/`.
- FINDINGS w31-64 (heavily compacted): loose ref beats stale packed-refs; A GATE INSIDE A CODE WAVE CAN NEVER QUALIFY (DEC-069); ONE MACHINE ONE HEAVY GATE lock (DEC-644); CSRF-EXEMPT WITHOUT SESSION IS BEARER-REACHABLE (DEC-027); AN AMENDMENT THAT REVERSES SAYS SO (DEC-099); A HAND-LISTED POPULATION IS NOT A POPULATION (DEC-180); A COVERAGE CAP IS NOT AN IDENTITY (DEC-100); A DECLARED TARGET IS PART OF THE CONTRACT (DEC-817); A KNOB IS DECLARED BY THE TABLE AND SPENT BY EVERY LINK (DEC-489); AN EXPORT IS A READ SIDE (DEC-873); A DAY LABEL FROM A SUB-DAY CLOCK OFFSET IS A TIMEZONE BOMB (DEC-522); A DECLARED KNOB/SETTING WITH NO READER IS A LIE (DEC-851/DEC-988); A LITERAL MATCH IS NOT A POPULATION (DEC-941/DEC-989); A DIRECTORY IS NOT A POPULATION (DEC-367/DEC-808); A CITATION IS NOT AN ASSERTION (DEC-967); THE DESIGN AUTHORITY MOVED, SPA HAS NO STATE LAYER (DEC-383); A BUDGET IS CLASSIFIED BY ITS KEY NOT ITS ROUTE (DEC-072); A DEFAULT IS AN INVITATION TO GUESS (DEC-678/DEC-808); A ROSTER IS NOT A PROJECTION OF ITS TASKS (DEC-829); A HIDDEN CONTROL WITH NO OFFSET IS STILL ON THE SCREEN (DEC-919); A LADDER IS NOT A GATE (DEC-370); ONE ROW ELECTED TO SPEAK FOR THE REST IS A LIE WITH A QUORUM (DEC-936); A SECOND COPY OF A VOCABULARY IS A TRAP WITH A DELAY FUSE (DEC-613); A CONFIRM WITH NO ARMING IS THE MIRROR OF A DELETE WITH NO CONFIRM (DEC-941); A WRITE'S ECHO COMES FROM THE WRITE, use `.returning()` (DEC-948); A MINT IS THE LAST THING A SEND DOES (DEC-397); A DURABLE WRITE IS A POINT OF NO RETURN (DEC-547); A GATE FINDING IS A CLAIM ABOUT A SNAPSHOT NOT ABOUT MAIN (DEC-903); A SILENT FALLBACK HAS SIBLINGS IN OTHER FILES (DEC-843); A MOCK THAT MATCHES NOTHING IS A CONTRACT WITH ITSELF (DEC-663).
- WAVES 65-127 HEAVILY COMPACTED (v12m mobile campaign start through desktop/phone ledgers converging): key recurring lessons — a `DEC_NNN` constant/registry entry is a mutable STRING not a receipt of build (DEC-967, sightings #7-#18+ across w90-w146); scan predicates lie in their PREDICATE not their count, always force ceiling to `-1` and read the offender list (DEC-808); branch-namespace collisions recurred nearly every wave, re-verify via `show-ref`+`for-each-ref`+`worktree list`+packed-refs before AND after planning; a hand-listed or tag-filtered population undercounts (DEC-180/393/613); frame-in-repo outranks a pixel measurement, and a frame's prose can assert behaviour the code forbids — goes to DEVIATIONS, never a worker (DEC-380/582); ratchet ceilings must be MEASURED not read from a snapshot; a green exit-predicate over a red suite is the campaign's costliest illusion, fixed by requiring a suite-verified ancestor sha (DEC-069); comment-stripping and entity-decoding must be string-aware or ledgers invent offenders (DEC-967); `git rev-list --count main..<branch>` is the only honest "did this land" test, not `--is-ancestor`.
- WAVES 128-151 HEAVILY COMPACTED: registry laundering recurs, always grep the TREE for the ruled sentence; caption ledgers need boundary-anchored+normalized matching (DEC-976); measure in a DETACHED worktree pinned to a sha, never the shared checkout; StrictMode double-invoke breaks render-time registry writes (DEC-728); `--is-ancestor` answers reachable not landed, use `git rev-list --count` (DEC-903); CSS comments are page content and must be stripped or read verbatim per DEC-374's subject test; the pack draws control floors in TWO registers (44 phone / 46 desktop), split before draining (DEC-393); DEC-NNN namespace SATURATED, new rulings are amendments only.
- WAVES 152-154 HEAVILY COMPACTED: fast tier oscillated red/green across waves as lanes landed mid-plan, ended fully green (1286 files/16405 tests/96s) — re-measure, never inherit a red set; every campaign exit-predicate ratchet reads 0 but a DRAINED LEDGER MEASURES CITATION NOT CONFORMANCE — four live review-lens defects (bare `<a>` tap targets, stale audit rows, half-applied DEC-124/DEC-517 amendments) hid behind green rows; `routeManifest.ts` has zero query sub-states so tabbed admin surfaces are only ever visited at their default tab (DEC-144/180); the mandate doc itself is a cited artefact whose citations rot (DEC-967); `render-sweep.ts`'s control selectors are class-token keyed and miss classless `<a>` floor violations (DEC-253).
- WAVE 155 HEAVILY COMPACTED: two directories hold `DEC-NNN.md` and collide on all 77 shared ids, 35 with different subjects under one id — `DEC-991` a flat contradiction, cite the directory not the bare id (DEC-976); only 77/1077 decision docs have checked citations, `decisions/*.md` is bare-path-only (DEC-518); the 390 gate reported ONE control per route not a list (DEC-253, still open); wave RULED DEC-919's read-drill-renders-children fix but built nothing — a ruling is not a receipt of build, always check `git rev-list --count`.

- WAVE 156 HEAVILY COMPACTED: wave-155 plan was RULED but never BUILT, 4/8 lanes committed 0 (`git rev-list --count`, not the decision doc, proves landing); main was red at 108c5aa3 from a citation-grammar bug (tag-kind annotation inside `quoteAfter`'s window); vitest rewrites `path:line` in error messages, replicate a scan's regex before trusting one; measure in a detached worktree but not D1-backed tests (no `.wrangler`); campaign gate down to one row, `SPA_CLASSLESS_CONTROL_CEILING=4`; Settings 390 read drills 8/9 diverge (DEC-919); desktop drawn-floor JOIN is a label-TEXT search, corroborate before draining (DEC-393); branch namespace `v12m-w11-*`/`v12m-w12-a..j` BURNED, wave used `v12m-w12-qa..qj`.

- WAVE 157 HEAVILY COMPACTED: tree moved 3x mid-plan, re-check `git log -1` before emitting; CLAIMED_FLOOR proves citation not conformance — 44/53 phone frames ungraded despite 53/53 claimed (DEC-976); a control-shaped corroboration can attach to the WRONG element, verify by nearest-enclosing-class read (DEC-393); `v12m-w13-a..f` burned, moved to `ra..rj`.
- WAVE 158 HEAVILY COMPACTED: SSR "phone-frames" tests were source scans not requests (20/53 phone frames graded by grep, `app.request` count 0) — copy `test/portal-page-headings.test.ts`'s `vi.mock`+`buildApp` harness (DEC-976); a planner who skips the CONCURRENT wave's worktrees re-plans already-built lanes, check `git worktree list` for the other wave's prefix too; `signOut()` discards `?signed-out=1` (DEC-154) and `useCurrentEvent`'s search-keyed cache never evicts, replaying stale banners on A→B→A (DEC-728) — a scan's own PREMISE is a claim about the tree, not documentation; `v12m-w14-a/b/c/d/e/j` burned, moved to `sa..sj`.

- WAVE 159 HEAVILY COMPACTED: branch prefixes burn fast, re-check `show-ref`+`packed-refs`+`worktree list` before/after planning every wave; a scribed `## Amendment (wave N)` is the cheapest read on what a CONCURRENT wave already claimed; a verdict ledger row and an in-code comment both rot faster than the code they describe — re-derive against the tree, grep the predicate not the prose; the pack draws vocabulary in per-surface registers (label, byte format) that a single flattened map cannot express, un-adjudicable divergences stay unfixed; a desktop frame can license a desktop-affecting change under the freeze, cite the desktop line when spending it.

## Wave 16 (planner notes)

**Branch namespace, third-in-a-row correction.** `v12m-w16-a`, `-b`, `-c`
were ALREADY in `packed-refs` (all three at `89b58e05`) with live worktrees
under `~/.claude/jobs/2880f027/tmp/v12m-wt/` before this wave was planned —
same as w13 (`a..j` burned → `ra..rj`), w14 (→ `sa..sj`), w15 (→ `ta..tj`).
Wave 16 uses `ua..ui`, verified free before AND after planning. Assume the
reserved single-letter prefix is spent; check `git for-each-ref
'refs/heads/v12m-w<N>-*'` first, every time.

**A full-suite run against shared `main` can report a phantom red.** A
`npm run test:fast` pass here failed `test/citation-form-drift.scan.test.ts`
with 5 line-keyed citations in `DEC-663/874/919/989.md`; a targeted re-run of
that one file passed immediately, and `git status` was clean at both moments.
The scribe writes `src/decisions-data/*.md` in the main working tree while a
144-second suite is reading it. Before scheduling a repair for any scan over
`src/decisions-data/`, `docs/design/audit/` or `docs/probes/`, re-run that
single file. Main was green at `8cce6a8d`.

**Verdict ledgers rot faster than the code they grade — check the sheet's own
comments before scheduling a row.** `w14-sf` filed the CFP dock's
`Save draft` vs the frame's `Draft` as a live divergence;
`src/routes/public/cfp.css.ts` had already ruled it in-sheet ("one control,
one name at every width — the frame's 'Draft' is a drawing abbreviation, not
a label to ship", DEC-613 wave-96). Likewise `settings-v12.md`'s `:444` row
was stale last wave. A ledger row is a claim about the tree, not a fact:
re-derive, and read the owning file's comment block, before spending a lane.

**The 390 verdict sweep is COMPLETE; waves from here are fixes, not
measurement.** Every one of the 53 phone frames and the 4 landed-Speakers
desktop frames now carries a render-through-the-route verdict across
`w13-r*`, `w14-s*` and the Settings/Comms ledgers. All 31 machine-derived
campaign ceilings in `scripts/exit-predicate.ts` read DECLARED 0 / TARGET 0.
What remains is (a) building the DIVERGES rows, (b) recording the ones that
fail on the merits as DEVIATIONS, and (c) the five DEC-069 slots, which a
verification wave fills — no worker task can.

**Where the unmerged verdicts live.** `w14-sb..sh` are committed and
UNMERGED; their ledgers are readable with `git show v12m-w14-s<x>:<path>`
(`docs/design/audit/{submissions,speakers,portal,public-390-verdicts,
account-docs,speakers-desktop}-v12.md`, plus verdicts filed in test-file
headers for Agenda, Overview and Home, which have no audit doc). Read them
from the branch, not from `main`, until the train lands them.
