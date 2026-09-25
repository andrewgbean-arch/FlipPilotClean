import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { requestCode, verifyCode } from "@/lib/account";
import { useTheme } from "@/styles/useTheme";

/**
 * Sign in (or make an account) with an email address and a one-time code. No password to forget.
 * The same screen is used for both: a new address simply becomes a new account.
 */
export default function SignInScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const codeRef = useRef<TextInput>(null);

  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const sendCode = async () => {
    if (busy || !emailOk) return;
    setBusy(true);
    setError(null);
    const result = await requestCode(email.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNote(`We've sent a 6-digit code to ${email.trim()}. It can take a minute, and may land in junk.`);
    setStep("code");
    setTimeout(() => codeRef.current?.focus(), 100);
  };

  const submitCode = async (value: string) => {
    if (busy || value.length !== 6) return;
    setBusy(true);
    setError(null);
    const result = await verifyCode(email.trim(), value);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      setCode("");
      return;
    }
    leave();
  };

  const onCodeChange = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (digits.length === 6) submitCode(digits);
  };

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
        {step === "email" ? "Sign in to FlipPilot" : "Check your email"}
      </Text>
      <Text style={[styles.lead, { color: theme.muted }]}>
        {step === "email"
          ? "You need an account to sell, message other people and report anything. Browsing and scanning need no account. There's no password: we email you a code."
          : note}
      </Text>

      {step === "email" ? (
        <>
          <TextInput
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setError(null);
            }}
            placeholder="you@example.com"
            placeholderTextColor={theme.muted}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={sendCode}
            editable={!busy}
            maxLength={254}
            accessibilityLabel="Email address"
            style={[styles.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.hairline }]}
          />
          <Button label="Email me a code" onPress={sendCode} disabled={!emailOk || busy} busy={busy} />
          <Text style={[styles.small, { color: theme.muted }]}>
            We use your email only to sign you in. We don't send marketing emails.
          </Text>
        </>
      ) : (
        <>
          <TextInput
            ref={codeRef}
            value={code}
            onChangeText={onCodeChange}
            placeholder="123456"
            placeholderTextColor={theme.muted}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            editable={!busy}
            accessibilityLabel="6-digit code"
            style={[
              styles.input,
              styles.codeInput,
              { color: theme.text, backgroundColor: theme.card, borderColor: theme.hairline },
            ]}
          />
          <Button label="Sign in" onPress={() => submitCode(code)} disabled={code.length !== 6 || busy} busy={busy} />
          <Pressable
            onPress={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.link}
          >
            <Text style={{ color: theme.gold, fontWeight: "600" }}>Use a different email or send a new code</Text>
          </Pressable>
        </>
      )}

      {error ? (
        <Text style={[styles.error, { color: theme.danger }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <Pressable onPress={leave} accessibilityRole="button" hitSlop={8} style={styles.link}>
        <Text style={{ color: theme.muted }}>Not now</Text>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

function Button({ label, onPress, disabled, busy }: { label: string; onPress: () => void; disabled: boolean; busy: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      style={[styles.button, { backgroundColor: theme.gold, opacity: disabled ? 0.5 : 1 }]}
    >
      {busy ? <ActivityIndicator color="#111" /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, gap: 14 },
  title: { fontSize: 26, fontWeight: "800" },
  lead: { fontSize: 15, lineHeight: 22 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 17 },
  codeInput: { fontSize: 28, letterSpacing: 8, textAlign: "center", fontWeight: "700" },
  button: { minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#111", fontSize: 17, fontWeight: "800" },
  small: { fontSize: 13, lineHeight: 18 },
  error: { fontSize: 15, lineHeight: 21, fontWeight: "600" },
  link: { alignItems: "center", paddingVertical: 10 },
});
