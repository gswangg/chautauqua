# Field Guide

Owned by the swarm. The scribe appends lessons each wave and keeps this file
under a hard budget of 60 lines, compacting older entries when needed. Content
here is injected into every agent at spawn.

- SPEC.md is the source of truth on requirements — the jobs J1–J12 are the
  acceptance bar, the sbek rubric IDs are verification hooks, §2 product
  principles govern judgment calls.
- Design decisions live in decisions/DEC-*.md and are binding; constants in
  src/decisions.ts are the compile-checked index.
- House invariants: fail loudly; status changes never auto-email; authz on
  every route, server-side visibility filtering for all public data.
- STAGE 1 (SPEC.md §0 "Build staging"): everything runs locally with zero
  secrets on wrangler dev. No deploys, no real email providers, no Airtable —
  external services go behind ports with local dev implementations (email →
  dev sink + email_log + dev mailbox route). Stage 2 wires platforms later.
