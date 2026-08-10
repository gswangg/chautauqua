# Requirement sources

Everything the product is built against, vendored into the repo so it is fully
accessible during development. **SPEC.md (repo root) is the synthesized authority**;
when sources conflict, this is the order of precedence:

1. [`clarifications.md`](clarifications.md) — the customer's (swyx's) direct answers to
   requirement questions. Highest fidelity; overrides everything below.
2. [`brief.md`](brief.md) — the competition brief: primary feature list, judging, bonus
   points, and ~40 annotated UI screenshots in [`brief-images/`](brief-images/) (the
   visual reference for what each screen must accomplish — functionality, not pixels).
3. [`sessionboard-reference/`](sessionboard-reference/) — detailed behavioral
   documentation of Sessionboard (the product being replaced), per feature area:
   personas, journeys, filled-state expectations, limits. Start with
   `00-how-sessionboard-works.md`. From the sbek eval kit (swyx's, adapted).
4. [`eval-rubric/`](eval-rubric/) — the sbek grading rubrics (7 YAML areas: scenarios,
   rubric items, pass criteria, evidence). This is the **regression floor**: the SPEC's
   bracketed IDs (CFP-01, ABS-05, EMB-14…) resolve here. Build to SPEC.md; verify
   against these.
5. [`fixtures/`](fixtures/) — the eval's fixture data (DevFlow Conf 2027: event, four
   personas, submissions, tasks, CSV, headshot, slides). **The seed script should mirror
   these values** so graders find populated screens with the exact names and titles the
   judge looks for.

Provenance: items 3–5 are vendored from swyx's `killmysaas-evals` repo
(forge.smol.ai/swyx/killmysaas-evals) for the Kill My SaaS competition; item 2 from the
competition brief document. Re-sync before final submission — the eval kit gets updates.
