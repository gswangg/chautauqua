import type { DocsArticle } from "./types";

export const contactsPipelineAndComms: DocsArticle = {
  slug: "contacts-pipeline-and-comms",
  group: "your-contacts",
  title: "Your contacts: directory, pipeline and comms",
  standfirst:
    "The contacts directory is org-wide and continues after each event. A sourcing pipeline records possible speakers before they submit. A segment is a saved filter that you can use again. When you compose to a segment, a dedupe period stops a second send that occurs by accident.",
  blocks: [
    { kind: "heading", text: "The directory and an event roster" },
    {
      kind: "prose",
      text: "Each contact — added manually or with a CSV import — lives in one org-wide directory, not in one event. When you add a contact to the directory, the contact does not go onto an event. A contact shows on the roster of an event only after a connection that you make. A connection is a submission, a pipeline enrollment that you push across, or an import that you attach to the event. The directory is the one location where a person is recorded. An event roster is a view of the persons who are attached to that event.",
    },
    { kind: "heading", text: "Importing a CSV" },
    {
      kind: "prose",
      text: "The import wizard maps the columns of your file onto contact fields: the built-in fields plus each custom field. Then it runs a dry-run plan before it writes data. The wizard flags a row that matches a contact in the directory as a possible duplicate. Each flagged row gets its selection — not one decision for the full file. 'Import as new', the default, keeps the row as a new contact. Or you can select 'Merge into <name> (<email>)' to fold the row into that one contact.",
    },
    {
      kind: "figure",
      shotId: "your-contacts-contacts-pipeline-and-comms-01",
      caption:
        "A possible-duplicate row in the import wizard: 'Import as new' next to one radio control for each merge alternative. You make the decision for each row independently.",
    },
    {
      kind: "prose",
      text: "To attach an import to an event is a selection that you make, not a side effect of the import. You select the event before you run the import. Only then do the imported rows go onto the roster of that event and also into the directory. If you do not select an event, the contacts go into the directory only. Use this when you collect contacts and do not do work on one event.",
    },
    { kind: "heading", text: "The sourcing pipeline" },
    {
      kind: "prose",
      text: "The pipeline is a board for the persons that you contact as possible speakers. It is not the accept and decline flow of the call for papers: you use it before a person sends a submission. When you enroll a contact, the card goes into Identified. From there, the card moves through Contacted, Interested, and Confirmed, or to Declined. You move a card with a drag or with its Move-to control, and the Move-to control is the step that saves the change. Each card can have a fit score, a recorded cause, and a note log. Thus, the card shows why it is where it is.",
    },
    {
      kind: "figure",
      shotId: "your-contacts-contacts-pipeline-and-comms-02",
      caption:
        "The columns of the pipeline board — Identified, Contacted, Interested, Confirmed, Declined. Each card shows its fit score and the time that it has stayed in its column.",
    },
    { kind: "heading", text: "Segments: a saved filter that you can use again" },
    {
      kind: "prose",
      text: "You can apply a filter to the directory by tag, by company, or by custom field. You can save that filter as a segment: a named view that you can use again. You can apply a segment again, or send it directly to compose. A segment does not make a copy of contacts. It is a saved set of rules, and each use applies the rules to the live directory again. Thus, a segment always shows the persons who match at that time, not a snapshot from the time of the save.",
    },
    { kind: "heading", text: "Composing to a segment" },
    {
      kind: "prose",
      text: "Compose starts from a template, fills in the merge fields for each recipient, and sends to all persons that the segment matches at that time. If compose cannot fill a placeholder in the template, it rejects the template before a message goes out. No recipient gets the text '{missing_field}' in their mail.",
    },
    {
      kind: "list",
      items: [
        "'sent' — the number of messages that went out in this run.",
        "'skipped' — the recipients that the dedupe period held back in this run.",
        "'remaining' — the recipients that this run did not send to. Run compose again to continue from that point.",
      ],
    },
    {
      kind: "prose",
      text: "The 'skipped' number comes from the one-hour dedupe period. This period stops a second send to the same recipient with the same filled-in subject in the hour after the last correct send. Thus, a compose that runs again does not mail a person two times with the message that they got before. This period is a safety limit that does not change. You cannot adjust it for each send.",
    },
    {
      kind: "figure",
      shotId: "your-contacts-contacts-pipeline-and-comms-03",
      caption:
        "The compose result after a send: 'sent', 'skipped', and 'remaining' shown independently, not folded into one number.",
    },
  ],
};
