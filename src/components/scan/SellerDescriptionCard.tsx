import React, { useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Copy, Eye } from "phosphor-react-native";

import { useTheme } from "@/styles/ThemeContext";
import { describeApiError, writeListingDescription } from "@/utils/api";
import { copyText } from "@/utils/copyText";

type Props = {
  title: string;
  condition?: string | null;
  age?: string | null;
  /** What the scan already wrote about the item from the photo. */
  intro?: string | null;
  packCount?: number | null;
};

/**
 * "Description to sell it": a listing description the AI writes on request, from
 * what the scan knows, ready to paste into whichever marketplace they sell on.
 * Written only when asked for (so a scan nobody wants it for costs nothing), and
 * kept for the rest of the visit so Copy and View share one description.
 */
export default function SellerDescriptionCard({ title, condition, age, intro, packCount }: Props) {
  const theme = useTheme();

  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = (message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2500);
  };

  /** The description, written now if it has not been yet. */
  const ensureText = async (): Promise<string | null> => {
    if (text) return text;
    setBusy(true);
    setError(null);
    try {
      const written = await writeListingDescription({ title, condition, age, intro, packCount });
      setText(written);
      return written;
    } catch (err) {
      setError(describeApiError(err));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (busy) return;
    const body = await ensureText();
    if (!body) return;
    const how = await copyText(body);
    if (how === "copied") say("Copied. Paste it into your listing.");
    else if (how === "failed") setError("Couldn't copy it. Open the full description and select the text instead.");
  };

  const view = async () => {
    if (busy) return;
    if (await ensureText()) setViewing(true);
  };

  const button = (kind: "solid" | "outline") => [
    styles.button,
    kind === "solid"
      ? { backgroundColor: theme.gold }
      : { borderWidth: 1, borderColor: theme.gold },
    busy && { opacity: 0.6 },
  ];

  return (
    <>
      <Text style={[styles.sectionTitle, { color: theme.text }]} accessibilityRole="header">
        Description to sell it
      </Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
        <Text style={[styles.help, { color: theme.muted }]}>
          Let the AI write a listing description for this item that you can paste into eBay,
          Facebook or Gumtree. Read it through and correct anything that isn't true of yours.
        </Text>

        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copy the description text"
            disabled={busy}
            onPress={copy}
            style={({ pressed }) => [...button("solid"), pressed && { opacity: 0.85 }]}
          >
            {busy ? (
              <ActivityIndicator color={theme.black} />
            ) : (
              <>
                <Copy size={18} color={theme.black} weight="bold" />
                <Text style={[styles.buttonText, { color: theme.black }]}>Copy text</Text>
              </>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View the full description"
            disabled={busy}
            onPress={view}
            style={({ pressed }) => [...button("outline"), pressed && { opacity: 0.85 }]}
          >
            <Eye size={18} color={theme.gold} weight="bold" />
            <Text style={[styles.buttonText, { color: theme.gold }]}>View full description</Text>
          </Pressable>
        </View>

        {busy ? (
          <Text style={[styles.status, { color: theme.muted }]}>Writing your description…</Text>
        ) : null}
        {notice ? (
          <Text style={[styles.status, { color: theme.success }]} accessibilityLiveRegion="polite">
            {notice}
          </Text>
        ) : null}
        {error ? (
          <Text style={[styles.status, { color: theme.danger }]} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </View>

      <Modal visible={viewing} transparent animationType="slide" onRequestClose={() => setViewing(false)}>
        <Pressable style={styles.overlay} onPress={() => setViewing(false)}>
          <Pressable
            onPress={() => {}}
            style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.hairline }]}
          >
            <Text style={[styles.sheetTitle, { color: theme.gold }]}>Full description</Text>
            <Text style={[styles.sheetHint, { color: theme.muted }]}>
              Fill in the "Add:" line yourself before you post it.
            </Text>

            <ScrollView style={styles.sheetBody}>
              <Text selectable style={{ color: theme.text, fontSize: 15, lineHeight: 22 }}>
                {text}
              </Text>
            </ScrollView>

            <View style={styles.row}>
              <Pressable onPress={copy} style={({ pressed }) => [...button("solid"), pressed && { opacity: 0.85 }]}>
                <Copy size={18} color={theme.black} weight="bold" />
                <Text style={[styles.buttonText, { color: theme.black }]}>Copy text</Text>
              </Pressable>
              <Pressable
                onPress={() => setViewing(false)}
                style={({ pressed }) => [...button("outline"), pressed && { opacity: 0.85 }]}
              >
                <Text style={[styles.buttonText, { color: theme.gold }]}>Close</Text>
              </Pressable>
            </View>

            {notice ? (
              <Text style={[styles.status, { color: theme.success }]}>{notice}</Text>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 24, marginBottom: 12 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  help: { fontSize: 13, lineHeight: 19 },
  row: { flexDirection: "row", gap: 10 },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    minHeight: 46,
  },
  buttonText: { fontSize: 14, fontWeight: "800", flexShrink: 1, textAlign: "center" },
  status: { fontSize: 13 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 20,
    paddingBottom: 32,
    gap: 10,
    maxHeight: "85%",
  },
  sheetTitle: { fontSize: 20, fontWeight: "800" },
  sheetHint: { fontSize: 13 },
  sheetBody: { maxHeight: 340 },
});
