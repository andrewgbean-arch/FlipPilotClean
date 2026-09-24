import React, { useState } from "react";
import { Pressable, Text } from "react-native";

import ReportSheet from "@/components/marketplace/ReportSheet";
import { useTheme } from "@/styles/ThemeContext";

/**
 * A small "Report this ad" link for every sponsored advert. Anyone can report a
 * scam or something offensive, and enough different people doing it takes the
 * advert off until it has been looked at.
 */
export default function AdReportButton({ advertId, onPhoto }: { advertId: string; onPhoto?: boolean }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Report this advert"
        hitSlop={8}
        onPress={() => setOpen(true)}
        style={{ alignSelf: "flex-end", paddingVertical: 2 }}
      >
        <Text style={{ color: onPhoto ? theme.white : theme.muted, fontSize: 11, fontWeight: "600" }}>Report this ad</Text>
      </Pressable>
      <ReportSheet visible={open} onClose={() => setOpen(false)} advertId={advertId} />
    </>
  );
}
