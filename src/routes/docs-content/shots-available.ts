// WRITTEN BY scripts/docs-shots.ts after a successful shoot (DEC-518
// amendment, wave 4). This file must NEVER be hand-extended: the only
// legal edits are (a) the script overwriting it with the sorted list of
// shot ids it actually captured against a real, seeded `npm run dev`, or
// (b) emptying it back to `[]`, which is always legal (it just returns
// every docs figure to its named placeholder -- see
// src/routes/docs-site.tsx's figure block renderer). A hand-added id here
// with no PNG on disk would silently 404 an <img> the reader can't get
// back from; that's why this is generated, not maintained.

export const DOCS_SHOTS_AVAILABLE: readonly string[] = ["for-reviewers-reviewing-start-to-finish-01","for-reviewers-reviewing-start-to-finish-02","for-speakers-your-speaker-portal-01","for-speakers-your-speaker-portal-02","getting-started-start-here-01","running-an-event-agenda-and-publishing-01","running-an-event-agenda-and-publishing-02","running-an-event-agenda-and-publishing-03","running-an-event-call-for-papers-and-submissions-01","running-an-event-call-for-papers-and-submissions-02","running-an-event-embeds-and-public-pages-01","running-an-event-embeds-and-public-pages-02","running-an-event-speakers-tasks-and-content-01","running-an-event-speakers-tasks-and-content-02","running-an-event-speakers-tasks-and-content-03","running-the-software-running-the-software-01","running-the-software-running-the-software-02","your-contacts-contacts-pipeline-and-comms-01","your-contacts-contacts-pipeline-and-comms-02","your-contacts-contacts-pipeline-and-comms-03"];
