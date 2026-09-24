import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useSyncExternalStore } from "react";

import { BASE_URL } from "@/utils/api";
import { adoptDeviceId, getDeviceId, resetDeviceId } from "@/utils/deviceId";

/**
 * The person's account: an email address confirmed with a one-time code, no password.
 *
 * The session token is kept in the phone's secure storage where there is one (the Keychain on
 * iPhone, the Keystore on Android) and in ordinary storage otherwise (the web preview). Every
 * request to our own server carries it; see installAuthFetch.
 */

const KEY = "flippilot.session.v1";

type Session = { token: string; email: string };

let session: Session | null = null;
let ready: Promise<void> | null = null;
let isReady = false;
const listeners = new Set<() => void>();
const needSignInListeners = new Set<() => void>();

// A new object every time something changes, so a screen using useAccount sees the change.
type Snapshot = { loaded: boolean; email: string | null };
let snapshot: Snapshot = { loaded: false, email: null };

const changed = () => {
  snapshot = { loaded: isReady, email: session?.email ?? null };
  listeners.forEach((fn) => fn());
};

async function secureStore(): Promise<typeof import("expo-secure-store") | null> {
  try {
    const mod = await import("expo-secure-store");
    return (await mod.isAvailableAsync()) ? mod : null;
  } catch {
    // Not in this build of the app (or on the web): ordinary storage is the fallback.
    return null;
  }
}

async function readStored(): Promise<Session | null> {
  try {
    const secure = await secureStore();
    const raw = secure ? await secure.getItemAsync(KEY) : await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.token === "string" && typeof parsed.email === "string" ? parsed : null;
  } catch {
    return null;
  }
}

async function writeStored(value: Session | null): Promise<void> {
  try {
    const secure = await secureStore();
    if (value) {
      const raw = JSON.stringify(value);
      if (secure) await secure.setItemAsync(KEY, raw);
      else await AsyncStorage.setItem(KEY, raw);
    } else {
      if (secure) await secure.deleteItemAsync(KEY);
      await AsyncStorage.removeItem(KEY);
    }
  } catch {
    // Storage failed: the session still works until the app is closed.
  }
}

/** Loads the saved session once. Everything else waits on this. */
export function loadAccount(): Promise<void> {
  if (!ready) {
    ready = readStored().then((s) => {
      session = s;
      isReady = true;
      changed();
    });
  }
  return ready;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useAccount(): Snapshot {
  useEffect(() => {
    loadAccount();
  }, []);
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

/** The app is told when something needs a signed-in person, and shows the sign-in screen. */
export function onSignInNeeded(fn: () => void): () => void {
  needSignInListeners.add(fn);
  return () => {
    needSignInListeners.delete(fn);
  };
}

async function post(path: string, body: unknown, token?: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

const NETWORK_MESSAGE = "Couldn't reach FlipPilot. Check your connection and try again.";

export async function requestCode(email: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { json } = await post("/auth/request-code", { email });
    if (json?.ok) return { ok: true };
    return { ok: false, message: json?.message ?? "Couldn't send a code. Please try again." };
  } catch {
    return { ok: false, message: NETWORK_MESSAGE };
  }
}

export async function verifyCode(
  email: string,
  code: string
): Promise<{ ok: true; isNew: boolean } | { ok: false; message: string }> {
  try {
    const deviceId = await getDeviceId();
    const { json } = await post("/auth/verify", { email, code, deviceId });
    if (!json?.ok) return { ok: false, message: json?.message ?? "That didn't work. Please try again." };
    session = { token: json.token, email: json.email };
    await writeStored(session);
    // From now on this phone acts as the account's own id.
    await adoptDeviceId(json.deviceId);
    changed();
    return { ok: true, isNew: !!json.isNew };
  } catch {
    return { ok: false, message: NETWORK_MESSAGE };
  }
}

async function forgetSession() {
  session = null;
  await writeStored(null);
  await resetDeviceId();
  changed();
}

export async function signOut(): Promise<void> {
  const token = session?.token;
  if (token) {
    try {
      await post("/auth/logout", {}, token);
    } catch {
      // Signing out on this phone matters more than telling the server.
    }
  }
  await forgetSession();
}

/** Erases the account and everything held under it. */
export async function deleteAccount(): Promise<{ ok: true } | { ok: false; message: string }> {
  const token = session?.token;
  if (!token) return { ok: false, message: "You're not signed in." };
  try {
    const { json } = await post("/auth/delete-account", { confirm: "DELETE" }, token);
    if (!json?.ok) return { ok: false, message: json?.error ?? "Couldn't delete your account. Please try again." };
    await forgetSession();
    return { ok: true };
  } catch {
    return { ok: false, message: NETWORK_MESSAGE };
  }
}

/**
 * Makes every request to our own server carry the session token, without every screen having to
 * remember. When the server says a sign-in is needed, the app is told so it can show the sign-in
 * screen; and a session the server no longer recognises (run out, or ended elsewhere) is dropped.
 */
let installed = false;
export function installAuthFetch(): void {
  if (installed) return;
  installed = true;
  const original = globalThis.fetch.bind(globalThis);

  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : "";
    if (!url.startsWith(BASE_URL)) return original(input, init);

    await loadAccount();
    const token = session?.token;
    let sent = init;
    if (token) {
      const headers = new Headers(init?.headers);
      if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
      sent = { ...init, headers };
    }
    const res = await original(input, sent);

    if ((res.status === 401 || res.status === 403) && !url.includes("/auth/")) {
      const body = await res.clone().json().catch(() => null);
      if (body?.error === "sign-in-required") {
        if (token) {
          // Is the session itself still good? If not, drop it.
          const check = await original(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).catch(
            () => null
          );
          if (check && check.status === 401 && session?.token === token) await forgetSession();
        }
        needSignInListeners.forEach((fn) => fn());
      } else if (body?.error === "identity-mismatch" && token) {
        // A screen used an id from before sign-in. Line the phone up with the account's own id.
        const me = await original(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => r.json())
          .catch(() => null);
        if (me?.ok && me.deviceId) await adoptDeviceId(me.deviceId);
      }
    }
    return res;
  }) as typeof fetch;
}
