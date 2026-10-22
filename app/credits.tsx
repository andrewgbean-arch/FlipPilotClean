import { useCallback, useMemo, useState } from "react";
import GoldFoil from "@/components/ui/GoldFoil";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSubscription } from "@/context/SubscriptionContext";
import { useAccount } from "@/lib/account";
import { claimCredits, fetchScanAllowance, type ScanAllowance } from "@/lib/credits";
import { PRO_PRICE, dateInWords } from "@/lib/scanAllowance";
import { useTheme } from "@/styles/useTheme";

/**
 * Your scans: the free scans left this month, whether you are on Pro, and any scan credits held from before the packs were
 * retired (they are used after the free scans, and also pay for boosts and Nightglass chapters). Packs to buy more appear here
 * only if the server is offering them. The store takes the payment; the server then asks RevenueCat what the account has bought
 * and adds the credits (see POST /credits/claim), so a purchase that is interrupted halfway is picked up the next time this
 * screen opens.
 */
export default function CreditsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const { offerings, purchaseProduct, available, busy, isPro } = useSubscription();

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

  // The packs the server is selling (none, unless it brings them back), matched to what the store is offering, with the store's own price.
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

  const onPro = isPro || !!allowance?.pro;
  const signedOut = !account.email;
  const resets = dateInWords(allowance?.resetsOn);
  const renews = dateInWords(allowance?.proRenewsOn);
  const credits = allowance?.credits ?? 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
    >
      {/* What you have */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
        {!allowance ? (
          <ActivityIndicator color={theme.gold} />
        ) : onPro ? (
          <>
            <Text style={[styles.label, { color: theme.muted }]}>FlipPilot Pro</Text>
            <Text style={[styles.big, { color: theme.gold }]}>Pro</Text>
            <Text style={[styles.body, { color: theme.text }]}>Unlimited scans (up to {allowance.proDailyLimit} a day)</Text>
            <Text style={[styles.small, { color: theme.muted, textAlign: "center" }]}>
              {renews ? `Renews on ${renews}. ` : ""}Your free scans are used first. A scan that finds nothing costs nothing.
            </Text>
          </>
        ) : signedOut ? (
          <>
            <Text style={[styles.label, { color: theme.muted }]}>Free scans</Text>
            <Text style={[styles.big, { color: theme.gold }]}>–</Text>
            <Text style={[styles.body, { color: theme.text }]}>Sign in to start scanning</Text>
            <Text style={[styles.small, { color: theme.muted, textAlign: "center" }]}>
              {`It's free: we email you a six-digit code (no password), and you get ${allowance.signedInFreeLimit} free scans a month.`}
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.label, { color: theme.muted }]}>Free scans this month</Text>
            <Text style={[styles.big, { color: theme.gold }]} accessibilityLabel={`${allowance.freeLeft} free scans left`}>
              {allowance.freeLeft}
            </Text>
            <Text style={[styles.body, { color: theme.text }]}>of {allowance.freeLimit} left</Text>
            <Text style={[styles.small, { color: theme.muted, textAlign: "center" }]}>
              {resets ? `They start again on ${resets}. ` : ""}A scan that finds nothing costs nothing.
            </Text>
          </>
        )}
        {notice ? (
          <Text style={[styles.notice, { color: theme.gold }]} accessibilityRole="alert">
            {notice}
          </Text>
        ) : null}
      </View>

      {signedOut ? (
        <Pressable
          onPress={() => router.push("/sign-in")}
          accessibilityRole="button"
          style={[styles.signIn, { borderColor: theme.gold }]}
        >
          <Text style={[styles.signInText, { color: theme.gold }]}>
            Sign in free for {allowance?.signedInFreeLimit ?? 100} scans a month
          </Text>
        </Pressable>
      ) : null}

      {!onPro ? (
        <Pressable
          onPress={() => router.push("/upgrade")}
          accessibilityRole="button"
          accessibilityLabel={`Go Pro for unlimited scans, ${PRO_PRICE} a month`}
          style={[styles.goPro, { backgroundColor: theme.gold, overflow: "hidden" }]}
        >
          <GoldFoil />
          <Text style={styles.goProText}>Go Pro for unlimited scans</Text>
          <Text style={styles.goProSub}>{PRO_PRICE} a month · Cancel any time</Text>
        </Pressable>
      ) : null}

      {/* Credits held from before the packs were retired */}
      {!signedOut && credits > 0 ? (
        <View style={[styles.pack, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.packTitle, { color: theme.text }]}>
              {credits} scan credit{credits === 1 ? "" : "s"}
            </Text>
            <Text style={[styles.small, { color: theme.muted }]}>
              Used after your free scans. They also pay for boosts and Operation Nightglass chapters, and never expire.
            </Text>
          </View>
        </View>
      ) : null}

      {/* Packs: only while the server is offering them */}
      {packs.length > 0 ? (
        <>
          <Text style={[styles.heading, { color: theme.text }]} accessibilityRole="header">
            Buy scan credits
          </Text>

          {!available ? (
            <Text style={[styles.small, { color: theme.muted }]}>Buying credits works in the FlipPilot app on your phone.</Text>
          ) : !packs.some((p) => p.pkg) ? (
            <Text style={[styles.small, { color: theme.muted }]}>{"Credit packs aren't available to buy just yet. Check back soon."}</Text>
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
                style={[styles.buy, { backgroundColor: theme.gold, overflow: "hidden", opacity: !pack.pkg || busy || claiming ? 0.45 : 1 }]}
              >
                <GoldFoil />
                {busy || claiming ? (
                  <ActivityIndicator color="#111" />
                ) : (
                  <Text style={styles.buyText}>{pack.pkg ? pack.pkg.product.priceString : "Soon"}</Text>
                )}
              </Pressable>
            </View>
          ))}
        </>
      ) : null}

      <Text style={[styles.small, { color: theme.muted }]}>
        {(credits > 0 || packs.length > 0 ? "Credits can't be transferred to another account, and are removed if you delete your account. " : "") +
          "Pro is paid for through the App Store or Google Play."}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 14 },
  card: { borderWidth: 1, borderRadius: 16, padding: 18, gap: 6, alignItems: "center", minHeight: 120, justifyContent: "center" },
  label: { fontSize: 14, fontWeight: "600" },
  big: { fontSize: 56, fontWeight: "800", lineHeight: 64 },
  body: { fontSize: 16, fontWeight: "600", textAlign: "center" },
  small: { fontSize: 13, lineHeight: 19 },
  notice: { fontSize: 15, fontWeight: "700", marginTop: 4 },
  heading: { fontSize: 20, fontWeight: "700", marginTop: 8 },
  signIn: { borderWidth: 1, borderRadius: 14, minHeight: 50, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  signInText: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  goPro: { minHeight: 58, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8, alignItems: "center", justifyContent: "center" },
  goProText: { color: "#111", fontSize: 16, fontWeight: "800" },
  goProSub: { color: "#111", fontSize: 13, fontWeight: "500", marginTop: 2, opacity: 0.75 },
  pack: { borderWidth: 1, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  packTitle: { fontSize: 18, fontWeight: "700" },
  buy: { minWidth: 92, minHeight: 46, borderRadius: 12, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  buyText: { color: "#111", fontSize: 16, fontWeight: "800" },
});
