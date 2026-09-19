import {
  Diamond,
  Fire,
  Heart,
  Lightning,
  Package,
  ShareNetwork,
  Tag,
  Trash,
  TrendUp,
} from "phosphor-react-native";
import type { Icon as PhosphorIcon } from "phosphor-react-native";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { formatMoney, formatSignedMoney } from "@/features/vehicles/utils/vehicleStats";
import { useTheme } from "@/styles/ThemeContext";
import { shareFlip } from "@/utils/share/shareFlip";

const HAIRLINE = "rgba(255, 255, 255, 0.08)";

// Buy/sell/profit live at the top level of a record, and that is where edits
// write them (a cleared price is stored as null). `pricing` only holds the
// original scan estimate, so it is used only for a record with no top-level
// prices at all.
const hasOwnPrices = (f: FlipRecord) =>
  f.buyPrice != null || f.sellPrice != null || f.profit != null;
const rawBuy = (f: FlipRecord) => (hasOwnPrices(f) ? f.buyPrice : f.pricing?.recommendedBuyPrice);
const rawSell = (f: FlipRecord) =>
  hasOwnPrices(f) ? f.sellPrice : f.pricing?.recommendedSellPrice;
const rawProfit = (f: FlipRecord) => (hasOwnPrices(f) ? f.profit : f.pricing?.predictedProfit);

export const getBuyPrice = (f: FlipRecord) => Number(rawBuy(f) ?? 0);
export const getSellPrice = (f: FlipRecord) => Number(rawSell(f) ?? 0);
export const getProfit = (f: FlipRecord) => Number(rawProfit(f) ?? 0);

// getProfit counts a missing figure as 0 so totals still add up. These say
// whether there was a real figure, so a card can show "-" instead of £0.00.
export const hasBuyPrice = (f: FlipRecord) => rawBuy(f) != null;
export const hasSellPrice = (f: FlipRecord) => rawSell(f) != null;
export const hasProfit = (f: FlipRecord) => rawProfit(f) != null;

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

  const buy = getBuyPrice(item);
  const sell = getSellPrice(item);
  const profit = getProfit(item);
  const profitKnown = hasProfit(item);
  const roiKnown = profitKnown && buy > 0;
  const roi = roiKnown ? (profit / buy) * 100 : 0;
  const roiColor = roi > 50 ? theme.success : roi > 0 ? theme.gold : theme.danger;

  const thumb =
    typeof item.images?.[0] === "string" && item.images[0].trim().length > 0
      ? item.images[0]
      : null;

  const profitColor = !profitKnown ? theme.muted : profit >= 0 ? theme.success : theme.danger;
  const profitText = profitKnown ? formatSignedMoney(profit) : "-";

  const share = () =>
    shareFlip({
      title: item.title,
      buyPrice: buy,
      sellPrice: sell,
      // No buy price means no meaningful ROI; leave it as "-".
      roi: buy > 0 ? Math.round(roi) : null,
      profit,
      // Scanned flips store the AI's confidence as conditionScore.
      // Confidence and origin are left out of the text when unknown.
      confidence: item.ai?.conditionScore ?? item.aiPriceConfidence ?? null,
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
            ? `${item.title}, ${profit >= 0 ? "profit" : "loss"} of ${formatMoney(Math.abs(profit))}. Open details`
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
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 8,
  },
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
