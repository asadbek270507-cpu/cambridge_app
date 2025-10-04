// students_app/IELTS/LessonMaterialsScreen.js
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import YoutubePlayer from "react-native-youtube-iframe";
import { Video } from "expo-av";
import ImageViewing from "react-native-image-viewing";
import Ionicons from "@expo/vector-icons/Ionicons";
import Slider from "@react-native-community/slider";

import { doc, getDoc } from "firebase/firestore";
import { firestore } from "../../firebase";
import { getStorage, ref, getDownloadURL } from "firebase/storage";

import * as Linking from "expo-linking";
// Legacy FS – deprecation warning chiqmasin
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";

// 🔊 RN Track Player v3
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  State,
  RepeatMode,
  Event,
  usePlaybackState,
  useProgress,
} from "react-native-track-player";

const SCREEN_W = Dimensions.get("window").width;
const YT_HEIGHT = SCREEN_W * (9 / 16);

// ---------- helpers ----------
function getYoutubeId(url = "") {
  const m = url?.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{6,})/
  );
  return m ? m[1] : null;
}

async function resolveUrlMaybeGs(u) {
  if (!u) return null;
  if (u.startsWith("gs://")) {
    const storage = getStorage();
    return await getDownloadURL(ref(storage, u));
  }
  return u;
}

