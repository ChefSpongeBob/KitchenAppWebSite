export const DELETION_REVIEW_STATUSES = {
  pending: 'Pending',
  in_review: 'In Review',
  awaiting_verification: 'Waiting for Verification',
  closed: 'Closed'
} as const;

export type DeletionReviewStatus = keyof typeof DELETION_REVIEW_STATUSES;
