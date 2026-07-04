import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useTheme } from "../../src/context/ThemeContext";
import { FlipRecord } from "../../src/models/FlipRecord";


const STORAGE_KEY = "@flippilot_history";

export default function FavouritesScreen() {
  const theme = useTheme();
  const s = styles(theme);

  const [favourites, setFavourites] = useState<FlipRecord[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const loadFavourites = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: FlipRecord[] = data ? JSON.parse(data) : [];

      const favs = parsed.filter((item) => item.favourite);

      const sorted = [...favs].sort(
        (a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0)
      );

      setFavourites(sorted);
    } catch {
      setFavourites([]);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadFavourites();
    }, [])
  );

  const deleteFlip = async (id: string) => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: FlipRecord[] = data ? JSON.parse(data) : [];

      const updated = parsed.filter((item) => item.id !== id);

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      loadFavourites();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.log("Delete error:", e);
    }
  };

  const toggleFavourite = async (id: string) => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: FlipRecord[] = data ? JSON.parse(data) : [];

      const updated = parsed.map((item) =>
        item.id === id ? { ...item, favourite: false } : item
      );

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      loadFavourites();

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.log("Toggle error:", e);
    }
  };

  const openDetails = (item: FlipRecord) => {
    router.push({
      pathname: "/flip/[id]",
      params: { id: item.id },
    });
  };

  const renderItem = ({ item }: { item: FlipRecord }) => {
    const buy = item.pricing?.recommendedBuyPrice ?? null;
    const sell = item.pricing?.recommendedSellPrice ?? null;
    const profit = item.pricing?.predictedProfit ?? null;

    const roi =
      buy && profit ? Math.round((profit / buy) * 100) : null;

    const confidence = item.ai?.conditionScore ?? null;

    return (
      <Pressable style={s.card} onPress={() => openDetails(item)}>
        {item.image && (
          <View style={s.imageWrapper}>
            <Image source={{ uri: item.image }} style={s.image} />
          </View>
        )}

        <Text style={s.name}>📦 {item.title}</Text>

        <View style={s.row}>
          <Text style={s.text}>Buy: £{buy?.toFixed(2) ?? "-"}</Text>
          <Text style={s.text}>Sell: £{sell?.toFixed(2) ?? "-"}</Text>
        </View>

        <Text
          style={[
            s.profit,
            { color: (profit ?? 0) >= 0 ? theme.success : theme.danger },
          ]}
        >
          £{profit?.toFixed(2) ?? "-"}
        </Text>

        <View style={s.badgeRow}>
          <Text style={s.roiBadge}>
            ROI {roi != null ? `${roi}%` : "-"}
          </Text>

          {confidence != null && (
            <Text style={s.confBadge}>
              Conf {confidence.toFixed(0)}%
            </Text>
          )}

          <Text style={s.favBadge}>⭐ Favourite</Text>
        </View>

        <View style={s.buttonRow}>
          <Pressable
            style={s.unsave}
            onPress={() => toggleFavourite(item.id)}
          >
            <Text style={s.unsaveText}>⭐ Unsave</Text>
          </Pressable>

          <Pressable
            style={s.delete}
            onPress={() => setConfirmId(item.id)}
          >
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
          showsVerticalScrollIndicator={false}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      {confirmId && (
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Bin this flip? 🔥</Text>
            <Text style={s.modalText}>
              Once it's gone… it's gone.
            </Text>

            <View style={s.modalBtns}>
              <Pressable
                style={s.cancelBtn}
                onPress={() => setConfirmId(null)}
              >
                <Text style={s.cancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={s.deleteBtn}
                onPress={() => {
                  deleteFlip(confirmId);
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
      backgroundColor: "#2979FF",
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 10,
      color: theme.white,
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
