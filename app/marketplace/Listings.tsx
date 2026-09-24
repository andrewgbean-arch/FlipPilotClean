import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useTheme } from "@/styles/ThemeContext";

import { BASE_URL } from "@/utils/api";
import { getDeviceId } from "@/utils/deviceId";
import {
  MARKETPLACE_CATEGORIES,
  categoryLabel,
  getCategory,
} from "@/constants/marketplaceCategories";
import { matchesSearch } from "@/utils/listingSearch";
import StatusBadge from "@/components/marketplace/StatusBadge";
import SponsoredCard from "@/components/marketplace/SponsoredCard";
import { reportAdvertEvent, useAdverts, type FeedAdverts } from "@/lib/adverts";
import { markShown, useRotated } from "@/lib/adRotation";
import { HOUSE_ADVERTS, fillWithHouse } from "@/lib/houseAdverts";
import { LISTINGS_PER_ADVERT, withAdverts, type FeedRow } from "@/utils/feedAdverts";

const NO_ADVERTS: FeedAdverts = { adverts: [] };

/**
 * One listing card: a small photo, the title, price and a line of details, and
 * a Look button. Compact on purpose, so several listings fit on one screen.
 *
 * Only the Look button opens the listing. The rest of the card is not
 * tappable, so a finger resting on it or dragging to scroll never throws
 * someone into a full listing by accident.
 *
 * Memoised, so scrolling or typing in the search box redraws only the cards
 * whose listing changed, not every card on the page.
 */
