import * as Haptics from "expo-haptics";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  AirplaneTilt,
  Barcode,
  CaretRight,
  ClipboardText,
  ClockCounterClockwise,
  CurrencyGbp,
  FloppyDisk,
  GearSix,
  Heart,
  Lightbulb,
  Lightning,
  MagnifyingGlass,
  Megaphone,
  Sparkle,
  Storefront,
  XCircle,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/styles/ThemeContext";

type Feature = {
  // What this screen draws for the feature.
  Icon: PhosphorIcon;
  // Handed to /feature/[slug] as its `icon` route param exactly as before,
  // because that screen still renders it. It is never drawn on this screen.
  emoji: string;
  title: string;
  desc: string;
  category: string;
  premium: boolean;
  content: string;
};

const FEATURES: Feature[] = [
  {
    Icon: CurrencyGbp,
    emoji: "💰",
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
    Icon: FloppyDisk,
    emoji: "💾",
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
    Icon: Heart,
    emoji: "⭐",
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
    Icon: ClockCounterClockwise,
    emoji: "📊",
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
    Icon: Megaphone,
    emoji: "📢",
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
    Icon: Lightning,
    emoji: "⚡",
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
    Icon: AirplaneTilt,
    emoji: "✈️",
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
    Icon: Lightbulb,
    emoji: "💡",
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
    Icon: GearSix,
    emoji: "⚙️",
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

type QuickAccessItem = {
  title: string;
  desc: string;
  href: Href;
  Icon: PhosphorIcon;
};

const QUICK_ACCESS: QuickAccessItem[] = [
  {
    title: "AI Lookup",
    desc: "Identify any item instantly",
    href: "/ai-camera",
    Icon: Sparkle,
  },
  {
    title: "Barcode Scanner",
    desc: "Fastest way to check value",
    href: "/scan",
    Icon: Barcode,
  },
  {
    title: "Boot Fairs",
    desc: "Find local boot fairs",
    href: "/bootfairs",
    Icon: Storefront,
  },
  {
    title: "MOT Checker",
    desc: "Look up any UK vehicle",
    href: "/vehicles/mot-lookup",
    Icon: ClipboardText,
  },
];

// Two tiles to a row.
const QUICK_ACCESS_ROWS = [QUICK_ACCESS.slice(0, 2), QUICK_ACCESS.slice(2, 4)];

// Category names double as search keys, so they stay as written in FEATURES.
// This only changes how a section heading reads.
const CATEGORY_LABELS: Record<string, string> = {
  "Market Tools": "Market tools",
  "Pro Features": "Pro features",
  "AI Tools": "AI tools",
};

const NEUTRAL_TINT = "rgba(255, 255, 255, 0.07)";

// The soft fill behind an icon: a theme colour at low opacity. Falls back to a
// neutral tint if the colour is not a plain #RRGGBB value.
const softTint = (color: string, alpha: number) => {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!match) return NEUTRAL_TINT;
  const [r, g, b] = [match[1], match[2], match[3]].map((h) => parseInt(h, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

function SectionTitle({ children }: { children: string }) {
  const theme = useTheme();

  return (
    <Text
      style={[styles.sectionTitle, { color: theme.text }]}
      accessibilityRole="header"
    >
      {children}
    </Text>
  );
}

function IconCircle({
  Icon,
  size,
  iconColor,
  background,
}: {
  Icon: PhosphorIcon;
  size: number;
  iconColor: string;
  background: string;
}) {
  return (
    <View
      style={[
        styles.iconCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
        },
      ]}
    >
      <Icon size={Math.round(size * 0.5)} color={iconColor} />
    </View>
  );
}

function ProBadge() {
  const theme = useTheme();

  return (
    <View
      style={[styles.proBadge, { backgroundColor: softTint(theme.gold, 0.14) }]}
    >
      <Text style={[styles.proBadgeText, { color: theme.gold }]}>PRO</Text>
    </View>
  );
}

function QuickTile({
  item,
  onOpen,
}: {
  item: QuickAccessItem;
  onOpen: (item: QuickAccessItem) => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.desc}`}
      onPress={() => onOpen(item)}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: theme.card, borderColor: theme.hairline },
        pressed && styles.pressed,
      ]}
    >
      <IconCircle
        Icon={item.Icon}
        size={44}
        iconColor={theme.secondary}
        background={softTint(theme.secondary, 0.16)}
      />
      <View>
        <Text
          style={[styles.tileTitle, { color: theme.text }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <Text
          style={[styles.tileDesc, { color: theme.muted }]}
          numberOfLines={2}
        >
          {item.desc}
        </Text>
      </View>
    </Pressable>
  );
}

// One tappable feature: icon, title, one line of description, a PRO marker
// where it applies, and a chevron.
function FeatureRow({
  feature,
  onOpen,
  divider,
}: {
  feature: Feature;
  onOpen: (feature: Feature) => void;
  divider?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${feature.title}. ${feature.desc}${
        feature.premium ? " Pro feature." : ""
      }`}
      onPress={() => onOpen(feature)}
      style={({ pressed }) => [
        styles.row,
        divider && { borderTopWidth: 1, borderTopColor: theme.hairline },
        pressed && styles.pressed,
      ]}
    >
      <IconCircle
        Icon={feature.Icon}
        size={40}
        iconColor={theme.text}
        background={NEUTRAL_TINT}
      />

      <View style={styles.rowText}>
        <Text
          style={[styles.rowTitle, { color: theme.text }]}
          numberOfLines={2}
        >
          {feature.title}
        </Text>
        <Text
          style={[styles.rowDesc, { color: theme.muted }]}
          numberOfLines={2}
        >
          {feature.desc}
        </Text>
      </View>

      {feature.premium ? <ProBadge /> : null}
      <CaretRight size={16} color={theme.muted} />
    </Pressable>
  );
}

function FeatureGroup({
  features,
  onOpen,
}: {
  features: Feature[];
  onOpen: (feature: Feature) => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.group,
        { backgroundColor: theme.card, borderColor: theme.hairline },
      ]}
    >
      {features.map((f, i) => (
        <FeatureRow key={f.title} feature={f} onOpen={onOpen} divider={i > 0} />
      ))}
    </View>
  );
}

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const theme = useTheme();

  const [search, setSearch] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      setSearch("");
      setRecent([]);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

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

  const recentFeatures = recent
    .map((title) => FEATURES.find((x) => x.title === title))
    .filter((f): f is Feature => !!f);

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
        icon: f.emoji,
      },
    });
  };

  const handleOpenQuickAccess = (item: QuickAccessItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(item.href);
  };

  const browsing = !search;

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      {/* HEADER */}
      <Text
        style={[styles.title, { color: theme.text }]}
        accessibilityRole="header"
      >
        Explore
      </Text>
      <Text style={[styles.subtitle, { color: theme.muted }]}>
        Tools, guides and AI features for flippers
      </Text>

      {/* SEARCH */}
      <View
        style={[
          styles.search,
          { backgroundColor: theme.card, borderColor: theme.hairline },
        ]}
      >
        <MagnifyingGlass size={20} color={theme.muted} />
        <TextInput
          placeholder="Search tools, features, guides..."
          placeholderTextColor={theme.muted}
          value={search}
          onChangeText={setSearch}
          accessibilityLabel="Search tools, features and guides"
          selectionColor={theme.gold}
          style={[styles.searchInput, { color: theme.text }]}
        />
        {search.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => setSearch("")}
            style={({ pressed }) => [
              styles.clearButton,
              pressed && styles.pressed,
            ]}
          >
            <XCircle size={20} weight="fill" color={theme.muted} />
          </Pressable>
        ) : null}
      </View>

      {/* QUICK ACCESS */}
      {browsing ? (
        <>
          <SectionTitle>Quick access</SectionTitle>
          <View style={styles.tileGrid}>
            {QUICK_ACCESS_ROWS.map((pair) => (
              <View key={pair[0].title} style={styles.tileRow}>
                {pair.map((item) => (
                  <QuickTile
                    key={item.title}
                    item={item}
                    onOpen={handleOpenQuickAccess}
                  />
                ))}
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* WHAT'S NEW */}
      {browsing ? (
        <>
          <SectionTitle>What’s new</SectionTitle>
          <FeatureGroup
            features={FEATURES.slice(0, 1)}
            onOpen={handleOpenFeature}
          />
        </>
      ) : null}

      {/* SUGGESTED FOR YOU */}
      {browsing ? (
        <>
          <SectionTitle>Suggested for you</SectionTitle>
          <FeatureGroup features={smartSuggestions} onOpen={handleOpenFeature} />
        </>
      ) : null}

      {/* RECENTLY VIEWED */}
      {browsing && recentFeatures.length > 0 ? (
        <>
          <SectionTitle>Recently viewed</SectionTitle>
          <FeatureGroup features={recentFeatures} onOpen={handleOpenFeature} />
        </>
      ) : null}

      {/* GROUPED SECTIONS */}
      {Object.keys(grouped).map((category) => (
        <View key={category}>
          <SectionTitle>{CATEGORY_LABELS[category] ?? category}</SectionTitle>
          <FeatureGroup features={grouped[category]} onOpen={handleOpenFeature} />
        </View>
      ))}

      {/* NO RESULTS */}
      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: theme.card, borderColor: theme.hairline },
            ]}
          >
            <MagnifyingGlass size={28} color={theme.muted} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            No matches
          </Text>
          <Text style={[styles.emptyBody, { color: theme.muted }]}>
            {`Nothing matched "${search.trim()}". Try a shorter word, or clear the search to browse everything.`}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40 },

  title: { fontSize: 28, fontWeight: "700" },
  subtitle: { fontSize: 14, marginTop: 2 },

  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    marginTop: 20,
    paddingLeft: 14,
    paddingRight: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    alignSelf: "stretch",
    fontSize: 16,
    paddingVertical: 0,
    paddingRight: 10,
  },
  clearButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 28,
    marginBottom: 10,
  },

  tileGrid: { gap: 12 },
  tileRow: { flexDirection: "row", gap: 12 },
  tile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  tileTitle: { fontSize: 16, fontWeight: "600" },
  tileDesc: { fontSize: 13, lineHeight: 18, marginTop: 2 },

  iconCircle: { alignItems: "center", justifyContent: "center" },

  group: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  row: {
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowDesc: { fontSize: 13, marginTop: 2 },

  proBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  proBadgeText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },

  empty: { alignItems: "center", paddingTop: 40, paddingHorizontal: 24 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
  },

  pressed: { opacity: 0.7 },
});
