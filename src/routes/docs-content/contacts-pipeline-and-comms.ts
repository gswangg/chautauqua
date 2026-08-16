import type { DocsArticle } from "./types";

export const contactsPipelineAndComms: DocsArticle = {
  slug: "contacts-pipeline-and-comms",
  group: "your-contacts",
  title: "Your contacts: directory, pipeline and comms",
  standfirst:
    "The contacts directory is org-wide and outlives any one event. A sourcing pipeline tracks possible speakers before they submit. A segment saves a filter for reuse. When you compose to a segment, a dedupe window stops accidental double sends.",
  blocks: [
    { kind: "heading", text: "The directory versus an event roster" },
    {
      kind: "prose",
      text: "Every contact — added by hand or with a CSV import — lives in one org-wide directory, not inside a single event. When you add a contact to the directory, the contact does not go onto an event. A contact shows on the roster of an event only after an explicit connection. A connection is a submission, a pipeline enrollment that you push across, or an import that you attach to the event. The directory is the one place where a person exists. An event roster is a view of the people who are attached to that event.",
    },
    { kind: "heading", text: "Importing a CSV" },
    {
      kind: "prose",
      text: "The import wizard maps the columns of your file onto contact fields: the built-in fields plus any custom field. Then it runs a dry-run plan before it writes anything. The wizard flags a row that looks like an existing contact as a possible duplicate. Each flagged row gets its own choice — never one blanket decision for the whole file. 'Import as new', the default, keeps the row separate. Or you can pick 'Merge into <name> (<email>)' to fold the row into one specific existing contact.",
    },
    {
      kind: "figure",
      shotId: "your-contacts-contacts-pipeline-and-comms-01",
      caption:
        "A possible-duplicate row in the import wizard: 'Import as new' next to one radio control per merge candidate. You decide each row on its own.",
    },
    {
      kind: "prose",
      text: "To attach an import to an event is a separate, explicit choice, not a side effect of the import. You choose the event before you run the import. Only then do the imported rows land on the roster of that event as well as in the directory. If you do not choose an event, the contacts land in the directory only. Use this when you build your address book and do not staff a specific event.",
    },
    { kind: "heading", text: "The sourcing pipeline" },
    {
      kind: "prose",
      text: "The pipeline is a board for the people that you pursue as possible speakers. It is separate from the accept and decline flow of the call for papers, because it is for outreach before a person submits anything. When you enroll a contact, the card lands in Identified. From there, the card moves through Contacted, Interested, and Confirmed, or to Declined. You move a card with a drag or with its Move-to control, and the Move-to control is the step that persists the change. Each card can carry a fit score, a rationale, and a running note log, so the reasons for its position are recorded.",
    },
    {
      kind: "figure",
      shotId: "your-contacts-contacts-pipeline-and-comms-02",
      caption:
        "The columns of the pipeline board — Identified, Contacted, Interested, Confirmed, Declined. Each card shows its fit score and its age in the current stage.",
    },
    { kind: "heading", text: "Segments: saving a filter as a reusable view" },
    {
      kind: "prose",
      text: "You can filter the directory by tag, by company, or by custom field. You can save that filter as a segment: a named, reusable view. You can apply a segment again later, or send it straight to compose. A segment does not copy contacts anywhere. It is a saved set of rules, and each use evaluates the rules against the live directory again. So a segment always reflects the people who match now, not a snapshot from the save time.",
    },
    { kind: "heading", text: "Composing to a segment" },
    {
      kind: "prose",
      text: "Compose picks up a template, fills in the merge fields for each recipient, and sends to every person that the segment currently matches. If the compose context cannot resolve a placeholder in the template, compose rejects the template before anything goes out. No recipient gets a literal '{missing_field}' in their mail.",
    },
    {
      kind: "list",
      items: [
        "sent — the count of messages that went out in this run.",
        "skipped — the recipients that the dedupe window held back in this run.",
        "remaining — the recipients that the send still owes. Run compose again to continue from that point.",
      ],
    },
    {
      kind: "prose",
      text: "The one-hour dedupe window produces the skipped count. The window blocks a second send to the same recipient with the same rendered subject within one hour of the last successful send. So a retried or repeated compose does not double-mail a person who already got the message. The window is a fixed safety limit. You do not configure it per send.",
    },
    {
      kind: "figure",
      shotId: "your-contacts-contacts-pipeline-and-comms-03",
      caption:
        "The compose result line after a send: sent, skipped, and remaining stated separately, never folded into one unclear count.",
    },
  ],
};
