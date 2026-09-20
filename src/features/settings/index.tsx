import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { CaretRight, CreditCard, Crown, Info, Star } from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSubscription } from "@/context/SubscriptionContext";
import { useTheme } from "@/styles/ThemeContext";

/* SMALL LOCAL COMPONENTS */
function SectionTitle({ children }: { children: string }) {
  const theme = useTheme();

  return (
    <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
      {children}
    </Text>
  );
}

function RowIcon({ Icon, tint }: { Icon: PhosphorIcon; tint?: string }) {
  const theme = useTheme();

  return (
    <View style={[styles.rowIcon, { backgroundColor: theme.background }]}>
      <Icon size={22} color={tint ?? theme.text} />
    </View>
  );
}

// A tappable row with an icon, a title, a second line and a chevron.
function MenuRow({
  Icon,
  title,
  subtitle,
  onPress,
  divider,
}: {
  Icon: PhosphorIcon;
  title: string;
  subtitle: string;
  onPress: () => void;
  divider?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        divider && { borderTopWidth: 1, borderTopColor: theme.hairline },
        pressed && styles.pressed,
      ]}
    >
      <RowIcon Icon={Icon} />

      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.rowSubtitle, { color: theme.muted }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>

      <CaretRight size={16} color={theme.muted} />
    </Pressable>
  );
}

// A row that only shows information, so it is not tappable and has no chevron.
function InfoRow({
  Icon,
  title,
  subtitle,
  tint,
  divider,
}: {
  Icon: PhosphorIcon;
  title: string;
  subtitle: string;
  tint?: string;
  divider?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${subtitle}`}
      style={[styles.row, divider && { borderTopWidth: 1, borderTopColor: theme.hairline }]}
    >
      <RowIcon Icon={Icon} tint={tint} />

      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.rowSubtitle, { color: theme.muted }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // The purchase state, not the theme (which is never switched to "pro").
  const { isPro } = useSubscription();

  const card = { backgroundColor: theme.card, borderColor: theme.hairline };

  // Only show what the build actually knows. The build number is not set in
  // app.json yet, so it appears once one is configured.
  const version = Constants.expoConfig?.version;
  const build = Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode;
  const versionText = version
    ? build != null
      ? `Version ${version} (${build})`
      : `Version ${version}`
    : "FlipPilot";

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        {/* YOUR PLAN */}
        <SectionTitle>Your plan</SectionTitle>
        <View style={[styles.group, card]}>
          <InfoRow
            Icon={Crown}
            tint={isPro ? theme.gold : undefined}
            title={isPro ? "FlipPilot Pro" : "Free plan"}
            subtitle={
              isPro
                ? "You have full access to every FlipPilot tool"
                : "Upgrade to unlock the full set of FlipPilot tools"
            }
          />
          {isPro ? (
            <MenuRow
              Icon={CreditCard}
              title="Manage subscription"
              subtitle="Update, cancel or change your plan"
              onPress={() => router.push("/manage-subscription")}
              divider
            />
          ) : (
            <MenuRow
              Icon={Crown}
              title="Upgrade to Pro"
              subtitle="See what Pro includes"
              onPress={() => router.push("/upgrade")}
              divider
            />
          )}
        </View>

        {/* HELP US IMPROVE */}
        <SectionTitle>Help us improve</SectionTitle>
        <View style={[styles.group, card]}>
          <MenuRow
            Icon={Star}
            title="Rate FlipPilot"
            subtitle="Tell us what you think of the app"
            onPress={() => router.push("/rate")}
          />
        </View>

        {/* ABOUT */}
        <SectionTitle>About</SectionTitle>
        <View style={[styles.group, card]}>
          <InfoRow Icon={Info} title="FlipPilot" subtitle={versionText} />
        </View>

        <Text style={[styles.caption, { color: theme.muted }]}>
          Your flips, favourites and boot fairs are stored on this phone.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4 },

  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 24, marginBottom: 12 },

  group: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  row: {
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowSubtitle: { fontSize: 13, lineHeight: 18, marginTop: 2 },

  caption: { fontSize: 13, lineHeight: 18, marginTop: 16, paddingHorizontal: 4 },

  pressed: { opacity: 0.7 },
});
