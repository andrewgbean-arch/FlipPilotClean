import * as Haptics from "expo-haptics";
import { router, useFocusEffect, type Href } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Barcode,
  BellRinging,
  BookOpen,
  Buildings,
  Car,
  CaretRight,
  ChatCircleDots,
  ClipboardText,
  CloudSun,
  Coins,
  Detective,
  GameController,
  ListBullets,
  MagnifyingGlass,
  Megaphone,
  Sparkle,
  Storefront,
  Tag,
  Tent,
  XCircle,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GUIDES } from "@/content/guides";
import { useTheme } from "@/styles/ThemeContext";
import { openPartnerLink, type PartnerLinkKind } from "@/utils/partnerLinks";

// Everything on this tab opens something real: a screen in the app, a guide worth reading, or
// (for businesses) the page they need. Nothing here is a description of a feature instead of it.

type Action = { href: Href } | { partner: PartnerLinkKind };

type Item = {
  title: string;
  desc: string;
  Icon: PhosphorIcon;
  action: Action;
  /** Extra words people might search for. */
  keywords?: string;
};

type Section = { title: string; items: Item[] };

const QUICK_ACCESS: Item[] = [
  { title: "AI Lookup", desc: "Identify any item instantly", href: "/ai-camera", Icon: Sparkle },
  { title: "Barcode Scanner", desc: "Fastest way to check value", href: "/scan", Icon: Barcode },
  { title: "Bootfairs & Events", desc: "Fairs, fêtes, markets & sales", href: "/bootfairs", Icon: Tent },
  { title: "MOT Checker", desc: "Look up any UK vehicle", href: "/vehicles/mot-lookup", Icon: ClipboardText },
  { title: "Marketplace", desc: "Buy, sell and message locally", href: "/marketplace", Icon: Storefront },
  { title: "How to use FlipPilot", desc: "A quick guide to get you flipping", href: "/help", Icon: BookOpen },
].map(({ href, ...rest }) => ({ ...rest, action: { href: href as Href } }));

// Two tiles to a row.
const QUICK_ACCESS_ROWS = [QUICK_ACCESS.slice(0, 2), QUICK_ACCESS.slice(2, 4), QUICK_ACCESS.slice(4, 6)];

// The newest things in the app. Keep this to the last two or three, and update it when
// something ships.
const WHATS_NEW: Item[] = [
  {
    title: "Operation Nightglass",
    desc: "A new spy adventure every month, played inside the app",
    Icon: Detective,
    action: { href: "/nightglass" },
    keywords: "game play story",
  },
  {
    title: "Lampy's Boot Fair Dash",
    desc: "Catch the bargains, dodge the tat: a quick arcade game",
    Icon: GameController,
    action: { href: "/game" },
    keywords: "game play arcade",
  },
];

