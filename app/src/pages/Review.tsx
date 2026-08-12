// J4 SPA entry (DEC-018 wire contract, DEC-024 role gating). Producer view:
// plan list -> editor/progress/results. Reviewer view: their plans -> queue
// -> scorecard. Which sub-tree mounts is decided by role from useMe(); the
// two views never mount at once.
import { Route, Routes } from 'react-router-dom';
import { useMe } from '../lib/useMe';
import { PlanEditor } from './review/PlanEditor';
import { PlanList } from './review/PlanList';
import { ProgressPanel } from './review/ProgressPanel';
import './review/review.css';
import { ResultsTable } from './review/ResultsTable';
import { ReviewerQueue } from './review/ReviewerQueue';
import { Scorecard } from './review/Scorecard';

export function ReviewPage() {
  const { me, loading } = useMe();

  if (loading) {
    return (
      <div className="chq-page chq-review-page">
        <h1 className="chq-page-title">Review</h1>
        <p>Loading…</p>
      </div>
    );
  }

  if (me?.role === 'reviewer') {
    return (
      <Routes>
        <Route path="/" element={<ReviewerQueue />} />
        <Route path="plans/:planId" element={<ReviewerQueue />} />
        <Route path="plans/:planId/submissions/:submissionId" element={<Scorecard />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<PlanList />} />
      <Route path="plans/new" element={<PlanEditor />} />
      <Route path="plans/:planId" element={<PlanEditor />} />
      <Route path="plans/:planId/progress" element={<ProgressPanel />} />
      <Route path="plans/:planId/results" element={<ResultsTable />} />
    </Routes>
  );
}
