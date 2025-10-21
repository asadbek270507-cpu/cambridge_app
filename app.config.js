// app.config.js
const PROJECT_ID = "9e64fca1-314b-4365-aea8-781e8dddd77e";

export default () => ({
  expo: {
    name: "Cambridge School",
    slug: "Cambridge_School",
    owner: "asadbek717",

    // JS entry
    entryPoint: "./index.js",

    platforms: ["ios", "android"],
    scheme: "cambridge-school",

    // App version
    version: "1.0.0",

    updates: {
      enabled: true,
      url: `https://u.expo.dev/${PROJECT_ID}`,
      checkAutomatically: "ON_LOAD",
      fallbackToCacheTimeout: 0
    },

runtimeVersion: "1.0.0",

    orientation: "portrait",
    icon: "./assets/Cambridge_logo.png",
    userInterfaceStyle: "light",
    newArchEnabled: false,

    splash: {
      image: "./assets/Cambridge_logo.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },

   

    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.cambridgeschool",
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
      notifications: { color: "#1565C0" },
      package: "com.cambridge.app",
      // Agar siz google-services.json faylini repo ichida saqlayotgan bo'lsangiz:
      googleServicesFile: "./android/app/google-services.json",
      // Agar faylni EAS environment variable orqali taqdim etmoqchi bo'lsangiz,
      // shuni o'rniga quyidagicha yozing:
      // googleServicesFile: process.env.GOOGLE_SERVICES_JSON,
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
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            buildToolsVersion: "36.0.0",
            usesCleartextTraffic: true,
            // =======================================================================
            // BU YERDA YECHIM. MANIFEST MERGERGA TO'G'RIDAN TO'G'RI BUYRUQ BERISH.
            // =======================================================================
            manifest: {
                // notification_color ziddiyatini majburan yechish.
                "meta-data[name=com.google.firebase.messaging.default_notification_color]": {
                  tools: "replace",
                  resource: "@color/notification_icon_color"
                },
                // notification_icon ziddiyatini majburan yechish.
                "meta-data[name=com.google.firebase.messaging.default_notification_icon]": {
                  tools: "replace",
                  resource: "@drawable/notification_icon"
                }
            }
            // =======================================================================
          },
          ios: {}
        }
      ]
    ]
  }
});
