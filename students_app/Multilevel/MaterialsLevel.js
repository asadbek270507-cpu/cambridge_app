// screens/LessonMaterialsScreen.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
// WebView importini endi tashqi kutubxona ichida ishlatamiz, bevosita kerak emas
// import { WebView } from "react-native-webview";
import YoutubePlayer from "react-native-youtube-iframe";
import { Video, Audio } from "expo-av";
import Ionicons from "react-native-vector-icons/Ionicons";
import Slider from "@react-native-community/slider";

import { doc, getDoc } from "firebase/firestore";
import { firestore } from "../../firebase";
import { getStorage, ref, getDownloadURL } from "firebase/storage";

import * as WebBrowser from "expo-web-browser";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import * as Linking from "expo-linking";
import * as Sharing from "expo-sharing";
import ImageViewing from "react-native-image-viewing";

const SCREEN_W = Dimensions.get("window").width;
const YT_HEIGHT = SCREEN_W * (9 / 16);

function getYoutubeId(url = "") {
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{6,})/
  );
  return m ? m[1] : null;
}

export default function MaterialsLevel({ route, navigation }) {
  const { partTitle, lessonId, lessonTitle, videoUrl: paramVideoUrl } = route.params || {};
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [ytId, setYtId] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null); // direct mp4 link bo‘lsa
  const [audioUrl, setAudioUrl] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [answersUrl, setAnswersUrl] = useState(null);
  const [comments, setComments] = useState([]);
  const [title, setTitle] = useState(lessonTitle || "Dars materiali");

  // Image viewer
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [images, setImages] = useState([]);

  // Audio
  const soundRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  /* ------------ Helpers ------------ */
  const openPdf = async (url) => {
    try {
      if (!url) return Alert.alert("Xatolik", "PDF mavjud emas");

      let remoteUrl = url;
      if (url.startsWith("gs://")) remoteUrl = await getDownloadURL(ref(getStorage(), url));

      if (Platform.OS === "android") {
        try {
          await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
            data: remoteUrl,
            type: "application/pdf",
          });
          return;
        } catch (_) {
          try {
            const localPath = `${FileSystem.cacheDirectory}temp.pdf`;
            const { uri } = await FileSystem.downloadAsync(remoteUrl, localPath);
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "PDF-ni ochish" });
              return;
            }
          } catch {}
          const viewer = `https://drive.google.com/viewerng/viewer?embedded=true&url=${encodeURIComponent(remoteUrl)}`;
          await WebBrowser.openBrowserAsync(viewer);
          return;
        }
      }

      const localPath = `${FileSystem.cacheDirectory}temp.pdf`;
      let fileUri = remoteUrl;
      if (!remoteUrl.startsWith("file://")) {
        const { uri } = await FileSystem.downloadAsync(remoteUrl, localPath);
        fileUri = uri;
      }
      const canOpen = await Linking.canOpenURL(fileUri);
      if (canOpen) return Linking.openURL(fileUri);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
          dialogTitle: "PDF-ni ochish",
        });
        return;
      }
      const viewer = `https://drive.google.com/viewerng/viewer?embedded=true&url=${encodeURIComponent(remoteUrl)}`;
      await WebBrowser.openBrowserAsync(viewer);
    } catch (err) {
      console.error("PDF ochishda xatolik:", err);
      Alert.alert("Xatolik", "PDF-ni ochishda muammo bo‘ldi.");
    }
  };

  const openImage = async (url) => {
    if (!url) return Alert.alert("Xatolik", "Rasm mavjud emas");
    try {
      let finalUrl = url;
      if (url.startsWith("gs://")) finalUrl = await getDownloadURL(ref(getStorage(), url));
      setImages([{ uri: finalUrl }]);
      setImageViewerVisible(true);
    } catch {
      Alert.alert("Xatolik", "Rasmni ochib bo‘lmadi.");
    }
  };

  /* ------------ Fetch lesson ------------ */
  useEffect(() => {
    const fetchLessonData = async () => {
      try {
        if (!partTitle || !lessonId) {
          setLoading(false);
          return;
        }

        const lessonRef = doc(firestore, "multilevelMaterials", partTitle, "lessons", lessonId);
        const snap = await getDoc(lessonRef);

        if (snap.exists()) {
          const data = snap.data();

          // Video (YouTube yoki to‘g‘ridan to‘g‘ri)
          let video = data.videoUrl || paramVideoUrl || null;
          const id = getYoutubeId(video || "");
          if (id) {
            setYtId(id);
            setVideoUrl(null);
          } else if (video) {
            if (video.startsWith("gs://")) {
              const vRef = ref(getStorage(), video);
              video = await getDownloadURL(vRef);
            }
            setVideoUrl(video);
          }

          // Audio
          if (data.audioUrl) {
            let audio = data.audioUrl;
            if (audio.startsWith("gs://")) {
              const aRef = ref(getStorage(), audio);
              audio = await getDownloadURL(aRef);
            }
            setAudioUrl(audio);
          }

          // PDF / Answers
          if (data.pdfUrl) setPdfUrl(data.pdfUrl);
          if (data.imageUrl) setAnswersUrl(data.imageUrl);

          // Comments
          const commentsData = data.comment || "";
          setComments(Array.isArray(commentsData) ? commentsData : [commentsData]);

          if (data.title) setTitle(data.title);
        }
      } catch (err) {
        console.error("Darsni olishda xato:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLessonData();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, [partTitle, lessonId, paramVideoUrl]);

  /* ------------ Audio controls ------------ */
  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis || 0);
      setDuration(status.durationMillis || 0);
      if (status.didJustFinish) setIsPlaying(false);
    }
  };

  const handleAudioPlayPause = async () => {
    if (!audioUrl) return;
    if (!soundRef.current) {
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } else {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    }
  };

  const handleSliderChange = async (value) => {
    if (soundRef.current) await soundRef.current.setPositionAsync(value);
  };

  const formatTime = (ms = 0) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  // YouTube xato bo‘lsa — brauzer/ilovada ochish
  const handleYoutubeError = useCallback(() => {
    if (ytId) Linking.openURL(`https://youtu.be/${ytId}`);
  }, [ytId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator size="large" color="#B71C1C" style={{ marginTop: 50 }} />
      </SafeAreaView>
    );
  }

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
          <Video
            source={{ uri: videoUrl }}
            style={styles.video}
            useNativeControls
            resizeMode="contain"
          />
        </View>
      ) : (
        <View style={styles.noVideo}>
          <Text style={styles.noVideoText}>Video mavjud emas.</Text>
        </View>
      )}

      {/* Audio */}
      <View style={styles.audioContainer}>
        <TouchableOpacity style={styles.audioButton} onPress={handleAudioPlayPause}>
          <Ionicons name={isPlaying ? "pause" : "play"} size={28} color="#fff" />
          <Text style={styles.audioText}>{audioUrl ? "Audio pleer" : "Audio mavjud emas"}</Text>
        </TouchableOpacity>
        {audioUrl && (
          <View style={{ marginTop: 8 }}>
            <Slider
              minimumValue={0}
              maximumValue={duration || 0}
              value={position}
              onSlidingComplete={handleSliderChange}
              minimumTrackTintColor="#B71C1C"
              maximumTrackTintColor="#ccc"
              thumbTintColor="#B71C1C"
            />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text>{formatTime(position)}</Text>
              <Text>{formatTime(duration)}</Text>
            </View>
          </View>
        )}
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
          comments.map((comment, index) => (
            <Text key={index} style={styles.commentText}>
              - {comment}
            </Text>
          ))
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

  ytWrap: { margin: 16, borderRadius: 12, overflow: "hidden", backgroundColor: "#000" },
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

  audioContainer: { marginHorizontal: 16, marginBottom: 12 },
  audioButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#B71C1C",
    padding: 12,
    borderRadius: 12,
  },
  audioText: { color: "#fff", marginLeft: 12, fontWeight: "600" },

  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 16,
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