const SECTIONS: Section[] = [
  {
    title: "Play",
    items: [
      { title: "Operation Nightglass", desc: "Monthly spy adventure", Icon: Detective, action: { href: "/nightglass" }, keywords: "game story" },
      { title: "Lampy's Boot Fair Dash", desc: "Arcade game: catch the bargains", Icon: GameController, action: { href: "/game" }, keywords: "game arcade" },
    ],
  },
  {
    title: "Buying & selling",
    items: [
      { title: "Sell an item", desc: "List something on the Marketplace", Icon: Tag, action: { href: "/marketplace/create/new" }, keywords: "listing list sell" },
      { title: "My listings", desc: "Edit, reprice or mark as sold", Icon: ListBullets, action: { href: "/marketplace/my-listings" }, keywords: "sold selling" },
      { title: "Messages", desc: "Chat with buyers and sellers", Icon: ChatCircleDots, action: { href: "/messages" }, keywords: "chat inbox" },
      { title: "Scan credits", desc: "See your balance or top up", Icon: Coins, action: { href: "/credits" }, keywords: "buy pay scans" },
      { title: "Boot fair weather", desc: "Conditions near you before you go", Icon: CloudSun, action: { href: "/weather" }, keywords: "rain forecast" },
    ],
  },
  {
    title: "Motors",
    items: [
      { title: "My vehicles", desc: "Your cars, their details and history", Icon: Car, action: { href: "/vehicles" }, keywords: "car van garage" },
      { title: "MOT alerts", desc: "Know before an MOT runs out", Icon: BellRinging, action: { href: "/motors/mot-alerts" }, keywords: "reminder expiry" },
      { title: "Sell a car", desc: "List a vehicle on the Marketplace", Icon: Tag, action: { href: "/marketplace/create/new?category=motors" }, keywords: "listing vehicle" },
    ],
  },
  {
    title: "Guides",
    items: GUIDES.map((g) => ({
      title: g.title,
      desc: `${g.desc} · ${g.minutes} min`,
      Icon: BookOpen,
      action: { href: { pathname: "/guide/[slug]", params: { slug: g.slug } } as Href },
      keywords: "guide tips how learn " + g.sections.map((s) => s.heading ?? "").join(" "),
    })),
  },
  {
    title: "For businesses",
    items: [
      { title: "Advertise your business", desc: "Put your business in front of local buyers and sellers", Icon: Megaphone, action: { partner: "advertise" }, keywords: "advert sponsor promote" },
      { title: "Car dealers", desc: "Stock and listings with FlipPilot Dealer OS", Icon: Buildings, action: { partner: "dealers" }, keywords: "dealer trade garage" },
    ],
  },
];

const NEUTRAL_TINT = "rgba(255, 255, 255, 0.07)";

// The soft fill behind an icon: a theme colour at low opacity. Falls back to a
// neutral tint if the colour is not a plain #RRGGBB value.
const softTint = (color: string, alpha: number) => {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!match) return NEUTRAL_TINT;
  const [r, g, b] = [match[1], match[2], match[3]].map((h) => parseInt(h, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const matches = (item: Item, section: string, q: string) =>
  `${item.title} ${item.desc} ${section} ${item.keywords ?? ""}`.toLowerCase().includes(q);

function open(item: Item) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  if ("partner" in item.action) openPartnerLink(item.action.partner);
  else router.push(item.action.href);
}

function SectionTitle({ children }: { children: string }) {
  const theme = useTheme();

  return (
    <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
      {children}
    </Text>
  );
}

function IconCircle({
  Icon,
  size,
  iconColor,
  background,
}: {
  Icon: PhosphorIcon;
  size: number;
  iconColor: string;
  background: string;
}) {
  return (
    <View
      style={[
        styles.iconCircle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background },
      ]}
    >
      <Icon size={Math.round(size * 0.5)} color={iconColor} />
    </View>
  );
}

