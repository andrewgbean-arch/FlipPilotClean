import { Text } from "react-native";

interface SymbolViewProps {
  name: { ios: string; web: string };
  tintColor?: string;
  size?: number;
}

export function SymbolView({ name, tintColor, size = 14 }: SymbolViewProps) {
  return (
    <Text style={{ color: tintColor, fontSize: size }}>
      {name.web}
    </Text>
  );
}
