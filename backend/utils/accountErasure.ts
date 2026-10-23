import { Account, deleteAccount } from "./accountStore";
import { eraseAdvertiser, runningAdvertFor } from "./advertErasure";
import { deleteUserData } from "./userData";

/**
 * Erasing an account, in one place. The app's "Delete my account", a request by email to the person who
 * runs FlipPilot, and the clean-up of an account nobody has used for two years all do exactly this, so
 * none of them can leave something behind that another one would have removed.
 */

/** Why this account can't be erased yet, in words for the person, or null when it can. */
export function erasureBlock(account: Account): string | null {
  if (!runningAdvertFor(account.id)) return null;
  return (
    "Your business has a paid advert that is still renewing each month. Please cancel it first, in the advertiser " +
    "portal at api.flippilot.co.uk/advertise (Cancel stops it at the end of the month you have paid for), or email " +
    "support@flippilot.co.uk, and then delete your account. Deleting it now would leave the monthly payment running."
  );
}

/** Everything held under the account (listings, messages, photos, advertiser profile and adverts, credits...), then the account. */
export function eraseAccount(account: Account) {
  const removed = deleteUserData(account.canonicalDeviceId);
  const advertiser = eraseAdvertiser(account.id);
  deleteAccount(account.id);
  return { ...removed, advertiser };
}
