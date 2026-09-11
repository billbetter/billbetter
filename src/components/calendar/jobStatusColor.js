/**
 * The block colour a job gets in the day, week and month views, by status.
 * Anything unrecognised (or no status) is neutral grey.
 */
const JOB_STATUS_COLORS = {
  planning: "bg-brand-600",
  in_progress: "bg-caution-500",
  completed: "bg-positive-500",
  cancelled: "bg-danger-500",
};

export function jobStatusColor(status) {
  return JOB_STATUS_COLORS[status] || "bg-ink-500";
}
