import axios from "axios";
import * as cheerio from "cheerio";

export default async function fetchAmazonMarket(query: string) {
  try {
    if (!query) return null;

    const searchUrl = `https://www.amazon.co.uk/s?k=${encodeURIComponent(
      query
    )}`;

    const { data } = await axios.get(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
    });

    const $ = cheerio.load(data);

    const first = $("div.s-result-item").first();

    if (!first) return null;

    const priceWhole = first.find("span.a-price-whole").first().text().trim();
    const priceFraction = first
      .find("span.a-price-fraction")
      .first()
      .text()
      .trim();

    const image = first.find("img.s-image").attr("src") || null;

    const newPrice =
      priceWhole && priceFraction
        ? Number(`${priceWhole}.${priceFraction}`)
        : null;

    return {
      newPrice,
      usedPrice: null,
      image,
    };
  } catch (err) {
    console.log("Amazon Scraper Error →", err);
    return null;
  }
}
