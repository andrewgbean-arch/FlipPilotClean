import { View, Text, ScrollView } from "react-native";
import { useTheme } from "@/styles/ThemeContext";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useUserSettings } from "@/features/settings/UserSettingsContext";
import { useRouter } from "expo-router";

import DealerNeonHeader from "@/components/dealer/DealerNeonHeader";
import SupernovaCard from "@/components/dealer/SupernovaCard";
import { MetricRow } from "@/components/MetricRow";
import { GradientChip } from "@/components/GradientChip";
import { AnimatedBar } from "@/components/AnimatedBar";

import Svg, { Rect, Polyline } from "react-native-svg";

function parseUkDate(dateStr?: string | null) {
  if (!dateStr) return null;
  const [day, month, year] = dateStr.split("/").map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

export default function DealerPerformanceHub() {
  const theme = useTheme();
  const router = useRouter();
  const { vehicles } = useVehicleHistory();
  const { isDealer } = useUserSettings();

  if (!isDealer) {
    return (
      <View style={{ padding: 20 }}>
        <Text style={{ color: theme.white, fontSize: 22, fontWeight: "700" }}>
          Dealer Mode is OFF
        </Text>
        <Text style={{ color: theme.muted, marginTop: 10 }}>
          Turn it on in Settings to access Dealer Performance Hub.
        </Text>
      </View>
    );
  }

  const sold = vehicles.filter((v) => v.sellDate);
  const stock = vehicles.filter((v) => !v.sellDate);

  const totalProfit = sold.reduce((sum, v) => {
    const profit = (v.sellPrice ?? v.valuation ?? 0) - (v.buyPrice ?? 0);
    return sum + profit;
  }, 0);

  const flipTimes = sold.map((v) => {
    const start = new Date(v.buyDate ?? v.timestamp).getTime();
    const end = new Date(v.sellDate ?? v.timestamp).getTime();
    return Math.ceil((end - start) / 86400000);
  });

  const avgFlipTime =
    flipTimes.length > 0
      ? Math.round(flipTimes.reduce((a, b) => a + b, 0) / flipTimes.length)
      : 0;

  const bestFlip = sold.reduce(
    (best, v) => {
      const profit = (v.sellPrice ?? v.valuation ?? 0) - (v.buyPrice ?? 0);
      if (profit > best.profit) return { vehicle: v, profit };
      return best;
    },
    { vehicle: null as any, profit: -Infinity }
  );

  const worstFlip = sold.reduce(
    (worst, v) => {
      const profit = (v.sellPrice ?? v.valuation ?? 0) - (v.buyPrice ?? 0);
      if (profit < worst.profit) return { vehicle: v, profit };
      return worst;
    },
    { vehicle: null as any, profit: Infinity }
  );

  // MOT buckets
  const now = new Date();
  const expiredMOT = vehicles.filter((v) => {
    const d = parseUkDate(v.mot?.motExpiry ?? v.mot?.expiryDate ?? null);
    return d !== null && d.getTime() < now.getTime();
  });

  const mot30 = vehicles.filter((v) => {
    const d = parseUkDate(v.mot?.motExpiry ?? v.mot?.expiryDate ?? null);
    if (!d) return false;
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / 86400000);
    return diffDays > 0 && diffDays <= 30;
  });

  const mot60 = vehicles.filter((v) => {
    const d = parseUkDate(v.mot?.motExpiry ?? v.mot?.expiryDate ?? null);
    if (!d) return false;
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / 86400000);
    return diffDays > 30 && diffDays <= 60;
  });

  // Monthly profit
  const monthlyProfitMap: Record<string, number> = {};
  sold.forEach((v) => {
    const month = new Date(v.sellDate ?? v.timestamp)
      .toISOString()
      .slice(0, 7);
    const profit = (v.sellPrice ?? v.valuation ?? 0) - (v.buyPrice ?? 0);
    monthlyProfitMap[month] = (monthlyProfitMap[month] ?? 0) + profit;
  });

  const months = Object.keys(monthlyProfitMap).sort();
  const profits = months.map((m) => monthlyProfitMap[m]);
  const maxProfit = Math.max(...profits, 1);

  const linePoints = profits
    .map((p, i) => {
      const x = i * 40 + 20;
      const y = 120 - (p / maxProfit) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  // Flip score distribution
  const scoreBuckets = [0, 0, 0, 0, 0];
  vehicles.forEach((v) => {
    const score = v.flipScore ?? 0;
    const index = Math.min(4, Math.floor(score / 20));
    scoreBuckets[index]++;
  });
  const maxBucket = Math.max(...scoreBuckets, 1);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <DealerNeonHeader
        title="Dealer Performance Hub"
        subtitle="Operational Metrics & Historical Intelligence"
      />

      <ScrollView style={{ padding: 20 }}>
        {/* ⭐ Profit Summary */}
        <SupernovaCard
          title="Profit Summary"
          subtitle="Historical performance overview"
          icon="💷"
          badge="AI"
          gradientBar
          glow
        >
          <GradientChip text="Performance Metrics" theme={theme} />

          <MetricRow label="Total Profit" value={`£${totalProfit}`} theme={theme} />
          <MetricRow label="Vehicles Sold" value={sold.length} theme={theme} />
          <MetricRow label="Vehicles in Stock" value={stock.length} theme={theme} />
          <MetricRow label="Avg Flip Time" value={`${avgFlipTime} days`} theme={theme} />

          <AnimatedBar value={Math.min(100, (totalProfit / 50000) * 100)} theme={theme} />
        </SupernovaCard>

        {/* ⭐ Best & Worst Flip */}
        <SupernovaCard
          title="Best & Worst Flip"
          subtitle="Profit extremes"
          icon="📊"
          badge="AI"
          gradientBar
          glow
        >
          <MetricRow
            label="Best Flip"
            value={bestFlip.vehicle ? `£${bestFlip.profit}` : "N/A"}
            theme={theme}
          />
          <MetricRow
            label="Worst Flip"
            value={worstFlip.vehicle ? `£${worstFlip.profit}` : "N/A"}
            theme={theme}
          />
        </SupernovaCard>

        {/* ⭐ MOT Status */}
        <SupernovaCard
          title="MOT Status Overview"
          subtitle="Expiry buckets"
          icon="🔧"
          badge="AI"
          gradientBar
          glow
        >
          <MetricRow label="Expired MOT" value={expiredMOT.length} theme={theme} />
          <MetricRow label="MOT ≤ 30 days" value={mot30.length} theme={theme} />
          <MetricRow label="MOT 30–60 days" value={mot60.length} theme={theme} />
        </SupernovaCard>

        {/* ⭐ Monthly Profit Chart */}
        <SupernovaCard
          title="Monthly Profit"
          subtitle="Line chart"
          icon="📈"
          badge="AI"
          gradientBar
          glow
        >
          <Svg height="140" width="100%">
            <Polyline
              points={linePoints}
              fill="none"
              stroke={theme.goldDeep}
              strokeWidth="3"
            />
          </Svg>
        </SupernovaCard>

        {/* ⭐ Flip Score Distribution */}
        <SupernovaCard
          title="Flip Score Distribution"
          subtitle="Bar chart"
          icon="📊"
          badge="AI"
          gradientBar
          glow
        >
          <Svg height="140" width="100%">
            {scoreBuckets.map((count, i) => {
              const barHeight = (count / maxBucket) * 100;
              return (
                <Rect
                  key={i}
                  x={i * 50 + 20}
                  y={120 - barHeight}
                  width="30"
                  height={barHeight}
                  fill={theme.goldDeep}
                />
              );
            })}
          </Svg>
        </SupernovaCard>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}
