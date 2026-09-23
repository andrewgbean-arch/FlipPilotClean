export type BusinessAdvert = {
  id: string;
  title: string;
  description: string;
  tagline?: string;
  image: string;
  website?: string;
  phone?: string;
  category?: string;
  rating?: number; // 1–5 stars
  isFeatured?: boolean;
  clicks?: number;
};

/**
 * Sponsor slots, on the Boot Fairs page and while a scan is loading.
 *
 * Empty on purpose: only add a business that has really agreed to advertise,
 * with its own name, image and link. This list used to hold three invented
 * businesses with made-up star ratings, which is misleading advertising, so
 * it was cleared. While it is empty every sponsor slot simply doesn't show.
 * A `rating` must come from a real source, never be typed in.
 */
export const businessAdverts: BusinessAdvert[] = [];
