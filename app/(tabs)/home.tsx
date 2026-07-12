import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  Platform,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Easing as RNEasing,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";


import WeatherCard from "../feature/WeatherCard";
import { useFlipHistory } from "@/context/FlipHistoryContext";
import { useTheme } from "@/context/ThemeContext";
import { FlipRecord } from "@/models/FlipRecord";
import { LayoutAnimation } from "react-native";
import ThemedText from "@/styles/theme/ThemedText";
import ThemedView from "@/styles/theme/ThemedView";
import logoSource from "../../assets/images/logopulse.png";
import ProfitSupernovaSheet from "../ProfitSupernovaSheet";
import FlipPilotAssistantSheet from "../../src/screens/FlipPilotAssistantSheet";
import FeedbackSheet from "../FeedbackSheet";

import Reanimated, {
  useSharedValue,
  withRepeat,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";

const ReanimatedView = Reanimated.View;

// ------------------------------------------------------
// Sparkle Burst (gold particles)
// ------------------------------------------------------
const SparkleBurst = ({ trigger }: { trigger: number }) => {
  const particles = Array.from({ length: 12 }).map(() => ({
    x: useSharedValue(0),
    y: useSharedValue(0),
    scale: useSharedValue(0),
    opacity: useSharedValue(0),
  }));

  useEffect(() => {
    if (trigger === 0) return;

    particles.forEach((p) => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 40 + Math.random() * 40;

      p.opacity.value = 1;
      p.scale.value = withTiming(1, { duration: 120 });

      p.x.value = withTiming(Math.cos(angle) * distance, { duration: 420 });
      p.y.value = withTiming(Math.sin(angle) * distance, { duration: 420 });

      p.opacity.value = withTiming(0, { duration: 420 });
      p.scale.value = withTiming(0, { duration: 420 });
    });
  }, [trigger]);

  return (
    <View style={{ position: "absolute", width: 120, height: 120 }}>
      {particles.map((p, i) => (
        <ReanimatedView
          key={i}
          style={{
            position: "absolute",
            width: 8,
            height: 8,
            borderRadius: 8,
            backgroundColor: "#FFD700",
            opacity: p.opacity,
            transform: [
              { translateX: p.x },
              { translateY: p.y },
              { scale: p.scale },
            ],
          }}
        />
      ))}
    </View>
  );
};





// ------------------------------------------------------
// AnimatedPressable
// subtle scale on press
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

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={() =>
          Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()
        }
        onPress={onPress}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
};

// ------------------------------------------------------
// CosmicParticles (sparkles)
// ------------------------------------------------------
const CosmicParticles = ({
  count = 22,
  color,
}: {
  count?: number;
  color: string;
}) => {
  const particles = Array.from({ length: count }).map(() => ({
    x: new Animated.Value(Math.random() * 700 - 350),
    y: new Animated.Value(Math.random() * 450 - 225),
    scale: new Animated.Value(Math.random() * 0.9 + 0.3),
    opacity: new Animated.Value(Math.random() * 0.6 + 0.15),
  }));

  useEffect(() => {
    particles.forEach((p) => {
      const loop = () => {
        Animated.parallel([
          Animated.timing(p.x, {
            toValue: Math.random() * 700 - 350,
            duration: 5000 + Math.random() * 4000,
            easing: RNEasing.inOut(RNEasing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(p.y, {
            toValue: Math.random() * 450 - 225,
            duration: 5000 + Math.random() * 4000,
            easing: RNEasing.inOut(RNEasing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(p.scale, {
            toValue: Math.random() * 0.9 + 0.3,
            duration: 4000 + Math.random() * 3000,
            useNativeDriver: true,
          }),
          Animated.timing(p.opacity, {
            toValue: Math.random() * 0.6 + 0.15,
            duration: 4000 + Math.random() * 3000,
            useNativeDriver: true,
          }),
        ]).start(loop);
      };
      loop();
    });
  }, []);

  return (
    <View style={{ position: "absolute", width: 700, height: 450 }}>
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            width: 6,
            height: 6,
            borderRadius: 6,
            backgroundColor: color,
            opacity: p.opacity,
            transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.scale }],
          }}
        />
      ))}
    </View>
  );
};

