import type { PurchasesOfferings } from "react-native-purchases";


import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSubscription } from "../src/context/SubscriptionContext";




const NAVY = "#0A1128";
const GOLD = "#FFD700";
const SLATE = "#1a2440";
const BLUE = "#1e90ff";

export default function UpgradeScreen() {
  const insets = useSafeAreaInsets();

  // RevenueCat subscription context
 const { offerings, purchase, restore } = useSubscription() as {
  offerings: PurchasesOfferings | null;

  purchase: (pkg: any) => Promise<void>;
  restore: () => Promise<void>;
};

  // Animations
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(40)).current;
  const glow = useRef(new Animated.Value(0)).current;

  const [yearly, setYearly] = useState(false);
useEffect(() => {
  Animated.parallel([
    Animated.timing(fade, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }),
    Animated.timing(slide, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }),
    Animated.timing(glow, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: false,
    }),
  ]).start();
}, []);

const glowShadow = glow.interpolate({
  inputRange: [0, 1],
  outputRange: [0, 18],
});


const handlePurchase = () => {
  const current = offerings?.current;

  if (!current) return;

  const pkg = yearly ? current.annual : current.monthly;

  if (pkg) purchase(pkg);
};







  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <Animated.View
        style={{
          opacity: fade,
          transform: [{ translateY: slide }],
        }}
      >
        {/* GLOWING HEADER */}
        <Animated.Text
          style={[
            styles.title,
            {
              textShadowColor: GOLD,
              opacity: glowShadow,

            },
          ]}
        >
          FlipPilot Pro
        </Animated.Text>

        <Text style={styles.subtitle}>Unlock your full flipping power</Text>

        {/* PRO BADGE */}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>PRO</Text>
        </View>

        {/* PRICING TOGGLE */}
        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => setYearly(false)}
            style={[styles.toggleButton, !yearly && styles.toggleActive]}
          >
            <Text style={!yearly ? styles.toggleTextActive : styles.toggleText}>
              Monthly
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setYearly(true)}
            style={[styles.toggleButton, yearly && styles.toggleActive]}
          >
            <Text style={yearly ? styles.toggleTextActive : styles.toggleText}>
              Yearly (Save 40%)
            </Text>
          </Pressable>
        </View>

        {/* FEATURE LIST */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔥 Everything You Unlock</Text>

          {[
            "Supernova AI Pricing",
            "Advanced Market Intelligence",
            "Unlimited AI Lookups",
            "Pro Flip Detection",
            "Boot Fair Finder Pro",
            "Advertising Hub Access",
            "Priority Feature Access",
            "Premium Themes",
          ].map((item, i) => (
            <Animated.View
              key={i}
              style={{
                opacity: fade,
                transform: [
                  {
                    translateY: slide.interpolate({
                      inputRange: [0, 40],
                      outputRange: [0, (i + 1) * 4],
                    }),
                  },
                ],
              }}
            >
              <Text style={styles.feature}>• {item}</Text>
            </Animated.View>
          ))}
        </View>

        {/* COMPARISON */}
        <View style={styles.compareCard}>
          <Text style={styles.compareTitle}>Free vs Pro</Text>

          {[
            ["AI Lookups", "Limited → Unlimited"],
            ["Market Check", "Basic → Full Data"],
            ["Profit Engine", "Standard → Advanced"],
            ["Flip Score", "Basic → Pro Metrics"],
            ["Boot Fair Finder", "Basic → Pro Map"],
          ].map(([left, right], i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.left}>{left}</Text>
              <Text style={styles.right}>{right}</Text>
            </View>
          ))}
        </View>

        {/* CTA BUTTON */}
        <Pressable style={styles.button} onPress={handlePurchase}>
          <Text style={styles.buttonText}>
            Unlock FlipPilot Pro —{" "}
            {yearly ? "£39.99 / year" : "£4.99 / month"}
          </Text>
          <Text style={styles.buttonSub}>Cancel anytime</Text>
        </Pressable>

        {/* RESTORE PURCHASES */}
        <Pressable onPress={restore} style={{ marginTop: 10 }}>
          <Text style={{ color: "#AFC6FF", textAlign: "center" }}>
            Restore Purchases
          </Text>
        </Pressable>

        {/* GUARANTEE */}
        <Text style={styles.guarantee}>
          7‑day free trial • No commitment • Cancel anytime
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
    paddingHorizontal: 20,
  },

  title: {
    fontSize: 42,
    fontWeight: "900",
    color: GOLD,
    textAlign: "center",
  },

  subtitle: {
    fontSize: 18,
    color: "#AFC6FF",
    textAlign: "center",
    marginBottom: 20,
  },

  badge: {
    alignSelf: "center",
    backgroundColor: GOLD,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 20,
  },

  badgeText: {
    color: NAVY,
    fontWeight: "900",
    fontSize: 14,
  },

  toggleRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
  },

  toggleButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginHorizontal: 6,
    backgroundColor: SLATE,
  },

  toggleActive: {
    backgroundColor: GOLD,
  },

  toggleText: {
    color: "#AFC6FF",
    fontWeight: "600",
  },

  toggleTextActive: {
    color: NAVY,
    fontWeight: "800",
  },

  card: {
    backgroundColor: SLATE,
    padding: 20,
    borderRadius: 14,
    marginBottom: 20,
  },

  cardTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: GOLD,
    marginBottom: 12,
  },

  feature: {
    color: "#DDE6FF",
    fontSize: 16,
    marginBottom: 6,
  },

  compareCard: {
    backgroundColor: "#0F1A33",
    padding: 20,
    borderRadius: 14,
    marginBottom: 30,
  },

  compareTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: BLUE,
    marginBottom: 14,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  left: {
    color: "#AFC6FF",
    fontSize: 16,
  },

  right: {
    color: GOLD,
    fontSize: 16,
    fontWeight: "600",
  },

  button: {
    backgroundColor: GOLD,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },

  buttonText: {
    fontSize: 18,
    fontWeight: "800",
    color: NAVY,
    textAlign: "center",
  },

  buttonSub: {
    fontSize: 14,
    color: NAVY,
    marginTop: 4,
  },

  guarantee: {
    textAlign: "center",
    color: "#AFC6FF",
    marginTop: 10,
    fontSize: 14,
  },
});

