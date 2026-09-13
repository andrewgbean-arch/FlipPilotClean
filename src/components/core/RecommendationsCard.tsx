import { View, StyleSheet, Animated, Text } from "react-native";
import { useTheme } from "@/styles/useTheme";
import { useEffect, useRef } from "react";

export interface RecommendationsCardProps {
  recs: string[];
}

export default function RecommendationsCard({ recs }: RecommendationsCardProps) {
  const theme = useTheme();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // If no recommendations, don't render the card
  if (!recs || recs.length === 0) return null;

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.goldDeep,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Text style={[styles.title, { color: theme.accent }]}>
        Smart Recommendations
      </Text>

      {recs.map((r, i) => (
        <RecommendationRow key={i} text={r} index={i} theme={theme} />
      ))}
    </Animated.View>
  );
}

function RecommendationRow({
  text,
  index,
  theme,
}: {
  text: string;
  index: number;
  theme: ReturnType<typeof useTheme>;
}) {
  const rowFade = useRef(new Animated.Value(0)).current;
  const rowSlide = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(rowFade, {
        toValue: 1,
        duration: 300,
        delay: 150 * index,
        useNativeDriver: true,
      }),
      Animated.timing(rowSlide, {
        toValue: 0,
        duration: 300,
        delay: 150 * index,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        opacity: rowFade,
        transform: [{ translateY: rowSlide }],
        marginTop: 10,
      }}
    >
      <Text style={{ color: theme.text, fontSize: 15 }}>⭐ {text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 20,
    borderWidth: 2,
  },
  title: {
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 6,
  },
});