function QuickTile({ item }: { item: Item }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.desc}`}
      onPress={() => open(item)}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: theme.card, borderColor: theme.hairline },
        pressed && styles.pressed,
      ]}
    >
      <IconCircle Icon={item.Icon} size={44} iconColor={theme.secondary} background={softTint(theme.secondary, 0.16)} />
      <View>
        <Text style={[styles.tileTitle, { color: theme.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.tileDesc, { color: theme.muted }]} numberOfLines={2}>
          {item.desc}
        </Text>
      </View>
    </Pressable>
  );
}

function Row({ item, divider, highlight }: { item: Item; divider?: boolean; highlight?: boolean }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole={"partner" in item.action ? "link" : "button"}
      accessibilityLabel={`${item.title}. ${item.desc}`}
      onPress={() => open(item)}
      style={({ pressed }) => [
        styles.row,
        divider && { borderTopWidth: 1, borderTopColor: theme.hairline },
        pressed && styles.pressed,
      ]}
    >
      <IconCircle
        Icon={item.Icon}
        size={40}
        iconColor={highlight ? theme.gold : theme.text}
        background={highlight ? softTint(theme.gold, 0.14) : NEUTRAL_TINT}
      />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.rowDesc, { color: theme.muted }]} numberOfLines={2}>
          {item.desc}
        </Text>
      </View>
      <CaretRight size={16} color={theme.muted} />
    </Pressable>
  );
}

function Group({ items, highlight }: { items: Item[]; highlight?: boolean }) {
  const theme = useTheme();

  return (
    <View style={[styles.group, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
      {items.map((item, i) => (
        <Row key={item.title} item={item} divider={i > 0} highlight={highlight} />
      ))}
    </View>
  );
}

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const theme = useTheme();
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      setSearch("");
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [])
  );

  const q = search.trim().toLowerCase();
  const browsing = q === "";

  // Searching looks through everything on the tab, quick access included, once each.
  const results = useMemo(() => {
    if (!q) return [];
    const seen = new Set<string>();
    const out: Item[] = [];
    const add = (item: Item, section: string) => {
      if (!seen.has(item.title) && matches(item, section, q)) {
        seen.add(item.title);
        out.push(item);
      }
    };
    QUICK_ACCESS.forEach((i) => add(i, "Quick access"));
    SECTIONS.forEach((s) => s.items.forEach((i) => add(i, s.title)));
    return out;
  }, [q]);

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
        Explore
      </Text>
      <Text style={[styles.subtitle, { color: theme.muted }]}>Tools, games and guides for flippers</Text>

      <View style={[styles.search, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
        <MagnifyingGlass size={20} color={theme.muted} />
        <TextInput
          placeholder="Search tools, games, guides..."
          placeholderTextColor={theme.muted}
          value={search}
          onChangeText={setSearch}
          accessibilityLabel="Search tools, games and guides"
          selectionColor={theme.gold}
          style={[styles.searchInput, { color: theme.text }]}
        />
        {search.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => setSearch("")}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
          >
            <XCircle size={20} weight="fill" color={theme.muted} />
          </Pressable>
        ) : null}
      </View>

      {browsing ? (
        <>
          <SectionTitle>Quick access</SectionTitle>
          <View style={styles.tileGrid}>
            {QUICK_ACCESS_ROWS.map((pair) => (
              <View key={pair[0].title} style={styles.tileRow}>
                {pair.map((item) => (
                  <QuickTile key={item.title} item={item} />
                ))}
              </View>
            ))}
          </View>

          <SectionTitle>What’s new</SectionTitle>
          <Group items={WHATS_NEW} highlight />

          {SECTIONS.map((s) => (
            <View key={s.title}>
              <SectionTitle>{s.title}</SectionTitle>
              <Group items={s.items} />
            </View>
          ))}
        </>
      ) : results.length > 0 ? (
        <>
          <SectionTitle>{results.length === 1 ? "1 match" : `${results.length} matches`}</SectionTitle>
          <Group items={results} />
        </>
      ) : (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
            <MagnifyingGlass size={28} color={theme.muted} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No matches</Text>
          <Text style={[styles.emptyBody, { color: theme.muted }]}>
            {`Nothing matched "${search.trim()}". Try a shorter word, or clear the search to browse everything.`}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40 },

  title: { fontSize: 28, fontWeight: "700" },
  subtitle: { fontSize: 14, marginTop: 2 },

  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    marginTop: 20,
    paddingLeft: 14,
    paddingRight: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    alignSelf: "stretch",
    fontSize: 16,
    paddingVertical: 0,
    paddingRight: 10,
  },
  clearButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 28,
    marginBottom: 10,
  },

  tileGrid: { gap: 12 },
  tileRow: { flexDirection: "row", gap: 12 },
  tile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  tileTitle: { fontSize: 16, fontWeight: "600" },
  tileDesc: { fontSize: 13, lineHeight: 18, marginTop: 2 },

  iconCircle: { alignItems: "center", justifyContent: "center" },

  group: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  row: {
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowDesc: { fontSize: 13, marginTop: 2 },

  empty: { alignItems: "center", paddingTop: 40, paddingHorizontal: 24 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
  },

  pressed: { opacity: 0.7 },
});
