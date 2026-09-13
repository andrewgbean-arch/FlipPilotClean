import { View, Text } from "react-native";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

type SmartAlertsProps = {
  vehicles: FlipRecord[];
  theme: any;
};

export default function SmartAlerts({ vehicles, theme }: SmartAlertsProps) {
  const alerts: string[] = [];

  vehicles.forEach((v: FlipRecord) => {
    const mot = v.mot ?? {};

    const failures = mot.failures ?? [];
    const advisories = mot.advisories ?? [];
    const status = mot.motStatus ?? "pass";
    const reg = mot.reg ?? v.title;

    if (status === "fail") alerts.push(`❗ ${reg}: MOT failed`);
    if (advisories.length > 3) alerts.push(`⚠️ ${reg}: High advisory count`);
    if (failures.length > 0) alerts.push(`🔧 ${reg}: MOT failures present`);
    if ((v.sellPrice ?? 0) < (v.buyPrice ?? 0))
      alerts.push(`📉 ${reg}: Sold at a loss`);
  });

  return (
    <View>
      {alerts.length === 0 ? (
        <Text style={{ color: theme.muted }}>No alerts — all good.</Text>
      ) : (
        alerts.map((a: string, i: number) => (
          <Text key={i} style={{ color: theme.white, marginBottom: 4 }}>
            {a}
          </Text>
        ))
      )}
    </View>
  );
}
