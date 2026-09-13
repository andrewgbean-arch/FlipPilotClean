import { FlipRecord } from "../features/vehicles/models/FlipRecord";

export function resolveCategory(flip: FlipRecord): string {
  // 1. Direct category from FlipRecord (top-level)
  if (flip.category) return flip.category;

  // 2. Keyword-based detection (from description instead)
  const keywords =
    flip.ai?.description?.toLowerCase() ??
    flip.title.toLowerCase(); // fallback to title

  if (keywords.includes("toy") || keywords.includes("lego")) return "Toys";
  if (keywords.includes("book") || keywords.includes("novel")) return "Books";
  if (keywords.includes("shoe") || keywords.includes("shirt")) return "Fashion";
  if (keywords.includes("tool") || keywords.includes("drill")) return "Tools";
  if (keywords.includes("phone") || keywords.includes("camera")) return "Electronics";

  // 3. Title-based fallback
  const title = flip.title.toLowerCase();

  if (title.includes("toy")) return "Toys";
  if (title.includes("book")) return "Books";
  if (title.includes("shoe")) return "Fashion";
  if (title.includes("tool")) return "Tools";
  if (title.includes("phone") || title.includes("camera")) return "Electronics";

  // 4. Unknown
  return "Unknown";
}
