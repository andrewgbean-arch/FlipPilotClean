import { styles } from "../../src/styles/explore.styles";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../src/context/ThemeContext";
import { ThemedText } from "../../src/styles/theme/ThemedText";
import ThemedView from "../../src/styles/theme/ThemedView";

type Feature = {
  icon: string;
  title: string;
  desc: string;
  category: string;
  premium: boolean;
  content: string;
};

const FEATURES: Feature[] = [
  {
    icon: "💰",
    title: "Market Check",
    desc: "See real resale value.",
    category: "Market Tools",
    premium: true,
    content: `
Shows real eBay sold prices, trends, and demand.

Pro Tips:
• Look for consistent sales  
• Avoid low sell‑through items  
• Compare condition carefully  
`,
  },
  {
    icon: "💾",
    title: "Save Flip",
    desc: "Track profit and ROI.",
    category: "Tools",
    premium: false,
    content: `
Track profit, ROI, and performance for every item you flip.

Pro Tips:
• Add photos  
• Tag items by category  
`,
  },
  {
    icon: "⭐",
    title: "Favourites",
    desc: "Quick access to top flips.",
    category: "Tools",
    premium: false,
    content: `
Save high‑value or interesting items for quick access.

Pro Tips:
• Use for items you want to research later  
`,
  },
  {
    icon: "📊",
    title: "History",
    desc: "Your flipping stats.",
    category: "Tools",
    premium: false,
    content: `
Your flipping performance dashboard.

Pro Tips:
• Track trends  
• See which categories make you the most profit  
`,
  },
  {
    icon: "📢",
    title: "Advertising Hub",
    desc: "Promote your stall.",
    category: "Pro Features",
    premium: true,
    content: `
Promote your stall and attract more buyers.

Pro Tips:
• Use clear photos  
• Highlight your best items  
`,
  },
  {
    icon: "⚡",
    title: "Supernova AI Pricing",
    desc: "True market value.",
    category: "AI Tools",
    premium: true,
    content: `
Predicts true market value using AI.

Pro Tips:
• Use after scanning  
• Compare predicted vs real sold prices  
`,
  },
  {
    icon: "✈️",
    title: "FlipPilot Method",
    desc: "Your flipping blueprint.",
    category: "Guides",
    premium: true,
    content: `
Your complete flipping blueprint.

Includes:
• Sourcing  
• Scanning  
• Pricing  
• Negotiation  
• Selling  
• Scaling  
`,
  },
  {
    icon: "💡",
    title: "Pro Tips",
    desc: "Level up your flips.",
    category: "Guides",
    premium: false,
    content: `
Level up your flipping skills.

Includes:
• Negotiation  
• Spotting fakes  
• Pricing strategies  
• Avoiding bad buys  
`,
  },
  {
    icon: "⚙️",
    title: "Advanced Rules",
    desc: "For serious flippers.",
    category: "Guides",
    premium: true,
    content: `
For serious flippers.
Includes:
• Trend tracking  
• Seasonal flips  
• High‑ROI strategies  
• Risk management  
`,
  },
];

