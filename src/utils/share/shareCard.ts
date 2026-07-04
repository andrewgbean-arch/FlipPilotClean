export async function captureShareCard(ref: any) {
  if (!ref) return null;
  try {
    return await ref.capture?.();
  } catch {
    return null;
  }
}