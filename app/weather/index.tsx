import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/styles/useTheme";
 import WeatherCard from "../components/WeatherCard";
// your winning card

export default function WeatherScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.background,
        paddingTop: insets.top + 10,
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 40,
        }}
      >
        <Text
          style={{
            fontSize: 28,
            fontWeight: "900",
            color: theme.goldDeep,
            marginBottom: 10,
            textAlign: "center",
          }}
        >
          Weather Insights
        </Text>

        <Text
          style={{
            fontSize: 15,
            color: theme.text,
            opacity: 0.8,
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          Live conditions near you — perfect for planning bootfair trips.
        </Text>

        {/* ⭐ Your WeatherCard #2 */}
        <WeatherCard theme={theme} />

        <View style={{ marginTop: 30 }}>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: theme.accent,
              marginBottom: 10,
            }}
          >
            Bootfair Tips
          </Text>

          <Text
            style={{
              fontSize: 15,
              color: theme.text,
              lineHeight: 22,
            }}
          >
            • Clear skies = more sellers, more bargains.{"\n"}
            • Light wind keeps stalls cool.{"\n"}
            • Avoid heavy rain — sellers pack up early.{"\n"}
            • Warm mornings bring out casual sellers with hidden gems.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
