import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Linking,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import YoutubePlayer from "react-native-youtube-iframe";
import Ionicons from "react-native-vector-icons/Ionicons";
import { Audio } from 'expo-audio';
import { Video } from 'expo-video'; 

const SCREEN_W = Dimensions.get("window").width;
const YT_H = SCREEN_W * (9 / 16);

// YouTube ID ajratish
function getYoutubeId(url = "") {
  const m = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{6,})/
  );
  return m ? m[1] : null;
}

export default function LessonMaterials({ route, navigation }) {
  const { videoUrl, comments, lessonTitle } = route.params || {};
  const insets = useSafeAreaInsets();

  const ytId = getYoutubeId(videoUrl || "");
  // Faqat keng tarqalgan kengaytmalar: .mp4, .mov, ...
  const isDirectVideo = !!(
    videoUrl &&
    /\.(mp4|mov|webm|m4v|avi|mkv)(\?.*)?$/i.test(videoUrl)
  );

  const openOnError = useCallback(() => {
    if (ytId) Linking.openURL(`https://youtu.be/${ytId}`);
  }, [ytId]);

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.lessonTitle}>{lessonTitle || "Dars materiali"}</Text>
      </View>

      {/* Video blok */}
      {ytId ? (
        <View style={styles.videoWrap}>
          <YoutubePlayer
            height={YT_H}
            videoId={ytId}
            play={false}
            initialPlayerParams={{
              controls: true,
              modestbranding: true,
              rel: false,
            }}
            webViewProps={{
              allowsFullscreenVideo: true,
              javaScriptEnabled: true,
              domStorageEnabled: true,
              mediaPlaybackRequiresUserAction: false,
              thirdPartyCookiesEnabled: true,
              setSupportMultipleWindows: false,
              androidLayerType: "hardware",
            }}
            onError={openOnError} // 153 bo‘lsa — YouTube’da ochadi
          />
        </View>
      ) : isDirectVideo ? (
        <View style={styles.videoWrap}>
          <Video
            source={{ uri: videoUrl }}
            style={{ flex: 1 }}
            useNativeControls
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
        {Array.isArray(comments) && comments.length > 0 ? (
          comments.map((c, i) => (
            <Text key={i} style={styles.commentText}>
              - {c}
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

  videoWrap: {
    height: SCREEN_W * (9 / 16),
    margin: 16,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
  },

  noVideo: {
    height: 220,
    margin: 16,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fee2e2",
  },
  noVideoText: { color: "#b91c1c", fontSize: 16 },

  commentsContainer: { flex: 1, paddingHorizontal: 16, marginTop: 8 },
  commentsTitle: { fontWeight: "700", fontSize: 16, marginBottom: 8 },
  commentText: { fontSize: 14, marginBottom: 6, color: "#333" },
});
