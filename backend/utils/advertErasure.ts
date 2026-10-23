import { dataPath, writeJsonAtomic } from "../config/dataDir";
import { RETENTION } from "../config/retention";
import fs from "fs";
import { Advert, allPictures, loadAdverts, saveAdverts, totals } from "./advertStore";
import { deleteProfile, profileFor } from "./advertiserStore";
import { deleteUploads } from "./uploadStore";

/**
 * What happens to a business's advertiser profile and adverts when its account is erased.
 *
 * Everything goes: the profile (name, phone, address, postcode, logo, website), every advert with its
 * words and pictures, and the reports made about them. Two things stand in the way or are kept:
 *
 *  - A renewing paid advert (a monthly booking that has not been cancelled) stops the erasure until it is
 *    cancelled, because deleting the account would leave it charging for something nobody can manage.
 *  - What we were paid is a business record the law has us keep. For an advert that was ever paid for, a
 *    short record stays (business name, amounts, dates, the payment provider's references) for
 *    RETENTION.paymentRecordYears, with no wording, pictures or contact details, and nothing saying
 *    which account it was.
 */

const RECORDS_PATH = dataPath("advertPaymentRecords.json");

export type PaymentRecord = {
  advertId: string;
  businessName: string;
  monthlyPence: number;
  launchMonthlyPence: number | null;
  firstPaidAt: string | null;
  paidAt: string | null;
  paidThrough: string | null;
  byCard: boolean;
  stripe: { customerId: string | null; subscriptionId: string | null };
  erasedAt: string;
};

export function loadPaymentRecords(): PaymentRecord[] {
  if (!fs.existsSync(RECORDS_PATH)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(RECORDS_PATH, "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    // A corrupt file must not be silently saved over with an empty one.
    throw new Error("advertPaymentRecords.json could not be read");
  }
}

const ms = (iso: string | null | undefined) => Date.parse(iso ?? "") || 0;

/** Payment records older than RETENTION.paymentRecordYears (counted from the last date on them) are deleted. */
export function purgePaymentRecords(now = new Date()): number {
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - RETENTION.paymentRecordYears);
  const all = loadPaymentRecords();
  const kept = all.filter((r) => Math.max(ms(r.paidThrough), ms(r.paidAt), ms(r.firstPaidAt), ms(r.erasedAt)) >= cutoff.getTime());
  if (kept.length !== all.length) writeJsonAtomic(RECORDS_PATH, kept);
  return all.length - kept.length;
}

/** A paid monthly booking that is still renewing: the one thing that has to be cancelled before an account can go. */
export function runningAdvertFor(accountId: string): Advert | null {
  return loadAdverts().find((a) => a.ownerAccountId === accountId && a.booking?.status === "active") ?? null;
}

function recordOf(ad: Advert, now: Date): PaymentRecord {
  const b = ad.booking!;
  return {
    advertId: ad.id,
    businessName: ad.advertiser,
    monthlyPence: b.monthlyPence,
    launchMonthlyPence: b.launchMonthlyPence ?? null,
    firstPaidAt: b.firstPaidAt ?? null,
    paidAt: b.paidAt ?? null,
    paidThrough: b.paidThrough ?? null,
    byCard: !!b.stripe?.subscriptionId,
    stripe: { customerId: b.stripe?.customerId ?? null, subscriptionId: b.stripe?.subscriptionId ?? null },
    erasedAt: now.toISOString(),
  };
}

export type AdvertiserErasure = { profileRemoved: boolean; advertsRemoved: number; paymentRecordsKept: number };

export function eraseAdvertiser(accountId: string, now = new Date()): AdvertiserErasure {
  const all = loadAdverts();
  const mine = all.filter((a) => a.ownerAccountId === accountId);
  const profile = profileFor(accountId);

  // The records are written before the adverts go, so a crash between the two can only ever leave a spare record.
  const records = mine.filter((a) => a.booking && (a.booking.paidAt || a.booking.firstPaidAt)).map((a) => recordOf(a, now));
  if (records.length > 0) writeJsonAtomic(RECORDS_PATH, [...loadPaymentRecords(), ...records]);

  const pictures: string[] = [];
  for (const ad of mine) {
    pictures.push(...allPictures(ad));
    if (ad.logo) pictures.push(ad.logo);
  }
  if (profile?.logo) pictures.push(profile.logo);

  if (mine.length > 0) saveAdverts(all.filter((a) => a.ownerAccountId !== accountId));
  const profileRemoved = !!deleteProfile(accountId);
  deleteUploads(pictures);
  return { profileRemoved, advertsRemoved: mine.length, paymentRecordsKept: records.length };
}

/** What a business holds with us, for its own copy of its data: the profile, and each advert and its booking. */
export function exportAdvertiserData(accountId: string) {
  const profile = profileFor(accountId);
  const adverts = loadAdverts()
    .filter((a) => a.ownerAccountId === accountId)
    .map((ad) => ({
      id: ad.id,
      businessName: ad.advertiser,
      title: ad.title,
      tagline: ad.tagline,
      description: ad.description,
      website: ad.website,
      phone: ad.phone ?? null,
      address: ad.address ?? null,
      pictures: allPictures(ad),
      logo: ad.logo ?? null,
      placements: ad.placements,
      scope: ad.scope,
      postcode: ad.postcode ?? null,
      radiusMiles: ad.radiusMiles ?? null,
      startsAt: ad.startsAt,
      endsAt: ad.endsAt,
      approved: ad.approved,
      createdAt: ad.createdAt,
      booking: ad.booking
        ? {
            status: ad.booking.status,
            monthlyPence: ad.booking.monthlyPence,
            launchMonthlyPence: ad.booking.launchMonthlyPence,
            launchMonths: ad.booking.launchMonths,
            submittedAt: ad.booking.submittedAt,
            reviewedAt: ad.booking.reviewedAt ?? null,
            rejectedReason: ad.booking.rejectedReason ?? null,
            paidAt: ad.booking.paidAt ?? null,
            firstPaidAt: ad.booking.firstPaidAt ?? null,
            paidThrough: ad.booking.paidThrough ?? null,
            invoiceRequested: !!ad.booking.invoiceRequested,
            byCard: !!ad.booking.stripe?.subscriptionId,
            freeMonth: ad.booking.freeMonth ?? null,
          }
        : null,
      performance: totals(ad),
    }));
  return profile || adverts.length > 0 ? { profile, adverts } : null;
}
