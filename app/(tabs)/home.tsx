// ------------------------------------------------------
// FLIPPILOT — ULTRA HOME SCREEN (Black/Gold Edition)
// ------------------------------------------------------
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  StyleSheet,
  View,
  Dimensions,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useFlipHistory } from "../../src/context/FlipHistoryContext";
import { useTheme, usePro } from "../../src/context/ThemeContext";
import { FlipRecord } from "../../src/models/FlipRecord";

import ThemedText from "../../src/components/ThemedText";
import ThemedView from "../../src/components/ThemedView";

import GoldParticles from "../../src/components/GoldParticles";
import LiveProfitCounter from "../../src/components/LiveProfitCounter";
import GoldButton from "../../src/components/GoldButton";
import WeatherCard from "../../src/components/WeatherCard";
import BootFairRadar from "../../src/components/BootFairRadar";
import RecommendationsCard from "../../src/components/RecommendationsCard";
import AchievementsCard from "../../src/components/AchievementsCard";
import AIChatWindow from "../../src/components/AIChatWindow";

import { generateRecommendations } from "../../src/utils/generateRecommendations";
import { evaluateAchievements, loadAchievements } from "../../src/utils/achievements";

const SCREEN_WIDTH = Dimensions.get("window").width;

// ------------------------------------------------------
// AnimatedPressable
// ------------------------------------------------------
interface AnimatedPressableProps {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
}

const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  children,
  style,
  onPress,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={onPress}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

// ------------------------------------------------------
// ParallaxScrollView
// ------------------------------------------------------
interface ParallaxProps {
  headerHeight?: number;
  header: React.ReactNode;
  children: React.ReactNode;
}

const ParallaxScrollView: React.FC<ParallaxProps> = ({
  headerHeight = 300,
  header,
  children,
}) => {
  const scrollY = useRef(new Animated.Value(0)).current;

  const translateY = scrollY.interpolate({
    inputRange: [0, headerHeight],
    outputRange: [0, -headerHeight / 2],
    extrapolate: "clamp",
  });

  const scale = scrollY.interpolate({
    inputRange: [0, headerHeight],
    outputRange: [1, 0.85],
    extrapolate: "clamp",
  });

  const opacity = scrollY.interpolate({
    inputRange: [0, headerHeight / 2],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={{ flex: 1 }}>
      <Animated.View
        style={{
          height: headerHeight,
          transform: [{ translateY }, { scale }],
          opacity,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {header}
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        contentContainerStyle={{ paddingTop: headerHeight - 40, paddingBottom: 40 }}
      >
        {children}
      </Animated.ScrollView>
    </View>
  );
};

// ------------------------------------------------------
// AI Bubble
// ------------------------------------------------------
interface AIBubbleProps {
  onPress: () => void;
  theme: any;
}

const AIBubble: React.FC<AIBubbleProps> = ({ onPress, theme }) => {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 1800, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const glow = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.9],
  });

  return (
    <AnimatedPressable
      onPress={onPress}
      style={{
        position: "absolute",
        bottom: 40,
        right: 20,
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: theme.accent,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: theme.goldDeep,
        shadowOpacity: glow,
        shadowRadius: 20,
        elevation: 10,
      }}
    >
      <ThemedText style={{ fontSize: 24, fontWeight: "900", color: theme.black }}>
        AI
      </ThemedText>
    </AnimatedPressable>
  );
};

// ------------------------------------------------------
// Best Flip Carousel
// ------------------------------------------------------
interface BestFlipProps {
  flips: FlipRecord[];
  theme: any;
  getProfit: (f: FlipRecord) => number;
  getROI: (f: FlipRecord) => number;
}

