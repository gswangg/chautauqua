// Overview worklist card definitions (DEC-030). Pure mapping from the
// GET /api/v1/events/:eventId/overview payload to the six nav-order cards
// the SPA renders — kept separate from Overview.tsx so the count/sentence/
// link mapping is unit-testable without rendering React.

export interface OverviewPayload {
  triage: { pending: number; accept_queue: number; decline_queue: number };
  review: { plans: number; evaluationsSubmitted: number };
  speakers: { contactsOwing: number; overdueAssignments: number };
  content: { awaitingApproval: number };
  agenda: { unplaced: number; conflicts: number };
  comms: { sentLast7Days: number; lastSentAt: number | null };
}

export interface OverviewCard {
  key: 'triage' | 'review' | 'speakers' | 'content' | 'agenda' | 'comms';
  title: string;
  count: number;
  sentence: string;
  link: string;
  zeroSentence: string;
}

/** Maps the overview payload to the six worklist cards, in nav order
 * (Triage, Review, Speakers, Content, Agenda, Comms), each carrying a
 * headline count, a plain-language sentence, and a link into the section
 * that clears it. Zero states say what to do next. */
export function buildOverviewCards(payload: OverviewPayload): OverviewCard[] {
  const triageCount = payload.triage.pending + payload.triage.accept_queue + payload.triage.decline_queue;
  const reviewCount = payload.review.plans - payload.review.evaluationsSubmitted > 0
    ? payload.review.plans - payload.review.evaluationsSubmitted
    : 0;
  const speakersCount = payload.speakers.contactsOwing;
  const contentCount = payload.content.awaitingApproval;
  const agendaCount = payload.agenda.unplaced + payload.agenda.conflicts;
  const commsCount = payload.comms.sentLast7Days;

  return [
    {
      key: 'triage',
      title: 'Triage',
      count: triageCount,
      sentence:
        triageCount > 0
          ? `${payload.triage.pending} submission${payload.triage.pending === 1 ? '' : 's'} waiting for triage, ${payload.triage.accept_queue} in the accept queue, ${payload.triage.decline_queue} in the decline queue.`
          : 'Every submission has moved past triage.',
      zeroSentence: 'Open your CFP form to bring in submissions.',
      link: '/submissions?status=pending',
    },
    {
      key: 'review',
      title: 'Review',
      count: reviewCount,
      sentence:
        payload.review.plans === 0
          ? 'No evaluation plans set up yet.'
          : `${payload.review.evaluationsSubmitted} of ${payload.review.plans} evaluation plan${payload.review.plans === 1 ? '' : 's'} have submitted evaluations.`,
      zeroSentence: 'Set up an evaluation plan to start reviewing.',
      link: '/review',
    },
    {
      key: 'speakers',
      title: 'Speakers',
      count: speakersCount,
      sentence:
        speakersCount > 0
          ? `${speakersCount} speaker${speakersCount === 1 ? '' : 's'} owe you a task, ${payload.speakers.overdueAssignments} overdue.`
          : 'No speakers owe outstanding tasks.',
      zeroSentence: 'Assign tasks to speakers to track what they owe.',
      link: '/speakers',
    },
    {
      key: 'content',
      title: 'Content',
      count: contentCount,
      sentence:
        contentCount > 0
          ? `${contentCount} accepted submission${contentCount === 1 ? '' : 's'} awaiting content approval.`
          : 'Nothing is waiting on content approval.',
      zeroSentence: 'Accept submissions to start collecting content.',
      link: '/content',
    },
    {
      key: 'agenda',
      title: 'Agenda',
      count: agendaCount,
      sentence:
        agendaCount > 0
          ? `${payload.agenda.unplaced} accepted session${payload.agenda.unplaced === 1 ? '' : 's'} unplaced, ${payload.agenda.conflicts} conflict${payload.agenda.conflicts === 1 ? '' : 's'}.`
          : 'The agenda is fully placed with no conflicts.',
      zeroSentence: 'Accept submissions, then place them on the agenda.',
      link: '/agenda',
    },
    {
      key: 'comms',
      title: 'Comms',
      count: commsCount,
      sentence:
        commsCount > 0
          ? `${commsCount} message${commsCount === 1 ? '' : 's'} sent in the last 7 days.`
          : 'No messages sent in the last 7 days.',
      zeroSentence: 'Compose a message to reach your speakers.',
      link: '/comms',
    },
  ];
}
