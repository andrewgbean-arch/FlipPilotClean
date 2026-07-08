import React, { ReactNode, useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useFlipHistory } from "@/context/FlipHistoryContext";
import { useTheme } from "@/context/ThemeContext";
import { FlipRecord } from "@/models/FlipRecord";

import ThemedText from "@/styles/theme/ThemedText";
import ThemedView from "@/styles/theme/ThemedView";

import ProfitSupernovaSheet from "../ProfitSupernovaSheet";
import FlipPilotAssistantSheet from "../FlipPilotAssistantSheet";


// ------------------------------------------------------
// AnimatedPressable
// ------------------------------------------------------
interface AnimatedPressableProps {
  children: ReactNode;
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
// HOME SCREEN
// ------------------------------------------------------
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { flips } = useFlipHistory();

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
  // HERO ANIMATION
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
  // NEON GOLD PULSE
  // ------------------------------------------------------
  const neonPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(neonPulse, {
          toValue: 1,
          duration: 2600,
          useNativeDriver: false,
        }),
        Animated.timing(neonPulse, {
          toValue: 0,
          duration: 2600,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const glow = neonPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 0.9],
  });

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
      ? flips.reduce((s: number, f: FlipRecord) => s + getProfit(f), 0) /
        totalFlips
      : 0;

  const avgROI =
    totalFlips > 0
      ? flips.reduce((s: number, f: FlipRecord) => s + getROI(f), 0) /
        totalFlips
      : 0;

  const bestFlip =
    totalFlips > 0
      ? [...flips].sort((a, b) => getProfit(b) - getProfit(a))[0]
      : null;

  const logoSource = require("../../assets/images/logo1.png");

  // ------------------------------------------------------
  // FEEDBACK + SHEETS + ANIMATIONS
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
  // RENDER — FINAL HOME SCREEN RETURN
  // ------------------------------------------------------
  return (
    <ThemedView
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom + 95,
        }}
        showsVerticalScrollIndicator={false}
      >

      

     {/* HERO HEADER */}
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
  <Animated.View
    style={[
      styles.logoHalo,
      {
        shadowColor: theme.goldDeep,
        shadowOpacity: glow,
      },
    ]}
  >
    <Image
      source={logoSource}
      style={{ width: 600, height: 400, resizeMode: "contain" }}
    />
  </Animated.View>
</Animated.View>

{/* GOLD FX BUTTON — ONLY THIS ONE */}
{GoldFXEntry}

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

        {/* PROFIT SUPER-NOVA */}
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

        {/* FLIPPILOT AI ASSISTANT BUTTON */}
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

      {assistantOpen && (
        <FlipPilotAssistantSheet
          translateY={assistantTranslate}
          closeSheet={closeAssistantSheet}
        />
      )}

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  logoHalo: {
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
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
