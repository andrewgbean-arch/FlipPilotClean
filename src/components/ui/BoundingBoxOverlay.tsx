import React from "react";
import { View, Text } from "react-native";

interface Box {
  label: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  boxes: Box[];
  theme: {
    goldDeep: string;
    black: string;
  };
}

export default function BoundingBoxOverlay({ boxes, theme }: Props) {
  return (
    <>
      {boxes.map((box: Box, idx: number) => (
        <View
          key={idx}
          style={{
            position: "absolute",
            left: box.x,
            top: box.y,
            width: box.width,
            height: box.height,
            borderWidth: 2,
            borderColor: theme.goldDeep,
            borderRadius: 6,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: theme.goldDeep,
              fontSize: 10,
              fontWeight: "700",
              backgroundColor: theme.black + "AA",
              paddingHorizontal: 4,
              borderRadius: 4,
            }}
          >
            {box.label} ({Math.round(box.confidence * 100)}%)
          </Text>
        </View>
      ))}
    </>
  );
}
