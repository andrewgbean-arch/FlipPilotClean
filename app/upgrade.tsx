import type { PurchasesOfferings } from "react-native-purchases";

import GoldFoil from "@/components/ui/GoldFoil";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Check, Info } from "phosphor-react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSubscription } from "../src/context/SubscriptionContext";
import { useTheme } from "@/styles/ThemeContext";

type TierId = "free" | "credits" | "trader";

// A plain string is a checked benefit; { heading } is a small section label with no checkmark.
type IncludedItem = string | { heading: string };

type Tier = {
  id: TierId;
  name: string;
  tagline: string;
  price: string;
  period: string;
  badge?: string;
  included: IncludedItem[];
};

// How FlipPilot is paid for (owner's choice, 2026-09-27): free scans every week, then either
// pay-as-you-go credit packs or the Trader plan. The prices here are written out; a real purchase
// always uses the matching store product (credit packs on the Scan credits screen, Trader below).
const TRADER_SCANS = 300;
const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    tagline: "5 scans every week with a free account",
    price: "£0",
    period: "forever",
    included: [
      "5 scans every week, back each Monday (2 a week until you sign in)",
      "Buy and sell on the Marketplace (free during our launch)",
      "Boot fairs, MOT checks, guides and games",
    ],
  },
  {
    id: "credits",
    name: "Scan credit packs",
    tagline: "Pay as you go · never expire",
    price: "from £0.99",
    period: "one-off",
    included: [
      "25, 50, 100 or 200 scans, from £0.99",
      "Used only after your free scans run out",
      "Never expire, no subscription",
      "Also pay for a car listing after our launch offer",
    ],
  },
  {
    id: "trader",
    name: "Trader",
    tagline: "For regular buying and selling",
    price: "£9.99",
    period: "month",
    badge: "Best value",
    included: [
      `${TRADER_SCANS} scans every month, on top of your 5 free a week`,
      "Export your listings straight to eBay",
      "Everything in Free",
      "Cancel any time in your phone's settings",
    ],
  },
];

// Feature, Free, Credits, Trader — kept short so four columns fit a phone width.
const COMPARISON: [string, string, string, string][] = [
  ["Scans", "5 a week", "Buy as needed", `${TRADER_SCANS} a month + 5 a week`],
  ["Cost", "£0", "From £0.99", "£9.99 a month"],
  ["Export to eBay", "—", "—", "Included"],
];

type TierOptionProps = {
  tier: Tier;
  selected: boolean;
  onPress: () => void;
};

