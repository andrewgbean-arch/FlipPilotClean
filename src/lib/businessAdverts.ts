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
  /** A full address for a picture the server holds. */
  image: string;
  website?: string;
  /** Boot Fairs only: the big banner rather than a small card. */
  featured?: boolean;
};
