import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Video, Audio } from "expo-av";
import Ionicons from "react-native-vector-icons/Ionicons";
import Slider from "@react-native-community/slider";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "../../firebase";
import { getStorage, ref, getDownloadURL } from "firebase/storage";

export default function MaterialsLevel({ route, navigation }) {
  const { partTitle, lessonId, lessonTitle, videoUrl: paramVideoUrl } = route.params || {};
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [answersUrl, setAnswersUrl] = useState(null);
  const [comments, setComments] = useState([]);
  const [title, setTitle] = useState(lessonTitle || "Dars materiali");

  const soundRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  // 📌 PDF ochish
  const openPdf = async (url) => {
    if (!url) {
      Alert.alert("Xatolik", "PDF mavjud emas");
      return;
    }
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Xatolik", "PDF faylni ochib bo‘lmadi");
      }
    } catch (err) {
      console.error("PDF ochishda xatolik:", err);
      Alert.alert("Xatolik", "Faylni ochishda muammo bo‘ldi");
    }
  };

  // 📌 Rasm ochish
  const openImage = async (url) => {
    if (!url) {
      Alert.alert("Xatolik", "Rasm mavjud emas");
      return;
    }
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Xatolik", "Rasmni ochib bo‘lmadi");
      }
    } catch (err) {
      console.error("Rasm ochishda xatolik:", err);
      Alert.alert("Xatolik", "Faylni ochishda muammo bo‘ldi");
    }
  };

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

          // Video
          let video = data.videoUrl || paramVideoUrl || null;
          const getYoutubeEmbedUrl = (url) => {
            if (!url) return null;
            const regex = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]+)/;
            const match = url.match(regex);
            return match && match[1] ? `https://www.youtube.com/embed/${match[1]}?autoplay=0&controls=1` : null;
          };
          const embedUrl = getYoutubeEmbedUrl(video);
          if (embedUrl) setVideoUrl(embedUrl);
          else if (video && video.startsWith("gs://")) {
            const storageRef = ref(getStorage(), video);
            const downloadUrl = await getDownloadURL(storageRef);
            setVideoUrl(downloadUrl);
          } else setVideoUrl(video);

          // Audio
          if (data.audioUrl) {
            let audio = data.audioUrl;
            if (audio.startsWith("gs://")) {
              const audioRef = ref(getStorage(), audio);
              const audioDownloadUrl = await getDownloadURL(audioRef);
              setAudioUrl(audioDownloadUrl);
            } else setAudioUrl(audio);
          }

          // PDF / Answers
          if (data.pdfUrl) setPdfUrl(data.pdfUrl);
          if (data.answersUrl) setAnswersUrl(data.answersUrl);

          // Comments
          const commentsData = data.comment || "";
          setComments(Array.isArray(commentsData) ? commentsData : [commentsData]);
          if (data.title) setTitle(data.title);
        }
      } catch (err) {
        console.error("Darsni olishda xato:", err);
      }
      setLoading(false);
    };

    fetchLessonData();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, [partTitle, lessonId, paramVideoUrl]);

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

  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setDuration(status.durationMillis);
      if (status.didJustFinish) setIsPlaying(false);
    }
  };

  const handleSliderChange = async (value) => {
    if (soundRef.current) {
      await soundRef.current.setPositionAsync(value);
    }
  };

  const formatTime = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  const isDirectVideo = videoUrl && !videoUrl.startsWith("https://www.youtube.com");
  const isYoutube = videoUrl && videoUrl.startsWith("https://www.youtube.com");

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
      {isYoutube ? (
        <View style={styles.videoContainer}>
          <WebView source={{ uri: videoUrl }} style={styles.webview} allowsFullscreenVideo />
        </View>
      ) : isDirectVideo ? (
        <View style={styles.videoContainer}>
          <Video source={{ uri: videoUrl }} style={styles.webview} useNativeControls resizeMode="contain" />
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

      {/* PDF / Answers Buttons */}
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
  videoContainer: {
    height: Dimensions.get("window").width * (9 / 16),
    margin: 16,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  webview: { flex: 1 },
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
