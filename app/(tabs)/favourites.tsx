import React, { useMemo, useState } from "react";
import { View, Text, Image, FlatList, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";

import { useTheme } from "../../src/styles/ThemeContext";

import { FlipRecord } from "@/features/vehicles/models/FlipRecord";
import { useVehicleHistory } from "@/features/vehicles/context/VehicleHistoryContext";

export default function FavouritesScreen() {
  const theme = useTheme();
  const s = styles(theme);

  const { vehicles, deleteVehicle, toggleFavourite } = useVehicleHistory();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const favourites = useMemo(() => {
    return [...vehicles]
      .filter((v) => v.favourite)
      .sort(
        (a, b) => Number(new Date(b.timestamp)) - Number(new Date(a.timestamp))
      );
  }, [vehicles]);

  const handleDelete = (id: string) => {
    deleteVehicle(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleUnsave = (id: string) => {
    toggleFavourite(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const openDetails = (item: FlipRecord) => {
    router.push(`/vehicles/details/${item.id}`);
  };

  const renderItem = ({ item }: { item: FlipRecord }) => {
    const safeBuy = Number(item.pricing?.recommendedBuyPrice ?? item.buyPrice ?? 0);
    const safeSell = Number(item.pricing?.recommendedSellPrice ?? item.sellPrice ?? 0);
    const profit = Number(item.pricing?.predictedProfit ?? item.profit ?? 0);
    const roi = safeBuy > 0 ? (profit / safeBuy) * 100 : 0;
    const flipScore = item.flipScore ?? 0;

    return (
      <Pressable style={s.card} onPress={() => openDetails(item)}>
        {/* IMAGE */}
        {item.images?.[0] && (
          <View style={s.imageWrapper}>
            <Image source={{ uri: item.images[0] }} style={s.image} />
          </View>
        )}

        {/* TITLE */}
        <Text style={s.name}>🚗 {item.title}</Text>

        {/* MONEY */}
        <View style={s.row}>
          <Text style={s.text}>Buy: £{safeBuy.toFixed(2)}</Text>
          <Text style={s.text}>Sell: £{safeSell.toFixed(2)}</Text>
        </View>

        {/* PROFIT */}
        <Text
          style={[
            s.profit,
            { color: profit >= 0 ? theme.success : theme.danger },
          ]}
        >
          £{profit.toFixed(2)}
        </Text>

        {/* BADGES */}
        <View style={s.badgeRow}>
          <Text style={s.roiBadge}>ROI {roi.toFixed(0)}%</Text>

          <Text style={s.confBadge}>Score {flipScore}</Text>

          <Text style={s.favBadge}>⭐ Favourite</Text>
        </View>

        {/* BUTTONS */}
        <View style={s.buttonRow}>
          <Pressable style={s.unsave} onPress={() => handleUnsave(item.id)}>
            <Text style={s.unsaveText}>⭐ Unsave</Text>
          </Pressable>

          <Pressable style={s.delete} onPress={() => setConfirmId(item.id)}>
            <Text style={s.deleteText}>🗑🔥 Bin It</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={s.container}>
      <Text style={s.title}>⭐ Favourites</Text>

      {favourites.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={s.empty}>⭐ No favourites yet</Text>
          <Text style={s.sub}>Save your best flips</Text>
        </View>
      ) : (
        <FlatList
          data={favourites}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      {/* CONFIRM DELETE MODAL */}
      {confirmId && (
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Bin this flip? 🔥</Text>
            <Text style={s.modalText}>Once it's gone… it's gone.</Text>

            <View style={s.modalBtns}>
              <Pressable style={s.cancelBtn} onPress={() => setConfirmId(null)}>
                <Text style={s.cancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={s.deleteBtn}
                onPress={() => {
                  handleDelete(confirmId);
                  setConfirmId(null);
                }}
              >
                <Text style={s.deleteText}>🗑🔥 Bin It</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      padding: 20,
    },
    title: {
      fontSize: 30,
      fontWeight: "900",
      color: theme.accent,
      marginBottom: 10,
    },
    emptyBox: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    empty: {
      fontSize: 20,
      color: theme.accent,
      fontWeight: "900",
    },
    sub: {
      color: theme.muted,
      marginTop: 5,
    },
    card: {
      backgroundColor: theme.card,
      padding: 16,
      borderRadius: 16,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: theme.secondary,
    },
    imageWrapper: {
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.accent,
    },
    image: {
      height: 140,
      width: "100%",
    },
    name: {
      fontSize: 18,
      fontWeight: "900",
      color: theme.accent,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    text: {
      color: theme.muted,
    },
    profit: {
      fontSize: 22,
      fontWeight: "900",
      marginTop: 5,
    },
    badgeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 6,
    },
    roiBadge: {
      backgroundColor: theme.secondary,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 10,
      color: theme.muted,
      fontWeight: "700",
    },
    confBadge: {
      backgroundColor: theme.accent,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 10,
      color: theme.black,
      fontWeight: "700",
    },
    favBadge: {
      backgroundColor: theme.accent,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 10,
      color: theme.black,
      fontWeight: "900",
    },
    buttonRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 10,
    },
    unsave: {
      flex: 1,
      backgroundColor: theme.accent,
      padding: 12,
      borderRadius: 12,
      alignItems: "center",
    },
    unsaveText: {
      fontWeight: "900",
      color: theme.black,
    },
    delete: {
      flex: 1,
      backgroundColor: theme.danger,
      padding: 12,
      borderRadius: 12,
      alignItems: "center",
    },
    deleteText: {
      color: theme.white,
      fontWeight: "900",
    },
    overlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      alignItems: "center",
    },
    modal: {
      backgroundColor: theme.card,
      padding: 25,
      borderRadius: 20,
      width: "85%",
      borderWidth: 2,
      borderColor: theme.accent,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: "900",
      color: theme.accent,
      textAlign: "center",
    },
    modalText: {
      color: theme.muted,
      textAlign: "center",
      marginTop: 10,
    },
    modalBtns: {
      flexDirection: "row",
      marginTop: 20,
      gap: 10,
    },
    cancelBtn: {
      flex: 1,
      backgroundColor: "#1B2A49",
      padding: 14,
      borderRadius: 12,
      alignItems: "center",
    },
    cancelText: {
      color: theme.muted,
      fontWeight: "900",
    },
    deleteBtn: {
      flex: 1,
      backgroundColor: theme.danger,
      padding: 14,
      borderRadius: 12,
      alignItems: "center",
    },
  });
