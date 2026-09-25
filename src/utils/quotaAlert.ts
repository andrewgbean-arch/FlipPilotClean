import { Alert } from "react-native";
import type { useRouter } from "expo-router";

import type { ApiError } from "./api";

/**
 * The scan allowance running out is a moment to help, not just an error. If signing in would let
 * the person use scan credits they already have, offer that; otherwise just say what happened.
 */
export function showQuotaAlert(err: ApiError, router: ReturnType<typeof useRouter>) {
  const buttons = err.needsSignIn
    ? [
        { text: "Not now", style: "cancel" as const },
        { text: "Sign in", onPress: () => router.push("/sign-in") },
      ]
    : [{ text: "OK", style: "cancel" as const }];
  Alert.alert("You're out of free scans", err.message, buttons);
}
