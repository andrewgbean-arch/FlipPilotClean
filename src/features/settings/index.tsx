import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import {
  BookOpen,
  CaretRight,
  CreditCard,
  Crown,
  Export,
  Info,
  Star,
  Storefront,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSubscription } from "@/context/SubscriptionContext";
import { useTheme } from "@/styles/ThemeContext";
import { connectEbay, disconnectEbay, getEbayStatus } from "@/utils/ebayExport";
import { getDeviceId } from "@/utils/deviceId";
import { getSellerName, setSellerName, SELLER_NAME_MAX } from "@/utils/sellerName";

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

  const [ebayConnected, setEbayConnected] = useState(false);
  const [ebayConfigured, setEbayConfigured] = useState(true);
  const [ebayBusy, setEbayBusy] = useState(false);

  const [sellerName, setName] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    getEbayStatus()
      .then(({ connected, configured }) => {
        setEbayConnected(connected);
        setEbayConfigured(configured);
      })
      .catch(() => {});

    getSellerName().then(setName).catch(() => {});
    getDeviceId().then(setDeviceId).catch(() => {});
  }, []);

  const saveName = async () => {
    await setSellerName(nameDraft);
    setName(await getSellerName());
    setEditingName(false);
  };

  // No clipboard in this build, so sharing it is how you get the id off the
  // phone and into the server's settings.
  const shareDeviceId = () => {
    if (!deviceId) return;
    Share.share({ message: deviceId, title: "FlipPilot device ID" }).catch(() => {});
  };

  const handleEbayRow = async () => {
    if (!ebayConfigured) {
      Alert.alert("Not set up yet", "eBay export isn't available in this build yet.");
      return;
    }
    if (ebayBusy) return;

    if (ebayConnected) {
      Alert.alert("Disconnect eBay?", "FlipPilot will no longer be able to export listings to your eBay account.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            setEbayBusy(true);
            await disconnectEbay();
            setEbayConnected(false);
            setEbayBusy(false);
          },
        },
      ]);
      return;
    }

    setEbayBusy(true);
    const result = await connectEbay();
    setEbayBusy(false);
    if (result.ok) {
      setEbayConnected(true);
    } else if (result.message) {
      Alert.alert("Couldn't connect eBay", result.message);
    }
  };

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

        {/* SELLING */}
        <SectionTitle>Selling</SectionTitle>
        <View style={[styles.group, card]}>
          <MenuRow
            Icon={Storefront}
            title={sellerName ? `Selling as ${sellerName}` : "Your seller name"}
            subtitle={
              sellerName
                ? "What buyers see on your listings"
                : "Buyers see a name instead of just “Seller”"
            }
            onPress={() => {
              setNameDraft(sellerName ?? "");
              setEditingName(true);
            }}
          />

          <MenuRow
            Icon={Export}
            title={ebayConnected ? "eBay connected" : "Connect eBay account"}
            subtitle={
              ebayConnected
                ? "Export your listings straight to eBay"
                : "Sign in to export your listings to eBay"
            }
            onPress={handleEbayRow}
            divider
          />
        </View>

        {/* HELP & GUIDES */}
        <SectionTitle>Help & guides</SectionTitle>
        <View style={[styles.group, card]}>
          <MenuRow
            Icon={BookOpen}
            title="How to use FlipPilot"
            subtitle="Scanning, pricing, selling and plans"
            onPress={() => router.push("/help")}
          />
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

          {/* Needed when a test phone has to be let through the selling gate. */}
          {deviceId && (
            <MenuRow
              Icon={Info}
              title="Device ID"
              subtitle={`${deviceId} — tap to share it`}
              onPress={shareDeviceId}
              divider
            />
          )}
        </View>

        <Text style={[styles.caption, { color: theme.muted }]}>
          Your flips, favourites and boot fairs are stored on this phone.
        </Text>
      </ScrollView>

      {/* SELLER NAME */}
      <Modal
        visible={editingName}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingName(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, card]}>
            <Text style={[styles.rowTitle, { color: theme.text, fontSize: 18 }]}>
              Your seller name
            </Text>
            <Text style={[styles.rowSubtitle, { color: theme.muted, marginBottom: 12 }]}>
              Buyers see this on your listings. Leave it empty to go back to just
              &ldquo;Seller&rdquo;.
            </Text>

            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              maxLength={SELLER_NAME_MAX}
              autoFocus
              placeholder="e.g. Bean Motors"
              placeholderTextColor={theme.muted}
              style={{
                backgroundColor: theme.background,
                color: theme.text,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.hairline,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 16,
              }}
            />

            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setEditingName(false)}
                style={({ pressed }) => [
                  styles.modalButton,
                  { borderColor: theme.muted, borderWidth: 1 },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={{ color: theme.text, fontWeight: "600" }}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={saveName}
                style={({ pressed }) => [
                  styles.modalButton,
                  { backgroundColor: theme.gold },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={{ color: theme.black, fontWeight: "800" }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  modalButtons: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  pressed: { opacity: 0.7 },
});
