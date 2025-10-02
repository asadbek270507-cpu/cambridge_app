// index.js
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import 'expo-dev-client';

import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';

// Hermes/dev-clientda ba’zan global.require bo‘lmaydi
if (!globalThis.require && globalThis.__r) {
  globalThis.require = globalThis.__r;
}

import App from './App';

// Ilovani ro‘yxatdan o‘tkazish
registerRootComponent(App);

// Background media notification servisini ro‘yxatdan o‘tkazish
// (service/trackPlayerService.js ichida RemotePlay/Pause/Seek va boshqalar bor)
TrackPlayer.registerPlaybackService(() => require('./service/trackPlayerService'));
