// J4 SPA entry (DEC-018 wire contract, DEC-024 role gating). Producer view:
// plan list -> editor/progress/results. Reviewer view: their plans -> queue
// -> scorecard. Which sub-tree mounts is decided by role from useMe(); the
// two views never mount at once.
//
// DEC-608: an organiser opening a reviewer-only URL (e.g. a scorecard route)
// matches nothing in the organiser subtree, and vice versa. React Router
// would otherwise render null and the shell paints an empty <main> -- a
// soft-404 with no explanation. Each subtree ends in its own catch-all that
// names whose route it is and links back to the caller's own /review
// landing page. No redirect: bouncing silently would hide the boundary.
import { Link, Route, Routes } from 'react-router-dom';
import { useMe } from '../lib/useMe';
import { DelayedLoading } from '../components/DelayedLoading';
import { PlanEditor } from './review/PlanEditor';
import { PlanList } from './review/PlanList';
import { ProgressPanel } from './review/ProgressPanel';
import './review/review.css';
import { ResultsTable } from './review/ResultsTable';
import { ReviewerQueue } from './review/ReviewerQueue';
import { Scorecard } from './review/Scorecard';

function OtherRolePanel({ owner }: { owner: 'reviewer' | 'organiser' }) {
  return (
    <div className="chq-page chq-review-page chq-measure">
      <h1 className="chq-page-title">Not your view</h1>
      <p className="chq-empty">That page belongs to the {owner} view.</p>
      <Link className="chq-btn-tertiary" to="/review">
        Back to Review
      </Link>
    </div>
  );
}

export function ReviewPage() {
  const { me, loading } = useMe();

  if (loading) {
    return (
      <div className="chq-page chq-review-page chq-measure">
        <h1 className="chq-page-title">Review</h1>
        <DelayedLoading />
      </div>
    );
  }

  if (me?.role === 'reviewer') {
    return (
      <Routes>
        <Route path="/" element={<ReviewerQueue />} />
        <Route path="plans/:planId" element={<ReviewerQueue />} />
        <Route path="plans/:planId/submissions/:submissionId" element={<Scorecard />} />
        <Route path="*" element={<OtherRolePanel owner="organiser" />} />
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
      <Route path="*" element={<OtherRolePanel owner="reviewer" />} />
    </Routes>
  );
}
