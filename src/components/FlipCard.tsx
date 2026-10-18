import {
  CheckCircle,
  Diamond,
  Fire,
  Heart,
  Lightning,
  Package,
  ShareNetwork,
  ShoppingBag,
  Storefront,
  Tag,
  Trash,
  TrendUp,
  XCircle,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import BoughtSheet from "@/components/BoughtSheet";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";
import { boughtPatch, boughtState, notBoughtPatch } from "@/features/vehicles/utils/boughtStatus";

import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import {
  getBuyPrice,
  getProfit,
  getSellPrice,
  hasBuyPrice,
  hasProfit,
  hasSellPrice,
} from "@/features/vehicles/utils/flipMoney";
import { formatMoney, formatSignedMoney } from "@/features/vehicles/utils/vehicleStats";
import { useTheme } from "@/styles/ThemeContext";
import { shareFlip } from "@/utils/share/shareFlip";

const HAIRLINE = "rgba(255, 255, 255, 0.08)";

// The buy/sell/profit readers now live in flipMoney.ts (so they can be checked and shared with the
// totals); they are re-exported here because other screens import them from this file.
export { getBuyPrice, getSellPrice, getProfit, hasBuyPrice, hasSellPrice, hasProfit };

// Small icon + text pill used for the facts on a flip card.
const MetaChip = ({
  Icon,
  label,
  accent,
}: {
  Icon?: PhosphorIcon;
  label: string;
  accent?: boolean;
}) => {
  const theme = useTheme();

  return (
    <View style={[styles.chip, { backgroundColor: theme.background }]}>
      {Icon ? (
        <Icon
          size={14}
          color={accent ? theme.gold : theme.muted}
          weight={accent ? "fill" : "regular"}
        />
      ) : null}
      <Text
        style={[styles.chipText, { color: accent ? theme.gold : theme.text }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
};

type Props = {
  item: FlipRecord;
  onOpen: () => void;
  onToggleFavourite: () => void;
  onDelete: () => void;
};

// One saved flip, as shown in History and Favourites. The summary is the
// tappable area; the actions sit beside it so each is its own button.
export default function FlipCard({ item, onOpen, onToggleFavourite, onDelete }: Props) {
  const theme = useTheme();
  const { updateVehicle } = useVehicleHistory();
  // "Did you buy it?" is asked from the card itself; the sheet is only mounted while it is open so a long
  // History list does not carry a pop-up per card.
  const [asking, setAsking] = useState(false);
  const bought = boughtState(item);

  const buy = getBuyPrice(item);
  const sell = getSellPrice(item);
  const profit = getProfit(item);
  const profitKnown = hasProfit(item);
  // A return is only real for something they bought. Until then the buy price is the scan's own suggestion (a
  // fixed share of the sell price), whose ROI would be a formula, the same on every scan, so it shows "-".
  const roiKnown = profitKnown && buy > 0 && bought === "bought";
  const roi = roiKnown ? (profit / buy) * 100 : 0;
  const roiColor = roi > 50 ? theme.success : roi > 0 ? theme.gold : theme.danger;

  const thumb =
    typeof item.images?.[0] === "string" && item.images[0].trim().length > 0
      ? item.images[0]
      : null;

  // Until the person says they bought it, the profit is only an estimate (and is not in any total).
  const counts = bought === "bought";
  const profitColor = !profitKnown || !counts ? theme.muted : profit >= 0 ? theme.success : theme.danger;
  const profitText = profitKnown ? (counts ? formatSignedMoney(profit) : `Est. ${formatSignedMoney(profit)}`) : "-";

  const status =
    bought === "bought"
      ? { Icon: CheckCircle, label: hasBuyPrice(item) ? `Bought for ${formatMoney(buy)}` : "Bought", color: theme.success, border: theme.hairline }
      : bought === "not-bought"
      ? { Icon: XCircle, label: "Not bought", color: theme.muted, border: theme.hairline }
      : { Icon: ShoppingBag, label: "Did you buy it?", color: theme.gold, border: theme.gold };

  const share = () =>
    shareFlip({
      title: item.title,
      buyPrice: buy,
      sellPrice: sell,
      // No buy price means no meaningful ROI; leave it as "-".
      roi: buy > 0 ? Math.round(roi) : null,
      profit,
      // The AI's confidence in its price (0-100). Not conditionScore: that is a 1-10 score for the item's state.
      // Confidence and origin are left out of the text when unknown.
      confidence: item.aiPriceConfidence ?? null,
      origin: item.ai?.origin ?? null,
      description: item.ai?.description || "",
      image: item.images?.[0],
      flipScore: item.flipScore ?? null,
    });

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: HAIRLINE }]}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={
          profitKnown
            ? `${item.title}, ${counts ? "" : "estimated "}${profit >= 0 ? "profit" : "loss"} of ${formatMoney(Math.abs(profit))}. Open details`
            : `${item.title}. Open details`
        }
        style={({ pressed }) => pressed && styles.pressed}
      >
        <View style={styles.top}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.thumb} />
          ) : (
            <View
              style={[styles.thumb, styles.thumbEmpty, { backgroundColor: theme.background }]}
            >
              <Package size={26} color={theme.muted} />
            </View>
          )}

          <View style={styles.main}>
            <Text numberOfLines={2} style={[styles.title, { color: theme.text }]}>
              {item.title}
            </Text>
            <Text style={[styles.profit, { color: profitColor }]}>{profitText}</Text>
            <Text style={[styles.summary, { color: theme.muted }]} numberOfLines={1}>
              Buy {hasBuyPrice(item) ? formatMoney(buy) : "-"} · Sell{" "}
              {hasSellPrice(item) ? formatMoney(sell) : "-"} ·{" "}
              <Text style={{ color: roiKnown ? roiColor : theme.muted }}>
                ROI {roiKnown ? `${roi.toFixed(0)}%` : "-"}
              </Text>
            </Text>
          </View>
        </View>

        <View style={styles.chips}>
          {item.flipScore != null && <MetaChip Icon={Fire} label={`Score ${item.flipScore}`} />}
          {item.sellSpeed != null && <MetaChip Icon={Lightning} label={String(item.sellSpeed)} />}
          {item.market?.demandScore != null && (
            <MetaChip Icon={TrendUp} label={`Demand ${item.market.demandScore}`} />
          )}
          {item.rarity != null && <MetaChip Icon={Diamond} label={String(item.rarity)} />}
          {item.ai?.condition ? <MetaChip Icon={Tag} label={item.ai.condition} /> : null}
          {item.aiPriceConfidence != null && (
            <MetaChip label={`Conf ${item.aiPriceConfidence.toFixed(0)}%`} />
          )}
        </View>
      </Pressable>

      <View style={styles.actions}>
        {/* Whether it was bought, and for what: the answer decides if it counts towards the profit totals. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${status.label}. Tap to change`}
          style={({ pressed }) => [styles.statusPill, { borderColor: status.border }, pressed && styles.pressed]}
          onPress={() => setAsking(true)}
        >
          <status.Icon size={16} weight={bought === "unconfirmed" ? "bold" : "fill"} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]} numberOfLines={1}>
            {status.label}
          </Text>
        </Pressable>
        <View style={styles.actionsSpacer} />

        {/* Straight to a listing, carrying this flip's photo and everything
            the scan already worked out. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sell this on the marketplace"
          style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
          onPress={() =>
            router.push(`/marketplace/create/new?fromFlip=${encodeURIComponent(item.id)}`)
          }
        >
          <Storefront size={22} color={theme.gold} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share flip"
          style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
          onPress={share}
        >
          <ShareNetwork size={22} color={theme.muted} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.favourite ? "Remove from favourites" : "Add to favourites"}
          style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
          onPress={onToggleFavourite}
        >
          <Heart
            size={22}
            weight={item.favourite ? "fill" : "regular"}
            color={item.favourite ? theme.gold : theme.muted}
          />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete flip"
          style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
          onPress={onDelete}
        >
          <Trash size={22} color={theme.danger} />
        </Pressable>
      </View>

      {asking ? (
        <BoughtSheet
          visible
          context="saved"
          itemTitle={item.title}
          suggestedPrice={hasBuyPrice(item) ? buy : null}
          currentlyPaid={bought === "bought" && hasBuyPrice(item) ? buy : null}
          onBought={(paid) => {
            updateVehicle(item.id, boughtPatch(paid));
            setAsking(false);
          }}
          onNotBought={() => {
            updateVehicle(item.id, notBoughtPatch());
            setAsking(false);
          }}
          onClose={() => setAsking(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  thumbEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  main: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 21,
  },
  profit: {
    fontSize: 22,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  summary: {
    fontSize: 13,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
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
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  actionsSpacer: { flex: 1 },
  statusPill: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: { fontSize: 13, fontWeight: "700", flexShrink: 1 },
  actionBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
});
