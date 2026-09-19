import type { PurchasesOfferings } from "react-native-purchases";

import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Check, Info } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSubscription } from "../src/context/SubscriptionContext";
import { useTheme } from "@/styles/ThemeContext";

// The prices and claims shown on this screen are written out here; the purchase
// itself always uses the RevenueCat package.
const MONTHLY_PRICE = "£4.99";
const YEARLY_PRICE = "£39.99";
const YEARLY_SAVING = "Save 40%";

const BENEFITS = [
  "Supernova AI Pricing",
  "Advanced Market Intelligence",
  "Unlimited AI Lookups",
  "Pro Flip Detection",
  "Boot Fair Finder Pro",
  "Advertising Hub Access",
  "Priority Feature Access",
  "Premium Themes",
];

// Feature, what Free gets, what Pro gets.
const COMPARISON: [string, string, string][] = [
  ["AI Lookups", "Limited", "Unlimited"],
  ["Market Check", "Basic", "Full Data"],
  ["Profit Engine", "Standard", "Advanced"],
  ["Flip Score", "Basic", "Pro Metrics"],
  ["Boot Fair Finder", "Basic", "Pro Map"],
];

type PlanOptionProps = {
  name: string;
  price: string;
  period: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
};

// One selectable plan. The gold outline and the filled tick mark the chosen one.
function PlanOption({ name, price, period, badge, selected, onPress }: PlanOptionProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${name} plan, ${price} per ${period}${badge ? `, ${badge}` : ""}`}
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
        <Text style={[styles.planName, { color: theme.text }]}>{name}</Text>
        {badge ? (
          <View style={[styles.saveChip, { backgroundColor: theme.success + "24" }]}>
            <Text style={[styles.saveChipText, { color: theme.success }]}>{badge}</Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.planPrice, { color: theme.text }]}>
        {price}
        <Text style={[styles.planPeriod, { color: theme.muted }]}> / {period}</Text>
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

  const [yearly, setYearly] = useState(false);

  const handlePurchase = () => {
    const current = offerings?.current;

    if (!current) return;

    const pkg = yearly ? current.annual : current.monthly;

    if (pkg) purchase(pkg);
  };

  const card = { backgroundColor: theme.card, borderColor: theme.hairline };
  const selectedPrice = yearly ? `${YEARLY_PRICE} / year` : `${MONTHLY_PRICE} / month`;
  const selectedPriceSpoken = yearly ? `${YEARLY_PRICE} per year` : `${MONTHLY_PRICE} per month`;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADLINE */}
        <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
          FlipPilot Pro
        </Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          Unlock your full flipping power
        </Text>

        {/* PLANS */}
        <View accessibilityRole="radiogroup" style={styles.plans}>
          <PlanOption
            name="Monthly"
            price={MONTHLY_PRICE}
            period="month"
            selected={!yearly}
            onPress={() => setYearly(false)}
          />
          <PlanOption
            name="Yearly"
            price={YEARLY_PRICE}
            period="year"
            badge={YEARLY_SAVING}
            selected={yearly}
            onPress={() => setYearly(true)}
          />
        </View>

        {/* BENEFITS */}
        <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
          Everything you unlock
        </Text>
        <View style={[styles.group, styles.benefits, card]}>
          {BENEFITS.map((item) => (
            <View key={item} style={styles.benefitRow}>
              <View style={[styles.benefitCheck, { backgroundColor: theme.gold + "1F" }]}>
                <Check size={14} weight="bold" color={theme.gold} />
              </View>
              <Text style={[styles.benefitText, { color: theme.text }]}>{item}</Text>
            </View>
          ))}
        </View>

        {/* COMPARISON */}
        <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
          Free vs Pro
        </Text>
        <View style={[styles.group, card]}>
          <View
            style={styles.compareHead}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View style={styles.compareLabel} />
            <Text style={[styles.compareHeadText, { color: theme.muted }]}>Free</Text>
            <Text style={[styles.compareHeadText, { color: theme.text }]}>Pro</Text>
          </View>

          {COMPARISON.map(([label, free, pro]) => (
            <View
              key={label}
              accessible
              accessibilityLabel={`${label}. Free: ${free}. Pro: ${pro}.`}
              style={[
                styles.compareRow,
                { borderTopWidth: 1, borderTopColor: theme.hairline },
              ]}
            >
              <Text style={[styles.compareLabel, styles.compareLabelText, { color: theme.text }]}>
                {label}
              </Text>
              <Text style={[styles.compareValue, { color: theme.muted }]}>{free}</Text>
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
        {!offerings?.current ? (
          <View style={styles.noticeRow} accessibilityLiveRegion="polite">
            <Info size={16} color={theme.muted} />
            <Text style={[styles.noticeText, { color: theme.muted }]}>
              Store prices aren't available yet. You can subscribe once they've loaded.
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Unlock FlipPilot Pro, ${selectedPriceSpoken}`}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: theme.gold },
            pressed && styles.pressed,
          ]}
          onPress={handlePurchase}
        >
          <Text style={[styles.ctaLabel, { color: theme.black }]}>Unlock FlipPilot Pro</Text>
          <Text style={[styles.ctaSub, { color: theme.black }]}>
            {selectedPrice} · Cancel anytime
          </Text>
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
          {"7‑day free trial • No commitment • Cancel anytime"}
          {"\n"}
          Subscriptions renew automatically until cancelled. You can manage or cancel in your
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
    minHeight: 64,
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
  planMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  planName: { fontSize: 16, fontWeight: "600" },
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
    gap: 12,
  },
  compareHeadText: { flex: 1, fontSize: 13, fontWeight: "600" },
  compareRow: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  compareLabel: { flex: 1.25 },
  compareLabelText: { fontSize: 14 },
  compareValue: { flex: 1, fontSize: 14 },
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
