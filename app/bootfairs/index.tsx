import { router, useFocusEffect } from "expo-router";
import {
  ArrowSquareOut,
  CalendarBlank,
  CaretRight,
  Clock,
  CloudRain,
  MagnifyingGlass,
  MapPin,
  Plus,
  Star,
  Tent,
  Users,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/styles/ThemeContext";

import { BusinessAdvert, businessAdverts } from "../../src/lib/businessAdverts";
import { Fair, getAllFairs, isFeatured } from "../../src/lib/fairs";

const RADIUS_OPTIONS = [5, 10, 20];

// A soft fill for a selected chip, and the scrim and pill that sit over a photo.
// The theme has no translucent values of its own.
const GOLD_TINT = "rgba(255, 215, 0, 0.12)";
const SCRIM = "rgba(0, 0, 0, 0.5)";
const ON_PHOTO_PILL = "rgba(255, 255, 255, 0.18)";

/* SMALL LOCAL COMPONENTS */
function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const theme = useTheme();

  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.sectionSubtitle, { color: theme.muted }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

// Small icon + text pill for the facts on a fair.
function Chip({
  Icon,
  label,
  accent,
  danger,
}: {
  Icon?: PhosphorIcon;
  label: string;
  accent?: boolean;
  danger?: boolean;
}) {
  const theme = useTheme();
  const tone = danger ? theme.danger : accent ? theme.gold : theme.muted;

  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: theme.background },
        danger && { borderWidth: 1, borderColor: theme.danger },
      ]}
    >
      {Icon ? <Icon size={14} color={tone} weight={danger || accent ? "fill" : "regular"} /> : null}
      <Text style={[styles.chipText, { color: danger ? theme.danger : theme.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function FactRow({ Icon, text }: { Icon: PhosphorIcon; text: string }) {
  const theme = useTheme();

  return (
    <View style={styles.factRow}>
      <Icon size={16} color={theme.muted} />
      <Text style={[styles.factText, { color: theme.text }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

// One boot fair in the list. The whole card opens the fair.
function FairCard({ item }: { item: Fair }) {
  const theme = useTheme();
  const [imageFailed, setImageFailed] = useState(false);

  const image = imageFailed ? undefined : item.images?.[0];
  const hasTimes = Boolean(item.openingTime || item.closingTime);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${[item.postcode, item.nextDate]
        .filter(Boolean)
        .join(", ")}. View details`}
      onPress={() =>
        router.push({
          pathname: "/bootfairs/details",
          params: { id: item.id },
        })
      }
      style={({ pressed }) => [
        styles.fairCard,
        { backgroundColor: theme.card, borderColor: theme.hairline },
        pressed && styles.pressed,
      ]}
    >
      {image ? (
        <Image
          source={{ uri: image }}
          style={[styles.fairImage, { backgroundColor: theme.background }]}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : null}

      <View style={styles.fairBody}>
        <Text numberOfLines={2} style={[styles.fairTitle, { color: theme.text }]}>
          {item.name}
        </Text>

        <View style={styles.chips}>
          {item.cancelledDueToWeather ? (
            <Chip Icon={CloudRain} label="Cancelled" danger />
          ) : null}
          {isFeatured(item) ? <Chip Icon={Star} label="Featured" accent /> : null}
          {item.frequency ? <Chip label={item.frequency} /> : null}
          {/* 0 means nobody has rated it, not "quiet" */}
          {item.busyScore > 0 ? <Chip Icon={Users} label={`Busy ${item.busyScore}/10`} /> : null}
        </View>

        <View style={styles.facts}>
          <FactRow Icon={MapPin} text={item.postcode} />
          {item.nextDate ? <FactRow Icon={CalendarBlank} text={item.nextDate} /> : null}
          {hasTimes ? (
            <FactRow Icon={Clock} text={`${item.openingTime}–${item.closingTime}`} />
          ) : null}
        </View>

        <View style={[styles.cardFooter, { borderTopColor: theme.hairline }]}>
          <Text style={[styles.cardFooterText, { color: theme.text }]}>View details</Text>
          <CaretRight size={18} color={theme.muted} />
        </View>
      </View>
    </Pressable>
  );
}

// A local business advert. Always labelled Sponsored; the card opens the
// advertiser's website when it has one.
function AdCard({ advert, style }: { advert: BusinessAdvert; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const website = advert.website;
  // A photo that won't load leaves a dead block, so drop it and show the text alone.
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <Pressable
      disabled={!website}
      accessibilityRole={website ? "button" : undefined}
      accessibilityLabel={
        website
          ? `Sponsored: ${advert.title}. Visit website`
          : `Sponsored: ${advert.title}`
      }
      onPress={() => {
        if (website) Linking.openURL(website);
      }}
      style={({ pressed }) => [
        styles.adCard,
        { backgroundColor: theme.card, borderColor: theme.hairline },
        style,
        pressed && styles.pressed,
      ]}
    >
      {advert.image && !imageFailed ? (
        <Image
          source={{ uri: advert.image }}
          style={[styles.adImage, { backgroundColor: theme.background }]}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : null}

      <View style={styles.adBody}>
        <View style={[styles.sponsoredPill, { backgroundColor: theme.background }]}>
          <Text style={[styles.sponsoredPillText, { color: theme.muted }]}>Sponsored</Text>
        </View>

        <Text numberOfLines={2} style={[styles.adTitle, { color: theme.text }]}>
          {advert.title}
        </Text>

        {advert.tagline ? (
          <Text style={[styles.adTagline, { color: theme.muted }]} numberOfLines={1}>
            {advert.tagline}
          </Text>
        ) : null}

        <Text style={[styles.adDescription, { color: theme.muted }]} numberOfLines={3}>
          {advert.description}
        </Text>

        {advert.rating ? (
          <View style={styles.ratingRow}>
            <Star size={16} color={theme.gold} weight="fill" />
            <Text style={[styles.ratingText, { color: theme.text }]}>
              {advert.rating.toFixed(1)}
            </Text>
          </View>
        ) : null}

        {website ? (
          <View style={[styles.cardFooter, { borderTopColor: theme.hairline }]}>
            <Text style={[styles.cardFooterText, { color: theme.text }]}>Visit website</Text>
            <ArrowSquareOut size={18} color={theme.muted} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function BootFairFinderScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [postcode, setPostcode] = useState("");
  const [radius, setRadius] = useState(10);

  const [fairLocations, setFairLocations] = useState<Fair[]>([]);
  const [fairsLoaded, setFairsLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getAllFairs().then((all) => {
        setFairLocations(all);
        setFairsLoaded(true);
      });
    }, [])
  );

  const featuredAd = businessAdverts.find((ad) => ad.isFeatured);
  const otherAds = businessAdverts.filter((ad) => !ad.isFeatured);
  // The closing banner shows an advert that isn't already on the page above it.
  const footerAd = businessAdverts.find((ad) => ad !== featuredAd && !otherAds.includes(ad));

  // Use `featured` fairs as "sponsored" for now
  const sponsoredFairs = useMemo(
    () => fairLocations.filter(isFeatured).slice(0, 5),
    [fairLocations]
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 24 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.intro, styles.block, { color: theme.muted }]}>
        Find boot fairs, fêtes, markets and garage sales near you, or list your own.
      </Text>

      {/* SEARCH */}
      <View
        style={[
          styles.card,
          styles.block,
          { backgroundColor: theme.card, borderColor: theme.hairline },
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.text }]} accessibilityRole="header">
          Find an event near you
        </Text>

        <Text style={[styles.fieldLabel, { color: theme.muted }]}>Postcode</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.background,
              borderColor: theme.hairline,
              color: theme.text,
            },
          ]}
          placeholder="Enter postcode (e.g. TQ4 6AG)"
          placeholderTextColor={theme.muted}
          value={postcode}
          onChangeText={setPostcode}
          accessibilityLabel="Postcode"
        />

        <Text style={[styles.fieldLabel, { color: theme.muted }]}>Search radius</Text>
        <View style={styles.segmentRow}>
          {RADIUS_OPTIONS.map((r) => {
            const selected = radius === r;

            return (
              <Pressable
                key={r}
                accessibilityRole="button"
                accessibilityLabel={`${r} miles`}
                accessibilityState={{ selected }}
                onPress={() => setRadius(r)}
                style={({ pressed }) => [
                  styles.segment,
                  {
                    backgroundColor: selected ? GOLD_TINT : theme.background,
                    borderColor: selected ? theme.gold : theme.hairline,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: selected ? theme.gold : theme.text },
                  ]}
                >
                  {r} miles
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search boot fairs"
          onPress={() =>
            router.push({
              pathname: "/bootfairs/search",
              params: { postcode, radius },
            })
          }
          style={({ pressed }) => [
            styles.primaryButton,
            styles.searchButton,
            { backgroundColor: theme.gold },
            pressed && styles.pressed,
          ]}
        >
          <MagnifyingGlass size={20} color={theme.black} weight="bold" />
          <Text style={[styles.primaryLabel, { color: theme.black }]}>Search boot fairs</Text>
        </Pressable>
      </View>

      {/* TOP SPONSORED BOOTFAIRS */}
      {sponsoredFairs.length > 0 && (
        <View style={[styles.section, styles.block]}>
          <SectionTitle
            title="Featured boot fairs"
            subtitle="Listings the organisers have promoted."
          />

          <View
            style={[styles.group, { backgroundColor: theme.card, borderColor: theme.hairline }]}
          >
            {sponsoredFairs.map((item, i) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${[item.postcode, item.nextDate]
                  .filter(Boolean)
                  .join(", ")}. Sponsored boot fair. View details`}
                onPress={() =>
                  router.push({
                    pathname: "/bootfairs/details",
                    params: { id: item.id },
                  })
                }
                style={({ pressed }) => [
                  styles.featuredRow,
                  i > 0 && { borderTopWidth: 1, borderTopColor: theme.hairline },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.featuredMain}>
                  <Text numberOfLines={2} style={[styles.featuredName, { color: theme.text }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.featuredMeta, { color: theme.muted }]} numberOfLines={1}>
                    {[item.postcode, item.nextDate].filter(Boolean).join(" · ")}
                  </Text>
                  <View style={[styles.sponsoredPill, { backgroundColor: theme.background }]}>
                    <Text style={[styles.sponsoredPillText, { color: theme.muted }]}>
                      Sponsored boot fair
                    </Text>
                  </View>
                </View>
                <CaretRight size={18} color={theme.muted} />
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* HERO SPONSOR (LOCAL BUSINESS) */}
      {featuredAd && (
        <View
          accessible
          accessibilityLabel={`Sponsored stall: ${featuredAd.title}`}
          style={[
            styles.hero,
            styles.block,
            { backgroundColor: theme.card, borderColor: theme.hairline },
          ]}
        >
          {featuredAd.image ? (
            <Image
              source={{ uri: featuredAd.image }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : null}

          <View style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} />

          <View style={styles.heroContent}>
            <View style={[styles.sponsoredPill, { backgroundColor: ON_PHOTO_PILL }]}>
              <Text style={[styles.sponsoredPillText, { color: theme.white }]}>
                Sponsored stall
              </Text>
            </View>
            <Text numberOfLines={2} style={[styles.heroTitle, { color: theme.white }]}>
              {featuredAd.title}
            </Text>
          </View>
        </View>
      )}

      {/* SPONSOR CAROUSEL (LOCAL BUSINESSES) */}
      {otherAds.length > 0 && (
        <View style={styles.section}>
          <View style={styles.block}>
            <SectionTitle title="Other sponsored stalls" />
          </View>

          <FlatList
            data={otherAds}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
            renderItem={({ item }) => (
              <View style={styles.adSlot}>
                <AdCard advert={item} style={styles.adFill} />
              </View>
            )}
          />
        </View>
      )}

      {/* BOOTFAIR LIST */}
      <View style={styles.section}>
        {fairLocations.length > 0 ? (
          <View style={styles.block}>
            <SectionTitle title="All boot fairs" />
          </View>
        ) : null}

        <FlatList
          data={fairLocations}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            fairsLoaded ? (
              <View style={styles.emptyBox}>
                <View
                  style={[
                    styles.emptyIcon,
                    { backgroundColor: theme.card, borderColor: theme.goldSoftGlow },
                  ]}
                >
                  <Tent size={30} color={theme.gold} />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>
                  No boot fairs listed yet
                </Text>
                <Text style={[styles.emptyBody, { color: theme.muted }]}>
                  Boot fairs you list show up here. Use the button below to add one.
                </Text>
              </View>
            ) : (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={theme.muted} />
                <Text style={[styles.loadingText, { color: theme.muted }]}>
                  Loading boot fairs
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => <FairCard item={item} />}
        />
      </View>

      {/* BOTTOM LOCAL BUSINESS SPONSOR (SECONDARY) */}
      {footerAd && (
        <View style={[styles.section, styles.block]}>
          <AdCard advert={footerAd} />
        </View>
      )}

      {/* LIST YOUR BOOT FAIR BUTTON */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="List your boot fair"
        onPress={() => router.push("/bootfairs/add")}
        style={({ pressed }) => [
          styles.secondaryButton,
          styles.block,
          styles.addButton,
          { backgroundColor: theme.card, borderColor: theme.hairline },
          pressed && styles.pressed,
        ]}
      >
        <Plus size={20} color={theme.text} weight="bold" />
        <Text style={[styles.secondaryLabel, { color: theme.text }]}>List your boot fair</Text>
      </Pressable>
    </ScrollView>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Every top-level block sits inside the 16pt gutter; the carousel bleeds to the edge.
  block: {
    marginHorizontal: 16,
  },
  section: {
    marginTop: 24,
  },
  intro: {
    fontSize: 15,
    lineHeight: 21,
  },
  pressed: {
    opacity: 0.75,
  },

  /* SEARCH */
  card: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 8,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentText: {
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  primaryButton: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  searchButton: {
    marginTop: 20,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  addButton: {
    marginTop: 24,
  },

  /* SECTIONS */
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  group: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },

  /* FEATURED FAIRS */
  featuredRow: {
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featuredMain: {
    flex: 1,
    gap: 3,
  },
  featuredName: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 21,
  },
  featuredMeta: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  sponsoredPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 4,
  },
  sponsoredPillText: {
    fontSize: 12,
    fontWeight: "600",
  },

  /* HERO SPONSOR */
  hero: {
    height: 168,
    marginTop: 24,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  heroContent: {
    padding: 16,
    gap: 8,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 26,
  },

  /* SPONSOR CARDS */
  carouselContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  adSlot: {
    width: 280,
  },
  adFill: {
    flex: 1,
  },
  adCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  adImage: {
    width: "100%",
    height: 140,
  },
  adBody: {
    padding: 16,
    gap: 4,
  },
  adTitle: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
    marginTop: 6,
  },
  adTagline: {
    fontSize: 13,
    fontWeight: "600",
  },
  adDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },

  /* BOOTFAIR CARDS */
  listContent: {
    paddingHorizontal: 16,
  },
  separator: {
    height: 12,
  },
  fairCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  fairImage: {
    width: "100%",
    height: 140,
  },
  fairBody: {
    padding: 16,
  },
  fairTitle: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 1,
    fontVariant: ["tabular-nums"],
  },
  facts: {
    gap: 6,
    marginTop: 12,
  },
  factRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  factText: {
    flex: 1,
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  cardFooter: {
    minHeight: 44,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardFooterText: {
    fontSize: 15,
    fontWeight: "600",
  },

  /* EMPTY AND LOADING */
  emptyBox: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
  },
  loadingBox: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
  },
});
