# 2026-08-12 task-w12-e — doc-truth repair (DEC-428) @ 0022580b3069ad14f1dcd8bca9f3029b088ed3ad

Full detail for the `## 2026-08-12 task-w12-e — doc-truth repair (DEC-428) @ 0022580b3069ad14f1dcd8bca9f3029b088ed3ad` section
of `docs/verification-log.md` (extracted per the contention-decomposition of
that file; see the stub entry there for `OPEN ITEMS` / `RESULT` summary).

Docs-only lane (no source/test/script changed). Full detail in
`docs/verification-log/task-w12-e-doc-truth.md`. Audited sha
`0022580b3069ad14f1dcd8bca9f3029b088ed3ad` ("scribe wave 12").

(1) SPEC.md:308 amended: the stale "≥600k iterations" bullet now reads
"100,000 iterations, the workerd production ceiling; DEC-004/DEC-237" —
matching the binding amendment in `decisions/DEC-004.md` and
`decisions/DEC-237.md` that five prior spec audits had each re-raised and
closed as "binding amendment, not a gap" without ever editing the prose.
One line changed in SPEC §6; nothing else in §6 touched.

(2) README.md "For evaluators" persona table byte-diffed against
`docs/fixtures/sample-data.json`'s `organizer`/`speaker`/`speaker2`/
`reviewer` objects (the same fixture `scripts/seed.ts` and
`scripts/render-sweep.ts` read) — all four rows (email + password) match
exactly, as do the three rows in the "Live demo" table. No drift found;
README.md unchanged. Quickstart command block (README.md:43-46: `npm i` /
`npm run db:migrate` / `npm run seed` / `npm run dev`) confirmed verbatim
against `package.json`'s `db:migrate`/`seed`/`dev` scripts; no drift.

(3) Searched README.md for the "600k" figure — not present; nothing to
correct.

`npm run build` PASS. `npm test --silent` PASS — unchanged from before this
docs-only edit, as expected.

OPEN ITEMS: 0

RESULT: PASS — SPEC.md:308 corrected to the implemented, DEC-004/DEC-237-cited
value; README.md evaluator credentials and quickstart confirmed byte-accurate
with no drift to repair.
