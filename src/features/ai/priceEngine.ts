import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

export function computeAiPrice(flip: FlipRecord) {
  const base = flip.sellPrice || flip.buyPrice || 0;

  const demandBoost = (flip.market?.demandScore ?? 50) / 100;

  const rarityBoost =
    flip.rarity === "Ultra Rare"
      ? 0.25
      : flip.rarity === "Rare"
      ? 0.15
      : flip.rarity === "Uncommon"
      ? 0.08
      : 0;

  const motPenalty =
    flip.mot?.motStatus === "Fail"
      ? 0.2
      : flip.mot?.motStatus === "Advisory"
      ? 0.1
      : 0;

  const suggested =
    base * (1 + demandBoost + rarityBoost - motPenalty);

  const confidence =
    (flip.aiPriceConfidence ?? 60) -
    motPenalty * 20 +
    demandBoost * 20;

 const riskLevel: "low" | "medium" | "high" =
  confidence > 75 ? "low" : confidence > 50 ? "medium" : "high";


  const notes = [
    demandBoost > 0.5 && "High demand market",
    rarityBoost > 0 && `Rarity boost: ${flip.rarity}`,
    motPenalty > 0 && "MOT issues reduce price",
  ]
    .filter(Boolean)
    .join(" • ");

  return {
    recommendedSellPrice: Math.round(suggested),
    confidence: Math.max(0, Math.min(100, Math.round(confidence))),
    riskLevel,
    notes,
  };
}
