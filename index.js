// index.js (ROOT) — B U T U N L A Y    Y A N G I
import "react-native-gesture-handler";
import "expo-dev-client";

import { registerRootComponent } from "expo";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import TrackPlayer from "react-native-track-player";
import App from "./App";

// --- Expo Notifications: foreground’dayam ko‘rsatish ---
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,   // banner ko‘rsat
    shouldPlaySound: true,   // ovoz chal
    shouldSetBadge: false,
  }),
});

// (ixtiyoriy) Debug loglar:
Notifications.addNotificationReceivedListener((n) => {
  console.log("🔔 Received (foreground):", JSON.stringify(n));
});
Notifications.addNotificationResponseReceivedListener((r) => {
  console.log("📝 Tapped:", JSON.stringify(r));
});

// ANDROID: default notification channel (Oreo+)
if (Platform.OS === "android") {
  // promiselarni kutmasak ham bo‘ladi
  Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  }).catch((e) => console.warn("Channel create failed:", e?.message || String(e)));
}

// --- Track Player servisini RO'YXATDAN O'TKAZISH (root componentdan oldin!) ---
TrackPlayer.registerPlaybackService(() => require("./trackPlayerService"));

// --- App’ni ishga tushirish ---
registerRootComponent(App);