function formatTime(sec = 0) {
  const s = Math.max(0, Math.floor(sec % 60));
  const m = Math.max(0, Math.floor(sec / 60));
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

// ===================================================================

export default function MaterialsLevel({ route, navigation }) {
  const { partTitle, lessonId, lessonTitle, videoUrl: paramVideoUrl } =
    route.params || {};
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [ytId, setYtId] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);

  // ---- Audio (RNTP) ----
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioError, setAudioError] = useState(null);

  // Hooklar
  const playbackState = usePlaybackState();
  const progress = useProgress(250); // 4x/s yangilash

  // Slider drag holati
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  // Ba'zan useProgress.duration 0 bo'ladi — lokal duration bilan “backup”
  const [durationLocal, setDurationLocal] = useState(0);

  const [pdfUrl, setPdfUrl] = useState(null);
  const [answersUrl, setAnswersUrl] = useState(null);
  const [comments, setComments] = useState([]);
  const [title, setTitle] = useState(lessonTitle || "Dars materiali");

  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [images, setImages] = useState([]);

  // ---------------- RNTP: setup ----------------
  const setupPlayerIfNeeded = useCallback(async () => {
    try {
      const ready = await TrackPlayer.getCurrentTrack().then(() => true, () => false);
      if (!ready) {
        await TrackPlayer.setupPlayer({ waitForBuffer: true });
      }

     await TrackPlayer.updateOptions({
  capabilities: [
    Capability.Play,
    Capability.Pause,
    Capability.SeekTo,
    Capability.JumpBackward,
    Capability.JumpForward,
  ],
  notificationCapabilities: [
    Capability.Play,
    Capability.Pause,
    Capability.SeekTo,
    Capability.JumpBackward,
    Capability.JumpForward,
  ],
  compactCapabilities: [Capability.Play, Capability.Pause],
  progressUpdateEventInterval: 1,
  android: {
    appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
  },
  forwardJumpInterval: 15,   // ⏩ oldinga 15s
  backwardJumpInterval: 15,  // ⏪ orqaga 15s
});


      await TrackPlayer.setRepeatMode(RepeatMode.Off);
    } catch (e) {
      console.warn("TrackPlayer setup error:", e?.message || e);
      setAudioError(e?.message || String(e));
    }
  }, []);

  // ---------------- Firestore ----------------
  useEffect(() => {
    (async () => {
      try {
        if (!partTitle || !lessonId) {
          setLoading(false);
          return;
        }

        const lessonRef = doc(
          firestore,
          "multilevelMaterials",
          partTitle,
          "lessons",
          lessonId
        );
        const snap = await getDoc(lessonRef);

        if (snap.exists()) {
          const data = snap.data();

          // Video
          let v = data.videoUrl || paramVideoUrl || null;
          const id = getYoutubeId(v || "");
          if (id) {
            setYtId(id);
            setVideoUrl(null);
          } else if (v) {
            setVideoUrl(await resolveUrlMaybeGs(v));
          } else setVideoUrl(null);

          // Audio
          if (data.audioUrl) setAudioUrl(await resolveUrlMaybeGs(data.audioUrl));
          else setAudioUrl(null);

          if (data.pdfUrl) setPdfUrl(data.pdfUrl);
          if (data.imageUrl) setAnswersUrl(data.imageUrl);

          const commentsData = data.comment || "";
          setComments(Array.isArray(commentsData) ? commentsData : [commentsData]);

          if (data.title) setTitle(data.title);
        }
      } catch (e) {
        console.log("Dars yuklash xatosi:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [partTitle, lessonId, paramVideoUrl]);

  // ---------------- RNTP: queue tayyorlash ----------------
  const ensureLessonTrackLoaded = useCallback(
    async (url) => {
      if (!url) return false;
      try {
        await setupPlayerIfNeeded();

        const curId = await TrackPlayer.getCurrentTrack().catch(() => null);
        if (curId != null) {
          const meta = await TrackPlayer.getTrack(curId).catch(() => null);
          if (meta?.url === url) {
            await TrackPlayer.updateMetadataForTrack(curId, {
              title: title || "Audio",
              artist: "@Cambridge",
            }).catch(() => {});
            // Duration-ni ham olib qo'yamiz (progress.duration 0 bo'lsa)
            const d = await TrackPlayer.getDuration().catch(() => 0);
            if (d > 0) setDurationLocal(d);
            return true;
          }
        }

        // Faqat bitta trek bo‘lsin
        await TrackPlayer.reset();
        await TrackPlayer.add({
          id: `${lessonId || Date.now()}`,
          url,
          title: title || "Audio",
          artist: "@Cambridge",
        });

        // Track qo‘shilgach duration-ni olish (ba'zan kechikadi)
        const d = await TrackPlayer.getDuration().catch(() => 0);
        if (d > 0) setDurationLocal(d);
        return true;
      } catch (e) {
        console.warn("ensureLessonTrackLoaded error:", e?.message || e);
        setAudioError(e?.message || String(e));
        return false;
      }
    },
    [lessonId, title, setupPlayerIfNeeded]
  );

  // preload (play emas)
  useEffect(() => {
    (async () => {
      if (audioUrl) await ensureLessonTrackLoaded(audioUrl);
    })();
  }, [audioUrl, ensureLessonTrackLoaded]);

  // Duration hook 0 bo'lsa, vaqti-vaqti bilan RNTP'dan olib qo'yamiz
  useEffect(() => {
    let t;
    if ((progress.duration || 0) === 0 && audioUrl) {
      t = setInterval(async () => {
        const d = await TrackPlayer.getDuration().catch(() => 0);
        if (d > 0) {
          setDurationLocal(d);
          clearInterval(t);
        }
      }, 500);
    }
    return () => t && clearInterval(t);
  }, [progress.duration, audioUrl]);

  useFocusEffect(
    useCallback(() => {
      const s1 = TrackPlayer.addEventListener(Event.PlaybackState, () => {});
      const s2 = TrackPlayer.addEventListener(Event.PlaybackTrackChanged, async () => {
        const d = await TrackPlayer.getDuration().catch(() => 0);
        if (d > 0) setDurationLocal(d);
      });
      return () => {
        s1?.remove?.();
        s2?.remove?.();
      };
    }, [])
  );

  // ---------------- Controls ----------------
  const togglePlayPause = async () => {
    try {
      if (!audioUrl) return;
      const ok = await ensureLessonTrackLoaded(audioUrl);
      if (!ok) return;

      const st = await TrackPlayer.getPlaybackState();
      const stateVal = typeof st === "object" && st?.state != null ? st.state : st;

      if (stateVal === State.Playing || stateVal === State.Buffering || stateVal === State.Connecting) {
        await TrackPlayer.pause();
      } else {
        await TrackPlayer.play();
      }
    } catch (e) {
      console.warn("togglePlayPause error:", e?.message || e);
      setAudioError(e?.message || String(e));
    }
  };

  const handleSeekStart = () => {
    setIsSeeking(true);
    setSeekValue(Math.floor(progress.position || 0));
  };
  const handleSeekChange = (v) => setSeekValue(v);
  const handleSeekComplete = async (v) => {
    try {
      await TrackPlayer.seekTo(Math.max(0, v));
    } catch (_) {}
    setIsSeeking(false);
  };

  const jumpBy = async (delta) => {
    try {
      const pos = await TrackPlayer.getPosition();
      const dur = (progress.duration || durationLocal || 0) || 0;
      const next = Math.min(Math.max(0, pos + delta), dur > 0 ? dur : pos + delta);
      await TrackPlayer.seekTo(next);
    } catch (_) {}
  };

  const handleYoutubeError = useCallback(() => {
    if (ytId) Linking.openURL(`https://youtu.be/${ytId}`);
  }, [ytId]);

  // PDF — brauzer emas, app chooser
  const openPdf = useCallback(async (u) => {
    try {
      const url = await resolveUrlMaybeGs(u);
      if (!url) return;

      const tmp = FileSystem.cacheDirectory + `lesson_${Date.now()}.pdf`;
      const dl = await FileSystem.downloadAsync(url, tmp);

      if (Platform.OS === "android") {
        const contentUri = await FileSystem.getContentUriAsync(dl.uri);
        await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
          data: contentUri,
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
          type: "application/pdf",
        });
      } else {
        await Sharing.shareAsync(dl.uri, { UTI: "com.adobe.pdf" });
      }
    } catch (e) {
      console.warn("openPdf error:", e?.message || e);
      setAudioError("PDF ochishda muammo: " + (e?.message || e));
    }
  }, []);

  const openImage = useCallback(async (u) => {
    const url = await resolveUrlMaybeGs(u);
    if (!url) return;
    setImages([{ uri: url }]);
    setImageViewerVisible(true);
  }, []);

  // ---------- UI state ----------
  const durationSec = Math.max(0, Math.floor(progress.duration || durationLocal || 0));
  const positionSec = Math.max(0, Math.floor(progress.position || 0));
  const displayPos = isSeeking ? Math.floor(seekValue || 0) : positionSec;
  const showSlider = !!audioUrl && durationSec > 0;

  const stateVal =
    typeof playbackState === "object" && playbackState?.state != null
      ? playbackState.state
      : playbackState;

  const isPlaying =
    stateVal === State.Playing ||
    stateVal === State.Buffering ||
    stateVal === State.Connecting;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator size="large" style={{ marginTop: 50 }} />
      </SafeAreaView>
    );
  }

  // ===================================================================

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.lessonTitle}>{title}</Text>
      </View>

      {/* Video */}
      {ytId ? (
        <View style={styles.ytWrap}>
          <YoutubePlayer
            height={YT_HEIGHT}
            videoId={ytId}
            play={false}
            webViewProps={{
              allowsFullscreenVideo: true,
              javaScriptEnabled: true,
              domStorageEnabled: true,
              mediaPlaybackRequiresUserAction: false,
              thirdPartyCookiesEnabled: true,
              setSupportMultipleWindows: false,
              androidLayerType: "hardware",
            }}
            onError={handleYoutubeError}
          />
        </View>
      ) : videoUrl ? (
        <View style={styles.videoContainer}>
          <Video source={{ uri: videoUrl }} style={styles.video} useNativeControls resizeMode="contain" />
        </View>
      ) : (
        <View style={styles.noVideo}><Text style={styles.noVideoText}>Video mavjud emas.</Text></View>
      )}

      {/* ===== Telegram-style AUDIO BUBBLE ===== */}
      <View style={styles.tgBubble}>
        <View style={styles.tgRow}>
          <TouchableOpacity
            style={[styles.tgPlayBtn, !audioUrl && { opacity: 0.5 }]}
            onPress={togglePlayPause}
            disabled={!audioUrl}
            activeOpacity={0.8}
          >
            <Ionicons name={isPlaying ? "pause" : "play"} size={22} color="#0A4BD9" />
          </TouchableOpacity>

          <View style={styles.tgRight}>
            <Text numberOfLines={1} style={styles.tgTitle}>
              {title || "Audio"}
            </Text>

            {audioError ? <Text style={styles.tgErr}>{audioError}</Text> : null}

            {/* Jump -15 / +15 */}
            <View style={styles.jumpRow}>
              <TouchableOpacity style={styles.jumpBtn} onPress={() => jumpBy(-15)}>
                <Ionicons name="play-back" size={18} color="#0A4BD9" />
                <Text style={styles.jumpTxt}>15s</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.jumpBtn} onPress={() => jumpBy(15)}>
                <Ionicons name="play-forward" size={18} color="#0A4BD9" />
                <Text style={styles.jumpTxt}>15s</Text>
              </TouchableOpacity>
            </View>

            {showSlider ? (
              <>
                <Slider
                  minimumValue={0}
                  maximumValue={durationSec}
                  value={displayPos}
                  onSlidingStart={handleSeekStart}
                  onValueChange={handleSeekChange}
                  onSlidingComplete={handleSeekComplete}
                  minimumTrackTintColor="#0A4BD9"
                  maximumTrackTintColor="#c9d7ff"
                  thumbTintColor="#0A4BD9"
                />
                <View style={styles.tgTimes}>
                  <Text style={styles.tgTime}>{formatTime(displayPos)}</Text>
                  <Text style={styles.tgTime}>{formatTime(durationSec)}</Text>
                </View>
              </>
            ) : (
              <Text style={styles.tgTimeMuted}>0:00</Text>
            )}
          </View>
        </View>
      </View>

      {/* PDF / Answers */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={() => openPdf(pdfUrl)}>
          <Text style={styles.buttonText}>PDF Book</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => openImage(answersUrl)}>
          <Text style={styles.buttonText}>Answers / Rasm</Text>
        </TouchableOpacity>
      </View>

      {/* Comments */}
      <ScrollView style={styles.commentsContainer}>
        <Text style={styles.commentsTitle}>Kommentlar:</Text>
        {comments.length > 0 ? (
          comments.map((c, i) => <Text key={i} style={styles.commentText}>- {c}</Text>)
        ) : (
          <Text style={styles.commentText}>Kommentlar mavjud emas.</Text>
        )}
      </ScrollView>

      {/* Image Viewer */}
      <ImageViewing
        images={images}
        imageIndex={0}
        visible={imageViewerVisible}
        onRequestClose={() => setImageViewerVisible(false)}
      />
    </SafeAreaView>
  );
}

