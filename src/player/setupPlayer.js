// src/player/setupPlayer.js
import TrackPlayer, {
  Capability,
  AppKilledPlaybackBehavior, // <-- kerak
} from 'react-native-track-player';

let didSetup = false;

export async function ensurePlayer() {
  // allaqachon sozlangan bo‘lsa, hech narsa qilmaymiz
  if (didSetup) return;
  try {
    const q = await TrackPlayer.getQueue();
    if (q && Array.isArray(q)) {
      didSetup = true;
      return;
    }
  } catch {}

  await TrackPlayer.setupPlayer();

  await TrackPlayer.updateOptions({
    stopWithApp: false, // ilova backgroundda ham ijro etsin
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SeekTo,
      // Capability.SkipToNext,      // faqat navbatda keyingi trek bo‘lsa qo‘ying
      // Capability.SkipToPrevious,  // xuddi shunday
      Capability.Stop,
    ],
    compactCapabilities: [Capability.Play, Capability.Pause, Capability.SeekTo],
    progressUpdateEventInterval: 0.5, // s, 0.5–1.0 tavsiya
    android: {
      appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
    },
    // ixtiyoriy (iOS):
    // ios: { category: 'playback' },
  });

  didSetup = true;
}
