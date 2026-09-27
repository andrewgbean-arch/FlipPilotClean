import React from "react";
import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop } from "react-native-svg";

/**
 * The boot fair behind him: a row of stalls and a line of bunting.
 *
 * It is drawn once and never moves, so it costs nothing per frame. Its whole
 * job is to stop the screen reading as a plain dark rectangle — you should be
 * able to tell where you are before anything has fallen.
 */
export default function Backdrop({
  width,
  height,
  sky = ["#2a2145", "#111938"],
}: {
  width: number;
  height: number;
  /** The top and middle of the sky: the rounds of a day move from dawn towards noon. */
  sky?: [string, string];
}) {
  const stalls = [];
  for (let i = 0; i < 8; i++) {
    const x = -20 + i * (width / 6.4);
    const h = 120 + ((i * 37) % 60);
    stalls.push(
      <Rect key={`s${i}`} x={x} y={height - h} width={width / 7} height={h} rx={6} fill="#141d42" opacity={0.85} />
    );
    stalls.push(
      <Path
        key={`r${i}`}
        d={`M${x - 6} ${height - h} h${width / 7 + 12} l-8 16 h-${width / 7 - 4} z`}
        fill={i % 2 ? "#1d2a5c" : "#222f66"}
      />
    );
  }

  const flags = [];
  const flagColours = ["#E0A42C", "#8fb8e0", "#c0603a", "#FFD700"];
  for (let i = 0; i < 12; i++) {
    const x = i * (width / 11);
    const y = 104 + Math.sin(i * 0.9) * 10;
    flags.push(
      <Path key={`f${i}`} d={`M${x} ${y} l14 0 l-7 16 z`} fill={flagColours[i % 4]} opacity={0.55} />
    );
  }

  return (
    <Svg width={width} height={height} style={{ position: "absolute" }}>
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={sky[0]} />
          <Stop offset="0.55" stopColor={sky[1]} />
          <Stop offset="1" stopColor="#070c1d" />
        </LinearGradient>
      </Defs>

      <Rect x={0} y={0} width={width} height={height} fill="url(#sky)" />
      <Path
        d={`M0 108 Q ${width / 2} 136 ${width} 108`}
        stroke="rgba(255,243,214,0.18)"
        strokeWidth={2}
        fill="none"
      />
      {flags}
      {stalls}
      {/* warm pool of light on the ground where he stands */}
      <Ellipse cx={width / 2} cy={height} rx={width * 0.8} ry={70} fill="rgba(255,215,0,0.06)" />
    </Svg>
  );
}
