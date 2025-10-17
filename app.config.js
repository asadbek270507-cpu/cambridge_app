import fs from "fs";
import path from "path";

const PROJECT_ID = "d2a970c5-f9d0-4390-8127-590381556704";

export default ({ config }) => {
  // Prebuild jarayonida google-services.json faylini joyiga ko‘chirish
  const srcPath = path.resolve("android/app/google-services.json");
  const destPath = path.join(process.cwd(), "android/app/google-services.json");

  try {
    if (fs.existsSync(srcPath)) {
      console.log("✅ google-services.json found. Ensuring it's in place...");
      fs.copyFileSync(srcPath, destPath);
    } else {
      console.warn("⚠️ google-services.json not found at:", srcPath);
    }
  } catch (error) {
    console.error("❌ Error copying google-services.json:", error);
  }

  return {
    expo: {
      name: "Cambridge School",
      slug: "Cambridge_School",
      owner: "asadbek12",

      entryPoint: "./index.js",
      platforms: ["ios", "android"],
      scheme: "cambridge-school",

      version: "1.0.0",
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

      updates: {
        enabled: true,
        url: `https://u.expo.dev/${PROJECT_ID}`,
        checkAutomatically: "ON_LOAD",
        fallbackToCacheTimeout: 0
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
        package: "com.rcsai.cambridge_admin",
        googleServicesFile: "./android/app/google-services.json",
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
              manifest: {
                "meta-data[name=com.google.firebase.messaging.default_notification_color]": {
                  tools: "replace",
                  resource: "@color/notification_icon_color"
                },
                "meta-data[name=com.google.firebase.messaging.default_notification_icon]": {
                  tools: "replace",
                  resource: "@drawable/notification_icon"
                }
              }
            },
            ios: {}
          }
        ]
      ]
    }
  };
};
