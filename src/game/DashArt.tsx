import React from "react";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

/**
 * The stuff that falls down the screen.
 *
 * A bargain is warm, gold-rimmed and glowing. Tat is grey, cracked, and has a
 * fly buzzing round it. That is three separate cues — colour, shape and glow —
 * because a five-year-old and a grandad both have to read it in half a second
 * without anybody reading a word.
 */

const BRASS = "gBrass";
const SHADE = "gShade";

function ItemDefs() {
  return (
    <Defs>
      <LinearGradient id={BRASS} x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#8a5a12" />
        <Stop offset="0.4" stopColor="#ffd978" />
        <Stop offset="0.6" stopColor="#e0a42c" />
        <Stop offset="1" stopColor="#7a4c0c" />
      </LinearGradient>
      <LinearGradient id={SHADE} x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#ecd09a" />
        <Stop offset="0.45" stopColor="#fff3d6" />
        <Stop offset="1" stopColor="#cfa262" />
      </LinearGradient>
    </Defs>
  );
}

const brass = `url(#${BRASS})`;
const shade = `url(#${SHADE})`;

/** Each drawing lives in a 100x100 box. */
const ART: Record<string, React.ReactNode> = {
  lamp: (
    <>
      <Path d="M22 62 H78 L70 86 H30 Z" fill={brass} stroke="#8a5a12" strokeWidth={3} />
      <Rect x={45} y={30} width={10} height={34} rx={4} fill={brass} />
      <Path d="M30 14 H70 L82 44 H18 Z" fill={shade} stroke="#9c6f2b" strokeWidth={3} />
    </>
  ),
  vinyl: (
    <>
      <Circle cx={50} cy={50} r={38} fill="#14121a" stroke="#3a3547" strokeWidth={3} />
      <Circle cx={50} cy={50} r={24} fill="none" stroke="#2b2636" strokeWidth={2} />
      <Circle cx={50} cy={50} r={12} fill={brass} />
      <Circle cx={50} cy={50} r={3} fill="#0A1128" />
    </>
  ),
  camera: (
    <>
      <Rect x={14} y={30} width={72} height={46} rx={8} fill="#2f2a3a" stroke={brass} strokeWidth={3} />
      <Rect x={34} y={20} width={30} height={12} rx={4} fill="#3b3550" />
      <Circle cx={50} cy={53} r={17} fill="#141220" stroke={brass} strokeWidth={4} />
      <Circle cx={50} cy={53} r={7} fill="#6ec6ff" opacity={0.65} />
      <Circle cx={74} cy={39} r={4} fill="#FFD700" />
    </>
  ),
  watch: (
    <>
      <Circle cx={50} cy={54} r={30} fill={shade} stroke={brass} strokeWidth={5} />
      <Rect x={45} y={14} width={10} height={12} rx={4} fill={brass} />
      <Path d="M50 54 V36 M50 54 L64 62" stroke="#3b2412" strokeWidth={4} strokeLinecap="round" />
    </>
  ),
  teapot: (
    <>
      <Path d="M26 44 H70 Q80 64 62 78 H34 Q16 64 26 44 Z" fill={shade} stroke="#9c6f2b" strokeWidth={3} />
      <Path d="M70 52 Q88 56 76 70" stroke={brass} strokeWidth={6} fill="none" strokeLinecap="round" />
      <Path d="M26 52 Q8 58 22 66" stroke={brass} strokeWidth={6} fill="none" strokeLinecap="round" />
      <Ellipse cx={48} cy={42} rx={14} ry={5} fill={brass} />
    </>
  ),
  trainers: (
    <>
      <Path d="M12 68 Q16 46 36 46 L52 58 Q74 58 84 68 L84 76 H12 Z" fill="#f4f1ea" stroke="#9c6f2b" strokeWidth={3} />
      <Path d="M12 76 H84" stroke={brass} strokeWidth={6} />
      <Path d="M36 48 L54 60" stroke="#e0a42c" strokeWidth={4} />
    </>
  ),
  ring: (
    <>
      <Circle cx={50} cy={58} r={24} fill="none" stroke={brass} strokeWidth={9} />
      <Path d="M50 20 l7 15 16 2 -12 11 4 16 -15 -9 -15 9 4 -16 -12 -11 16 -2 z" fill="#FFF3C4" />
    </>
  ),
  console: (
    <>
      <Rect x={16} y={36} width={68} height={40} rx={10} fill="#2a2440" stroke={brass} strokeWidth={3} />
      <Circle cx={33} cy={56} r={8} fill="#0A1128" />
      <Path d="M33 50 V62 M27 56 H39" stroke="#FFD700" strokeWidth={3} />
      <Circle cx={64} cy={50} r={4} fill="#FFD700" />
      <Circle cx={74} cy={58} r={4} fill="#FFD700" />
      <Circle cx={64} cy={66} r={4} fill="#FFD700" />
      <Circle cx={54} cy={58} r={4} fill="#FFD700" />
    </>
  ),
  plate: (
    <>
      <Circle cx={50} cy={54} r={34} fill={shade} stroke={brass} strokeWidth={4} />
      <Circle cx={50} cy={54} r={22} fill="none" stroke="#c99b4e" strokeWidth={2} />
      <Path d="M40 54 q10 -14 20 0 q-10 14 -20 0z" fill="#8fb8e0" opacity={0.8} />
    </>
  ),
  spoons: (
    <>
      <G stroke={brass} strokeWidth={6} strokeLinecap="round" fill="none">
        <Path d="M34 78 L40 40" />
        <Path d="M50 78 L52 38" />
        <Path d="M66 78 L62 40" />
      </G>
      <Ellipse cx={40} cy={30} rx={10} ry={13} fill={shade} stroke="#9c6f2b" strokeWidth={3} />
      <Ellipse cx={52} cy={28} rx={10} ry={13} fill={shade} stroke="#9c6f2b" strokeWidth={3} />
      <Ellipse cx={63} cy={30} rx={10} ry={13} fill={shade} stroke="#9c6f2b" strokeWidth={3} />
    </>
  ),

  /* ---- tat: grey, damaged, unappealing ---- */
  mug: (
    <>
      <Path d="M28 34 H66 V72 Q66 80 56 80 H38 Q28 80 28 72 Z" fill="#6f6a63" stroke="#4b4741" strokeWidth={3} />
      <Path d="M66 44 Q84 48 74 64" stroke="#5d5952" strokeWidth={6} fill="none" />
      <Path d="M44 34 L50 52 L42 60 L50 76" stroke="#332f2b" strokeWidth={3} fill="none" />
    </>
  ),
  tape: (
    <>
      <Rect x={16} y={34} width={68} height={42} rx={6} fill="#5f5a54" stroke="#413d38" strokeWidth={3} />
      <Circle cx={36} cy={55} r={9} fill="#38342f" />
      <Circle cx={64} cy={55} r={9} fill="#38342f" />
      <Path d="M14 30 Q34 20 26 44 Q44 34 38 52" stroke="#2f2c28" strokeWidth={3} fill="none" />
    </>
  ),
  shoe: (
    <>
      <Path d="M12 70 Q18 50 38 52 L54 62 Q74 62 82 72 L82 78 H12 Z" fill="#5c5750" stroke="#403c37" strokeWidth={3} />
      <Path d="M40 54 L56 64" stroke="#332f2b" strokeWidth={3} />
      <Path d="M62 66 q6 -8 12 0" stroke="#2e2b27" strokeWidth={3} fill="none" />
    </>
  ),
  plant: (
    <>
      <Path d="M32 54 H68 L62 80 H38 Z" fill="#6b5f4f" stroke="#473f34" strokeWidth={3} />
      <Path
        d="M50 54 V26 M50 36 Q38 30 34 20 M50 40 Q62 34 68 24"
        stroke="#5b6b4a"
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
  tin: (
    <>
      <Rect x={26} y={30} width={48} height={50} rx={5} fill="#6d5a45" stroke="#473a2c" strokeWidth={3} />
      <Ellipse cx={50} cy={30} rx={24} ry={7} fill="#7d6a52" stroke="#473a2c" strokeWidth={3} />
      <Circle cx={38} cy={50} r={4} fill="#4a3b2b" />
      <Circle cx={60} cy={62} r={5} fill="#4a3b2b" />
    </>
  ),
};

/** An umbrella: not a bargain, it keeps one bit of tat off him. Bright blue, so it reads as neither. */
const UMBRELLA_ART = (
  <>
    <Circle cx={50} cy={52} r={44} fill="rgba(110,190,255,0.18)" />
    <Path d="M12 50 Q50 6 88 50 Q79 43 69 50 Q59 43 50 50 Q41 43 31 50 Q21 43 12 50 Z" fill="#4FA3FF" stroke="#1d5fa8" strokeWidth={3} />
    <Path d="M50 50 V80 q0 8 -8 8 q-7 0 -7 -7" stroke="#e8eef8" strokeWidth={5} fill="none" strokeLinecap="round" />
    <Path d="M50 12 V6" stroke="#1d5fa8" strokeWidth={4} strokeLinecap="round" />
  </>
);

/**
 * The tell on a fake: a crooked red tag with a question mark. A genuine bargain has a warm glow and
 * no tag, so there are two differences to spot, not one tiny one.
 */
function FakeTag() {
  return (
    <G transform="rotate(-16 74 26)">
      <Path d="M56 10 H96 V42 H56 L46 26 Z" fill="#d6453d" stroke="#7a1d18" strokeWidth={3} />
      <Circle cx={56} cy={26} r={3.2} fill="#7a1d18" />
      <Path d="M70 20 q0 -6 6 -6 q6 0 6 6 q0 4.5 -6 6 v4.5" stroke="#fff" strokeWidth={3.6} fill="none" strokeLinecap="round" />
      <Circle cx={76} cy={36} r={2.2} fill="#fff" />
    </G>
  );
}

/** The fly that hangs around anything not worth having. */
function Fly() {
  return (
    <G opacity={0.9}>
      <Path d="M78 22 q8 -6 12 2" stroke="#8d8578" strokeWidth={2} fill="none" />
      <Circle cx={90} cy={26} r={3} fill="#8d8578" />
    </G>
  );
}

export default function ItemArt({
  kindId,
  tat,
  golden,
  size,
  fake = false,
}: {
  kindId: string;
  tat: boolean;
  golden: boolean;
  size: number;
  /** A fake bargain: drawn like the real thing, without the glow, and with a wonky red tag. */
  fake?: boolean;
}) {
  if (kindId === "umbrella") {
    return (
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {UMBRELLA_ART}
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <ItemDefs />
      {golden && !fake && <Circle cx={50} cy={52} r={46} fill="rgba(255,215,0,0.24)" />}
      {!tat && !fake && <Circle cx={50} cy={52} r={42} fill="rgba(255,215,0,0.10)" />}
      {ART[kindId] ?? ART.teapot}
      {tat && <Fly />}
      {fake && <FakeTag />}
    </Svg>
  );
}