const SUPER_NOVA_TITLE = "Supernova AI Pricing";

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const theme = useTheme();

  const [search, setSearch] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      setSearch("");
      setRecent([]);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  useEffect(() => {
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 550,
      useNativeDriver: true,
    }).start();

    Animated.timing(cardAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    Animated.timing(searchAnim, {
      toValue: 1,
      duration: 500,
      delay: 150,
      useNativeDriver: true,
    }).start();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return FEATURES;
    return FEATURES.filter((f) =>
      `${f.title} ${f.desc} ${f.category}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [search]);

  const grouped = useMemo(() => {
    const groups: Record<string, Feature[]> = {};
    filtered.forEach((f) => {
      if (!groups[f.category]) groups[f.category] = [];
      groups[f.category].push(f);
    });
    return groups;
  }, [filtered]);

  const smartSuggestions = useMemo(() => {
    return FEATURES.filter((f) =>
      ["AI Tools", "Market Tools"].includes(f.category)
    ).slice(0, 3);
  }, []);

  const getCardStyle = (index: number) => ({
    opacity: cardAnim,
    transform: [
      {
        translateY: cardAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [20 + index * 3, 0],
        }),
      },
    ],
  });

  const handleOpenFeature = (f: Feature) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRecent((prev) => {
      const updated = [f.title, ...prev.filter((x) => x !== f.title)];
      return updated.slice(0, 5);
    });
    router.push({
      pathname: "/feature/[slug]",
      params: {
        slug: f.title,
        content: f.content,
        icon: f.icon,
      },
    });
  };

  const getCardBaseStyle = (f: Feature) =>
    f.premium ? styles.cardDark : styles.cardLight;

  const getCardExtraStyle = (f: Feature, isAISuggested = false) => {
    const extras: any[] = [];
    if (f.premium) extras.push(styles.glowCard);
    if (f.title === SUPER_NOVA_TITLE) extras.push(styles.supernova);
    if (isAISuggested) extras.push(styles.aiGlow);
    return extras;
  };

  const renderProBadge = (f: Feature) =>
    f.premium ? (
      <ThemedView style={styles.proBadge}>
        <ThemedText style={styles.proBadgeText}>PRO</ThemedText>
      </ThemedView>
    ) : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      ref={scrollRef}
      scrollEventThrottle={16}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom + 40,
        },
      ]}
    >
      {/* HEADER */}
      <Animated.View
        style={{
          opacity: headerAnim,
          transform: [
            {
              translateY: headerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        }}
      >
        <ThemedText style={styles.title}>FlipPilot Academy</ThemedText>
        <ThemedText style={styles.subtitle}>
          Your hub for tools, guides, AI features, and flipping mastery.
        </ThemedText>
      </Animated.View>

      {/* SEARCH */}
      <Animated.View
        style={{
          opacity: searchAnim,
          transform: [
            {
              translateY: searchAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
          marginTop: 12,
        }}
      >
        <ThemedView>
          <TextInput
            placeholder="Search tools, features, guides..."
            placeholderTextColor={theme.muted}
            value={search}
            onChangeText={setSearch}
            style={[
              styles.search,
              {
                color: theme.text,
                borderColor: theme.goldDeep,
                backgroundColor: theme.card,
              },
            ]}
          />
          {search.length > 0 && (
            <Pressable
              onPress={() => setSearch("")}
              style={{
                position: "absolute",
                right: 20,
                top: 18,
              }}
            >
              <ThemedText
                style={{ color: theme.accent, fontSize: 14, fontWeight: "700" }}
              >
                Clear
              </ThemedText>
            </Pressable>
          )}
        </ThemedView>
      </Animated.View>

      {/* QUICK ACCESS (now premium card, no gradient) */}
      {!search && (
        <ThemedView style={{ marginTop: 26 }}>
          <ThemedView
            style={{
              padding: 16,
              borderRadius: 16,
              borderWidth: 3,
              borderColor: theme.goldDeep,
              backgroundColor: theme.card,
            }}
          >
            <ThemedText style={styles.sectionTitle}>Quick Access</ThemedText>

            <ThemedView style={{ gap: 14, marginTop: 14 }}>
              {/* AI Lookup */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/ai-camera");
                }}
                style={({ pressed }) => [
                  styles.cardDark,
                  styles.glowCard,
                  styles.aiGlow,
                  {
                    borderColor: theme.goldDeep,
                    shadowOpacity: pressed ? 0.35 : 0.2,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
              >
                <ThemedText style={styles.cardTitleDark}>
                  🔍 AI Lookup
                </ThemedText>
                <ThemedText style={styles.cardTextDark}>
                  Identify any item instantly
                </ThemedText>
              </Pressable>

              {/* Barcode Scanner */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/scan");
                }}
                style={({ pressed }) => [
                  styles.cardDark,
                  styles.glowCard,
                  {
                    borderColor: theme.goldDeep,
                    shadowOpacity: pressed ? 0.35 : 0.2,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
              >
                <ThemedText style={styles.cardTitleDark}>
                  📸 Barcode Scanner
                </ThemedText>
                <ThemedText style={styles.cardTextDark}>
                  Fastest way to check value
                </ThemedText>
              </Pressable>

              {/* Boot Fairs */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/bootfairs");
                }}
                style={({ pressed }) => [
                  styles.cardDark,
                  {
                    borderColor: theme.goldDeep,
                    shadowOpacity: pressed ? 0.35 : 0.2,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
              >
                <ThemedText style={styles.cardTitleDark}>
                  🛒 Boot Fairs
                </ThemedText>
                <ThemedText style={styles.cardTextDark}>
                  Find local boot fairs
                </ThemedText>
              </Pressable>

              {/* Market Tools */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/(market)");
                }}
                style={({ pressed }) => [
                  styles.cardDark,
                  {
                    borderColor: theme.goldDeep,
                    shadowOpacity: pressed ? 0.35 : 0.2,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
              >
                <ThemedText style={styles.cardTitleDark}>
                  📊 Market Tools
                </ThemedText>
                <ThemedText style={styles.cardTextDark}>
                  Real resale value & trends
                </ThemedText>
              </Pressable>
            </ThemedView>
          </ThemedView>
        </ThemedView>
      )}

      {/* WHAT’S NEW */}
      {!search && (
        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>What’s New</ThemedText>

          {FEATURES.slice(0, 1).map((f, i) => (
            <View key={f.title}>
              <Animated.View style={getCardStyle(i)}>
                <Pressable
                  style={({ pressed }) => [
                    getCardBaseStyle(f),
                    ...getCardExtraStyle(f),
                    {
                      transform: [{ scale: pressed ? 0.96 : 1 }],
                      shadowOpacity: pressed ? 0.1 : 0.25,
                    },
                  ]}
                  onPress={() => handleOpenFeature(f)}
                >
                  {renderProBadge(f)}
                  <ThemedText
                    style={
                      f.premium ? styles.cardTitleDark : styles.cardTitle
                    }
                  >
                    {f.icon} {f.title}
                  </ThemedText>
                  <ThemedText
                    style={f.premium ? styles.cardTextDark : styles.cardText}
                  >
                    {f.desc}
                  </ThemedText>
                </Pressable>
              </Animated.View>
            </View>
          ))}
        </ThemedView>
      )}

      {/* SUGGESTED FOR YOU */}
      {!search && (
        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Suggested for You</ThemedText>

          {smartSuggestions.map((f, i) => (
            <View key={f.title}>
              <Animated.View style={getCardStyle(i)}>
                <Pressable
                  style={({ pressed }) => [
                    getCardBaseStyle(f),
                    ...getCardExtraStyle(f, true),
                    {
                      transform: [{ scale: pressed ? 0.96 : 1 }],
                      shadowOpacity: pressed ? 0.1 : 0.25,
                    },
                  ]}
                  onPress={() => handleOpenFeature(f)}
                >
                  {renderProBadge(f)}
                  <ThemedText
                    style={
                      f.premium ? styles.cardTitleDark : styles.cardTitle
                    }
                  >
                    {f.icon} {f.title}
                  </ThemedText>
                  <ThemedText
                    style={f.premium ? styles.cardTextDark : styles.cardText}
                  >
                    {f.desc}
                  </ThemedText>
                </Pressable>
              </Animated.View>
            </View>
          ))}
        </ThemedView>
      )}

      {/* RECENTLY VIEWED */}
      {!search && recent.length > 0 && (
        <ThemedView style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Recently Viewed</ThemedText>

          {recent.map((title, i) => {
            const f = FEATURES.find((x) => x.title === title);
            if (!f) return null;

            return (
              <View key={f.title}>
                <Animated.View style={getCardStyle(i)}>
                  <Pressable
                    style={({ pressed }) => [
                      getCardBaseStyle(f),
                      ...getCardExtraStyle(f),
                      {
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                        shadowOpacity: pressed ? 0.1 : 0.25,
                      },
                    ]}
                    onPress={() => handleOpenFeature(f)}
                  >
                    {renderProBadge(f)}
                    <ThemedText
                      style={
                        f.premium ? styles.cardTitleDark : styles.cardTitle
                      }
                    >
                      {f.icon} {f.title}
                    </ThemedText>
                    <ThemedText
                      style={
                        f.premium ? styles.cardTextDark : styles.cardText
                      }
                    >
                      {f.desc}
                    </ThemedText>
                  </Pressable>
                </Animated.View>
              </View>
            );
          })}
        </ThemedView>
      )}

      {/* GROUPED SECTIONS */}
      {Object.keys(grouped).map((category, sectionIndex) => (
        <ThemedView key={category} style={styles.section}>
          {sectionIndex > 0 && <View style={styles.divider} />}

          <Animated.Text
            style={[styles.sectionTitle, getCardStyle(sectionIndex)]}
          >
            {category}
          </Animated.Text>

          {grouped[category].map((f, i) => (
            <View key={f.title}>
              <Animated.View style={getCardStyle(i)}>
                <Pressable
                  style={({ pressed }) => [
                    getCardBaseStyle(f),
                    ...getCardExtraStyle(f),
                    {
                      transform: [{ scale: pressed ? 0.96 : 1 }],
                      shadowOpacity: pressed ? 0.1 : 0.25,
                    },
                  ]}
                  onPress={() => handleOpenFeature(f)}
                >
                  {renderProBadge(f)}
                  <ThemedText
                    style={
                      f.premium ? styles.cardTitleDark : styles.cardTitle
                    }
                  >
                    {f.icon} {f.title}
                  </ThemedText>
                  <ThemedText
                    style={
                      f.premium ? styles.cardTextDark : styles.cardText
                    }
                  >
                    {f.desc}
                  </ThemedText>
                </Pressable>
              </Animated.View>
            </View>
          ))}
        </ThemedView>
      ))}

      {filtered.length === 0 && (
        <ThemedText style={styles.empty}>No results found.</ThemedText>
      )}
    </ScrollView>
  );
}
