// pendingScan.ts — holds what the price lookup needs while the result screen is open.
//
// A scan now happens in two steps: "what is it?" (fast) opens the result screen, and
// "what is it worth?" runs while that screen is showing. The second step needs the
// title and, for a photo, the (shrunk) photo again for the description. Those are kept
// here rather than in the route params, which are only meant for small values.

export type PriceRequest = {
  title: string;
  barcode?: string | null;
  packCount?: number | null;
  condition?: string | null;
  imageBase64?: string | null;
};

const pending = new Map<string, PriceRequest>();

export function putPending(request: PriceRequest): string {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  pending.set(id, request);
  // Old ones are only useful while their screen is open; never let this grow.
  if (pending.size > 10) {
    const oldest = pending.keys().next().value;
    if (oldest !== undefined) pending.delete(oldest);
  }
  return id;
}

export const getPending = (id: string) => pending.get(id);
export const dropPending = (id: string) => void pending.delete(id);
