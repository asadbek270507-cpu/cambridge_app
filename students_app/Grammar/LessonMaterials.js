import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import Video from "react-native-video";
import Ionicons from "react-native-vector-icons/Ionicons";

export default function LessonMaterials({ route, navigation }) {
  const { videoUrl, comments, lessonTitle } = route.params || {};
  const insets = useSafeAreaInsets();

  // YouTube linkini embed formatga o‘zgartiruvchi funksiya
  function getYoutubeEmbedUrl(url) {
    if (!url) return null;
    const regex =
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]+)/;
    const match = url.match(regex);
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}?autoplay=0&controls=1`;
    }
    return null;
  }

  const embedUrl = getYoutubeEmbedUrl(videoUrl);

  // Video fayl ekanligini tekshirish (serverdan ham ishlaydi)
  const isDirectVideo =
    videoUrl &&
    (/\.(mp4|mov|webm|m4v|avi|mkv)(\?.*)?$/i.test(videoUrl) || videoUrl.startsWith("http"));

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.lessonTitle}>
          {lessonTitle || "Dars materiali"}
        </Text>
      </View>

      {/* Video qismi */}
      {embedUrl ? (
        <View style={styles.videoContainer}>
          <WebView
            source={{ uri: embedUrl }}
            style={styles.webview}
            allowsFullscreenVideo
            mediaPlaybackRequiresUserAction={false}
          />
        </View>
      ) : isDirectVideo ? (
        <View style={styles.videoContainer}>
          <Video
            source={{ uri: videoUrl }}
            style={styles.webview}
            controls
            resizeMode="contain"
          />
        </View>
      ) : (
        <View style={styles.noVideo}>
          <Text style={styles.noVideoText}>Video mavjud emas.</Text>
        </View>
      )}

      {/* Kommentlar */}
      <ScrollView style={styles.commentsContainer}>
        <Text style={styles.commentsTitle}>Kommentlar:</Text>
        {comments && comments.length > 0 ? (
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
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    backgroundColor: "#fff",
  },
  backButton: {
    marginRight: 12,
  },
  lessonTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  videoContainer: {
    height: Dimensions.get("window").width * (9 / 16),
    margin: 16,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  webview: {
    flex: 1,
  },
  noVideo: {
    height: 220,
    margin: 16,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fee2e2",
  },
  noVideoText: {
    color: "#b91c1c",
    fontSize: 16,
  },
  commentsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  commentsTitle: {
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 8,
  },
  commentText: {
    fontSize: 14,
    marginBottom: 6,
    color: "#333",
  },
});
