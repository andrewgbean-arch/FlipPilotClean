import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import WeatherCard from "../feature/WeatherCard";
import { useFlipHistory } from "@/context/FlipHistoryContext";
import { useTheme } from "@/context/ThemeContext";
import { FlipRecord } from "@/models/FlipRecord";

import ThemedText from "@/styles/theme/ThemedText";
import ThemedView from "@/styles/theme/ThemedView";

import ProfitSupernovaSheet from "../ProfitSupernovaSheet";
import FlipPilotAssistantSheet from "../../src/screens/FlipPilotAssistantSheet";
import FeedbackSheet from "../FeedbackSheet";

import { Easing } from "react-native";


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

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={() =>
          Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start()
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
// CosmicParticles (Sparkles Replacement)
// ------------------------------------------------------
const CosmicParticles = ({
  count = 26,
  color,
}: {
  count?: number;
  color: string;
}) => {
  const particles = Array.from({ length: count }).map(() => ({
    x: new Animated.Value(Math.random() * 700 - 350),
    y: new Animated.Value(Math.random() * 450 - 225),
    scale: new Animated.Value(Math.random() * 1.2 + 0.4),
    opacity: new Animated.Value(Math.random() * 0.8 + 0.2),
  }));

  useEffect(() => {
    particles.forEach((p) => {
      const loop = () => {
        Animated.parallel([
          Animated.timing(p.x, {
            toValue: Math.random() * 700 - 350,
            duration: 4000 + Math.random() * 3000,
            useNativeDriver: true,
          }),
          Animated.timing(p.y, {
            toValue: Math.random() * 450 - 225,
            duration: 4000 + Math.random() * 3000,
            useNativeDriver: true,
          }),
          Animated.timing(p.scale, {
            toValue: Math.random() * 1.2 + 0.4,
            duration: 3000 + Math.random() * 2000,
            useNativeDriver: true,
          }),
          Animated.timing(p.opacity, {
            toValue: Math.random() * 0.8 + 0.2,
            duration: 3000 + Math.random() * 2000,
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
            width: 8,
            height: 8,
            borderRadius: 8,
            backgroundColor: color,
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
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(heroTranslate, {
        toValue: 0,
        useNativeDriver: true,
        speed: 1,
        bounciness: 12,
      }),
    ]).start();
  }, []);

 // ------------------------------------------------------
// TRIPLE SUPERNOVA PULSE (DISABLED FOR DEBUG)
// ------------------------------------------------------

// const pulseA = useRef(new Animated.Value(0)).current;
// const pulseB = useRef(new Animated.Value(0)).current;
// const pulseC = useRef(new Animated.Value(0)).current;

// useEffect(() => {
//   Animated.loop(
//     Animated.sequence([
//       Animated.timing(pulseA, { toValue: 1, duration: 2600, useNativeDriver: false }),
//       Animated.timing(pulseA, { toValue: 0, duration: 2600, useNativeDriver: false }),
//     ])
//   ).start();

//   Animated.loop(
//     Animated.sequence([
//       Animated.timing(pulseB, { toValue: 1, duration: 3200, useNativeDriver: false }),
//       Animated.timing(pulseB, { toValue: 0, duration: 3200, useNativeDriver: false }),
//     ])
//   ).start();

//   Animated.loop(
//     Animated.sequence([
//       Animated.timing(pulseC, { toValue: 1, duration: 3800, useNativeDriver: false }),
//       Animated.timing(pulseC, { toValue: 0, duration: 3800, useNativeDriver: false }),
//     ])
//   ).start();
// }, []);

// const glowA = pulseA.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });
// const glowB = pulseB.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.75] });
// const glowC = pulseC.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.65] });



  // ------------------------------------------------------
// NEBULA DRIFT
// ------------------------------------------------------
const nebulaA = useRef(new Animated.Value(0)).current;
const nebulaB = useRef(new Animated.Value(0)).current;

const nebulaTranslateA = nebulaA.interpolate({
  inputRange: [0, 1],
  outputRange: [-10, 10],
});

const nebulaTranslateB = nebulaB.interpolate({
  inputRange: [0, 1],
  outputRange: [6, -6],
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
      Animated.timing(supernovaScale, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(supernovaScale, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  };

  const tapCosmicStar = () => {
    cosmicTapCount.current++;

    Animated.sequence([
      Animated.spring(cosmicStarScale, { toValue: 1.6, useNativeDriver: true }),
      Animated.spring(cosmicStarScale, { toValue: 1, useNativeDriver: true }),
    ]).start();

    if (cosmicTapCount.current >= 3) {
      fireComet();
      triggerSupernova();
      cosmicTapCount.current = 0;
    }
  };

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
      ? flips.reduce((s, f) => s + getProfit(f), 0) / totalFlips
      : 0;

  const avgROI =
    totalFlips > 0
      ? flips.reduce((s, f) => s + getROI(f), 0) / totalFlips
      : 0;

  const bestFlip =
    totalFlips > 0
      ? [...flips].sort((a, b) => getProfit(b) - getProfit(a))[0]
      : null;

  const logoSource = require("../../assets/images/logo1.png");

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
      duration: 280,
      useNativeDriver: false,
    }).start();
  };

  const closeSheet = () => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 240,
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
  // PROFIT + AI SHEETS
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
      duration: 240,
      useNativeDriver: false,
    }).start(() => {
      setProfitOpen(false);
    });
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
      duration: 240,
      useNativeDriver: false,
    }).start(() => {
      setAssistantOpen(false);
    });
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

  const [recentFeedback, setRecentFeedback] = useState([]);

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
  // GOLD FX LAB BUTTON
  // ------------------------------------------------------
  const GoldFXEntry = (
    <AnimatedPressable
      style={{
        marginTop: 20,
        padding: 16,
        borderRadius: 16,
        backgroundColor: theme.goldDeep,
        alignItems: "center",
      }}
      onPress={() => router.push("/goldfx")}
    >
      <ThemedText
        style={{
          fontSize: 18,
          fontWeight: "900",
          color: theme.black,
          textAlign: "center",
        }}
      >
        Open GoldFX Lab
      </ThemedText>

      <ThemedText
        style={{
          fontSize: 14,
          opacity: 0.85,
          color: theme.black,
          marginTop: 4,
          textAlign: "center",
        }}
      >
        Cinematic Gold Engine
      </ThemedText>
    </AnimatedPressable>
  );

  // ------------------------------------------------------
  // RENDER
  // ------------------------------------------------------
  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom + 95,
        }}
        showsVerticalScrollIndicator={false}
      >

        {/* ------------------------------------------------------ */}
        {/* INTERSTELLAR HEADER — BALANCED COSMIC (700×450)         */}
        {/* ------------------------------------------------------ */}
        <Animated.View
          style={{
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
            marginTop: insets.top - 100,
            marginBottom: -80,
            opacity: heroFade,
            transform: [{ translateY: heroTranslate }],
          }}
        >

          {/* 🌌 Nebula Drift A */}
          <Animated.View
            style={{
              position: "absolute",
              width: "100%",
              height: 320,
              backgroundColor: theme.goldDeep + "22",
              transform: [{ translateX: nebulaTranslateA }],
              borderRadius: 320,
            }}
          />

          {/* 🌌 Nebula Drift B */}
          <Animated.View
            style={{
              position: "absolute",
              width: "100%",
              height: 320,
              backgroundColor: theme.goldDeep + "33",
              transform: [{ translateX: nebulaTranslateB }],
              borderRadius: 320,
            }}
          />

          {/* ✨ Cosmic Particle Engine */}
          <CosmicParticles count={26} color={theme.goldDeep} />

         {/* ☄️ Comet */}
<Animated.View
  style={{
    position: "absolute",
    width: 180,
    height: 4,
    backgroundColor: theme.goldDeep,
    opacity: 0.4,
    transform: [{ scaleX: cometScale }],
    top: 40,
    left: -60,
  }}
/>
{/* 💥 Shockwave */}
<Animated.View
  style={{
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 320,
    backgroundColor: theme.goldDeep + "22",
    transform: [{ scale: supernovaScale }],
    opacity: 0.5,
  }}
/>

{/* 🌟 Cosmic Star */}
<AnimatedPressable
  onPress={() => {
    tapCosmicStar();
    triggerSupernova();
  }}
  style={{ position: "absolute", top: 60, right: 60 }}
>
  <Animated.Text
    style={{
      fontSize: 38,
      color: theme.goldDeep,
      transform: [{ scale: cosmicStarScale }],
    }}
  >
    🌟
  </Animated.Text>
</AnimatedPressable>

{/* 🔆 Triple Supernova Pulse Halo — DISABLED */}
{/* 
<Animated.View
  style={[
    styles.logoHalo,
    {
      shadowColor: theme.goldDeep,
      shadowOpacity: glowA,
      transform: [{ translateX: driftTranslate }],
      elevation: 0,
    },
  ]}
>

  <Animated.View
    style={{
      position: "absolute",
      width: 700,
      height: 450,
      borderRadius: 350,
      shadowColor: theme.goldDeep,
      shadowOpacity: glowB,
      shadowRadius: 60,
      elevation: 0,
    }}
  />

  <Animated.View
    style={{
      position: "absolute",
      width: 700,
      height: 450,
      borderRadius: 350,
      shadowColor: theme.goldDeep,
      shadowOpacity: glowC,
      shadowRadius: 80,
      elevation: 0,
    }}
  />

  <Image
    source={logoSource}
    style={{ width: 700, height: 450, resizeMode: "contain" }}
  />
</Animated.View>
*/}


{/* GOLD FX BUTTON */}
{GoldFXEntry}

</Animated.View>
{/* STATS CARD */}
<ThemedView
  style={[
    styles.statsCard,
    {
      backgroundColor: theme.card,
      borderColor: theme.goldDeep,
      borderWidth: 3,
    },
  ]}
>
  <ThemedText style={[styles.cardTitle, { color: theme.accent }]}>
    Your Flip Stats
  </ThemedText>

  <ThemedView style={styles.statsRow}>
    <ThemedView style={styles.statBox}>
      <ThemedText style={styles.statLabel}>Total</ThemedText>
      <ThemedText style={styles.statValue}>{totalFlips}</ThemedText>
    </ThemedView>

    <ThemedView style={styles.statBox}>
      <ThemedText style={styles.statLabel}>Avg £</ThemedText>
      <ThemedText style={styles.statValue}>
        £{avgProfit.toFixed(2)}
      </ThemedText>
    </ThemedView>

    <ThemedView style={styles.statBox}>
      <ThemedText style={styles.statLabel}>ROI</ThemedText>
      <ThemedText style={styles.statValue}>
        {avgROI.toFixed(1)}%
      </ThemedText>
    </ThemedView>
  </ThemedView>
</ThemedView>

{/* WEATHER */}
<WeatherCard />

{/* QUICK ACTION BUTTONS */}
<ThemedView style={{ marginTop: 25 }}>
  {/* Ask FlipPilot AI */}
  <AnimatedPressable
    style={{
      padding: 18,
      borderRadius: 18,
      backgroundColor: theme.card,
      borderColor: theme.goldDeep,
      borderWidth: 3,
      marginBottom: 14,
    }}
    onPress={openAssistantSheet}
  >
    <ThemedText
      style={{ fontSize: 18, fontWeight: "900", color: theme.accent }}
    >
      Ask FlipPilot AI
    </ThemedText>
    <ThemedText
      style={{ fontSize: 14, opacity: 0.85, color: theme.accent }}
    >
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
    <ThemedText
      style={{ fontSize: 18, fontWeight: "900", color: theme.black }}
    >
      Scan Anything
    </ThemedText>
    <ThemedText
      style={{ fontSize: 14, opacity: 0.85, color: theme.black }}
    >
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
    <ThemedText
      style={{ fontSize: 18, fontWeight: "900", color: theme.accent }}
    >
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
    <ThemedText
      style={{ fontSize: 18, fontWeight: "900", color: theme.accent }}
    >
      Discover Boot Fairs
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
    <ThemedText
      style={{ fontSize: 18, fontWeight: "900", color: theme.accent }}
    >
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
    <ThemedText
      style={{ fontSize: 18, fontWeight: "900", color: theme.accent }}
    >
      Feedback / Ideas
    </ThemedText>
  </AnimatedPressable>
</ThemedView>

{/* PROFIT SUPERNOVA */}
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
  <ThemedText
    style={[styles.profitButtonTitle, { color: theme.black }]}
  >
    Profit Supernova
  </ThemedText>
  <ThemedText
    style={[styles.profitButtonSub, { color: theme.black }]}
  >
    See your best flips and averages
  </ThemedText>
</AnimatedPressable>

{/* FLIPPILOT AI ASSISTANT */}
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
</ScrollView>

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
</ThemedView>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
});
