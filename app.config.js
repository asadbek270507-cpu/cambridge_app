// app.config.js
export default ({ config }) => ({
  expo: {
    name: "Cambridge School",
    slug: "Cambridge_School",
    platforms: ["ios", "android"],
    scheme: "cambridge-school",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/Cambridge_logo.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/Cambridge_logo.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    notification: { color: "#1565C0" },

    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.rcsai.cambridgeschool",
      jsEngine: "hermes",
      infoPlist: {
        NSPhotoLibraryUsageDescription:
          "Ilovangiz galereyangizdan rasm va video tanlash uchun ruxsat so'raydi.",
        NSCameraUsageDescription:
          "Ilovangiz rasmga olish yoki video yozish uchun kamerangizga ruxsat so'raydi.",
        NSMicrophoneUsageDescription:
          "Ilovangiz ovozli xabar yozish uchun mikrofoningizga ruxsat so'raydi.",
        ITSAppUsesNonExemptEncryption: false,
        UIBackgroundModes: ["audio"],
      },
      runtimeVersion: { policy: "appVersion" },
    },

    android: {
      newArchEnabled: true,
      package: "com.rcsai.cambridgeschool.dev",
      // EAS file env'dan olamiz (GOOGLE_SERVICES_JSON ni env sifatida yaratgansiz)
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON,
      jsEngine: "hermes",
      softwareKeyboardLayoutMode: "pan",
      adaptiveIcon: {
        foregroundImage: "./assets/Cambridge_logo.png",
        backgroundColor: "#ffffff",
      },
      permissions: [
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.RECORD_AUDIO",
        "android.permission.CAMERA",
        "android.permission.READ_MEDIA_AUDIO",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.WAKE_LOCK",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
        "android.permission.BLUETOOTH",
        "android.permission.BLUETOOTH_ADMIN",
        "android.permission.BLUETOOTH_CONNECT",
        "android.permission.BLUETOOTH_SCAN",
        "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
        "android.permission.MODIFY_AUDIO_SETTINGS",
      ],
      runtimeVersion: "1.0.0",
    },

    extra: {
      eas: { projectId: "4abff30e-a432-4baf-a029-6130ac2b4c35" },
    },

    plugins: [
      "expo-system-ui",
      [
        "expo-notifications",
        { icon: "./assets/Cambridge_logo.png", color: "#1565C0" },
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Galereyadan rasm/video tanlash uchun ruxsat berasizmi?",
          cameraPermission: "Kameradan foydalanish uchun ruxsat berasizmi?",
        },
      ],
      "expo-media-library",
      "expo-av",
      [
        "expo-build-properties",
        { android: { usesCleartextTraffic: true } },
      ],
      // expo install sizga qo‘shishni aytgan plugin:
      "expo-web-browser",
    ],

    updates: {},
  },
});
