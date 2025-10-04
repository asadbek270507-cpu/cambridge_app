// app.config.js
export default ({ config }) => ({
  expo: {
    name: "Cambridge School",
    slug: "Cambridge_School",
    owner: "asadbek270507",

    // JS entry
    entryPoint: "./index.js",

    platforms: ["ios", "android"],
    scheme: "cambridge-school",
    version: "1.0.0",
    runtimeVersion: config.version,

    orientation: "portrait",
    icon: "./assets/Cambridge_logo.png",
    userInterfaceStyle: "light",

    newArchEnabled: false,

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
    },

    android: {
      package: "com.rcsai.cambridgeschool.dev",
      // EAS buildda FILE ENV; lokalda esa fayl ishlaydi:
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ?? "./android/app/google-services.json",
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
        "android.permission.BLUETOOTH_CONNECT",
        "android.permission.BLUETOOTH_SCAN",
        "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
        "android.permission.MODIFY_AUDIO_SETTINGS",
      ],
    },

    extra: {
      // 🔗 EAS project: @asadbek270507/Cambridge_School
      eas: { projectId: "4abff30e-a432-4baf-a029-6130ac2b4c35" },
    },

    plugins: [
      "expo-system-ui",
      ["expo-notifications", { icon: "./assets/Cambridge_logo.png", color: "#1565C0" }],
      [
        "expo-image-picker",
        {
          photosPermission: "Galereyadan rasm/video tanlash uchun ruxsat berasizmi?",
          cameraPermission: "Kameradan foydalanish uchun ruxsat berasizmi?",
        },
      ],
      "expo-media-library",
      "expo-audio",
      "expo-video",
      [
        "expo-build-properties",
        {
          android: {
            // EAS log’iga mos: SDK 36 toolchain
            minSdkVersion: 24,
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            buildToolsVersion: "36.0.0",
            // ✅ KSP mos Kotlin
            kotlinVersion: "2.1.20",
            usesCleartextTraffic: true,
          },
          ios: {},
        },
      ],
      "expo-web-browser",
      // RN Track Player uchun alohida plugin shart emas (autolinking)
    ],

    updates: {},
  },
});