const ListingCard = React.memo(function ListingCard({ item, theme }: { item: any; theme: any }) {
  const thumbnail = item.photos?.[0];

  // Only a listing that really is sponsored gets the badge.
  const isSponsored = item.sponsored === true;
  const title =
    item.title ?? (`${item.vehicle?.make ?? ""} ${item.vehicle?.model ?? ""}`.trim() || "Untitled listing");

  return (
    <View style={cardStyle(theme, isSponsored)}>
      {thumbnail ? (
        <Image
          source={{ uri: thumbnail }}
          style={thumbStyle}
          contentFit="cover"
          // Kept in memory and on disk, and drawn at the size it is shown at,
          // so scrolling back over a card does not load or decode it again.
          cachePolicy="memory-disk"
          recyclingKey={String(item.id)}
          transition={120}
        />
      ) : (
        <View style={[thumbStyle, { backgroundColor: theme.background }]} />
      )}

      <View style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 12, justifyContent: "space-between" }}>
        <View>
          <Text numberOfLines={2} style={titleStyle(theme)}>
            {title}
          </Text>
          <Text style={priceStyle(theme)}>£{item.price}</Text>
          <Text numberOfLines={1} style={metaStyle(theme)}>
            {categoryLabel(item.category)}
            {item.condition ? ` • ${item.condition}` : ""}
            {item.details?.size ? ` • Size ${item.details.size}` : ""}
            {item.mileage != null ? ` • ${item.mileage} miles` : ""}
            {item.location ? ` • ${item.location}` : ""}
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <View style={{ flexDirection: "row", gap: 6, flexShrink: 1 }}>
            {isSponsored && (
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: theme.goldDeep }}>
                <Text style={{ color: theme.black, fontSize: 10, fontWeight: "700" }}>Sponsored</Text>
              </View>
            )}
            {item.status === "reserved" ? <StatusBadge status="reserved" /> : null}
          </View>
          <TouchableOpacity
            onPress={() => router.push(`/marketplace/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Look at ${title}, £${item.price}`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={lookStyle(theme)}
          >
            <Text style={{ color: theme.black, fontSize: 13, fontWeight: "800" }}>Look</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

export default function Listings() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ category?: string }>();

  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Arriving from a category tile opens that category, instead of ignoring it.
  const [category, setCategory] = useState<string>(
    getCategory(params.category)?.id ?? "All"
  );

  useEffect(() => {
    // Sending who you are lets the server leave out sellers you've blocked.
    getDeviceId()
      .then((deviceId) =>
        fetch(`${BASE_URL}/published-listings`, { headers: { "x-device-id": deviceId } })
      )
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setListings(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return (listings || [])
      // Sold is over, so it stays out of what people browse. Reserved stays
      // in, with a badge, so buyers can see it and know where it stands.
      .filter((item) => item.status !== "sold" && !item.soldAt)
      .filter((item) => matchesSearch(item, search))
      .filter((item) => {
        if (category === "All") return true;
        // Listings made before the categories were tidied up still match.
        return getCategory(item.category)?.id === category;
      });
  }, [listings, search, category]);

  const filterChips = useMemo(
    () => [
      { id: "All", label: "All" },
      ...MARKETPLACE_CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
    ],
    []
  );

  const feed = useAdverts<FeedAdverts>("feed", NO_ADVERTS);
  // The advert this phone saw longest ago goes first, so people meet different ones.
  const ordered = useRotated(feed.adverts);
  const houseOrder = useRotated(HOUSE_ADVERTS);
  // Places nobody has bought are filled with FlipPilot's own promos, after every paying advertiser.
  // Only once the server has answered and both lists are sorted, so a paid advert never gets bumped by a late arrival.
  const answered = feed !== NO_ADVERTS && (feed.adverts.length === 0 || ordered.length > 0) && houseOrder.length > 0;
  const rows = useMemo(() => {
    const slots = filtered.length >= LISTINGS_PER_ADVERT ? Math.floor(filtered.length / LISTINGS_PER_ADVERT) : filtered.length > 0 ? 1 : 0;
    return withAdverts(filtered, answered ? fillWithHouse(ordered, houseOrder, slots) : ordered);
  }, [filtered, ordered, houseOrder, answered]);

  const renderItem = useCallback(
    ({ item }: { item: FeedRow }) =>
      item.kind === "ad" ? (
        <SponsoredCard advert={item.advert} />
      ) : (
        <ListingCard item={item.item} theme={theme} />
      ),
    [theme]
  );
  // An advert counts as seen (and rotation moves on) only when it is really on screen for a moment,
  // not when the list draws it ahead of the scroll.
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60, minimumViewTime: 400 }).current;
  const onViewable = useRef(({ viewableItems }: { viewableItems: { item: FeedRow }[] }) => {
    for (const v of viewableItems) {
      const row = v.item;
      if (row?.kind !== "ad") continue;
      markShown(row.advert.id);
      if (!row.advert.house) reportAdvertEvent(row.advert.id, "view", 30);
    }
  }).current;

  const keyExtractor = useCallback(
    (row: FeedRow) => (row.kind === "ad" ? `ad-${row.advert.id}-${row.slot}` : String(row.item.id)),
    []
  );

  // Passed as an element, not a component, so typing in the search box does not
  // rebuild it and close the keyboard.
  const header = (
    <View>
      <Text style={{ color: theme.goldDeep, fontSize: 30, fontWeight: "900", marginBottom: 6 }}>
        Listings
      </Text>
      <Text style={{ color: theme.text, marginBottom: 16 }}>
        Browse all public marketplace listings
      </Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search anything — sofa, iPhone 13, size 10, Paignton…"
        placeholderTextColor={theme.muted}
        style={{
          backgroundColor: theme.card,
          color: theme.white,
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.goldDeep,
          marginBottom: 12,
        }}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginBottom: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {filterChips.map((cat) => {
          const active = category === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setCategory(cat.id)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: theme.goldDeep,
                backgroundColor: active ? theme.goldDeep : theme.card,
                marginRight: 8,
              }}
            >
              <Text
                style={{
                  color: active ? theme.black : theme.white,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading && <ActivityIndicator size="large" color={theme.goldDeep} />}
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.black }}
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      data={loading ? [] : rows}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={header}
      ListEmptyComponent={
        !loading ? (
          <Text style={{ color: theme.text, marginTop: 20 }}>No listings match your filters.</Text>
        ) : null
      }
      keyboardShouldPersistTaps="handled"
      // Only what is on screen (plus a little either side) is drawn and kept.
      onViewableItemsChanged={onViewable}
      viewabilityConfig={viewabilityConfig}
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      windowSize={7}
      removeClippedSubviews
    />
  );
}

// No drop shadow: on many cards at once it is one of the slowest things to
// draw while scrolling, and the border already separates the cards.
const cardStyle = (theme: any, sponsored: boolean) => ({
  flexDirection: "row" as const,
  backgroundColor: theme.card,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: sponsored ? theme.goldDeep : theme.goldSoftGlow,
  marginBottom: 12,
  overflow: "hidden" as const,
});

const thumbStyle = {
  width: 104,
  alignSelf: "stretch" as const,
  minHeight: 112,
};

const titleStyle = (theme: any) => ({
  color: theme.goldDeep,
  fontSize: 16,
  fontWeight: "700" as const,
});

const priceStyle = (theme: any) => ({
  color: theme.text,
  fontSize: 16,
  fontWeight: "600" as const,
  marginTop: 2,
});

const metaStyle = (theme: any) => ({
  color: theme.muted,
  fontSize: 12,
  marginTop: 2,
});

const lookStyle = (theme: any) => ({
  backgroundColor: theme.goldDeep,
  paddingHorizontal: 18,
  paddingVertical: 6,
  borderRadius: 999,
});
