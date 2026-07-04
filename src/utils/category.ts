import { FlipRecord } from "../models/FlipRecord";

export function resolveCategory(flip: FlipRecord): string {
  // 1. Direct AI category
  if (flip.ai?.category) return flip.ai.category;

  // 2. Keyword-based detection
  const keywords = flip.ai?.keywords?.join(" ").toLowerCase() ?? "";

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
