import { Linking, Pressable, PressableProps } from "react-native";

interface ExternalLinkProps extends PressableProps {
  href: string;
}

export function ExternalLink({ href, children, ...props }: ExternalLinkProps) {
  return (
    <Pressable onPress={() => Linking.openURL(href)} {...props}>
      {children}
    </Pressable>
  );
}
