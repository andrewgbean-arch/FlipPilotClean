import * as WebBrowser from "expo-web-browser";

import { BASE_URL } from "./api";
import { getDeviceId } from "./deviceId";

/* --------------------------------------------------
   Exporting a FlipPilot listing to the seller's own eBay account.
   The actual OAuth + listing creation happens on the backend
   (backend/ebay/*, backend/routes/ebayExport.ts) - this just drives the
   "sign in with eBay" browser step and calls the export endpoint.
-------------------------------------------------- */

export type EbayStatus = { connected: boolean; configured: boolean };

export async function getEbayStatus(): Promise<EbayStatus> {
  const deviceId = await getDeviceId();
  const res = await fetch(`${BASE_URL}/ebay/status?deviceId=${encodeURIComponent(deviceId)}`);
  return res.json();
}

/** Opens eBay's own sign-in page and waits for the seller to approve access. */
export async function connectEbay(): Promise<{ ok: boolean; message?: string }> {
  const deviceId = await getDeviceId();

  const urlRes = await fetch(`${BASE_URL}/ebay/connect-url?deviceId=${encodeURIComponent(deviceId)}`);
  const urlData = await urlRes.json();
  if (!urlData?.ok) {
    return { ok: false, message: urlData?.message ?? "eBay export isn't set up yet." };
  }
  if (!urlData.redirectUrl) {
    return { ok: false, message: "eBay export isn't fully set up yet (missing redirect URL)." };
  }

  const result = await WebBrowser.openAuthSessionAsync(urlData.url, urlData.redirectUrl);
  if (result.type !== "success" || !("url" in result)) {
    return { ok: false, message: "eBay sign-in was cancelled." };
  }

  const code = new URL(result.url).searchParams.get("code");
  if (!code) {
    return { ok: false, message: "eBay didn't send back an authorisation code. Please try again." };
  }

  const callbackRes = await fetch(`${BASE_URL}/ebay/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, code }),
  });
  const callbackData = await callbackRes.json();
  return callbackData?.ok
    ? { ok: true }
    : { ok: false, message: callbackData?.message ?? "Couldn't connect your eBay account." };
}

export async function disconnectEbay(): Promise<void> {
  const deviceId = await getDeviceId();
  await fetch(`${BASE_URL}/ebay/disconnect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId }),
  });
}

export async function exportListingToEbay(
  listingId: number | string
): Promise<{ ok: boolean; error?: string; message?: string; ebayUrl?: string | null }> {
  const deviceId = await getDeviceId();
  const res = await fetch(`${BASE_URL}/ebay/export/${listingId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId }),
  });
  return res.json();
}
