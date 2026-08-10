# Customer clarifications (Discord, 2026-08-08/09)

swyx's answers to competitor questions in the Kill My SaaS Discord. **These are the
highest-fidelity requirement statements we have** — they override the brief and the
Sessionboard reference docs where they differ. Paraphrases stay close to verbatim.

## Scope reductions

- **Accelevents integration: skip it.** "skip accelevents its fine, like i said its not
  required." (The brief listed it as primary; it is out.)
- **Calendar invites: a standards-compliant .ics email is sufficient** for
  Gmail/Outlook/iCal — "ics good enough." No calendar-API integration. Detail: the
  initial invite usually has **no room**; the room is assigned later — so invite
  *updates* (same UID, bumped SEQUENCE) are the flow that matters.
- **Conditional form logic: "conditional fine for now"** — basic show/hide is enough.
- **"Category routing" means tracks:** "talks are submitted to one or more tracks, and
  reviewers review one or more tracks."
- **Minimum review workflow:** "unreviewed → approve/maybe/deny". Bonus: "being able to
  email speaker from inside the app to ask for changes/attach feedback when sending the
  approve/deny decision."
- **Schedule:** day/room views + drag-and-drop + conflict detection "is enough".
- **Airtable: nice-to-have, not a minus if unused.** Read-only is fine — "they like to
  setup automations that happen on airtable once a new row lands." Never the primary DB.
- **Open source is not a hard requirement** ("no it is not but we'd like to use your code
  if you win"). Ticketing/registration: not wanted.
- **Admin UI first; agentic interface is bonus** — "most of the AIE team is used to
  admin ui."

## Scope confirmations

- **Emails must actually send on an MVP basis** ("it's easy to setup with cloudflare
  email or resend") — not stubbed in the final product. (Stage 1 builds the full comms
  surface against a dev sink; the real provider is stage-2 wiring.)
- **Acceptance auto-creates** the speaker record, the session, and the onboarding tasks
  ("yes").
- **Must-have onboarding tasks:** hotel stay requirement form; flight reimbursement form.
  Optional examples: finalize talk description; finalize bio/photos; announce
  participation; invite colleagues with a speaker discount.
- **Accepted speakers can keep editing their submission**; close-date edit locks exist in
  most tools "but we dont really use that."
- **Single CFP form with track options** is right; multiple forms creatable after.
  Co-speakers each getting portal accounts: "up to you whatever is easier… nice to have."
- Calendar invites: **no video link; room details when available.**

## Who judges, and how

- The eval kit "is **NOT** the final list of llm evals, NOR is this what the real final
  judge (the tools buyer human) will focus on" — it is self-check tooling.
- The buyers are the AIE team: "**they are not technical at all; they are event
  production professionals** that just want to use software to make their lives easier,
  the 'eval' is partially that i will put it in front of them and they will actually
  use it."
- Tiebreaker: "whoever has made subjective judgment calls for the product that we would
  actually use/buy."
- "Blindly copying the screens/forms but they dont work will not be in the spirit of the
  competition" — use product sense; screens must *work*.
- Bonus points: Cloudflare infra (mild), Airtable persistence, speed ("we do not want
  slow SaaS pls"), an API (Sessionboard's is at sessionboard.mintlify.app).

## Context

- Sessionboard costs the team **>$40k/year** and they use only a subset.
- Sessionboard's own UX is a known weakness — a competitor called it "a maze of tabs and
  buttons with no clear order." Being *clearer* is a real requirement (SPEC.md §2.1).
- The team runs multiple events per year sharing one speaker network (the CRM matters).

## Field wisdom adopted into the spec (from Gene Kim's 12-year archive analysis)

Baked into SPEC.md as design choices: per-submission permalinks; "fewest ratings first"
and "average score descending" as the two core review sorts; warn-never-block scheduling
(TBD is a real value, partial states always save); stable IDs everywhere with
`title_at_time`/`org_at_time` frozen at submission; .ics UIDs that never churn; the
post-acceptance content loop (versions, comments, materials states) as a first-class
surface; decide ≠ notify. His adapt-with-caution ideas live in SPEC.md §10 nice-to-haves.
