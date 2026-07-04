import { View, StyleSheet } from "react-native";
import { Video, ResizeMode } from "expo-av";

export default function Intro() {
  return (
    <View style={styles.container}>
      <Video
       source={require("../../assets/videos/intro.mp4")}

        style={styles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  video: { width: "100%", height: "100%" },
});
