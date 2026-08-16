import type { DocsArticle } from "./types";

export const contactsPipelineAndComms: DocsArticle = {
  slug: "contacts-pipeline-and-comms",
  group: "your-contacts",
  title: "Your contacts: directory, pipeline and comms",
  standfirst:
    "One directory of people, shared by every event you run: this page covers the sourcing pipeline, saved segments, and the compose tools that send email without double sends.",
  blocks: [
    { kind: "heading", text: "The directory and an event roster" },
    {
      kind: "prose",
      text: "Every contact, added by hand or through a CSV import, lives in one org-wide directory, not in any single event. Adding a contact to the directory does not put them on an event; a contact reaches a roster only through a connection you make. That connection is a submission, a pipeline enrollment you push across, or an import attached to the event. The directory is the one place a person is recorded; an event roster is just a view of the people attached to that event.",
    },
    { kind: "heading", text: "Importing a CSV" },
    {
      kind: "prose",
      text: "The import wizard maps your file's columns onto contact fields (the built-in fields plus every custom field) and runs a dry-run plan before it writes anything. Rows that match an existing directory contact are flagged as possible duplicates, and each flagged row gets its own choice rather than one decision for the whole file. The default, **Import as new**, keeps the row as a new contact; choosing a **Merge into** option folds the row into that existing contact instead.",
    },
    {
      kind: "figure",
      shotId: "your-contacts-contacts-pipeline-and-comms-01",
      caption:
        "A possible-duplicate row in the import wizard: **Import as new** beside one radio control for each merge option. You decide each row independently.",
    },
    {
      kind: "prose",
      text: "Attaching an import to an event is a choice you make, not a side effect of the import. You select the event before you run the import; only then do the imported rows go onto that roster as well as into the directory. If you select no event, the contacts go into the directory only, which is useful when you are collecting contacts without working on a particular event.",
    },
    { kind: "heading", text: "The sourcing pipeline" },
    {
      kind: "prose",
      text: "The pipeline is a board for the people you contact as possible speakers — not the accept-and-decline flow of the call for papers, but the stage before a person submits. An enrolled contact starts as a card in Identified and moves through Contacted, Interested, and Confirmed, or to Declined. You move a card by drag or with its **Move to** control, and the **Move to** control is what saves the change. Each card can carry a fit score, a recorded reason, and a note log, so the board shows why every card is where it is.",
    },
    {
      kind: "figure",
      shotId: "your-contacts-contacts-pipeline-and-comms-02",
      caption:
        "The pipeline board's columns: Identified, Contacted, Interested, Confirmed, Declined. Each card shows its fit score and how long it has been in its column.",
    },
    { kind: "heading", text: "Segments: a saved filter you can reuse" },
    {
      kind: "prose",
      text: "You can filter the directory by tag, company, or custom field, and save the filter as a segment: a named view you can reuse or send straight to compose. A segment does not copy contacts; it is a saved set of rules, and every use runs those rules against the live directory again. So a segment always shows the people who match right now, not a snapshot from when you saved it.",
    },
    { kind: "heading", text: "Composing to a segment" },
    {
      kind: "prose",
      text: "Compose starts from a template, fills in the merge fields for each recipient, and sends to everyone the segment matches at that moment. If compose cannot fill a placeholder, it rejects the template before any message goes out; no recipient ever sees the literal text `{missing_field}` in their mail.",
    },
    {
      kind: "list",
      items: [
        "**Sent** — the messages that went out in this run.",
        "**Skipped** — the recipients the dedupe window held back in this run.",
        "**Remaining** — the recipients this run did not send to. Run compose again to continue from that point.",
      ],
    },
    {
      kind: "prose",
      text: "The **Skipped** number comes from the one-hour dedupe window. For an hour after a successful send, the window stops any second send to the same recipient with the same filled-in subject. So a compose you run again never mails a person twice with a message they already got. The window is a fixed safety limit; you cannot adjust it per send.",
    },
    {
      kind: "figure",
      shotId: "your-contacts-contacts-pipeline-and-comms-03",
      caption:
        "The compose result after a send: **Sent**, **Skipped**, and **Remaining** reported separately, not folded into one number.",
    },
  ],
};
