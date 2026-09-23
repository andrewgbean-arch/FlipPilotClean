/**
 * How long each kind of data is kept. One place, so the privacy policy and the
 * clean-up job cannot drift apart: change a number here and change the policy.
 * These are the proposed periods; the owner accepts them (or a solicitor
 * changes them) before the policy is published.
 */
export const RETENTION = {
  /** A conversation is deleted this long after its last message. */
  messagesMonthsAfterLastMessage: 12,
  /** A sold listing is deleted this long after it was marked sold. */
  soldListingMonths: 6,
  /** A listing never marked sold is deleted this long after it was posted. */
  unsoldListingMonths: 12,
  /** A boot fair or event is deleted this long after its date has passed. */
  fairDaysAfterDate: 60,
  /** A report is kept for this long, for safety and legal claims. */
  reportMonths: 24,
  /** A free-scan counter is deleted this long after its week ended. */
  freeScanDaysAfterWeek: 30,
  /** A seller with no listings and no activity is deleted after this long. */
  inactiveSellerMonths: 24,
  /** An uploaded photo not attached to any listing or fair is deleted after this. */
  orphanUploadHours: 24,
} as const;

export function monthsAgo(months: number, from = new Date()): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() - months);
  return d;
}

export function daysAgo(days: number, from = new Date()): Date {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
}
