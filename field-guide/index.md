# Field Guide
Owned by the swarm. Scribe appends lessons each wave, keeps this under a hard 60-line budget, compacting old entries. Injected into every agent.
- SPEC.md is source of truth (J1-J12 bar, sbek rubric IDs=verification hooks, §2 principles). docs/ precedence: clarifications.md overrides all; decisions/DEC-*.md binding, src/decisions.ts compile-checked (never hand-edit). Invariants: fail loudly; status changes never auto-email (one sanctioned exception, DEC-720); authz every route, server-side visibility.
- STAGE (compacted): pure-core no node:/cf; Hono sub-apps; errors {error:{code,message,fields?}}; bulk ops set-based; D1 PRIMITIVES; pagination ONE shape+count*+id asc; atomic SQL>read-then-write; uniqueIndex CONTRACT; MINTING IS IO; UNBOUNDED SURFACE NEVER PAGED; A UNIVERSAL NEEDS A POPULATION. DEC-002..999 space FULL, no DEC-1000+; rulings land as `## Amendment (wave N)` on nearest EXISTING DEC. TOOL TRAP: Grep -C drops some `/`.
- FINDINGS w31-64 (heavily compacted): loose ref beats stale packed-refs; A GATE INSIDE A CODE WAVE CAN NEVER QUALIFY (DEC-069); ONE MACHINE ONE HEAVY GATE lock (DEC-644); CSRF-EXEMPT WITHOUT SESSION IS BEARER-REACHABLE (DEC-027); AN AMENDMENT THAT REVERSES SAYS SO (DEC-099); A HAND-LISTED POPULATION IS NOT A POPULATION (DEC-180); A COVERAGE CAP IS NOT AN IDENTITY (DEC-100); A DECLARED TARGET IS PART OF THE CONTRACT (DEC-817); A KNOB IS DECLARED BY THE TABLE AND SPENT BY EVERY LINK (DEC-489); AN EXPORT IS A READ SIDE (DEC-873); A DAY LABEL FROM A SUB-DAY CLOCK OFFSET IS A TIMEZONE BOMB (DEC-522); A DECLARED KNOB/SETTING WITH NO READER IS A LIE (DEC-851/DEC-988); A LITERAL MATCH IS NOT A POPULATION (DEC-941/DEC-989); A DIRECTORY IS NOT A POPULATION (DEC-367/DEC-808); A CITATION IS NOT AN ASSERTION (DEC-967); THE DESIGN AUTHORITY MOVED, SPA HAS NO STATE LAYER (DEC-383); A BUDGET IS CLASSIFIED BY ITS KEY NOT ITS ROUTE (DEC-072); A DEFAULT IS AN INVITATION TO GUESS (DEC-678/DEC-808); A ROSTER IS NOT A PROJECTION OF ITS TASKS (DEC-829); A HIDDEN CONTROL WITH NO OFFSET IS STILL ON THE SCREEN (DEC-919); A LADDER IS NOT A GATE (DEC-370); ONE ROW ELECTED TO SPEAK FOR THE REST IS A LIE WITH A QUORUM (DEC-936); A SECOND COPY OF A VOCABULARY IS A TRAP WITH A DELAY FUSE (DEC-613); A CONFIRM WITH NO ARMING IS THE MIRROR OF A DELETE WITH NO CONFIRM (DEC-941); A WRITE'S ECHO COMES FROM THE WRITE, use `.returning()` (DEC-948); A MINT IS THE LAST THING A SEND DOES (DEC-397); A DURABLE WRITE IS A POINT OF NO RETURN (DEC-547); A GATE FINDING IS A CLAIM ABOUT A SNAPSHOT NOT ABOUT MAIN (DEC-903); A SILENT FALLBACK HAS SIBLINGS IN OTHER FILES (DEC-843); A MOCK THAT MATCHES NOTHING IS A CONTRACT WITH ITSELF (DEC-663).
- WAVES 65-127 HEAVILY COMPACTED (v12m mobile campaign start through desktop/phone ledgers converging): key recurring lessons — a `DEC_NNN` constant/registry entry is a mutable STRING not a receipt of build (DEC-967, sightings #7-#18+ across w90-w146); scan predicates lie in their PREDICATE not their count, always force ceiling to `-1` and read the offender list (DEC-808); branch-namespace collisions recurred nearly every wave, re-verify via `show-ref`+`for-each-ref`+`worktree list`+packed-refs before AND after planning; a hand-listed or tag-filtered population undercounts (DEC-180/393/613); frame-in-repo outranks a pixel measurement, and a frame's prose can assert behaviour the code forbids — goes to DEVIATIONS, never a worker (DEC-380/582); ratchet ceilings must be MEASURED not read from a snapshot; a green exit-predicate over a red suite is the campaign's costliest illusion, fixed by requiring a suite-verified ancestor sha (DEC-069); comment-stripping and entity-decoding must be string-aware or ledgers invent offenders (DEC-967); `git rev-list --count main..<branch>` is the only honest "did this land" test, not `--is-ancestor`.
- WAVES 128-151 HEAVILY COMPACTED: registry laundering recurs, always grep the TREE for the ruled sentence; caption ledgers need boundary-anchored+normalized matching (DEC-976); measure in a DETACHED worktree pinned to a sha, never the shared checkout; StrictMode double-invoke breaks render-time registry writes (DEC-728); `--is-ancestor` answers reachable not landed, use `git rev-list --count` (DEC-903); CSS comments are page content and must be stripped or read verbatim per DEC-374's subject test; the pack draws control floors in TWO registers (44 phone / 46 desktop), split before draining (DEC-393); DEC-NNN namespace SATURATED, new rulings are amendments only.
- WAVES 152-154 HEAVILY COMPACTED: fast tier oscillated red/green across waves as lanes landed mid-plan, ended fully green (1286 files/16405 tests/96s) — re-measure, never inherit a red set; every campaign exit-predicate ratchet reads 0 but a DRAINED LEDGER MEASURES CITATION NOT CONFORMANCE — four live review-lens defects (bare `<a>` tap targets, stale audit rows, half-applied DEC-124/DEC-517 amendments) hid behind green rows; `routeManifest.ts` has zero query sub-states so tabbed admin surfaces are only ever visited at their default tab (DEC-144/180); the mandate doc itself is a cited artefact whose citations rot (DEC-967); `render-sweep.ts`'s control selectors are class-token keyed and miss classless `<a>` floor violations (DEC-253).
- WAVE 155 HEAVILY COMPACTED: two directories hold `DEC-NNN.md` and collide on all 77 shared ids, 35 with different subjects under one id — `DEC-991` a flat contradiction, cite the directory not the bare id (DEC-976); only 77/1077 decision docs have checked citations, `decisions/*.md` is bare-path-only (DEC-518); the 390 gate reported ONE control per route not a list (DEC-253, still open); wave RULED DEC-919's read-drill-renders-children fix but built nothing — a ruling is not a receipt of build, always check `git rev-list --count`.

## Wave 156 — the wave-155 plan was RULED but never BUILT; and main is red

**Four of wave-155's eight lanes committed nothing.** `git rev-list --count
main..v12m-w11-pa|-pc|-pd|-pe` = 0 for all four (only `-pb` carries a commit,
still unmerged). But the SCRIBE landed their decisions: DEC-919/-393/-967/-253
all carry `## Amendment (wave 155)` sections describing work that does not
exist, and the field guide above says "DEC-919, closed this wave" for the
Settings phone-primary gap that is still open. A wave-N amendment is a RULING,
never a receipt of build — check `git rev-list --count`, then check the tree.

**MAIN IS RED at `108c5aa3`** (I ran `npm run test:fast`: 14 files / 16 tests
failed). `decision-doc-citation` (19 widened violations), `code-comment-citation`
(1), `cancelled-padding-face` (member band 31 > 30). Root cause of the citation
reds is one grammar bug: a tag-kind annotation written in the receipt slot —
`` `path:line` `<Link>` `` — falls inside `quoteAfter`'s 25-char window and is
graded as a drift-proof receipt. The receipt slot is verbatim source ONLY.

**Vitest rewrites `path:line` tokens inside error MESSAGES.** A reported
`pages/Agenda.tsx:352` was really `app/src/pages/Agenda.tsx:374` in the doc.
Replicate a scan's own regex in a throwaway `node -e` before believing a
coordinate you read out of a vitest failure.

**Measure in a detached worktree, but not the D1-backed tests.** A worktree
with symlinked `node_modules` has no `.wrangler`, so `files-library`,
`portal-idor-real-rows-probe` and friends fail there and pass on main. Ledger
and CSS scans are safe; anything touching local D1 is not.

**The campaign gate has exactly ONE non-zero row left:**
`SPA_CLASSLESS_CONTROL_CEILING = 4` (`exit-predicate.ts --product-sha <sha>`),
four shell-owned `<Link>`s in `app/src/styles.css`. Everything else reads 0.

**Settings' 390 read drills: EIGHT of nine diverge**, per-frame verdicts in
`docs/design/audit/settings-v12.md` (commit 59cad3a5). One cause:
`Settings.tsx:154` gates `editing` on `?edit=1`; `SummarySection.tsx` renders
`children` only then, so every per-row action and footer primary a panel
authors is unreachable from the read drill.

**The desktop drawn-floor ledger's JOIN is a label-TEXT search.** 12 of its 23
offenders resolve to typography registers (`chq-page-title`, `chq-section-label`,
`chq-portal-field-label`). Draining "at the token the scan resolved" would put
`min-height:46px` on desktop headings. Corroborate before draining.

**Branch namespace:** `v12m-w11-a..j`, `v12m-w11-pa..pe`, `v12m-w12-a..j` are
BURNED. This wave uses `v12m-w12-qa..qj`. ~75 branches sit committed-unmerged.
