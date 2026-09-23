import React, { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/styles/ThemeContext";
import { BASE_URL } from "@/utils/api";
import { getDeviceId } from "@/utils/deviceId";
import ReportSheet from "@/components/marketplace/ReportSheet";

type Props = { listingId: string | number; sold?: boolean };

/**
 * The two things you can do about a listing you're looking at: talk to the
 * seller (or, if it's yours, read who has written to you) and report it.
 * Who you are is asked of the server, not guessed from the listing.
 */
export default function ListingActions({ listingId, sold }: Props) {
  const theme = useTheme();
  const [role, setRole] = useState<"buyer" | "seller" | null>(null);
  const [waiting, setWaiting] = useState(0);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const deviceId = await getDeviceId();
        const res = await fetch(`${BASE_URL}/messages/${listingId}`, {
          headers: { "x-device-id": deviceId },
        });
        const data = await res.json();
        if (cancelled || !data?.ok) return;
        setRole(data.role);
        if (Array.isArray(data.threads)) setWaiting(data.threads.length);
      } catch {
        // Without an answer, fall back to the buyer view: the server still
        // decides what anyone can read.
        if (!cancelled) setRole("buyer");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  if (!role) return null;

  const isSeller = role === "seller";

  return (
    <View style={{ marginTop: 20 }}>
      {(isSeller || !sold) && (
        <TouchableOpacity
          onPress={() => router.push(`/messages/${listingId}`)}
          accessibilityRole="button"
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: theme.goldDeep,
            borderRadius: theme.radius.md,
            paddingVertical: 14,
          }}
        >
          <Feather name="message-circle" size={18} color={theme.black} />
          <Text style={{ color: theme.black, fontWeight: "800", fontSize: 16 }}>
            {isSeller
              ? waiting > 0
                ? `Your messages (${waiting})`
                : "Your messages"
              : "Message seller"}
          </Text>
        </TouchableOpacity>
      )}

      {!isSeller && (
        <TouchableOpacity
          onPress={() => setReporting(true)}
          accessibilityRole="button"
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            paddingVertical: 14,
          }}
        >
          <Feather name="flag" size={14} color={theme.muted} />
          <Text style={{ color: theme.muted, fontWeight: "700", fontSize: 13 }}>
            Report this listing
          </Text>
        </TouchableOpacity>
      )}

      <ReportSheet
        visible={reporting}
        onClose={() => setReporting(false)}
        listingId={listingId}
      />
    </View>
  );
}
