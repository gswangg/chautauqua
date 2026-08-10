# Field Guide

Owned by the swarm. The scribe appends lessons each wave and keeps this file
under a hard budget of 60 lines, compacting older entries when needed. Content
here is injected into every agent at spawn.

- SPEC.md is the source of truth on requirements — the jobs J1–J12 are the
  acceptance bar, the sbek rubric IDs are verification hooks, §2 product
  principles govern judgment calls. Underlying sources are vendored in docs/
  (precedence in docs/README.md): clarifications.md overrides all; brief.md +
  brief-images/ screenshots; sessionboard-reference/ behavior docs;
  eval-rubric/*.yaml (where rubric IDs resolve); fixtures/ seed data.
- Design decisions live in decisions/DEC-*.md and are binding; constants in
  src/decisions.ts are the compile-checked index.
- House invariants: fail loudly; status changes never auto-email; authz on
  every route, server-side visibility filtering for all public data.
- Eval rubrics/fixtures are requirements input, never a target to game: no
  fixture values or rubric IDs in product code — fixtures live only in the
  seed script; features work for arbitrary data.
- STAGE 1 (SPEC.md §0 "Build staging"): everything runs locally with zero
  secrets on wrangler dev. No deploys, no real email providers, no Airtable —
  external services go behind ports with local dev implementations (email →
  dev sink + email_log + dev mailbox route). Stage 2 wires platforms later.
- Wave 1 contracts are binding: DEC-003 owns table names + enum literals
  ('pending'|'accept_queue'|'decline_queue'|'accepted'|'declined'; task kinds
  'general'|'file_request'|'form'; file kinds
  'presentation'|'poster'|'handout'), DEC-004 owns the hash format
  'pbkdf2$v1$600000$salt$hash', DEC-005 owns the route map + admin nav. Use
  these exact strings; never invent parallel enums.
- Pure-core rule (DEC-002): src/{auth,domain,forms,mail,lib} must import
  nothing from node:, cloudflare, or drizzle — Web APIs only, typed on plain
  interfaces. That is what makes them testable under plain vitest and
  swappable in stage 2.
- package.json is shared-write in wave 1 (w1-a canonical list; w1-b/g/j add
  matching entries) — merge unions it. Everything else is single-owner per
  task. src/decisions.ts is scribe-owned; workers never edit it.
