/**
 * Gives every request a time limit.
 *
 * Many screens call fetch() directly, and a request with no limit never ends when the connection
 * stalls (a weak signal, a server that has stopped answering), so a spinner spins for ever. This wraps
 * the phone's fetch once, at start-up: a request that has no time limit or cancel of its own is
 * cancelled after 30 seconds (90 when it is sending a file, which is slow on a weak signal), and the
 * caller gets the same failure it already handles for "no connection". A request that brings its own
 * signal (the scan lookups, which have their own timeouts) is left exactly as it is.
 */
export const DEFAULT_TIMEOUT_MS = 30_000;
export const UPLOAD_TIMEOUT_MS = 90_000;

let installed = false;

export function timeoutFor(init?: RequestInit, limits = { normal: DEFAULT_TIMEOUT_MS, upload: UPLOAD_TIMEOUT_MS }): number {
  const body: any = init?.body;
  return typeof FormData !== "undefined" && body instanceof FormData ? limits.upload : limits.normal;
}

export function installFetchTimeout(
  target: { fetch: typeof fetch } = globalThis as any,
  limits = { normal: DEFAULT_TIMEOUT_MS, upload: UPLOAD_TIMEOUT_MS }
) {
  if (installed) return;
  installed = true;

  const original = target.fetch.bind(target);
  target.fetch = ((input: any, init?: RequestInit) => {
    // A request that brings its own signal (or is a ready-made Request object) is left as it is.
    if (init?.signal || (typeof Request !== "undefined" && input instanceof Request)) {
      return original(input, init);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutFor(init, limits));
    // The timer is not cleared when the answer arrives: the limit also covers reading the body,
    // and cancelling a finished request later does nothing.
    return original(input, { ...init, signal: controller.signal }).catch((err) => {
      clearTimeout(timer);
      throw err;
    });
  }) as typeof fetch;
}

/** For tests: forget that it was installed. */
export function resetFetchTimeoutForTests() {
  installed = false;
}
