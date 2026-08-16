import type { DocsArticle } from "./types";

export const contactsPipelineAndComms: DocsArticle = {
  slug: "contacts-pipeline-and-comms",
  group: "your-contacts",
  title: "Your contacts: directory, pipeline and comms",
  standfirst:
    "The contacts directory is org-wide and outlives any one event; a sourcing pipeline tracks people you're courting before they're speakers; segments save a filter for reuse; and composing to a segment sends one message with a dedupe window that stops you from double-mailing someone by accident.",
  blocks: [
    { kind: "heading", text: "The directory versus an event roster" },
    {
      kind: "prose",
      text: "Every contact you add — by hand, by CSV import, or picked up along the way — lives in one org-wide directory, not inside any single event. Adding someone to the directory does not put them on an event: a contact only shows up on an event's roster once something explicit connects them to it, like a submission, a pipeline enrollment you push across, or an import you've chosen to attach. The directory is where a person exists once; an event roster is a view of who's actually attached to that event.",
    },
    { kind: "heading", text: "Importing a CSV" },
    {
      kind: "prose",
      text: "The import wizard maps your file's columns onto contact fields — the built-ins plus any custom field — then runs a dry-run plan before it writes anything. Rows that look like an existing contact are flagged as possible duplicates, and each one gets its own disposition: 'Import as new' (the default) keeps it separate, or you can pick 'Merge into <name> (<email>)' to fold the row into a specific existing contact instead. Nothing is assumed on your behalf — every possible-duplicate row keeps its own choice, never one blanket decision for the whole file.",
    },
    {
      kind: "figure",
      shotId: "your-contacts-contacts-pipeline-and-comms-01",
      caption:
        "A possible-duplicate row in the import wizard, offering 'Import as new' alongside one radio per merge candidate — each row decided on its own.",
    },
    {
      kind: "prose",
      text: "Attaching an import to an event is a separate, explicit opt-in, not a side effect of importing: you choose the event before you run the import, and only then do the rows you're bringing in land on that event's roster as well as in the directory. Import without choosing an event and the contacts land in the directory only — exactly what you want when you're building your address book rather than staffing a specific conference.",
    },
    { kind: "heading", text: "The sourcing pipeline" },
    {
      kind: "prose",
      text: "The pipeline is a board for tracking people you're courting as potential speakers, separate from the CFP's own accept/decline flow — it's for outreach before anyone's submitted anything. Enroll a contact and they land in Identified; from there a card moves through Contacted, Interested and Confirmed (or Declined) as you work them, either by dragging a card or using its Move-to control, which is what actually persists the change. Each card can carry a fit score and rationale, and a running note log, so the reasoning behind where someone sits doesn't live only in your head.",
    },
    {
      kind: "figure",
      shotId: "your-contacts-contacts-pipeline-and-comms-02",
      caption:
        "The pipeline board's columns — Identified, Contacted, Interested, Confirmed, Declined — each card showing its fit score and age in the current stage.",
    },
    { kind: "heading", text: "Segments: saving a filter as a reusable view" },
    {
      kind: "prose",
      text: "Filter the directory down — by tag, company, custom field, whatever combination you need — and you can save that filter as a segment: a named, reusable view you can reapply later or hand straight to compose. A segment doesn't copy contacts anywhere; it's a saved set of rules that's re-evaluated against the live directory each time you use it, so it always reflects who currently matches, not a snapshot from when you saved it.",
    },
    { kind: "heading", text: "Composing to a segment" },
    {
      kind: "prose",
      text: "Compose picks up a template, fills in merge fields per recipient, and sends to everyone the segment currently matches. A template with a placeholder the compose context can't resolve is rejected before anything goes out, rather than mailing someone a literal '{missing_field}'.",
    },
    {
      kind: "list",
      items: [
        "sent — how many messages actually went out this run.",
        "skipped — recipients held back by the dedupe window, not sent this run.",
        "remaining — recipients the send still owes; run it again to pick up where it left off.",
      ],
    },
    {
      kind: "prose",
      text: "The one-hour dedupe window is what produces the skipped count: the same recipient and the same rendered subject won't be sent again within an hour of the last successful send. That's what keeps a retried or re-run compose from double-mailing someone who already got the message — it's a safety net, not something you configure per send.",
    },
    {
      kind: "figure",
      shotId: "your-contacts-contacts-pipeline-and-comms-03",
      caption:
        "The compose result line after a send: sent, skipped and remaining stated separately, never folded into one ambiguous count.",
    },
  ],
};
