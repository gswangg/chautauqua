# task-w18-c: paginate the contact directory in SQL

DEC-333, DEC-336. Rewrote `listContactsForOrg` (src/server/repo/contacts/crud.ts)
so the default directory/search/sort/paging path (no segmentId, no rules)
issues exactly two SQL statements — a `count(*)` and a paginated
`select().orderBy().limit().offset()` — with no JS filter/sort/slice. The
DEC-266 search predicate (AND-across-tokens x OR-across-columns over
firstName/lastName/email/company) moved fully into SQL via a new
`likeContains` helper (src/server/repo/contacts/query.ts) that lowercases
and escapes `\ % _`, paired with `LIKE ... ESCAPE '\\'` at each call site.
`matchesContactQuery` (src/domain/contacts.ts) — the old in-memory
superset-narrowing predicate it replaced — was deleted (no callers left).
The segmentId/rules path is unchanged in shape (load matching rows, run
`matchesSegment` in JS for `custom.*` support SQL can't express) but now
rides the same exact SQL `q` predicate instead of the old OR-superset
prefilter.

## Commands run

```
npm run build
npm test --silent
npm run db:migrate
npm run seed
npx wrangler dev --port 8797
```

## Unit / integration tests

- `npx vitest run test/contacts-search.test.ts test/contacts-repo.test.ts` — 25 passed.
- Full suite: `npm test --silent` — 226 files / 1885 tests passed.
- `npm run build` — tsc (root + app tsconfig) + vite build, clean.
- Collateral fix: test/contacts-import.test.ts's fake in-memory `Db` (not an
  owned file, but broke on the new orderBy/limit/offset/count(*) shape) was
  extended to support `.orderBy()` (no-op), `.limit()`/`.offset()`
  (in-memory slice), and `select({...})` aggregate selects where a field
  value isn't a real `schema.contact` column (treated as `count(*)`,
  returning one row of `{ [key]: filteredRows.length }`). No assertions in
  that test changed; it still exercises the real repo write+read path
  through the real contactsRoutes sub-app.

## Live probe (PORT 8797, seeded organizer sbek-organizer@example.com)

Seeded org has 31 contacts total (`total: 31` from GET /api/v1/contacts).

(a) `q=Alex Delgado` (exact firstName+lastName of seed_synth_contact_0001) ->
    `total: 1`, `items[0].id = seed_synth_contact_0001`. PASS.

(b) `q=Alex Abernathy` (firstName of contact 0001 x lastName of a different
    contact, seed_synth_contact_0012 = Lane Abernathy) -> `total: 0`,
    `items: []`. Confirms AND-across-tokens (not OR) still holds under the
    all-SQL predicate — the DEC-266 regression. PASS.

(c) `sort=name&perPage=5`, page=1 vs page=2: both report `total: 31`;
    page=1 ids = [seed_synth_contact_0012, _0016, _0020, _0024, _0001],
    page=2 ids = [seed_synth_contact_0005, _0009, _0013, _0017, _0021].
    Identical total, disjoint id sets. PASS.

(d) `q=%25` (literal `%`) -> `total: 0` (not 31/everything). Confirms
    likeContains' escaping of `%` via `ESCAPE '\\'` prevents a literal `%`
    search term from degenerating into a wildcard match-all. PASS.

(e) `rules=[{"field":"company","op":"eq","value":"Northwind Systems"}]`
    (URL-encoded, DEC-149 route parsing) -> `total: 3`, all three returned
    contacts (seed_synth_contact_0001/0021/0011) have
    `company: "Northwind Systems"`. Confirms the segmentId/rules
    whole-directory path (DEC-336) still filters correctly on the new SQL
    `q`-predicate base. PASS.

OPEN ITEMS: 0
RESULT: PASS
