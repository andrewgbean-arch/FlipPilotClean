import { ImageBroken } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { Alert, AppState, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/styles/ThemeContext";
import { clockTime, EBAY_FRESH_MS, isEbayCheckFresh, type EbayCard } from "@/utils/ebayListings";

type Props = {
  /** eBay's cheapest and dearest asking prices, already checked against the Fair market price. */
  low: number;
  high: number;
  /** How many live listings those two figures stand on. */
  listingCount: number | null;
  /** The listings to show as cards (see pickEbayCards). */
  cards: EbayCard[];
  /** When the listings were looked up, in milliseconds. Without it nothing is shown. */
  checkedAt: number | null;
};

// True until the listings are too old to show. A timer does not run while the phone is asleep, so the age is
// checked again when the app comes back to the front.
function useStillFresh(checkedAt: number | null): boolean {
  // The check that has run out, if any: a newer check is a different stamp, so it starts fresh by itself.
  const [expiredAt, setExpiredAt] = useState<number | null>(null);

  useEffect(() => {
    if (checkedAt == null) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      if (timer) clearTimeout(timer);
      const now = Date.now();
      if (!isEbayCheckFresh(checkedAt, now)) {
        setExpiredAt(checkedAt);
        return;
      }
      timer = setTimeout(check, Math.max(1000, checkedAt + EBAY_FRESH_MS - now + 100));
    };
    check();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => {
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, [checkedAt]);

  return checkedAt != null && expiredAt !== checkedAt;
}

// A label on the left and a value on the right, the same row the other cards on the result use.
function Row({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${value}`}
      style={[styles.factRow, divider && { borderTopWidth: 1, borderTopColor: theme.hairline }]}
    >
      <Text style={[styles.factLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.factValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

function ListingCard({ card }: { card: EbayCard }) {
  const theme = useTheme();
  const [imageFailed, setImageFailed] = useState(false);
  const price = `£${card.price.toFixed(2)}`;

  const open = () => {
    Linking.openURL(card.link).catch(() => Alert.alert("Couldn't open that listing", "Please try again in a moment."));
  };

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${card.title}, ${price}${card.condition ? `, ${card.condition}` : ""}`}
      accessibilityHint="Opens the listing on eBay"
      onPress={open}
      style={({ pressed }) => [
        styles.listing,
        { backgroundColor: theme.background, borderColor: theme.hairline },
        pressed && styles.pressed,
      ]}
    >
      {card.image && !imageFailed ? (
        <Image
          source={{ uri: card.image }}
          style={styles.thumb}
          resizeMode="cover"
          accessible={false}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: theme.card }]}>
          <ImageBroken size={28} color={theme.muted} />
        </View>
      )}
      <View style={styles.listingText}>
        <Text style={[styles.listingPrice, { color: theme.text }]} numberOfLines={1}>
          {price}
        </Text>
        <Text style={[styles.listingCondition, { color: theme.muted }]} numberOfLines={1}>
          {card.condition ?? ""}
        </Text>
        <Text style={[styles.listingTitle, { color: theme.text }]} numberOfLines={2}>
          {card.title}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * "On eBay right now": everything the result shows that comes from eBay, kept together in one block of its own
 * and apart from the blended price and Google's rows above it, as eBay's licence asks. The From and To, then a
 * row of the listings behind them that open on eBay when tapped. Asking prices, said plainly, with the time
 * they were looked up; hidden altogether once they are five hours old. Never saved with a flip.
 */
export default function EbayListings({ low, high, listingCount, cards, checkedAt }: Props) {
  const theme = useTheme();
  const fresh = useStillFresh(checkedAt);
  if (!fresh || checkedAt == null) return null;

  const same = high - low < 0.005;
  const count =
    listingCount != null && listingCount > 0
      ? `${listingCount} live listing${listingCount === 1 ? "" : "s"}`
      : "Live listings";

  return (
    <>
      <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
        On eBay right now
      </Text>
      <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
        {same ? (
          <Row label="Asking price" value={`£${low.toFixed(2)}`} />
        ) : (
          <>
            <Row label="From" value={`£${low.toFixed(2)}`} />
            <Row label="To" value={`£${high.toFixed(2)}`} divider />
          </>
        )}
        {cards.length > 0 ? (
          <View style={[styles.cardsArea, { borderTopColor: theme.hairline }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cardsRow}
              accessibilityLabel="Listings on eBay"
            >
              {cards.map((card) => (
                <ListingCard key={card.link} card={card} />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
      <Text style={[styles.hint, { color: theme.muted }]}>
        {count} on eBay, checked at {clockTime(checkedAt)}. Asking prices, not confirmed sales.
        {cards.length > 0 ? " Tap a listing to open it on eBay." : ""}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 24, marginBottom: 12 },
  group: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  factRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  factLabel: { fontSize: 14, minWidth: "42%", flexShrink: 0, marginRight: 8 },
  factValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  cardsArea: { borderTopWidth: 1, paddingVertical: 12 },
  cardsRow: { paddingHorizontal: 12, gap: 10 },
  // Fixed sizes, not percentages: a remote picture has no size of its own until it loads.
  listing: { width: 136, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  thumb: { width: 134, height: 104 },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  listingText: { padding: 8, gap: 2 },
  listingPrice: { fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] },
  listingCondition: { fontSize: 12, minHeight: 16 },
  // Two lines kept free, so every card in the row is the same height.
  listingTitle: { fontSize: 12, lineHeight: 16, minHeight: 32 },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 8 },
  pressed: { opacity: 0.7 },
});
