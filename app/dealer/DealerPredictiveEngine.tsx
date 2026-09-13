import { View, Text, ScrollView } from "react-native";
import { useTheme } from "@/styles/ThemeContext";
import DealerNeonHeader from "@/components/dealer/DealerNeonHeader";
import SupernovaCard from "@/components/dealer/SupernovaCard";
import { GradientChip } from "@/components/GradientChip";

import MotAiFutureTimeline from "@/components/motors/MotAiFutureTimeline";
import MotAiOutcomeSimulator from "@/components/motors/MotAiOutcomeSimulator";
import MotAiChainReaction from "@/components/motors/MotAiChainReaction";
import MotAiNeuralRiskMap from "@/components/motors/MotAiNeuralRiskMap";
import MotAiPassChance from "@/components/motors/MotAiPassChance";
import MotAiBuyerConfidence from "@/components/motors/MotAiBuyerConfidence";
import MotAiMileageProjection from "@/components/motors/MotAiMileageProjection";
import MotAiServicePredictor from "@/components/motors/MotAiServicePredictor";
import MotAiCostEstimator from "@/components/motors/MotAiCostEstimator";
import MotAiRecommendations from "@/components/motors/MotAiRecommendations";

import { motAiEngine } from "@/features/vehicles/ai/motAiEngine";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { useLocalSearchParams } from "expo-router";

export default function DealerPredictiveEngine() {
  const theme = useTheme();
  const { id } = useLocalSearchParams();
  const { vehicles } = useVehicleHistory();

  // ⭐ Select vehicle by ID or fallback to newest
  const vehicle =
    vehicles.find((v) => String(v.id) === String(id)) ??
    [...vehicles].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

  if (!vehicle) {
    return (
      <View style={{ padding: 20 }}>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: "800" }}>
          Loading predictive engine…
        </Text>
      </View>
    );
  }

  // ⭐ Generate MotAiResult correctly
  const motAi = motAiEngine(
    vehicle.mot ?? {},
    [{ mileage: vehicle.mileage ?? 0 }]
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <DealerNeonHeader
        title="Predictive Intelligence Engine"
        subtitle="AI‑Powered Future Forecasting"
      />

      <ScrollView style={{ padding: 20 }}>
        {/* ⭐ Buyer Confidence */}
        <SupernovaCard
          title="Buyer Confidence Forecast"
          subtitle="AI prediction of buyer behaviour"
          icon="🧠"
          badge="AI"
          shimmer
          gradientBar
          glow
        >
          <GradientChip text="Confidence Model" theme={theme} />
          <MotAiBuyerConfidence ai={motAi} theme={theme} />
        </SupernovaCard>

        {/* ⭐ MOT Pass Chance */}
        <SupernovaCard
          title="MOT Pass Probability"
          subtitle="AI pass chance modelling"
          icon="🔧"
          badge="AI"
          shimmer
          gradientBar
          glow
        >
          <MotAiPassChance ai={motAi} theme={theme} />
        </SupernovaCard>

        {/* ⭐ Mileage Projection */}
        <SupernovaCard
          title="Mileage Projection"
          subtitle="AI future mileage estimation"
          icon="📈"
          badge="AI"
          shimmer
          gradientBar
          glow
        >
          <MotAiMileageProjection
            currentMileage={vehicle.mileage ?? 0}
            theme={theme}
          />
        </SupernovaCard>

        {/* ⭐ Service Predictor */}
        <SupernovaCard
          title="Service Predictor"
          subtitle="AI maintenance forecasting"
          icon="🛠️"
          badge="AI"
          shimmer
          gradientBar
          glow
        >
          <MotAiServicePredictor
            currentMileage={vehicle.mileage ?? 0}
            theme={theme}
          />
        </SupernovaCard>

        {/* ⭐ Cost Estimator */}
        <SupernovaCard
          title="Cost Estimator"
          subtitle="AI future cost modelling"
          icon="💷"
          badge="AI"
          shimmer
          gradientBar
          glow
        >
          <MotAiCostEstimator ai={motAi} theme={theme} />
        </SupernovaCard>

        {/* ⭐ Future Timeline */}
        <SupernovaCard
          title="Future Timeline"
          subtitle="AI chronological prediction"
          icon="⏳"
          badge="AI"
          shimmer
          gradientBar
          glow
        >
          <MotAiFutureTimeline ai={motAi} theme={theme} />
        </SupernovaCard>

        {/* ⭐ Outcome Simulator */}
        <SupernovaCard
          title="Outcome Simulator"
          subtitle="AI scenario modelling"
          icon="🎲"
          badge="AI"
          shimmer
          gradientBar
          glow
        >
          <MotAiOutcomeSimulator ai={motAi} theme={theme} />
        </SupernovaCard>

        {/* ⭐ Chain Reaction */}
        <SupernovaCard
          title="Chain Reaction Model"
          subtitle="AI cascading event prediction"
          icon="🔗"
          badge="AI"
          shimmer
          gradientBar
          glow
        >
          <MotAiChainReaction ai={motAi} theme={theme} />
        </SupernovaCard>

        {/* ⭐ Neural Risk Map */}
        <SupernovaCard
          title="Neural Risk Map"
          subtitle="AI risk modelling"
          icon="⚠️"
          badge="AI"
          shimmer
          gradientBar
          glow
        >
          <MotAiNeuralRiskMap ai={motAi} theme={theme} />
        </SupernovaCard>

        {/* ⭐ Recommendations */}
        <SupernovaCard
          title="AI Recommendations"
          subtitle="Actionable insights"
          icon="✨"
          badge="AI"
          gradientBar
          glow
        >
          <MotAiRecommendations ai={motAi} theme={theme} />
        </SupernovaCard>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}
