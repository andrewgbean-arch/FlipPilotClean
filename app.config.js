export default {
  expo: {
    name: "flippilot-new",
    slug: "flippilot-new",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "flippilotnew",
    userInterfaceStyle: "automatic",
    assetBundlePatterns: ["**/*"],
    ios: {
      icon: "./assets/expo.icon"
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png"
      },
      predictiveBackGestureEnabled: false,
      package: "com.anonymous.flippilotnew"
    },
    web: {
      output: "single",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      [
        "expo-splash-screen",
        {
          backgroundColor: "#208AEF",
          android: {
            image: "./assets/images/splash-icon.png",
            imageWidth: 76
          }
        }
      ],
      "expo-sharing",
      "expo-router",
      "expo-image",
      "expo-camera"
    ],
    experiments: {
      typedRoutes: false,
      reactCompiler: true
    },
    extra: {
      eas: {
        projectId: "2ce83690-2a04-49f2-b650-7564f72926a1"
      }
    }
  }
}
