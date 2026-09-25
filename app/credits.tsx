import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSubscription } from "@/context/SubscriptionContext";
import { useAccount } from "@/lib/account";
import { claimCredits, fetchScanAllowance, type ScanAllowance } from "@/lib/credits";
import { useTheme } from "@/styles/useTheme";

/**
 * Scan credits: what you have, and packs to buy more. The store takes the payment; the server then
 * asks RevenueCat what the account has bought and adds the credits (see POST /credits/claim), so a
 * purchase that is interrupted halfway is picked up the next time this screen opens.
 */
export default function CreditsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const { offerings, purchaseProduct, available, busy } = useSubscription();

  const [allowance, setAllowance] = useState<ScanAllowance | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setAllowance(await fetchScanAllowance());
  }, []);

  // Each time the screen is shown: pick up anything bought but not yet added, then show the balance.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        if (account.email) {
          const result = await claimCredits();
          if (live && result.ok && result.granted > 0) setNotice(`${result.granted} scan credits added.`);
        }
        if (live) await refresh();
      })();
      return () => {
        live = false;
      };
    }, [account.email, refresh])
  );

  // The packs the server is selling, matched to what the store is offering, with the store's own price.
  const packs = useMemo(() => {
    const storePackages = Object.values(offerings?.all ?? {}).flatMap((o: any) => o.availablePackages ?? []);
    return (allowance?.packs ?? []).map((pack) => ({
      ...pack,
      pkg: storePackages.find((p: any) => {
        const id: string = p?.product?.identifier ?? "";
        return id === pack.productId || id.startsWith(`${pack.productId}:`);
      }),
    }));
  }, [allowance?.packs, offerings]);

  const buy = async (pack: (typeof packs)[number]) => {
    if (!account.email) {
      router.push("/sign-in");
      return;
    }
    if (!pack.pkg || busy || claiming) return;

    const result = await purchaseProduct(pack.pkg);
    if (!result.success) return;

    // Paid. Now have the server add the credits: it asks RevenueCat itself, it does not take our word.
    setClaiming(true);
    let claim = await claimCredits();
    if (!claim.ok) {
      // RevenueCat can be a moment behind the store; one more try before giving up for now.
      await new Promise((r) => setTimeout(r, 2500));
      claim = await claimCredits();
    }
    setClaiming(false);
    await refresh();

    if (claim.ok && claim.granted > 0) {
      setNotice(`${claim.granted} scan credits added.`);
    } else {
      Alert.alert(
        "Your purchase went through",
        "We're still adding your credits. They'll appear when you next open this screen; there's no need to buy again."
      );
    }
  };

  const perScan = (pkg: any, credits: number) => {
    const price = Number(pkg?.product?.price);
    if (!Number.isFinite(price) || price <= 0) return null;
    return pkg.product.currencyCode === "GBP"
      ? `${((price / credits) * 100).toFixed(1)}p a scan`
      : `${(price / credits).toFixed(3)} ${pkg.product.currencyCode} a scan`;
  };

  const anyForSale = packs.some((p) => p.pkg);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
    >
      {/* What you have */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
        <Text style={[styles.label, { color: theme.muted }]}>Scan credits</Text>
        <Text style={[styles.big, { color: theme.gold }]} accessibilityLabel={`${allowance?.credits ?? 0} scan credits`}>
          {account.email ? allowance?.credits ?? "–" : "–"}
        </Text>
        {allowance ? (
          <Text style={[styles.body, { color: theme.text }]}>
            {allowance.freeLeft} of {allowance.freeLimit} free scans left this week
          </Text>
        ) : null}
        <Text style={[styles.small, { color: theme.muted }]}>
          Free scans are used first, and come back every Monday. A scan that finds nothing costs nothing.
        </Text>
        {notice ? (
          <Text style={[styles.notice, { color: theme.gold }]} accessibilityRole="alert">
            {notice}
          </Text>
        ) : null}
      </View>

      {!account.email ? (
        <Pressable
          onPress={() => router.push("/sign-in")}
          accessibilityRole="button"
          style={[styles.signIn, { borderColor: theme.gold }]}
        >
          <Text style={[styles.signInText, { color: theme.gold }]}>Sign in to buy or use scan credits</Text>
        </Pressable>
      ) : null}

      {/* Packs */}
      <Text style={[styles.heading, { color: theme.text }]} accessibilityRole="header">
        Buy more scans
      </Text>

      {!available ? (
        <Text style={[styles.small, { color: theme.muted }]}>Buying credits works in the FlipPilot app on your phone.</Text>
      ) : !allowance ? (
        <ActivityIndicator color={theme.gold} />
      ) : !anyForSale ? (
        <Text style={[styles.small, { color: theme.muted }]}>Credit packs aren't available to buy just yet. Check back soon.</Text>
      ) : null}

      {packs.map((pack) => (
        <View key={pack.productId} style={[styles.pack, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.packTitle, { color: theme.text }]}>{pack.credits} scans</Text>
            {pack.pkg ? (
              <Text style={[styles.small, { color: theme.muted }]}>{perScan(pack.pkg, pack.credits)}</Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => buy(pack)}
            disabled={!pack.pkg || busy || claiming}
            accessibilityRole="button"
            accessibilityLabel={`Buy ${pack.credits} scans${pack.pkg ? ` for ${pack.pkg.product.priceString}` : ""}`}
            style={[styles.buy, { backgroundColor: theme.gold, opacity: !pack.pkg || busy || claiming ? 0.45 : 1 }]}
          >
            {busy || claiming ? (
              <ActivityIndicator color="#111" />
            ) : (
              <Text style={styles.buyText}>{pack.pkg ? pack.pkg.product.priceString : "Soon"}</Text>
            )}
          </Pressable>
        </View>
      ))}

      <Text style={[styles.small, { color: theme.muted }]}>
        Credits never expire and can't be transferred to another account. They are removed if you delete your account.
        Payment is taken by the App Store or Google Play.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  card: { borderWidth: 1, borderRadius: 16, padding: 18, gap: 6, alignItems: "center" },
  label: { fontSize: 14, fontWeight: "600" },
  big: { fontSize: 56, fontWeight: "800", lineHeight: 64 },
  body: { fontSize: 16, fontWeight: "600" },
  small: { fontSize: 13, lineHeight: 19 },
  notice: { fontSize: 15, fontWeight: "700", marginTop: 4 },
  heading: { fontSize: 20, fontWeight: "700", marginTop: 8 },
  signIn: { borderWidth: 1, borderRadius: 14, minHeight: 50, alignItems: "center", justifyContent: "center" },
  signInText: { fontSize: 16, fontWeight: "700" },
  pack: { borderWidth: 1, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  packTitle: { fontSize: 18, fontWeight: "700" },
  buy: { minWidth: 92, minHeight: 46, borderRadius: 12, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  buyText: { color: "#111", fontSize: 16, fontWeight: "800" },
});
