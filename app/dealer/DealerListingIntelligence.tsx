import { ScrollView, View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/styles/ThemeContext";

import { DealerGlowCard } from "@/components/DealerGlowCard";
import { MetricRow } from "@/components/MetricRow";
import { AnimatedBar } from "@/components/AnimatedBar";
import { GradientChip } from "@/components/GradientChip";
import HeroHeader from "@/components/ui/HeroHeader";

import FinanceSuiteSummaryCard from "@/components/dealer/FinanceSuiteSummaryCard";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

export default function DealerListingIntelligence() {
  const theme = useTheme();
  const { vehicles } = useVehicleHistory();

  // pick most recent vehicle for finance summary
  const activeVehicle: FlipRecord | null =
    vehicles.length > 0
      ? [...vehicles].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]
      : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ padding: theme.spacing.lg }}
    >
      <HeroHeader title="Listing Intelligence V14" theme={theme} />

      {/* ⭐ FinanceSuite SummaryCard */}
      {activeVehicle && (
        <FinanceSuiteSummaryCard
          vehicle={activeVehicle}
          buyer={{}} // placeholder buyer until CRM wiring
        />
      )}

      {/* ⭐ Listing Performance */}
      <DealerGlowCard title="Listing Performance Score" theme={theme}>
        <GradientChip text="Moderate Performance" theme={theme} />

        <MetricRow label="Views (7 days)" value="128" theme={theme} />
        <MetricRow label="Saves" value="9" theme={theme} />
        <MetricRow label="Buyer Interest" value="Medium" theme={theme} />

        <AnimatedBar value={58} theme={theme} />
      </DealerGlowCard>

      {/* ⭐ Photos */}
      <DealerGlowCard title="Listing Photos" theme={theme}>
        {activeVehicle ? (
          <>
            <MetricRow
              label="Photos uploaded"
              value={activeVehicle.images?.length ?? 0}
              theme={theme}
            />
            <MetricRow
              label="AI condition scan"
              value={activeVehicle.images?.length ? "Available" : "No photos yet"}
              theme={theme}
            />

            <TouchableOpacity
              onPress={() => router.push(`/dealer/gallery/${activeVehicle.id}`)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginTop: 14,
                backgroundColor: theme.goldDeep,
                paddingVertical: 10,
                borderRadius: theme.radius.md,
                justifyContent: "center",
              }}
            >
              <Feather name="camera" size={16} color={theme.black} />
              <Text style={{ color: theme.black, fontWeight: "700" }}>
                Open AI Photo Analysis
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={{ color: theme.muted }}>No active listing yet.</Text>
        )}
      </DealerGlowCard>

      {/* ⭐ Buyer Search Match */}
      <DealerGlowCard title="Buyer Search Match" theme={theme}>
        <GradientChip text="Low Match" theme={theme} />

        <MetricRow label="Keyword Match" value="38%" theme={theme} />
        <MetricRow label="Category Fit" value="Low" theme={theme} />
        <MetricRow label="Search Frequency" value="Weak" theme={theme} />

        <AnimatedBar value={38} theme={theme} />
      </DealerGlowCard>

      {/* ⭐ Price Competitiveness */}
      <DealerGlowCard title="Price Competitiveness" theme={theme}>
        <GradientChip text="Slightly Overpriced" theme={theme} />

        <MetricRow label="Market Avg" value="£4,120" theme={theme} />
        <MetricRow label="Your Price" value="£4,495" theme={theme} />
        <MetricRow label="Overprice %" value="9%" theme={theme} />

        <AnimatedBar value={91} theme={theme} />
      </DealerGlowCard>

      {/* ⭐ AI Listing Fixes */}
      <DealerGlowCard title="AI Listing Fixes" theme={theme}>
        <GradientChip text="Recommended Improvements" theme={theme} />

        <Text style={theme.textStyle}>
          • Add 3 more exterior angles{"\n"}
          • Include interior dashboard close‑up{"\n"}
          • Add “Full Service History” to description{"\n"}
          • Reduce price by £150 to match market
        </Text>
      </DealerGlowCard>

      {/* ⭐ Competitor Comparison */}
      <DealerGlowCard title="Competitor Comparison" theme={theme}>
        <GradientChip text="Competitors Selling Faster" theme={theme} />

        <MetricRow label="Avg Competitor Price" value="£4,250" theme={theme} />
        <MetricRow label="Avg Competitor Views" value="212" theme={theme} />
        <MetricRow label="Competitor Speed" value="Fast" theme={theme} />

        <AnimatedBar value={72} theme={theme} />
      </DealerGlowCard>

      {/* ⭐ Next Move AI */}
      <DealerGlowCard title="Next Move AI" theme={theme}>
        <GradientChip text="Action Required" theme={theme} />

        <Text style={theme.textStyle}>
          Lower price slightly, update photos, and refresh listing timing{"\n"}
          to boost visibility in peak buyer hours.
        </Text>
      </DealerGlowCard>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
