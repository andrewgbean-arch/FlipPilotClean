import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import {
  Barcode,
  Car,
  Crown,
  FloppyDisk,
  PencilSimple,
  Sliders,
  Storefront,
  Tent,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/styles/ThemeContext";

type Section = {
  Icon: PhosphorIcon;
  title: string;
  steps: string[];
};

// Real, step-by-step instructions for what the app actually does today — not
// the short teaser blurbs on Explore's "Guides" cards.
const SECTIONS: Section[] = [
  {
    Icon: Barcode,
    title: "Scan an item",
    steps: [
      "Open the Scan tab and point your camera at a barcode, or tap \"Scan photo\" to identify anything without one.",
      "The result opens in about a second with what FlipPilot thinks it is, while it checks prices in the background.",
      "\"Checking prices…\" turns into a full price guide — what it's worth new, and what to pay and charge for a used one.",
    ],
  },
  {
    Icon: PencilSimple,
    title: "Fix a wrong guess",
    steps: [
      "AI guesses can be too vague to price well (\"White Bluetooth Speaker\" instead of the actual model).",
      "On the results screen, tap the pencil next to the item's name to type in a better one.",
      "FlipPilot re-checks the price straight away with the corrected name.",
    ],
  },
  {
    Icon: Sliders,
    title: "Set Condition and Age",
    steps: [
      "For a photo scan of a used item, two boxes appear: Condition (perfect, good, poor, or not working) and Age.",
      "These matter — a used item's price is worked out from the new price, scaled down by how worn and how old it is.",
      "A barcode scan skips this, since a barcode is always priced as new.",
    ],
  },
  {
    Icon: FloppyDisk,
    title: "Save and track your flips",
    steps: [
      "Tap Save Flip on the results screen to add it to History.",
      "History shows your total flips, profit and average flip score.",
      "Tap the star on any item to add it to Favourites for quick access later.",
    ],
  },
  {
    Icon: Storefront,
    title: "Sell on the Marketplace",
    steps: [
      "Anyone can browse the Marketplace for free, on any plan.",
      "To list something for sale yourself, you'll need Bolt-on or Pro — Free is browse-only.",
      "Buyers message you straight from your listing to arrange a sale.",
    ],
  },
  {
    Icon: Car,
    title: "Add a vehicle",
    steps: [
      "In the Vehicles Hub, look up any UK vehicle by registration for its MOT and DVLA details.",
      "Your first 2 vehicle listings are free on Pro.",
      "List more than that and each extra one is billed — either one at a time, or as a discounted block for higher-volume traders.",
    ],
  },
  {
    Icon: Tent,
    title: "Find boot fairs",
    steps: [
      "Explore > Boot Fairs shows local fairs near you, with dates and times.",
      "Good for planning where to source your next flip.",
    ],
  },
  {
    Icon: Crown,
    title: "Choose your plan",
    steps: [
      "Free: browse everything, 5 AI lookups a week, can't sell yet.",
      "Bolt-on (£2.99/month): 200 lookups a month and up to 5 Marketplace listings.",
      "Pro (£6.99/month): unlimited lookups and selling, plus 2 free vehicle listings.",
    ],
  },
];

function SectionCard({ section }: { section: Section }) {
  const theme = useTheme();
  const { Icon, title, steps } = section;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconCircle, { backgroundColor: theme.gold + "1F" }]}>
          <Icon size={20} color={theme.gold} />
        </View>
        <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
      </View>

      {steps.map((step, i) => (
        <View key={step} style={styles.stepRow}>
          <View style={[styles.stepNumber, { backgroundColor: theme.background }]}>
            <Text style={[styles.stepNumberText, { color: theme.muted }]}>{i + 1}</Text>
          </View>
          <Text style={[styles.stepText, { color: theme.muted }]}>{step}</Text>
        </View>
      ))}
    </View>
  );
}

export default function HelpScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
          How to use FlipPilot
        </Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          A quick guide to scanning, pricing and selling
        </Text>

        {SECTIONS.map((section) => (
          <SectionCard key={section.title} section={section} />
        ))}

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: theme.gold },
            pressed && styles.pressed,
          ]}
          onPress={() => router.push("/scan")}
        >
          <Text style={[styles.ctaLabel, { color: theme.black }]}>Start scanning</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.secondaryLink, pressed && styles.pressed]}
          onPress={() => router.push("/upgrade")}
        >
          <Text style={[styles.secondaryLinkLabel, { color: theme.text }]}>See plans and pricing</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16 },

  title: { fontSize: 28, fontWeight: "700" },
  subtitle: { fontSize: 16, marginTop: 4, marginBottom: 20 },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 17, fontWeight: "700", flex: 1 },

  stepRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  stepNumberText: { fontSize: 11, fontWeight: "700" },
  stepText: { flex: 1, fontSize: 14, lineHeight: 20 },

  cta: {
    minHeight: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  ctaLabel: { fontSize: 16, fontWeight: "700" },

  secondaryLink: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 4 },
  secondaryLinkLabel: { fontSize: 15, fontWeight: "600" },

  pressed: { opacity: 0.75 },
});
