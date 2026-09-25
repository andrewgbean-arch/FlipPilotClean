import axios from "axios";
import fs from "fs";
import path from "path";
import { decryptJson, encryptJson, encryptionConfigured } from "../utils/secretBox";
import { dataPath, writeJsonAtomic } from "../config/dataDir";

/* --------------------------------------------------
   ⭐ eBay Seller OAuth (authorization-code grant)

   Separate from ebayBrowseApi.ts's client-credentials token, which only
   ever reads PUBLIC listings and can't act on anyone's behalf. Exporting
   a listing TO a seller's own eBay account needs their explicit consent:
   they log into their own eBay account and approve this app, exactly
   like "Sign in with eBay" on any other site.

   Needs its own Keyset from developer.ebay.com (Production, once ready
   - Sandbox for testing first) and a registered RuName ("Sign in with
   eBay" redirect setup) whose "Auth accepted" URL matches
   EBAY_SELL_REDIRECT_URL below. See backend/.env.example for exactly
   what's needed and where to get it.
-------------------------------------------------- */

const SANDBOX = (process.env.EBAY_SELL_ENV ?? "sandbox").toLowerCase() !== "production";

const AUTH_BASE = SANDBOX ? "https://auth.sandbox.ebay.com" : "https://auth.ebay.com";
const API_BASE = SANDBOX ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";

// Only what's needed to create and publish a listing on the seller's behalf.
const SCOPES = [
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account.readonly",
].join(" ");

function clientId() {
  return process.env.EBAY_SELL_CLIENT_ID ?? "";
}
function clientSecret() {
  return process.env.EBAY_SELL_CLIENT_SECRET ?? "";
}
function ruName() {
  return process.env.EBAY_SELL_RUNAME ?? "";
}

// Also needs the token encryption key: tokens are never stored unencrypted, so
// without one there is nowhere safe to keep a login and the feature stays off.
export function ebaySellConfigured(): boolean {
  return Boolean(clientId() && clientSecret() && ruName() && encryptionConfigured());
}

/** The URL the app opens for the seller to log into eBay and approve access. */
export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: ruName(),
    response_type: "code",
    scope: SCOPES,
    state,
  });
  return `${AUTH_BASE}/oauth2/authorize?${params.toString()}`;
}

type StoredTokens = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number; // epoch ms
};

const STORE_FILE = dataPath("ebaySellTokens.json");

// On disk each device's tokens are one encrypted string (see utils/secretBox.ts).
// An entry that will not decrypt (wrong key, or altered) counts as not
// connected. A plain entry from before encryption still reads, and is
// encrypted the next time the store is saved.
function loadStore(): Record<string, StoredTokens> {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
  } catch {
    return {};
  }

  const out: Record<string, StoredTokens> = {};
  for (const [deviceId, entry] of Object.entries(raw)) {
    const tokens =
      typeof entry === "string" ? decryptJson<StoredTokens>(entry) : (entry as StoredTokens);
    if (tokens?.refreshToken) out[deviceId] = tokens;
  }
  return out;
}
function saveStore(store: Record<string, StoredTokens>) {
  const encrypted: Record<string, string> = {};
  for (const [deviceId, tokens] of Object.entries(store)) {
    encrypted[deviceId] = encryptJson(tokens);
  }
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  writeJsonAtomic(STORE_FILE, encrypted);
}

function basicAuthHeader() {
  return `Basic ${Buffer.from(`${clientId()}:${clientSecret()}`).toString("base64")}`;
}

/** Exchanges the one-time authorization code (from the redirect) for tokens, and stores them. */
export async function exchangeCodeForTokens(deviceId: string, code: string): Promise<void> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: ruName(),
  });

  const res = await axios.post(`${API_BASE}/identity/v1/oauth2/token`, body.toString(), {
    timeout: 8000,
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const { access_token, refresh_token, expires_in } = res.data;
  const store = loadStore();
  store[deviceId] = {
    accessToken: access_token,
    refreshToken: refresh_token,
    accessExpiresAt: Date.now() + Number(expires_in ?? 7200) * 1000,
  };
  saveStore(store);
}

export function isConnected(deviceId: string): boolean {
  return Boolean(loadStore()[deviceId]?.refreshToken);
}

export function disconnect(deviceId: string): void {
  const store = loadStore();
  delete store[deviceId];
  saveStore(store);
}

/** A usable access token for this device, refreshing it first if it's expired. Null if never connected. */
export async function getValidAccessToken(deviceId: string): Promise<string | null> {
  const store = loadStore();
  const tokens = store[deviceId];
  if (!tokens) return null;

  if (tokens.accessExpiresAt > Date.now() + 30_000) {
    return tokens.accessToken;
  }

  // Refresh tokens last much longer (~18 months) than access tokens (~2 hours).
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refreshToken,
    scope: SCOPES,
  });

  const res = await axios.post(`${API_BASE}/identity/v1/oauth2/token`, body.toString(), {
    timeout: 8000,
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const { access_token, expires_in } = res.data;
  tokens.accessToken = access_token;
  tokens.accessExpiresAt = Date.now() + Number(expires_in ?? 7200) * 1000;
  store[deviceId] = tokens;
  saveStore(store);

  return access_token;
}

export function ebayApiBase(): string {
  return API_BASE;
}