const BestFlipCarousel: React.FC<BestFlipProps> = ({
  flips,
  theme,
  getProfit,
  getROI,
}) => {
  if (!flips.length) return null;

  const sorted = [...flips].sort((a, b) => getProfit(b) - getProfit(a));
  const topFive = sorted.slice(0, 5);

  return (
    <Animated.ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={SCREEN_WIDTH * 0.8}
      decelerationRate="fast"
      contentContainerStyle={{ paddingHorizontal: 20, marginTop: 20 }}
    >
      {topFive.map((flip) => (
        <ThemedView
          key={flip.id}
          style={{
            width: SCREEN_WIDTH * 0.8,
            marginRight: 20,
            padding: 20,
            borderRadius: 26,
            backgroundColor: theme.card,
            borderColor: theme.goldDeep,
            borderWidth: 3,
          }}
        >
          {flip.image ? (
            <Image
              source={{ uri: flip.image }}
              style={{ width: "100%", height: 160, borderRadius: 16 }}
            />
          ) : (
            <ThemedView
              style={{
                width: "100%",
                height: 160,
                borderRadius: 16,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <ThemedText>No Image</ThemedText>
            </ThemedView>
          )}

          <ThemedText style={{ fontSize: 18, fontWeight: "700", marginTop: 12 }}>
            {flip.title}
          </ThemedText>

          <ThemedText style={{ color: theme.accent, marginTop: 4 }}>
            Profit: £{getProfit(flip).toFixed(2)}
          </ThemedText>

          <ThemedText style={{ color: "#AFC6FF", marginTop: 2 }}>
            ROI: {getROI(flip).toFixed(1)}%
          </ThemedText>
        </ThemedView>
      ))}
    </Animated.ScrollView>
  );
};

// ------------------------------------------------------
// MAIN SCREEN
// ------------------------------------------------------
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const pro = usePro();
  const { flips } = useFlipHistory();

  const [achievements, setAchievements] = useState<string[]>([]);
  const [aiOpen, setAiOpen] = useState(false);

  const getProfit = (f: FlipRecord) =>
    f.pricing?.recommendedSellPrice != null && f.pricing?.recommendedBuyPrice != null
      ? f.pricing.recommendedSellPrice - f.pricing.recommendedBuyPrice
      : f.pricing?.predictedProfit ?? 0;

  const getROI = (f: FlipRecord) =>
    f.pricing?.recommendedSellPrice != null && f.pricing?.recommendedBuyPrice != null
      ? ((f.pricing.recommendedSellPrice - f.pricing.recommendedBuyPrice) /
          f.pricing.recommendedBuyPrice) *
        100
      : 0;

  const totalProfit = flips.reduce((s, f) => s + getProfit(f), 0);

  const recs = generateRecommendations(flips);

  useEffect(() => {
    (async () => {
      const existing = await loadAchievements();
      setAchievements(existing);

      const updated = await evaluateAchievements(flips);
      setAchievements(updated);
    })();
  }, [flips]);

  const logoSource = require("../../assets/images/logo1.png");

  const handleAIMessage = async (msg: string) => {
    return `FlipPilot AI: Got it boss — "${msg}"`;
  };

  return (
    <ThemedView style={{ flex: 1, backgroundColor: theme.background }}>
      <GoldParticles theme={theme} />
      <LiveProfitCounter totalProfit={totalProfit} theme={theme} />

      <ParallaxScrollView
        headerHeight={300}
        header={
          <View
            style={{
              marginTop: insets.top - 20,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Image
              source={logoSource}
              style={{ width: 600, height: 400, resizeMode: "contain" }}
            />
          </View>
        }
      >
        {/* Stats */}
        <ThemedView
          style={[
            styles.statsCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.goldDeep,
              borderWidth: pro ? 4 : 3,
              shadowColor: pro ? theme.goldDeep : "transparent",
              shadowOpacity: pro ? 0.8 : 0,
              shadowRadius: pro ? 24 : 0,
            },
          ]}
        >
          <ThemedText style={[styles.cardTitle, { color: theme.accent }]}>
            {pro ? "Flip Stats · PRO" : "Your Flip Stats"}
          </ThemedText>

          <ThemedView style={styles.statsRow}>
            <ThemedView style={styles.statBox}>
              <ThemedText style={styles.statLabel}>Total</ThemedText>
              <ThemedText style={styles.statValue}>{flips.length}</ThemedText>
            </ThemedView>

            <ThemedView style={styles.statBox}>
              <ThemedText style={styles.statLabel}>Avg £</ThemedText>
              <ThemedText style={styles.statValue}>
                £
                {flips.length > 0
                  ? (flips.reduce((s, f) => s + getProfit(f), 0) / flips.length).toFixed(2)
                  : 0}
              </ThemedText>
            </ThemedView>

            <ThemedView style={styles.statBox}>
              <ThemedText style={styles.statLabel}>ROI</ThemedText>
              <ThemedText style={styles.statValue}>
                {flips.length > 0
                  ? (
                      flips.reduce((s, f) => s + getROI(f), 0) / flips.length
                    ).toFixed(1)
                  : 0}
                %
              </ThemedText>
            </ThemedView>
          </ThemedView>
        </ThemedView>

        {/* Best Flip Carousel */}
        <BestFlipCarousel flips={flips} theme={theme} getProfit={getProfit} getROI={getROI} />

        {/* Weather */}
        <WeatherCard theme={theme} />

        {/* Boot Fair Radar */}
        <BootFairRadar
          theme={theme}
          nearest={{
            name: "Exeter Boot Fair",
            distance: 7.4,
            nextOpen: "Saturday 8:00 AM",
          }}
        />

        {/* Smart Recommendations */}
        <RecommendationsCard theme={theme} recs={recs} />

        {/* Achievements */}
        <AchievementsCard theme={theme} achievements={achievements} />

        {/* Actions */}
        <GoldButton
          title="Scan Anything"
          subtitle="AI-powered lookup"
          onPress={() => router.push("/scan")}
          theme={theme}
        />

        <GoldButton
          title="View History"
          subtitle=""
          onPress={() => router.push("/history")}
          theme={theme}
        />

        <GoldButton
          title="Discover Boot Fairs"
          subtitle=""
          onPress={() => router.push("/bootfairs")}
          theme={theme}
        />

        <GoldButton
          title="Rate / Review FlipPilot"
          subtitle=""
          onPress={() => router.push("/review")}
          theme={theme}
        />

        <GoldButton
          title="Feedback / Ideas"
          subtitle=""
          onPress={() => router.push("/feedback")}
          theme={theme}
        />
      </ParallaxScrollView>

      {/* AI Bubble + Chat */}
      <AIBubble onPress={() => setAiOpen(true)} theme={theme} />

      <AIChatWindow
        theme={theme}
        visible={aiOpen}
        onClose={() => setAiOpen(false)}
        onSend={handleAIMessage}
      />
    </ThemedView>
  );
}

// ------------------------------------------------------
// Styles
// ------------------------------------------------------
const styles = StyleSheet.create({
  statsCard: {
    borderRadius: 26,
    paddingVertical: 32,
    paddingHorizontal: 22,
    marginTop: 20,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 18,
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
    color: "#AFC6FF",
  },
  statValue: {
    fontSize: 26,
    fontWeight: "800",
    color: "white",
  },
});
