import type { BusinessAdvert } from "@/lib/businessAdverts";

/**
 * FlipPilot's own promos, used to fill advert space nobody has bought so it is
 * never left empty and always selling something: our Dealer OS, and an
 * invitation to advertise. They come after every paying advertiser, never in
 * place of one, and are labelled as FlipPilot's own rather than "Sponsored".
 *
 * They are made in the app (see HousePromo) and are not counted like paid
 * adverts: nobody paid, so there is nothing to report to anyone.
 */
export const HOUSE_ADVERTS: BusinessAdvert[] = [
  {
    id: "house-dealers",
    house: "dealers",
    title: "FlipPilot Dealer OS",
    tagline: "Run your whole dealership from one app",
    description: "Stock, diary, customers and invoices in one place, and list your cars free on the Marketplace.",
    image: "",
  },
  {
    id: "house-advertise",
    house: "advertise",
    title: "Advertise here",
    tagline: "Put your business in front of people near you",
    description: "Reach local buyers and sellers, or the whole country.",
    image: "",
  },
];

/**
 * The paying adverts first, then just enough of our own to fill the places that
 * would otherwise be empty. `slots` is how many places there are to fill.
 */
export function fillWithHouse(
  paid: BusinessAdvert[],
  house: BusinessAdvert[],
  slots: number
): BusinessAdvert[] {
  const missing = Math.max(0, slots - paid.length);
  return missing > 0 ? [...paid, ...house.slice(0, missing)] : paid;
}
