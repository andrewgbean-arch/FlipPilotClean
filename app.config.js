export default {
  expo: {
    name: "FlipPilot",
    slug: "flippilot-new",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "flippilotnew",
    // The app is dark-only for now, so keep system UI (keyboard, alerts) dark to match.
    userInterfaceStyle: "dark",
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
          backgroundColor: "#0A1128",
          android: {
            image: "./assets/images/splash-icon.png",
            imageWidth: 76
          }
        }
      ],
      "expo-sharing",
      "expo-router",
      "expo-image",
      [
        "expo-camera",
        {
          cameraPermission: "FlipPilot uses the camera to scan barcodes and photograph items you want to value.",
          microphonePermission: false,
          recordAudioAndroid: false
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "FlipPilot uses your photos so you can add pictures to your flips and listings.",
          cameraPermission: "FlipPilot uses the camera so you can take pictures for your flips and listings.",
          microphonePermission: false
        }
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission: "FlipPilot uses your location to show the weather near you for boot fair trips."
        }
      ]
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
