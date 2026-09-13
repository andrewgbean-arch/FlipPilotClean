import { View, Text } from "react-native";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

type FlipTimeAnalyzerProps = {
  vehicles: FlipRecord[];
  theme: any;
};

export default function FlipTimeAnalyzer({ vehicles, theme }: FlipTimeAnalyzerProps) {
  const durations = vehicles
    .map((v: FlipRecord) => {
      const start = v.buyDate;
      const end = v.sellDate;

      if (!start || !end) return null;

      const startDate = new Date(start).getTime();
      const endDate = new Date(end).getTime();

      if (isNaN(startDate) || isNaN(endDate)) return null;

      const days = (endDate - startDate) / (1000 * 60 * 60 * 24);
      return Math.round(days);
    })
    .filter((d): d is number => d !== null);

  const avg =
    durations.length > 0
      ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length)
      : 0;

  return (
    <View>
      <Text style={{ color: theme.white, fontSize: 18, fontWeight: "700" }}>
        Avg Flip Time: {avg} days
      </Text>

      <Text style={{ color: theme.muted, marginTop: 6 }}>
        {avg <= 14
          ? "⚡ Fast flips — great turnover."
          : avg <= 30
          ? "📊 Moderate flip speed."
          : "🐌 Slow flips — review pricing or sourcing."}
      </Text>
    </View>
  );
}
