import type { PurchasesOfferings } from "react-native-purchases";

import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Check, Info, Minus } from "phosphor-react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSubscription } from "../src/context/SubscriptionContext";
import { useTheme } from "@/styles/ThemeContext";

type TierId = "free" | "boltOn" | "pro";

type Tier = {
  id: TierId;
  name: string;
  tagline: string;
  price: string;
  period: string;
  badge?: string;
  included: string[];
  notIncluded?: string[];
};

// The prices and claims shown on this screen are written out here; a real
// purchase always uses the matching RevenueCat package (see boltOnPackage /
// proPackage below) — Free never purchases anything.
const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Browse everything, try it out",
    price: "£0",
    period: "forever",
    included: ["Browse the Marketplace and every screen", "5 AI lookups a week", "See vehicle listings"],
    notIncluded: ["Sell on the Marketplace", "List a vehicle"],
  },
  {
    id: "boltOn",
    name: "Bolt-on",
    tagline: "For the occasional flip",
    price: "£2.99",
    period: "month",
    included: ["200 AI lookups a month", "Sell up to 5 items on the Marketplace", "Everything in Free"],
    notIncluded: ["List a vehicle"],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Full use — built for trading",
    price: "£6.99",
    period: "month",
    badge: "Best value",
    included: [
      "Unlimited AI lookups",
      "Sell unlimited items on the Marketplace",
      "Export listings straight to eBay",
      "Share listings to Facebook, Gumtree, Vinted & more",
      "2 vehicle listings free",
      "Extra vehicles billed per vehicle",
      "Everything in Bolt-on",
    ],
  },
];

// Feature, Free, Bolt-on, Pro — kept short so four columns fit a phone width.
const COMPARISON: [string, string, string, string][] = [
  ["AI lookups", "5 / week", "200 / month", "Unlimited"],
  ["Sell on Marketplace", "—", "Up to 5 items", "Unlimited"],
  ["Export to eBay", "—", "—", "Included"],
  ["Vehicle listings", "—", "—", "2 free, then billed"],
];

type TierOptionProps = {
  tier: Tier;
  selected: boolean;
  onPress: () => void;
};

