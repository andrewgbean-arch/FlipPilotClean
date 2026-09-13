import { ScrollView, View, Text } from "react-native";
import { useTheme } from "@/styles/ThemeContext";

import { DealerGlowCard } from "@/components/DealerGlowCard";
import { MetricRow } from "@/components/MetricRow";
import { AnimatedBar } from "@/components/AnimatedBar";
import { GradientChip } from "@/components/GradientChip";
import HeroHeader from "@/components/ui/HeroHeader";

import { DealerGridButton } from "@/components/dealer/DealerGridButton";

export default function DealerCRMIntelligence() {
  const theme = useTheme();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ padding: theme.spacing.lg }}
    >
      {/* ⭐ Modern Header */}
      <HeroHeader
        title="CRM Intelligence Hub"
        subtitle="AI‑Powered Buyer Behaviour Analysis"
        theme={theme}
        icon="👥"
        badge="CRM AI"
        glow
      />

      {/* ⭐ Navigation Grid */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "space-between",
          marginBottom: 25,
        }}
      >
        <DealerGridButton label="Dashboard" icon="📊" route="/dealer/DealerDashboardV11" />
        <DealerGridButton label="Stock Hub" icon="🚗" route="/dealer/dealer-stock" />
        <DealerGridButton label="Finance Hub" icon="💳" route="/dealer/dealer-finance" />
        <DealerGridButton label="Marketing Hub" icon="📣" route="/dealer/dealer-marketing" />
        <DealerGridButton label="Risk Hub" icon="⚠️" route="/dealer/dealer-risk" />
        <DealerGridButton label="Sales Hub" icon="💰" route="/dealer/dealer-sales" />
      </View>

      {/* ⭐ INTELLIGENCE SECTION (Injected here) */}
      <Text
        style={{
          color: theme.goldDeep,
          fontSize: 22,
          fontWeight: "800",
          marginTop: 10,
          marginBottom: 12,
          textShadowColor: theme.goldSoftGlow,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 8,
        }}
      >
        Intelligence
      </Text>

      <View
        style={{
          height: 2,
          backgroundColor: theme.goldSoftGlow,
          marginBottom: 16,
          borderRadius: 2,
          shadowColor: theme.goldDeep,
          shadowOpacity: 0.4,
          shadowRadius: 6,
        }}
      />

      <DealerGridButton
        label="Predictive Engine"
        icon="🔮"
        route="/dealer/DealerPredictiveEngine"
      />

      <DealerGridButton
        label="Performance Hub"
        icon="📊"
        route="/dealer/DealerPerformanceHub"
      />

      {/* ⭐ Buyer Emotion Engine */}
      <DealerGlowCard
        title="Buyer Emotion Engine"
        subtitle="AI emotional signal decoding"
        icon="💬"
        badge="AI"
        shimmer
        gradientBar
        theme={theme}
      >
        <GradientChip text="Emotion: Confident" theme={theme} />

        <MetricRow label="Tone Stability" value="82%" theme={theme} percentage trend="up" />
        <MetricRow label="Message Positivity" value="74%" theme={theme} percentage />
        <MetricRow label="Engagement Level" value="High" theme={theme} highlight />

        <AnimatedBar value={78} theme={theme} />
      </DealerGlowCard>

      {/* ⭐ Buyer Intent Score */}
      <DealerGlowCard
        title="Buyer Intent Score"
        subtitle="Intent prediction engine"
        icon="🎯"
        badge="AI"
        shimmer
        gradientBar
        theme={theme}
      >
        <GradientChip text="Strong Intent" theme={theme} />

        <MetricRow label="Vehicle Interest" value="High" theme={theme} highlight />
        <MetricRow label="Response Speed" value="Fast" theme={theme} />
        <MetricRow label="Repeat Views" value="5x" theme={theme} />

        <AnimatedBar value={84} theme={theme} />
      </DealerGlowCard>

      {/* ⭐ Closing Probability */}
      <DealerGlowCard
        title="Closing Probability"
        subtitle="AI deal‑closing likelihood"
        icon="🔐"
        badge="AI"
        shimmer
        gradientBar
        theme={theme}
      >
        <GradientChip text="Likely to Close" theme={theme} />

        <MetricRow label="AI Confidence" value="71%" theme={theme} percentage trend="up" />
        <MetricRow label="Objection Level" value="Low" theme={theme} success />
        <MetricRow label="Buyer Momentum" value="Strong" theme={theme} highlight />

        <AnimatedBar value={71} theme={theme} />
      </DealerGlowCard>

      {/* ⭐ Finance Risk */}
      <DealerGlowCard
        title="Finance Risk"
        subtitle="Financial behaviour analysis"
        icon="💳"
        badge="AI"
        shimmer
        gradientBar
        theme={theme}
      >
        <GradientChip text="Low Risk" theme={theme} />

        <MetricRow label="Credit Behaviour" value="Stable" theme={theme} />
        <MetricRow label="Income Signals" value="Positive" theme={theme} success />
        <MetricRow label="Finance Drop-off" value="6%" theme={theme} percentage danger />

        <AnimatedBar value={12} theme={theme} />
      </DealerGlowCard>

      {/* ⭐ Drop-off Risk */}
      <DealerGlowCard
        title="Drop-off Risk"
        subtitle="Buyer retention prediction"
        icon="🧠"
        badge="AI"
        shimmer
        gradientBar
        theme={theme}
      >
        <GradientChip text="Very Low" theme={theme} />

        <MetricRow label="Reply Consistency" value="High" theme={theme} highlight />
        <MetricRow label="Interest Decay" value="Minimal" theme={theme} />
        <MetricRow label="Ghosting Probability" value="4%" theme={theme} percentage success />

        <AnimatedBar value={4} theme={theme} />
      </DealerGlowCard>

      {/* ⭐ Next Move AI */}
      <DealerGlowCard
        title="Next Move AI"
        subtitle="Recommended strategic action"
        icon="🤖"
        badge="AI"
        gradientBar
        theme={theme}
      >
        <GradientChip text="Recommended Action" theme={theme} />

        <Text
          style={{
            color: theme.text,
            fontSize: 16,
            lineHeight: 22,
            marginTop: 10,
          }}
        >
          Send a confident follow‑up message with a soft urgency tone.  
          Offer a viewing slot within the next 24 hours.
        </Text>
      </DealerGlowCard>

      {/* ⭐ Buyer Personality */}
      <DealerGlowCard
        title="Buyer Personality Type"
        subtitle="Behavioural profile"
        icon="🧩"
        badge="AI"
        gradientBar
        theme={theme}
      >
        <GradientChip text="Logical Buyer" theme={theme} />

        <MetricRow label="Emotion Influence" value="Low" theme={theme} />
        <MetricRow label="Detail Sensitivity" value="High" theme={theme} highlight />
        <MetricRow label="Negotiation Style" value="Structured" theme={theme} />
      </DealerGlowCard>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
