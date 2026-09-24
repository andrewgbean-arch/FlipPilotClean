import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { BookmarkSimple } from "phosphor-react-native";

import { reportAdvertEvent } from "@/lib/adverts";
import type { BusinessAdvert } from "@/lib/businessAdverts";
import { removeSponsor, saveSponsor, useSavedSponsors } from "@/lib/savedSponsors";
import { useTheme } from "@/styles/ThemeContext";

/**
 * "Save" on a paid advert: keeps the sponsor in Messages to look at later, so
 * nobody has to leave what they are doing (a scan, say) to check it out.
 * Pressing it again takes it back out. Only paid adverts with a website can be
 * saved; FlipPilot's own promos and adverts with nothing to visit have no button.
 */
export default function SaveSponsorButton({ advert }: { advert: BusinessAdvert }) {
  const theme = useTheme();
  const savedList = useSavedSponsors();
  const isSaved = savedList.some((s) => s.id === advert.id);

  if (advert.house || !advert.website) return null;

  const toggle = () => {
    if (isSaved) {
      removeSponsor(advert.id);
    } else if (saveSponsor(advert)) {
      // A plain count that it was saved, not who saved it.
      reportAdvertEvent(advert.id, "save");
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isSaved ? `Saved. Remove ${advert.title} from your Messages` : `Save ${advert.title} to your Messages`}
      hitSlop={8}
      onPress={toggle}
      style={({ pressed }) => [
        styles.button,
        { borderColor: theme.goldDeep, backgroundColor: isSaved ? theme.goldDeep : "transparent" },
        pressed && styles.pressed,
      ]}
    >
      <BookmarkSimple size={14} weight={isSaved ? "fill" : "regular"} color={isSaved ? theme.black : theme.goldDeep} />
      <Text style={[styles.text, { color: isSaved ? theme.black : theme.goldDeep }]}>{isSaved ? "Saved" : "Save"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  text: { fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.85 },
});
