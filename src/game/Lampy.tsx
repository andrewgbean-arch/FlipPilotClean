import React, { useEffect, useState } from "react";
import Animated, { SharedValue, useAnimatedProps, useSharedValue } from "react-native-reanimated";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

/**
 * Lampy, the same character as the advert, redrawn for the app.
 *
 * Three kinds of movement, and they are deliberately separate:
 *
 *  - The things that must happen every frame — his arms swinging, his shade
 *    lagging behind when he changes direction, his eyes following whatever is
 *    falling — are driven straight from shared values on the UI thread. They
 *    never touch React, so they stay smooth however busy the screen gets.
 *  - Blinking runs on its own timer in here, because nothing else needs to
 *    know about it.
 *  - His expression changes on events, which happen a few times a second at
 *    most, so plain props are right for those.
 *
 * The head lag is the one worth keeping: a cartoon feels alive when the heavy
 * end arrives a moment after the rest of it, and it costs a single multiply.
 */

export type Mood = "idle" | "joy" | "star" | "hurt";

const AnimatedG = Animated.createAnimatedComponent(G);

const B = "lBrass";
const S = "lShade";
const GL = "lGlow";

export default function Lampy({
  width,
  height,
  mood = "idle",
  magnet = false,
  glow = 0,
  /** Degrees his arms swing out, from how fast he is moving. */
  armSwing,
  /** -1 to 1: which way his eyes drift. */
  look,
  /** Degrees the shade lags behind the stem. */
  headTilt,
}: {
  width: number;
  height: number;
  mood?: Mood;
  magnet?: boolean;
  glow?: number;
  armSwing?: SharedValue<number>;
  look?: SharedValue<number>;
  headTilt?: SharedValue<number>;
}) {
  // Always call the hooks; use the caller's values when it gave any.
  const armFallback = useSharedValue(0);
  const lookFallback = useSharedValue(0);
  const tiltFallback = useSharedValue(0);
  const arm = armSwing ?? armFallback;
  const eyes = look ?? lookFallback;
  const tilt = headTilt ?? tiltFallback;

  /* ---- blinking, on its own clock ---- */
  const [blinking, setBlinking] = useState(false);
  useEffect(() => {
    let closeTimer: ReturnType<typeof setTimeout>;
    const openTimer = setInterval(() => {
      setBlinking(true);
      closeTimer = setTimeout(() => setBlinking(false), 110);
    }, 2600 + Math.random() * 2600);
    return () => {
      clearInterval(openTimer);
      clearTimeout(closeTimer);
    };
  }, []);

  const happy = mood === "joy" || mood === "star";
  const hurt = mood === "hurt";
  const stars = mood === "star";
  const blush = happy ? 0.8 : 0;
  const open = happy ? 0.75 : 0;
  const smile = hurt ? -1 : 0.6;
  const brow = hurt ? -16 : 0;

  const y0 = 210;
  const sm = 16 * smile;
  const mouthLine = `M166 ${y0} Q200 ${y0 + sm} 234 ${y0}`;
  const mouthFill = `M168 ${y0} Q200 ${y0 + sm} 232 ${y0} Q200 ${y0 + sm + 12 + 56 * open} 168 ${y0} Z`;

  // Eyes shut while blinking, and while he is wincing.
  const eyesShut = blinking || hurt;

  /* ---- the per-frame bits ---- */
  const armLProps = useAnimatedProps(() => ({
    transform: `translate(190 360) rotate(${-arm.value})`,
  }));
  const armRProps = useAnimatedProps(() => ({
    transform: `translate(210 360) rotate(${arm.value})`,
  }));
  const headProps = useAnimatedProps(() => ({
    transform: `rotate(${tilt.value} 200 262)`,
  }));
  const pupilProps = useAnimatedProps(() => ({
    transform: `translate(${Math.max(-9, Math.min(9, eyes.value * 9))} 0)`,
  }));

  return (
    <Svg width={width} height={height} viewBox="0 0 400 640">
      <Defs>
        <LinearGradient id={S} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#ecd09a" />
          <Stop offset="0.45" stopColor="#fff3d6" />
          <Stop offset="1" stopColor="#cfa262" />
        </LinearGradient>
        <LinearGradient id={B} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#8a5a12" />
          <Stop offset="0.4" stopColor="#ffd978" />
          <Stop offset="0.6" stopColor="#e0a42c" />
          <Stop offset="1" stopColor="#7a4c0c" />
        </LinearGradient>
        <RadialGradient id={GL}>
          <Stop offset="0" stopColor="#fff3c4" stopOpacity="0.95" />
          <Stop offset="1" stopColor="#fff3c4" stopOpacity="0" />
        </RadialGradient>
        <ClipPath id="lcl">
          <Ellipse cx={155} cy={148} rx={31} ry={36} />
        </ClipPath>
        <ClipPath id="lcr">
          <Ellipse cx={245} cy={148} rx={31} ry={36} />
        </ClipPath>
      </Defs>

      {glow > 0 && (
        <Ellipse cx={200} cy={170} rx={250} ry={210} fill={`url(#${GL})`} opacity={glow} />
      )}

      {/* arms, behind the stem, swinging with him */}
      <AnimatedG animatedProps={armLProps}>
        <Path d="M0 0 Q -50 10 -86 56" stroke={`url(#${B})`} strokeWidth={16} fill="none" strokeLinecap="round" />
        <Circle cx={-88} cy={60} r={20} fill="#ffd978" stroke="#8a5a12" strokeWidth={4} />
      </AnimatedG>
      <AnimatedG animatedProps={armRProps}>
        <Path d="M0 0 Q 50 10 86 56" stroke={`url(#${B})`} strokeWidth={16} fill="none" strokeLinecap="round" />
        <Circle cx={88} cy={60} r={20} fill="#ffd978" stroke="#8a5a12" strokeWidth={4} />
      </AnimatedG>

      {/* body */}
      <Rect x={184} y={250} width={32} height={300} rx={8} fill={`url(#${B})`} />
      <Ellipse cx={200} cy={340} rx={38} ry={17} fill={`url(#${B})`} />
      <Ellipse cx={200} cy={440} rx={28} ry={13} fill={`url(#${B})`} />
      <Path d="M106 590 Q200 480 294 590 Z" fill={`url(#${B})`} />
      <Ellipse cx={200} cy={594} rx={118} ry={28} fill={`url(#${B})`} />

      {/* the shade, which arrives a moment after the rest of him */}
      <AnimatedG animatedProps={headProps}>
        <Path d="M112 40 H288 L362 262 H38 Z" fill={`url(#${S})`} stroke="#9c6f2b" strokeWidth={7} strokeLinejoin="round" />
        <Path d="M38 262 H362" stroke="#b5832f" strokeWidth={11} />
        <G stroke="#b5832f" strokeWidth={5}>
          {Array.from({ length: 18 }, (_, i) => (
            <Path key={i} d={`M${46 + i * 18.4} 268 V296`} />
          ))}
        </G>

        {blush > 0 && (
          <>
            <Ellipse cx={112} cy={198} rx={26} ry={14} fill="#ff8a8a" opacity={blush} />
            <Ellipse cx={288} cy={198} rx={26} ry={14} fill="#ff8a8a" opacity={blush} />
          </>
        )}

        {/* open eyes, following whatever is coming down */}
        {!happy && !eyesShut && (
          <G>
            <G clipPath="url(#lcl)">
              <Ellipse cx={155} cy={148} rx={31} ry={36} fill="#fff" />
              <AnimatedG animatedProps={pupilProps}>
                <Circle cx={155} cy={150} r={15} fill="#2a1a0c" />
                <Circle cx={160} cy={144} r={5} fill="#fff" />
              </AnimatedG>
            </G>
            <G clipPath="url(#lcr)">
              <Ellipse cx={245} cy={148} rx={31} ry={36} fill="#fff" />
              <AnimatedG animatedProps={pupilProps}>
                <Circle cx={245} cy={150} r={15} fill="#2a1a0c" />
                <Circle cx={250} cy={144} r={5} fill="#fff" />
              </AnimatedG>
            </G>
            <Ellipse cx={155} cy={148} rx={31} ry={36} fill="none" stroke="#3b2412" strokeWidth={5} />
            <Ellipse cx={245} cy={148} rx={31} ry={36} fill="none" stroke="#3b2412" strokeWidth={5} />
          </G>
        )}

        {/* shut: a blink, or a wince */}
        {!happy && eyesShut && (
          <G stroke="#3b2412" strokeWidth={8} fill="none" strokeLinecap="round">
            <Path d={hurt ? "M126 140 Q155 168 184 140" : "M126 148 L184 148"} />
            <Path d={hurt ? "M216 140 Q245 168 274 140" : "M216 148 L274 148"} />
          </G>
        )}

        {stars && (
          <G>
            <Path d="M155 122 l8 19 21 2 -16 13 6 21 -19 -11 -19 11 6 -21 -16 -13 21 -2 z" fill="#FFD700" />
            <Path d="M245 122 l8 19 21 2 -16 13 6 21 -19 -11 -19 11 6 -21 -16 -13 21 -2 z" fill="#FFD700" />
          </G>
        )}

        {happy && !stars && (
          <G stroke="#3b2412" strokeWidth={8} fill="none" strokeLinecap="round">
            <Path d="M126 156 Q155 122 184 156" />
            <Path d="M216 156 Q245 122 274 156" />
          </G>
        )}

        <Rect x={126} y={92} width={58} height={12} rx={6} fill="#3b2412" transform={`rotate(${brow} 155 98)`} />
        <Rect x={216} y={92} width={58} height={12} rx={6} fill="#3b2412" transform={`rotate(${-brow} 245 98)`} />

        {open > 0.06 && <Path d={mouthFill} fill="#7a1f1f" stroke="#3b2412" strokeWidth={6} strokeLinejoin="round" />}
        <Path d={mouthLine} fill="none" stroke="#3b2412" strokeWidth={7} strokeLinecap="round" />

        {magnet && (
          <G>
            <Rect x={112} y={122} width={84} height={50} rx={14} fill="#111" />
            <Rect x={204} y={122} width={84} height={50} rx={14} fill="#111" />
            <Rect x={190} y={132} width={20} height={10} fill="#111" />
            <Path d="M122 132 L150 132" stroke="#555" strokeWidth={6} strokeLinecap="round" />
            <Path d="M214 132 L242 132" stroke="#555" strokeWidth={6} strokeLinecap="round" />
          </G>
        )}
      </AnimatedG>
    </Svg>
  );
}
