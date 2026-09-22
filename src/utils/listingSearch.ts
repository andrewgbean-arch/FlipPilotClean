import { categoryLabel } from "@/constants/marketplaceCategories";

/**
 * Everything a listing holds, as one lowercase string to search through —
 * title, description, where it is, what condition it is in, its category, and
 * every answer the seller gave for that category. So "size 10", "unlocked",
 * "oak" or "Paignton" all find something, not just a make and model.
 */
export function searchableText(item: any): string {
  const parts: unknown[] = [
    item?.title,
    item?.description,
    item?.location,
    item?.condition,
    categoryLabel(item?.category),
    item?.vehicle?.make,
    item?.vehicle?.model,
    item?.vehicle?.year,
    item?.mileage != null ? `${item.mileage} miles` : null,
    item?.price != null ? `£${item.price}` : null,
  ];

  if (item?.details && typeof item.details === "object") {
    parts.push(...Object.values(item.details));
  }

  return parts
    .filter((p) => typeof p === "string" || typeof p === "number")
    .map(String)
    .join(" ")
    .toLowerCase();
}

/**
 * Every word typed has to appear somewhere in the listing, so "nike 10" finds
 * a size 10 Nike and not everything Nike has ever made.
 */
export function matchesSearch(item: any, search: string): boolean {
  const words = String(search ?? "").toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const haystack = searchableText(item);
  return words.every((word) => haystack.includes(word));
}
