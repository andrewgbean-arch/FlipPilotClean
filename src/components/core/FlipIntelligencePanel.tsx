import { View } from "react-native";

import MOTHealthScore from "@/components/motors/MOTHealthScore";
import MOTExpiryCountdownCard from "@/components/motors/MOTExpiryCountdownCard";
import MOTPredictionCard from "@/components/motors/MOTPredictionCard";
import MileageFlow from "@/components/motors/MileageFlow";
import MOTStatusCard from "@/components/motors/MOTStatusCard";

export default function FlipIntelligencePanel({
  mot,
  history,
  theme,
}: {
  mot: any;
  history: any[];
  theme: any;
}) {
  // Expiry
  const expiryDate = mot.expiryDate ? new Date(mot.expiryDate) : null;

  const daysLeft = expiryDate
    ? Math.max(
        0,
        Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      )
    : null;

  // Prediction
  const nextMotPrediction = expiryDate
    ? new Date(expiryDate.getTime() + 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0]
    : "Unknown";

  return (
    <View style={{ gap: 20 }}>
      <MOTHealthScore history={history} theme={theme} />

      <MOTExpiryCountdownCard daysLeft={daysLeft} theme={theme} />

      <MOTPredictionCard prediction={nextMotPrediction} theme={theme} />

      <MileageFlow history={history} theme={theme} />

      <MOTStatusCard
        status={mot.motStatus ?? null}
        expiryDate={mot.expiryDate ?? null}
        theme={theme}
      />
    </View>
  );
}
