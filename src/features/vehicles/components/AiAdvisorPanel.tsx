import { View, Text, ScrollView } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import React from "react";
import AnimatedPressable from "@/components/ui/AnimatedPressable";
import { useTheme } from "@/styles/ThemeContext";

export default function AiAdvisorPanel({ vehicle }: { vehicle: any }) {
  const theme = useTheme();

  const translateY = useSharedValue(500);

  const openPanel = () => {
    translateY.value = withTiming(0, { duration: 300 });
  };

  const closePanel = () => {
    translateY.value = withTiming(500, { duration: 300 });
  };

  const gesture = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, translateY.value + e.translationY);
    })
    .onEnd(() => {
      if (translateY.value > 250) {
        closePanel();
      } else {
        openPanel();
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const ai = vehicle.aiPrice || {};
  const market = vehicle.market || {};

  return (
    <>
      {/* OPEN BUTTON */}
      <AnimatedPressable
        onPress={openPanel}
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          backgroundColor: theme.accent,
          paddingVertical: 14,
          paddingHorizontal: 20,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: theme.goldDeep,
        }}
      >
        <Text style={{ color: theme.black, fontSize: 16 }}>
          🤖 AI Advisor
        </Text>
      </AnimatedPressable>

      {/* PANEL */}
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            {
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 500,
              backgroundColor: theme.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderWidth: 2,
              borderColor: theme.goldDeep,
              padding: 20,
            },
            style,
          ]}
        >
          {/* HANDLE BAR */}
          <View
            style={{
              width: 60,
              height: 6,
              backgroundColor: theme.goldDeep,
              borderRadius: 3,
              alignSelf: "center",
              marginBottom: 16,
            }}
          />

          <ScrollView>
            <Text
              style={{
                fontSize: 24,
                fontWeight: "700",
                color: theme.accent,
                marginBottom: 10,
              }}
            >
              🤖 AI Advisor
            </Text>

            {/* RECOMMENDED PRICE */}
            <View
              style={{
                padding: 16,
                borderRadius: 16,
                borderWidth: 2,
                borderColor: theme.goldDeep,
                backgroundColor: theme.black,
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: theme.accent,
                  marginBottom: 6,
                }}
              >
                Recommended Sell Price
              </Text>

              <Text
                style={{
                  fontSize: 32,
                  fontWeight: "700",
                  color: theme.goldDeep,
                }}
              >
                £{ai.recommendedSellPrice ?? "—"}
              </Text>

              <Text style={{ color: theme.text, marginTop: 6 }}>
                Confidence: {ai.aiPriceConfidence ?? "—"}%
              </Text>

              <Text style={{ color: theme.text }}>
                Risk Level: {ai.riskLevel ?? "—"}
              </Text>
            </View>

            {/* MARKET SMART PRICE */}
            <View
              style={{
                padding: 16,
                borderRadius: 16,
                borderWidth: 2,
                borderColor: theme.goldDeep,
                backgroundColor: theme.card,
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: theme.accent,
                  marginBottom: 6,
                }}
              >
                📈 Market Smart Price
              </Text>

              <Text
                style={{
                  fontSize: 28,
                  fontWeight: "700",
                  color: theme.goldDeep,
                }}
              >
                £{market.smartPrice ?? "—"}
              </Text>

              <Text style={{ color: theme.text }}>
                Range: £{market.lowest ?? "—"} → £{market.highest ?? "—"}
              </Text>

              <Text style={{ color: theme.text }}>
                Average: £{market.average ?? "—"}
              </Text>

              <Text style={{ color: theme.text }}>
                Demand Score: {market.demandScore ?? "—"} / 100
              </Text>
            </View>

            {/* INSIGHTS */}
            <View
              style={{
                padding: 16,
                borderRadius: 16,
                borderWidth: 2,
                borderColor: theme.goldDeep,
                backgroundColor: theme.card,
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: theme.accent,
                  marginBottom: 10,
                }}
              >
                💡 Insights
              </Text>

              {(ai.insights || []).map((line: string, idx: number) => (
                <Text
                  key={idx}
                  style={{
                    color: theme.text,
                    marginBottom: 6,
                    fontSize: 14,
                  }}
                >
                  • {line}
                </Text>
              ))}

              {(!ai.insights || ai.insights.length === 0) && (
                <Text style={{ color: theme.text }}>
                  No insights available.
                </Text>
              )}
            </View>

            {/* CLOSE BUTTON */}
            <AnimatedPressable
              onPress={closePanel}
              style={{
                padding: 14,
                backgroundColor: theme.accent,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: theme.goldDeep,
                alignItems: "center",
              }}
            >
              <Text style={{ color: theme.black }}>Close</Text>
            </AnimatedPressable>
          </ScrollView>
        </Animated.View>
      </GestureDetector>
    </>
  );
}