// ===================================================================

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    backgroundColor: "#fff",
  },
  backButton: { marginRight: 12 },
  lessonTitle: { fontSize: 20, fontWeight: "700", color: "#0f172a" },

  ytWrap: {
    margin: 16,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  videoContainer: {
    height: SCREEN_W * (9 / 16),
    margin: 16,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  video: { flex: 1 },

  noVideo: {
    height: 220,
    margin: 16,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fee2e2",
  },
  noVideoText: { color: "#b91c1c", fontSize: 16 },

  // ===== Bubble =====
  tgBubble: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#EAF1FF",
  },
  tgRow: { flexDirection: "row", alignItems: "center" },
  tgPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  tgRight: { flex: 1 },
  tgTitle: { fontWeight: "700", color: "#0a204a" },

  jumpRow: {
    marginTop: 6,
    flexDirection: "row",
    gap: 10,
  },
  jumpBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f6ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  jumpTxt: { marginLeft: 4, color: "#0A4BD9", fontWeight: "600", fontSize: 12 },

  tgTimes: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  tgTime: { color: "#263b7f", fontSize: 12, fontWeight: "600" },
  tgTimeMuted: { color: "#97a5d8", fontSize: 12, marginTop: 6 },
  tgErr: { color: "#b91c1c", marginTop: 6 },

  // Buttons
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
  },
  actionButton: {
    flex: 0.48,
    backgroundColor: "#0f172a",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600" },

  commentsContainer: { flex: 1, paddingHorizontal: 16, marginTop: 8 },
  commentsTitle: { fontWeight: "700", fontSize: 16, marginBottom: 8 },
  commentText: { fontSize: 14, marginBottom: 6, color: "#333" },
});
