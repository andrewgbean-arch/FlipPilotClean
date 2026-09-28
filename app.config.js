// Testing builds (eas.json "development", APP_VARIANT=development) are a separate app, "FlipPilot Dev",
// with their own id and link scheme, so they install beside the real FlipPilot instead of replacing it.
const DEV = process.env.APP_VARIANT === "development";

export default {
  expo: {
    name: DEV ? "FlipPilot Dev" : "FlipPilot",
    slug: "flippilot-new",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/app-icon.png",
    scheme: DEV ? "flippilotdev" : "flippilotnew",
    // The app is dark-only for now, so keep system UI (keyboard, alerts) dark to match.
    userInterfaceStyle: "dark",
    assetBundlePatterns: ["**/*"],
    ios: {
      icon: "./assets/images/app-icon.png",
      // Permanent once the app is published. Keep in step with android.package.
      bundleIdentifier: DEV ? "com.flippilot.app.dev" : "com.flippilot.app"
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#0A1128",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png"
      },
      predictiveBackGestureEnabled: false,
      package: DEV ? "com.flippilot.app.dev" : "com.flippilot.app"
    },
    web: {
      output: "single",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 240,
          resizeMode: "contain",
          backgroundColor: "#0A1128"
        }
      ],
      "expo-sharing",
      "expo-router",
      "expo-image",
      "expo-video",
      "expo-audio",
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
