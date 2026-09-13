import React from "react";
import { MarketplaceRankingBrainScreen } from "../../src/features/dealer-ai/screens/MarketplaceRankingBrainScreen";

export default function MarketplaceRanking() {
  const platforms = [
    {
      platform: "AutoTrader",
      visibility: 8.4,
      engagement: 7.9,
      buyerIntent: 8.1,
      searchRank: 1,
      competitorRank: 2,
      listingQuality: 7.8,
      platformStrength: "Highest buyer intent and strongest search visibility.",
      platformWeakness: "High competition and higher listing costs.",
    },
    {
      platform: "Facebook Marketplace",
      visibility: 7.1,
      engagement: 6.4,
      buyerIntent: 5.9,
      searchRank: 4,
      competitorRank: 5,
      listingQuality: 5.2,
      platformStrength: "High engagement and free listings.",
      platformWeakness: "Low buyer intent and inconsistent search ranking.",
    },
    {
      platform: "eBay Motors",
      visibility: 6.8,
      engagement: 6.1,
      buyerIntent: 6.4,
      searchRank: 3,
      competitorRank: 3,
      listingQuality: 6.0,
      platformStrength: "Strong national reach and good buyer intent.",
      platformWeakness: "Lower engagement and auction-style volatility.",
    },
  ];

  const data = platforms.map(p => {
    const score =
      p.visibility * 0.3 +
      p.engagement * 0.2 +
      p.buyerIntent * 0.3 +
      p.listingQuality * 0.2;

    const marketplaceBand =
      score > 7 ? "HIGH" : score > 4.5 ? "MEDIUM" : "LOW";

    const marketplaceAdjustment =
      marketplaceBand === "HIGH"
        ? 1200
        : marketplaceBand === "MEDIUM"
        ? 300
        : -900;

    const recommendation =
      marketplaceBand === "HIGH"
        ? "Strong marketplace — prioritise listings here."
        : marketplaceBand === "MEDIUM"
        ? "Moderate marketplace — use selectively."
        : "Weak marketplace — avoid unless necessary.";

    return {
      ...p,
      marketplaceBand,
      marketplaceAdjustment,
      recommendation,
    };
  });

  return <MarketplaceRankingBrainScreen data={data} />;
}
