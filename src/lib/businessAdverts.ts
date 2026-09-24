/**
 * What an advert looks like to the app.
 *
 * Adverts are not kept in the app. They come from the server (src/lib/adverts.ts)
 * and only when a business has really paid to advertise, and been approved and
 * booked for today's date. Nothing is shown otherwise, and there are no made-up
 * businesses or star ratings: a rating must never be typed in.
 */
export type BusinessAdvert = {
  id: string;
  title: string;
  description?: string;
  tagline?: string;
  /** A full address for the main picture the server holds. */
  image: string;
  /** All its pictures (up to three), the main one first. */
  images?: string[];
  website?: string;
  /** Boot Fairs only: the big banner rather than a small card. */
  featured?: boolean;
  /** Set on FlipPilot's own promos (see houseAdverts): drawn in the app and opens our own link. */
  house?: "dealers" | "advertise";
};
