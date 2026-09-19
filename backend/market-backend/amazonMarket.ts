import axios from "axios";
import * as cheerio from "cheerio";
import { priceForPack } from "./bulkListingFilter";

// How many of the top results to look at, and how many usable ones to average.
const RESULTS_TO_SCAN = 10;
const RESULTS_TO_USE = 3;

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Amazon UK's first search result is very often a paid ad or a big multipack,
 * and it used to be the only thing read: a £3.49 pack of lozenges was priced
 * from a 72-lozenge box. Now several results are read, ads and multipacks are
 * skipped, and the middle price of what is left is used.
 */
export default async function fetchAmazonMarket(
  query: string,
  wantedCount?: number | null
) {
  try {
    if (!query) return null;

    const searchUrl = `https://www.amazon.co.uk/s?k=${encodeURIComponent(query)}`;

    const { data } = await axios.get(searchUrl, {
      timeout: 4000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
    });

    const $ = cheerio.load(data);

    const prices: number[] = [];
    let image: string | null = null;

    $('div[data-component-type="s-search-result"]')
      .slice(0, RESULTS_TO_SCAN)
      .each((_, el) => {
        if (prices.length >= RESULTS_TO_USE) return;

        const card = $(el);
        const text = card.text().replace(/\s+/g, " ").trim();
        // Paid placements are not what the shelf price is: skip them.
        if (
          /sponsored/i.test(card.find(".puis-sponsored-label-text, .s-sponsored-label-text").text()) ||
          /^\s*sponsored/i.test(text)
        ) {
          return;
        }

        // The product name is in a span inside the heading; the heading alone is just the brand.
        const title =
          card.find("h2 span").text().trim() || card.find("h2").first().text().trim() || text.slice(0, 250);

        const whole = card.find("span.a-price-whole").first().text().replace(/[^0-9]/g, "");
        const fraction = card.find("span.a-price-fraction").first().text().replace(/[^0-9]/g, "");
        if (!whole) return;

        const listed = Number(`${whole}.${fraction || "0"}`);
        // Scaled to the scanned pack size where the listing says its own; skipped if bulk.
        const price = priceForPack(title, listed, wantedCount);
        if (price === null) return;

        prices.push(price);
        if (!image) image = card.find("img.s-image").attr("src") || null;
      });

    return {
      newPrice: prices.length ? Number(median(prices).toFixed(2)) : null,
      usedPrice: null,
      image,
    };
  } catch (err: any) {
    console.log("Amazon Scraper Error →", err?.code ?? err?.message ?? err);
    return null;
  }
}
