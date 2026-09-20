// api.ts — API layer for the scan chain (barcode search, photo lookup, vehicle photo analysis).
// Every request here has a timeout, can be cancelled, and fails with an ApiError whose
// message is safe to show to the user.

const LOCAL_LAN_IP = "192.168.0.47"; // the owner's dev PC, used only in development builds
const PORT = 3001;

const REQUEST_TIMEOUT_MS = 20_000;
// Photo lookups run a vision call and then a market lookup on the server, so they get longer.
// The server gives up on its slowest source after about 8 seconds, so 25 is generous.
const PHOTO_TIMEOUT_MS = 25_000;
// The backend rejects request bodies over 10mb; stay under that rather than upload a doomed request.
const MAX_IMAGE_BASE64_LENGTH = 9_000_000;

// Builds inline EXPO_PUBLIC_* values at bundle time, so this must stay a literal property access.
const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
const configuredUrl = fromEnv || (__DEV__ ? `http://${LOCAL_LAN_IP}:${PORT}` : "");

export const API_CONFIGURED = configuredUrl !== "";

// A release build with no EXPO_PUBLIC_API_URL has no server to call. Point BASE_URL at an address
// that can never resolve, so screens that build their own requests from it fail fast instead of hanging.
export const BASE_URL = API_CONFIGURED ? configuredUrl : "https://server-not-configured.invalid";

// -----------------------------
// ERRORS
// -----------------------------
export type ApiErrorKind =
  | "not-configured"
  | "timeout"
  | "offline"
  | "aborted"
  | "rate-limited"
  | "too-large"
  | "server"
  | "lookup";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly retryAfter?: number;

  constructor(
    kind: ApiErrorKind,
    message: string,
    extra: { status?: number; retryAfter?: number } = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = extra.status;
    this.retryAfter = extra.retryAfter;
  }
}

// The text to show the user for any error thrown by this module.
export function describeApiError(err: unknown): string {
  return err instanceof ApiError
    ? err.message
    : "Something went wrong. Please try again.";
}

// -----------------------------
// SHARED REQUEST
// -----------------------------
type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
};

async function request(path: string, options: RequestOptions = {}): Promise<any> {
  if (!API_CONFIGURED) {
    throw new ApiError(
      "not-configured",
      "This version of FlipPilot isn't connected to a server yet, so scanning isn't available. Please update the app."
    );
  }

  const { method = "GET", body, signal, timeoutMs = REQUEST_TIMEOUT_MS } = options;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const forwardAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", forwardAbort);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    let payload: any = null;
    try {
      payload = await res.json();
    } catch {
      // Not JSON (for example an error page from a proxy); the checks below turn this into an error.
    }

    if (res.status === 429) {
      const wait = Math.ceil(Number(payload?.retryAfter));
      throw new ApiError(
        "rate-limited",
        wait > 0
          ? `You're scanning quickly. Wait ${wait} ${wait === 1 ? "second" : "seconds"} and try again.`
          : "You're scanning quickly. Wait a moment and try again.",
        { status: 429, retryAfter: wait > 0 ? wait : undefined }
      );
    }

    if (res.status === 413) {
      throw new ApiError("too-large", "That photo is too large to upload. Please try again.", {
        status: 413,
      });
    }

    if (!res.ok || payload === null || typeof payload !== "object") {
      throw new ApiError("server", "The server ran into a problem. Please try again in a moment.", {
        status: res.status,
      });
    }

    // The backend answers most lookup failures with 200 and { error }, and may
    // add a `message` that is safe to show ("We don't recognise that barcode yet").
    if (typeof payload.error === "string") {
      console.log("Server could not complete", path, "-", payload.error);
      throw new ApiError(
        "lookup",
        typeof payload.message === "string" && payload.message
          ? payload.message
          : "We couldn't get a result for that item. Try again, or try a clearer barcode or photo.",
        { status: res.status }
      );
    }

    return payload;
  } catch (err) {
    if (err instanceof ApiError) throw err;

    if (timedOut) {
      throw new ApiError(
        "timeout",
        "The server took too long to answer. Check your connection and try again."
      );
    }

    if (controller.signal.aborted) {
      throw new ApiError("aborted", "Cancelled.");
    }

    console.log("Network error on", path, err);
    throw new ApiError(
      "offline",
      "Couldn't reach the FlipPilot server. Check your internet connection and try again."
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
  }
}

function assertImageFits(imageBase64: string) {
  if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    throw new ApiError("too-large", "That photo is too large to upload. Please try again.");
  }
}

// -----------------------------
// BARCODE SEARCH
// -----------------------------
export async function searchBarcode(barcode: string, signal?: AbortSignal) {
  return request(`/search?q=${encodeURIComponent(barcode)}`, { signal });
}

// -----------------------------
// AI LOOKUP (VISION)
// -----------------------------
export async function aiLookup(imageBase64: string, signal?: AbortSignal) {
  assertImageFits(imageBase64);
  return request("/search-image", {
    method: "POST",
    body: { imageBase64 },
    signal,
    timeoutMs: PHOTO_TIMEOUT_MS,
  });
}

// -----------------------------
// SCAN IN TWO STEPS (fast "what is it?", then "what is it worth?")
// -----------------------------
export async function identifyBarcode(barcode: string, signal?: AbortSignal) {
  return request(`/identify-barcode?q=${encodeURIComponent(barcode)}`, {
    signal,
    timeoutMs: 12_000,
  });
}

export async function identifyPhoto(imageBase64: string, signal?: AbortSignal) {
  assertImageFits(imageBase64);
  return request("/identify-image", {
    method: "POST",
    body: { imageBase64 },
    signal,
    timeoutMs: 20_000,
  });
}

export async function fetchPrices(
  body: {
    title: string;
    barcode?: string | null;
    packCount?: number | null;
    condition?: string | null;
    imageBase64?: string | null;
  },
  signal?: AbortSignal
) {
  return request("/price", { method: "POST", body, signal, timeoutMs: 20_000 });
}

// -----------------------------
// VEHICLE PHOTO CONDITION ANALYSIS
// -----------------------------
export async function analyzeVehiclePhoto(imageBase64: string, signal?: AbortSignal) {
  assertImageFits(imageBase64);
  return request("/vehicle-photo-analysis", {
    method: "POST",
    body: { imageBase64 },
    signal,
    timeoutMs: PHOTO_TIMEOUT_MS,
  });
}
