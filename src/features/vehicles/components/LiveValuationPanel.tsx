import { View, Text } from "react-native";

import GlowPulseCard from "@/components/ui/GlowPulseCard";
import FlipScoreMeter from "@/components/analytics/FlipScoreMeter";
import ConfidenceMeter from "@/components/analytics/ConfidenceMeter";
import MarketHeatIndex from "@/components/analytics/MarketHeatIndex";
import FlipIntelligencePanel from "@/components/core/FlipIntelligencePanel";
import { formatMoney, realisedProfit } from "@/features/vehicles/utils/vehicleStats";

export default function LiveValuationPanel({ flip, theme }: { flip: any; theme: any }) {
  const profit = realisedProfit(flip);
  // Confidence is 0-100. The edit screens keep it under aiPrice, the AI lookup at the top level.
  const confidence = flip.aiPrice?.confidence ?? flip.aiPriceConfidence ?? 0;

  return (
    <View
      style={{
        padding: 16,
        borderRadius: 16,
        backgroundColor: theme.card,
        borderWidth: 2,
        borderColor: theme.goldDeep,
        marginTop: 20,
        gap: 20,
      }}
    >
      {/* PROFIT */}
      <GlowPulseCard>
        <Text
          style={{
            fontSize: 22,
            fontWeight: "800",
            color:
              profit === null
                ? theme.muted
                : profit > 0
                ? theme.accent
                : theme.danger,
          }}
        >
          Profit: {formatMoney(profit)}
        </Text>
      </GlowPulseCard>

      {/* FLIP SCORE METER */}
      <FlipScoreMeter
        price={flip.sellPrice ?? 0}
        mileage={flip.mileage ?? 0}
        descriptionLength={flip.ai?.description?.length ?? 0}
      />

      {/* CONFIDENCE */}
      <ConfidenceMeter score={confidence} />

      {/* MARKET HEAT */}
      <MarketHeatIndex />

      {/* AI INTELLIGENCE */}
      <FlipIntelligencePanel
        mot={flip.mot}
        history={flip.mot?.mileageHistory ?? []}
        theme={theme}
      />
    </View>
  );
}
