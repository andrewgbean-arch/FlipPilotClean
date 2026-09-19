import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useTheme } from "@/styles/ThemeContext";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useRouter } from "expo-router";
import Svg, { Rect, Polyline } from "react-native-svg";
import { motDaysLeft } from "@/features/vehicles/utils/motDates";
import {
  formatMoney,
  isVehicleRecord,
  realisedProfit,
} from "@/features/vehicles/utils/vehicleStats";

export default function MotorsAnalytics() {
  const theme = useTheme();
  const router = useRouter();
  const { vehicles: records } = useVehicleHistory();

  // Scans share the store with vehicles but are not vehicles.
  const vehicles = records.filter(isVehicleRecord);

  const sold = vehicles.filter((v) => v.sellDate);
  const stock = vehicles.filter((v) => !v.sellDate);

  const totalProfit = sold.reduce((sum, v) => sum + (realisedProfit(v) ?? 0), 0);

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
      const profit = realisedProfit(v);
      if (profit !== null && profit > best.profit) {
        return { vehicle: v, profit };
      }
      return best;
    },
    { vehicle: null as any, profit: -Infinity }
  );

  const worstFlip = sold.reduce(
    (worst, v) => {
      const profit = realisedProfit(v);
      if (profit !== null && profit < worst.profit) {
        return { vehicle: v, profit };
      }
      return worst;
    },
    { vehicle: null as any, profit: Infinity }
  );

  // MOT buckets (a MOT is valid through the whole of its expiry day)
  const expiredMOT = vehicles.filter((v) => {
    const days = motDaysLeft(v);
    return days !== null && days < 0;
  });

  const mot30 = vehicles.filter((v) => {
    const days = motDaysLeft(v);
    return days !== null && days >= 0 && days <= 30;
  });

  const mot60 = vehicles.filter((v) => {
    const days = motDaysLeft(v);
    return days !== null && days > 30 && days <= 60;
  });

  // Monthly profit
  const monthlyProfitMap: Record<string, number> = {};
  sold.forEach((v) => {
    const month = new Date(v.sellDate ?? v.timestamp)
      .toISOString()
      .slice(0, 7);
    const profit = realisedProfit(v) ?? 0;
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
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.black }}
      contentContainerStyle={{ padding: 16 }}
    >
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={{ color: theme.goldDeep, marginBottom: 10 }}>
          ← Back
        </Text>
      </TouchableOpacity>

      <Text
        style={{
          fontSize: 32,
          fontWeight: "800",
          color: theme.goldDeep,
          marginBottom: 20,
          textShadowColor: theme.goldSoftGlow,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 8,
        }}
      >
        Analytics
      </Text>

      {/* Stats grid */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <StatCard label="Total Profit" value={formatMoney(totalProfit)} theme={theme} />
        <StatCard label="Total Vehicles" value={vehicles.length} theme={theme} />
        <StatCard label="Stock" value={stock.length} theme={theme} />
        <StatCard label="Sold" value={sold.length} theme={theme} />
        <StatCard label="Avg Flip Time" value={`${avgFlipTime} days`} theme={theme} />
        <StatCard
          label="Best Flip"
          value={bestFlip.vehicle ? formatMoney(bestFlip.profit) : "N/A"}
          theme={theme}
        />
        <StatCard
          label="Worst Flip"
          value={worstFlip.vehicle ? formatMoney(worstFlip.profit) : "N/A"}
          theme={theme}
        />
        <StatCard
          label="Expired MOT"
          value={expiredMOT.length}
          theme={theme}
        />
        <StatCard
          label="MOT ≤ 30 days"
          value={mot30.length}
          theme={theme}
        />
        <StatCard
          label="MOT 30–60 days"
          value={mot60.length}
          theme={theme}
        />
      </View>

      {/* Link to MOT alerts screen */}
      <TouchableOpacity
        style={{
          marginTop: 20,
          backgroundColor: theme.goldDeep,
          padding: 12,
          borderRadius: theme.radius.md,
        }}
        onPress={() => router.push("/motors/mot-alerts")}
      >
        <Text
          style={{
            color: theme.black,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          View MOT Alerts
        </Text>
      </TouchableOpacity>

      {/* Monthly profit line chart */}
      <Text style={{ color: theme.white, fontSize: 20, marginTop: 30 }}>
        Monthly Profit (Line Chart)
      </Text>

      <Svg height="140" width="100%">
        <Polyline
          points={linePoints}
          fill="none"
          stroke={theme.goldDeep}
          strokeWidth="3"
        />
      </Svg>

      {/* Flip score bar chart */}
      <Text style={{ color: theme.white, fontSize: 20, marginTop: 30 }}>
        Flip Score Distribution (Bar Chart)
      </Text>

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

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

type StatCardProps = {
  label: string;
  value: string | number;
  theme: any;
};

function StatCard({ label, value, theme }: StatCardProps) {
  return (
    <View
      style={{
        width: "48%",
        backgroundColor: theme.card,
        padding: 14,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.goldSoftGlow,
      }}
    >
      <Text style={{ color: theme.muted, fontSize: 14 }}>{label}</Text>
      <Text
        style={{
          color: theme.white,
          fontSize: 20,
          fontWeight: "700",
          marginTop: 4,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