// One selectable tier card. The gold outline and the filled tick mark the chosen one.
function TierOption({ tier, selected, onPress }: TierOptionProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${tier.name} plan, ${tier.price} per ${tier.period}${
        tier.badge ? `, ${tier.badge}` : ""
      }`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.plan,
        {
          backgroundColor: theme.card,
          borderColor: selected ? theme.gold : theme.hairline,
        },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.radio,
          selected
            ? { backgroundColor: theme.gold, borderColor: theme.gold }
            : { borderColor: theme.muted },
        ]}
      >
        {selected ? <Check size={14} weight="bold" color={theme.black} /> : null}
      </View>

      <View style={styles.planMain}>
        <View style={styles.planNameRow}>
          <Text style={[styles.planName, { color: theme.text }]}>{tier.name}</Text>
          {tier.badge ? (
            <View style={[styles.saveChip, { backgroundColor: theme.gold + "24" }]}>
              <Text style={[styles.saveChipText, { color: theme.gold }]}>{tier.badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.planTagline, { color: theme.muted }]} numberOfLines={1}>
          {tier.tagline}
        </Text>
      </View>

      <Text style={[styles.planPrice, { color: theme.text }]}>
        {tier.price}
        {tier.period !== "forever" ? (
          <Text style={[styles.planPeriod, { color: theme.muted }]}> / {tier.period}</Text>
        ) : null}
      </Text>
    </Pressable>
  );
}

export default function UpgradeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // RevenueCat subscription context
  const { offerings, purchase, restore } = useSubscription() as {
    offerings: PurchasesOfferings | null;
    purchase: (pkg: any) => Promise<void>;
    restore: () => Promise<void>;
  };

  const [selected, setSelected] = useState<TierId>("pro");

  // Only "Pro" has a real product in RevenueCat today. Bolt-on's price and
  // features are shown honestly, but it can't be bought until a matching
  // product exists there — this looks for one by identifier rather than
  // assuming it's there, so the button never pretends a purchase happened.
  const proPackage = offerings?.current?.monthly ?? null;
  const boltOnPackage = useMemo(() => {
    const packages = offerings?.current?.availablePackages ?? [];
    return packages.find((p) => p.identifier.toLowerCase().includes("bolt")) ?? null;
  }, [offerings]);

  const tier = TIERS.find((t) => t.id === selected)!;
  const card = { backgroundColor: theme.card, borderColor: theme.hairline };

  const activePackage = selected === "free" ? null : selected === "boltOn" ? boltOnPackage : proPackage;
  const notReadyToBuy = selected !== "free" && !activePackage;

  const handleCta = () => {
    if (selected === "free") {
      router.back();
      return;
    }
    if (!activePackage) {
      Alert.alert(
        `${tier.name} isn't ready yet`,
        "This plan is coming soon — check back shortly."
      );
      return;
    }
    purchase(activePackage);
  };

  const ctaLabel =
    selected === "free" ? "Continue with Free" : `Get ${tier.name}`;
  const ctaSub = selected === "free" ? "No card needed" : `${tier.price} / ${tier.period} · Cancel anytime`;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADLINE */}
        <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
          Choose your plan
        </Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          Start free, add what you need
        </Text>

        {/* TIERS */}
        <View accessibilityRole="radiogroup" style={styles.plans}>
          {TIERS.map((t) => (
            <TierOption key={t.id} tier={t} selected={selected === t.id} onPress={() => setSelected(t.id)} />
          ))}
        </View>

        {/* WHAT'S INCLUDED */}
        <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
          What's in {tier.name}
        </Text>
        <View style={[styles.group, styles.benefits, card]}>
          {tier.included.map((item) => (
            <View key={item} style={styles.benefitRow}>
              <View style={[styles.benefitCheck, { backgroundColor: theme.gold + "1F" }]}>
                <Check size={14} weight="bold" color={theme.gold} />
              </View>
              <Text style={[styles.benefitText, { color: theme.text }]}>{item}</Text>
            </View>
          ))}
          {tier.notIncluded?.map((item) => (
            <View key={item} style={styles.benefitRow}>
              <View style={[styles.benefitCheck, { backgroundColor: theme.muted + "1A" }]}>
                <Minus size={14} weight="bold" color={theme.muted} />
              </View>
              <Text style={[styles.benefitText, { color: theme.muted }]}>{item}</Text>
            </View>
          ))}
        </View>

        {/* COMPARISON */}
        <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
          Compare plans
        </Text>
        <View style={[styles.group, card]}>
          <View
            style={styles.compareHead}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View style={styles.compareLabel} />
            <Text style={[styles.compareHeadText, { color: theme.muted }]}>Free</Text>
            <Text style={[styles.compareHeadText, { color: theme.muted }]}>Bolt-on</Text>
            <Text style={[styles.compareHeadText, { color: theme.text }]}>Pro</Text>
          </View>

          {COMPARISON.map(([label, free, boltOn, pro]) => (
            <View
              key={label}
              accessible
              accessibilityLabel={`${label}. Free: ${free === "—" ? "not included" : free}. Bolt-on: ${
                boltOn === "—" ? "not included" : boltOn
              }. Pro: ${pro}.`}
              style={[styles.compareRow, { borderTopWidth: 1, borderTopColor: theme.hairline }]}
            >
              <Text style={[styles.compareLabel, styles.compareLabelText, { color: theme.text }]}>
                {label}
              </Text>
              <Text style={[styles.compareValue, { color: theme.muted }]}>{free}</Text>
              <Text style={[styles.compareValue, { color: theme.muted }]}>{boltOn}</Text>
              <Text style={[styles.compareValue, styles.compareValuePro, { color: theme.text }]}>
                {pro}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* PURCHASE */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.background,
            borderTopColor: theme.hairline,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        {notReadyToBuy ? (
          <View style={styles.noticeRow} accessibilityLiveRegion="polite">
            <Info size={16} color={theme.muted} />
            <Text style={[styles.noticeText, { color: theme.muted }]}>
              {selected === "boltOn"
                ? "Bolt-on isn't available to buy yet — check back shortly."
                : "Store prices aren't available yet. You can subscribe once they've loaded."}
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${ctaLabel}, ${ctaSub}`}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: theme.gold },
            pressed && styles.pressed,
          ]}
          onPress={handleCta}
        >
          <Text style={[styles.ctaLabel, { color: theme.black }]}>{ctaLabel}</Text>
          <Text style={[styles.ctaSub, { color: theme.black }]}>{ctaSub}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Restore purchases"
          onPress={restore}
          style={({ pressed }) => [styles.restore, pressed && styles.pressed]}
        >
          <Text style={[styles.restoreLabel, { color: theme.text }]}>Restore purchases</Text>
        </Pressable>

        <Text style={[styles.legal, { color: theme.muted }]}>
          Bolt-on and Pro renew automatically until cancelled. You can manage or cancel in your
          device's subscription settings.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },

  /* HEADLINE */
  title: { fontSize: 28, fontWeight: "700" },
  subtitle: { fontSize: 16, marginTop: 4 },

  /* PLANS */
  plans: { marginTop: 24, gap: 12 },
  plan: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  planMain: { flex: 1, gap: 2 },
  planNameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  planName: { fontSize: 16, fontWeight: "600" },
  planTagline: { fontSize: 13 },
  saveChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  saveChipText: { fontSize: 12, fontWeight: "600" },
  planPrice: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  planPeriod: { fontSize: 13, fontWeight: "400" },

  /* SECTIONS */
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 24, marginBottom: 12 },
  group: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },

  /* BENEFITS */
  benefits: { padding: 16, gap: 14 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  benefitCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: { flex: 1, fontSize: 16 },

  /* COMPARISON */
  compareHead: {
    minHeight: 40,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  compareHeadText: { flex: 1, fontSize: 12, fontWeight: "600", textAlign: "center" },
  compareRow: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  compareLabel: { flex: 1.15 },
  compareLabelText: { fontSize: 13 },
  compareValue: { flex: 1, fontSize: 12, textAlign: "center" },
  compareValuePro: { fontWeight: "600" },

  /* PURCHASE */
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  noticeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  noticeText: { flexShrink: 1, fontSize: 13 },
  cta: {
    minHeight: 56,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaLabel: { fontSize: 16, fontWeight: "700" },
  ctaSub: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
    opacity: 0.75,
    fontVariant: ["tabular-nums"],
  },
  restore: {
    minHeight: 44,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  restoreLabel: { fontSize: 15, fontWeight: "600" },
  legal: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },

  pressed: { opacity: 0.75 },
});
