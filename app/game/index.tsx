import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  runOnJS,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/styles/ThemeContext";
import Lampy, { Mood } from "@/game/Lampy";
import ItemArt from "@/game/DashArt";
import Backdrop from "@/game/Backdrop";
import { play } from "@/game/sound";
import {
  ItemKind,
  STARTING_BAGS,
  dropGap,
  earnsMagnet,
  fallSpeed,
  formatMoney,
  isCaught,
  payout,
  randomDrop,
  verdict,
  MAGNET_MS,
  GOLDEN_MAGNET_MS,
} from "@/game/dashLogic";

const BEST_KEY = "flippilot.dash.best";

/** How many item sprites exist. They are recycled, never created mid-run. */
const SLOTS = 14;
const ITEM = 62;

type SlotState = { kind: ItemKind; golden: boolean } | null;

export default function BootFairDash() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();

  const LAMPY_W = Math.min(160, W * 0.38);
  const LAMPY_H = LAMPY_W * 1.6;
  const FLOOR_PAD = 8;
  const lampyTop = H - LAMPY_H - FLOOR_PAD - insets.bottom;

  /* ---------------- shared values: the moving parts ---------------- */
  // One set per slot. Reanimated needs these created up front, not in a loop
  // that could change length, so the pool is fixed.
  const xs = Array.from({ length: SLOTS }, () => useSharedValue(0));
  const ys = Array.from({ length: SLOTS }, () => useSharedValue(-999));
  const rots = Array.from({ length: SLOTS }, () => useSharedValue(0));
  const alive = Array.from({ length: SLOTS }, () => useSharedValue(0));
  const isTat = Array.from({ length: SLOTS }, () => useSharedValue(0));

  const lampX = useSharedValue(W / 2);
  const lampTarget = useSharedValue(W / 2);
  const bob = useSharedValue(0);
  const squash = useSharedValue(0);
  const magnetUntil = useSharedValue(0);
  // Lampy's own movement, all driven from the loop so it never hits React.
  const armSwing = useSharedValue(0);
  const lookAt = useSharedValue(0);
  const headTilt = useSharedValue(0);
  const elapsed = useSharedValue(0);
  const running = useSharedValue(0);

  /* ---------------- react state: the rare changes ---------------- */
  const [slots, setSlots] = useState<SlotState[]>(() => Array(SLOTS).fill(null));
  const [takings, setTakings] = useState(0);
  const [bags, setBags] = useState(STARTING_BAGS);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(1);
  const [lasted, setLasted] = useState(0);
  const [caught, setCaught] = useState(0);
  const [best, setBest] = useState(0);
  const [phase, setPhase] = useState<"ready" | "playing" | "over">("ready");
  const [mood, setMood] = useState<Mood>("idle");
  const [magnetOn, setMagnetOn] = useState(false);
  const [pops, setPops] = useState<{ id: number; x: number; y: number; text: string; kind: string }[]>([]);

  // Read in callbacks that run off the UI thread, where React state would be stale.
  const comboRef = useRef(0);
  const bagsRef = useRef(STARTING_BAGS);
  const takingsRef = useRef(0);
  const slotsRef = useRef<SlotState[]>(Array(SLOTS).fill(null));
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spawnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popId = useRef(0);
  const startedAt = useRef(0);
  const caughtRef = useRef(0);

  useEffect(() => {
    AsyncStorage.getItem(BEST_KEY)
      .then((v) => setBest(Number(v) || 0))
      .catch(() => {});
  }, []);

  /* ---------------- little helpers ---------------- */
  const showMood = useCallback((m: Mood, ms: number) => {
    setMood(m);
    if (moodTimer.current) clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => setMood("idle"), ms);
  }, []);

  const addPop = useCallback((x: number, y: number, text: string, kind: string) => {
    const id = popId.current++;
    setPops((p) => [...p, { id, x, y, text, kind }]);
    setTimeout(() => setPops((p) => p.filter((q) => q.id !== id)), 850);
  }, []);

  const clearField = useCallback(() => {
    for (let i = 0; i < SLOTS; i++) {
      alive[i].value = 0;
      ys[i].value = -999;
    }
    slotsRef.current = Array(SLOTS).fill(null);
    setSlots(Array(SLOTS).fill(null));
  }, [alive, ys]);

  /* ---------------- spawning happens in JS ----------------
     Only a couple of times a second, and picking what falls needs the item
     list, so there is nothing to gain from doing it on the UI thread — and
     a slot must know what it is before it is shown, or it flickers as the
     previous item for one frame. */
  const spawnOne = useCallback(() => {
    const free = alive.findIndex((a) => a.value === 0);
    if (free === -1) return;

    const drop = randomDrop(elapsed.value);
    const next = [...slotsRef.current];
    next[free] = { kind: drop.kind, golden: drop.golden };
    slotsRef.current = next;
    setSlots(next);

    xs[free].value = 18 + Math.random() * Math.max(1, W - ITEM - 36);
    ys[free].value = -ITEM;
    rots[free].value = (Math.random() - 0.5) * 40;
    isTat[free].value = drop.kind.tat ? 1 : 0;
    alive[free].value = 1;
  }, [W, alive, elapsed, isTat, rots, xs, ys]);

  const scheduleSpawn = useCallback(() => {
    const secs = (Date.now() - startedAt.current) / 1000;
    const gap = dropGap(secs) * (0.7 + Math.random() * 0.6);
    spawnTimer.current = setTimeout(() => {
      spawnOne();
      scheduleSpawn();
    }, gap);
  }, [spawnOne]);

  /* ---------------- what a catch or a knock means ---------------- */
  const onCatch = useCallback(
    (slot: number, cx: number, cy: number) => {
      const s = slotsRef.current[slot];
      if (!s) return;

      caughtRef.current += 1;
      setCaught(caughtRef.current);

      const nextCombo = comboRef.current + 1;
      comboRef.current = nextCombo;
      setCombo(nextCombo);
      setBestCombo((b) => Math.max(b, nextCombo));

      const gained = payout(s.kind.value, nextCombo, s.golden);
      takingsRef.current += gained;
      setTakings(takingsRef.current);

      addPop(cx, cy, "+" + formatMoney(gained), s.golden ? "gold" : "good");
      showMood(s.golden ? "star" : "joy", s.golden ? 900 : 320);
      play(s.golden ? "golden" : "catch");
      Haptics.impactAsync(
        s.golden ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light
      ).catch(() => {});

      if (s.golden) magnetUntil.value = Date.now() + GOLDEN_MAGNET_MS;
      else if (earnsMagnet(nextCombo)) magnetUntil.value = Date.now() + MAGNET_MS;
    },
    [addPop, magnetUntil, showMood]
  );

  const endRun = useCallback(() => {
    running.value = 0;
    setLasted(Math.round((Date.now() - startedAt.current) / 1000));
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    play("over");
    setPhase("over");

    const score = takingsRef.current;
    setBest((b) => {
      if (score > b) {
        AsyncStorage.setItem(BEST_KEY, String(score)).catch(() => {});
        return score;
      }
      return b;
    });
  }, [running]);

  const onTat = useCallback(
    (cx: number, cy: number) => {
      comboRef.current = 0;
      setCombo(0);
      addPop(cx, cy, "tat!", "bad");
      showMood("hurt", 520);
      play("tat");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      squash.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 260 }));

      bagsRef.current -= 1;
      setBags(bagsRef.current);
      if (bagsRef.current <= 0) endRun();
    },
    [addPop, endRun, showMood, squash]
  );

  /** A bargain hitting the floor breaks the run, but costs no bag. */
  const onMissed = useCallback(() => {
    if (comboRef.current >= 2) {
      comboRef.current = 0;
      setCombo(0);
    } else {
      comboRef.current = 0;
      setCombo(0);
    }
  }, []);

  const setMagnetFlag = useCallback((on: boolean) => setMagnetOn(on), []);

  /* ---------------- the loop, on the UI thread ---------------- */
  useFrameCallback((info) => {
    "worklet";
    const dt = Math.min(0.05, (info.timeSincePreviousFrame ?? 16) / 1000);
    elapsed.value += dt;

    if (running.value === 0) {
      // Between runs he still breathes, swings and looks about, so the title
      // card has somebody alive on it rather than a drawing.
      bob.value = Math.sin(elapsed.value * 2.2) * 5;
      armSwing.value = Math.sin(elapsed.value * 1.6) * 10;
      headTilt.value = Math.sin(elapsed.value * 1.1) * 2.5;
      lookAt.value = Math.sin(elapsed.value * 0.8) * 0.7;
      lampX.value += (W / 2 - lampX.value) * Math.min(1, dt * 6);
      return;
    }

    // He eases towards your thumb instead of snapping to it, which is what
    // makes a near miss feel like your fault and not the game's.
    const before = lampX.value;
    lampX.value += (lampTarget.value - lampX.value) * Math.min(1, dt * 14);
    bob.value = Math.sin(elapsed.value * 3) * 4;

    // How hard he is running decides how far his arms fly out, on top of a
    // gentle idle swing so he is never completely still.
    const vel = (lampX.value - before) / Math.max(dt, 0.001);
    const idleSwing = Math.sin(elapsed.value * 5) * 7;
    const target = Math.max(-38, Math.min(38, vel * 0.055)) + idleSwing;
    armSwing.value += (target - armSwing.value) * Math.min(1, dt * 10);

    // The shade is the heavy end: it arrives after the rest of him.
    const tiltTarget = Math.max(-14, Math.min(14, -vel * 0.022));
    headTilt.value += (tiltTarget - headTilt.value) * Math.min(1, dt * 6);

    const now = Date.now();
    const magnet = now < magnetUntil.value;
    const speed = fallSpeed(elapsed.value);
    const lx = lampX.value;

    // Whatever is closest to landing is what he watches.
    let watchX = lx;
    let watchY = -1;

    for (let i = 0; i < SLOTS; i++) {
      if (alive[i].value === 0) continue;

      ys[i].value += speed * dt;
      rots[i].value += 26 * dt;

      // The magnet only pulls what is worth having.
      if (magnet && isTat[i].value === 0) {
        xs[i].value += (lx - (xs[i].value + ITEM / 2)) * Math.min(1, dt * 3.2);
      }

      const cx = xs[i].value + ITEM / 2;
      const cy = ys[i].value + ITEM / 2;

      if (isTat[i].value === 0 && cy > watchY) {
        watchY = cy;
        watchX = cx;
      }

      if (isCaught(cx, cy, lx, lampyTop, LAMPY_W, LAMPY_H)) {
        alive[i].value = 0;
        ys[i].value = -999;
        if (isTat[i].value === 1) runOnJS(onTat)(cx, cy);
        else runOnJS(onCatch)(i, cx, cy);
        continue;
      }

      if (ys[i].value > H + 30) {
        alive[i].value = 0;
        ys[i].value = -999;
        if (isTat[i].value === 0) runOnJS(onMissed)();
      }
    }

    const wantLook = Math.max(-1, Math.min(1, (watchX - lx) / (W * 0.4)));
    lookAt.value += (wantLook - lookAt.value) * Math.min(1, dt * 7);
  });

  // The sunglasses are React state, so the flag is synced once a second
  // rather than every frame.
  useEffect(() => {
    if (phase !== "playing") return;
    const t = setInterval(() => {
      setMagnetFlag(Date.now() < magnetUntil.value);
    }, 200);
    return () => clearInterval(t);
  }, [phase, magnetUntil, setMagnetFlag]);

  /* ---------------- starting and stopping ---------------- */
  const startRun = useCallback(() => {
    clearField();
    comboRef.current = 0;
    bagsRef.current = STARTING_BAGS;
    takingsRef.current = 0;
    startedAt.current = Date.now();

    setCombo(0);
    setBags(STARTING_BAGS);
    setTakings(0);
    setBestCombo(1);
    setLasted(0);
    setCaught(0);
    caughtRef.current = 0;
    setMood("idle");
    setPops([]);
    setPhase("playing");

    elapsed.value = 0;
    magnetUntil.value = 0;
    lampX.value = W / 2;
    lampTarget.value = W / 2;
    running.value = 1;

    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    spawnOne();
    scheduleSpawn();
  }, [W, clearField, elapsed, lampTarget, lampX, magnetUntil, running, scheduleSpawn, spawnOne]);

  useEffect(() => {
    return () => {
      if (spawnTimer.current) clearTimeout(spawnTimer.current);
      if (moodTimer.current) clearTimeout(moodTimer.current);
      running.value = 0;
    };
  }, [running]);

  /* ---------------- one thumb, anywhere on the screen ---------------- */
  const pan = Gesture.Pan()
    .onBegin((e) => {
      "worklet";
      lampTarget.value = e.x;
    })
    .onUpdate((e) => {
      "worklet";
      lampTarget.value = e.x;
    });

  const lampyStyle = useAnimatedStyle(() => {
    const half = LAMPY_W / 2;
    const x = Math.max(LAMPY_W * 0.22, Math.min(W - LAMPY_W * 0.22, lampX.value));
    const lean = Math.max(-11, Math.min(11, (lampTarget.value - lampX.value) * 0.045));
    return {
      transform: [
        { translateX: x - half },
        { translateY: lampyTop + bob.value },
        { rotate: `${lean}deg` },
        { scaleX: 1 + squash.value * 0.12 },
        { scaleY: 1 - squash.value * 0.12 },
      ],
    };
  });

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <GestureDetector gesture={pan}>
        <View style={StyleSheet.absoluteFill} collapsable={false}>
          <Backdrop width={W} height={H} />

          {/* ---- falling stuff ---- */}
          {slots.map((s, i) =>
            s ? <FallingItem key={i} slot={s} x={xs[i]} y={ys[i]} rot={rots[i]} /> : null
          )}

          {/* ---- Lampy ---- */}
          <Animated.View
            pointerEvents="none"
            style={[{ position: "absolute", width: LAMPY_W, height: LAMPY_H }, lampyStyle]}
          >
            <Lampy
              width={LAMPY_W}
              height={LAMPY_H}
              mood={mood}
              magnet={magnetOn}
              glow={magnetOn ? 0.85 : combo >= 3 ? 0.35 : 0}
              armSwing={armSwing}
              look={lookAt}
              headTilt={headTilt}
            />
          </Animated.View>

          {/* ---- floating money ---- */}
          {pops.map((p) => (
            <View key={p.id} pointerEvents="none" style={[styles.pop, { left: p.x - 60, top: p.y - 30 }]}>
              <Text
                style={[
                  styles.popText,
                  p.kind === "bad" && { color: "#FF6B6B" },
                  p.kind === "gold" && { color: "#FFF3C4", fontSize: 28 },
                ]}
              >
                {p.text}
              </Text>
            </View>
          ))}
        </View>
      </GestureDetector>

      {/* ---- HUD ---- */}
      <View pointerEvents="none" style={[styles.hud, { paddingTop: insets.top + 10 }]}>
        <View>
          <Text style={styles.hudLabel}>TAKINGS</Text>
          <Text style={styles.money}>{formatMoney(takings)}</Text>
          <Text style={styles.best}>Best {formatMoney(best)}</Text>
        </View>
        <View style={styles.bags}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.bag, i >= bags && styles.bagGone]} />
          ))}
        </View>
      </View>

      {combo >= 2 && phase === "playing" && (
        <View pointerEvents="none" style={[styles.comboWrap, { top: insets.top + 84 }]}>
          <Text style={styles.combo}>×{combo}</Text>
        </View>
      )}

      {/* ---- cards ---- */}
      {phase !== "playing" && (
        <View style={styles.card}>
          {phase === "ready" ? (
            <>
              <Text style={styles.kicker}>FLIPPILOT PRESENTS</Text>
              <Text style={styles.title}>LAMPY'S{"\n"}BOOT FAIR DASH</Text>
              <Text style={styles.blurb}>
                Slide your thumb to move Lampy. Catch the shiny bargains — leave the grubby tat
                alone. Three bags and you're out.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.kicker}>{verdict(takings, best).toUpperCase()}</Text>
              <Text style={styles.title}>{formatMoney(takings)}</Text>
              <View style={styles.totals}>
                <View style={styles.total}>
                  <Text style={styles.totalKey}>BEST EVER</Text>
                  <Text style={styles.totalValue}>{formatMoney(best)}</Text>
                </View>
                <View style={styles.total}>
                  <Text style={styles.totalKey}>BEST RUN</Text>
                  <Text style={styles.totalValue}>×{bestCombo}</Text>
                </View>
              </View>
              <Text style={styles.runLine}>
                Lasted {lasted}s · {caught} {caught === 1 ? "bargain" : "bargains"} caught
              </Text>
            </>
          )}

          <Pressable style={styles.btn} onPress={startRun}>
            <Text style={styles.btnText}>
              {phase === "ready" ? "Open the gates" : "One more go"}
            </Text>
          </Pressable>

          <Pressable style={styles.leave} onPress={() => router.back()}>
            <Text style={styles.leaveText}>Back to FlipPilot</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** One recycled sprite. Its movement is driven entirely from the UI thread. */
function FallingItem({
  slot,
  x,
  y,
  rot,
}: {
  slot: { kind: ItemKind; golden: boolean };
  x: SharedValue<number>;
  y: SharedValue<number>;
  rot: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${rot.value}deg` }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", width: ITEM, height: ITEM }, style]}>
      <ItemArt kindId={slot.kind.id} tat={slot.kind.tat} golden={slot.golden} size={ITEM} />
    </Animated.View>
  );
}

const GOLD = "#FFD700";
const CREAM = "#FFF3D6";

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },

  hud: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  hudLabel: { color: "rgba(255,243,214,0.55)", fontSize: 10, fontWeight: "700", letterSpacing: 1.6 },
  money: { color: GOLD, fontSize: 34, fontWeight: "900", lineHeight: 38 },
  best: { color: "rgba(255,243,214,0.5)", fontSize: 11, fontWeight: "700" },

  bags: { flexDirection: "row", gap: 6 },
  bag: {
    width: 18,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#8a5a12",
    backgroundColor: GOLD,
  },
  bagGone: { opacity: 0.18 },

  comboWrap: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  combo: {
    color: "#2a1a0c",
    backgroundColor: GOLD,
    fontSize: 26,
    fontWeight: "900",
    paddingHorizontal: 18,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
  },

  pop: { position: "absolute", width: 120, alignItems: "center" },
  popText: {
    color: GOLD,
    fontSize: 22,
    fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 6,
  },

  card: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 10,
    backgroundColor: "rgba(6,10,24,0.88)",
  },
  kicker: { color: "rgba(255,243,214,0.6)", fontSize: 13, fontWeight: "900", letterSpacing: 3 },
  title: { color: GOLD, fontSize: 38, fontWeight: "900", textAlign: "center", lineHeight: 42 },
  blurb: { color: "rgba(255,243,214,0.82)", fontSize: 15, lineHeight: 22, textAlign: "center", maxWidth: 300 },

  totals: { flexDirection: "row", gap: 26, marginTop: 4 },
  total: { alignItems: "center", gap: 2 },
  totalKey: { color: "rgba(255,243,214,0.5)", fontSize: 10, letterSpacing: 1.4, fontWeight: "700" },
  totalValue: { color: CREAM, fontSize: 24, fontWeight: "900" },
  runLine: { color: "rgba(255,243,214,0.45)", fontSize: 12, fontWeight: "600", marginTop: 8 },

  btn: {
    marginTop: 16,
    paddingHorizontal: 38,
    paddingVertical: 15,
    borderRadius: 999,
    backgroundColor: GOLD,
    ...Platform.select({ android: { elevation: 6 }, default: {} }),
  },
  btnText: { color: "#2a1a0c", fontSize: 18, fontWeight: "900" },

  leave: { marginTop: 14, padding: 8 },
  leaveText: { color: "rgba(255,243,214,0.55)", fontSize: 14, fontWeight: "600" },
});
