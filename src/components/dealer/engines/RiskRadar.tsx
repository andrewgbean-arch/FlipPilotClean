import { View, Text } from "react-native";
import { FlipRecord } from "@/features/vehicles/models/FlipRecord";

type RiskRadarProps = {
  vehicles: FlipRecord[];
  theme: any;
};

export default function RiskRadar({ vehicles, theme }: RiskRadarProps) {
  const score = vehicles.reduce((acc: number, v: FlipRecord) => {
    let risk = 0;

    const mot = v.mot ?? {};

    const failures = mot.failures ?? [];
    const advisories = mot.advisories ?? [];
    const status = mot.motStatus ?? "pass";
    const keepers = mot.keepers ?? 0;

    if (failures.length) risk += failures.length * 15;
    if (advisories.length) risk += advisories.length * 5;
    if (keepers > 5) risk += 10;
    if (status === "fail") risk += 20;

    return acc + risk;
  }, 0);

  const avg = vehicles.length ? Math.round(score / vehicles.length) : 0;

  return (
    <View>
      <Text style={{ color: theme.white, fontSize: 18, fontWeight: "700" }}>
        Risk Score: {avg}
      </Text>

      <Text style={{ color: theme.muted, marginTop: 6 }}>
        {avg < 20
          ? "🟢 Low risk — inventory looks healthy."
          : avg < 50
          ? "🟡 Medium risk — keep an eye on MOT advisories."
          : "🔴 High risk — failures and advisories increasing."}
      </Text>
    </View>
  );
}
