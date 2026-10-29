// Testing builds (eas.json "development", APP_VARIANT=development) are a separate app, "FlipPilot Dev",
// with their own id and link scheme, so they install beside the real FlipPilot instead of replacing it.
const DEV = process.env.APP_VARIANT === "development";

export default {
  expo: {
    name: DEV ? "FlipPilot Dev" : "FlipPilot UK",
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
        backgroundImage: "./assets/images/android-icon-background.png",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png"
      },
      predictiveBackGestureEnabled: false,
      package: DEV ? "com.flippilot.app.dev" : "com.flippilot.app",
      // Permissions the app's libraries or the Expo template add by default but FlipPilot never uses. Leaving them in makes
      // the Play listing ask for things it should not, and the foreground-service ones force a separate Play declaration.
      // Not in the development build, whose tooling needs the overlay. `npm run check:android` guards this list.
      blockedPermissions: DEV
        ? []
        : [
            "android.permission.SYSTEM_ALERT_WINDOW", // the template adds it for the debug overlay
            "android.permission.ACCESS_FINE_LOCATION", // the weather card asks for low accuracy only, so approximate location is enough
            "android.permission.USE_BIOMETRIC", // pulled in by the secure-store library; nothing here asks for a fingerprint or face
            "android.permission.USE_FINGERPRINT",
            "android.permission.FOREGROUND_SERVICE", // background audio is switched off below
            "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
            "android.permission.RECORD_AUDIO"
          ]
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
      // Android only: the app ignores the phone's "Bold text" setting so no text is cut off (reason in the plugin file).
      // `npm run check:boldoverride` guards it.
      "./plugins/withIgnoreBoldText",
      // Sounds, voices and the start-up video play while the app is open. No background playback, no recording, no
      // microphone: by default the audio plugin would add the microphone and a media foreground service.
      ["expo-video", { supportsBackgroundPlayback: false, supportsPictureInPicture: false }],
      [
        "expo-audio",
        {
          microphonePermission: false,
          recordAudioAndroid: false,
          enableBackgroundPlayback: false,
          enableBackgroundRecording: false
        }
      ],
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
