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
  magnetPull,
} from "@/game/dashLogic";
import {
  FAKE_COST,
  LIST_BONUS,
  LOB_EVERY,
  LOB_GRAVITY,
  LOB_WARNING_MS,
  ROUNDS,
  Role,
  Round,
  bagsAfterRound,
  dayVerdict,
  goalMet,
  goalProgress,
  lobLaunch,
  makeList,
  randomDayDrop,
  timeBonus,
  windAt,
} from "@/game/dayRounds";

const BEST_KEY = "flippilot.dash.best";
const BEST_DAY_KEY = "flippilot.dash.bestDay";
const FURTHEST_KEY = "flippilot.dash.furthest";

/** How many item sprites exist. They are recycled, never created mid-run. */
const SLOTS = 16;
const ITEM = 62;
/** The most umbrellas he can hold at once. */
const MAX_SHIELDS = 2;

/** Roles as numbers, for the UI thread. */
const R_BARGAIN = 0;
const R_TAT = 1;
const R_UMBRELLA = 2;
const R_FAKE = 3;
const ROLE_NUM: Record<Role, number> = { bargain: R_BARGAIN, tat: R_TAT, umbrella: R_UMBRELLA, fake: R_FAKE };

type SlotState = { kind: ItemKind; golden: boolean; role: Role } | null;

type Mode = "endless" | "day";
/**
 * title: choose a mode. intro: the card before a round (with how the last one went).
 * playing. over: an endless run ended. dayOver: a day ended, finished or not.
 */
type Phase = "title" | "intro" | "playing" | "over" | "dayOver";

