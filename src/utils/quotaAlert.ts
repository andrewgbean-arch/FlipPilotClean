import { Alert } from "react-native";
import type { useRouter } from "expo-router";

import { quotaAlertContent } from "@/lib/scanAllowance";
import type { ApiError } from "./api";

/**
 * A scan being refused is a moment to help, not just an error. The server's own words say what happened (they name the date the
 * free scans come back); the buttons offer what would actually help: sign in (signing up is how you scan), go Pro, or, at
 * Pro's daily ceiling, just wait.
 */
export function showQuotaAlert(err: ApiError, router: ReturnType<typeof useRouter>) {
  const reason = err.quotaReason ?? (err.needsSignIn ? "sign-in" : err.needsCredits ? "out-of-credits" : undefined);
  const { title, buttons } = quotaAlertContent(reason);
  Alert.alert(
    title,
    err.message,
    buttons.map((b) => ({
      text: b.label,
      style: b.to ? undefined : ("cancel" as const),
      onPress: b.to ? () => router.push(b.to!) : undefined,
    }))
  );
}
