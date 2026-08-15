## task-w31-a: files library headshot join perf (DEC-773 w31 amendment 3b)

QUALIFYING: SOLE OWNER of src/server/repo/files-library.ts; UNOWNED at main
`dbac66d1` (w29-b produced zero commits). Rewrote HEADSHOT_JOIN off a
`'/headshots/' || file.id` concatenation to `file.id = substr(headshot_url,
12) and substr(headshot_url,1,11)='/headshots/'` at all 3 call sites
(computeKindCounts, listEventDeliverableFiles, resolveHeadshotVersions).
INVALIDATED BY: src/server/repo/files-library.ts, src/server/repo/files.ts
RESULT: files library (page 1) BEFORE raw=485.4ms adjusted=481.1ms FAIL ->
AFTER raw=20.3ms adjusted=17.3ms PASS (budget(read)=50ms). ~24x raw / ~28x
adjusted improvement. Paired before/after, port 8894, sibling w31 lanes
concurrent (absolute load-inflated, delta is the grade per DEC-347 w31).
Full detail: docs/verification-log/task-w31-a-files-library-perf-39634fe8.md
OPEN ITEMS: DEC-773 wave-29 clause (1) SQL-aggregate totals NOT applied —
not needed, budget met by the join fix alone. reviewer queue / plan results
rows still FAIL post-fix — unrelated, owned by sibling w31 lanes.

MERGE NOTE (merge train, `merge task-w31-a`): this lane's PRODUCT CHANGE was
NOT taken. Its qualifying premise — "UNOWNED at main `dbac66d1` (w29-b
produced zero commits)", inherited verbatim from DEC-773's wave-31 amendment
— was false by the time the branch merged: task-w29-b landed as `c50e56f3`,
implementing DEC-773 wave-29 option (3) (`contact.headshot_file_id` FK +
indexed `contact_headshot_file_id_idx`, migration 0040), and measured the
same row 466.1ms -> 17.7ms PASS. Option (3b) was sanctioned as PREFERRED over
(3) solely because it was "migration-free and semantically identical"; with
(3) already landed that rationale is moot, and DEC-773's LATER wave-32
amendment controls: "contact.headshot_file_id is the ONE home for a
headshot's file id — no module re-derives it from the /headshots/<id>
string." The substr rewrite re-derives it. All five conflicts
(src/server/repo/files-library.ts and the four fake-db test modules) were
therefore resolved to HEAD's indexed-FK form, and this lane's
test/files-library-headshot-join.scan.test.ts was dropped because its scan
assertion pinned the exact predicate form wave-32 forbids. The two lanes
fixed one defect by two routes and reached equivalent numbers (17.7ms vs
17.3ms adjusted); the FK route is the one in force. No perf regression: the
row is fixed on main by w29-b.

