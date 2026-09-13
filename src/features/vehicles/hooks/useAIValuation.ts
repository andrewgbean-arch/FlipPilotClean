import { useState } from "react";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { BASE_URL } from "@/utils/api";

type AIResponse = {
  recommendedSellPrice: number | null;
  riskLevel: "low" | "medium" | "high";
  confidence: number | null;
  aiPriceMin: number | null;
  aiPriceMax: number | null;
  insights: string;
};

export function useAIValuation() {
  const [loading, setLoading] = useState(false);

  const fetchAIValuation = async (vehicle: FlipRecord): Promise<AIResponse | null> => {
    if (!vehicle.title) return null;

    try {
      setLoading(true);

      const res = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(vehicle.title)}`);

      if (!res.ok) return null;

      const data = await res.json();
      if (data.error) return null;

      const confidence = data.aiPriceConfidence ?? data.market?.aiPriceConfidence ?? null;

      return {
        recommendedSellPrice: data.pricing?.recommendedSellPrice ?? null,
        riskLevel: confidence == null ? "medium" : confidence >= 70 ? "low" : confidence >= 40 ? "medium" : "high",
        confidence,
        aiPriceMin: data.aiPriceMin ?? null,
        aiPriceMax: data.aiPriceMax ?? null,
        insights: data.insights ?? "",
      };
    } catch (e) {
      console.log("AI valuation error", e);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { fetchAIValuation, loading };
}