// ------------------------------------------------------
// HOME SCREEN
// ------------------------------------------------------
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { flips } = useFlipHistory();

  // ------------------------------------------------------
  // HERO ENTRANCE
  // ------------------------------------------------------
  const heroFade = useRef(new Animated.Value(0)).current;
  const heroTranslate = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroFade, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(heroTranslate, {
        toValue: 0,
        useNativeDriver: true,
        speed: 1,
        bounciness: 10,
      }),
    ]).start();
  }, []);

  // ------------------------------------------------------
  // TRIPLE SUPERNOVA PULSE (SAFE)
  // ------------------------------------------------------
  const pulseA = useRef(new Animated.Value(0)).current;
  const pulseB = useRef(new Animated.Value(0)).current;
  const pulseC = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseA, {
          toValue: 1,
          duration: 2800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseA, {
          toValue: 0,
          duration: 2800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseB, {
          toValue: 1,
          duration: 3400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseB, {
          toValue: 0,
          duration: 3400,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseC, {
          toValue: 1,
          duration: 4200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseC, {
          toValue: 0,
          duration: 4200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // SAFE glow (opacity instead of shadowOpacity)
  const glowA = pulseA.interpolate({
    inputRange: [0, 1],
    outputRange: [0.12, 0.55],
  });

  const glowB = pulseB.interpolate({
    inputRange: [0, 1],
    outputRange: [0.08, 0.45],
  });

  const glowC = pulseC.interpolate({
    inputRange: [0, 1],
    outputRange: [0.06, 0.32],
  });

  // ------------------------------------------------------
  // NEBULA DRIFT
  // ------------------------------------------------------
  const nebulaA = useRef(new Animated.Value(0)).current;
  const nebulaB = useRef(new Animated.Value(0)).current;

  const nebulaTranslateA = nebulaA.interpolate({
    inputRange: [0, 1],
    outputRange: [-12, 12],
  });

  const nebulaTranslateB = nebulaB.interpolate({
    inputRange: [0, 1],
    outputRange: [8, -8],
  });

  // ------------------------------------------------------
  // COSMIC STAR + COMET + SHOCKWAVE
  // ------------------------------------------------------
  const cosmicStarScale = useRef(new Animated.Value(1)).current;
  const cosmicTapCount = useRef(0);

  const cometScale = useRef(new Animated.Value(0)).current;
  const supernovaScale = useRef(new Animated.Value(0)).current;

  const fireComet = () => {
    Animated.sequence([
      Animated.timing(cometScale, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(cometScale, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  };

  const triggerSupernova = () => {
    Animated.sequence([
      Animated.timing(supernovaScale, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(supernovaScale, { toValue: 0, duration: 640, useNativeDriver: true }),
    ]).start();
  };

  const tapCosmicStar = () => {
    cosmicTapCount.current++;

    Animated.sequence([
      Animated.spring(cosmicStarScale, { toValue: 1.55, useNativeDriver: true }),
      Animated.spring(cosmicStarScale, { toValue: 1, useNativeDriver: true }),
    ]).start();

    if (cosmicTapCount.current >= 3) {
      fireComet();
      triggerSupernova();
      cosmicTapCount.current = 0;
    }
  };

  // ------------------------------------------------------
  // LOGO PULSE (new header image)
  // ------------------------------------------------------
  const logoSource = require("../../assets/images/logopulse.png");
  const logoPulseScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulseScale, {
          toValue: 1.03,
          duration: 1200,
          easing: RNEasing.inOut(RNEasing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(logoPulseScale, {
          toValue: 1,
          duration: 1200,
          easing: RNEasing.inOut(RNEasing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // ------------------------------------------------------
  // SAFE HALO GLOW (Reanimated)
  // ------------------------------------------------------
  const haloOpacity = useSharedValue(0.36);
  const haloScale = useSharedValue(1);

  useEffect(() => {
    haloOpacity.value = withRepeat(withTiming(0.72, { duration: 2600 }), -1, true);
    haloScale.value = withRepeat(withTiming(1.04, { duration: 2600 }), -1, true);
  }, []);

  const haloAnimatedStyle = useAnimatedStyle(() => ({
    opacity: haloOpacity.value,
    transform: [{ scale: haloScale.value }],
  }));

  // ------------------------------------------------------
  // NEBULA DRIFT LOOPS
  // ------------------------------------------------------
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(nebulaA, {
          toValue: 1,
          duration: 7000,
          useNativeDriver: true,
        }),
        Animated.timing(nebulaA, {
          toValue: 0,
          duration: 7000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(nebulaB, {
          toValue: 1,
          duration: 7600,
          useNativeDriver: true,
        }),
        Animated.timing(nebulaB, {
          toValue: 0,
          duration: 7600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // ------------------------------------------------------
  // STATS HELPERS
  // ------------------------------------------------------
  const getProfit = (f: FlipRecord) =>
    f.pricing?.recommendedSellPrice != null &&
    f.pricing?.recommendedBuyPrice != null
      ? f.pricing.recommendedSellPrice - f.pricing.recommendedBuyPrice
      : f.pricing?.predictedProfit ?? 0;

  const getROI = (f: FlipRecord) =>
    f.pricing?.recommendedSellPrice != null &&
    f.pricing?.recommendedBuyPrice != null
      ? ((f.pricing.recommendedSellPrice - f.pricing.recommendedBuyPrice) /
          f.pricing.recommendedBuyPrice) *
        100
      : 0;

  const totalFlips = flips.length;

  const avgProfit =
    totalFlips > 0
      ? flips.reduce((s: number, f: FlipRecord) => s + getProfit(f), 0) / totalFlips
      : 0;

  const avgROI =
    totalFlips > 0
      ? flips.reduce((s: number, f: FlipRecord) => s + getROI(f), 0) / totalFlips
      : 0;

  const bestFlip =
    totalFlips > 0 ? [...flips].sort((a, b) => getProfit(b) - getProfit(a))[0] : null;

  // ------------------------------------------------------
  // FEEDBACK + SHEETS
  // ------------------------------------------------------
  const [sheetOpen, setSheetOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [warning, setWarning] = useState(false);

  const sheetAnim = useRef(new Animated.Value(0)).current;

  const openSheet = () => {
    setSheetOpen(true);
    Animated.timing(sheetAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const closeSheet = () => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 260,
      useNativeDriver: false,
    }).start(() => {
      setSheetOpen(false);
      setFeedbackText("");
      setWarning(false);
    });
  };

  const sheetTranslate = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [500, 0],
  });

  // ------------------------------------------------------
  // PROFIT + ASSISTANT SHEETS
  // ------------------------------------------------------
  const [profitOpen, setProfitOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  const profitAnim = useRef(new Animated.Value(0)).current;
  const assistantAnim = useRef(new Animated.Value(0)).current;

  const profitTranslate = profitAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, -250],
  });

  const assistantTranslate = assistantAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, -250],
  });

  const openProfitSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setProfitOpen(true);
    Animated.spring(profitAnim, {
      toValue: 1,
      useNativeDriver: false,
      speed: 1,
      bounciness: 12,
    }).start();
  };

  const closeProfitSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(profitAnim, {
      toValue: 0,
      duration: 260,
      useNativeDriver: false,
    }).start(() => setProfitOpen(false));
  };

  const openAssistantSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAssistantOpen(true);
    Animated.spring(assistantAnim, {
      toValue: 1,
      useNativeDriver: false,
      speed: 1,
      bounciness: 12,
    }).start();
  };

  const closeAssistantSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(assistantAnim, {
      toValue: 0,
      duration: 260,
      useNativeDriver: false,
    }).start(() => setAssistantOpen(false));
  };

  // ------------------------------------------------------
  // FEEDBACK STORAGE
  // ------------------------------------------------------
  const sendFeedback = async () => {
    if (!feedbackText.trim()) {
      setWarning(true);
      return;
    }

    try {
      const existing = await AsyncStorage.getItem("feedbackEntries");
      const arr = existing ? JSON.parse(existing) : [];

      arr.push({
        id: Date.now().toString(),
        text: feedbackText.trim(),
        source: "home",
        timestamp: new Date().toISOString(),
      });

      await AsyncStorage.setItem("feedbackEntries", JSON.stringify(arr));
    } catch {}

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    closeSheet();
  };

  const [recentFeedback, setRecentFeedback] = useState<any[]>([]);

  useEffect(() => {
    const loadFeedback = async () => {
      try {
        const existing = await AsyncStorage.getItem("feedbackEntries");
        const arr = existing ? JSON.parse(existing) : [];
        setRecentFeedback(arr.slice(-3).reverse());
      } catch {}
    };
    loadFeedback();
  }, [sheetOpen]);

 // ------------------------------------------------------
// GOLD FX ENTRY
// ------------------------------------------------------
function GoldFXEntryComponent() {
  return (
    <AnimatedPressable
      style={[
        styles.goldButton,
        {
          backgroundColor: theme.goldDeep,
          shadowColor: theme.goldDeep,
        },
      ]}
      onPress={() => router.push("/goldfx")}
    >
      <ThemedText style={styles.goldTitle}>Open GoldFX Lab</ThemedText>
      <ThemedText style={styles.goldSubtitle}>Cinematic Gold Engine</ThemedText>
    </AnimatedPressable>
  );
}


  // ------------------------------------------------------
  // RENDER
  // ------------------------------------------------------
  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + -30,
        }}
        showsVerticalScrollIndicator={false}
      >
     

       {/* INTERSTELLAR HEADER */}
<Animated.View
  style={[
    styles.heroWrap,
    {
      marginTop: insets.top -70,
      marginBottom: 20,
      opacity: heroFade,
      transform: [{ translateY: heroTranslate }],
    },
  ]}
>

  {/* Nebula layers */}
  <Animated.View
    style={[
      styles.nebula,
      {
        backgroundColor: theme.goldDeep + "22",
        transform: [{ translateX: nebulaTranslateA }],
      },
    ]}
  />
  <Animated.View
    style={[
      styles.nebula,
      {
        backgroundColor: theme.goldDeep + "33",
        transform: [{ translateX: nebulaTranslateB }],
      },
    ]}
  />

  {/* Particles */}
  <CosmicParticles count={22} color={theme.goldDeep} />

  {/* Comet */}
  <Animated.View
    style={[
      styles.comet,
      {
        backgroundColor: theme.goldDeep,
        transform: [{ scaleX: cometScale }],
      },
    ]}
  />

  {/* Shockwave */}
  <Animated.View
    style={[
      styles.shockwave,
      {
        backgroundColor: `${theme.goldDeep}22`,

        transform: [{ scale: supernovaScale }],
      },
    ]}
  />

  {/* Cosmic star */}
  <AnimatedPressable
    onPress={() => {
      tapCosmicStar();
      triggerSupernova();
    }}
    style={styles.starPress}
  >
    <Animated.Text
      style={[
        styles.starText,
        {
          color: theme.goldDeep,
          transform: [{ scale: cosmicStarScale }],
        },
      ]}
    >
      🌟
    </Animated.Text>
  </AnimatedPressable>

{/* TRIPLE SUPERNOVA PULSE HALO */}
<Animated.View
  style={[
    styles.logoHalo,
    {
      position: "absolute",
      width: 700,
      height: 450,
      borderRadius: 350,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: theme.goldDeep,
      elevation: 0,
    },
  ]}
>
  <Animated.View
    style={{
      position: "absolute",
      width: 620,
      height: 400,
      borderRadius: 320,
      backgroundColor: theme.goldDeep + "14",
      shadowColor: theme.goldDeep,
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 40,
      shadowOpacity: glowA,
      transform: [{ translateX: nebulaTranslateA }],
    }}
  />

  <Animated.View
    style={{
      position: "absolute",
      width: 520,
      height: 340,
      borderRadius: 300,
      backgroundColor: theme.goldDeep + "18",
      shadowColor: theme.goldDeep,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 28,
      shadowOpacity: glowB,
      transform: [{ translateX: nebulaTranslateA }],
    }}
  />

  <Animated.View
    style={{
      position: "absolute",
      width: 420,
      height: 280,
      borderRadius: 260,
      backgroundColor: theme.goldDeep + "22",
      shadowColor: theme.goldDeep,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 18,
      shadowOpacity: glowC,
      transform: [{ translateX: nebulaTranslateA }],
    }}
  />
</Animated.View>

{/* Halo */}
<Reanimated.View
  style={[
    {
      position: "absolute",
      width: 700,
      height: 450,
      borderRadius: 350,
      backgroundColor: theme.goldDeep + "10",
    },
    haloAnimatedStyle,
  ]}
/>

{/* Logo */}
<View
  style={{
    shadowColor: theme.goldDeep,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    borderRadius: 20,
    overflow: Platform.OS === "android" ? "hidden" : "visible",
  }}
>
  <Animated.Image
    source={logoSource}
    style={[
      styles.logo,
      {
        transform: [{ scale: logoPulseScale }],
      },
    ]}
  />
</View>

{/* Best Flip */}
{bestFlip && (
  <ThemedView style={{ marginTop: 12 }}>
    <ThemedText style={styles.bestLabel}>Best Flip</ThemedText>
    <ThemedText style={styles.bestValue}>
      {bestFlip.title ?? "Unnamed"} — £{getProfit(bestFlip).toFixed(2)}
    </ThemedText>
  </ThemedView>
)}


</Animated.View>  

{/* STATS CARD */}
<ThemedView
  style={[
    styles.statsCard,
    {
      backgroundColor: theme.card,
      borderColor: theme.goldDeep,
      borderWidth: 3,
      shadowColor: theme.goldDeep,
      shadowOpacity: 0.18,
      shadowRadius: 22,
      elevation: 8,
      paddingVertical: 24,
      marginTop: -5,   // brings Flip Stats DOWN
    },
  ]}
>

  {/* Title */}
  <ThemedText
    style={[
      styles.cardTitle,
      {
        color: theme.accent,
        textAlign: "center",
        marginBottom: 10,
        fontSize: 24,
      },
    ]}
  >
    Flip Stats Overview
  </ThemedText>

  {/* Gold Divider */}
  <View
    style={{
      height: 2,
      backgroundColor: theme.goldDeep,
      opacity: 0.35,
      marginBottom: 10,
      borderRadius: 2,
      width: "80%",
      alignSelf: "center",
    }}
  />

  {/* Stats Row */}
  <View style={styles.statsRow}>
    {/* Total Flips */}
    <View style={styles.statBox}>
      <ThemedText style={[styles.statLabel, { color: theme.accent }]}>
        Total Flips
      </ThemedText>
      <ThemedText
        style={[
          styles.statValue,
          { color: theme.accent, fontSize: 22 },
        ]}
      >
        {totalFlips}
      </ThemedText>
    </View>

    {/* Avg Profit */}
    <View style={styles.statBox}>
      <ThemedText style={[styles.statLabel, { color: theme.accent }]}>
        Avg Profit
      </ThemedText>
      <ThemedText
        style={[
          styles.statValue,
          { color: theme.accent, fontSize: 22 },
        ]}
      >
        £{avgProfit.toFixed(2)}
      </ThemedText>
    </View>

    {/* ROI */}
    <View style={styles.statBox}>
      <ThemedText style={[styles.statLabel, { color: theme.accent }]}>
        Avg ROI
      </ThemedText>
      <ThemedText
        style={[
          styles.statValue,
          { color: theme.accent, fontSize: 22 },
        ]}
      >
        {avgROI.toFixed(2)}%
      </ThemedText>
    </View>
  </View>

  {/* ROI Gauge */}
  <View style={{ marginTop: 22, width: "100%", paddingHorizontal: 20 }}>
    <ThemedText
      style={[
        styles.statLabel,
        { marginBottom: 6, color: theme.accent },
      ]}
    >
      ROI Gauge
    </ThemedText>

    <View
      style={{
        height: 12,
        backgroundColor: theme.goldDeep + "22",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          height: "100%",
          width: `${Math.min(avgROI, 100)}%`,
          backgroundColor: theme.goldDeep,
        }}
      />
    </View>
  </View>

  {/* Best Flip */}
  {bestFlip && (
    <View style={{ marginTop: 24 }}>
      <ThemedText
        style={[
          styles.bestLabel,
          { color: theme.accent, fontSize: 14 },
        ]}
      >
        Best Flip
      </ThemedText>

      <ThemedText
        style={[
          styles.bestValue,
          {
            color: theme.accent,
            fontSize: 16,
            marginTop: 4,
          },
        ]}
      >
        ⭐ {bestFlip.title ?? "Unnamed"} — £{getProfit(bestFlip).toFixed(2)}
      </ThemedText>
    </View>
  )}
</ThemedView>

{/* FLIP SCORE PANEL */}
<ThemedView
  style={{
    marginTop: 20,
    marginBottom: 16,
    padding: 18,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: theme.goldDeep,
    backgroundColor: theme.card,
  }}
>
  <ThemedText
    style={{
      fontSize: 22,
      fontWeight: "900",
      color: theme.accent,
      marginBottom: 8,
    }}
  >
    🔥 Flip Score
  </ThemedText>

  <ThemedText
    style={{
      fontSize: 32,
      fontWeight: "bold",
      color: theme.goldDeep,
    }}
  >
    {(bestFlip?.flipScore ?? 0)}/100
  </ThemedText>

  <ThemedText
    style={{
      fontSize: 16,
      marginTop: 6,
      color: theme.text,
    }}
  >
    {(() => {
      const score = bestFlip?.flipScore ?? 0;
      if (score >= 80) return "Excellent flip potential";
      if (score >= 60) return "Strong flip";
      if (score >= 40) return "Moderate flip";
      return "High‑risk flip";
    })()}
  </ThemedText>
</ThemedView>



{/* MARKET INTELLIGENCE MEGA SECTION (ANIMATED) */}
<ThemedView
  style={{
    marginTop: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: theme.goldDeep,
    backgroundColor: theme.card,
  }}
>
  {/* HEADER */}
  <Animated.View
    style={{
      transform: [{ scale: 1.02 }],
      marginBottom: 12,
    }}
  >
    <ThemedText
      style={{
        fontSize: 26,
        fontWeight: "900",
        color: theme.accent,
        textAlign: "center",
      }}
    >
      🧠 Market Intelligence
    </ThemedText>
  </Animated.View>

  {/* COLLAPSIBLE SECTIONS */}
  {[
    {
      title: "🔥 Market Heatmap",
      content: (
        <>
          {[
            { label: "Electronics", value: 85 },
            { label: "Toys", value: 72 },
            { label: "Collectibles", value: 64 },
            { label: "Books", value: 38 },
          ].map((item, idx) => (
            <View key={idx} style={{ marginBottom: 10 }}>
              <ThemedText style={{ fontSize: 15, color: theme.text, marginBottom: 4 }}>
                {item.label}
              </ThemedText>
              <View
                style={{
                  height: 10,
                  backgroundColor: theme.goldDeep + "22",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${item.value}%`,
                    backgroundColor:
                      item.value > 70
                        ? theme.goldDeep
                        : item.value > 50
                        ? theme.accent
                        : "#FF4D4D",
                  }}
                />
              </View>
            </View>
          ))}
        </>
      ),
    },

    {
      title: "🛰️ Market Radar",
      content: (
        <View style={{ height: 180, alignItems: "center", justifyContent: "center" }}>
          {[160, 110, 60].map((size, idx) => (
            <View
              key={idx}
              style={{
                position: "absolute",
                width: size,
                height: size,
                borderRadius: size,
                borderWidth: 2,
                borderColor: theme.goldDeep + (idx === 0 ? "55" : idx === 1 ? "40" : "30"),
              }}
            />
          ))}

          {[
            { label: "Electronics", value: 85, color: theme.goldDeep },
            { label: "Toys", value: 72, color: theme.accent },
            { label: "Collectibles", value: 64, color: "#FF4D4D" },
            { label: "Books", value: 38, color: theme.text },
          ].map((item, idx) => (
            <View
              key={idx}
              style={{
                position: "absolute",
                width: 12,
                height: 12,
                borderRadius: 12,
                backgroundColor: item.color,
                transform: [
                  { translateX: Math.cos((idx * Math.PI) / 2) * (item.value / 2) },
                  { translateY: Math.sin((idx * Math.PI) / 2) * (item.value / 2) },
                ],
              }}
            />
          ))}
        </View>
      ),
    },

    {
      title: "📅 Weekly Trend Forecast",
      content: (
        <>
          <ThemedText style={{ fontSize: 16, color: theme.text, marginBottom: 6 }}>
            Rising This Week:
          </ThemedText>
          {["Electronics", "Retro Toys", "Collectibles"].map((cat, idx) => (
            <View
              key={idx}
              style={{
                paddingVertical: 6,
                borderRadius: 10,
                marginBottom: 6,
                backgroundColor: theme.goldDeep + "33",
              }}
            >
              <ThemedText style={{ fontSize: 15, color: theme.accent, paddingLeft: 10 }}>
                🔥 {cat}
              </ThemedText>
            </View>
          ))}

          <ThemedText style={{ fontSize: 16, color: theme.text, marginBottom: 6 }}>
            Cooling Down:
          </ThemedText>
          {["Books", "Home Goods"].map((cat, idx) => (
            <View
              key={idx}
              style={{
                paddingVertical: 6,
                borderRadius: 10,
                marginBottom: 6,
                backgroundColor: theme.accent + "22",
              }}
            >
              <ThemedText style={{ fontSize: 15, color: theme.text, paddingLeft: 10 }}>
                ❄️ {cat}
              </ThemedText>
            </View>
          ))}
        </>
      ),
    },

    {
      title: "🏕️ Boot Fair Scanner",
      content: (
        <>
          {[
            { fair: "Newton Abbot", score: 82 },
            { fair: "Torquay Racecourse", score: 74 },
            { fair: "Exeter Market", score: 68 },
          ].map((item, idx) => (
            <View key={idx} style={{ marginBottom: 10 }}>
              <ThemedText style={{ fontSize: 15, color: theme.text, marginBottom: 4 }}>
                {item.fair}
              </ThemedText>
              <View
                style={{
                  height: 10,
                  backgroundColor: theme.goldDeep + "22",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${item.score}%`,
                    backgroundColor: item.score > 70 ? theme.goldDeep : theme.accent,
                  }}
                />
              </View>
            </View>
          ))}
        </>
      ),
    },

    {
      title: "🤖 AI Market Predictor",
      content: (
        <>
          {[
            "Electronics expected to rise 12% next week",
            "Retro toys predicted to spike due to collector demand",
            "Books likely to drop due to oversupply",
          ].map((tip, idx) => (
            <ThemedText key={idx} style={{ fontSize: 15, color: theme.text, marginBottom: 6 }}>
              • {tip}
            </ThemedText>
          ))}
        </>
      ),
    },

    {
      title: "🌀 Category Strength Wheel",
      content: (
        <View style={{ height: 180, alignItems: "center", justifyContent: "center" }}>
          {[140, 100, 60].map((size, idx) => (
            <View
              key={idx}
              style={{
                position: "absolute",
                width: size,
                height: size,
                borderRadius: size,
                borderWidth: 2,
                borderColor: theme.goldDeep + (idx === 0 ? "55" : idx === 1 ? "40" : "30"),
              }}
            />
          ))}

          {[
            { label: "Electronics", angle: 0, color: theme.goldDeep },
            { label: "Toys", angle: 90, color: theme.accent },
            { label: "Collectibles", angle: 180, color: "#FF4D4D" },
            { label: "Books", angle: 270, color: theme.text },
          ].map((item, idx) => (
            <View
              key={idx}
              style={{
                position: "absolute",
                width: 14,
                height: 14,
                borderRadius: 14,
                backgroundColor: item.color,
                transform: [
                  { translateX: Math.cos((item.angle * Math.PI) / 180) * 70 },
                  { translateY: Math.sin((item.angle * Math.PI) / 180) * 70 },
                ],
              }}
            />
          ))}
        </View>
      ),
    },

    {
      title: "🌍 FlipScore Global Meter",
      content: (
        <View
          style={{
            height: 12,
            backgroundColor: theme.goldDeep + "22",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: "100%",
              width: `${Math.min(avgROI + avgProfit / 10, 100)}%`,
              backgroundColor: theme.goldDeep,
            }}
          />
        </View>
      ),
    },
].map((section, idx) => {
  const [open, setOpen] = React.useState(false);
  const [sparkTrigger, setSparkTrigger] = useState<number>(0);   // ← REQUIRED

  // Animation values
  const anim = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: anim.value,
    transform: [{ translateY: withTiming(open ? 0 : -10, { duration: 250 }) }],
  }));

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(!open);

    anim.value = withTiming(open ? 0 : 1, { duration: 250 });

    if (!open) {
      setSparkTrigger((v: number) => v + 1);   // ← NOW VALID
    }
  };




  return (
  <View key={idx} style={{ marginBottom: 16, position: "relative" }}>
    <Pressable
      onPress={toggle}
      style={{
        paddingVertical: 10,
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >
      <ThemedText style={{ fontSize: 18, fontWeight: "900", color: theme.accent }}>
        {section.title}
      </ThemedText>
      <ThemedText style={{ fontSize: 18, color: theme.goldDeep }}>
        {open ? "▼" : "▲"}
      </ThemedText>
    </Pressable>

    {open && (
      <View style={{ position: "absolute", right: 0, top: -10 }}>
        <SparkleBurst trigger={sparkTrigger} />
      </View>
    )}

    {open && (
      <ReanimatedView
        style={[
          {
            marginTop: 10,
            padding: 10,
            borderRadius: 14,
            backgroundColor: theme.card,
            shadowColor: theme.goldDeep,
            shadowOpacity: 0.18,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          },
          animatedStyle,
        ]}
      >
        {section.content}
      </ReanimatedView>
    )}
  </View>
);
})}



{/* ------------------------------------------------------
   WEATHER UNDER STATS (F + MPH)
------------------------------------------------------ */}

<View style={{ paddingHorizontal: 20, marginTop: 5, }}>
  <WeatherCard />
</View>






       {/* QUICK ACTIONS */}
<ThemedView style={{ marginTop: 18, paddingHorizontal: 20 }}>
  {/* Ask FlipPilot AI */}
  <AnimatedPressable
    style={{
      padding: 18,
      borderRadius: 18,
      backgroundColor: theme.card,
      borderColor: theme.goldDeep,
      borderWidth: 3,
      marginBottom: 15,
    }}
    onPress={openAssistantSheet}
  >
    <ThemedText style={{ fontSize: 18, fontWeight: "900", color: theme.accent }}>
      Ask FlipPilot AI
    </ThemedText>
    <ThemedText style={{ fontSize: 14, opacity: 0.85, color: theme.accent }}>
      Get ideas based on your flips
    </ThemedText>
  </AnimatedPressable>

  {/* Scan Anything */}
  <AnimatedPressable
    style={{
      padding: 18,
      borderRadius: 18,
      backgroundColor: theme.accent,
      borderColor: theme.goldDeep,
      borderWidth: 3,
      marginBottom: 14,
    }}
    onPress={() => router.push("/scan")}
  >
    <ThemedText style={{ fontSize: 18, fontWeight: "900", color: theme.black }}>
      Scan Anything
    </ThemedText>
    <ThemedText style={{ fontSize: 14, opacity: 0.85, color: theme.black }}>
      AI-powered scanning
    </ThemedText>
  </AnimatedPressable>

  {/* View History */}
  <AnimatedPressable
    style={{
      padding: 18,
      borderRadius: 18,
      backgroundColor: theme.card,
      borderColor: theme.goldDeep,
      borderWidth: 3,
      marginBottom: 14,
    }}
    onPress={() => router.push("/history")}
  >
    <ThemedText style={{ fontSize: 18, fontWeight: "900", color: theme.accent }}>
      View History
    </ThemedText>
  </AnimatedPressable>

  {/* Discover Boot Fairs */}
  <AnimatedPressable
    style={{
      padding: 18,
      borderRadius: 18,
      backgroundColor: theme.card,
      borderColor: theme.goldDeep,
      borderWidth: 3,
      marginBottom: 14,
    }}
    onPress={() => router.push("/bootfairs")}
  >
    <ThemedText style={{ fontSize: 18, fontWeight: "900", color: theme.accent }}>
      Discover Boot Fairs
    </ThemedText>
  </AnimatedPressable>
{/* Car Flips */}
<AnimatedPressable
  style={{
    padding: 18,
    borderRadius: 18,
    backgroundColor: theme.card,
    borderColor: theme.goldDeep,
    borderWidth: 3,
    marginBottom: 14,
  }}
  onPress={() => router.push("/car/CarListScreen")}
>
  <ThemedText style={{ fontSize: 18, fontWeight: "900", color: theme.accent }}>
    Car Flips
  </ThemedText>
  <ThemedText style={{ fontSize: 14, opacity: 0.85, color: theme.accent }}>
    Manage your vehicle flips
  </ThemedText>
</AnimatedPressable>

  {/* Rate / Review FlipPilot */}
  <AnimatedPressable
    style={{
      padding: 18,
      borderRadius: 18,
      backgroundColor: theme.card,
      borderColor: theme.goldDeep,
      borderWidth: 3,
      marginBottom: 14,
    }}
    onPress={() => router.push("/rate")}
  >
    <ThemedText style={{ fontSize: 18, fontWeight: "900", color: theme.accent }}>
      Rate / Review FlipPilot
    </ThemedText>
  </AnimatedPressable>

  {/* Feedback / Ideas */}
  <AnimatedPressable
    style={{
      padding: 18,
      borderRadius: 18,
      backgroundColor: theme.card,
      borderColor: theme.goldDeep,
      borderWidth: 3,
      marginBottom: 14,
    }}
    onPress={openSheet}
  >
    <ThemedText style={{ fontSize: 18, fontWeight: "900", color: theme.accent }}>
      Feedback / Ideas
    </ThemedText>
  </AnimatedPressable>
</ThemedView>


        {/* PROFIT + AI Buttons */}
        <View style={{ paddingHorizontal: 20, marginTop: -30}}>
          <AnimatedPressable
            style={[
              styles.profitButton,
              {
                backgroundColor: theme.accent,
                borderColor: theme.goldDeep,
                borderWidth: 3,
              },
            ]}
            onPress={openProfitSheet}
          >
            <ThemedText style={[styles.profitButtonTitle, { color: theme.black }]}>
              Profit Supernova
            </ThemedText>
            <ThemedText style={[styles.profitButtonSub, { color: theme.black }]}>
              See your best flips and averages
            </ThemedText>
          </AnimatedPressable>

          <AnimatedPressable
            style={[
              styles.aiButton,
              {
                backgroundColor: theme.card,
                borderColor: theme.goldDeep,
                borderWidth: 3,
              },
            ]}
            onPress={openAssistantSheet}
          >
            <ThemedText style={[styles.aiButtonTitle, { color: theme.accent }]}>
              FlipPilot AI Assistant
            </ThemedText>
            <ThemedText style={[styles.aiButtonSub, { color: theme.accent }]}>
              Ask anything about your flips
            </ThemedText>
          </AnimatedPressable>
        </View>

        
           
      </ThemedView>

      {/* GoldFX entry */}
      <View style={{ paddingHorizontal: 20, marginTop: -9 }}>
        <GoldFXEntryComponent />
      </View>

      {/* SHEETS */}
      {profitOpen && (
        <ProfitSupernovaSheet
          translateY={profitTranslate}
          closeSheet={closeProfitSheet}
          bestFlip={bestFlip}
          avgProfit={avgProfit}
          avgROI={avgROI}
        />
      )}

      {sheetOpen && (
        <FeedbackSheet
          translateY={sheetTranslate}
          closeSheet={closeSheet}
          feedbackText={feedbackText}
          setFeedbackText={setFeedbackText}
          warning={warning}
          sendFeedback={sendFeedback}
        />
      )}

      <FlipPilotAssistantSheet
        translateY={assistantTranslate}
        closeSheet={closeAssistantSheet}
        isOpen={assistantOpen}
      />
    </ScrollView>
  </ThemedView>
);
}
  

// ------------------------------------------------------
// STYLES
// ------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  weatherWrap: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  heroWrap: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    height: 280,
    overflow: "hidden",
  },
  nebula: {
    position: "absolute",
    width: "100%",
    height: 320,
    borderRadius: 320,
    top: 0,
    left: 0,
  },
  comet: {
    position: "absolute",
    width: 180,
    height: 4,
    opacity: 0.42,
    top: 40,
    left: -60,
    borderRadius: 4,
  },
  shockwave: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 320,
    opacity: 0.5,
  },
  starPress: {
    position: "absolute",
    top: 60,
    right: 60,
  },
  starText: {
    fontSize: 38,
  },
  logo: {
    width: 400,
    height: 380,
    resizeMode: "contain",
  },
  logoHalo: {
    alignItems: "center",
    justifyContent: "center",
  },
  statsCard: {
    marginTop: 20,
    padding: 20,
    borderRadius: 20,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statBox: {
    alignItems: "center",
    flex: 1,
  },
  statLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "900",
    marginTop: 4,
  },
  bestLabel: {
    fontSize: 12,
    opacity: 0.8,
    color: "#666",
  },
  bestValue: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
    color: "#111",
  },
  profitButton: {
    marginTop: 30,
    padding: 20,
    borderRadius: 20,
  },
  profitButtonTitle: {
    fontSize: 20,
    fontWeight: "900",
  },
  profitButtonSub: {
    fontSize: 14,
    marginTop: 6,
    opacity: 0.85,
  },
  aiButton: {
    marginTop: 20,
    padding: 20,
    borderRadius: 20,
  },
  aiButtonTitle: {
    fontSize: 20,
    fontWeight: "900",
  },
  aiButtonSub: {
    fontSize: 14,
    marginTop: 6,
    opacity: 0.85,
  },
  goldButton: {
    marginTop: 20,
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  goldTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111",
  },
  goldSubtitle: {
    fontSize: 13,
    opacity: 0.9,
    color: "#111",
    marginTop: 6,
  },
});
