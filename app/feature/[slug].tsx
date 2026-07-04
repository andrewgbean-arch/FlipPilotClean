import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";

/* Enable LayoutAnimation on Android */
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const NAVY = "#0A1128";
const GOLD = "#FFD700";
const SLATE = "#112240";
const TEXT = "#DDE6F7";

export default function FeaturePage() {
  const { slug, content, icon } = useLocalSearchParams();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const heroAnim = useRef(new Animated.Value(0)).current;

  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const onScroll = (e: any) => {
    heroAnim.setValue(e.nativeEvent.contentOffset.y);
  };

  const heroTranslate = heroAnim.interpolate({
    inputRange: [0, 200],
    outputRange: [0, -60],
    extrapolate: "clamp",
  });

  const heroScale = heroAnim.interpolate({
    inputRange: [0, 200],
    outputRange: [1, 1.15],
    extrapolate: "clamp",
  });

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  const previewText =
    typeof content === "string" && content.length > 160
      ? content.slice(0, 160) + "..."
      : content;

  return (
    <View style={styles.container}>
      {/* BACK BUTTON */}
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={28} color={GOLD} />
      </Pressable>

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        {/* HERO */}
        <Animated.View
          style={[
            styles.hero,
            {
              transform: [{ translateY: heroTranslate }, { scale: heroScale }],
            },
          ]}
        >
          <View style={styles.heroOverlay} />

          <Text style={styles.heroIcon}>{icon}</Text>
          <Text style={styles.heroTitle}>{slug}</Text>
        </Animated.View>

        {/* CONTENT */}
        <Animated.View
          style={{
            padding: 24,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* DESCRIPTION PREVIEW */}
          <Text style={styles.descriptionText}>
            {expanded ? content : previewText}
          </Text>

          {/* READ MORE BUTTON */}
          {typeof content === "string" && content.length > 160 && (
            <Pressable onPress={toggleExpand} style={styles.readMoreButton}>
              <Text style={styles.readMoreText}>
                {expanded ? "Show Less" : "Read Full Description"}
              </Text>
            </Pressable>
          )}

          {/* Divider */}
          <View style={styles.divider} />

          {/* MODULES SECTION */}
          <Text style={styles.sectionTitle}>Learning Modules</Text>

          <View style={styles.moduleCard}>
            <Text style={styles.moduleTitle}>Module 1 — Introduction</Text>
            <Text style={styles.moduleText}>
              A beginner‑friendly overview of this feature and how to use it
              effectively inside FlipPilot.
            </Text>
          </View>

          <View style={styles.moduleCard}>
            <Text style={styles.moduleTitle}>Module 2 — Pro Tips</Text>
            <Text style={styles.moduleText}>
              Learn advanced strategies, shortcuts, and hidden tricks to get the
              most out of this tool.
            </Text>
          </View>

          {/* COMING SOON */}
          <Text style={styles.sectionTitle}>Coming Soon</Text>

          <Text style={styles.comingSoonText}>
            Interactive guides, videos, AI‑powered insights, and more will appear
            here as FlipPilot evolves.
          </Text>

          {/* START LESSON BUTTON */}
          <Pressable style={styles.lessonButton}>
            <Text style={styles.lessonButtonText}>Start Lesson</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

/* ============================
   STYLES
============================ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
  },

  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 20,
    backgroundColor: "rgba(10,17,40,0.6)",
    padding: 10,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.4)",
  },

  hero: {
    height: 260,
    backgroundColor: GOLD,
    justifyContent: "flex-end",
    padding: 24,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },

  heroOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.15)",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },

  heroIcon: {
    fontSize: 64,
    fontWeight: "900",
    color: NAVY,
  },

  heroTitle: {
    fontSize: 40,
    fontWeight: "900",
    color: NAVY,
    marginTop: 4,
  },

  descriptionText: {
    color: TEXT,
    fontSize: 18,
    lineHeight: 28,
    marginBottom: 12,
  },

  readMoreButton: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,215,0,0.15)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.3)",
    marginBottom: 20,
  },

  readMoreText: {
    color: GOLD,
    fontSize: 15,
    fontWeight: "700",
  },

  divider: {
    height: 2,
    backgroundColor: "rgba(255,215,0,0.4)",
    marginVertical: 20,
    borderRadius: 2,
  },

  sectionTitle: {
    color: GOLD,
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 12,
  },

  moduleCard: {
    backgroundColor: SLATE,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.25)",
    marginBottom: 16,
  },

  moduleTitle: {
    color: GOLD,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },

  moduleText: {
    color: "#AFC6FF",
    fontSize: 15,
    lineHeight: 22,
  },

  comingSoonText: {
    color: TEXT,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },

  lessonButton: {
    backgroundColor: GOLD,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },

  lessonButtonText: {
    color: NAVY,
    fontSize: 18,
    fontWeight: "900",
  },
});
