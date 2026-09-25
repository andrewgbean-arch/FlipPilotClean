/**
 * Who may list what on the Marketplace, and what it costs. One place, so the
 * launch offer and the limits can be changed without hunting through routes.
 *
 * Launch offer: for a set time after launch (MARKETPLACE_PROMO_ENDS_AT) listing
 * is free for everyone. Afterwards a car costs credits and items beyond a free
 * allowance do too. Credits are not built yet, so once the offer ends those
 * listings are refused with a "credits required" answer rather than let through
 * for nothing.
 *
 * MARKETPLACE_PROMO_ENDS_AT is an ISO date set on the server when the app
 * launches (for example 2026-12-01). Unset means the offer runs until it is set;
 * the server says so at startup so it cannot be forgotten quietly.
 */
export const POLICY = {
  /** One car for sale at a time per seller. Stops a trader posing as a private seller. */
  maxActiveCarsPerSeller: 1,
  /** After the offer, this many item listings stay free at a time. */
  freeActiveItemsAfterPromo: 5,
  /** A flood guard, not a limit anyone should meet: 30 new listings in 24 hours. */
  maxNewListingsPerDay: Number(process.env.MAX_NEW_LISTINGS_PER_DAY) || 30,
  /** What a car listing will cost in credits once the offer is over. */
  carCreditCost: 25,
  /** A boost puts one of your listings at the top of the feed, labelled Promoted, for this many days... */
  boostDays: 7,
  /** ...for this many credits. */
  boostCreditCost: 10,
  /** Category id used for cars (see src/constants/marketplaceCategories.ts). */
  carCategory: "motors",
} as const;

export function promoEndsAt(): Date | null {
  const raw = process.env.MARKETPLACE_PROMO_ENDS_AT?.trim();
  if (!raw) return null;
  const when = new Date(raw);
  return Number.isNaN(when.getTime()) ? null : when;
}

/** Is listing still free for everyone? */
export function promoActive(now = new Date()): boolean {
  const ends = promoEndsAt();
  // Not set (or not a real date) means the offer is running.
  return ends === null || now.getTime() < ends.getTime();
}
