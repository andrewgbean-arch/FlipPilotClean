import { View, type ViewProps } from 'react-native';
import { useThemeColor } from '../../../hooks/use-theme-color';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  ...otherProps
}: ThemedViewProps) {
  const backgroundColor = useThemeColor(
    { light: lightColor, dark: darkColor },
    'background'
  );

  return (
    <View
      style={[
        // ⭐ Only apply backgroundColor if user explicitly passes lightColor/darkColor
        lightColor || darkColor ? { backgroundColor } : null,
        style,
      ]}
      {...otherProps}
    />
  );
}

