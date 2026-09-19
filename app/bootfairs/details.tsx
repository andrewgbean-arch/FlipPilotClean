import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  CaretRight,
  Car,
  CreditCard,
  EnvelopeSimple,
  FacebookLogo,
  ForkKnife,
  Globe,
  House,
  InstagramLogo,
  MapPin,
  Money,
  NavigationArrow,
  PawPrint,
  Phone,
  SealCheck,
  Star,
  Tent,
  Toilet,
  TwitterLogo,
  Umbrella,
  Users,
  Wheelchair,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/styles/ThemeContext";

import { Fair, getAllFairs } from "../../src/lib/fairs";

/* SMALL LOCAL COMPONENTS */
function SectionTitle({ children }: { children: string }) {
  const theme = useTheme();

  return (
    <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
      {children}
    </Text>
  );
}

// A card that holds rows and blocks; the rows inside are split by hairlines.
function Group({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
      {children}
    </View>
  );
}

function DataRow({
  label,
  value,
  divider,
}: {
  label: string;
  value: string;
  divider?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.dataRow, divider && { borderTopWidth: 1, borderTopColor: theme.hairline }]}
    >
      <Text style={[styles.dataLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.dataValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

// Small icon + text pill for the status of a fair.
function Chip({
  Icon,
  label,
  iconColor,
  filled,
}: {
  Icon?: PhosphorIcon;
  label: string;
  iconColor?: string;
  filled?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.chip, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
      {Icon ? (
        <Icon
          size={14}
          color={iconColor ?? theme.muted}
          weight={filled ? "fill" : "regular"}
        />
      ) : null}
      <Text style={[styles.chipText, { color: theme.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// Two figures side by side, as a pair of tiles.
function StatTile({ label, value }: { label: string; value: string }) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[styles.statTile, { backgroundColor: theme.card, borderColor: theme.hairline }]}
    >
      <Text style={[styles.statLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

// One thing the fair does or does not have. A missing one is dimmed rather
// than crossed out, because it may simply not have been listed.
function Facility({
  Icon,
  label,
  enabled,
}: {
  Icon: PhosphorIcon;
  label: string;
  enabled: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${enabled ? "available" : "not listed"}`}
      style={[
        styles.facility,
        { backgroundColor: theme.card, borderColor: theme.hairline },
        !enabled && styles.facilityOff,
      ]}
    >
      <Icon
        size={22}
        color={enabled ? theme.text : theme.muted}
        weight={enabled ? "fill" : "regular"}
      />
      <Text
        style={[styles.facilityLabel, { color: enabled ? theme.text : theme.muted }]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
}

type Contact = {
  key: string;
  Icon: PhosphorIcon;
  label: string;
  description: string;
  onPress: () => void;
};

function ContactRow({ contact, divider }: { contact: Contact; divider: boolean }) {
  const theme = useTheme();
  const { Icon } = contact;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={contact.description}
      onPress={contact.onPress}
      style={({ pressed }) => [
        styles.contactRow,
        divider && { borderTopWidth: 1, borderTopColor: theme.hairline },
        pressed && styles.pressed,
      ]}
    >
      <Icon size={20} color={theme.muted} />
      <Text style={[styles.contactText, { color: theme.text }]} numberOfLines={1}>
        {contact.label}
      </Text>
      <CaretRight size={18} color={theme.muted} />
    </Pressable>
  );
}

export default function BootfairDetails() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { id: idParam } = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;

  const [fair, setFair] = useState<Fair | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Fairs the user added live in storage, so they are read asynchronously.
    getAllFairs().then((all) => {
      if (!active) return;
      setFair(all.find((f) => f.id === id) ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.muted} />
        <Text style={[styles.stateBody, { color: theme.muted }]}>Loading boot fair</Text>
      </View>
    );
  }

  if (!fair) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <View
          style={[styles.stateIcon, { backgroundColor: theme.card, borderColor: theme.hairline }]}
        >
          <Tent size={30} color={theme.muted} />
        </View>
        <Text style={[styles.stateTitle, { color: theme.text }]} accessibilityRole="header">
          Boot fair not found
        </Text>
        <Text style={[styles.stateBody, { color: theme.muted }]}>
          We could not find that boot fair. It may have been removed from your list.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [
            styles.primaryButton,
            styles.stateButton,
            { backgroundColor: theme.gold },
            pressed && styles.pressed,
          ]}
          onPress={() => router.back()}
        >
          <Text style={[styles.primaryLabel, { color: theme.black }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const openMaps = () => {
    // Fairs listed without coordinates are stored as 0,0 (a point in the sea),
    // so search by address/postcode instead.
    const hasCoords = fair.lat !== 0 || fair.lng !== 0;
    const query = hasCoords
      ? `${fair.lat},${fair.lng}`
      : encodeURIComponent([fair.address, fair.postcode].filter(Boolean).join(", "));
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  };

  const openWebsite = () => {
    if (fair.website) Linking.openURL(fair.website);
  };

  const callOrganiser = () => {
    if (fair.phone) Linking.openURL(`tel:${fair.phone}`);
  };

  const emailOrganiser = () => {
    if (fair.email) Linking.openURL(`mailto:${fair.email}`);
  };

  // Only the ways of getting in touch that this fair actually has.
  const contacts: Contact[] = [];

  if (fair.displayEmailPublicly && fair.email) {
    contacts.push({
      key: "email",
      Icon: EnvelopeSimple,
      label: fair.email,
      description: `Email the organiser at ${fair.email}`,
      onPress: emailOrganiser,
    });
  }

  if (fair.phone) {
    contacts.push({
      key: "phone",
      Icon: Phone,
      label: fair.phone,
      description: `Call the organiser on ${fair.phone}`,
      onPress: callOrganiser,
    });
  }

  if (fair.website) {
    contacts.push({
      key: "website",
      Icon: Globe,
      label: "Website",
      description: "Open the organiser's website",
      onPress: openWebsite,
    });
  }

  if (fair.social?.facebook) {
    contacts.push({
      key: "facebook",
      Icon: FacebookLogo,
      label: "Facebook",
      description: "Open the organiser's Facebook page",
      onPress: () => Linking.openURL(fair.social?.facebook!),
    });
  }

  if (fair.social?.instagram) {
    contacts.push({
      key: "instagram",
      Icon: InstagramLogo,
      label: "Instagram",
      description: "Open the organiser's Instagram page",
      onPress: () => Linking.openURL(fair.social?.instagram!),
    });
  }

  if (fair.social?.twitter) {
    contacts.push({
      key: "twitter",
      Icon: TwitterLogo,
      label: "Twitter",
      description: "Open the organiser's Twitter page",
      onPress: () => Linking.openURL(fair.social?.twitter!),
    });
  }

  const hasFees = Boolean(fair.entryFee || fair.stallFee);
  // 0 means no estimate, so the block is hidden.
  const hasEstimates = fair.estimatedStalls > 0 || fair.estimatedVisitors > 0;

  const updated = fair.lastUpdated ? new Date(fair.lastUpdated) : null;
  const updatedText =
    updated && !Number.isNaN(updated.getTime())
      ? updated.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;

  const hasDetails = Boolean(fair.nextDate || fair.hours || fair.frequency);
  const detailRows: { label: string; value: string }[] = [];
  if (fair.nextDate) detailRows.push({ label: "Next date", value: fair.nextDate });
  if (fair.hours) detailRows.push({ label: "Opening hours", value: fair.hours });
  if (fair.frequency) detailRows.push({ label: "How often", value: fair.frequency });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO IMAGE */}
        {fair.images?.length > 0 && fair.images[0] ? (
          <Image
            source={{ uri: fair.images[0] }}
            style={[styles.heroImage, { backgroundColor: theme.card }]}
            resizeMode="cover"
          />
        ) : null}

        {/* TITLE */}
        <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
          {fair.name}
        </Text>
        <View style={styles.addressRow}>
          <MapPin size={16} color={theme.muted} />
          <Text style={[styles.address, { color: theme.muted }]}>
            {fair.address || fair.postcode}
          </Text>
        </View>

        {/* BADGES */}
        <View style={styles.chips}>
          {fair.featured ? (
            <Chip Icon={Star} label="Featured" iconColor={theme.gold} filled />
          ) : null}

          {fair.verified ? (
            <Chip Icon={SealCheck} label="Verified" iconColor={theme.success} filled />
          ) : null}

          {/* 0 means nobody has rated it, not "quiet" */}
          {fair.busyScore > 0 ? <Chip Icon={Users} label={`Busy ${fair.busyScore}/10`} /> : null}
        </View>

        {/* CATEGORY CHIPS */}
        {fair.categories?.length > 0 ? (
          <View style={styles.chips}>
            {fair.categories.map((cat) => (
              <Chip key={cat} label={cat} />
            ))}
          </View>
        ) : null}

        {/* DESCRIPTION */}
        {fair.description ? (
          <Text style={[styles.description, { color: theme.muted }]}>{fair.description}</Text>
        ) : null}

        {/* WHEN (entered by whoever listed the fair) */}
        {hasDetails ? (
          <>
            <SectionTitle>Details</SectionTitle>
            <Group>
              {detailRows.map((row, i) => (
                <DataRow key={row.label} label={row.label} value={row.value} divider={i > 0} />
              ))}
            </Group>
          </>
        ) : null}

        {/* HOW MUCH */}
        {hasFees ? (
          <>
            <SectionTitle>Fees</SectionTitle>
            <View style={styles.tileRow}>
              <StatTile label="Entry fee" value={fair.entryFee || "-"} />
              <StatTile label="Stall fee" value={fair.stallFee || "-"} />
            </View>
          </>
        ) : null}

        {/* EVENT STATS */}
        {hasEstimates ? (
          <>
            <SectionTitle>Expected turnout</SectionTitle>
            <View style={styles.tileRow}>
              <StatTile label="Estimated stalls" value={String(fair.estimatedStalls)} />
              <StatTile label="Estimated visitors" value={String(fair.estimatedVisitors)} />
            </View>
          </>
        ) : null}

        {/* PAYMENTS AND GOOD TO KNOW */}
        <SectionTitle>Good to know</SectionTitle>
        <View style={styles.facilityGrid}>
          <Facility Icon={CreditCard} label="Card payments" enabled={fair.acceptsCard} />
          <Facility Icon={Money} label="Cash payments" enabled={fair.acceptsCash} />
          <Facility Icon={Car} label="Parking" enabled={fair.parking} />
          <Facility Icon={ForkKnife} label="Food" enabled={fair.foodStalls} />
          <Facility Icon={PawPrint} label="Dogs" enabled={fair.dogFriendly} />
          <Facility Icon={Toilet} label="Toilets" enabled={fair.toilets} />
          <Facility Icon={Wheelchair} label="Accessible" enabled={fair.wheelchairAccessible} />
          <Facility Icon={Umbrella} label="Weather safe" enabled={fair.weatherSafe} />
          <Facility Icon={House} label="Indoor" enabled={fair.indoor} />
        </View>

        {/* ORGANISER CONTACT */}
        <SectionTitle>Organiser contact</SectionTitle>
        <Group>
          {contacts.length > 0 ? (
            contacts.map((contact, i) => (
              <ContactRow key={contact.key} contact={contact} divider={i > 0} />
            ))
          ) : (
            <Text style={[styles.noContact, { color: theme.muted }]}>
              The organiser has not listed any contact details.
            </Text>
          )}
        </Group>

        {/* LAST UPDATED */}
        {updatedText ? (
          <Text style={[styles.lastUpdated, { color: theme.muted }]}>
            Last updated {updatedText}
          </Text>
        ) : null}
      </ScrollView>

      {/* ACTIONS */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: theme.background,
            borderTopColor: theme.hairline,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: theme.hairline, backgroundColor: theme.card },
              pressed && styles.pressed,
            ]}
            onPress={() => router.back()}
          >
            <ArrowLeft size={18} color={theme.text} />
            <Text style={[styles.secondaryLabel, { color: theme.text }]} numberOfLines={1}>
              Back
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open in Google Maps"
            style={({ pressed }) => [
              styles.primaryButton,
              styles.mapsButton,
              { backgroundColor: theme.gold },
              pressed && styles.pressed,
            ]}
            onPress={openMaps}
          >
            <NavigationArrow size={18} color={theme.black} weight="fill" />
            <Text style={[styles.primaryLabel, { color: theme.black }]} numberOfLines={1}>
              Open in Google Maps
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  pressed: {
    opacity: 0.75,
  },

  /* LOADING / NOT FOUND */
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  stateIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  stateTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  stateBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
  },
  stateButton: {
    alignSelf: "center",
    paddingHorizontal: 28,
    marginTop: 24,
  },

  /* HERO AND TITLE */
  heroImage: {
    width: "100%",
    height: 200,
    borderRadius: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  address: {
    flex: 1,
    fontSize: 15,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
    fontVariant: ["tabular-nums"],
  },
  description: {
    fontSize: 16,
    lineHeight: 23,
    marginTop: 16,
  },

  /* SECTIONS */
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 24,
    marginBottom: 12,
  },
  group: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  dataRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  dataLabel: {
    fontSize: 15,
  },
  dataValue: {
    fontSize: 16,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },

  /* STAT TILES */
  tileRow: {
    flexDirection: "row",
    gap: 12,
  },
  statTile: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  statLabel: {
    fontSize: 13,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },

  /* GOOD TO KNOW */
  facilityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  facility: {
    // Three to a row at any phone width; the nine tiles fill the rows exactly.
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: "30%",
    minHeight: 84,
    paddingHorizontal: 6,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  facilityOff: {
    opacity: 0.55,
  },
  facilityLabel: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },

  /* ORGANISER CONTACT */
  contactRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  contactText: {
    flex: 1,
    fontSize: 16,
  },
  noContact: {
    padding: 16,
    fontSize: 15,
    lineHeight: 22,
  },
  lastUpdated: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 24,
  },

  /* ACTIONS */
  footer: {
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  secondaryLabel: {
    fontSize: 15,
    fontWeight: "600",
    flexShrink: 1,
  },
  primaryButton: {
    minHeight: 52,
    paddingHorizontal: 10,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  mapsButton: {
    flex: 2,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: "700",
    flexShrink: 1,
  },
});