type RoundResult = { bonus: number; bagBack: boolean; listBonus: boolean };

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
  const roles = Array.from({ length: SLOTS }, () => useSharedValue(0));
  // Thrown things (the tat-attack round) fly on their own path; everything else falls.
  const lobbed = Array.from({ length: SLOTS }, () => useSharedValue(0));
  const vxs = Array.from({ length: SLOTS }, () => useSharedValue(0));
  const vys = Array.from({ length: SLOTS }, () => useSharedValue(0));

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
  // The round's settings, readable from the loop.
  const curveStart = useSharedValue(0);
  const speedMul = useSharedValue(1);
  const windMax = useSharedValue(0);

  /* ---------------- react state: the rare changes ---------------- */
  const [slots, setSlots] = useState<SlotState[]>(() => Array(SLOTS).fill(null));
  const [takings, setTakings] = useState(0);
  const [bags, setBags] = useState(STARTING_BAGS);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(1);
  const [lasted, setLasted] = useState(0);
  const [caught, setCaught] = useState(0);
  const [best, setBest] = useState(0);
  const [bestDay, setBestDay] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [mode, setMode] = useState<Mode>("day");
  const [phase, setPhase] = useState<Phase>("title");
  const [mood, setMood] = useState<Mood>("idle");
  const [magnetOn, setMagnetOn] = useState(false);
  const [pops, setPops] = useState<{ id: number; x: number; y: number; text: string; kind: string }[]>([]);

  // A day at the fair.
  const [roundIdx, setRoundIdx] = useState(0);
  const [genuine, setGenuine] = useState(0);
  const [list, setList] = useState<ItemKind[]>([]);
  const [listLeft, setListLeft] = useState<string[]>([]);
  const [shields, setShields] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [wind, setWind] = useState(0);
  const [warnings, setWarnings] = useState<{ id: number; left: boolean; y: number }[]>([]);
  const [lastResult, setLastResult] = useState<RoundResult | null>(null);
  const [dayEnd, setDayEnd] = useState<{ done: number; reason: string } | null>(null);

  // Read in callbacks that run off the UI thread, where React state would be stale.
  const comboRef = useRef(0);
  const bagsRef = useRef(STARTING_BAGS);
  const takingsRef = useRef(0);
  const slotsRef = useRef<SlotState[]>(Array(SLOTS).fill(null));
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spawnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lobTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clockTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const popId = useRef(0);
  const startedAt = useRef(0);
  const caughtRef = useRef(0);
  const modeRef = useRef<Mode>("day");
  const roundRef = useRef<Round>(ROUNDS[0]);
  const roundIdxRef = useRef(0);
  const genuineRef = useRef(0);
  const listLeftRef = useRef<ItemKind[]>([]);
  const shieldsRef = useRef(0);
  const endedRef = useRef(false);
  // Where a round started, so it can be tried again from the same place.
  const roundStartTakings = useRef(0);
  const roundStartBags = useRef(STARTING_BAGS);

  useEffect(() => {
    AsyncStorage.multiGet([BEST_KEY, BEST_DAY_KEY, FURTHEST_KEY])
      .then((pairs) => {
        const v = Object.fromEntries(pairs);
        setBest(Number(v[BEST_KEY]) || 0);
        setBestDay(Number(v[BEST_DAY_KEY]) || 0);
        setFurthest(Number(v[FURTHEST_KEY]) || 0);
      })
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
      lobbed[i].value = 0;
    }
    slotsRef.current = Array(SLOTS).fill(null);
    setSlots(Array(SLOTS).fill(null));
    setWarnings([]);
  }, [alive, ys, lobbed]);

  const stopTimers = useCallback(() => {
    if (spawnTimer.current) clearTimeout(spawnTimer.current);
    if (lobTimer.current) clearTimeout(lobTimer.current);
    if (clockTimer.current) clearInterval(clockTimer.current);
    spawnTimer.current = null;
    lobTimer.current = null;
    clockTimer.current = null;
  }, []);

  const setTakingsTo = useCallback((v: number) => {
    takingsRef.current = Math.max(0, v);
    setTakings(takingsRef.current);
  }, []);

  /** Puts one thing into a free slot. Returns the slot, or -1 when the screen is full. */
  const place = useCallback(
    (s: NonNullable<SlotState>) => {
      const free = alive.findIndex((a) => a.value === 0);
      if (free === -1) return -1;
      const next = [...slotsRef.current];
      next[free] = s;
      slotsRef.current = next;
      setSlots(next);
      roles[free].value = ROLE_NUM[s.role];
      return free;
    },
    [alive, roles]
  );

  /* ---------------- spawning happens in JS ----------------
     Only a couple of times a second, and picking what falls needs the item
     list, so there is nothing to gain from doing it on the UI thread — and
     a slot must know what it is before it is shown, or it flickers as the
     previous item for one frame. */
  const spawnOne = useCallback(() => {
    const drop =
      modeRef.current === "day"
        ? randomDayDrop(roundRef.current, listLeftRef.current.slice(0, 1))
        : (() => {
            const d = randomDrop(elapsed.value);
            return { ...d, role: (d.kind.tat ? "tat" : "bargain") as Role };
          })();
    const i = place({ kind: drop.kind, golden: drop.golden, role: drop.role });
    if (i === -1) return;

    xs[i].value = 18 + Math.random() * Math.max(1, W - ITEM - 36);
    ys[i].value = -ITEM;
    rots[i].value = (Math.random() - 0.5) * 40;
    lobbed[i].value = 0;
    alive[i].value = 1;
  }, [W, alive, elapsed, lobbed, place, rots, xs, ys]);

  const scheduleSpawn = useCallback(() => {
    const secs = (Date.now() - startedAt.current) / 1000;
    const r = roundRef.current;
    const gap =
      modeRef.current === "day"
        ? dropGap(r.curveStart + secs) * r.gap
        : dropGap(secs);
    spawnTimer.current = setTimeout(() => {
      spawnOne();
      scheduleSpawn();
    }, gap * (0.7 + Math.random() * 0.6));
  }, [spawnOne]);

  /** Tat attack: a warning at the side, then something thrown. */
  const scheduleLob = useCallback(() => {
    const [lo, hi] = LOB_EVERY;
    lobTimer.current = setTimeout(() => {
      const left = Math.random() < 0.5;
      const startY = H * (0.26 + Math.random() * 0.16);
      const id = popId.current++;
      setWarnings((w) => [...w, { id, left, y: startY }]);
      Haptics.selectionAsync().catch(() => {});

      lobTimer.current = setTimeout(() => {
        setWarnings((w) => w.filter((q) => q.id !== id));
        const tatKinds = ["mug", "tape", "shoe", "plant", "tin"];
        const kind = { id: tatKinds[Math.floor(Math.random() * tatKinds.length)], name: "Tat", value: 0, tat: true };
        const i = place({ kind, golden: false, role: "tat" });
        if (i !== -1) {
          const l = lobLaunch({
            fromLeft: left,
            screenW: W,
            startY,
            landX: W * (0.15 + Math.random() * 0.7),
            landY: lampyTop + LAMPY_H * 0.2,
            flight: 1.1 + Math.random() * 0.35,
            item: ITEM,
          });
          xs[i].value = l.x;
          ys[i].value = l.y;
          vxs[i].value = l.vx;
          vys[i].value = l.vy;
          rots[i].value = 0;
          lobbed[i].value = 1;
          alive[i].value = 1;
        }
        scheduleLob();
      }, LOB_WARNING_MS);
    }, (lo + Math.random() * (hi - lo)) * 1000);
  }, [H, LAMPY_H, W, alive, lampyTop, lobbed, place, rots, vxs, vys, xs, ys]);

  /* ---------------- the end of an endless run, a round or a day ---------------- */
  const saveBest = useCallback((key: string, value: number, setter: (fn: (b: number) => number) => void) => {
    setter((b) => {
      if (value > b) {
        AsyncStorage.setItem(key, String(value)).catch(() => {});
        return value;
      }
      return b;
    });
  }, []);

  const endRun = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    running.value = 0;
    stopTimers();
    setLasted(Math.round((Date.now() - startedAt.current) / 1000));
    play("over");
    setPhase("over");
    saveBest(BEST_KEY, takingsRef.current, setBest);
  }, [running, saveBest, stopTimers]);

  /** A day stops here: `done` rounds were finished. */
  const endDay = useCallback(
    (done: number, reason: string) => {
      if (endedRef.current) return;
      endedRef.current = true;
      running.value = 0;
      stopTimers();
      clearField();
      play("over");
      setDayEnd({ done, reason });
      setPhase("dayOver");
      saveBest(BEST_DAY_KEY, takingsRef.current, setBestDay);
      saveBest(FURTHEST_KEY, done, setFurthest);
    },
    [clearField, running, saveBest, stopTimers]
  );

  const winRound = useCallback(
    (secsLeft: number) => {
      if (endedRef.current) return;
      endedRef.current = true;
      running.value = 0;
      stopTimers();
      clearField();

      const r = roundRef.current;
      const timed = r.goal.kind === "catch" || r.goal.kind === "list";
      const bonus = timed ? timeBonus(secsLeft) : 0;
      if (bonus) setTakingsTo(takingsRef.current + bonus);
      const before = bagsRef.current;
      bagsRef.current = bagsAfterRound(before, STARTING_BAGS);
      setBags(bagsRef.current);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showMood("star", 1200);

      const done = roundIdxRef.current + 1;
      if (done >= ROUNDS.length) {
        endedRef.current = false;
        endDay(done, "");
        return;
      }
      setLastResult({ bonus, bagBack: bagsRef.current > before, listBonus: r.goal.kind === "list" });
      roundIdxRef.current = done;
      setRoundIdx(done);
      saveBest(FURTHEST_KEY, done, setFurthest);
      setPhase("intro");
    },
    [clearField, endDay, running, saveBest, setTakingsTo, showMood, stopTimers]
  );

  /* ---------------- what a catch or a knock means ---------------- */
  const loseBag = useCallback(() => {
    bagsRef.current -= 1;
    setBags(bagsRef.current);
    if (bagsRef.current <= 0) {
      if (modeRef.current === "day") endDay(roundIdxRef.current, "Out of bags");
      else endRun();
    }
  }, [endDay, endRun]);

  const breakCombo = useCallback(() => {
    comboRef.current = 0;
    setCombo(0);
  }, []);

  const onHit = useCallback(
    (slot: number, role: number, cx: number, cy: number) => {
      const s = slotsRef.current[slot];
      if (!s || endedRef.current) return;
      const day = modeRef.current === "day";
      const r = roundRef.current;

      if (role === R_TAT) {
        if (shieldsRef.current > 0) {
          shieldsRef.current -= 1;
          setShields(shieldsRef.current);
          addPop(cx, cy, "blocked!", "shield");
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          return;
        }
        breakCombo();
        addPop(cx, cy, "tat!", "bad");
        showMood("hurt", 520);
        play("tat");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        squash.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 260 }));
        loseBag();
        return;
      }

      if (role === R_UMBRELLA) {
        shieldsRef.current = Math.min(MAX_SHIELDS, shieldsRef.current + 1);
        setShields(shieldsRef.current);
        addPop(cx, cy, "umbrella!", "shield");
        showMood("joy", 400);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        return;
      }

      if (role === R_FAKE) {
        breakCombo();
        setTakingsTo(takingsRef.current - FAKE_COST);
        addPop(cx, cy, `fake! −${formatMoney(FAKE_COST)}`, "bad");
        showMood("hurt", 520);
        play("tat");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        return;
      }

      // A genuine bargain.
      caughtRef.current += 1;
      setCaught(caughtRef.current);
      const nextCombo = comboRef.current + 1;
      comboRef.current = nextCombo;
      setCombo(nextCombo);
      setBestCombo((b) => Math.max(b, nextCombo));

      const gained = payout(s.kind.value, nextCombo, s.golden) * (day ? r.pay : 1);
      setTakingsTo(takingsRef.current + gained);
      addPop(cx, cy, "+" + formatMoney(gained), s.golden ? "gold" : "good");
      showMood(s.golden ? "star" : "joy", s.golden ? 900 : 320);
      play(s.golden ? "golden" : "catch");
      Haptics.impactAsync(
        s.golden ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light
      ).catch(() => {});

      if (s.golden) magnetUntil.value = Date.now() + GOLDEN_MAGNET_MS;
      else if (earnsMagnet(nextCombo)) magnetUntil.value = Date.now() + MAGNET_MS;

      if (!day) return;
      genuineRef.current += 1;
      setGenuine(genuineRef.current);

      // The collector's list goes in order: only the next thing on it counts.
      if (listLeftRef.current[0]?.id === s.kind.id) {
        listLeftRef.current = listLeftRef.current.slice(1);
        setListLeft(listLeftRef.current.map((k) => k.id));
        setTimeout(() => addPop(cx, cy - 34, `✓ ${s.kind.name}`, "shield"), 120);
        if (listLeftRef.current.length === 0) {
          setTakingsTo(takingsRef.current + LIST_BONUS);
          setTimeout(() => addPop(W / 2, H * 0.4, `List done +${formatMoney(LIST_BONUS)}`, "gold"), 250);
        }
      }

      const left = r.seconds - (Date.now() - startedAt.current) / 1000;
      if (goalMet(r.goal, { genuine: genuineRef.current, listLeft: listLeftRef.current.length, bags: bagsRef.current, bell: false })) {
        winRound(left);
      }
    },
    [H, W, addPop, breakCombo, loseBag, magnetUntil, setTakingsTo, showMood, squash, winRound]
  );

  /** A bargain hitting the floor breaks the run, but costs no bag. */
  const onMissed = useCallback(() => {
    breakCombo();
  }, [breakCombo]);

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
    const speed = fallSpeed(curveStart.value + elapsed.value) * speedMul.value;
    const blow = windAt(elapsed.value, windMax.value);
    const lx = lampX.value;

    // Whatever is closest to landing is what he watches.
    let watchX = lx;
    let watchY = -1;

    for (let i = 0; i < SLOTS; i++) {
      if (alive[i].value === 0) continue;
      const role = roles[i].value;

      if (lobbed[i].value === 1) {
        vys[i].value += LOB_GRAVITY * dt;
        xs[i].value += vxs[i].value * dt;
        ys[i].value += vys[i].value * dt;
        rots[i].value += 240 * dt;
      } else {
        ys[i].value += speed * dt;
        rots[i].value += 26 * dt;
        if (blow !== 0) {
          xs[i].value = Math.max(0, Math.min(W - ITEM, xs[i].value + blow * dt));
        }
      }

      // The magnet only pulls what is worth having, and only what is already
      // near him.
      if (magnet && role === R_BARGAIN) {
        xs[i].value += magnetPull(xs[i].value + ITEM / 2, lx, W, dt);
      }

      const cx = xs[i].value + ITEM / 2;
      const cy = ys[i].value + ITEM / 2;

      if ((role === R_BARGAIN || role === R_UMBRELLA) && cy > watchY) {
        watchY = cy;
        watchX = cx;
      }

      if (isCaught(cx, cy, lx, lampyTop, LAMPY_W, LAMPY_H)) {
        alive[i].value = 0;
        ys[i].value = -999;
        runOnJS(onHit)(i, role, cx, cy);
        continue;
      }

      const gone =
        ys[i].value > H + 30 ||
        (lobbed[i].value === 1 && (xs[i].value < -ITEM * 2 || xs[i].value > W + ITEM));
      if (gone) {
        alive[i].value = 0;
        ys[i].value = -999;
        if (role === R_BARGAIN && lobbed[i].value === 0) runOnJS(onMissed)();
        lobbed[i].value = 0;
      }
    }

    const wantLook = Math.max(-1, Math.min(1, (watchX - lx) / (W * 0.4)));
    lookAt.value += (wantLook - lookAt.value) * Math.min(1, dt * 7);
  });

  // The sunglasses and the wind flag are React state, so they are synced a few
  // times a second rather than every frame.
  useEffect(() => {
    if (phase !== "playing") return;
    const t = setInterval(() => {
      setMagnetFlag(Date.now() < magnetUntil.value);
      if (windMax.value) setWind(Math.round(windAt(elapsed.value, windMax.value)));
    }, 200);
    return () => clearInterval(t);
  }, [phase, magnetUntil, setMagnetFlag, windMax, elapsed]);

  /* ---------------- starting and stopping ---------------- */
  const resetRunState = useCallback(() => {
    clearField();
    comboRef.current = 0;
    setCombo(0);
    setMood("idle");
    setPops([]);
    endedRef.current = false;
    magnetUntil.value = 0;
    lampX.value = W / 2;
    lampTarget.value = W / 2;
    elapsed.value = 0;
    startedAt.current = Date.now();
  }, [W, clearField, elapsed, lampTarget, lampX, magnetUntil]);

  const startEndless = useCallback(() => {
    stopTimers();
    modeRef.current = "endless";
    setMode("endless");
    resetRunState();
    bagsRef.current = STARTING_BAGS;
    setBags(STARTING_BAGS);
    setTakingsTo(0);
    setBestCombo(1);
    setLasted(0);
    caughtRef.current = 0;
    setCaught(0);
    shieldsRef.current = 0;
    setShields(0);
    curveStart.value = 0;
    speedMul.value = 1;
    windMax.value = 0;
    setPhase("playing");
    running.value = 1;
    spawnOne();
    scheduleSpawn();
  }, [curveStart, resetRunState, running, scheduleSpawn, setTakingsTo, spawnOne, speedMul, stopTimers, windMax]);

  /** Shows the card for round `idx` (0-based) with fresh day numbers when `fresh`. */
  const openDay = useCallback(
    (idx: number, fresh: boolean) => {
      stopTimers();
      modeRef.current = "day";
      setMode("day");
      running.value = 0;
      clearField();
      if (fresh) {
        setTakingsTo(0);
        bagsRef.current = STARTING_BAGS;
        setBags(STARTING_BAGS);
        setBestCombo(1);
        caughtRef.current = 0;
        setCaught(0);
        shieldsRef.current = 0;
        setShields(0);
        setLastResult(null);
      }
      roundIdxRef.current = idx;
      setRoundIdx(idx);
      setDayEnd(null);
      setPhase("intro");
    },
    [clearField, running, setTakingsTo, stopTimers]
  );

  /** Tries the round that just ended again, from where it began. */
  const retryRound = useCallback(() => {
    setTakingsTo(roundStartTakings.current);
    bagsRef.current = roundStartBags.current;
    setBags(roundStartBags.current);
    setLastResult(null);
    openDay(roundIdxRef.current, false);
  }, [openDay, setTakingsTo]);

  const startRound = useCallback(() => {
    const r = ROUNDS[roundIdxRef.current];
    roundRef.current = r;
    resetRunState();
    roundStartTakings.current = takingsRef.current;
    roundStartBags.current = bagsRef.current;

    genuineRef.current = 0;
    setGenuine(0);
    const wanted = r.goal.kind === "list" ? makeList(Math.random, r.goal.count) : [];
    listLeftRef.current = wanted;
    setList(wanted);
    setListLeft(wanted.map((k) => k.id));
    setWind(0);
    setSecondsLeft(r.seconds);

    curveStart.value = r.curveStart;
    speedMul.value = r.speed;
    windMax.value = r.wind;
    setPhase("playing");
    running.value = 1;
    spawnOne();
    scheduleSpawn();
    if (r.lobs) scheduleLob();

    clockTimer.current = setInterval(() => {
      const left = r.seconds - (Date.now() - startedAt.current) / 1000;
      setSecondsLeft(Math.max(0, left));
      if (left > 0 || endedRef.current) return;
      const met = goalMet(r.goal, {
        genuine: genuineRef.current,
        listLeft: listLeftRef.current.length,
        bags: bagsRef.current,
        bell: true,
      });
      if (met) winRound(0);
      else endDay(roundIdxRef.current, r.goal.kind === "list" ? "The collector went home" : "Time's up");
    }, 100);
  }, [curveStart, endDay, resetRunState, running, scheduleLob, scheduleSpawn, spawnOne, speedMul, windMax, winRound]);

  useEffect(() => {
    return () => {
      stopTimers();
      if (moodTimer.current) clearTimeout(moodTimer.current);
      running.value = 0;
    };
  }, [running, stopTimers]);

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

  const round = ROUNDS[roundIdx];
  const inDay = mode === "day";
  const dayHud = inDay && phase === "playing";
  const sky = inDay && phase !== "title" ? round.sky : undefined;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <GestureDetector gesture={pan}>
        <View style={StyleSheet.absoluteFill} collapsable={false}>
          <Backdrop width={W} height={H} sky={sky} />

          {/* ---- falling stuff ---- */}
          {slots.map((s, i) =>
            s ? <FallingItem key={i} slot={s} x={xs[i]} y={ys[i]} rot={rots[i]} /> : null
          )}

          {/* ---- where the next throw is coming from ---- */}
          {warnings.map((w) => (
            <View
              key={w.id}
              pointerEvents="none"
              style={[styles.warning, { top: w.y, [w.left ? "left" : "right"]: 6 }]}
            >
              <Text style={styles.warningText}>!</Text>
            </View>
          ))}

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
            <View key={p.id} pointerEvents="none" style={[styles.pop, { left: p.x - 80, top: p.y - 30 }]}>
              <Text
                style={[
                  styles.popText,
                  p.kind === "bad" && { color: "#FF6B6B" },
                  p.kind === "gold" && { color: "#FFF3C4", fontSize: 28 },
                  p.kind === "shield" && { color: "#9fd0ff", fontSize: 20 },
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
          <Text style={styles.best}>
            {inDay ? `Best day ${formatMoney(bestDay)}` : `Best ${formatMoney(best)}`}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <View style={styles.bags}>
            {Array.from({ length: STARTING_BAGS }, (_, i) => (
              <View key={i} style={[styles.bag, i >= bags && styles.bagGone]} />
            ))}
          </View>
          {shields > 0 && (
            <View style={styles.shieldRow}>
              {Array.from({ length: shields }, (_, i) => (
                <ItemArt key={i} kindId="umbrella" tat={false} golden={false} size={24} />
              ))}
            </View>
          )}
        </View>
      </View>

      {dayHud && (
        <View pointerEvents="none" style={[styles.roundHud, { top: insets.top + 78 }]}>
          <Text style={styles.roundLabel}>
            {round.clock} · {round.title}
          </Text>
          <View style={styles.clockTrack}>
            <View style={[styles.clockFill, { width: `${Math.max(0, secondsLeft / round.seconds) * 100}%` }, secondsLeft < 6 && { backgroundColor: "#FF6B6B" }]} />
          </View>
          <GoalLine
            round={round}
            genuine={genuine}
            list={list}
            listLeft={listLeft}
            secondsLeft={secondsLeft}
            wind={wind}
          />
        </View>
      )}

      {combo >= 2 && phase === "playing" && (
        <View pointerEvents="none" style={[styles.comboWrap, { top: insets.top + (dayHud ? 164 : 84) }]}>
          <Text style={styles.combo}>×{combo}</Text>
        </View>
      )}

      {/* ---- cards ---- */}
      {phase !== "playing" && (
        <View style={styles.card}>
          {phase === "title" && (
            <>
              <Text style={styles.kicker}>FLIPPILOT PRESENTS</Text>
              <Text style={styles.title}>LAMPY'S{"\n"}BOOT FAIR DASH</Text>
              <Text style={styles.blurb}>
                Slide your thumb to move Lampy. Catch the shiny bargains and leave the grubby tat alone.
              </Text>
              <Pressable style={styles.btn} onPress={() => openDay(0, true)} accessibilityRole="button">
                <Text style={styles.btnText}>Play a day at the fair</Text>
              </Pressable>
              <Text style={styles.subLine}>
                Six rounds, 7am to closing time
                {furthest > 0 ? ` · best: ${furthest >= ROUNDS.length ? "the whole day" : `round ${Math.min(ROUNDS.length, furthest + 1)}`}, ${formatMoney(bestDay)}` : ""}
              </Text>
              <Pressable style={[styles.btn, styles.btnQuiet]} onPress={startEndless} accessibilityRole="button">
                <Text style={[styles.btnText, styles.btnQuietText]}>Endless</Text>
              </Pressable>
              <Text style={styles.subLine}>Three bags and you're out · best {formatMoney(best)}</Text>
            </>
          )}

          {phase === "intro" && (
            <>
              {lastResult && (
                <View style={styles.result}>
                  <Text style={styles.resultTitle}>Round done!</Text>
                  <Text style={styles.resultLine}>
                    {[
                      lastResult.listBonus ? `List bonus +${formatMoney(LIST_BONUS)}` : null,
                      lastResult.bonus ? `Time bonus +${formatMoney(lastResult.bonus)}` : null,
                      lastResult.bagBack ? "A bag back" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "On to the next one"}
                  </Text>
                </View>
              )}
              <Text style={styles.kicker}>
                ROUND {roundIdx + 1} OF {ROUNDS.length} · {round.clock.toUpperCase()}
              </Text>
              <Text style={[styles.title, { fontSize: 34 }]}>{round.title}</Text>
              <Text style={styles.blurb}>{round.howTo}</Text>
              <RoundPreview round={round} />
              <Pressable style={styles.btn} onPress={startRound} accessibilityRole="button">
                <Text style={styles.btnText}>{roundIdx === 0 && !lastResult ? "Open the gates" : "Go!"}</Text>
              </Pressable>
              {inDay && roundIdx > 0 && (
                <Text style={styles.subLine}>
                  {formatMoney(takings)} so far · {bags} {bags === 1 ? "bag" : "bags"}
                </Text>
              )}
            </>
          )}

          {phase === "dayOver" && dayEnd && (
            <>
              <Text style={styles.kicker}>
                {(dayEnd.done >= ROUNDS.length ? "Closing time" : dayEnd.reason).toUpperCase()}
              </Text>
              <Text style={styles.title}>{formatMoney(takings)}</Text>
              <Text style={styles.verdict}>{dayVerdict(dayEnd.done, ROUNDS.length)}</Text>
              <View style={styles.totals}>
                <View style={styles.total}>
                  <Text style={styles.totalKey}>ROUNDS</Text>
                  <Text style={styles.totalValue}>
                    {dayEnd.done}/{ROUNDS.length}
                  </Text>
                </View>
                <View style={styles.total}>
                  <Text style={styles.totalKey}>BEST DAY</Text>
                  <Text style={styles.totalValue}>{formatMoney(bestDay)}</Text>
                </View>
                <View style={styles.total}>
                  <Text style={styles.totalKey}>BEST RUN</Text>
                  <Text style={styles.totalValue}>×{bestCombo}</Text>
                </View>
              </View>
              {dayEnd.done < ROUNDS.length && (
                <Pressable style={styles.btn} onPress={retryRound} accessibilityRole="button">
                  <Text style={styles.btnText}>Try round {dayEnd.done + 1} again</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.btn, dayEnd.done < ROUNDS.length && styles.btnQuiet]}
                onPress={() => openDay(0, true)}
                accessibilityRole="button"
              >
                <Text style={[styles.btnText, dayEnd.done < ROUNDS.length && styles.btnQuietText]}>
                  Start the day again
                </Text>
              </Pressable>
            </>
          )}

          {phase === "over" && (
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
              <Pressable style={styles.btn} onPress={startEndless} accessibilityRole="button">
                <Text style={styles.btnText}>One more go</Text>
              </Pressable>
            </>
          )}

          {phase !== "title" && (
            <Pressable style={styles.leave} onPress={() => { stopTimers(); running.value = 0; clearField(); setPhase("title"); }}>
              <Text style={styles.leaveText}>Main menu</Text>
            </Pressable>
          )}
          <Pressable style={styles.leave} onPress={() => router.back()}>
            <Text style={styles.leaveText}>Back to FlipPilot</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** The line under the clock: what this round wants from you, and how far you've got. */
function GoalLine({
  round,
  genuine,
  list,
  listLeft,
  secondsLeft,
  wind,
}: {
  round: Round;
  genuine: number;
  list: ItemKind[];
  listLeft: string[];
  secondsLeft: number;
  wind: number;
}) {
  const g = round.goal;
  const secs = Math.ceil(secondsLeft);
  if (g.kind === "list") {
    return (
      <View style={styles.goalRow}>
        {list.map((k) => {
          const got = !listLeft.includes(k.id);
          const next = listLeft[0] === k.id;
          return (
            <View key={k.id} style={[styles.listItem, got && styles.listGot, next && styles.listNext]}>
              <ItemArt kindId={k.id} tat={false} golden={false} size={34} />
              {got && <Text style={styles.tick}>✓</Text>}
            </View>
          );
        })}
        <Text style={styles.goalText}>{secs}s</Text>
      </View>
    );
  }
  const progress = goalProgress(g, { genuine, listLeft: listLeft.length, secondsLeft, seconds: round.seconds });
  const text =
    g.kind === "catch"
      ? `Bargains ${Math.min(genuine, g.count)}/${g.count} · ${secs}s`
      : g.kind === "survive"
        ? `Keep a bag till the bell · ${secs}s`
        : `Double pay! · ${secs}s`;
  return (
    <View style={styles.goalRow}>
      <Text style={styles.goalText}>{text}</Text>
      {round.wind > 0 && Math.abs(wind) > 8 && (
        <Text style={styles.windText}>{wind > 0 ? "wind ›››" : "‹‹‹ wind"}</Text>
      )}
      {g.kind === "catch" && progress >= 1 && <Text style={styles.goalText}>✓</Text>}
    </View>
  );
}

/** On the card before a round: pictures of what matters in it. */
function RoundPreview({ round }: { round: Round }) {
  const tiles: { id: string; label: string; tat?: boolean; fake?: boolean }[] = [];
  if (round.id === "fakes") {
    tiles.push({ id: "watch", label: "Real" }, { id: "watch", label: "Fake", fake: true });
  } else if (round.umbrellas > 0) {
    tiles.push({ id: "camera", label: "Catch" }, { id: "umbrella", label: "Blocks tat" }, { id: "shoe", label: "Avoid", tat: true });
  } else if (round.tat === 0) {
    tiles.push({ id: "ring", label: "×2" }, { id: "console", label: "×2" }, { id: "lamp", label: "×2" });
  } else {
    tiles.push({ id: "lamp", label: "Catch" }, { id: "mug", label: "Avoid", tat: true });
  }
  return (
    <View style={styles.preview}>
      {tiles.map((t, i) => (
        <View key={i} style={styles.previewTile}>
          <ItemArt kindId={t.id} tat={!!t.tat} golden={false} fake={t.fake} size={54} />
          <Text style={styles.previewLabel}>{t.label}</Text>
        </View>
      ))}
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
  slot: { kind: ItemKind; golden: boolean; role: Role };
  x: SharedValue<number>;
  y: SharedValue<number>;
  rot: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${rot.value}deg` }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", width: ITEM, height: ITEM }, style]}>
      <ItemArt
        kindId={slot.kind.id}
        tat={slot.kind.tat}
        golden={slot.golden}
        fake={slot.role === "fake"}
        size={ITEM}
      />
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
  shieldRow: { flexDirection: "row", gap: 2 },

  roundHud: { position: "absolute", left: 16, right: 16, alignItems: "center", gap: 6 },
  roundLabel: { color: CREAM, fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  clockTrack: { width: "100%", height: 6, borderRadius: 3, backgroundColor: "rgba(255,243,214,0.14)", overflow: "hidden" },
  clockFill: { height: 6, borderRadius: 3, backgroundColor: GOLD },
  goalRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 36 },
  goalText: { color: CREAM, fontSize: 15, fontWeight: "800" },
  windText: { color: "#9fd0ff", fontSize: 13, fontWeight: "800" },
  listItem: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,243,214,0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255,215,0,0.45)",
  },
  listGot: { backgroundColor: "rgba(76,175,80,0.28)", borderColor: "#4CAF50", opacity: 0.7 },
  listNext: { backgroundColor: "rgba(255,215,0,0.22)", borderColor: GOLD, borderWidth: 2.5, transform: [{ scale: 1.12 }] },
  tick: { position: "absolute", right: -4, top: -8, color: "#7ee081", fontSize: 18, fontWeight: "900" },

  warning: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FF6B6B",
    alignItems: "center",
    justifyContent: "center",
  },
  warningText: { color: "#fff", fontSize: 22, fontWeight: "900" },

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

  pop: { position: "absolute", width: 160, alignItems: "center" },
  popText: {
    color: GOLD,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
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
    paddingHorizontal: 28,
    gap: 10,
    backgroundColor: "rgba(6,10,24,0.88)",
  },
  kicker: { color: "rgba(255,243,214,0.6)", fontSize: 13, fontWeight: "900", letterSpacing: 3, textAlign: "center" },
  title: { color: GOLD, fontSize: 38, fontWeight: "900", textAlign: "center", lineHeight: 42 },
  verdict: { color: CREAM, fontSize: 17, fontWeight: "800" },
  blurb: { color: "rgba(255,243,214,0.82)", fontSize: 15, lineHeight: 22, textAlign: "center", maxWidth: 320 },
  subLine: { color: "rgba(255,243,214,0.5)", fontSize: 12, fontWeight: "600", textAlign: "center" },

  result: {
    alignItems: "center",
    gap: 2,
    marginBottom: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(76,175,80,0.18)",
    borderWidth: 1,
    borderColor: "rgba(126,224,129,0.5)",
  },
  resultTitle: { color: "#7ee081", fontSize: 18, fontWeight: "900" },
  resultLine: { color: CREAM, fontSize: 13, fontWeight: "700" },

  preview: { flexDirection: "row", gap: 14, marginTop: 6 },
  previewTile: { alignItems: "center", gap: 2 },
  previewLabel: { color: "rgba(255,243,214,0.7)", fontSize: 12, fontWeight: "700" },

  totals: { flexDirection: "row", gap: 26, marginTop: 4 },
  total: { alignItems: "center", gap: 2 },
  totalKey: { color: "rgba(255,243,214,0.5)", fontSize: 10, letterSpacing: 1.4, fontWeight: "700" },
  totalValue: { color: CREAM, fontSize: 24, fontWeight: "900" },
  runLine: { color: "rgba(255,243,214,0.45)", fontSize: 12, fontWeight: "600", marginTop: 8 },

  btn: {
    marginTop: 14,
    paddingHorizontal: 34,
    paddingVertical: 15,
    borderRadius: 999,
    backgroundColor: GOLD,
    minWidth: 240,
    alignItems: "center",
    ...Platform.select({ android: { elevation: 6 }, default: {} }),
  },
  btnText: { color: "#2a1a0c", fontSize: 18, fontWeight: "900" },
  btnQuiet: { backgroundColor: "transparent", borderWidth: 2, borderColor: "rgba(255,215,0,0.6)", ...Platform.select({ android: { elevation: 0 }, default: {} }) },
  btnQuietText: { color: GOLD },

  leave: { marginTop: 6, padding: 8 },
  leaveText: { color: "rgba(255,243,214,0.55)", fontSize: 14, fontWeight: "600" },
});
