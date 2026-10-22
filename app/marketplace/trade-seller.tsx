import { useCallback, useState } from "react";
import GoldFoil from "@/components/ui/GoldFoil";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { becomeTradeSeller, fetchTradeSeller, type TradeSellerStatus } from "@/lib/tradeSeller";
import { DEFAULT_TRADE_CAR_LIMIT, businessNameReady, tradeOfferWords, tradeScreenWords } from "@/lib/tradeSellerRules";
import { openPartnerLink } from "@/utils/partnerLinks";
import { useTheme } from "@/styles/useTheme";

/**
 * Sell as a dealer: a dealer who lists cars in the app itself, without the Dealer OS web app, says so and gives the name they
 * trade under. Buyers then see "Trade seller" on their cars (so they know they are buying from a business), and they may have
 * several cars for sale at once where a private seller has one. The server decides the limit and whether it is free.
 */
export default function TradeSellerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<TradeSellerStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Each time the screen is shown: whether this phone is a trade seller already (the name box starts with its name).
  useFocusEffect(
    useCallback(() => {
      let live = true;
      fetchTradeSeller().then((s) => {
        if (!live) return;
        setStatus(s);
        setLoaded(true);
        if (s?.tradeSeller) setName((typed) => typed || s.tradeSeller!.businessName);
      });
      return () => {
        live = false;
      };
    }, [])
  );

  const words = tradeScreenWords(status);
  const offer = tradeOfferWords(status ?? { carLimit: DEFAULT_TRADE_CAR_LIMIT, free: true });
  const ready = businessNameReady(name);
  const already = status?.tradeSeller?.businessName.trim() === name.replace(/\s+/g, " ").trim();

  const save = async () => {
    if (busy || !ready) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    const result = await becomeTradeSeller(name);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setStatus(result.status);
    setName(result.status.tradeSeller?.businessName ?? name);
    setSaved(true);
  };

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
        {loaded ? words.heading : "Sell as a dealer"}
      </Text>
      <Text style={[styles.lead, { color: theme.muted }]}>
        {offer} Buyers see you as a Trade seller, with the name you give here, so they know they are buying from a business.
      </Text>

      <Text style={[styles.label, { color: theme.text }]}>Your trading name</Text>
      <TextInput
        value={name}
        onChangeText={(t) => {
          setName(t);
          setError(null);
          setSaved(false);
        }}
        placeholder="For example: A1 Autos"
        placeholderTextColor={theme.muted}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={save}
        editable={!busy}
        maxLength={60}
        accessibilityLabel="Your trading name"
        style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.hairline }]}
      />

      <Pressable
        onPress={save}
        disabled={!ready || busy || (!!status?.tradeSeller && already)}
        accessibilityRole="button"
        accessibilityState={{ disabled: !ready || busy || (!!status?.tradeSeller && already), busy }}
        style={[
          styles.button,
          { backgroundColor: theme.gold, overflow: "hidden", opacity: !ready || busy || (!!status?.tradeSeller && already) ? 0.5 : 1 },
        ]}
      >
        <GoldFoil />
        {busy ? <ActivityIndicator color="#111" /> : <Text style={styles.buttonText}>{words.button}</Text>}
      </Pressable>

      {error ? (
        <Text style={[styles.error, { color: theme.danger }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      {saved ? (
        <Text style={[styles.good, { color: theme.gold }]} accessibilityRole="alert">
          {"Saved. You're a trade seller now."}
        </Text>
      ) : null}

      {status?.tradeSeller ? (
        <Pressable
          onPress={() => router.push("/marketplace/create/new?category=motors")}
          accessibilityRole="button"
          style={[styles.secondary, { borderColor: theme.gold }]}
        >
          <Text style={[styles.secondaryText, { color: theme.gold }]}>List a car</Text>
        </Pressable>
      ) : null}

      <Text style={[styles.small, { color: theme.muted }]}>
        {"FlipPilot doesn't check your trading name, so use your real one. Buyers have different rights when they buy from a business, and a plain name helps them trust you."}
      </Text>

      <Pressable onPress={() => openPartnerLink("dealers")} accessibilityRole="button" hitSlop={8} style={styles.link}>
        <Text style={{ color: theme.gold, fontWeight: "600", textAlign: "center" }}>
          Run a bigger business? FlipPilot Dealer OS does your stock, leads, books and staff too
        </Text>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, gap: 14 },
  title: { fontSize: 26, fontWeight: "800" },
  lead: { fontSize: 15, lineHeight: 22 },
  label: { fontSize: 15, fontWeight: "700", marginTop: 6 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 17 },
  button: { minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#111", fontSize: 17, fontWeight: "800" },
  secondary: { borderWidth: 1, borderRadius: 14, minHeight: 50, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontSize: 16, fontWeight: "700" },
  small: { fontSize: 13, lineHeight: 19 },
  error: { fontSize: 15, lineHeight: 21, fontWeight: "600" },
  good: { fontSize: 15, lineHeight: 21, fontWeight: "700" },
  link: { alignItems: "center", paddingVertical: 10 },
});
