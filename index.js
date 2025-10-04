// index.js (ROOT)
import "react-native-gesture-handler";
import "expo-dev-client";

import { registerRootComponent } from "expo";
import TrackPlayer from "react-native-track-player";
import App from "./App";

// 🚨 Servisni App'dan OLDIN ro‘yxatdan o‘tkazamiz
TrackPlayer.registerPlaybackService(() => require("./trackPlayerService"));

registerRootComponent(App);
