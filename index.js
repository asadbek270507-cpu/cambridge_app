import "react-native-gesture-handler";
import "expo-dev-client";

import { registerRootComponent } from "expo";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import TrackPlayer from "react-native-track-player";
import App from "./App";

// --- Global notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Debug logs (optional)
Notifications.addNotificationReceivedListener((n) => {
  console.log("🔔 Received (foreground):", JSON.stringify(n));
});
Notifications.addNotificationResponseReceivedListener((r) => {
  console.log("📝 Tapped:", JSON.stringify(r));
});

// Android channel
if (Platform.OS === "android") {
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

// TrackPlayer service
TrackPlayer.registerPlaybackService(() => require("./trackPlayerService"));

// Launch App
registerRootComponent(App);
