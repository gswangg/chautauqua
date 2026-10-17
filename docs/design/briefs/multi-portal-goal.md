Implement multi-portal in Chautauqua (/Users/wednesdayniemeyer/Documents/gniemeyer/Projects/chautauqua): tested, deployed to chautauqua.cc, pushed to GitHub with CI green.

## Inputs
- Design: chautauqua/multiportal.zip. Import only `Chautauqua Portals.dc.html` and the README's "Multi-portal" section into docs/design/. Its other files are out of scope, and its Speakers frame and DESIGN-RULINGS.md are older than the repo's; never overwrite them.
- Brief: docs/design/briefs/multi-portal-brief.md. Its participation model is fixed.
- Parity: learn.sessionboard.com/portals/portals-101.

The mock describes the requirements; it isn't a strict spec. Match its visual language, but correct logical errors or missing states you find. Log every correction and gap decision with its reasoning.

## Scope
1. Data model: participations (a person's role on a session, or membership of a sponsor company), portals with rules, an item library, per-portal item settings, field permissions, capabilities, sponsor companies, tiers, entitlement slots, invitations. Migrate each event's existing portal into a "Profile basics" portal with the same note, field permissions and resources.
2. Every flow in the mock, at desktop and 390px phone where drawn: Settings portals and sponsorships, portals overview, portal editor, change preview, library modals, "not in any portal" view, person record, preview as participant, tiers, sponsor-session approval queue and review, participant homes, sponsor session lifecycle, invited-speaker acceptance, sponsor team.
3. Gaps to design and build:
    - Notifications: the change preview says who'll be emailed about new items and lets the organizer choose; people are emailed when they gain items; reminders cover portal items.
    - Copy portals and tiers from another event.
    - Duplicate and delete a portal.
    - Negative rule conditions ("is not", "is none of").
    - Item settings: per-portal name, allow edits after submitting, view-only once done, help text per field.
    - A share-kit item type for speaker and sponsor promotion.
4. An append-only audit_event table, written by preview-as-participant and sensitive portal actions (rule, permission and entitlement changes; approvals, declines), built for reuse app-wide.
5. Seed data on DevFlow Conf 2027 showing every flow: Gold and Silver sponsors, CFP and invited speakers, and Priya Raman with a CFP talk, an invited panel and a Gold sponsor contact role.

## Must not break
- Sponsor isolation: a sponsor contact never sees another sponsor's sessions, team, entitlements or data. Prove it with route-walking tests like the cross-org probes.
- Permission resolution: test rule matching, merging an item from two portals (earliest deadline, required if either requires it), strictest lock for profile fields, and finished work kept when someone loses a portal.
- Existing behavior: the full suite stays green, and existing speakers see exactly what they see today after the migration.

## Done means
- Everything above built, no TODOs in shipped paths, full suite green.
- A browser probe of every new flow at 1600px and 390px against the Portals frame; divergences fixed or logged as corrections.
- A browser regression check of the existing app at both widths (admin, public pages, CFP form, current portal): nothing that worked is broken.
- Deployed to chautauqua.cc with migrations applied, demo data added, live site checked; candidate also on localhost:8878.
- Pushed to GitHub main, CI green.
- A short report: what was built, corrections, gap decisions, test results, open questions.

## Rules
- Prod deploys are fine; there are no prod users. Add demo data idempotently; never wipe or reseed the prod database.
- Pushing to GitHub is fine; fix anything red in CI.
- Path-scoped git adds only; never `git add -A` or stash on main.
- Converge on this goal and stop: no open-ended hygiene work or extra test instruments.
