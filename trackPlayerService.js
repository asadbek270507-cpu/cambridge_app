// trackPlayerService.js (ROOT)

// CommonJS export: module.exports = async () => {...}
// Shunda index.js dagi `require("./trackPlayerService")` to‘g‘ri ishlaydi.
const TrackPlayer = require("react-native-track-player").default;
const { Event } = require("react-native-track-player");

module.exports = async function () {
  // ▶️ / ⏸
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());

  // ⏪ / ⏩ (15s)
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async ({ interval }) => {
    const pos = await TrackPlayer.getPosition();
    await TrackPlayer.seekTo(Math.max(0, pos - (interval || 15)));
  });
  TrackPlayer.addEventListener(Event.RemoteJumpForward, async ({ interval }) => {
    const pos = await TrackPlayer.getPosition();
    await TrackPlayer.seekTo(pos + (interval || 15));
  });

  // 🎚 Seek (notif slider)
  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) => {
    if (typeof position === "number") {
      TrackPlayer.seekTo(Math.max(0, position));
    }
  });
};
