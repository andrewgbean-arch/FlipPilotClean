import { useState } from "react";
import { BASE_URL } from "@/utils/api";

export type MarketScanResult = {
  googlePriceMin?: number | null;
  googlePriceMax?: number | null;
  lowest?: number | null;
  highest?: number | null;
  average?: number | null;
  smartPrice?: number | null;
  soldCount?: number | null;
  demandScore?: number | null;
  aiPriceMin?: number | null;
  aiPriceMax?: number | null;
  aiPriceConfidence?: number | null;
};

export function useMarketScan() {
  const [loading, setLoading] = useState(false);

  const fetchMarketScan = async (query: {
    title: string;
    buyPrice: number | null;
    sellPrice: number | null;
    notes: string;
    images: string[];
  }): Promise<MarketScanResult | null> => {
    if (!query.title) return null;

    try {
      setLoading(true);

      const res = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(query.title)}`);

      if (!res.ok) return null;

      const data = await res.json();
      if (data.error) return null;

      return data.market as MarketScanResult;
    } catch (e) {
      console.log("Market scan error", e);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { fetchMarketScan, loading };
}
