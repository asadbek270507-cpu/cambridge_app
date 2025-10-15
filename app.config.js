// app.config.js
const PROJECT_ID = "a1575b7f-8b30-49f0-bef2-94250a5af081";

export default () => ({
  expo: {
    name: "Cambridge School",
    slug: "Cambridge_School",
    owner: "asadbek2705",

    // JS entry
    entryPoint: "./index.js",

    platforms: ["ios", "android"],
    scheme: "cambridge-school",

    // ❗ App versiyasi — EAS Update runtimeVersion siyosati bilan bog'liq
    version: "1.0.0",

    // ✅ EAS Update yoqildi: build qayta qilmasdan OTA yuborish uchun
    updates: {
      enabled: true,
      url: `https://u.expo.dev/${PROJECT_ID}`,
      checkAutomatically: "ON_LOAD",
      fallbackToCacheTimeout: 0
    },

    // ✅ Bir xil appVersion bo'lsa, OTA keladi (native o'zgarish bo'lsa versiyani oshirasiz)
    runtimeVersion: { policy: "appVersion" },

    orientation: "portrait",
    icon: "./assets/Cambridge_logo.png",
    userInterfaceStyle: "light",
    newArchEnabled: false,

    splash: {
      image: "./assets/Cambridge_logo.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
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
        UIBackgroundModes: ["audio"]
      }
    },

    android: {
      package: "com.rcsai.cambridgeschool.dev",
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ?? "./android/app/google-services.json",
      jsEngine: "hermes",
      softwareKeyboardLayoutMode: "pan",

      adaptiveIcon: {
        foregroundImage: "./assets/Cambridge_logo.png",
        backgroundColor: "#ffffff"
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
        "android.permission.MODIFY_AUDIO_SETTINGS"
      ]
    },

    // ✅ EAS projectId (expo-updates ham shundan foydalanadi)
    extra: {
      eas: { projectId: PROJECT_ID }
    },

    plugins: [
      "expo-system-ui",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#1565C0",
          iosDisplayInForeground: true
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission:
            "Galereyadan rasm/video tanlash uchun ruxsat berasizmi?",
          cameraPermission: "Kameradan foydalanish uchun ruxsat berasizmi?"
        }
      ],
      "expo-media-library",
      [
        "expo-build-properties",
        {
          android: {
            minSdkVersion: 24,
            compileSdkVersion: 34,
            targetSdkVersion: 34,
            usesCleartextTraffic: true
          },
          ios: {}
        }
      ]
    ]
  }
});