// One selectable option card. The gold outline and the filled tick mark the chosen one.
function TierOption({ tier, selected, onPress }: TierOptionProps) {
  const theme = useTheme();
  const priceLabel = tier.period === "month" ? `${tier.price} per month` : tier.price;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${tier.name}, ${priceLabel}${tier.badge ? `, ${tier.badge}` : ""}`}
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
        {tier.period === "month" ? (
          <Text style={[styles.planPeriod, { color: theme.muted }]}> / month</Text>
        ) : null}
      </Text>
    </Pressable>
  );
}

export default function UpgradeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { offerings, purchase, restore, isPro } = useSubscription() as {
    offerings: PurchasesOfferings | null;
    purchase: (pkg: any) => Promise<void>;
    restore: () => Promise<void>;
    isPro: boolean;
  };

  const [selected, setSelected] = useState<TierId>("trader");

  // The Trader plan's store product (flippilot_trader_monthly), found by name rather than assumed,
  // so the button never pretends a purchase happened when the store hasn't offered it yet.
  const packages = offerings?.current?.availablePackages ?? [];
  const traderPackage =
    packages.find((p) => p.product.identifier === "flippilot_trader_monthly") ??
    packages.find((p) => p.identifier.toLowerCase().includes("trader")) ??
    offerings?.current?.monthly ??
    null;

  const tier = TIERS.find((t) => t.id === selected)!;
  const card = { backgroundColor: theme.card, borderColor: theme.hairline };
  const notReadyToBuy = selected === "trader" && !traderPackage && !isPro;

  const handleCta = () => {
    if (selected === "free") {
      router.back();
      return;
    }
    if (selected === "credits") {
      router.push("/credits");
      return;
    }
    if (isPro) {
      router.push("/manage-subscription");
      return;
    }
    if (!traderPackage) {
      Alert.alert("Trader isn't ready yet", "The Trader plan will be here shortly. Credit packs work in the meantime.");
      return;
    }
    purchase(traderPackage);
  };

  const ctaLabel =
    selected === "free"
      ? "Carry on with Free"
      : selected === "credits"
        ? "See credit packs"
        : isPro
          ? "Manage your Trader plan"
          : "Get Trader";
  const ctaSub =
    selected === "free"
      ? "No card needed"
      : selected === "credits"
        ? "Pay once · credits never expire"
        : isPro
          ? "You're on Trader"
          : `${traderPackage ? traderPackage.product.priceString : "£9.99"} a month · Cancel any time`;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADLINE */}
        <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
          More scans
        </Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          5 free every week with a free account. Need more? Pay as you go, or go Trader.
        </Text>

        {/* OPTIONS */}
        <View accessibilityRole="radiogroup" style={styles.plans}>
          {TIERS.map((t) => (
            <TierOption key={t.id} tier={t} selected={selected === t.id} onPress={() => setSelected(t.id)} />
          ))}
        </View>

        {/* WHAT'S INCLUDED */}
        <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
          {tier.id === "credits" ? "How credit packs work" : `What's in ${tier.name}`}
        </Text>
        <View style={[styles.group, styles.benefits, card]}>
          {tier.included.map((item, i) =>
            typeof item === "string" ? (
              <View key={item} style={styles.benefitRow}>
                <View style={[styles.benefitCheck, { backgroundColor: theme.gold + "1F" }]}>
                  <Check size={14} weight="bold" color={theme.gold} />
                </View>
                <Text style={[styles.benefitText, { color: theme.text }]}>{item}</Text>
              </View>
            ) : (
              <Text
                key={`heading-${i}-${item.heading}`}
                style={[styles.benefitGroupLabel, { color: theme.muted }, i > 0 && styles.benefitGroupLabelSpaced]}
              >
                {item.heading}
              </Text>
            )
          )}
        </View>

        {/* COMPARISON */}
        <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
          Side by side
        </Text>
        <View style={[styles.group, card]}>
          <View
            style={styles.compareHead}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View style={styles.compareLabel} />
            <Text style={[styles.compareHeadText, { color: theme.muted }]}>Free</Text>
            <Text style={[styles.compareHeadText, { color: theme.muted }]}>Credits</Text>
            <Text style={[styles.compareHeadText, { color: theme.text }]}>Trader</Text>
          </View>

          {COMPARISON.map(([label, free, credits, trader]) => (
            <View
              key={label}
              accessible
              accessibilityLabel={`${label}. Free: ${free === "—" ? "not included" : free}. Credit packs: ${
                credits === "—" ? "not included" : credits
              }. Trader: ${trader === "—" ? "not included" : trader}.`}
              style={[styles.compareRow, { borderTopWidth: 1, borderTopColor: theme.hairline }]}
            >
              <Text style={[styles.compareLabel, styles.compareLabelText, { color: theme.text }]}>
                {label}
              </Text>
              <Text style={[styles.compareValue, { color: theme.muted }]}>{free}</Text>
              <Text style={[styles.compareValue, { color: theme.muted }]}>{credits}</Text>
              <Text style={[styles.compareValue, styles.compareValuePro, { color: theme.text }]}>
                {trader}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ACTION */}
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
              {"Store prices aren't available yet. You can subscribe once they've loaded."}
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${ctaLabel}, ${ctaSub}`}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: theme.gold, overflow: "hidden" },
            pressed && styles.pressed,
          ]}
          onPress={handleCta}
        >
          <GoldFoil />
          <Text style={[styles.ctaLabel, { color: theme.black }]}>{ctaLabel}</Text>
          <Text style={[styles.ctaSub, { color: theme.black }]}>{ctaSub}</Text>
        </Pressable>

        {selected === "trader" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Restore purchases"
            onPress={restore}
            style={({ pressed }) => [styles.restore, pressed && styles.pressed]}
          >
            <Text style={[styles.restoreLabel, { color: theme.text }]}>Restore purchases</Text>
          </Pressable>
        ) : null}

        <Text style={[styles.legal, { color: theme.muted }]}>
          {"Trader renews monthly until cancelled; manage or cancel it in your phone's subscription settings. Credit packs are one-off purchases and never expire."}
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
  benefitGroupLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  benefitGroupLabelSpaced: { marginTop: 6 },

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
