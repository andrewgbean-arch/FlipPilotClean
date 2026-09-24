import type { Request } from "express";

/**
 * Photos are stored as "/uploads/<name>". Anyone reading a listing needs a full
 * address to load one, so the server adds the front of it on the way out.
 * PUBLIC_BASE_URL wins when set (what to do behind a proxy that hides https);
 * otherwise the address the request itself came in on.
 */
function baseUrl(req: Request): string {
  const fixed = process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (fixed) return fixed;
  return `${req.protocol}://${req.get("host")}`;
}

function absolute(path: unknown, base: string): unknown {
  return typeof path === "string" && path.startsWith("/uploads/") ? `${base}${path}` : path;
}

export function mediaForListing<T extends Record<string, any>>(listing: T, req: Request): T {
  if (!listing || typeof listing !== "object") return listing;
  const base = baseUrl(req);
  return {
    ...listing,
    ...(Array.isArray(listing.photos)
      ? { photos: listing.photos.map((p: unknown) => absolute(p, base)) }
      : {}),
    ...(listing.bestThumbnail ? { bestThumbnail: absolute(listing.bestThumbnail, base) } : {}),
  };
}

export function mediaForAdvert<T extends Record<string, any>>(ad: T, req: Request): T {
  if (!ad || typeof ad !== "object") return ad;
  const base = baseUrl(req);
  return {
    ...ad,
    image: absolute(ad.image, base),
    ...(Array.isArray(ad.images) ? { images: ad.images.map((p: unknown) => absolute(p, base)) } : {}),
    ...(typeof ad.artwork === "string" ? { artwork: absolute(ad.artwork, base) } : {}),
  };
}

export function mediaForFair<T extends Record<string, any>>(fair: T, req: Request): T {
  if (!fair || typeof fair !== "object") return fair;
  const base = baseUrl(req);
  return Array.isArray(fair.images)
    ? { ...fair, images: fair.images.map((p: unknown) => absolute(p, base)) }
    : fair;
}
