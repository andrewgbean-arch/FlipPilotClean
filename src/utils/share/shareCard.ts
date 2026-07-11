export async function captureShareCard(ref: any) {
  if (!ref || !ref.capture) return null;

  try {
    const uri = await ref.capture();
    return uri ?? null;
  } catch (e) {
    console.log("captureShareCard failed:", e);
    return null;
  }
}
