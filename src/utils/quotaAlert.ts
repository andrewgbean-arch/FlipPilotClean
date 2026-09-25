import { Alert } from "react-native";
import type { useRouter } from "expo-router";

import type { ApiError } from "./api";

/**
 * The scan allowance running out is a moment to help, not just an error. Offer what would actually
 * help: signing in (to use credits they may already hold), or getting more credits.
 */
export function showQuotaAlert(err: ApiError, router: ReturnType<typeof useRouter>) {
  const buttons = err.needsSignIn
    ? [
        { text: "Not now", style: "cancel" as const },
        { text: "Sign in", onPress: () => router.push("/sign-in") },
      ]
    : err.needsCredits
    ? [
        { text: "Not now", style: "cancel" as const },
        { text: "Get credits", onPress: () => router.push("/credits") },
      ]
    : [{ text: "OK", style: "cancel" as const }];
  Alert.alert("You're out of free scans", err.message, buttons);
}
