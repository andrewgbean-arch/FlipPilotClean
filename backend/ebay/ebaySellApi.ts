import axios from "axios";
import { ebayApiBase } from "./ebaySellAuth";

/* --------------------------------------------------
   ⭐ Creating a real listing on the seller's own eBay account

   Uses eBay's modern Inventory API (inventory item -> offer -> publish),
   not the older Trading API. Three real eBay requirements this can't
   route around, since they're eBay's own rules, not this app's:

   1. The seller needs at least one eBay Business Policy set up
      (payment/return/fulfillment) - checked and reported clearly if
      missing rather than guessed at.
   2. The seller needs at least one inventory location on their eBay
      account (their registered address/warehouse).
   3. eBay wants publicly-reachable image URLs. FlipPilot's own listing
      photos are local file URIs on the seller's phone, not hosted
      anywhere public, so images are NOT sent yet - this is a text-only
      export until there's somewhere public to host them from. Some
      eBay categories require at least one photo to publish; if that
      happens, eBay's own rejection message is passed straight back
      rather than pretending it worked.
-------------------------------------------------- */

const MARKETPLACE_ID = "EBAY_GB";

function authHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "Content-Language": "en-GB",
    "Accept-Language": "en-GB",
  };
}

let categoryTreeIdCache: string | null = null;
async function getCategoryTreeId(accessToken: string): Promise<string> {
  if (categoryTreeIdCache) return categoryTreeIdCache;
  const res = await axios.get(
    `${ebayApiBase()}/commerce/taxonomy/v1/get_default_category_tree_id`,
    { params: { marketplace_id: MARKETPLACE_ID }, headers: authHeaders(accessToken), timeout: 6000 }
  );
  categoryTreeIdCache = String(res.data.categoryTreeId);
  return categoryTreeIdCache;
}

/** Best-guess numeric eBay category id for a listing title - approximate, not curated. */
async function suggestCategoryId(accessToken: string, title: string): Promise<string | null> {
  try {
    const treeId = await getCategoryTreeId(accessToken);
    const res = await axios.get(
      `${ebayApiBase()}/commerce/taxonomy/v1/category_tree/${treeId}/get_category_suggestions`,
      { params: { q: title }, headers: authHeaders(accessToken), timeout: 6000 }
    );
    const first = res.data?.categorySuggestions?.[0]?.category?.categoryId;
    return first ? String(first) : null;
  } catch (err: any) {
    console.log("eBay category suggestion failed:", err?.response?.data ?? err?.message);
    return null;
  }
}

async function getFirstPolicyIds(accessToken: string) {
  const [fulfillment, payment, returns, locations] = await Promise.all([
    axios.get(`${ebayApiBase()}/sell/account/v1/fulfillment_policy`, {
      params: { marketplace_id: MARKETPLACE_ID },
      headers: authHeaders(accessToken),
      timeout: 6000,
    }),
    axios.get(`${ebayApiBase()}/sell/account/v1/payment_policy`, {
      params: { marketplace_id: MARKETPLACE_ID },
      headers: authHeaders(accessToken),
      timeout: 6000,
    }),
    axios.get(`${ebayApiBase()}/sell/account/v1/return_policy`, {
      params: { marketplace_id: MARKETPLACE_ID },
      headers: authHeaders(accessToken),
      timeout: 6000,
    }),
    axios.get(`${ebayApiBase()}/sell/inventory/v1/location`, {
      headers: authHeaders(accessToken),
      timeout: 6000,
    }),
  ]);

  return {
    fulfillmentPolicyId: fulfillment.data?.fulfillmentPolicies?.[0]?.fulfillmentPolicyId ?? null,
    paymentPolicyId: payment.data?.paymentPolicies?.[0]?.paymentPolicyId ?? null,
    returnPolicyId: returns.data?.returnPolicies?.[0]?.returnPolicyId ?? null,
    merchantLocationKey: locations.data?.locations?.[0]?.merchantLocationKey ?? null,
  };
}

export type ExportResult =
  | { ok: true; offerId: string; ebayUrl: string | null }
  | { ok: false; error: string; message: string };

export async function exportListingToEbay(
  accessToken: string,
  listing: { id: number | string; title: string; price: number; description?: string | null }
): Promise<ExportResult> {
  const sku = `flippilot-${listing.id}`;

  const [categoryId, policies] = await Promise.all([
    suggestCategoryId(accessToken, listing.title),
    getFirstPolicyIds(accessToken),
  ]);

  if (!policies.fulfillmentPolicyId || !policies.paymentPolicyId || !policies.returnPolicyId) {
    return {
      ok: false,
      error: "no-business-policies",
      message:
        "Your eBay account needs at least one payment, return and postage policy set up before FlipPilot can list for you. Set these up in eBay's Seller Hub, then try again.",
    };
  }
  if (!policies.merchantLocationKey) {
    return {
      ok: false,
      error: "no-location",
      message: "Your eBay account needs at least one registered location before FlipPilot can list for you.",
    };
  }
  if (!categoryId) {
    return {
      ok: false,
      error: "no-category",
      message: "Couldn't work out an eBay category for this item's title. Try a more specific title and try again.",
    };
  }

  try {
    await axios.put(
      `${ebayApiBase()}/sell/inventory/v1/inventory_item/${sku}`,
      {
        product: {
          title: listing.title.slice(0, 80),
          description: listing.description || listing.title,
        },
        condition: "USED_GOOD",
        availability: { shipToLocationAvailability: { quantity: 1 } },
      },
      { headers: authHeaders(accessToken), timeout: 8000 }
    );

    const offerRes = await axios.post(
      `${ebayApiBase()}/sell/inventory/v1/offer`,
      {
        sku,
        marketplaceId: MARKETPLACE_ID,
        format: "FIXED_PRICE",
        availableQuantity: 1,
        categoryId,
        listingDescription: listing.description || listing.title,
        pricingSummary: { price: { value: String(listing.price), currency: "GBP" } },
        listingPolicies: {
          fulfillmentPolicyId: policies.fulfillmentPolicyId,
          paymentPolicyId: policies.paymentPolicyId,
          returnPolicyId: policies.returnPolicyId,
        },
        merchantLocationKey: policies.merchantLocationKey,
      },
      { headers: authHeaders(accessToken), timeout: 8000 }
    );

    const offerId = offerRes.data.offerId;

    const publishRes = await axios.post(
      `${ebayApiBase()}/sell/inventory/v1/offer/${offerId}/publish`,
      {},
      { headers: authHeaders(accessToken), timeout: 10000 }
    );

    const listingId = publishRes.data?.listingId ?? null;
    return {
      ok: true,
      offerId,
      ebayUrl: listingId ? `https://www.ebay.co.uk/itm/${listingId}` : null,
    };
  } catch (err: any) {
    const ebayMessage =
      err?.response?.data?.errors?.[0]?.message ?? err?.response?.data?.message ?? err?.message;
    console.log("eBay export failed:", ebayMessage);
    return {
      ok: false,
      error: "ebay-error",
      message: `eBay couldn't publish this listing: ${ebayMessage ?? "please try again."}`,
    };
  }
}
